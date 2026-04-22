"""FastAPI surface for pipeline v2.

All routes under /api/pipeline2. Runs on its own uvicorn process so the
legacy pipeline_api.py stays untouched. Nginx should proxy
/api/pipeline2/ to this service (see docker-compose addition).

Run:
    uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101 --workers 1
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Make sibling modules importable whether launched via uvicorn or python.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from lib.config import DATABASE_URL  # noqa: E402
from lib.db_client import get_db as _get_db  # noqa: E402

# Optional AI / assembler modules — gracefully absent if not installed
try:
    from lib.ai_prompts import SKILLS as _AI_SKILLS          # noqa: E402
    from lib.ai_client import complete as _ai_complete, AI_ENABLED as _AI_ENABLED  # noqa: E402
    from lib.data_assemblers import (                         # noqa: E402
        assemble_instrument_context,
        assemble_market_pulse_context,
    )
    _AI_OPTIONAL_OK = True
except ImportError:
    _AI_SKILLS = {}
    _ai_complete = lambda **_: None  # noqa: E731
    _AI_ENABLED = False
    _AI_OPTIONAL_OK = False

from pipeline2 import health as v2_health  # noqa: E402
from pipeline2 import scheduler as v2_scheduler  # noqa: E402
from pipeline2.handlers import KNOWN_DIMENSIONS, FIXABLE_DIMENSIONS  # noqa: E402
from pipeline2.health import label_for as _label_for, DOWNLOAD_DIMENSIONS  # noqa: E402


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [pipeline2-api] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('pipeline2-api')


# ── App-scoped state ──────────────────────────────────────────────────────

_scheduler = None
_worker_process: subprocess.Popen | None = None


def _conn():
    """Return a fresh psycopg2 connection. Callers must close."""
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL not set')
    return psycopg2.connect(DATABASE_URL)


def _reset_stale_jobs():
    """On startup, reset any jobs stuck in 'running' back to 'queued'.
    These are orphaned from a previous worker that was killed mid-job.
    Handlers are designed to be re-entrant (force=False skips done work)."""
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE km_jobs SET status = 'queued', started_at = NULL "
                "WHERE status = 'running'",
            )
            count = cur.rowcount
        conn.commit()
        conn.close()
        if count:
            log.info(f'Reset {count} stale running job(s) to queued on startup')
    except Exception as e:
        log.warning(f'Could not reset stale jobs: {e}')


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler, _worker_process

    log.info('pipeline2 API starting')

    # Reset any jobs orphaned by a previous process kill
    _reset_stale_jobs()

    # Start worker subprocess
    worker_cmd = [sys.executable, '-m', 'pipeline2.worker', '--watch']
    _worker_process = subprocess.Popen(
        worker_cmd, cwd=_SCRIPT_DIR,
    )
    log.info(f'worker subprocess started (PID {_worker_process.pid})')

    # Start scheduler
    if DATABASE_URL:
        _scheduler = v2_scheduler.start_scheduler(DATABASE_URL)
    else:
        log.warning('DATABASE_URL not set — scheduler not started')

    yield

    log.info('pipeline2 API shutting down')
    if _scheduler:
        try:
            _scheduler.shutdown(wait=False)
        except Exception as e:
            log.warning(f'scheduler shutdown error: {e}')
    if _worker_process and _worker_process.poll() is None:
        _worker_process.terminate()
        try:
            _worker_process.wait(timeout=5)
        except Exception:
            _worker_process.kill()
        log.info('worker subprocess stopped')


app = FastAPI(title='Kāla-Drishti Pipeline v2 API', version='2.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ── Pydantic request bodies ───────────────────────────────────────────────

class FixRequest(BaseModel):
    dimension: str
    trade_date: str               # YYYY-MM-DD
    exchange: Optional[str] = None
    force: bool = False


class DailyRunRequest(BaseModel):
    trade_date: Optional[str] = None   # default: today (or last weekday)
    force: bool = False


class CancelRequest(BaseModel):
    """Cancel one job by id OR every queued/running job in a batch.
    Exactly one of job_id / batch_id must be set."""
    job_id: Optional[int] = None
    batch_id: Optional[str] = None


class BackfillRequest(BaseModel):
    dimension: str                # dim key or 'all'
    date_from: str                # YYYY-MM-DD
    date_to: str                  # YYYY-MM-DD
    exchange: Optional[str] = None
    force: bool = False


class CalendarMarkRequest(BaseModel):
    """Manual override for km_trading_calendar. `status='clear'` removes
    any existing holiday/no_data marking; status in {holiday, no_data}
    upserts the row."""
    trade_date: str               # YYYY-MM-DD
    status: str                   # 'holiday' | 'no_data' | 'clear'
    exchange: Optional[str] = None  # None → apply to both NSE and BSE


# Dependency order for the 'all' backfill — downloads first (so EOD data
# exists before any compute), then the compute DAG. 14 jobs total.
BACKFILL_ALL_ORDER = [
    'index_eod_download',
    'nse_eod_download',
    'bse_eod_download',
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


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get('/api/pipeline2/health')
def get_health(days: int = 30):
    """Ground-truth fill-rate grid across all dimensions.

    `days` is clamped to 7..120 to keep payloads predictable. The UI
    toggles between 30/60/90/120; anything wider than 120 typically
    belongs in an export, not the live grid.
    """
    days = min(max(days, 7), 120)
    conn = _conn()
    try:
        return {
            'days': days,
            'dimensions': v2_health.health_grid(conn, days=days),
            'generated_at': datetime.utcnow().isoformat() + 'Z',
        }
    finally:
        conn.close()


@app.get('/api/pipeline2/jobs')
def list_jobs(limit: int = 20, dimension: Optional[str] = None, status: Optional[str] = None):
    """Most recent jobs, optionally filtered by dimension or status."""
    limit = min(max(limit, 1), 200)
    conn = _conn()
    try:
        wheres: list[str] = []
        params: list = []
        if dimension:
            wheres.append('dimension = %s')
            params.append(dimension)
        if status:
            wheres.append('status = %s')
            params.append(status)
        where_sql = ('WHERE ' + ' AND '.join(wheres)) if wheres else ''
        params.append(limit)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"SELECT id, job_type, dimension, trade_date, exchange, force, "
                f"       status, progress_text, progress_pct, rows_affected, "
                f"       fill_rate_before, fill_rate_after, error_msg, "
                f"       created_at, started_at, completed_at, created_by, "
                f"       date_from, date_to, batch_id "
                f"FROM km_jobs {where_sql} "
                f"ORDER BY created_at DESC, id DESC LIMIT %s",
                params,
            )
            rows = cur.fetchall()
        jobs = []
        for r in rows:
            jobs.append({
                'id': r['id'],
                'job_type': r['job_type'],
                'dimension': r['dimension'],
                'trade_date': str(r['trade_date']) if r['trade_date'] else None,
                'date_from': str(r['date_from']) if r['date_from'] else None,
                'date_to': str(r['date_to']) if r['date_to'] else None,
                'batch_id': r['batch_id'],
                'exchange': r['exchange'],
                'force': r['force'],
                'status': r['status'],
                'progress_text': r['progress_text'],
                'progress_pct': r['progress_pct'],
                'rows_affected': r['rows_affected'],
                'fill_rate_before': float(r['fill_rate_before']) if r['fill_rate_before'] is not None else None,
                'fill_rate_after': float(r['fill_rate_after']) if r['fill_rate_after'] is not None else None,
                'error_msg': r['error_msg'],
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'started_at': r['started_at'].isoformat() if r['started_at'] else None,
                'completed_at': r['completed_at'].isoformat() if r['completed_at'] else None,
                'created_by': r['created_by'],
            })
        return {'jobs': jobs, 'count': len(jobs)}
    finally:
        conn.close()


@app.get('/api/pipeline2/jobs/{job_id}')
def get_job(job_id: int):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM km_jobs WHERE id = %s", [job_id])
            row = cur.fetchone()
        if not row:
            raise HTTPException(404, f'Job {job_id} not found')
        j = dict(row)
        for k in ('created_at', 'started_at', 'completed_at'):
            if j.get(k):
                j[k] = j[k].isoformat()
        for k in ('trade_date', 'date_from', 'date_to'):
            if j.get(k):
                j[k] = str(j[k])
        for k in ('fill_rate_before', 'fill_rate_after'):
            if j.get(k) is not None:
                j[k] = float(j[k])
        return j
    finally:
        conn.close()


@app.post('/api/pipeline2/fix')
def enqueue_fix(req: FixRequest):
    """Queue a single-dimension fix for one trade_date."""
    if req.dimension not in KNOWN_DIMENSIONS:
        raise HTTPException(
            400,
            f'Unknown dimension {req.dimension!r}. Available: {", ".join(KNOWN_DIMENSIONS)}',
        )
    if req.dimension not in FIXABLE_DIMENSIONS:
        raise HTTPException(
            400,
            f'Dimension {req.dimension!r} is not fixable via this endpoint.',
        )
    try:
        trade_date = date.fromisoformat(req.trade_date)
    except ValueError:
        raise HTTPException(400, f'Invalid trade_date: {req.trade_date!r}')

    if req.exchange and req.exchange not in ('NSE', 'BSE'):
        raise HTTPException(400, 'exchange must be NSE or BSE or omitted')

    conn = _conn()
    try:
        with conn.cursor() as cur:
            # Reject duplicate queued/running fix for the same (dimension, date).
            cur.execute(
                "SELECT id FROM km_jobs "
                "WHERE job_type = 'fix' AND dimension = %s AND trade_date = %s "
                "  AND status IN ('queued', 'running') LIMIT 1",
                [req.dimension, str(trade_date)],
            )
            dup = cur.fetchone()
            if dup:
                raise HTTPException(
                    409, f'A {req.dimension} job for {trade_date} is already queued/running (#{dup[0]})'
                )
            cur.execute(
                "INSERT INTO km_jobs "
                "  (job_type, dimension, trade_date, exchange, force, created_by) "
                "VALUES ('fix', %s, %s, %s, %s, 'ui') "
                "RETURNING id",
                [req.dimension, str(trade_date), req.exchange, req.force],
            )
            new_id = cur.fetchone()[0]
        conn.commit()
        return {'job_id': new_id, 'status': 'queued'}
    finally:
        conn.close()


@app.post('/api/pipeline2/daily-run')
def enqueue_daily_run(req: DailyRunRequest):
    """Queue a daily_run job manually (same shape as the 18:00 IST scheduler trigger)."""
    if req.trade_date:
        try:
            trade_date = date.fromisoformat(req.trade_date)
        except ValueError:
            raise HTTPException(400, f'Invalid trade_date: {req.trade_date!r}')
    else:
        trade_date = date.today()

    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM km_jobs "
                "WHERE job_type = 'daily_run' AND trade_date = %s "
                "  AND status IN ('queued', 'running') LIMIT 1",
                [str(trade_date)],
            )
            dup = cur.fetchone()
            if dup:
                raise HTTPException(
                    409, f'daily_run for {trade_date} is already queued/running (#{dup[0]})'
                )
            cur.execute(
                "INSERT INTO km_jobs (job_type, trade_date, force, created_by) "
                "VALUES ('daily_run', %s, %s, 'ui') RETURNING id",
                [str(trade_date), req.force],
            )
            new_id = cur.fetchone()[0]
        conn.commit()
        return {'job_id': new_id, 'status': 'queued'}
    finally:
        conn.close()


@app.post('/api/pipeline2/backfill')
def enqueue_backfill(req: BackfillRequest):
    """Queue a multi-date backfill, one job per dimension.

    dimension='all' expands to BACKFILL_ALL_ORDER (11 compute dimensions
    in dependency order). All inserted jobs share a batch_id so the UI
    can render them as a group.
    """
    # ── Validate dates ──────────────────────────────────────────────
    try:
        from_d = date.fromisoformat(req.date_from)
        to_d = date.fromisoformat(req.date_to)
    except ValueError as e:
        raise HTTPException(400, f'Invalid date: {e}')
    today_d = date.today()
    if from_d > to_d:
        raise HTTPException(400, 'date_from must be <= date_to')
    if to_d > today_d:
        raise HTTPException(400, 'date_to cannot be in the future')
    if (today_d - from_d).days > 365:
        raise HTTPException(400, 'date_from cannot be more than 365 days ago')
    if req.exchange and req.exchange not in ('NSE', 'BSE'):
        raise HTTPException(400, 'exchange must be NSE or BSE or omitted')

    # ── Resolve dimension list ──────────────────────────────────────
    if req.dimension == 'all':
        dims_to_run = list(BACKFILL_ALL_ORDER)
    else:
        if req.dimension not in KNOWN_DIMENSIONS:
            raise HTTPException(
                400,
                f'Unknown dimension {req.dimension!r}. Available: all, '
                f'{", ".join(KNOWN_DIMENSIONS)}',
            )
        if req.dimension not in FIXABLE_DIMENSIONS:
            raise HTTPException(
                400,
                f'Dimension {req.dimension!r} is not fixable via this endpoint.',
            )
        dims_to_run = [req.dimension]

    batch_id = f'backfill-{from_d}-{to_d}-{uuid.uuid4().hex[:6]}'

    conn = _conn()
    inserted: list[dict] = []
    try:
        with conn.cursor() as cur:
            # Insert in order. The worker is single-threaded and claims
            # oldest-created first, so insertion order == execution order.
            for dim in dims_to_run:
                cur.execute(
                    "INSERT INTO km_jobs "
                    "  (job_type, dimension, date_from, date_to, "
                    "   exchange, force, batch_id, created_by) "
                    "VALUES ('backfill', %s, %s, %s, %s, %s, %s, 'ui') "
                    "RETURNING id",
                    [dim, str(from_d), str(to_d), req.exchange, req.force, batch_id],
                )
                new_id = cur.fetchone()[0]
                inserted.append({'job_id': new_id, 'dimension': dim})
        conn.commit()
    finally:
        conn.close()

    return {
        'batch_id': batch_id,
        'job_count': len(inserted),
        'jobs': inserted,
        'status': 'queued',
    }


@app.post('/api/pipeline2/calendar/mark')
def mark_calendar(req: CalendarMarkRequest):
    """Mark or unmark a trade_date in km_trading_calendar so the health
    grid stops showing it as rose/missing. Applies to both NSE and BSE
    unless an explicit exchange is provided.

    status:
      'holiday'  → upsert row with is_holiday=true, status='holiday'
      'no_data'  → upsert row with is_holiday=false, status='no_data'
      'clear'    → delete any existing holiday/no_data row(s) for the date
    """
    if req.status not in ('holiday', 'no_data', 'clear'):
        raise HTTPException(400, "status must be holiday | no_data | clear")
    try:
        td = date.fromisoformat(req.trade_date)
    except ValueError:
        raise HTTPException(400, f'Invalid trade_date: {req.trade_date!r}')
    if req.exchange and req.exchange not in ('NSE', 'BSE'):
        raise HTTPException(400, 'exchange must be NSE or BSE or omitted')

    exchanges = [req.exchange] if req.exchange else ['NSE', 'BSE']

    conn = _conn()
    try:
        with conn.cursor() as cur:
            affected = 0
            for ex in exchanges:
                if req.status == 'clear':
                    cur.execute(
                        "DELETE FROM km_trading_calendar "
                        "WHERE trade_date = %s AND exchange = %s "
                        "  AND status IN ('holiday', 'no_data')",
                        [str(td), ex],
                    )
                else:
                    cur.execute(
                        "INSERT INTO km_trading_calendar "
                        "  (trade_date, exchange, status, is_holiday) "
                        "VALUES (%s, %s, %s, %s) "
                        "ON CONFLICT (trade_date, exchange) DO UPDATE "
                        "  SET status = EXCLUDED.status, "
                        "      is_holiday = EXCLUDED.is_holiday",
                        [str(td), ex, req.status, req.status == 'holiday'],
                    )
                affected += cur.rowcount
        conn.commit()
        return {
            'trade_date': str(td),
            'status': req.status,
            'exchanges': exchanges,
            'rows_affected': affected,
        }
    finally:
        conn.close()


@app.post('/api/pipeline2/cancel')
def cancel_job(req: CancelRequest):
    """Mark running/queued jobs cancelled. Worker's per-date check observes
    the flag and stops at the next safe boundary (handler end for single
    jobs, next-date iteration for backfills).

    Accepts either a single job_id or a batch_id (cancels every still-
    active member of that batch). Exactly one must be provided.
    """
    if (req.job_id is None) == (req.batch_id is None):
        raise HTTPException(400, 'Provide exactly one of job_id or batch_id')

    conn = _conn()
    try:
        with conn.cursor() as cur:
            if req.job_id is not None:
                cur.execute(
                    "UPDATE km_jobs SET status = 'cancelled', completed_at = now() "
                    "WHERE id = %s AND status IN ('queued', 'running') RETURNING id",
                    [req.job_id],
                )
            else:
                cur.execute(
                    "UPDATE km_jobs SET status = 'cancelled', completed_at = now() "
                    "WHERE batch_id = %s AND status IN ('queued', 'running') "
                    "RETURNING id",
                    [req.batch_id],
                )
            cancelled_ids = [r[0] for r in cur.fetchall()]
        conn.commit()

        if not cancelled_ids:
            target = f'job {req.job_id}' if req.job_id is not None else f'batch {req.batch_id!r}'
            raise HTTPException(404, f'{target}: nothing to cancel (not queued or running)')

        return {
            'status': 'cancelled',
            'count': len(cancelled_ids),
            'cancelled_job_ids': cancelled_ids,
        }
    finally:
        conn.close()


@app.get('/api/pipeline2/dimensions')
def list_dimensions():
    """List dimensions known to v2 in compute-DAG order."""
    return {
        'dimensions': [
            {
                'key': dim,
                'label': _label_for(dim),
                'group': v2_health.group_for(dim),
                'fixable': dim in FIXABLE_DIMENSIONS,
                'ok_threshold': v2_health.ok_threshold_for(dim),
            }
            for dim in KNOWN_DIMENSIONS
        ],
    }


@app.get('/api/pipeline2/scheduler')
def scheduler_info():
    """Next scheduled runs for both APScheduler jobs."""
    active = _scheduler is not None and _scheduler.running
    return {
        'active': active,
        'daily_run': {
            'next': v2_scheduler.next_run_time(_scheduler, 'pipeline2_daily_run'),
            'trigger': '18:00 IST (Mon-Fri)',
        },
        'gap_sweep': {
            'next': v2_scheduler.next_run_time(_scheduler, 'pipeline2_gap_sweep'),
            'trigger': '19:30 IST (Mon-Fri) — last 3 days',
        },
    }


def _refresh_market_breadth():
    """Recompute EMA market breadth for missing dates."""
    try:
        from compute_market_breadth import load_closes, compute_breadth, upsert
        import psycopg2 as _pg
        if not DATABASE_URL:
            log.warning('breadth refresh skipped — DATABASE_URL not set')
            return
        conn = _pg.connect(DATABASE_URL)
        try:
            closes = load_closes(conn)
            df = compute_breadth(closes)
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_market_breadth')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]
            if df.empty:
                log.info('breadth: no new dates to compute')
                return
            for d in df.index:
                upsert(conn, df.loc[[d]], dry_run=False)
            log.info(f'breadth: {len(df)} dates processed')
        finally:
            conn.close()
    except Exception as e:
        log.warning(f'breadth refresh failed: {e}')


def _refresh_breadth_roc():
    """Recompute ROC breadth oscillator for missing dates."""
    try:
        from compute_breadth_roc import load_closes, compute_roc, upsert
        import psycopg2 as _pg
        if not DATABASE_URL:
            return
        conn = _pg.connect(DATABASE_URL)
        try:
            closes = load_closes(conn)
            df = compute_roc(closes)
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_breadth_roc')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]
            if df.empty:
                log.info('breadth_roc: no new dates to compute')
                return
            for d in df.index:
                upsert(conn, df.loc[[d]], dry_run=False)
            log.info(f'breadth_roc: {len(df)} dates processed')
        finally:
            conn.close()
    except Exception as e:
        log.warning(f'breadth_roc refresh failed: {e}')


@app.post('/api/pipeline/refresh-breadth')
def refresh_breadth(background_tasks: BackgroundTasks):
    """Recompute EMA market breadth scores for missing dates."""
    background_tasks.add_task(_refresh_market_breadth)
    return {'status': 'queued', 'message': 'Breadth recompute queued'}


@app.post('/api/pipeline/refresh-breadth-roc')
def refresh_breadth_roc(background_tasks: BackgroundTasks):
    """Recompute ROC breadth oscillator for missing dates."""
    background_tasks.add_task(_refresh_breadth_roc)
    return {'status': 'queued', 'message': 'Breadth ROC recompute queued'}


@app.get('/api/vani-opportunity/config')
def vani_opportunity_config():
    """Return all active VaNi Opportunity config rows (one per direction)."""
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id,config_name,description,is_active,applies_to_presets,"
                "parameters,created_at,updated_at "
                "FROM kd_vani_opportunity_config WHERE is_active = true ORDER BY id"
            )
            return cur.fetchall() or []
    finally:
        conn.close()


# ── Shared helper ─────────────────────────────────────────────────────────

def _db_query(sql: str, params: tuple = ()) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _stringify_dates(row: dict) -> dict:
    return {k: (v.isoformat() if hasattr(v, 'isoformat') else v) for k, v in row.items()}


# ── Panchangam ────────────────────────────────────────────────────────────

_panchang_cache: dict[str, dict] = {}

_PANCHANG_SQL = """
    SELECT
        today.*,
        tomorrow.tithi_name      AS tithi_next_name,
        tomorrow.nakshatra_name  AS nakshatra_next_name,
        tomorrow.karana_name     AS karana_next_name
    FROM km_daily_panchang today
    LEFT JOIN km_daily_panchang tomorrow
        ON tomorrow.date = today.date + INTERVAL '1 day'
    WHERE today.date = %s
"""


@app.get('/api/panchang/daily')
def panchang_daily(date: str = None):
    if not date:
        date = datetime.now(tz=__import__('zoneinfo').ZoneInfo('Asia/Kolkata')).strftime('%Y-%m-%d')
    if date in _panchang_cache:
        return _panchang_cache[date]
    try:
        rows = _db_query(_PANCHANG_SQL, (date,))
    except Exception as e:
        log.error(f'panchang_daily error for {date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    if not rows:
        raise HTTPException(status_code=404, detail=f'No panchang data for {date}')
    row = _stringify_dates(rows[0])
    _panchang_cache[date] = row
    return row


# ── Astro Market-Book ─────────────────────────────────────────────────────

_astro_cache: dict[str, object] = {}

_ASTRO_SIGNAL_SQL = """
    SELECT
        s.*,
        COALESCE(
            json_agg(
                json_build_object('id', e.id, 'display_name', e.display_name,
                                  'market_impact', e.market_impact,
                                  'start_date', e.start_date, 'end_date', e.end_date)
                ORDER BY e.market_impact
            ) FILTER (WHERE e.id IS NOT NULL),
            '[]'
        ) AS active_events
    FROM km_astro_daily_signal s
    LEFT JOIN km_astro_calendar e ON e.id = ANY(s.active_event_ids)
    WHERE s.trade_date = %s
    GROUP BY s.trade_date
"""

_ASTRO_RANGE_SQL = """
    SELECT
        s.trade_date, s.net_signal, s.net_score,
        s.active_event_count, s.turning_date,
        s.strong_bullish_count, s.bullish_count, s.minor_bullish_count,
        s.neutral_count, s.minor_bearish_count, s.bearish_count, s.strong_bearish_count,
        s.primary_event, s.secondary_event
    FROM km_astro_daily_signal s
    WHERE s.trade_date BETWEEN %s AND %s
    ORDER BY s.trade_date
"""


@app.get('/api/astro/daily-signal')
def astro_daily_signal(date: str = None):
    if not date:
        date = datetime.now(tz=__import__('zoneinfo').ZoneInfo('Asia/Kolkata')).strftime('%Y-%m-%d')
    if date in _astro_cache:
        return _astro_cache[date]
    try:
        rows = _db_query(_ASTRO_SIGNAL_SQL, (date,))
    except Exception as e:
        log.error(f'astro_daily_signal error for {date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    if not rows:
        raise HTTPException(status_code=404, detail=f'No astro signal for {date}')
    row = _stringify_dates(rows[0])
    _astro_cache[date] = row
    return row


@app.get('/api/astro/signals')
def astro_signals(from_date: str = None, to_date: str = None):
    today = datetime.now(tz=__import__('zoneinfo').ZoneInfo('Asia/Kolkata')).date()
    if not from_date:
        from_date = today.strftime('%Y-%m-%d')
    if not to_date:
        to_date = (today + timedelta(days=30)).strftime('%Y-%m-%d')
    try:
        d_from = date.fromisoformat(from_date)
        d_to   = date.fromisoformat(to_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f'Invalid date format: {e}')
    if (d_to - d_from).days > 90:
        raise HTTPException(status_code=400, detail='Range exceeds 90-day maximum')
    try:
        rows = _db_query(_ASTRO_RANGE_SQL, (from_date, to_date))
    except Exception as e:
        log.error(f'astro_signals error {from_date}→{to_date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    return [_stringify_dates(r) for r in rows]


@app.get('/api/astro/transits')
def astro_transits(from_date: str = None, to_date: str = None):
    today = datetime.now(tz=__import__('zoneinfo').ZoneInfo('Asia/Kolkata')).date()
    if not from_date:
        from_date = today.strftime('%Y-%m-%d')
    if not to_date:
        to_date = (today + timedelta(days=6)).strftime('%Y-%m-%d')
    cache_key = f'transits_{from_date}_{to_date}'
    if cache_key in _astro_cache:
        return _astro_cache[cache_key]
    sql = """
        SELECT id, display_name, start_date, end_date, market_impact, inference
        FROM km_astro_calendar
        WHERE is_transit = true
          AND start_date <= %s
          AND (end_date IS NULL OR end_date >= %s)
        ORDER BY start_date
    """
    try:
        rows = _db_query(sql, (to_date, from_date))
    except Exception as e:
        log.error(f'astro_transits error {from_date}→{to_date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    result = [_stringify_dates(r) for r in rows]
    _astro_cache[cache_key] = result
    return result


# ── Astro Calendar CRUD (admin only) ─────────────────────────────────────

class AstroCalendarUpsert(BaseModel):
    display_name: str
    start_date: str
    end_date: Optional[str] = None
    market_impact: str
    is_transit: bool = False
    narrative: Optional[str] = None
    notes: Optional[str] = None
    inference: Optional[str] = None

def _invalidate_astro_cache():
    _astro_cache.clear()

@app.post('/api/astro/calendar')
def astro_calendar_create(req: AstroCalendarUpsert):
    from datetime import date as _date
    sd = req.start_date
    month = int(sd[5:7])
    year  = int(sd[:4])
    sql = """
        INSERT INTO km_astro_calendar
          (display_name, start_date, end_date, market_impact, is_transit,
           narrative, notes, inference, month, year, day_of_week)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                TO_CHAR(%s::date, 'Day'))
        RETURNING id
    """
    try:
        rows = _db_query(sql, (
            req.display_name, req.start_date, req.end_date,
            req.market_impact, req.is_transit,
            req.narrative, req.notes, req.inference,
            month, year, req.start_date,
        ))
        _invalidate_astro_cache()
        return {'id': rows[0]['id']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch('/api/astro/calendar/{event_id}')
def astro_calendar_update(event_id: int, req: AstroCalendarUpsert):
    sd = req.start_date
    month = int(sd[5:7])
    year  = int(sd[:4])
    sql = """
        UPDATE km_astro_calendar SET
          display_name  = %s,
          start_date    = %s,
          end_date      = %s,
          market_impact = %s,
          is_transit    = %s,
          narrative     = %s,
          notes         = %s,
          inference     = %s,
          month         = %s,
          year          = %s,
          day_of_week   = TO_CHAR(%s::date, 'Day')
        WHERE id = %s
    """
    try:
        _db_query(sql, (
            req.display_name, req.start_date, req.end_date,
            req.market_impact, req.is_transit,
            req.narrative, req.notes, req.inference,
            month, year, req.start_date,
            event_id,
        ))
        _invalidate_astro_cache()
        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete('/api/astro/calendar/{event_id}')
def astro_calendar_delete(event_id: int):
    try:
        _db_query('DELETE FROM km_astro_calendar WHERE id = %s', (event_id,))
        _invalidate_astro_cache()
        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── VaNi AI Endpoints ─────────────────────────────────────────────────────

_insight_cache: dict[str, object] = {}
_db_singleton = None


def _db():
    global _db_singleton
    if _db_singleton is None:
        _db_singleton = _get_db()
    return _db_singleton


def _IST():
    import zoneinfo
    return datetime.now(tz=zoneinfo.ZoneInfo('Asia/Kolkata'))


@app.get('/api/ai/panchang-insight')
def panchang_insight(date: str):
    if not _AI_ENABLED:
        return {"date": date, "insight": None, "ai": False}
    if date in _insight_cache:
        return {"date": date, "insight": _insight_cache[date], "ai": True}
    try:
        rows = _db().select('km_daily_panchang', '*', filters={'date': date}, limit=1)
    except Exception as e:
        log.error(f'panchang_insight error for {date}: {e}')
        return {"date": date, "insight": None, "ai": False}
    if not rows:
        return {"date": date, "insight": None, "ai": False}
    p = rows[0]
    special = ", ".join(filter(None, [
        "Purnima"   if p.get("is_purnima")   else "",
        "Amavasya"  if p.get("is_amavasya")  else "",
        "Ekadashi"  if p.get("is_ekadashi")  else "",
        "Sankranti" if p.get("is_sankranti") else "",
    ])) or "None"
    user_msg = (
        f"Panchangam for {date}:\n"
        f"Tithi: {p.get('tithi_num', '')}. {p.get('tithi_name', '')} (Lord: {p.get('tithi_lord', '')})\n"
        f"Nakshatra: {p.get('nakshatra_name', '')} Pada {p.get('nakshatra_pada', '')} (Lord: {p.get('nakshatra_lord', '')})\n"
        f"Yoga: {p.get('yoga_name', '')}\n"
        f"Vara: {p.get('vara', '')} (Lord: {p.get('vara_lord', '')})\n"
        f"Moon Sign: {p.get('moon_sign_name', p.get('moon_sign', ''))}\n"
        f"Special Events: {special}\n"
        f"What is today's market risk context?"
    )
    skill = _AI_SKILLS.get("panchang_insight")
    if not skill:
        return {"date": date, "insight": None, "ai": False}
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[date] = insight
    return {"date": date, "insight": insight, "ai": insight is not None}


@app.get('/api/ai/breadth-insight')
def breadth_insight(date: str = None):
    if not _AI_ENABLED:
        return {"date": date, "insight": None, "ai": False}
    cache_key = f"breadth:{date or 'latest'}"
    if cache_key in _insight_cache:
        return {"date": date, "insight": _insight_cache[cache_key], "ai": True}
    try:
        if date:
            rows = _db().select('km_market_breadth', '*', filters={'trade_date': date}, limit=1)
        else:
            rows = _db().select('km_market_breadth', '*', order='trade_date.desc', limit=2)
    except Exception as e:
        log.error(f'breadth_insight error: {e}')
        return {"date": date, "insight": None, "ai": False}
    if not rows:
        return {"date": date, "insight": None, "ai": False}
    latest = rows[0]
    prev   = rows[1] if len(rows) > 1 else None
    target_date = str(latest.get('trade_date', date or ''))
    score  = float(latest.get('breadth_score') or 0)
    regime = 'Greed' if score > 55 else ('Fear' if score < 35 else 'Neutral')
    trend  = 'stable'
    if prev and prev.get('breadth_score') is not None:
        delta = score - float(prev['breadth_score'])
        trend = 'improving' if delta > 1.5 else ('deteriorating' if delta < -1.5 else 'stable')
    user_msg = (
        f"Market Breadth snapshot as of {target_date}:\n"
        f"Regime: {regime} (Breadth Score: {score:.1f})\n"
        f"% Stocks above 20-day EMA : {latest.get('pct_above_20', 'N/A')}%\n"
        f"% Stocks above 50-day EMA : {latest.get('pct_above_50', 'N/A')}%\n"
        f"% Stocks above 150-day EMA: {latest.get('pct_above_150', 'N/A')}%\n"
        f"Stock universe size: {latest.get('stock_count', 'N/A')} NSE equities\n"
        f"Breadth trend (vs previous session): {trend}\n"
        f"\nProvide your structural market breadth insight."
    )
    skill = _AI_SKILLS.get("breadth_insight")
    if not skill:
        return {"date": target_date, "insight": None, "ai": False}
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {"date": target_date, "insight": insight, "ai": insight is not None}


@app.get('/api/ai/breadth-roc-insight')
def breadth_roc_insight():
    if not _AI_ENABLED:
        return {"date": None, "insight": None, "ai": False}
    cache_key = "breadth_roc:latest"
    if cache_key in _insight_cache:
        return {"date": None, "insight": _insight_cache[cache_key], "ai": True}
    try:
        rows = _db().select('km_breadth_roc', '*', order='trade_date.desc', limit=2)
    except Exception as e:
        log.error(f'breadth_roc_insight error: {e}')
        return {"date": None, "insight": None, "ai": False}
    if not rows:
        return {"date": None, "insight": None, "ai": False}
    latest     = rows[0]
    prev       = rows[1] if len(rows) > 1 else None
    target_date = str(latest.get('trade_date', ''))
    roc13 = float(latest.get('roc_13') or 0)
    roc55 = float(latest.get('roc_55') or 0)
    sma   = float(latest.get('sma_breadth') or 0)
    trend = 'stable'
    if prev and prev.get('roc_13') is not None:
        delta = roc13 - float(prev['roc_13'])
        trend = 'strengthening' if delta > 0.0002 else ('weakening' if delta < -0.0002 else 'stable')
    user_msg = (
        f"ROC Breadth Oscillator snapshot as of {target_date}:\n"
        f"ROC_13: {roc13:+.4f} ({'positive (bullish)' if roc13 > 0 else 'negative (bearish)'})\n"
        f"ROC_55: {roc55:+.4f} ({'positive' if roc55 > 0 else 'negative'})\n"
        f"SMA_BREADTH: {sma:+.4f} ({'above zero (confirming)' if sma > 0 else 'below zero (diverging)'})\n"
        f"Fast vs slow spread: {'expanding' if roc13 > roc55 else 'narrowing'}\n"
        f"Momentum trend vs prior session: {trend}\n"
        f"Stock universe: {latest.get('stock_count', 'N/A')} NSE equities\n"
        f"\nProvide your ROC breadth oscillator insight."
    )
    skill = _AI_SKILLS.get("breadth_roc_insight")
    if not skill:
        return {"date": target_date, "insight": None, "ai": False}
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {"date": target_date, "insight": insight, "ai": insight is not None}


@app.get('/api/ai/instrument-insight')
def instrument_insight(id: int, type: str = 'index', date: str = None):
    if not _AI_ENABLED or not _AI_OPTIONAL_OK:
        return {"id": id, "type": type, "date": date, "insight": None, "ai": False, "alignment": ""}
    cache_key = f"instrument:{type}:{id}:{date or 'latest'}"
    if cache_key in _insight_cache:
        return {"id": id, "type": type, "date": date,
                "insight": _insight_cache[cache_key], "ai": True, "alignment": ""}
    ctx = assemble_instrument_context(_db(), id, type, date)
    if not ctx:
        return {"id": id, "type": type, "date": date, "insight": None, "ai": False, "alignment": ""}
    skill = _AI_SKILLS.get("instrument_insight")
    if not skill:
        return {"id": id, "type": type, "date": date, "insight": None, "ai": False, "alignment": ""}
    from pipeline_api import _fmt_instrument_msg  # reuse formatting helper
    user_msg = _fmt_instrument_msg(ctx)
    insight  = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    alignment = ctx.get('alignment', {}).get('status', '')
    return {"id": id, "type": type, "date": ctx.get('date', date),
            "insight": insight, "ai": insight is not None, "alignment": alignment}


@app.get('/api/ai/market-pulse-insight')
def market_pulse_insight(date: str = None):
    if not _AI_ENABLED or not _AI_OPTIONAL_OK:
        return {"date": date, "insight": None, "ai": False, "astro_direction": ""}
    cache_key = f"market_pulse:{date or 'latest'}"
    if cache_key in _insight_cache:
        return {"date": date, "insight": _insight_cache[cache_key], "ai": True, "astro_direction": ""}
    ctx = assemble_market_pulse_context(_db(), date)
    if not ctx:
        return {"date": date, "insight": None, "ai": False, "astro_direction": ""}
    skill = _AI_SKILLS.get("market_pulse_insight")
    if not skill:
        return {"date": date, "insight": None, "ai": False, "astro_direction": ""}
    from pipeline_api import _fmt_market_pulse_msg  # reuse formatting helper
    user_msg      = _fmt_market_pulse_msg(ctx)
    insight       = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    astro_dir = ctx.get('astro', {}).get('direction', '')
    return {"date": ctx.get('date', date), "insight": insight,
            "ai": insight is not None, "astro_direction": astro_dir}


@app.get('/api/pipeline2/ping')
def ping():
    """Minimal liveness check for nginx / docker healthcheck."""
    db_ok = False
    try:
        c = _conn()
        try:
            with c.cursor() as cur:
                cur.execute('SELECT 1')
                cur.fetchone()
            db_ok = True
        finally:
            c.close()
    except Exception:
        pass
    return {
        'ok': True,
        'db': 'ok' if db_ok else 'error',
        'worker_running': bool(_worker_process and _worker_process.poll() is None),
    }
