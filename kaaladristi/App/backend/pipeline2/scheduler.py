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


def _score_recent_transits(dsn: str) -> None:
    """Runs at 19:00 IST — 60 min after the 18:00 daily run, so today's EOD
    close is already loaded. Scores every km_rule_transits window whose
    end_date <= today and nifty_return_pct IS NULL (matched/Confirmed vs
    Not-matched), then refreshes km_rule_confidence.

    Before this job existed, that scoring only ran as phase 2 of the heavy
    admin-triggered 'Run Discovery' job — so a transit window that closed
    yesterday sat 'Pending validation' on the chart/almanac indefinitely
    unless someone manually re-ran full discovery. This reuses the same
    lightweight functions confidence_compute() calls (no rule re-discovery,
    just scoring + aggregation over rows already in km_rule_transits).
    """
    try:
        from scripts.confidence_scoring import (
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
    except Exception as e:
        log.error(f'transit scoring: import failed: {e}')
        return

    try:
        conn = psycopg2.connect(dsn)
    except Exception as e:
        log.error(f'transit scoring: could not connect to DB: {e}')
        return

    try:
        close_map = build_nifty_close_map(conn)
        rule_outcome_map = load_rule_outcome_map(conn)
        scored = update_transit_returns(conn, close_map, rule_outcome_map)
        populate_partial_day_flags(conn)
        daily_scored = update_daily_signal_returns(conn, close_map, rule_outcome_map)
        upserted = compute_confidence_from_transits(conn)
        upserted += compute_confidence_from_daily_signals(conn)
        compute_yearly_breakdown(conn)
        compute_yearly_breakdown_from_signals(conn)
        conn.commit()
        log.info(
            f'Transit scoring complete — {scored} transits + {daily_scored} daily '
            f'signals scored, {upserted} rules upserted'
        )
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        log.error(f'transit scoring: unexpected error — {e}')
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _daily_gap_sweep(dsn: str) -> None:
    """Runs at 19:30 IST — 90 min after the 18:00 daily run. Looks at the
    last 3 trading days and enqueues a fix job for every (dimension, date)
    still sitting at missing or partial.

    Rules:
      * Only enqueues job_type='fix' — never backfill, never daily_run.
      * Includes *_eod_download dims: if bhav wasn't published at 18:00
        it is usually available by 19:30, so retrying makes sense.
      * Skips (dim, date) pairs that already have a queued or running job
        so we don't double-book the worker.
      * created_by = 'gap_sweep' so the operator can spot the source in
        Panel B.
    """
    # Lazy imports — avoid running health-grid queries at scheduler-start time.
    from .health import health_grid

    try:
        conn = psycopg2.connect(dsn)
    except Exception as e:
        log.error(f'gap sweep: could not connect to DB: {e}')
        return

    enqueued = 0
    skipped_existing = 0

    try:
        try:
            grid = health_grid(conn, days=3)
        except Exception as e:
            log.error(f'gap sweep: health_grid failed — aborting: {e}')
            return

        with conn.cursor() as cur:
            for dim_row in grid:
                dim_key = dim_row.get('dimension')
                if not dim_key:
                    continue

                for day in dim_row.get('days') or []:
                    if day.get('status') not in ('missing', 'partial'):
                        continue
                    td = day.get('trade_date')
                    if not td:
                        continue

                    # De-dupe: skip if the worker already has this claim.
                    cur.execute(
                        "SELECT id FROM km_jobs "
                        "WHERE job_type = 'fix' "
                        "  AND dimension = %s AND trade_date = %s "
                        "  AND status IN ('queued', 'running') LIMIT 1",
                        [dim_key, td],
                    )
                    if cur.fetchone():
                        skipped_existing += 1
                        continue

                    cur.execute(
                        "INSERT INTO km_jobs "
                        "  (job_type, dimension, trade_date, created_by) "
                        "VALUES ('fix', %s, %s, 'gap_sweep')",
                        [dim_key, td],
                    )
                    enqueued += 1
        conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        log.error(f'gap sweep: unexpected error — {e}')
        return
    finally:
        try:
            conn.close()
        except Exception:
            pass

    log.info(
        f'Gap sweep complete — {enqueued} fix job(s) enqueued, '
        f'{skipped_existing} already queued/running'
    )


def start_scheduler(dsn: str) -> BackgroundScheduler:
    """Start APScheduler with the 18:00 IST daily run and 19:30 IST gap sweep."""
    sched = BackgroundScheduler(timezone=IST)

    sched.add_job(
        _enqueue_daily_run,
        trigger=CronTrigger(hour=18, minute=0, day_of_week='mon-fri', timezone=IST),
        id='pipeline2_daily_run',
        name='Pipeline v2 daily run (18:00 IST, Mon-Fri)',
        args=[dsn],
        replace_existing=True,
    )

    # 19:00 — 60 min after the 18:00 daily run, so today's close is loaded.
    # Scores newly-closed transit windows so Almanac/chart tooltips flip from
    # 'Pending validation' to Confirmed/Not matched without an admin click.
    sched.add_job(
        _score_recent_transits,
        trigger=CronTrigger(hour=19, minute=0, day_of_week='mon-fri', timezone=IST),
        id='pipeline2_transit_scoring',
        name='Pipeline v2 transit confidence scoring (19:00 IST, Mon-Fri)',
        args=[dsn],
        replace_existing=True,
    )

    # 19:30 gives the 18:00 daily run 90 minutes to complete. Anything still
    # missing / partial after that window is fair game for auto-retry.
    sched.add_job(
        _daily_gap_sweep,
        trigger=CronTrigger(hour=19, minute=30, day_of_week='mon-fri', timezone=IST),
        id='pipeline2_gap_sweep',
        name='Pipeline v2 gap sweep (19:30 IST, Mon-Fri) — last 3 days',
        args=[dsn],
        replace_existing=True,
    )

    sched.start()
    log.info('pipeline2 scheduler started (daily_run 18:00, transit_scoring 19:00, gap_sweep 19:30 IST, Mon-Fri)')
    return sched


def next_run_time(sched: BackgroundScheduler | None,
                  job_id: str = 'pipeline2_daily_run') -> str | None:
    if not sched:
        return None
    job = sched.get_job(job_id)
    if not job or not job.next_run_time:
        return None
    return job.next_run_time.isoformat()
