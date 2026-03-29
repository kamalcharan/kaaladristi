from .sma import compute_sma
from .rsi import compute_rsi
from .mfi import compute_mfi
from .atr import compute_atr
from .supertrend import compute_supertrend
from .obv import compute_obv
from .volume import compute_volume
from .magic_rs import compute_magic_rs
from .sniper_dragon import compute_sniper_dragon
from .rss import compute_rss
from .pivots import compute_pivots
from .chartink import compute_chartink
from .dots import compute_dots
from .swing import compute_swing

ALL_CALCULATORS = [
    compute_sma,
    compute_rsi,
    compute_mfi,
    compute_atr,
    compute_supertrend,
    compute_obv,
    compute_volume,
    compute_sniper_dragon,
    compute_rss,
    compute_pivots,
    compute_chartink,
    compute_dots,
    compute_swing,
]

# MagicRS needs benchmark data — called separately
