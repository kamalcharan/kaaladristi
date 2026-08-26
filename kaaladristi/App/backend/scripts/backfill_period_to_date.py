"""
Period-to-Date Backfill — week and month reference columns on km_equity_eod
===========================================================================
Populates the columns added by migrations 183 (weekly) and 185 (monthly),
which back the "Weekly Movers" and "Monthly Movers" Price Action screeners.

  week   -> prev_week_close  / pct_wtd
  month  -> prev_month_close / pct_mtd

(Supersedes backfill_week_to_date.py — same script, generalised to both
periods so the two never drift apart. One SQL template, one unit parameter.)

DEFINITION (must stay identical to compute_rolling_range() in
indicators/compute_engine.py — that is the forward/nightly path, this is the
history path):

  prev_<period>_close = the last close STRICTLY BEFORE the start of the row's
                        own period. Implemented as LAG over the periods PRESENT
                        in each symbol's history, which makes it gap-safe: a
                        symbol that did not trade last week/month references its
                        last available close instead of dropping out with NULL.
  pct_<period>        = (close - prev_close) / prev_close * 100

PostgreSQL date_trunc('week', d) returns that week's MONDAY and
date_trunc('month', d) the 1st, matching the pandas 'W-SUN' and 'M' bucketing
used in compute_engine.

The period aggregation deliberately scans FULL history even when --from/--to is
given: a ranged run still needs the prior period's close, which may lie outside
the range. Only the final UPDATE is date-filtered.

Idempotent — safe to re-run.

Usage:
    KD_DB_PASSWORD=<pw> python3 backfill_period_to_date.py                  # both
    KD_DB_PASSWORD=<pw> python3 backfill_period_to_date.py --period month
    KD_DB_PASSWORD=<pw> python3 backfill_period_to_date.py --from 2025-01-01
    KD_DB_PASSWORD=<pw> python3 backfill_period_to_date.py --verify --date 2026-08-25
"""

import os
import sys
import argparse
import time
import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

STATEMENT_TIMEOUT_MS = 60 * 60 * 1000

# unit -> (date_trunc unit, reference column, pct column)
PERIODS = {
    'week':  ('week',  'prev_week_close',  'pct_wtd'),
    'month': ('month', 'prev_month_close', 'pct_mtd'),
}


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
    -- Full history, unfiltered: the prior period may sit outside --from/--to.
    SELECT id, equity_id, trade_date, close,
           date_trunc('{unit}', trade_date)::date AS p_start
    FROM km_equity_eod
    WHERE close IS NOT NULL
), p_last AS (
    -- Last close of each period PRESENT for that symbol.
    SELECT DISTINCT ON (equity_id, p_start)
           equity_id, p_start, close AS p_close
    FROM bars
    ORDER BY equity_id, p_start, trade_date DESC
), p_prev AS (
    -- LAG over periods present == "last close strictly before this period".
    SELECT equity_id, p_start,
           LAG(p_close) OVER (PARTITION BY equity_id ORDER BY p_start) AS prev_close
    FROM p_last
), scored AS (
    SELECT b.id,
           ROUND(p.prev_close, 2) AS ref_close,
           -- Representability guard, NOT a business threshold: the pct column is
           -- NUMERIC(10,2), so the absolute value must stay under 1e8. Junk
           -- historical BSE bars (OHLC all exactly 100000.0) sit next to 0.01
           -- closes in the same symbol and produce ratios near 1e7 -- a "return"
           -- of roughly 1e9 percent. Those are not returns; store NULL rather
           -- than overflow the UPDATE or rank garbage first in the screener.
           -- NOTE: never write a literal percent sign anywhere in this template.
           -- psycopg2 treats it as a parameter placeholder whenever a params
           -- sequence is passed and raises IndexError. Spell the word.
           CASE
             WHEN p.prev_close > 0
              AND abs((b.close - p.prev_close) / p.prev_close * 100.0) < 100000000
             THEN ROUND((b.close - p.prev_close) / p.prev_close * 100.0, 2)
             ELSE NULL
           END AS pct_val
    FROM bars b
    JOIN p_prev p ON p.equity_id = b.equity_id AND p.p_start = b.p_start
    {date_filter}
)
UPDATE km_equity_eod e
SET {ref_col} = s.ref_close,
    {pct_col} = s.pct_val
FROM scored s
WHERE e.id = s.id
  AND s.ref_close IS NOT NULL;
"""

# psycopg2 interpolates whenever a params sequence is passed, so any literal
# percent sign in the template is parsed as a placeholder. Fail loudly at import
# rather than at execute time, where it surfaces as a bare IndexError.
assert "%" not in _SQL_TEMPLATE, (
    "backfill_period_to_date: _SQL_TEMPLATE contains a literal percent sign; "
    "psycopg2 will treat it as a parameter placeholder. Spell out 'percent'."
)


def build_sql(period, from_date, to_date):
    unit, ref_col, pct_col = PERIODS[period]
    clauses, params = [], []
    if from_date:
        clauses.append("b.trade_date >= %s")
        params.append(from_date)
    if to_date:
        clauses.append("b.trade_date <= %s")
        params.append(to_date)
    date_filter = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = (_SQL_TEMPLATE
           .replace("{unit}", unit)
           .replace("{ref_col}", ref_col)
           .replace("{pct_col}", pct_col)
           .replace("{date_filter}", date_filter))
    return sql, params


def run_update(period, from_date, to_date):
    sql, params = build_sql(period, from_date, to_date)
    _, ref_col, pct_col = PERIODS[period]
    scope = f"{from_date or 'start'} .. {to_date or 'end'}"
    print(f"[{period}] updating {ref_col} / {pct_col} for {scope}")
    t0 = time.time()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            print(f"[{period}] {cur.rowcount} rows updated in {time.time()-t0:.1f}s")
        conn.commit()
    finally:
        conn.close()


def run_verify(period, date_arg):
    _, ref_col, pct_col = PERIODS[period]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if date_arg:
                cur.execute(
                    f"SELECT COUNT(*), COUNT({ref_col}), COUNT({pct_col}), "
                    f"COUNT(*) FILTER (WHERE {pct_col} > 0) "
                    f"FROM km_equity_eod WHERE trade_date = %s",
                    [date_arg],
                )
                total, refc, pctc, positive = cur.fetchone()
                pct = (100.0 * refc / total) if total else 0
                print(f"[{period}] {date_arg}: {total} rows | {ref_col} {refc} ({pct:.1f} pct) "
                      f"| {pct_col} {pctc} | {pct_col}>0 {positive}")
            else:
                cur.execute(f"SELECT COUNT(*), COUNT({ref_col}) FROM km_equity_eod")
                total, filled = cur.fetchone()
                pct = (100.0 * filled / total) if total else 0
                print(f"[{period}] all history: {total} rows | {ref_col} {filled} ({pct:.1f} pct)")

            # Invariant: the first bar of each symbol has no prior period, so a
            # 100 pct fill rate would mean the gap-safe LAG is wrong.
            cur.execute(
                f"SELECT COUNT(*) FROM ("
                f"  SELECT DISTINCT ON (equity_id) equity_id, {ref_col}"
                f"  FROM km_equity_eod ORDER BY equity_id, trade_date"
                f") f WHERE f.{ref_col} IS NOT NULL"
            )
            leaked = cur.fetchone()[0]
            print(f"[{period}] first-bar rows with a {ref_col} (must be 0): {leaked}"
                  f" {'OK' if leaked == 0 else '<-- DEFECT'}")

            # Guard footprint: a reference close present but no pct value means
            # the reference was 0 or the ratio was not representable. Junk source
            # bars. Report rather than let the guard swallow them silently.
            cur.execute(
                f"SELECT COUNT(*) FROM km_equity_eod "
                f"WHERE {ref_col} IS NOT NULL AND {pct_col} IS NULL"
            )
            skipped = cur.fetchone()[0]
            print(f"[{period}] reference close present but {pct_col} unrepresentable: {skipped}"
                  f" (junk source bars — expect a handful, not thousands)")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser(
        description="Backfill week/month to-date reference columns on km_equity_eod.")
    ap.add_argument("--period", choices=['week', 'month', 'both'], default='both')
    ap.add_argument("--from", dest="from_date", metavar="YYYY-MM-DD")
    ap.add_argument("--to", dest="to_date", metavar="YYYY-MM-DD")
    ap.add_argument("--date", metavar="YYYY-MM-DD", help="Single date (verify only)")
    ap.add_argument("--verify", action="store_true", help="Only verify — no update")
    args = ap.parse_args()

    periods = ['week', 'month'] if args.period == 'both' else [args.period]

    if args.verify:
        for p in periods:
            run_verify(p, args.date or args.from_date)
        return

    for p in periods:
        run_update(p, args.from_date, args.to_date)
        run_verify(p, args.to_date or args.date)


if __name__ == "__main__":
    main()
