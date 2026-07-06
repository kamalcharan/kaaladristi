-- ============================================================================
-- Migration 128 — Mars Almanac: motion + journey rules, unified 'Mars' tag
-- Target database: kaala_dristi_db
--
-- Context (owner, 2026-07-06): same almanac pattern as Mercury (migration
-- 127) — /rules tag filter 'Mars' groups the family, each rule's Almanac
-- tab shows its forward window calendar.
--
-- Mars inventory before this migration:
--   6x MAR-GAN-*         Gandanta transitions (migration 102) — no Mars tag
--   BAY-R02-MAR-MER-SPD  Mars-Mercury speed differential — no Mars tag
--   BAY-R06-MAR-1635     Mars at 16°35' any sign            — no Mars tag
--   TR-MAR-DHA-BEA       Mars in Dhanishta nakshatra         — no Mars tag
-- Missing entirely: plain retrograde motion rule, sign-transit ("Journey
-- of Mars") rule — this migration adds both.
--
-- Deliberately NOT added: a Mars combust rule. Combustion angle thresholds
-- are planet-specific and Mercury/Venus are the classically tracked
-- combustible planets — no confirmation Mars combust data is meaningfully
-- populated. Revisit if/when confirmed.
--
-- After running this migration, generate the two new rules' windows:
--   cd App/backend/scripts
--   DB_PRIMARY=... python3 generate_mars_windows.py
-- ============================================================================

-- ── Step 1: Insert the two missing Mars rules ───────────────────────────────

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'TR-MAR-RET',
  'planet_state',
  'Mars Retrograde — Motion Periods',
  'Mars', null,
  'turning', 'High',
  ARRAY['Mars', 'Motion'],
  true, true, false,
  'Plain Mars retrograde windows (~10 weeks, roughly every 2 years). Momentum reverses — the accelerator becomes the brake. Historically a distribution/topping process for momentum-driven sectors; choppy and mean-reverting for the duration. Alternating with direct periods this forms the Mars Motion almanac.'
),
(
  'TRN-MAR-MAN-TRN',
  'planet_transit',
  'Mars Sign Transit — Journey of Mars',
  'Mars', null,
  'turning', 'Reasonable',
  ARRAY['Mars', 'Journey'],
  true, true, false,
  'Mars sign-by-sign transit calendar (Journey of Mars). Each sign ingress reads Mars-ruled sector strength (defence, energy, metals, engineering) through the lens of the entered sign — own sign / exalted signs strongest, debilitated sign weakest.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Step 2: Unified 'Mars' tag on every Mars rule ───────────────────────────
-- Idempotent (same pattern as migrations 101/127).

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Mars')
WHERE rule_code IN (
  'TR-MAR-RET',
  'TRN-MAR-MAN-TRN',
  'TR-MAR-DHA-BEA',
  'BAY-R02-MAR-MER-SPD',
  'BAY-R06-MAR-1635',
  'MAR-GAN-ARI-REV',
  'MAR-GAN-CAN-BEA',
  'MAR-GAN-LEO-REV',
  'MAR-GAN-SCO-BEA',
  'MAR-GAN-SAG-REV',
  'MAR-GAN-PIS-BEA'
)
AND NOT ('Mars' = ANY(tags));

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT rule_code, display_name, tags FROM km_astro_rule_master
-- WHERE 'Mars' = ANY(tags) ORDER BY rule_code;
