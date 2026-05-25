-- Migration 088: user_frameworks table
-- Target: kaala_dristi_db
-- Run manually in pgAdmin / DBeaver / psql

CREATE TABLE user_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Framework',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  instruments TEXT[] NOT NULL DEFAULT ARRAY['NIFTY50'],
  blocks JSONB NOT NULL DEFAULT '[]',
  chart_overlays JSONB NOT NULL DEFAULT '[]',
  template_id TEXT,
  tier_at_creation TEXT NOT NULL DEFAULT 'free'
);

CREATE INDEX ON user_frameworks (user_id);
CREATE INDEX ON user_frameworks (updated_at DESC);

-- RLS: users can only read/write their own framework
ALTER TABLE user_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_framework" ON user_frameworks
  USING (user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid);
