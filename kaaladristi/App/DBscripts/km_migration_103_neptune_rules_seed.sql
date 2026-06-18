-- km_migration_103_neptune_rules_seed.sql
-- Target database: kaala_dristi_db
--
-- Seeds 4 Neptune station/retrograde rules into km_astro_rule_master.
-- Based on Bill Meridian framework: Neptune stations rated higher than
-- Pluto stations for financial market impact.
-- Run in pgAdmin / DBeaver / psql — do not run automatically.
-- After running: execute generate_neptune_windows.py to populate km_rule_transits.

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'NEP-STN-RET-BEA',
  'planet_state',
  'Neptune Station Retrograde',
  'Neptune', null,
  'bearish', 'Very High',
  ARRAY['Neptune', 'Transit', 'MajorTransit', 'Retrograde'],
  true, true, false,
  'Neptune stations retrograde — peak fog density window (±7 days). Collective market perception maximally distorted. Valuations disconnected from fundamentals feel normal. Momentum strategies extend past logical end. Smart money repositions quietly. Bill Meridian rates Neptune station higher than Pluto station for financial market impact. Sectors most affected: pharma/biotech, crypto/speculative tech, media/entertainment, oil/liquids. Watch for major top formations — not immediate crash but the high before a long slide.'
),
(
  'NEP-STN-DIR-TRN',
  'planet_state',
  'Neptune Station Direct',
  'Neptune', null,
  'turning', 'Very High',
  ARRAY['Neptune', 'Transit', 'MajorTransit'],
  true, true, false,
  'Neptune stations direct after retrograde — fog begins lifting. The "wait, what were we buying?" moment begins. Disillusionment phase starts as collective narrative dissolves. Sectors built on narrative over fundamentals show first cracks. Reversal confirmation window — trends that held through retrograde now vulnerable. Bill Meridian framework: station direct marks beginning of trend reality-check.'
),
(
  'NEP-RET-BEA',
  'planet_state',
  'Neptune Full Retrograde Period',
  'Neptune', null,
  'bearish', 'High',
  ARRAY['Neptune', 'Transit', 'Retrograde'],
  true, true, false,
  'Neptune retrograde full period (~5 months). Sustained narrative dissolution phase. Markets gradually reprice assets built on belief over fundamentals. Not a crash signal — a slow leak of confidence in momentum/narrative trades. Pharma, speculative tech, media sectors underperform. Value over growth during this window historically.'
),
(
  'NEP-STN-RET-WIN',
  'planet_state',
  'Neptune Stationary Retrograde Window',
  'Neptune', null,
  'bearish', 'Very High',
  ARRAY['Neptune', 'Transit', 'MajorTransit', 'Retrograde'],
  true, true, false,
  'Neptune stationary phase — 7 days before exact retrograde station. Peak risk window per Bill Meridian. Markets at maximum collective delusion — bubble holds shape longest here. Highest probability of major top formation. Smart money exits while retail momentum continues. Speed < 0.02 degrees/day. The silence before the dissolution.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Verify ───────────────────────────────────────────────────────────────────

SELECT rule_code, display_name, base_bias, catalog_visible
FROM km_astro_rule_master
WHERE 'Neptune' = ANY(tags)
ORDER BY rule_code;
