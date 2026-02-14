-- ============================================================================
-- KALA-DRISHTI PANCHANG TABLE (km_ prefix)
-- Run this in Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_daily_panchang (
    id                      SERIAL PRIMARY KEY,
    date                    DATE NOT NULL UNIQUE,
    -- Sunrise / Sunset (Ujjain)
    sunrise_jd              DOUBLE PRECISION,
    sunrise_ist             TEXT,
    sunset_jd               DOUBLE PRECISION,
    sunset_ist              TEXT,
    -- Tithi
    tithi_num               SMALLINT NOT NULL,
    tithi_name              TEXT NOT NULL,
    tithi_base_name         TEXT,
    paksha                  TEXT NOT NULL,
    tithi_group             TEXT,
    tithi_lord              TEXT,
    -- Nakshatra
    nakshatra_num           SMALLINT NOT NULL,
    nakshatra_name          TEXT NOT NULL,
    nakshatra_lord          TEXT,
    nakshatra_pada          SMALLINT,
    -- Yoga
    yoga_num                SMALLINT,
    yoga_name               TEXT,
    -- Karana
    karana_num              SMALLINT,
    karana_name             TEXT,
    -- Vara
    vara                    TEXT NOT NULL,
    vara_lord               TEXT NOT NULL,
    -- DLNL
    dlnl_match              BOOLEAN DEFAULT FALSE,
    -- Sun position
    sun_sign                SMALLINT,
    sun_sign_name           TEXT,
    sun_longitude           DOUBLE PRECISION,
    sun_tropical_longitude  DOUBLE PRECISION,
    -- Moon position
    moon_sign               SMALLINT,
    moon_sign_name          TEXT,
    moon_longitude          DOUBLE PRECISION,
    -- Sankranti
    is_sankranti            BOOLEAN DEFAULT FALSE,
    sankranti_from          TEXT,
    sankranti_to            TEXT,
    -- Hemisphere events
    hemisphere_event        TEXT,
    -- Special flags
    is_purnima              BOOLEAN DEFAULT FALSE,
    is_amavasya             BOOLEAN DEFAULT FALSE,
    is_ekadashi             BOOLEAN DEFAULT FALSE,
    -- Metadata
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_km_panchang_date
    ON km_daily_panchang(date);
CREATE INDEX IF NOT EXISTS idx_km_panchang_tithi
    ON km_daily_panchang(tithi_num);
CREATE INDEX IF NOT EXISTS idx_km_panchang_nakshatra
    ON km_daily_panchang(nakshatra_name);
CREATE INDEX IF NOT EXISTS idx_km_panchang_dlnl
    ON km_daily_panchang(dlnl_match) WHERE dlnl_match = TRUE;
CREATE INDEX IF NOT EXISTS idx_km_panchang_sankranti
    ON km_daily_panchang(is_sankranti) WHERE is_sankranti = TRUE;
CREATE INDEX IF NOT EXISTS idx_km_panchang_paksha
    ON km_daily_panchang(paksha, tithi_num);

-- Row Level Security
ALTER TABLE km_daily_panchang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read km_daily_panchang"
    ON km_daily_panchang FOR SELECT USING (true);
