"""Pipeline v2 worker.

Polls km_jobs for queued rows, dispatches to orchestrator or handler,
writes live progress + fill_rate_{before,after} back to km_jobs.

Usage:
    python -m pipeline2.worker --watch       # default: poll every 3s

Two job types:
    'daily_run'  -> orchestrator.run_daily(trade_date)
    'fix'        -> handlers.handle(dimension, ...)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta
from typing import Optional

import psycopg2
import psycopg2.extras

# Allow `python -m pipeline2.worker` AND `python pipeline2/worker.py` to work.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPT_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from lib.config import DATABASE_URL  # noqa: E402

from . import handlers  # noqa: E402
from . import orchestrator  # noqa: E402


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [pipeline2.worker] %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('pipeline2.worker')


# ── DB helpers ────────────────────────────────────────────────────────────

def _connect() -> 'psycopg2.extensions.connection':
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL not set')
    return psycopg2.connect(DATABASE_URL)


def _claim_job(conn) -> Optional[dict]:
    """Atomically claim the oldest queued job. Returns the row or None."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE km_jobs
               SET status = 'running', started_at = now()
             WHERE id = (
                 SELECT id FROM km_jobs
                  WHERE status = 'queued'
                  ORDER BY created_at
                  LIMIT 1
                  FOR UPDATE SKIP LOCKED
             )
            RETURNING *
            """
        )
        row = cur.fetchone()
    conn.commit()
    return dict(row) if row else None


def _update_job(conn, job_id: int, **fields) -> None:
    if not fields:
        return
    set_parts = []
    params: list = []
    for k, v in fields.items():
        set_parts.append(f'{k} = %s')
        params.append(v)
    params.append(job_id)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE km_jobs SET {', '.join(set_parts)} WHERE id = %s",
            params,
        )
    conn.commit()


def _is_cancelled(conn, job_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM km_jobs WHERE id = %s", [job_id])
        row = cur.fetchone()
    conn.commit()
    return bool(row and row[0] == 'cancelled')


# ── Job execution ─────────────────────────────────────────────────────────

def _run_fix(conn, job: dict) -> None:
    """Execute a fix:<dimension> job."""
    job_id = job['id']
    dim = job.get('dimension')
    trade_date_val = job.get('trade_date')
    force = bool(job.get('force'))
    exchange = job.get('exchange')

    if not dim:
        _update_job(conn, job_id, status='failed',
                    error_msg='fix job missing dimension',
                    completed_at=datetime.utcnow())
        return
    if trade_date_val is None:
        _update_job(conn, job_id, status='failed',
                    error_msg='fix job missing trade_date',
                    completed_at=datetime.utcnow())
        return

    trade_date_obj = trade_date_val if isinstance(trade_date_val, date) else \
                     date.fromisoformat(str(trade_date_val))

    def _progress(text: str, pct: int):
        if _is_cancelled(conn, job_id):
            raise RuntimeError('cancelled')
        _update_job(conn, job_id, progress_text=text[:500], progress_pct=min(max(pct, 0), 99))

    try:
        result = handlers.handle(dim, conn, trade_date_obj, force, exchange, _progress)
    except RuntimeError as e:
        if str(e) == 'cancelled':
            log.info(f'Job #{job_id}: cancelled mid-run')
            return
        conn.rollback()
        _update_job(conn, job_id, status='failed',
                    error_msg=str(e)[:500],
                    completed_at=datetime.utcnow(),
                    progress_pct=100)
        return
    except Exception as e:
        conn.rollback()
        _update_job(conn, job_id, status='failed',
                    error_msg=str(e)[:500],
                    completed_at=datetime.utcnow(),
                    progress_pct=100)
        return

    _update_job(
        conn, job_id,
        status=result.status,
        fill_rate_before=result.fill_rate_before,
        fill_rate_after=result.fill_rate_after,
        rows_affected=result.rows_affected,
        error_msg=result.error_msg,
        progress_text=f'done: {result.fill_rate_before:.1f}% → {result.fill_rate_after:.1f}%',
        progress_pct=100,
        completed_at=datetime.utcnow(),
    )
    log.info(
        f'Job #{job_id} ({dim} {trade_date_obj} force={force}): '
        f'{result.fill_rate_before:.1f}% -> {result.fill_rate_after:.1f}% '
        f'[{result.status}]'
    )


def _run_daily(conn, job: dict) -> None:
    """Execute a daily_run job."""
    job_id = job['id']
    trade_date_val = job.get('trade_date')
    if trade_date_val is None:
        _update_job(conn, job_id, status='failed',
                    error_msg='daily_run job missing trade_date',
                    completed_at=datetime.utcnow())
        return

    trade_date_obj = trade_date_val if isinstance(trade_date_val, date) else \
                     date.fromisoformat(str(trade_date_val))
    force = bool(job.get('force'))

    def _progress(text: str, pct: int):
        if _is_cancelled(conn, job_id):
            raise RuntimeError('cancelled')
        _update_job(conn, job_id, progress_text=text[:500], progress_pct=min(max(pct, 0), 99))

    try:
        outcome = orchestrator.run_daily(conn, trade_date_obj, _progress, force=force)
    except RuntimeError as e:
        if str(e) == 'cancelled':
            log.info(f'Job #{job_id}: cancelled mid-run')
            return
        conn.rollback()
        _update_job(conn, job_id, status='failed',
                    error_msg=str(e)[:500],
                    completed_at=datetime.utcnow(),
                    progress_pct=100)
        return
    except Exception as e:
        conn.rollback()
        _update_job(conn, job_id, status='failed',
                    error_msg=str(e)[:500],
                    completed_at=datetime.utcnow(),
                    progress_pct=100)
        return

    # Summarise: rows_affected = sum across steps; fill_rate_after = avg.
    rows = sum(s.rows_affected for s in outcome.steps)
    after_vals = [s.fill_rate_after for s in outcome.steps]
    before_vals = [s.fill_rate_before for s in outcome.steps]
    after_avg = round(sum(after_vals) / max(len(after_vals), 1), 2)
    before_avg = round(sum(before_vals) / max(len(before_vals), 1), 2)
    errors = [s.error_msg for s in outcome.steps if s.error_msg]

    _update_job(
        conn, job_id,
        status=outcome.overall_status,
        fill_rate_before=before_avg,
        fill_rate_after=after_avg,
        rows_affected=rows,
        error_msg='; '.join(errors)[:500] if errors else None,
        progress_text=f'daily_run {outcome.overall_status} '
                      f'({len(outcome.steps)} steps, {rows} rows)',
        progress_pct=100,
        completed_at=datetime.utcnow(),
    )
    log.info(f'Job #{job_id} daily_run {trade_date_obj}: {outcome.overall_status} '
             f'({len(outcome.steps)} steps, {rows} rows)')


# ── Backfill ──────────────────────────────────────────────────────────────

def _trading_days_between(conn, from_d: date, to_d: date) -> list[date]:
    """Weekdays between from_d..to_d inclusive, excluding holidays and
    no_data dates from km_trading_calendar. Returns oldest-first."""
    skips: set[str] = set()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT trade_date FROM km_trading_calendar "
            "WHERE (is_holiday = TRUE OR status IN ('holiday','no_data','weekend')) "
            "  AND trade_date BETWEEN %s AND %s",
            [str(from_d), str(to_d)],
        )
        skips = {str(r[0]) for r in cur.fetchall()}
    conn.commit()

    out: list[date] = []
    cursor = from_d
    while cursor <= to_d:
        if cursor.weekday() < 5 and str(cursor) not in skips:
            out.append(cursor)
        cursor += timedelta(days=1)
    return out


def _run_backfill(conn, job: dict) -> None:
    """Execute a backfill job: loop trading days in [date_from, date_to]
    and invoke the single-date handler for each.

    Aggregates rows_affected across the range. Reports before = fill rate
    on the first date and after = fill rate on the last date (individual
    per-date fill rates are still visible via the progress text)."""
    from . import handlers

    job_id = job['id']
    dim = job.get('dimension')
    from_val = job.get('date_from')
    to_val = job.get('date_to')
    force = bool(job.get('force'))
    exchange = job.get('exchange')

    if not dim:
        _update_job(conn, job_id, status='failed',
                    error_msg='backfill job missing dimension',
                    completed_at=datetime.utcnow())
        return
    if from_val is None or to_val is None:
        _update_job(conn, job_id, status='failed',
                    error_msg='backfill job missing date_from / date_to',
                    completed_at=datetime.utcnow())
        return

    from_d = from_val if isinstance(from_val, date) else date.fromisoformat(str(from_val))
    to_d   = to_val   if isinstance(to_val,   date) else date.fromisoformat(str(to_val))

    # Safety-net: backfill handler refuses download dims (API rejects too).
    from .health import DOWNLOAD_DIMENSIONS
    if dim in DOWNLOAD_DIMENSIONS:
        _update_job(conn, job_id, status='failed',
                    error_msg='Download backfill not yet implemented',
                    completed_at=datetime.utcnow())
        return

    try:
        dates = _trading_days_between(conn, from_d, to_d)
    except Exception as e:
        conn.rollback()
        _update_job(conn, job_id, status='failed',
                    error_msg=f'failed to resolve trading days: {e}'[:500],
                    completed_at=datetime.utcnow())
        return

    if not dates:
        _update_job(conn, job_id, status='completed',
                    progress_text=f'No trading days in {from_d}..{to_d}',
                    progress_pct=100,
                    rows_affected=0,
                    completed_at=datetime.utcnow())
        log.info(f'Job #{job_id}: backfill {dim} {from_d}..{to_d} — 0 trading days')
        return

    total = len(dates)
    log.info(f'Job #{job_id}: backfill {dim} {from_d}..{to_d} — {total} trading days')

    # before = fill rate on the earliest date (cheap one-shot read).
    from .health import fill_rate
    try:
        before = fill_rate(conn, dim, dates[0])
    except Exception as e:
        log.warning(f'Job #{job_id}: before fill_rate read failed: {e}')
        before = None

    rows_total = 0
    last_after: float | None = None
    errors: list[str] = []
    partial_count = 0

    for i, td in enumerate(dates):
        if _is_cancelled(conn, job_id):
            log.info(f'Job #{job_id}: cancelled mid-backfill at {td} ({i+1}/{total})')
            return

        pct = int(i / total * 99)
        _update_job(conn, job_id,
                    progress_text=f'{i+1}/{total} · {td}: running…',
                    progress_pct=pct)

        try:
            # Noop progress callback — per-date progress is captured via
            # the progress_text update above. Avoids spamming the job row.
            result = handlers.handle(
                dim, conn, td, force, exchange, lambda _t, _p: None,
            )
        except Exception as e:
            conn.rollback()
            errors.append(f'{td}: {str(e)[:120]}')
            log.error(f'Job #{job_id}: {dim} {td} failed — {e}')
            continue

        rows_total += int(result.rows_affected or 0)
        last_after = result.fill_rate_after
        if result.status == 'failed':
            errors.append(f'{td}: {result.error_msg or "failed"}')
        elif result.status == 'partial':
            partial_count += 1

        _update_job(conn, job_id,
                    progress_text=f'{i+1}/{total} · {td}: '
                                  f'{result.fill_rate_before:.1f}% → '
                                  f'{result.fill_rate_after:.1f}% '
                                  f'[{result.status}]',
                    progress_pct=pct)

    # Terminal status: failed > partial > completed.
    if errors and not (total - len(errors)):
        terminal = 'failed'
    elif errors or partial_count:
        terminal = 'partial'
    else:
        terminal = 'completed'

    summary = (
        f'{terminal}: {total} dates, {rows_total} rows'
        + (f', {len(errors)} errors' if errors else '')
        + (f', {partial_count} partial' if partial_count else '')
    )

    _update_job(
        conn, job_id,
        status=terminal,
        fill_rate_before=before,
        fill_rate_after=last_after,
        rows_affected=rows_total,
        error_msg='; '.join(errors[:3])[:500] if errors else None,
        progress_text=summary,
        progress_pct=100,
        completed_at=datetime.utcnow(),
    )
    log.info(f'Job #{job_id}: {summary}')


# ── Main loop ─────────────────────────────────────────────────────────────

def process_one(conn) -> bool:
    """Claim one job, execute it, return True if work was done."""
    job = _claim_job(conn)
    if not job:
        return False

    job_id = job['id']
    job_type = job.get('job_type')
    log.info(f'Job #{job_id}: claimed {job_type} (dimension={job.get("dimension")}, '
             f'trade_date={job.get("trade_date")}, force={job.get("force")})')

    if job_type == 'fix':
        _run_fix(conn, job)
    elif job_type == 'daily_run':
        _run_daily(conn, job)
    elif job_type == 'backfill':
        _run_backfill(conn, job)
    else:
        _update_job(conn, job_id, status='failed',
                    error_msg=f'Unknown job_type: {job_type}',
                    completed_at=datetime.utcnow())
    return True


def main():
    parser = argparse.ArgumentParser(description='Kāla-Drishti pipeline v2 worker')
    parser.add_argument('--watch', nargs='?', const=3, type=int,
                        help='Poll continuously (default: every 3s)')
    args = parser.parse_args()

    conn = _connect()
    try:
        if args.watch:
            interval = args.watch
            log.info(f'Worker started (watch mode, {interval}s)')
            while True:
                try:
                    processed = process_one(conn)
                except Exception as loop_err:
                    log.error(f'Loop error: {loop_err}')
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    time.sleep(interval)
                    continue
                if not processed:
                    time.sleep(interval)
        else:
            log.info('Worker started (one-shot mode)')
            count = 0
            while process_one(conn):
                count += 1
            log.info(f'Processed {count} job(s), exiting')
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == '__main__':
    main()
