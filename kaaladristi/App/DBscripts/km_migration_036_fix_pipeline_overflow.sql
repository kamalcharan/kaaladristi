-- ============================================================
-- Migration 036 · Fix pipeline coverage overflow + industry RLS
--
-- Two issues discovered 2026-04-15:
--
-- 1. coverage_pct NUMERIC(5,2) overflows when multi-date RPC
--    results are divided by single-date expected counts, producing
--    values > 999.99%. Widen to NUMERIC(7,2) (max 99999.99%).
--
-- 2. km_industry_eod still has RLS enabled. The
--    compute_all_industry_composites RPC runs as the caller's role
--    (no SECURITY DEFINER). If the role isn't in the RLS policy,
--    INSERT fails with "new row violates row-level security policy".
--    This table contains computed aggregates with no user-specific
--    data — RLS provides zero security benefit here.
-- ============================================================

-- ── 1. Widen coverage_pct to prevent overflow ─────────────────
ALTER TABLE km_pipeline_runs
  ALTER COLUMN coverage_pct TYPE NUMERIC(7,2);

COMMENT ON COLUMN km_pipeline_runs.coverage_pct
  IS 'rows_count / rows_expected * 100. May exceed 100% when RPC processes multi-date windows. Capped at 999.99 in Python.';


-- ── 2. Disable RLS on computed aggregate tables ───────────────
-- These contain no user-specific data. RLS creates permission bugs
-- with zero security benefit (see LESSONS_LEARNED.md).
ALTER TABLE km_industry_eod DISABLE ROW LEVEL SECURITY;

-- Also ensure breadth tables don't have the same issue
ALTER TABLE km_market_breadth DISABLE ROW LEVEL SECURITY;
ALTER TABLE km_breadth_roc DISABLE ROW LEVEL SECURITY;


NOTIFY pgrst, 'reload schema';
