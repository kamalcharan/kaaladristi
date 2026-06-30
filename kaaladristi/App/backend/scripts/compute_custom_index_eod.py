"""
Compute synthetic EOD rows for custom indices.

For every km_index_symbols row where category = 'custom' and is_active = true,
upserts one km_index_eod row per trading date using equal-weight average of
that index's constituents from km_equity_eod.

After this script, run compute_all_index_scores() (or backfill_index_scores.py)
to fill score_5d / score_22d / avg_amt columns.

Usage:
    python3 compute_custom_index_eod.py
"""

import os
import sys
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

SQL = """
INSERT INTO km_index_eod (index_id, trade_date, close, ret_5d, ret_22d, ret_66d)
SELECT
  c.index_id,
  e.trade_date,
  AVG(e.close)   AS close,
  AVG(e.ret_5d)  AS ret_5d,
  AVG(e.ret_22d) AS ret_22d,
  AVG(e.ret_66d) AS ret_66d
FROM km_index_constituents c
JOIN km_equity_eod e ON e.equity_id = c.equity_id
JOIN km_index_symbols s ON s.id = c.index_id
WHERE s.category = 'custom' AND s.is_active = true
GROUP BY c.index_id, e.trade_date
ON CONFLICT (index_id, trade_date) DO UPDATE SET
  close    = EXCLUDED.close,
  ret_5d   = EXCLUDED.ret_5d,
  ret_22d  = EXCLUDED.ret_22d,
  ret_66d  = EXCLUDED.ret_66d;
"""

SQL_SCORES = "SELECT * FROM compute_all_index_scores();"


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def run(conn):
    with conn.cursor() as cur:
        print("Upserting km_index_eod rows for all active custom indices ...")
        cur.execute(SQL)
        rows_affected = cur.rowcount
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
    conn = get_conn()
    try:
        run(conn)
    finally:
        conn.close()
