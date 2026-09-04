-- Migration 199: grant CRUD on km_user_bookmarks to kd_app (+ authenticated/admin)
--
-- Reported 2026-09-04: saving a position from the VaNi popover ("I hold
-- this" / "Can I enter now?") returns HTTP 500 on every attempt.
--
-- ROOT CAUSE (confirmed against live grants): km_user_bookmarks (migration
-- 153) shipped with RLS enabled + a `users_own_bookmarks` policy, but
-- table-level GRANTs were only ever given to kd_readonly (SELECT). The
-- exact recurring bug class already documented in this project's
-- LESSONS_LEARNED (km_index_constituents, migration 142/148): a table-level
-- GRANT denial happens BEFORE RLS is even evaluated, so this has nothing to
-- do with the `users_own_bookmarks` policy being wrong — the connecting
-- role was never allowed to attempt the command at all.
--
-- /api/bookmarks/* (pipeline2_api.py) reads/writes this table via a direct
-- psycopg2 connection as kd_app (same pattern as /api/framework/*, see
-- _framework_conn()), which had ZERO grants here — GET, POST, DELETE, and
-- PUT .../position all failed identically; live data confirms this (zero
-- rows in km_user_bookmarks — the feature has never once persisted since
-- migration 153 shipped, not something introduced by the new popover pills).
--
-- Granting kd_app/authenticated/admin here is safe: RLS's
-- `users_own_bookmarks USING (user_id = jwt sub)` remains the real
-- per-user gate — these grants only let the role ATTEMPT the command,
-- same reasoning as migration 148. authenticated/admin are included for
-- parity with the rest of this project's tables even though this one is
-- currently FastAPI/kd_app-only, not PostgREST-direct, in case that ever
-- changes.
--
-- id defaults to gen_random_uuid() (not a sequence) — no sequence grant needed.
--
-- Target database: kaala_dristi_db

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON km_user_bookmarks TO kd_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON km_user_bookmarks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON km_user_bookmarks TO admin;

NOTIFY pgrst, 'reload schema';

COMMIT;
