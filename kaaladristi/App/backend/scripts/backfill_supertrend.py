"""
SuperTrend Backfill Script
==========================
Computes supertrend and supertrend_dir for all rows in km_equity_eod
where atr_10 IS NOT NULL.

Parameters: ATR period=10, multiplier=3.0 (standard settings)
Column written: supertrend (NUMERIC), supertrend_dir (SMALLINT: 1 or -1)

Usage:
    cd App/backend
    python scripts/backfill_supertrend.py              # all equities
    python scripts/backfill_supertrend.py TITAN        # single symbol (test)
    python scripts/backfill_supertrend.py --verify     # just run verification query
"""

import sys
import os
import time
from collections import defaultdict
from datetime import date as _date
import psycopg2
import psycopg2.extras

# ── DB connection ──────────────────────────────────────────────────────────

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

MULTIPLIER = 3.0
BATCH_SIZE = 1000


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=15)


# ── Core algorithm ─────────────────────────────────────────────────────────

def compute_supertrend(rows):
    """
    Given a list of dicts (id, high, low, close, atr_10) sorted ASC by trade_date,
    return a list of (id, supertrend_value, direction) tuples.

    direction: 1 = bullish (price above supertrend), -1 = bearish.
    Rows without atr_10 are skipped; their id is NOT included in output.
    """
    prev_direction  = 1
    prev_lower_band = 0.0
    prev_upper_band = 0.0
    first_valid     = True
    results         = []

    for row in rows:
        atr = row['atr_10']
        if atr is None:
            continue

        high  = float(row['high'])
        low   = float(row['low'])
        close = float(row['close'])
        atr   = float(atr)

        hl2         = (high + low) / 2.0
        upper_band  = hl2 + MULTIPLIER * atr
        lower_band  = hl2 - MULTIPLIER * atr

        if first_valid:
            direction       = 1
            final_upper     = upper_band
            final_lower     = lower_band
            supertrend_val  = lower_band
            first_valid     = False
        else:
            # Carry-forward bands (prevent band from moving against trend)
            if prev_direction == 1:
                final_lower = max(lower_band, prev_lower_band)
                final_upper = upper_band
            else:
                final_upper = min(upper_band, prev_upper_band)
                final_lower = lower_band

            # Direction flip logic
            if prev_direction == 1:
                if close < final_lower:
                    direction      = -1
                    supertrend_val = final_upper
                else:
                    direction      = 1
                    supertrend_val = final_lower
            else:
                if close > final_upper:
                    direction      = 1
                    supertrend_val = final_lower
                else:
                    direction      = -1
                    supertrend_val = final_upper

        prev_direction  = direction
        prev_lower_band = final_lower
        prev_upper_band = final_upper

        results.append((row['id'], round(supertrend_val, 4), direction))

    return results


# ── DB helpers ─────────────────────────────────────────────────────────────

def load_equity_ids(conn, symbol_filter=None):
    """Return list of equity_ids to process (all, or one by symbol name)."""
    with conn.cursor() as cur:
        if symbol_filter:
            cur.execute(
                "SELECT id FROM km_equity_symbols WHERE symbol = %s",
                [symbol_filter],
            )
        else:
            cur.execute(
                """
                SELECT DISTINCT equity_id AS id
                FROM km_equity_eod
                WHERE atr_10 IS NOT NULL
                ORDER BY equity_id
                """
            )
        return [r[0] for r in cur.fetchall()]


def load_rows_for_equity(conn, equity_id):
    """Load all OHLCV + atr_10 rows for one equity, sorted ASC."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, high, low, close, atr_10
            FROM km_equity_eod
            WHERE equity_id = %s
            ORDER BY trade_date ASC
            """,
            [equity_id],
        )
        return cur.fetchall()


def batch_update(conn, updates):
    """
    Batch UPDATE using execute_values for speed.
    updates: list of (supertrend, supertrend_dir, id)
    """
    sql = """
        UPDATE km_equity_eod AS e
        SET supertrend     = v.supertrend,
            supertrend_dir = v.supertrend_dir
        FROM (VALUES %s) AS v(supertrend, supertrend_dir, id)
        WHERE e.id = v.id
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, updates, page_size=BATCH_SIZE)
    conn.commit()


# ── Verification ───────────────────────────────────────────────────────────

def run_verification(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)                                               AS total,
              COUNT(supertrend_dir)                                  AS with_dir,
              SUM(CASE WHEN supertrend_dir =  1 THEN 1 ELSE 0 END)  AS bullish,
              SUM(CASE WHEN supertrend_dir = -1 THEN 1 ELSE 0 END)  AS bearish
            FROM km_equity_eod
            WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
            """
        )
        row = dict(cur.fetchone())
    total   = row['total']
    with_d  = row['with_dir']
    bull    = row['bullish'] or 0
    bear    = row['bearish'] or 0
    pct_b   = round(bull / with_d * 100, 1) if with_d else 0
    print(f'\n── Verification ──────────────────────────────')
    print(f'  Latest-date rows   : {total}')
    print(f'  With supertrend_dir: {with_d}')
    print(f'  Bullish (dir=1)    : {bull}  ({pct_b}%)')
    print(f'  Bearish (dir=-1)   : {bear}  ({100 - pct_b}%)')

    cur2 = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur2.execute(
        """
        SELECT s.symbol, e.close, e.supertrend, e.supertrend_dir, e.atr_10
        FROM km_equity_eod e
        JOIN km_equity_symbols s ON e.equity_id = s.id
        WHERE e.trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
          AND s.symbol IN (
            'STLTECH','BAJFINANCE','BEL','TITAN','HFCL','TVSMOTOR'
          )
        ORDER BY s.symbol
        """
    )
    rows = cur2.fetchall()
    cur2.close()
    if rows:
        print(f'\n  Spot check:')
        print(f'  {"Symbol":<14} {"Close":>8}  {"Supertrend":>10}  {"Dir":>4}  {"ATR":>7}')
        print(f'  {"-"*50}')
        for r in rows:
            st   = r['supertrend']
            atr  = r['atr_10']
            d    = r['supertrend_dir']
            arrow = ('▲' if d == 1 else '▼') if d is not None else ' '
            st_str  = f'{float(st):>10.2f}' if st  is not None else f'{"NULL":>10}'
            atr_str = f'{float(atr):>7.2f}'  if atr is not None else f'{"NULL":>7}'
            dir_str = f'{arrow}{d:>2}'        if d   is not None else f'  --'
            print(
                f'  {r["symbol"]:<14} '
                f'{float(r["close"]):>8.2f}  '
                f'{st_str}  '
                f'{dir_str}  '
                f'{atr_str}'
            )


# ── Pipeline entry point ──────────────────────────────────────────────────

def compute_supertrend_for_date(db_conn, trade_date, verbose=False) -> int:
    """Called from daily_pipeline.py after compute_all_pending_indicators.
    Opens its own psycopg2 connection -- db_conn is accepted but unused.
    Loads last 600 trading days per equity -- sufficient for state machine
    accuracy (converges within ~50 bars), avoids full-history scan.
    """
    conn = get_conn()
    try:
        target = str(trade_date)
        target_dt = _date.fromisoformat(target)

        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT equity_id FROM km_equity_eod
                WHERE trade_date = %s AND atr_10 IS NOT NULL
            """, [target])
            equity_ids = [r[0] for r in cur.fetchall()]

        if not equity_ids:
            if verbose:
                print(f"  [supertrend] No equities with atr_10 for {target}")
            return 0

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, equity_id, trade_date, high, low, close, atr_10
                FROM km_equity_eod
                WHERE equity_id = ANY(%s)
                  AND trade_date <= %s
                  AND trade_date >= (
                      SELECT MIN(d) FROM (
                          SELECT trade_date AS d
                          FROM km_equity_eod
                          WHERE trade_date <= %s
                          ORDER BY trade_date DESC
                          LIMIT 600
                      ) sub
                  )
                ORDER BY equity_id, trade_date ASC
            """, [equity_ids, target, target])
            all_rows = cur.fetchall()

        groups = defaultdict(list)
        for r in all_rows:
            groups[r['equity_id']].append(r)

        pending_batch = []
        for eid, rows in groups.items():
            results = compute_supertrend(rows)
            target_ids = {r['id'] for r in rows if r['trade_date'] == target_dt}
            for (row_id, st_val, st_dir) in results:
                if row_id in target_ids:
                    pending_batch.append((st_val, st_dir, row_id))

        if not pending_batch:
            return 0

        batch_update(conn, pending_batch)
        if verbose:
            print(f"  [supertrend] {len(pending_batch)} rows updated for {target}")
        return len(pending_batch)
    finally:
        conn.close()


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    args        = sys.argv[1:]
    verify_only = '--verify' in args
    date_arg    = next((a.split('=', 1)[1] if '=' in a else None
                        for a in args if a.startswith('--date')), None)
    if date_arg is None:
        date_arg = next((a for a in args
                         if not a.startswith('--') and len(a) == 10 and a[4] == '-'), None)
    symbol      = next((a for a in args
                        if not a.startswith('--') and not (len(a) == 10 and a[4] == '-')), None)

    conn = get_conn()

    if verify_only:
        run_verification(conn)
        conn.close()
        return

    if date_arg:
        print(f'SuperTrend for single date {date_arg}')
        n = compute_supertrend_for_date(None, date_arg, verbose=True)
        print(f'  Done -- {n} rows updated')
        conn.close()
        return

    print(f'SuperTrend backfill -- multiplier={MULTIPLIER}, batch={BATCH_SIZE}')
    if symbol:
        print(f'  Mode: single symbol "{symbol}"')
    else:
        print(f'  Mode: all equities with atr_10')

    equity_ids = load_equity_ids(conn, symbol_filter=symbol)
    if not equity_ids:
        print('  No equities found -- check symbol name or atr_10 population')
        conn.close()
        return

    total_symbols = len(equity_ids)
    print(f'  Processing {total_symbols} equity ID(s)...\n')

    t0             = time.time()
    total_rows     = 0
    pending_batch  = []

    for i, eid in enumerate(equity_ids, 1):
        rows    = load_rows_for_equity(conn, eid)
        results = compute_supertrend(rows)

        for (row_id, st_val, st_dir) in results:
            pending_batch.append((st_val, st_dir, row_id))

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
    print(f'\n  Done -- {total_rows} rows updated in {elapsed:.1f}s')

    run_verification(conn)
    conn.close()


if __name__ == '__main__':
    main()
