-- =====================================================================
-- km_migration_172_shares_outstanding.sql
-- Target database: kaala_dristi_db
-- Waking Giants / First Ascent — permanent market-cap freshness
-- =====================================================================
-- mcap_cr was populated once by scripts/populate_mcap.py (NSE quote API,
-- since 403-blocked at the TLS-fingerprint layer) and then froze: the
-- stored values age with every price move, and the ~2,100 newly-admitted
-- full-universe symbols never got one at all — 725 of the Giants age-pool
-- and 146 of First Ascent carry NULL mcap_cr and would be silently
-- excluded by the ₹200 Cr gate.
--
-- New model (mcap = shares × price, decomposed by how fast each part moves):
--   shares_outstanding — slow-moving (changes only on QIP/bonus/buyback).
--                        Refreshed from Yahoo on a rolling ~45-day cadence
--                        by scripts/enrich_equity_metadata.py.
--   shares_updated_at  — date of the last Yahoo shares lookup ATTEMPT
--                        (hit or miss) — drives the rolling cadence and
--                        stops misses from being retried every night.
--   mcap_cr            — recomputed daily in the pipeline as
--                        shares_outstanding × latest close / 1e7.
--                        One SQL UPDATE, zero API calls, always current.

ALTER TABLE km_equity_symbols
  ADD COLUMN IF NOT EXISTS shares_outstanding BIGINT,
  ADD COLUMN IF NOT EXISTS shares_updated_at  DATE;

COMMENT ON COLUMN km_equity_symbols.shares_outstanding IS
  'Total shares outstanding (Yahoo sharesOutstanding). Slow-moving; refreshed on a ~45-day rolling cadence by enrich_equity_metadata.py.';
COMMENT ON COLUMN km_equity_symbols.shares_updated_at IS
  'Date of last Yahoo shares lookup attempt (hit or miss). Drives the rolling refresh; NULL = never attempted.';
