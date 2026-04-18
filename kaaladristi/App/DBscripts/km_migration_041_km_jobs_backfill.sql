-- ============================================================
-- Migration 041 · Backfill support on km_jobs
--
-- Adds three columns so a km_jobs row can represent a multi-date
-- backfill of one dimension:
--
--   date_from / date_to  — inclusive weekday range the worker loops
--                          over (trade_date stays NULL for these jobs).
--   batch_id             — groups the 1..11 rows inserted by a single
--                          POST /api/pipeline2/backfill call so the UI
--                          can render a batch header with rolling
--                          progress.
--
-- Existing single-date fix and daily_run jobs are unaffected — their
-- trade_date is set and the new columns stay NULL.
-- ============================================================

ALTER TABLE km_jobs
  ADD COLUMN IF NOT EXISTS date_from date,
  ADD COLUMN IF NOT EXISTS date_to   date,
  ADD COLUMN IF NOT EXISTS batch_id  text;

-- Partial index — only non-NULL batch ids matter for grouping queries.
CREATE INDEX IF NOT EXISTS idx_km_jobs_batch
  ON km_jobs (batch_id, created_at DESC)
  WHERE batch_id IS NOT NULL;

COMMENT ON COLUMN km_jobs.date_from IS 'Inclusive start of backfill range. NULL for single-date jobs.';
COMMENT ON COLUMN km_jobs.date_to   IS 'Inclusive end of backfill range. NULL for single-date jobs.';
COMMENT ON COLUMN km_jobs.batch_id  IS 'Shared id for the set of jobs inserted by one backfill request.';

NOTIFY pgrst, 'reload schema';
