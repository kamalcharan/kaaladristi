-- ============================================================================
-- Migration 223 — Standouts + Standouts · Caution scanner presets
-- ============================================================================
-- Target: kaala_dristi_db.  Owner runs this in pgAdmin.
-- Holds NO DATA, creates NO TABLE, touches NO matview. Two rows.
-- Nothing to REFRESH, nothing to backfill.
--
-- WHAT IT IS
-- ----------
-- A stock is a standout when SEVERAL SCANNERS ON ONE SIDE flag it while it sits
-- in a basket the catalog already curates. It collapses the two-step the
-- product forces today — read the sector flow, then drill into the index to
-- find the names — into one list.
--
-- Membership is DERIVED ON READ in `fetchStandouts` (services/scanEngine.ts):
-- km_scan_results x km_index_constituents, resolved and deduped. No column, no
-- matview arm, no nightly job. Storing it would be a second implementation of
-- a rule whose inputs already live in the matview.
--
-- ⚠ THE GATE IS 2, AND IT IS MEASURED — NOT CHOSEN.
-- Counting presets blind mixes direction: breakdown_watch + power_sell +
-- distribution_warning is three presets and is the opposite of a standout. Split
-- by `vani_side`, over every basket on the 2026-09-24 bar (1,526 stocks after
-- the ISIN resolve):
--
--     min presets   strength   caution   ON BOTH SIDES
--     >= 1             440        488         79
--     >= 2             164        188          0
--     >= 3              59         76          0
--
-- At >= 1, seventy-nine stocks carry a strength AND a caution flag at once. At
-- >= 2 that conflict vanishes entirely, so the threshold is the point where
-- direction becomes unambiguous. The list then sorts by agreement descending,
-- so the >= 3 set leads without an arbitrary top-N cut.
--
-- ⚠ NOT MEASURED: whether preset-count predicts anything. It is a membership
-- rule with a workable distribution and it ships as an OBSERVATION. The RS
-- study is the standing reminder — rs_percentile's top decile scored WORSE than
-- its second bucket across 153,556 windows, so "more of a good ranking is
-- better" is precisely the assumption that has already failed here.
--
-- ⚠ vani_side IS NULL ON BOTH ROWS, DELIBERATELY.
-- The fetcher SELECTS on vani_side to decide which presets count. A value here
-- would make Standouts count itself — the preset would feed its own input.
-- pead_drift already carries NULL for the same class of reason (it stays out of
-- the Workspace Discovery union). Do not "complete" these rows.
--
-- ⚠ ITS OWN CATEGORY, sort 7. Standouts is the only preset whose membership is
-- a function of the OTHER presets. Dropped into Market it would hold rows from
-- Price Action siblings, and a category strip reads as ALTERNATIVES, not as one
-- tab containing the others — every badge count would double-count. Same reason
-- pead_drift got its own category rather than joining Price Action.
--
-- ⚠ THE ARRAY AND THIS TABLE MOVE TOGETHER. getPresetMeta() reads
-- kd_scan_presets FIRST and falls back to SCAN_PRESETS only offline, so editing
-- one leaves the page rendering whichever copy answers (the migration-218
-- `universe` trap). The matching SCAN_PRESETS entries ship in the same change.
--
-- BSE: admitted (universe NSE_BSE). BSE data is NOT the limitation — on the
-- 2026-09-24 bar BSE carried 4,114 active bars against NSE's 3,380, with 99%
-- ema_20 and BETTER mcap_cr coverage. `delivery_pct` is the single gap (0 of
-- 4,114). BSE is scarce in scanners because 12 of 17 presets are NSE-scoped,
-- and in the 5 that are not, BSE OUTNUMBERS NSE. Nothing here should imply BSE
-- data is weak.
-- ============================================================================

BEGIN;

INSERT INTO public.kd_scan_presets
  (id, name, description, tooltip, sort_order, result_limit, is_active,
   category, category_label, category_color, category_sort,
   universe, timeframe, vani_rule, is_default_tab, vani_side)
VALUES
  ('standouts',
   'Standouts',
   'Stocks inside a curated basket that several scanners are flagging on the same side',
   'Names carried by at least two strength scanners at once, inside an index basket from the catalog. Sorted by how many scanners agree. Two is the measured floor: at one, 79 stocks carried a strength and a caution flag simultaneously; at two that conflict disappears. Agreement is an observation, not a forecast.',
   710, 200, TRUE,
   'standouts', 'Standouts', '#8b5cf6', 7,
   'NSE_BSE', 'daily', NULL, TRUE, NULL),

  ('standouts_caution',
   'Standouts · Caution',
   'Stocks inside a curated basket that several scanners are flagging as weakening',
   'The same rule read on the caution side: names carried by at least two weakening scanners at once, inside an index basket from the catalog. Shown beside the strength list on purpose — surfacing strength while hiding risk is the asymmetry this product refuses.',
   720, 200, TRUE,
   'standouts', 'Standouts', '#8b5cf6', 7,
   'NSE_BSE', 'daily', NULL, FALSE, NULL)
ON CONFLICT (id) DO UPDATE SET
  name            = EXCLUDED.name,
  description     = EXCLUDED.description,
  tooltip         = EXCLUDED.tooltip,
  sort_order      = EXCLUDED.sort_order,
  result_limit    = EXCLUDED.result_limit,
  is_active       = EXCLUDED.is_active,
  category        = EXCLUDED.category,
  category_label  = EXCLUDED.category_label,
  category_color  = EXCLUDED.category_color,
  category_sort   = EXCLUDED.category_sort,
  universe        = EXCLUDED.universe,
  timeframe       = EXCLUDED.timeframe,
  vani_rule       = EXCLUDED.vani_rule,
  is_default_tab  = EXCLUDED.is_default_tab,
  vani_side       = EXCLUDED.vani_side,
  updated_at      = now();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verification ────────────────────────────────────────────────────────────
-- Both rows present, in their own category, with vani_side NULL:
--
--   SELECT id, name, category, category_sort, universe, vani_side, is_default_tab
--     FROM kd_scan_presets WHERE category = 'standouts' ORDER BY sort_order;
--
-- vani_side MUST read NULL on both. If either is 'strength' or 'caution', the
-- preset is counting itself and the list is wrong.
