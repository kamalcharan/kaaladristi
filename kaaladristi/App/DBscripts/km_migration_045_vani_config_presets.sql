-- ============================================================
-- Migration 045 · kd_vani_opportunity_config — preset routing
--
-- Extends the config table so each row declares which scanner
-- presets it applies to. Adds a separate bearish config row.
--
-- Step 1: Drop the single-active-row guard (now two rows are
--         intentionally active — one bullish, one bearish).
-- Step 2: Add applies_to_presets column.
-- Step 3: Assign presets to the existing bullish config.
-- Step 4: Insert bearish config.
-- ============================================================

-- Step 1: Drop old single-active guard
DROP INDEX IF EXISTS kd_vani_opp_config_one_active;

-- Step 2: Add applies_to_presets
ALTER TABLE kd_vani_opportunity_config
    ADD COLUMN IF NOT EXISTS applies_to_presets varchar(100)[] NOT NULL DEFAULT '{}';

-- Step 3: Update existing bullish config
UPDATE kd_vani_opportunity_config
SET applies_to_presets = '{"power_buy","smart_money","fresh_breakout","quiet_accumulation"}'
WHERE config_name = 'default';

-- Step 4: Insert bearish config
INSERT INTO kd_vani_opportunity_config
    (config_name, description, is_active, applies_to_presets, parameters)
VALUES (
    'default_bearish',
    'Standard VaNi Opportunity policy — bearish conditions',
    true,
    '{"power_sell","distribution_warning"}',
    '{
        "atr_multiplier": 1.0,
        "min_rvol": 1.2,
        "rs_zones": ["Strong Bear", "Mild Bear"],
        "flow_types": ["FRESH_SHORTS", "LONG_LIQUIDATION"],
        "min_reward_atr_multiple": 0.0
    }'
);

NOTIFY pgrst, 'reload schema';
