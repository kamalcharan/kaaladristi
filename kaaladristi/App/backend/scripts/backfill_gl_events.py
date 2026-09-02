"""
Golden Line Events Backfill
===========================
Writes km_equity_eod.pct_from_gl / gl_event / gl_days_above (migration 194).

The Golden Line is sma_150 — a 150-BAR mean of close (migration 014,
v_sum / 150), the same series compute_wg_journeys.py rebuilds in memory. It
was on the table all along; what was missing was a record of what happens AT
it, which is what a scanner can filter on.

THE TWO EVENTS (owner-specified)

  BREAKOUT  prior close <= prior GL, this close > GL, and this bar prints
            SVD or SBD. The volume lands on the crossing bar itself.

  RETEST    low <= GL (the line was reached intraday) while close > GL (it
            held), on an SVD/SBD bar, after at least GL_RETEST_MIN_DAYS_ABOVE
            PRIOR sessions closed above the line. That precondition is the
            whole difference between a retest of an established reclaim and
            noise around the line.

BREAKOUT takes precedence where both match: a bar whose prior close was below
the line cannot be retesting a reclaim it has not made.

Usage:
    cd App/backend
    python scripts/backfill_gl_events.py              # resumes by default
    python scripts/backfill_gl_events.py --restart    # full reprocess
    python scripts/backfill_gl_events.py --verify     # report, write nothing

Symbol-batched, for the same reason as every other window backfill here:
every window is PARTITION BY equity_id, so a DATE chunk would hand each chunk
a truncated history and silently mis-state gl_days_above at the boundary.
"""

import os
import sys
import time
import argparse

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# Prior sessions a stock must have held above the Golden Line before a touch
# counts as a RETEST rather than chop around the line.
GL_RETEST_MIN_DAYS_ABOVE = 10

STATEMENT_TIMEOUT_MS = 60 * 60 * 1000

# pct_from_gl is NUMERIC(10,2). sma_150 is a real price mean and junk BSE bars
# can drag it to fractions of a rupee, so the ratio can exceed the column.
# NULL beats a clamped lie.
PCT_GUARD = 100000000

DEADLOCK_RETRIES = 5
DEADLOCK_BACKOFF_S = [5, 15, 45, 90, 180]


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
                 f"-c work_mem=64MB"),
    )


# `%(where)s` is substituted with a date restriction for the nightly path and
# with TRUE for the backfill. The windows themselves must always see the
# symbol's FULL history — gl_days_above counts back to the last close below
# the line, which can be years.
_SQL = """
WITH lvl AS (
    SELECT id, equity_id, trade_date, close, low, sma_150,
           COALESCE(dot_svd, FALSE) OR COALESCE(dot_sbd, FALSE) AS has_dot,
           LAG(close)   OVER w AS pclose,
           LAG(sma_150) OVER w AS pgl,
           (sma_150 IS NOT NULL AND sma_150 > 0 AND close > sma_150) AS above
    FROM km_equity_eod
    WHERE equity_id = ANY(%(ids)s)
    WINDOW w AS (PARTITION BY equity_id ORDER BY trade_date)
), near AS (
    -- A dot ANYWHERE within +/- 5 calendar days of the bar, not only ON it.
    -- Requiring the SVD/SBD to print on the exact crossing session threw away
    -- two thirds of the crossings: of the 30 current WAKING journeys since
    -- 2026-06-01, 14 crossed the Golden Line, 27 printed a dot on some bar,
    -- but only 4 had both on one session. At +/- 5 days it is 7 (owner call,
    -- 2026-08-28: "cross and volume conviction in the same week").
    --
    -- RANGE with an INTERVAL frame is keyed on the ORDER BY value, so this is
    -- 5 CALENDAR days either side and a weekend costs no lookback. A ROWS
    -- frame would have meant 5 SESSIONS, which drifts across holidays.
    SELECT lvl.*,
           bool_or(has_dot) OVER (
               PARTITION BY equity_id ORDER BY trade_date
               RANGE BETWEEN INTERVAL '5 days' PRECEDING
                         AND INTERVAL '5 days' FOLLOWING
           ) AS dot_near
    FROM lvl
), isl AS (
    -- Gaps and islands: the running count of NOT-above bars is constant
    -- within a stretch that stays above the line, so it identifies the run.
    SELECT near.*,
           SUM(CASE WHEN above THEN 0 ELSE 1 END)
             OVER (PARTITION BY equity_id ORDER BY trade_date
                   ROWS UNBOUNDED PRECEDING) AS grp
    FROM near
), runs AS (
    SELECT isl.*,
           CASE
             WHEN NOT above THEN 0
             -- Every island except the first OPENS with its non-above bar, so
             -- that bar occupies position 1 and the days-above count is one
             -- less. Island 0 has no such bar (the symbol has been above the
             -- line since its first bar with an sma_150), so it counts whole.
             ELSE row_number() OVER (PARTITION BY equity_id, grp ORDER BY trade_date)
                  - CASE WHEN grp = 0 THEN 0 ELSE 1 END
           END AS days_above
    FROM isl
), ev AS (
    SELECT runs.*,
           CASE
             WHEN dot_near AND above AND pclose IS NOT NULL AND pgl IS NOT NULL
                  AND pgl > 0 AND pclose <= pgl
               THEN 'BREAKOUT'
             -- days_above includes this bar, so "10 PRIOR sessions" is > 10.
             WHEN dot_near AND above AND low IS NOT NULL AND low <= sma_150
                  AND days_above > %(min_days)s
               THEN 'RETEST'
             ELSE NULL
           END AS event
    FROM runs
)
UPDATE km_equity_eod t
SET pct_from_gl = CASE
        WHEN e.sma_150 IS NOT NULL AND e.sma_150 > 0
         AND abs((e.close - e.sma_150) / e.sma_150 * 100.0) < %(guard)s
        THEN ROUND((e.close - e.sma_150) / e.sma_150 * 100.0, 2)
        ELSE NULL
    END,
    gl_event      = e.event,
    gl_days_above = e.days_above
FROM ev e
WHERE t.id = e.id
  AND %(where)s
"""


def _symbols_to_process(conn, resume: bool):
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT equity_id FROM km_equity_eod ORDER BY equity_id")
        all_ids = [r[0] for r in cur.fetchall()]
        if not resume:
            return all_ids, 0
        # gl_days_above is written on EVERY bar (0 when below the line), so it
        # is a reliable per-symbol done marker; gl_event would not be, since
        # most symbols legitimately have no event at all.
        cur.execute("SELECT DISTINCT equity_id FROM km_equity_eod "
                    "WHERE gl_days_above IS NOT NULL")
        done = {r[0] for r in cur.fetchall()}
    return [i for i in all_ids if i not in done], len(done)


def _run_batch(conn, chunk, where_sql, params):
    for attempt in range(DEADLOCK_RETRIES + 1):
        try:
            with conn.cursor() as cur:
                cur.execute(_SQL.replace('%(where)s', where_sql),
                            {'ids': chunk, 'min_days': GL_RETEST_MIN_DAYS_ABOVE,
                             'guard': PCT_GUARD, **params})
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
        ids, already = _symbols_to_process(conn, resume)
        total = len(ids)
        if total == 0:
            print(f"\n[gl-events] nothing to do — {already:,} symbols already "
                  f"processed. Use --restart to reprocess.")
            return 0
        print(f"\n[gl-events] {total:,} symbols in "
              f"{(total + batch_size - 1) // batch_size} batches of {batch_size}.")
        if already:
            print(f"  Resuming — skipping {already:,} already processed.")
        print(f"  Retest needs > {GL_RETEST_MIN_DAYS_ABOVE} prior sessions above the line.\n")

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


def compute_gl_events_for_date(db_conn, trade_date, verbose: bool = False) -> int:
    """Nightly step. Must run AFTER `dots` — it reads dot_svd/dot_sbd, and
    running it before would compute against yesterday's dots and miss every
    event on the day it happened.

    Rewrites a TRAILING WINDOW, not just `trade_date`. The dot no longer has
    to print on the crossing bar — it counts anywhere within +/- 5 calendar
    days (owner call, 2026-08-28) — and the forward half of that window does
    not exist yet on the evening of the cross. A bar that crosses today and
    draws its SVD three days from now is not an event tonight and IS one on
    Thursday, so tonight's answer for it has to be revisited. Restricting the
    UPDATE to one date would have made every forward-confirmed event
    permanently invisible: computed once, on the only day it could not be
    seen. Seven calendar days covers the five-day reach with slack for a
    weekend.

    The windows still span each symbol's full history (gl_days_above counts
    back to the last close below the line, which can be years); only the
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
        for i in range(0, len(ids), 500):
            n += _run_batch(
                conn, ids[i:i + 500],
                't.trade_date > %(dt)s::date - 7 AND t.trade_date <= %(dt)s',
                {'dt': str(trade_date)})
        if verbose:
            print(f"  [gl-events] {trade_date}: {n:,} rows in {time.time() - t0:.1f}s")
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
                SELECT gl_event, count(*) AS n
                FROM km_equity_eod WHERE trade_date = %s
                GROUP BY 1 ORDER BY 2 DESC
            """, [latest])
            for r in cur.fetchall():
                print(f"  {str(r['gl_event'] or '(no event)'):<12} {r['n']:>7,}")
            cur.execute("""
                SELECT count(*) AS bars, count(sma_150) AS with_gl,
                       count(pct_from_gl) AS with_dist,
                       count(*) FILTER (WHERE gl_days_above > 0) AS above_line
                FROM km_equity_eod WHERE trade_date = %s
            """, [latest])
            r = cur.fetchone()
            print()
            for k, v in r.items():
                print(f"  {k:<12} = {v:>8,}")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser(
        description='Backfill Golden Line events on km_equity_eod (migration 194).')
    ap.add_argument('--batch-size', type=int, default=250)
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
