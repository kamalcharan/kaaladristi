-- ============================================================================
-- KĀLA-DRISHTI MASTER TABLES (km_ prefix)
-- Run this in Supabase SQL Editor to create all master/reference tables
-- ============================================================================

-- 1. Planets (central hub - all other lord tables reference this)
CREATE TABLE IF NOT EXISTS km_planets (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    vedic_name  TEXT,
    category    TEXT CHECK(category IN ('classical','node','outer'))
);

-- 2. Nakshatras (27 lunar mansions)
CREATE TABLE IF NOT EXISTS km_nakshatras (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    start_deg   NUMERIC,
    end_deg     NUMERIC
);

-- 3. Nakshatra Lords (which planet rules which nakshatra)
CREATE TABLE IF NOT EXISTS km_nakshatra_lords (
    nakshatra_id INTEGER NOT NULL REFERENCES km_nakshatras(id),
    planet_id    INTEGER NOT NULL REFERENCES km_planets(id),
    PRIMARY KEY (nakshatra_id, planet_id)
);

-- 4. Zodiac Signs (12 rashis)
CREATE TABLE IF NOT EXISTS km_zodiac_signs (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    element     TEXT,
    start_deg   NUMERIC,
    end_deg     NUMERIC
);

-- 5. Zodiac Lords (which planet rules which sign)
CREATE TABLE IF NOT EXISTS km_zodiac_lords (
    zodiac_id   INTEGER NOT NULL REFERENCES km_zodiac_signs(id),
    planet_id   INTEGER NOT NULL REFERENCES km_planets(id),
    PRIMARY KEY (zodiac_id, planet_id)
);

-- 6. Days of Week
CREATE TABLE IF NOT EXISTS km_days_of_week (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE
);

-- 7. Day Lords (which planet rules which day)
CREATE TABLE IF NOT EXISTS km_day_lords (
    day_id      INTEGER NOT NULL REFERENCES km_days_of_week(id),
    planet_id   INTEGER NOT NULL REFERENCES km_planets(id),
    is_primary  BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (day_id, planet_id)
);

-- 8. Sectors (market sectors/commodities/industries)
CREATE TABLE IF NOT EXISTS km_sectors (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE
);

-- 9. Sector Lords (which planet rules which sector - many-to-many)
CREATE TABLE IF NOT EXISTS km_sector_lords (
    sector_id   INTEGER NOT NULL REFERENCES km_sectors(id),
    planet_id   INTEGER NOT NULL REFERENCES km_planets(id),
    PRIMARY KEY (sector_id, planet_id)
);

-- 10. Index Master (NIFTY, BANKNIFTY, sectoral indices)
CREATE TABLE IF NOT EXISTS km_index_master (
    id          SERIAL PRIMARY KEY,
    symbol      TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    yahoo_ticker TEXT
);

-- 11. Index Composition (which stocks in which index)
CREATE TABLE IF NOT EXISTS km_index_composition (
    id            SERIAL PRIMARY KEY,
    index_id      INTEGER NOT NULL REFERENCES km_index_master(id),
    stock_symbol  TEXT NOT NULL,
    sector        TEXT,
    weight_pct    NUMERIC,
    snapshot_date TEXT,
    UNIQUE(index_id, stock_symbol, snapshot_date)
);
