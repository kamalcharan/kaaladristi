-- ============================================================
-- Migration 035 · Pipeline Observability — Coverage Tracking
--
-- Adds coverage tracking columns to km_pipeline_runs so each
-- step records expected vs actual rows and a coverage %.
-- Also adds step_order for consistent display + trigger metadata.
-- ============================================================

-- ── Add columns ────────────────────────────────────────────────
ALTER TABLE km_pipeline_runs
  ADD COLUMN IF NOT EXISTS step_order      INT,
  ADD COLUMN IF NOT EXISTS rows_expected   INT,
  ADD COLUMN IF NOT EXISTS coverage_pct    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS triggered_by    TEXT DEFAULT 'scheduler',
  ADD COLUMN IF NOT EXISTS triggered_user  TEXT;

COMMENT ON COLUMN km_pipeline_runs.step_order    IS 'Consistent display ordering (1=ingestion, 2=indicators, etc.)';
COMMENT ON COLUMN km_pipeline_runs.rows_expected IS 'Expected row count for this step (from coverage rule)';
COMMENT ON COLUMN km_pipeline_runs.coverage_pct  IS 'rows_count / rows_expected * 100 — NULL if expected is unknown';
COMMENT ON COLUMN km_pipeline_runs.triggered_by  IS 'scheduler | manual_full | manual_step';
COMMENT ON COLUMN km_pipeline_runs.triggered_user IS 'User who triggered manual run (NULL for scheduler)';

-- ── Index for fast date+step queries ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date_step
  ON km_pipeline_runs (trade_date DESC, step_order);

-- ── Backfill step_order for existing rows ─────────────────────
UPDATE km_pipeline_runs SET step_order = CASE step
  WHEN 'index_download' THEN 1
  WHEN 'tri_download' THEN 2
  WHEN 'fii_dii' THEN 3
  WHEN 'index_indicators' THEN 4
  WHEN 'download' THEN 5
  WHEN 'parse' THEN 6
  WHEN 'insert' THEN 7
  WHEN 'delivery' THEN 8
  WHEN 'indicators' THEN 9
  WHEN 'magic_rs' THEN 10
  WHEN 'flow_intelligence' THEN 11
  WHEN 'industry_composites' THEN 12
  WHEN 'views' THEN 13
  ELSE 99
END
WHERE step_order IS NULL;

NOTIFY pgrst, 'reload schema';
