"""
Kāla-Drishti — Data Health Checks
====================================
Modular health check registry. Each check reports 60 trading days
of coverage status for one data dimension.

Adding a new health check:
  1. Write a function: def check_xxx(db, trading_days, skip_dates) -> HealthRow
  2. Register it in HEALTH_CHECKS list at the bottom
  3. If the dimension has a backing step in km_pipeline_runs or a fix:*
     job in km_jobs, register it in DIMENSION_META below so per-day errors
     and last-job metadata surface on the UI.
"""

import json as _json
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
    """Build per-day status array. skip_dates maps date_str -> 'holiday'|'no_data'.
    Row-presence classification: date present => 'ok', absent => 'missing'."""
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


def _build_day_statuses_coverage(trading_days: list[date],
                                 coverage_by_date: dict[str, tuple[int, int]],
                                 skip_dates: dict[str, str] = None,
                                 ok_threshold: float = 0.95,
                                 partial_threshold: float = 0.5) -> list[dict]:
    """Column-fill classification. coverage_by_date maps date_str -> (total, populated).

    A date is:
      * 'ok'      if populated / total >= ok_threshold
      * 'partial' if populated / total >= partial_threshold (but < ok_threshold)
      * 'missing' otherwise (including when total == 0)

    Each day dict carries `coverage_pct` so the UI tooltip can show the exact
    fill percentage instead of a binary ok/missing.
    """
    today = date.today()
    result = []
    for d in trading_days:
        ds = str(d)
        if d > today:
            result.append({'date': ds, 'status': 'future'})
            continue
        if skip_dates and ds in skip_dates:
            result.append({'date': ds, 'status': skip_dates[ds]})
            continue

        total, populated = coverage_by_date.get(ds, (0, 0))
        if total <= 0:
            result.append({'date': ds, 'status': 'missing', 'coverage_pct': 0.0,
                           'populated_rows': 0, 'total_rows': 0})
            continue

        frac = populated / total
        pct = round(frac * 100, 2)
        if frac >= ok_threshold:
            status = 'ok'
        elif frac >= partial_threshold:
            status = 'partial'
        else:
            status = 'missing'
        result.append({'date': ds, 'status': status, 'coverage_pct': pct,
                       'populated_rows': populated, 'total_rows': total})
    return result


def _column_fill_by_date(db, sql: str, params: list) -> dict[str, tuple[int, int]]:
    """Run a SQL that returns (trade_date, total, populated) per row.
    Returns {date_str: (total, populated)}."""
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                out: dict[str, tuple[int, int]] = {}
                for r in cur.fetchall():
                    ds = str(r['trade_date'])
                    total = int(r.get('total') or 0)
                    populated = int(r.get('populated') or 0)
                    out[ds] = (total, populated)
                return out
        finally:
            db._put(conn)
    except Exception as e:
        print(f'  [health] column_fill query error: {e}')
        return {}


def _latest_date(dates: set[str]) -> str | None:
    return max(dates) if dates else None


def _latest_date_from_coverage(coverage: dict[str, tuple[int, int]],
                               min_frac: float = 0.5) -> str | None:
    """Latest date where at least `min_frac` of rows are populated.
    Used as the "last good date" label under a row."""
    good = [d for d, (total, pop) in coverage.items()
            if total > 0 and pop / total >= min_frac]
    return max(good) if good else None


# ── Error / job-result lookups ───────────────────────────────────────────────
#
# Maps a dimension id (as returned by a check function) to the km_pipeline_runs
# step name + exchange filter used to look up per-day error messages, and to
# the km_jobs.job_type used to look up the most recent fix attempt.
#
# Notes on why some entries are None:
#   * 'flow_intelligence' (index flow): daily_pipeline.py:158-169 does NOT
#     call StepTracker for index flow — it only prints. No error_msg will
#     ever appear in km_pipeline_runs for this dimension.
#   * 'market_breadth' / 'breadth_roc': computed in Python inside
#     pipeline_api._refresh_market_breadth / _refresh_breadth_roc with no
#     StepTracker wrapper. No per-day errors either.
#   * 'bse_magic_rs': daily_pipeline.run_bse_pipeline does not compute
#     magic_rs. NSE's magic_rs step RPC writes zones across all equities
#     (exchange-agnostic), so BSE coverage derives from NSE's run. No
#     per-day error tracking for the BSE view.
#
# Indicator columns sampled to decide "is this row fully computed?" for
# indicator-family dimensions. The ground-truth case that motivated this:
# 2026-04-15 had 92/92 rows stamped with indicators_computed_at but only 23/92
# with sma_21 populated — the stamp lied. Checking actual columns catches that.
_INDICATOR_SAMPLE_COLS = ['rsi_14', 'sma_21', 'sma_50', 'atr_14', 'rvol']

DIMENSION_META: dict[str, dict] = {
    # dim id                   → step name in km_pipeline_runs, exchange filter, fix job_type,
    #                            coverage_cols (columns that must all be non-NULL for a row
    #                            to count as "populated"), and ok/partial thresholds.
    'nse_equities':            {'step': 'insert',                'exchange': 'NSE', 'fix': 'fix:nse_equities'},
    'bse_equities':            {'step': 'insert',                'exchange': 'BSE', 'fix': 'fix:bse_equities'},

    'indicators':              {'step': 'index_indicators',      'exchange': 'NSE', 'fix': 'fix:indicators',
                                'coverage_cols': _INDICATOR_SAMPLE_COLS,
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},
    'nse_equity_indicators':   {'step': 'indicators',            'exchange': 'NSE', 'fix': 'fix:nse_equity_indicators',
                                'coverage_cols': _INDICATOR_SAMPLE_COLS,
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},
    'bse_equity_indicators':   {'step': 'indicators',            'exchange': 'BSE', 'fix': 'fix:bse_equity_indicators',
                                'coverage_cols': _INDICATOR_SAMPLE_COLS,
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},

    'nse_magic_rs':            {'step': 'magic_rs',              'exchange': 'NSE', 'fix': 'fix:magic_rs',
                                'coverage_cols': ['magic_rs_zone', 'magic_rs'],
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},
    # BSE Magic RS has no dedicated scheduler step — NSE's magic_rs RPC runs
    # over the whole km_equity_eod table exchange-agnostically, so the NSE
    # run's error_msg is the closest truth for BSE rows too. We alias
    # step='magic_rs' + exchange='NSE' so the UI still shows *some* error
    # source on BSE Magic RS red squares.
    'bse_magic_rs':            {'step': 'magic_rs',              'exchange': 'NSE', 'fix': 'fix:magic_rs',
                                'coverage_cols': ['magic_rs_zone', 'magic_rs'],
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},

    'flow_intelligence':       {'step': 'index_flow_intelligence','exchange': 'NSE', 'fix': 'fix:flow_intelligence',
                                'coverage_cols': ['flow_type'],
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},
    'nse_flow_intelligence':   {'step': 'flow_intelligence',     'exchange': 'NSE', 'fix': 'fix:flow_intelligence',
                                'coverage_cols': ['flow_type'],
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},
    'bse_flow_intelligence':   {'step': 'flow_intelligence',     'exchange': 'BSE', 'fix': 'fix:flow_intelligence',
                                'coverage_cols': ['flow_type'],
                                'ok_threshold': 0.95, 'partial_threshold': 0.5},

    # BSE delivery (SCBSEALL feed). Delivery lands during the bse_eod_download
    # step (step='delivery' in run_bse_pipeline); the wrench reuses the BSE-EOD
    # fix, which re-runs download incl. delivery. Thresholds are intentionally
    # looser than NSE's 0.95 — the BSE traded universe is messier and some
    # scrips are absent from SCBSEALL; recalibrate once real fill is observed.
    'bse_delivery':            {'step': 'delivery',              'exchange': 'BSE', 'fix': 'fix:bse_equities',
                                'coverage_cols': ['delivery_pct'],
                                'ok_threshold': 0.85, 'partial_threshold': 0.4},

    # Single-row-per-date aggregates — row-presence is the right semantic.
    'industry_composites':     {'step': 'industry_composites',   'exchange': 'NSE', 'fix': 'fix:industry_composites'},
    'market_breadth':          {'step': 'market_breadth',        'exchange': 'NSE', 'fix': 'fix:market_breadth'},
    'breadth_roc':             {'step': 'breadth_roc',           'exchange': 'NSE', 'fix': 'fix:breadth_roc'},

    'fii_dii':                 {'step': 'fii_dii',               'exchange': 'NSE', 'fix': 'fix:fii_dii'},
}


def _errors_by_date(db, step: str, exchange: str | None,
                    from_date: str, to_date: str) -> dict[str, dict]:
    """Fetch per-trade_date status/error from km_pipeline_runs for a given step.
    Returns {date_str: {status, error_msg, rows_count, rows_expected, coverage_pct}}.
    Empty dict if step is None or on any DB error."""
    if not step:
        return {}
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                sql = (
                    "SELECT trade_date, status, error_msg, rows_count, "
                    "rows_expected, coverage_pct "
                    "FROM km_pipeline_runs "
                    "WHERE step = %s AND trade_date BETWEEN %s AND %s"
                )
                params: list = [step, from_date, to_date]
                if exchange:
                    sql += ' AND exchange = %s'
                    params.append(exchange)
                cur.execute(sql, params)
                result: dict[str, dict] = {}
                for r in cur.fetchall():
                    ds = str(r['trade_date'])
                    result[ds] = {
                        'status': r.get('status'),
                        'error_msg': r.get('error_msg'),
                        'rows_count': r.get('rows_count'),
                        'rows_expected': r.get('rows_expected'),
                        'coverage_pct': float(r['coverage_pct']) if r.get('coverage_pct') is not None else None,
                    }
                return result
        finally:
            db._put(conn)
    except Exception as e:
        print(f'  [health] errors_by_date error ({step}/{exchange}): {e}')
        return {}


def _latest_job(db, job_type: str | None) -> dict | None:
    """Fetch the most recent km_jobs row for a given job_type.
    Returns {status, error_msg, rows_updated, completed_at} or None."""
    if not job_type:
        return None
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT status, error_msg, result, completed_at "
                    "FROM km_jobs WHERE job_type = %s "
                    "ORDER BY created_at DESC LIMIT 1",
                    [job_type],
                )
                row = cur.fetchone()
                if not row:
                    return None
                rows_updated = None
                res = row.get('result')
                if isinstance(res, str):
                    try:
                        res = _json.loads(res)
                    except Exception:
                        res = None
                if isinstance(res, dict):
                    # Worker writes `{'rows': N}` (worker.py:646). Fall back to
                    # other keys if a handler ever writes a different shape.
                    rows_updated = res.get('rows')
                    if rows_updated is None:
                        rows_updated = res.get('rows_updated')
                    if rows_updated is None:
                        rows_updated = res.get('total')
                completed_at = row.get('completed_at')
                return {
                    'status': row.get('status'),
                    'error_msg': row.get('error_msg'),
                    'rows_updated': rows_updated,
                    'completed_at': completed_at.isoformat() if completed_at else None,
                }
        finally:
            db._put(conn)
    except Exception as e:
        print(f'  [health] latest_job error ({job_type}): {e}')
        return None


def _enrich_row(db, row: dict, from_date: str, to_date: str) -> None:
    """Annotate a HealthRow in-place with per-day errors and last-job metadata."""
    meta = DIMENSION_META.get(row.get('id'))
    if not meta:
        return

    errors = _errors_by_date(db, meta.get('step'), meta.get('exchange'), from_date, to_date)
    latest_error: str | None = None
    latest_error_date: str | None = None
    for day in row.get('days') or []:
        info = errors.get(day.get('date'))
        if not info:
            continue
        err_msg = info.get('error_msg')
        if err_msg:
            day['error'] = err_msg
            day['last_run_status'] = info.get('status')
            if latest_error_date is None or day['date'] > latest_error_date:
                latest_error = err_msg
                latest_error_date = day['date']
        # Surface a completed-but-undercovered run so the UI can hint
        # "ran but only partial" even if the per-day SELECT says 'ok'.
        elif info.get('status') == 'completed' and info.get('coverage_pct') is not None and info['coverage_pct'] < 95:
            day['coverage_pct'] = info['coverage_pct']
            day['last_run_status'] = 'completed'

    row['last_error'] = latest_error
    row['last_error_date'] = latest_error_date

    job = _latest_job(db, meta.get('fix'))
    if job is not None:
        row['last_job_status'] = job.get('status')
        row['last_job_error'] = job.get('error_msg')
        row['last_job_rows_updated'] = job.get('rows_updated')
        row['last_job_completed_at'] = job.get('completed_at')


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


# ── Column-coverage helpers ──────────────────────────────────────────────────
#
# Column-fill SQL templates. Each returns (trade_date, total, populated) per
# date, where `populated` = rows where ALL sampled columns are non-NULL.
# This catches the stamped-but-empty failure mode where e.g.
# indicators_computed_at = NOW() but sma_21 = NULL.

def _indicator_populated_expr(cols: list[str]) -> str:
    """SQL expression for COUNT of rows where every sampled column is non-NULL."""
    conds = ' AND '.join(f'{c} IS NOT NULL' for c in cols)
    return (
        f"COUNT(*) FILTER (WHERE {conds})"
    )


def _index_table_coverage_sql(cols: list[str]) -> str:
    """km_index_eod (no exchange filter)."""
    return (
        "SELECT trade_date, COUNT(*) AS total, "
        f"{_indicator_populated_expr(cols)} AS populated "
        "FROM km_index_eod "
        "WHERE trade_date BETWEEN %s AND %s "
        "GROUP BY trade_date"
    )


def _equity_table_coverage_sql(cols: list[str], exchange: str) -> str:
    """km_equity_eod with exchange filter on km_equity_symbols.is_active only.
    `exchange` is interpolated (safe — validated upstream to NSE/BSE)."""
    # Table-qualify each sampled column with 'e.' so JOIN doesn't cause ambiguity.
    conds = ' AND '.join(f'e.{c} IS NOT NULL' for c in cols)
    return (
        "SELECT e.trade_date, COUNT(*) AS total, "
        f"COUNT(*) FILTER (WHERE {conds}) AS populated "
        "FROM km_equity_eod e "
        "JOIN km_equity_symbols s ON s.id = e.equity_id "
        f"WHERE s.exchange = '{exchange}' "
        "AND e.trade_date BETWEEN %s AND %s "
        "GROUP BY e.trade_date"
    )


def _coverage_row(db, row_id: str, label: str, table: str, cols: list[str],
                  exchange: str | None, trading_days, skip_dates,
                  ok_threshold: float, partial_threshold: float) -> dict:
    """Assemble a HealthRow for a column-coverage dimension."""
    from_d = str(trading_days[0])
    to_d = str(trading_days[-1])
    if table == 'km_index_eod':
        sql = _index_table_coverage_sql(cols)
        params = [from_d, to_d]
    else:
        assert exchange in ('NSE', 'BSE'), f'Bad exchange {exchange!r}'
        sql = _equity_table_coverage_sql(cols, exchange)
        params = [from_d, to_d]

    coverage = _column_fill_by_date(db, sql, params)
    days = _build_day_statuses_coverage(
        trading_days, coverage, skip_dates,
        ok_threshold=ok_threshold, partial_threshold=partial_threshold,
    )
    return {
        'id': row_id, 'layer': 'snapshot', 'label': label,
        'latest_date': _latest_date_from_coverage(coverage, min_frac=ok_threshold),
        'days': days,
    }


def check_indicators(db, trading_days, skip_dates):
    """Index technical indicators coverage. Column-fill based."""
    meta = DIMENSION_META['indicators']
    return _coverage_row(db, 'indicators', 'Index Indicators',
                         'km_index_eod', meta['coverage_cols'], None,
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_nse_equity_indicators(db, trading_days, skip_dates):
    meta = DIMENSION_META['nse_equity_indicators']
    return _coverage_row(db, 'nse_equity_indicators', 'NSE Equity Indicators',
                         'km_equity_eod', meta['coverage_cols'], 'NSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_bse_equity_indicators(db, trading_days, skip_dates):
    meta = DIMENSION_META['bse_equity_indicators']
    return _coverage_row(db, 'bse_equity_indicators', 'BSE Equity Indicators',
                         'km_equity_eod', meta['coverage_cols'], 'BSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_nse_magic_rs(db, trading_days, skip_dates):
    meta = DIMENSION_META['nse_magic_rs']
    return _coverage_row(db, 'nse_magic_rs', 'NSE Magic RS',
                         'km_equity_eod', meta['coverage_cols'], 'NSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_bse_magic_rs(db, trading_days, skip_dates):
    meta = DIMENSION_META['bse_magic_rs']
    return _coverage_row(db, 'bse_magic_rs', 'BSE Magic RS',
                         'km_equity_eod', meta['coverage_cols'], 'BSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_nse_flow_intelligence(db, trading_days, skip_dates):
    meta = DIMENSION_META['nse_flow_intelligence']
    return _coverage_row(db, 'nse_flow_intelligence', 'NSE Flow Intelligence',
                         'km_equity_eod', meta['coverage_cols'], 'NSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_bse_flow_intelligence(db, trading_days, skip_dates):
    meta = DIMENSION_META['bse_flow_intelligence']
    return _coverage_row(db, 'bse_flow_intelligence', 'BSE Flow Intelligence',
                         'km_equity_eod', meta['coverage_cols'], 'BSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_bse_delivery(db, trading_days, skip_dates):
    """BSE delivery (delivery_pct) column fill — from the SCBSEALL feed."""
    meta = DIMENSION_META['bse_delivery']
    return _coverage_row(db, 'bse_delivery', 'BSE Delivery',
                         'km_equity_eod', meta['coverage_cols'], 'BSE',
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


def check_flow_intelligence(db, trading_days, skip_dates):
    """Index flow intelligence — km_index_eod column fill."""
    meta = DIMENSION_META['flow_intelligence']
    return _coverage_row(db, 'flow_intelligence', 'Index Flow Intelligence',
                         'km_index_eod', meta['coverage_cols'], None,
                         trading_days, skip_dates,
                         meta['ok_threshold'], meta['partial_threshold'])


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
    check_bse_delivery,
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
            row = check_fn(db, trading_days, skip_dates)
            try:
                _enrich_row(db, row, from_date, to_date)
            except Exception as enrich_err:
                print(f'  [health] enrich failed for {row.get("id")}: {enrich_err}')
            results.append(row)
        except Exception as e:
            results.append({
                'id': check_fn.__name__.replace('check_', ''),
                'layer': 'unknown', 'label': check_fn.__name__,
                'latest_date': None, 'days': [], 'error': str(e),
            })
    return results
