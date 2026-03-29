"""RSS (Relative Spread Strength) — from LuckyPop RSSI.

Spread = SMA(10) - SMA(40) of close
RS = RSI(5) of Spread
Smooth = SMA(3) of RS
"""

import pandas as pd
import numpy as np
from .rsi import _rsi


def compute_rss(df: pd.DataFrame) -> dict:
    close = df['close'].astype(float)

    e1 = close.rolling(window=10, min_periods=10).mean()
    e2 = close.rolling(window=40, min_periods=40).mean()
    spread = e1 - e2

    rs = _rsi(spread, 5)
    smooth = rs.rolling(window=3, min_periods=3).mean()

    # Also compute raw RSI(14) for divergence detection
    rss_rsi = _rsi(close, 14)

    return {
        'rss_value': smooth.round(4),
        'rss_rsi': rss_rsi.round(4),
    }
