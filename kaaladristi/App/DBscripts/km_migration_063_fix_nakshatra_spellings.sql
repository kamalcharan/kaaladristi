-- M063: Fix nakshatra spellings in km_astro_rule_master conditions JSONB
-- All values corrected to match km_planetary_positions (positions_name column)
-- Date: 2026-04-24

-- ── Nakshatra name corrections ─────────────────────────────────
-- Mrigasira → Mrigashira
UPDATE km_astro_rule_master SET conditions = REPLACE(conditions::text, '"Mrigasira"', '"Mrigashira"')::jsonb WHERE conditions::text LIKE '%Mrigasira%';

-- Mula → Moola
UPDATE km_astro_rule_master SET conditions = REPLACE(conditions::text, '"Mula"', '"Moola"')::jsonb WHERE conditions::text LIKE '%"Mula"%';

-- Dhanistha → Dhanishta
UPDATE km_astro_rule_master SET conditions = REPLACE(conditions::text, '"Dhanistha"', '"Dhanishta"')::jsonb WHERE conditions::text LIKE '%Dhanistha%';

-- Purva Ashadha → Purva Ashadha (same — skip)
-- Purva Bhadrapada → Purva Bhadrapada (same — skip)
-- Uttara Bhadrapada → Uttara Bhadrapada (same — skip)
-- Shravana → Shravana (same — skip)
-- Shatabhisha → Shatabhisha (same — skip)
-- Ardra → Ardra (same — skip)
-- Ashwini → Ashwini (same — skip)

-- ── Hemisphere event corrections ───────────────────────────────
UPDATE km_astro_rule_master SET conditions = '{"event":"spring_equinox"}' WHERE rule_code = 'HEM-BST-TRN';
UPDATE km_astro_rule_master SET conditions = '{"event":"autumn_equinox"}' WHERE rule_code = 'HEM-DAK-TRN';

-- ── Yoga name corrections ──────────────────────────────────────
-- Vyatipath → Vyatipata
UPDATE km_astro_rule_master
SET conditions = REPLACE(conditions::text, '"Vyatipath"', '"Vyatipata"')::jsonb
WHERE conditions::text LIKE '%Vyatipath%';

-- Vaidhrati → Vaidhriti
UPDATE km_astro_rule_master
SET conditions = REPLACE(conditions::text, '"Vaidhrati"', '"Vaidhriti"')::jsonb
WHERE conditions::text LIKE '%Vaidhrati%';

-- Normalise yog key → yoga key for consistency
UPDATE km_astro_rule_master
SET conditions = (conditions - 'yog') || jsonb_build_object('yoga', conditions->>'yog')
WHERE conditions ? 'yog' AND NOT conditions ? 'yoga';

-- ── Vedh map corrections ───────────────────────────────────────
-- Fix vedh_of values that use wrong spellings
UPDATE km_astro_rule_master SET conditions = REPLACE(conditions::text, '"Mula"', '"Moola"')::jsonb WHERE conditions::text LIKE '%"Mula"%' AND rule_type = 'vedh';
UPDATE km_astro_rule_master SET conditions = REPLACE(conditions::text, '"Dhanistha"', '"Dhanishta"')::jsonb WHERE conditions::text LIKE '%Dhanistha%' AND rule_type = 'vedh';

-- ── VERIFY ─────────────────────────────────────────────────────
-- V1: Check no old spellings remain
SELECT rule_code, conditions
FROM km_astro_rule_master
WHERE conditions::text LIKE '%Mrigasira%'
   OR conditions::text LIKE '%"Mula"%'
   OR conditions::text LIKE '%Vyatipath"%'
   OR conditions::text LIKE '%Vaidhrati%'
   OR conditions::text LIKE '%"yog"%';

-- V2: Spot check corrected rules
SELECT rule_code, conditions
FROM km_astro_rule_master
WHERE rule_code IN (
  'HEM-BST-TRN','HEM-DAK-TRN',
  'YOG-VYA-SAT-BEA','PNK-VAI-BUL',
  'VDH-SAT-MRI-BUL','VDH-SAT-MOO-BEA',
  'TR-MAR-DHA-BEA'
)
ORDER BY rule_code;
