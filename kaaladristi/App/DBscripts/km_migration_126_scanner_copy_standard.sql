-- ============================================================
-- Migration 126 · Scanner copy standard — description + tooltip
--
-- Standard (owner decision 2026-07-06):
--   description — ONE plain-English sentence: what the scan surfaces and
--                 why you'd look at it. No column names, no thresholds.
--   tooltip     — the mechanics: universe, match conditions, ranking, in
--                 consistent compact form so a power user can verify what
--                 fired.
--   A third line (VaNi daily interpretation) will render below these later.
--
-- CONSTRAINT: the Score formula is proprietary and is NEVER disclosed —
-- Score may only be referenced as "Score 5D (money-flow conviction)".
-- Bearish scans use observational risk-review language (SEBI: no
-- directional advice, no sell/short recommendations).
--
-- Copy verified against the actual gate logic in scanEngine.ts on
-- 2026-07-06 (post-migration-125 merged breakout definition).
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

UPDATE kd_scan_presets SET
  description = 'Stocks where several independent bullish conditions line up at once, inside industries that money is currently favouring.',
  tooltip     = 'Universe: industries leading or rotating in. Match: an Accumulation Signature, OR price above its 150-day average + bullish Relative Strength zone + fresh-longs / short-covering flow + volume above 1.5× normal. Top 25 by Relative Strength.'
WHERE id = 'power_buy';

UPDATE kd_scan_presets SET
  description = 'Stocks where several independent weakening conditions coincide, inside industries currently losing participation.',
  tooltip     = 'Universe: industries lagging or rotating out. Match: a Distribution Signal, OR price below its 150-day average + bearish Relative Strength zone + fresh-shorts / long-liquidation flow + volume above 1.5× normal. Bottom 25 by Relative Strength.'
WHERE id = 'power_sell';

UPDATE kd_scan_presets SET
  description = 'Stocks being bought for keeps — high delivery (shares actually taken home, not day-traded) inside industries where accumulation is broad.',
  tooltip     = 'Universe: industries with over 60% of members in accumulation. Match: delivery above 60% of traded quantity + positive RSS momentum. Top 25 by delivery %.'
WHERE id = 'smart_money';

UPDATE kd_scan_presets SET
  description = 'Stocks clearing their recent price ceiling on unusually heavy volume, inside industries that are already leading.',
  tooltip     = 'Universe: leading industries. Match: close above the prior 20-session high + above the 150-day average + volume above 2× normal. Top 25 by relative volume.'
WHERE id = 'fresh_breakout';

UPDATE kd_scan_presets SET
  description = 'Under-the-radar industries where buying interest is rising before the price story is obvious — and the stocks inside them showing an accumulation footprint.',
  tooltip     = 'Universe: industries outside the top quartile whose accumulation breadth is rising over 5 sessions. Match: Accumulation Signature + Smart Money reading rising vs 5 sessions ago. Top 25 by industry accumulation change.'
WHERE id = 'quiet_accumulation';

UPDATE kd_scan_presets SET
  description = 'Recently strong stocks showing early signs that large holders may be handing off — strength fading alongside distribution footprints. A risk-review list.',
  tooltip     = 'Match: Relative Strength zone was Strong Bull 10 sessions ago and has slipped since + a Distribution Signal or downward volume divergence. Ranked by size of the strength slip × industry rank drop.'
WHERE id = 'distribution_warning';

UPDATE kd_scan_presets SET
  description = 'Stocks where this week''s delivery money is running well ahead of its monthly norm — buying with intent, still near a sensible re-entry zone.',
  tooltip     = 'Match: 5-day avg delivery value above 1.5× the 22-day avg + 22-day avg above ₹1.5 Cr + price within ±8% of its 20-day average. Ranked by delivery surge multiple.'
WHERE id = 'conviction_flow';

UPDATE kd_scan_presets SET
  description = 'Stocks closing above their 20-day high on an up day — exiting consolidation with participation behind the move.',
  tooltip     = 'Match: close above the highest close of the prior 20 sessions + green day + price ≥ ₹50. NSE universe — use the MCap filter to restrict to large caps. Ranked by Score 5D (money-flow conviction).'
WHERE id = 'breakout_surge';

UPDATE kd_scan_presets SET
  description = 'Stocks in a confirmed Weinstein Stage 2 advance — the phase where trends are established and orderly.',
  tooltip     = 'Match: classified Stage 2 — price above rising long-term averages with proper 52-week position. Ranked by Relative Strength.'
WHERE id = 'stage_2_leaders';

UPDATE kd_scan_presets SET
  description = 'Stocks knocking on the Stage 2 door — moving averages stacked in order, waiting only for the long-term average to turn up.',
  tooltip     = 'Match: Stage 2 candidate — MA stacking confirmed (price > 50-day > 150-day > 200-day), 200-day average not yet rising. Ranked by RS percentile.'
WHERE id = 'stage_2_watch';

UPDATE kd_scan_presets SET
  description = 'VaNi''s shortlist of the strongest confirmed setups — Stage 2 stocks carrying the top relative-strength readings.',
  tooltip     = 'Match: VaNi Stage-2 quality overlay (structure + strength + position). Top 50 by RS percentile.'
WHERE id = 'vani_opportunity';

UPDATE kd_scan_presets SET
  description = 'Stocks in a confirmed Stage 4 decline — an observation list for risk awareness, not a trade list.',
  tooltip     = 'Match: classified Stage 4 — 50-day average below the 200-day (death cross), price below both. Ranked weakest-first by RS percentile.'
WHERE id = 'stage_4_leaders';

UPDATE kd_scan_presets SET
  description = 'Previously trending stocks entering the topping phase — momentum flattening as the long-term averages converge.',
  tooltip     = 'Match: classified Stage 3 — 50-day average converging toward the 200-day, price ≥ ₹30. Ranked weakest-first by RS percentile.'
WHERE id = 'stage_3_watch';

UPDATE kd_scan_presets SET
  description = 'VaNi''s shortlist of the weakest names — confirmed Stage 4 with the lowest relative strength. For exit timing and risk review.',
  tooltip     = 'Match: Stage 4 confirmed + RS percentile below 20 + price ≥ ₹30. Bottom 25 by RS percentile.'
WHERE id = 'vani_exit_watch';

-- ── Verify ──────────────────────────────────────────────────────
-- SELECT id, name, description, tooltip FROM kd_scan_presets
-- WHERE is_active = true ORDER BY category_sort, sort_order;

COMMIT;
