-- Migration 150: add the short-window Magic RS columns to km_index_eod
--
-- Reported 2026-07-14: backfilling index Magic RS via
--   SELECT * FROM compute_all_magic_rs('km_index_eod','index_id', 8, '<date>')
-- fails with: column "magic_rs_short" of relation "km_index_eod" does not exist.
--
-- ROOT CAUSE: compute_magic_rs_batch computes BOTH a long (144-day) and a short
-- (21-day) Magic RS and its UPDATE statements ALWAYS write the short trio
-- (magic_rs_short, magic_rs_short_ma, magic_rs_short_zone). km_equity_eod has
-- those columns; km_index_eod only ever got the long trio (magic_rs,
-- magic_rs_sma144, magic_ma, magic_rs_zone). So the generic RPC errors on the
-- index table even though it was built to run on it.
--
-- Add the missing columns (double precision to match the index table's existing
-- magic_rs / magic_rs_sma144, which are double precision — km_equity_eod uses
-- numeric, but the RPC writes float8 values either way). Idempotent.
--
-- After this runs, the backfill above succeeds and the daily index_magic_rs
-- pipeline step (added 2026-07-14) populates these each day.
--
-- Target database: kaala_dristi_db

BEGIN;

ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS magic_rs_short      double precision;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS magic_rs_short_ma   double precision;
ALTER TABLE km_index_eod ADD COLUMN IF NOT EXISTS magic_rs_short_zone text;

NOTIFY pgrst, 'reload schema';

COMMIT;
