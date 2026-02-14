-- ============================================================================
-- KALA-DRISHTI COMPUTED / ENGINE-OUTPUT TABLES (km_ prefix)
-- Run this in Supabase SQL Editor after km_ephemeris_tables.sql
-- ============================================================================

-- ============================================================================
-- 1. RISK SCORES (daily composite risk per symbol from risk engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_risk_scores (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    symbol          TEXT NOT NULL,
    composite_score DOUBLE PRECISION NOT NULL,
    structural      DOUBLE PRECISION,
    momentum        DOUBLE PRECISION,
    volatility      DOUBLE PRECISION,
    deception       DOUBLE PRECISION,
    regime          TEXT,
    explanation     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, symbol)
);

CREATE INDEX IF NOT EXISTS idx_km_risk_symbol_date
    ON km_risk_scores(symbol, date);
CREATE INDEX IF NOT EXISTS idx_km_risk_regime
    ON km_risk_scores(regime, date);
CREATE INDEX IF NOT EXISTS idx_km_risk_score
    ON km_risk_scores(composite_score);

-- ============================================================================
-- 2. FACTOR CORRELATION STATS (per-factor market impact from correlation engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_factor_correlation_stats (
    id                      SERIAL PRIMARY KEY,
    factor_type             TEXT NOT NULL,
    index_symbol            TEXT NOT NULL,
    pct_down_days           DOUBLE PRECISION,
    avg_return              DOUBLE PRECISION,
    avg_range_pct           DOUBLE PRECISION,
    volatility_multiplier   DOUBLE PRECISION,
    sample_count            INTEGER,
    baseline_down_pct       DOUBLE PRECISION,
    baseline_avg_return     DOUBLE PRECISION,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(factor_type, index_symbol)
);

CREATE INDEX IF NOT EXISTS idx_km_corr_factor
    ON km_factor_correlation_stats(factor_type);
CREATE INDEX IF NOT EXISTS idx_km_corr_symbol
    ON km_factor_correlation_stats(index_symbol);

-- ============================================================================
-- 3. SECTOR SENSITIVITY (per-factor sector-level differential impact)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_sector_sensitivity (
    id              SERIAL PRIMARY KEY,
    factor_type     TEXT NOT NULL,
    sector          TEXT NOT NULL,
    sensitivity_pct DOUBLE PRECISION,
    sample_count    INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(factor_type, sector)
);

CREATE INDEX IF NOT EXISTS idx_km_sector_factor
    ON km_sector_sensitivity(factor_type);
CREATE INDEX IF NOT EXISTS idx_km_sector_name
    ON km_sector_sensitivity(sector);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE km_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_factor_correlation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_sector_sensitivity ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read km_risk_scores"
    ON km_risk_scores FOR SELECT USING (true);
CREATE POLICY "Public read km_factor_correlation_stats"
    ON km_factor_correlation_stats FOR SELECT USING (true);
CREATE POLICY "Public read km_sector_sensitivity"
    ON km_sector_sensitivity FOR SELECT USING (true);
