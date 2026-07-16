-- km_migration_162_user_bookmarks.sql
-- Target database: kaala_dristi_db
-- Run manually in pgAdmin / DBeaver / psql
--
-- "My Bookmarks" — per-user saved stock list. Mirrors user_frameworks
-- (migration 088) exactly: same RLS shape, same request.jwt.claims->>'sub'
-- policy, no explicit table GRANTs (Framework's identical setup works
-- without them — access goes exclusively through the FastAPI backend's own
-- DB role via direct psycopg2, never through PostgREST, so PostgREST-role
-- grants like migration 142 needed are not applicable here).

CREATE TABLE km_user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  equity_id INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, equity_id)
);

CREATE INDEX ON km_user_bookmarks (user_id);
CREATE INDEX ON km_user_bookmarks (equity_id);

-- RLS: users can only read/write their own bookmarks
ALTER TABLE km_user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bookmarks" ON km_user_bookmarks
  USING (user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid);
