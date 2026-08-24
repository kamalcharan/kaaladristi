-- =====================================================================
-- km_migration_177_wg_journeys.sql
-- Target database: kaala_dristi_db
-- Waking Giants v4 — the Hibernation → Wake → Ascent journey model
-- (spec: docs/claude/waking-giants-poa.md, "v4 spec CLOSED 2026-08-24")
-- =====================================================================
-- A waking giant is a multi-year JOURNEY (a persistent state, Weinstein-
-- cycle style), not a 60-session evidence window. This table holds one
-- CURRENT row per pooled stock (is_current = TRUE) plus archived past
-- journeys (is_current = FALSE — the backtest record: every historical
-- wake with its dates, for forward-return stats and the audit's
-- 30-signal confidence minimum).
--
-- States: HIBERNATING → STIRRING (quiet building inside the base) →
-- WAKING (close breaks the multi-year ceiling at/above the Golden Line,
-- weekly confirm) → ASCENDING (MagicRS Alignment 6/6 AND monthly close
-- holds above the base ceiling). No "death": when alignment collapses
-- to <= 1 the stock GOES BACK TO SLEEP (journey archived, state back to
-- HIBERNATING). Weekly close below the Golden Line = resting flag only.
--
-- Rows are written by scripts/compute_wg_journeys.py (nightly + CLI).
-- Display fields are stamped denormalized so each scanner tab is a
-- single-table PostgREST read (the km_fpb_active pattern).

CREATE TABLE IF NOT EXISTS km_wg_journeys (
    id            BIGSERIAL PRIMARY KEY,
    equity_id     INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    is_current    BOOLEAN NOT NULL DEFAULT TRUE,

    state         TEXT NOT NULL CHECK (state IN ('HIBERNATING','STIRRING','WAKING','ASCENDING')),
    resting       BOOLEAN NOT NULL DEFAULT FALSE,   -- weekly close below the Golden Line (journey alive)

    -- the hibernation this journey broke out of (or sits inside)
    base_start    DATE,                -- last time price traded at/above the wake level before the sleep
    base_high     NUMERIC(14,2),       -- the consolidation ceiling that was / must be broken
    base_years    NUMERIC(5,1),        -- length of the hibernation (story stat + runtime user filter)

    wake_date     DATE,                -- daily breakout of base_high at/above the Golden Line
    confirm_date  DATE,                -- ASCENDING: alignment 6/6 + monthly close holds above base_high
    sleep_date    DATE,                -- archived journeys: when alignment collapsed to <= 1

    -- MagicRS Alignment Score (0-6): daily=1, weekly=2, monthly=3.
    -- Monthly is judged on magic_rs_short (migration-169 lesson); weekly
    -- falls back to short when long is unwarmed. NULL flag = data missing
    -- (missing is never scored as red).
    align_score   SMALLINT,
    align_daily   BOOLEAN,
    align_weekly  BOOLEAN,
    align_monthly BOOLEAN,

    gl_dist_pct        NUMERIC(7,2),   -- close vs Golden Line (SMA150), %
    pct_from_base_high NUMERIC(7,2),   -- close vs the base ceiling, %
    journey_age_days   INTEGER,        -- days since wake_date
    stir_days          SMALLINT,       -- quiet building sessions of last 60 (relative-delivery gate)

    -- display stamp (denormalized; refreshed on every evaluator run)
    symbol         TEXT, company_name TEXT, industry TEXT, exchange TEXT, isin TEXT,
    mcap_cr        NUMERIC, close NUMERIC(14,2), pct_chng NUMERIC(7,2),
    delivery_pct   NUMERIC(6,2), magic_rs NUMERIC, magic_rs_zone TEXT,
    listing_age_years SMALLINT,
    trade_date     DATE,               -- EOD date the evaluation used

    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wg_journeys_current
    ON km_wg_journeys (equity_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS ix_wg_journeys_state
    ON km_wg_journeys (state, base_years) WHERE is_current;
CREATE INDEX IF NOT EXISTS ix_wg_journeys_history
    ON km_wg_journeys (equity_id, wake_date) WHERE NOT is_current;

-- Grants: `authenticated` is the decisive live role (CLAUDE.md lesson);
-- the rest match the platform's standard read set. kd_app writes.
GRANT SELECT ON km_wg_journeys TO authenticated, anon, admin, "user", kd_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON km_wg_journeys TO kd_app;
GRANT USAGE ON SEQUENCE km_wg_journeys_id_seq TO kd_app;

-- =====================================================================
-- Presets — the stage-family pattern: one tab per journey state.
-- 'first_ascent' (interim v2/v3 age-band sibling) is retired; the age
-- dimension is now a tier badge + filter inside every tab.
-- Copy is D39-observational (no directive verbs, no bull/bear words).
-- =====================================================================
UPDATE public.kd_scan_presets SET is_active = FALSE, updated_at = now()
WHERE id = 'first_ascent';

INSERT INTO public.kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe,
    vani_rule, vani_side, vani_short_label, vani_cap,
    is_default_tab
) VALUES
(
    'waking_giants',
    'Waking Giants',
    'Stocks breaking out of a multi-year hibernation at the Golden Line - the first sessions of a structural transition',
    'A wake event: the close prints its highest level in years (the hibernation ceiling breaks) at or above the Golden Line (SMA 150), with weekly confirmation. Each row shows how long the sleep lasted and how the multi-timeframe alignment is building. A journey is confirmed into Ascent when alignment reaches 6/6 and the monthly close holds above the old ceiling. Observational conditions, not a recommendation.',
    11, 60, TRUE,
    'discovery', 'Discovery', '#14b8a6', 5,
    'NSE_ONLY', 'daily',
    NULL, NULL, NULL, NULL,
    FALSE
),
(
    'wg_ascent',
    'Ascent',
    'Confirmed multi-year journeys in progress - aligned across the daily, weekly and monthly clocks',
    'Journeys past their confirmation point: MagicRS alignment reached 6/6 (Leading on all three clocks) and the monthly close held above the old hibernation ceiling. Rows carry journey age, hibernation length, current alignment and a Resting marker when the weekly close sits below the Golden Line. A journey returns to sleep when alignment collapses. Observational conditions, not a recommendation.',
    12, 60, TRUE,
    'discovery', 'Discovery', '#14b8a6', 5,
    'NSE_ONLY', 'daily',
    NULL, NULL, NULL, NULL,
    FALSE
),
(
    'wg_stirring',
    'Stirring',
    'Quiet delivery-backed building inside a multi-year hibernation - no breakout yet',
    'Stocks still inside a long consolidation where delivery-heavy, low-noise sessions are clustering above the stock''s own baseline - the early-observation tier of the hibernation cycle. No breakout has occurred; these are conditions to watch, not signals. Observational, not a recommendation.',
    13, 40, TRUE,
    'discovery', 'Discovery', '#14b8a6', 5,
    'NSE_ONLY', 'daily',
    NULL, NULL, NULL, NULL,
    FALSE
)
ON CONFLICT (id) DO UPDATE SET
    name             = EXCLUDED.name,
    description      = EXCLUDED.description,
    tooltip          = EXCLUDED.tooltip,
    sort_order       = EXCLUDED.sort_order,
    result_limit     = EXCLUDED.result_limit,
    is_active        = EXCLUDED.is_active,
    category         = EXCLUDED.category,
    category_label   = EXCLUDED.category_label,
    category_color   = EXCLUDED.category_color,
    category_sort    = EXCLUDED.category_sort,
    universe         = EXCLUDED.universe,
    timeframe        = EXCLUDED.timeframe,
    is_default_tab   = EXCLUDED.is_default_tab,
    updated_at       = now();

NOTIFY pgrst, 'reload schema';

-- NOTE: the interim WG blocks inside km_scan_results (migration 176)
-- keep refreshing harmlessly; the frontend no longer reads the
-- 'waking_giants' preset from the matview after this migration's code
-- deploy. They get dropped in the next scheduled matview recreate.
