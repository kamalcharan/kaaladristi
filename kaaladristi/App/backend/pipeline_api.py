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
                        skip_indicators: bool = False):
    """Run the pipeline for a list of dates. Executed in background thread."""
    global db

    from daily_pipeline import run_nse_pipeline, run_bse_pipeline

    active_jobs[job_id]['status'] = 'running'
    success = 0
    failed = 0

    for d in dates:
        try:
            if exchange in ('NSE', 'ALL'):
                ok = run_nse_pipeline(db, d, skip_indicators=skip_indicators)
                if ok:
                    success += 1
                else:
                    failed += 1

            if exchange in ('BSE', 'ALL'):
                ok = run_bse_pipeline(db, d, skip_indicators=skip_indicators)
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
    global db, scheduler

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

    yield

    log.info('Shutting down scheduler...')
    scheduler.shutdown(wait=False)


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
    since = str(date.today() - timedelta(days=14))
    calendar = db.select('km_trading_calendar', '*',
                         order='trade_date.desc', limit=100)
    calendar = [c for c in calendar if c['trade_date'] >= since]

    # Recent pipeline runs
    recent_runs = db.select('km_pipeline_runs', '*',
                            order='trade_date.desc,id', limit=200)
    recent_runs = [r for r in recent_runs if r['trade_date'] >= since]

    return {
        'today': today,
        'today_steps': today_steps,
        'calendar': calendar,
        'recent_runs': recent_runs,
        'active_jobs': active_jobs,
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

    background_tasks.add_task(_run_pipeline_dates, job_id, [target], req.exchange)
    log.info(f'Job {job_id}: queued for {target} ({req.exchange})')

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
        })

    return types
