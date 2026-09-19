-- ============================================================================
-- km_migration_219_magic_rs_momentum.sql
-- Target DB: kaala_dristi_db
--
-- MagicRS momentum on the HOUSE CLOCK: 5 / 22 / 66 bars, on km_equity_eod.
--
-- WHY THIS EXISTS
-- ---------------
-- MagicRS momentum is real, is already on screen, and is invisible to
-- everything except one chart widget. `MagicRsSubchart` derives 1/5/20-bar
-- changes in the browser from whatever bars the chart happens to have loaded.
-- No scanner can filter on it, no SQL can rank by it, and VaNi cannot be told
-- about it -- because it is not stored anywhere.
--
-- The Pine source defines the measure (magicRS.txt, "5-Bar Momentum"):
--
--     momentum_direction = magicrs_value > magicrs_value[5]
--     momentum_strength  = math.abs(magicrs_value - magicrs_value[5])
--
-- Note it is a POINT DIFFERENCE, not a percent change. magic_rs is already a
-- percentage deviation ( ((rs / SMA(rs,144)) - 1) * 100 ), so a percent change
-- of a percent is not a quantity anyone can read. `diff`, never `pct_change`.
--
-- WHY 5 / 22 / 66 AND NOT 1 / 5 / 20
-- ----------------------------------
-- Owner decision. Every other horizon in this database is 5/22/66 bars on the
-- daily table -- ret_5d/22d/66d (close.pct_change(5|22|66) in
-- indicators/compute_engine.py), avg_amt_5d/22d/66d, rel_*_n50, rel_*_n500,
-- score_5d/22d, avg_ret_* on km_industry_eod. MagicRS was the one measure
-- speaking a different dialect (1/5/20, labelled "1D/1W/1M").
--
-- ⚠ THIS IS NOT THE PINE MULTI-TIMEFRAME SCORE, AND MUST NOT BE LABELLED AS IT
-- ----------------------------------------------------------------------------
-- luckypop.txt's calculateStrengthPoints() scores 6/3/1 across three CHART
-- TIMEFRAMES, and which three depends on the chart you are standing on:
--
--     <= 60 min   ->  15m / 60m / D
--     <= 1440 min ->  60m / D  / W          <-- a DAILY chart asks for this
--     >  1440 min ->  D   / W  / M
--
-- We are EOD. The 60m leg does not exist (km_equity_15m is schema-only), and
-- the D/W/M branch cannot be substituted: km_equity_monthly.magic_rs is NULL
-- for every row and structurally always will be -- the long measure needs 145
-- monthly bars (~12 years) and the deepest symbol holds 80. Migration 169's
-- header states this outright. Monthly carries magic_rs_short only, which is a
-- different measure (21-bar RS, 10-bar MA) and cannot be mixed into one score.
--
-- So `magic_rs_align` below is THREE LOOKBACKS ON ONE DAILY SERIES, scored
-- 0-3. It is the honest EOD adaptation of that idea, not a port of it. Do not
-- rename it to "strength points" and do not score it 6/3/1 -- that would claim
-- a timeframe agreement this data cannot support.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- --------------------------------------------
--   * It does NOT touch km_scan_results. rs_percentile -- the closest
--     precedent, another column ranked off magic_rs -- is not in the matview
--     either; it is read by direct PostgREST selects on km_equity_eod. So
--     there is no 17-arm edit here and NO REFRESH is required. (Migration 218
--     hid three defects that only surfaced on execution; the matview machinery
--     is worth avoiding when a column does not need it.)
--   * It changes NO existing value. magic_rs, magic_ma, magic_rs_zone,
--     flow_type and every vani flag are untouched. No scanner's membership or
--     ordering moves. This is purely additive.
--   * It does NOT add the ATR adaptive zone threshold. That was measured on
--     2026-09-18 and deliberately declined -- see CLAUDE.md "MagicRS".
--
-- OWNER RUNS THIS IN pgAdmin. ADD COLUMN nullable-no-default is instant even on
-- 13.2M rows. Values are NULL until the pipeline2 `magic_rs_momentum` dimension
-- runs (nightly), or until the one-shot backfill:
--     cd App/backend && python scripts/compute_magic_rs_momentum.py --all
-- ============================================================================

BEGIN;

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 1. Columns                                                 ║
-- ╚════════════════════════════════════════════════════════════╝

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS magic_rs_chg_5d   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_chg_22d  NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_chg_66d  NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_align    SMALLINT;

COMMENT ON COLUMN km_equity_eod.magic_rs_chg_5d IS
  'magic_rs minus magic_rs 5 BARS ago, in points. Point difference, not percent '
  '- magic_rs is already a percentage deviation. NULL when either end is NULL.';
COMMENT ON COLUMN km_equity_eod.magic_rs_chg_22d IS
  'magic_rs minus magic_rs 22 bars ago, in points.';
COMMENT ON COLUMN km_equity_eod.magic_rs_chg_66d IS
  'magic_rs minus magic_rs 66 bars ago, in points.';
COMMENT ON COLUMN km_equity_eod.magic_rs_align IS
  'How many of chg_5d/22d/66d are > 0, scored 0-3. NULL unless ALL THREE are '
  'measurable - "2 of 3 rising" with the third unmeasured is a different claim '
  'from "2 of 3 rising, 1 falling", and a score that silently conflates them '
  'is the stir_days denominator mistake. NOT the Pine 6/3/1 timeframe score.';

-- Supports "rising on all three horizons" screens without scanning the day.
CREATE INDEX IF NOT EXISTS idx_equity_eod_magic_rs_align
  ON km_equity_eod (trade_date, magic_rs_align)
  WHERE magic_rs_align IS NOT NULL;

-- ╔════════════════════════════════════════════════════════════╗
-- ║ 2. compute_magic_rs_momentum(from, to)                     ║
-- ╚════════════════════════════════════════════════════════════╝
--
-- NULL SEMANTICS, and why they must stay exactly this:
--   LAG(magic_rs, N) takes the Nth prior ROW's value, which may itself be
--   NULL. A NULL at either end yields a NULL change -- "there was no reading
--   N bars ago" is not the same as "no change", and must never read as 0.
--   This mirrors the frontend's `data[idx - N]?.magic_rs` exactly, so the
--   stored column and the chart cannot disagree about what a gap means.
--
-- WARM-UP:
--   p_from - 400 calendar days is a LOADER bound for cost only (~275 trading
--   bars against the 66 needed). It is NOT what decides correctness: LAG
--   returns NULL when the history is not there, so an under-sized window
--   produces NULL, never a wrong number. The verification block at the tail
--   proves the bound is generous enough on live data. Sizing a warm-up in
--   calendar days without that proof is the migration-169 failure.

CREATE OR REPLACE FUNCTION compute_magic_rs_momentum(
  p_from DATE,
  p_to   DATE DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_to      DATE := COALESCE(p_to, p_from);
  v_floor   DATE := p_from - 400;
  v_updated INT;
BEGIN
  WITH lagged AS (
    SELECT e.id, e.trade_date, e.magic_rs,
           LAG(e.magic_rs,  5) OVER w AS mrs_5,
           LAG(e.magic_rs, 22) OVER w AS mrs_22,
           LAG(e.magic_rs, 66) OVER w AS mrs_66
    FROM km_equity_eod e
    WHERE e.trade_date >= v_floor
      AND e.trade_date <= v_to
    WINDOW w AS (PARTITION BY e.equity_id ORDER BY e.trade_date)
  ),
  calc AS (
    SELECT l.id,
           CASE WHEN l.magic_rs IS NOT NULL AND l.mrs_5  IS NOT NULL
                THEN round((l.magic_rs - l.mrs_5)::numeric,  4) END AS c5,
           CASE WHEN l.magic_rs IS NOT NULL AND l.mrs_22 IS NOT NULL
                THEN round((l.magic_rs - l.mrs_22)::numeric, 4) END AS c22,
           CASE WHEN l.magic_rs IS NOT NULL AND l.mrs_66 IS NOT NULL
                THEN round((l.magic_rs - l.mrs_66)::numeric, 4) END AS c66
    FROM lagged l
    WHERE l.trade_date >= p_from
  ),
  scored AS (
    SELECT c.id, c.c5, c.c22, c.c66,
           CASE WHEN c.c5 IS NOT NULL AND c.c22 IS NOT NULL AND c.c66 IS NOT NULL
                THEN ((c.c5  > 0)::int
                    + (c.c22 > 0)::int
                    + (c.c66 > 0)::int)::smallint
           END AS align
    FROM calc c
  )
  UPDATE km_equity_eod e
     SET magic_rs_chg_5d  = s.c5,
         magic_rs_chg_22d = s.c22,
         magic_rs_chg_66d = s.c66,
         magic_rs_align   = s.align
    FROM scored s
   WHERE e.id = s.id
     -- Skip no-op writes: on a re-run most rows already hold these values, and
     -- rewriting 13.2M unchanged rows costs a full table's worth of dead tuples.
     AND (e.magic_rs_chg_5d  IS DISTINCT FROM s.c5
       OR e.magic_rs_chg_22d IS DISTINCT FROM s.c22
       OR e.magic_rs_chg_66d IS DISTINCT FROM s.c66
       OR e.magic_rs_align   IS DISTINCT FROM s.align);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION compute_magic_rs_momentum(DATE, DATE) IS
  'Writes magic_rs_chg_5d/22d/66d + magic_rs_align for [p_from, p_to]. '
  'Point differences over 5/22/66 BARS (the house clock), never percent '
  'changes. Called per-date by the pipeline2 magic_rs_momentum dimension and '
  'over ranges by scripts/compute_magic_rs_momentum.py.';

COMMIT;

-- ============================================================================
-- VERIFICATION -- run these after the migration, before trusting the column.
-- ============================================================================
--
-- 1. Compute the latest bar and confirm it wrote something:
--
--      SELECT compute_magic_rs_momentum((SELECT max(trade_date) FROM km_equity_eod));
--
-- 2. Fill rate on that bar. chg_5d should sit just under rs_percentile's rate
--    (it needs 5 more bars on a series that already needs 145):
--
--      SELECT count(*)                          AS rows,
--             count(magic_rs)                   AS with_rs,
--             count(magic_rs_chg_5d)            AS c5,
--             count(magic_rs_chg_22d)           AS c22,
--             count(magic_rs_chg_66d)           AS c66,
--             count(magic_rs_align)             AS align
--      FROM km_equity_eod
--      WHERE trade_date = (SELECT max(trade_date) FROM km_equity_eod);
--
-- 3. ⚠ THE ONE THAT MATTERS -- proves the 400-day loader bound is generous
--    enough. Counts rows that HAVE a magic_rs and 66+ prior magic_rs bars but
--    got no chg_66d anyway. That can only mean the warm-up was starved. It
--    must be 0; if it is not, raise the 400 in v_floor and re-run.
--
--      WITH d AS (
--        SELECT equity_id, trade_date, magic_rs, magic_rs_chg_66d,
--               count(magic_rs) OVER (PARTITION BY equity_id ORDER BY trade_date
--                                     ROWS BETWEEN 66 PRECEDING AND CURRENT ROW) AS rs_bars
--        FROM km_equity_eod
--        WHERE trade_date >= (SELECT max(trade_date) - 400 FROM km_equity_eod)
--      )
--      SELECT count(*) AS starved_rows
--      FROM d
--      WHERE trade_date = (SELECT max(trade_date) FROM km_equity_eod)
--        AND magic_rs IS NOT NULL AND rs_bars = 67 AND magic_rs_chg_66d IS NULL;
--
-- 4. Sanity: align must be 0-3 and never present without all three parts.
--
--      SELECT count(*) AS bad_align
--      FROM km_equity_eod
--      WHERE trade_date = (SELECT max(trade_date) FROM km_equity_eod)
--        AND magic_rs_align IS NOT NULL
--        AND (magic_rs_chg_5d IS NULL OR magic_rs_chg_22d IS NULL
--             OR magic_rs_chg_66d IS NULL OR magic_rs_align NOT BETWEEN 0 AND 3);
--
-- 5. Full history (slow -- run once, off-hours, NOT through the read-only MCP):
--
--      cd App/backend && python scripts/compute_magic_rs_momentum.py --all
-- ============================================================================
