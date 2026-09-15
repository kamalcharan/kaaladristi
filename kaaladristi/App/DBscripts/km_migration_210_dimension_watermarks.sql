-- ============================================================================
-- km_migration_210_dimension_watermarks.sql
-- Target DB: kaala_dristi_db
--
-- Per-dimension, per-date watermark: WHEN each pipeline2 dimension was last
-- computed for a trade date, and from which job.
--
-- WHY THIS EXISTS
-- ---------------
-- Migration-0 of the thesis-events plan gave `fix` jobs a dependency cascade,
-- so repairing one dimension now re-runs everything derived from it. What it
-- could not give was PROOF: nothing recorded which version of its inputs a row
-- was derived from, so a row computed from superseded data is indistinguishable
-- from a current one. Every existing health check measures PRESENCE (is the
-- column filled) and cannot see this at all -- the columns are populated, just
-- not current. That is the same blind spot that let `value_cr` run 1e5x wrong
-- and `dot_svd` sit all-FALSE for months while every check read green.
--
-- The gap is wider than "no watermark". `run_daily` produces a StepOutcome for
-- each of its 22 dimensions and stores NONE of them individually: the worker
-- folds them into one aggregate km_jobs row (dimension NULL) and a
-- progress_text string. `fix` jobs do carry (dimension, trade_date), and
-- km_pipeline_runs carries the LEGACY step names, which pipeline2 mostly skips.
-- So no existing table can answer "when was nse_magic_rs last computed for
-- 2026-09-11", and this one is the smallest thing that can.
--
-- WHAT IT BUYS
-- ------------
-- With DIMENSION_DEPENDENTS (pipeline2/orchestrator.py) inverted into parents,
-- a dimension D on date T is DERIVED-STALE when any parent P has
-- computed_at(P,T) > computed_at(D,T). That is checkable, and it catches the
-- cases the cascade structurally cannot:
--   * a fix applied while PIPELINE2_CASCADE was off
--   * a cascade job that was enqueued and then failed
--   * a manual backfill script run straight against the DB
--
-- SIZE
-- ----
-- One row per (dimension, trade_date): ~30 dimensions x ~250 sessions = ~7,500
-- rows a year. Trivial next to km_equity_eod's 16.65M rows / 19 GB.
--
-- STATUS SEMANTICS -- read this before changing the check
-- -------------------------------------------------------
-- 'completed' AND 'partial' both stamp. Both mean the compute RAN against the
-- inputs as they stood, which is the only question this table answers.
-- 'partial' means it ran and did not reach its fill threshold -- a fill
-- question, already answered by DIMENSION_HEALTH. Refusing to stamp a partial
-- would make the 2,184 partial fix jobs on record read as permanently stale and
-- the check would be muted within a week. 'failed' never stamps.
--
-- Owner runs this in pgAdmin. No REFRESH, no backfill, nothing else required.
-- The table starts EMPTY on purpose: an absent watermark is "unknown", never
-- "stale", so the first nights report nothing while history accumulates.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.km_dimension_watermarks (
  dimension      TEXT        NOT NULL,
  trade_date     DATE        NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT        NOT NULL,
  source         TEXT        NOT NULL,
  job_id         BIGINT,
  rows_affected  INTEGER,
  PRIMARY KEY (dimension, trade_date),
  CONSTRAINT km_dimension_watermarks_status_chk
    CHECK (status IN ('completed', 'partial')),
  CONSTRAINT km_dimension_watermarks_source_chk
    CHECK (source IN ('daily_run', 'fix', 'backfill', 'cascade', 'manual'))
);

COMMENT ON TABLE public.km_dimension_watermarks IS
  'When each pipeline2 dimension was last computed for a trade date. Compared '
  'against a dimension''s PARENTS (orchestrator.DIMENSION_DEPENDENTS inverted) '
  'to detect a row derived from superseded inputs -- which fill-rate checks '
  'structurally cannot see.';

COMMENT ON COLUMN public.km_dimension_watermarks.computed_at IS
  'End of the compute. A dimension is derived-stale when a PARENT carries a '
  'LATER computed_at for the same trade_date.';

COMMENT ON COLUMN public.km_dimension_watermarks.status IS
  'completed | partial. Both stamp -- the compute ran either way. failed never '
  'stamps, so a failure can never make a dimension look current.';

COMMENT ON COLUMN public.km_dimension_watermarks.source IS
  'Which path wrote it: daily_run | fix | backfill | cascade | manual.';

-- The staleness check scans a date window across all dimensions.
CREATE INDEX IF NOT EXISTS idx_dim_watermarks_date
  ON public.km_dimension_watermarks (trade_date, dimension);

-- Read by the Pipeline Dashboard (PostgREST, DB role `authenticated` -- the
-- migration-142 lesson: a table with no `authenticated` grant is readable
-- anonymously and permission-denied for every logged-in user, and it fails
-- silently on an optional panel).
GRANT SELECT ON public.km_dimension_watermarks TO authenticated, anon, kd_app, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON public.km_dimension_watermarks TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
-- Empty immediately after this runs; fills from the next daily run / fix job.
--
--   SELECT count(*) FROM km_dimension_watermarks;             -- 0
--   SELECT relacl FROM pg_class WHERE relname = 'km_dimension_watermarks';
--     -- must list authenticated=r. information_schema.role_table_grants is
--     -- BLIND over a restricted connection; relacl is not.
