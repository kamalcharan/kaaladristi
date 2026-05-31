"""FastAPI surface for pipeline v2.

All routes under /api/pipeline2. Runs on its own uvicorn process so the
legacy pipeline_api.py stays untouched. Nginx should proxy
/api/pipeline2/ to this service (see docker-compose addition).

Run:
    uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101 --workers 1
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Make sibling modules importable whether launched via uvicorn or python.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from lib.auth import get_current_user_id as _get_current_user_id  # noqa: E402
from lib.config import DATABASE_URL  # noqa: E402
from lib.db_client import get_db as _get_db  # noqa: E402

# Optional AI / assembler modules — gracefully absent if not installed
try:
    from lib.ai_prompts import SKILLS as _AI_SKILLS          # noqa: E402
    from lib.ai_client import complete as _ai_complete, AI_ENABLED as _AI_ENABLED, AI_MODEL as _AI_MODEL  # noqa: E402
    from lib.data_assemblers import (                         # noqa: E402
        assemble_instrument_context,
        assemble_market_pulse_context,
    )
    from lib.vani_intents import INTENTS as _VANI_INTENTS, get_intents_for_page as _get_intents_for_page  # noqa: E402
    from lib.vani_assemblers import (                         # noqa: E402
        assemble_dashboard_context,
        format_user_message,
        assemble_astro_calendar_context,
        format_astro_user_message,
        assemble_industry_transition_context,
        format_industry_user_message,
        assemble_equity_context,
        format_equity_user_message,
    )
    _AI_OPTIONAL_OK = True
except ImportError:
    _AI_SKILLS = {}
    _VANI_INTENTS = {}
    _get_intents_for_page = lambda page: {}  # noqa: E731
    _ai_complete = lambda **_: None  # noqa: E731
    _AI_ENABLED = False
    _AI_MODEL = ""
    _AI_OPTIONAL_OK = False

try:
    from app.middleware.interaction_logger import log_llm_interaction as _log_interaction  # noqa: E402
except ImportError:
    _log_interaction = lambda **_: None  # noqa: E731

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


def _conn(statement_timeout_ms: int = 0):
    """Return a fresh psycopg2 connection. Callers must close."""
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL not set')
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
    if statement_timeout_ms:
        with conn.cursor() as cur:
            cur.execute(f'SET statement_timeout = {statement_timeout_ms}')
        conn.commit()
    return conn


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


class VaNiDailyRequest(BaseModel):
    date: Optional[str] = None    # YYYY-MM-DD; defaults to today (IST)


class VaNiFeedbackRequest(BaseModel):
    log_id: str
    rating: int   # 1 | -1


class VaNiAskRequest(BaseModel):
    intent_id: str
    date: Optional[str] = None          # YYYY-MM-DD; defaults to today (IST)
    entity_type: Optional[str] = None   # 'equity' | 'index'
    entity_id: Optional[int] = None
    page_context: Optional[str] = None


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


@app.get('/api/scan/presets')
def scan_presets():
    """Return all active scan preset definitions ordered by sort_order."""
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id,name,description,tooltip,sort_order,result_limit,is_active "
                "FROM kd_scan_presets WHERE is_active = true ORDER BY sort_order"
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

_panchang_cache: dict[str, dict] = {}       # bare panchang (legacy, kept for internal use)
_panchang_full_cache: dict[str, dict] = {}  # enriched: panchang + signals + summary

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

_PANCHANG_SIGNALS_SQL = """
    SELECT
        r.id              AS rule_id,
        r.rule_code,
        r.display_name    AS rule_name,
        r.rule_type,
        r.outcome,
        r.probability_label,
        r.scope,
        s.strength,
        s.conditions_snapshot,
        c.confidence_score,
        c.avg_return_matched,
        c.total_occurrences
    FROM km_rule_signals s
    JOIN  km_astro_rule_master r  ON r.id = s.rule_id
    LEFT JOIN km_rule_confidence c ON c.rule_id = s.rule_id
    WHERE s.date = %s
      AND r.is_active = TRUE
    ORDER BY c.confidence_score DESC NULLS LAST, s.strength DESC
"""

_TRADING_DAY_SQL = """
    SELECT COUNT(*) AS cnt
    FROM km_index_eod
    WHERE trade_date = %s
      AND index_id = (SELECT id FROM km_index_symbols WHERE name = 'NIFTY 50' LIMIT 1)
"""

# Outcome groupings for the 8-value scale
_BULLISH_OUTCOMES = frozenset({'strong_bullish', 'bullish', 'mild_bullish'})
_BEARISH_OUTCOMES = frozenset({'strong_bearish', 'bearish', 'mild_bearish'})


@app.get('/api/panchang/daily')
def panchang_daily(date: str = None):
    tz_ist = __import__('zoneinfo').ZoneInfo('Asia/Kolkata')
    today = datetime.now(tz=tz_ist).date()

    if not date:
        date = today.strftime('%Y-%m-%d')

    # Enriched cache — skip today so freshly-run signals appear immediately
    if date in _panchang_full_cache:
        return _panchang_full_cache[date]

    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f'Invalid date format: {date}')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # ── 1. Panchang row ──────────────────────────────────────────
            cur.execute(_PANCHANG_SQL, (date,))
            panchang_row = cur.fetchone()
            if not panchang_row:
                raise HTTPException(status_code=404, detail=f'No panchang data for {date}')
            panchang_data = _stringify_dates(dict(panchang_row))

            # ── 2. Rule signals for this date ────────────────────────────
            cur.execute(_PANCHANG_SIGNALS_SQL, (date,))
            signals = []
            bullish = bearish = volatile = turning = neutral = 0
            confidence_scores = []

            for r in cur.fetchall():
                outcome = r['outcome'] or 'neutral'
                conf = float(r['confidence_score']) if r['confidence_score'] is not None else None
                signals.append({
                    'rule_id':           r['rule_id'],
                    'rule_code':         r['rule_code'],
                    'rule_name':         r['rule_name'],
                    'rule_type':         r['rule_type'],
                    'outcome':           outcome,
                    'probability_label': r['probability_label'],
                    'scope':             r['scope'],
                    'strength':          r['strength'],
                    'conditions_snapshot': r['conditions_snapshot'],
                    'confidence_score':  conf,
                    'avg_return':        float(r['avg_return_matched']) if r['avg_return_matched'] is not None else None,
                    'total_occurrences': r['total_occurrences'],
                })
                if outcome in _BULLISH_OUTCOMES:   bullish  += 1
                elif outcome in _BEARISH_OUTCOMES: bearish  += 1
                elif outcome == 'volatile':        volatile += 1
                elif outcome == 'turning':         turning  += 1
                else:                              neutral  += 1
                if conf is not None:
                    confidence_scores.append(conf)

            # ── 3. Is this a trading day? ────────────────────────────────
            if date_obj > today:
                is_trading_day = None
            else:
                cur.execute(_TRADING_DAY_SQL, (date,))
                td = cur.fetchone()
                is_trading_day = bool(td['cnt'] > 0) if td else False

    except HTTPException:
        raise
    except Exception as e:
        log.error(f'panchang_daily error for {date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    result = {
        **panchang_data,
        'is_trading_day': is_trading_day,
        'signals': signals,
        'summary': {
            'total_signals': len(signals),
            'bullish':       bullish,
            'bearish':       bearish,
            'volatile':      volatile,
            'turning':       turning,
            'neutral':       neutral,
            'avg_confidence': round(sum(confidence_scores) / len(confidence_scores), 1)
                              if confidence_scores else None,
        },
    }

    # Cache past dates only — today's signals may still be updating after discovery
    if date_obj < today:
        _panchang_full_cache[date] = result

    return result


_WEEK_SIGNALS_SQL = """
    SELECT
        s.date,
        COUNT(*)                                                          AS total_signals,
        COUNT(*) FILTER (WHERE r.outcome IN ('strong_bullish','bullish','mild_bullish'))  AS bullish,
        COUNT(*) FILTER (WHERE r.outcome IN ('strong_bearish','bearish','mild_bearish'))  AS bearish,
        COUNT(*) FILTER (WHERE r.outcome = 'turning')                                     AS turning,
        COUNT(*) FILTER (WHERE r.outcome = 'neutral')                                     AS neutral,
        ROUND(AVG(c.confidence_score)::numeric, 1)                       AS avg_confidence,
        MAX(s.strength)                                                   AS peak_strength,
        json_agg(
            json_build_object(
                'rule_id',        r.id,
                'rule_code',      r.rule_code,
                'rule_name',      r.display_name,
                'rule_type',      r.rule_type,
                'outcome',        r.outcome,
                'strength',       s.strength,
                'confidence',     c.confidence_score,
                'probability_label', r.probability_label
            )
            ORDER BY c.confidence_score DESC NULLS LAST, s.strength DESC
        ) AS signals
    FROM km_rule_signals s
    JOIN  km_astro_rule_master  r ON r.id = s.rule_id
    LEFT JOIN km_rule_confidence c ON c.rule_id = s.rule_id
    WHERE s.date BETWEEN %s AND %s
      AND r.is_active = TRUE
      AND r.is_deleted = FALSE
      AND r.rule_type = 'nakshatra_vara'
    GROUP BY s.date
    ORDER BY s.date
"""

_PANCHANG_WEEK_SQL = """
    SELECT date, vara, nakshatra_name, tithi_name, yoga_name, paksha,
           dlnl_match, is_ekadashi, is_purnima
    FROM km_daily_panchang
    WHERE date BETWEEN %s AND %s
    ORDER BY date
"""

_IS_TRADING_WEEK_SQL = """
    SELECT DISTINCT trade_date FROM km_index_eod
    WHERE trade_date BETWEEN %s AND %s
      AND index_id = (SELECT id FROM km_index_symbols WHERE name = 'NIFTY 50' LIMIT 1)
"""


@app.get('/api/panchang/week')
def panchang_week(from_date: str = Query(..., alias='from'),
                  to_date: str  = Query(..., alias='to')):
    """
    Per-day rule signal summary for a date range (max 31 days).
    Returns list of {date, vara, nakshatra_name, tithi, is_trading_day,
                     total_signals, bullish, bearish, turning, neutral,
                     avg_confidence, peak_strength, signals[]}.
    """
    try:
        from_obj = datetime.strptime(from_date, '%Y-%m-%d').date()
        to_obj   = datetime.strptime(to_date,   '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail='Dates must be YYYY-MM-DD')

    if (to_obj - from_obj).days > 31:
        raise HTTPException(status_code=400, detail='Range must be ≤ 31 days')
    if to_obj < from_obj:
        raise HTTPException(status_code=400, detail='to must be ≥ from')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_PANCHANG_WEEK_SQL, (from_date, to_date))
            panchang_rows = {str(r['date']): dict(r) for r in cur.fetchall()}

            cur.execute(_WEEK_SIGNALS_SQL, (from_date, to_date))
            signal_rows = {str(r['date']): dict(r) for r in cur.fetchall()}

            cur.execute(_IS_TRADING_WEEK_SQL, (from_date, to_date))
            trading_days = {str(r['trade_date']) for r in cur.fetchall()}
    except Exception as e:
        log.error(f'panchang_week error {from_date}→{to_date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    # Build one entry per calendar day in range
    result = []
    day = from_obj
    while day <= to_obj:
        ds = str(day)
        prow = panchang_rows.get(ds, {})
        srow = signal_rows.get(ds, {})

        result.append({
            'date':            ds,
            'vara':            prow.get('vara'),
            'nakshatra_name':  prow.get('nakshatra_name'),
            'tithi_name':      prow.get('tithi_name'),
            'yoga_name':       prow.get('yoga_name'),
            'paksha':          prow.get('paksha'),
            'dlnl_match':      prow.get('dlnl_match'),
            'is_ekadashi':     prow.get('is_ekadashi'),
            'is_purnima':      prow.get('is_purnima'),
            'is_trading_day':  ds in trading_days,
            'total_signals':   int(srow.get('total_signals', 0)),
            'bullish':         int(srow.get('bullish', 0)),
            'bearish':         int(srow.get('bearish', 0)),
            'turning':         int(srow.get('turning', 0)),
            'neutral':         int(srow.get('neutral', 0)),
            'avg_confidence':  float(srow['avg_confidence']) if srow.get('avg_confidence') is not None else None,
            'peak_strength':   int(srow['peak_strength']) if srow.get('peak_strength') is not None else None,
            'signals':         srow.get('signals') or [],
        })
        day += timedelta(days=1)

    return result


# ── Dashboard Composite ────────────────────────────────────────────────────

_COMPOSITE_ASTRO_SQL = """
    SELECT r.outcome, r.display_name AS rule_name, s.strength, c.confidence_score
    FROM km_rule_signals s
    JOIN  km_astro_rule_master  r ON r.id = s.rule_id
    LEFT JOIN km_rule_confidence c ON c.rule_id = s.rule_id
    WHERE s.date = %s
      AND r.is_active = TRUE
      AND r.is_deleted = FALSE
      AND r.rule_type = 'nakshatra_vara'
"""

_COMPOSITE_ROC_SQL = """
    SELECT trade_date, roc_13
    FROM km_breadth_roc
    WHERE trade_date <= %s
    ORDER BY trade_date DESC
    LIMIT 2
"""

_COMPOSITE_BREADTH_SQL = """
    SELECT breadth_score
    FROM km_market_breadth
    WHERE trade_date <= %s
    ORDER BY trade_date DESC
    LIMIT 1
"""

_BULLISH_SET = frozenset({'strong_bullish', 'bullish', 'mild_bullish'})
_BEARISH_SET = frozenset({'strong_bearish', 'bearish', 'mild_bearish'})


@app.get('/api/dashboard/composite')
def dashboard_composite(date: str = Query(default=None)):
    """
    Compute Astro-Technical Alignment composite score for a given date.
    Components: astro rule signals, breadth ROC momentum, market breadth.
    Returns MarketWeatherProps-shaped JSON.
    """
    if date is None:
        date = str(datetime.now().date())
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail='date must be YYYY-MM-DD')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_COMPOSITE_ASTRO_SQL, (date,))
            astro_rows = cur.fetchall()

            cur.execute(_COMPOSITE_ROC_SQL, (date,))
            roc_rows = cur.fetchall()

            cur.execute(_COMPOSITE_BREADTH_SQL, (date,))
            breadth_row = cur.fetchone()
    except Exception as e:
        log.error(f'dashboard_composite error for {date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    # ── Astro component ────────────────────────────────────────────────────
    pos_rows = [r for r in astro_rows if r['outcome'] in _BULLISH_SET]
    neg_rows = [r for r in astro_rows if r['outcome'] in _BEARISH_SET]
    trn_rows = [r for r in astro_rows if r['outcome'] == 'turning']
    positive = len(pos_rows)
    negative = len(neg_rows)
    turning  = len(trn_rows)
    mixed    = len(astro_rows) - positive - negative - turning
    total    = len(astro_rows)

    def _avg_conf(rows: list) -> float:
        confs = [float(r['confidence_score']) for r in rows if r['confidence_score'] is not None]
        return round(sum(confs) / len(confs), 1) if confs else 0.0

    avg_pos_conf = _avg_conf(pos_rows)
    avg_neg_conf = _avg_conf(neg_rows)
    avg_trn_conf = _avg_conf(trn_rows)

    # Astro bar = average confidence of the dominant-direction signals
    if total == 0:
        astro_norm = 0.5
        astro_score = 50.0
    elif turning > positive and turning > negative:
        astro_score = avg_trn_conf
        astro_norm  = avg_trn_conf / 100.0
    elif positive >= negative:
        astro_score = avg_pos_conf
        astro_norm  = avg_pos_conf / 100.0
    else:
        astro_score = avg_neg_conf
        astro_norm  = avg_neg_conf / 100.0

    # ── ROC component ──────────────────────────────────────────────────────
    roc_13      = float(roc_rows[0]['roc_13']) if roc_rows else 0.0
    roc_13_prev = float(roc_rows[1]['roc_13']) if len(roc_rows) > 1 else roc_13
    # Normalize ROC: clamp [-5, +5] → [0, 1]
    roc_norm = max(0.0, min(1.0, (roc_13 + 5.0) / 10.0))

    # ── Breadth component ──────────────────────────────────────────────────
    breadth_raw  = float(breadth_row['breadth_score']) if breadth_row and breadth_row['breadth_score'] is not None else 50.0
    breadth_norm = breadth_raw / 100.0

    # ── Composite (weighted: astro 50%, roc 25%, breadth 25%) ─────────────
    composite = round((astro_norm * 0.50 + roc_norm * 0.25 + breadth_norm * 0.25) * 100)

    def _label(score: int) -> tuple[str, str]:
        if score > 70: return 'High Positive Alignment', '☀️'
        if score > 60: return 'Moderate Positive',       '🌤'
        if score > 45: return 'Mixed Signals',           '🌥'
        if score > 35: return 'Moderate Negative',       '🌦'
        return           'High Negative Alignment',      '🌧'

    label, icon = _label(composite)

    return {
        'date':            date,
        'composite_score': composite,
        'composite_label': label,
        'composite_icon':  icon,
        'components': {
            'astro': {
                'score':        astro_score,
                'positive':     positive,
                'negative':     negative,
                'turning':      turning,
                'mixed':        mixed,
                'total':        total,
                'avg_pos_conf': avg_pos_conf,
                'avg_neg_conf': avg_neg_conf,
                'avg_trn_conf': avg_trn_conf,
            },
            'roc': {
                'roc_13':      round(roc_13, 4),
                'roc_13_prev': round(roc_13_prev, 4),
                'normalized':  round(roc_norm, 4),
            },
            'breadth': {
                'breadth_score': round(breadth_raw, 2),
                'normalized':    round(breadth_norm, 4),
            },
        },
    }


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

# Intraday Plan Score — sum of strength × signed direction across active
# planetary rules on a date (see docs/dristiq/intraday_page_spec.md §6).
# Mirrored verbatim in scripts/calibrate_plan_score.py.
_PLAN_SCORE_RAW_SQL = """
    SELECT
      COALESCE(SUM(
        CASE
          WHEN s.signal IN ('strong_bullish','bullish')   THEN  s.strength
          WHEN s.signal =  'mild_bullish'                 THEN  s.strength * 0.5
          WHEN s.signal =  'mild_bearish'                 THEN -s.strength * 0.5
          WHEN s.signal IN ('strong_bearish','bearish')   THEN -s.strength
          ELSE 0
        END
      ), 0)::NUMERIC AS plan_raw,
      COUNT(*)        AS contributing_rules
    FROM km_rule_signals      s
    JOIN km_astro_rule_master r ON r.id = s.rule_id
    WHERE s.date = %s
      AND r.is_active   = TRUE
      AND r.is_deleted  = FALSE
      AND r.rule_type IN ('planet_state','planet_transit',
                          'planet_conjunction','vedh','eclipse')
"""

_PLAN_SCORE_NORMALIZER_SQL = """
    SELECT normalizer, sample_count, percentile, computed_at
    FROM km_score_calibration
    WHERE score_name = 'intraday_plan_score'
"""


@app.get('/api/dashboard/context')
def dashboard_context(date: str = Query(default=None)):
    """
    Historical context for a given date: same vara + nakshatra_lord + paksha + breadth regime.
    Returns occurrence count, positive%, avg return, and last 5 matching dates with NIFTY returns.
    """
    if date is None:
        date = datetime.now(tz=__import__('zoneinfo').ZoneInfo('Asia/Kolkata')).strftime('%Y-%m-%d')
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail='date must be YYYY-MM-DD')

    conn = _conn()
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT vara, nakshatra_name, nakshatra_lord, paksha, tithi_name, dlnl_match
            FROM km_daily_panchang
            WHERE date = %s
        """, (date,))
        panchang = cur.fetchone()
        if not panchang:
            cur.close()
            return {"available": False}

        vara, nak_name, nak_lord, paksha, tithi, dlnl = panchang

        cur.execute("""
            SELECT breadth_score,
                CASE WHEN breadth_score > 55 THEN 'Elevated'
                     WHEN breadth_score > 35 THEN 'Moderate'
                     ELSE 'Depressed' END AS regime
            FROM km_market_breadth
            WHERE trade_date <= %s
            ORDER BY trade_date DESC LIMIT 1
        """, (date,))
        breadth_row = cur.fetchone()
        breadth_score = float(breadth_row[0]) if breadth_row else None
        breadth_regime = breadth_row[1] if breadth_row else 'Unknown'

        _regime_case = """
            CASE WHEN b.breadth_score > 55 THEN 'Elevated'
                 WHEN b.breadth_score > 35 THEN 'Moderate'
                 ELSE 'Depressed' END
        """

        cur.execute(f"""
            SELECT
                COUNT(*) AS occurrences,
                ROUND(AVG(e.pct_chng)::numeric, 2) AS avg_return,
                ROUND(
                    COUNT(*) FILTER (WHERE e.pct_chng > 0)::numeric
                    / NULLIF(COUNT(*), 0) * 100
                , 1) AS positive_pct
            FROM km_daily_panchang p
            JOIN km_market_breadth b ON b.trade_date = p.date
            JOIN km_index_eod e ON e.trade_date = p.date AND e.index_id = 1
            WHERE p.vara = %s
              AND p.nakshatra_lord = %s
              AND p.paksha = %s
              AND {_regime_case} = %s
              AND p.date < %s
              AND e.pct_chng IS NOT NULL
        """, (vara, nak_lord, paksha, breadth_regime, date))
        stats = cur.fetchone()
        occurrences = int(stats[0]) if stats else 0
        avg_return   = float(stats[1]) if stats and stats[1] is not None else None
        positive_pct = float(stats[2]) if stats and stats[2] is not None else None

        cur.execute(f"""
            SELECT p.date, e.pct_chng
            FROM km_daily_panchang p
            JOIN km_market_breadth b ON b.trade_date = p.date
            JOIN km_index_eod e ON e.trade_date = p.date AND e.index_id = 1
            WHERE p.vara = %s
              AND p.nakshatra_lord = %s
              AND p.paksha = %s
              AND {_regime_case} = %s
              AND p.date < %s
              AND e.pct_chng IS NOT NULL
            ORDER BY p.date DESC
            LIMIT 5
        """, (vara, nak_lord, paksha, breadth_regime, date))
        recent = [{"date": str(r[0]), "return": float(r[1])} for r in cur.fetchall()]
        cur.close()

    except Exception as e:
        log.error(f'dashboard_context error for {date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return {
        "available": True,
        "date": date,
        "conditions": {
            "vara": vara,
            "nakshatra": nak_name,
            "nakshatra_lord": nak_lord,
            "paksha": paksha,
            "breadth_regime": breadth_regime,
            "breadth_score": breadth_score,
        },
        "historical": {
            "occurrences": occurrences,
            "positive_pct": positive_pct,
            "avg_return": avg_return,
            "recent": recent,
        },
    }


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


# ── Intraday Plan Score (data-driven planetary contribution) ─────────────

@app.get('/api/intraday/plan-score')
def intraday_plan_score(date: str = None):
    """Plan Score for a single date.

    Returns plan_raw (signed strength sum), contributing_rules (int),
    normalizer (NUMERIC from km_score_calibration), and plan_score
    (clamped to [-2, 2] = plan_raw / normalizer * 2).
    """
    tz_ist = __import__('zoneinfo').ZoneInfo('Asia/Kolkata')
    if not date:
        date = datetime.now(tz=tz_ist).strftime('%Y-%m-%d')
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f'Invalid date format: {date}')

    try:
        raw_rows = _db_query(_PLAN_SCORE_RAW_SQL, (date,))
        norm_rows = _db_query(_PLAN_SCORE_NORMALIZER_SQL)
    except Exception as e:
        log.error(f'intraday_plan_score error for {date}: {e}')
        raise HTTPException(status_code=500, detail=str(e))

    raw = raw_rows[0] if raw_rows else {'plan_raw': 0, 'contributing_rules': 0}
    plan_raw = float(raw['plan_raw'] or 0)
    contributing = int(raw['contributing_rules'] or 0)

    normalizer = None
    calibrated_at = None
    if norm_rows:
        normalizer = float(norm_rows[0]['normalizer'])
        calibrated_at = norm_rows[0]['computed_at'].isoformat() \
            if norm_rows[0]['computed_at'] else None

    if normalizer and normalizer > 0:
        scaled = plan_raw / normalizer * 2.0
        plan_score = max(-2.0, min(2.0, scaled))
    else:
        # Calibration not yet run — fall back to raw, capped, with warning flag.
        plan_score = max(-2.0, min(2.0, plan_raw))

    return {
        'date': date_obj.isoformat(),
        'plan_raw': round(plan_raw, 4),
        'contributing_rules': contributing,
        'normalizer': round(normalizer, 4) if normalizer else None,
        'plan_score': round(plan_score, 4),
        'calibrated_at': calibrated_at,
        'is_calibrated': normalizer is not None,
    }


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
    # month, year, day_of_week are GENERATED ALWAYS columns — do NOT include
    # them in the INSERT list; PostgreSQL computes them from start_date.
    sql = """
        INSERT INTO km_astro_calendar
          (display_name, start_date, end_date, market_impact, is_transit,
           narrative, notes, inference)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (
                req.display_name, req.start_date, req.end_date,
                req.market_impact, req.is_transit,
                req.narrative, req.notes, req.inference,
            ))
            row_id = cur.fetchone()[0]
        conn.commit()
        _invalidate_astro_cache()
        return {'id': row_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.patch('/api/astro/calendar/{event_id}')
def astro_calendar_update(event_id: int, req: AstroCalendarUpsert):
    # month, year, day_of_week are GENERATED ALWAYS columns — omit from SET;
    # they auto-recompute when start_date changes.
    sql = """
        UPDATE km_astro_calendar SET
          display_name  = %s,
          start_date    = %s,
          end_date      = %s,
          market_impact = %s,
          is_transit    = %s,
          narrative     = %s,
          notes         = %s,
          inference     = %s
        WHERE id = %s
    """
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (
                req.display_name, req.start_date, req.end_date,
                req.market_impact, req.is_transit,
                req.narrative, req.notes, req.inference,
                event_id,
            ))
        conn.commit()
        _invalidate_astro_cache()
        return {'ok': True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete('/api/astro/calendar/{event_id}')
def astro_calendar_delete(event_id: int):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM km_astro_calendar WHERE id = %s', (event_id,))
        conn.commit()
        _invalidate_astro_cache()
        return {'ok': True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Panchang Generate Endpoint ───────────────────────────────────────────────

@app.post('/api/panchang/generate')
def panchang_generate(month: int, year: int):
    """
    Compute and upsert panchang rows for the given month/year into
    km_panchang_calendar. Runs synchronously — no background task.
    """
    import calendar as _cal
    from datetime import date as _date, timedelta as _td
    try:
        from generate_panchang_2026 import build_row, upsert_panchang_calendar
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f'Ephemeris module unavailable: {exc}')

    last_day = _cal.monthrange(year, month)[1]
    start    = _date(year, month, 1)
    end      = _date(year, month, last_day)

    db_rows  = []
    errors   = []
    conn     = _conn()
    try:
        d = start
        while d <= end:
            try:
                _csv_row, db_row = build_row(d, conn)
                db_rows.append(db_row)
            except Exception as e:
                errors.append(f'{d}: {e}')
            d += _td(days=1)

        if db_rows:
            upsert_panchang_calendar(conn, db_rows)

        result = {'upserted': len(db_rows), 'errors': errors}
        return result
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Panchang Calendar Endpoints ───────────────────────────────────────────────

@app.get('/api/panchang/calendar')
def panchang_calendar(month: int, year: int):
    """
    Monthly panchang rows joined with astro daily signals and day notes.
    Returns one object per calendar day with nested notes array.
    """
    import calendar as _cal
    last_day = _cal.monthrange(year, month)[1]
    first_iso = f'{year:04d}-{month:02d}-01'
    last_iso  = f'{year:04d}-{month:02d}-{last_day:02d}'

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    p.trade_date::text,
                    p.weekday,
                    p.tithi,
                    CASE
                        WHEN dp.tithi_end_ist IS NOT NULL
                        THEN TO_CHAR(dp.tithi_end_ist, 'HH24:MI')
                             || CASE WHEN dp.tithi_end_next_day THEN '+1' ELSE '' END
                        ELSE p.tithi_end_time
                    END AS tithi_end_time,
                    p.moon_rashi,
                    p.moon_rashi_next,
                    p.moon_rashi_change_time,
                    p.nakshatra,
                    p.nakshatra_next,
                    p.nakshatra_change_time,
                    CASE
                        WHEN dp.nakshatra_end_ist IS NOT NULL
                        THEN TO_CHAR(dp.nakshatra_end_ist, 'HH24:MI')
                             || CASE WHEN dp.nakshatra_end_next_day THEN '+1' ELSE '' END
                        ELSE NULL
                    END AS nakshatra_end_time,
                    p.nak_lord,
                    s.net_signal,
                    s.net_score,
                    s.turning_date
                FROM km_panchang_calendar p
                LEFT JOIN km_daily_panchang dp ON dp.date = p.trade_date
                LEFT JOIN km_astro_daily_signal s ON s.trade_date = p.trade_date
                WHERE p.trade_date BETWEEN %s AND %s
                ORDER BY p.trade_date
            """, (first_iso, last_iso))
            panchang_rows = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT id, trade_date::text, calendar_label, scope, scope_value,
                       annotation, sort_order
                FROM km_panchang_day_notes
                WHERE trade_date BETWEEN %s AND %s
                ORDER BY trade_date, sort_order, id
            """, (first_iso, last_iso))
            notes_rows = cur.fetchall()

        # index notes by date
        notes_by_date: dict = {}
        for n in notes_rows:
            nd = n['trade_date']
            notes_by_date.setdefault(nd, []).append(dict(n))

        for row in panchang_rows:
            row['notes'] = notes_by_date.get(row['trade_date'], [])

        return panchang_rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Panchang Day Notes CRUD ───────────────────────────────────────────────────

class PanchangNotePayload(BaseModel):
    trade_date:     str
    calendar_label: str
    scope:          str = 'market'
    scope_value:    Optional[str] = None
    annotation:     Optional[str] = None
    sort_order:     int = 0


@app.get('/api/panchang/notes')
def panchang_notes_for_date(date: str):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, trade_date::text, calendar_label, scope, scope_value,
                       annotation, sort_order
                FROM km_panchang_day_notes
                WHERE trade_date = %s
                ORDER BY sort_order, id
            """, (date,))
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post('/api/panchang/notes')
def panchang_note_create(req: PanchangNotePayload):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO km_panchang_day_notes
                  (trade_date, calendar_label, scope, scope_value, annotation, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (req.trade_date, req.calendar_label, req.scope,
                  req.scope_value, req.annotation, req.sort_order))
            row_id = cur.fetchone()[0]
        conn.commit()
        return {'id': row_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.patch('/api/panchang/notes/{note_id}')
def panchang_note_update(note_id: int, req: PanchangNotePayload):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE km_panchang_day_notes SET
                  trade_date     = %s,
                  calendar_label = %s,
                  scope          = %s,
                  scope_value    = %s,
                  annotation     = %s,
                  sort_order     = %s
                WHERE id = %s
            """, (req.trade_date, req.calendar_label, req.scope,
                  req.scope_value, req.annotation, req.sort_order, note_id))
        conn.commit()
        return {'ok': True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete('/api/panchang/notes/{note_id}')
def panchang_note_delete(note_id: int):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM km_panchang_day_notes WHERE id = %s', (note_id,))
        conn.commit()
        return {'ok': True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── VaNi AI Endpoints ─────────────────────────────────────────────────────

_insight_cache: dict[str, object] = {}

_vani_cache: dict[str, dict] = {}
_intent_cache: dict[str, dict] = {}   # key: "{intent_id}:{date}:{entity_id}"
_VANI_CACHE_TTL_HOURS = 24

_VANI_SYSTEM_PROMPT = """You are VaNi (Vāṇī), the voice of knowledge for DristiQ — \
a Vedic astronomical market intelligence platform for Indian traders.

Your role: Generate factual, educational, non-predictive explanations of astronomical \
conditions and their historical correlation with NSE market behavior.

Rules:
- Never use: buy, sell, bullish, bearish, up, down, rise, fall
- Use: positive correlation, negative correlation, historically associated, \
  recorded instances, atmospheric conditions
- Always cite data when available (occurrences, %)
- Maximum 4 sentences
- End with macro backdrop context
- Use astronomical terminology: vara, nakshatra, tithi, paksha, combust, \
  retrograde, conjunction, vedh
- Tone: scholarly, observational, non-advisory
- Language: English with Sanskrit terms where natural"""
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
    _t0 = time.monotonic()
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens, no_think=True)
    _latency = int((time.monotonic() - _t0) * 1000)
    log_id: str | None = None
    if insight:
        _insight_cache[date] = insight
        log_id = _log_interaction(
            product="dristiq",
            endpoint="/api/ai/panchang-insight",
            user_input=user_msg,
            llm_response=insight,
            system_prompt=skill.system,
            context_payload={k: str(v) for k, v in p.items() if v is not None},
            model_version=_AI_MODEL,
            latency_ms=_latency,
        )
    return {"date": date, "insight": insight, "ai": insight is not None, "log_id": log_id}


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
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens, no_think=True)
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
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens, no_think=True)
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
    insight  = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens, no_think=True)
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
    insight       = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens, no_think=True)
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


# ─────────────────────────────────────────────────────────────────────────────
# DISCOVERY ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

# ── Module-level state for the single running discovery job ───────────────────

_discovery_state: dict = {
    'job_id':                None,
    'running':               False,
    'cancel_requested':      False,
    'started_at':            None,
    'finished_at':           None,
    'rules_total':           0,
    'rules_done':            0,
    'signals_inserted':      0,
    'transits_inserted':     0,
    'current_rule_code':     None,
    'phase':                 None,
    'errors':                [],
    'confidence_computed_at': None,
    'confidence_error':      None,
}

# ── Import discovery logic lazily (scripts package, same process) ─────────────

def _import_discover_rule():
    """Return discovery functions tuple or raise."""
    try:
        from scripts.rule_discovery import (  # noqa: PLC0415
            discover_rule,
            load_vocabulary,
            build_vedh_map,
            get_panchak_nakshatras,
            should_group_transits,
            detect_transits,
            insert_transits,
        )
        return (discover_rule, load_vocabulary, build_vedh_map,
                get_panchak_nakshatras, should_group_transits,
                detect_transits, insert_transits)
    except Exception as exc:
        raise ImportError(f'Cannot import rule_discovery: {exc}') from exc


def _load_rules_for_discovery(conn, mode: str, rule_id: int | None = None) -> list[dict]:
    """Load active available rules based on mode."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if mode == 'single' and rule_id is not None:
            cur.execute(
                "SELECT id, rule_code, rule_type, display_name, outcome, "
                "probability_label, conditions, data_source "
                "FROM km_astro_rule_master "
                "WHERE id = %s AND is_active = TRUE AND is_deleted = FALSE",
                (rule_id,)
            )
        elif mode == 'missing':
            cur.execute(
                "SELECT r.id, r.rule_code, r.rule_type, r.display_name, r.outcome, "
                "r.probability_label, r.conditions, r.data_source "
                "FROM km_astro_rule_master r "
                "WHERE r.is_active = TRUE AND r.is_deleted = FALSE "
                "AND r.data_source = 'available' "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM km_rule_signals s WHERE s.rule_id = r.id"
                ") "
                "ORDER BY r.rule_type, r.rule_code"
            )
        else:  # 'all'
            cur.execute(
                "SELECT id, rule_code, rule_type, display_name, outcome, "
                "probability_label, conditions, data_source "
                "FROM km_astro_rule_master "
                "WHERE is_active = TRUE AND is_deleted = FALSE "
                "AND data_source = 'available' "
                "ORDER BY rule_type, rule_code"
            )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def _run_discovery_bg(mode: str, rule_id: int | None = None):
    """Background task: run rule discovery and update _discovery_state."""
    print(f"DEBUG: background task started, mode={mode}", flush=True)
    import json as _json  # noqa: PLC0415

    global _discovery_state

    job_id = _discovery_state['job_id']
    # Reset counters — running=True already set by the endpoint
    _discovery_state.update({
        'cancel_requested':  False,
        'started_at':        datetime.utcnow().isoformat(),
        'finished_at':       None,
        'rules_total':       0,
        'rules_done':        0,
        'signals_inserted':  0,
        'transits_inserted': 0,
        'current_rule_code': None,
        'errors':            [],
    })

    print("DEBUG: about to import rule_discovery", flush=True)
    try:
        import scripts.rule_discovery as _rd_mod  # noqa: PLC0415
        _rd_mod._PANCHANG_SCHEMA_PRINTED = False   # reset diag flag for fresh run
        (discover_rule, load_vocabulary, build_vedh_map, get_panchak_nakshatras,
         should_group_transits, detect_transits, insert_transits) = _import_discover_rule()
    except ImportError as exc:
        print(f"DEBUG: import failed: {exc}", flush=True)
        log.error(f'Discovery import failed: {exc}')
        _discovery_state.update({'running': False, 'finished_at': datetime.utcnow().isoformat()})
        _discovery_state['errors'].append({'rule_code': 'IMPORT', 'error': str(exc)})
        return
    print("DEBUG: import succeeded", flush=True)

    _discovery_state['phase'] = 'connecting'
    print("DEBUG: about to open DB connection", flush=True)
    try:
        conn = _conn(statement_timeout_ms=60000)
    except Exception as exc:
        print(f"DEBUG: DB connection failed: {exc}", flush=True)
        log.error(f'Discovery DB connection failed: {exc}')
        _discovery_state.update({'running': False, 'finished_at': datetime.utcnow().isoformat(), 'phase': None})
        _discovery_state['errors'].append({'rule_code': 'DB_CONN', 'error': str(exc)})
        return

    print("DEBUG: DB connection opened", flush=True)
    try:
        _discovery_state['phase'] = 'loading vocabulary'
        print("DEBUG: about to load vocabulary", flush=True)
        vocab = load_vocabulary(conn)
        vedh_map = build_vedh_map(vocab['nakshatra_positions_names'])
        panchak_naks = get_panchak_nakshatras(vocab['nakshatra_positions_names'])
        print(f"DEBUG: vocabulary loaded: {len(vocab['nakshatra_positions_names'])} nakshatras", flush=True)
        log.info(f'Vocabulary loaded: {len(vocab["nakshatra_positions_names"])} nakshatras')

        _discovery_state['phase'] = 'loading rules'
        print(f"DEBUG: about to load rules from DB", flush=True)
        rules = _load_rules_for_discovery(conn, mode, rule_id)
        print(f"DEBUG: loaded {len(rules)} rules", flush=True)
        _discovery_state['rules_total'] = len(rules)
        _discovery_state['phase'] = 'running'
        log.info(f'Discovery [{mode}] starting — {len(rules)} rules, job {job_id}')

        for rule in rules:
            # Honour cancel requests between rules
            if _discovery_state['cancel_requested']:
                log.info(f'Discovery [{mode}] cancelled after {_discovery_state["rules_done"]} rules')
                _discovery_state['errors'].append({'rule_code': 'CANCELLED', 'error': 'Cancelled by user'})
                break

            _discovery_state['current_rule_code'] = rule['rule_code']

            # Ensure conditions is a dict (may come from DB as dict or str)
            if isinstance(rule.get('conditions'), str):
                try:
                    rule['conditions'] = _json.loads(rule['conditions'])
                except Exception:
                    rule['conditions'] = {}
            elif rule.get('conditions') is None:
                rule['conditions'] = {}

            try:
                matched_rows = discover_rule(conn, rule, vedh_map, panchak_naks, vocab)
                print(f"DEBUG [{rule['rule_code']}]: discover_rule → {len(matched_rows)} rows, should_group={should_group_transits(rule)}", flush=True)

                strength = {'Very High': 5, 'High': 4, 'Reasonable': 3, 'Low': 2}.get(
                    rule.get('probability_label'), 3
                )
                inserted = 0
                if matched_rows:
                    from psycopg2.extras import execute_values as _ev
                    _data = [
                        (d, rule['id'], rule.get('outcome'), strength,
                         rule['display_name'], _json.dumps(snapshot))
                        for d, snapshot in matched_rows
                    ]
                    with conn.cursor() as cur:
                        _ev(cur,
                            "INSERT INTO km_rule_signals "
                            "(date, rule_id, signal, strength, details, conditions_snapshot) "
                            "VALUES %s ON CONFLICT (date, rule_id) DO NOTHING",
                            _data)
                        inserted = len(_data)
                conn.commit()
                _discovery_state['signals_inserted'] += inserted

                # Insert transits for transit-grouped rule types
                if matched_rows and should_group_transits(rule):
                    rule_transits = detect_transits(conn, rule, matched_rows)
                    print(f"DEBUG [{rule['rule_code']}]: detect_transits → {len(rule_transits)} transits", flush=True)
                    if rule_transits:
                        try:
                            n_tr = insert_transits(conn, rule, rule_transits)
                            conn.commit()
                            _discovery_state['transits_inserted'] += n_tr
                            print(f"DEBUG [{rule['rule_code']}]: insert_transits → {n_tr} inserted", flush=True)
                        except Exception as tr_exc:
                            conn.rollback()
                            print(f"DEBUG [{rule['rule_code']}]: insert_transits FAILED: {tr_exc}", flush=True)
                            log.error(f"Transit insert error rule {rule['rule_code']}: {tr_exc}")
                            _discovery_state['errors'].append(
                                {'rule_code': rule['rule_code'] + ':TRANSIT', 'error': str(tr_exc)}
                            )

            except Exception as exc:
                log.error(f"Discovery error rule {rule['rule_code']}: {exc}")
                conn.rollback()
                _discovery_state['errors'].append(
                    {'rule_code': rule['rule_code'], 'error': str(exc)}
                )

            _discovery_state['rules_done'] += 1

    except Exception as exc:
        log.error(f'Discovery task failed: {exc}')
        _discovery_state['errors'].append({'rule_code': 'FATAL', 'error': str(exc)})
    finally:
        try:
            conn.close()
        except Exception:
            pass
        # Keep running=True here — confidence phase follows immediately below.
        # We only clear transient per-rule state in the finally block.
        _discovery_state['current_rule_code'] = None
        log.info(
            f'Discovery [{mode}] done — {_discovery_state["rules_done"]} rules, '
            f'{_discovery_state["signals_inserted"]} signals, '
            f'{len(_discovery_state["errors"])} errors'
        )

    # Phase 2: auto-run confidence scoring.
    # running stays True so the frontend keeps polling and data is only
    # refreshed once both discovery AND confidence have completed.
    _discovery_state['phase'] = 'confidence_scoring'
    log.info('Discovery complete. Starting confidence scoring…')
    _run_confidence_bg()
    # Sync confidence result into discovery state so the panel can show it
    _discovery_state['confidence_computed_at'] = _confidence_state.get('finished_at')
    _discovery_state['confidence_error'] = _confidence_state.get('error')
    # Mark the full pipeline (discovery + confidence) as done
    _discovery_state['running'] = False
    _discovery_state['finished_at'] = datetime.utcnow().isoformat()
    _discovery_state['phase'] = None
    log.info('Full discovery+confidence pipeline complete.')


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post('/api/discovery/run-all')
def discovery_run_all(background_tasks: BackgroundTasks):
    """Trigger full discovery for all active available rules (all history)."""
    if _discovery_state['running']:
        raise HTTPException(409, 'A discovery job is already running')
    job_id = str(uuid.uuid4())
    _discovery_state['job_id'] = job_id
    _discovery_state['running'] = True
    background_tasks.add_task(_run_discovery_bg, 'all')
    return {'job_id': job_id, 'status': 'started', 'message': 'Full discovery started'}


@app.post('/api/discovery/run-missing')
def discovery_run_missing(background_tasks: BackgroundTasks):
    """Trigger discovery only for rules with zero signals."""
    if _discovery_state['running']:
        raise HTTPException(409, 'A discovery job is already running')
    # Count missing rules synchronously so we can return the number
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM km_astro_rule_master r "
                "WHERE r.is_active = TRUE AND r.is_deleted = FALSE "
                "AND r.data_source = 'available' "
                "AND NOT EXISTS (SELECT 1 FROM km_rule_signals s WHERE s.rule_id = r.id)"
            )
            missing_count = cur.fetchone()[0]
        conn.close()
    except Exception:
        missing_count = 0

    job_id = str(uuid.uuid4())
    _discovery_state['job_id'] = job_id
    _discovery_state['running'] = True
    background_tasks.add_task(_run_discovery_bg, 'missing')
    return {
        'job_id': job_id,
        'status': 'started',
        'message': 'Missing rules discovery started',
        'rules_to_process': missing_count,
    }


@app.post('/api/discovery/run-rule/{rule_id}')
def discovery_run_single(rule_id: int, background_tasks: BackgroundTasks):
    """Trigger discovery for a single rule_id."""
    if _discovery_state['running']:
        raise HTTPException(409, 'A discovery job is already running')
    job_id = str(uuid.uuid4())
    _discovery_state['job_id'] = job_id
    _discovery_state['running'] = True
    background_tasks.add_task(_run_discovery_bg, 'single', rule_id)
    return {'job_id': job_id, 'status': 'started', 'rule_id': rule_id}


@app.get('/api/discovery/status')
def discovery_status():
    """Return current or last discovery job state."""
    state = dict(_discovery_state)

    # Add a summary from the DB
    summary = {'rules_with_signals': 0, 'rules_without_signals': 0, 'total_signals': 0}
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT "
                "  COUNT(DISTINCT rule_id) AS rules_with_signals, "
                "  SUM(cnt) AS total_signals "
                "FROM (SELECT rule_id, COUNT(*) AS cnt FROM km_rule_signals GROUP BY rule_id) t"
            )
            row = cur.fetchone()
            if row:
                summary['rules_with_signals'] = row[0] or 0
                summary['total_signals'] = row[1] or 0

            cur.execute(
                "SELECT COUNT(*) FROM km_astro_rule_master "
                "WHERE is_active = TRUE AND is_deleted = FALSE AND data_source = 'available'"
            )
            total_active = (cur.fetchone() or [0])[0] or 0
            summary['rules_without_signals'] = max(0, total_active - summary['rules_with_signals'])
        conn.close()
    except Exception as exc:
        log.warning(f'discovery_status summary query failed: {exc}')

    state['summary'] = summary
    return state


@app.get('/api/discovery/signal-counts')
def discovery_signal_counts():
    """Return per-rule signal counts plus transit counts for the Rule List column."""
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT rule_id, COUNT(*) AS count FROM km_rule_signals GROUP BY rule_id"
            )
            signal_rows = cur.fetchall()
            cur.execute(
                "SELECT rule_id, COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE end_date <= CURRENT_DATE) AS historical "
                "FROM km_rule_transits GROUP BY rule_id"
            )
            transit_rows = cur.fetchall()
        conn.close()
        transit_map = {r[0]: {'total': r[1], 'historical': r[2]} for r in transit_rows}
        return [
            {
                'rule_id': r[0],
                'count': r[1],
                'transit_total': transit_map.get(r[0], {}).get('total', 0),
                'transit_historical': transit_map.get(r[0], {}).get('historical', 0),
            }
            for r in signal_rows
        ]
    except Exception as exc:
        raise HTTPException(500, f'Signal counts query failed: {exc}')


@app.get('/api/discovery/transit-counts')
def discovery_transit_counts():
    """Return per-rule transit counts (historical and future) for the Rule List column."""
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    rule_id,
                    COUNT(*)                                          AS total,
                    COUNT(*) FILTER (WHERE end_date <= CURRENT_DATE) AS historical,
                    COUNT(*) FILTER (WHERE start_date > CURRENT_DATE) AS future
                FROM km_rule_transits
                GROUP BY rule_id
            """)
            rows = cur.fetchall()
        conn.close()
        return [
            {'rule_id': r[0], 'total': r[1], 'historical': r[2], 'future': r[3]}
            for r in rows
        ]
    except Exception as exc:
        raise HTTPException(500, f'Transit counts query failed: {exc}')


@app.post('/api/discovery/cancel')
def discovery_cancel():
    """Request cancellation of the currently running discovery job."""
    if not _discovery_state['running']:
        raise HTTPException(409, 'No discovery job is currently running')
    _discovery_state['cancel_requested'] = True
    return {'status': 'cancel_requested', 'job_id': _discovery_state['job_id']}


@app.post('/api/discovery/run-clean')
def discovery_run_clean(background_tasks: BackgroundTasks):
    """Delete ALL existing signals then run full discovery from scratch."""
    if _discovery_state['running']:
        raise HTTPException(409, 'A discovery job is already running')
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute('DELETE FROM km_rule_signals')
            deleted = cur.rowcount
        conn.commit()
        conn.close()
    except Exception as exc:
        raise HTTPException(500, f'Failed to clear signals: {exc}')
    job_id = str(uuid.uuid4())
    _discovery_state['job_id'] = job_id
    _discovery_state['running'] = True
    background_tasks.add_task(_run_discovery_bg, 'all')
    return {
        'job_id': job_id,
        'status': 'started',
        'message': f'Cleared {deleted:,} signals — full discovery started',
        'signals_deleted': deleted,
    }


@app.post('/api/discovery/rule/{rule_id}/drop-signals')
def discovery_drop_rule_signals(rule_id: int):
    """Delete all signals and transits for a single rule_id, resetting it for re-discovery."""
    if _discovery_state['running']:
        raise HTTPException(409, 'A discovery job is running — wait for it to finish before dropping signals')
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute('DELETE FROM km_rule_transits WHERE rule_id = %s', (rule_id,))
            transits_deleted = cur.rowcount
            cur.execute('DELETE FROM km_rule_signals WHERE rule_id = %s', (rule_id,))
            signals_deleted = cur.rowcount
            cur.execute('DELETE FROM km_rule_confidence WHERE rule_id = %s', (rule_id,))
        conn.commit()
        conn.close()
    except Exception as exc:
        raise HTTPException(500, f'Failed to drop signals for rule {rule_id}: {exc}')
    return {
        'rule_id': rule_id,
        'signals_deleted': signals_deleted,
        'transits_deleted': transits_deleted,
        'status': 'cleared',
    }


@app.get('/api/discovery/diagnose')
def discovery_diagnose():
    """
    Diagnostic endpoint — measures each phase of discovery initialization.
    Hit this to find out exactly where things are slow / failing.
    Returns timing for: DB connect, import, rule load, 1-rule test.
    """
    import time as _t
    report: dict = {}

    # 1. DB connect
    t0 = _t.monotonic()
    try:
        conn = _conn()
        report['db_connect_ms'] = round((_t.monotonic() - t0) * 1000)
        report['db_connect'] = 'ok'
    except Exception as exc:
        report['db_connect_ms'] = round((_t.monotonic() - t0) * 1000)
        report['db_connect'] = f'FAILED: {exc}'
        return report

    # 2. Import rule_discovery
    t0 = _t.monotonic()
    try:
        (discover_rule, load_vocabulary, build_vedh_map,
         get_panchak_nakshatras, should_group_transits,
         detect_transits, insert_transits) = _import_discover_rule()
        report['import_ms'] = round((_t.monotonic() - t0) * 1000)
        report['import'] = 'ok'
    except Exception as exc:
        report['import_ms'] = round((_t.monotonic() - t0) * 1000)
        report['import'] = f'FAILED: {exc}'
        conn.close()
        return report

    # 3. Load vocabulary
    t0 = _t.monotonic()
    try:
        vocab = load_vocabulary(conn)
        vedh_map = build_vedh_map(vocab['nakshatra_positions_names'])
        panchak_naks = get_panchak_nakshatras(vocab['nakshatra_positions_names'])
        report['vocab_ms'] = round((_t.monotonic() - t0) * 1000)
        report['vocab'] = f'ok — {len(vocab["nakshatra_positions_names"])} nakshatras'
    except Exception as exc:
        report['vocab_ms'] = round((_t.monotonic() - t0) * 1000)
        report['vocab'] = f'FAILED: {exc}'
        conn.close()
        return report

    # 4. Load rules
    t0 = _t.monotonic()
    try:
        rules = _load_rules_for_discovery(conn, 'all')
        report['rules_ms'] = round((_t.monotonic() - t0) * 1000)
        report['rules_count'] = len(rules)
        report['rules'] = 'ok'
    except Exception as exc:
        report['rules_ms'] = round((_t.monotonic() - t0) * 1000)
        report['rules'] = f'FAILED: {exc}'
        conn.close()
        return report

    # 5. Run 1 simple nakshatra_vara rule as a speed test
    test_rule = next((r for r in rules if r['rule_type'] == 'nakshatra_vara'), None)
    if test_rule:
        t0 = _t.monotonic()
        try:
            matched = discover_rule(conn, test_rule, vedh_map, panchak_naks, vocab)
            report['test_rule_ms'] = round((_t.monotonic() - t0) * 1000)
            report['test_rule'] = test_rule['rule_code']
            report['test_rule_matched'] = len(matched)
        except Exception as exc:
            report['test_rule_ms'] = round((_t.monotonic() - t0) * 1000)
            report['test_rule'] = f'FAILED: {exc}'
    else:
        report['test_rule'] = 'no nakshatra_vara rule found'

    conn.close()
    report['verdict'] = (
        'slow_db_connect' if report.get('db_connect_ms', 0) > 3000
        else 'slow_import' if report.get('import_ms', 0) > 2000
        else 'slow_vocab' if report.get('vocab_ms', 0) > 2000
        else 'slow_rules_load' if report.get('rules_ms', 0) > 2000
        else 'slow_per_rule' if report.get('test_rule_ms', 0) > 3000
        else 'ok'
    )
    return report


# ── Confidence scoring ────────────────────────────────────────────────────────

_confidence_state: dict = {
    'job_id':            None,
    'running':           False,
    'started_at':        None,
    'finished_at':       None,
    'signals_scored':    0,
    'rules_upserted':    0,
    'error':             None,
}


def _run_confidence_bg():
    """Background task: score km_rule_signals and upsert km_rule_confidence."""
    import json as _json  # noqa: PLC0415

    global _confidence_state

    if _confidence_state['running']:
        log.warning('Confidence scoring already running — ignoring duplicate request')
        return

    _confidence_state.update({
        'running':        True,
        'started_at':     datetime.utcnow().isoformat(),
        'finished_at':    None,
        'signals_scored': 0,
        'rules_upserted': 0,
        'error':          None,
    })

    try:
        from scripts.confidence_scoring import (  # noqa: PLC0415
            build_nifty_close_map,
            load_rule_outcome_map,
            update_transit_returns,
            populate_partial_day_flags,
            update_daily_signal_returns,
            compute_confidence_from_transits,
            compute_confidence_from_daily_signals,
            compute_yearly_breakdown,
            compute_yearly_breakdown_from_signals,
        )
    except Exception as exc:
        log.error(f'Confidence import failed: {exc}')
        _confidence_state.update({'running': False, 'finished_at': datetime.utcnow().isoformat(), 'error': str(exc)})
        return

    try:
        conn = _conn()
    except Exception as exc:
        log.error(f'Confidence DB connection failed: {exc}')
        _confidence_state.update({'running': False, 'finished_at': datetime.utcnow().isoformat(), 'error': str(exc)})
        return

    try:
        close_map = build_nifty_close_map(conn)
        rule_outcome_map = load_rule_outcome_map(conn)

        # Transit-based rules
        scored = update_transit_returns(conn, close_map, rule_outcome_map)

        # Daily-only rules (nakshatra_vara, tithi_alone, eclipse)
        populate_partial_day_flags(conn)
        daily_scored = update_daily_signal_returns(conn, close_map, rule_outcome_map)

        # Confidence aggregation
        upserted  = compute_confidence_from_transits(conn)
        upserted += compute_confidence_from_daily_signals(conn)
        compute_yearly_breakdown(conn)
        compute_yearly_breakdown_from_signals(conn)

        _confidence_state['signals_scored'] = scored + daily_scored
        _confidence_state['rules_upserted'] = upserted
        log.info(f'Confidence done — {scored} transits + {daily_scored} daily signals scored, '
                 f'{upserted} rules upserted')
    except Exception as exc:
        log.error(f'Confidence scoring failed: {exc}')
        _confidence_state['error'] = str(exc)
    finally:
        try:
            conn.close()
        except Exception:
            pass
        _confidence_state['running'] = False
        _confidence_state['finished_at'] = datetime.utcnow().isoformat()


@app.post('/api/confidence/compute')
def confidence_compute(background_tasks: BackgroundTasks):
    """Score all km_rule_signals against Nifty returns and upsert km_rule_confidence."""
    if _confidence_state['running']:
        raise HTTPException(409, 'Confidence scoring is already running')
    job_id = str(uuid.uuid4())
    _confidence_state['job_id'] = job_id
    background_tasks.add_task(_run_confidence_bg)
    return {'job_id': job_id, 'status': 'started', 'message': 'Confidence scoring started'}


@app.get('/api/confidence/status')
def confidence_status():
    """Return current or last confidence scoring job state."""
    return dict(_confidence_state)


@app.get('/api/confidence/summary')
def confidence_summary():
    """Return per-rule confidence scores joined with rule metadata. Ordered by confidence DESC."""
    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    r.id              AS rule_id,
                    r.rule_code,
                    r.display_name,
                    r.outcome,
                    r.rule_type,
                    c.total_occurrences,
                    c.matched_count,
                    c.confidence_score,
                    c.avg_return_all,
                    c.avg_return_matched,
                    c.avg_return_unmatched,
                    c.best_return,
                    c.worst_return,
                    c.avg_duration_days,
                    c.historical_transits,
                    c.last_computed_at
                FROM km_rule_confidence c
                JOIN km_astro_rule_master r ON c.rule_id = r.id
                ORDER BY c.confidence_score DESC NULLS LAST
            """)
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as exc:
        raise HTTPException(500, f'Confidence summary query failed: {exc}')


@app.get('/api/confidence/yearly/{rule_id}')
def confidence_yearly(rule_id: int):
    """Return year-by-year win-rate breakdown for a single rule."""
    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT year, transits, matched, win_pct, avg_return, avg_duration
                FROM km_rule_confidence_yearly
                WHERE rule_id = %s
                ORDER BY year DESC
            """, (rule_id,))
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as exc:
        raise HTTPException(500, f'Yearly confidence query failed: {exc}')


# ── MagicRS ───────────────────────────────────────────────────────────────────

def _rs_signal(long_zone: str | None, short_zone: str | None) -> str:
    long_positive  = 'Bull' in (long_zone  or '')
    short_positive = 'Bull' in (short_zone or '')
    if long_positive and short_positive:
        return 'Strong Alignment'
    elif not long_positive and short_positive:
        return 'Emerging Recovery'
    elif long_positive and not short_positive:
        return 'Tactical Pullback'
    else:
        return 'Negative Alignment'


_confluence_cache: dict | None = None  # cache busted on restart only

# NAK-VARA only, same-day NIFTY 50 (index_id=1) pct_chng.
# GROUP BY outcome × breadth_regime
_CONFLUENCE_BREADTH_SQL = """
    SELECT
        r.outcome,
        CASE WHEN b.breadth_score > 55 THEN 'Elevated'
             WHEN b.breadth_score > 35 THEN 'Moderate'
             ELSE 'Depressed' END                       AS breadth_regime,
        COUNT(*)                                         AS signal_count,
        ROUND(
            COUNT(*) FILTER (WHERE i.pct_chng > 0)::NUMERIC /
            NULLIF(COUNT(*), 0) * 100
        , 1)                                             AS positive_day_pct,
        ROUND(AVG(i.pct_chng)::NUMERIC, 2)              AS avg_day_return
    FROM  km_rule_signals       s
    JOIN  km_astro_rule_master  r  ON r.id  = s.rule_id
    JOIN  km_market_breadth     b  ON b.trade_date = s.date
    JOIN  km_breadth_roc        br ON br.trade_date = s.date
    JOIN  km_index_eod          i  ON i.trade_date  = s.date
                                  AND i.index_id    = 1
    WHERE r.rule_type = 'nakshatra_vara'
      AND r.outcome   IN ('bullish', 'bearish')
      AND i.pct_chng  IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1, 2
"""

# GROUP BY outcome × roc_regime
_CONFLUENCE_ROC_SQL = """
    SELECT
        r.outcome,
        CASE WHEN br.roc_13 > 1  THEN 'Expanding'
             WHEN br.roc_13 > 0  THEN 'Positive'
             WHEN br.roc_13 > -1 THEN 'Negative'
             ELSE 'Contracting' END                      AS roc_regime,
        COUNT(*)                                         AS signal_count,
        ROUND(
            COUNT(*) FILTER (WHERE i.pct_chng > 0)::NUMERIC /
            NULLIF(COUNT(*), 0) * 100
        , 1)                                             AS positive_day_pct,
        ROUND(AVG(i.pct_chng)::NUMERIC, 2)              AS avg_day_return
    FROM  km_rule_signals       s
    JOIN  km_astro_rule_master  r  ON r.id  = s.rule_id
    JOIN  km_market_breadth     b  ON b.trade_date = s.date
    JOIN  km_breadth_roc        br ON br.trade_date = s.date
    JOIN  km_index_eod          i  ON i.trade_date  = s.date
                                  AND i.index_id    = 1
    WHERE r.rule_type = 'nakshatra_vara'
      AND r.outcome   IN ('bullish', 'bearish')
      AND i.pct_chng  IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1, 2
"""


@app.get('/api/confluence/historical')
def confluence_historical():
    """
    NAK-VARA signals × same-day NIFTY 50 pct_chng, grouped into two
    2D matrices (outcome × breadth_regime, outcome × roc_regime).
    Returns { breadth_rows, roc_rows, total_signals }.
    Cached in-process (historical data is stable intraday).
    """
    global _confluence_cache
    if _confluence_cache is not None:
        return _confluence_cache

    try:
        breadth_rows = _db_query(_CONFLUENCE_BREADTH_SQL)
        roc_rows     = _db_query(_CONFLUENCE_ROC_SQL)
    except Exception as exc:
        log.error(f'confluence_historical error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))

    total = sum(int(r['signal_count']) for r in breadth_rows)

    result = {
        'breadth_rows':  [_stringify_dates(r) for r in breadth_rows],
        'roc_rows':      [_stringify_dates(r) for r in roc_rows],
        'total_signals': total,
    }
    _confluence_cache = result
    return result


# ── Confluence heatmap — today's conditions + matching 3-way pattern ──────────

def _breadth_regime(score: float) -> str:
    if score > 55: return 'Elevated'
    if score > 35: return 'Moderate'
    return 'Depressed'

def _roc_regime(roc: float) -> str:
    if roc > 1:  return 'Expanding'
    if roc > 0:  return 'Positive'
    if roc > -1: return 'Negative'
    return 'Contracting'

def _normalize_outcome(outcome: str) -> str | None:
    if outcome in ('strong_bullish', 'bullish', 'mild_bullish'): return 'bullish'
    if outcome in ('strong_bearish', 'bearish', 'mild_bearish'): return 'bearish'
    return None

_HEATMAP_PATTERN_SQL = """
    SELECT
        COUNT(*)                                              AS signal_count,
        ROUND(
            COUNT(*) FILTER (WHERE i.pct_chng > 0)::NUMERIC /
            NULLIF(COUNT(*), 0) * 100
        , 1)                                                  AS positive_day_pct,
        ROUND(AVG(i.pct_chng)::NUMERIC, 2)                   AS avg_day_return
    FROM  km_rule_signals       s
    JOIN  km_astro_rule_master  r  ON r.id  = s.rule_id
    JOIN  km_market_breadth     b  ON b.trade_date = s.date
    JOIN  km_breadth_roc        br ON br.trade_date = s.date
    JOIN  km_index_eod          i  ON i.trade_date  = s.date
                                  AND i.index_id    = 1
    WHERE r.rule_type = 'nakshatra_vara'
      AND i.pct_chng  IS NOT NULL
      AND CASE WHEN b.breadth_score > 55 THEN 'Elevated'
               WHEN b.breadth_score > 35 THEN 'Moderate'
               ELSE 'Depressed' END = %(breadth_regime)s
      AND CASE WHEN br.roc_13 > 1  THEN 'Expanding'
               WHEN br.roc_13 > 0  THEN 'Positive'
               WHEN br.roc_13 > -1 THEN 'Negative'
               ELSE 'Contracting' END = %(roc_regime)s
      AND CASE WHEN r.outcome IN ('strong_bullish','bullish','mild_bullish') THEN 'bullish'
               WHEN r.outcome IN ('strong_bearish','bearish','mild_bearish') THEN 'bearish'
               ELSE NULL END = %(nakvar_outcome)s
"""


@app.get('/api/confluence/heatmap')
def confluence_heatmap(date: str = None):
    """
    Returns today's market conditions (breadth, ROC, dominant nak-vara signal)
    plus the 3-way historical pattern for that combination.
    """
    tz_ist = __import__('zoneinfo').ZoneInfo('Asia/Kolkata')
    if not date:
        date = datetime.now(tz=tz_ist).strftime('%Y-%m-%d')

    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # 1. Today's breadth (exact date — shown in conditions panel, may be null on non-trading days)
            cur.execute(
                'SELECT breadth_score FROM km_market_breadth WHERE trade_date = %s', (date,)
            )
            brow = cur.fetchone()
            breadth_score = float(brow['breadth_score']) if brow else None
            b_regime      = _breadth_regime(breadth_score) if breadth_score is not None else None

            # 2. Today's ROC (exact date — shown in conditions panel, may be null on non-trading days)
            cur.execute(
                'SELECT roc_13, sma_breadth FROM km_breadth_roc WHERE trade_date = %s', (date,)
            )
            rrow = cur.fetchone()
            roc_13      = float(rrow['roc_13'])      if rrow and rrow['roc_13']      is not None else None
            sma_breadth = float(rrow['sma_breadth']) if rrow and rrow['sma_breadth'] is not None else None
            r_regime    = _roc_regime(roc_13) if roc_13 is not None else None

            # Crossover direction vs SMA
            if roc_13 is not None and sma_breadth is not None:
                roc_direction = ('accelerating' if roc_13 > sma_breadth else 'decelerating') if roc_13 > 0 \
                           else ('recovering'   if roc_13 > sma_breadth else 'deepening')
            else:
                roc_direction = None

            # 2b. Most recent breadth/ROC regime for the pattern lookup
            #     (uses latest available trading-day data — may differ from today on weekends/holidays)
            if b_regime is None:
                cur.execute(
                    'SELECT breadth_score FROM km_market_breadth WHERE trade_date < %s ORDER BY trade_date DESC LIMIT 1', (date,)
                )
                brow2 = cur.fetchone()
                b_regime_pattern = _breadth_regime(float(brow2['breadth_score'])) if brow2 else None
            else:
                b_regime_pattern = b_regime

            if r_regime is None:
                cur.execute(
                    'SELECT roc_13 FROM km_breadth_roc WHERE trade_date < %s ORDER BY trade_date DESC LIMIT 1', (date,)
                )
                rrow2 = cur.fetchone()
                r_regime_pattern = _roc_regime(float(rrow2['roc_13'])) if rrow2 and rrow2['roc_13'] is not None else None
            else:
                r_regime_pattern = r_regime

            # 3. Today's dominant nak-vara signal
            cur.execute("""
                SELECT r.rule_code, r.display_name AS rule_name, r.outcome,
                       s.strength, c.confidence_score, c.total_occurrences
                FROM  km_rule_signals      s
                JOIN  km_astro_rule_master r ON r.id = s.rule_id
                LEFT JOIN km_rule_confidence c ON c.rule_id = s.rule_id
                WHERE s.date = %s
                  AND r.rule_type = 'nakshatra_vara'
                  AND r.is_active = TRUE
                ORDER BY c.confidence_score DESC NULLS LAST, s.strength DESC
                LIMIT 1
            """, (date,))
            nrow = cur.fetchone()

            nakvar_outcome   = None
            nakvar_rule_code = None
            nakvar_rule_name = None
            nakvar_strength  = None
            nakvar_conf      = None
            if nrow:
                nakvar_outcome   = _normalize_outcome(nrow['outcome'] or '')
                nakvar_rule_code = nrow['rule_code']
                nakvar_rule_name = nrow['rule_name']
                nakvar_strength  = nrow['strength']
                nakvar_conf      = float(nrow['confidence_score']) if nrow['confidence_score'] else None

            # 4. Vara + nakshatra from panchang
            cur.execute(
                'SELECT vara, vara_lord, nakshatra_name, nakshatra_lord FROM km_daily_panchang WHERE date = %s',
                (date,)
            )
            prow = cur.fetchone()
            vara            = prow['vara']          if prow else None
            nakshatra_lord  = prow['nakshatra_lord'] if prow else None

            # 5. 3-way historical pattern — uses most-recent-available regime for breadth/ROC
            #    (conditions panel values may be null on weekends; pattern still runs off latest regime)
            pattern = None
            if b_regime_pattern and r_regime_pattern and nakvar_outcome:
                cur.execute(_HEATMAP_PATTERN_SQL, {
                    'breadth_regime': b_regime_pattern,
                    'roc_regime':     r_regime_pattern,
                    'nakvar_outcome': nakvar_outcome,
                })
                patt = cur.fetchone()
                if patt and patt['signal_count']:
                    pattern = {
                        'breadth_regime':   b_regime_pattern,
                        'roc_regime':       r_regime_pattern,
                        'nakvar_outcome':   nakvar_outcome,
                        'signal_count':     int(patt['signal_count']),
                        'positive_day_pct': float(patt['positive_day_pct']) if patt['positive_day_pct'] else None,
                        'avg_day_return':   float(patt['avg_day_return'])   if patt['avg_day_return']   else None,
                    }

        conn.close()
        return {
            'date': date,
            'conditions': {
                'breadth_score':    breadth_score,
                'breadth_regime':   b_regime,
                'roc_13':           roc_13,
                'sma_breadth':      sma_breadth,
                'roc_regime':       r_regime,
                'roc_direction':    roc_direction,
                'nakvar_outcome':   nakvar_outcome,
                'nakvar_rule_code': nakvar_rule_code,
                'nakvar_rule_name': nakvar_rule_name,
                'nakvar_strength':  nakvar_strength,
                'nakvar_conf':      nakvar_conf,
                'vara':             vara,
                'nakshatra_lord':   nakshatra_lord,
            },
            'pattern': pattern,
        }

    except Exception as exc:
        log.error(f'confluence_heatmap error for {date}: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
@app.get('/api/confluence/timeline')
def confluence_timeline(days: int = 30):
    """
    Returns the last N trading days with nak-vara signal, breadth score,
    ROC-13, and NIFTY 50 pct_chng — used by the day-by-day dot grid.
    """
    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    i.trade_date,
                    i.pct_chng          AS nifty_return,
                    b.breadth_score,
                    br.roc_13,
                    (
                        SELECT CASE
                                   WHEN r.outcome IN ('strong_bullish','bullish','mild_bullish') THEN 'bullish'
                                   WHEN r.outcome IN ('strong_bearish','bearish','mild_bearish') THEN 'bearish'
                                   ELSE NULL
                               END
                        FROM  km_rule_signals      s2
                        JOIN  km_astro_rule_master r  ON r.id = s2.rule_id
                        WHERE s2.date       = i.trade_date
                          AND r.rule_type   = 'nakshatra_vara'
                          AND r.is_active   = TRUE
                        ORDER BY s2.strength DESC
                        LIMIT 1
                    ) AS nakvar_outcome
                FROM  km_index_eod    i
                LEFT JOIN km_market_breadth b  ON b.trade_date  = i.trade_date
                LEFT JOIN km_breadth_roc    br ON br.trade_date = i.trade_date
                WHERE i.index_id  = 1
                  AND i.pct_chng IS NOT NULL
                ORDER BY i.trade_date DESC
                LIMIT %(days)s
            """, {'days': max(1, min(days, 120))})
            rows = cur.fetchall()
        conn.close()
        return [_stringify_dates(dict(r)) for r in reversed(rows)]
    except Exception as exc:
        log.error(f'confluence_timeline error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))


def equity_magic_rs(symbol: str, from_date: str = '2025-01-01'):
    """Return Long + Short MagicRS time-series for one equity symbol."""
    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT e.trade_date,
                       e.magic_rs, e.magic_ma, e.magic_rs_zone,
                       e.magic_rs_short, e.magic_rs_short_ma, e.magic_rs_short_zone
                FROM km_equity_eod e
                JOIN km_equity_symbols s ON s.id = e.equity_id
                WHERE s.symbol = %s
                  AND e.trade_date >= %s
                ORDER BY e.trade_date ASC
            """, (symbol, from_date))
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()

        if not rows:
            return {'symbol': symbol, 'data': [], 'latest': None}

        for r in rows:
            if hasattr(r['trade_date'], 'isoformat'):
                r['trade_date'] = r['trade_date'].isoformat()
            for k in ('magic_rs', 'magic_ma', 'magic_rs_short', 'magic_rs_short_ma'):
                if r[k] is not None:
                    r[k] = float(r[k])

        latest     = rows[-1]
        long_zone  = latest.get('magic_rs_zone')
        short_zone = latest.get('magic_rs_short_zone')

        return {
            'symbol': symbol,
            'data': rows,
            'latest': {
                'long_rs':    latest.get('magic_rs'),
                'long_ma':    latest.get('magic_ma'),
                'long_zone':  long_zone,
                'short_rs':   latest.get('magic_rs_short'),
                'short_ma':   latest.get('magic_rs_short_ma'),
                'short_zone': short_zone,
                'signal':     _rs_signal(long_zone, short_zone),
            },
        }
    except Exception as exc:
        raise HTTPException(500, f'Magic RS query failed: {exc}')


# ── VaNi Daily Interpretation ─────────────────────────────────────────────────

@app.post('/api/vani/daily')
def vani_daily(req: VaNiDailyRequest):
    """
    Generate a VaNi atmospheric reading for a given date.
    Builds a prompt from panchang + rule signal counts, then calls the configured
    LLM (AI_ENABLED path) or falls back to the local LLM at LLM_BASE_URL.
    Results are cached for VANI_CACHE_TTL_HOURS hours.
    """
    tz_ist = __import__('zoneinfo').ZoneInfo('Asia/Kolkata')
    date_str = req.date or datetime.now(tz=tz_ist).strftime('%Y-%m-%d')

    # Serve from cache if fresh
    if date_str in _vani_cache:
        cached = _vani_cache[date_str]
        if datetime.now() - cached['cached_at'] < timedelta(hours=_VANI_CACHE_TTL_HOURS):
            return {'date': date_str, 'interpretation': cached['text'], 'cached': True}

    # Fetch panchang + signal counts from DB
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT vara, vara_lord, nakshatra_name, nakshatra_lord,
                       tithi_name, yoga_name, paksha
                FROM km_daily_panchang
                WHERE date = %s
            """, (date_str,))
            panchang = cur.fetchone()

            cur.execute("""
                SELECT
                    COUNT(*)                                                              AS total,
                    COUNT(*) FILTER (WHERE r.outcome IN
                        ('strong_bullish','bullish','mild_bullish'))                     AS positive,
                    COUNT(*) FILTER (WHERE r.outcome IN
                        ('strong_bearish','bearish','mild_bearish'))                     AS negative
                FROM km_rule_signals s
                JOIN km_astro_rule_master r ON r.id = s.rule_id
                WHERE s.date = %s
                  AND r.is_active  = TRUE
                  AND r.is_deleted = FALSE
            """, (date_str,))
            sig_row = cur.fetchone()
    except Exception as e:
        log.error(f'vani_daily DB error for {date_str}: {e}')
        return {'date': date_str, 'interpretation': 'VaNi is unavailable at this time.', 'cached': False}
    finally:
        conn.close()

    if not panchang:
        return {'date': date_str, 'interpretation': 'No panchang data available for this date.', 'cached': False}

    vara, vara_lord, nak_name, nak_lord, tithi, yoga, paksha = panchang
    total    = int(sig_row[0]) if sig_row else 0
    positive = int(sig_row[1]) if sig_row else 0
    negative = int(sig_row[2]) if sig_row else 0

    user_msg = (
        f"Astronomical conditions for {date_str}:\n"
        f"Vara: {vara} (lord: {vara_lord})\n"
        f"Nakshatra: {nak_name} (lord: {nak_lord})\n"
        f"Tithi: {tithi} · {paksha} Paksha\n"
        f"Yoga: {yoga}\n\n"
        f"Rule signals today: {total} active\n"
        f"Breakdown: {positive} positive · {negative} negative\n\n"
        f"Generate a 3-4 sentence VaNi interpretation."
    )

    _t0 = time.monotonic()
    interpretation = _ai_complete(
        system=_VANI_SYSTEM_PROMPT, user=user_msg, max_tokens=300,
        temperature=0.4, no_think=True,
    )
    _latency = int((time.monotonic() - _t0) * 1000)

    log_id: str | None = None
    if interpretation:
        log_id = _log_interaction(
            product="dristiq",
            endpoint="/api/vani/daily",
            user_input=user_msg,
            llm_response=interpretation,
            system_prompt=_VANI_SYSTEM_PROMPT,
            context_payload={
                "vara": vara, "vara_lord": vara_lord,
                "nakshatra": nak_name, "nakshatra_lord": nak_lord,
                "tithi": tithi, "yoga": yoga, "paksha": paksha,
                "total_signals": total, "positive": positive, "negative": negative,
            },
            model_version=_AI_MODEL,
            latency_ms=_latency,
        )
    else:
        interpretation = 'VaNi is unavailable at this time.'

    _vani_cache[date_str] = {'text': interpretation, 'cached_at': datetime.now()}
    return {'date': date_str, 'interpretation': interpretation, 'cached': False, 'log_id': log_id}


# ── VaNi Intent System ────────────────────────────────────────────────────────

# Single system prompt for all /api/vani/ask calls.
# Gemma 2.8B hallucinates when given loose instructions — these absolute rules
# override whatever per-intent focus text is in vani_intents.py.
_VANI_ASK_SYSTEM = (
    "You are VaNi, an atmospheric intelligence narrator for DristiQ — "
    "a Vedic astronomical market intelligence platform for Indian traders.\n\n"
    "ABSOLUTE RULES — never violate these:\n"
    "1. ONLY use data explicitly provided in the user message below. Never invent, "
    "assume, or extrapolate any numbers, sector names, company names, planet positions, "
    "nakshatra names, percentages, or dates not explicitly stated.\n"
    "2. NEVER use these words: buy, sell, long, short, invest, recommend, predict, "
    "forecast, bullish, bearish, up, down, rise, fall, rally, correction, target.\n"
    "3. REPLACE directional words with: recorded, observed, historically associated, "
    "atmospheric conditions, noted correlation, registered.\n"
    "4. Write exactly 3-4 sentences. No lists. No bullet points. No headers.\n"
    "5. If any data field says N/A, missing, or unavailable — skip it entirely. "
    "Do not substitute or guess.\n"
    "6. End with one sentence referencing the macro backdrop using only transit "
    "data provided.\n"
    "7. If the provided data is insufficient to generate a meaningful response, "
    'output exactly: "Insufficient atmospheric data for this period."\n\n'
    "Tone: scholarly, calm, observational. Non-advisory. Educational only.\n"
    "Language: English with Sanskrit astronomical terms where they appear in the data."
)


def _wrap_vani_user_msg(user_msg: str) -> str:
    """Wrap every vani/ask user message with grounding delimiters."""
    return (
        "Narrate the following data only. "
        "Do not add anything not listed below.\n\n"
        "[DATA START]\n"
        + user_msg +
        "\n[DATA END]"
    )


@app.get('/api/vani/intents')
def vani_intents(page: str = 'dashboard'):
    """Return available intents for a given page, keyed for the frontend."""
    page_intents = _get_intents_for_page(page)
    return [
        {'intent_id': k, 'label': v.label, 'page': v.page}
        for k, v in page_intents.items()
    ]


@app.post('/api/vani/ask')
def vani_ask(req: VaNiAskRequest):
    """
    Execute a VaNi intent and return a natural-language response.

    Request:  { intent_id, date?, entity_type?, entity_id?, page_context? }
    Response: { intent_id, date, response, ai, cached, provider, error? }
    """
    tz_ist = __import__('zoneinfo').ZoneInfo('Asia/Kolkata')
    date_str = req.date or datetime.now(tz=tz_ist).strftime('%Y-%m-%d')
    intent_id = req.intent_id

    # Look up intent definition
    intent = _VANI_INTENTS.get(intent_id)
    if not intent:
        return {
            'intent_id': intent_id, 'date': date_str,
            'response': None, 'ai': False, 'cached': False,
            'provider': None, 'error': f'Unknown intent: {intent_id}',
        }

    # Cache check — key includes entity so different stocks don't collide
    cache_key = f'{intent_id}:{date_str}:{req.entity_id or ""}'
    cached_entry = _intent_cache.get(cache_key)
    if cached_entry:
        age_h = (datetime.now() - cached_entry['cached_at']).total_seconds() / 3600
        if age_h < intent.cache_ttl_hours:
            return {
                'intent_id': intent_id, 'date': date_str,
                'response': cached_entry['text'],
                'ai': True, 'cached': True,
                'provider': cached_entry.get('provider'),
            }

    # Assemble context + format user message based on intent page group
    db = _db()
    try:
        prefix = intent_id.split('.')[0]

        if prefix == 'dashboard':
            ctx = assemble_dashboard_context(db, date_str)
            user_msg = format_user_message(intent_id, ctx) if ctx else None

        elif prefix == 'astro_calendar':
            ctx = assemble_astro_calendar_context(db, date_str)
            user_msg = format_astro_user_message(intent_id, ctx) if ctx else None

        elif prefix == 'industry_transition':
            ctx = assemble_industry_transition_context(db, date_str)
            user_msg = format_industry_user_message(intent_id, ctx) if ctx else None

        elif prefix == 'equity':
            if not req.entity_id:
                return {
                    'intent_id': intent_id, 'date': date_str,
                    'response': None, 'ai': False, 'cached': False,
                    'provider': None, 'error': 'entity_id required for equity intents',
                }
            ctx = assemble_equity_context(
                db,
                entity_id=req.entity_id,
                page_context=req.page_context,
                target_date=date_str,
                entity_type=req.entity_type or 'equity',
            )
            user_msg = format_equity_user_message(intent_id, ctx) if ctx else None

        else:
            return {
                'intent_id': intent_id, 'date': date_str,
                'response': None, 'ai': False, 'cached': False,
                'provider': None, 'error': f'No assembler for intent prefix: {prefix}',
            }

    except Exception as e:
        log.error(f'vani_ask assembler error [{intent_id}]: {e}')
        return {
            'intent_id': intent_id, 'date': date_str,
            'response': None, 'ai': False, 'cached': False,
            'provider': None, 'error': 'Context assembly failed',
        }

    if not user_msg:
        return {
            'intent_id': intent_id, 'date': date_str,
            'response': None, 'ai': False, 'cached': False,
            'provider': None, 'error': 'No data available for this date',
        }

    # Call LLM — use the single anti-hallucination system prompt for all intents;
    # wrap user_msg with grounding delimiters so the model can't drift outside the data.
    provider = os.getenv('AI_PROVIDER', 'local')
    _wrapped_msg = _wrap_vani_user_msg(user_msg)
    _t0 = time.monotonic()
    response_text = _ai_complete(
        system=_VANI_ASK_SYSTEM,
        user=_wrapped_msg,
        max_tokens=intent.max_tokens,
        temperature=0.4,
        no_think=True,
    )
    _latency = int((time.monotonic() - _t0) * 1000)

    if not response_text:
        return {
            'intent_id': intent_id, 'date': date_str,
            'response': None, 'ai': False, 'cached': False,
            'provider': None, 'error': 'LLM unavailable',
        }

    log_id = _log_interaction(
        product="dristiq",
        endpoint="/api/vani/ask",
        user_input=_wrapped_msg,
        llm_response=response_text,
        system_prompt=_VANI_ASK_SYSTEM,
        context_payload=ctx if isinstance(ctx, dict) else None,
        model_version=_AI_MODEL,
        latency_ms=_latency,
    )

    _intent_cache[cache_key] = {
        'text': response_text,
        'cached_at': datetime.now(),
        'provider': provider,
    }
    return {
        'intent_id': intent_id, 'date': date_str,
        'response': response_text,
        'ai': True, 'cached': False,
        'provider': provider,
        'log_id': log_id,
    }


@app.delete('/api/vani/cache')
def vani_cache_clear(intent_id: str):
    """Admin: clear cached response for a specific intent (all dates/entities)."""
    removed = [k for k in list(_intent_cache.keys()) if k.startswith(f'{intent_id}:')]
    for k in removed:
        del _intent_cache[k]
    return {'cleared': len(removed), 'intent_id': intent_id}


@app.post('/api/vani/feedback')
def vani_feedback(req: VaNiFeedbackRequest):
    """Record a thumbs up/down rating for a logged VaNi interaction."""
    if req.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="rating must be 1 or -1")
    vani_db_url = os.getenv('VANI_DB_URL', '')
    if not vani_db_url:
        return {'ok': False, 'error': 'VANI_DB_URL not configured'}
    try:
        conn = psycopg2.connect(vani_db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE vn_interaction_log SET user_rating = %s WHERE id = %s::uuid",
                    (req.rating, req.log_id),
                )
        conn.close()
        return {'ok': True}
    except Exception as e:
        log.error(f'vani_feedback error: {e}')
        return {'ok': False}



# ── User Frameworks ───────────────────────────────────────────────────────────

class FrameworkUpdateRequest(BaseModel):
    name: str | None = None
    instruments: list[str] | None = None
    blocks: list[dict] | None = None
    chart_overlays: list[dict] | None = None
    template_id: str | None = None
    tier_at_creation: str | None = None


def _framework_conn():
    db_url = DATABASE_URL
    if not db_url:
        raise HTTPException(status_code=500, detail='DATABASE_URL not configured')
    return psycopg2.connect(db_url)


def _set_user_context(cur, user_id: str) -> None:
    """Set request.jwt.claims so the RLS policy passes for direct psycopg2 connections.

    The user_frameworks RLS policy checks:
      current_setting('request.jwt.claims', true)::json->>'sub'
    PostgREST sets this automatically; direct connections must set it manually.
    """
    cur.execute(
        "SELECT set_config('request.jwt.claims', %s, true)",
        (json.dumps({'sub': user_id}),),
    )


@app.get('/api/framework/{user_id}')
def get_framework(
    user_id: str,
    caller_id: str = Depends(_get_current_user_id),
):
    """Fetch the user's framework. Creates a default empty one if none exists."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _framework_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _set_user_context(cur, user_id)
            cur.execute(
                'SELECT * FROM user_frameworks WHERE user_id = %s::uuid LIMIT 1',
                (user_id,),
            )
            row = cur.fetchone()

            if row is None:
                # Create default framework for new user
                cur.execute(
                    """
                    INSERT INTO user_frameworks (user_id, name, instruments, blocks, chart_overlays)
                    VALUES (%s::uuid, 'My Framework', ARRAY['NIFTY50'], '[]', '[]')
                    RETURNING *
                    """,
                    (user_id,),
                )
                conn.commit()
                row = cur.fetchone()

            # Join current tier from km_profiles
            cur.execute(
                'SELECT tier FROM km_profiles WHERE id = %s::uuid LIMIT 1',
                (user_id,),
            )
            profile_row = cur.fetchone()
            result = dict(row)
            result['tier'] = profile_row['tier'] if profile_row else 'free'
        return result
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f'get_framework error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@app.post('/api/framework/{user_id}')
def create_framework(
    user_id: str,
    req: FrameworkUpdateRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    """Explicitly create a new framework (replaces any existing one)."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _framework_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _set_user_context(cur, user_id)
            cur.execute(
                """
                INSERT INTO user_frameworks
                  (user_id, name, instruments, blocks, chart_overlays, template_id, tier_at_creation)
                VALUES
                  (%s::uuid, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING *
                """,
                (
                    user_id,
                    req.name or 'My Framework',
                    req.instruments or ['NIFTY50'],
                    json.dumps(req.blocks or []),
                    json.dumps(req.chart_overlays or []),
                    req.template_id,
                    req.tier_at_creation or 'free',
                ),
            )
            conn.commit()
            row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=409, detail='Framework already exists')
        return dict(row)
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f'create_framework error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@app.put('/api/framework/{user_id}')
def update_framework(
    user_id: str,
    req: FrameworkUpdateRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    """Full update (auto-save). Server increments version and sets updated_at."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _framework_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _set_user_context(cur, user_id)
            updates = []
            params: list = []

            if req.name is not None:
                updates.append('name = %s')
                params.append(req.name)
            if req.instruments is not None:
                updates.append('instruments = %s')
                params.append(req.instruments)
            if req.blocks is not None:
                updates.append('blocks = %s')
                params.append(json.dumps(req.blocks))
            if req.chart_overlays is not None:
                updates.append('chart_overlays = %s')
                params.append(json.dumps(req.chart_overlays))
            if req.template_id is not None:
                updates.append('template_id = %s')
                params.append(req.template_id)
            if req.tier_at_creation is not None:
                updates.append('tier_at_creation = %s')
                params.append(req.tier_at_creation)

            if not updates:
                raise HTTPException(status_code=400, detail='No fields to update')

            # version and updated_at always server-controlled
            updates += ['version = version + 1', 'updated_at = NOW()']
            params.append(user_id)

            cur.execute(
                f"UPDATE user_frameworks SET {', '.join(updates)} WHERE user_id = %s::uuid RETURNING *",
                params,
            )
            conn.commit()
            row = cur.fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail='Framework not found')
        return dict(row)
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f'update_framework error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# /api/correlation/compute
# ──────────────────────────────────────────────────────────────────────────────

class CorrelationRequest(BaseModel):
    item_a: str
    item_b: str
    benchmark: str = 'NIFTY50'  # NIFTY50 | BANKNIFTY | NIFTY500


_BENCHMARK_NAMES: dict[str, str] = {
    'NIFTY50':   'NIFTY 50',
    'BANKNIFTY': 'NIFTY BANK',
    'NIFTY500':  'NIFTY 500',
}

# Indicator items that live as columns in km_index_eod
_INDICATOR_COLS: dict[str, str] = {
    'ema_20':   'ema_20',
    'ema_60':   'ema_60',
    'sma_50':   'sma_50',
    'sma_150':  'sma_150',
    'sma_200':  'sma_200',
    'rsi_14':   'rsi_14',
    'supertrend': 'supertrend_dir',
}

# State label for EVENT_IN_STATE shape — what was the indicator doing at overlap start?
def _get_indicator_state(item_id: str, start_date, index_id: int, conn) -> str:
    try:
        with conn.cursor() as cur:
            if item_id == 'magic_rs':
                cur.execute(
                    "SELECT magic_rs_zone FROM km_index_eod WHERE index_id=%s AND trade_date<=%s ORDER BY trade_date DESC LIMIT 1",
                    (index_id, start_date))
                row = cur.fetchone()
                return row[0] if row and row[0] else 'Unknown'
            elif item_id == 'order_flow':
                cur.execute(
                    "SELECT flow_type FROM km_index_eod WHERE index_id=%s AND trade_date<=%s ORDER BY trade_date DESC LIMIT 1",
                    (index_id, start_date))
                row = cur.fetchone()
                return row[0].replace('_', ' ').title() if row and row[0] else 'Unknown'
            elif item_id == 'smart_money':
                cur.execute(
                    "SELECT sniper_inst FROM km_index_eod WHERE index_id=%s AND trade_date<=%s ORDER BY trade_date DESC LIMIT 1",
                    (index_id, start_date))
                row = cur.fetchone()
                if not row or row[0] is None: return 'Unknown'
                v = float(row[0])
                return 'High' if v > 0.7 else 'Medium' if v > 0.3 else 'Low'
            elif item_id == 'breadth_roc':
                cur.execute(
                    "SELECT roc_13 FROM km_breadth_roc WHERE trade_date<=%s ORDER BY trade_date DESC LIMIT 1",
                    (start_date,))
                row = cur.fetchone()
                if not row or row[0] is None: return 'Unknown'
                return 'Rising' if float(row[0]) > 0 else 'Falling'
    except Exception:
        pass
    return 'Unknown'


def _classify_shape(item_a: str, item_b: str) -> str:
    def is_event(x):
        return x.startswith('astro_rule:')
    def is_threshold(x):
        return x in ('rsi_14', 'rsi_9')
    def is_zone(x):
        return x in ('magic_rs', 'order_flow', 'smart_money', 'breadth_roc')

    if is_event(item_a) and is_event(item_b):
        return 'EVENT_OVERLAP'
    if (is_event(item_a) and is_threshold(item_b)) or (is_event(item_b) and is_threshold(item_a)):
        return 'THRESHOLD_CROSS'
    if (is_event(item_a) and is_zone(item_b)) or (is_event(item_b) and is_zone(item_a)):
        return 'EVENT_IN_STATE'
    return 'ZONE_CONFLUENCE'


def _dates_to_ranges(dates: list) -> list[tuple]:
    """Group individual dates into (start, end) tuples for consecutive trading-day runs."""
    if not dates:
        return []
    ranges, start, prev = [], dates[0], dates[0]
    for d in dates[1:]:
        if (d - prev).days <= 5:   # allow weekend gaps
            prev = d
        else:
            ranges.append((start, prev))
            start = prev = d
    ranges.append((start, prev))
    return ranges


def _get_astro_ranges(rule_code: str, conn) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT t.start_date, t.end_date
            FROM km_rule_transits t
            JOIN km_astro_rule_master r ON r.id = t.rule_id
            WHERE r.rule_code = %s
            ORDER BY t.start_date
        """, (rule_code,))
        return [(r[0], r[1]) for r in cur.fetchall()]


def _get_indicator_ranges(item_id: str, index_id: int, conn) -> list[tuple]:
    col = _INDICATOR_COLS.get(item_id)
    if item_id in ('ema_20', 'ema_60', 'sma_50', 'sma_150', 'sma_200'):
        sql = f"SELECT trade_date FROM km_index_eod WHERE index_id=%s AND {col} IS NOT NULL AND close > {col} ORDER BY trade_date"
    elif item_id == 'rsi_14':
        sql = "SELECT trade_date FROM km_index_eod WHERE index_id=%s AND rsi_14 IS NOT NULL AND (rsi_14 > 65 OR rsi_14 < 35) ORDER BY trade_date"
    elif item_id == 'supertrend':
        sql = "SELECT trade_date FROM km_index_eod WHERE index_id=%s AND supertrend_dir IS NOT NULL AND supertrend_dir > 0 ORDER BY trade_date"
    # Zone items — active when in a directional / strong state
    elif item_id == 'magic_rs':
        sql = "SELECT trade_date FROM km_index_eod WHERE index_id=%s AND magic_rs IS NOT NULL ORDER BY trade_date"
    elif item_id == 'order_flow':
        sql = "SELECT trade_date FROM km_index_eod WHERE index_id=%s AND flow_type IS NOT NULL ORDER BY trade_date"
    elif item_id == 'smart_money':
        sql = "SELECT trade_date FROM km_index_eod WHERE index_id=%s AND sniper_inst IS NOT NULL ORDER BY trade_date"
    elif item_id == 'breadth_roc':
        sql = "SELECT trade_date FROM km_breadth_roc WHERE trade_date IN (SELECT trade_date FROM km_index_eod WHERE index_id=%s) AND roc_13 > 0 ORDER BY trade_date"
    elif col:
        sql = f"SELECT trade_date FROM km_index_eod WHERE index_id=%s AND {col} IS NOT NULL ORDER BY trade_date"
    else:
        return []
    with conn.cursor() as cur:
        cur.execute(sql, (index_id,))
        return _dates_to_ranges([r[0] for r in cur.fetchall()])


def _find_overlaps(ranges_a: list[tuple], ranges_b: list[tuple]) -> list[tuple]:
    result = []
    for a_s, a_e in ranges_a:
        for b_s, b_e in ranges_b:
            s = max(a_s, b_s)
            e = min(a_e, b_e)
            if s <= e:
                result.append((s, e))
    return result


@app.post('/api/correlation/compute')
def correlation_compute(body: CorrelationRequest, _uid: str = Depends(_get_current_user_id)):
    benchmark_name = _BENCHMARK_NAMES.get(body.benchmark, 'NIFTY 50')
    conn = _conn(15000)
    try:
        # ── Resolve benchmark index id ──────────────────────────────────────
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM km_index_symbols WHERE name=%s LIMIT 1", (benchmark_name,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(400, f'Benchmark not found: {benchmark_name}')
            bm_id = row[0]

        # ── Fetch all benchmark closes ordered by date ──────────────────────
        with conn.cursor() as cur:
            cur.execute(
                "SELECT trade_date, close FROM km_index_eod WHERE index_id=%s AND close IS NOT NULL ORDER BY trade_date",
                (bm_id,)
            )
            rows = cur.fetchall()
        date_list   = [r[0] for r in rows]
        price_map   = {r[0]: float(r[1]) for r in rows}
        date_index  = {d: i for i, d in enumerate(date_list)}

        def _fwd_return(start: date, n: int) -> float | None:
            idx = date_index.get(start)
            if idx is None:
                return None
            # find nearest trading day on or after start
            closest = next((date_index[date_list[j]] for j in range(idx, min(idx+3, len(date_list)))
                            if date_list[j] >= start), idx)
            fwd_idx = closest + n
            if fwd_idx >= len(date_list):
                return None
            start_close = price_map.get(date_list[closest])
            end_close   = price_map.get(date_list[fwd_idx])
            if not start_close or not end_close:
                return None
            return round((end_close - start_close) / start_close * 100, 4)

        # ── Get active ranges for each item ────────────────────────────────
        def get_ranges(item_id: str) -> list[tuple]:
            if item_id.startswith('astro_rule:'):
                rc = item_id[len('astro_rule:'):]
                return _get_astro_ranges(rc, conn)
            return _get_indicator_ranges(item_id, bm_id, conn)

        ranges_a = get_ranges(body.item_a)
        ranges_b = get_ranges(body.item_b)
        overlaps  = _find_overlaps(ranges_a, ranges_b)

        if len(overlaps) < 3:
            return {'insufficient_data': True, 'n_instances': len(overlaps)}

        # ── Compute returns for each overlap ────────────────────────────────
        today = date.today()
        shape = _classify_shape(body.item_a, body.item_b)
        # Identify which item is the zone indicator (for EVENT_IN_STATE state labels)
        zone_item = body.item_b if body.item_a.startswith('astro_rule:') else body.item_a
        instances, bullish, bearish = [], 0, 0
        ret5_sum = ret22_sum = ret5_cnt = ret22_cnt = 0.0

        for s, e in overlaps:
            r5  = _fwd_return(s, 5)
            r22 = _fwd_return(s, 22)
            dur = (e - s).days + 1
            inst = {
                'start_date':    str(s),
                'end_date':      str(e),
                'duration_days': dur,
                'return_5d':     r5,
                'return_22d':    r22,
            }
            if shape == 'EVENT_IN_STATE':
                inst['state'] = _get_indicator_state(zone_item, s, bm_id, conn)
            instances.append(inst)
            if r5 is not None:
                if r5 > 0: bullish += 1
                else:       bearish += 1
                ret5_sum  += r5;  ret5_cnt  += 1
            if r22 is not None:
                ret22_sum += r22; ret22_cnt += 1

        # Sort newest first
        instances.sort(key=lambda x: x['start_date'], reverse=True)

        # Currently active: is today inside any overlap range?
        currently_active = any(s <= today <= e for s, e in overlaps)

        # ── Data quality metrics ──────────────────────────────────────────
        # days_covered = trading days with valid close data (date_list is already
        #   filtered by close IS NOT NULL, so this is the clean day count)
        # days_total   = all rows for this benchmark regardless of NULL close
        # coverage_pct = what fraction of benchmark history has usable EOD data
        days_covered = len(date_list)
        date_from    = str(date_list[0])  if date_list else ''
        date_to      = str(date_list[-1]) if date_list else ''
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM km_index_eod WHERE index_id=%s",
                (bm_id,)
            )
            days_total = cur.fetchone()[0]
        coverage_pct = round((days_covered / days_total * 100), 2) if days_total else 0.0

        return {
            'shape':           shape,
            'n_instances':     len(overlaps),
            'bearish_count':   bearish,
            'bullish_count':   bullish,
            'avg_return_5d':   round(ret5_sum  / ret5_cnt,  4) if ret5_cnt  else 0,
            'avg_return_22d':  round(ret22_sum / ret22_cnt, 4) if ret22_cnt else 0,
            'currently_active': currently_active,
            'instances':       instances,
            'coverage_pct':    coverage_pct,
            'days_covered':    days_covered,
            'days_total':      days_total,
            'date_from':       date_from,
            'date_to':         date_to,
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f'correlation_compute error: {exc}')
        raise HTTPException(500, str(exc))
    finally:
        conn.close()


# ── Payments (Razorpay) ────────────────────────────────────────────────────────

RAZORPAY_KEY_ID     = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')

TIER_AMOUNTS_PAISE = {
    'trial':     19900,   # ₹199
    'quarterly': 199900,  # ₹1,999
    'annual':    499900,  # ₹4,999
}

class CreateOrderRequest(BaseModel):
    tier:    str
    user_id: str

class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id:   str
    razorpay_signature:  str


@app.post('/api/payments/create-order')
def payments_create_order(
    req: CreateOrderRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    if caller_id != req.user_id:
        raise HTTPException(status_code=403, detail='Forbidden')
    if req.tier not in TIER_AMOUNTS_PAISE:
        raise HTTPException(status_code=400, detail=f'Unknown tier: {req.tier}')
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail='Payment gateway not configured')

    try:
        import razorpay as _rzp  # type: ignore
        client = _rzp.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order  = client.order.create({
            'amount':   TIER_AMOUNTS_PAISE[req.tier],
            'currency': 'INR',
            'notes':    {'tier': req.tier, 'user_id': req.user_id},
        })
        return {
            'order_id': order['id'],
            'amount':   order['amount'],
            'currency': order['currency'],
        }
    except ImportError:
        raise HTTPException(status_code=503, detail='razorpay SDK not installed — run pip install razorpay')
    except Exception as exc:
        log.error(f'payments_create_order error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))


@app.post('/api/payments/verify')
def payments_verify(
    req: VerifyPaymentRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail='Payment gateway not configured')

    try:
        import razorpay as _rzp  # type: ignore
        import hmac as _hmac, hashlib as _hashlib

        # Verify signature
        body       = f'{req.razorpay_order_id}|{req.razorpay_payment_id}'.encode()
        expected   = _hmac.new(RAZORPAY_KEY_SECRET.encode(), body, _hashlib.sha256).hexdigest()
        if not _hmac.compare_digest(expected, req.razorpay_signature):
            raise HTTPException(status_code=400, detail='Invalid payment signature')

        # Fetch order from Razorpay to get tier from notes
        client = _rzp.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order  = client.order.fetch(req.razorpay_order_id)
        tier   = order.get('notes', {}).get('tier', 'trial')
        user_id = order.get('notes', {}).get('user_id', caller_id)

        # Determine expires_at based on tier
        from datetime import timedelta
        tier_durations = {'trial': 3, 'quarterly': 90, 'annual': 365}
        days_valid     = tier_durations.get(tier, 3)
        expires_at     = datetime.utcnow() + timedelta(days=days_valid)

        # Upgrade km_profiles.tier + insert user_subscriptions row
        conn = _conn(5000)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE km_profiles SET tier = %s, updated_at = now() WHERE id = %s::uuid",
                    (tier, user_id),
                )
                cur.execute(
                    """
                    INSERT INTO user_subscriptions (user_id, tier, started_at, expires_at)
                    VALUES (%s::uuid, %s, now(), %s)
                    """,
                    (user_id, tier, expires_at),
                )
                conn.commit()
        finally:
            conn.close()

        return {'tier': tier, 'expires_at': expires_at.isoformat()}

    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(status_code=503, detail='razorpay SDK not installed — run pip install razorpay')
    except Exception as exc:
        log.error(f'payments_verify error: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
