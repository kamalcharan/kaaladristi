-- Migration 065: Indexes for rule discovery query performance
-- Without these, every discovery run does full table scans on large tables.
-- Run once in pgAdmin / psql. Safe to re-run (all use IF NOT EXISTS).

-- ── km_planetary_positions ────────────────────────────────────────────────────
-- planet + nakshatra: discover_planet_in_nakshatra, discover_vedh
CREATE INDEX IF NOT EXISTS idx_kpp_planet_nakshatra
    ON km_planetary_positions (planet, nakshatra_name);

-- planet + sign: discover_planet_state (vargottam), discover_sign_planet
CREATE INDEX IF NOT EXISTS idx_kpp_planet_sign
    ON km_planetary_positions (planet, sign_name);

-- retrograde filter: discover_planet_state (retrograde, planets_retrograde)
CREATE INDEX IF NOT EXISTS idx_kpp_planet_retrograde
    ON km_planetary_positions (planet)
    WHERE retrograde = TRUE;

-- combust filter: discover_planet_state (combust)
CREATE INDEX IF NOT EXISTS idx_kpp_planet_combust
    ON km_planetary_positions (planet)
    WHERE combust = TRUE;

-- speed: discover_planet_state (reducing_speed, atichari)
CREATE INDEX IF NOT EXISTS idx_kpp_planet_speed
    ON km_planetary_positions (planet, speed);

-- date: JOIN target from km_daily_panchang
CREATE INDEX IF NOT EXISTS idx_kpp_date
    ON km_planetary_positions (date);

-- ── km_planetary_aspects ──────────────────────────────────────────────────────
-- aspect_type + planets: discover_conjunction, discover_relative_position
CREATE INDEX IF NOT EXISTS idx_kpa_aspect_planets
    ON km_planetary_aspects (aspect_type, planet_1, planet_2);

-- reverse planet order (OR clause in discover_conjunction)
CREATE INDEX IF NOT EXISTS idx_kpa_aspect_planets_rev
    ON km_planetary_aspects (aspect_type, planet_2, planet_1);

-- date: JOIN target
CREATE INDEX IF NOT EXISTS idx_kpa_date
    ON km_planetary_aspects (date);

-- ── km_daily_panchang ─────────────────────────────────────────────────────────
-- vara: discover_nakshatra_vara
CREATE INDEX IF NOT EXISTS idx_kdp_vara
    ON km_daily_panchang (vara);

-- vara + nakshatra_lord: discover_nakshatra_vara (vara + lord combo)
CREATE INDEX IF NOT EXISTS idx_kdp_vara_nakshatra_lord
    ON km_daily_panchang (vara, nakshatra_lord);

-- nakshatra_name: panchak rules, compound nakshatra rules
CREATE INDEX IF NOT EXISTS idx_kdp_nakshatra_name
    ON km_daily_panchang (nakshatra_name);

-- yoga_name: discover_compound_yog
CREATE INDEX IF NOT EXISTS idx_kdp_yoga
    ON km_daily_panchang (yoga_name);

-- tithi_base_name + paksha: discover_tithi
CREATE INDEX IF NOT EXISTS idx_kdp_tithi_base_paksha
    ON km_daily_panchang (tithi_base_name, paksha);

-- ekadashi partial: discover_tithi (is_ekadashi)
CREATE INDEX IF NOT EXISTS idx_kdp_ekadashi
    ON km_daily_panchang (vara)
    WHERE is_ekadashi = TRUE;

-- purnima partial: discover_tithi (is_purnima)
CREATE INDEX IF NOT EXISTS idx_kdp_purnima
    ON km_daily_panchang (date)
    WHERE is_purnima = TRUE;

-- dlnl_match partial: discover_nakshatra_vara DLNL rule
CREATE INDEX IF NOT EXISTS idx_kdp_dlnl
    ON km_daily_panchang (date)
    WHERE dlnl_match = TRUE;

-- hemisphere_event: discover_seasonal
CREATE INDEX IF NOT EXISTS idx_kdp_hemisphere
    ON km_daily_panchang (hemisphere_event)
    WHERE hemisphere_event IS NOT NULL;
