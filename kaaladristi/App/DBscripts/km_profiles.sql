-- ============================================================================
-- KALA-DRISHTI: User Profiles + Auth
-- Run this in Supabase SQL Editor AFTER enabling Auth in your project
-- ============================================================================

-- 1. Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS km_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    display_name TEXT,
    email       TEXT,
    phone       TEXT,
    avatar_url  TEXT,
    role        TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    onboarded   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.km_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_updated ON km_profiles;
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON km_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Row Level Security
ALTER TABLE km_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON km_profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (but not role)
CREATE POLICY "Users can update own profile"
    ON km_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
    ON km_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM km_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update any profile (including role)
CREATE POLICY "Admins can update any profile"
    ON km_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM km_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- To make the first admin: after signing up, run manually:
-- UPDATE km_profiles SET role = 'admin' WHERE email = 'your-email@example.com';
-- ============================================================================
