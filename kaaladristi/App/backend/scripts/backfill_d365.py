"""
d365_pct_chng Backfill Script
==============================
Computes d365_pct_chng for all rows in km_equity_eod using actual calendar
dates: for each row, finds the close price closest to exactly 365 days ago
(not 252 bars), then computes (current - past) / past * 100.

Usage:
    cd App/backend
    python scripts/backfill_d365.py              # all equities
    python scripts/backfill_d365.py TITAN        # single symbol (test)
    python scripts/backfill_d365.py --verify     # just run verification
"""

import sys
import os
import time
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

BATCH_SIZE = 5000
TARGET_DAYS = 365


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=15)


def load_equity_ids(conn, symbol_filter=None):
    with conn.cursor() as cur:
        if symbol_filter:
            cur.execute(
                "SELECT id FROM km_equity_symbols WHERE symbol = %s",
                [symbol_filter],
            )
        else:
            cur.execute(
                "SELECT DISTINCT equity_id AS id FROM km_equity_eod ORDER BY equity_id"
            )
        return [r[0] for r in cur.fetchall()]


def load_rows_for_equity(conn, equity_id):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, trade_date, close
            FROM km_equity_eod
            WHERE equity_id = %s AND close IS NOT NULL
            ORDER BY trade_date ASC
            """,
            [equity_id],
        )
        return cur.fetchall()


def compute_d365(rows):
    """
    For each row find the close price closest to exactly 365 calendar days ago.
    Returns list of (id, d365_value) — skips rows with no past reference.
    """
    if not rows:
        return []

    dates = [r['trade_date'] for r in rows]
    closes = {r['trade_date']: float(r['close']) for r in rows}
    results = []

    for i, row in enumerate(rows):
        td = row['trade_date']
        target = td - timedelta(days=TARGET_DAYS)

        # Binary search for closest date to target
        lo, hi = 0, i - 1
        if hi < 0:
            continue

        best_date = None
        best_diff = None

        while lo <= hi:
            mid = (lo + hi) // 2
            d = dates[mid]
            diff = abs((d - target).days)
            if best_diff is None or diff < best_diff:
                best_diff = diff
                best_date = d
            if d < target:
                lo = mid + 1
            elif d > target:
                hi = mid - 1
            else:
                break

        # Only use if within 10 trading days (~14 calendar days) of target
        if best_date is None or best_diff > 14:
            continue

        past_close = closes[best_date]
        if past_close == 0:
            continue

        d365 = round((float(row['close']) - past_close) / past_close * 100, 2)
        results.append((row['id'], d365))

    return results


def batch_update(conn, updates):
    """updates: list of (d365_pct_chng, id)"""
    sql = """
        UPDATE km_equity_eod AS e
        SET d365_pct_chng = v.d365
        FROM (VALUES %s) AS v(d365, id)
        WHERE e.id = v.id
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, updates, page_size=BATCH_SIZE)
    conn.commit()


def run_verification(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                 AS total,
              COUNT(d365_pct_chng)     AS with_d365,
              MIN(d365_pct_chng)       AS min_val,
              MAX(d365_pct_chng)       AS max_val,
              ROUND(AVG(d365_pct_chng)::numeric, 2) AS avg_val
            FROM km_equity_eod
            WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
            """
        )
        row = dict(cur.fetchone())

    print(f'\n── Verification (latest date) ────────────────')
    print(f'  Total rows     : {row["total"]}')
    print(f'  With d365      : {row["with_d365"]}')
    print(f'  Min / Max / Avg: {row["min_val"]} / {row["max_val"]} / {row["avg_val"]}')

    # Spot check
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT s.symbol, e.close, e.d365_pct_chng, e.d30_pct_chng, e.trade_date
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
            d30  = f'{r["d30_pct_chng"]:>8.2f}' if r['d30_pct_chng']  is not None else f'{"NULL":>8}'
            d365 = f'{r["d365_pct_chng"]:>8.2f}' if r['d365_pct_chng'] is not None else f'{"NULL":>8}'
            print(f'  {r["symbol"]:<14} {float(r["close"]):>8.2f}  {d30}  {d365}')


def main():
    args        = sys.argv[1:]
    verify_only = '--verify' in args
    symbol      = next((a for a in args if not a.startswith('--')), None)

    conn = get_conn()

    if verify_only:
        run_verification(conn)
        conn.close()
        return

    print(f'd365_pct_chng backfill — calendar-date 365-day lookback, batch={BATCH_SIZE}')
    if symbol:
        print(f'  Mode: single symbol "{symbol}"')
    else:
        print(f'  Mode: all equities')

    equity_ids = load_equity_ids(conn, symbol_filter=symbol)
    if not equity_ids:
        print('  No equities found')
        conn.close()
        return

    total_symbols = len(equity_ids)
    print(f'  Processing {total_symbols} equity ID(s)...\n')

    t0            = time.time()
    total_rows    = 0
    pending_batch = []   # (d365_pct_chng, id)

    for i, eid in enumerate(equity_ids, 1):
        rows    = load_rows_for_equity(conn, eid)
        results = compute_d365(rows)

        for (row_id, d365_val) in results:
            pending_batch.append((d365_val, row_id))

        if len(pending_batch) >= BATCH_SIZE:
            batch_update(conn, pending_batch)
            total_rows    += len(pending_batch)
            pending_batch  = []

        if i % 500 == 0 or i == total_symbols:
            elapsed = time.time() - t0
            rate    = i / elapsed
            eta     = (total_symbols - i) / rate if rate > 0 else 0
            print(
                f'  [{i:>5}/{total_symbols}]  '
                f'{total_rows + len(pending_batch):>7} rows staged  '
                f'{elapsed:>5.0f}s elapsed  '
                f'ETA {eta:>4.0f}s'
            )

    if pending_batch:
        batch_update(conn, pending_batch)
        total_rows += len(pending_batch)

    elapsed = time.time() - t0
    print(f'\n  Done — {total_rows} rows updated in {elapsed:.1f}s')

    run_verification(conn)
    conn.close()


if __name__ == '__main__':
    main()
