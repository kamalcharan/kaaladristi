"""Dot Signals from LuckyPop Enhanced — SVD, SBD, SYD.

SVD (Solid Violet Dot): Massive volume surge + strong bullish close
SBD (Solid Blue Dot):   Moderate volume surge + bullish close
SYD (Solid Yellow Dot): Bearish reversal with high volume
"""

import pandas as pd
import numpy as np


def compute_dots(df: pd.DataFrame) -> dict:
    close = df['close'].astype(float)
    open_ = df['open'].astype(float)
    high = df['high'].astype(float)
    low = df['low'].astype(float)
    volume = df['volume'].astype(float).fillna(0)

    vol_avg_52 = volume.rolling(window=52, min_periods=52).mean()
    vol_avg_50 = volume.rolling(window=50, min_periods=50).mean()

    candle_range = high - low
    body = (close - open_).abs()
    body_ratio = body / candle_range.replace(0, np.nan)

    prev_close = close.shift(1)
    hl_mid = (high + low) / 2

    # SVD: volume >= 10x avg, close > mid, close > open, body ratio >= 0.5, close > prev_close * 1.03
    svd = (
        (volume >= 10 * vol_avg_52) &
        (close > hl_mid) &
        (close > open_) &
        (body_ratio >= 0.5) &
        (close > prev_close * 1.03) &
        (volume > 1000)
    )

    # SBD: volume >= 3x avg (but < 10x), close > prev, close near high, body ratio >= 0.5
    sbd = (
        (volume >= 3 * vol_avg_52) &
        (volume < 10 * vol_avg_52) &
        (close > prev_close) &
        (close > high - candle_range / 3) &
        (body_ratio >= 0.5) &
        (volume > 1000)
    )

    # SYD: close < prev, volume >= 2x avg50, close in lower third, volume > prev volume
    prev_vol = volume.shift(1)
    syd = (
        (close < prev_close) &
        (volume >= 2 * vol_avg_50) &
        (close < low + candle_range / 3) &
        (volume > prev_vol)
    )

    return {
        'dot_svd': svd.fillna(False),
        'dot_sbd': sbd.fillna(False),
        'dot_syd': syd.fillna(False),
    }
