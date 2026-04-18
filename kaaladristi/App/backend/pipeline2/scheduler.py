"""APScheduler trigger for pipeline v2 daily runs.

Enqueues a 'daily_run' row in km_jobs at 18:00 IST on weekdays. The
worker picks it up — scheduler never runs compute directly.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

import pytz
import psycopg2
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger


log = logging.getLogger('pipeline2.scheduler')

IST = pytz.timezone('Asia/Kolkata')


def _last_trading_day(today: date | None = None) -> date:
    """Nearest past weekday (Mon-Fri) at or before `today`."""
    d = today or date.today()
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _enqueue_daily_run(dsn: str) -> None:
    """Insert a daily_run job for the last trading day."""
    target = _last_trading_day()

    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            # Skip if an identical job is already queued or running.
            cur.execute(
                "SELECT id FROM km_jobs "
                "WHERE job_type = 'daily_run' AND trade_date = %s "
                "  AND status IN ('queued', 'running') LIMIT 1",
                [str(target)],
            )
            if cur.fetchone():
                log.info(f'daily_run for {target} already queued/running, skipping')
                return
            cur.execute(
                "INSERT INTO km_jobs (job_type, trade_date, created_by) "
                "VALUES ('daily_run', %s, 'scheduler')",
                [str(target)],
            )
        conn.commit()
        log.info(f'Enqueued daily_run for {target}')
    finally:
        conn.close()


def start_scheduler(dsn: str) -> BackgroundScheduler:
    """Start APScheduler with the 18:00 IST cron trigger."""
    sched = BackgroundScheduler(timezone=IST)
    sched.add_job(
        _enqueue_daily_run,
        trigger=CronTrigger(hour=18, minute=0, day_of_week='mon-fri', timezone=IST),
        id='pipeline2_daily_run',
        name='Pipeline v2 daily run (18:00 IST, Mon-Fri)',
        args=[dsn],
        replace_existing=True,
    )
    sched.start()
    log.info('pipeline2 scheduler started (18:00 IST, Mon-Fri)')
    return sched


def next_run_time(sched: BackgroundScheduler | None) -> str | None:
    if not sched:
        return None
    job = sched.get_job('pipeline2_daily_run')
    if not job or not job.next_run_time:
        return None
    return job.next_run_time.isoformat()
