-- ============================================================================
-- KALA-DRISHTI: Add Technical Indicator columns to EOD tables
-- Migration 005 — Run on kaala_dristi_db
-- ============================================================================
--
-- Adds precomputed indicator columns directly to km_index_eod and km_equity_eod.
-- Columns start as NULL and are populated by the Python compute engine.
--
-- Indicators from Pine Script strategies:
--   LuckyPop Enhanced v3.1 (overlay)
--   LuckyPop SuperMagic Enhanced (MagicRS)
--   LuckyPop RSSI (RSS)
--   Sniper Scope Dragon (Institutional flow)
-- ============================================================================

-- ============================================================================
-- 1. MOVING AVERAGES
-- ============================================================================

-- SMA periods from LuckyPop: 8, 21, 55, 89, 233 + Golden Line (150)
-- Also commonly used: 50, 200

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS sma_8     NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_21    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_50    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_55    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_89    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_150   NUMERIC,    -- Golden Line
    ADD COLUMN IF NOT EXISTS sma_200   NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_233   NUMERIC;

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS sma_8     NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_21    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_50    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_55    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_89    NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_150   NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_200   NUMERIC,
    ADD COLUMN IF NOT EXISTS sma_233   NUMERIC;

-- ============================================================================
-- 2. RSI / MFI / MOMENTUM
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS rsi_14    NUMERIC,     -- RSI(14) — primary
    ADD COLUMN IF NOT EXISTS rsi_9     NUMERIC,     -- RSI(9) — Sniper Dragon
    ADD COLUMN IF NOT EXISTS mfi_14    NUMERIC;     -- Money Flow Index(14)

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS rsi_14    NUMERIC,
    ADD COLUMN IF NOT EXISTS rsi_9     NUMERIC,
    ADD COLUMN IF NOT EXISTS mfi_14    NUMERIC;

-- ============================================================================
-- 3. ATR + SUPERTREND
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS atr_10           NUMERIC,     -- ATR(10) for SuperTrend
    ADD COLUMN IF NOT EXISTS atr_14           NUMERIC,     -- ATR(14) general purpose
    ADD COLUMN IF NOT EXISTS supertrend       NUMERIC,     -- SuperTrend value
    ADD COLUMN IF NOT EXISTS supertrend_dir   SMALLINT;    -- 1=bullish, -1=bearish

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS atr_10           NUMERIC,
    ADD COLUMN IF NOT EXISTS atr_14           NUMERIC,
    ADD COLUMN IF NOT EXISTS supertrend       NUMERIC,
    ADD COLUMN IF NOT EXISTS supertrend_dir   SMALLINT;

-- ============================================================================
-- 4. OBV (On-Balance Volume)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS obv              BIGINT,      -- On-Balance Volume
    ADD COLUMN IF NOT EXISTS obv_sma_20       NUMERIC;     -- OBV SMA(20) for trend

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS obv              BIGINT,
    ADD COLUMN IF NOT EXISTS obv_sma_20       NUMERIC;

-- ============================================================================
-- 5. VOLUME ANALYSIS (RVol, TVol)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS rvol             NUMERIC,     -- Relative Volume (vol / SMA(50))
    ADD COLUMN IF NOT EXISTS tvol             NUMERIC;     -- Total Volume ratio (vol / SMA(20))

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS rvol             NUMERIC,
    ADD COLUMN IF NOT EXISTS tvol             NUMERIC;

-- ============================================================================
-- 6. MAGIC RS (Relative Strength vs Benchmark)
-- ============================================================================
-- MagicRS = ((symbol/benchmark) / SMA144(symbol/benchmark) - 1) * 100
-- MagicMA = SMA(60) of MagicRS

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS magic_rs         NUMERIC,     -- Relative Strength value
    ADD COLUMN IF NOT EXISTS magic_rs_sma144  NUMERIC,     -- 144-period SMA of RS ratio
    ADD COLUMN IF NOT EXISTS magic_ma         NUMERIC,     -- 60-period SMA of MagicRS
    ADD COLUMN IF NOT EXISTS magic_rs_zone    TEXT;         -- Strong Bull/Mild Bull/Neutral/Mild Bear/Strong Bear

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS magic_rs         NUMERIC,
    ADD COLUMN IF NOT EXISTS magic_rs_sma144  NUMERIC,
    ADD COLUMN IF NOT EXISTS magic_ma         NUMERIC,
    ADD COLUMN IF NOT EXISTS magic_rs_zone    TEXT;

-- ============================================================================
-- 7. SNIPER DRAGON (Institutional / Hot Money / Retail)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS sniper_inst      NUMERIC,     -- Institutional RSI (banker)
    ADD COLUMN IF NOT EXISTS sniper_hot       NUMERIC,     -- Hot Money RSI
    ADD COLUMN IF NOT EXISTS sniper_rsi       NUMERIC;     -- Sniper RSI line (9-period scaled)

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS sniper_inst      NUMERIC,
    ADD COLUMN IF NOT EXISTS sniper_hot       NUMERIC,
    ADD COLUMN IF NOT EXISTS sniper_rsi       NUMERIC;

-- ============================================================================
-- 8. RSS (Relative Spread Strength — LuckyPop RSSI)
-- ============================================================================
-- Spread = SMA(10) - SMA(40), then RSI(5) of spread, smoothed by SMA(3)

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS rss_value        NUMERIC,     -- Smoothed RSS
    ADD COLUMN IF NOT EXISTS rss_rsi          NUMERIC;     -- Raw RSI for divergence

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS rss_value        NUMERIC,
    ADD COLUMN IF NOT EXISTS rss_rsi          NUMERIC;

-- ============================================================================
-- 9. PIVOT / FIBONACCI LEVELS (from previous day OHLC)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS pivot_pp         NUMERIC,     -- Classic Pivot Point
    ADD COLUMN IF NOT EXISTS pivot_r1         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_r2         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_r3         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_s1         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_s2         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_s3         NUMERIC;

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS pivot_pp         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_r1         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_r2         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_r3         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_s1         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_s2         NUMERIC,
    ADD COLUMN IF NOT EXISTS pivot_s3         NUMERIC;

-- ============================================================================
-- 10. CHARTINK RULES (EMD / CA / VMAC)
-- ============================================================================
-- Rule 1 - EMD: Explosive Move Detection (8-week % move)
-- Rule 2 - CA:  Correction Analysis (% from recent high)
-- Rule 3 - VMAC: Volume + MA Confluence

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS chartink_emd_pct    NUMERIC,  -- 8-week move %
    ADD COLUMN IF NOT EXISTS chartink_emd_ok     BOOLEAN,  -- meets threshold?
    ADD COLUMN IF NOT EXISTS chartink_ca_pct     NUMERIC,  -- correction from high %
    ADD COLUMN IF NOT EXISTS chartink_ca_ok      BOOLEAN,
    ADD COLUMN IF NOT EXISTS chartink_vmac_ok    BOOLEAN,  -- volume surge + MA proximity
    ADD COLUMN IF NOT EXISTS chartink_score      SMALLINT;  -- 0-3

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS chartink_emd_pct    NUMERIC,
    ADD COLUMN IF NOT EXISTS chartink_emd_ok     BOOLEAN,
    ADD COLUMN IF NOT EXISTS chartink_ca_pct     NUMERIC,
    ADD COLUMN IF NOT EXISTS chartink_ca_ok      BOOLEAN,
    ADD COLUMN IF NOT EXISTS chartink_vmac_ok    BOOLEAN,
    ADD COLUMN IF NOT EXISTS chartink_score      SMALLINT;

-- ============================================================================
-- 11. DOT SIGNALS (SVD / SBD / SYD from LuckyPop)
-- ============================================================================
-- SVD = Solid Violet Dot (massive volume surge + strong close)
-- SBD = Solid Blue Dot (moderate volume + bullish close)
-- SYD = Solid Yellow Dot (bearish reversal with high volume)

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS dot_svd           BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dot_sbd           BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dot_syd           BOOLEAN DEFAULT FALSE;

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS dot_svd           BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dot_sbd           BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dot_syd           BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 12. IB30 / IS30 (Initial Balance — INTRADAY ONLY, reserved for future)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS ib30_high         NUMERIC,    -- First 30min high
    ADD COLUMN IF NOT EXISTS ib30_low          NUMERIC,    -- First 30min low
    ADD COLUMN IF NOT EXISTS ib30_status       TEXT;       -- FORMING/INSIDE/BREAK UP/BREAK DOWN

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS ib30_high         NUMERIC,
    ADD COLUMN IF NOT EXISTS ib30_low          NUMERIC,
    ADD COLUMN IF NOT EXISTS ib30_status       TEXT;

-- ============================================================================
-- 13. ORDER FLOW (INTRADAY ONLY, reserved for future)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS delta_smoothed    NUMERIC,    -- Smoothed buy-sell delta
    ADD COLUMN IF NOT EXISTS absorption        BOOLEAN DEFAULT FALSE;  -- Absorption detected

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS delta_smoothed    NUMERIC,
    ADD COLUMN IF NOT EXISTS absorption        BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 14. SWING HIGH / LOW
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS swing_high        BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS swing_low         BOOLEAN DEFAULT FALSE;

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS swing_high        BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS swing_low         BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 15. COMPUTE METADATA
-- ============================================================================

ALTER TABLE km_index_eod
    ADD COLUMN IF NOT EXISTS indicators_computed_at  TIMESTAMPTZ;

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS indicators_computed_at  TIMESTAMPTZ;

-- ============================================================================
-- SIGNALS TABLE — sparse crossover/event records
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_technical_signals (
    id              BIGSERIAL PRIMARY KEY,
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('index', 'equity')),
    symbol_id       INTEGER NOT NULL,
    trade_date      DATE NOT NULL,

    signal_type     TEXT NOT NULL,
    -- Signal types:
    --   price_cross_sma8, price_cross_sma21, price_cross_sma50,
    --   price_cross_sma55, price_cross_sma89, price_cross_sma150,
    --   price_cross_sma200, price_cross_sma233
    --   golden_cross (SMA50 crosses SMA200)
    --   death_cross  (SMA50 crosses below SMA200)
    --   supertrend_flip
    --   rsi14_oversold, rsi14_overbought
    --   rsi9_oversold,  rsi9_overbought
    --   magic_rs_cross, magic_rs_zone_change
    --   dot_svd, dot_sbd, dot_syd
    --   obv_trend_change
    --   rss_oversold, rss_overbought

    direction       TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish')),
    indicator_value NUMERIC,
    price_at_signal NUMERIC,
    description     TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(asset_type, symbol_id, trade_date, signal_type)
);

CREATE INDEX idx_signals_symbol_date
    ON km_technical_signals(asset_type, symbol_id, trade_date DESC);

CREATE INDEX idx_signals_screen
    ON km_technical_signals(trade_date, signal_type, direction);

-- ============================================================================
-- COMPUTE JOB LOG — audit trail for indicator computation runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_indicator_compute_log (
    id              BIGSERIAL PRIMARY KEY,
    compute_mode    TEXT NOT NULL,          -- 'full', 'incremental', 'single'
    asset_type      TEXT,
    symbols_count   INTEGER DEFAULT 0,
    date_from       DATE,
    date_to         DATE,
    rows_computed   INTEGER DEFAULT 0,
    signals_found   INTEGER DEFAULT 0,
    status          TEXT NOT NULL,          -- 'running', 'success', 'failed'
    error_msg       TEXT,
    duration_secs   NUMERIC,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- GRANTS — match existing pattern from migration 004
-- ============================================================================

GRANT SELECT ON km_technical_signals TO anon, authenticated;
GRANT ALL ON km_technical_signals TO service_role;

GRANT SELECT ON km_indicator_compute_log TO anon, authenticated;
GRANT ALL ON km_indicator_compute_log TO service_role;

-- Sequences for new tables
GRANT USAGE ON SEQUENCE km_technical_signals_id_seq TO authenticated, service_role;
GRANT USAGE ON SEQUENCE km_indicator_compute_log_id_seq TO authenticated, service_role;

-- ============================================================================
-- DONE. New columns on km_index_eod / km_equity_eod:
--
--   SMAs:       sma_8, sma_21, sma_50, sma_55, sma_89, sma_150, sma_200, sma_233
--   Momentum:   rsi_14, rsi_9, mfi_14
--   Volatility: atr_10, atr_14, supertrend, supertrend_dir
--   Volume:     obv, obv_sma_20, rvol, tvol
--   RelStr:     magic_rs, magic_rs_sma144, magic_ma, magic_rs_zone
--   Sniper:     sniper_inst, sniper_hot, sniper_rsi
--   RSS:        rss_value, rss_rsi
--   Pivots:     pivot_pp, pivot_r1-r3, pivot_s1-s3
--   Chartink:   chartink_emd_pct/ok, chartink_ca_pct/ok, chartink_vmac_ok, chartink_score
--   Dots:       dot_svd, dot_sbd, dot_syd
--   IB30:       ib30_high, ib30_low, ib30_status (future — intraday)
--   OrderFlow:  delta_smoothed, absorption (future — intraday)
--   Swing:      swing_high, swing_low
--   Meta:       indicators_computed_at
--
-- New tables:
--   km_technical_signals      — sparse crossover/event records
--   km_indicator_compute_log  — job audit trail
-- ============================================================================
