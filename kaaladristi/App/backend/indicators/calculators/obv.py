"""On-Balance Volume (OBV) + OBV SMA(20)."""

import pandas as pd
import numpy as np


def compute_obv(df: pd.DataFrame) -> dict:
    close = df['close'].astype(float)
    volume = df['volume'].astype(float).fillna(0)

    direction = np.sign(close.diff())
    direction.iloc[0] = 0

    obv = (direction * volume).cumsum()
    obv_sma = obv.rolling(window=20, min_periods=20).mean()

    return {
        'obv': obv.astype('Int64'),
        'obv_sma_20': obv_sma,
    }
