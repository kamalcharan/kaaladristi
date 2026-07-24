"""
compute_market_breadth.py
=========================
Computes EMA-based market breadth scores from km_equity_eod and upserts
into km_market_breadth.

Breadth Score = 50% × (% stocks above 20-day EMA)
              + 30% × (% stocks above 50-day EMA)
              + 20% × (% stocks above 150-day EMA)

Regimes: Greed > 55  ·  Neutral 35-55  ·  Fear < 35

Prerequisites:
  - Run migration 020 (creates km_market_breadth table)
  - km_equity_eod populated with NSE equity close prices

Usage (from App/backend):
    python compute_market_breadth.py            # upsert missing dates only
    python compute_market_breadth.py --all      # recompute everything
    python compute_market_breadth.py --date 2026-04-09
    python compute_market_breadth.py --dry-run  # preview last 5 rows
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras
import pandas as pd
import numpy as np

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(script_dir, '..', '.env'))

from lib.config import DATABASE_URL
from lib.breadth_common import load_closes, adjust_close_cliffs  # noqa: F401 — load_closes re-exported for pipeline2/handlers.py

# ── Config ────────────────────────────────────────────────────────────────────

EMA_SPANS = [20, 50, 150]
WEIGHTS   = {20: 0.50, 50: 0.30, 150: 0.20}

# ── Computation ───────────────────────────────────────────────────────────────

def _ema_traded_bars(closes: pd.DataFrame, span: int) -> pd.DataFrame:
    """
    EMA per stock over its OWN traded bars only.

    A full-frame ewm() carries the EMA forward through NaN closes, so a
    delisted/suspended stock keeps a "valid" EMA forever and silently counts
    as "below MA" in every denominator (~120 phantom stocks depressing the
    score by ~3 pts, found 2026-07-24). Computing on each stock's dropna
    series and reindexing back leaves an EMA value only on days the stock
    actually traded — matching the per-stock indicator-column semantics.
    """
    cols = {}
    for col in closes.columns:
        s = closes[col].dropna()
        if len(s) >= span:
            cols[col] = s.ewm(span=span, min_periods=span, adjust=False).mean()
    return pd.DataFrame(cols).reindex(index=closes.index, columns=closes.columns)


def compute_breadth(closes: pd.DataFrame) -> pd.DataFrame:
    """
    For each date compute pct_above_20/50/150 + breadth_score PLUS the
    movers/thrust dimensions: universe/above counts and daily/5-day
    extreme-mover counts.

    Hygiene (2026-07-24 fix — score previously read systematically low vs
    reference breadth sources):
      - closes are cliff-adjusted first (unadjusted splits/bonuses inflated
        long EMAs → stocks read "below 150-EMA" for months after a split)
      - every denominator requires the stock to have TRADED that day with a
        warmed-up MA (no phantom delisted/suspended stocks)

    The count columns share ONE daily universe = stocks with a valid 150-day
    MA (the most conservative set), so above+below reconciles to universe.
    Drops early dates where the 150-day MA hasn't warmed up yet.
    """
    closes = adjust_close_cliffs(closes)

    pct = {}
    above_by_span = {}
    valid_150 = None

    for span in EMA_SPANS:
        ema   = _ema_traded_bars(closes, span)
        above = closes > ema          # False wherever close or EMA is NaN
        valid = ema.notna()           # traded that day + span bars of history

        n_valid = valid.sum(axis=1).replace(0, np.nan)
        pct[span] = (above.sum(axis=1) / n_valid * 100).round(2)
        above_by_span[span] = above
        if span == 150:
            valid_150 = valid

    out = pd.DataFrame(index=closes.index)
    out['pct_above_20']  = pct[20]
    out['pct_above_50']  = pct[50]
    out['pct_above_150'] = pct[150]

    out['breadth_score'] = (
        out['pct_above_20']  * WEIGHTS[20]  +
        out['pct_above_50']  * WEIGHTS[50]  +
        out['pct_above_150'] * WEIGHTS[150]
    ).round(2)

    # ── Shared universe = stocks traded today with a valid 150-MA ─────────────
    universe = valid_150
    n_universe = universe.sum(axis=1)
    out['stock_count']    = n_universe.astype(int)   # kept for back-compat
    out['universe_count'] = n_universe.astype(int)

    # Above-counts recounted against the SINGLE 150-universe (above+below=universe)
    for span in EMA_SPANS:
        out[f'above_{span}'] = (above_by_span[span] & universe).sum(axis=1).astype(int)

    # ── Movers / thrust — over the same 150-universe ──────────────────────────
    # Manual ffill/shift instead of pct_change: identical padding semantics on
    # every pandas version, and cliff-adjusted closes mean a split ex-date no
    # longer registers as a fake −50% mover.
    cf = closes.ffill()
    ret_1d = (cf / cf.shift(1) - 1) * 100
    ret_5d = (cf / cf.shift(5) - 1) * 100
    out['up_5pct']       = ((ret_1d >  5) & universe).sum(axis=1).astype(int)
    out['down_5pct']     = ((ret_1d < -5) & universe).sum(axis=1).astype(int)
    out['up_20pct_5d']   = ((ret_5d >  20) & universe).sum(axis=1).astype(int)
    out['down_20pct_5d'] = ((ret_5d < -20) & universe).sum(axis=1).astype(int)

    # Drop warmup rows (where no stock has a valid 150 MA yet)
    out = out[out['pct_above_150'].notna()]
    out.index = out.index.date   # convert to date objects for DB insertion
    return out

# ── Upsert ────────────────────────────────────────────────────────────────────

UPSERT_SQL = """
    INSERT INTO km_market_breadth
        (trade_date, pct_above_20, pct_above_50, pct_above_150, breadth_score, stock_count,
         universe_count, above_20, above_50, above_150,
         up_5pct, down_5pct, up_20pct_5d, down_20pct_5d)
    VALUES (%s, %s, %s, %s, %s, %s,  %s, %s, %s, %s,  %s, %s, %s, %s)
    ON CONFLICT (trade_date) DO UPDATE SET
        pct_above_20   = EXCLUDED.pct_above_20,
        pct_above_50   = EXCLUDED.pct_above_50,
        pct_above_150  = EXCLUDED.pct_above_150,
        breadth_score  = EXCLUDED.breadth_score,
        stock_count    = EXCLUDED.stock_count,
        universe_count = EXCLUDED.universe_count,
        above_20       = EXCLUDED.above_20,
        above_50       = EXCLUDED.above_50,
        above_150      = EXCLUDED.above_150,
        up_5pct        = EXCLUDED.up_5pct,
        down_5pct      = EXCLUDED.down_5pct,
        up_20pct_5d    = EXCLUDED.up_20pct_5d,
        down_20pct_5d  = EXCLUDED.down_20pct_5d
"""

def upsert(conn, df: pd.DataFrame, dry_run: bool) -> int:
    rows = [
        (
            str(date),
            float(row['pct_above_20']),
            float(row['pct_above_50']),
            float(row['pct_above_150']),
            float(row['breadth_score']),
            int(row['stock_count']),
            int(row['universe_count']),
            int(row['above_20']),
            int(row['above_50']),
            int(row['above_150']),
            int(row['up_5pct']),
            int(row['down_5pct']),
            int(row['up_20pct_5d']),
            int(row['down_20pct_5d']),
        )
        for date, row in df.iterrows()
    ]

    if dry_run:
        print('\n  Preview (last 5 rows):')
        for r in rows[-5:]:
            score = r[4]
            regime = 'Greed' if score > 55 else 'Fear' if score < 35 else 'Neutral'
            print(f'    {r[0]}  score={score:5.1f} ({regime:<7})  '
                  f'20EMA={r[1]:5.1f}%  50EMA={r[2]:5.1f}%  150EMA={r[3]:5.1f}%')
        print(f'\n  {len(rows)} rows total (dry run — nothing written)')
        return len(rows)

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, UPSERT_SQL, rows, page_size=1000)
    conn.commit()
    return len(rows)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date',    help='Single date YYYY-MM-DD')
    parser.add_argument('--all',     action='store_true', help='Recompute all dates')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    args = parser.parse_args()

    if not DATABASE_URL:
        print('ERROR: DATABASE_URL not set — check App/.env')
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        print('Loading NSE equity closes...')
        closes = load_closes(conn)

        print('Computing EMA breadths...')
        df = compute_breadth(closes)
        print(f'  {len(df):,} dates computed (after 150-EMA warmup)')

        # Filter to target dates
        if args.date:
            df = df[df.index == args.date]
            if df.empty:
                print(f'  Date {args.date} not in computed range.')
                return
        elif not args.all:
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_market_breadth')
                existing = {str(r[0]) for r in cur.fetchall()}
            df = df[[str(d) not in existing for d in df.index]]

        if df.empty:
            print('No new rows to upsert.')
            return

        tag = '[DRY RUN] ' if args.dry_run else ''
        print(f'\n{tag}Upserting {len(df):,} rows...')
        n = upsert(conn, df, dry_run=args.dry_run)

        if not args.dry_run:
            latest = df.iloc[-1]
            score  = latest['breadth_score']
            regime = 'Greed' if score > 55 else 'Fear' if score < 35 else 'Neutral'
            print(f'\nDone — {n:,} rows upserted')
            print(f'Latest: {df.index[-1]}  score={score:.1f} ({regime})'
                  f'  20EMA={latest["pct_above_20"]:.1f}%'
                  f'  50EMA={latest["pct_above_50"]:.1f}%'
                  f'  150EMA={latest["pct_above_150"]:.1f}%'
                  f'  stocks={int(latest["stock_count"]):,}')

    except Exception as e:
        conn.rollback()
        print(f'FATAL: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
