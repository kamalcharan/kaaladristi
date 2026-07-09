-- Migration 143: sweep — mirror 'authenticated' SELECT grants onto the
-- profile roles "user" and admin, across every table/view in public.
--
-- Context: migration 096 made PostgREST execute logged-in browser queries
-- as the PROFILE DB role ('admin' / 'user') instead of 'authenticated'.
-- Historically, table read access was granted with a blanket script that
-- listed (anon, authenticated, kd_app, admin, kd_readonly) but NEVER the
-- 'user' role. Result: every such table is readable anonymously (anon) and
-- by admin, but DENIED to logged-in non-admin users. This surfaced one
-- table at a time as bug reports:
--   * migration 137 — km_rule_patterns / km_rule_inference (Patterns tab)
--   * migration 142 — km_index_constituents (Constituents / Flow Map tabs)
-- Confirmed live 2026-07-09: km_index_constituents grants listed anon,
-- authenticated, admin, kd_app, kd_readonly, vikuna_admin — but no "user".
--
-- Rather than keep patching one table per bug report, this migration heals
-- the whole class in one pass: for EVERY table/view/matview in schema
-- public that the 'authenticated' role can already SELECT, grant SELECT to
-- "user" and admin too.
--
-- SAFETY: this NEVER grants more than 'authenticated' already has — it only
-- mirrors existing read access onto the roles that PostgREST now actually
-- runs as. Tables that withhold SELECT from 'authenticated' (relying on
-- grant-withholding for privacy) stay withheld from "user" as well. Tables
-- that grant 'authenticated' + rely on RLS for row scoping keep their RLS:
-- policies apply to "user" identically, so row-level protection is intact.
-- SELECT only — writes for user-owned tables (frameworks, profiles) keep
-- their own explicit grants + RLS and are untouched here.
--
-- Idempotent (re-granting an existing privilege is a no-op) and guarded on
-- role existence, so it runs cleanly on any instance.
--
-- Target database: kaala_dristi_db

BEGIN;

DO $$
DECLARE
  obj               record;
  has_authenticated boolean;
  has_user          boolean;
  has_admin         boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_authenticated;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'user')          INTO has_user;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin')         INTO has_admin;

  IF NOT has_authenticated THEN
    RAISE NOTICE 'Role "authenticated" not present; nothing to mirror. Skipping.';
    RETURN;
  END IF;

  FOR obj IN
    SELECT c.oid, c.relname
    FROM   pg_class     c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  n.nspname = 'public'
      AND  c.relkind IN ('r','v','m','p')          -- table, view, matview, partitioned table
      AND  has_table_privilege('authenticated', c.oid, 'SELECT')
  LOOP
    IF has_user THEN
      EXECUTE format('GRANT SELECT ON public.%I TO %I', obj.relname, 'user');
    END IF;
    IF has_admin THEN
      EXECUTE format('GRANT SELECT ON public.%I TO %I', obj.relname, 'admin');
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
