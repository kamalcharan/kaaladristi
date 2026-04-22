-- ============================================================
-- Migration 044 · kd_vani_opportunity_config
--
-- Replaces the flat-column km_vani_opportunity_config (043) with
-- a JSONB-parameters design. One active row at a time enforced
-- by a partial unique index.
--
-- Default policy parameters:
--   atr_multiplier          1.0  → close within 1× ATR of EMA(20)
--   min_rvol                1.2  → minimum relative volume
--   rs_zones                ['Strong Bull','Mild Bull']
--   flow_types              ['FRESH_LONGS','SHORT_COVERING']
--   min_reward_atr_multiple 0.0  → any positive reward qualifies
-- ============================================================

CREATE TABLE IF NOT EXISTS kd_vani_opportunity_config (
    id              serial PRIMARY KEY,
    config_name     varchar(100) NOT NULL,
    description     text,
    is_active       boolean DEFAULT false,
    parameters      jsonb NOT NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Only one active config allowed at a time (partial index, not inline constraint)
CREATE UNIQUE INDEX IF NOT EXISTS kd_vani_opp_config_one_active
    ON kd_vani_opportunity_config (is_active)
    WHERE (is_active = true);

INSERT INTO kd_vani_opportunity_config
    (config_name, description, is_active, parameters)
VALUES (
    'default',
    'Standard VaNi Opportunity policy — bull market conditions',
    true,
    '{
        "atr_multiplier": 1.0,
        "min_rvol": 1.2,
        "rs_zones": ["Strong Bull", "Mild Bull"],
        "flow_types": ["FRESH_LONGS", "SHORT_COVERING"],
        "min_reward_atr_multiple": 0.0
    }'
);

GRANT ALL ON kd_vani_opportunity_config TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE kd_vani_opportunity_config_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
