-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 222 — the scanner category "Events" becomes "Filing Intelligence"
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Owner call, 2026-09-24. "Events" said nothing: every scanner on the page is
-- an event of some kind. "Filing Intelligence" names where the rows come from.
--
-- ⚠ THE LABEL CHANGES, THE ID DOES NOT. `category = 'events'` is an ADDRESS —
-- it keys the category strip, `?setup=` links and PRESET_COL_OVERRIDES. Renaming
-- the id would break every saved link for a cosmetic gain.
--
-- ⚠ THIS MUST MOVE WITH THE FRONTEND ARRAY, IN THE SAME CHANGE.
-- `getPresetMeta()` reads `kd_scan_presets` FIRST and only falls back to
-- SCAN_PRESETS in scanEngine.ts. Editing one and not the other leaves the page
-- rendering whichever copy happens to answer — the same trap migration 218 hit
-- with `universe`, and the `is_etf` column before it.
--
-- Holds no data, creates nothing, touches one column on one row today.
-- Owner runs it in pgAdmin. No REFRESH, no backfill.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE kd_scan_presets
   SET category_label = 'Filing Intelligence',
       updated_at     = now()
 WHERE category = 'events'
   AND category_label IS DISTINCT FROM 'Filing Intelligence';

COMMIT;

-- Verify — expect every 'events' preset to read 'Filing Intelligence'.
-- SELECT id, name, category, category_label, category_sort
--   FROM kd_scan_presets WHERE category = 'events' ORDER BY sort_order;
