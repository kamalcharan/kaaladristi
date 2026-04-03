-- ============================================================================
-- KALA-DRISHTI: DC Inference — Fix RLS + Grants
-- Migration 004b — Run after 004 to correct role permissions
-- ============================================================================
--
-- Root cause: JWT tokens use role='authenticated' (set in kd_generate_token),
-- but migration 004 granted to 'kd_app'/'anon' instead.
-- All other tables (km_index_symbols, etc.) correctly use TO authenticated.
-- ============================================================================

-- ── Drop wrong policies from 004 ─────────────────────────────────────────────

DROP POLICY IF EXISTS "dc_inference_select" ON dc_inference;
DROP POLICY IF EXISTS "dc_inference_insert" ON dc_inference;
DROP POLICY IF EXISTS "dc_inference_update" ON dc_inference;
DROP POLICY IF EXISTS "dc_inference_delete" ON dc_inference;

-- ── Correct RLS policies — mirror pattern of km_index_symbols etc. ───────────

CREATE POLICY "dc_inference_read" ON dc_inference
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "dc_inference_write" ON dc_inference
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Correct grants ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON dc_inference TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE dc_inference_id_seq TO authenticated;

-- ── Force PostgREST schema reload ─────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
