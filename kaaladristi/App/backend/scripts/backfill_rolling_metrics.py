"""
Rolling Metrics Backfill — pure SQL, no Python import chain
=============================================================
Computes w52_high, w52_low, lifetime_high, avg_amt_5d, avg_amt_22d,
and delivery_surge_x directly via PostgreSQL window functions.
No dependency on compute_engine.py or indicators package.

Usage:
    cd App/backend
    python scripts/backfill_rolling_metrics.py --date 2026-06-03
    python scripts/backfill_rolling_metrics.py --date 2026-06-03 --verify
"""

import sys
import os
import argparse
import psycopg2
import psycopg2.extras
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def verify(target_date: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*)               AS total_rows,
                    COUNT(w52_high)        AS w52_high_count,
                    COUNT(w52_low)         AS w52_low_count,
                    COUNT(lifetime_high)   AS lifetime_high_count,
                    COUNT(avg_amt_5d)      AS avg_amt_5d_count,
                    COUNT(avg_amt_22d)     AS avg_amt_22d_count,
                    COUNT(delivery_surge_x) AS surge_x_count
                FROM km_equity_eod
                WHERE trade_date = %s
            """, [target_date])
            row = cur.fetchone()
            total, w52h, w52l, lth, amt5, amt22, surge = row
            print(f"\n[verify] trade_date = {target_date}")
            print(f"  total_rows      = {total}")
            print(f"  w52_high        = {w52h}")
            print(f"  w52_low         = {w52l}")
            print(f"  lifetime_high   = {lth}")
            print(f"  avg_amt_5d      = {amt5}")
            print(f"  avg_amt_22d     = {amt22}")
            print(f"  delivery_surge_x= {surge}")
            if total and w52h and total == w52h:
                print(f"\n✓ All {total} rows populated correctly.")
            else:
                print(f"\n⚠ {(total or 0) - (w52h or 0)} rows still have NULL w52_high.")
    finally:
        conn.close()


def run_update(target_date: str):
    """
    UPDATE km_equity_eod for target_date using window functions over full
    history. Computes:
      - w52_high, w52_low    : 52-week (252-bar) rolling high/low
      - lifetime_high        : expanding max from first record
      - avg_amt_5d/22d       : AVG(delivery_qty * close / 10M) over 5/22 bars
                               matches migration 054 definition (delivery value in Cr)
      - delivery_surge_x     : avg_amt_5d / avg_amt_22d
    No dependency on compute_engine.py.
    """
    sql = """
UPDATE km_equity_eod e
SET
    w52_high          = sub.w52h,
    w52_low           = sub.w52l,
    lifetime_high     = sub.lth,
    avg_amt_5d        = sub.amt5,
    avg_amt_22d       = sub.amt22,
    delivery_surge_x  = sub.surge_x
FROM (
    SELECT
        id,
        trade_date,
        MAX(high) OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
        ) AS w52h,
        MIN(low) OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
        ) AS w52l,
        MAX(high) OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS lth,
        ROUND(AVG(ROUND((COALESCE(delivery_qty, 0) * close / 10000000.0)::numeric, 4)) OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ), 4) AS amt5,
        ROUND(AVG(ROUND((COALESCE(delivery_qty, 0) * close / 10000000.0)::numeric, 4)) OVER (
            PARTITION BY equity_id
            ORDER BY trade_date
            ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
        ), 4) AS amt22,
        CASE
            WHEN ROUND(AVG(ROUND((COALESCE(delivery_qty, 0) * close / 10000000.0)::numeric, 4)) OVER (
                PARTITION BY equity_id
                ORDER BY trade_date
                ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
            ), 4) > 0
            THEN ROUND(
                ROUND(AVG(ROUND((COALESCE(delivery_qty, 0) * close / 10000000.0)::numeric, 4)) OVER (
                    PARTITION BY equity_id
                    ORDER BY trade_date
                    ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
                ), 4)
                /
                ROUND(AVG(ROUND((COALESCE(delivery_qty, 0) * close / 10000000.0)::numeric, 4)) OVER (
                    PARTITION BY equity_id
                    ORDER BY trade_date
                    ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
                ), 4)
            , 4)
            ELSE NULL
        END AS surge_x
    FROM km_equity_eod
) sub
WHERE e.id = sub.id
  AND sub.trade_date = %s
"""
    print(f"\n[update] Running window-function UPDATE for {target_date}...")
    print("  (scans full history — may take 30-90 seconds)")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, [target_date])
            updated = cur.rowcount
        conn.commit()
        print(f"  Updated {updated} rows.")
        return updated
    finally:
        conn.close()


def compute_rolling_metrics_for_date(db_conn, trade_date, verbose=False) -> int:
    """Pipeline entry point. Pure SQL — no indicators.calculators dependency.
    db_conn is accepted but unused (opens its own psycopg2 connection).
    """
    n = run_update(str(trade_date))
    if verbose:
        print(f"  [rolling_metrics] {n} rows updated for {trade_date}")
    return n


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=str(date.today()), help='Trade date YYYY-MM-DD (default: today)')
    parser.add_argument('--verify', action='store_true', help='Only verify, no update')
    args = parser.parse_args()

    target_date = args.date

    if args.verify:
        verify(target_date)
        return

    verify(target_date)   # before
    run_update(target_date)
    verify(target_date)   # after


if __name__ == '__main__':
    main()
