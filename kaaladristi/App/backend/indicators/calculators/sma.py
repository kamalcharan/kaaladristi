"""Simple Moving Averages: 8, 21, 50, 55, 89, 150 (Golden Line), 200, 233."""

import pandas as pd

SMA_PERIODS = [8, 21, 50, 55, 89, 150, 200, 233]


def compute_sma(df: pd.DataFrame) -> dict:
    result = {}
    close = df['close'].astype(float)
    for p in SMA_PERIODS:
        result[f'sma_{p}'] = close.rolling(window=p, min_periods=p).mean()
    return result
