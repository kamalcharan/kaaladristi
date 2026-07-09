-- Migration 142: grant SELECT on km_index_constituents to logged-in users
--
-- Reported 2026-07-09: Sector Rotation → index detail → Constituents / Flow
-- Map tabs show "Unable to load flow data" / empty constituent list for
-- regular users, while admin sees them fine.
--
-- ROOT CAUSE (confirmed — this migration fixed it for all users):
-- km_index_constituents was created in migration 022 with RLS enabled and a
-- permissive read policy (FOR SELECT USING (true)) but NO table-level GRANT
-- statements. The historical blanket grant script that gave 'authenticated'
-- (and anon/kd_app) SELECT on every other data table simply MISSED this one
-- table. Logged-in browser users run PostgREST queries as the DB role
-- 'authenticated' (verified from a live user JWT: role claim = "authenticated"
-- for a profile-role='user' account — the running kd_auth_login issues
-- 'authenticated', the migration-003 behavior, not the profile role). So
-- 'authenticated' hit 'permission denied for table km_index_constituents',
-- while admin worked via its broader/owner privileges.
--
-- Both the Overview → Constituents table (useIndexConstituents) and the Flow
-- Map tab (fetchConstituentFlowMap) hard-depend on this table, which is why
-- both broke. The Chart tab reads km_index_eod (already granted) and was
-- unaffected. RLS was NOT the cause — 'SET ROLE authenticated; SELECT
-- count(*) FROM km_index_constituents' returns all rows fine; the only gap
-- was the missing table GRANT.
--
-- The GRANT loop below is idempotent and guarded on role existence, so it
-- runs cleanly regardless of which role names exist. The decisive line for
-- this bug is 'GRANT SELECT ... TO authenticated'. NOTIFY reloads PostgREST.
--
-- Target database: kaala_dristi_db

BEGIN;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anon', 'kd_app', 'admin', 'kd_readonly']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON km_index_constituents TO %I', r);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
