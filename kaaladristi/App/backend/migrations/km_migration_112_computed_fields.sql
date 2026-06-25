-- Migration 112 — add computed scanner fields to km_equity_eod
-- Target DB: kaala_dristi_db
-- Populated nightly by compute_rolling_range() in compute_engine.py (pipeline step 6g)
-- and on backfill by scripts/backfill_rolling_metrics.py

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS ret_5d             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS ret_22d            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS ret_66d            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS breakout_level     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pct_from_breakout  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pct_below_52w_high NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deliv_value_cr     NUMERIC(14,4);
