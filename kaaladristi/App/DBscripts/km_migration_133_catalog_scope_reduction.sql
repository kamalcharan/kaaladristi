-- Migration 133: Catalog scope reduction (owner decision, 2026-07-07)
--
-- Owner directive: only Mercury, Mars, Saturn, Jupiter, Bayer, and
-- MajorTransit-tagged rules should appear in Catalog → Astro Rules until
-- the inference/theory layer (migration 134) covers a wider slice of the
-- rule set with real domain content. is_active is untouched — Discovery
-- and the Pattern Engine keep computing on every rule (they still act as
-- context for the 6 active groups, e.g. Bayer windows get stamped with
-- Saturn/Jupiter sign+motion regardless of Catalog visibility).
--
-- Idempotent — safe to re-run. Reversible: SET catalog_visible = true on
-- the same WHERE clause restores prior state.
-- Already applied ad-hoc on the VPS on 2026-07-07; this file makes that
-- change reproducible from a fresh clone.

BEGIN;

UPDATE km_astro_rule_master
SET catalog_visible = false
WHERE catalog_visible = true
  AND NOT (tags && ARRAY['Mercury','Mars','Saturn','Jupiter','Bayer','MajorTransit']);

DO $$
DECLARE v_hidden INTEGER;
BEGIN
  GET DIAGNOSTICS v_hidden = ROW_COUNT;
  RAISE NOTICE 'km_migration_133: % rule(s) removed from Catalog visibility', v_hidden;
END $$;

COMMIT;
