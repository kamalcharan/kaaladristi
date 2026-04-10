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


def _now_ist() -> str:
    """Current time in IST as ISO string."""
    import pytz
    return datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()


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


def _pending_symbols(db, table, id_col, column, from_dt, to_dt):
    """Find symbols with NULL column in date range."""
    import psycopg2.extras
    conn = db._conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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


# ── Job Handlers ─────────────────────────────────────────────────────────────

def handle_fix_indicators(db, job_id, params):
    """Compute indicators only for missing rows in date range — INDEX only."""
    days = params.get('days', 60)
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    total = 0
    # Only process indexes — equity indicators are a separate, heavier job
    table, id_col = 'km_index_eod', 'index_id'
    pending = _pending_symbols(db, table, id_col, 'indicators_computed_at', from_dt, cutoff)
    _update_job(db, job_id, progress=f'{len(pending)} index symbols to compute')
    log.info(f'{table}: {len(pending)} symbols with indicator gaps')

    for i, sid in enumerate(pending):
        if _is_cancelled(db, job_id):
            return total
        _update_job(db, job_id,
                    progress=f'Index {i+1}/{len(pending)}',
                    progress_pct=int((i / max(len(pending), 1)) * 100))
        try:
            result = db.rpc('compute_indicators_batch', {
                'p_table': table, 'p_id_col': id_col,
                'p_symbol_id': sid, 'p_from_date': str(from_dt),
            })
            count = result[0].get('compute_indicators_batch', 0) if result else 0
            total += count
        except Exception as e:
            log.error(f'{table} sid={sid}: {e}')

    return total


def handle_fix_equity_indicators(db, job_id, params):
    """Compute indicators for EQUITY — separate heavy job."""
    days = params.get('days', 60)
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    total = 0
    table, id_col = 'km_equity_eod', 'equity_id'
    pending = _pending_symbols(db, table, id_col, 'indicators_computed_at', from_dt, cutoff)
    _update_job(db, job_id, progress=f'{len(pending)} equity symbols to compute')
    log.info(f'{table}: {len(pending)} symbols with indicator gaps')

    for i, sid in enumerate(pending):
        if _is_cancelled(db, job_id):
            return total
        _update_job(db, job_id,
                    progress=f'Equity {i+1}/{len(pending)}',
                    progress_pct=int((i / max(len(pending), 1)) * 100))
        try:
            result = db.rpc('compute_indicators_batch', {
                'p_table': table, 'p_id_col': id_col,
                'p_symbol_id': sid, 'p_from_date': str(from_dt),
            })
            count = result[0].get('compute_indicators_batch', 0) if result else 0
            total += count
        except Exception as e:
            log.error(f'{table} sid={sid}: {e}')

    return total


def handle_fix_flow(db, job_id, params):
    """Compute flow intelligence only for missing rows — INDEX only."""
    days = params.get('days', 60)
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    total = 0
    table, id_col = 'km_index_eod', 'index_id'
    pending = _pending_symbols(db, table, id_col, 'flow_type', from_dt, cutoff)
    _update_job(db, job_id, progress=f'{len(pending)} index symbols')
    log.info(f'{table}: {len(pending)} symbols with flow gaps')

    for i, sid in enumerate(pending):
        if _is_cancelled(db, job_id):
            return total
        _update_job(db, job_id,
                    progress=f'Index {i+1}/{len(pending)}',
                    progress_pct=int((i / max(len(pending), 1)) * 100))
        try:
            result = db.rpc('compute_flow_intelligence', {
                'p_table': table, 'p_id_col': id_col,
                'p_symbol_id': sid, 'p_from_date': str(from_dt),
            })
            count = result[0].get('compute_flow_intelligence', 0) if result else 0
            total += count
        except Exception as e:
            log.error(f'{table} sid={sid}: {e}')

    return total


def handle_fix_breadth(db, job_id, params):
    """Recompute market breadth."""
    _update_job(db, job_id, progress='Computing market breadth...')
    from compute_market_breadth import load_closes, compute_breadth, upsert
    closes = load_closes(db)
    if closes.empty:
        return 0
    df = compute_breadth(closes)
    count = upsert(db, df)
    return count


def handle_fix_breadth_roc(db, job_id, params):
    """Recompute breadth ROC."""
    _update_job(db, job_id, progress='Computing breadth ROC...')
    from compute_breadth_roc import load_closes, compute_roc, upsert
    closes = load_closes(db)
    if closes.empty:
        return 0
    df = compute_roc(closes)
    count = upsert(db, df)
    return count


def handle_fix_fii_dii(db, job_id, params):
    """Download FII/DII data only."""
    days = params.get('days', 60)
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    from pipeline.downloaders.nse_fiidii import download_nse_fiidii, upsert_fii_dii
    from pipeline.utils.nse_session import NseSession

    existing = _dates_with_data(db, 'km_fii_dii', None, from_dt, cutoff)
    holidays = _get_holidays(db, from_dt, cutoff)

    to_process = []
    cursor = from_dt
    while cursor <= cutoff:
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
    """Backfill NSE equities — download only missing dates."""
    days = params.get('days', 60)
    strategy = params.get('strategy', 'smart')
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    from daily_pipeline import run_nse_pipeline

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

    success = 0
    for i, d in enumerate(to_process):
        if _is_cancelled(db, job_id):
            return success
        _update_job(db, job_id,
                    progress=f'{d} ({i+1}/{len(to_process)})',
                    progress_pct=int((i / max(len(to_process), 1)) * 100))
        try:
            ok = run_nse_pipeline(db, d, force=(strategy == 'force'))
            if ok:
                success += 1
        except Exception as e:
            log.error(f'NSE {d}: {e}')

    return success


def handle_fix_bse_equities(db, job_id, params):
    """Backfill BSE equities — download only missing dates."""
    days = params.get('days', 60)
    strategy = params.get('strategy', 'smart')
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    from daily_pipeline import run_bse_pipeline

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

    success = 0
    for i, d in enumerate(to_process):
        if _is_cancelled(db, job_id):
            return success
        _update_job(db, job_id,
                    progress=f'{d} ({i+1}/{len(to_process)})',
                    progress_pct=int((i / max(len(to_process), 1)) * 100))
        try:
            ok = run_bse_pipeline(db, d, force=(strategy == 'force'))
            if ok:
                success += 1
        except Exception as e:
            log.error(f'BSE {d}: {e}')

    return success


# ── Handler Registry ─────────────────────────────────────────────────────────

HANDLERS = {
    'fix:indicators':            handle_fix_indicators,
    'fix:equity_indicators':     handle_fix_equity_indicators,
    'fix:flow_intelligence':     handle_fix_flow,
    'fix:market_breadth':    handle_fix_breadth,
    'fix:breadth_roc':       handle_fix_breadth_roc,
    'fix:fii_dii':           handle_fix_fii_dii,
    'fix:nse_equities':      handle_fix_nse_equities,
    'fix:bse_equities':      handle_fix_bse_equities,
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
                UPDATE km_jobs SET status = 'running', started_at = NOW() AT TIME ZONE 'Asia/Kolkata'
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
                        completed_at=_now_ist(),
                        result=json.dumps({'rows': result_count}))
            log.info(f'Job #{job_id}: cancelled after {result_count} rows')
        else:
            _update_job(db, job_id, status='completed',
                        completed_at=_now_ist(),
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
