-- =====================================================================
-- Migration 192 — wake price on km_wg_journeys
-- Target DB: kaala_dristi_db
--
-- WHY
-- ---
-- The Discovery tabs show WHEN a journey woke (journey_age_days, "2mo")
-- but not the price it woke at, so there is no way to read from the grid
-- whether the breakout has gone anywhere.
--
-- SPARC, 2026-08-27, is the case that prompted this: wake_date 2026-07-06,
-- base_high 251.43, wake close 261.71 — and today 194.98. The tab showed
-- "2mo · 5/6 · -22.4%" with nothing saying the stock is a quarter below
-- where the journey began.
--
-- SERIES CONSISTENCY — the trap this column has to avoid
-- -----------------------------------------------------
-- km_wg_journeys.close is the RAW latest EOD close (from the display
-- join). base_high and pct_from_base_high come from a different series:
-- ISIN-merged across NSE/BSE twins and cliff-adjusted for splits and
-- bonuses (merge_isin_histories -> adjust_close_cliffs in
-- compute_wg_journeys.py). Computing "% since wake" as
-- (close - wake_close) / wake_close would mix the two and quietly
-- misreport every stock that has had a corporate action since it woke.
--
-- So wake_close is stored from the ADJUSTED series, and pct_from_wake is
-- computed inside walk_stock against the adjusted latest close — the same
-- pair pct_from_base_high already uses. The two percentages are then
-- comparable with each other, which is the whole point of showing them
-- side by side. For a stock with no corporate action the adjusted and raw
-- closes are identical, which is most of them.
-- =====================================================================

BEGIN;

ALTER TABLE km_wg_journeys
    -- Close on wake_date, from the adjusted series (see above). NULL for
    -- HIBERNATING/STIRRING rows, which have no wake_date either.
    ADD COLUMN IF NOT EXISTS wake_close     NUMERIC(12,2),
    -- (latest_adjusted_close - wake_close) / wake_close * 100.
    ADD COLUMN IF NOT EXISTS pct_from_wake  NUMERIC(10,2);

COMMENT ON COLUMN km_wg_journeys.wake_close IS
    'Close on wake_date, ADJUSTED series (ISIN-merged + cliff-adjusted) — the same series as base_high, not the raw close column.';
COMMENT ON COLUMN km_wg_journeys.pct_from_wake IS
    'Price change since the journey woke, both sides on the adjusted series. Directly comparable with pct_from_base_high.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Populate: rerun the journey compute, which rewrites km_wg_journeys whole.
--   cd App/backend && python scripts/compute_wg_journeys.py
--
-- Verify (SPARC should read wake 2026-07-06 @ 261.71):
--   SELECT symbol, state, wake_date, wake_close, close, pct_from_wake,
--          base_high, pct_from_base_high
--   FROM km_wg_journeys WHERE is_current AND symbol = 'SPARC';
