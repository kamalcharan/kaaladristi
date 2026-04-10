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
    # Use date object for comparison (psycopg2 returns datetime.date, not str)
    since_date = date.today() - timedelta(days=14)
    since = str(since_date)
    calendar = db.select('km_trading_calendar', '*',
                         order='trade_date.desc', limit=100)
    calendar = [c for c in calendar if c['trade_date'] >= since_date]
    # Normalise trade_date to str for JSON serialisation
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
