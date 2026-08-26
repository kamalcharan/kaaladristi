-- Migration 188 — the three breakdown Price Action screeners
-- Target DB: kaala_dristi_db
--
-- Depends on migration 187 (breakdown_level / pct_from_breakdown) for
-- breakdown_watch ONLY. weekly_decliners and monthly_decliners need NO new
-- columns -- they read pct_wtd / pct_mtd from migrations 183 / 185, already
-- backfilled over full history.
--
-- RUN ORDER: 187 -> scripts/backfill_rolling_metrics_fast.py -> 188.
--
-- THE SET MIRRORS THE BREAKOUT SIDE EXACTLY
--   Breakout Surge    <-> Breakdown Watch     (daily, true 20-bar lookback)
--   Weekly Movers     <-> Weekly Decliners    (week-to-date)
--   Monthly Movers    <-> Monthly Decliners   (month-to-date)
-- The asymmetry between a lookback daily clock and period-to-date weekly and
-- monthly clocks is inherited from the up side, not introduced here.
--
-- NAMING (SEBI - D39). Only the daily preset is called a BREAKDOWN, because
-- only it screens a structural level. Measured on 2026-08-25, NSE, close >= 50
-- (eligible universe 2,517):
--     below the 20-day LOW  ....  248 rows   <- breakdown_watch
--     below last week's close .. 1,340 rows  <- weekly_decliners
--     below last month's close . 1,119 rows  <- monthly_decliners
--     below the 20-day HIGH ... 2,242 rows  (89 percent -- means nothing)
-- Calling a 53-percent-of-universe filter a "breakdown" would overstate it in
-- exactly the way "Weekly Breakout" would have overstated Weekly Movers.
--
-- UNIVERSE: full active NSE, close >= 50, NSE_ONLY enforced in the fetchers.
-- No mcap gate, per the doctrine applied to Breakout Surge and the Movers.

INSERT INTO kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe, vani_rule, is_default_tab
)
VALUES
(
    'breakdown_watch',
    'Breakdown Watch',
    'NSE stocks closing below their 20-day low on a red day — ranked by depth below the level',
    'Stocks that closed under the lowest close of the prior 20 sessions, on a down day. This is the mirror of Breakout Surge: a structural level being lost, not merely a weak week. The Brk Dn Lvl column is the floor that was broken; % Below states how far under it price now sits. Observational only; not a recommendation.',
    12, 500, TRUE,
    'price_action', 'Price Action', '#f59e0b', 1,
    'NSE_ONLY', 'daily', 'is_vani_weakness', FALSE
),
(
    'weekly_decliners',
    'Weekly Decliners',
    'NSE stocks trading below last week''s close — ranked by week-to-date loss',
    'Stocks whose current price is below the previous week''s closing price, ranked by how far the week has fallen so far. The mirror of Weekly Movers. This is week-to-date weakness, not a breakdown through a level: a stock can appear here while still holding its 20-day floor, and while closing green today. Observational only; not a recommendation.',
    13, 500, TRUE,
    'price_action', 'Price Action', '#f59e0b', 1,
    'NSE_ONLY', 'daily', 'is_vani_weakness', FALSE
),
(
    'monthly_decliners',
    'Monthly Decliners',
    'NSE stocks trading below last month''s close — ranked by month-to-date loss',
    'Stocks whose current price is below the previous month''s closing price, ranked by how far the month has fallen so far. The mirror of Monthly Movers. This is month-to-date weakness, not a breakdown through a level, and it says nothing about today''s direction. Observational only; not a recommendation.',
    14, 500, TRUE,
    'price_action', 'Price Action', '#f59e0b', 1,
    'NSE_ONLY', 'daily', 'is_vani_weakness', FALSE
)
ON CONFLICT (id) DO UPDATE SET
    name           = EXCLUDED.name,
    description    = EXCLUDED.description,
    tooltip        = EXCLUDED.tooltip,
    sort_order     = EXCLUDED.sort_order,
    result_limit   = EXCLUDED.result_limit,
    is_active      = EXCLUDED.is_active,
    category       = EXCLUDED.category,
    category_label = EXCLUDED.category_label,
    category_color = EXCLUDED.category_color,
    category_sort  = EXCLUDED.category_sort,
    universe       = EXCLUDED.universe,
    timeframe      = EXCLUDED.timeframe,
    vani_rule      = EXCLUDED.vani_rule,
    is_default_tab = EXCLUDED.is_default_tab;

NOTIFY pgrst, 'reload schema';
