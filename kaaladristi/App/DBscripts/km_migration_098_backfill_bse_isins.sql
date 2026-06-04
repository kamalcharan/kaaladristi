-- Migration 098: Backfill missing ISINs for BSE stocks that have NSE equivalents
-- Matches on LOWER(company_name) — exact match only (safe, no false positives).
-- Run on kaala_dristi_db.

-- 1. Diagnostic: how many BSE stocks are missing ISIN?
-- SELECT COUNT(*) FROM km_equity_symbols WHERE exchange = 'BSE' AND isin IS NULL;

-- 2. How many can be matched to an NSE peer by company_name?
-- SELECT COUNT(*) FROM km_equity_symbols b
-- JOIN km_equity_symbols n ON LOWER(n.company_name) = LOWER(b.company_name)
--   AND n.exchange = 'NSE' AND n.isin IS NOT NULL
-- WHERE b.exchange = 'BSE' AND b.isin IS NULL;

-- 3. Apply the backfill
UPDATE km_equity_symbols b
SET isin = n.isin
FROM km_equity_symbols n
WHERE b.exchange   = 'BSE'
  AND b.isin       IS NULL
  AND n.exchange   = 'NSE'
  AND n.isin       IS NOT NULL
  AND LOWER(n.company_name) = LOWER(b.company_name);

-- 4. Verify remaining gaps
-- SELECT COUNT(*) AS still_missing
-- FROM km_equity_symbols
-- WHERE exchange = 'BSE' AND isin IS NULL;
