-- ============================================================================
-- KĀLA-DRISHTI: ADD LUCKYPOP INDICATOR COLUMNS TO km_index_eod
-- Pre-computed technical indicators from all 4 PineScript files
-- Run AFTER km_restructure_eod.sql (existing OHLCV columns stay untouched)
-- ============================================================================

-- ── SMA Lines (6 moving averages) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_8           NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_21          NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_55          NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_89          NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_233         NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS golden_line     NUMERIC;  -- SMA(150)

-- ── SMA Distances (% from close) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS dist_sma_8      NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS dist_sma_21     NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS dist_sma_55     NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS dist_golden     NUMERIC;

-- ── SuperTrend ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS supertrend_val  NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS supertrend_dir  SMALLINT;   -- 1=up, -1=down
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS st_buy_signal   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS st_sell_signal  BOOLEAN DEFAULT FALSE;

-- ── Dot Signals (Volume-based) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS svd_condition   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sbd_condition   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS syd_condition   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS pre_syd_warning BOOLEAN DEFAULT FALSE;

-- ── RSI / MFI / OBV ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rsi             NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS mfi             NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS mfi_rsi_cross   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS obv_trend       TEXT;       -- Bullish|Bearish|Neutral

-- ── Volume Metrics ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rel_volume      NUMERIC;    -- volume/SMA(vol,55)
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rvol            NUMERIC;    -- volume/SMA(vol,50)
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS tvol            NUMERIC;    -- volume/SMA(vol,20)
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS avg_range       NUMERIC;    -- SMA(high-low,233)

-- ── RSS (Relative Strength Spread) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rss_smooth      NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rss_spread      NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rss_direction   BOOLEAN;    -- E1>E2

-- ── IB30 / IS30 (Initial Balance — mainly for intraday, nullable for EOD) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS ib30_high       NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS ib30_low        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS ib30_established BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS ib30_status     TEXT;       -- FORMING|BREAK UP|BREAK DOWN|INSIDE
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS is30_bull_break BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS is30_bear_break BOOLEAN DEFAULT FALSE;

-- ── Chartink Rules ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rule1_move_pct  NUMERIC;    -- Explosive Move %
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rule1_satisfied BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS correction_pct  NUMERIC;    -- Correction %
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rule2_satisfied BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS volume_surge    BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS ma_proximity    BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rule3_satisfied BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS chartink_score  SMALLINT;   -- 0-3
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS chartink_status TEXT;       -- Perfect|Strong|Partial|Weak

-- ── Order Flow ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS delta           NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS smoothed_delta  NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS absorption      BOOLEAN DEFAULT FALSE;

-- ── Flow Classification ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS flow_type       TEXT;       -- SOLID GREEN|HOLLOW GREEN|etc
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS flow_meaning    TEXT;       -- Fresh Longs|Short Covering|etc

-- ── Vacuum / Accumulation / Distribution ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS vacuum_status   TEXT;       -- NONE|VACUUM UP|VACUUM DOWN
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS accum_dist      TEXT;       -- NONE|ACCUMULATION|DISTRIBUTION

-- ── MagicRS Strength ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS magicrs_pts     SMALLINT;   -- 0-6
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS magicrs_value   NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS magicma_value   NUMERIC;

-- ── SMA Crossover ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_cross_up    BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_cross_down  BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sma_cross_dist  NUMERIC;

-- ── Confluence Score ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS confluence      SMALLINT;   -- 0-10

-- ── Bias & Momentum ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS bias_status     TEXT;       -- LONG|SHORT|NEUTRAL
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS momentum_status TEXT;       -- ALIGNED UP|ALIGNED DOWN|MIXED

-- ── Breakout Quality ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS breakout_quality SMALLINT;  -- 0-6
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS breakout_label  TEXT;       -- NO BREAK|WEAK|MODERATE|CONFIRMED|STRONG

-- ── Recommendation Engine ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS recommendation  TEXT;       -- STRONG BUY|BUY|SELL|WAIT|etc
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rec_reason      TEXT;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS signal_score    SMALLINT;   -- -10 to +10
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS display_mode    TEXT;       -- SCANNING|CONFIRMING|IN LONG|IN SHORT

-- ── Position Management ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS position_rec    TEXT;       -- HOLD|EXIT|BOOK PARTIAL
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS position_reason TEXT;

-- ── RSI Divergence ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS div_type        TEXT;       -- Bull|Bear|H.Bull|H.Bear|Dbl Bull|etc
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS div_bars_ago    SMALLINT;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS div_freshness   TEXT;

-- ── Pivot / Fibonacci / Gann Levels ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS pivot_pp        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS pivot_r1        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS pivot_r2        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS pivot_s1        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS pivot_s2        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS fibo_382        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS fibo_500        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS fibo_618        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS gann_250        NUMERIC;   -- Gann 2/8
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS gann_500        NUMERIC;   -- Gann 4/8
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS gann_750        NUMERIC;   -- Gann 6/8

-- ── Swing High/Low ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS is_swing_high   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS is_swing_low    BOOLEAN DEFAULT FALSE;

-- ── Sniper Dragon (sniperdragon.txt) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sniper_banker   NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sniper_hotmoney NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS sniper_rsi_line NUMERIC;

-- ── RSSI (RSSI.txt) ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rssi_rss        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rssi_rsi        NUMERIC;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rssi_new_high   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rssi_bull_div   BOOLEAN DEFAULT FALSE;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS rssi_bear_div   BOOLEAN DEFAULT FALSE;

-- ── Computation Metadata ──
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS indicators_computed_at TIMESTAMPTZ;

-- ============================================================================
-- ADDITIONAL INDEXES for indicator queries
-- ============================================================================

-- Recommendation screener: "show all STRONG BUY today"
CREATE INDEX IF NOT EXISTS idx_index_eod_recommendation
    ON km_index_eod(trade_date, recommendation)
    WHERE recommendation IS NOT NULL;

-- Signal score ranking
CREATE INDEX IF NOT EXISTS idx_index_eod_signal_score
    ON km_index_eod(trade_date, signal_score DESC)
    WHERE signal_score IS NOT NULL;

-- Dot signals screener
CREATE INDEX IF NOT EXISTS idx_index_eod_dots
    ON km_index_eod(trade_date)
    WHERE svd_condition OR sbd_condition OR syd_condition;
