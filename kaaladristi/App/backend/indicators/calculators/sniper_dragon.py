"""Sniper Scope Dragon — Institutional / Hot Money / Retail histogram.

Port of Pine Script: bids_sniper "Sniper Scope Dragon"
Uses modified RSI with sensitivity scaling.
"""

import pandas as pd
import numpy as np
from .rsi import _rsi


def _sniper_rsi(close: pd.Series, period: int, base: float, sensitivity: float) -> pd.Series:
    raw = _rsi(close, period)
    scaled = sensitivity * (raw - base)
    return scaled.clip(lower=0, upper=50)


def compute_sniper_dragon(df: pd.DataFrame) -> dict:
    close = df['close'].astype(float)

    # Institutional (Banker): RSI(9), base=61, sensitivity=1.5
    inst = _sniper_rsi(close, period=9, base=61, sensitivity=1.5)

    # Hot Money: RSI(4), base=15, sensitivity=1.0
    hot = _sniper_rsi(close, period=4, base=15, sensitivity=1.0)

    # Sniper RSI line: RSI(9) scaled to 0-50 range
    raw_rsi = _rsi(close, 9)
    sniper_rsi = raw_rsi / 2  # scale 0-100 to 0-50

    return {
        'sniper_inst': inst.round(4),
        'sniper_hot': hot.round(4),
        'sniper_rsi': sniper_rsi.round(4),
    }
