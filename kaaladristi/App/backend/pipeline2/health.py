"""Fill-rate health queries for pipeline v2.

Ground truth:
  * Indicator / flow / magic_rs dimensions: a row counts as "populated"
    only when every sampled column is non-NULL. Percentage is over the
    total EOD rows for that (date, exchange).
  * Industry composites: row-count per date vs a healthy floor (~150).
  * Market breadth / breadth_roc: single-row-per-date presence.

The previous pipeline trusted `indicators_computed_at` stamps, which
could be set while the actual columns stayed NULL. v2 never trusts
stamps — column fill is the only truth.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable

import psycopg2.extras


# ── Dimension registry ─────────────────────────────────────────────────
#
# (table, id_col, columns, ok_threshold)
#   table       : SQL table the dimension lives in
#   id_col      : id column for column-fill dimensions ('equity_id' / 'index_id');
#                 None for row-presence dimensions
#   columns     : columns that must ALL be non-NULL for a row to count as
#                 populated; None for row-presence dimensions
#   ok_threshold: fraction (0..1) at/above which fill-rate is 'healthy'

DIMENSION_HEALTH: dict[str, tuple[str, str | None, list[str] | None, float | None]] = {
    # Reconciliation — equity rows in the bhavcopy vs rows actually inserted.
    # Every other check in this table measures PRESENCE (is the column filled,
    # did rows arrive), which cannot see a row dropped BEFORE insert: 1,853 NSE
    # equities were silently discarded daily for months while every check read
    # green. Threshold is 0.99 — any sustained equity-series drop is a bug.
    'nse_reconciliation':    ('km_pipeline_runs',  None,        None, 0.99),
    'bse_reconciliation':    ('km_pipeline_runs',  None,        None, 0.99),

    # Period aggregates, keyed by week_start / month_start (not trade_date).
    # They ran only in legacy daily_pipeline steps 6e/6f, both gated on
    # `not skip_indicators` — and pipeline2 passes skip_indicators=True, so both
    # stopped the day production moved to pipeline2 (weekly stale from
    # 2026-05-18, monthly from 2026-05-01). Same failure mode as rs_percentile
    # and index_returns. Registered here so the nightly sweep keeps them current.
    'equity_weekly':         ('km_equity_weekly',  'equity_id', None, None),
    'equity_monthly':        ('km_equity_monthly', 'equity_id', None, None),

    # Download dimensions — row-count checks only. `columns` / `ok_threshold`
    # are unused; expected row counts live in DOWNLOAD_EXPECTED below.
    'index_eod_download':    ('km_index_eod',    'index_id',  None, None),
    'nse_eod_download':      ('km_equity_eod',   'equity_id', None, None),
    'bse_eod_download':      ('km_equity_eod',   'equity_id', None, None),

    # index_indicators samples sma_50 (not sma_55) to match the ground-truth
    # audit. Legacy rows stamped before sma_50 was added have sma_55 populated
    # but sma_50 NULL — using sma_55 would falsely report those as healthy.
    'index_indicators':      ('km_index_eod',     'index_id',  ['rsi_14', 'sma_21', 'sma_50', 'atr_14', 'rvol'],           1.0),
    'nse_equity_indicators': ('km_equity_eod',    'equity_id', ['rsi_14', 'sma_21', 'sma_50', 'atr_14', 'rvol'],           0.95),
    'bse_equity_indicators': ('km_equity_eod',    'equity_id', ['rsi_14', 'sma_21', 'sma_50', 'atr_14', 'rvol'],           0.95),
    'index_flow':            ('km_index_eod',     'index_id',  ['flow_type'],                                              1.0),
    'nse_flow':              ('km_equity_eod',    'equity_id', ['flow_type'],                                              0.95),
    'bse_flow':              ('km_equity_eod',    'equity_id', ['flow_type'],                                              0.95),
    'nse_magic_rs':          ('km_equity_eod',    'equity_id', ['magic_rs_zone'],                                          0.95),
    'bse_magic_rs':          ('km_equity_eod',    'equity_id', ['magic_rs_zone'],                                          0.95),
    # index_magic_rs: relative strength of each index vs NIFTY 500 (both live in
    # km_index_eod — compute_all_magic_rs routes the benchmark on-table for the
    # index case). Needs ~144 bars of history; ~96% of indices qualify (the few
    # brand-new custom indices legitimately can't yet), so threshold 0.90.
    'index_magic_rs':        ('km_index_eod',     'index_id',  ['magic_rs_zone'],                                          0.90),
    # rs_percentile ranks each equity by magic_rs within the day's universe, so
    # its max coverage equals magic_rs coverage (both exchanges, no exchange
    # split). Threshold 0.90 leaves margin below that ~95% ceiling while still
    # catching the 0% regression that occurred when this step went unwired.
    'rs_percentile':         ('km_equity_eod',    'equity_id', ['rs_percentile'],                                          0.90),
    'supertrend':            ('km_equity_eod',    'equity_id', ['supertrend_dir'],                                         0.90),
    'rolling_metrics':       ('km_equity_eod',    'equity_id', ['w52_high', 'w52_low', 'lifetime_high'],                   0.95),
    'd365':                  ('km_equity_eod',    'equity_id', ['d365_pct_chng'],                                          0.85),
    'stage_classification':  ('km_equity_eod',    'equity_id', ['stage'],                                                  0.95),
    # gl_days_above is written on EVERY bar (0 below the line); gl_event is
    # rare by design, so measuring fill on it would report the step broken on
    # any quiet day.
    'gl_events':             ('km_equity_eod',    'equity_id', ['gl_days_above'],                                          0.90),
    'vani_flags':            ('km_equity_eod',    'equity_id', ['is_vani_strength', 'is_vani_breakout'],                   1.0),
    # index_returns samples ret_5d only — ret_22d/ret_66d are legitimately
    # NULL for indices younger than their window, and indices with no EOD
    # rows on the date (e.g. inactive ones) never enter the denominator.
    'index_returns':         ('km_index_eod',     'index_id',  ['ret_5d'],                                                 0.90),
    'industry_composites':   ('km_industry_eod',  None,        None,                                                       None),
    'market_breadth':        ('km_market_breadth', None,       None,                                                       None),
    'breadth_roc':           ('km_breadth_roc',   None,        None,                                                       None),
}


# Expected row counts per download dimension: (min_expected, max_expected).
# status for downloads:
#   ok      = actual >= min_expected
#   partial = 1..(min_expected - 1)
#   missing = 0
# max_expected is informational — overshooting does NOT downgrade to partial.
DOWNLOAD_EXPECTED: dict[str, tuple[int, int]] = {
    'index_eod_download':  (80,   92),
    'nse_eod_download':    (800,  900),
    'bse_eod_download':    (3000, 4500),
}

DOWNLOAD_DIMENSIONS = set(DOWNLOAD_EXPECTED.keys())


# Display labels — hand-curated so NSE/BSE/RS/ROC render with correct casing.
# A generic title() would produce "Nse Equity Indicators" and "Bse Magic Rs".
LABELS: dict[str, str] = {
    'equity_weekly':         'Equity Weekly Bars',
    'equity_monthly':        'Equity Monthly Bars',
    'nse_reconciliation':    'NSE Parsed vs Inserted',
    'bse_reconciliation':    'BSE Parsed vs Inserted',
    'index_eod_download':    'Index EOD Download',
    'nse_eod_download':      'NSE EOD Download',
    'bse_eod_download':      'BSE EOD Download',
    'index_indicators':      'Index Indicators',
    'nse_equity_indicators': 'NSE Equity Indicators',
    'bse_equity_indicators': 'BSE Equity Indicators',
    'index_flow':            'Index Flow',
    'nse_flow':              'NSE Flow',
    'bse_flow':              'BSE Flow',
    'index_magic_rs':        'Index Magic RS',
    'nse_magic_rs':          'NSE Magic RS',
    'bse_magic_rs':          'BSE Magic RS',
    'rs_percentile':         'RS Percentile',
    'supertrend':            'SuperTrend',
    'rolling_metrics':       'Rolling Metrics',
    'd365':                  'D365 % Change',
    'stage_classification':  'Stage Classification',
    'gl_events':             'Golden Line Events',
    'vani_flags':            'VaNi Flags',
    'index_returns':         'Index Returns & Scores',
    'industry_composites':   'Industry Composites',
    'market_breadth':        'Market Breadth',
    'breadth_roc':           'Breadth ROC',
}


def group_for(dim: str) -> str:
    """UI group — 'download' or 'compute'. Used to draw a separator in the grid."""
    return 'download' if dim in DOWNLOAD_DIMENSIONS else 'compute'


def label_for(dim: str) -> str:
    """Display label for a dimension. Falls back to a prettified key."""
    return LABELS.get(dim, dim.replace('_', ' ').title())

# Exchange filter inferred from dimension key prefix.
def _exchange_for(dim: str) -> str | None:
    if dim.startswith('nse_'):
        return 'NSE'
    if dim.startswith('bse_'):
        return 'BSE'
    return None


# Industry composites: ~1,900 NSE equities span ~150 industries with >=5 stocks.
# Anything below 50 is 'missing'; 50..149 is 'partial'; >=150 is 'ok'.
INDUSTRY_OK_FLOOR      = 150
INDUSTRY_PARTIAL_FLOOR = 50


# ── Data classes ──────────────────────────────────────────────────────────

@dataclass
class DayStatus:
    trade_date: str
    status: str                  # 'ok' | 'partial' | 'missing' | 'holiday' | 'no_data' | 'future'
    total: int = 0
    populated: int = 0
    fill_rate: float | None = None  # 0..100

    def to_dict(self) -> dict:
        return {
            'trade_date': self.trade_date,
            'status': self.status,
            'total': self.total,
            'populated': self.populated,
            'fill_rate': self.fill_rate,
        }


@dataclass
class DimensionHealth:
    dimension: str
    label: str
    group: str                      # 'download' | 'compute'
    latest_ok: str | None
    days: list[DayStatus]

    def to_dict(self) -> dict:
        return {
            'dimension': self.dimension,
            'label': self.label,
            'group': self.group,
            'latest_ok': self.latest_ok,
            'days': [d.to_dict() for d in self.days],
        }


# ── Trading-day generation ────────────────────────────────────────────────

def weekday_range(days: int, today: date | None = None) -> list[date]:
    """Return the last `days` weekdays ending at `today` (inclusive), oldest first."""
    anchor = today or date.today()
    out: list[date] = []
    cursor = anchor
    while len(out) < days:
        if cursor.weekday() < 5:
            out.append(cursor)
        cursor -= timedelta(days=1)
    out.reverse()
    return out


def _skip_dates(conn, from_dt: date, to_dt: date) -> dict[str, str]:
    """Map of {date_str: 'holiday'|'no_data'} from km_trading_calendar."""
    result: dict[str, str] = {}
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT trade_date, status, is_holiday "
            "FROM km_trading_calendar "
            "WHERE trade_date BETWEEN %s AND %s "
            "  AND (is_holiday = TRUE OR status IN ('holiday', 'no_data', 'weekend'))",
            [str(from_dt), str(to_dt)],
        )
        for row in cur.fetchall():
            ds = str(row['trade_date'])
            if row.get('is_holiday') or row.get('status') == 'holiday':
                result[ds] = 'holiday'
            else:
                result[ds] = 'no_data'
    return result


# ── Single-date fill rate ────────────────────────────────────────────────

def fill_rate(conn, dimension: str, trade_date: date) -> float:
    """Return ground-truth fill rate for (dimension, trade_date) as 0..100.

    0 if the dimension has no rows on the date. For row-presence dimensions
    (industry_composites / market_breadth / breadth_roc) returns either
    100 (present, healthy) or a proportional value for industry_composites.
    """
    meta = DIMENSION_HEALTH.get(dimension)
    if meta is None:
        raise ValueError(f'Unknown dimension: {dimension}')

    table, id_col, cols, _ok = meta
    exchange = _exchange_for(dimension)

    # A dimension whose columns have not been migrated yet reads as 0%, not as
    # an exception. fill_rate is the choke point for the health dashboard, the
    # 19:30 gap sweep AND every handler's before/after reading, so a raise here
    # takes down all three — which is how gl_events failed on its own health
    # probe before reaching the compute it was guarding, and why guarding the
    # handler alone was not enough. The backend is always deployed before the
    # migrations run; this is a normal state, not an error.
    if cols:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_name = %s AND column_name = ANY(%s)
            """, (table, list(cols)))
            present = cur.fetchone()[0]
        conn.commit()
        if present < len(cols):
            return 0.0

    with conn.cursor() as cur:
        # Download dimensions — row count only, graded against min_expected.
        if dimension in DOWNLOAD_EXPECTED:
            min_expected, _max_expected = DOWNLOAD_EXPECTED[dimension]
            if exchange and table == 'km_equity_eod':
                cur.execute(
                    "SELECT COUNT(*) FROM km_equity_eod e "
                    "JOIN km_equity_symbols s ON s.id = e.equity_id "
                    "WHERE s.exchange = %s AND e.trade_date = %s",
                    [exchange, str(trade_date)],
                )
            else:
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE trade_date = %s",
                            [str(trade_date)])
            n = cur.fetchone()[0] or 0
            if n <= 0:
                return 0.0
            if n >= min_expected:
                return 100.0
            return round(n / min_expected * 100.0, 2)

        # Reconciliation: of the EQUITY rows in the day's bhavcopy, how many
        # reached km_equity_eod? Debt/GS/warrants are legitimately excluded, so a
        # raw matched/parsed ratio reads ~40% on a healthy day — the denominator
        # is matched + equity-series unmatched, which should sit at 100%.
        if dimension in ('nse_reconciliation', 'bse_reconciliation'):
            exch = 'NSE' if dimension.startswith('nse') else 'BSE'
            cur.execute(
                "SELECT metadata FROM km_pipeline_runs "
                "WHERE exchange = %s AND step = 'insert' AND trade_date = %s "
                "  AND metadata IS NOT NULL "
                "ORDER BY id DESC LIMIT 1",
                [exch, str(trade_date)],
            )
            row = cur.fetchone()
            if not row or not row[0]:
                return 0.0
            meta = row[0]
            matched = meta.get('matched_count')
            if matched is None:
                # Run predates the reconciliation fields — unknown, not healthy.
                return 0.0
            if exch == 'NSE':
                from pipeline.processors.symbol_registrar import NSE_EQUITY_SERIES
                by_series = meta.get('unmatched_by_series') or {}
                missed = sum(v for k, v in by_series.items() if k in NSE_EQUITY_SERIES)
            else:
                # parse_bse_bhav already gates to equities — every miss is real.
                missed = int(meta.get('unmatched_count') or 0)
            total = int(matched) + int(missed)
            if total <= 0:
                return 0.0
            return round(int(matched) / total * 100.0, 2)

        # Weekly / monthly aggregates are keyed by week_start / month_start, not
        # trade_date, so "fill rate for this date" means: does the period that
        # CONTAINS trade_date have rows? Anything > 0 is complete — the aggregate
        # writes every equity for the period in one pass or none at all.
        if dimension in ('equity_weekly', 'equity_monthly'):
            weekly = dimension == 'equity_weekly'
            period_col = 'week_start' if weekly else 'month_start'
            unit = 'week' if weekly else 'month'
            cur.execute(
                f"SELECT COUNT(*) FROM {table} "
                f"WHERE {period_col} = date_trunc('{unit}', %s::date)::date",
                [str(trade_date)],
            )
            return 100.0 if (cur.fetchone()[0] or 0) > 0 else 0.0

        if dimension == 'industry_composites':
            cur.execute(
                "SELECT COUNT(*) FROM km_industry_eod WHERE trade_date = %s",
                [str(trade_date)],
            )
            n = cur.fetchone()[0]
            if n >= INDUSTRY_OK_FLOOR:
                return 100.0
            if n <= 0:
                return 0.0
            return round(min(100.0, (n / INDUSTRY_OK_FLOOR) * 100.0), 2)

        if dimension in ('market_breadth', 'breadth_roc'):
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE trade_date = %s", [str(trade_date)])
            n = cur.fetchone()[0]
            return 100.0 if n > 0 else 0.0

        # Column-fill dimensions
        conds = ' AND '.join(f'e.{c} IS NOT NULL' for c in cols)
        if exchange and table == 'km_equity_eod':
            cur.execute(
                f"SELECT COUNT(*) AS total, "
                f"       COUNT(*) FILTER (WHERE {conds}) AS populated "
                f"FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id "
                f"WHERE s.exchange = %s AND e.trade_date = %s",
                [exchange, str(trade_date)],
            )
        else:
            # Index table or no exchange filter
            conds_t = ' AND '.join(f'{c} IS NOT NULL' for c in cols)
            cur.execute(
                f"SELECT COUNT(*) AS total, "
                f"       COUNT(*) FILTER (WHERE {conds_t}) AS populated "
                f"FROM {table} WHERE trade_date = %s",
                [str(trade_date)],
            )
        row = cur.fetchone()
        total = row[0] or 0
        populated = row[1] or 0
        if total <= 0:
            return 0.0
        return round(populated / total * 100.0, 2)


# ── Multi-day health grid ────────────────────────────────────────────────

def _classify(frac: float, ok_threshold: float) -> str:
    """Classify a fill fraction against a threshold.

    Compares at 1-decimal percent precision so the colour matches what the
    tooltip shows (frontend uses `.toFixed(1)`). Otherwise 0.9495 reads as
    "95.0%" in the UI but fails `0.9495 >= 0.95` and renders amber.
    """
    pct   = round(frac * 100.0, 1)
    t_pct = round(ok_threshold * 100.0, 1)
    if pct >= t_pct:
        return 'ok'
    if pct >= 50.0:
        return 'partial'
    return 'missing'


def _coverage_by_date_column_fill(
    conn, table: str, cols: list[str], exchange: str | None,
    from_dt: date, to_dt: date,
) -> dict[str, tuple[int, int]]:
    """Return {date_str: (total, populated)} across the window."""
    out: dict[str, tuple[int, int]] = {}
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if exchange and table == 'km_equity_eod':
            conds = ' AND '.join(f'e.{c} IS NOT NULL' for c in cols)
            cur.execute(
                f"SELECT e.trade_date, COUNT(*) AS total, "
                f"       COUNT(*) FILTER (WHERE {conds}) AS populated "
                f"FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id "
                f"WHERE s.exchange = %s AND e.trade_date BETWEEN %s AND %s "
                f"GROUP BY e.trade_date",
                [exchange, str(from_dt), str(to_dt)],
            )
        else:
            conds = ' AND '.join(f'{c} IS NOT NULL' for c in cols)
            cur.execute(
                f"SELECT trade_date, COUNT(*) AS total, "
                f"       COUNT(*) FILTER (WHERE {conds}) AS populated "
                f"FROM {table} "
                f"WHERE trade_date BETWEEN %s AND %s "
                f"GROUP BY trade_date",
                [str(from_dt), str(to_dt)],
            )
        for r in cur.fetchall():
            ds = str(r['trade_date'])
            out[ds] = (int(r['total'] or 0), int(r['populated'] or 0))
    return out


def _row_count_by_date(conn, table: str, from_dt: date, to_dt: date) -> dict[str, int]:
    out: dict[str, int] = {}
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT trade_date, COUNT(*) FROM {table} "
            f"WHERE trade_date BETWEEN %s AND %s GROUP BY trade_date",
            [str(from_dt), str(to_dt)],
        )
        for r in cur.fetchall():
            out[str(r[0])] = int(r[1] or 0)
    return out


def _equity_row_count_by_date(
    conn, exchange: str, from_dt: date, to_dt: date,
) -> dict[str, int]:
    """Row count per date for km_equity_eod restricted to `exchange`."""
    out: dict[str, int] = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT e.trade_date, COUNT(*) "
            "FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id "
            "WHERE s.exchange = %s AND e.trade_date BETWEEN %s AND %s "
            "GROUP BY e.trade_date",
            [exchange, str(from_dt), str(to_dt)],
        )
        for r in cur.fetchall():
            out[str(r[0])] = int(r[1] or 0)
    return out


def _health_row(
    conn, dimension: str, trading_days: list[date], skip_dates: dict[str, str],
) -> DimensionHealth:
    meta = DIMENSION_HEALTH[dimension]
    table, id_col, cols, ok_threshold = meta
    from_dt, to_dt = trading_days[0], trading_days[-1]
    today = date.today()

    days: list[DayStatus] = []
    latest_ok: str | None = None

    if dimension in DOWNLOAD_EXPECTED:
        min_expected, _max_expected = DOWNLOAD_EXPECTED[dimension]
        exchange = _exchange_for(dimension)
        if exchange and table == 'km_equity_eod':
            counts = _equity_row_count_by_date(conn, exchange, from_dt, to_dt)
        else:
            counts = _row_count_by_date(conn, table, from_dt, to_dt)
        for d in trading_days:
            ds = str(d)
            if d > today:
                days.append(DayStatus(ds, 'future'))
                continue
            if ds in skip_dates:
                days.append(DayStatus(ds, skip_dates[ds]))
                continue
            n = counts.get(ds, 0)
            if n >= min_expected:
                status = 'ok'
                fr = 100.0
            elif n > 0:
                status = 'partial'
                fr = round(n / min_expected * 100.0, 2)
            else:
                status = 'missing'
                fr = 0.0
            days.append(DayStatus(ds, status, total=min_expected, populated=n, fill_rate=fr))
            if status == 'ok':
                latest_ok = ds

    elif dimension == 'industry_composites':
        counts = _row_count_by_date(conn, 'km_industry_eod', from_dt, to_dt)
        for d in trading_days:
            ds = str(d)
            if d > today:
                days.append(DayStatus(ds, 'future'))
                continue
            if ds in skip_dates:
                days.append(DayStatus(ds, skip_dates[ds]))
                continue
            n = counts.get(ds, 0)
            if n >= INDUSTRY_OK_FLOOR:
                status = 'ok'
            elif n >= INDUSTRY_PARTIAL_FLOOR:
                status = 'partial'
            else:
                status = 'missing'
            fr = round(min(100.0, n / INDUSTRY_OK_FLOOR * 100.0), 2) if n else 0.0
            days.append(DayStatus(ds, status, total=INDUSTRY_OK_FLOOR, populated=n, fill_rate=fr))
            if status == 'ok':
                latest_ok = ds

    elif dimension in ('market_breadth', 'breadth_roc'):
        counts = _row_count_by_date(conn, table, from_dt, to_dt)
        for d in trading_days:
            ds = str(d)
            if d > today:
                days.append(DayStatus(ds, 'future'))
                continue
            if ds in skip_dates:
                days.append(DayStatus(ds, skip_dates[ds]))
                continue
            n = counts.get(ds, 0)
            status = 'ok' if n > 0 else 'missing'
            days.append(DayStatus(ds, status, total=1, populated=n, fill_rate=100.0 if n else 0.0))
            if status == 'ok':
                latest_ok = ds

    elif dimension in ('equity_weekly', 'equity_monthly'):
        # Period aggregates are keyed by week_start/month_start, not trade_date.
        # A day is 'ok' when the period CONTAINING it has rows — same semantics
        # as fill_rate() below. Without this branch these dims fell through to
        # the column-fill path with cols=None, which raised, so health_grid()
        # returned them with days=[] / latest_ok=None and the dashboard showed
        # them as never-run even while the aggregates were green (2026-08-15).
        weekly = dimension == 'equity_weekly'
        period_col = 'week_start' if weekly else 'month_start'
        first_period = (from_dt - timedelta(days=from_dt.weekday())) if weekly \
            else from_dt.replace(day=1)
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT DISTINCT {period_col} FROM {table} "
                f"WHERE {period_col} BETWEEN %s AND %s",
                [first_period, to_dt],
            )
            have = {r[0] for r in cur.fetchall()}
        for d in trading_days:
            ds = str(d)
            if d > today:
                days.append(DayStatus(ds, 'future'))
                continue
            if ds in skip_dates:
                days.append(DayStatus(ds, skip_dates[ds]))
                continue
            period = (d - timedelta(days=d.weekday())) if weekly else d.replace(day=1)
            ok = period in have
            days.append(DayStatus(ds, 'ok' if ok else 'missing',
                                  total=1, populated=1 if ok else 0,
                                  fill_rate=100.0 if ok else 0.0))
            if ok:
                latest_ok = ds

    elif dimension in ('nse_reconciliation', 'bse_reconciliation'):
        # Parsed-vs-inserted, from the insert step's run metadata — the same
        # math as fill_rate() below. Days whose insert run predates the
        # reconciliation fields (pre migration-167 deploys) are 'no_data', not
        # 'missing': unknown is not the same as broken, and these dims have no
        # fix handler for the gap sweep to act on anyway (see
        # OBSERVATIONAL_DIMENSIONS).
        exch = 'NSE' if dimension.startswith('nse') else 'BSE'
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT ON (trade_date) trade_date, metadata "
                "FROM km_pipeline_runs "
                "WHERE exchange = %s AND step = 'insert' AND metadata IS NOT NULL "
                "  AND trade_date BETWEEN %s AND %s "
                "ORDER BY trade_date, id DESC",
                [exch, from_dt, to_dt],
            )
            metas = {str(r[0]): r[1] for r in cur.fetchall()}
        if exch == 'NSE':
            from pipeline.processors.symbol_registrar import NSE_EQUITY_SERIES
        for d in trading_days:
            ds = str(d)
            if d > today:
                days.append(DayStatus(ds, 'future'))
                continue
            if ds in skip_dates:
                days.append(DayStatus(ds, skip_dates[ds]))
                continue
            meta_row = metas.get(ds)
            matched = meta_row.get('matched_count') if meta_row else None
            if matched is None:
                days.append(DayStatus(ds, 'no_data'))
                continue
            if exch == 'NSE':
                by_series = meta_row.get('unmatched_by_series') or {}
                missed = sum(v for k, v in by_series.items() if k in NSE_EQUITY_SERIES)
            else:
                missed = int(meta_row.get('unmatched_count') or 0)
            total = int(matched) + int(missed)
            if total <= 0:
                days.append(DayStatus(ds, 'no_data'))
                continue
            frac = int(matched) / total
            status = _classify(frac, ok_threshold)
            days.append(DayStatus(ds, status, total=total, populated=int(matched),
                                  fill_rate=round(frac * 100.0, 2)))
            if status == 'ok':
                latest_ok = ds

    else:
        exchange = _exchange_for(dimension)
        coverage = _coverage_by_date_column_fill(conn, table, cols, exchange, from_dt, to_dt)
        for d in trading_days:
            ds = str(d)
            if d > today:
                days.append(DayStatus(ds, 'future'))
                continue
            if ds in skip_dates:
                days.append(DayStatus(ds, skip_dates[ds]))
                continue
            total, populated = coverage.get(ds, (0, 0))
            if total <= 0:
                days.append(DayStatus(ds, 'missing', total=0, populated=0, fill_rate=0.0))
                continue
            frac = populated / total
            status = _classify(frac, ok_threshold)
            fr = round(frac * 100.0, 2)
            days.append(DayStatus(ds, status, total=total, populated=populated, fill_rate=fr))
            if status == 'ok':
                latest_ok = ds

    return DimensionHealth(
        dimension=dimension,
        label=label_for(dimension),
        group=group_for(dimension),
        latest_ok=latest_ok,
        days=days,
    )


# Fixed dimension order for the grid — downloads first, then the compute DAG.
DIMENSION_ORDER = [
    # ── Downloads (row-count check) ───────────────────────────────────
    'index_eod_download',
    'nse_eod_download',
    'bse_eod_download',
    # ── Compute ──────────────────────────────────────────────────────
    'index_indicators',
    'nse_equity_indicators',
    'bse_equity_indicators',
    'index_flow',
    'nse_flow',
    'bse_flow',
    'index_magic_rs',
    'nse_magic_rs',
    'bse_magic_rs',
    'rs_percentile',
    'supertrend',
    'rolling_metrics',
    'd365',
    'stage_classification',
    'vani_flags',
    'industry_composites',
    'market_breadth',
    'breadth_roc',
    'equity_weekly',
    'equity_monthly',
    # ── Reconciliation (parsed vs inserted) ──────────────────────────
    'nse_reconciliation',
    'bse_reconciliation',
]


# Dimensions that MEASURE an outcome but have no fix handler of their own —
# the remedy for a bad reconciliation day is re-running the eod download /
# insert, which the gap sweep already enqueues via the *_eod_download dims.
# The sweep must skip these or its fix jobs die in the worker with
# "unknown dimension".
OBSERVATIONAL_DIMENSIONS = {'nse_reconciliation', 'bse_reconciliation'}


def health_grid(conn, days: int = 30) -> list[dict]:
    """Build the full fill-rate grid for the UI. `days` = weekday lookback."""
    trading_days = weekday_range(days)
    from_dt, to_dt = trading_days[0], trading_days[-1]
    skips = _skip_dates(conn, from_dt, to_dt)

    rows: list[dict] = []
    for dim in DIMENSION_ORDER:
        try:
            rows.append(_health_row(conn, dim, trading_days, skips).to_dict())
        except Exception as e:
            rows.append({
                'dimension': dim,
                'label': label_for(dim),
                'group': group_for(dim),
                'latest_ok': None,
                'days': [],
                'error': str(e),
            })
    return rows


# ── Single-fill-rate helpers used by handlers ───────────────────────────

def fill_rate_pair(conn, dimension: str, trade_date: date) -> float:
    """Alias — kept separate from `fill_rate` so handlers can import a
    clearly-named symbol ('the before/after reading')."""
    return fill_rate(conn, dimension, trade_date)


def ok_threshold_for(dimension: str) -> float | None:
    """Return the healthy fraction (0..1) for a dimension, or None for
    row-presence dimensions where the check is binary."""
    meta = DIMENSION_HEALTH.get(dimension)
    if not meta:
        return None
    return meta[3]
