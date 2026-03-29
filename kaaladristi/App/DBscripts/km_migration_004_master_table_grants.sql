-- ============================================================================
-- KALA-DRISHTI: Grant master table read access to authenticated/anon roles
-- Migration 004 — Run on kaala_dristi_db
-- ============================================================================
--
-- Root cause: Migration 003 (self-hosted auth) added schema-level GRANT USAGE
-- but never granted SELECT on the km_* master tables. PostgREST returns
-- permission-denied / empty results for any authenticated user querying
-- planets, sectors, sector_lords, etc.
--
-- This migration adds the missing grants so the Settings → Sector Lords page
-- (and any other page using master data) works correctly.
-- ============================================================================

-- Master/reference tables: read-only for authenticated + anon
GRANT SELECT ON km_planets          TO anon, authenticated;
GRANT SELECT ON km_nakshatras       TO anon, authenticated;
GRANT SELECT ON km_nakshatra_lords  TO anon, authenticated;
GRANT SELECT ON km_zodiac_signs     TO anon, authenticated;
GRANT SELECT ON km_zodiac_lords     TO anon, authenticated;
GRANT SELECT ON km_days_of_week     TO anon, authenticated;
GRANT SELECT ON km_day_lords        TO anon, authenticated;
GRANT SELECT ON km_sectors          TO anon, authenticated;
GRANT SELECT ON km_sector_lords     TO anon, authenticated;
GRANT SELECT ON km_index_master     TO anon, authenticated;
GRANT SELECT ON km_index_composition TO anon, authenticated;

-- service_role gets full access for backend scripts
GRANT ALL ON km_planets             TO service_role;
GRANT ALL ON km_nakshatras          TO service_role;
GRANT ALL ON km_nakshatra_lords     TO service_role;
GRANT ALL ON km_zodiac_signs        TO service_role;
GRANT ALL ON km_zodiac_lords        TO service_role;
GRANT ALL ON km_days_of_week        TO service_role;
GRANT ALL ON km_day_lords           TO service_role;
GRANT ALL ON km_sectors             TO service_role;
GRANT ALL ON km_sector_lords        TO service_role;
GRANT ALL ON km_index_master        TO service_role;
GRANT ALL ON km_index_composition   TO service_role;

-- Grant on data tables too (if they exist)
DO $$ BEGIN
    EXECUTE 'GRANT SELECT ON km_index_eod TO anon, authenticated';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    EXECUTE 'GRANT SELECT ON km_equity_eod TO anon, authenticated';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    EXECUTE 'GRANT SELECT ON km_index_symbols TO anon, authenticated';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    EXECUTE 'GRANT SELECT ON km_equity_symbols TO anon, authenticated';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================================
-- DONE. The Sector Lords page (and all master data hooks) should now work.
-- ============================================================================
