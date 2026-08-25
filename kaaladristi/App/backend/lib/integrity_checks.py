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

from . import scan_contract

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
            month_start = run_date.replace(day=1)
            n_rows, n_dates = _rows(conn, '''
                SELECT COUNT(*), COUNT(DISTINCT trade_date)
                FROM km_equity_monthly WHERE trade_date >= %s
            ''', (month_start,))[0]
            out.append(Finding(
                check_key='monthly_partial_bar', check_class='invariant', severity='critical',
                subject='km_equity_monthly',
                summary=(f'{n_rows:,} monthly bars across {n_dates} date(s) up to {mo_max} sit inside '
                         f'the current, incomplete month — a month-to-date bar is being served as '
                         f'the monthly bar'),
                metric=n_rows, expected=0,
                detail={'newest_bar': str(mo_max), 'month_start': str(month_start),
                        'rows': int(n_rows), 'distinct_dates': int(n_dates)}))

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


# ── 5. Contract — the guard for the class that produced this file ────────
# Scanner-integrity audit, 2026-08-24. The matview was recreated three
# times in one session and a five-column gap survived every check,
# because every check was self-referential: syntax parses, UNION arms
# agree, EXPLAIN resolves — none asked whether the OUTPUT satisfied its
# CONSUMER. The existing parity harness compares rank/equity_id/symbol/
# vani_flag only, so it would have reported clean while every display
# column rendered a dash.
#
# Root cause of the class: the matview<->frontend contract is written
# down nowhere. These checks write it down and test it nightly.
# See docs/claude/scanner-integrity-poa.md.

# DERIVED from the frontend at run time — see lib/scan_contract.py for why a
# hand-maintained version of this dict is worthless (it is how the blank
# Score 5D/22D bug passed the audit). Kept as a module-level name so callers
# that imported the old constant keep working.
def _db_preset_meta(conn) -> dict:
    """kd_scan_presets rows — the source getPresetMeta() prefers at run time."""
    return {r[0]: {'category': r[1], 'universe': r[2], 'vani_rule': r[3]}
            for r in _rows(conn,
                'SELECT id, category, universe, vani_rule FROM kd_scan_presets')}


def matview_preset_columns(db_columns: set[str], db_meta: dict | None = None) -> dict[str, list[str]]:
    """preset -> the UI's columns that are REAL data columns, so must exist and
    be populated in km_scan_results. A rendered key that is not a data column
    anywhere (UI-derived, e.g. dot_signal) is not the matview's job and is
    excluded — but only because it was checked, not because it was assumed."""
    contract = scan_contract.contract(db_meta)
    served = {p for p, kind in contract['routing'].items() if kind == 'matview'}
    out = {}
    for preset in sorted(served):
        cols = contract['columns'].get(preset)
        if cols is None:
            continue      # preset renders the default column set, not an override
        out[preset] = [c for c in cols if c in db_columns]
    return out


# vani_rule -> the SQL predicate it evaluates to, so the base rate of the rule
# can be measured on the same day the preset ran. Mirrors computeVaniOpportunity
# in scanEngine.ts.
VANI_RULE_SQL = {
    'is_vani_s2':                   'is_vani_s2',
    'is_vani_smart':                'is_vani_smart',
    'is_vani_weakness':             'is_vani_weakness',
    'is_vani_distrib_and_weakness': '(is_vani_distrib OR is_vani_weakness)',
    'is_vani_surge_or_breakout':    '(is_vani_surge OR is_vani_breakout)',
    'svd_delivery_conviction':      '(dot_svd AND delivery_pct >= 50)',
}

# Below this many EXPECTED hits, "zero flags" carries no information and must
# not be reported as a defect.
#
# The original check was `flagged == 0 -> DEAD`. Measured 2026-08-25, that test
# has no power at the sizes these presets run at. is_vani_smart is true for 37
# of 7,635 stocks (0.48%); in a 25-row preset the expected count is 0.12 and
# P(zero) is 89% EVEN IF THE RULE IS PERFECTLY CORRECT. It reported
# smart_money / quiet_accumulation / distribution_warning as broken on that
# basis. Worse, it reported power_buy as healthy while that preset would read
# DEAD on 94% of days by chance alone — the verdict was flipping on noise.
#
# What actually distinguishes a working rule is ENRICHMENT: power_buy flags 2
# of 25 against a 0.25% base rate (32x), power_sell 6 of 25 against 1.44%
# (17x). Those are real. Zero-in-25 is not evidence of anything.
VANI_MIN_EXPECTED = 3.0
   # owner decision 2026-08-24 — uniform, all presets

# Presets whose own gate measures COMBINED-exchange ADV (wg_adv sums every ISIN
# twin's 22-session average turnover) rather than the NSE-only avg_amt_22d
# column. Checking them against the column understates their liquidity and logs
# a permanent false positive: SHALBY reads 0.63 Cr on its NSE row and 1.10 Cr
# combined (2026-08-25) — it passes the floor, the column just cannot see it.
WG_ADV_PRESETS = ['waking_giants', 'first_ascent']

# Which presets the frontend reads from km_scan_results is DERIVED by walking
# executeScan()'s branches in order and asking each chosen fetcher which table
# it queries. Hand-listing it is what let waking_giants — served from
# km_wg_journeys while still carrying 26 matview rows — read as healthy.
def matview_served_presets() -> frozenset:
    return frozenset(scan_contract.matview_served())


# Effective liquidity per matview row, measured the way the preset's own gate
# measures it. Two special cases, both verified rather than waived:
#   * WG family      -> combined-exchange ADV, summed across ISIN twins.
#   * arms that emit NULL for avg_amt_22d (flower_pot_burst does, by design —
#     its column set never renders it) -> fall back to the live EOD row, so the
#     floor applied upstream at final selection is CONFIRMED, not assumed.
# A row with no measurable value at all is counted separately; folding it into
# "below floor" would recreate the false positive this query exists to remove.
_LIQUIDITY_SQL = """
WITH latest AS (SELECT max(trade_date) AS d FROM km_equity_eod),
row_amt AS (
    SELECT r.preset_id,
           CASE WHEN r.preset_id = ANY(%(wg)s) THEN (
                    SELECT SUM(x.a)
                    FROM km_equity_symbols tw
                    JOIN LATERAL (
                        SELECT AVG(v.value_cr) AS a FROM (
                            SELECT e2.value_cr FROM km_equity_eod e2
                            WHERE e2.equity_id = tw.id
                              AND e2.trade_date <= (SELECT d FROM latest)
                            ORDER BY e2.trade_date DESC LIMIT 22) v) x ON TRUE
                    WHERE (s.isin IS NOT NULL AND tw.isin = s.isin) OR tw.id = s.id)
                ELSE COALESCE(r.avg_amt_22d, e.avg_amt_22d)
           END AS amt
    FROM km_scan_results r
    JOIN km_equity_symbols s ON s.id = r.equity_id
    LEFT JOIN km_equity_eod e
           ON e.equity_id = r.equity_id AND e.trade_date = (SELECT d FROM latest)
)
SELECT preset_id,
       COUNT(*)                                              AS rows_n,
       COUNT(*) FILTER (WHERE amt IS NOT NULL AND amt < %(floor)s) AS below_n,
       COUNT(*) FILTER (WHERE amt IS NULL)                    AS unmeasured_n
FROM row_amt
GROUP BY preset_id
"""


def measure_liquidity(conn) -> dict:
    """preset_id -> (rows, below_floor, unmeasured), each row scored on the
    yardstick that preset's gate actually uses. Shared with
    scripts/audit_scanner_contract.py so both report the same numbers."""
    return {r[0]: (int(r[1]), int(r[2]), int(r[3]))
            for r in _rows(conn, _LIQUIDITY_SQL,
                           {'wg': WG_ADV_PRESETS, 'floor': MIN_AVG_AMT_22D_CR})}


def check_scanner_contract(conn, run_date: date) -> list[Finding]:
    """Per matview preset: rendered columns exist and are populated, the
    declared universe holds, the liquidity floor holds, and a declared
    vani_rule actually produces flags."""
    out: list[Finding] = []

    existing = {r[0] for r in _rows(conn, """
        SELECT a.attname FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'km_scan_results' AND n.nspname = 'public'
          AND a.attnum > 0 AND NOT a.attisdropped
    """)}
    if not existing:
        return [Finding('contract_matview_missing', 'invariant', 'critical',
                        'km_scan_results does not exist — every matview preset is dead',
                        subject='km_scan_results')]

    # An UNPOPULATED matview is not a checker error — it is the loudest
    # possible finding: every matview-backed scanner returns nothing.
    # This is the state a migration leaves behind between CREATE ... WITH
    # NO DATA and the REFRESH, so it is entirely possible in production if
    # the refresh step is missed. Detect it explicitly; querying it would
    # raise and get logged as a mere checker warning (observed 2026-08-24).
    populated = _rows(conn, """
        SELECT c.relispopulated FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'km_scan_results' AND n.nspname = 'public'
    """)
    if populated and not populated[0][0]:
        return [Finding(
            'contract_matview_unpopulated', 'invariant', 'critical',
            'km_scan_results exists but has never been populated — every matview-backed '
            'scanner is returning zero rows. Run: REFRESH MATERIALIZED VIEW km_scan_results; '
            'then REFRESH MATERIALIZED VIEW km_scan_exclusion_counts;',
            subject='km_scan_results', metric=0, expected=1,
            detail={'remedy': 'REFRESH MATERIALIZED VIEW km_scan_results'})]

    # C0 — produced vs consumed. An arm the frontend never reads is dead
    # weight: it costs refresh time, inflates the matview, and makes every
    # reader (this audit included) believe a preset is matview-backed when it
    # is served from somewhere else entirely.
    produced = {r[0] for r in _rows(
        conn, 'SELECT DISTINCT preset_id FROM km_scan_results')}
    served = matview_served_presets()
    for orphan in sorted(produced - served):
        n = _rows(conn, 'SELECT COUNT(*) FROM km_scan_results WHERE preset_id = %s',
                  (orphan,))[0][0]
        out.append(Finding(
            f'contract_arm_unconsumed_{orphan}', 'invariant', 'warning',
            f'{orphan}: {n} rows computed into km_scan_results on every refresh but no '
            f'frontend path reads them — the arm is dead weight or the preset lost its UI',
            subject=orphan, metric=int(n), expected=0,
            detail={'preset': orphan, 'rows': int(n)}))
    for missing in sorted(served - produced):
        out.append(Finding(
            f'contract_arm_missing_{missing}', 'invariant', 'critical',
            f'{missing}: the frontend reads this preset from km_scan_results but the '
            f'matview produces no rows for it — the scan returns empty',
            subject=missing, metric=0, expected=1,
            detail={'preset': missing}))

    # C1b — the row mapper. A column can be present and populated in the
    # matview and still render as a dash, because scanRowToScanStock decides
    # what survives into the ScanStock the table reads. Migration 180's five
    # columns sat exactly there for a day: matview populated, audit green,
    # UI blank. The DB cannot see this; only the frontend source can.
    try:
        for preset, cols in sorted(scan_contract.mapper_gaps(db_meta).items()):
            out.append(Finding(
                f'contract_mapper_gap_{preset}', 'invariant', 'critical',
                f'{preset}: the UI renders {", ".join(cols)} but the row mapper nulls or '
                f'omits them — dashes regardless of what the matview holds',
                subject=preset, metric=len(cols), expected=0,
                detail={'preset': preset, 'unmapped': cols}))
    except (OSError, ValueError) as e:
        out.append(Finding(
            'contract_mapper_unreadable', 'invariant', 'warning',
            f'could not derive the mapper contract from the frontend source: {e}',
            subject='scanRowToScanStock'))

    # C1 — columns present and populated
    db_meta = _db_preset_meta(conn)

    # C0b — the hardcoded SCAN_PRESETS array vs the live kd_scan_presets row.
    # getPresetMeta() prefers the DB, so a disagreement means the code says one
    # thing and the app does another. Found on 2026-08-25: power_sell is
    # category '' in the TS and 'market' in the DB (which silently changes
    # which columns the table renders), stage_2_watch is NSE_ONLY in the TS
    # and NSE_BSE in the DB.
    for preset, fields in scan_contract.contract(db_meta)['meta_drift'].items():
        if not fields:
            continue
        detail = ', '.join(f'{k}: code={c!r} db={d!r}' for k, (c, d) in fields.items())
        out.append(Finding(
            f'contract_meta_drift_{preset}', 'invariant', 'warning',
            f'{preset}: scanEngine.ts and kd_scan_presets disagree ({detail}). '
            f'The DB wins at run time, so the code is misleading about what ships.',
            subject=preset, metric=len(fields), expected=0,
            detail={'preset': preset, 'drift': {k: {'code': c, 'db': d}
                                                for k, (c, d) in fields.items()}}))

    db_meta = _db_preset_meta(conn)
    for preset, cols in matview_preset_columns(existing, db_meta).items():
        absent = [c for c in cols if c not in existing]
        if absent:
            out.append(Finding(
                f'contract_cols_absent_{preset}', 'invariant', 'critical',
                f'{preset}: the UI renders {", ".join(absent)} but km_scan_results has no such column '
                f'— every row shows a dash',
                subject=preset, metric=len(absent), expected=0,
                detail={'preset': preset, 'absent': absent}))
            continue
        present = [c for c in cols if c in existing]
        sel = ', '.join(f'COUNT({c}) AS n_{c}' for c in present)
        row = _rows(conn, f"SELECT COUNT(*), {sel} FROM km_scan_results WHERE preset_id = %s",
                    (preset,))
        if not row or not row[0][0]:
            continue                       # preset legitimately empty today
        total, *counts = row[0]
        dead = [c for c, n in zip(present, counts) if n == 0]
        if dead:
            out.append(Finding(
                f'contract_cols_null_{preset}', 'invariant', 'warning',
                f'{preset}: {", ".join(dead)} present in the matview but 100% NULL across all '
                f'{total} rows — renders as a dash',
                subject=preset, metric=len(dead), expected=0,
                detail={'preset': preset, 'all_null': dead, 'rows': int(total)}))

    # C2/C3/C4 — universe, liquidity, vani_rule, straight off the declared metadata
    liq = measure_liquidity(conn)
    for preset, universe, vani_rule, rows_n, bse_n, vani_n in _rows(conn, """
        SELECT p.id, p.universe, p.vani_rule,
               (SELECT COUNT(*) FROM km_scan_results r WHERE r.preset_id = p.id),
               (SELECT COUNT(*) FROM km_scan_results r WHERE r.preset_id = p.id AND r.exchange = 'BSE'),
               (SELECT COUNT(*) FROM km_scan_results r WHERE r.preset_id = p.id AND r.vani_flag)
        FROM kd_scan_presets p
        WHERE p.is_active AND EXISTS (SELECT 1 FROM km_scan_results r WHERE r.preset_id = p.id)
    """):
        if not rows_n:
            continue
        if universe == 'NSE_ONLY' and bse_n:
            out.append(Finding(
                f'contract_universe_{preset}', 'invariant', 'critical',
                f'{preset} is declared {universe} in kd_scan_presets but returned {bse_n} BSE rows',
                subject=preset, metric=bse_n, expected=0,
                detail={'preset': preset, 'declared': universe, 'bse_rows': int(bse_n)}))
        _, below_n, unmeasured_n = liq.get(preset, (rows_n, 0, 0))
        if below_n:
            out.append(Finding(
                f'contract_liquidity_{preset}', 'invariant', 'warning',
                f'{preset}: {below_n} of {rows_n} rows trade under Rs {MIN_AVG_AMT_22D_CR} Cr/day '
                f'— below the platform liquidity floor',
                subject=preset, metric=below_n, expected=0,
                detail={'preset': preset, 'below_floor': int(below_n), 'rows': int(rows_n)}))
        if unmeasured_n:
            out.append(Finding(
                f'contract_liquidity_unmeasured_{preset}', 'invariant', 'warning',
                f'{preset}: {unmeasured_n} of {rows_n} rows carry no turnover on the latest '
                f'session — the liquidity floor cannot be verified for them',
                subject=preset, metric=unmeasured_n, expected=0,
                detail={'preset': preset, 'unmeasured': int(unmeasured_n), 'rows': int(rows_n)}))
        if vani_rule and vani_rule != 'always_true':
            pred = VANI_RULE_SQL.get(vani_rule)
            base = None
            if pred:
                r = _rows(conn, f"""
                    SELECT COUNT(*) FILTER (WHERE {pred})::float / NULLIF(COUNT(*),0)
                    FROM km_equity_eod
                    WHERE trade_date = (SELECT max(trade_date) FROM km_equity_eod)
                """)
                base = r[0][0] if r and r[0][0] is not None else None
            expected = (base or 0) * rows_n
            if base is not None and expected < VANI_MIN_EXPECTED:
                # Not a defect — the sample cannot answer the question. Say so
                # rather than manufacturing a finding.
                if vani_n == 0:
                    out.append(Finding(
                        f'contract_vani_unpowered_{preset}', 'staleness', 'info',
                        f'{preset}: vani_rule {vani_rule} produced 0 flags, but with a '
                        f'{base*100:.2f}% base rate over {rows_n} rows the expected count is '
                        f'{expected:.2f} — zero is the normal outcome and says nothing about '
                        f'whether the rule is right',
                        subject=preset, metric=0, expected=0,
                        detail={'preset': preset, 'rule': vani_rule, 'rows': int(rows_n),
                                'base_rate': base, 'expected': expected}))
            elif vani_n == 0:
                # Powered: at this base rate we EXPECTED >= VANI_MIN_EXPECTED
                # hits and got none, so zero means something.
                out.append(Finding(
                    f'contract_vani_dead_{preset}', 'staleness', 'warning',
                    f'{preset} declares vani_rule "{vani_rule}" and none of its {rows_n} rows '
                    f'carries the flag, against an expected {expected:.1f} at the rule\'s '
                    f'{(base or 0)*100:.2f}% base rate — the VaNi filter is dead on this scan',
                    subject=preset, metric=0, expected=1,
                    detail={'preset': preset, 'vani_rule': vani_rule, 'rows': int(rows_n),
                            'base_rate': base, 'expected_hits': expected}))
    return out


ALL_CHECKS.append(check_scanner_contract)
