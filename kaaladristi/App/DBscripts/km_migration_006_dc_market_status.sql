-- ============================================================================
-- KALA-DRISHTI: DC Market Status master table
-- Migration 006 — Run on kaala_dristi_db
-- ============================================================================
--
-- dc_market_status is the DB-side master for market impact values.
-- The frontend constants file (App/frontend/src/constants/marketStatus.ts)
-- is the source of truth; this table mirrors it so the rule engine can
-- JOIN dc_inference against market status metadata when running correlations.
--
-- dc_inference.market_impact stores the `value` slug (e.g. 'major_positive').
-- The CHECK constraint on dc_inference is dropped so new statuses can be
-- added to this table without a separate migration.
-- ============================================================================

-- ── 1. Drop the old CHECK constraint ──────────────────────────────────────────

ALTER TABLE dc_inference
    DROP CONSTRAINT IF EXISTS dc_inference_market_impact_check;

-- ── 2. Create dc_market_status ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dc_market_status (
    id          SERIAL PRIMARY KEY,
    value       TEXT NOT NULL UNIQUE,   -- slug stored in dc_inference.market_impact
    label       TEXT NOT NULL,          -- display name
    color       TEXT NOT NULL DEFAULT 'slate',  -- green|red|amber|violet|blue|slate
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Seed from constants (mirrors marketStatus.ts) ─────────────────────────

INSERT INTO dc_market_status (value, label, color, sort_order) VALUES
    ('major_positive',  'Major Positive',  'green',  1),
    ('minor_positive',  'Minor Positive',  'green',  2),
    ('bullish',         'Bullish',         'green',  3),
    ('major_negative',  'Major Negative',  'red',    4),
    ('minor_negative',  'Minor Negative',  'red',    5),
    ('bearish',         'Bearish',         'red',    6),
    ('highly_volatile', 'Highly Volatile', 'amber',  7),
    ('volatile',        'Volatile',        'amber',  8),
    ('cautious',        'Cautious',        'amber',  9),
    ('neutral',         'Neutral',         'slate',  10),
    ('consolidation',   'Consolidation',   'blue',   11),
    ('mixed',           'Mixed',           'violet', 12)
ON CONFLICT (value) DO NOTHING;

-- ── 4. Grants ─────────────────────────────────────────────────────────────────

GRANT ALL ON dc_market_status TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE dc_market_status_id_seq TO authenticated, kd_app, anon;

-- ── 5. Reload PostgREST schema cache ──────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
