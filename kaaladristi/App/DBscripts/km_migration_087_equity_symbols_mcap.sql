-- ============================================================
-- Migration 087 · Add mcap_cr to km_equity_symbols
--
-- Adds market-cap column (in Crores) to the equity master.
-- After applying, the scanner will populate mcap_cr in scan
-- results and XLS exports.
-- Populate via your data source or pipeline once the column exists.
-- ============================================================

BEGIN;

ALTER TABLE km_equity_symbols
  ADD COLUMN IF NOT EXISTS mcap_cr NUMERIC;

COMMENT ON COLUMN km_equity_symbols.mcap_cr IS 'Market capitalisation in Indian Crores (₹ Cr)';

COMMIT;
