"""
Kāla-Drishti — Data Health Checks
====================================
Modular health check registry. Each check reports 60 trading days
of coverage status for one data dimension.

Adding a new health check:
  1. Write a function: def check_xxx(db, trading_days) -> HealthRow
  2. Register it in HEALTH_CHECKS list at the bottom
"""

from datetime import date, timedelta


# ── Types ────────────────────────────────────────────────────────────────────

# Per-day status: 'ok' | 'missing' | 'partial' | 'holiday' | 'future'
# HealthRow: { id, layer, label, latest_date, days: [{date, status, detail?}] }


def _generate_trading_days(n: int = 60) -> list[date]:
    """Generate last N weekdays (Mon-Fri) ending at today, newest last."""
    days = []
    cursor = date.today()
    while len(days) < n:
        if cursor.weekday() < 5:  # Mon=0 .. Fri=4
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()  # oldest first
    return days


def _date_set_from_query(db, table: str, date_col: str = 'trade_date',
                         filters: dict = None, days: list[date] = None) -> set[str]:
    """Query a table and return set of date strings that have data."""
    if not days:
        return set()

    from_date = str(days[0])
    to_date = str(days[-1])

    try:
        rows = db.select(
            table, date_col,
            filters=filters or {},
            order=f'{date_col}.asc',
            limit=5000,
        )
        return {str(r[date_col]) for r in (rows or []) if r.get(date_col)}
    except Exception:
        return set()


def _count_by_date(db, table: str, date_col: str = 'trade_date',
                   count_col: str = '*', filters: dict = None,
                   days: list[date] = None) -> dict[str, int]:
    """Query distinct count per date. Returns {date_str: count}."""
    # PostgREST doesn't support GROUP BY, so we fetch and count client-side
    try:
        rows = db.select(
            table, date_col,
            filters=filters or {},
            order=f'{date_col}.asc',
            limit=50000,
        )
        counts: dict[str, int] = {}
        for r in (rows or []):
            d = str(r.get(date_col, ''))
            counts[d] = counts.get(d, 0) + 1
        return counts
    except Exception:
        return {}


def _get_holidays(db, exchange: str = 'NSE') -> set[str]:
    """Get known holidays from trading calendar."""
    try:
        rows = db.select(
            'km_trading_calendar', 'trade_date',
            filters={'exchange': exchange, 'is_holiday': True},
            limit=500,
        )
        return {str(r['trade_date']) for r in (rows or [])}
    except Exception:
        return set()


def _build_day_statuses(trading_days: list[date], dates_with_data: set[str],
                        holidays: set[str] = None) -> list[dict]:
    """Build per-day status array."""
    today = date.today()
    result = []
    for d in trading_days:
        ds = str(d)
        if d > today:
            result.append({'date': ds, 'status': 'future'})
        elif holidays and ds in holidays:
            result.append({'date': ds, 'status': 'holiday'})
        elif ds in dates_with_data:
            result.append({'date': ds, 'status': 'ok'})
        else:
            result.append({'date': ds, 'status': 'missing'})
    return result


def _latest_date(dates_with_data: set[str]) -> str | None:
    """Return the most recent date string from a set."""
    if not dates_with_data:
        return None
    return max(dates_with_data)


# ── Health Check Functions ───────────────────────────────────────────────────


def check_nse_equities(db, trading_days: list[date], holidays: set[str]) -> dict:
    """NSE equity EOD data coverage."""
    dates = _date_set_from_query(db, 'km_trading_calendar',
                                 filters={'exchange': 'NSE', 'status': 'completed'},
                                 days=trading_days)
    return {
        'id': 'nse_equities',
        'layer': 'download',
        'label': 'NSE Equities',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_bse_equities(db, trading_days: list[date], holidays: set[str]) -> dict:
    """BSE equity EOD data coverage."""
    dates = _date_set_from_query(db, 'km_trading_calendar',
                                 filters={'exchange': 'BSE', 'status': 'completed'},
                                 days=trading_days)
    return {
        'id': 'bse_equities',
        'layer': 'download',
        'label': 'BSE Equities',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_indexes(db, trading_days: list[date], holidays: set[str]) -> dict:
    """Index EOD data — check distinct trade_dates in km_index_eod."""
    dates = _date_set_from_query(db, 'km_index_eod', days=trading_days)
    day_strs = {str(d) for d in trading_days}
    dates = dates & day_strs  # only keep dates in our window
    return {
        'id': 'indexes',
        'layer': 'download',
        'label': 'Indexes',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_fii_dii(db, trading_days: list[date], holidays: set[str]) -> dict:
    """FII/DII activity data coverage."""
    dates = _date_set_from_query(db, 'km_fii_dii', days=trading_days)
    day_strs = {str(d) for d in trading_days}
    dates = dates & day_strs
    return {
        'id': 'fii_dii',
        'layer': 'download',
        'label': 'FII / DII',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_panchang(db, trading_days: list[date], holidays: set[str]) -> dict:
    """Panchangam data coverage."""
    dates = _date_set_from_query(db, 'km_daily_panchang', date_col='date',
                                 days=trading_days)
    day_strs = {str(d) for d in trading_days}
    dates = dates & day_strs
    return {
        'id': 'panchang',
        'layer': 'download',
        'label': 'Panchangam',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_indicators(db, trading_days: list[date], holidays: set[str]) -> dict:
    """Technical indicators computed — check indicators_computed_at IS NOT NULL."""
    try:
        # Check which trade_dates have at least one row with indicators computed
        rows = db.select(
            'km_index_eod', 'trade_date',
            order='trade_date.asc', limit=50000,
        )
        # Filter to rows where indicators_computed_at exists
        # PostgREST: we can't easily filter NOT NULL, so fetch all and check
        dates_with_indicators = set()
        for r in (rows or []):
            if r.get('indicators_computed_at'):
                dates_with_indicators.add(str(r['trade_date']))
    except Exception:
        dates_with_indicators = set()

    day_strs = {str(d) for d in trading_days}
    dates_with_indicators = dates_with_indicators & day_strs

    return {
        'id': 'indicators',
        'layer': 'snapshot',
        'label': 'Indicators',
        'latest_date': _latest_date(dates_with_indicators),
        'days': _build_day_statuses(trading_days, dates_with_indicators, holidays),
    }


def check_flow_intelligence(db, trading_days: list[date], holidays: set[str]) -> dict:
    """Flow intelligence (flow_type) coverage on index EOD."""
    try:
        rows = db.select('km_index_eod', 'trade_date,flow_type',
                         order='trade_date.asc', limit=50000)
        dates = {str(r['trade_date']) for r in (rows or [])
                 if r.get('flow_type') is not None}
    except Exception:
        dates = set()

    day_strs = {str(d) for d in trading_days}
    dates = dates & day_strs

    return {
        'id': 'flow_intelligence',
        'layer': 'snapshot',
        'label': 'Flow Intelligence',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_market_breadth(db, trading_days: list[date], holidays: set[str]) -> dict:
    """Market breadth computation coverage."""
    dates = _date_set_from_query(db, 'km_market_breadth', days=trading_days)
    day_strs = {str(d) for d in trading_days}
    dates = dates & day_strs
    return {
        'id': 'market_breadth',
        'layer': 'snapshot',
        'label': 'Market Breadth',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


def check_breadth_roc(db, trading_days: list[date], holidays: set[str]) -> dict:
    """Breadth ROC computation coverage."""
    dates = _date_set_from_query(db, 'km_breadth_roc', days=trading_days)
    day_strs = {str(d) for d in trading_days}
    dates = dates & day_strs
    return {
        'id': 'breadth_roc',
        'layer': 'snapshot',
        'label': 'Breadth ROC',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, holidays),
    }


# ── Registry ─────────────────────────────────────────────────────────────────
# Add new checks here — they'll automatically appear in the health grid.

HEALTH_CHECKS = [
    # Layer: download
    check_nse_equities,
    check_bse_equities,
    check_indexes,
    check_fii_dii,
    check_panchang,
    # Layer: snapshot
    check_indicators,
    check_flow_intelligence,
    check_market_breadth,
    check_breadth_roc,
]


def run_all_health_checks(db) -> list[dict]:
    """Run all registered health checks and return results."""
    trading_days = _generate_trading_days(60)
    holidays = _get_holidays(db)
    results = []
    for check_fn in HEALTH_CHECKS:
        try:
            results.append(check_fn(db, trading_days, holidays))
        except Exception as e:
            results.append({
                'id': check_fn.__name__.replace('check_', ''),
                'layer': 'unknown',
                'label': check_fn.__name__,
                'latest_date': None,
                'days': [],
                'error': str(e),
            })
    return results
