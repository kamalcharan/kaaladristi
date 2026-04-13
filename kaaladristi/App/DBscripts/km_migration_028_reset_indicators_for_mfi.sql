-- ============================================================
-- Migration 028 · Reset indicators_computed_at for MFI backfill
--
-- Migration 027 patched compute_indicators_batch() to compute
-- mfi_14 and include it in the UPDATE. However, the UPDATE has
-- a guard: "WHERE indicators_computed_at IS NULL". Rows already
-- computed (with mfi_14 = NULL) won't be re-processed.
--
-- This migration NULLs out indicators_computed_at for rows from
-- 2026-03-25 onward so the next compute_all_pending_indicators()
-- run will recompute them with MFI included.
--
-- NOTE: Does NOT touch rows before 2026-03-25 — those would need
-- a separate full recompute if MFI is needed historically.
-- ============================================================

-- ── Index EOD ──
UPDATE km_index_eod
SET indicators_computed_at = NULL
WHERE trade_date >= '2026-03-25'
  AND indicators_computed_at IS NOT NULL;

-- ── Equity EOD ──
UPDATE km_equity_eod
SET indicators_computed_at = NULL
WHERE trade_date >= '2026-03-25'
  AND indicators_computed_at IS NOT NULL;
