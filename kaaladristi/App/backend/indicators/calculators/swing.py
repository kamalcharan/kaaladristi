"""Swing High / Low detection.

Swing High: high is highest in left_lookback + right_lookback window
Swing Low:  low is lowest in the same window
Matching LuckyPop settings: left=15, right=10
"""

import pandas as pd
import numpy as np


def compute_swing(df: pd.DataFrame) -> dict:
    left = 15
    right = 10
    high = df['high'].astype(float)
    low = df['low'].astype(float)

    n = len(df)
    swing_high = np.zeros(n, dtype=bool)
    swing_low = np.zeros(n, dtype=bool)

    for i in range(left, n - right):
        window_high = high.iloc[i - left:i + right + 1]
        if high.iloc[i] == window_high.max():
            swing_high[i] = True

        window_low = low.iloc[i - left:i + right + 1]
        if low.iloc[i] == window_low.min():
            swing_low[i] = True

    return {
        'swing_high': pd.Series(swing_high, index=df.index),
        'swing_low': pd.Series(swing_low, index=df.index),
    }
