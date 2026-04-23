-- Migration 059: Panchang Day Notes table
-- Manual admin annotations per trading day.
-- Multiple rows per date are allowed (one per scope/label combination).
-- Admins CRUD these via /admin/panchang to enrich the 2026 panchang view.

CREATE TYPE panchang_note_scope AS ENUM (
    'market',       -- whole market (e.g. NIFTY, broad indices)
    'sector',       -- a specific NSE sector (e.g. 'Banking', 'IT')
    'commodity',    -- gold, silver, crude …
    'planet',       -- planetary effect (e.g. 'Jupiter', 'Venus')
    'currency'      -- currency pair (e.g. 'USDINR')
);

CREATE TYPE panchang_calendar_label AS ENUM (
    'POSITIVE',
    'NEGATIVE',
    'VOLATILE',
    'MAJOR_POSITIVE',
    'SUDDEN_SPURT'
);

CREATE TABLE IF NOT EXISTS km_panchang_day_notes (
    id              SERIAL          PRIMARY KEY,
    trade_date      DATE            NOT NULL REFERENCES km_panchang_calendar(trade_date) ON DELETE CASCADE,

    calendar_label  panchang_calendar_label NOT NULL,

    scope           panchang_note_scope     NOT NULL DEFAULT 'market',
    scope_value     TEXT,                       -- e.g. 'Banking', 'Gold', 'Jupiter'; NULL for market scope

    annotation      TEXT,                       -- free-text note

    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_panchang_day_notes_date ON km_panchang_day_notes(trade_date);

CREATE OR REPLACE FUNCTION km_panchang_day_notes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_panchang_day_notes_updated_at ON km_panchang_day_notes;
CREATE TRIGGER trg_panchang_day_notes_updated_at
    BEFORE UPDATE ON km_panchang_day_notes
    FOR EACH ROW EXECUTE FUNCTION km_panchang_day_notes_set_updated_at();

-- PostgREST access: all authenticated users can read; only admins write (enforced in API layer)
GRANT SELECT ON km_panchang_day_notes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON km_panchang_day_notes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE km_panchang_day_notes_id_seq TO authenticated;
