-- km_migration_154_flower_pot_burst_scan.sql
-- Target DB: kaala_dristi_db
--
-- C1 (2026-07-14): register the "Flower Pot Burst" scanner preset.
--
-- Flower Pot Burst is an energy compression → release scan. Two phases surface
-- together in the results:
--   SETUP  — stocks coiling now (ATR contracting, 10-day range < 8%, volume
--            dying, MagicRS flat). The watchlist.
--   BURST  — the rare session (~2x/month across NSE) when an active coil
--            releases: 3x+ volume, 2x+ range expansion, strong close, breaking
--            the 10-day range on real delivery.
--
-- All compute is client-side TypeScript in scanEngine.ts (fetchFlowerPotBurst),
-- with its own on-demand 60-session fetch — it does NOT use the shared scanner
-- bundle and adds no columns to km_equity_eod. Thresholds are calibrated to the
-- live NSE distribution (the spec's ATR15/ATR60 < 0.5 gate fired for only 12 of
-- 1,232 stocks; the calibrated 0.8 gate yields ~4 coiling / 37 active per day).
--
-- The scanner tab list is built from `kd_scan_presets WHERE is_active = true`
-- (pipeline2_api.py GET /api/scan/presets). Inserting this row shows the tab.

INSERT INTO kd_scan_presets
  (id, name, description, tooltip,
   sort_order, result_limit, is_active,
   category, category_label, category_color, category_sort,
   universe, timeframe, vani_rule, is_default_tab)
VALUES
  ('flower_pot_burst',
   'Flower Pot Burst',
   'Stocks coiling in tight compression — dying volume, contracting range — plus the rare session when a coil releases with an explosive volume-and-range expansion',
   'Energy compression then release. Watchlist = coiling setups; Burst = a coil that just released today. Observational — not a trade instruction.',
   9, 60, true,
   'price_action', 'Price Action', '#f59e0b', 1,
   'NSE_ONLY', 'daily', NULL, false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    tooltip = EXCLUDED.tooltip,
    sort_order = EXCLUDED.sort_order,
    result_limit = EXCLUDED.result_limit,
    is_active = EXCLUDED.is_active,
    category = EXCLUDED.category,
    category_label = EXCLUDED.category_label,
    category_color = EXCLUDED.category_color,
    category_sort = EXCLUDED.category_sort,
    universe = EXCLUDED.universe,
    timeframe = EXCLUDED.timeframe,
    is_default_tab = EXCLUDED.is_default_tab,
    updated_at = now();

-- Verify: should return the flower_pot_burst row, is_active = true.
-- SELECT id, name, is_active, category_sort, sort_order FROM kd_scan_presets WHERE id = 'flower_pot_burst';
