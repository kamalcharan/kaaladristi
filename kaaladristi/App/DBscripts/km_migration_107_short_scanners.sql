-- km_migration_107_short_scanners.sql
-- Target DB: kaala_dristi_db
-- Adds 3 weakness/short-side scanner presets to kd_scan_presets.

INSERT INTO kd_scan_presets
  (id, name, description, tooltip, result_limit,
   universe, timeframe, category, category_label,
   category_color, category_sort, vani_rule, is_active)
VALUES
  (
    'stage_4_leaders',
    'Stage 4 Leaders',
    'Stocks in confirmed downtrend — below SMA50 and SMA200, death cross confirmed.',
    'Death cross confirmed: close < SMA50 < SMA200. Sorted by RS percentile ascending (weakest first).',
    200,
    'NSE_ONLY',
    'daily',
    'weakness',
    'Weakness',
    '#EF4444',
    20,
    'is_vani_weakness',
    true
  ),
  (
    'stage_3_watch',
    'Stage 3 Watch',
    'Stocks entering weakness — above SMA200 but SMA50 converging downward. Watch for Stage 4 breakdown.',
    'SMA50 within 15% of SMA200 and narrowing. Early warning system.',
    100,
    'NSE_ONLY',
    'daily',
    'weakness',
    'Weakness',
    '#EF4444',
    21,
    'is_vani_weakness',
    true
  ),
  (
    'vani_exit_watch',
    'VaNi Exit Watch',
    'Highest conviction weakness — death cross confirmed with lowest RS momentum. Exit or hedge candidates.',
    'Stage 4 + RS percentile <20 + death cross. Bottom 25 by RS rank. Not a sell recommendation.',
    25,
    'NSE_ONLY',
    'daily',
    'weakness',
    'Weakness',
    '#EF4444',
    22,
    'always_true',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT id, name, vani_rule, category
FROM kd_scan_presets
WHERE category = 'weakness'
ORDER BY category_sort;
