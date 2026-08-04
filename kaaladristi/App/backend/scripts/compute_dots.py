"""
SVD / SBD Dot Computation — single-pass over km_equity_eod
==========================================================
Rebuilds the `dot_svd` and `dot_sbd` boolean columns, which have been
all-FALSE across the entire universe since 2026-04-06. No writer for them
existed anywhere in the repo — every reference was a read (chart markers,
StockCard badges, XLS export, km_industry_eod aggregates), so the dots
silently went blank and nothing noticed.

Definitions come from the owner's Chartink screeners (the authoritative source
— the previous implementation is lost and was NOT reverse-engineered).

  SBD — "Accumulation Signature", the broad net
      close  >= prev close
      close  >= open                          (green candle)
      volume >= prev volume
      volume >= SMA(volume, 50) * 3           (SMA excludes the current bar)
      close  >  low + 0.67 * (high - low)     (close in the TOP THIRD of range)

  SVD — "Volume Drive", the extreme tail
      volume    >  SMA(volume, 5) * 10        (SMA excludes the current bar)
      pct_chng  >  9
      close     >  low + 0.50 * (high - low)  (close in the TOP HALF of range)
      close     >= sma_150                    (trend gate — see note below)

On a live sample (2026-08-03) SBD returned 50 names and SVD 13, with 12 of the
13 inside the SBD set. They are one family at two intensities, which is why
this is one function with two thresholds rather than two implementations.

WEEKLY-GATE APPROXIMATION
-------------------------
SVD's fourth condition is literally "Weekly Close >= Weekly SMA(Weekly Close,
30)". km_equity_weekly is stale (latest week_start 2026-05-18, ~2.5 months
behind), so depending on it would silently freeze the gate. 30 weekly closes
span ~150 trading sessions, so `close >= sma_150` on daily bars is used
instead. The two track closely but are not identical — SMA over 30 weekly
samples is not the same as SMA over 150 daily samples. If km_equity_weekly is
ever brought current, switch to the literal form.

  SYD — "Distribution Signal", the bearish mirror of SBD
      close  <  prev close
      close  <  open                          (red candle)
      volume >  prev volume
      volume >= SMA(volume, 50) * 3           (SMA excludes the current bar)
      close  <  low + 0.33 * (high - low)     (close in the BOTTOM THIRD)
      close * SMA(volume, 20) >= 50,000,000   (Rs 5 Cr turnover; SMA INCLUDES
                                               the current bar — the screener
                                               says "Daily Sma(Daily Volume,20)"
                                               with no "1 day ago" qualifier)

SYD RESOLUTION MISMATCH — READ BEFORE TRUSTING dot_syd
------------------------------------------------------
The owner's SYD screener ("SYD - ID") is a **15-MINUTE INTRADAY** screener; the
SBD one is daily/weekly/monthly. Every price/volume condition in SYD is written
against 15-minute bars, and km_equity_15m is empty (0 rows), so the literal
screener is not computable here.

What this script writes is the DAILY ANALOGUE: the same five mirrored
conditions applied to daily bars, plus the screener's own daily liquidity gate
(which was already expressed in daily terms). It is a faithful translation of
the SHAPE, not of the resolution — a 15-minute distribution bar and a daily one
are different events, and dot_syd will fire less often and later than the
owner's screener does. Treat it as directionally equivalent, not identical.

Two further deviations, both deliberate:
  * The screener restricts to the NIFTY 500 segment; this computes universe-wide
    (the column lives on every km_equity_eod row). Filter at the scanner layer.
  * "Market Cap >= 5" is omitted — mcap_cr coverage is poor (BSE ~12%), so the
    gate would silently drop rows for missing data rather than for weak
    fundamentals. The Rs 5 Cr turnover gate does similar work on data we
    actually have.

Usage:
    # Full history (all dates in km_equity_eod)
    python3 compute_dots.py

    # Date range — window look-back still spans full history
    python3 compute_dots.py --from 2024-06-01 --to 2026-08-03

    # Single date (what the daily pipeline would call)
    python3 compute_dots.py --date 2026-08-03

    # Report current fire-rates without writing
    python3 compute_dots.py --verify
"""

import os
import sys
import argparse
import time
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# One UPDATE over ~15.5M rows with several window frames. 60 minutes.
STATEMENT_TIMEOUT_MS = 60 * 60 * 1000

# ── Tunables — the two intensities of the same shape ──────────────────────────
SBD_VOL_MULT = 3       # x SMA(volume, 50)
SBD_VOL_SMA = 50
SBD_CLOSE_POS = 0.67   # top third of range
SVD_VOL_MULT = 10      # x SMA(volume, 5)
SVD_VOL_SMA = 5
SVD_CLOSE_POS = 0.50   # top half of range
SVD_MIN_PCT_CHG = 9    # %
SYD_VOL_MULT = 3       # x SMA(volume, 50) — same multiple as SBD, mirrored
SYD_VOL_SMA = 50
SYD_CLOSE_POS = 0.33   # BOTTOM third of range
SYD_LIQ_SMA = 20       # close x SMA(volume, 20) must clear SYD_MIN_TURNOVER
SYD_MIN_TURNOVER = 50000000   # Rs 5 Cr, in rupees — from the screener literally


# SYD reuses SBD's volume-SMA window (sma_vol_sbd / n_sbd) because both are
# SMA(volume, 50). Retuning SYD_VOL_SMA alone would silently evaluate SYD
# against SBD's frame instead of its own, which is the kind of drift that reads
# as a threshold problem for weeks. Fail loudly instead.
assert SYD_VOL_SMA == SBD_VOL_SMA, (
    f'SYD_VOL_SMA ({SYD_VOL_SMA}) must equal SBD_VOL_SMA ({SBD_VOL_SMA}), or SYD '
    'needs its own window in the CTE — see dot_syd in _SQL.'
)


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(
        DATABASE_URL,
        connect_timeout=30,
        options=f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
    )


# ── Core SQL ──────────────────────────────────────────────────────────────────
# The window CTE deliberately carries NO date filter: ROWS BETWEEN N PRECEDING
# look-back must see full history or the earliest target dates compute against a
# truncated window. Date scoping is applied on the UPDATE join instead.
#
# Volume SMAs use `ROWS BETWEEN n PRECEDING AND 1 PRECEDING` — the Chartink
# source reads "Sma(1 day ago Volume, n)", i.e. the average EXCLUDES the current
# bar. Including it would dilute exactly the spike being detected.
#
# n_sbd / n_svd count the bars actually present in each frame. Without them a
# stock with 3 bars of history would average those 3 and fire spuriously, which
# is how a thinly-traded new listing turns into a false signal.
_SQL = """
WITH base AS (
    SELECT
        id,
        equity_id,
        trade_date,
        open, high, low, close, volume, pct_chng, sma_150,
        LAG(close)  OVER w AS prev_close,
        LAG(volume) OVER w AS prev_vol,
        AVG(volume) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN {sbd_sma} PRECEDING AND 1 PRECEDING
        ) AS sma_vol_sbd,
        COUNT(*) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN {sbd_sma} PRECEDING AND 1 PRECEDING
        ) AS n_sbd,
        AVG(volume) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN {svd_sma} PRECEDING AND 1 PRECEDING
        ) AS sma_vol_svd,
        COUNT(*) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN {svd_sma} PRECEDING AND 1 PRECEDING
        ) AS n_svd,
        -- SYD liquidity gate: the screener reads "Daily Sma(Daily Volume, 20)",
        -- which INCLUDES the current bar (no "1 day ago" qualifier), unlike the
        -- spike SMAs above.
        AVG(volume) OVER (
            PARTITION BY equity_id ORDER BY trade_date
            ROWS BETWEEN {syd_liq_sma} PRECEDING AND CURRENT ROW
        ) AS sma_vol_liq
    FROM km_equity_eod
    WINDOW w AS (PARTITION BY equity_id ORDER BY trade_date)
)
UPDATE km_equity_eod e
   SET dot_sbd = COALESCE(
           b.n_sbd = {sbd_sma}
           AND b.high > b.low
           AND b.prev_close IS NOT NULL
           AND b.prev_vol   IS NOT NULL
           AND b.sma_vol_sbd > 0
           AND b.close  >= b.prev_close
           AND b.close  >= b.open
           AND b.volume >= b.prev_vol
           AND b.volume >= {sbd_mult} * b.sma_vol_sbd
           AND b.close  >  b.low + {sbd_pos} * (b.high - b.low)
       , FALSE),
       dot_svd = COALESCE(
           b.n_svd = {svd_sma}
           AND b.high > b.low
           AND b.sma_vol_svd > 0
           AND b.sma_150 IS NOT NULL
           AND b.pct_chng > {svd_pct}
           AND b.volume  > {svd_mult} * b.sma_vol_svd
           AND b.close   > b.low + {svd_pos} * (b.high - b.low)
           AND b.close  >= b.sma_150
       , FALSE),
       dot_syd = COALESCE(
           b.n_sbd = {syd_sma}
           AND b.high > b.low
           AND b.prev_close IS NOT NULL
           AND b.prev_vol   IS NOT NULL
           AND b.sma_vol_sbd > 0
           AND b.close  <  b.prev_close
           AND b.close  <  b.open
           AND b.volume >  b.prev_vol
           AND b.volume >= {syd_mult} * b.sma_vol_sbd
           AND b.close  <  b.low + {syd_pos} * (b.high - b.low)
           AND b.close * b.sma_vol_liq >= {syd_turnover}
       , FALSE)
  FROM base b
 WHERE e.id = b.id
   {date_clause}
"""

_VERIFY_SQL = """
SELECT s.exchange,
       count(*)                          AS rows,
       count(*) FILTER (WHERE e.dot_sbd) AS sbd_fires,
       count(*) FILTER (WHERE e.dot_svd) AS svd_fires,
       count(*) FILTER (WHERE e.dot_syd) AS syd_fires,
       count(*) FILTER (WHERE e.dot_svd AND NOT e.dot_sbd) AS svd_not_in_sbd,
       count(*) FILTER (WHERE e.dot_sbd AND e.dot_syd)     AS sbd_syd_conflict
  FROM km_equity_eod e
  JOIN km_equity_symbols s ON s.id = e.equity_id
 WHERE e.trade_date = %s
 GROUP BY s.exchange
 ORDER BY s.exchange
"""


def build_sql(date_from=None, date_to=None, single_date=None):
    if single_date:
        clause = 'AND e.trade_date = %(d)s'
    elif date_from and date_to:
        clause = 'AND e.trade_date BETWEEN %(f)s AND %(t)s'
    elif date_from:
        clause = 'AND e.trade_date >= %(f)s'
    else:
        clause = ''
    return _SQL.format(
        sbd_sma=SBD_VOL_SMA, sbd_mult=SBD_VOL_MULT, sbd_pos=SBD_CLOSE_POS,
        svd_sma=SVD_VOL_SMA, svd_mult=SVD_VOL_MULT, svd_pos=SVD_CLOSE_POS,
        svd_pct=SVD_MIN_PCT_CHG,
        syd_sma=SYD_VOL_SMA, syd_mult=SYD_VOL_MULT, syd_pos=SYD_CLOSE_POS,
        syd_liq_sma=SYD_LIQ_SMA, syd_turnover=SYD_MIN_TURNOVER,
        date_clause=clause,
    )


def run_verify(conn, target_date):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if not target_date:
            cur.execute('SELECT max(trade_date) AS d FROM km_equity_eod')
            target_date = cur.fetchone()['d']
        cur.execute(_VERIFY_SQL, [str(target_date)])
        rows = cur.fetchall()

    print(f'\n  Dot fire-rates for {target_date}:')
    if not rows:
        print('    (no rows for that date)')
        return
    for r in rows:
        print(f"    {r['exchange']}: {r['rows']:>6} rows | "
              f"SBD {r['sbd_fires']:>4} | SVD {r['svd_fires']:>4} | "
              f"SYD {r['syd_fires']:>4} | SVD outside SBD {r['svd_not_in_sbd']:>3} | "
              f"SBD+SYD both {r['sbd_syd_conflict']:>3}")
    print('\n  Expect SVD to be a near-subset of SBD (same shape, higher '
          'thresholds). A large "SVD outside SBD" means the definitions have '
          'drifted apart — check the tunables at the top of this file.')
    print('  "SBD+SYD both" MUST be 0 — SBD needs a green candle and SYD a red '
          'one, so a bar firing both means a sign error in the mirrored '
          'conditions.')


def main():
    ap = argparse.ArgumentParser(description='Compute dot_svd / dot_sbd on km_equity_eod')
    ap.add_argument('--from', dest='date_from', default=None, help='Start date YYYY-MM-DD')
    ap.add_argument('--to', dest='date_to', default=None, help='End date YYYY-MM-DD')
    ap.add_argument('--date', default=None, help='Single trade date YYYY-MM-DD')
    ap.add_argument('--verify', action='store_true', help='Report fire-rates, write nothing')
    args = ap.parse_args()

    conn = get_conn()
    conn.autocommit = False
    try:
        if args.verify:
            run_verify(conn, args.date)
            return

        sql = build_sql(args.date_from, args.date_to, args.date)
        params = {}
        if args.date:
            params['d'] = args.date
            scope = f'date {args.date}'
        elif args.date_from and args.date_to:
            params['f'], params['t'] = args.date_from, args.date_to
            scope = f'{args.date_from} .. {args.date_to}'
        elif args.date_from:
            params['f'] = args.date_from
            scope = f'from {args.date_from}'
        else:
            scope = 'FULL HISTORY'

        print(f'\n  Computing dot_sbd / dot_svd — scope: {scope}')
        print('  Window look-back spans full history regardless of scope.')
        print('  Single-pass UPDATE; progress is not printed — please wait...\n')

        t0 = time.time()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            updated = cur.rowcount
        conn.commit()
        print(f'  Updated {updated:,} rows in {time.time() - t0:.1f}s')

        run_verify(conn, args.date)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
