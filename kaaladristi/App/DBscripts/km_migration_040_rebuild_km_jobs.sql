-- ============================================================
-- Migration 040 · Rebuild km_jobs for pipeline v2
--
-- Drops the legacy km_jobs table and recreates it with the schema
-- needed by the new /data-pipeline surface.
--
-- Key differences from the old schema:
--   * `dimension`, `trade_date`, `exchange`, `force` are first-class
--     columns instead of params-JSON fields.
--   * `fill_rate_before` / `fill_rate_after` capture ground-truth
--     coverage so a "completed" job can still be marked partial when
--     the post-run column-fill is below threshold.
--   * `rows_affected` is the single canonical row-count field (the
--     legacy `rows_updated` inflation bug is gone — v2 derives this
--     from fill-rate delta, not RPC return values).
--
-- The old worker.py + pipeline_api.py expect the old km_jobs schema
-- and WILL fail after this migration. That is intentional — v2 is a
-- hard cutover at the job-store layer. The old daily_pipeline.py
-- scheduler and km_pipeline_runs / km_trading_calendar tables remain
-- untouched so EOD downloads continue to work via the old scheduler
-- until v2 takes over scheduling too.
-- ============================================================

DROP TABLE IF EXISTS km_jobs CASCADE;

CREATE TABLE km_jobs (
  id               serial PRIMARY KEY,
  job_type         text NOT NULL,             -- 'daily_run' | 'fix'
  dimension        text,                      -- e.g. 'nse_magic_rs' (NULL for daily_run)
  trade_date       date,
  exchange         text,                      -- 'NSE' | 'BSE' | NULL
  force            boolean DEFAULT false,
  status           text NOT NULL DEFAULT 'queued',  -- queued | running | completed | partial | failed | cancelled
  progress_text    text,
  progress_pct     integer DEFAULT 0,
  rows_affected    integer,
  fill_rate_before numeric(5,2),              -- 0.00 .. 100.00
  fill_rate_after  numeric(5,2),
  error_msg        text,
  created_at       timestamptz DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  created_by       text DEFAULT 'ui'
);

CREATE INDEX idx_km_jobs_status       ON km_jobs (status, created_at DESC);
CREATE INDEX idx_km_jobs_type_date    ON km_jobs (job_type, trade_date DESC);
CREATE INDEX idx_km_jobs_dimension    ON km_jobs (dimension, trade_date DESC);

-- Computed aggregate — RLS provides no benefit and breaks RPC writes.
ALTER TABLE km_jobs DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  km_jobs IS 'Pipeline v2 job store. Rebuilt by migration 040.';
COMMENT ON COLUMN km_jobs.job_type       IS 'daily_run (scheduler) | fix (targeted recompute)';
COMMENT ON COLUMN km_jobs.dimension      IS 'Specific dimension for fix jobs; NULL for daily_run';
COMMENT ON COLUMN km_jobs.status         IS 'queued | running | completed | partial | failed | cancelled';
COMMENT ON COLUMN km_jobs.fill_rate_after IS 'Ground-truth column-fill rate computed AFTER the RPC committed. Source of truth, not RPC return value.';

NOTIFY pgrst, 'reload schema';
