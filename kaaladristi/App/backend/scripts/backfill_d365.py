"""
d365_pct_chng Backfill Script
==============================
Computes d365_pct_chng for all rows in km_equity_eod using actual calendar
dates: for each row finds the closest trading-day close on or before
365 calendar days ago (tolerance: within 30 days), then computes
(current - past) / past * 100.

Uses bisect_left for O(log n) date lookup per row.

Usage:
    cd App/backend
    python scripts/backfill_d365.py              # all equities
    python scripts/backfill_d365.py --verify     # just run verification
"""

import sys
import os
import time
from bisect import bisect_left
from datetime import timedelta, date as _date
from collections import defaultdict

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

BATCH_SIZE   = 5000
TARGET_DAYS  = 365
MAX_LOOKBACK = 30   # days tolerance


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def run_verification(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                              AS total,
              COUNT(d365_pct_chng)                                  AS filled,
              ROUND(
                COUNT(d365_pct_chng)::numeric / COUNT(*)::numeric * 100, 1
              )                                                     AS fill_pct
            FROM km_equity_eod
            WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
            """
        )
        row = dict(cur.fetchone())

    print(f'\n── Verification (latest date) ────────────────────')
    print(f'  Total rows : {row["total"]}')
    print(f'  Filled     : {row["filled"]}')
    print(f'  Fill %     : {row["fill_pct"]}%')

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT s.symbol, e.close, e.d30_pct_chng, e.d365_pct_chng
            FROM km_equity_eod e
            JOIN km_equity_symbols s ON e.equity_id = s.id
            WHERE e.trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
              AND s.symbol IN ('STLTECH','HFCL','TITAN','BHARATFORG','COALINDIA','DIVISLAB')
            ORDER BY s.symbol
            """
        )
        rows = cur.fetchall()

    if rows:
        print(f'\n  Spot check:')
        print(f'  {"Symbol":<14} {"Close":>8}  {"d30%":>8}  {"d365%":>8}')
        print(f'  {"-"*44}')
        for r in rows:
            d30  = f'{r["d30_pct_chng"]:>8.2f}'  if r['d30_pct_chng']  is not None else f'{"NULL":>8}'
            d365 = f'{r["d365_pct_chng"]:>8.2f}' if r['d365_pct_chng'] is not None else f'{"NULL":>8}'
            print(f'  {r["symbol"]:<14} {float(r["close"]):>8.2f}  {d30}  {d365}')


def _compute_d365(conn, date_arg=None) -> int:
    """Core d365 computation. Shared by main() CLI and compute_d365_for_date() pipeline."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if date_arg:
            # Only need ~400 trading days back (365 calendar days + 30 day tolerance).
            # Loading full history caused multi-hour hangs on ~1.7M rows.
            cur.execute("""
                SELECT id, equity_id, trade_date, close
                FROM km_equity_eod
                WHERE close IS NOT NULL
                  AND equity_id IN (
                    SELECT DISTINCT equity_id FROM km_equity_eod
                    WHERE trade_date = %s
                  )
                  AND trade_date <= %s
                  AND trade_date >= (
                      SELECT MIN(d) FROM (
                          SELECT trade_date AS d
                          FROM km_equity_eod
                          WHERE trade_date <= %s
                          ORDER BY trade_date DESC
                          LIMIT 450
                      ) sub
                  )
                ORDER BY equity_id, trade_date ASC
            """, [date_arg, date_arg, date_arg])
        else:
            cur.execute("""
                SELECT id, equity_id, trade_date, close
                FROM km_equity_eod
                WHERE close IS NOT NULL
                ORDER BY equity_id, trade_date ASC
            """)
        all_rows = cur.fetchall()

    groups = defaultdict(list)
    for row in all_rows:
        groups[row['equity_id']].append(row)

    pending_batch = []
    total_rows = 0
    # psycopg2 returns datetime.date objects; convert target for comparison
    target_dt = _date.fromisoformat(date_arg) if date_arg else None

    for equity_id, rows in groups.items():
        dates  = [r['trade_date'] for r in rows]
        closes = [float(r['close']) for r in rows]

        for i, row in enumerate(rows):
            if target_dt and row['trade_date'] != target_dt:
                continue

            target_date = row['trade_date'] - timedelta(days=TARGET_DAYS)
            j = bisect_left(dates, target_date, 0, i)
            if j > 0 and (j >= i or dates[j] > target_date):
                j -= 1
            if j < 0 or j >= i:
                continue
            diff = abs((dates[j] - target_date).days)
            if diff > MAX_LOOKBACK:
                continue
            past_close = closes[j]
            if past_close == 0:
                continue

            d365 = round((closes[i] - past_close) / past_close * 100, 2)
            pending_batch.append((d365, row['id']))

        if len(pending_batch) >= BATCH_SIZE:
            sql = """
                UPDATE km_equity_eod AS e
                SET d365_pct_chng = v.d365
                FROM (VALUES %s) AS v(d365, id)
                WHERE e.id = v.id
            """
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, sql, pending_batch, page_size=BATCH_SIZE)
            conn.commit()
            total_rows   += len(pending_batch)
            pending_batch  = []

    if pending_batch:
        sql = """
            UPDATE km_equity_eod AS e
            SET d365_pct_chng = v.d365
            FROM (VALUES %s) AS v(d365, id)
            WHERE e.id = v.id
        """
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, sql, pending_batch, page_size=BATCH_SIZE)
        conn.commit()
        total_rows += len(pending_batch)

    return total_rows


# ── Pipeline entry point ──────────────────────────────────────────────────

def compute_d365_for_date(db_conn, trade_date, verbose=False) -> int:
    """Called from daily_pipeline.py after rolling_metrics.
    Opens its own psycopg2 connection — db_conn is accepted but unused.
    """
    conn = get_conn()
    try:
        n = _compute_d365(conn, date_arg=str(trade_date))
        if verbose:
            print(f"  [d365] {n} rows updated for {trade_date}")
        return n
    finally:
        conn.close()


def main():
    args        = sys.argv[1:]
    verify_only = '--verify' in args
    date_arg    = next((a.split('=',1)[1] if '=' in a else None
                        for a in args if a.startswith('--date')), None)
    if date_arg is None:
        date_arg = next((a for a in args
                         if not a.startswith('--') and len(a) == 10 and a[4] == '-'), None)

    conn = get_conn()

    if verify_only:
        run_verification(conn)
        conn.close()
        return

    print(f'd365_pct_chng backfill — calendar 365-day lookback, batch={BATCH_SIZE}')
    if date_arg:
        print(f'  Mode: single date {date_arg}')
    else:
        print(f'  Mode: full history')
    print(f'  Loading rows from km_equity_eod...')

    t0 = time.time()
    total_rows = _compute_d365(conn, date_arg=date_arg)
    elapsed = time.time() - t0
    print(f'\n  Done — {total_rows:,} rows updated in {elapsed:.1f}s')

    run_verification(conn)
    conn.close()


if __name__ == '__main__':
    main()
