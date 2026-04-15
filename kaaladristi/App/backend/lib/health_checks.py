"""
Kāla-Drishti — Data Health Checks
====================================
Modular health check registry. Each check reports 60 trading days
of coverage status for one data dimension.

Adding a new health check:
  1. Write a function: def check_xxx(db, trading_days, skip_dates) -> HealthRow
  2. Register it in HEALTH_CHECKS list at the bottom
"""

from datetime import date, timedelta


def _generate_trading_days(n: int = 60) -> list[date]:
    """Generate last N weekdays (Mon-Fri) ending at today, newest last."""
    days = []
    cursor = date.today()
    while len(days) < n:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return days


def _query_distinct_dates(db, sql: str, params: list = None) -> set[str]:
    """Run a raw SQL query that returns date rows, return as set of date strings."""
    try:
        conn = db._conn()
        try:
            import psycopg2.extras
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params or [])
                rows = cur.fetchall()
            return {str(r['trade_date']) for r in rows if r.get('trade_date')}
        finally:
            db._put(conn)
    except Exception as e:
        print(f'  [health] query error: {e}')
        return set()


def _get_skip_dates(db, from_date: str, to_date: str) -> dict[str, str]:
    """Get holidays and no_data dates from trading calendar. Returns {date: status}."""
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT trade_date, status, is_holiday FROM km_trading_calendar "
                    "WHERE (is_holiday = TRUE OR status IN ('holiday', 'no_data', 'weekend')) "
                    "AND trade_date BETWEEN %s AND %s",
                    [from_date, to_date]
                )
                result = {}
                for r in cur.fetchall():
                    ds = str(r['trade_date'])
                    if r.get('is_holiday') or r.get('status') == 'holiday':
                        result[ds] = 'holiday'
                    else:
                        result[ds] = 'no_data'
                return result
        finally:
            db._put(conn)
    except Exception:
        return {}


def _build_day_statuses(trading_days: list[date], dates_with_data: set[str],
                        skip_dates: dict[str, str] = None) -> list[dict]:
    """Build per-day status array. skip_dates maps date_str -> 'holiday'|'no_data'."""
    today = date.today()
    result = []
    for d in trading_days:
        ds = str(d)
        if d > today:
            result.append({'date': ds, 'status': 'future'})
        elif skip_dates and ds in skip_dates:
            result.append({'date': ds, 'status': skip_dates[ds]})
        elif ds in dates_with_data:
            result.append({'date': ds, 'status': 'ok'})
        else:
            result.append({'date': ds, 'status': 'missing'})
    return result


def _latest_date(dates: set[str]) -> str | None:
    return max(dates) if dates else None


# ── Health Check Functions ───────────────────────────────────────────────────


def check_nse_equities(db, trading_days, skip_dates):
    """NSE equity EOD data coverage — checks actual data in km_equity_eod."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'NSE' "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'nse_equities', 'layer': 'download', 'label': 'NSE Equities',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_bse_equities(db, trading_days, skip_dates):
    """BSE equity EOD data coverage — checks actual data in km_equity_eod."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'BSE' "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'bse_equities', 'layer': 'download', 'label': 'BSE Equities',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_indexes(db, trading_days, skip_dates):
    """Index EOD data coverage (distinct trade_dates in km_index_eod)."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_index_eod "
        "WHERE trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'indexes', 'layer': 'download', 'label': 'Indexes',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_fii_dii(db, trading_days, skip_dates):
    """FII/DII activity data coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_fii_dii "
        "WHERE trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'fii_dii', 'layer': 'download', 'label': 'FII / DII',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_panchang(db, trading_days, skip_dates):
    """Panchangam data coverage."""
    dates = _query_distinct_dates(db,
        "SELECT date AS trade_date FROM km_daily_panchang "
        "WHERE date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'panchang', 'layer': 'download', 'label': 'Panchangam',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_indicators(db, trading_days, skip_dates):
    """Index technical indicators coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_index_eod "
        "WHERE indicators_computed_at IS NOT NULL "
        "AND trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'indicators', 'layer': 'snapshot', 'label': 'Index Indicators',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_nse_equity_indicators(db, trading_days, skip_dates):
    """NSE equity technical indicators coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'NSE' AND e.indicators_computed_at IS NOT NULL "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'nse_equity_indicators', 'layer': 'snapshot', 'label': 'NSE Equity Indicators',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_bse_equity_indicators(db, trading_days, skip_dates):
    """BSE equity technical indicators coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'BSE' AND e.indicators_computed_at IS NOT NULL "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'bse_equity_indicators', 'layer': 'snapshot', 'label': 'BSE Equity Indicators',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_nse_magic_rs(db, trading_days, skip_dates):
    """NSE equity MagicRS coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'NSE' AND e.magic_rs_zone IS NOT NULL "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'nse_magic_rs', 'layer': 'snapshot', 'label': 'NSE Magic RS',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_bse_magic_rs(db, trading_days, skip_dates):
    """BSE equity MagicRS coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'BSE' AND e.magic_rs_zone IS NOT NULL "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'bse_magic_rs', 'layer': 'snapshot', 'label': 'BSE Magic RS',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_nse_flow_intelligence(db, trading_days, skip_dates):
    """NSE equity flow intelligence (flow_type) coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'NSE' AND e.flow_type IS NOT NULL "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'nse_flow_intelligence', 'layer': 'snapshot', 'label': 'NSE Flow Intelligence',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_bse_flow_intelligence(db, trading_days, skip_dates):
    """BSE equity flow intelligence (flow_type) coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        "WHERE s.exchange = 'BSE' AND e.flow_type IS NOT NULL "
        "AND e.trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'bse_flow_intelligence', 'layer': 'snapshot', 'label': 'BSE Flow Intelligence',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_flow_intelligence(db, trading_days, skip_dates):
    """Index flow intelligence (flow_type) coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_index_eod "
        "WHERE flow_type IS NOT NULL "
        "AND trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'flow_intelligence', 'layer': 'snapshot', 'label': 'Index Flow Intelligence',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_industry_composites(db, trading_days, skip_dates):
    """Industry composites (km_industry_eod) coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_industry_eod "
        "WHERE trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'industry_composites', 'layer': 'snapshot', 'label': 'Industry Composites',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_market_breadth(db, trading_days, skip_dates):
    """Market breadth computation coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_market_breadth "
        "WHERE trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'market_breadth', 'layer': 'snapshot', 'label': 'Market Breadth',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


def check_breadth_roc(db, trading_days, skip_dates):
    """Breadth ROC computation coverage."""
    dates = _query_distinct_dates(db,
        "SELECT DISTINCT trade_date FROM km_breadth_roc "
        "WHERE trade_date BETWEEN %s AND %s",
        [str(trading_days[0]), str(trading_days[-1])])
    return {
        'id': 'breadth_roc', 'layer': 'snapshot', 'label': 'Breadth ROC',
        'latest_date': _latest_date(dates),
        'days': _build_day_statuses(trading_days, dates, skip_dates),
    }


# ── Registry ─────────────────────────────────────────────────────────────────

HEALTH_CHECKS = [
    # Layer: download
    check_nse_equities,
    check_bse_equities,
    check_indexes,
    check_fii_dii,
    check_panchang,
    # Layer: snapshot (computation)
    check_indicators,
    check_nse_equity_indicators,
    check_bse_equity_indicators,
    check_nse_magic_rs,
    check_bse_magic_rs,
    check_flow_intelligence,
    check_nse_flow_intelligence,
    check_bse_flow_intelligence,
    check_industry_composites,
    check_market_breadth,
    check_breadth_roc,
]


def run_all_health_checks(db, days: int = 60) -> list[dict]:
    """Run all registered health checks and return results."""
    trading_days = _generate_trading_days(days)
    from_date = str(trading_days[0])
    to_date = str(trading_days[-1])
    skip_dates = _get_skip_dates(db, from_date, to_date)

    results = []
    for check_fn in HEALTH_CHECKS:
        try:
            results.append(check_fn(db, trading_days, skip_dates))
        except Exception as e:
            results.append({
                'id': check_fn.__name__.replace('check_', ''),
                'layer': 'unknown', 'label': check_fn.__name__,
                'latest_date': None, 'days': [], 'error': str(e),
            })
    return results
