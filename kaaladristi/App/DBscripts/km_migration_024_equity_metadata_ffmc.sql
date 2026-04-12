-- Migration 024: Add equity metadata columns + ffmc to EOD
--
-- km_equity_symbols gets: company_name, industry, listing_date, is_fno, is_etf
-- km_equity_eod gets: ffmc (free-float market cap)
--
-- Populated via one-time seed from NSE stock indices API.
-- ffmc captured daily going forward in EOD pipeline.

-- ── km_equity_symbols: static metadata ──────────────────────────────────────

ALTER TABLE km_equity_symbols
  ADD COLUMN IF NOT EXISTS company_name  TEXT,
  ADD COLUMN IF NOT EXISTS industry      TEXT,
  ADD COLUMN IF NOT EXISTS listing_date  DATE,
  ADD COLUMN IF NOT EXISTS is_fno        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_etf        BOOLEAN DEFAULT false;

-- Index for fast sector/industry queries
CREATE INDEX IF NOT EXISTS idx_equity_industry
  ON km_equity_symbols(industry);

-- ── km_equity_eod: daily ffmc ───────────────────────────────────────────────

ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS ffmc NUMERIC;

COMMENT ON COLUMN km_equity_symbols.company_name IS 'Full company name from NSE (e.g. HDFC Bank Limited)';
COMMENT ON COLUMN km_equity_symbols.industry     IS 'NSE industry classification (e.g. Private Sector Bank)';
COMMENT ON COLUMN km_equity_symbols.listing_date IS 'Date of listing on exchange';
COMMENT ON COLUMN km_equity_symbols.is_fno       IS 'Available in F&O segment';
COMMENT ON COLUMN km_equity_symbols.is_etf       IS 'Is an ETF';
COMMENT ON COLUMN km_equity_eod.ffmc             IS 'Free-float market cap (from NSE API)';
