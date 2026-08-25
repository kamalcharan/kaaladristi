-- ============================================================================
-- Migration 182 — Stage 2 Watch: point vani_rule at a rule that can fire
-- ============================================================================
-- The VaNi chip has never lit up on Stage 2 Watch. Not "stopped working" —
-- never, in any month of 2026:
--
--     month                Jan Feb Mar Apr May Jun Jul Aug
--     VaNi on Watch          0   0   0   0   0   0   0   0
--     VaNi on Leaders      181 165 134 137 244 358 290 348
--
-- The cause is arithmetic, not a bug. The preset filters stage='S2_CANDIDATE'
-- (approaching Stage 2, SMA200 not yet rising). Its vani_rule is is_vani_s2,
-- which the classifier only ever sets on stage='S2' (confirmed). On
-- 2026-08-24: 1,023 rows are S2 and 19 carry is_vani_s2; 447 rows are
-- S2_CANDIDATE and 0 carry it. A stock cannot be in both stages, so the rule
-- and the preset are mutually exclusive by construction.
--
-- Replacement: is_vani_smart. The tab's job is to spot which watchers will
-- convert, and institutional accumulation is the evidence for conversion.
-- Measured on the 447 S2_CANDIDATE rows of 2026-08-24, the candidates were:
--
--     is_vani_smart      6    <- chosen: accumulation behind the approach
--     is_vani_strength   5
--     is_vani_delivery   6
--     is_vani_ema20     12
--     is_vani_score22d  12
--     is_vani_overbought 12   (wrong direction for a watch list)
--     is_vani_s2         0    <- current, impossible
--
-- 6 of 447 keeps the chip selective, in line with the chips that do work
-- (power_buy flags 2 of 25, power_sell 6 of 25). A chip that fires on half
-- the list tells you nothing.
--
-- This is a judgement call on what the chip should MEAN, and it is one line
-- to change if the answer is is_vani_strength or a combination instead.
--
-- NOT fixed here: smart_money, quiet_accumulation and distribution_warning
-- have the same class of defect, but today they return 7, 8 and 2 rows —
-- squeezed by the liquidity floor migration 181 removes. Choosing a rule
-- against 2 rows would be guessing. They follow in a later migration, once
-- 181 is applied and their real row sets are visible.
--
-- Run AFTER migration 181 + REFRESH.
-- ============================================================================

UPDATE kd_scan_presets
SET vani_rule = 'is_vani_smart'
WHERE id = 'stage_2_watch' AND vani_rule = 'is_vani_s2';

-- PostgREST reads kd_scan_presets; nudge it to reload.
NOTIFY pgrst, 'reload schema';

-- Verify: expect one row, vani_rule = 'is_vani_smart'
--   SELECT id, vani_rule FROM kd_scan_presets WHERE id = 'stage_2_watch';
