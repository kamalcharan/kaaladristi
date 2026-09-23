-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 221 — Post-Result Drift (PEAD) scanner preset
--
-- Registers the 'pead_drift' preset consumed by fetchPeadDrift() in
-- services/scanEngine.ts. Holds NO DATA and creates NO TABLE: the scanner is
-- DERIVED ON READ from kd_result_returns (migration 215) with migration 216's
-- one-row-per-board-meeting de-duplication. A third copy of a derivable number
-- is how two readings of one rule start to disagree.
--
-- WHY THE GATE IS +5% — MEASURED, NOT CHOSEN
-- ------------------------------------------
-- 2,245 result announcements, Jul-Aug 2026. Median drift over the 20 sessions
-- AFTER Day 0, against a universe median of -0.59% over the same window:
--
--     reaction > +5%      n=278   +0.95%   (+1.54 pts excess)   <- the gate
--     reaction +2..+5%    n=288   +0.16%   (+0.75)
--     reaction -2..+2%    n=833   -1.61%   (-1.02)
--     reaction -5..-2%    n=554   -1.87%   (-1.28)
--     reaction < -5%      n=292   -1.52%   (-0.93)
--
-- A 2.8-point spread, and the threshold is sharp: the drift is negative across
-- three consecutive bands below +2%.
--
-- ⚠ NO MagicRS GATE, deliberately. react>=5% with RS rising measured +0.80%,
-- with RS falling +0.59% (n=42) — within noise. Adding it would halve the list
-- for no measured gain and imply a confluence that was tested and is not there.
--
-- ⚠ NEW CATEGORY 'events' (category_sort 6), and it earns its own rail because
-- this preset is SEASONAL. Qualifying events per week, measured:
--
--     2026-07-13    12
--     2026-07-27    46
--     2026-08-10   104   <- peak
--     2026-08-17    18
--     2026-09-14     1
--     2026-09-21     0
--
-- On 2026-09-23 there is exactly ONE live candidate in the whole market. An
-- empty list is CORRECT between results seasons, and sitting it inside Price
-- Action or Discovery would make those families look broken four weeks in
-- five. The empty state must read "no results filed in the last 20 sessions",
-- never "no opportunities" — the fpbEvents starvation lesson.
--
-- ⚠ vani_side is NULL: this preset does NOT enter the Workspace Discovery
-- union. A board that is empty most of the year is worse than no board.
--
-- ⚠ suspect_corporate_action is filtered in the reader, not here. It stays
-- mandatory while km_corporate_actions is EMPTY (D44) — a bonus inside the
-- span reads as a genuine -50% drift, and results season is exactly when
-- boards declare them.
--
-- Target database: kaala_dristi_db. Holds no data, no REFRESH, no backfill.
-- Owner runs it in pgAdmin.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO public.kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe,
    vani_rule, vani_side, vani_short_label, vani_cap,
    is_default_tab
) VALUES (
    'pead_drift',
    'Post-Result Drift',
    'Stocks that jumped more than 5% on their results day, still inside the 20-session window that move was measured over',
    'Post-earnings announcement drift. A results-day reaction above +5% was followed by 1.54 percentage points of excess return over the next 20 sessions, measured across 2,245 announcements; every reaction band below +2% underperformed the market. Reaction and Drift are shown separately and never merged — measuring drift from the day before the result would fold the announcement jump into it. SEASONAL: full during results season, empty between. Surfaces a condition, not a recommendation.',
    23,     -- max sort_order is 22; 'events' sorts last on the category rail
    200,
    TRUE,
    'events', 'Events', '#a855f7', 6,
    'NSE_ONLY',     -- the filing ingest does not cover BSE
    'daily',
    NULL,           -- no vani_rule: the highlight would restate membership
    NULL,           -- NOT on the Workspace Discovery board (seasonal)
    'Results',
    NULL,
    TRUE            -- the only preset in its category, so it is its own default
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
    is_default_tab   = EXCLUDED.is_default_tab,
    updated_at       = now();

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────
SELECT id, name, sort_order, result_limit, is_active,
       category, category_label, category_sort, universe, is_default_tab
  FROM public.kd_scan_presets
 WHERE id = 'pead_drift';

-- What the scanner will actually serve today. Empty between results seasons
-- is the correct answer, not a failure.
SELECT count(*) AS live_candidates
  FROM kd_result_returns(
         (SELECT min(trade_date) FROM (
            SELECT trade_date FROM km_trading_calendar
             WHERE exchange='NSE' AND status IN ('completed','partial')
             ORDER BY trade_date DESC LIMIT 21) z),
         (SELECT max(trade_date) FROM km_trading_calendar
           WHERE exchange='NSE' AND status IN ('completed','partial')),
         20)
 WHERE reaction_pct >= 5 AND NOT suspect_corporate_action AND equity_id IS NOT NULL;
