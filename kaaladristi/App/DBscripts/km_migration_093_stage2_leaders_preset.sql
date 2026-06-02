-- Migration 093: Add Stage 2 Leaders scan preset to kd_scan_presets
-- Weinstein Stage 2 thesis — stocks above rising 200-SMA, above 50-SMA, not extended from 52w low

INSERT INTO kd_scan_presets (id, name, description, tooltip, sort_order, result_limit)
VALUES (
    'stage_2_leaders',
    'Stage 2 Leaders',
    'Stocks in Weinstein Stage 2 — above rising 200-SMA, above 50-SMA, not extended',
    'Stocks exhibiting classic Weinstein Stage 2 characteristics: price above a rising 200-day SMA, above 50-day SMA, not extended from 52-week low. Sorted by relative strength. Not a buy recommendation.',
    9,
    50
)
ON CONFLICT (id) DO UPDATE SET
    name         = EXCLUDED.name,
    description  = EXCLUDED.description,
    tooltip      = EXCLUDED.tooltip,
    sort_order   = EXCLUDED.sort_order,
    result_limit = EXCLUDED.result_limit;
