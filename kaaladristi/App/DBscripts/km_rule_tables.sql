-- ============================================================================
-- KALA-DRISHTI RULE ENGINE TABLES (km_ prefix)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. RULES (given + discovered, active/inactive)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_rules (
    id              SERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    conditions      TEXT NOT NULL,
    signal          TEXT NOT NULL CHECK(signal IN ('Super Bullish','Bullish','Neutral','Bearish','Super Bearish')),
    strength        INTEGER DEFAULT 1,
    source          TEXT DEFAULT 'given' CHECK(source IN ('given','discovered')),
    active          BOOLEAN DEFAULT TRUE,
    historical_note TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_km_rules_category
    ON km_rules(category);
CREATE INDEX IF NOT EXISTS idx_km_rules_active
    ON km_rules(active) WHERE active = TRUE;

-- ============================================================================
-- 2. RULE SIGNALS (which rules fired on which dates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_rule_signals (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    rule_id         INTEGER NOT NULL REFERENCES km_rules(id),
    signal          TEXT NOT NULL,
    strength        INTEGER DEFAULT 1,
    details         TEXT,
    UNIQUE(date, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_km_signals_date
    ON km_rule_signals(date);
CREATE INDEX IF NOT EXISTS idx_km_signals_rule
    ON km_rule_signals(rule_id, date);

-- ============================================================================
-- 3. CANDIDATE RULES (discovered by pattern agent, pending review)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_candidate_rules (
    id                      SERIAL PRIMARY KEY,
    pattern_description     TEXT NOT NULL,
    conditions              TEXT NOT NULL,
    signal                  TEXT NOT NULL,
    statistical_confidence  DOUBLE PRECISION,
    sample_count            INTEGER,
    pct_correct             DOUBLE PRECISION,
    avg_return              DOUBLE PRECISION,
    volatility_impact       DOUBLE PRECISION,
    discovered_date         DATE,
    reviewed                BOOLEAN DEFAULT FALSE,
    approved                BOOLEAN DEFAULT FALSE,
    promoted_to_rule_id     INTEGER REFERENCES km_rules(id),
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE km_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_rule_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_candidate_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read km_rules"
    ON km_rules FOR SELECT USING (true);
CREATE POLICY "Public read km_rule_signals"
    ON km_rule_signals FOR SELECT USING (true);
CREATE POLICY "Public read km_candidate_rules"
    ON km_candidate_rules FOR SELECT USING (true);
