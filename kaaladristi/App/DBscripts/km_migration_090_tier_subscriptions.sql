-- Migration 090: Add tier to km_profiles + create user_subscriptions
-- Next migration number was 089 but two 089s already exist; using 090.

-- 1. Add tier column to km_profiles
ALTER TABLE km_profiles
  ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'trial', 'quarterly', 'annual', 'beta'));

-- 2. All existing users are beta testers
UPDATE km_profiles SET tier = 'beta';

-- 3. user_subscriptions table
CREATE TABLE user_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES km_profiles(id) ON DELETE CASCADE,
  tier         TEXT        NOT NULL CHECK (tier IN ('free', 'trial', 'quarterly', 'annual', 'beta')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON user_subscriptions(user_id);

-- RLS — uses same JWT pattern as migration 088 (self-hosted, no auth schema)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_subscriptions"
  ON user_subscriptions FOR SELECT
  USING (
    user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
  );

-- Backend writes directly via psycopg2 (bypasses RLS); this policy covers
-- any future PostgREST writes with a service-level JWT.
CREATE POLICY "service_manage_subscriptions"
  ON user_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
