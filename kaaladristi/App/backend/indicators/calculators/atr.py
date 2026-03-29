"""Average True Range (ATR) — periods 10 and 14.

Uses Wilder's smoothing to match Pine Script.
"""

import pandas as pd
import numpy as np


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)

    # Wilder's smoothing
    atr = tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    return atr


def compute_atr(df: pd.DataFrame) -> dict:
    high = df['high'].astype(float)
    low = df['low'].astype(float)
    close = df['close'].astype(float)
    return {
        'atr_10': _atr(high, low, close, 10),
        'atr_14': _atr(high, low, close, 14),
    }
