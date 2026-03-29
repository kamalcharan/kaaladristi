"""RSI (Relative Strength Index) — periods 9 and 14.

Uses Wilder's smoothing (exponential moving average) to match TradingView/Pine Script.
"""

import pandas as pd
import numpy as np


def _rsi(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)

    # Wilder's smoothing (same as Pine Script ta.rsi)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def compute_rsi(df: pd.DataFrame) -> dict:
    close = df['close'].astype(float)
    return {
        'rsi_14': _rsi(close, 14),
        'rsi_9': _rsi(close, 9),
    }
