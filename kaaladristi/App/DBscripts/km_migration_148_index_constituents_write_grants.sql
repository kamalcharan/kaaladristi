-- Migration 148: grant write privileges on km_index_constituents to logged-in
-- users (custom-index create / manage)
--
-- Reported 2026-07-14: saving a custom index fails with
--   "permission denied for table km_index_constituents"
--
-- ROOT CAUSE (confirmed against live grants):
-- Custom-index create (CustomIndexCreatePage) and manage (CustomIndexManagePage)
-- write constituents via DIRECT PostgREST INSERT/DELETE on km_index_constituents.
-- Logged-in browser users run PostgREST as the DB role 'authenticated' (the
-- running kd_auth_login issues role="authenticated" — see migration 142's notes
-- and LESSONS_LEARNED). Migration 142 granted 'authenticated' only SELECT on
-- this table (it was the read-access fix). No write privilege was ever granted,
-- so INSERT/DELETE hit a table-level "permission denied" — BEFORE row-level
-- security is even evaluated (a GRANT denial, distinct from RLS's
-- "new row violates row-level security policy").
--
-- Two layers must be cleared for a write to land:
--   1. Table GRANT  — lets the 'authenticated' role ATTEMPT the command.
--   2. RLS policy   — km_index_constituents has RLS enabled with
--                     idx_const_write (FOR ALL USING is_admin()), so the write
--                     only actually succeeds for admins. is_admin() resolves the
--                     caller's profile via auth.uid() (JWT sub), independent of
--                     the DB role, so this stays admin-only after the grant.
-- Granting write to 'authenticated' is therefore SAFE: RLS still restricts real
-- writes to admins. This mirrors the intended design already in place on the
-- sibling table km_index_symbols (authenticated = arwd).
--
-- The INSERT also needs USAGE on the id sequence — the id column defaults to
-- nextval('km_index_constituents_id_seq'), and 'authenticated' had no grant on
-- that sequence (nextval would fail with "permission denied for sequence").
--
-- Plain GRANTs (no DO/LOOP) so this runs in any client, including ones that
-- naively split on ';' and can't parse a dollar-quoted block. Roles
-- authenticated/admin/kd_app all exist on this deployment, so no existence
-- guard is needed; GRANT is idempotent. NOTIFY reloads PostgREST's cache.
--
-- Table-level write. RLS (idx_const_write USING is_admin()) remains the real
-- authorization gate — these grants only let the role ATTEMPT the command.
-- Sequence USAGE is required because the id column defaults to nextval().
--
-- Target database: kaala_dristi_db

BEGIN;

GRANT INSERT, UPDATE, DELETE ON km_index_constituents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON km_index_constituents TO admin;
GRANT INSERT, UPDATE, DELETE ON km_index_constituents TO kd_app;

GRANT USAGE, SELECT ON SEQUENCE km_index_constituents_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE km_index_constituents_id_seq TO admin;
GRANT USAGE, SELECT ON SEQUENCE km_index_constituents_id_seq TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;
