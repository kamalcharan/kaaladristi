-- ============================================================
-- Migration 012 · API Session Management
-- Stores auto-generated Breeze session tokens + sync status
-- ============================================================

CREATE TABLE IF NOT EXISTS km_api_sessions (
  id            SERIAL PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'breeze',
  api_key_hint  TEXT,                         -- last 6 chars of API key (for display)
  session_token TEXT,
  status        TEXT NOT NULL DEFAULT 'disconnected',  -- connected / expired / error / disconnected
  last_error    TEXT,
  connected_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_api_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_api_sessions_updated ON km_api_sessions;
CREATE TRIGGER trg_api_sessions_updated
  BEFORE UPDATE ON km_api_sessions
  FOR EACH ROW EXECUTE FUNCTION set_api_session_updated_at();

-- Permissions
GRANT ALL ON km_api_sessions TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_api_sessions_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
