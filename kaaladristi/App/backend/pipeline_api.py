"""
Kāla-Drishti Pipeline API — FastAPI Sidecar
=============================================
Production-grade HTTP API for the data pipeline.

Exposes endpoints for:
  - Triggering pipeline runs (single date / backfill)
  - Checking pipeline status and health
  - Managing Breeze sessions
  - Auto-scheduling daily runs at 6 PM IST

Run:
  uvicorn pipeline_api:app --host 0.0.0.0 --port 8100 --workers 1

Docker:
  CMD ["uvicorn", "pipeline_api:app", "--host", "0.0.0.0", "--port", "8100"]
"""

import os
import sys
import json
import uuid
import logging
from datetime import date, datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional
from threading import Thread

# Add backend dir to path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from lib.db_client import get_db
from lib.breeze_client import init_breeze, get_login_url
from lib.ai_prompts import SKILLS as _AI_SKILLS
from lib.ai_client import complete as _ai_complete, AI_ENABLED as _AI_ENABLED
from pipeline.utils.trading_calendar import (
    is_weekend, is_trading_day, is_already_completed,
    mark_day_status, get_missing_dates, last_trading_day,
)

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('pipeline-api')

# ── Global State ──────────────────────────────────────────────────────────────

db = None
scheduler = None
active_jobs: dict[str, dict] = {}  # job_id → {status, started_at, exchange, dates, ...}

IST = pytz.timezone('Asia/Kolkata')

# ── Pydantic Models ───────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    date: Optional[str] = None       # YYYY-MM-DD, default: last trading day
    exchange: str = 'ALL'            # NSE / BSE / ALL
    force: bool = False              # re-run even if already completed

class BackfillRequest(BaseModel):
    date_from: str                   # YYYY-MM-DD
    date_to: str                     # YYYY-MM-DD
    exchange: str = 'ALL'

class BreezeConnectRequest(BaseModel):
    session_token: str

class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

# ── Pipeline Runner (background thread) ───────────────────────────────────────

def _run_pipeline_dates(job_id: str, dates: list[date], exchange: str,
                        skip_indicators: bool = False, force: bool = False):
    """Run the pipeline for a list of dates. Executed in background thread."""
    global db

    from daily_pipeline import run_nse_pipeline, run_bse_pipeline

    active_jobs[job_id]['status'] = 'running'
    success = 0
    failed = 0

    for d in dates:
        try:
            if exchange in ('NSE', 'ALL'):
                ok = run_nse_pipeline(db, d, skip_indicators=skip_indicators, force=force)
                if ok:
                    success += 1
                else:
                    failed += 1

            if exchange in ('BSE', 'ALL'):
                ok = run_bse_pipeline(db, d, skip_indicators=skip_indicators, force=force)
                if ok:
                    success += 1
                else:
                    failed += 1
        except Exception as e:
            log.error(f'Pipeline error for {d}: {e}')
            failed += 1

    active_jobs[job_id].update({
        'status': 'completed',
        'completed_at': datetime.utcnow().isoformat(),
        'success': success,
        'failed': failed,
    })
    log.info(f'Job {job_id}: completed — {success} success, {failed} failed')

    if success > 0:
        _refresh_market_breadth()
        _refresh_breadth_roc()


def _refresh_breadth_roc():
    """Recompute ROC breadth for missing dates after EOD data loads."""
    try:
        from compute_breadth_roc import load_closes, compute_roc, upsert
        import psycopg2 as _pg
        from lib.config import DATABASE_URL
        if not DATABASE_URL:
            return
        conn = _pg.connect(DATABASE_URL)
        try:
            closes = load_closes(conn)
            df     = compute_roc(closes)
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_breadth_roc')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]
            if df.empty:
                log.info('breadth_roc: no new dates to compute')
                return
            n = upsert(conn, df, dry_run=False)
            log.info(f'breadth_roc: {n} dates upserted')
        finally:
            conn.close()
    except Exception as e:
        log.warning(f'breadth_roc refresh failed (non-fatal): {e}')


def _refresh_market_breadth():
    """
    Recompute market breadth scores for any missing dates after EOD data loads.
    Runs compute_market_breadth.py in-process (missing dates only — fast daily incremental).
    """
    try:
        from compute_market_breadth import load_closes, compute_breadth, upsert
        import psycopg2 as _pg
        from lib.config import DATABASE_URL
        if not DATABASE_URL:
            log.warning('breadth refresh skipped — DATABASE_URL not set')
            return
        conn = _pg.connect(DATABASE_URL)
        try:
            closes = load_closes(conn)
            df     = compute_breadth(closes)
            # Missing dates only
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_market_breadth')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]
            if df.empty:
                log.info('breadth: no new dates to compute')
                return
            n = upsert(conn, df, dry_run=False)
            log.info(f'breadth: {n} dates upserted')
        finally:
            conn.close()
    except Exception as e:
        log.warning(f'breadth refresh failed (non-fatal): {e}')


def _scheduled_daily_run():
    """Called by APScheduler at 6 PM IST Mon-Fri."""
    log.info('Scheduled daily pipeline starting...')
    target = last_trading_day()

    if is_already_completed(db, target, 'NSE') and is_already_completed(db, target, 'BSE'):
        log.info(f'{target} already completed, skipping scheduled run')
        return

    job_id = f'scheduled-{target}'
    active_jobs[job_id] = {
        'status': 'queued',
        'started_at': datetime.utcnow().isoformat(),
        'exchange': 'ALL',
        'dates': [str(target)],
        'type': 'scheduled',
    }

    _run_pipeline_dates(job_id, [target], 'ALL')


# ── App Lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, scheduler, _worker_process

    log.info('Pipeline API starting...')
    db = get_db()

    # Start scheduler
    scheduler = BackgroundScheduler(timezone=IST)
    scheduler.add_job(
        _scheduled_daily_run,
        trigger=CronTrigger(hour=18, minute=0, day_of_week='mon-fri', timezone=IST),
        id='daily_pipeline',
        name='Daily EOD Pipeline (6:00 PM IST)',
        replace_existing=True,
    )
    scheduler.start()
    log.info('Scheduler started — daily pipeline at 6:00 PM IST (Mon-Fri)')

    next_run = scheduler.get_job('daily_pipeline').next_run_time
    log.info(f'Next scheduled run: {next_run}')

    # Start worker process automatically
    import subprocess
    worker_path = os.path.join(script_dir, 'worker.py')
    _worker_process = subprocess.Popen(
        [sys.executable, worker_path, '--watch'],
        cwd=script_dir,
    )
    log.info(f'Worker process started (PID: {_worker_process.pid})')

    yield

    log.info('Shutting down...')
    scheduler.shutdown(wait=False)
    if _worker_process and _worker_process.poll() is None:
        _worker_process.terminate()
        _worker_process.wait(timeout=5)
        log.info('Worker process stopped')


_worker_process = None


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title='Kāla-Drishti Pipeline API',
    version='1.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # Tighten in production
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get('/api/pipeline/health-checks')
def health_checks(days: int = 60):
    """Return N-day heatmap data for all data health dimensions."""
    from lib.health_checks import run_all_health_checks
    days = min(max(days, 30), 365)  # clamp to 30-365
    return run_all_health_checks(db, days=days)


@app.get('/api/ai/data-health-insight')
def data_health_insight(days: int = 60):
    """VaNi insight on data pipeline health — actionable fix guidance."""
    if not _AI_ENABLED:
        return {"insight": None, "ai": False}

    days = min(max(days, 30), 365)
    cache_key = f"health_insight:{days}"
    if cache_key in _insight_cache:
        return {"insight": _insight_cache[cache_key], "ai": True}

    from lib.health_checks import run_all_health_checks
    checks = run_all_health_checks(db, days=days)

    # Build summary for VaNi
    lines = [f"Data Health Summary — {days} trading days:\n"]
    for c in checks:
        day_list = c.get('days', [])
        ok = sum(1 for d in day_list if d['status'] == 'ok')
        missing = sum(1 for d in day_list if d['status'] == 'missing')
        total = sum(1 for d in day_list if d['status'] not in ('future', 'holiday'))
        latest = c.get('latest_date', 'Never')
        lines.append(
            f"  {c['label']} [{c['layer']}]: "
            f"{ok}/{total} days present, {missing} gaps, "
            f"latest: {latest}"
        )
    lines.append("\nProvide your data health assessment and recommended fix.")
    user_msg = '\n'.join(lines)

    skill = _AI_SKILLS["data_health_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {"insight": insight, "ai": insight is not None}


@app.get('/api/pipeline/health')
def health():
    """Overall pipeline health check."""
    # DB connectivity
    db_ok = db.ping() if db else False

    # Breeze session
    breeze_status = 'unknown'
    try:
        rows = db.select('km_api_sessions', '*', filters={'provider': 'breeze'}, limit=1)
        if rows:
            breeze_status = rows[0].get('status', 'unknown')
    except Exception:
        breeze_status = 'error'

    # Last sync
    last_sync = None
    try:
        rows = db.select('km_trading_calendar', 'trade_date,status',
                         filters={'status': 'completed'},
                         order='trade_date.desc', limit=1)
        if rows:
            last_sync = rows[0]['trade_date']
    except Exception:
        pass

    # Scheduler
    sched_next = None
    if scheduler:
        job = scheduler.get_job('daily_pipeline')
        if job and job.next_run_time:
            sched_next = job.next_run_time.isoformat()

    return {
        'db': 'ok' if db_ok else 'error',
        'breeze': breeze_status,
        'last_sync': last_sync,
        'scheduler_next_run': sched_next,
        'active_jobs': len([j for j in active_jobs.values() if j['status'] == 'running']),
    }


@app.get('/api/pipeline/status')
def status():
    """Current pipeline status — today's steps + recent history."""
    today = str(date.today())

    # Today's steps
    today_steps = db.select('km_pipeline_runs', '*',
                            filters={'trade_date': today}, order='id')

    # Last 14 days from trading calendar
    since_date = date.today() - timedelta(days=14)
    since = str(since_date)
    calendar = db.select('km_trading_calendar', '*',
                         order='trade_date.desc', limit=100)
    calendar = [c for c in calendar if c['trade_date'] >= since_date]
    for c in calendar:
        c['trade_date'] = str(c['trade_date'])

    # Recent pipeline runs
    recent_runs = db.select('km_pipeline_runs', '*',
                            order='trade_date.desc,id', limit=200)
    recent_runs = [r for r in recent_runs if r['trade_date'] >= since_date]
    for r in recent_runs:
        r['trade_date'] = str(r['trade_date'])

    return {
        'today': today,
        'today_steps': today_steps,
        'calendar': calendar,
        'recent_runs': recent_runs,
        'active_jobs': active_jobs,
    }


# Ordered step definitions for live execution view
NSE_STEPS = [
    {'step': 'index_download',    'label': 'NSE Index Download'},
    {'step': 'tri_download',      'label': 'TRI Index Download'},
    {'step': 'fii_dii',           'label': 'FII / DII Activity'},
    {'step': 'index_indicators',  'label': 'Index Indicators'},
    {'step': 'download',          'label': 'NSE Equity Download'},
    {'step': 'parse',             'label': 'NSE Parse CSV'},
    {'step': 'insert',            'label': 'NSE Insert Records'},
    {'step': 'delivery',          'label': 'NSE Delivery Data'},
    {'step': 'indicators',        'label': 'NSE Equity Indicators'},
    {'step': 'views',             'label': 'Refresh Views'},
]

BSE_STEPS = [
    {'step': 'download',          'label': 'BSE Equity Download'},
    {'step': 'parse',             'label': 'BSE Parse CSV'},
    {'step': 'insert',            'label': 'BSE Insert Records'},
    {'step': 'indicators',        'label': 'BSE Equity Indicators'},
]


@app.get('/api/pipeline/live')
def pipeline_live():
    """Live execution state — reads from km_jobs table."""
    # Find active job
    running = db.select('km_jobs', '*', filters={'status': 'running'},
                        order='created_at.desc', limit=1)
    if not running:
        running = db.select('km_jobs', '*', filters={'status': 'queued'},
                            order='created_at.desc', limit=1)
    if not running:
        # Show most recent completed/failed
        running = db.select('km_jobs', '*', order='created_at.desc', limit=1)

    if not running:
        return {'active': False, 'job': None, 'exchanges': []}

    job = running[0]
    # Serialise dates
    for k in ('created_at', 'started_at', 'completed_at'):
        if job.get(k):
            job[k] = str(job[k])

    running_job = {
        'job_id': job['id'],
        'status': job['status'],
        'type': job['job_type'],
        'exchange': 'NSE',
        'started_at': job.get('started_at'),
        'completed_at': job.get('completed_at'),
        'progress': job.get('progress'),
        'progress_pct': job.get('progress_pct', 0),
        'result': job.get('result'),
        'error_msg': job.get('error_msg'),
    }

    job_status = job['status']

    # Elapsed time
    elapsed_ms = None
    if running_job.get('started_at'):
        try:
            start_dt = datetime.fromisoformat(str(running_job['started_at']))
            if running_job.get('completed_at'):
                end_dt = datetime.fromisoformat(str(running_job['completed_at']))
            else:
                end_dt = datetime.utcnow()
            elapsed_ms = int((end_dt - start_dt).total_seconds() * 1000)
        except Exception:
            pass

    # Get step-level data from km_pipeline_runs for the dates being processed
    job_params = job.get('params') or {}
    if isinstance(job_params, str):
        import json as _json
        job_params = _json.loads(job_params)

    # Determine exchange from job type
    exchange = 'NSE'
    if 'bse' in (job.get('job_type') or ''):
        exchange = 'BSE'

    # Build step-level view for dates in progress
    exchanges = []
    progress_text = running_job.get('progress', '')

    # Extract current date from progress text (format: "2026-04-02 (2/5) — downloading...")
    current_dates = []
    if progress_text:
        import re
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', progress_text)
        if date_match:
            current_dates = [date_match.group(1)]

    # Also check recent pipeline runs for this exchange in the last 2 days
    if not current_dates and job_status == 'running':
        recent = db.select('km_pipeline_runs', 'trade_date',
                           filters={'exchange': exchange},
                           order='started_at.desc', limit=1)
        if recent:
            current_dates = [str(recent[0]['trade_date'])]

    if current_dates:
        step_defs = NSE_STEPS if exchange == 'NSE' else BSE_STEPS
        date_views = []

        for d in current_dates:
            runs = db.select('km_pipeline_runs', '*',
                             filters={'trade_date': d, 'exchange': exchange},
                             order='id')
            run_map = {r['step']: r for r in runs}

            steps = []
            for sd in step_defs:
                run = run_map.get(sd['step'])
                if run:
                    for k in ('trade_date', 'started_at', 'completed_at'):
                        if run.get(k):
                            run[k] = str(run[k])
                    steps.append({
                        **sd,
                        'status': run.get('status', 'pending'),
                        'rows_count': run.get('rows_count', 0),
                        'duration_ms': run.get('duration_ms'),
                        'error_msg': run.get('error_msg'),
                    })
                else:
                    steps.append({
                        **sd,
                        'status': 'pending',
                        'rows_count': 0,
                        'duration_ms': None,
                        'error_msg': None,
                    })

            completed_count = sum(1 for s in steps if s['status'] in ('completed', 'skipped'))
            date_views.append({
                'date': d,
                'steps': steps,
                'completed': completed_count,
                'total': len(steps),
                'progress_pct': round(completed_count / len(steps) * 100) if steps else 0,
            })

        exchanges.append({'exchange': exchange, 'dates': date_views})

    return {
        'active': job_status in ('running', 'queued'),
        'job': {
            'job_id': running_job['job_id'],
            'status': job_status,
            'type': running_job['type'],
            'exchange': exchange,
            'started_at': running_job.get('started_at'),
            'completed_at': running_job.get('completed_at'),
            'elapsed_ms': elapsed_ms,
            'progress': running_job.get('progress'),
            'progress_pct': running_job.get('progress_pct', 0),
            'error_msg': running_job.get('error_msg'),
        },
        'exchanges': exchanges,
    }


@app.post('/api/pipeline/run', response_model=JobResponse)
def run_pipeline(req: RunRequest, background_tasks: BackgroundTasks):
    """Trigger pipeline for a single date."""
    # Check for already running jobs
    running = [j for j in active_jobs.values() if j['status'] == 'running']
    if running:
        raise HTTPException(409, 'A pipeline job is already running')

    target = date.fromisoformat(req.date) if req.date else last_trading_day()

    if is_weekend(target):
        raise HTTPException(400, f'{target} is a weekend')

    job_id = str(uuid.uuid4())[:8]
    active_jobs[job_id] = {
        'status': 'queued',
        'started_at': datetime.utcnow().isoformat(),
        'exchange': req.exchange,
        'dates': [str(target)],
        'type': 'manual',
    }

    background_tasks.add_task(_run_pipeline_dates, job_id, [target], req.exchange, force=req.force)
    log.info(f'Job {job_id}: queued for {target} ({req.exchange}){" [FORCE]" if req.force else ""}')

    return JobResponse(
        job_id=job_id,
        status='queued',
        message=f'Pipeline queued for {target} ({req.exchange})',
    )


@app.post('/api/pipeline/backfill', response_model=JobResponse)
def backfill(req: BackfillRequest, background_tasks: BackgroundTasks):
    """Trigger pipeline for a date range."""
    running = [j for j in active_jobs.values() if j['status'] == 'running']
    if running:
        raise HTTPException(409, 'A pipeline job is already running')

    from_dt = date.fromisoformat(req.date_from)
    to_dt = date.fromisoformat(req.date_to)

    if from_dt > to_dt:
        raise HTTPException(400, 'date_from must be before date_to')

    dates = get_missing_dates(db, from_dt, to_dt, req.exchange)
    if not dates:
        return JobResponse(
            job_id='none',
            status='completed',
            message=f'No missing dates between {from_dt} and {to_dt}',
        )

    job_id = str(uuid.uuid4())[:8]
    active_jobs[job_id] = {
        'status': 'queued',
        'started_at': datetime.utcnow().isoformat(),
        'exchange': req.exchange,
        'dates': [str(d) for d in dates],
        'type': 'backfill',
    }

    background_tasks.add_task(_run_pipeline_dates, job_id, dates, req.exchange)
    log.info(f'Job {job_id}: backfill queued — {len(dates)} dates ({req.exchange})')

    return JobResponse(
        job_id=job_id,
        status='queued',
        message=f'Backfill queued for {len(dates)} missing dates ({req.exchange})',
    )


@app.get('/api/pipeline/jobs')
def list_jobs():
    """List all active/recent jobs."""
    return active_jobs


@app.get('/api/pipeline/jobs/{job_id}')
def get_job(job_id: str):
    """Get status of a specific job."""
    if job_id not in active_jobs:
        raise HTTPException(404, f'Job {job_id} not found')
    return active_jobs[job_id]


@app.post('/api/pipeline/breeze-connect')
def breeze_connect(req: BreezeConnectRequest):
    """Store Breeze session token (from UI login flow)."""
    try:
        breeze = init_breeze(session_token=req.session_token, db=db)
        return {
            'status': 'connected',
            'message': 'Breeze session connected successfully',
        }
    except Exception as e:
        raise HTTPException(400, f'Failed to connect: {str(e)}')


@app.get('/api/pipeline/breeze-status')
def breeze_status():
    """Get current Breeze session status."""
    try:
        rows = db.select('km_api_sessions', '*', filters={'provider': 'breeze'}, limit=1)
        if not rows:
            return {
                'status': 'disconnected',
                'login_url': get_login_url(),
            }
        session = rows[0]
        return {
            'status': session.get('status', 'unknown'),
            'connected_at': session.get('connected_at'),
            'expires_at': session.get('expires_at'),
            'last_error': session.get('last_error'),
            'api_key_hint': session.get('api_key_hint'),
            'login_url': get_login_url(),
        }
    except Exception as e:
        return {'status': 'error', 'error': str(e), 'login_url': get_login_url()}


@app.get('/api/pipeline/scheduler')
def scheduler_status():
    """Get scheduler status and next run time."""
    if not scheduler:
        return {'active': False}

    job = scheduler.get_job('daily_pipeline')
    return {
        'active': scheduler.running,
        'job_id': 'daily_pipeline',
        'next_run': job.next_run_time.isoformat() if job and job.next_run_time else None,
        'trigger': '6:00 PM IST (Mon-Fri)',
    }


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


# ── Per-dimension Fix Endpoint ────────────────────────────────────────────────

class FixRequest(BaseModel):
    dimension: str           # health check ID: nse_equities, indicators, etc.
    days: int = 60           # how far back to look for gaps
    strategy: str = 'smart'  # smart (skip existing) | force (redownload) | compute_only (no downloads)


# ── Cancel endpoint ───────────────────────────────────────────────────────────
# Sets a flag that running jobs can check to abort early

_cancel_flags: dict[str, bool] = {}

@app.post('/api/pipeline/cancel')
def cancel_job(job_id: int = None):
    """Cancel a running/queued job in km_jobs."""
    if job_id:
        db.patch('km_jobs', {'id': job_id}, {
            'status': 'cancelled',
            'completed_at': datetime.utcnow().isoformat(),
        })
        return {'status': 'cancelled', 'message': f'Job #{job_id} cancelled'}
    else:
        # Cancel all running/queued jobs
        running = db.select('km_jobs', 'id', filters={'status': 'running'}, limit=10)
        queued = db.select('km_jobs', 'id', filters={'status': 'queued'}, limit=10)
        cancelled = []
        for row in (running or []) + (queued or []):
            db.patch('km_jobs', {'id': row['id']}, {
                'status': 'cancelled',
                'completed_at': datetime.utcnow().isoformat(),
            })
            cancelled.append(row['id'])
        return {'status': 'cancelled', 'message': f'Cancelled {len(cancelled)} job(s)', 'job_ids': cancelled}


class MarkDateRequest(BaseModel):
    date: str              # YYYY-MM-DD
    status: str = 'no_data'  # no_data | holiday
    exchange: str = 'NSE'


@app.post('/api/pipeline/mark-date')
def mark_date(req: MarkDateRequest):
    """Mark a date as holiday/no_data so backfill skips it."""
    if req.status not in ('no_data', 'holiday'):
        raise HTTPException(400, 'Status must be no_data or holiday')

    record = {
        'trade_date': req.date,
        'exchange': req.exchange,
        'status': req.status,
        'is_holiday': req.status == 'holiday',
    }
    db.upsert('km_trading_calendar', [record], 'trade_date,exchange')
    log.info(f'[mark-date] {req.date} ({req.exchange}) → {req.status}')
    return {'status': 'ok', 'message': f'{req.date} marked as {req.status}'}

def _fix_indicators(days: int = 60, job_id: str = None, strategy: str = 'smart'):
    """Recompute technical indicators ONLY for dates missing them."""
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    backfill_db = _get_backfill_db()
    try:
        import psycopg2.extras
        total = 0
        for table, id_col in [('km_index_eod', 'index_id'), ('km_equity_eod', 'equity_id')]:
            # Find symbols with uncomputed rows IN THE DATE RANGE ONLY
            conn = backfill_db._conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(f"""
                        SELECT DISTINCT {id_col} AS sid
                        FROM {table}
                        WHERE indicators_computed_at IS NULL
                          AND trade_date BETWEEN %s AND %s
                    """, [str(from_dt), str(cutoff)])
                    pending = [r['sid'] for r in cur.fetchall()]
            finally:
                backfill_db._put(conn)

            log.info(f'[fix:indicators] {table}: {len(pending)} symbols with gaps in last {days} days')

            for sid in pending:
                if _cancel_flags.get(job_id):
                    break
                try:
                    result = backfill_db.rpc('compute_indicators_batch', {
                        'p_table': table,
                        'p_id_col': id_col,
                        'p_symbol_id': sid,
                        'p_from_date': str(from_dt),
                    })
                    count = result[0].get('compute_indicators_batch', 0) if result else 0
                    total += count
                except Exception as e:
                    log.error(f'[fix:indicators] {table} sid={sid}: {e}')

            log.info(f'[fix:indicators] {table}: done, {total} rows updated')
    finally:
        if backfill_db is not db:
            try: backfill_db.close()
            except Exception: pass
    _cancel_flags.pop(job_id, None)


def _fix_flow_intelligence(days: int = 60, job_id: str = None, strategy: str = 'smart'):
    """Recompute flow intelligence ONLY for dates missing it."""
    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    backfill_db = _get_backfill_db()
    try:
        import psycopg2.extras
        total = 0
        for table, id_col in [('km_index_eod', 'index_id'), ('km_equity_eod', 'equity_id')]:
            conn = backfill_db._conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(f"""
                        SELECT DISTINCT {id_col} AS sid
                        FROM {table}
                        WHERE flow_type IS NULL
                          AND trade_date BETWEEN %s AND %s
                    """, [str(from_dt), str(cutoff)])
                    pending = [r['sid'] for r in cur.fetchall()]
            finally:
                backfill_db._put(conn)

            log.info(f'[fix:flow_intel] {table}: {len(pending)} symbols with gaps in last {days} days')

            for sid in pending:
                if _cancel_flags.get(job_id):
                    break
                try:
                    result = backfill_db.rpc('compute_flow_intelligence', {
                        'p_table': table,
                        'p_id_col': id_col,
                        'p_symbol_id': sid,
                        'p_from_date': str(from_dt),
                    })
                    count = result if isinstance(result, int) else (result[0].get('compute_flow_intelligence', 0) if result else 0)
                    total += count
                except Exception as e:
                    log.error(f'[fix:flow_intel] {table} sid={sid}: {e}')

            log.info(f'[fix:flow_intel] {table}: done, {total} rows updated')
    finally:
        if backfill_db is not db:
            try: backfill_db.close()
            except Exception: pass
    _cancel_flags.pop(job_id, None)

def _dates_with_eod_data(exchange: str, from_date: date, to_date: date) -> set[str]:
    """Check which dates already have EOD data in km_equity_eod."""
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT DISTINCT e.trade_date FROM km_equity_eod e "
                    "JOIN km_equity_symbols s ON s.id = e.equity_id "
                    "WHERE s.exchange = %s AND e.trade_date BETWEEN %s AND %s",
                    [exchange, str(from_date), str(to_date)]
                )
                return {str(r['trade_date']) for r in cur.fetchall()}
        finally:
            db._put(conn)
    except Exception:
        return set()


def _get_known_holidays(from_date: date, to_date: date) -> set[str]:
    """Get holidays from km_trading_calendar + known Indian market holidays."""
    holidays = set()
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT trade_date FROM km_trading_calendar "
                    "WHERE (is_holiday = TRUE OR status IN ('holiday', 'no_data', 'weekend')) "
                    "AND trade_date BETWEEN %s AND %s",
                    [str(from_date), str(to_date)]
                )
                holidays = {str(r['trade_date']) for r in cur.fetchall()}
        finally:
            db._put(conn)
    except Exception:
        pass
    return holidays


def _get_backfill_db():
    """Get a SEPARATE db client for backfill operations so API stays responsive."""
    try:
        from lib.pg_client import PgClient
        from lib.config import DATABASE_URL
        return PgClient(DATABASE_URL)
    except Exception:
        return db  # fallback to shared pool


def _get_cutoff_date() -> date:
    """Don't process today if before 6 PM IST (bhav copy not available yet)."""
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    now_ist = datetime.now(ist)
    if now_ist.hour < 18:
        return last_trading_day(date.today() - timedelta(days=1))
    return date.today()


def _fix_nse_backfill(days: int, job_id: str = None, strategy: str = 'smart'):
    """Backfill NSE equity pipeline for missing dates."""
    from daily_pipeline import run_nse_pipeline

    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    # Collect weekdays
    all_weekdays = []
    cursor = from_dt
    while cursor <= cutoff:
        if cursor.weekday() < 5:
            all_weekdays.append(cursor)
        cursor += timedelta(days=1)

    # Skip holidays
    holidays = _get_known_holidays(from_dt, cutoff)
    all_weekdays = [d for d in all_weekdays if str(d) not in holidays]

    if strategy == 'smart':
        existing = _dates_with_eod_data('NSE', from_dt, cutoff)
        to_process = [d for d in all_weekdays if str(d) not in existing]
        log.info(f'[fix:nse] Smart: {len(existing)} have data, {len(holidays)} holidays, {len(to_process)} to process')
    else:
        to_process = all_weekdays
        log.info(f'[fix:nse] Force: {len(to_process)} dates to process')

    if job_id and job_id in active_jobs:
        active_jobs[job_id]['dates'] = [str(d) for d in to_process]
        active_jobs[job_id]['exchange'] = 'NSE'

    # Use separate DB connection to avoid starving the API
    backfill_db = _get_backfill_db()
    try:
        for d in to_process:
            if _cancel_flags.get(job_id):
                log.info(f'[fix:nse] Cancelled at {d}')
                break
            try:
                run_nse_pipeline(backfill_db, d, force=(strategy == 'force'))
            except Exception as e:
                log.error(f'[fix:nse] {d} failed: {e}')
    finally:
        if backfill_db is not db:
            try:
                backfill_db.close()
            except Exception:
                pass

    _cancel_flags.pop(job_id, None)
    _refresh_market_breadth()
    _refresh_breadth_roc()


def _fix_bse_backfill(days: int, job_id: str = None, strategy: str = 'smart'):
    """Backfill BSE equity pipeline for missing dates."""
    from daily_pipeline import run_bse_pipeline

    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    all_weekdays = []
    cursor = from_dt
    while cursor <= cutoff:
        if cursor.weekday() < 5:
            all_weekdays.append(cursor)
        cursor += timedelta(days=1)

    holidays = _get_known_holidays(from_dt, cutoff)
    all_weekdays = [d for d in all_weekdays if str(d) not in holidays]

    if strategy == 'smart':
        existing = _dates_with_eod_data('BSE', from_dt, cutoff)
        to_process = [d for d in all_weekdays if str(d) not in existing]
        log.info(f'[fix:bse] Smart: {len(existing)} have data, {len(holidays)} holidays, {len(to_process)} to process')
    else:
        to_process = all_weekdays
        log.info(f'[fix:bse] Force: {len(to_process)} dates to process')

    if job_id and job_id in active_jobs:
        active_jobs[job_id]['dates'] = [str(d) for d in to_process]
        active_jobs[job_id]['exchange'] = 'BSE'

    backfill_db = _get_backfill_db()
    try:
        for d in to_process:
            if _cancel_flags.get(job_id):
                log.info(f'[fix:bse] Cancelled at {d}')
                break
            try:
                run_bse_pipeline(backfill_db, d, force=(strategy == 'force'))
            except Exception as e:
                log.error(f'[fix:bse] {d} failed: {e}')
    finally:
        if backfill_db is not db:
            try:
                backfill_db.close()
            except Exception:
                pass

    _cancel_flags.pop(job_id, None)

def _fix_fii_dii(days: int = 60, job_id: str = None, strategy: str = 'smart'):
    """Download FII/DII data ONLY — no equity/index pipeline."""
    from pipeline.downloaders.nse_fiidii import download_nse_fiidii, upsert_fii_dii
    from pipeline.utils.nse_session import NseSession

    cutoff = _get_cutoff_date()
    from_dt = cutoff - timedelta(days=int(days * 1.5))

    # Check which dates already have FII/DII data
    existing = set()
    if strategy == 'smart':
        existing = _query_distinct_dates_raw('km_fii_dii', from_dt, cutoff)

    skip = _get_known_holidays_set(from_dt, cutoff)
    to_process = []
    cursor = from_dt
    while cursor <= cutoff:
        ds = str(cursor)
        if cursor.weekday() < 5 and ds not in skip and ds not in existing:
            to_process.append(cursor)
        cursor += timedelta(days=1)

    log.info(f'[fix:fii_dii] {len(existing)} have data, {len(to_process)} to process')

    if job_id and job_id in active_jobs:
        active_jobs[job_id]['dates'] = [str(d) for d in to_process]
        active_jobs[job_id]['exchange'] = 'NSE'

    backfill_db = _get_backfill_db()
    nse = NseSession()
    try:
        for d in to_process:
            if _cancel_flags.get(job_id):
                break
            try:
                records = download_nse_fiidii(d, session=nse)
                if records:
                    upsert_fii_dii(backfill_db, records)
                    log.info(f'[fix:fii_dii] {d}: {len(records)} records')
            except Exception as e:
                log.error(f'[fix:fii_dii] {d}: {e}')
    finally:
        if backfill_db is not db:
            try: backfill_db.close()
            except Exception: pass
    _cancel_flags.pop(job_id, None)


def _query_distinct_dates_raw(table: str, from_dt: date, to_dt: date) -> set[str]:
    """Quick helper to get distinct dates from a table."""
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    f"SELECT DISTINCT trade_date FROM {table} "
                    "WHERE trade_date BETWEEN %s AND %s",
                    [str(from_dt), str(to_dt)]
                )
                return {str(r['trade_date']) for r in cur.fetchall()}
        finally:
            db._put(conn)
    except Exception:
        return set()


def _get_known_holidays_set(from_dt: date, to_dt: date) -> set[str]:
    """Get holiday/no_data dates as a simple set for backfill skipping."""
    try:
        import psycopg2.extras
        conn = db._conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT trade_date FROM km_trading_calendar "
                    "WHERE (is_holiday = TRUE OR status IN ('holiday', 'no_data', 'weekend')) "
                    "AND trade_date BETWEEN %s AND %s",
                    [str(from_dt), str(to_dt)]
                )
                return {str(r['trade_date']) for r in cur.fetchall()}
        finally:
            db._put(conn)
    except Exception:
        return set()


FIX_DIMENSIONS = {
    'nse_equities', 'bse_equities', 'indicators',
    'nse_equity_indicators', 'bse_equity_indicators',
    'flow_intelligence', 'magic_rs', 'market_breadth', 'breadth_roc',
    'industry_composites', 'fii_dii',
}


@app.post('/api/pipeline/fix')
def fix_dimension(req: FixRequest):
    """Queue a fix job for a specific data health dimension.
    The job is picked up by worker.py — NOT run inside the API process."""
    if req.dimension not in FIX_DIMENSIONS:
        raise HTTPException(400, f'Unknown dimension: {req.dimension}. '
                            f'Available: {", ".join(sorted(FIX_DIMENSIONS))}')

    # Check for already queued/running jobs of same type
    existing = db.select('km_jobs', 'id,status',
                         filters={'job_type': f'fix:{req.dimension}'},
                         order='created_at.desc', limit=1)
    if existing and existing[0].get('status') in ('queued', 'running'):
        raise HTTPException(409, f'A {req.dimension} job is already queued/running (#{existing[0]["id"]})')

    # Insert job into queue
    record = {
        'job_type': f'fix:{req.dimension}',
        'params': json.dumps({'days': req.days, 'strategy': req.strategy}),
        'status': 'queued',
        'created_by': 'ui',
    }
    db.insert('km_jobs', record)

    # Get the inserted job ID
    rows = db.select('km_jobs', 'id',
                     filters={'job_type': f'fix:{req.dimension}', 'status': 'queued'},
                     order='created_at.desc', limit=1)
    job_id = rows[0]['id'] if rows else None

    return {'job_id': job_id, 'status': 'queued',
            'message': f'Job queued for {req.dimension}. Start worker: python worker.py --watch'}


# ── Per-step re-run endpoint ────────────────────────────────────────────────

class RunStepRequest(BaseModel):
    trade_date: str
    step: str
    exchange: str = 'NSE'

@app.post('/api/pipeline/run-step')
def run_step(req: RunStepRequest):
    """Queue a re-run of a specific pipeline step for a specific date.
    Maps step names to fix: job types for the worker."""
    STEP_TO_FIX = {
        'indicators': 'fix:nse_equity_indicators' if req.exchange == 'NSE' else 'fix:bse_equity_indicators',
        'index_indicators': 'fix:indicators',
        'magic_rs': 'fix:magic_rs',
        'flow_intelligence': 'fix:flow_intelligence',
        'industry_composites': 'fix:industry_composites',
        'market_breadth': 'fix:market_breadth',
        'breadth_roc': 'fix:breadth_roc',
    }
    job_type = STEP_TO_FIX.get(req.step)
    if not job_type:
        raise HTTPException(400, f'Step "{req.step}" cannot be re-run individually')

    # Check for already queued/running
    existing = db.select('km_jobs', 'id,status',
                         filters={'job_type': job_type},
                         order='created_at.desc', limit=1)
    if existing and existing[0].get('status') in ('queued', 'running'):
        raise HTTPException(409, f'A {req.step} job is already queued/running')

    record = {
        'job_type': job_type,
        'params': json.dumps({
            'days': 60, 'strategy': 'smart',
            'trade_date': req.trade_date, 'exchange': req.exchange,
        }),
        'status': 'queued',
        'created_by': 'manual_step',
    }
    db.insert('km_jobs', record)

    rows = db.select('km_jobs', 'id',
                     filters={'job_type': job_type, 'status': 'queued'},
                     order='created_at.desc', limit=1)
    job_id = rows[0]['id'] if rows else None

    return {'job_id': job_id, 'status': 'queued',
            'message': f'Re-run queued for {req.step} ({req.exchange}, {req.trade_date})'}


@app.get('/api/pipeline/coverage-summary')
def coverage_summary(trade_date: str = None):
    """Return per-step coverage for a date. Used by header status dot.
    If no date specified, uses the latest date with pipeline runs."""
    if not trade_date:
        latest = db.select('km_pipeline_runs', 'trade_date',
                           order='trade_date.desc', limit=1)
        if latest:
            trade_date = str(latest[0]['trade_date'])
        else:
            from datetime import date as date_cls
            trade_date = str(date_cls.today())

    rows = db.select('km_pipeline_runs', '*',
                     filters={'trade_date': trade_date},
                     order='step_order')
    if not rows:
        return {'trade_date': trade_date, 'steps': [], 'overall': 'unknown'}

    from config.pipeline_steps import STEP_BY_NAME, classify_coverage

    steps = []
    worst = 'healthy'
    for r in rows:
        step_name = r.get('step', '')
        config = STEP_BY_NAME.get(step_name, {})
        cov = r.get('coverage_pct')
        status = r.get('status', 'unknown')

        if status == 'failed':
            classification = 'failed'
        elif status == 'skipped':
            classification = 'skipped'
        elif cov is not None:
            classification = classify_coverage(step_name, float(cov))
        else:
            classification = 'healthy' if status == 'completed' else 'unknown'

        steps.append({
            'step': step_name,
            'label': config.get('label', step_name),
            'order': config.get('order', 99),
            'exchange': r.get('exchange'),
            'status': status,
            'rows_count': r.get('rows_count'),
            'rows_expected': r.get('rows_expected'),
            'coverage_pct': cov,
            'classification': classification,
            'duration_ms': r.get('duration_ms'),
            'error_msg': r.get('error_msg'),
        })

        # Track worst classification
        severity = {'failed': 4, 'partial': 3, 'warning': 2, 'healthy': 1, 'skipped': 0, 'unknown': 0}
        if severity.get(classification, 0) > severity.get(worst, 0):
            worst = classification

    return {'trade_date': trade_date, 'steps': steps, 'overall': worst}


# ── AI Endpoints ──────────────────────────────────────────────────────────────

# Per-day in-memory cache — insight for a given date never changes
_insight_cache: dict[str, str] = {}


@app.get('/api/ai/panchang-insight')
def panchang_insight(date: str):
    """Return an AI-generated 2-sentence market insight for a given date's Panchangam."""
    if not _AI_ENABLED:
        return {"date": date, "insight": None, "ai": False}

    if date in _insight_cache:
        return {"date": date, "insight": _insight_cache[date], "ai": True}

    # Fetch panchang row from DB
    try:
        rows = db.select('km_daily_panchang', '*', filters={'date': date}, limit=1)
    except Exception as e:
        log.error(f"Failed to fetch panchang for {date}: {e}")
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
        f"Vara: {p.get('vara_name', p.get('vara', ''))} (Lord: {p.get('vara_lord', '')})\n"
        f"Moon Sign: {p.get('moon_sign_name', p.get('moon_sign', ''))}\n"
        f"Special Events: {special}\n"
        f"What is today's market risk context?"
    )

    skill = _AI_SKILLS["panchang_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[date] = insight
    return {"date": date, "insight": insight, "ai": insight is not None}


@app.get('/api/ai/breadth-insight')
def breadth_insight(date: str = None):
    """Return an AI-generated 3-sentence market breadth insight for a given date (default: latest)."""
    if not _AI_ENABLED:
        return {"date": date, "insight": None, "ai": False}

    cache_key = f"breadth:{date or 'latest'}"
    if cache_key in _insight_cache:
        return {"date": date, "insight": _insight_cache[cache_key], "ai": True}

    # Fetch breadth row from DB
    try:
        if date:
            rows = db.select('km_market_breadth', '*', filters={'trade_date': date}, limit=1)
        else:
            rows = db.select('km_market_breadth', '*', order='trade_date.desc', limit=2)
    except Exception as e:
        log.error(f"Failed to fetch market breadth: {e}")
        return {"date": date, "insight": None, "ai": False}

    if not rows:
        return {"date": date, "insight": None, "ai": False}

    latest = rows[0]
    prev   = rows[1] if len(rows) > 1 else None
    target_date = str(latest.get('trade_date', date or ''))

    # Regime label
    score = float(latest.get('breadth_score') or 0)
    regime = 'Greed' if score > 55 else ('Fear' if score < 35 else 'Neutral')

    # Trend direction
    trend = 'stable'
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

    skill = _AI_SKILLS["breadth_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {"date": target_date, "insight": insight, "ai": insight is not None}


@app.get('/api/ai/breadth-roc-insight')
def breadth_roc_insight():
    """Return an AI-generated 3-sentence ROC breadth oscillator insight (latest date)."""
    if not _AI_ENABLED:
        return {"date": None, "insight": None, "ai": False}

    cache_key = "breadth_roc:latest"
    if cache_key in _insight_cache:
        return {"date": None, "insight": _insight_cache[cache_key], "ai": True}

    try:
        rows = db.select('km_breadth_roc', '*', order='trade_date.desc', limit=2)
    except Exception as e:
        log.error(f"Failed to fetch breadth_roc: {e}")
        return {"date": None, "insight": None, "ai": False}

    if not rows:
        return {"date": None, "insight": None, "ai": False}

    latest = rows[0]
    prev   = rows[1] if len(rows) > 1 else None
    target_date = str(latest.get('trade_date', ''))

    roc13 = float(latest.get('roc_13') or 0)
    roc55 = float(latest.get('roc_55') or 0)
    sma   = float(latest.get('sma_breadth') or 0)

    bias_13 = 'positive (bullish)' if roc13 > 0 else 'negative (bearish)'
    bias_55 = 'positive' if roc55 > 0 else 'negative'
    sma_dir = 'above zero (confirming)' if sma > 0 else 'below zero (diverging)'

    spread = roc13 - roc55
    spread_desc = (
        'fast momentum outpacing long-term (breadth expanding)'
        if spread > 0 else
        'fast momentum lagging long-term (breadth narrowing)'
    )

    trend = 'stable'
    if prev and prev.get('roc_13') is not None:
        delta = roc13 - float(prev['roc_13'])
        trend = 'strengthening' if delta > 0.0002 else ('weakening' if delta < -0.0002 else 'stable')

    user_msg = (
        f"ROC Breadth Oscillator snapshot as of {target_date}:\n"
        f"ROC_13 (13-day momentum breadth): {roc13:+.4f} — {bias_13}\n"
        f"ROC_55 (55-day momentum breadth): {roc55:+.4f} — {bias_55}\n"
        f"SMA_BREADTH (5-day smoothed ROC_13): {sma:+.4f} — {sma_dir}\n"
        f"Fast vs slow spread: {spread_desc}\n"
        f"Momentum trend vs prior session: {trend}\n"
        f"Stock universe: {latest.get('stock_count', 'N/A')} NSE equities\n"
        f"\nProvide your ROC breadth oscillator insight."
    )

    skill = _AI_SKILLS["breadth_roc_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {"date": target_date, "insight": insight, "ai": insight is not None}


# ── Data Assembler Endpoints (Phase 2 — context for VaNi skills) ─────────────

from lib.data_assemblers import assemble_instrument_context, assemble_market_pulse_context


@app.get('/api/context/instrument')
def get_instrument_context(id: int, type: str = 'index', date: str = None):
    """Return assembled technical + astro context for one instrument."""
    ctx = assemble_instrument_context(db, id, type, date)
    if not ctx:
        raise HTTPException(404, f'{type} #{id} not found or no data')
    return ctx


@app.get('/api/context/market-pulse')
def get_market_pulse_context(date: str = None):
    """Return assembled market-wide context for the dashboard pulse card."""
    ctx = assemble_market_pulse_context(db, date)
    if not ctx:
        raise HTTPException(500, 'Failed to assemble market pulse context')
    return ctx


# ── VaNi Skill Endpoints (Phase 3 — AI-powered instrument & market insights) ─


def _fmt_instrument_msg(ctx: dict) -> str:
    """Format assembled instrument context into a structured user message for VaNi."""
    p = ctx['price']
    f = ctx['flow']
    part = ctx['participation']
    mom = ctx['momentum']
    rs = ctx['relative_strength']
    vol = ctx['volume']
    dots = ctx['dots']
    gl = ctx['golden_line']
    astro = ctx['astro']
    pang = ctx.get('panchang')
    align = ctx['alignment']

    # Dot events summary
    dot_events = []
    if dots['svd_recent']:
        dot_events.append('SVD (institutional accumulation)')
    if dots['sbd_recent']:
        dot_events.append('SBD (strong accumulation)')
    if dots['syd_recent']:
        dot_events.append('SYD (distribution)')
    dot_str = ', '.join(dot_events) if dot_events else 'None'

    # Astro events summary
    astro_str = 'None active'
    if astro['events']:
        astro_str = '; '.join(
            f"{e['event']} ({e['impact']}, conf:{e['confidence']})"
            for e in astro['events'][:3]
        )

    # Panchang summary
    pang_str = 'N/A'
    if pang:
        special = ', '.join(pang['special']) if pang.get('special') else 'None'
        pang_str = (
            f"Tithi: {pang['tithi']} (Lord: {pang['tithi_lord']}), "
            f"Nakshatra: {pang['nakshatra']} (Lord: {pang['nakshatra_lord']}), "
            f"Vara: {pang['vara']} (Lord: {pang['vara_lord']}), "
            f"Moon: {pang['moon_sign']}, Special: {special}"
        )

    return (
        f"Instrument: {ctx['instrument']['name']} ({ctx['instrument']['type']})\n"
        f"Date: {ctx['date']}\n"
        f"Price: {p['close']} ({p['change_pct']:+.2f}%)\n"
        f"\n--- Technical Snapshot ---\n"
        f"Flow Type: {f['type'] or 'N/A'}\n"
        f"Vacuum: {f['vacuum'] or 'None'}\n"
        f"Accum/Distrib: {f['accum_distrib'] or 'None'}\n"
        f"Participation: {part['profile']} "
        f"(Inst: {part['institution']}, Hot$: {part['hot_money']}, RSI: {part['rsi']})\n"
        f"Momentum: RSI={mom['rsi_14']}, MFI={mom['mfi_14']}, Alignment={mom['alignment']}\n"
        f"MagicRS Zone: {rs['zone'] or 'N/A'} "
        f"(RS={rs['magic_rs']}, MA={rs['magic_ma']})\n"
        f"Volume: RVOL={vol['rvol']}, TVOL={vol['tvol']}, Character={vol['character']}\n"
        f"Dot Events (last 5 bars): {dot_str}\n"
        f"Golden Line (SMA 150): {gl['sma_150']}, Bias={gl['bias']}, "
        f"Distance={gl['distance_pct']}%\n"
        f"\n--- Cycle Context ---\n"
        f"Astro Events: {astro_str}\n"
        f"Astro Day Score: {astro['day_score']:+.1f}, Direction: {astro['direction']}\n"
        f"Panchang: {pang_str}\n"
        f"\n--- Alignment ---\n"
        f"Tech Direction: {align['tech_direction']}\n"
        f"Astro Direction: {align['astro_direction']}\n"
        f"Cycle-Technical Status: {align['status']}\n"
        f"\nProvide your instrument intelligence insight."
    )


def _fmt_market_pulse_msg(ctx: dict) -> str:
    """Format assembled market pulse context into a structured user message for VaNi."""
    # Index summaries
    idx_lines = []
    for idx in ctx.get('indexes', []):
        idx_lines.append(
            f"  {idx['name']}: {idx['close']} ({idx['change_pct']:+.2f}%), "
            f"Flow={idx['flow_type'] or 'N/A'}, "
            f"Participation={idx['participation']}, "
            f"MagicRS={idx['magic_rs_zone'] or 'N/A'}, "
            f"RVOL={idx['rvol']}"
        )
    idx_str = '\n'.join(idx_lines) if idx_lines else '  No index data available'

    # Breadth
    b = ctx.get('breadth')
    breadth_str = 'N/A'
    if b:
        breadth_str = (
            f"Regime={b['regime']} (Score: {b['score']:.1f}), "
            f"Above 20EMA: {b['pct_above_20']}%, "
            f"Above 50EMA: {b['pct_above_50']}%, "
            f"Above 150EMA: {b['pct_above_150']}%"
        )

    # Breadth ROC
    r = ctx.get('breadth_roc')
    roc_str = 'N/A'
    if r:
        roc_str = (
            f"ROC_13={r['roc_13']:+.4f} ({r['bias']}), "
            f"ROC_55={r['roc_55']:+.4f}, "
            f"SMA_BREADTH={r['sma_breadth']:+.4f}"
        )

    # Astro
    astro = ctx.get('astro', {})
    astro_str = 'None active'
    if astro.get('events'):
        astro_str = '; '.join(
            f"{e['event']} ({e['impact']}, conf:{e['confidence']})"
            for e in astro['events'][:4]
        )

    # Panchang
    pang = ctx.get('panchang')
    pang_str = 'N/A'
    if pang:
        special = ', '.join(pang['special']) if pang.get('special') else 'None'
        pang_str = (
            f"Tithi: {pang['tithi']}, Nakshatra: {pang['nakshatra']}, "
            f"Vara: {pang['vara']} (Lord: {pang['vara_lord']}), "
            f"Moon: {pang['moon_sign']}, Special: {special}"
        )

    return (
        f"Market Pulse — {ctx['date']}\n"
        f"\n--- Index Summaries ---\n{idx_str}\n"
        f"\n--- Market Breadth ---\n{breadth_str}\n"
        f"\n--- Breadth Momentum (ROC) ---\n{roc_str}\n"
        f"\n--- Cycle Context ---\n"
        f"Astro Events: {astro_str}\n"
        f"Day Score: {astro.get('day_score', 0):+.1f}, "
        f"Direction: {astro.get('direction', 'N/A')}\n"
        f"Panchang: {pang_str}\n"
        f"\nProvide your market pulse insight."
    )


@app.get('/api/ai/instrument-insight')
def instrument_insight(id: int, type: str = 'index', date: str = None):
    """Return VaNi AI insight for one instrument's astro-technical correlation."""
    if not _AI_ENABLED:
        return {"id": id, "type": type, "date": date, "insight": None, "ai": False}

    cache_key = f"instrument:{type}:{id}:{date or 'latest'}"
    if cache_key in _insight_cache:
        return {"id": id, "type": type, "date": date,
                "insight": _insight_cache[cache_key], "ai": True}

    ctx = assemble_instrument_context(db, id, type, date)
    if not ctx:
        return {"id": id, "type": type, "date": date, "insight": None, "ai": False}

    user_msg = _fmt_instrument_msg(ctx)
    skill = _AI_SKILLS["instrument_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {
        "id": id, "type": type, "date": ctx['date'],
        "insight": insight, "ai": insight is not None,
        "alignment": ctx['alignment']['status'],
    }


@app.get('/api/ai/market-pulse-insight')
def market_pulse_insight(date: str = None):
    """Return VaNi AI insight for overall market astro-technical pulse."""
    if not _AI_ENABLED:
        return {"date": date, "insight": None, "ai": False}

    cache_key = f"pulse:{date or 'latest'}"
    if cache_key in _insight_cache:
        return {"date": date, "insight": _insight_cache[cache_key], "ai": True}

    ctx = assemble_market_pulse_context(db, date)
    if not ctx:
        return {"date": date, "insight": None, "ai": False}

    user_msg = _fmt_market_pulse_msg(ctx)
    skill = _AI_SKILLS["market_pulse_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {
        "date": ctx['date'], "insight": insight, "ai": insight is not None,
        "astro_direction": ctx.get('astro', {}).get('direction'),
    }


@app.post('/api/ai/visual-pulse-insight')
def visual_pulse_insight(payload: dict):
    """Return VaNi AI narrative for a single Visual Pulse candle snapshot.

    The frontend computes all signals and sends the snapshot as JSON.
    We format it as a user message and send to the LLM.
    Falls back to null when AI is disabled — frontend uses rule-based narrative.
    """
    if not _AI_ENABLED:
        return {"insight": None, "ai": False}

    trade_date = payload.get("trade_date", "unknown")
    cache_key = f"vpulse:{trade_date}:{payload.get('style', 'Balanced')}"
    if cache_key in _insight_cache:
        return {"date": trade_date, "insight": _insight_cache[cache_key], "ai": True}

    # Build compact user message from the signal snapshot
    parts = [
        f"Date: {trade_date}",
        f"Flow: {payload.get('flow_type', 'N/A')}",
        f"Accum/Dist: {payload.get('accum_distrib', 'none')}",
        f"Vacuum: {payload.get('vacuum_flag', 'none')}",
        f"Vol Divergence: {payload.get('volume_divergence_flag', 'none')}",
        f"RVOL: {payload.get('rvol', 'N/A')}, TVOL: {payload.get('tvol', 'N/A')}",
        f"RSI-14: {payload.get('rsi_14', 'N/A')}, MFI-14: {payload.get('mfi_14', 'N/A')}",
        f"RSS: {payload.get('rss_value', 'N/A')}, Spread: {payload.get('rss_spread', 'N/A')}",
        f"Smart Money: {payload.get('sniper_inst', 'N/A')}, Fast Money: {payload.get('sniper_hot', 'N/A')}",
        f"SM Relationship: {payload.get('sm_relationship', 'N/A')}",
        f"MagicRS Zone: {payload.get('magic_rs_zone', 'N/A')}",
        f"Astro Score: {payload.get('astro_score', 0)}",
        f"Tech Score: {payload.get('tech_score', 0)} ({payload.get('style', 'Balanced')} lens)",
        f"Correlation: {payload.get('corr_state', 'Neutral')}",
    ]
    user_msg = "\n".join(parts)

    skill = _AI_SKILLS["visual_pulse_insight"]
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
    if insight:
        _insight_cache[cache_key] = insight
    return {
        "date": trade_date, "insight": insight, "ai": insight is not None,
    }


@app.get('/api/fii-dii')
def fii_dii_data(days: int = 30):
    """
    Return FII/DII cash market activity for the last N trading days.
    Each row: {trade_date, category, buy_value, sell_value, net_value}
    """
    since = str(date.today() - timedelta(days=days))
    rows = db.select(
        'km_fii_dii',
        'trade_date,category,buy_value,sell_value,net_value',
        order='trade_date.desc',
        limit=days * 2,   # 2 categories (FII + DII) per day
    )
    # Filter client-side since PostgREST filter on date range
    rows = [r for r in rows if r.get('trade_date', '') >= since]
    return rows


@app.get('/api/pipeline/downloads')
def download_types():
    """List all download types with their status."""
    today = str(date.today())
    yesterday = str(date.today() - timedelta(days=1))
    last_td = str(last_trading_day())

    # Check each download type
    types = []

    for exchange, label in [('NSE', 'NSE Equities'), ('BSE', 'BSE Equities')]:
        rows = db.select('km_trading_calendar', 'trade_date,status',
                         filters={'exchange': exchange, 'status': 'completed'},
                         order='trade_date.desc', limit=1)
        last_date = rows[0]['trade_date'] if rows else None
        gap = 0
        if last_date:
            from pipeline.utils.trading_calendar import get_missing_dates as _gm
            gap = len(_gm(db, date.fromisoformat(str(last_date)), date.today(), exchange))

        types.append({
            'type': f'{exchange.lower()}_bhav',
            'label': label,
            'last_sync': last_date,
            'status': 'ok' if gap == 0 else f'gap_{gap}_days',
            'gap_days': gap,
            'run_exchange': exchange,
        })

    # FII/DII — last date in km_fii_dii
    try:
        fii_rows = db.select('km_fii_dii', 'trade_date', order='trade_date.desc', limit=1)
        fii_last = fii_rows[0]['trade_date'] if fii_rows else None
    except Exception:
        fii_last = None

    types.append({
        'type': 'fii_dii',
        'label': 'FII / DII Activity',
        'last_sync': fii_last,
        'status': 'ok' if fii_last == last_td else ('never' if not fii_last else 'gap'),
        'gap_days': 0,
        'run_exchange': 'NSE',   # FII/DII step runs inside NSE pipeline
    })

    # Breeze status
    breeze_rows = db.select('km_api_sessions', 'status', filters={'provider': 'breeze'}, limit=1)
    breeze_ok = breeze_rows[0]['status'] == 'connected' if breeze_rows else False

    for label, dep in [('NSE Indexes (Breeze)', 'breeze'), ('MCX Commodities (Breeze)', 'breeze')]:
        types.append({
            'type': label.lower().replace(' ', '_').replace('(', '').replace(')', ''),
            'label': label,
            'last_sync': None,
            'status': 'ok' if breeze_ok else 'breeze_expired',
            'gap_days': 0,
            'depends_on': dep,
            'run_exchange': 'NSE',
        })

    return types
