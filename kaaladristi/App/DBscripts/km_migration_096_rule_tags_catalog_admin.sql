-- Migration 096: Add tags column to km_astro_rule_master
-- Target DB: kaala_dristi_db
-- DO NOT RUN — apply manually via pgAdmin / DBeaver / psql

-- Step 1: Add tags column
ALTER TABLE km_astro_rule_master
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Step 2: Seed tags by rule pattern

-- Panchak
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Panchak')
WHERE (rule_code ILIKE '%PNK%')
  AND NOT ('Panchak' = ANY(tags));

-- Mercury
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Mercury')
WHERE (rule_code ILIKE '%MER%')
  AND NOT ('Mercury' = ANY(tags));

-- Retrograde
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Retrograde')
WHERE (rule_code ILIKE '%RET%')
  AND NOT ('Retrograde' = ANY(tags));

-- Conjunction
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Conjunction')
WHERE (rule_code ILIKE 'CON-%' OR rule_type = 'planet_conjunction')
  AND NOT ('Conjunction' = ANY(tags));

-- Nakshatra
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Nakshatra')
WHERE (rule_code ILIKE 'DN-%' OR rule_type = 'nakshatra_vara')
  AND NOT ('Nakshatra' = ANY(tags));

-- Manifestation
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Manifestation')
WHERE (rule_code ILIKE 'TRN-%' OR rule_type = 'planet_manifestation')
  AND NOT ('Manifestation' = ANY(tags));

-- Yoga
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Yoga')
WHERE (rule_code ILIKE 'YOG-%')
  AND NOT ('Yoga' = ANY(tags));

-- Transit
UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Transit')
WHERE (rule_code ILIKE 'TR-%' OR rule_type = 'planet_transit' OR rule_type = 'planet_state')
  AND NOT ('Transit' = ANY(tags));

-- Verify seeding
SELECT unnest(tags) AS tag, COUNT(*)
FROM km_astro_rule_master
GROUP BY tag ORDER BY tag;
