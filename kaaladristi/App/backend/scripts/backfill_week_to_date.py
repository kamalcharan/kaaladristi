"""
Week-to-Date Backfill — prev_week_close / pct_wtd on km_equity_eod
==================================================================
Populates the two columns added by migration 183, which back the
"Weekly Movers (WTD)" Price Action screener.

DEFINITION (must stay identical to compute_rolling_range() in
indicators/compute_engine.py — that is the forward/nightly path, this is the
history path):

  prev_week_close = the last close STRICTLY BEFORE the Monday of the row's own
                    week. Implemented as LAG over the weeks PRESENT in each
                    symbol's history, which makes it gap-safe: a symbol that
                    did not trade last week references its last available
                    close instead of dropping out with a NULL.
  pct_wtd         = (close - prev_week_close) / prev_week_close * 100

PostgreSQL date_trunc('week', d) returns that week's MONDAY, matching the
pandas 'W-SUN' (Mon-Sun) bucketing used in compute_engine.

The week aggregation deliberately scans FULL history even when --from/--to is
given: a date-ranged run still needs the prior week's close, which may lie
outside the range. Only the final UPDATE is date-filtered.

Idempotent — safe to re-run.

Usage:
    KD_DB_PASSWORD=<pw> python3 backfill_week_to_date.py
    KD_DB_PASSWORD=<pw> python3 backfill_week_to_date.py --from 2025-01-01
    KD_DB_PASSWORD=<pw> python3 backfill_week_to_date.py --verify --date 2026-08-24
"""

import os
import sys
import argparse
import time
import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

STATEMENT_TIMEOUT_MS = 60 * 60 * 1000


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=30,
        options=f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
    )


_SQL_TEMPLATE = """
WITH bars AS (
    -- Full history, unfiltered: the prior week may sit outside --from/--to.
    SELECT id, equity_id, trade_date, close,
           date_trunc('week', trade_date)::date AS wk_start
    FROM km_equity_eod
    WHERE close IS NOT NULL
), wk_last AS (
    -- Last close of each week PRESENT for that symbol.
    SELECT DISTINCT ON (equity_id, wk_start)
           equity_id, wk_start, close AS wk_close
    FROM bars
    ORDER BY equity_id, wk_start, trade_date DESC
), wk_prev AS (
    -- LAG over weeks present == "last close strictly before this week".
    SELECT equity_id, wk_start,
           LAG(wk_close) OVER (PARTITION BY equity_id ORDER BY wk_start) AS prev_wk_close
    FROM wk_last
), scored AS (
    SELECT b.id,
           ROUND(p.prev_wk_close, 2) AS prev_week_close,
           ROUND(
               (b.close - p.prev_wk_close) / NULLIF(p.prev_wk_close, 0) * 100.0
           , 2) AS pct_wtd
    FROM bars b
    JOIN wk_prev p ON p.equity_id = b.equity_id AND p.wk_start = b.wk_start
    {date_filter}
)
UPDATE km_equity_eod e
SET prev_week_close = s.prev_week_close,
    pct_wtd         = s.pct_wtd
FROM scored s
WHERE e.id = s.id
  AND s.prev_week_close IS NOT NULL;
"""


def build_sql(from_date, to_date):
    clauses, params = [], []
    if from_date:
        clauses.append("b.trade_date >= %s")
        params.append(from_date)
    if to_date:
        clauses.append("b.trade_date <= %s")
        params.append(to_date)
    date_filter = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return _SQL_TEMPLATE.replace("{date_filter}", date_filter), params


def run_update(from_date, to_date):
    sql, params = build_sql(from_date, to_date)
    scope = f"{from_date or 'start'} .. {to_date or 'end'}"
    print(f"[wtd] updating prev_week_close / pct_wtd for {scope}")
    t0 = time.time()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            print(f"[wtd] {cur.rowcount} rows updated in {time.time()-t0:.1f}s")
        conn.commit()
    finally:
        conn.close()


def run_verify(date_arg):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if date_arg:
                cur.execute("""
                    SELECT COUNT(*), COUNT(prev_week_close), COUNT(pct_wtd),
                           COUNT(*) FILTER (WHERE pct_wtd > 0)
                    FROM km_equity_eod WHERE trade_date = %s
                """, [date_arg])
                total, pwc, pw, positive = cur.fetchone()
                pct = (100.0 * pwc / total) if total else 0
                print(f"[wtd] {date_arg}: {total} rows | prev_week_close {pwc} ({pct:.1f}%) "
                      f"| pct_wtd {pw} | pct_wtd>0 {positive}")
            else:
                cur.execute("""
                    SELECT COUNT(*), COUNT(prev_week_close) FROM km_equity_eod
                """)
                total, filled = cur.fetchone()
                pct = (100.0 * filled / total) if total else 0
                print(f"[wtd] all history: {total} rows | prev_week_close {filled} ({pct:.1f}%)")

            # Invariant: the first bar of each symbol has no prior week, so a
            # 100% fill rate would mean the gap-safe LAG is wrong.
            cur.execute("""
                SELECT COUNT(*) FROM (
                    SELECT DISTINCT ON (equity_id) equity_id, prev_week_close
                    FROM km_equity_eod ORDER BY equity_id, trade_date
                ) f WHERE f.prev_week_close IS NOT NULL
            """)
            leaked = cur.fetchone()[0]
            print(f"[wtd] first-bar rows with a prev_week_close (must be 0): {leaked}"
                  f" {'OK' if leaked == 0 else '<-- DEFECT'}")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser(description="Backfill prev_week_close / pct_wtd on km_equity_eod.")
    ap.add_argument("--from", dest="from_date", metavar="YYYY-MM-DD")
    ap.add_argument("--to", dest="to_date", metavar="YYYY-MM-DD")
    ap.add_argument("--date", metavar="YYYY-MM-DD", help="Single date (verify only)")
    ap.add_argument("--verify", action="store_true", help="Only verify — no update")
    args = ap.parse_args()

    if args.verify:
        run_verify(args.date or args.from_date)
        return
    run_update(args.from_date, args.to_date)
    run_verify(args.to_date or args.date)


if __name__ == "__main__":
    main()
