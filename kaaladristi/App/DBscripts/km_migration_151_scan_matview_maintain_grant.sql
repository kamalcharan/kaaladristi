-- Migration 151: grant MAINTAIN on the scanner matviews to the pipeline role
--
-- Reported 2026-07-14: the daily pipeline fails on its last step (scan_refresh)
-- with:  permission denied for materialized view km_scan_results
--
-- ROOT CAUSE: on PostgreSQL 17, REFRESH MATERIALIZED VIEW requires the caller to
-- either OWN the matview or hold the new MAINTAIN privilege. km_scan_results and
-- km_scan_exclusion_counts (migration 147) are owned by vikuna_admin and were
-- granted only SELECT to the app roles — never MAINTAIN. The daily pipeline
-- connects as kd_app (DB_PRIMARY), which is neither the owner nor a MAINTAIN
-- holder, so its `REFRESH MATERIALIZED VIEW CONCURRENTLY km_scan_results` is
-- denied. The handler's CONCURRENTLY→plain fallback doesn't help: a plain REFRESH
-- needs the same privilege.
--
-- FIX: grant MAINTAIN to kd_app (the pipeline role) — least-privilege, PG17-idiomatic
-- (no ownership change needed). admin is included in case a manual fix job runs
-- under it. MAINTAIN is a PostgreSQL 17+ privilege; this server is 17.9.
--
-- Requires no code deploy — applying this migration alone unblocks the daily run.
--
-- Target database: kaala_dristi_db (PostgreSQL 17+)

BEGIN;

GRANT MAINTAIN ON km_scan_results          TO kd_app;
GRANT MAINTAIN ON km_scan_exclusion_counts TO kd_app;

GRANT MAINTAIN ON km_scan_results          TO admin;
GRANT MAINTAIN ON km_scan_exclusion_counts TO admin;

COMMIT;
