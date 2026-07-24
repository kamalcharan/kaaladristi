"""
lib/breadth_common.py
=====================
Shared data loading + close-series hygiene for the market-breadth computes
(compute_market_breadth.py, compute_breadth_roc.py).

Why cliff adjustment exists
---------------------------
km_equity_eod closes are raw bhavcopy values and km_corporate_actions is
unpopulated, so splits/bonuses leave permanent price cliffs in every series.
NSE price bands cap genuine single-day moves at ±20%, so a close that is
<0.55× or >1.80× the previous traded close is a corporate action, not a
market move. Left unadjusted, those cliffs poison every long-lookback
computation: a 2:1 bonus makes a stock read "below its 150-day MA" for
months and shows up as a fake −50% mover/ROC on the ex-date.

`adjust_close_cliffs` back-adjusts each series onto its current price scale
(the same thing a proper adj_factor would do), estimated from the observed
ex-date ratio. The estimate absorbs the ex-date's genuine move (±few %),
which is negligible for MA/ROC breadth purposes. When km_corporate_actions
is eventually populated, exact factors should replace this heuristic.
"""

import sys
import pandas as pd

# NSE price bands cap genuine moves at ±20% (stocks without derivatives);
# thresholds sit far outside that so only corporate actions trip them.
CLIFF_DOWN_RATIO = 0.55   # split / bonus
CLIFF_UP_RATIO   = 1.80   # reverse split / consolidation
CLIFF_MAX_GAP    = 10     # sessions; beyond this a jump may be a genuine
                          # suspension-return repricing — leave it alone


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


def adjust_close_cliffs(closes: pd.DataFrame) -> pd.DataFrame:
    """
    Back-adjust corporate-action price cliffs so each stock's history sits on
    its current price scale.

    A cliff at row t with observed ratio r (= close_t / last traded close)
    multiplies every earlier close by r — i.e. all rows before an event carry
    the cumulative product of all later event ratios, which is exactly how
    adj_factor back-adjustment works.
    """
    prev  = closes.ffill(limit=CLIFF_MAX_GAP).shift(1)
    ratio = closes / prev
    events = ratio.where((ratio < CLIFF_DOWN_RATIO) | (ratio > CLIFF_UP_RATIO))

    n_events = int(events.notna().sum().sum())
    if n_events == 0:
        return closes

    n_stocks = int((events.notna().any()).sum())
    print(f'  Cliff adjustment: {n_events} corporate-action cliffs across {n_stocks} stocks')

    factors = events.fillna(1.0)
    # Cumulative product of all future event ratios, per stock
    back = factors.iloc[::-1].cumprod().iloc[::-1].shift(-1).fillna(1.0)
    return closes * back
