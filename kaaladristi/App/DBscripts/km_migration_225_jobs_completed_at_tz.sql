-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 225 — repair km_jobs.completed_at, shifted 5h30m early
-- Target database: kaala_dristi_db
-- 2026-09-25.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- pipeline2/worker.py wrote `completed_at` from a NAIVE UTC datetime.
-- psycopg2 sends a naive value as a bare timestamp literal, and PostgreSQL
-- resolves a bare literal against the SESSION TimeZone -- Asia/Kolkata here --
-- so every completion instant was stored 5h30m BEFORE it happened.
-- `started_at` was never affected: _claim_job writes it as SQL now().
--
-- Measured before this ran:
--   4,296 rows total
--   4,273 with started_at NOT NULL and completed_at < started_at
--       1 with no started_at and completed_at < created_at (id 935)
--       8 correct (completed_at >= started_at)
--      14 correct, no started_at (cancelled backfills, stamped by the API's
--         own `completed_at = now()`)
--   negative gap range 4h03m .. 5h30m -- i.e. the 5h30m offset minus a job
--   duration of 0 .. 1h27m. No job in the table ran long enough for the bug to
--   produce a POSITIVE gap, so the sign test below is complete for this history.
--
-- ⚠ THE CODE FIX SHIPS WITH THIS FILE. Applying the migration without
-- deploying the backend leaves new rows skewed and this repair half-true;
-- deploying the backend without the migration is safe but leaves the history
-- wrong. The worker now writes `completed_at = now()` in SQL (the SQL_NOW
-- sentinel in pipeline2/worker.py), so no Python clock touches this column.
--
-- ⚠ WHY THE 3..6 HOUR BAND, not simply `completed_at < started_at`:
-- the residual after shifting is a few SECONDS in either direction (the app
-- container's clock against the database's), so a bare sign test would
-- re-shift those rows on a second run and break them by another 5h30m. The
-- band is well clear of the residual and well clear of any real job duration,
-- which makes this file idempotent: re-running it writes 0 rows.
--
-- Holds no data, adds no column. Owner runs it in pgAdmin.

BEGIN;

-- The two skewed shapes. Both conditions stop being true once the row is
-- corrected, which is what makes a re-run a no-op.
UPDATE km_jobs
   SET completed_at = completed_at + INTERVAL '5 hours 30 minutes'
 WHERE completed_at IS NOT NULL
   AND started_at   IS NOT NULL
   AND (started_at - completed_at) BETWEEN INTERVAL '3 hours' AND INTERVAL '6 hours';

UPDATE km_jobs
   SET completed_at = completed_at + INTERVAL '5 hours 30 minutes'
 WHERE completed_at IS NOT NULL
   AND started_at   IS NULL
   AND (created_at - completed_at) BETWEEN INTERVAL '3 hours' AND INTERVAL '6 hours';

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
-- Expect skewed = 0 and a sane duration spread:
--
--   SELECT count(*) FILTER (WHERE completed_at < started_at)              AS still_negative,
--          count(*) FILTER (WHERE (started_at - completed_at)
--                                 BETWEEN INTERVAL '3 hours' AND INTERVAL '6 hours') AS skewed,
--          max(completed_at - started_at)                                 AS longest_job,
--          min(completed_at - started_at)                                 AS shortest_job
--     FROM km_jobs
--    WHERE completed_at IS NOT NULL AND started_at IS NOT NULL;
--
-- `still_negative` may be a handful of rows off by SECONDS -- that is the app
-- host's clock against the database's, not this bug, and it is deliberately
-- left alone. `skewed` MUST be 0.
--
-- Then confirm the guard this unblocks can now see a fresh failure:
--
--   SELECT id, dimension, trade_date, status, started_at, completed_at
--     FROM km_jobs
--    WHERE status = 'failed' AND completed_at > now() - INTERVAL '120 minutes';
--
-- Before the fix that query could not return a row that had just failed.
