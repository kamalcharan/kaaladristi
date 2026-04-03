-- ============================================================================
-- KALA-DRISHTI: Make dc_inference.end_date optional
-- Migration 007 — Run on kaala_dristi_db
-- ============================================================================

ALTER TABLE dc_inference
    ALTER COLUMN end_date DROP NOT NULL;

-- Also relax the dates check so it only applies when end_date is present
ALTER TABLE dc_inference
    DROP CONSTRAINT IF EXISTS dc_inference_dates_check;

ALTER TABLE dc_inference
    ADD CONSTRAINT dc_inference_dates_check
        CHECK (end_date IS NULL OR end_date >= start_date);
