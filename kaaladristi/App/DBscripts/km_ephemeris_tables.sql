-- ============================================================================
-- KALA-DRISHTI EPHEMERIS TABLES (km_ prefix)
-- Run this in Supabase SQL Editor after km_master_tables.sql
-- ============================================================================

-- ============================================================================
-- 1. PLANETARY POSITIONS (daily longitude, sign, nakshatra for each planet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_planetary_positions (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    planet          TEXT NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    speed           DOUBLE PRECISION,
    retrograde      BOOLEAN DEFAULT FALSE,
    sign            INTEGER,
    sign_name       TEXT,
    nakshatra       INTEGER,
    nakshatra_name  TEXT,
    nakshatra_pada  INTEGER,
    combust         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, planet)
);

CREATE INDEX IF NOT EXISTS idx_km_positions_date
    ON km_planetary_positions(date);
CREATE INDEX IF NOT EXISTS idx_km_positions_planet
    ON km_planetary_positions(planet, date);
CREATE INDEX IF NOT EXISTS idx_km_positions_retro
    ON km_planetary_positions(retrograde, planet) WHERE retrograde = TRUE;
CREATE INDEX IF NOT EXISTS idx_km_positions_sign
    ON km_planetary_positions(sign_name, date);
CREATE INDEX IF NOT EXISTS idx_km_positions_nakshatra
    ON km_planetary_positions(nakshatra_name, date);

-- ============================================================================
-- 2. PLANETARY ASPECTS (daily aspect geometry between planet pairs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_planetary_aspects (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    planet_1        TEXT NOT NULL,
    planet_2        TEXT NOT NULL,
    aspect_type     TEXT NOT NULL,
    angle           DOUBLE PRECISION,
    orb             DOUBLE PRECISION,
    exact           BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, planet_1, planet_2, aspect_type)
);

CREATE INDEX IF NOT EXISTS idx_km_aspects_date
    ON km_planetary_aspects(date);
CREATE INDEX IF NOT EXISTS idx_km_aspects_type
    ON km_planetary_aspects(aspect_type, date);
CREATE INDEX IF NOT EXISTS idx_km_aspects_exact
    ON km_planetary_aspects(exact) WHERE exact = TRUE;

-- ============================================================================
-- 3. ASTRO EVENTS (sign changes, retrograde starts/stops, combustions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_astro_events (
    id              SERIAL PRIMARY KEY,
    event_date      DATE NOT NULL,
    event_type      TEXT NOT NULL,
    planet          TEXT NOT NULL,
    from_value      TEXT,
    to_value        TEXT,
    severity        TEXT DEFAULT 'normal',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_km_events_date
    ON km_astro_events(event_date);
CREATE INDEX IF NOT EXISTS idx_km_events_type
    ON km_astro_events(event_type, event_date);
CREATE INDEX IF NOT EXISTS idx_km_events_severity
    ON km_astro_events(severity) WHERE severity = 'high';
CREATE INDEX IF NOT EXISTS idx_km_events_planet
    ON km_astro_events(planet, event_date);

-- ============================================================================
-- 4. MOON INTRADAY (hourly moon longitude, sign, nakshatra)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_moon_intraday (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    time_ist        TEXT NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    speed           DOUBLE PRECISION,
    sign            INTEGER,
    sign_name       TEXT,
    nakshatra       INTEGER,
    nakshatra_name  TEXT,
    nakshatra_pada  INTEGER,
    gandanta        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, time_ist)
);

CREATE INDEX IF NOT EXISTS idx_km_moon_date
    ON km_moon_intraday(date);
CREATE INDEX IF NOT EXISTS idx_km_moon_gandanta
    ON km_moon_intraday(gandanta) WHERE gandanta = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE km_planetary_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_planetary_aspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_astro_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_moon_intraday ENABLE ROW LEVEL SECURITY;

-- Public read access for all ephemeris tables
CREATE POLICY "Public read km_planetary_positions"
    ON km_planetary_positions FOR SELECT USING (true);
CREATE POLICY "Public read km_planetary_aspects"
    ON km_planetary_aspects FOR SELECT USING (true);
CREATE POLICY "Public read km_astro_events"
    ON km_astro_events FOR SELECT USING (true);
CREATE POLICY "Public read km_moon_intraday"
    ON km_moon_intraday FOR SELECT USING (true);
