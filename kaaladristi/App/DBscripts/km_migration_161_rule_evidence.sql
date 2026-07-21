-- km_migration_161_rule_evidence.sql
-- Target: kaala_dristi_db
--
-- km_rule_evidence — per-rule observational evidence for the astro layer
-- (docs/claude/astro-story.md §3). One row per rule, computed nightly by
-- scripts/compute_rule_evidence.py (wired into the 19:00 IST transit-scoring
-- job) against the NIFTY 50 benchmark.
--
-- Every effect measure ships WITH its base rate, because prototyping on live
-- data (2026-07-21) showed Mercury windows are largely in line with NIFTY's
-- unconditional behavior (combust range ratio 1.005; 61% positive windows vs
-- a drifting-index base rate of about the same). The frontend renders
-- threshold-driven copy: it may only claim an effect when the measure clears
-- the base rate by a margin, otherwise it says "in line with usual". The
-- honesty lives in the schema: no base-rate column, no claim.

BEGIN;

CREATE TABLE IF NOT EXISTS km_rule_evidence (
  rule_id             INTEGER PRIMARY KEY
                      REFERENCES km_astro_rule_master(id) ON DELETE CASCADE,
  benchmark_index_id  INTEGER NOT NULL DEFAULT 1,   -- NIFTY 50

  windows_total       INTEGER NOT NULL,             -- all stored windows (1990-2030)
  windows_scored      INTEGER NOT NULL,             -- windows overlapping price history
  first_scored        DATE,
  last_scored         DATE,
  avg_window_sessions NUMERIC(6,1),

  -- Range texture: mean of (window avg daily range% / prior-60-session avg)
  range_ratio_mean    NUMERIC(6,3),
  range_expanded_n    INTEGER,                      -- windows where ratio > 1

  -- Direction texture (neutral counts, never a verdict)
  pos_close_n         INTEGER,                      -- benchmark closed higher over window
  pos_close_base_pct  NUMERIC(5,1),                 -- unconditional rate, same length
  avg_window_ret      NUMERIC(7,2),

  -- Turn texture: window contained a ±10-session swing high/low
  turn_n              INTEGER,
  turn_base_pct       NUMERIC(5,1),                 -- unconditional rate, same length

  -- VIX overlap (recent era only — series starts 2025-06)
  vix_windows         INTEGER,
  vix_up_n            INTEGER,

  last20              JSONB,                        -- same measures, most recent 20 windows
  slices              JSONB,                        -- per direction / combustion-stage cuts

  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants — same set migration 142 proved out; the decisive one is
-- `authenticated` (the DB role every logged-in browser user actually runs as).
GRANT SELECT ON km_rule_evidence TO authenticated, anon, admin, kd_readonly;
GRANT ALL    ON km_rule_evidence TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;
