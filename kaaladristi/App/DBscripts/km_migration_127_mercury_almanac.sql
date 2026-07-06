-- ============================================================================
-- Migration 127 — Mercury Almanac: motion rule + unified 'Mercury' tag
-- Target database: kaala_dristi_db
--
-- Context (owner, 2026-07-06): Mercury rules surface on /rules filtered by
-- tag 'Mercury'; whatever is published there reflects into Catalog → Astro
-- rules. The reference almanac (Mercury Motion / Combust & Rise / Journey)
-- needs one rule that does not exist yet: plain Mercury retrograde motion
-- periods (only the combined retrogrades TR-JUP-MER-RET-BUL and
-- TR-MER-VEN-RET-BUL exist today). Combust (TR-MER-CMB-E-BEA) and sign
-- journey (TRN-MER-MAN-TRN) windows already exist.
--
-- After running this migration, generate the new rule's windows:
--   cd App/backend/scripts
--   DB_PRIMARY=... python3 generate_mercury_windows.py
-- ============================================================================

-- ── Step 1: Insert the Mercury Retrograde motion rule ───────────────────────

INSERT INTO km_astro_rule_master
  (rule_code, rule_type, display_name, planet_1, planet_2,
   base_bias, probability_label, tags,
   is_active, catalog_visible, is_deleted, remarks)
VALUES
(
  'TR-MER-RET',
  'planet_state',
  'Mercury Retrograde — Motion Periods',
  'Mercury', null,
  'turning', 'High',
  ARRAY['Mercury', 'Motion'],
  true, true, false,
  'Plain Mercury retrograde windows (~3 weeks, 3-4 times/year). Information-flow disruption: data revisions, policy U-turns, execution risk. Historically a caution window for new positions rather than a directional signal. Alternating with direct periods this forms the Mercury Motion almanac.'
)
ON CONFLICT (rule_code) DO NOTHING;

-- ── Step 2: Unified 'Mercury' tag on every Mercury rule ─────────────────────
-- Idempotent (same pattern as migration 101's Bayer tagging).

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Mercury')
WHERE rule_code IN (
  'TR-MER-RET',
  'TRN-MER-MAN-TRN',
  'TRN-MER-RIS-W-BUL',
  'CON-SUN-MER-TRN',
  'CON-MER-VEN-CD-BEA',
  'TR-MER-CMB-E-BEA',
  'TR-JUP-MER-RET-BUL',
  'TR-MER-VEN-RET-BUL',
  'BAY-R02-MAR-MER-SPD',
  'BAY-R27-MER-SPD',
  'DN-MON-MER-BUL',
  'DN-TUE-MER-BEA',
  'DN-WED-MER-BUL',
  'DN-THU-MER-VOL',
  'DN-FRI-MER-VOL'
)
AND NOT ('Mercury' = ANY(tags));

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT rule_code, display_name, tags FROM km_astro_rule_master
-- WHERE 'Mercury' = ANY(tags) ORDER BY rule_code;
