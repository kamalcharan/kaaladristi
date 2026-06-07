-- ============================================================
-- Migration 082 · Fix flow intelligence columns on weekly/monthly
--
-- Two issues with km_equity_weekly and km_equity_monthly:
--
-- 1. vacuum_flag was defined as BOOLEAN but compute_flow_intelligence
--    writes TEXT values ('VACUUM_UP' | 'VACUUM_DOWN' | NULL).
--    Fix: change column type to TEXT.
--
-- 2. volume_divergence_flag is missing entirely. The RPC UPDATE is:
--      SET flow_type=$1, vacuum_flag=$2, volume_divergence_flag=$3, accum_distrib=$4
--    causing "column does not exist".
--    Fix: add volume_divergence_flag TEXT.
-- ============================================================

BEGIN;

-- ── km_equity_weekly ─────────────────────────────────────────

ALTER TABLE km_equity_weekly
  ALTER COLUMN vacuum_flag TYPE TEXT USING NULL;

ALTER TABLE km_equity_weekly
  ADD COLUMN IF NOT EXISTS volume_divergence_flag TEXT;

-- ── km_equity_monthly ────────────────────────────────────────

ALTER TABLE km_equity_monthly
  ALTER COLUMN vacuum_flag TYPE TEXT USING NULL;

ALTER TABLE km_equity_monthly
  ADD COLUMN IF NOT EXISTS volume_divergence_flag TEXT;

NOTIFY pgrst, 'reload schema';

COMMIT;
