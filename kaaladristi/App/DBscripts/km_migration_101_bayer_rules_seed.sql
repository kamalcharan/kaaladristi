-- km_migration_101_bayer_rules_seed.sql
-- Target database: kaala_dristi_db
--
-- Seeds Bayer rules into km_astro_rule_master:
--   Step 1: Tag 5 existing rules with 'Bayer'
--   Step 2: Insert 5 new Bayer-specific rules
-- Run in pgAdmin / DBeaver / psql — do not run automatically.

-- ── Step 1: Tag existing rules that map to Bayer ────────────────────────────

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Bayer')
WHERE rule_code IN (
  'TRN-MER-MAN-TRN',
  'TRN-MER-RIS-W-BUL',
  'CON-SUN-MER-TRN',
  'CON-MER-VEN-CD-BEA',
  'TR-MER-CMB-E-BEA'
)
AND NOT ('Bayer' = ANY(tags));

-- ── Step 2: Insert new Bayer rules ──────────────────────────────────────────

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'BAY-R02-MAR-MER-SPD',
  'compound',
  'Mars Mercury Speed Differential',
  'Mars', 'Mercury',
  'turning', 'High',
  ARRAY['Bayer'],
  true, true, false,
  'Rule 2: When geocentric speed difference between Mars and Mercury hits 59 minutes, market trend reverses within 3 days. One of Bayer''s most cited and validated rules.'
),
(
  'BAY-R03-VEN-RET',
  'planet_state',
  'Venus Retrograde — Bayer Rule 3',
  'Venus', null,
  'bearish', 'High',
  ARRAY['Bayer', 'Venus'],
  true, true, false,
  'Rule 3: Major market lows often form when Venus is in retrograde motion. Watch for reversals and bottoming patterns during Venus Rx periods.'
),
(
  'BAY-R06-MAR-1635',
  'planet_transit',
  'Mars at 16°35'' Any Sign',
  'Mars', null,
  'bullish', 'High',
  ARRAY['Bayer'],
  true, true, false,
  'Rule 6: When Mars reaches 16 degrees 35 minutes of any zodiac sign (within ± 30 days), a market bottom tends to form. One of Bayer''s geometric degree rules.'
),
(
  'BAY-R27-MER-SPD',
  'planet_state',
  'Mercury Speed 59'' or 1°58''',
  'Mercury', null,
  'turning', 'Very High',
  ARRAY['Bayer', 'Mercury'],
  true, true, false,
  'Rule 27: When Mercury geocentric speed hits exactly 59 minutes or 1 degree 58 minutes, major market tops and bottoms form. Highly specific speed trigger.'
),
(
  'BAY-R14-VEN-LON',
  'planet_transit',
  'Venus Longitude Unit Cycle',
  'Venus', null,
  'turning', 'High',
  ARRAY['Bayer', 'Venus'],
  true, true, false,
  'Rule 14: Venus geocentric longitude advances in units of 1 degree 9 minutes 13 seconds. Each unit completion marks a key reversal, especially in banking and financial stocks.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Verify ───────────────────────────────────────────────────────────────────

SELECT rule_code, display_name, tags, catalog_visible
FROM km_astro_rule_master
WHERE 'Bayer' = ANY(tags)
ORDER BY rule_code;
