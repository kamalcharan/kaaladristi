-- Migration 022: km_index_constituents — Index → Equity constituent mapping
--
-- Replaces the deprecated km_index_composition (which FK'd to km_index_master).
-- This table FK's to km_index_symbols (93 indices, production table).
--
-- Populated from km_equity_symbols.index_names[] via the INSERT below.
-- sector and weight_pct are NULL initially — to be enriched later.

CREATE TABLE IF NOT EXISTS km_index_constituents (
    id              SERIAL PRIMARY KEY,
    index_id        INTEGER NOT NULL REFERENCES km_index_symbols(id),
    equity_id       INTEGER NOT NULL REFERENCES km_equity_symbols(id),
    sector          TEXT,
    weight_pct      NUMERIC,
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(index_id, equity_id, snapshot_date)
);

-- Index for fast lookups by index
CREATE INDEX IF NOT EXISTS idx_index_constituents_index_id
    ON km_index_constituents(index_id);

-- Index for fast lookups by equity
CREATE INDEX IF NOT EXISTS idx_index_constituents_equity_id
    ON km_index_constituents(equity_id);

-- RLS: read for authenticated, write for admin
ALTER TABLE km_index_constituents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idx_const_read ON km_index_constituents;
CREATE POLICY idx_const_read ON km_index_constituents
    FOR SELECT USING (true);

DROP POLICY IF EXISTS idx_const_write ON km_index_constituents;
CREATE POLICY idx_const_write ON km_index_constituents
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json ->> 'role' = 'admin'
    );

-- Populate from km_equity_symbols.index_names[] ↔ km_index_symbols.name
-- This unnests the index_names array and joins to find matching index IDs.
INSERT INTO km_index_constituents (index_id, equity_id, snapshot_date)
SELECT DISTINCT
    idx.id          AS index_id,
    eq.id           AS equity_id,
    CURRENT_DATE    AS snapshot_date
FROM   km_equity_symbols eq,
       LATERAL unnest(eq.index_names) AS idx_name
JOIN   km_index_symbols idx ON UPPER(idx.name) = UPPER(idx_name)
WHERE  array_length(eq.index_names, 1) > 0
ON CONFLICT (index_id, equity_id, snapshot_date) DO NOTHING;
