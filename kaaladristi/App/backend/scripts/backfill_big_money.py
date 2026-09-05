"""
Big Money Days Backfill
=======================
Writes km_equity_eod.bm_event / bm_ratio (migration 200).

A Big Money day is a session where DELIVERED value -- shares actually taken
home, not day-traded -- ran far above the stock's own norm. It marks a price
zone where large money changed hands. This moves the detection off the client
(services/bigMoney.ts) and onto the row, so the scanners, ChartView, bookmarks
and the VaNi intents all read one number instead of each deriving their own.

WHAT CHANGED vs THE CLIENT IMPLEMENTATION -- read this before comparing output

  1. Delivered value comes from the STORED deliv_value_cr, not from
     delivery_qty * close. The client computed it from first principles
     because "the stored deliv_value_cr / avg_amt_66d columns carry a 100x
     scale bug" (its header comment, diagnosed 2026-07-07). That bug is FIXED:
     measured 2026-09-05 across SSWL and COALINDIA,
         deliv_value_cr / (delivery_qty * close / 1e7) = 0.9846 .. 1.0044.
     The stored column is also the BETTER number -- it is VWAP-based, where
     close * qty prices every delivered share at the closing print.

  2. The 66-day baseline is the stored avg_amt_66d, not a rolling mean
     recomputed here. It already IS the 66-day delivered-value norm and is
     populated on every bar that has delivery data, so there is no rolling
     window in this script at all.

  3. The self-relative floor is now a FIXED trailing 252 bars, prior-only.
     The client took its top-2% percentile over whatever window the chart had
     loaded, so the same stock produced a different set of Big Money days at
     6M than at 1Y. Prior-only also means a past bar never repaints from data
     that arrived after it.

  Consequences 1 and 3 both move the numbers slightly. On SSWL the stored path
  gives 01-Sep 9.2x / 15-Jul 7.3x / 04-Jun 5.3x where the client card showed
  01-Sep 11.0x / 16-Jul 5.2x / 15-Jul 8.0x -- the same events, read off a
  better measurement. This is expected, not a regression.

THE THREE GATES

  ratio    deliv_value_cr / avg_amt_66d >= BM_MIN_RATIO (5). Owner calibration
           from 2026-07-07, anchored by TARIL 19-Jun-2026: Rs 240 Cr delivered
           against a Rs 40 Cr baseline = 6.0x. Liquid stocks carry big
           baselines, so high multiples are structurally rare -- 8x would have
           missed the owner's own canonical event.

  self     deliv_value_cr must land in the stock's own top BM_TOP_PCT (2%) of
           the prior up-to-252 sessions. Nearest-rank, so for a full 252-bar
           window it means "at most 5 prior bars delivered more".

  sanity   deliv_value_cr >= BM_ABS_SANITY_CR (Rs 1 Cr). Without it the ratio
           gate alone leaves a tail of stocks whose delivery baseline is tiny
           and erratic -- measured over the trailing year, ratio-only fires on
           4,414 stocks at an average of 5.5 events each but a worst case of 33
           (one every seven sessions), which is noise, not a footprint.

  A bar also needs BM_MIN_PRIOR_BARS of prior delivered history before it can
  fire at all, so the first months of a stock's delivery record cannot produce
  an event off a two-bar "norm".

DIRECTION is an INFERENCE, not a fact -- delivery is two-sided by definition
(every delivered share had a buyer and a seller). What price tells us is how
the handover was absorbed:
    entry  up bar closing in the top 40% of its range -- buyers paid up
    exit   down bar closing in the bottom 40% -- holders sold down
    mixed  large ownership change with no clear price verdict

NOT STORED, deliberately: the zone (it is the event bar's own low/high) and the
aftermath stat (how many sessions since have closed above the zone). The
aftermath changes every session for every past event, so storing it would mean
rewriting all history nightly. It is read-time arithmetic.

DATA HORIZON: delivery data does not exist in km_equity_eod before 2024-06-03
(NSE) / 2024-07-10 (BSE) -- delivery_qty is 0, not merely NULL. Big Money
cannot be computed before those dates. Deeper history needs the delivery feed
backfilled first (scripts/backfill_nse_delivery.py, backfill_bse_delivery.py),
then rolling metrics recomputed, then this re-run -- it is idempotent and
simply extends.

Usage:
    cd App/backend
    python scripts/backfill_big_money.py              # resumes by default
    python scripts/backfill_big_money.py --restart    # full reprocess
    python scripts/backfill_big_money.py --verify     # report, write nothing

Symbol-batched, for the same reason as every other window backfill here: the
percentile window is PARTITION BY equity_id, so a DATE chunk would hand each
chunk a truncated history and mis-state the floor at the boundary.
"""

import os
import sys
import time
import argparse

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# Delivered value as a multiple of the stock's own 66-day norm.
BM_MIN_RATIO = 5.0
# Self-relative floor: top 2% of the stock's own prior delivered days.
BM_TOP_PCT = 0.02
# Absolute sanity floor (Rs Cr) so near-zero-delivery names cannot fire.
BM_ABS_SANITY_CR = 1.0
# Trailing window the percentile is measured over (bars, prior-only).
BM_PERCENTILE_BARS = 252
# Prior delivered bars required before any event can fire.
BM_MIN_PRIOR_BARS = 66
# Close position within the bar's range that reads as buyers paying up.
BM_ENTRY_CLOSE_POS = 0.6
# ...and its mirror.
BM_EXIT_CLOSE_POS = 0.4

STATEMENT_TIMEOUT_MS = 60 * 60 * 1000

# bm_ratio is NUMERIC(10,2). A stock whose 66-day norm is a fraction of a lakh
# can produce an absurd multiple; NULL beats a clamped lie, same as
# backfill_gl_events.py does for pct_from_gl.
RATIO_GUARD = 99999999

DEADLOCK_RETRIES = 5
DEADLOCK_BACKOFF_S = [5, 15, 45, 90, 180]

# Smaller than the gl backfill's 250: each row carries an array of its prior
# 252 delivered values through the window, so memory scales with
# batch_size * bars_per_symbol * 252 rather than with rows alone.
DEFAULT_BATCH_SIZE = 100


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=30,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        options=(f"-c statement_timeout={STATEMENT_TIMEOUT_MS} "
                 f"-c work_mem=128MB"),
    )


# `%(where)s` is substituted with a date restriction for the nightly path and
# with TRUE for the backfill. The window itself must always see the symbol's
# FULL delivered history -- the percentile looks back 252 bars, which a date
# restriction would truncate.
#
# On the percentile: PostgreSQL has no percentile window function
# (percentile_cont is an ordered-set aggregate and cannot take an OVER clause),
# so the frame is collected with array_agg and the rank read off it directly.
# Nearest-rank, not interpolated -- for n prior bars the floor is the
# ceil(n * BM_TOP_PCT)-th highest, i.e. "at most that many prior bars beat it".
_SQL = """
WITH base AS (
    SELECT id, equity_id, trade_date, close, low, high, pct_chng,
           deliv_value_cr, avg_amt_66d,
           CASE WHEN avg_amt_66d > 0 AND deliv_value_cr IS NOT NULL
                 AND deliv_value_cr / avg_amt_66d < %(guard)s
                THEN ROUND((deliv_value_cr / avg_amt_66d)::numeric, 2)
           END AS ratio
    FROM km_equity_eod
    WHERE equity_id = ANY(%(ids)s)
), win AS (
    -- Prior-only frame: 1 PRECEDING excludes the current bar, so today's
    -- delivered value is never part of the floor it has to clear.
    SELECT base.*,
           array_agg(deliv_value_cr) FILTER (WHERE deliv_value_cr > 0) OVER (
               PARTITION BY equity_id ORDER BY trade_date
               ROWS BETWEEN %(pbars)s PRECEDING AND 1 PRECEDING
           ) AS prior_dv
    FROM base
), floors AS (
    SELECT win.*,
           COALESCE(array_length(prior_dv, 1), 0) AS n_prior,
           (SELECT v FROM unnest(prior_dv) AS v
             ORDER BY v DESC
             OFFSET GREATEST(0, CEIL(array_length(prior_dv, 1) * %(toppct)s)::int - 1)
             LIMIT 1) AS floor_dv
    FROM win
), ev AS (
    SELECT floors.*,
           CASE
             WHEN ratio IS NOT NULL
              AND ratio >= %(minratio)s
              AND n_prior >= %(minprior)s
              AND deliv_value_cr >= GREATEST(COALESCE(floor_dv, 0), %(sanity)s)
              AND low IS NOT NULL AND high IS NOT NULL AND close IS NOT NULL
             THEN CASE
                    WHEN pct_chng > 0 AND high > low
                     AND (close - low) / (high - low) >= %(entrypos)s THEN 'entry'
                    WHEN pct_chng < 0 AND high > low
                     AND (close - low) / (high - low) <= %(exitpos)s  THEN 'exit'
                    ELSE 'mixed'
                  END
           END AS event
    FROM floors
)
UPDATE km_equity_eod t
SET bm_ratio = e.ratio,
    bm_event = e.event
FROM ev e
WHERE t.id = e.id
  AND %(where)s
"""

_PARAMS = {
    'guard':    RATIO_GUARD,
    'pbars':    BM_PERCENTILE_BARS,
    'toppct':   BM_TOP_PCT,
    'minratio': BM_MIN_RATIO,
    'minprior': BM_MIN_PRIOR_BARS,
    'sanity':   BM_ABS_SANITY_CR,
    'entrypos': BM_ENTRY_CLOSE_POS,
    'exitpos':  BM_EXIT_CLOSE_POS,
}


def _symbols_to_process(conn, resume: bool):
    """Returns (ids_to_process, already_done_count, no_data_count).

    bm_ratio is written on every bar that HAS a baseline, so it is the resume
    marker -- bm_event would not be, since most symbols legitimately have no
    event at all (the same reason backfill_gl_events.py resumes on
    gl_days_above rather than gl_event).

    Symbols with no delivery baseline anywhere in their history are skipped
    permanently rather than retried on every run. Most BSE-only scrips are in
    this set, and so is every symbol whose history ends before delivery data
    began in June 2024 -- there is nothing for this script to compute, and
    marking them 'pending' forever would make --resume meaningless.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT equity_id FROM km_equity_eod ORDER BY equity_id")
        all_ids = [r[0] for r in cur.fetchall()]
        cur.execute("SELECT equity_id FROM km_equity_eod "
                    "GROUP BY equity_id HAVING COALESCE(max(avg_amt_66d), 0) <= 0")
        no_data = {r[0] for r in cur.fetchall()}
        if not resume:
            return [i for i in all_ids if i not in no_data], 0, len(no_data)
        cur.execute("SELECT DISTINCT equity_id FROM km_equity_eod "
                    "WHERE bm_ratio IS NOT NULL")
        done = {r[0] for r in cur.fetchall()}
    todo = [i for i in all_ids if i not in done and i not in no_data]
    return todo, len(done), len(no_data)


def _run_batch(conn, chunk, where_sql, params):
    for attempt in range(DEADLOCK_RETRIES + 1):
        try:
            with conn.cursor() as cur:
                cur.execute(_SQL.replace('%(where)s', where_sql),
                            {'ids': chunk, **_PARAMS, **params})
                n = cur.rowcount
            conn.commit()
            return n
        except psycopg2.errors.DeadlockDetected:
            conn.rollback()
            if attempt >= DEADLOCK_RETRIES:
                raise
            wait = DEADLOCK_BACKOFF_S[attempt]
            print(f"    deadlock — retry {attempt + 1}/{DEADLOCK_RETRIES} in {wait}s",
                  flush=True)
            time.sleep(wait)
        except psycopg2.Error:
            try:
                conn.rollback()
            except psycopg2.Error:
                pass
            raise
    raise RuntimeError('unreachable')


def run_backfill(batch_size: int, resume: bool = True) -> int:
    conn = get_conn()
    try:
        ids, already, no_data = _symbols_to_process(conn, resume)
        total = len(ids)
        if total == 0:
            print(f"\n[big-money] nothing to do — {already:,} symbols already "
                  f"processed, {no_data:,} have no delivery baseline at all. "
                  f"Use --restart to reprocess.")
            return 0
        print(f"\n[big-money] {total:,} symbols in "
              f"{(total + batch_size - 1) // batch_size} batches of {batch_size}.")
        if already:
            print(f"  Resuming — skipping {already:,} already processed.")
        if no_data:
            print(f"  Skipping {no_data:,} symbols with no delivery baseline "
                  f"(no avg_amt_66d anywhere in their history).")
        print(f"  Gates: ratio >= {BM_MIN_RATIO}x own 66d norm · top "
              f"{BM_TOP_PCT:.0%} of prior {BM_PERCENTILE_BARS} bars · "
              f">= Rs {BM_ABS_SANITY_CR:g} Cr · {BM_MIN_PRIOR_BARS}+ prior bars.\n")

        t0, updated = time.time(), 0
        for i in range(0, total, batch_size):
            n = _run_batch(conn, ids[i:i + batch_size], 'TRUE', {})
            updated += n
            done = min(i + batch_size, total)
            print(f"  [{done:>5}/{total}] {n:>9,} rows   "
                  f"(running {updated:>11,} · {time.time() - t0:.0f}s)", flush=True)
        print(f"\n  Done in {time.time() - t0:.0f}s — {updated:,} rows updated.")
        return updated
    finally:
        conn.close()


def compute_big_money_for_date(db_conn, trade_date, verbose: bool = False) -> int:
    """Nightly step. Must run AFTER `rolling_metrics` — it reads avg_amt_66d,
    and running it first would measure today's delivered value against a
    baseline that stops at yesterday.

    Rewrites a TRAILING WINDOW rather than just `trade_date`, for a reason
    specific to this signal: avg_amt_66d and the 252-bar percentile floor both
    move as new bars arrive, so a bar that missed the ratio gate by a hair
    yesterday can clear it once a large delivered day rolls OUT of its
    baseline. Restricting the UPDATE to one date would freeze each bar's
    verdict on the single evening it was computed. Seven calendar days is the
    same window backfill_gl_events.py rewrites, and covers a weekend.

    The percentile window still spans each symbol's full history; only the
    UPDATE is restricted.
    """
    conn = get_conn()
    try:
        t0 = time.time()
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT equity_id FROM km_equity_eod "
                        "WHERE trade_date = %s", [str(trade_date)])
            ids = [r[0] for r in cur.fetchall()]
        if not ids:
            return 0
        n = 0
        for i in range(0, len(ids), DEFAULT_BATCH_SIZE):
            n += _run_batch(
                conn, ids[i:i + DEFAULT_BATCH_SIZE],
                't.trade_date > %(dt)s::date - 7 AND t.trade_date <= %(dt)s',
                {'dt': str(trade_date)})
        if verbose:
            print(f"  [big-money] {trade_date}: {n:,} rows in {time.time() - t0:.1f}s")
        return n
    finally:
        conn.close()


def run_verify() -> None:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT max(trade_date) AS d FROM km_equity_eod")
            latest = cur.fetchone()['d']
            print(f"\n[verify] latest trade_date = {latest}\n")

            cur.execute("""
                SELECT min(trade_date) AS first_event, max(trade_date) AS last_event,
                       count(*) AS events, count(DISTINCT equity_id) AS symbols
                FROM km_equity_eod WHERE bm_event IS NOT NULL
            """)
            r = cur.fetchone()
            print("  events overall")
            for k, v in r.items():
                print(f"    {k:<12} = {v}")

            cur.execute("""
                SELECT bm_event, count(*) AS n
                FROM km_equity_eod WHERE bm_event IS NOT NULL
                GROUP BY 1 ORDER BY 2 DESC
            """)
            print("\n  direction split")
            for r in cur.fetchall():
                print(f"    {r['bm_event']:<8} {r['n']:>8,}")

            # Per-symbol event density. The whole point of the self-relative
            # floor is to keep this tail short -- a stock firing every few
            # sessions is erratic delivery, not a footprint.
            cur.execute("""
                WITH per AS (
                    SELECT equity_id, count(*) AS n
                    FROM km_equity_eod
                    WHERE bm_event IS NOT NULL AND trade_date > %s::date - 365
                    GROUP BY 1
                )
                SELECT count(*) AS symbols, round(avg(n), 2) AS avg_per_symbol,
                       max(n) AS worst, count(*) FILTER (WHERE n > 12) AS over_12
                FROM per
            """, [latest])
            r = cur.fetchone()
            print("\n  trailing-year density")
            for k, v in r.items():
                print(f"    {k:<15} = {v}")

            cur.execute("""
                SELECT count(*) AS bars, count(bm_ratio) AS with_ratio,
                       count(*) FILTER (WHERE deliv_value_cr > 0) AS with_delivery
                FROM km_equity_eod WHERE trade_date = %s
            """, [latest])
            r = cur.fetchone()
            print("\n  latest bar coverage")
            for k, v in r.items():
                print(f"    {k:<15} = {v:>8,}")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser(
        description='Backfill Big Money days on km_equity_eod (migration 200).')
    ap.add_argument('--batch-size', type=int, default=DEFAULT_BATCH_SIZE)
    ap.add_argument('--restart', action='store_true',
                    help='reprocess every symbol instead of resuming')
    ap.add_argument('--verify', action='store_true', help='report only')
    a = ap.parse_args()
    if a.verify:
        run_verify()
    else:
        run_backfill(a.batch_size, resume=not a.restart)


if __name__ == '__main__':
    main()
