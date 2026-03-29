"""SuperTrend indicator — ATR period 10, factor 3.0 (matching LuckyPop settings)."""

import pandas as pd
import numpy as np
from .atr import _atr


def compute_supertrend(df: pd.DataFrame) -> dict:
    period = 10
    factor = 3.0

    high = df['high'].astype(float)
    low = df['low'].astype(float)
    close = df['close'].astype(float)

    atr = _atr(high, low, close, period)
    hl2 = (high + low) / 2

    upper_band = hl2 + factor * atr
    lower_band = hl2 - factor * atr

    n = len(df)
    supertrend = np.full(n, np.nan)
    direction = np.full(n, 0, dtype=int)

    for i in range(1, n):
        if np.isnan(atr.iloc[i]):
            continue

        # Lower band logic: keep previous if higher
        if lower_band.iloc[i] < lower_band.iloc[i - 1] and close.iloc[i - 1] > lower_band.iloc[i - 1]:
            lower_band.iloc[i] = lower_band.iloc[i - 1]

        # Upper band logic: keep previous if lower
        if upper_band.iloc[i] > upper_band.iloc[i - 1] and close.iloc[i - 1] < upper_band.iloc[i - 1]:
            upper_band.iloc[i] = upper_band.iloc[i - 1]

        # Direction
        if i == 1 or np.isnan(supertrend[i - 1]):
            direction[i] = 1 if close.iloc[i] > upper_band.iloc[i] else -1
        elif supertrend[i - 1] == upper_band.iloc[i - 1]:
            direction[i] = 1 if close.iloc[i] > upper_band.iloc[i] else -1
        else:
            direction[i] = -1 if close.iloc[i] < lower_band.iloc[i] else 1

        supertrend[i] = lower_band.iloc[i] if direction[i] == 1 else upper_band.iloc[i]

    return {
        'supertrend': pd.Series(supertrend, index=df.index),
        'supertrend_dir': pd.Series(direction, index=df.index).replace(0, np.nan),
    }
