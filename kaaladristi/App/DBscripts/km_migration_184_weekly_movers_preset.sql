-- Migration 184 — "Weekly Movers" Price Action screener preset
-- Target DB: kaala_dristi_db
--
-- Depends on migration 183 (prev_week_close / pct_wtd on km_equity_eod).
-- RUN ORDER: 183 -> scripts/backfill_week_to_date.py -> 184.
-- Adding the preset before the backfill would surface an empty screener.
--
-- WHAT THIS SCREENS
-- Stocks trading above LAST WEEK'S CLOSE, ranked by week-to-date gain.
-- Reverse-engineered from the owner's weekly export (2026-08-24) and matched
-- to it exactly, symbol for symbol: RATNAMANI 2354.40/+14.55%,
-- SIEMENS 3920.00/+4.95%, LTFOODS 427.60/+7.34%, MUTHOOTFIN 3022.00/+6.19%,
-- WELCORP 2311.90/+4.21%, HATSUN 984.70/+6.07%, URBANCO 158.60/+6.46%,
-- ITC 269.40/+0.11%. Evidence: docs/claude/price-action-matrix-poa.md 3a.
--
-- NAMING (SEBI - D39): this is period-to-date momentum, NOT a rolling-high
-- breakout, so it is deliberately NOT called "Weekly Breakout". The measured
-- difference is large: on 2026-08-24, 199 NSE large-caps were above last
-- week's close versus 41 above last week's HIGH and 44 above the 20-week high.
-- Calling a 42%-of-universe filter a breakout would overstate it.
--
-- UNIVERSE: full active NSE, close >= 50 (penny filter). The export's
-- Rs 14,000 Cr large-cap gate is NOT baked in - same owner doctrine applied to
-- Breakout Surge, whose Rs 10,000 Cr gate became the MCap filter in the filter
-- bar. Full-universe NSE yields 1,120 rows on 2026-08-24; result_limit 500
-- caps the display, ranked by week-to-date gain.

INSERT INTO kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe, vani_rule, is_default_tab
)
VALUES (
    'weekly_movers',
    'Weekly Movers',
    'NSE stocks trading above last week''s close — ranked by week-to-date gain',
    'Stocks whose current price is above the previous week''s closing price, ranked by how far the week has travelled so far. The Prev Wk Close column is the reference the move is measured from. This is a week-to-date momentum view, not a breakout above a rolling high — a stock can appear here while still well below its 52-week high. Observational only; not a recommendation.',
    10,
    500,
    TRUE,
    'price_action',
    'Price Action',
    '#f59e0b',
    1,
    'NSE_ONLY',
    'daily',
    'is_vani_surge_or_breakout',
    FALSE
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
