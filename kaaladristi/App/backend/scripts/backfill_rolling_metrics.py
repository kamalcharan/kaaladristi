"""
Rolling Metrics Backfill — pure SQL, no Python import chain
=============================================================
Computes w52_high, w52_low, lifetime_high directly via PostgreSQL window
functions. No dependency on compute_engine.py or indicators package.

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
                    COUNT(lifetime_high)   AS lifetime_high_count
                FROM km_equity_eod
                WHERE trade_date = %s
            """, [target_date])
            row = cur.fetchone()
            total, w52h, w52l, lth = row
            print(f"\n[verify] trade_date = {target_date}")
            print(f"  total_rows    = {total}")
            print(f"  w52_high      = {w52h}")
            print(f"  w52_low       = {w52l}")
            print(f"  lifetime_high = {lth}")
            if total and w52h and total == w52h:
                print(f"\n✓ All {total} rows populated correctly.")
            else:
                print(f"\n⚠ {(total or 0) - (w52h or 0)} rows still have NULL w52_high.")
    finally:
        conn.close()


def run_update(target_date: str):
    """
    UPDATE km_equity_eod for target_date using window functions over full
    history. Computes w52_high (252-bar max high), w52_low (252-bar min low),
    lifetime_high (expanding max high).
    """
    sql = """
UPDATE km_equity_eod e
SET
    w52_high      = sub.w52h,
    w52_low       = sub.w52l,
    lifetime_high = sub.lth
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
        ) AS lth
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
