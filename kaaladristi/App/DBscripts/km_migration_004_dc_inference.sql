-- ============================================================================
-- KALA-DRISHTI: DC Inference — Expert Knowledge Base
-- Migration 004 — Run on kaala_dristi_db as vikuna_admin
-- ============================================================================
--
-- Creates:
--   1. dc_inference  — expert-curated planetary event + market inference table
--
-- Each row = one astrological event period annotated by an expert with an
-- expected / observed market outcome. These rows become the seed data for the
-- Rule Engine (Phase 2) which will scan ephemeris data for similar conditions
-- and run historical correlation against km_index_eod / km_equity_eod.
--
-- Columns:
--   astro_event      — free-text description (e.g. "Rahu Mars in same sign")
--   rule_definition  — JSONB parsed by Rule Engine (populated later, nullable)
--   start_date/time  — when the planetary condition began
--   end_date/time    — when it ended
--   inference        — expert's observation or expectation for markets
--   market_impact    — bullish | bearish | volatile | neutral | mixed
--   confidence       — expert confidence 1-10
--   notes            — optional additional context
--   created_by       — who entered the record
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dc_inference (
    id              BIGSERIAL PRIMARY KEY,
    astro_event     TEXT NOT NULL,
    rule_definition JSONB,
    start_date      DATE NOT NULL,
    start_time      TIME,
    end_date        DATE NOT NULL,
    end_time        TIME,
    inference       TEXT,
    market_impact   TEXT CHECK (
                        market_impact IN ('bullish','bearish','volatile','neutral','mixed')
                    ),
    confidence      SMALLINT CHECK (confidence BETWEEN 1 AND 10),
    notes           TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT dc_inference_dates_check CHECK (end_date >= start_date)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dc_inference_start_date    ON dc_inference(start_date);
CREATE INDEX IF NOT EXISTS idx_dc_inference_end_date      ON dc_inference(end_date);
CREATE INDEX IF NOT EXISTS idx_dc_inference_market_impact ON dc_inference(market_impact);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ BEGIN
    CREATE TRIGGER trg_dc_inference_updated_at
        BEFORE UPDATE ON dc_inference
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE dc_inference ENABLE ROW LEVEL SECURITY;

-- All authenticated users (kd_app role) can read and write expert inference data
CREATE POLICY "dc_inference_select" ON dc_inference
    FOR SELECT
    TO anon, kd_app
    USING (true);

CREATE POLICY "dc_inference_insert" ON dc_inference
    FOR INSERT
    TO kd_app
    WITH CHECK (true);

CREATE POLICY "dc_inference_update" ON dc_inference
    FOR UPDATE
    TO kd_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "dc_inference_delete" ON dc_inference
    FOR DELETE
    TO kd_app
    USING (true);

-- ── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT                        ON dc_inference TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dc_inference TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE dc_inference_id_seq TO kd_app;
