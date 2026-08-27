-- =====================================================================
-- Migration 191 — stage entry date / price on km_equity_eod
-- Target DB: kaala_dristi_db
--
-- WHAT
-- ----
-- "When did this stock enter its stage, and at what price" as sortable
-- scanner fields, instead of only being readable off the Story View's
-- regime bands.
--
-- WHY THE RAW `stage` COLUMN IS NOT ENOUGH
-- ----------------------------------------
-- `stage` is stamped per bar and is DENSE (every classified bar back to
-- 1996), so the entry date looks like a simple "start of the current
-- contiguous run". It is not: the label flickers hard around the 200-SMA.
-- Measured 2026-08-27 over 120 symbols x 20 months: 3,161 runs, of which
-- 1,644 (52%) last 3 bars or fewer and 914 last a single bar. BOSCHLTD
-- alone printed 37 runs in 20 months, most of them 1-2 bars.
--
-- Taken raw, that yields dates that are technically true and practically
-- useless: ABB reads "Stage 2 since 2026-07-15 @ 7,204.50" (+5.6%) when
-- the turn a chart reader would mark is 2026-03-04 @ 5,830.50 (+30.5%).
--
-- THE DEFINITION STORED HERE
-- --------------------------
-- A stage becomes CONFIRMED only once it has held STAGE_MIN_SPELL = 10
-- bars (~2 weeks). Shorter spells do not reset the clock -- they inherit
-- the previous confirmed stage. Once confirmed, the entry is backdated to
-- the FIRST bar of that raw run, which is the date the turn actually
-- happened.
--
-- 10 bars was chosen on the run-length distribution (60 symbols, 4.5y,
-- 3,582 runs): >=5 keeps 1,515, >=10 keeps 942, >=15 keeps 700, >=20
-- keeps 543. Ten discards three quarters of the noise while still
-- confirming a fresh Stage 2 inside a fortnight; twenty would delay every
-- new entry by a month. The constant lives in
-- scripts/backfill_stage_entry.py -- retuning it means re-running the
-- backfill, not editing this file.
--
-- The rule is CAUSAL: a spell confirms on its 10th bar using only bars up
-- to that point, so the nightly increment and a full-history rebuild
-- agree on every row. No look-ahead.
--
-- CONSEQUENCE TO EXPECT, NOT A BUG
-- --------------------------------
-- stage_confirmed can differ from `stage` when a stock has just flipped
-- and the new label has not held 10 bars yet. Measured on a random 60
-- symbols: 49 agree, 9 differ, 2 have never confirmed any stage. The
-- disagreement is the informative case -- it says the flip is days old --
-- so the UI shows both rather than hiding one.
--
-- UNKNOWN and NULL bars are excluded from the walk. Both mean the same
-- thing (`stage = 'UNKNOWN'` is set where sma_200 IS NULL): not
-- classifiable. A stock cannot be "in" them.
--
-- stage_since_censored marks a spell whose entry bar is the symbol's
-- FIRST classified bar -- the stock may well have entered the stage
-- earlier, before the 200-SMA existed, and the date is a floor, not the
-- truth. 63 of a random 200 symbols have stage starting later than their
-- first bar, so this is common enough to need its own flag rather than a
-- footnote.
--
-- NO NEW INDEX. The scanners already filter km_equity_eod by trade_date;
-- these are additional columns on rows they already select, and an index
-- build on a table this size would cost far more than it returns.
-- =====================================================================

BEGIN;

ALTER TABLE km_equity_eod
    -- The de-flickered stage. Compare with `stage` (raw, unchanged).
    ADD COLUMN IF NOT EXISTS stage_confirmed      VARCHAR(16),
    -- First bar of the raw run that opened the current confirmed spell.
    ADD COLUMN IF NOT EXISTS stage_since          DATE,
    -- Close on that bar.
    ADD COLUMN IF NOT EXISTS stage_since_close    NUMERIC(12,2),
    -- Bars held since stage_since, inclusive. Bars, not calendar days --
    -- calendar days over a holiday stretch overstate how much trading
    -- the stage has actually survived.
    ADD COLUMN IF NOT EXISTS stage_bars           INTEGER,
    -- (close - stage_since_close) / stage_since_close * 100.
    ADD COLUMN IF NOT EXISTS pct_from_stage_entry NUMERIC(10,2),
    -- INTERNAL: length of the current RAW run ending on this bar. Carried
    -- so the nightly step is O(1) per symbol -- it can decide "does today
    -- extend the run, and has the run now reached 10 bars" from yesterday's
    -- row instead of re-walking history every night.
    ADD COLUMN IF NOT EXISTS stage_run_bars       INTEGER,
    -- TRUE when stage_since is the symbol's first classified bar, i.e. the
    -- real entry is unknown and this date is a lower bound.
    ADD COLUMN IF NOT EXISTS stage_since_censored BOOLEAN;

COMMENT ON COLUMN km_equity_eod.stage_confirmed IS
    'De-flickered stage: the raw stage label once it has held 10 bars. Differs from stage when a flip is fresh.';
COMMENT ON COLUMN km_equity_eod.stage_since IS
    'First bar of the raw run that opened the current confirmed spell. NULL when no stage has ever confirmed.';
COMMENT ON COLUMN km_equity_eod.stage_since_close IS
    'Close on stage_since. Raw bhavcopy close -- NOT adjusted for splits/bonuses (km_corporate_actions is empty), so pct_from_stage_entry across a corporate action is not a real return.';
COMMENT ON COLUMN km_equity_eod.stage_since_censored IS
    'TRUE when stage_since is the symbol''s first classified bar -- the entry is a floor, not the truth.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Populate (run AFTER commit; symbol-batched, resumable):
--   cd App/backend && python scripts/backfill_stage_entry.py
--
-- Verify:
--   SELECT stage, stage_confirmed, count(*)
--   FROM km_equity_eod WHERE trade_date = '2026-08-26'
--   GROUP BY 1,2 ORDER BY 3 DESC;
--   -- expect the diagonal to dominate, with a minority off it (fresh flips)
--
--   SELECT count(*) FILTER (WHERE stage_since IS NULL) AS no_confirmed_stage,
--          count(*) FILTER (WHERE stage_since_censored) AS censored
--   FROM km_equity_eod WHERE trade_date = '2026-08-26' AND stage NOT IN ('UNKNOWN');
