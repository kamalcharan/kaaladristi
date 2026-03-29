"""Money Flow Index (MFI) — period 14.

MFI uses typical price * volume to measure buying/selling pressure.
"""

import pandas as pd
import numpy as np


def compute_mfi(df: pd.DataFrame) -> dict:
    period = 14
    high = df['high'].astype(float)
    low = df['low'].astype(float)
    close = df['close'].astype(float)
    volume = df['volume'].astype(float).fillna(0)

    typical_price = (high + low + close) / 3
    raw_money_flow = typical_price * volume

    delta = typical_price.diff()
    pos_flow = pd.Series(np.where(delta > 0, raw_money_flow, 0), index=df.index)
    neg_flow = pd.Series(np.where(delta < 0, raw_money_flow, 0), index=df.index)

    pos_sum = pos_flow.rolling(window=period, min_periods=period).sum()
    neg_sum = neg_flow.rolling(window=period, min_periods=period).sum()

    money_ratio = pos_sum / neg_sum.replace(0, np.nan)
    mfi = 100 - (100 / (1 + money_ratio))

    return {'mfi_14': mfi}
