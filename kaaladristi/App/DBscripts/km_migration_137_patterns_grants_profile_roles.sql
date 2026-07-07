-- Migration 137: grant km_rule_patterns / km_rule_inference to profile roles
--
-- Root cause (found 2026-07-07 via 'permission denied for table
-- km_rule_patterns' in the Patterns tab): migration 096 patched
-- kd_auth_login to embed the PROFILE role ('admin' / 'user') as the JWT
-- role claim — so PostgREST executes logged-in browser queries as DB role
-- admin/user, NOT 'authenticated'. Any table granted only to
-- (authenticated, anon, kd_app) is readable anonymously but DENIED to
-- logged-in users. km_rule_patterns (132) and km_rule_inference (134)
-- both hit this.
--
-- LESSON for every future migration: new PostgREST-read tables must grant
-- to the profile roles too, not just authenticated/anon/kd_app.
--
-- Grants are guarded on role existence so this runs cleanly regardless of
-- which role names exist on the instance.

BEGIN;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin', 'user', 'authenticated', 'anon', 'kd_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON km_rule_patterns TO %I', r);
      EXECUTE format('GRANT SELECT ON km_rule_inference TO %I', r);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
