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

# ── Config ────────────────────────────────────────────────────────────────────

EMA_SPANS = [20, 50, 150]
WEIGHTS   = {20: 0.50, 50: 0.30, 150: 0.20}

# ── Data loading ──────────────────────────────────────────────────────────────

def load_closes(conn) -> pd.DataFrame:
    """
    Load all NSE equity close prices.
    Returns a DataFrame: index=trade_date (datetime), columns=equity_id.
    """
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

def compute_breadth(closes: pd.DataFrame) -> pd.DataFrame:
    """
    For each date compute pct_above_20/50/150 and breadth_score.
    Drops early dates where the 150-day EMA hasn't warmed up yet.
    """
    pct = {}
    valid_mask = pd.DataFrame(index=closes.index, dtype=bool)

    for span in EMA_SPANS:
        ema   = closes.ewm(span=span, min_periods=span, adjust=False).mean()
        above = (closes > ema).astype(float)

        # Per-date: only count stocks that have a valid EMA
        has_ema = ema.notna()
        n_valid = has_ema.sum(axis=1).replace(0, np.nan)
        n_above = (above * has_ema).sum(axis=1)

        pct[span] = (n_above / n_valid * 100).round(2)
        valid_mask[span] = n_valid.notna()

    out = pd.DataFrame(index=closes.index)
    out['pct_above_20']  = pct[20]
    out['pct_above_50']  = pct[50]
    out['pct_above_150'] = pct[150]

    out['breadth_score'] = (
        out['pct_above_20']  * WEIGHTS[20]  +
        out['pct_above_50']  * WEIGHTS[50]  +
        out['pct_above_150'] * WEIGHTS[150]
    ).round(2)

    # Stock count = number of stocks with a valid 150-EMA (most conservative)
    ema150 = closes.ewm(span=150, min_periods=150, adjust=False).mean()
    out['stock_count'] = ema150.notna().sum(axis=1).astype(int)

    # Drop warmup rows (where 150 EMA hasn't kicked in)
    out = out[valid_mask[150]]
    out.index = out.index.date   # convert to date objects for DB insertion
    return out

# ── Upsert ────────────────────────────────────────────────────────────────────

UPSERT_SQL = """
    INSERT INTO km_market_breadth
        (trade_date, pct_above_20, pct_above_50, pct_above_150, breadth_score, stock_count)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON CONFLICT (trade_date) DO UPDATE SET
        pct_above_20  = EXCLUDED.pct_above_20,
        pct_above_50  = EXCLUDED.pct_above_50,
        pct_above_150 = EXCLUDED.pct_above_150,
        breadth_score = EXCLUDED.breadth_score,
        stock_count   = EXCLUDED.stock_count
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
