-- ============================================================
-- Migration 072 · Panchang Windows + Score Calibration
--
-- Part 1: Promote Rahu Kala / Abhijit / Yoga end-time to
--         km_daily_panchang columns (no more JS lookups).
--         All columns nullable; backfill via
--         populate_panchang_windows.py.
--
-- Part 2: New km_score_calibration table — stores normalizers
--         like the Plan Score divisor. Single row per score_name.
-- ============================================================

BEGIN;

-- ── Part 1: km_daily_panchang extensions ──────────────────────

ALTER TABLE km_daily_panchang
  ADD COLUMN IF NOT EXISTS rahu_kala_start    TIME,
  ADD COLUMN IF NOT EXISTS rahu_kala_end      TIME,
  ADD COLUMN IF NOT EXISTS abhijit_start      TIME,
  ADD COLUMN IF NOT EXISTS abhijit_end        TIME,
  ADD COLUMN IF NOT EXISTS yoga_end_ist       TIME,
  ADD COLUMN IF NOT EXISTS yoga_end_next_day  BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Part 2: Score calibration registry ────────────────────────

CREATE TABLE IF NOT EXISTS km_score_calibration (
    id            SERIAL PRIMARY KEY,
    score_name    TEXT        NOT NULL UNIQUE,
    normalizer    NUMERIC     NOT NULL,
    sample_count  INTEGER,
    percentile    NUMERIC,
    computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes         TEXT
);

GRANT SELECT ON km_score_calibration TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_score_calibration_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
