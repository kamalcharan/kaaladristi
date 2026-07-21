-- km_migration_160_mercury_launch_catalog_scope.sql
-- Target: kaala_dristi_db
--
-- Mercury-slice launch catalog scope — Variant B (owner sign-off 2026-07-21,
-- per MERCURY_SLICE_PLAN.md §2/§4). A prior cleanup already applied strict
-- Variant A (Mercury-only: 18 rules visible); this migration moves the live
-- state to Variant B and finishes the pending W2/W4 hygiene:
--
--   1. Un-hide the 6 healthy slow-planet almanac rules (Mars/Jupiter/Saturn
--      journeys + retrogrades). Gives the almanac its seasonal backdrop
--      ("Mercury combust inside Saturn retrograde") and lets saved
--      MajorTransit group overlays regain their non-Mercury bands.
--      All 6 verified healthy on 2026-07-21: live future windows on each.
--   2. W2 — deactivate the 3 broken/dead Mercury rules (already hidden, but
--      still is_active): CON-NEP-MER-BUL (data_source unavailable, 0 windows),
--      VOL-MOO-MER-D9-VOL (0 windows), SP-ARI-JUP-MER-BEA (5 windows, all
--      expired 2024).
--   3. W4 — hide the 5 DN-*-MER nakshatra-vara day rules pending hypothesis
--      review: degenerate 0%/100% confidence at n>50 is a matched-derivation
--      artifact, and rendering "Strong 100%" in Catalog overclaims. They stay
--      is_active so nightly confidence scoring continuity is preserved for
--      the review.
--
-- After this migration the Catalog shows 19 rules: 13 Mercury + 6 almanac.
-- No DELETEs anywhere (km_rule_transits/km_rule_patterns CASCADE from the
-- master table — flags only, per the risk notes in MERCURY_SLICE_PLAN.md).

BEGIN;

-- 1. Variant B: restore the 6 slow-planet almanac rules (expect 6 rows)
UPDATE km_astro_rule_master
SET catalog_visible = true, updated_at = now()
WHERE rule_code IN ('TRN-MAR-MAN-TRN','TRN-JUP-MAN-TRN','TRN-SAT-MAN-TRN',
                    'TR-MAR-RET','TR-JUP-RET','TR-SAT-RET');

-- 2. W2: deactivate the broken/dead rules (expect 3 rows)
UPDATE km_astro_rule_master
SET is_active = false, catalog_visible = false, updated_at = now()
WHERE rule_code IN ('CON-NEP-MER-BUL','VOL-MOO-MER-D9-VOL','SP-ARI-JUP-MER-BEA');

-- 3. W4: hide the degenerate-confidence day rules, keep scoring alive (expect 5 rows)
UPDATE km_astro_rule_master
SET catalog_visible = false, updated_at = now()
WHERE rule_code IN ('DN-MON-MER-BUL','DN-TUE-MER-BEA','DN-WED-MER-BUL',
                    'DN-THU-MER-VOL','DN-FRI-MER-VOL');

-- Verification (run before COMMIT; abort on mismatch):
--   SELECT COUNT(*) FROM km_astro_rule_master
--   WHERE NOT is_deleted AND catalog_visible;   -- expect 19
--   SELECT COUNT(*) FROM km_astro_rule_master
--   WHERE NOT is_deleted AND catalog_visible
--     AND tags && ARRAY['Mercury'];             -- expect 13

COMMIT;
