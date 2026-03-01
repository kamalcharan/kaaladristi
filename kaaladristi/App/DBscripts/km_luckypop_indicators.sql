-- ============================================================================
-- KĀLA-DRISHTI: LUCKYPOP INDICATORS TABLE
-- Pre-computed technical indicators from LuckyPop PineScript
-- Works for both INDEX and EQUITY symbols
-- Run AFTER km_restructure_eod.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE INDICATORS TABLE
-- All LuckyPop + SniperDragon + RSSI + MagicRS computed values per bar
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_luckypop_indicators (
    id              SERIAL PRIMARY KEY,

    -- ── Symbol Identity ──
    symbol_type     TEXT NOT NULL CHECK(symbol_type IN ('index', 'equity')),
    symbol_id       INTEGER NOT NULL,       -- FK to km_index_eod.index_id or km_equity_eod.equity_id
    trade_date      DATE NOT NULL,

    -- ── OHLCV (denormalized for fast chart reads) ──
    open            NUMERIC,
    high            NUMERIC,
    low             NUMERIC,
    close           NUMERIC,
    prev_close      NUMERIC,
    volume          BIGINT,

    -- ── SMA Lines (6 moving averages) ──
    sma_8           NUMERIC,                -- SMA(close, 8)
    sma_21          NUMERIC,                -- SMA(close, 21)
    sma_55          NUMERIC,                -- SMA(close, 55)
    sma_89          NUMERIC,                -- SMA(close, 89)
    sma_233         NUMERIC,                -- SMA(close, 233)
    golden_line     NUMERIC,                -- SMA(close, 150)

    -- ── SMA Distances (% from close) ──
    dist_sma_8      NUMERIC,                -- 100*(close-sma8)/sma8
    dist_sma_21     NUMERIC,
    dist_sma_55     NUMERIC,
    dist_golden     NUMERIC,                -- 100*(close-golden)/golden

    -- ── SuperTrend ──
    supertrend_val  NUMERIC,                -- The SuperTrend line value
    supertrend_dir  SMALLINT,               -- 1 = uptrend, -1 = downtrend
    st_buy_signal   BOOLEAN DEFAULT FALSE,  -- SuperTrend buy signal
    st_sell_signal  BOOLEAN DEFAULT FALSE,  -- SuperTrend sell signal

    -- ── Dot Signals (Volume-based) ──
    svd_condition   BOOLEAN DEFAULT FALSE,  -- Solid Violet Dot (institutional buying)
    sbd_condition   BOOLEAN DEFAULT FALSE,  -- Solid Blue Dot (accumulation)
    syd_condition   BOOLEAN DEFAULT FALSE,  -- Solid Yellow Dot (distribution)
    pre_syd_warning BOOLEAN DEFAULT FALSE,  -- Pre-SYD warning

    -- ── RSI / MFI / OBV ──
    rsi             NUMERIC,                -- RSI(close, 14)
    mfi             NUMERIC,                -- MFI(hlc3, 14)
    mfi_rsi_cross   BOOLEAN DEFAULT FALSE,  -- MFI crossed RSI
    obv_trend       TEXT,                   -- 'Bullish' | 'Bearish' | 'Neutral'

    -- ── Volume Metrics ──
    rel_volume      NUMERIC,                -- volume / SMA(volume, 55)
    rvol            NUMERIC,                -- volume / SMA(volume, 50) — longer term
    tvol            NUMERIC,                -- volume / SMA(volume, 20) — short term
    avg_range       NUMERIC,                -- SMA(high-low, 233)

    -- ── RSS (Relative Strength Spread) ──
    rss_smooth      NUMERIC,                -- SMA(RSI(E1-E2, 5), 3)
    rss_spread      NUMERIC,                -- E1 - E2
    rss_direction   BOOLEAN,                -- E1 > E2

    -- ── IB30 / IS30 (Initial Balance) ──
    ib30_high       NUMERIC,
    ib30_low        NUMERIC,
    ib30_established BOOLEAN DEFAULT FALSE,
    ib30_status     TEXT,                   -- 'FORMING' | 'BREAK UP' | 'BREAK DOWN' | 'INSIDE'
    is30_bull_break BOOLEAN DEFAULT FALSE,
    is30_bear_break BOOLEAN DEFAULT FALSE,

    -- ── Chartink Rules ──
    rule1_move_pct  NUMERIC,                -- Explosive Move Detection %
    rule1_satisfied BOOLEAN DEFAULT FALSE,
    correction_pct  NUMERIC,                -- Correction Analysis %
    rule2_satisfied BOOLEAN DEFAULT FALSE,
    volume_surge    BOOLEAN DEFAULT FALSE,
    ma_proximity    BOOLEAN DEFAULT FALSE,
    rule3_satisfied BOOLEAN DEFAULT FALSE,
    chartink_score  SMALLINT,               -- 0-3
    chartink_status TEXT,                   -- 'Perfect' | 'Strong' | 'Partial' | 'Weak'

    -- ── Order Flow ──
    delta           NUMERIC,                -- up_volume - down_volume
    smoothed_delta  NUMERIC,                -- SMA(delta, 5)
    absorption      BOOLEAN DEFAULT FALSE,  -- High volume + small body

    -- ── Flow Classification ──
    flow_type       TEXT,                   -- 'SOLID GREEN' | 'HOLLOW GREEN' | 'SOLID RED' | 'HOLLOW RED' | 'MIXED' | 'GREY'
    flow_meaning    TEXT,                   -- 'Fresh Longs' | 'Short Covering' | etc.

    -- ── Vacuum / Accumulation / Distribution ──
    vacuum_status   TEXT,                   -- 'NONE' | 'VACUUM UP' | 'VACUUM DOWN'
    accum_dist      TEXT,                   -- 'NONE' | 'ACCUMULATION' | 'DISTRIBUTION'

    -- ── MagicRS Strength ──
    magicrs_pts     SMALLINT,               -- 0-6, multi-timeframe strength
    magicrs_value   NUMERIC,                -- RS ratio vs comparison symbol
    magicma_value   NUMERIC,                -- SMA of magicrs_value

    -- ── SMA Crossover ──
    sma_cross_up    BOOLEAN DEFAULT FALSE,  -- SMA2 crossed above SMA3
    sma_cross_down  BOOLEAN DEFAULT FALSE,  -- SMA2 crossed below SMA3
    sma_cross_dist  NUMERIC,                -- % distance between SMA2 and SMA3

    -- ── Confluence Score ──
    confluence      SMALLINT,               -- 0-10 master score

    -- ── Bias ──
    bias_status     TEXT,                   -- 'LONG' | 'SHORT' | 'NEUTRAL'
    momentum_status TEXT,                   -- 'ALIGNED UP' | 'ALIGNED DOWN' | 'MIXED'

    -- ── Breakout Quality ──
    breakout_quality SMALLINT,              -- 0-6
    breakout_label  TEXT,                   -- 'NO BREAK' | 'WEAK' | 'MODERATE' | 'CONFIRMED' | 'STRONG'

    -- ── Recommendation Engine ──
    recommendation  TEXT,                   -- 'STRONG BUY' | 'BUY' | 'SELL' | 'WAIT' | etc.
    rec_reason      TEXT,                   -- Reason text
    signal_score    SMALLINT,               -- -10 to +10
    display_mode    TEXT,                   -- 'SCANNING' | 'CONFIRMING' | 'IN LONG' | 'IN SHORT'

    -- ── Position Management ──
    position_rec    TEXT,                   -- 'HOLD' | 'EXIT' | 'BOOK PARTIAL'
    position_reason TEXT,

    -- ── RSI Divergence ──
    div_type        TEXT,                   -- 'Bull' | 'Bear' | 'H.Bull' | 'H.Bear' | 'Dbl Bull' | etc.
    div_bars_ago    SMALLINT,               -- Bars since last divergence
    div_freshness   TEXT,                   -- Fire/Check/Warning/Sleep indicator

    -- ── Pivot / Fibonacci / Gann Levels ──
    pivot_pp        NUMERIC,
    pivot_r1        NUMERIC,
    pivot_r2        NUMERIC,
    pivot_s1        NUMERIC,
    pivot_s2        NUMERIC,
    fibo_382        NUMERIC,
    fibo_500        NUMERIC,
    fibo_618        NUMERIC,
    gann_250        NUMERIC,                -- Gann 2/8
    gann_500        NUMERIC,                -- Gann 4/8
    gann_750        NUMERIC,                -- Gann 6/8

    -- ── Swing High/Low ──
    is_swing_high   BOOLEAN DEFAULT FALSE,
    is_swing_low    BOOLEAN DEFAULT FALSE,

    -- ── Sniper Dragon (from sniperdragon.txt) ──
    sniper_banker   NUMERIC,                -- Institution RSI histogram
    sniper_hotmoney NUMERIC,                -- Hot Money RSI histogram
    sniper_rsi_line NUMERIC,                -- RSI line

    -- ── RSSI (from RSSI.txt) ──
    rssi_rss        NUMERIC,                -- RSS Smooth value
    rssi_rsi        NUMERIC,                -- RSI value
    rssi_new_high   BOOLEAN DEFAULT FALSE,  -- RSS new high detected
    rssi_bull_div   BOOLEAN DEFAULT FALSE,  -- Bullish divergence
    rssi_bear_div   BOOLEAN DEFAULT FALSE,  -- Bearish divergence

    -- ── Metadata ──
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(symbol_type, symbol_id, trade_date)
);

-- ============================================================================
-- STEP 2: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup: symbol + date range (chart rendering)
CREATE INDEX IF NOT EXISTS idx_lp_symbol_date
    ON km_luckypop_indicators(symbol_type, symbol_id, trade_date);

-- Date-only queries (e.g., "all symbols for today")
CREATE INDEX IF NOT EXISTS idx_lp_trade_date
    ON km_luckypop_indicators(trade_date);

-- Recommendation filtering (e.g., "show all STRONG BUY today")
CREATE INDEX IF NOT EXISTS idx_lp_recommendation
    ON km_luckypop_indicators(trade_date, recommendation);

-- Signal score filtering (top signals today)
CREATE INDEX IF NOT EXISTS idx_lp_signal_score
    ON km_luckypop_indicators(trade_date, signal_score DESC);

-- Dot signals (SVD/SBD/SYD screener)
CREATE INDEX IF NOT EXISTS idx_lp_dots
    ON km_luckypop_indicators(trade_date, svd_condition, sbd_condition, syd_condition)
    WHERE svd_condition OR sbd_condition OR syd_condition;

-- ============================================================================
-- STEP 3: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE km_luckypop_indicators ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users
CREATE POLICY "lp_indicators_read" ON km_luckypop_indicators
    FOR SELECT TO authenticated USING (true);

-- Admin-only write (backend compute job runs as admin)
CREATE POLICY "lp_indicators_admin_write" ON km_luckypop_indicators
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================================================
-- STEP 4: HELPER VIEW FOR QUICK CHART QUERIES
-- Joins indicator data with symbol names for easy frontend access
-- ============================================================================

CREATE OR REPLACE VIEW v_luckypop_index AS
SELECT
    lp.*,
    ks.name AS symbol_name,
    ks.category AS symbol_category
FROM km_luckypop_indicators lp
JOIN km_index_symbols ks ON ks.id = lp.symbol_id
WHERE lp.symbol_type = 'index';

CREATE OR REPLACE VIEW v_luckypop_equity AS
SELECT
    lp.*,
    es.symbol AS symbol_name
FROM km_luckypop_indicators lp
JOIN km_equity_symbols es ON es.id = lp.symbol_id
WHERE lp.symbol_type = 'equity';
