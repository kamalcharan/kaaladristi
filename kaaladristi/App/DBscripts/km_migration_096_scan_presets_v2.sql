-- Migration 096: Scanner v2 — add category + universe + timeframe columns to kd_scan_presets
-- These columns drive the left-nav category grouping and pill strip in Scanner v2.
-- The frontend derives its entire structure from DB — no hardcoded CATS object.

-- ── Step 1: Add new columns ────────────────────────────────────────────────

ALTER TABLE kd_scan_presets
  ADD COLUMN IF NOT EXISTS category       TEXT    NOT NULL DEFAULT 'price-action',
  ADD COLUMN IF NOT EXISTS category_label TEXT    NOT NULL DEFAULT 'Price Action',
  ADD COLUMN IF NOT EXISTS category_color TEXT    NOT NULL DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS category_sort  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS universe       TEXT    NOT NULL DEFAULT 'NSE_BSE',
  ADD COLUMN IF NOT EXISTS timeframe      TEXT    NOT NULL DEFAULT 'daily';

-- ── Step 2: Update all 9 existing rows ────────────────────────────────────

UPDATE kd_scan_presets SET
  category       = 'price-action',
  category_label = 'Price Action',
  category_color = '#3b82f6',
  category_sort  = 1,
  universe       = 'NSE_BSE',
  timeframe      = 'daily'
WHERE id = 'power_buy';

UPDATE kd_scan_presets SET
  category       = 'price-action',
  category_label = 'Price Action',
  category_color = '#3b82f6',
  category_sort  = 1,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily'
WHERE id = 'fresh_breakout';

UPDATE kd_scan_presets SET
  category       = 'price-action',
  category_label = 'Price Action',
  category_color = '#3b82f6',
  category_sort  = 1,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily'
WHERE id = 'breakout_surge';

UPDATE kd_scan_presets SET
  category       = 'price-action',
  category_label = 'Price Action',
  category_color = '#3b82f6',
  category_sort  = 1,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily'
WHERE id = 'stage_2_leaders';

UPDATE kd_scan_presets SET
  category       = 'market-activity',
  category_label = 'Market Activity',
  category_color = '#00c9a0',
  category_sort  = 2,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily'
WHERE id = 'conviction_flow';

UPDATE kd_scan_presets SET
  category       = 'market-activity',
  category_label = 'Market Activity',
  category_color = '#00c9a0',
  category_sort  = 2,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily'
WHERE id = 'smart_money';

UPDATE kd_scan_presets SET
  category       = 'market-activity',
  category_label = 'Market Activity',
  category_color = '#00c9a0',
  category_sort  = 2,
  universe       = 'NSE_ONLY',
  timeframe      = 'daily'
WHERE id = 'quiet_accumulation';

UPDATE kd_scan_presets SET
  category       = 'bear',
  category_label = 'Bear Signals',
  category_color = '#f43f5e',
  category_sort  = 3,
  universe       = 'NSE_BSE',
  timeframe      = 'daily'
WHERE id = 'power_sell';

UPDATE kd_scan_presets SET
  category       = 'bear',
  category_label = 'Bear Signals',
  category_color = '#f43f5e',
  category_sort  = 3,
  universe       = 'NSE_BSE',
  timeframe      = 'daily'
WHERE id = 'distribution_warning';

-- ── Verify ────────────────────────────────────────────────────────────────

-- SELECT id, name, category, category_label, universe, timeframe, sort_order
-- FROM kd_scan_presets
-- ORDER BY category_sort, sort_order;
