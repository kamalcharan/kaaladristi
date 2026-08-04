-- =============================================================================
-- Migration 168 — Volume Drive scan preset
-- Target database: kaala_dristi_db
-- =============================================================================
--
-- Registers the 'volume_drive' preset consumed by fetchVolumeDrive() in
-- scanEngine.ts. The scan selects on dot_svd / dot_sbd, which are rebuilt
-- nightly by scripts/compute_dots.py from the owner's Chartink screener
-- definitions. Those columns were all-FALSE universe-wide from 2026-04-06 until
-- compute_dots.py landed, so this preset is inert unless that script runs.
--
-- WHY THIS PRESET EXISTS
-- ----------------------
-- Measured over 2026-05-01..2026-08-03, NSE, close >= 10, against a next-day
-- >= 10% move (base rate 0.686%):
--
--     signal on day T                      n      P(move T+1)    lift
--     ------------------------------  ------   ------------   -----
--     dot_svd AND delivery_pct >= 50      59         23.73%    34.6x
--     dot_svd                            462          7.14%    10.4x
--     dot_sbd                          2,811          3.74%     5.4x
--     rvol >= 3                        8,409          2.41%     3.5x
--     ret_5d >= 10                    11,308          2.09%     3.0x
--     (baseline)                     186,075          0.686%     1.0x
--
-- Features that do NOT predict, kept here so they are not re-tried:
--     rsi_14 ........... 54.7 vs 51.7   (1.06x — nothing)
--     magic_rs .......... 2.73 vs 3.21  (0.85x — INVERTED)
--     delivery_pct alone ......         (0.96x — nothing on its own)
--     magic_rs_zone Neutral Bull ...    (0.5x — below baseline)
--     volume_divergence_flag UP/DOWN    (0.4x / 0.5x — worse than random)
--
-- VANI RULE — deliberately NOT is_vani_surge_or_breakout
-- ------------------------------------------------------
-- Those flags measure 0.53% (0.8x, BELOW base rate) on their own, and stacking
-- them onto this scan cut it from 59 signals to 5 while lowering the hit rate
-- to 20%. The new 'svd_delivery_conviction' rule marks the delivery >= 50
-- subset instead — the 34.6x cohort — so the chip highlights conviction within
-- the results rather than filtering them.
--
-- Delivery is a MULTIPLIER, not a filter: 0.96x on the general population,
-- 7.14% -> 23.73% on an already-selected one. That is why it ranks and chips
-- rather than gates.
--
-- SCOPE — what this preset cannot do
-- ----------------------------------
-- SVD requires pct_chng > 9 and SBD a green candle with 3x volume, so both fire
-- ON the move day. This surfaces continuation, not prediction. Stocks that
-- explode from a quiet base are invisible to it: STEELCITY traded 8,728 shares
-- the session before a +16% move. That cohort needs the intraday feed
-- (km_equity_15m, currently 0 rows).
--
-- SAMPLE-SIZE CAVEAT: the 34.6x figure rests on n=59 over three months, and
-- dot_svd history is only reliable from ~2026-05 because sma_150 is unpopulated
-- earlier for the newly registered cohort (the indicator RPC computes 90 days).
-- Treat the ranking as sound and the exact multiple as provisional.
-- =============================================================================

BEGIN;

DO $mig168$
BEGIN
    IF current_database() <> 'kaala_dristi_db' THEN
        RAISE EXCEPTION 'Migration 168 targets kaala_dristi_db but this session is connected to "%". Reconnect and re-run.', current_database();
    END IF;

    IF to_regclass('public.kd_scan_presets') IS NULL THEN
        RAISE EXCEPTION 'public.kd_scan_presets not found in database "%". Wrong server?', current_database();
    END IF;
END
$mig168$;

INSERT INTO public.kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe,
    vani_rule, vani_side, vani_short_label, vani_cap,
    is_default_tab
) VALUES (
    'volume_drive',
    'Volume Drive',
    'Stocks printing a volume-drive or accumulation bar — ranked by delivery conviction',
    'Bars where volume broke sharply above its own baseline and the close held in the upper part of the range. Ranked by delivery percentage: the VaNi chip marks names where a volume-drive bar came with delivery above 50%, historically the highest-conviction subset. Surfaces continuation, not prediction.',
    10,     -- 9 is already occupied by BOTH flower_pot_burst and stage_2_leaders;
            -- a third at 9 would leave tab order undefined between them.
    60,
    TRUE,
    'flow', 'Flow', '#3b82f6', 3,
    'NSE_BSE',
    'daily',
    'svd_delivery_conviction',
    'strength',
    'Drive',
    NULL,
    FALSE   -- not a default tab until the owner has watched it for a few days
)
ON CONFLICT (id) DO UPDATE SET
    sort_order       = EXCLUDED.sort_order,
    name             = EXCLUDED.name,
    description      = EXCLUDED.description,
    tooltip          = EXCLUDED.tooltip,
    result_limit     = EXCLUDED.result_limit,
    is_active        = EXCLUDED.is_active,
    category         = EXCLUDED.category,
    category_label   = EXCLUDED.category_label,
    category_color   = EXCLUDED.category_color,
    category_sort    = EXCLUDED.category_sort,
    universe         = EXCLUDED.universe,
    timeframe        = EXCLUDED.timeframe,
    vani_rule        = EXCLUDED.vani_rule,
    vani_side        = EXCLUDED.vani_side,
    vani_short_label = EXCLUDED.vani_short_label,
    updated_at       = now();

-- Verify
SELECT id, name, sort_order, result_limit, is_active, universe, vani_rule, is_default_tab
  FROM public.kd_scan_presets
 WHERE id = 'volume_drive';

COMMIT;
