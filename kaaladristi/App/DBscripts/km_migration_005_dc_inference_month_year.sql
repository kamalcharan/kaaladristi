-- ============================================================================
-- KALA-DRISHTI: DC Inference — Add month + year generated columns
-- Migration 005 — Run on kaala_dristi_db
-- ============================================================================
--
-- month and year are auto-derived from start_date (GENERATED ALWAYS AS STORED).
-- No manual entry required — they stay in sync automatically.
-- Useful for filtering: WHERE month = 4 AND year = 2026
-- ============================================================================

ALTER TABLE dc_inference
    ADD COLUMN IF NOT EXISTS month SMALLINT
        GENERATED ALWAYS AS (EXTRACT(MONTH FROM start_date)::SMALLINT) STORED,
    ADD COLUMN IF NOT EXISTS year  SMALLINT
        GENERATED ALWAYS AS (EXTRACT(YEAR  FROM start_date)::SMALLINT) STORED;

CREATE INDEX IF NOT EXISTS idx_dc_inference_year_month ON dc_inference(year, month);

NOTIFY pgrst, 'reload schema';
