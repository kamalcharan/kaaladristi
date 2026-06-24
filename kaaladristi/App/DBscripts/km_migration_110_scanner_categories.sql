-- ============================================================
-- Migration 110 · Scanner preset categories + default tabs
--
-- Adds category grouping columns to kd_scan_presets so the
-- Scanner Hub can display a left-nav with grouped categories
-- and route directly to the default tab per category.
--
-- Target DB: kaala_dristi_db
-- ============================================================

ALTER TABLE kd_scan_presets
  ADD COLUMN IF NOT EXISTS category       VARCHAR(50)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS category_label VARCHAR(100) DEFAULT '',
  ADD COLUMN IF NOT EXISTS category_color VARCHAR(20)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS category_sort  INTEGER      DEFAULT 99,
  ADD COLUMN IF NOT EXISTS is_default_tab BOOLEAN      DEFAULT false;

-- ── Price Action ──────────────────────────────────────────────
UPDATE kd_scan_presets SET
  category       = 'price_action',
  category_label = 'Price Action',
  category_color = '#f59e0b',
  category_sort  = 1,
  is_default_tab = true
WHERE id = 'breakout_surge';

UPDATE kd_scan_presets SET
  category       = 'price_action',
  category_label = 'Price Action',
  category_color = '#f59e0b',
  category_sort  = 1,
  is_default_tab = false
WHERE id = 'fresh_breakout';

-- ── Stage Analysis ────────────────────────────────────────────
UPDATE kd_scan_presets SET
  category       = 'stage_analysis',
  category_label = 'Stage Analysis',
  category_color = '#22c55e',
  category_sort  = 2,
  is_default_tab = true
WHERE id = 'stage_2_watch';

UPDATE kd_scan_presets SET
  category       = 'stage_analysis',
  category_label = 'Stage Analysis',
  category_color = '#22c55e',
  category_sort  = 2,
  is_default_tab = false
WHERE id IN (
  'stage_2_leaders',
  'vani_opportunity',
  'stage_3_watch',
  'stage_4_leaders',
  'vani_exit_watch'
);

-- ── Flow ──────────────────────────────────────────────────────
UPDATE kd_scan_presets SET
  category       = 'flow',
  category_label = 'Flow',
  category_color = '#3b82f6',
  category_sort  = 3,
  is_default_tab = true
WHERE id = 'conviction_flow';

UPDATE kd_scan_presets SET
  category       = 'flow',
  category_label = 'Flow',
  category_color = '#3b82f6',
  category_sort  = 3,
  is_default_tab = false
WHERE id = 'power_buy';

-- ── Market ────────────────────────────────────────────────────
UPDATE kd_scan_presets SET
  category       = 'market',
  category_label = 'Market',
  category_color = '#8b5cf6',
  category_sort  = 4,
  is_default_tab = true
WHERE id = 'smart_money';

UPDATE kd_scan_presets SET
  category       = 'market',
  category_label = 'Market',
  category_color = '#8b5cf6',
  category_sort  = 4,
  is_default_tab = false
WHERE id IN ('quiet_accumulation', 'distribution_warning');

-- ── Parked — no category (removed from hub nav) ───────────────
UPDATE kd_scan_presets SET
  category       = '',
  category_label = '',
  is_default_tab = false
WHERE id IN ('power_sell', 'manipulation_watch');
