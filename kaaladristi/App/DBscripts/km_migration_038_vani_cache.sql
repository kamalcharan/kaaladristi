-- ============================================================
-- Migration 038 · VaNi Conversational Layer — Cache Table
--
-- Persistent cache for VaNi intent responses. Cache key includes
-- intent_id + context_hash (bucketed signal values) so responses
-- auto-invalidate when underlying data state changes.
--
-- The intent registry itself lives in code (lib/vani_intents.py),
-- not in the database. Only cached LLM responses go here.
-- ============================================================

CREATE TABLE IF NOT EXISTS km_vani_cache (
    cache_key       TEXT        PRIMARY KEY,
    intent_id       TEXT        NOT NULL,
    context_hash    TEXT        NOT NULL,
    response_text   TEXT        NOT NULL,
    llm_provider    TEXT,
    llm_model       TEXT,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    hit_count       INT         NOT NULL DEFAULT 0
);

CREATE INDEX idx_vani_cache_expiry  ON km_vani_cache (expires_at);
CREATE INDEX idx_vani_cache_intent  ON km_vani_cache (intent_id);

COMMENT ON TABLE km_vani_cache IS
    'Persistent cache for VaNi conversational layer responses. '
    'Key = intent_id + context_hash. TTL per intent.';
