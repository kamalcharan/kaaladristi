"""
Compute synthetic EOD rows for custom indices.

For every km_index_symbols row where category = 'custom' and is_active = true,
upserts one km_index_eod row per trading date using equal-weight average of
that index's constituents from km_equity_eod.

The synthesis SQL now lives in the PostgreSQL RPC compute_custom_index_eod()
(migration 096) so the daily pipeline and this backfill script share a single
source of truth. The daily pipeline calls the RPC for one trade date; this
script calls it for a date range (or full history) and then refreshes the
score_5d / score_22d / avg_amt columns via compute_all_index_scores() — scoped
to the same range so a targeted backfill stays fast.

Usage:
    python3 compute_custom_index_eod.py                       # ALL history (slow)
    python3 compute_custom_index_eod.py --from 2026-05-25     # from date → latest
    python3 compute_custom_index_eod.py --from 2026-05-25 --to 2026-06-30
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

SQL_EOD    = "SELECT compute_custom_index_eod(%(from_date)s, %(to_date)s) AS rows_affected;"
SQL_SCORES = "SELECT * FROM compute_all_index_scores(%(from_date)s);"


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def run(conn, from_date=None, to_date=None):
    if from_date and to_date:
        scope = f"{from_date} → {to_date}"
    elif from_date:
        scope = f"{from_date} → latest"
    else:
        scope = "all history"

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        print(f"Upserting km_index_eod rows for active custom indices ({scope}) ...")
        cur.execute(SQL_EOD, {'from_date': from_date, 'to_date': to_date})
        rows_affected = cur.fetchone()['rows_affected']
        conn.commit()
        print(f"  Done — {rows_affected} rows upserted.")

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        print(f"\nRunning compute_all_index_scores() ({scope}) ...")
        cur.execute(SQL_SCORES, {'from_date': from_date})
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
    parser.add_argument('--from', dest='from_date', type=str, default=None,
                        help='Start date YYYY-MM-DD (inclusive). Omit for full history.')
    parser.add_argument('--to', dest='to_date', type=str, default=None,
                        help='End date YYYY-MM-DD (inclusive). Omit for latest.')
    args = parser.parse_args()

    conn = get_conn()
    try:
        run(conn, from_date=args.from_date, to_date=args.to_date)
    finally:
        conn.close()
