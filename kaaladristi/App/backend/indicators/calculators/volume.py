"""Relative Volume (RVol) and Total Volume ratio (TVol).

RVol = current volume / SMA(50) of volume  — unusual activity detection
TVol = current volume / SMA(20) of volume  — short-term activity
"""

import pandas as pd
import numpy as np


def compute_volume(df: pd.DataFrame) -> dict:
    volume = df['volume'].astype(float).fillna(0)

    avg_vol_50 = volume.rolling(window=50, min_periods=50).mean()
    avg_vol_20 = volume.rolling(window=20, min_periods=20).mean()

    rvol = volume / avg_vol_50.replace(0, np.nan)
    tvol = volume / avg_vol_20.replace(0, np.nan)

    return {
        'rvol': rvol.round(4),
        'tvol': tvol.round(4),
    }
