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
    'index_indicators':      ('km_index_eod',     'index_id',  ['rsi_14', 'sma_21', 'sma_55', 'atr_14', 'rvol'],           1.0),
    'nse_equity_indicators': ('km_equity_eod',    'equity_id', ['rsi_14', 'sma_21', 'sma_50', 'atr_14', 'rvol'],           0.95),
    'bse_equity_indicators': ('km_equity_eod',    'equity_id', ['rsi_14', 'sma_21', 'sma_50', 'atr_14', 'rvol'],           0.95),
    'index_flow':            ('km_index_eod',     'index_id',  ['flow_type'],                                              1.0),
    'nse_flow':              ('km_equity_eod',    'equity_id', ['flow_type'],                                              0.95),
    'bse_flow':              ('km_equity_eod',    'equity_id', ['flow_type'],                                              0.95),
    'nse_magic_rs':          ('km_equity_eod',    'equity_id', ['magic_rs_zone'],                                          0.95),
    'bse_magic_rs':          ('km_equity_eod',    'equity_id', ['magic_rs_zone'],                                          0.95),
    'industry_composites':   ('km_industry_eod',  None,        None,                                                       None),
    'market_breadth':        ('km_market_breadth', None,       None,                                                       None),
    'breadth_roc':           ('km_breadth_roc',   None,        None,                                                       None),
}


# Display labels — hand-curated so NSE/BSE/RS/ROC render with correct casing.
# A generic title() would produce "Nse Equity Indicators" and "Bse Magic Rs".
LABELS: dict[str, str] = {
    'index_indicators':      'Index Indicators',
    'nse_equity_indicators': 'NSE Equity Indicators',
    'bse_equity_indicators': 'BSE Equity Indicators',
    'index_flow':            'Index Flow',
    'nse_flow':              'NSE Flow',
    'bse_flow':              'BSE Flow',
    'nse_magic_rs':          'NSE Magic RS',
    'bse_magic_rs':          'BSE Magic RS',
    'industry_composites':   'Industry Composites',
    'market_breadth':        'Market Breadth',
    'breadth_roc':           'Breadth ROC',
}


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
    latest_ok: str | None
    days: list[DayStatus]

    def to_dict(self) -> dict:
        return {
            'dimension': self.dimension,
            'label': self.label,
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

    with conn.cursor() as cur:
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
    if frac >= ok_threshold:
        return 'ok'
    if frac >= 0.5:
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


def _health_row(
    conn, dimension: str, trading_days: list[date], skip_dates: dict[str, str],
) -> DimensionHealth:
    meta = DIMENSION_HEALTH[dimension]
    table, id_col, cols, ok_threshold = meta
    from_dt, to_dt = trading_days[0], trading_days[-1]
    today = date.today()

    days: list[DayStatus] = []
    latest_ok: str | None = None

    if dimension == 'industry_composites':
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
        latest_ok=latest_ok,
        days=days,
    )


# Fixed dimension order for the grid — matches the compute DAG.
DIMENSION_ORDER = [
    'index_indicators',
    'nse_equity_indicators',
    'bse_equity_indicators',
    'index_flow',
    'nse_flow',
    'bse_flow',
    'nse_magic_rs',
    'bse_magic_rs',
    'industry_composites',
    'market_breadth',
    'breadth_roc',
]


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
