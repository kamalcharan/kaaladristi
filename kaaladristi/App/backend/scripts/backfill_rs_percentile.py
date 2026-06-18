"""
RS Percentile Backfill Script
==============================
Computes rs_percentile for km_equity_eod using PERCENT_RANK() over magic_rs
partitioned by trade_date. Each equity gets a 0.00–100.00 score reflecting
its relative-strength rank within the full universe on that date.

Only rows where magic_rs IS NOT NULL are scored. Rows without magic_rs
remain NULL (magic_rs must be computed first — pipeline step 6a).

Usage:
    cd App/backend
    python scripts/backfill_rs_percentile.py --date 2026-06-17
    python scripts/backfill_rs_percentile.py --date 2026-06-17 --verify
    python scripts/backfill_rs_percentile.py --all        # backfill full history
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


_SQL_SINGLE_DATE = """
    UPDATE km_equity_eod e
    SET rs_percentile = sub.pct
    FROM (
        SELECT id,
            ROUND(
                PERCENT_RANK() OVER (
                    PARTITION BY trade_date
                    ORDER BY magic_rs ASC NULLS LAST
                )::numeric * 100, 2
            ) AS pct
        FROM km_equity_eod
        WHERE trade_date = %s
          AND magic_rs IS NOT NULL
    ) sub
    WHERE e.id = sub.id
      AND e.trade_date = %s;
"""

_SQL_ALL_DATES = """
    UPDATE km_equity_eod e
    SET rs_percentile = sub.pct
    FROM (
        SELECT id,
            ROUND(
                PERCENT_RANK() OVER (
                    PARTITION BY trade_date
                    ORDER BY magic_rs ASC NULLS LAST
                )::numeric * 100, 2
            ) AS pct
        FROM km_equity_eod
        WHERE magic_rs IS NOT NULL
    ) sub
    WHERE e.id = sub.id;
"""


def run_update(trade_date: str) -> int:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(_SQL_SINGLE_DATE, [trade_date, trade_date])
            rows = cur.rowcount
        conn.commit()
        return rows
    finally:
        conn.close()


def run_update_all() -> int:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(_SQL_ALL_DATES)
            rows = cur.rowcount
        conn.commit()
        return rows
    finally:
        conn.close()


def verify(trade_date: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    COUNT(*)                                    AS total_rows,
                    COUNT(rs_percentile)                        AS scored,
                    MIN(rs_percentile)                          AS min_pct,
                    MAX(rs_percentile)                          AS max_pct,
                    COUNT(*) FILTER (WHERE rs_percentile > 80)  AS rs_leaders
                FROM km_equity_eod
                WHERE trade_date = %s
            """, [trade_date])
            row = cur.fetchone()
            print(f"\n[verify] trade_date = {trade_date}")
            print(f"  total_rows = {row['total_rows']}")
            print(f"  scored     = {row['scored']}")
            print(f"  min_pct    = {row['min_pct']}")
            print(f"  max_pct    = {row['max_pct']}")
            print(f"  rs_leaders (>80) = {row['rs_leaders']}")
            if row['total_rows'] and row['scored'] == row['total_rows']:
                print(f"  ✓ All rows scored")
    finally:
        conn.close()


def compute_rs_percentile_for_date(db_conn, trade_date, verbose=False) -> int:
    """Pipeline entry point — called from daily_pipeline.py.
    db_conn is accepted for API consistency but unused (opens its own connection).
    Requires magic_rs to be populated first (pipeline step 6a).
    """
    n = run_update(str(trade_date))
    if verbose:
        print(f"  [rs_percentile] {n} rows updated for {trade_date}")
    return n


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=str(date.today()), help='Trade date YYYY-MM-DD')
    parser.add_argument('--all', action='store_true', help='Backfill all historical dates')
    parser.add_argument('--verify', action='store_true', help='Verify only, no update')
    args = parser.parse_args()

    if args.verify:
        verify(args.date)
        return

    if args.all:
        print('Backfilling rs_percentile for all dates with magic_rs...')
        n = run_update_all()
        print(f'Done — {n} rows updated across all dates.')
        verify(args.date)
        return

    verify(args.date)
    n = run_update(args.date)
    print(f'Updated {n} rows for {args.date}')
    verify(args.date)


if __name__ == '__main__':
    main()
