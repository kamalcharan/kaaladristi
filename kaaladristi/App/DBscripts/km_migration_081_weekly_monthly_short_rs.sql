-- ============================================================
-- Migration 081 · Add short MagicRS columns to weekly/monthly
--
-- compute_magic_rs_batch (migration 069) writes three short-RS
-- columns in addition to the long-RS columns. km_equity_weekly
-- and km_equity_monthly were created before migration 069 and
-- are missing these columns, causing the batch RPC to fail.
-- ============================================================

BEGIN;

ALTER TABLE km_equity_weekly
  ADD COLUMN IF NOT EXISTS magic_rs_short      NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_short_ma   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_short_zone VARCHAR(20)
    CHECK (magic_rs_short_zone IS NULL OR magic_rs_short_zone IN (
      'Strong Bull', 'Mild Bull', 'Neutral Bull',
      'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
    ));

ALTER TABLE km_equity_monthly
  ADD COLUMN IF NOT EXISTS magic_rs_short      NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_short_ma   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS magic_rs_short_zone VARCHAR(20)
    CHECK (magic_rs_short_zone IS NULL OR magic_rs_short_zone IN (
      'Strong Bull', 'Mild Bull', 'Neutral Bull',
      'Neutral', 'Neutral Bear', 'Mild Bear', 'Strong Bear'
    ));

NOTIFY pgrst, 'reload schema';

COMMIT;
