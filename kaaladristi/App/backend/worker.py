"""
Kāla-Drishti Job Worker
========================
Standalone process that polls km_jobs table and executes queued jobs.
Run separately from the API — killing the API doesn't affect the worker.

Usage:
  python worker.py              # run once, process all queued jobs, exit
  python worker.py --watch      # poll continuously every 5 seconds
  python worker.py --watch 10   # poll every 10 seconds

The API just inserts rows into km_jobs. This worker picks them up.
"""

import os
import sys
import time
import json
import logging
from datetime import date, datetime, timedelta

# Add backend dir to path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from lib.db_client import get_db
from lib.config import DATABASE_URL

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [worker] %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('worker')


def _now_iso() -> str:
    """Current time as ISO string (DB handles timezone via TIMESTAMPTZ)."""
    return datetime.utcnow().isoformat() + 'Z'


# ── Cutoff logic ─────────────────────────────────────────────────────────────

def _get_cutoff_date() -> date:
    """Don't process today if before 6 PM IST."""
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    if now_ist.hour < 18:
        d = date.today() - timedelta(days=1)
        while d.weekday() >= 5:
            d -= timedelta(days=1)
        return d
    return date.today()


def _get_holidays(db, from_dt, to_dt):
    """Get holiday/no_data dates as a set."""
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT trade_date FROM km_trading_calendar "
                "WHERE (is_holiday = TRUE OR status IN ('holiday','no_data','weekend')) "
                "AND trade_date BETWEEN %s AND %s",
                [str(from_dt), str(to_dt)])
            return {str(r['trade_date']) for r in cur.fetchall()}
    finally:
        db._put(conn)


def _dates_with_data(db, table, exchange, from_dt, to_dt):
    """Check which dates have EOD data."""
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if exchange:
                cur.execute(
                    f"SELECT DISTINCT e.trade_date FROM {table} e "
                    f"JOIN km_equity_symbols s ON s.id = e.equity_id "
                    "WHERE s.exchange = %s AND e.trade_date BETWEEN %s AND %s",
                    [exchange, str(from_dt), str(to_dt)])
            else:
                cur.execute(
                    f"SELECT DISTINCT trade_date FROM {table} "
                    "WHERE trade_date BETWEEN %s AND %s",
                    [str(from_dt), str(to_dt)])
            return {str(r['trade_date']) for r in cur.fetchall()}
    finally:
        db._put(conn)


def _pending_symbols(db, table, id_col, column, from_dt, to_dt, exchange: str | None = None):
    """Find symbols with NULL column in date range.

    When `exchange` is provided AND the table is `km_equity_eod`, the result
    is restricted to symbols on that exchange (joined via km_equity_symbols).
    Ignored for km_index_eod — index rows have no exchange column.
    """
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if table == 'km_equity_eod' and exchange:
                cur.execute(f"""
                    SELECT DISTINCT e.{id_col} AS sid FROM km_equity_eod e
                    JOIN km_equity_symbols s ON s.id = e.{id_col}
                    WHERE s.exchange = %s
                      AND e.{column} IS NULL
                      AND e.trade_date BETWEEN %s AND %s
                """, [exchange, str(from_dt), str(to_dt)])
            else:
                cur.execute(f"""
                    SELECT DISTINCT {id_col} AS sid FROM {table}
                    WHERE {column} IS NULL AND trade_date BETWEEN %s AND %s
                """, [str(from_dt), str(to_dt)])
            return [r['sid'] for r in cur.fetchall()]
    finally:
        db._put(conn)


def _update_job(db, job_id, **kwargs):
    """Update job status in km_jobs."""
    data = {}
    for k, v in kwargs.items():
        if k == 'result' and isinstance(v, dict):
            data[k] = json.dumps(v)
        else:
            data[k] = v
    db.patch('km_jobs', {'id': job_id}, data)


def _is_cancelled(db, job_id):
    """Check if job was cancelled."""
    rows = db.select('km_jobs', 'status', filters={'id': job_id}, limit=1)
    return rows and rows[0].get('status') == 'cancelled'


# ── Threshold: above this, use bulk RPC instead of per-symbol loop ───────────
BULK_RPC_THRESHOLD = 100


# ── Job-window + force-recompute helpers ─────────────────────────────────────
#
# Every handle_fix_* handler now supports two modes:
#
#   a) Single-date mode — `trade_date` is set in params. Compute is scoped to
#      that specific date. This is what the day-level wrench uses.
#   b) Legacy sweep mode — no trade_date. Compute sweeps the last days*1.5
#      window, matching the old "fix last N days" behaviour of the row-level
#      wrench.
#
# `force=true` is only valid when `trade_date` is provided. It NULLs (or
# DELETEs) the dimension's output columns for the target date before calling
# the compute RPC, so rows stamped as done but empty get recomputed.

def _parse_job_window(params: dict):
    """Return (trade_date_or_none, from_dt, to_dt, force, exchange).

    trade_date is a datetime.date or None.
    from_dt / to_dt always have values — when trade_date is set they're both
    equal to trade_date; otherwise they cover the legacy sweep window.
    Raises ValueError if force=true is requested without a trade_date.
    """
    td_raw = params.get('trade_date')
    force = bool(params.get('force', False))
    exchange = params.get('exchange')

    trade_date = None
    if td_raw:
        try:
            trade_date = date.fromisoformat(str(td_raw))
        except ValueError:
            raise ValueError(f'Invalid trade_date: {td_raw!r}')

    if force and trade_date is None:
        raise ValueError(
            'force=true requires a trade_date — refusing to erase computation '
            'for a full 90-day window. Set trade_date in params to proceed.'
        )

    if trade_date is not None:
        return trade_date, trade_date, trade_date, force, exchange

    days = int(params.get('days', 60))
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))
    return None, from_dt, cutoff, force, exchange


# Column groups that `force=true` clears per dimension. All lists are
# deliberate — adding a new indicator column means adding it here too.
_FORCE_NULL_COLUMNS = {
    'indicators':         ['indicators_computed_at'],
    'magic_rs':           ['magic_rs', 'magic_rs_sma144', 'magic_ma', 'magic_rs_zone'],
    'flow_intelligence':  ['flow_type', 'vacuum_flag', 'accum_distrib', 'volume_divergence_flag'],
}


def _force_null(db, dim: str, table: str, trade_date, exchange: str | None = None) -> int:
    """UPDATE the dimension's output columns to NULL for rows on trade_date.

    For km_equity_eod with exchange set, restricts to that exchange via a
    subselect on km_equity_symbols. Returns number of rows affected.
    """
    cols = _FORCE_NULL_COLUMNS.get(dim)
    if not cols:
        raise ValueError(f'Unknown dimension for force NULL: {dim}')

    set_clause = ', '.join(f'{c} = NULL' for c in cols)
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            if table == 'km_equity_eod' and exchange:
                cur.execute(
                    f"UPDATE km_equity_eod SET {set_clause} "
                    "WHERE trade_date = %s AND equity_id IN "
                    "(SELECT id FROM km_equity_symbols WHERE exchange = %s)",
                    [str(trade_date), exchange],
                )
            else:
                cur.execute(
                    f"UPDATE {table} SET {set_clause} WHERE trade_date = %s",
                    [str(trade_date)],
                )
            affected = cur.rowcount
        conn.commit()
        log.info(f'[force] {dim} {table} {trade_date} {exchange or ""}: NULLed {affected} rows')
        return affected
    finally:
        db._put(conn)


def _force_delete(db, table: str, trade_date) -> int:
    """DELETE rows for the target date. Used for industry_composites /
    market_breadth / breadth_roc where compute is a full rebuild per date."""
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM {table} WHERE trade_date = %s",
                [str(trade_date)],
            )
            affected = cur.rowcount
        conn.commit()
        log.info(f'[force] {table} {trade_date}: DELETEd {affected} rows')
        return affected
    finally:
        db._put(conn)


# ── Job Handlers ─────────────────────────────────────────────────────────────

def handle_fix_indicators(db, job_id, params):
    """Compute index indicators. Respects params.trade_date and params.force.

    Single-date + force: NULL indicators_computed_at on km_index_eod for the
    target date, then invoke the bulk RPC scoped to that one date. All the
    per-symbol work happens inside one Postgres call — no HTTP round-trip
    per index.

    Single-date without force: per-symbol loop (respects the IS-NULL stamp,
    so already-computed rows aren't reprocessed).

    Legacy sweep: bulk RPC with the 90-day default window, same as before.
    """
    import time as _time
    trade_date, from_dt, to_dt, force, _ = _parse_job_window(params)

    if trade_date is not None and force:
        _update_job(db, job_id, progress=f'{trade_date}: force-resetting stamps...')
        _force_null(db, 'indicators', 'km_index_eod', trade_date)
        _update_job(db, job_id, progress=f'{trade_date}: bulk recompute...')
        t0 = _time.time()
        result = db.rpc('compute_all_pending_indicators', {
            'p_table': 'km_index_eod', 'p_id_col': 'index_id',
            'p_from_date': str(trade_date), 'p_to_date': str(trade_date),
        })
        elapsed = _time.time() - t0
        total = sum(r.get('rows_updated', 0) for r in (result or []))
        log.info(f'[bulk] index indicators {trade_date} force=True: {total} rows in {elapsed:.2f}s')
        return total

    if trade_date is not None:
        # Respect existing stamps — only compute missing rows for the date.
        pending = _pending_symbols(db, 'km_index_eod', 'index_id',
                                   'indicators_computed_at', from_dt, to_dt)
        log.info(f'Index indicators {trade_date}: {len(pending)} indices to compute')
        _update_job(db, job_id, progress=f'{trade_date}: {len(pending)} indices to compute')

        t0 = _time.time()
        total = 0
        for i, sid in enumerate(pending):
            if _is_cancelled(db, job_id):
                return total
            if i % 20 == 0:
                _update_job(db, job_id,
                            progress=f'Index indicators: {i+1}/{len(pending)}',
                            progress_pct=int((i / max(len(pending), 1)) * 100))
            try:
                result = db.rpc('compute_indicators_batch', {
                    'p_table': 'km_index_eod', 'p_id_col': 'index_id',
                    'p_symbol_id': sid, 'p_from_date': str(trade_date),
                })
                count = result[0].get('compute_indicators_batch', 0) if result else 0
                total += count
            except Exception as e:
                log.error(f'Index indicators sid={sid} {trade_date}: {e}')
        log.info(f'Index indicators {trade_date}: {total} rows in {_time.time()-t0:.2f}s')
        return total

    _update_job(db, job_id, progress='Computing index indicators (sweep)...')
    t0 = _time.time()
    result = db.rpc('compute_all_pending_indicators', {
        'p_table': 'km_index_eod', 'p_id_col': 'index_id',
    })
    total = sum(r.get('rows_updated', 0) for r in (result or []))
    log.info(f'[sweep] index indicators: {total} rows in {_time.time()-t0:.2f}s')
    return total


def _handle_fix_equity_indicators(db, job_id, params, exchange: str):
    """Shared implementation for NSE / BSE equity indicators.

    Single-date + force: NULL stamps for the exchange on target date, then
    one bulk RPC call scoped to that date. Because we only NULLed the
    target-date rows for the target exchange, the RPC's
    `indicators_computed_at IS NULL` filter naturally picks up only those
    rows — no exchange argument on the RPC needed.

    Single-date without force: per-symbol loop. Not used via the bulk path
    because the stamp filter would match nothing (everything is already
    stamped).

    Legacy sweep: bulk RPC when >100 symbols pending, else per-symbol.
    """
    import time as _time
    trade_date, from_dt, to_dt, force, _ = _parse_job_window(params)

    if trade_date is not None and force:
        _update_job(db, job_id, progress=f'{trade_date}: force-resetting {exchange} stamps...')
        _force_null(db, 'indicators', 'km_equity_eod', trade_date, exchange=exchange)
        _update_job(db, job_id, progress=f'{trade_date} {exchange}: bulk recompute...')
        t0 = _time.time()
        result = db.rpc('compute_all_pending_indicators', {
            'p_table': 'km_equity_eod', 'p_id_col': 'equity_id',
            'p_from_date': str(trade_date), 'p_to_date': str(trade_date),
        })
        elapsed = _time.time() - t0
        total = sum(r.get('rows_updated', 0) for r in (result or []))
        log.info(f'[bulk] {exchange} equity indicators {trade_date} force=True: {total} rows in {elapsed:.2f}s')
        return total

    if trade_date is not None:
        pending = _pending_symbols(db, 'km_equity_eod', 'equity_id',
                                   'indicators_computed_at', trade_date, trade_date,
                                   exchange=exchange)
        log.info(f'{exchange} Equity indicators {trade_date}: {len(pending)} symbols to compute')
        _update_job(db, job_id, progress=f'{trade_date}: {len(pending)} symbols to compute')

        t0 = _time.time()
        total = 0
        for i, sid in enumerate(pending):
            if _is_cancelled(db, job_id):
                return total
            if i % 50 == 0:
                _update_job(db, job_id,
                            progress=f'{exchange} indicators {trade_date}: {i+1}/{len(pending)}',
                            progress_pct=int((i / max(len(pending), 1)) * 100))
            try:
                result = db.rpc('compute_indicators_batch', {
                    'p_table': 'km_equity_eod', 'p_id_col': 'equity_id',
                    'p_symbol_id': sid, 'p_from_date': str(trade_date),
                })
                count = result[0].get('compute_indicators_batch', 0) if result else 0
                total += count
            except Exception as e:
                log.error(f'{exchange} Equity indicators sid={sid} {trade_date}: {e}')
        log.info(f'{exchange} Equity indicators {trade_date}: {total} rows in {_time.time()-t0:.2f}s')
        return total

    # Legacy sweep mode
    pending = _pending_symbols(db, 'km_equity_eod', 'equity_id',
                               'indicators_computed_at', from_dt, to_dt,
                               exchange=exchange)
    log.info(f'{exchange} Equity indicators: {len(pending)} symbols with gaps')

    if len(pending) > BULK_RPC_THRESHOLD:
        _update_job(db, job_id, progress=f'{len(pending)} symbols — using bulk RPC')
        result = db.rpc('compute_all_pending_indicators', {
            'p_table': 'km_equity_eod', 'p_id_col': 'equity_id',
        })
        total = sum(r.get('rows_updated', 0) for r in (result or []))
    else:
        _update_job(db, job_id, progress=f'{len(pending)} symbols to compute')
        total = 0
        for i, sid in enumerate(pending):
            if _is_cancelled(db, job_id):
                return total
            _update_job(db, job_id,
                        progress=f'{exchange}: {i+1}/{len(pending)} symbols',
                        progress_pct=int((i / max(len(pending), 1)) * 100))
            try:
                result = db.rpc('compute_indicators_batch', {
                    'p_table': 'km_equity_eod', 'p_id_col': 'equity_id',
                    'p_symbol_id': sid, 'p_from_date': str(from_dt),
                })
                count = result[0].get('compute_indicators_batch', 0) if result else 0
                total += count
            except Exception as e:
                log.error(f'{exchange} Equity indicators sid={sid}: {e}')

    log.info(f'{exchange} Equity indicators: {total} rows updated')
    return total


def handle_fix_nse_equity_indicators(db, job_id, params):
    return _handle_fix_equity_indicators(db, job_id, params, exchange='NSE')


def handle_fix_bse_equity_indicators(db, job_id, params):
    return _handle_fix_equity_indicators(db, job_id, params, exchange='BSE')


def handle_fix_flow(db, job_id, params):
    """Compute flow intelligence.

    Respects params.trade_date, params.force, and params.exchange.
    exchange in ('NSE', 'BSE', None). When set, limits equity processing to
    that exchange; indices are always included unless exchange is set (they
    don't belong to an exchange).
    """
    import time as _time
    trade_date, from_dt, to_dt, force, exchange = _parse_job_window(params)

    # Determine which tables to process. If exchange is set, user is asking
    # for a specific equity subset — don't touch indices.
    if exchange:
        tables = [('km_equity_eod', 'equity_id', f'{exchange} Equity', exchange)]
    else:
        tables = [
            ('km_index_eod', 'index_id', 'Index', None),
            ('km_equity_eod', 'equity_id', 'Equity', None),
        ]

    total = 0
    for table, id_col, label, table_exchange in tables:
        if trade_date is not None and force:
            _update_job(db, job_id,
                        progress=f'{label} {trade_date}: force-resetting flow columns...')
            _force_null(db, 'flow_intelligence', table, trade_date,
                        exchange=table_exchange)
            _update_job(db, job_id, progress=f'{label} {trade_date}: bulk recompute...')
            t0 = _time.time()
            # Migration 039 added p_from_date/p_to_date to this RPC.
            # Scoping to the single target date — per-symbol work stays
            # inside one Postgres call.
            result = db.rpc('compute_all_flow_intelligence', {
                'p_table': table, 'p_id_col': id_col,
                'p_from_date': str(trade_date), 'p_to_date': str(trade_date),
            })
            count = sum(r.get('rows_updated', 0) for r in (result or []))
            elapsed = _time.time() - t0
            log.info(f'[bulk] {label} flow {trade_date} force=True: {count} rows in {elapsed:.2f}s')
            total += count
            continue

        if trade_date is not None:
            pending = _pending_symbols(db, table, id_col, 'flow_type',
                                       trade_date, trade_date,
                                       exchange=table_exchange)
            log.info(f'{label} flow {trade_date}: {len(pending)} symbols to compute')
            _update_job(db, job_id,
                        progress=f'{label} {trade_date}: {len(pending)} symbols')
            t0 = _time.time()
            for i, sid in enumerate(pending):
                if _is_cancelled(db, job_id):
                    return total
                if i % 50 == 0:
                    _update_job(db, job_id,
                                progress=f'{label} flow {trade_date}: {i+1}/{len(pending)}',
                                progress_pct=int((i / max(len(pending), 1)) * 100))
                try:
                    result = db.rpc('compute_flow_intelligence', {
                        'p_table': table, 'p_id_col': id_col,
                        'p_symbol_id': sid, 'p_from_date': str(trade_date),
                    })
                    count = result if isinstance(result, int) else (
                        result[0].get('compute_flow_intelligence', 0) if result else 0
                    )
                    total += count
                except Exception as e:
                    log.error(f'{label} flow sid={sid} {trade_date}: {e}')
            log.info(f'{label} flow {trade_date}: rows in {_time.time()-t0:.2f}s')
            continue

        # Legacy sweep
        pending = _pending_symbols(db, table, id_col, 'flow_type', from_dt, to_dt,
                                   exchange=table_exchange)
        log.info(f'{label} flow: {len(pending)} symbols with gaps')

        if len(pending) > BULK_RPC_THRESHOLD:
            _update_job(db, job_id, progress=f'{label}: {len(pending)} symbols — using bulk RPC')
            result = db.rpc('compute_all_flow_intelligence', {
                'p_table': table, 'p_id_col': id_col,
            })
            count = sum(r.get('rows_updated', 0) for r in (result or []))
            total += count
        else:
            _update_job(db, job_id, progress=f'{label}: {len(pending)} symbols to compute')
            for i, sid in enumerate(pending):
                if _is_cancelled(db, job_id):
                    return total
                if i % 20 == 0:
                    _update_job(db, job_id,
                                progress=f'{label} flow: {i+1}/{len(pending)} symbols',
                                progress_pct=int((i / max(len(pending), 1)) * 100))
                try:
                    result = db.rpc('compute_flow_intelligence', {
                        'p_table': table, 'p_id_col': id_col,
                        'p_symbol_id': sid, 'p_from_date': str(from_dt),
                    })
                    count = result if isinstance(result, int) else (
                        result[0].get('compute_flow_intelligence', 0) if result else 0
                    )
                    total += count
                except Exception as e:
                    log.error(f'{label} flow sid={sid}: {e}')

    log.info(f'Flow intelligence: {total} rows updated')
    return total


def _get_nifty500_id(db) -> int | None:
    """Look up the NIFTY 500 benchmark index id. Returns None if missing."""
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1")
            row = cur.fetchone()
            return row['id'] if row else None
    finally:
        db._put(conn)


def handle_fix_magic_rs(db, job_id, params):
    """Compute MagicRS for indices and/or equities.

    Respects params.trade_date, params.force, and params.exchange.

    Single-date + force: NULL the 4 magic_rs columns for the exchange on
    target date, then call compute_all_magic_rs scoped to that date. Post
    migration 039 the RPC has correct cross-table benchmark routing for
    equities (migration 038 accidentally regressed that).

    Single-date without force: per-symbol loop scoped to the date — respects
    the magic_rs_zone IS NULL filter so already-computed rows are skipped.

    Legacy sweep: per-symbol loop over the 90-day window (same as before).
    """
    import time as _time
    trade_date, from_dt, to_dt, force, exchange = _parse_job_window(params)

    benchmark_id = _get_nifty500_id(db)
    if benchmark_id is None:
        log.error('NIFTY 500 not found in km_index_symbols — aborting MagicRS fix')
        return 0

    if exchange:
        tables = [('km_equity_eod', 'equity_id', f'{exchange} Equity', exchange)]
    else:
        tables = [
            ('km_index_eod', 'index_id', 'Index', None),
            ('km_equity_eod', 'equity_id', 'Equity', None),
        ]

    total = 0
    for table, id_col, label, table_exchange in tables:
        if trade_date is not None and force:
            _update_job(db, job_id,
                        progress=f'{label} {trade_date}: force-resetting magic_rs columns...')
            _force_null(db, 'magic_rs', table, trade_date, exchange=table_exchange)
            _update_job(db, job_id, progress=f'{label} {trade_date}: bulk recompute...')
            t0 = _time.time()
            result = db.rpc('compute_all_magic_rs', {
                'p_table': table, 'p_id_col': id_col,
                'p_benchmark_id': benchmark_id,
                'p_from_date': str(trade_date),
            })
            count = sum(r.get('rows_updated', 0) for r in (result or []))
            elapsed = _time.time() - t0
            log.info(f'[bulk] {label} MagicRS {trade_date} force=True: {count} rows in {elapsed:.2f}s')
            total += count
            continue

        # Non-force paths: per-symbol. Either single-date (trade_date set) or
        # legacy 90-day sweep.
        p_from_date = str(trade_date) if trade_date is not None else str(from_dt)
        if trade_date is not None:
            pending = _pending_symbols(db, table, id_col, 'magic_rs_zone',
                                       trade_date, trade_date,
                                       exchange=table_exchange)
        else:
            pending = _pending_symbols(db, table, id_col, 'magic_rs_zone',
                                       from_dt, to_dt,
                                       exchange=table_exchange)
        log.info(f'{label} MagicRS: {len(pending)} symbols with gaps')
        _update_job(db, job_id, progress=f'{label}: {len(pending)} symbols to compute')

        t0 = _time.time()
        for i, sid in enumerate(pending):
            if _is_cancelled(db, job_id):
                return total
            if i % 50 == 0:
                _update_job(db, job_id,
                            progress=f'{label} MagicRS: {i+1}/{len(pending)} symbols',
                            progress_pct=int((i / max(len(pending), 1)) * 100))
            try:
                rpc_params = {
                    'p_table': table, 'p_id_col': id_col,
                    'p_symbol_id': sid, 'p_from_date': p_from_date,
                    'p_benchmark_id': benchmark_id,
                }
                if table == 'km_equity_eod':
                    rpc_params['p_bench_table'] = 'km_index_eod'
                    rpc_params['p_bench_id_col'] = 'index_id'
                result = db.rpc('compute_magic_rs_batch', rpc_params)
                count = result[0].get('compute_magic_rs_batch', 0) if result else 0
                total += count
            except Exception as e:
                log.error(f'{label} MagicRS sid={sid}: {e}')
        log.info(f'{label} MagicRS: {_time.time()-t0:.2f}s')

    log.info(f'MagicRS: {total} rows updated')
    return total


def _pg_conn_for_breadth():
    """compute_market_breadth.load_closes / upsert expect a real psycopg2
    connection — the PgClient/PostgRESTClient abstractions don't expose a
    .cursor() method. Hand them a direct connection."""
    import psycopg2
    from lib.config import DATABASE_URL
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL not set — cannot run breadth compute')
    return psycopg2.connect(DATABASE_URL)


def _breadth_tracker(db, trade_date_obj):
    """StepTracker for breadth/breadth_roc steps triggered via the fix queue."""
    from pipeline.utils.step_tracker import StepTracker
    return StepTracker(db, trade_date_obj, exchange='NSE', triggered_by='manual_step')


def handle_fix_breadth(db, job_id, params):
    """Recompute market breadth.

    Force + trade_date: DELETE the row for that date, then upsert just that
    date's computed row. Non-force: upsert all dates that are missing from
    km_market_breadth (same behaviour as pipeline_api._refresh_market_breadth).
    Per-date events land in km_pipeline_runs(step='market_breadth', NSE) so the
    health grid can surface errors on the breadth row.
    """
    trade_date, _from, _to, force, _ex = _parse_job_window(params)
    _update_job(db, job_id, progress='Computing market breadth...')

    from compute_market_breadth import load_closes, compute_breadth, upsert
    conn = _pg_conn_for_breadth()
    try:
        closes = load_closes(conn)
        if closes.empty:
            return 0
        df = compute_breadth(closes)

        if trade_date is not None:
            if force:
                _force_delete(db, 'km_market_breadth', trade_date)
            df = df[df.index == trade_date]
            if df.empty:
                log.info(f'breadth {trade_date}: no computed row (likely outside EMA warmup)')
                return 0
        else:
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_market_breadth')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]
            if df.empty:
                log.info('breadth: no new dates to compute')
                return 0

        total = 0
        for d in df.index:
            tracker = _breadth_tracker(db, d)
            tracker.start('market_breadth')
            try:
                n = upsert(conn, df.loc[[d]], dry_run=False)
                tracker.complete('market_breadth', rows=int(n))
                total += int(n)
            except Exception as e:
                tracker.fail('market_breadth', str(e))
        log.info(f'breadth: {total} rows upserted')
        return total
    finally:
        conn.close()


def handle_fix_breadth_roc(db, job_id, params):
    """Recompute breadth ROC. Same single-date / sweep split as breadth."""
    trade_date, _from, _to, force, _ex = _parse_job_window(params)
    _update_job(db, job_id, progress='Computing breadth ROC...')

    from compute_breadth_roc import load_closes, compute_roc, upsert
    conn = _pg_conn_for_breadth()
    try:
        closes = load_closes(conn)
        if closes.empty:
            return 0
        df = compute_roc(closes)

        if trade_date is not None:
            if force:
                _force_delete(db, 'km_breadth_roc', trade_date)
            df = df[df.index == trade_date]
            if df.empty:
                log.info(f'breadth_roc {trade_date}: no computed row (warmup)')
                return 0
        else:
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_breadth_roc')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]
            if df.empty:
                log.info('breadth_roc: no new dates to compute')
                return 0

        total = 0
        for d in df.index:
            tracker = _breadth_tracker(db, d)
            tracker.start('breadth_roc')
            try:
                n = upsert(conn, df.loc[[d]], dry_run=False)
                tracker.complete('breadth_roc', rows=int(n))
                total += int(n)
            except Exception as e:
                tracker.fail('breadth_roc', str(e))
        log.info(f'breadth_roc: {total} rows upserted')
        return total
    finally:
        conn.close()


def handle_fix_industry_composites(db, job_id, params):
    """Recompute industry composites.

    Single-date mode: always processes the given date (ignores "already has
    rows" check). With force=true, DELETEs the day's rows first; the RPC
    itself does DELETE+INSERT internally so both paths are equivalent, but
    the explicit DELETE makes the force semantics observable.

    Legacy sweep: dates in the window that have equity EOD but no composites.
    """
    trade_date, from_dt, to_dt, force, _ = _parse_job_window(params)

    if trade_date is not None:
        if force:
            _update_job(db, job_id,
                        progress=f'{trade_date}: force-deleting existing composites...')
            _force_delete(db, 'km_industry_eod', trade_date)

        _update_job(db, job_id, progress=f'{trade_date}: computing composites...')
        try:
            result = db.rpc('compute_all_industry_composites', {
                'p_trade_date': str(trade_date),
            })
            count = result[0].get('compute_all_industry_composites', 0) if result else 0
            log.info(f'Industry composites {trade_date}: {count} industries')
            return count
        except Exception as e:
            log.error(f'Industry composites {trade_date}: {e}')
            raise

    # Legacy sweep: find dates with equity EOD but no composites
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT DISTINCT e.trade_date
                FROM km_equity_eod e
                WHERE e.trade_date BETWEEN %s AND %s
                  AND NOT EXISTS (
                    SELECT 1 FROM km_industry_eod i
                    WHERE i.trade_date = e.trade_date
                  )
                ORDER BY e.trade_date
            """, [str(from_dt), str(to_dt)])
            gap_dates = [r['trade_date'] for r in cur.fetchall()]
    finally:
        db._put(conn)

    log.info(f'Industry composites: {len(gap_dates)} dates to compute')
    _update_job(db, job_id, progress=f'{len(gap_dates)} dates to compute')

    total = 0
    for i, d in enumerate(gap_dates):
        if _is_cancelled(db, job_id):
            return total
        _update_job(db, job_id,
                    progress=f'{d} ({i+1}/{len(gap_dates)})',
                    progress_pct=int((i / max(len(gap_dates), 1)) * 100))
        try:
            result = db.rpc('compute_all_industry_composites', {
                'p_trade_date': str(d),
            })
            count = result[0].get('compute_all_industry_composites', 0) if result else 0
            total += count
            log.info(f'Industry composites {d}: {count} industries')
        except Exception as e:
            log.error(f'Industry composites {d}: {e}')

    log.info(f'Industry composites: {total} total rows')
    return total


def handle_fix_fii_dii(db, job_id, params):
    """Download FII/DII data.

    Single-date mode: downloads only that date. With force=true, DELETEs
    existing rows for that date first so the new download lands cleanly.
    Legacy sweep: downloads missing weekday dates in the window.
    """
    trade_date, from_dt, to_dt, force, _ = _parse_job_window(params)

    from pipeline.downloaders.nse_fiidii import download_nse_fiidii, upsert_fii_dii
    from pipeline.utils.nse_session import NseSession

    if trade_date is not None:
        if force:
            _force_delete(db, 'km_fii_dii', trade_date)

        _update_job(db, job_id, progress=f'FII/DII {trade_date}: downloading...')
        nse = NseSession()
        try:
            records = download_nse_fiidii(trade_date, session=nse)
            if records:
                upsert_fii_dii(db, records)
                log.info(f'FII/DII {trade_date}: {len(records)} records upserted')
                return len(records)
            return 0
        except Exception as e:
            log.error(f'FII/DII {trade_date}: {e}')
            raise

    # Legacy sweep
    existing = _dates_with_data(db, 'km_fii_dii', None, from_dt, to_dt)
    holidays = _get_holidays(db, from_dt, to_dt)

    to_process = []
    cursor = from_dt
    while cursor <= to_dt:
        ds = str(cursor)
        if cursor.weekday() < 5 and ds not in holidays and ds not in existing:
            to_process.append(cursor)
        cursor += timedelta(days=1)

    log.info(f'FII/DII: {len(to_process)} dates to download')
    _update_job(db, job_id, progress=f'{len(to_process)} dates to download')

    nse = NseSession()
    total = 0
    for i, d in enumerate(to_process):
        if _is_cancelled(db, job_id):
            return total
        _update_job(db, job_id,
                    progress=f'{d} ({i+1}/{len(to_process)})',
                    progress_pct=int((i / max(len(to_process), 1)) * 100))
        try:
            records = download_nse_fiidii(d, session=nse)
            if records:
                upsert_fii_dii(db, records)
                total += len(records)
        except Exception as e:
            log.error(f'FII/DII {d}: {e}')

    return total


def handle_fix_nse_equities(db, job_id, params):
    """Backfill NSE equities — download only missing dates, with per-date timeout.

    Single-date mode: runs run_nse_pipeline for that date only. Force is
    passed through to run_nse_pipeline (resets the calendar status; does
    NOT NULL computed_at columns — this handler is about downloads, not
    compute-layer force).
    """
    trade_date, from_dt_win, to_dt_win, force, _ = _parse_job_window(params)
    strategy = params.get('strategy', 'smart')

    from daily_pipeline import run_nse_pipeline
    import threading

    if trade_date is not None:
        _update_job(db, job_id, progress=f'{trade_date}: downloading NSE bhav...')
        try:
            ok = run_nse_pipeline(db, trade_date, force=force or (strategy == 'force'))
            return 1 if ok else 0
        except Exception as e:
            log.error(f'NSE {trade_date}: {e}')
            raise

    # Legacy sweep
    from_dt = from_dt_win
    cutoff = to_dt_win
    holidays = _get_holidays(db, from_dt, cutoff)
    existing = _dates_with_data(db, 'km_equity_eod', 'NSE', from_dt, cutoff) if strategy == 'smart' else set()

    to_process = []
    cursor = from_dt
    while cursor <= cutoff:
        ds = str(cursor)
        if cursor.weekday() < 5 and ds not in holidays and ds not in existing:
            to_process.append(cursor)
        cursor += timedelta(days=1)

    log.info(f'NSE Equities: {len(existing)} have data, {len(to_process)} to process')
    _update_job(db, job_id, progress=f'{len(to_process)} dates to process')

    MAX_MINUTES_PER_DATE = 3  # Skip date if takes longer than 3 minutes

    success = 0
    failed_dates = []
    for i, d in enumerate(to_process):
        if _is_cancelled(db, job_id):
            return success
        _update_job(db, job_id,
                    progress=f'{d} ({i+1}/{len(to_process)}) — downloading...',
                    progress_pct=int((i / max(len(to_process), 1)) * 100))

        # Run with timeout using a thread
        result = [None]  # [True/False/None]
        error = [None]

        def _run_date():
            try:
                ok = run_nse_pipeline(db, d, force=(strategy == 'force'))
                result[0] = ok
            except Exception as e:
                error[0] = str(e)
                result[0] = False

        t = threading.Thread(target=_run_date, daemon=True)
        t.start()
        t.join(timeout=MAX_MINUTES_PER_DATE * 60)

        if t.is_alive():
            # Timed out — skip this date
            log.warning(f'NSE {d}: TIMEOUT after {MAX_MINUTES_PER_DATE}m — skipping')
            _update_job(db, job_id,
                        progress=f'{d} ({i+1}/{len(to_process)}) — TIMEOUT, skipping')
            failed_dates.append(str(d))
            # Thread will eventually die when the HTTP request returns
        elif result[0]:
            success += 1
        else:
            log.error(f'NSE {d}: failed — {error[0]}')
            failed_dates.append(str(d))

    if failed_dates:
        _update_job(db, job_id,
                    progress=f'Done: {success} ok, {len(failed_dates)} failed ({", ".join(failed_dates[:5])})')
    return success


def handle_fix_bse_equities(db, job_id, params):
    """Backfill BSE equities — download only missing dates, with per-date timeout."""
    trade_date, from_dt_win, to_dt_win, force, _ = _parse_job_window(params)
    strategy = params.get('strategy', 'smart')

    from daily_pipeline import run_bse_pipeline
    import threading

    if trade_date is not None:
        _update_job(db, job_id, progress=f'{trade_date}: downloading BSE bhav...')
        try:
            ok = run_bse_pipeline(db, trade_date, force=force or (strategy == 'force'))
            return 1 if ok else 0
        except Exception as e:
            log.error(f'BSE {trade_date}: {e}')
            raise

    # Legacy sweep
    from_dt = from_dt_win
    cutoff = to_dt_win
    holidays = _get_holidays(db, from_dt, cutoff)
    existing = _dates_with_data(db, 'km_equity_eod', 'BSE', from_dt, cutoff) if strategy == 'smart' else set()

    to_process = []
    cursor = from_dt
    while cursor <= cutoff:
        ds = str(cursor)
        if cursor.weekday() < 5 and ds not in holidays and ds not in existing:
            to_process.append(cursor)
        cursor += timedelta(days=1)

    log.info(f'BSE Equities: {len(existing)} have data, {len(to_process)} to process')
    _update_job(db, job_id, progress=f'{len(to_process)} dates to process')

    MAX_MINUTES_PER_DATE = 3

    success = 0
    failed_dates = []
    for i, d in enumerate(to_process):
        if _is_cancelled(db, job_id):
            return success
        _update_job(db, job_id,
                    progress=f'{d} ({i+1}/{len(to_process)}) — downloading...',
                    progress_pct=int((i / max(len(to_process), 1)) * 100))

        result = [None]
        error = [None]

        def _run_date():
            try:
                ok = run_bse_pipeline(db, d, force=(strategy == 'force'))
                result[0] = ok
            except Exception as e:
                error[0] = str(e)
                result[0] = False

        t = threading.Thread(target=_run_date, daemon=True)
        t.start()
        t.join(timeout=MAX_MINUTES_PER_DATE * 60)

        if t.is_alive():
            log.warning(f'BSE {d}: TIMEOUT after {MAX_MINUTES_PER_DATE}m — skipping')
            _update_job(db, job_id,
                        progress=f'{d} ({i+1}/{len(to_process)}) — TIMEOUT, skipping')
            failed_dates.append(str(d))
        elif result[0]:
            success += 1
        else:
            log.error(f'BSE {d}: failed — {error[0]}')
            failed_dates.append(str(d))

    if failed_dates:
        _update_job(db, job_id,
                    progress=f'Done: {success} ok, {len(failed_dates)} failed ({", ".join(failed_dates[:5])})')
    return success


# ── Handler Registry ─────────────────────────────────────────────────────────

HANDLERS = {
    'fix:indicators':              handle_fix_indicators,
    'fix:nse_equity_indicators':   handle_fix_nse_equity_indicators,
    'fix:bse_equity_indicators':   handle_fix_bse_equity_indicators,
    'fix:flow_intelligence':       handle_fix_flow,
    'fix:magic_rs':                handle_fix_magic_rs,
    'fix:market_breadth':          handle_fix_breadth,
    'fix:breadth_roc':             handle_fix_breadth_roc,
    'fix:industry_composites':     handle_fix_industry_composites,
    'fix:fii_dii':                 handle_fix_fii_dii,
    'fix:nse_equities':            handle_fix_nse_equities,
    'fix:bse_equities':            handle_fix_bse_equities,
}


# ── Main Loop ────────────────────────────────────────────────────────────────

def process_one(db):
    """Pick up and execute one queued job. Returns True if a job was processed."""
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Atomic pick: grab oldest queued job and mark running
            cur.execute("""
                UPDATE km_jobs SET status = 'running', started_at = NOW()
                WHERE id = (
                    SELECT id FROM km_jobs WHERE status = 'queued'
                    ORDER BY created_at LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING *
            """)
            row = cur.fetchone()
        conn.commit()
    finally:
        db._put(conn)

    if not row:
        return False

    job = dict(row)
    job_id = job['id']
    job_type = job['job_type']
    params = job.get('params') or {}

    handler = HANDLERS.get(job_type)
    if not handler:
        _update_job(db, job_id, status='failed',
                    error_msg=f'Unknown job type: {job_type}',
                    completed_at=datetime.utcnow().isoformat())
        log.error(f'Job #{job_id}: unknown type {job_type}')
        return True

    log.info(f'Job #{job_id}: starting {job_type} (params: {params})')

    try:
        result_count = handler(db, job_id, params)

        # Check if it was cancelled mid-run
        if _is_cancelled(db, job_id):
            _update_job(db, job_id, status='cancelled',
                        completed_at=_now_iso(),
                        result=json.dumps({'rows': result_count}))
            log.info(f'Job #{job_id}: cancelled after {result_count} rows')
        else:
            _update_job(db, job_id, status='completed',
                        completed_at=_now_iso(),
                        progress_pct=100,
                        result=json.dumps({'rows': result_count}))
            log.info(f'Job #{job_id}: completed — {result_count} rows')

    except Exception as e:
        _update_job(db, job_id, status='failed',
                    error_msg=str(e)[:500],
                    completed_at=datetime.utcnow().isoformat())
        log.error(f'Job #{job_id}: FAILED — {e}')

    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Kāla-Drishti Job Worker')
    parser.add_argument('--watch', nargs='?', const=5, type=int,
                        help='Poll continuously (default: every 5 seconds)')
    args = parser.parse_args()

    db = get_db()
    log.info('Worker started' + (' (watch mode)' if args.watch else ' (single run)'))

    if args.watch:
        interval = args.watch
        log.info(f'Polling every {interval}s — Ctrl+C to stop')
        try:
            while True:
                processed = process_one(db)
                if not processed:
                    time.sleep(interval)
        except KeyboardInterrupt:
            log.info('Worker stopped')
    else:
        count = 0
        while process_one(db):
            count += 1
        log.info(f'Processed {count} job(s), exiting')


if __name__ == '__main__':
    main()
