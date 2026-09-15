-- ============================================================================
-- km_migration_211_journey_stir_window.sql
-- Target DB: kaala_dristi_db
--
-- Two columns on km_wg_journeys so the Stirring reading can state a rate WITH
-- its denominator, and one deliberate NON-column.
--
-- THE NON-COLUMN: there is no `stir_start_date`, and there must not be
-- ------------------------------------------------------------------------
-- The thesis-events plan called for `stir_start_date` -- "the one genuinely
-- missing Discovery field... the scanner built for EARLY detection cannot say
-- when it began". The premise does not survive contact with the data.
--
-- `stir_days` is a TALLY, not a run length: stir_days_map() counts qualifying
-- bars inside the last 60 sessions, and those bars are scattered. Measured
-- across all 1,048 stirring stocks on 2026-09-14:
--
--     9.4 qualifying bars, spread over a 41.3-bar span
--     29 of 1,048 (2.8%) are a contiguous run
--
-- So "stirring since 12 June" would be false for 97% of the population -- it
-- reads as three months of continuous stirring over what is really nine
-- scattered sessions. A field name that implies continuity over a scattered
-- tally is a lie told by the schema, and no amount of careful UI copy
-- undoes it.
--
-- WHAT IS HONEST
-- --------------
--   stir_first_date   the EARLIEST qualifying bar in the window
--   stir_window_bars  how many bars the tally was measured over
--
-- Together with the existing stir_days they say "9 qualifying sessions since
-- 12 June, out of 41" -- a rate carrying its denominator, the same rule
-- km_journey_base_rates enforces for confirmation frequency. Never render
-- stir_first_date on its own; that reconstructs the very claim this migration
-- refuses to store.
--
-- Both are NULL on archived rows on purpose: stirring is measured over the
-- last 60 sessions, so it is a property of NOW with no meaning on a closed arc.
--
-- NOT IN THIS MIGRATION, because no schema change was needed
-- ---------------------------------------------------------
-- `turn_date`, `turn_close` and `gl_dist_pct` already exist as columns. They
-- were simply never WRITTEN on archive -- 560 current rows carried a turn and
-- 0 archived rows did, so on a closed journey you could never see where the
-- turn was. compute_wg_journeys.py now records each arc's own turn, computed
-- by the same turn_at() the live snapshot uses (at the arc's WAKE bar, because
-- by its sleep bar the stock has usually lost the Golden Line -- frequently
-- the reason it slept -- and asking there would return NULL for exactly the
-- journeys worth inspecting). That ships with the script, not with SQL.
--
-- ADD COLUMN nullable-no-default on ~1,700 rows is metadata-only and instant.
-- Values appear on the next wg_journeys run; no backfill script, nothing to
-- REFRESH. Owner runs this in pgAdmin.
-- ============================================================================

BEGIN;

ALTER TABLE public.km_wg_journeys
  ADD COLUMN IF NOT EXISTS stir_first_date  DATE,
  ADD COLUMN IF NOT EXISTS stir_window_bars SMALLINT;

COMMENT ON COLUMN public.km_wg_journeys.stir_first_date IS
  'Earliest qualifying bar of the stirring TALLY, not the start of a run -- '
  'the qualifying bars are scattered (9.4 across a 41.3-bar span; 2.8% '
  'contiguous). Render only alongside stir_days and stir_window_bars. '
  'NULL on archived rows: stirring is a property of the last 60 sessions.';

COMMENT ON COLUMN public.km_wg_journeys.stir_window_bars IS
  'Bars the stirring tally was measured over -- the DENOMINATOR for '
  'stir_days. Fewer than 60 for a recent listing, which must not report a '
  'window it never had.';

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
-- Both columns read NULL until the next wg_journeys run. Afterwards:
--
--   SELECT count(*) FILTER (WHERE stir_days > 0)            AS stirring,
--          count(*) FILTER (WHERE stir_first_date IS NOT NULL) AS dated,
--          round(avg(stir_days)     FILTER (WHERE stir_days > 0), 1) AS avg_days,
--          round(avg(stir_window_bars) FILTER (WHERE stir_days > 0), 1) AS avg_window
--   FROM km_wg_journeys WHERE is_current;
--     -- stirring and dated must match; avg_days should sit near 9 and
--     -- avg_window near 41 on a population like 2026-09-14's.
--
--   SELECT count(*) FILTER (WHERE turn_date IS NOT NULL) AS archived_with_turn
--   FROM km_wg_journeys WHERE NOT is_current;
--     -- was 0 before the script change; should be non-zero after.
