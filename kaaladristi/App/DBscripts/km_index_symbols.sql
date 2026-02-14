-- ============================================================================
-- KĀLA-DRISHTI: INDEX SYMBOLS + EOD
-- 93 NSE indices across 5 categories with daily OHLC data
-- Run AFTER km_master_tables.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_index_symbols (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,                   -- e.g. 'NIFTY 50', 'NIFTY BANK'
    category        TEXT NOT NULL CHECK(category IN (
                        'index',
                        'broad market index',
                        'sectoral index',
                        'strategy market index',
                        'thematic market index'
                    )),
    trade_date      DATE NOT NULL,
    open            NUMERIC,
    high            NUMERIC,
    low             NUMERIC,
    prev_close      NUMERIC,
    ltp             NUMERIC,                         -- Last Traded Price
    chng            NUMERIC,                         -- Absolute change
    pct_chng        NUMERIC,                         -- % change
    volume          BIGINT,                          -- Volume in shares
    value_cr        NUMERIC,                         -- Value in ₹ Crores
    w52_high        NUMERIC,                         -- 52-week high
    w52_low         NUMERIC,                         -- 52-week low
    d30_pct_chng    NUMERIC,                         -- 30-day % change
    d365_pct_chng   NUMERIC,                         -- 365-day % change
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(name, trade_date)
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_index_symbols_category ON km_index_symbols(category);

-- Index for date-range queries (future multi-day)
CREATE INDEX IF NOT EXISTS idx_index_symbols_trade_date ON km_index_symbols(trade_date);

-- ============================================================================
-- RLS: read-only for all authenticated users
-- ============================================================================
ALTER TABLE km_index_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "index_symbols_read" ON km_index_symbols
    FOR SELECT TO authenticated USING (true);

-- Admin-only insert/update/delete
CREATE POLICY "index_symbols_admin_write" ON km_index_symbols
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
    );
