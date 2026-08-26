-- Migration 183 — week-to-date reference columns on km_equity_eod
-- Target DB: kaala_dristi_db
--
-- Backs the "Weekly Movers (WTD)" Price Action screener.
--
-- WHY COLUMNS AND NOT A MATVIEW ARM
-- The screener's condition is `close > previous week's close` — a comparison
-- between two COLUMNS. PostgREST filters compare a column to a LITERAL only
-- (see services/postgrest.ts: every filter is (column, value)), so the
-- condition is unexpressible in a direct query as-is. Precomputing it collapses
-- the filter to `pct_wtd > 0`, exactly how breakout_surge uses
-- pct_from_breakout — which is why that preset is a clean direct-query fetcher
-- while the matview family carries the column-contract bugs (see
-- docs/claude/scanner-integrity-poa.md).
--
-- DEFINITION
--   prev_week_close = the last close STRICTLY BEFORE the Monday of the row's
--                     own week. Gap-safe: if a symbol did not trade last week,
--                     this is its last available close, which is the correct
--                     reference price rather than a NULL.
--   pct_wtd         = (close - prev_week_close) / prev_week_close * 100
--
-- Both are per-row historical values (the WTD as of that bar), so they are
-- fully backfillable and stable once written.
--
-- Populated by compute_rolling_range() in indicators/compute_engine.py,
-- written by pipeline step 6g (compute_rolling_metrics_for_date) and by
-- scripts/backfill_week_to_date.py for history.

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS prev_week_close NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pct_wtd         NUMERIC(10,2);

COMMENT ON COLUMN km_equity_eod.prev_week_close IS
  'Last close strictly before the Monday of this row''s week (gap-safe). Reference price for week-to-date.';
COMMENT ON COLUMN km_equity_eod.pct_wtd IS
  'Week-to-date return %% vs prev_week_close. Filter column for the Weekly Movers screener.';

-- Partial index: the screener only ever reads pct_wtd > 0 on the latest date.
CREATE INDEX IF NOT EXISTS idx_equity_eod_pct_wtd
  ON km_equity_eod (trade_date, pct_wtd)
  WHERE pct_wtd IS NOT NULL;

NOTIFY pgrst, 'reload schema';
