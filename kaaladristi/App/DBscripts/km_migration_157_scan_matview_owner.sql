-- km_migration_157_scan_matview_owner.sql
-- Target DB: kaala_dristi_db
--
-- Fix: pipeline `scan_refresh` failed with "permission denied for materialized
-- view km_scan_results". REFRESH MATERIALIZED VIEW requires OWNERSHIP of the
-- view (there is no GRANT REFRESH), but migrations 147 created these matviews
-- owned by vikuna_admin (the migration runner), while the pipeline connects as
-- kd_app. Transfer ownership of the two scan matviews to kd_app so the daily
-- scan_refresh step can refresh them. Grants and definitions are preserved.
--
-- Must be run by the current owner (vikuna_admin) or a superuser.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kd_app') THEN
    IF to_regclass('public.km_scan_results') IS NOT NULL THEN
      EXECUTE 'ALTER MATERIALIZED VIEW km_scan_results OWNER TO kd_app';
    END IF;
    IF to_regclass('public.km_scan_exclusion_counts') IS NOT NULL THEN
      EXECUTE 'ALTER MATERIALIZED VIEW km_scan_exclusion_counts OWNER TO kd_app';
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verify (owner should now be kd_app):
--   SELECT relname, pg_get_userbyid(relowner) AS owner FROM pg_class
--   WHERE relname IN ('km_scan_results','km_scan_exclusion_counts');
