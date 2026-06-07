-- ============================================================================
-- Migration 055: Add narrative + day_of_week to km_astro_calendar
--
-- narrative    — long-form VaNi narrative text for admin editing
-- day_of_week  — GENERATED ALWAYS from start_date so it never drifts
--
-- NOTE: month and year are already GENERATED ALWAYS columns (migration 048).
--       The API must NOT include them in INSERT/UPDATE column lists.
-- ============================================================================

ALTER TABLE km_astro_calendar
  ADD COLUMN IF NOT EXISTS narrative    TEXT,
  ADD COLUMN IF NOT EXISTS day_of_week  TEXT
    GENERATED ALWAYS AS (TRIM(TO_CHAR(start_date, 'Day'))) STORED;

NOTIFY pgrst, 'reload schema';
