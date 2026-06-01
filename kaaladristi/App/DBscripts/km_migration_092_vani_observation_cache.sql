-- Migration 092: vani_observation_cache
-- Target database: vani_db (VANI_DB_URL) — NOT kaala_dristi_db
-- Run this against the vani_db instance, not the main Postgres DB.
--
-- Replaces the in-memory _vani_cache dict with a persistent per-item cache.
-- Each observation card is stored individually so partial cache hits are possible
-- (only missing items trigger an LLM call).

CREATE TABLE IF NOT EXISTS vani_observation_cache (
    item_key   TEXT        NOT NULL,
    cache_date DATE        NOT NULL,
    observation JSONB      NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (item_key, cache_date)
);

-- Fast lookup by date for daily brief assembly
CREATE INDEX IF NOT EXISTS idx_vani_obs_cache_date ON vani_observation_cache (cache_date);
