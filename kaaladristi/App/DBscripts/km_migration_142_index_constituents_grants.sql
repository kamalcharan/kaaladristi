-- Migration 142: grant km_index_constituents to profile roles
--
-- Root cause (reported 2026-07-09: Sector Rotation → index detail →
-- Constituents / Flow Map tabs show "Unable to load flow data" / empty
-- constituent list for regular users, while admin sees them fine):
-- km_index_constituents was created back in migration 022 with RLS enabled
-- and a permissive read policy (FOR SELECT USING (true)) but NO table-level
-- GRANT statements. Migration 096 later patched kd_auth_login to embed the
-- PROFILE role ('admin' / 'user') as the JWT role claim — so PostgREST now
-- executes logged-in browser queries as DB role admin/user, NOT
-- 'authenticated'. The 'admin' role retained access (broader grants), but
-- the 'user' role was never granted SELECT, so every logged-in non-admin
-- got 'permission denied for table km_index_constituents'.
--
-- Both the Overview → Constituents table (useIndexConstituents) and the
-- Flow Map tab (fetchConstituentFlowMap) hard-depend on this table, which is
-- why both broke for users. The Chart tab reads km_index_eod (already
-- granted) and is unaffected.
--
-- Same bug class as migration 137 (km_rule_patterns / km_rule_inference);
-- same fix. LESSON for every future migration: new PostgREST-read tables
-- must grant to the profile roles too, not just authenticated/anon/kd_app.
--
-- Grants are guarded on role existence so this runs cleanly regardless of
-- which role names exist on the instance.
--
-- Target database: kaala_dristi_db

BEGIN;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'user', 'authenticated', 'anon', 'kd_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON km_index_constituents TO %I', r);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
