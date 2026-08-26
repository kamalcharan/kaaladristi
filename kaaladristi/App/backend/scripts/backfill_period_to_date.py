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
from datetime import date, timedelta

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
    # keepalives are NOT optional here. connect_timeout covers only the CONNECT;
    # a long UPDATE over a NAT/firewall that silently drops the idle socket
    # leaves psycopg2 blocked on a read that never returns. That is exactly what
    # happened on the first monthly run: two hours with pg_stat_activity empty,
    # zero dead tuples, and nothing written. With keepalives the client gets an
    # error in ~2 minutes instead of hanging indefinitely.
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=30,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        options=f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
    )


# Period references are aggregated ONCE into a temp table, then applied in
# bounded per-year UPDATEs. Three reasons this beats one 16.5M-row statement:
#   · the LAG still sees FULL history, so the gap-safe reference stays correct
#     even for a symbol suspended for years (a windowed re-scan per chunk would
#     silently break exactly those symbols);
#   · each transaction is small enough to commit and survive a flaky link;
#   · progress is visible, and a re-run resumes rather than restarting.
_BUILD_REF = """
CREATE TEMP TABLE period_ref AS
WITH bars AS (
    SELECT equity_id, trade_date, close,
           date_trunc('{unit}', trade_date)::date AS p_start
    FROM km_equity_eod
    WHERE close IS NOT NULL
), p_last AS (
    SELECT DISTINCT ON (equity_id, p_start)
           equity_id, p_start, close AS p_close
    FROM bars
    ORDER BY equity_id, p_start, trade_date DESC
)
SELECT equity_id, p_start,
       LAG(p_close) OVER (PARTITION BY equity_id ORDER BY p_start) AS prev_close
FROM p_last;
"""

_INDEX_REF = "CREATE INDEX ON period_ref (equity_id, p_start);"

_APPLY = """
UPDATE km_equity_eod e
SET {ref_col} = ROUND(r.prev_close, 2),
    -- Representability guard, NOT a business threshold: the pct column is
    -- NUMERIC(10,2), so the absolute value must stay under 1e8. Junk historical
    -- BSE bars (OHLC all exactly 100000.0) sit next to 0.01 closes in the same
    -- symbol and produce ratios near 1e7 -- a "return" of roughly 1e9 percent.
    -- Those are not returns; store NULL rather than overflow the UPDATE.
    -- NOTE: never write a literal percent sign anywhere in this template.
    -- psycopg2 treats it as a parameter placeholder whenever a params sequence
    -- is passed and raises IndexError. Spell the word.
    {pct_col} = CASE
        WHEN r.prev_close > 0
         AND abs((e.close - r.prev_close) / r.prev_close * 100.0) < 100000000
        THEN ROUND((e.close - r.prev_close) / r.prev_close * 100.0, 2)
        ELSE NULL
      END
FROM period_ref r
WHERE r.equity_id = e.equity_id
  AND r.p_start = date_trunc('{unit}', e.trade_date)::date
  AND r.prev_close IS NOT NULL
  AND e.close IS NOT NULL
  AND e.trade_date >= %s AND e.trade_date < %s;
"""

# psycopg2 interpolates whenever a params sequence is passed, so any literal
# percent sign in the template is parsed as a placeholder. Fail loudly at import
# rather than at execute time, where it surfaces as a bare IndexError.
for _name, _tpl in (('_BUILD_REF', _BUILD_REF), ('_INDEX_REF', _INDEX_REF)):
    assert "%" not in _tpl, (
        f"backfill_period_to_date: {_name} contains a literal percent sign; "
        "psycopg2 will treat it as a parameter placeholder. Spell out 'percent'."
    )
# _APPLY legitimately carries exactly the two %s date placeholders and nothing else.
assert _APPLY.count("%") == 2 and _APPLY.count("%s") == 2, (
    "backfill_period_to_date: _APPLY must contain exactly two %s placeholders "
    "and no other percent sign."
)


def run_update(period, from_date, to_date):
    unit, ref_col, pct_col = PERIODS[period]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT min(trade_date), max(trade_date) FROM km_equity_eod")
            db_lo, db_hi = cur.fetchone()
        lo = date.fromisoformat(from_date) if from_date else db_lo
        hi = date.fromisoformat(to_date) if to_date else db_hi
        if lo is None or hi is None:
            print(f"[{period}] km_equity_eod is empty — nothing to do")
            return

        print(f"[{period}] building period references over FULL history "
              f"(gap-safe LAG needs it) …")
        t0 = time.time()
        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS period_ref")
            cur.execute(_BUILD_REF.replace("{unit}", unit))
            cur.execute(_INDEX_REF)
        conn.commit()
        print(f"[{period}] references built in {time.time()-t0:.1f}s")

        apply_sql = (_APPLY.replace("{unit}", unit)
                           .replace("{ref_col}", ref_col)
                           .replace("{pct_col}", pct_col))

        total = 0
        t0 = time.time()
        for year in range(lo.year, hi.year + 1):
            y_lo = max(lo, date(year, 1, 1))
            y_hi = min(hi, date(year, 12, 31))
            if y_lo > y_hi:
                continue
            with conn.cursor() as cur:
                cur.execute(apply_sql, [y_lo.isoformat(),
                                        (y_hi + timedelta(days=1)).isoformat()])
                n = cur.rowcount
            conn.commit()          # bounded transaction, per year
            total += n
            print(f"[{period}]   {year}: {n:>9,} rows   "
                  f"(running {total:>10,} · {time.time()-t0:.0f}s)", flush=True)

        print(f"[{period}] {total:,} rows updated in {time.time()-t0:.1f}s")
    finally:
        try:
            with conn.cursor() as cur:
                cur.execute("DROP TABLE IF EXISTS period_ref")
            conn.commit()
        except Exception:
            pass
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
