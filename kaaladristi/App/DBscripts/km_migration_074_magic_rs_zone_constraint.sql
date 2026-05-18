-- ============================================================
-- Migration 074 · MagicRS Zone CHECK Constraint
--
-- Cleans any stale / mis-cased zone values that slipped in
-- before the RPC was stabilised (migrations 026 / 070), then
-- adds a CHECK constraint so future writes are validated at
-- the DB level.
--
-- Applies to both km_equity_eod and km_index_eod.
-- ============================================================

BEGIN;

-- ── 1. Null-out any value that is not in the canonical set ────
--   (safer than trying to map unknown values to a zone)

-- Zone vocabulary after migration 069: Neutral is directional.
-- 'Neutral' may still appear on exact RS == MA (edge case in migration 070).

UPDATE km_equity_eod
SET magic_rs_zone = NULL
WHERE magic_rs_zone IS NOT NULL
  AND magic_rs_zone NOT IN (
    'Strong Bull', 'Mild Bull', 'Neutral Bull',
    'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
  );

UPDATE km_index_eod
SET magic_rs_zone = NULL
WHERE magic_rs_zone IS NOT NULL
  AND magic_rs_zone NOT IN (
    'Strong Bull', 'Mild Bull', 'Neutral Bull',
    'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
  );

-- ── 2. Add CHECK constraints ──────────────────────────────────

ALTER TABLE km_equity_eod
  DROP CONSTRAINT IF EXISTS km_equity_eod_magic_rs_zone_check;

ALTER TABLE km_equity_eod
  ADD CONSTRAINT km_equity_eod_magic_rs_zone_check
  CHECK (magic_rs_zone IS NULL OR magic_rs_zone IN (
    'Strong Bull', 'Mild Bull', 'Neutral Bull',
    'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
  ));

ALTER TABLE km_index_eod
  DROP CONSTRAINT IF EXISTS km_index_eod_magic_rs_zone_check;

ALTER TABLE km_index_eod
  ADD CONSTRAINT km_index_eod_magic_rs_zone_check
  CHECK (magic_rs_zone IS NULL OR magic_rs_zone IN (
    'Strong Bull', 'Mild Bull', 'Neutral Bull',
    'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
  ));

NOTIFY pgrst, 'reload schema';

COMMIT;
