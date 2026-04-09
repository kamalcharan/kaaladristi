"""
compute_breadth_roc.py
======================
Computes ROC-based market breadth oscillator from km_equity_eod
and upserts into km_breadth_roc.

Formula (mirrors Chartink GroupAvg approach):
  ROC_13     = GroupAvg( (Close - Close[13]) / Close[13] × 100 ) / 13
  ROC_55     = GroupAvg( (Close - Close[55]) / Close[55] × 100 ) / 55
  SMA_BREADTH = 5-period rolling average of ROC_13

Interpretation:
  Positive → average stock is accelerating upward (bullish momentum breadth)
  Negative → average stock is decelerating / falling (bearish momentum breadth)
  Zero crossing → momentum regime shift
  SMA crossing ROC_13 → smoothed confirmation / divergence

Prerequisites:
  - Run migration 021 (creates km_breadth_roc table)
  - km_equity_eod populated with NSE equity close prices

Usage (from App/backend):
    python compute_breadth_roc.py            # upsert missing dates only
    python compute_breadth_roc.py --all      # recompute all
    python compute_breadth_roc.py --date 2026-04-09
    python compute_breadth_roc.py --dry-run  # preview last 5 rows
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

# ── Data loading ──────────────────────────────────────────────────────────────

def load_closes(conn) -> pd.DataFrame:
    """Load all NSE equity close prices as a pivot (index=date, cols=equity_id)."""
    sql = """
        SELECT e.trade_date, e.equity_id, e.close
        FROM   km_equity_eod    e
        JOIN   km_equity_symbols s ON s.id = e.equity_id
        WHERE  s.exchange = 'NSE'
          AND  e.close    IS NOT NULL
        ORDER  BY e.trade_date
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    if not rows:
        print('  No NSE equity EOD data found.')
        sys.exit(1)

    df = pd.DataFrame(rows, columns=['trade_date', 'equity_id', 'close'])
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df['close']      = df['close'].astype(float)

    pivot = df.pivot(index='trade_date', columns='equity_id', values='close')
    pivot = pivot.sort_index()
    print(f'  Loaded {len(pivot.columns):,} stocks × {len(pivot):,} dates')
    return pivot

# ── Computation ───────────────────────────────────────────────────────────────

def compute_roc(closes: pd.DataFrame) -> pd.DataFrame:
    """
    For each date compute roc_13, roc_55, sma_breadth.
    Drops early warmup rows where 5-period SMA of ROC_13 isn't available.
    """
    # Per-stock ROC: (Close - Close[N]) / Close[N] * 100
    roc_13_stocks = (closes - closes.shift(13)) / closes.shift(13) * 100
    roc_55_stocks = (closes - closes.shift(55)) / closes.shift(55) * 100

    # GroupAvg across stocks (skip NaN), then normalise by lookback period
    roc_13 = roc_13_stocks.mean(axis=1, skipna=True) / 13
    roc_55 = roc_55_stocks.mean(axis=1, skipna=True) / 55

    # 5-period SMA of roc_13 (smoothed oscillator signal)
    sma = roc_13.rolling(5, min_periods=5).mean()

    # Stock count = stocks contributing to the 55-day reading (most conservative)
    stock_count = roc_55_stocks.notna().sum(axis=1)

    out = pd.DataFrame({
        'roc_13':      roc_13.round(4),
        'roc_55':      roc_55.round(4),
        'sma_breadth': sma.round(4),
        'stock_count': stock_count.astype(int),
    })

    # Drop warmup period (need 55 days for roc_55 + 5 for SMA)
    out = out[out['sma_breadth'].notna() & out['roc_55'].notna()]
    out.index = out.index.date
    return out

# ── Upsert ────────────────────────────────────────────────────────────────────

UPSERT_SQL = """
    INSERT INTO km_breadth_roc
        (trade_date, roc_13, roc_55, sma_breadth, stock_count)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (trade_date) DO UPDATE SET
        roc_13       = EXCLUDED.roc_13,
        roc_55       = EXCLUDED.roc_55,
        sma_breadth  = EXCLUDED.sma_breadth,
        stock_count  = EXCLUDED.stock_count
"""

def upsert(conn, df: pd.DataFrame, dry_run: bool) -> int:
    rows = [
        (
            str(date),
            float(row['roc_13']),
            float(row['roc_55']),
            float(row['sma_breadth']),
            int(row['stock_count']),
        )
        for date, row in df.iterrows()
    ]

    if dry_run:
        print('\n  Preview (last 5 rows):')
        for r in rows[-5:]:
            bias = 'BULL' if r[1] > 0 else 'BEAR'
            sma_dir = '↑' if r[3] > 0 else '↓'
            print(f'    {r[0]}  roc13={r[1]:+.4f} ({bias})  '
                  f'roc55={r[2]:+.4f}  sma={r[3]:+.4f}{sma_dir}')
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

        print('Computing ROC breadth...')
        df = compute_roc(closes)
        print(f'  {len(df):,} dates computed')

        if args.date:
            df = df[df.index == args.date]
            if df.empty:
                print(f'  Date {args.date} not in computed range.')
                return
        elif not args.all:
            with conn.cursor() as cur:
                cur.execute('SELECT trade_date FROM km_breadth_roc')
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
            bias = 'BULL' if latest['roc_13'] > 0 else 'BEAR'
            print(f'\nDone — {n:,} rows upserted')
            print(f'Latest: {df.index[-1]}  roc13={latest["roc_13"]:+.4f} ({bias})'
                  f'  roc55={latest["roc_55"]:+.4f}'
                  f'  sma={latest["sma_breadth"]:+.4f}'
                  f'  stocks={int(latest["stock_count"]):,}')

    except Exception as e:
        conn.rollback()
        print(f'FATAL: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
