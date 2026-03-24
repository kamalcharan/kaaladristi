-- ============================================================================
-- KĀLA-DRISHTI: Migration 002 — Multi-Exchange Support
-- Enables BSE/MCX/future exchanges in km_equity_symbols
-- Creates commodity tables for MCX
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS checks)
-- ============================================================================

-- ============================================================================
-- 1. CHANGE UNIQUE CONSTRAINT: symbol → (symbol, exchange)
--    Allows RELIANCE on both NSE and BSE as separate rows
-- ============================================================================

-- Drop old unique constraint (symbol only)
ALTER TABLE km_equity_symbols DROP CONSTRAINT IF EXISTS km_equity_symbols_symbol_key;

-- Add new composite unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'km_equity_symbols_symbol_exchange_key'
    ) THEN
        ALTER TABLE km_equity_symbols
            ADD CONSTRAINT km_equity_symbols_symbol_exchange_key UNIQUE(symbol, exchange);
    END IF;
END $$;

-- Composite index for symbol+exchange lookups
CREATE INDEX IF NOT EXISTS idx_equity_symbol_exchange
    ON km_equity_symbols(symbol, exchange);

-- ============================================================================
-- 2. UPDATE SEED SQL: ON CONFLICT must match new constraint
--    The old seed used ON CONFLICT (symbol) — now it needs (symbol, exchange)
--    Existing NSE rows already have exchange='NSE' (default), so no data fix needed.
-- ============================================================================

-- Ensure all existing rows have exchange set (in case any NULLs slipped in)
UPDATE km_equity_symbols SET exchange = 'NSE' WHERE exchange IS NULL;

-- ============================================================================
-- 3. COMMODITY MASTER TABLE (MCX, future commodity exchanges)
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_commodity_symbols (
    id              SERIAL PRIMARY KEY,
    symbol          TEXT NOT NULL,                   -- e.g. 'CRUDEOIL', 'GOLD', 'SILVER'
    name            TEXT,                            -- e.g. 'Crude Oil', 'Gold'
    exchange        TEXT NOT NULL DEFAULT 'MCX',     -- MCX, NCDEX, etc.
    category        TEXT,                            -- e.g. 'energy', 'metals', 'agriculture'
    lot_size        INTEGER,                         -- contract lot size
    tick_size       NUMERIC,                         -- minimum price movement
    vendor_codes    JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(symbol, exchange)
);

CREATE INDEX IF NOT EXISTS idx_commodity_symbol ON km_commodity_symbols(symbol);
CREATE INDEX IF NOT EXISTS idx_commodity_exchange ON km_commodity_symbols(exchange);
CREATE INDEX IF NOT EXISTS idx_commodity_vendor_codes ON km_commodity_symbols USING GIN(vendor_codes);

ALTER TABLE km_commodity_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commodity_symbols_read" ON km_commodity_symbols
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "commodity_symbols_admin_write" ON km_commodity_symbols
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. COMMODITY EOD TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_commodity_eod (
    id              SERIAL PRIMARY KEY,
    commodity_id    INTEGER NOT NULL REFERENCES km_commodity_symbols(id) ON DELETE CASCADE,
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
    open_interest   BIGINT,                          -- OI specific to commodities
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(commodity_id, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_commodity_eod_date ON km_commodity_eod(trade_date);
CREATE INDEX IF NOT EXISTS idx_commodity_eod_commodity ON km_commodity_eod(commodity_id);

ALTER TABLE km_commodity_eod ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commodity_eod_read" ON km_commodity_eod
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "commodity_eod_admin_write" ON km_commodity_eod
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- DONE. Final additions:
--
-- km_equity_symbols:    UNIQUE(symbol) → UNIQUE(symbol, exchange)
-- km_commodity_symbols: id, symbol, name, exchange, category, lot_size, tick_size, vendor_codes
-- km_commodity_eod:     id, commodity_id (FK), trade_date, OHLCV + open_interest
--
-- Next steps:
--   1. Run populate_bse_symbols.py to seed 5000+ BSE equities
--   2. Run populate_mcx_symbols.py to seed MCX commodities
--   3. Use breeze_downloader.py --exchange BSE to download BSE EOD
-- ============================================================================
