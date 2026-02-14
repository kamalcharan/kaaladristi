-- ============================================================================
-- KĀLA-DRISHTI: Fix infinite recursion in RLS policies
-- The admin check on km_profiles references itself → infinite recursion
-- Fix: create a SECURITY DEFINER function to bypass RLS for admin checks
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM km_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Fix km_profiles policies (remove self-referencing)
DROP POLICY IF EXISTS "Admins can read all profiles" ON km_profiles;
CREATE POLICY "Admins can read all profiles"
    ON km_profiles FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any profile" ON km_profiles;
CREATE POLICY "Admins can update any profile"
    ON km_profiles FOR UPDATE
    USING (public.is_admin());

-- 3. Fix km_index_symbols policies
DROP POLICY IF EXISTS "index_symbols_admin_write" ON km_index_symbols;
CREATE POLICY "index_symbols_admin_write" ON km_index_symbols
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Fix km_equity_symbols policies
DROP POLICY IF EXISTS "equity_symbols_admin_write" ON km_equity_symbols;
CREATE POLICY "equity_symbols_admin_write" ON km_equity_symbols
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. Fix km_index_eod policies
DROP POLICY IF EXISTS "index_eod_admin_write" ON km_index_eod;
CREATE POLICY "index_eod_admin_write" ON km_index_eod
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Fix km_equity_eod policies
DROP POLICY IF EXISTS "equity_eod_admin_write" ON km_equity_eod;
CREATE POLICY "equity_eod_admin_write" ON km_equity_eod
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- DONE. Reload the app — the infinite recursion error should be gone.
-- ============================================================================
