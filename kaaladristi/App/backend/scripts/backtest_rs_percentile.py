"""
Does screening on rs_percentile add value?  (READ-ONLY STUDY — writes nothing.)
==============================================================================

rs_percentile is PERCENT_RANK() over magic_rs, partitioned by trade_date
(scripts/backfill_rs_percentile.py). It is cross-sectional by construction, so
every bucket holds the same share of the universe on every date and the counts
cannot drift with the regime. That makes it a clean thing to test.

"Adds value" is not one question, it is three, and a result that answers only
the first is noise:

  1. Does the high bucket beat the BASE RATE?  Forward return is measured as
     excess over the SAME-DATE universe median, so market direction cancels
     out. A bucket that returns +4% in a month when everything returned +4% has
     told you nothing.
  2. Is the gradient MONOTONE?  If p90-100 > p80-90 > ... > p0-10 the effect is
     structural. One good bucket surrounded by noise is a lucky bucket.
  3. Does it add anything OVER WHAT WE ALREADY SHIP?  If the high-RS names are
     already inside Stage 2 Leaders / Strength Confluence, it is a new label on
     an old list. Phase 3 measures the names high RS finds that the shipped
     scanners do not.

Usage (needs DB_PRIMARY / DATABASE_URL in App/.env, or KD_DB_PASSWORD):
    cd App/backend
    python scripts/backtest_rs_percentile.py                    # 5/22/66 sessions
    python scripts/backtest_rs_percentile.py --horizons 22
    python scripts/backtest_rs_percentile.py --exchange NSE
    python scripts/backtest_rs_percentile.py --from 2024-01-01

── FIVE TRAPS THIS STUDY HAS TO SURVIVE, all of them already recorded in
   LESSONS_LEARNED / CLAUDE.md ───────────────────────────────────────────────

1. CORPORATE ACTIONS.  km_corporate_actions is EMPTY (D44), so closes are raw
   bhavcopy. A 1:2 split inside a forward window reads as a genuine -50%. We
   apply the same gate adjust_close_cliffs() uses -- a single-session move
   below 0.55x or above 1.80x, impossible under NSE's +/-20% band -- and DROP
   any (stock, window) containing one, rather than adjusting. Dropped counts
   are REPORTED: silently discarding them is how a study launders its own bias.

2. SURVIVORSHIP.  A stock with no bar at t+h (delisted, suspended, or simply
   not yet listed) is excluded by the join. Excluding it silently biases the
   result upward, because the ones that vanish are rarely the winners. The
   script counts and prints them per bucket.

3. OVERLAPPING WINDOWS.  Sampling every session gives wildly autocorrelated
   observations and a meaningless significance test. Sample dates are spaced at
   least `horizon` sessions apart, so each stock contributes independent
   windows, and the number of independent sample dates is printed with the
   result. Read a 2-date study as an anecdote.

4. MEDIAN, NOT MEAN.  One unadjusted corporate action or one ten-bagger
   dominates a mean over a few hundred rows. Both are printed; the median is
   the one to read, and a large mean-median gap is itself the warning.

5. DEPTH.  A pure RS screen needs neither ema_20 (null before ~2025, which is
   what caps every existing scanner -- DATA_DEPTH_AUDIT.md) nor delivery. It is
   bounded only by magic_rs, so this study can look back further than the
   shipped scanners can run. Phase 0 measures that window instead of assuming
   it.
"""

import argparse
import os
import sys

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

CLIFF_LOW, CLIFF_HIGH = 0.55, 1.80     # adjust_close_cliffs(), lib/breadth_common.py
BUCKETS = [(90, 100), (80, 90), (70, 80), (50, 70), (30, 50), (0, 30)]


def get_conn():
    from lib.config import DATABASE_URL
    dsn = DATABASE_URL or os.environ.get('DATABASE_URL')
    if not dsn and os.environ.get('KD_DB_PASSWORD'):
        dsn = (f"postgresql://kd_app:{os.environ['KD_DB_PASSWORD']}"
               f"@187.127.136.65:5432/kaala_dristi_db")
    if not dsn:
        raise SystemExit('Set DB_PRIMARY/DATABASE_URL in App/.env, or KD_DB_PASSWORD.')
    conn = psycopg2.connect(dsn, connect_timeout=30)
    conn.set_session(readonly=True)          # this study writes nothing, ever
    return conn


def q(cur, sql, args=None):
    cur.execute(sql, args or {})
    return cur.fetchall()


def phase0_depth(cur, exchange):
    """How far back can this actually be tested?"""
    rows = q(cur, """
        SELECT min(e.trade_date) AS first_rs, max(e.trade_date) AS last_rs,
               count(*) AS rs_rows
        FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id
        WHERE e.rs_percentile IS NOT NULL
          AND (%(ex)s = 'BOTH' OR s.exchange = %(ex)s)
    """, {'ex': exchange})[0]
    ema = q(cur, "SELECT min(trade_date) AS first_ema FROM km_equity_eod WHERE ema_20 IS NOT NULL")[0]
    print('── Phase 0: usable window ' + '─' * 46)
    print(f"  rs_percentile populated : {rows['first_rs']} → {rows['last_rs']}  ({rows['rs_rows']:,} bars)")
    print(f"  ema_20 starts           : {ema['first_ema']}   ← every SHIPPED scanner is capped here")
    if rows['first_rs'] and ema['first_ema'] and rows['first_rs'] < ema['first_ema']:
        print("  → RS can be tested EARLIER than the shipped scanners can run.")
        print()
        print("  ⚠ DEPTH IS NOT THE SAME AS QUALITY. km_corporate_actions is EMPTY")
        print("    (D44), so closes are raw bhavcopy over the whole window — and")
        print("    magic_rs, which rs_percentile ranks, was itself computed on those")
        print("    unadjusted closes. The cliff filter drops a window that CONTAINS a")
        print("    split, but it cannot repair an rs_percentile that was distorted by")
        print("    one before the window opened. Treat pre-2025 results as indicative")
        print("    and compare them against a recent-only run (--from 2024-01-01)")
        print("    before believing either.")
    print()
    return rows['first_rs'], rows['last_rs']


def sample_dates(cur, start, end, horizon, max_dates):
    """Non-overlapping sample dates (trap 3), spread across the whole window.

    The trading calendar comes from km_index_eod — one row per index per date,
    a few thousand rows — NOT from a DISTINCT over km_equity_eod, which is 13.2M
    rows once rs_percentile reaches back to 2006 and was the original reason this
    script appeared to hang. km_equity_eod is the fallback if the index table is
    empty for the window.

    With twenty years available, sixty dates SPREAD over the whole range is a
    better study than sixty consecutive recent ones — more independent regimes,
    same cost — so the sample is thinned evenly rather than truncated.
    """
    rows = q(cur, """
        SELECT DISTINCT trade_date FROM km_index_eod
        WHERE trade_date BETWEEN %(a)s AND %(b)s ORDER BY trade_date
    """, {'a': start, 'b': end})
    if not rows:
        rows = q(cur, """
            SELECT DISTINCT trade_date FROM km_equity_eod
            WHERE trade_date BETWEEN %(a)s AND %(b)s ORDER BY trade_date
        """, {'a': start, 'b': end})
    days = [r['trade_date'] for r in rows]
    # every horizon-th session keeps the windows non-overlapping ...
    spaced = days[::horizon]
    # ... and if that is still more than the budget, thin it evenly so the
    # sample still spans the full history instead of clustering at one end.
    if max_dates and len(spaced) > max_dates:
        step = len(spaced) / float(max_dates)
        spaced = [spaced[int(i * step)] for i in range(max_dates)]
    return spaced


_STUDY = """
WITH base AS (
  SELECT e.equity_id, e.rs_percentile, e.close AS c0
  FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id
  WHERE e.trade_date = %(d)s AND e.rs_percentile IS NOT NULL
    AND e.close > 0 AND s.is_active
    AND (s.isin IS NULL OR s.isin NOT LIKE 'INF%%')      -- funds/ETFs out (migration 205)
    AND (%(ex)s = 'BOTH' OR s.exchange = %(ex)s)
),
-- The forward window, newest-first; rn = horizon is the exit bar.
fwd AS (
  SELECT e.equity_id, e.trade_date, e.close, e.prev_close,
         row_number() OVER (PARTITION BY e.equity_id ORDER BY e.trade_date) AS rn
  FROM km_equity_eod e
  WHERE e.trade_date > %(d)s
    -- Bounded by CALENDAR date as well as by rn. Without this ceiling the CTE
    -- ranks every future bar for ~5,000 stocks before filtering to the first h
    -- — on twenty years of history that is the whole table, once per sample
    -- date. `h` sessions can never span more than ~1.6*h calendar days plus a
    -- holiday allowance, so this cannot truncate a real window.
    AND e.trade_date <= (%(d)s::date + ((%(h)s * 1.8)::int + 21))
    AND e.equity_id IN (SELECT equity_id FROM base)
),
win AS (SELECT * FROM fwd WHERE rn <= %(h)s),
-- Trap 1: any single-session cliff inside the window disqualifies the pair.
cliff AS (
  SELECT equity_id FROM win
  WHERE prev_close > 0 AND close > 0
    AND (close / prev_close < %(lo)s OR close / prev_close > %(hi)s)
  GROUP BY equity_id
),
exit_bar AS (SELECT equity_id, close AS c1 FROM win WHERE rn = %(h)s),
joined AS (
  SELECT b.equity_id, b.rs_percentile,
         (x.c1 / b.c0 - 1.0) * 100.0 AS ret_pct
  FROM base b JOIN exit_bar x USING (equity_id)
  WHERE b.equity_id NOT IN (SELECT equity_id FROM cliff)
),
med AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ret_pct) AS m FROM joined)
SELECT
  (SELECT count(*) FROM base)                                        AS universe,
  (SELECT count(*) FROM cliff)                                       AS dropped_cliff,
  (SELECT count(*) FROM base) - (SELECT count(*) FROM joined)
    - (SELECT count(*) FROM cliff)                                   AS dropped_no_exit_bar,
  (SELECT m FROM med)                                                AS universe_median,
  j.bucket_lo, j.bucket_hi, count(*) AS n,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY j.ret_pct - (SELECT m FROM med)) AS excess_median,
  avg(j.ret_pct - (SELECT m FROM med))                               AS excess_mean,
  count(*) FILTER (WHERE j.ret_pct > (SELECT m FROM med))            AS beat_median
FROM (
  SELECT ret_pct, b.lo AS bucket_lo, b.hi AS bucket_hi
  FROM joined, (VALUES %(buckets)s) AS b(lo, hi)
  WHERE rs_percentile >= b.lo AND rs_percentile < b.hi
) j
GROUP BY j.bucket_lo, j.bucket_hi
ORDER BY j.bucket_lo DESC;
"""


def run(cur, dates, horizon, exchange):
    """One bounded query per sample date, with progress. A study that prints
    nothing for 45 minutes is indistinguishable from a hung one — which is
    exactly how the first version of this script failed."""
    buckets = psycopg2.extensions.AsIs(
        ','.join(f'({lo},{hi})' for lo, hi in BUCKETS))
    agg, meta = {}, {'universe': 0, 'cliff': 0, 'noexit': 0, 'dates': 0}
    import time
    t0 = time.time()
    for i, d in enumerate(dates, 1):
        cur.execute("SET LOCAL statement_timeout = '180s'")
        try:
            rows = q(cur, _STUDY, {'d': d, 'h': horizon, 'ex': exchange,
                                   'lo': CLIFF_LOW, 'hi': CLIFF_HIGH, 'buckets': buckets})
        except Exception as exc:                      # one slow date must not lose the run
            print(f"    [{i}/{len(dates)}] {d}  SKIPPED — {str(exc).splitlines()[0][:70]}")
            cur.connection.rollback()
            continue
        el = time.time() - t0
        print(f"    [{i}/{len(dates)}] {d}  {el:5.1f}s elapsed"
              f"  (~{el / i * (len(dates) - i):.0f}s left)", flush=True)
        if not rows:
            continue
        meta['dates'] += 1
        meta['universe'] += rows[0]['universe'] or 0
        meta['cliff'] += rows[0]['dropped_cliff'] or 0
        meta['noexit'] += rows[0]['dropped_no_exit_bar'] or 0
        for r in rows:
            k = (r['bucket_lo'], r['bucket_hi'])
            a = agg.setdefault(k, {'n': 0, 'exc': [], 'beat': 0})
            a['n'] += r['n']
            a['beat'] += r['beat_median']
            a['exc'].append((float(r['excess_median'] or 0), r['n']))
    return agg, meta


def report(agg, meta, horizon):
    print(f"── Horizon {horizon} sessions " + '─' * 50)
    print(f"  {meta['dates']} independent (non-overlapping) sample dates")
    if meta['dates'] < 8:
        print("  ⚠ Fewer than 8 independent periods — read this as an anecdote, not a result.")
    print(f"  dropped: {meta['cliff']:,} stock-windows on a corporate-action cliff, "
          f"{meta['noexit']:,} with no bar at t+{horizon} (delisted/suspended/too new)")
    print()
    print(f"  {'RS pct':>10} {'n':>8} {'excess median %':>17} {'hit rate':>10}")
    prev = None
    monotone = True
    for lo, hi in BUCKETS:
        a = agg.get((lo, hi))
        if not a or not a['n']:
            continue
        # weight each date's median by its n — a date with 40 names should not
        # count the same as one with 400.
        tot = sum(n for _, n in a['exc']) or 1
        exc = sum(m * n for m, n in a['exc']) / tot
        hit = 100.0 * a['beat'] / a['n']
        print(f"  {lo:>4}–{hi:<5} {a['n']:>8,} {exc:>17.2f} {hit:>9.1f}%")
        if prev is not None and exc > prev + 1e-9:
            monotone = False
        prev = exc
    print()
    # Strict monotonicity over six buckets is a demanding test — one inversion
    # anywhere fails it — so it is reported ALONGSIDE Spearman's rho and the
    # top-minus-bottom spread rather than as the verdict. rho near +1 with a
    # wide spread is a real gradient even if two adjacent buckets swap; rho
    # near 0 is noise however tidy one bucket looks.
    vals = [(lo, sum(m * n for m, n in agg[(lo, hi)]['exc']) / (sum(n for _, n in agg[(lo, hi)]['exc']) or 1))
            for lo, hi in BUCKETS if agg.get((lo, hi), {}).get('n')]
    if len(vals) >= 3:
        k = len(vals)
        # buckets are already ordered high→low, so expected rank == position
        order = sorted(range(k), key=lambda i: vals[i][1], reverse=True)
        actual = [0] * k
        for rank, i in enumerate(order):
            actual[i] = rank
        dsq = sum((i - actual[i]) ** 2 for i in range(k))
        rho = 1 - (6 * dsq) / (k * (k * k - 1))
        spread = vals[0][1] - vals[-1][1]
        print(f"  Spearman rho (bucket rank vs excess) : {rho:+.2f}   "
              f"top−bottom spread: {spread:+.2f} pts")
    print(f"  strictly monotone high→low           : {'yes' if monotone else 'no'}")
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--horizons', default='5,22,66')
    ap.add_argument('--exchange', default='BOTH', choices=['BOTH', 'NSE', 'BSE'])
    ap.add_argument('--from', dest='start', default=None)
    ap.add_argument('--to', dest='end', default=None)
    ap.add_argument('--max-dates', type=int, default=60,
                    help='independent sample dates per horizon (default 60). '
                         'Sixty spread across twenty years beats sixty consecutive '
                         'recent ones — more regimes, same cost.')
    a = ap.parse_args()

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    print(f"\nRS-percentile study — exchange={a.exchange}  (read-only)\n")
    first, last = phase0_depth(cur, a.exchange)
    start = a.start or first
    end = a.end or last
    if not start:
        raise SystemExit('rs_percentile is not populated — run backfill_rs_percentile.py --all first.')
    for h in (int(x) for x in a.horizons.split(',')):
        print(f"  sampling up to {a.max_dates} dates for horizon {h} …", flush=True)
        dates = sample_dates(cur, start, end, h, a.max_dates)
        # The last `h` sessions cannot have a forward window yet.
        dates = dates[:-1] if dates else dates
        agg, meta = run(cur, dates, h, a.exchange)
        report(agg, meta, h)
    conn.close()
    print("Reading it: the top bucket adds value only if its excess median is\n"
          "clearly positive AND the gradient is monotone AND there are enough\n"
          "independent periods. Any one of those failing makes the rest noise.\n"
          "Phase 3 (overlap with the shipped scanners) is the separate question\n"
          "of whether it adds anything we do not already surface.\n")


if __name__ == '__main__':
    main()
