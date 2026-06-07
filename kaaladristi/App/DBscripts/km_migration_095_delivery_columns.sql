-- Migration 095: Add delivery value rolling columns to km_equity_eod,
-- and lifetime_high to km_equity_weekly + km_equity_monthly.
-- Backfill SQL for all columns is in the task notes — run separately after this.

-- ── km_equity_eod ─────────────────────────────────────────────────────────
ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS avg_amt_5d        NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_amt_22d       NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_surge_x  NUMERIC;

-- d30_pct_chng and d365_pct_chng columns should already exist (audit showed 0% fill).
-- Add them if somehow missing:
ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS d30_pct_chng   NUMERIC,
  ADD COLUMN IF NOT EXISTS d365_pct_chng  NUMERIC;

-- ── km_equity_weekly ──────────────────────────────────────────────────────
ALTER TABLE km_equity_weekly
  ADD COLUMN IF NOT EXISTS lifetime_high NUMERIC;

-- ── km_equity_monthly ─────────────────────────────────────────────────────
ALTER TABLE km_equity_monthly
  ADD COLUMN IF NOT EXISTS lifetime_high NUMERIC;

-- ── Indexes for common screener filter patterns ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_km_equity_eod_delivery_surge
  ON km_equity_eod (equity_id, trade_date, delivery_surge_x)
  WHERE delivery_surge_x IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_km_equity_eod_d30
  ON km_equity_eod (equity_id, trade_date, d30_pct_chng)
  WHERE d30_pct_chng IS NOT NULL;
