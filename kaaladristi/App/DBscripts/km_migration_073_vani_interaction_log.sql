-- ============================================================
-- Migration 073 · VaNi Interaction Log
--
-- Target DB : vani_db  (Main VPS — 187.127.136.65:5432)
--             NOT kaala_dristi_db
--
-- Run manually in pgAdmin / psql connected to vani_db.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS vn_interaction_log (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product           TEXT        NOT NULL,
    session_id        UUID,
    user_id           UUID,
    system_prompt     TEXT,
    user_input        TEXT        NOT NULL,
    context_payload   JSONB,
    llm_response      TEXT        NOT NULL,
    model_version     TEXT,
    user_rating       SMALLINT,
    was_edited        BOOLEAN     DEFAULT FALSE,
    edited_response   TEXT,
    follow_up_query   TEXT,
    was_accepted      BOOLEAN,
    prompt_tokens     INT,
    completion_tokens INT,
    latency_ms        INT,
    endpoint          TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vn_interaction_log_product_created
    ON vn_interaction_log (product, created_at DESC);

CREATE INDEX IF NOT EXISTS vn_interaction_log_user_created
    ON vn_interaction_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vn_interaction_log_endpoint_created
    ON vn_interaction_log (endpoint, created_at DESC);

COMMIT;
