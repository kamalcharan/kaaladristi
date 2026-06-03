"""
Rolling Metrics Backfill
=========================
Runs compute_rolling_metrics_for_date() for one or more trade dates.

Usage:
    cd App/backend
    python scripts/backfill_rolling_metrics.py                # today (2026-06-03)
    python scripts/backfill_rolling_metrics.py --date 2026-06-03
    python scripts/backfill_rolling_metrics.py --date 2026-06-03 --verify

Populates: w52_high, w52_low, lifetime_high, d30_pct_chng, d365_pct_chng,
           avg_amt_5d, avg_amt_22d, delivery_surge_x

This is the same code that daily_pipeline.py step 6g runs automatically.
Use this script to re-run it manually after a missed pipeline run.
"""

import sys
import os
import argparse
import psycopg2
import psycopg2.extras
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from lib.db_client import PostgreSQLClient


def verify(target_date: str):
    """Print null counts for w52/lifetime columns on target_date."""
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*)           AS total_rows,
                    COUNT(w52_high)    AS w52_high_count,
                    COUNT(w52_low)     AS w52_low_count,
                    COUNT(lifetime_high) AS lifetime_high_count,
                    COUNT(d30_pct_chng)  AS d30_count,
                    COUNT(avg_amt_5d)    AS avg_amt_5d_count
                FROM km_equity_eod
                WHERE trade_date = %s
            """, [target_date])
            row = cur.fetchone()
            print(f"\n[verify] trade_date = {target_date}")
            print(f"  total_rows        = {row[0]}")
            print(f"  w52_high          = {row[1]}")
            print(f"  w52_low           = {row[2]}")
            print(f"  lifetime_high     = {row[3]}")
            print(f"  d30_pct_chng      = {row[4]}")
            print(f"  avg_amt_5d        = {row[5]}")
            if row[0] and row[1] and row[0] == row[1]:
                print(f"\n✓ All {row[0]} rows populated correctly.")
            else:
                print(f"\n⚠ {row[0] - (row[1] or 0)} rows still have NULL w52_high.")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=str(date.today()), help='Trade date YYYY-MM-DD')
    parser.add_argument('--verify', action='store_true', help='Only run verification, no update')
    args = parser.parse_args()

    target_date = args.date

    if args.verify:
        verify(target_date)
        return

    if not DATABASE_URL:
        print('ERROR: DATABASE_URL / DB_PRIMARY not set in .env')
        sys.exit(1)

    print(f"[rolling_metrics] Running for trade_date = {target_date}")
    verify(target_date)  # show before state

    # Run via the existing compute function
    from indicators.compute_engine import compute_rolling_metrics_for_date

    db = PostgreSQLClient(DATABASE_URL)
    updated = compute_rolling_metrics_for_date(db, target_date, verbose=True)
    print(f"\n[rolling_metrics] Updated {updated} rows for {target_date}")

    verify(target_date)  # show after state


if __name__ == '__main__':
    main()
