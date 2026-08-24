"""
lib/integrity_checks.py
=======================
The three check classes the 2026-08-03 audit found missing, plus step
failures. Every existing health check measures PRESENCE (fill rate, row
count, exceptions); these measure CORRECTNESS.

Why this exists — the record of what "green" hid:
  * NSE value_cr inflated 1e5x for months (column 100% populated → green)
  * 2,104 NSE symbols dropped daily (1,334 rows arrived consistently →
    green); `unmatched_count` was ALREADY written to
    km_pipeline_runs.metadata every run and nothing ever read it
  * dot_svd/dot_sbd/dot_syd all-FALSE universe-wide since 2026-04-06
    (columns populated, just degenerate → green)
  * symbol_enrichment raised before its script every night, for weeks
  * a partial 2026-08-05 monthly bar served as "August" for 3 weeks

Each check returns Finding objects; the caller persists them to
km_integrity_findings (migration 178) and dispatches alerts. Checks are
pure reads — they never mutate.

Adding a check: write a `check_*` function returning list[Finding] and
add it to ALL_CHECKS. Keep every threshold a named constant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Optional

# ── Thresholds (calibration = edit here) ─────────────────────────────────
UNMATCHED_WARN_PCT      = 5.0     # parsed-but-not-inserted share that warrants a warning
UNMATCHED_CRIT_PCT      = 20.0    # ... and one that is an outright bug
VALUE_CR_TOLERANCE      = 0.25    # |value_cr - volume*close/1e7| / expected
VALUE_CR_SAMPLE         = 400     # rows sampled for the invariant
VALUE_CR_BAD_SHARE      = 0.10    # share of sampled rows off-tolerance that trips it
STALE_SIGNAL_DAYS       = 5       # a boolean column with zero TRUE for this many
                                  # trading days across the whole universe is degenerate
SIGNAL_COLUMNS          = ['dot_svd', 'dot_sbd', 'dot_syd',
                           'is_vani_s2', 'is_vani_breakout', 'is_vani_smart']
WEEKLY_MAX_AGE_DAYS     = 10      # newest weekly bar older than this = missed aggregation
MONTHLY_MAX_AGE_DAYS    = 40      # newest monthly bar older than this = missed aggregation


@dataclass
class Finding:
    check_key: str
    check_class: str            # reconciliation | invariant | staleness | step_failure
    severity: str               # critical | warning | info
    summary: str
    subject: Optional[str] = None
    metric: Optional[float] = None
    expected: Optional[float] = None
    detail: dict[str, Any] = field(default_factory=dict)


def _rows(conn, sql: str, params=None) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


# ── 1. Reconciliation — parsed vs inserted ───────────────────────────────
# CASH-EQUITY series only. Measured 2026-08-24: NSE parses ~3,676 symbols
# and drops 279 (7.6%) — every single one a debt/bond series (GB, GS, TB,
# N0-NZ, SG, Y*, Z*), i.e. correct behaviour. A raw unmatched% check would
# cry wolf daily and get muted, which is how a real gap hides. Scoring the
# EQ/BE/BZ/SM/ST series alone keeps the check silent today AND would have
# fired on day one of the full-universe gap, when the dropped symbols were
# ordinary EQ stocks.
CASH_EQUITY_SERIES = {'EQ', 'BE', 'BZ', 'SM', 'ST'}


def check_reconciliation(conn, run_date: date) -> list[Finding]:
    """Read the unmatched_by_series the pipeline already writes and nobody reads."""
    out: list[Finding] = []
    rows = _rows(conn, """
        SELECT trade_date, exchange,
               (metadata->>'parsed_count')::numeric,
               (metadata->>'unmatched_count')::numeric,
               (metadata->>'matched_count')::numeric,
               metadata->'unmatched_by_series'
        FROM km_pipeline_runs
        WHERE trade_date >= %s
          AND metadata ? 'unmatched_count'
        ORDER BY trade_date DESC, exchange
    """, (run_date - timedelta(days=3),))

    for trade_date, exchange, parsed, unmatched, matched, by_series in rows:
        if not parsed or parsed <= 0 or unmatched is None:
            continue

        # Score only the cash-equity series. No breakdown (BSE) → fall back
        # to the raw count, which is 0 there.
        if isinstance(by_series, dict):
            eq_dropped = sum(int(v) for k, v in by_series.items()
                             if k.upper() in CASH_EQUITY_SERIES)
            basis = 'cash-equity series'
        else:
            eq_dropped = int(unmatched)
            basis = 'all series (no breakdown recorded)'

        if eq_dropped == 0:
            continue
        denom = float(matched or parsed) + eq_dropped
        pct = eq_dropped / denom * 100.0 if denom > 0 else 0.0
        if pct < UNMATCHED_WARN_PCT:
            continue
        sev = 'critical' if pct >= UNMATCHED_CRIT_PCT else 'warning'
        out.append(Finding(
            check_key=f'reconciliation_{exchange or "na"}_{trade_date}',
            check_class='reconciliation', severity=sev,
            subject=f'{exchange} bhavcopy',
            summary=(f'{exchange} {trade_date}: {eq_dropped:,} cash-equity symbols were parsed but '
                     f'never inserted ({pct:.1f}% of the equity universe)'),
            metric=round(pct, 2), expected=0.0,
            detail={'trade_date': str(trade_date), 'exchange': exchange,
                    'parsed': float(parsed), 'unmatched_total': float(unmatched),
                    'unmatched_cash_equity': eq_dropped, 'basis': basis,
                    'by_series': by_series if isinstance(by_series, dict) else None},
        ))
    return out


# ── 2. Invariants / plausibility ─────────────────────────────────────────

def check_value_cr_invariant(conn, run_date: date) -> list[Finding]:
    """value_cr must be ~ volume x close / 1e7. This is the exact shape of
    the 1e5x NSE inflation that ran green for months."""
    rows = _rows(conn, """
        SELECT s.exchange,
               COUNT(*) AS n,
               COUNT(*) FILTER (
                 WHERE ABS(e.value_cr - (e.volume::numeric * e.close / 1e7))
                       > %s * GREATEST(e.volume::numeric * e.close / 1e7, 0.01)
               ) AS bad
        FROM km_equity_eod e
        JOIN km_equity_symbols s ON s.id = e.equity_id
        WHERE e.trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
          AND e.value_cr IS NOT NULL AND e.volume > 0 AND e.close > 0
        GROUP BY s.exchange
    """, (VALUE_CR_TOLERANCE,))

    out: list[Finding] = []
    for exchange, n, bad in rows:
        if not n:
            continue
        share = float(bad) / float(n)
        if share <= VALUE_CR_BAD_SHARE:
            continue
        out.append(Finding(
            check_key=f'invariant_value_cr_{exchange}',
            check_class='invariant', severity='critical',
            subject=f'km_equity_eod.value_cr ({exchange})',
            summary=(f'{exchange}: {bad:,} of {n:,} rows ({share*100:.0f}%) have value_cr that does '
                     f'not match volume x close / 1e7'),
            metric=round(share * 100, 1), expected=0.0,
            detail={'exchange': exchange, 'rows': int(n), 'off_tolerance': int(bad),
                    'tolerance': VALUE_CR_TOLERANCE},
        ))
    return out


def check_period_bars(conn, run_date: date) -> list[Finding]:
    """Weekly/monthly aggregates must be aligned and current:
      - no bar for a period that is still in progress (the partial-bar bug)
      - the newest bar must not be stale (a missed aggregation run)
      - weekly bulk bars must land on Fridays
    """
    out: list[Finding] = []

    # -- newest bars
    (wk_max,), = _rows(conn, 'SELECT MAX(trade_date) FROM km_equity_weekly')
    (mo_max,), = _rows(conn, 'SELECT MAX(trade_date) FROM km_equity_monthly')

    if wk_max is not None:
        age = (run_date - wk_max).days
        if age > WEEKLY_MAX_AGE_DAYS:
            out.append(Finding(
                check_key='weekly_stale', check_class='invariant', severity='critical',
                subject='km_equity_weekly',
                summary=f'Newest weekly bar is {age} days old ({wk_max}) — an aggregation run was missed',
                metric=age, expected=WEEKLY_MAX_AGE_DAYS,
                detail={'newest_bar': str(wk_max)}))
        if wk_max.isoweekday() != 5:
            out.append(Finding(
                check_key='weekly_not_friday', check_class='invariant', severity='warning',
                subject='km_equity_weekly',
                summary=f'Newest weekly bar {wk_max} is a {wk_max.strftime("%A")}, not a Friday — '
                        f'likely a partial week written by a forced run',
                detail={'newest_bar': str(wk_max), 'weekday': wk_max.strftime('%A')}))

    if mo_max is not None:
        age = (run_date - mo_max).days
        if age > MONTHLY_MAX_AGE_DAYS:
            out.append(Finding(
                check_key='monthly_stale', check_class='invariant', severity='critical',
                subject='km_equity_monthly',
                summary=f'Newest monthly bar is {age} days old ({mo_max}) — an aggregation run was missed',
                metric=age, expected=MONTHLY_MAX_AGE_DAYS,
                detail={'newest_bar': str(mo_max)}))
        # A monthly bar inside the CURRENT month means a month-to-date bar
        # is masquerading as complete (the 2026-08-05 bug).
        if mo_max >= run_date.replace(day=1):
            n_rows = _rows(conn, 'SELECT COUNT(*) FROM km_equity_monthly WHERE trade_date = %s',
                           (mo_max,))[0][0]
            out.append(Finding(
                check_key='monthly_partial_bar', check_class='invariant', severity='critical',
                subject='km_equity_monthly',
                summary=(f'{n_rows:,} monthly bars dated {mo_max} sit inside the current, incomplete '
                         f'month — a month-to-date bar is being served as the monthly bar'),
                metric=n_rows, expected=0,
                detail={'bar_date': str(mo_max), 'rows': int(n_rows)}))

    return out


# ── 3. Signal staleness — degenerate columns ─────────────────────────────

def check_signal_staleness(conn, run_date: date) -> list[Finding]:
    """A boolean signal column with zero TRUE across the entire universe
    for N trading days is degenerate — populated, so every fill-rate check
    reads green, while the feature that depends on it is silently dead
    (dot_svd/sbd/syd were all-FALSE from 2026-04-06 and nothing noticed)."""
    dates = [d for (d,) in _rows(conn, """
        SELECT DISTINCT trade_date FROM km_equity_eod
        ORDER BY trade_date DESC LIMIT %s
    """, (STALE_SIGNAL_DAYS,))]
    if not dates:
        return []

    out: list[Finding] = []
    for col in SIGNAL_COLUMNS:
        try:
            (true_count,), = _rows(conn, f"""
                SELECT COUNT(*) FROM km_equity_eod
                WHERE trade_date = ANY(%s) AND {col} IS TRUE
            """, (dates,))
        except Exception:
            continue  # column not present on this deployment — not a finding
        if true_count == 0:
            out.append(Finding(
                check_key=f'stale_signal_{col}', check_class='staleness', severity='warning',
                subject=f'km_equity_eod.{col}',
                summary=(f'{col} has been FALSE for every stock on the last '
                         f'{len(dates)} trading days — the signal is populated but dead'),
                metric=0, expected=1,
                detail={'column': col, 'days_checked': len(dates),
                        'from': str(min(dates)), 'to': str(max(dates))}))
    return out


# ── 4. Step failures — nothing alerts on these today ─────────────────────

def check_step_failures(conn, run_date: date) -> list[Finding]:
    """Any pipeline job that failed in the last 36 hours (km_jobs is where
    pipeline2 records dimension outcomes). Nothing alerts on these today —
    symbol_enrichment raised every night for weeks in silence."""
    rows = _rows(conn, """
        SELECT j.dimension, j.status, COALESCE(j.error_msg, ''), j.trade_date
        FROM km_jobs j
        WHERE j.created_at >= NOW() - INTERVAL '36 hours'
          AND j.status IN ('failed', 'error')
        ORDER BY j.dimension, j.trade_date DESC
    """)
    out: list[Finding] = []
    for dimension, status, err, trade_date in rows:
        sev = 'critical' if status == 'failed' else 'warning'
        out.append(Finding(
            check_key=f'step_{dimension}_{trade_date}',
            check_class='step_failure', severity=sev,
            subject=dimension,
            summary=f'Pipeline step {dimension} on {trade_date}: {status}'
                    + (f' — {err[:160]}' if err else ''),
            detail={'dimension': dimension, 'status': status,
                    'trade_date': str(trade_date), 'error': err[:500]}))
    return out


ALL_CHECKS = [
    check_reconciliation,
    check_value_cr_invariant,
    check_period_bars,
    check_signal_staleness,
    check_step_failures,
]


def run_all(conn, run_date: date) -> list[Finding]:
    """Run every check; a check that itself blows up becomes a finding
    rather than killing the sweep (a broken checker must never mask the
    thing it was watching)."""
    findings: list[Finding] = []
    for fn in ALL_CHECKS:
        try:
            findings.extend(fn(conn, run_date))
        except Exception as e:
            findings.append(Finding(
                check_key=f'checker_error_{fn.__name__}',
                check_class='step_failure', severity='warning',
                subject=fn.__name__,
                summary=f'Integrity check {fn.__name__} raised: {str(e)[:200]}',
                detail={'checker': fn.__name__, 'error': str(e)[:500]}))
    return findings
