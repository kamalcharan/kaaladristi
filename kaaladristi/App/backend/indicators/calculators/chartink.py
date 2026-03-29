"""Chartink Rules from LuckyPop Enhanced.

Rule 1 - EMD (Explosive Move Detection): 8-week % move
Rule 2 - CA  (Correction Analysis): % correction from recent high
Rule 3 - VMAC (Volume + MA Confluence): volume surge near key MAs
"""

import pandas as pd
import numpy as np


def compute_chartink(df: pd.DataFrame) -> dict:
    close = df['close'].astype(float)
    high = df['high'].astype(float)
    volume = df['volume'].astype(float).fillna(0)

    # Rule 1: EMD — 8 weeks ≈ 40 trading days
    weeks_lookback = 40
    past_price = close.shift(weeks_lookback)
    emd_pct = ((close - past_price) / past_price.replace(0, np.nan)) * 100
    emd_ok = emd_pct >= 100.0  # threshold from Pine Script

    # Rule 2: CA — correction from recent high (max 30 weeks = 150 bars)
    correction_lookback = 150
    recent_high = high.rolling(window=correction_lookback, min_periods=1).max()
    ca_pct = ((recent_high - close) / recent_high.replace(0, np.nan)) * 100
    ca_ok = (ca_pct <= 20.0) & (ca_pct >= 0)

    # Rule 3: VMAC — volume surge (1.5x SMA20) + price near SMA(21/55/150)
    avg_vol_20 = volume.rolling(window=20, min_periods=20).mean()
    vol_surge = volume >= avg_vol_20 * 1.5

    sma_21 = close.rolling(window=21, min_periods=21).mean()
    sma_55 = close.rolling(window=55, min_periods=55).mean()
    sma_150 = close.rolling(window=150, min_periods=150).mean()

    near_21 = ((close - sma_21).abs() / sma_21.replace(0, np.nan) * 100) <= 3.0
    near_55 = ((close - sma_55).abs() / sma_55.replace(0, np.nan) * 100) <= 3.0
    near_150 = ((close - sma_150).abs() / sma_150.replace(0, np.nan) * 100) <= 3.0
    ma_proximity = near_21 | near_55 | near_150

    vmac_ok = vol_surge & ma_proximity

    # Score: 0-3
    score = emd_ok.astype(int) + ca_ok.astype(int) + vmac_ok.astype(int)

    return {
        'chartink_emd_pct': emd_pct.round(2),
        'chartink_emd_ok': emd_ok,
        'chartink_ca_pct': ca_pct.round(2),
        'chartink_ca_ok': ca_ok,
        'chartink_vmac_ok': vmac_ok,
        'chartink_score': score,
    }
