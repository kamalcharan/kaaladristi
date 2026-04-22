-- Migration 057: Scan preset definitions table
-- Moves hardcoded SCAN_PRESETS from frontend scanEngine.ts into the database.
-- Frontend fetches via GET /api/scan/presets.

CREATE TABLE IF NOT EXISTS kd_scan_presets (
    id           TEXT PRIMARY KEY,
    name         TEXT        NOT NULL,
    description  TEXT,
    tooltip      TEXT,
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    result_limit INTEGER     NOT NULL DEFAULT 25,
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant read access to the PostgREST role (anon + authenticated)
GRANT SELECT ON kd_scan_presets TO anon, authenticated;

-- Seed all 8 presets
INSERT INTO kd_scan_presets (id, name, description, tooltip, sort_order, result_limit) VALUES
(
    'power_buy',
    'Strength Confluence',
    'Stocks where multiple bullish conditions converge in leading or rotating-in industries',
    'Stocks where multiple positive conditions are converging — strong relative strength, accumulation patterns, recent institutional fingerprints, in rotating-in or leading industries. Not a buy recommendation.',
    1,
    25
),
(
    'power_sell',
    'Weakness Confluence',
    'Stocks where multiple bearish conditions converge in lagging or rotating-out industries',
    'Stocks where multiple negative conditions are converging — weakness, distribution, selling pressure, in rotating-out industries. Not a sell recommendation.',
    2,
    25
),
(
    'smart_money',
    'Smart Money Loading',
    'Industries with heavy accumulation and rising institutional presence',
    NULL,
    3,
    25
),
(
    'fresh_breakout',
    'Fresh Breakouts',
    'Stocks breaking above recent highs with strong volume in leading industries',
    NULL,
    4,
    25
),
(
    'quiet_accumulation',
    'Quiet Accumulation',
    'Under-the-radar industries where smart money is quietly building positions',
    NULL,
    5,
    25
),
(
    'distribution_warning',
    'Distribution Warnings',
    'Previously strong stocks showing signs of institutional exit',
    NULL,
    6,
    25
),
(
    'conviction_flow',
    'Conviction Flow',
    'Stocks where 5-day delivery value is outpacing the 22-day norm — rising institutional commitment',
    'delivery_surge_x = avg_amt_5d / avg_amt_22d. Surge > 1.5× means recent delivery is accelerating vs baseline. VaNi gate: surge > 2×, price near EMA20, avg_amt_22d > 2 Cr.',
    7,
    50
),
(
    'breakout_surge',
    'Breakout Surge',
    'Stocks breaking above 20-day highs with RVOL > 2× — fresh momentum with institutional volume',
    'Close > 20-day high + RVOL > 2 + Close ≥ 50. VaNi gate: RVOL > 5, 0–5% above breakout level, RSI < 75, price within 15% of EMA20.',
    8,
    50
)
ON CONFLICT (id) DO UPDATE
    SET name         = EXCLUDED.name,
        description  = EXCLUDED.description,
        tooltip      = EXCLUDED.tooltip,
        sort_order   = EXCLUDED.sort_order,
        result_limit = EXCLUDED.result_limit,
        updated_at   = now();
