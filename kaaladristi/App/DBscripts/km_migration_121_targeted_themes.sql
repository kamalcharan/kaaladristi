-- ============================================================
-- Migration 121 · Targeted Theme Discovery Columns
--
-- Extends km_discovered_themes (migration 120) for the new
-- theme-name-driven discovery mode:
--   source : 'auto'     — signal-first clustering (existing flow)
--            'targeted' — admin typed a theme name; LLM classified
--                         the full liquid universe against it
--   detail : JSONB { core: [{symbol, company_name, role}],
--                    ecosystem: [{symbol, company_name, role}] }
--            — core vs ecosystem split for targeted rows
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

ALTER TABLE km_discovered_themes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto'
    CHECK (source IN ('auto', 'targeted')),
  ADD COLUMN IF NOT EXISTS detail JSONB;

NOTIFY pgrst, 'reload schema';

COMMIT;
