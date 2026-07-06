-- ============================================================================
-- Migration 129 — Jupiter Almanac: motion + journey rules, unified 'Jupiter' tag
-- Target database: kaala_dristi_db
--
-- Context (owner, 2026-07-06): same almanac pattern as Mercury (127) and
-- Mars (128) — /rules tag filter 'Jupiter' groups the family, each rule's
-- Almanac tab shows its forward window calendar.
--
-- Jupiter inventory before this migration: only TR-JUP-MER-RET-BUL exists
-- (Mercury retrograde during a Jupiter-retrograde overlap — fundamentally
-- a Mercury rule, already tagged 'Mercury'). No dedicated Jupiter rule of
-- any kind existed. This is the largest gap of the three planets done so
-- far — Jupiter's annual sign transit is the primary sector-rotation
-- signal per the Finastro framework ("the trend engine").
--
-- Deliberately NOT added: a Jupiter combust rule (same reasoning as Mars
-- in migration 128 — combustion angle thresholds are planet-specific,
-- Mercury/Venus are the classically tracked combustible planets).
--
-- After running this migration, generate the two new rules' windows:
--   cd App/backend/scripts
--   DB_PRIMARY=... python3 generate_jupiter_windows.py
-- ============================================================================

-- ── Step 1: Insert the two missing Jupiter rules ────────────────────────────

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'TR-JUP-RET',
  'planet_state',
  'Jupiter Retrograde — Motion Periods',
  'Jupiter', null,
  'turning', 'High',
  ARRAY['Jupiter', 'Motion'],
  true, true, false,
  'Plain Jupiter retrograde windows (~4 months, roughly once every 13 months). Historically a consolidation/accumulation phase rather than a directional signal — expansion pauses, value investing and fundamental revisiting favoured over growth-at-any-price. Alternating with direct periods this forms the Jupiter Motion almanac.'
),
(
  'TRN-JUP-MAN-TRN',
  'planet_transit',
  'Jupiter Sign Transit — Journey of Jupiter',
  'Jupiter', null,
  'bullish', 'High',
  ARRAY['Jupiter', 'Journey'],
  true, true, false,
  'Jupiter''s annual sign transit — the primary sector-rotation calendar. Each ~12-13 month sign ingress reads sector tailwind through the lens of the entered sign: exalted (Cancer) strongest, debilitated (Capricorn) weakest, own signs (Sagittarius/Pisces) disciplined expansion. The single most important rolling trend signal in the nine-planet hierarchy.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Step 2: Unified 'Jupiter' tag on every Jupiter rule ─────────────────────
-- Idempotent (same pattern as migrations 101/127/128).

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Jupiter')
WHERE rule_code IN (
  'TR-JUP-RET',
  'TRN-JUP-MAN-TRN',
  'TR-JUP-MER-RET-BUL'
)
AND NOT ('Jupiter' = ANY(tags));

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT rule_code, display_name, tags FROM km_astro_rule_master
-- WHERE 'Jupiter' = ANY(tags) ORDER BY rule_code;
