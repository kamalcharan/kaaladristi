"""Classic Pivot Points — calculated from PREVIOUS day's OHLC.

PP  = (High + Low + Close) / 3
R1  = 2*PP - Low
S1  = 2*PP - High
R2  = PP + (High - Low)
S2  = PP - (High - Low)
R3  = High + 2*(PP - Low)
S3  = Low - 2*(High - PP)
"""

import pandas as pd
import numpy as np


def compute_pivots(df: pd.DataFrame) -> dict:
    high = df['high'].astype(float).shift(1)
    low = df['low'].astype(float).shift(1)
    close = df['close'].astype(float).shift(1)

    pp = (high + low + close) / 3
    r1 = 2 * pp - low
    s1 = 2 * pp - high
    r2 = pp + (high - low)
    s2 = pp - (high - low)
    r3 = high + 2 * (pp - low)
    s3 = low - 2 * (high - pp)

    return {
        'pivot_pp': pp.round(2),
        'pivot_r1': r1.round(2),
        'pivot_r2': r2.round(2),
        'pivot_r3': r3.round(2),
        'pivot_s1': s1.round(2),
        'pivot_s2': s2.round(2),
        'pivot_s3': s3.round(2),
    }
