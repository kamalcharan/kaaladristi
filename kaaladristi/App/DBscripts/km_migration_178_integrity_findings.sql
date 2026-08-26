-- =====================================================================
-- km_migration_178_integrity_findings.sql
-- Target database: kaala_dristi_db
-- Data-integrity findings log + partial-monthly-bar cleanup
-- =====================================================================
-- WHY (audit 2026-08-03, re-proven twice since):
-- Every health check in the platform reduces to column fill-rate, row
-- count, or step exceptions — PRESENCE, not CORRECTNESS — and there is
-- no alert channel anywhere in the backend. Consequence: real bugs ran
-- green for months (NSE value_cr inflated 1e5x, 2,104 symbols dropped
-- daily, dot_* all-false since 2026-04-06). Two more were found by hand
-- on 2026-08-24: the nightly symbol_enrichment dimension had NEVER run
-- (it raised before the script), and a partial 2026-08-05 "August"
-- monthly bar had been the latest monthly bar for three weeks.
--
-- The audit named the three missing check classes; this table is where
-- they record what they find, so a finding is queryable, alertable, and
-- visible on the Pipeline Dashboard instead of living in nobody's head:
--   reconciliation  — parsed vs inserted (the unmatched_count already
--                     written to km_pipeline_runs.metadata every run and
--                     never read by anything)
--   invariant       — relationships that must hold (value_cr vs
--                     volume x close, period-bar alignment, ...)
--   staleness       — a signal column that has gone degenerate (zero
--                     TRUE across the whole universe for N days)
--   step_failure    — a pipeline step that failed / never ran

CREATE TABLE IF NOT EXISTS km_integrity_findings (
    id           BIGSERIAL PRIMARY KEY,
    run_date     DATE        NOT NULL,
    check_key    TEXT        NOT NULL,   -- stable id, e.g. 'monthly_partial_bar'
    check_class  TEXT        NOT NULL CHECK (check_class IN
                     ('reconciliation','invariant','staleness','step_failure')),
    severity     TEXT        NOT NULL CHECK (severity IN ('critical','warning','info')),
    subject      TEXT,                   -- table / dimension / column the finding is about
    summary      TEXT        NOT NULL,   -- one line, human-readable
    metric       NUMERIC,                -- the measured number, when there is one
    expected     NUMERIC,                -- what it should have been
    detail       JSONB,                  -- structured evidence
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (run_date, check_key) — a re-run updates rather than piles up.
CREATE UNIQUE INDEX IF NOT EXISTS ux_integrity_findings_day
    ON km_integrity_findings (run_date, check_key);
CREATE INDEX IF NOT EXISTS ix_integrity_findings_recent
    ON km_integrity_findings (run_date DESC, severity);

GRANT SELECT ON km_integrity_findings TO authenticated, anon, admin, "user", kd_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON km_integrity_findings TO kd_app;
GRANT USAGE ON SEQUENCE km_integrity_findings_id_seq TO kd_app;

-- =====================================================================
-- Cleanup: the partial August monthly bar (found 2026-08-24)
-- =====================================================================
-- 2026-08-05 carried 3,184 monthly rows holding Aug 1-5 data only
-- (RELIANCE: close 1280 / 43M volume, vs the month's real 1309.8 /
-- 168M). Root cause is fixed in code (pipeline/compute/{weekly,monthly}
-- _bars.py now refuse to write a period that is still in progress);
-- this removes the row set it already produced. August's real bar is
-- written by the normal month-end run.
DELETE FROM km_equity_monthly
WHERE trade_date = DATE '2026-08-05'
  AND DATE '2026-08-05' < DATE '2026-08-31';   -- belt-and-braces: only if August is still open

-- Verify (expect the latest monthly bar to be 2026-07-31 until month end):
--   SELECT MAX(trade_date) FROM km_equity_monthly;
