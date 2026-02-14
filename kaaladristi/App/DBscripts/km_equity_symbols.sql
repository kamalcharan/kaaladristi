-- ============================================================================
-- KĀLA-DRISHTI: EQUITY SYMBOLS + EOD
-- 1,380+ NSE equities with daily OHLC data
-- Each equity tagged with its parent index names (TEXT[])
-- Run AFTER km_index_symbols.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_equity_symbols (
    id              SERIAL PRIMARY KEY,
    symbol          TEXT NOT NULL,                   -- e.g. 'RELIANCE', 'TCS', 'HDFCBANK'
    trade_date      DATE NOT NULL,
    index_names     TEXT[] NOT NULL DEFAULT '{}',    -- e.g. {'NIFTY 50','NIFTY 100','NIFTY OIL & GAS'}
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

    UNIQUE(symbol, trade_date)
);

-- GIN index for array containment queries: WHERE index_names @> ARRAY['NIFTY 50']
CREATE INDEX IF NOT EXISTS idx_equity_index_names ON km_equity_symbols USING GIN(index_names);

-- Index for symbol lookup
CREATE INDEX IF NOT EXISTS idx_equity_symbol ON km_equity_symbols(symbol);

-- Index for date-range queries (future multi-day)
CREATE INDEX IF NOT EXISTS idx_equity_trade_date ON km_equity_symbols(trade_date);

-- ============================================================================
-- RLS: read-only for all authenticated users
-- ============================================================================
ALTER TABLE km_equity_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equity_symbols_read" ON km_equity_symbols
    FOR SELECT TO authenticated USING (true);

-- Admin-only insert/update/delete
CREATE POLICY "equity_symbols_admin_write" ON km_equity_symbols
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin')
    );
