-- ============================================================================
-- KĀLA-DRISHTI: CLEAN REBUILD — Index & Equity tables (new schema)
-- Drops old tables and recreates with separated master + EOD structure
-- Run this ONCE in Supabase SQL Editor, then run the seed files
-- ============================================================================

-- ── Drop everything (order matters due to FKs) ──
DROP TABLE IF EXISTS km_index_eod CASCADE;
DROP TABLE IF EXISTS km_equity_eod CASCADE;
DROP TABLE IF EXISTS km_index_symbols CASCADE;
DROP TABLE IF EXISTS km_equity_symbols CASCADE;

-- ============================================================================
-- MASTER TABLES (identity only, no OHLC)
-- ============================================================================

-- ── Index Masters ──
CREATE TABLE km_index_symbols (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    category    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE km_index_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "index_symbols_read" ON km_index_symbols
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "index_symbols_admin_write" ON km_index_symbols
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Equity Masters ──
CREATE TABLE km_equity_symbols (
    id          SERIAL PRIMARY KEY,
    symbol      TEXT NOT NULL UNIQUE,
    index_names TEXT[],
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equity_index_names ON km_equity_symbols USING GIN (index_names);

ALTER TABLE km_equity_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equity_symbols_read" ON km_equity_symbols
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equity_symbols_admin_write" ON km_equity_symbols
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- EOD TABLES (time-series OHLC data)
-- ============================================================================

-- ── Index EOD ──
CREATE TABLE km_index_eod (
    id              SERIAL PRIMARY KEY,
    index_id        INTEGER NOT NULL REFERENCES km_index_symbols(id) ON DELETE CASCADE,
    trade_date      DATE NOT NULL,
    open            NUMERIC,
    high            NUMERIC,
    low             NUMERIC,
    close           NUMERIC,
    prev_close      NUMERIC,
    chng            NUMERIC,
    pct_chng        NUMERIC,
    volume          BIGINT,
    value_cr        NUMERIC,
    w52_high        NUMERIC,
    w52_low         NUMERIC,
    d30_pct_chng    NUMERIC,
    d365_pct_chng   NUMERIC,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(index_id, trade_date)
);

CREATE INDEX idx_index_eod_date ON km_index_eod(trade_date);
CREATE INDEX idx_index_eod_index ON km_index_eod(index_id);

ALTER TABLE km_index_eod ENABLE ROW LEVEL SECURITY;

CREATE POLICY "index_eod_read" ON km_index_eod
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "index_eod_admin_write" ON km_index_eod
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Equity EOD ──
CREATE TABLE km_equity_eod (
    id              SERIAL PRIMARY KEY,
    equity_id       INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    trade_date      DATE NOT NULL,
    open            NUMERIC,
    high            NUMERIC,
    low             NUMERIC,
    close           NUMERIC,
    prev_close      NUMERIC,
    chng            NUMERIC,
    pct_chng        NUMERIC,
    volume          BIGINT,
    value_cr        NUMERIC,
    w52_high        NUMERIC,
    w52_low         NUMERIC,
    d30_pct_chng    NUMERIC,
    d365_pct_chng   NUMERIC,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(equity_id, trade_date)
);

CREATE INDEX idx_equity_eod_date ON km_equity_eod(trade_date);
CREATE INDEX idx_equity_eod_equity ON km_equity_eod(equity_id);

ALTER TABLE km_equity_eod ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equity_eod_read" ON km_equity_eod
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equity_eod_admin_write" ON km_equity_eod
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- DONE. Run seed files next:
--   1. km_seed_masters.sql      (93 indices + 1380 equities)
--   2. km_seed_index_eod.sql    (93 index EOD rows)
--   3. km_seed_equity_eod_part1.sql through part3.sql
-- ============================================================================
