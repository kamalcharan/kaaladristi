-- ============================================================================
-- Add vendor_codes JSONB column to master tables
-- Stores vendor-specific stock codes: {"breeze": "RELIND", "bse": "500325", ...}
-- Run in Supabase SQL Editor
-- ============================================================================

ALTER TABLE km_index_symbols
    ADD COLUMN IF NOT EXISTS vendor_codes JSONB DEFAULT '{}';

ALTER TABLE km_equity_symbols
    ADD COLUMN IF NOT EXISTS vendor_codes JSONB DEFAULT '{}';

-- GIN index for fast JSONB lookups (e.g. find by breeze code)
CREATE INDEX IF NOT EXISTS idx_index_vendor_codes ON km_index_symbols USING GIN (vendor_codes);
CREATE INDEX IF NOT EXISTS idx_equity_vendor_codes ON km_equity_symbols USING GIN (vendor_codes);
