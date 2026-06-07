-- ============================================================
-- Migration 083 · Fix magic_rs_zone CHECK constraint on weekly/monthly
--
-- km_equity_weekly and km_equity_monthly were created with the
-- original 5-value zone set before migration 069 split 'Neutral'
-- into 'Neutral Bull' / 'Neutral Bear'. The CHECK constraint
-- rejects these new values, blocking compute_magic_rs_batch.
--
-- Fix: drop and recreate with the correct 7-value set.
-- ============================================================

BEGIN;

-- ── km_equity_weekly ─────────────────────────────────────────

ALTER TABLE km_equity_weekly
  DROP CONSTRAINT IF EXISTS km_equity_weekly_magic_rs_zone_check;

ALTER TABLE km_equity_weekly
  ADD CONSTRAINT km_equity_weekly_magic_rs_zone_check
  CHECK (magic_rs_zone IS NULL OR magic_rs_zone IN (
    'Strong Bull', 'Mild Bull', 'Neutral Bull',
    'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
  ));

-- ── km_equity_monthly ────────────────────────────────────────

ALTER TABLE km_equity_monthly
  DROP CONSTRAINT IF EXISTS km_equity_monthly_magic_rs_zone_check;

ALTER TABLE km_equity_monthly
  ADD CONSTRAINT km_equity_monthly_magic_rs_zone_check
  CHECK (magic_rs_zone IS NULL OR magic_rs_zone IN (
    'Strong Bull', 'Mild Bull', 'Neutral Bull',
    'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
  ));

NOTIFY pgrst, 'reload schema';

COMMIT;
