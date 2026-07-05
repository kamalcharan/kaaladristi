"""
Compute synthetic EOD rows for custom indices.

For every km_index_symbols row where category = 'custom' and is_active = true,
upserts one km_index_eod row per trading date using equal-weight average of
that index's constituents from km_equity_eod.

The synthesis SQL now lives in the PostgreSQL RPC compute_custom_index_eod()
(migration 096) so the daily pipeline and this backfill script share a single
source of truth. The daily pipeline calls the RPC per trade date; this script
calls it for the full history (or a single --date) and then refreshes the
score_5d / score_22d / avg_amt columns via compute_all_index_scores().

Usage:
    python3 compute_custom_index_eod.py                 # all history
    python3 compute_custom_index_eod.py --date 2026-07-03   # single date
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

SQL_EOD = "SELECT compute_custom_index_eod(%(trade_date)s) AS rows_affected;"
SQL_SCORES = "SELECT * FROM compute_all_index_scores();"


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def run(conn, trade_date=None):
    scope = f"date {trade_date}" if trade_date else "all history"
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        print(f"Upserting km_index_eod rows for active custom indices ({scope}) ...")
        cur.execute(SQL_EOD, {'trade_date': trade_date})
        rows_affected = cur.fetchone()['rows_affected']
        conn.commit()
        print(f"  Done — {rows_affected} rows upserted.")

    print("\nRunning compute_all_index_scores() ...")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(SQL_SCORES)
        results = cur.fetchall()
        conn.commit()

    if results:
        print(f"\n  {'index_id':>10}  {'rows_updated':>12}")
        print(f"  {'-'*10}  {'-'*12}")
        for r in results:
            print(f"  {r['out_index_id']:>10}  {r['rows_updated']:>12,}")
    else:
        print("  No indices updated by compute_all_index_scores() — check constituents.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute synthetic EOD for custom indices')
    parser.add_argument('--date', dest='trade_date', type=str, default=None,
                        help='Single trade date (YYYY-MM-DD). Omit for full history.')
    args = parser.parse_args()

    conn = get_conn()
    try:
        run(conn, trade_date=args.trade_date)
    finally:
        conn.close()
