-- ============================================================================
-- KĀLA-DRISHTI PANCHANG & RULES TABLES (km_ prefix)
-- Run this in Supabase SQL Editor after km_master_tables.sql
-- ============================================================================

-- ============================================================================
-- PANCHANG MASTER TABLES
-- ============================================================================

-- 1. Tithis (30 lunar days: 15 Shukla + 15 Krishna)
CREATE TABLE IF NOT EXISTS km_tithis (
    id              INTEGER PRIMARY KEY,
    num             INTEGER NOT NULL,
    name            TEXT NOT NULL,
    base_name       TEXT NOT NULL,
    paksha          TEXT NOT NULL CHECK(paksha IN ('Shukla','Krishna')),
    tattva_group    TEXT,
    group_lord      TEXT
);

-- 2. Yogas (27 Sun+Moon combinations)
CREATE TABLE IF NOT EXISTS km_yogas (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    nature          TEXT CHECK(nature IN ('auspicious','inauspicious','neutral'))
);

-- 3. Karanas (11 unique types: 7 recurring + 4 fixed)
CREATE TABLE IF NOT EXISTS km_karanas (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    type            TEXT CHECK(type IN ('recurring','fixed'))
);

-- ============================================================================
-- DAILY PANCHANG (Ujjain-based, time-series)
-- All elements computed at Ujjain sunrise
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_daily_panchang (
    date                    DATE PRIMARY KEY,
    -- Sunrise / Sunset (Ujjain: 23.1765°N, 75.7885°E)
    sunrise_jd              DOUBLE PRECISION,
    sunrise_ist             TEXT,
    sunset_jd               DOUBLE PRECISION,
    sunset_ist              TEXT,
    -- Tithi (lunar day)
    tithi_num               INTEGER,
    tithi_name              TEXT,
    tithi_base_name         TEXT,
    paksha                  TEXT,
    tithi_group             TEXT,
    tithi_lord              TEXT,
    -- Nakshatra (Moon at sunrise)
    nakshatra_num           INTEGER,
    nakshatra_name          TEXT,
    nakshatra_lord          TEXT,
    nakshatra_pada          INTEGER,
    -- Yoga
    yoga_num                INTEGER,
    yoga_name               TEXT,
    -- Karana
    karana_num              INTEGER,
    karana_name             TEXT,
    -- Vara (weekday)
    vara                    TEXT,
    vara_lord               TEXT,
    -- DLNL match (Day Lord = Nakshatra Lord)
    dlnl_match              BOOLEAN DEFAULT FALSE,
    -- Sun position
    sun_sign                INTEGER,
    sun_sign_name           TEXT,
    sun_longitude           DOUBLE PRECISION,
    sun_tropical_longitude  DOUBLE PRECISION,
    -- Moon position
    moon_sign               INTEGER,
    moon_sign_name          TEXT,
    moon_longitude          DOUBLE PRECISION,
    -- Sankranti (Sun sign change)
    is_sankranti            BOOLEAN DEFAULT FALSE,
    sankranti_from          TEXT,
    sankranti_to            TEXT,
    -- Hemisphere events (equinox/solstice)
    hemisphere_event        TEXT,
    -- Special flags
    is_purnima              BOOLEAN DEFAULT FALSE,
    is_amavasya             BOOLEAN DEFAULT FALSE,
    is_ekadashi             BOOLEAN DEFAULT FALSE,
    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_km_panchang_tithi ON km_daily_panchang(tithi_base_name);
CREATE INDEX IF NOT EXISTS idx_km_panchang_nakshatra ON km_daily_panchang(nakshatra_name);
CREATE INDEX IF NOT EXISTS idx_km_panchang_vara ON km_daily_panchang(vara);
CREATE INDEX IF NOT EXISTS idx_km_panchang_dlnl ON km_daily_panchang(dlnl_match) WHERE dlnl_match = TRUE;
CREATE INDEX IF NOT EXISTS idx_km_panchang_sankranti ON km_daily_panchang(is_sankranti) WHERE is_sankranti = TRUE;
CREATE INDEX IF NOT EXISTS idx_km_panchang_ekadashi ON km_daily_panchang(is_ekadashi) WHERE is_ekadashi = TRUE;

-- ============================================================================
-- RULE ENGINE TABLES
-- ============================================================================

-- Rules: both given (domain knowledge) and discovered (data-driven)
CREATE TABLE IF NOT EXISTS km_rules (
    id                  SERIAL PRIMARY KEY,
    code                TEXT NOT NULL UNIQUE,
    category            TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    conditions          JSONB NOT NULL,
    signal              TEXT NOT NULL CHECK(signal IN ('Super Bullish','Bullish','Neutral','Bearish','Super Bearish')),
    strength            INTEGER DEFAULT 1,
    source              TEXT DEFAULT 'given' CHECK(source IN ('given','discovered')),
    active              BOOLEAN DEFAULT TRUE,
    historical_note     TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_km_rules_category ON km_rules(category);
CREATE INDEX IF NOT EXISTS idx_km_rules_active ON km_rules(active) WHERE active = TRUE;

-- Rule signals: which rules fired on which dates
CREATE TABLE IF NOT EXISTS km_rule_signals (
    id                  SERIAL PRIMARY KEY,
    date                DATE NOT NULL,
    rule_id             INTEGER NOT NULL REFERENCES km_rules(id),
    signal              TEXT NOT NULL,
    strength            INTEGER DEFAULT 1,
    details             JSONB,
    UNIQUE(date, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_km_signals_date ON km_rule_signals(date);
CREATE INDEX IF NOT EXISTS idx_km_signals_rule ON km_rule_signals(rule_id, date);

-- Candidate rules: discovered by the pattern agent, pending human review
CREATE TABLE IF NOT EXISTS km_candidate_rules (
    id                      SERIAL PRIMARY KEY,
    pattern_description     TEXT NOT NULL,
    conditions              JSONB NOT NULL,
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

ALTER TABLE km_tithis ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_yogas ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_karanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_daily_panchang ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_rule_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_candidate_rules ENABLE ROW LEVEL SECURITY;

-- Public read access for all panchang and rule tables
CREATE POLICY "Public read km_tithis" ON km_tithis FOR SELECT USING (true);
CREATE POLICY "Public read km_yogas" ON km_yogas FOR SELECT USING (true);
CREATE POLICY "Public read km_karanas" ON km_karanas FOR SELECT USING (true);
CREATE POLICY "Public read km_daily_panchang" ON km_daily_panchang FOR SELECT USING (true);
CREATE POLICY "Public read km_rules" ON km_rules FOR SELECT USING (true);
CREATE POLICY "Public read km_rule_signals" ON km_rule_signals FOR SELECT USING (true);
CREATE POLICY "Public read km_candidate_rules" ON km_candidate_rules FOR SELECT USING (true);
