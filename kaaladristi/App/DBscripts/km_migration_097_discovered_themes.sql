-- ============================================================
-- Migration 097 · Discovered Themes Staging Table
--
-- Persists AI Discover (Path 2) results so recommendations
-- survive navigation / page reloads and the LLM does not need
-- to be re-invoked to see past suggestions.
--
-- Lifecycle: status 'new' → 'used' (converted to a custom index)
--                        → 'dismissed' (admin rejected it)
-- The Discover page lists status='new' rows on mount.
--
-- Written by POST /api/custom-index/discover (backend only);
-- read/updated via GET/PATCH /api/custom-index/themes.
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS km_discovered_themes (
  id                   SERIAL PRIMARY KEY,
  theme_name           TEXT        NOT NULL,
  description          TEXT,
  rationale            TEXT,
  constituent_symbols  TEXT[]      NOT NULL DEFAULT '{}',
  llm                  TEXT        NOT NULL,               -- 'claude' | 'qwen'
  stock_count          INT,                                -- universe size at discovery time
  status               TEXT        NOT NULL DEFAULT 'new'  -- 'new' | 'used' | 'dismissed'
                       CHECK (status IN ('new', 'used', 'dismissed')),
  used_index_id        INT REFERENCES km_index_symbols(id),-- set when converted to a custom index
  discovered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovered_themes_status
  ON km_discovered_themes (status, discovered_at DESC);

GRANT SELECT, INSERT, UPDATE ON km_discovered_themes TO kd_app;
GRANT USAGE ON SEQUENCE km_discovered_themes_id_seq TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;
