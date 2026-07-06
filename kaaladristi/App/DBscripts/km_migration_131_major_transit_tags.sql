-- ============================================================================
-- Migration 131 — Mark the four-planet Motion/Journey rules as MajorTransit
-- Target database: kaala_dristi_db
--
-- Context (owner, 2026-07-06): the 8 almanac rules created in migrations
-- 127-130 (Mercury/Mars/Jupiter/Saturn × Motion/Journey) are the core
-- four-planet market engine. Tag them 'MajorTransit' + 'Transit' (same
-- convention as TR-MER-CMB-E-BEA and the Gandanta rules) and ensure
-- catalog_visible so they surface in Catalog → Astro rules.
-- ============================================================================

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'MajorTransit')
WHERE rule_code IN (
  'TR-MER-RET',  'TRN-MER-MAN-TRN',
  'TR-MAR-RET',  'TRN-MAR-MAN-TRN',
  'TR-JUP-RET',  'TRN-JUP-MAN-TRN',
  'TR-SAT-RET',  'TRN-SAT-MAN-TRN'
)
AND NOT ('MajorTransit' = ANY(tags));

UPDATE km_astro_rule_master
SET tags = array_append(tags, 'Transit')
WHERE rule_code IN (
  'TR-MER-RET',  'TRN-MER-MAN-TRN',
  'TR-MAR-RET',  'TRN-MAR-MAN-TRN',
  'TR-JUP-RET',  'TRN-JUP-MAN-TRN',
  'TR-SAT-RET',  'TRN-SAT-MAN-TRN'
)
AND NOT ('Transit' = ANY(tags));

-- Ensure catalog visibility (already true from the seed migrations —
-- idempotent safety in case any were toggled off during review).
UPDATE km_astro_rule_master
SET catalog_visible = true, is_active = true
WHERE rule_code IN (
  'TR-MER-RET',  'TRN-MER-MAN-TRN',
  'TR-MAR-RET',  'TRN-MAR-MAN-TRN',
  'TR-JUP-RET',  'TRN-JUP-MAN-TRN',
  'TR-SAT-RET',  'TRN-SAT-MAN-TRN'
);

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT rule_code, display_name, tags, catalog_visible
-- FROM km_astro_rule_master
-- WHERE 'MajorTransit' = ANY(tags) ORDER BY rule_code;
