-- km_migration_159_vani_cache_grants_breakout_tooltip.sql
-- Target database: kaala_dristi_db
--
-- Part 1 — km_vani_cache grants (BUG: persistent VaNi cache never worked).
-- Migration 038 created km_vani_cache but granted only kd_readonly SELECT.
-- The FastAPI backend reads/writes it through PostgREST as kd_app, so every
-- get_cached() and set_cached() silently failed (the lib catches + warns) and
-- each "What does this screener show?" ask fell through to the LLM instead of
-- serving the cached explainer. Same missing-grant landmine as migration 142.

GRANT SELECT, INSERT, UPDATE, DELETE ON km_vani_cache TO kd_app;

-- Part 2 — Breakout Surge tooltip correction. The scan queries the FULL
-- equity universe (NSE + BSE), ISIN-dedups preferring NSE for dual listings,
-- and only then applies the user's exchange filter — so "NSE universe" was
-- factually wrong (BSE-only listings appear under the combined filter).

UPDATE kd_scan_presets SET
  tooltip    = 'Match: close above the highest close of the prior 20 sessions + green day + price ≥ ₹50. NSE + BSE combined (NSE preferred for dual listings) — use the exchange tabs or MCap filter to narrow. Ranked by Score 5D (money-flow conviction).',
  updated_at = NOW()
WHERE id = 'breakout_surge';

NOTIFY pgrst, 'reload schema';
