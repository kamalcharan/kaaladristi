-- Migration 071: Backfill foundational table schemas
--
-- 14 tables exist in the live production DB but had no CREATE TABLE statement
-- in the migration history (created via direct psql/pgAdmin before migration
-- discipline started ~M020). Without these statements, a fresh DB cannot be
-- reconstructed from the repo.
--
-- This migration is IDEMPOTENT: every CREATE uses IF NOT EXISTS, so running it
-- against the live DB is a no-op. Running it against a fresh DB creates the
-- tables exactly as they exist in production (column types, defaults, PK,
-- UNIQUE constraints).
--
-- Schemas captured from information_schema.columns + table_constraints on
-- 187.127.136.65:5432/kaala_dristi_db. Indexes are NOT captured here — add
-- them in a follow-up migration if needed.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. km_daily_panchang (foundational — 14,975 rows · 1990–2030)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_daily_panchang (
    id                       SERIAL PRIMARY KEY,
    date                     DATE             NOT NULL UNIQUE,
    sunrise_jd               DOUBLE PRECISION,
    sunrise_ist              TEXT,
    sunset_jd                DOUBLE PRECISION,
    sunset_ist               TEXT,
    tithi_num                SMALLINT         NOT NULL,
    tithi_name               TEXT             NOT NULL,
    tithi_base_name          TEXT,
    paksha                   TEXT             NOT NULL,
    tithi_group              TEXT,
    tithi_lord               TEXT,
    nakshatra_num            SMALLINT         NOT NULL,
    nakshatra_name           TEXT             NOT NULL,
    nakshatra_lord           TEXT,
    nakshatra_pada           SMALLINT,
    yoga_num                 SMALLINT,
    yoga_name                TEXT,
    karana_num               SMALLINT,
    karana_name              TEXT,
    vara                     TEXT             NOT NULL,
    vara_lord                TEXT             NOT NULL,
    dlnl_match               BOOLEAN                   DEFAULT FALSE,
    sun_sign                 SMALLINT,
    sun_sign_name            TEXT,
    sun_longitude            DOUBLE PRECISION,
    sun_tropical_longitude   DOUBLE PRECISION,
    moon_sign                SMALLINT,
    moon_sign_name           TEXT,
    moon_longitude           DOUBLE PRECISION,
    is_sankranti             BOOLEAN                   DEFAULT FALSE,
    sankranti_from           TEXT,
    sankranti_to             TEXT,
    hemisphere_event         TEXT,
    is_purnima               BOOLEAN                   DEFAULT FALSE,
    is_amavasya              BOOLEAN                   DEFAULT FALSE,
    is_ekadashi              BOOLEAN                   DEFAULT FALSE,
    created_at               TIMESTAMPTZ               DEFAULT now(),
    tithi_end_ist            TIME,
    nakshatra_end_ist        TIME,
    tithi_end_next_day       BOOLEAN          NOT NULL DEFAULT FALSE,
    nakshatra_end_next_day   BOOLEAN          NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------------
-- 2. km_planetary_positions (foundational — 134,775 rows · 1990–2030)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_planetary_positions (
    id              SERIAL PRIMARY KEY,
    date            DATE             NOT NULL,
    planet          TEXT             NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    speed           DOUBLE PRECISION,
    retrograde      BOOLEAN                   DEFAULT FALSE,
    sign            INTEGER,
    sign_name       TEXT,
    nakshatra       INTEGER,
    nakshatra_name  TEXT,
    nakshatra_pada  INTEGER,
    combust         BOOLEAN                   DEFAULT FALSE,
    created_at      TIMESTAMPTZ               DEFAULT now(),
    UNIQUE (date, planet)
);

-- ---------------------------------------------------------------------------
-- 3. km_planetary_aspects (foundational — 31,938 rows · 1990–2030)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_planetary_aspects (
    id           SERIAL PRIMARY KEY,
    date         DATE             NOT NULL,
    planet_1     TEXT             NOT NULL,
    planet_2     TEXT             NOT NULL,
    aspect_type  TEXT             NOT NULL,
    angle        DOUBLE PRECISION,
    orb          DOUBLE PRECISION,
    exact        BOOLEAN                   DEFAULT FALSE,
    created_at   TIMESTAMPTZ               DEFAULT now(),
    UNIQUE (date, planet_1, planet_2, aspect_type)
);

-- ---------------------------------------------------------------------------
-- 4. km_rule_signals (foundational — 65,124 rows · 1990–2030)
-- Note: production has TWO unique constraints on (date, rule_id) —
-- km_rule_signals_date_rule_id_key and uq_rule_signals_date_rule.
-- We keep the auto-generated one only; the duplicate is a historical artifact.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_rule_signals (
    id                    SERIAL PRIMARY KEY,
    date                  DATE    NOT NULL,
    rule_id               INTEGER NOT NULL,
    signal                TEXT    NOT NULL,
    strength              INTEGER          DEFAULT 1,
    details               TEXT,
    actual_market_return  NUMERIC,
    matched               BOOLEAN,
    conditions_snapshot   JSONB,
    partial_day           BOOLEAN,
    UNIQUE (date, rule_id)
);

-- ---------------------------------------------------------------------------
-- 5. km_astro_events (purpose: per-day astro event log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_astro_events (
    id          SERIAL PRIMARY KEY,
    event_date  DATE        NOT NULL,
    event_type  TEXT        NOT NULL,
    planet      TEXT        NOT NULL,
    from_value  TEXT,
    to_value    TEXT,
    severity    TEXT                 DEFAULT 'normal',
    created_at  TIMESTAMPTZ          DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. km_candidate_rules (12 rows — proposed-rule staging)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_candidate_rules (
    id                       SERIAL PRIMARY KEY,
    pattern_description      TEXT             NOT NULL,
    conditions               TEXT             NOT NULL,
    signal                   TEXT             NOT NULL,
    statistical_confidence   DOUBLE PRECISION,
    sample_count             INTEGER,
    pct_correct              DOUBLE PRECISION,
    avg_return               DOUBLE PRECISION,
    volatility_impact        DOUBLE PRECISION,
    discovered_date          DATE,
    reviewed                 BOOLEAN                   DEFAULT FALSE,
    approved                 BOOLEAN                   DEFAULT FALSE,
    promoted_to_rule_id      INTEGER,
    notes                    TEXT,
    created_at               TIMESTAMPTZ               DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. km_daily_snapshots (per-day per-symbol JSONB snapshot store)
-- Production uses bigint id with no default — modelled here as IDENTITY.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_daily_snapshots (
    id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    date          DATE         NOT NULL,
    symbol        TEXT         NOT NULL,
    version       INTEGER      NOT NULL DEFAULT 1,
    snapshot      JSONB        NOT NULL,
    generated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_snapshot_date_symbol UNIQUE (date, symbol)
);

-- ---------------------------------------------------------------------------
-- 8. km_factor_correlation_stats (29 rows — factor×index volatility/return)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_factor_correlation_stats (
    id                     SERIAL PRIMARY KEY,
    factor_type            TEXT             NOT NULL,
    index_symbol           TEXT             NOT NULL,
    pct_down_days          DOUBLE PRECISION,
    avg_return             DOUBLE PRECISION,
    avg_range_pct          DOUBLE PRECISION,
    volatility_multiplier  DOUBLE PRECISION,
    sample_count           INTEGER,
    baseline_down_pct      DOUBLE PRECISION,
    baseline_avg_return    DOUBLE PRECISION,
    created_at             TIMESTAMPTZ               DEFAULT now(),
    UNIQUE (factor_type, index_symbol)
);

-- ---------------------------------------------------------------------------
-- 9. km_indicator_compute_log (pipeline run log for indicator compute)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_indicator_compute_log (
    id              BIGSERIAL PRIMARY KEY,
    compute_mode    TEXT        NOT NULL,
    asset_type      TEXT,
    symbols_count   INTEGER              DEFAULT 0,
    date_from       DATE,
    date_to         DATE,
    rows_computed   INTEGER              DEFAULT 0,
    signals_found   INTEGER              DEFAULT 0,
    status          TEXT        NOT NULL,
    error_msg       TEXT,
    duration_secs   NUMERIC,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. km_moon_intraday (59,900 rows — intraday moon position 09:15–15:30 IST)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_moon_intraday (
    id              SERIAL PRIMARY KEY,
    date            DATE             NOT NULL,
    time_ist        TEXT             NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    speed           DOUBLE PRECISION,
    sign            INTEGER,
    sign_name       TEXT,
    nakshatra       INTEGER,
    nakshatra_name  TEXT,
    nakshatra_pada  INTEGER,
    gandanta        BOOLEAN                   DEFAULT FALSE,
    created_at      TIMESTAMPTZ               DEFAULT now(),
    UNIQUE (date, time_ist)
);

-- ---------------------------------------------------------------------------
-- 11. km_risk_scores (13,004 rows — Risk Engine output, 4-dim composite)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_risk_scores (
    id               SERIAL PRIMARY KEY,
    date             DATE             NOT NULL,
    symbol           TEXT             NOT NULL,
    composite_score  DOUBLE PRECISION NOT NULL,
    structural       DOUBLE PRECISION,
    momentum         DOUBLE PRECISION,
    volatility       DOUBLE PRECISION,
    deception        DOUBLE PRECISION,
    regime           TEXT,
    explanation      TEXT,
    created_at       TIMESTAMPTZ               DEFAULT now(),
    UNIQUE (date, symbol)
);

-- ---------------------------------------------------------------------------
-- 12. km_rules (18 rows — legacy/technical rules registry, distinct from
--     km_astro_rule_master)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_rules (
    id               SERIAL PRIMARY KEY,
    code             TEXT        NOT NULL UNIQUE,
    category         TEXT        NOT NULL,
    name             TEXT        NOT NULL,
    description      TEXT,
    conditions       TEXT        NOT NULL,
    signal           TEXT        NOT NULL,
    strength         INTEGER              DEFAULT 1,
    source           TEXT                 DEFAULT 'given',
    active           BOOLEAN              DEFAULT TRUE,
    historical_note  TEXT,
    created_at       TIMESTAMPTZ          DEFAULT now(),
    updated_at       TIMESTAMPTZ          DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 13. km_sector_sensitivity (per factor_type × sector sensitivity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_sector_sensitivity (
    id               SERIAL PRIMARY KEY,
    factor_type      TEXT             NOT NULL,
    sector           TEXT             NOT NULL,
    sensitivity_pct  DOUBLE PRECISION,
    sample_count     INTEGER,
    created_at       TIMESTAMPTZ               DEFAULT now(),
    UNIQUE (factor_type, sector)
);

-- ---------------------------------------------------------------------------
-- 14. km_technical_signals (empty in prod — schema present, never populated)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS km_technical_signals (
    id                BIGSERIAL PRIMARY KEY,
    asset_type        TEXT        NOT NULL,
    symbol_id         INTEGER     NOT NULL,
    trade_date        DATE        NOT NULL,
    signal_type       TEXT        NOT NULL,
    direction         TEXT        NOT NULL,
    indicator_value   NUMERIC,
    price_at_signal   NUMERIC,
    description       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_type, symbol_id, trade_date, signal_type)
);

COMMIT;
