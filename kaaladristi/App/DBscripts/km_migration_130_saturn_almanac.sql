-- ============================================================================
-- Migration 130 — Saturn Almanac: motion + journey rules, unified 'Saturn' tag
-- Target database: kaala_dristi_db
--
-- Context (owner, 2026-07-06): same almanac pattern as Mercury (127), Mars
-- (128), Jupiter (129) — /rules tag filter 'Saturn' groups the family,
-- each rule's Almanac tab shows its forward window calendar.
--
-- Saturn inventory before this migration (none tagged 'Saturn'):
--   VDH-SAT-MOO-BEA   vedh    Saturn Vedh of Moola     — bearish, market-wide
--   VDH-SAT-MRI-BUL   vedh    Saturn Vedh of Mrigashira — bullish, Mars sectors
--   YOG-VYA-SAT-BEA   compound Vyatipata Yoga on Saturday — bearish
-- Missing entirely: plain retrograde motion rule, sign-transit ("Journey
-- of Saturn") rule — this migration adds both. Per the Finastro framework
-- Saturn is 'the structural framework' — its sign sets the multi-year
-- ceiling/floor rather than a rolling trend (that's Jupiter's role).
--
-- Deliberately NOT added: a Saturn combust rule (same reasoning as Mars/
-- Jupiter — combustion thresholds are planet-specific; Mercury/Venus are
-- the classically tracked combustible planets).
--
-- After running this migration, generate the two new rules' windows:
--   cd App/backend/scripts
--   DB_PRIMARY=... python3 generate_saturn_windows.py
-- ============================================================================

-- ── Step 1: Insert the two missing Saturn rules ─────────────────────────────

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'TR-SAT-RET',
  'planet_state',
  'Saturn Retrograde — Motion Periods',
  'Saturn', null,
  'turning', 'High',
  ARRAY['Saturn', 'Motion'],
  true, true, false,
  'Plain Saturn retrograde windows (~4.5 months, roughly once a year). Structural pressure eases temporarily — a review/reassessment phase for the sign''s ruled sectors rather than a reversal signal. Alternating with direct periods this forms the Saturn Motion almanac.'
),
(
  'TRN-SAT-MAN-TRN',
  'planet_transit',
  'Saturn Sign Transit — Journey of Saturn',
  'Saturn', null,
  'turning', 'High',
  ARRAY['Saturn', 'Journey'],
  true, true, false,
  'Saturn''s sign transit calendar (Journey of Saturn) — the slowest-moving of the four-planet market engine, ~2.5 years per sign. Sets the multi-year structural ceiling/floor for the sign''s ruled sectors: own signs (Capricorn/Aquarius) disciplined structural strength, debilitated (Aries) volatility and leadership rotation. Unlike Jupiter''s rolling annual sector calendar, Saturn defines the arena everything else plays within.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Step 2: Unified 'Saturn' tag on every Saturn rule ───────────────────────
-- Idempotent (same pattern as migrations 101/127/128/129).

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Saturn')
WHERE rule_code IN (
  'TR-SAT-RET',
  'TRN-SAT-MAN-TRN',
  'VDH-SAT-MOO-BEA',
  'VDH-SAT-MRI-BUL',
  'YOG-VYA-SAT-BEA'
)
AND NOT ('Saturn' = ANY(tags));

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT rule_code, display_name, tags FROM km_astro_rule_master
-- WHERE 'Saturn' = ANY(tags) ORDER BY rule_code;
