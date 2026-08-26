-- Migration 186 — "Monthly Movers" Price Action screener preset
-- Target DB: kaala_dristi_db
--
-- Depends on migration 185 (prev_month_close / pct_mtd on km_equity_eod).
-- RUN ORDER: 185 -> scripts/backfill_period_to_date.py --period month -> 186.
-- Adding the preset before the backfill would surface an empty screener.
--
-- WHAT THIS SCREENS
-- Stocks trading above LAST MONTH'S CLOSE, ranked by month-to-date gain.
-- Reverse-engineered from the owner's monthly export (2026-08-24) and matched
-- to it exactly, symbol for symbol -- verified against the live DB:
--   RATNAMANI 2358.90/+14.33%   SIEMENS 3760.00/+9.41%
--   WELCORP   1650.60/+45.96%   PTCIL   17737.00/+22.19%
--   RELIANCE  1307.80/+0.15%    TITAN   4875.20/+4.18%
--   SBIN      1027.40/+1.18%    BOSCHLTD 41085.00/+17.07%
-- Evidence: docs/claude/price-action-matrix-poa.md section 3b.
--
-- NAMING (SEBI - D39): this is period-to-date momentum, NOT a rolling-high
-- breakout, so it is deliberately NOT called "Monthly Breakout". The measured
-- difference is larger than the weekly case: on 2026-08-24, 259 NSE large-caps
-- were above last month's close (55% of the eligible universe) versus 124
-- above last month's HIGH and 84 above the 12-month high. 141 of those 259
-- rows closed RED that session -- a month-to-date gain says nothing about the
-- current day.
--
-- UNIVERSE: full active NSE, close >= 50 (penny filter), NSE_ONLY enforced in
-- the fetcher. The export's Rs 14,000 Cr large-cap gate is NOT baked in, per
-- the doctrine already applied to Breakout Surge and Weekly Movers; MCap is a
-- sortable column and a filter-bar control instead. result_limit 500.

INSERT INTO kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe, vani_rule, is_default_tab
)
VALUES (
    'monthly_movers',
    'Monthly Movers',
    'NSE stocks trading above last month''s close — ranked by month-to-date gain',
    'Stocks whose current price is above the previous month''s closing price, ranked by how far the month has travelled so far. The Prev Mth Close column is the reference the move is measured from. This is a month-to-date momentum view, not a breakout above a rolling high: a stock can appear here while still well below its 52-week high, and while closing red today. Observational only; not a recommendation.',
    11,
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
