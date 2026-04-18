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
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Make sibling modules importable whether launched via uvicorn or python.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from lib.config import DATABASE_URL  # noqa: E402

from pipeline2 import health as v2_health  # noqa: E402
from pipeline2 import scheduler as v2_scheduler  # noqa: E402
from pipeline2.handlers import KNOWN_DIMENSIONS  # noqa: E402
from pipeline2.health import label_for as _label_for  # noqa: E402


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler, _worker_process

    log.info('pipeline2 API starting')

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
    job_id: int


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get('/api/pipeline2/health')
def get_health(days: int = 30):
    """Ground-truth fill-rate grid across all dimensions.

    `days` is clamped to 7..90 to keep payloads predictable.
    """
    days = min(max(days, 7), 90)
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
                f"       created_at, started_at, completed_at, created_by "
                f"FROM km_jobs {where_sql} "
                f"ORDER BY created_at DESC LIMIT %s",
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
        if j.get('trade_date'):
            j['trade_date'] = str(j['trade_date'])
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


@app.post('/api/pipeline2/cancel')
def cancel_job(req: CancelRequest):
    """Mark a running/queued job cancelled. Worker will observe and stop."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE km_jobs SET status = 'cancelled', completed_at = now() "
                "WHERE id = %s AND status IN ('queued', 'running') RETURNING id",
                [req.job_id],
            )
            row = cur.fetchone()
        conn.commit()
        if not row:
            raise HTTPException(404, f'Job {req.job_id} not queued or running')
        return {'job_id': req.job_id, 'status': 'cancelled'}
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
                'ok_threshold': v2_health.ok_threshold_for(dim),
            }
            for dim in KNOWN_DIMENSIONS
        ],
    }


@app.get('/api/pipeline2/scheduler')
def scheduler_info():
    """Next scheduled daily_run time."""
    return {
        'active': _scheduler is not None and _scheduler.running,
        'next_run': v2_scheduler.next_run_time(_scheduler),
        'trigger': '18:00 IST (Mon-Fri)',
    }


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
