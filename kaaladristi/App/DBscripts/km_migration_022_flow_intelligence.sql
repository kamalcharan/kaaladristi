-- ============================================================
-- Migration 022 · Flow Intelligence Columns
-- Adds: flow_type, vacuum_flag, accum_distrib to EOD tables
-- These are derived from existing indicator columns:
--   flow_type:     MagicRS zone + price direction + RVOL
--   vacuum_flag:   price moving on declining volume
--   accum_distrib: below/above Golden Line + high RVOL + momentum
-- ============================================================

-- ── Index EOD ──────────────────────────────────────────────
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS flow_type TEXT;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS vacuum_flag TEXT;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS accum_distrib TEXT;

-- ── Equity EOD ─────────────────────────────────────────────
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS flow_type TEXT;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS vacuum_flag TEXT;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS accum_distrib TEXT;

-- ── Comments ───────────────────────────────────────────────
COMMENT ON COLUMN km_index_eod.flow_type IS
  'Order flow classification: FRESH_LONGS | SHORT_COVERING | FRESH_SHORTS | LONG_LIQUIDATION | MIXED | LOW_VOLUME';
COMMENT ON COLUMN km_index_eod.vacuum_flag IS
  'Vacuum move detection: VACUUM_UP | VACUUM_DOWN | NULL (none)';
COMMENT ON COLUMN km_index_eod.accum_distrib IS
  'Accumulation/Distribution: ACCUMULATION | DISTRIBUTION | NULL (none)';

COMMENT ON COLUMN km_equity_eod.flow_type IS
  'Order flow classification: FRESH_LONGS | SHORT_COVERING | FRESH_SHORTS | LONG_LIQUIDATION | MIXED | LOW_VOLUME';
COMMENT ON COLUMN km_equity_eod.vacuum_flag IS
  'Vacuum move detection: VACUUM_UP | VACUUM_DOWN | NULL (none)';
COMMENT ON COLUMN km_equity_eod.accum_distrib IS
  'Accumulation/Distribution: ACCUMULATION | DISTRIBUTION | NULL (none)';

NOTIFY pgrst, 'reload schema';
