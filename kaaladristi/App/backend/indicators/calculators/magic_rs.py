"""MagicRS — Relative Strength vs Benchmark (CNX500).

Port of LuckyPop SuperMagic Enhanced.

MagicRS = ((symbol_close / benchmark_close) / SMA144(ratio) - 1) * 100
MagicMA = SMA(60) of MagicRS
Zone = based on distance between MagicRS and MagicMA
"""

import pandas as pd
import numpy as np


def compute_magic_rs(df: pd.DataFrame, benchmark_close: pd.Series) -> dict:
    """
    Args:
        df: OHLCV DataFrame for the symbol, indexed/aligned by trade_date
        benchmark_close: Series of benchmark close prices, aligned to same dates
    """
    close = df['close'].astype(float)

    # Align benchmark to symbol's dates
    bench = benchmark_close.reindex(df.index).astype(float)

    ratio = close / bench.replace(0, np.nan)

    # SMA(144) of ratio
    ratio_sma144 = ratio.rolling(window=144, min_periods=144).mean()

    # MagicRS value
    magic_rs = ((ratio / ratio_sma144.replace(0, np.nan)) - 1) * 100

    # MagicMA = SMA(60) of MagicRS
    magic_ma = magic_rs.rolling(window=60, min_periods=60).mean()

    # Zone determination (adaptive threshold using base 6%)
    threshold = 6.0
    diff = (magic_rs - magic_ma).abs()

    def _zone(rs_val, ma_val, d):
        if pd.isna(rs_val) or pd.isna(ma_val):
            return None
        if rs_val > ma_val:
            return 'Strong Bull' if d > threshold * 1.5 else ('Mild Bull' if d > threshold else 'Neutral')
        else:
            return 'Strong Bear' if d > threshold * 1.5 else ('Mild Bear' if d > threshold else 'Neutral')

    zone = pd.Series(
        [_zone(r, m, d) for r, m, d in zip(magic_rs, magic_ma, diff)],
        index=df.index,
    )

    return {
        'magic_rs': magic_rs.round(4),
        'magic_rs_sma144': ratio_sma144.round(6),
        'magic_ma': magic_ma.round(4),
        'magic_rs_zone': zone,
    }
