"""
SR-B3 — Backfill avg_amt + score columns for km_index_eod.

Calls compute_all_index_scores() for all historical dates.
Run AFTER km_migration_113 has been applied.

Usage:
    python3 backfill_index_scores.py
    python3 backfill_index_scores.py --verify
"""

import os
import sys
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def run_backfill(conn):
    print("Running compute_all_index_scores() — full history backfill ...")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM compute_all_index_scores();")
        rows = cur.fetchall()
    conn.commit()
    print(f"\nDone. {len(rows)} indices updated:\n")
    print(f"{'index_id':>10}  {'rows_updated':>12}")
    print(f"{'-'*10}  {'-'*12}")
    total = 0
    for r in rows:
        print(f"{r['out_index_id']:>10}  {r['rows_updated']:>12,}")
        total += r['rows_updated']
    print(f"{'-'*10}  {'-'*12}")
    print(f"{'TOTAL':>10}  {total:>12,}")
    return rows


def run_verify(conn):
    print("\nVerification — latest date per index (sample):")
    sql = """
        SELECT
            s.name,
            e.trade_date,
            ROUND(e.avg_amt_5d::numeric, 1)  AS avg_amt_5d,
            ROUND(e.avg_amt_22d::numeric, 1) AS avg_amt_22d,
            ROUND(e.avg_amt_66d::numeric, 1) AS avg_amt_66d,
            ROUND(e.score_5d::numeric, 2)    AS score_5d,
            ROUND(e.score_22d::numeric, 2)   AS score_22d
        FROM km_index_eod e
        JOIN km_index_symbols s ON s.id = e.index_id
        WHERE e.trade_date = (
            SELECT MAX(trade_date) FROM km_index_eod WHERE index_id = e.index_id
        )
          AND s.is_active = TRUE
        ORDER BY s.name
        LIMIT 20;
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    print(f"\n{'Index':<35} {'Date':>12} {'5D':>8} {'22D':>8} {'66D':>8} "
          f"{'S5D':>8} {'S22D':>8}")
    print("-" * 95)
    for r in rows:
        print(
            f"{r['name'][:35]:<35} {str(r['trade_date']):>12} "
            f"{r['avg_amt_5d'] or '—':>8} {r['avg_amt_22d'] or '—':>8} "
            f"{r['avg_amt_66d'] or '—':>8} "
            f"{r['score_5d'] or '—':>8} {r['score_22d'] or '—':>8}"
        )

    null_sql = """
        SELECT
            COUNT(*) FILTER (WHERE avg_amt_5d IS NULL) AS null_5d,
            COUNT(*) FILTER (WHERE avg_amt_22d IS NULL) AS null_22d,
            COUNT(*) FILTER (WHERE avg_amt_66d IS NULL) AS null_66d,
            COUNT(*) FILTER (WHERE score_5d IS NULL)   AS null_s5d,
            COUNT(*) FILTER (WHERE score_22d IS NULL)  AS null_s22d,
            COUNT(*)                                    AS total_rows
        FROM km_index_eod;
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(null_sql)
        stats = cur.fetchone()

    print(f"\nNULL counts across all {stats['total_rows']:,} rows:")
    print(f"  avg_amt_5d  NULL: {stats['null_5d']:,}")
    print(f"  avg_amt_22d NULL: {stats['null_22d']:,}")
    print(f"  avg_amt_66d NULL: {stats['null_66d']:,}")
    print(f"  score_5d    NULL: {stats['null_s5d']:,}")
    print(f"  score_22d   NULL: {stats['null_s22d']:,}")
    print("\n(NULLs expected only on early rows with insufficient look-back history)")


if __name__ == "__main__":
    verify_only = "--verify" in sys.argv
    conn = get_conn()
    try:
        if not verify_only:
            run_backfill(conn)
        run_verify(conn)
    finally:
        conn.close()
