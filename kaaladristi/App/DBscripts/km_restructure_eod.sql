-- ============================================================================
-- KĀLA-DRISHTI: RESTRUCTURE INDEX & EQUITY TABLES
-- Separates master (identity) from time-series (EOD) data
-- Run in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE NEW EOD TABLES (before altering masters)
-- ============================================================================

-- ── Index EOD ──
CREATE TABLE IF NOT EXISTS km_index_eod (
    id              SERIAL PRIMARY KEY,
    index_id        INTEGER NOT NULL,
    trade_date      DATE NOT NULL,
    open            NUMERIC,
    high            NUMERIC,
    low             NUMERIC,
    close           NUMERIC,                         -- LTP (Last Traded Price)
    prev_close      NUMERIC,
    chng            NUMERIC,
    pct_chng        NUMERIC,
    volume          BIGINT,
    value_cr        NUMERIC,                         -- Value in ₹ Crores
    w52_high        NUMERIC,
    w52_low         NUMERIC,
    d30_pct_chng    NUMERIC,
    d365_pct_chng   NUMERIC,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(index_id, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_index_eod_date ON km_index_eod(trade_date);
CREATE INDEX IF NOT EXISTS idx_index_eod_index ON km_index_eod(index_id);

-- ── Equity EOD ──
CREATE TABLE IF NOT EXISTS km_equity_eod (
    id              SERIAL PRIMARY KEY,
    equity_id       INTEGER NOT NULL,
    trade_date      DATE NOT NULL,
    open            NUMERIC,
    high            NUMERIC,
    low             NUMERIC,
    close           NUMERIC,                         -- LTP
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

CREATE INDEX IF NOT EXISTS idx_equity_eod_date ON km_equity_eod(trade_date);
CREATE INDEX IF NOT EXISTS idx_equity_eod_equity ON km_equity_eod(equity_id);

-- ============================================================================
-- STEP 2: MIGRATE EXISTING OHLC DATA → EOD TABLES
-- ============================================================================

-- Move index OHLC data
INSERT INTO km_index_eod (index_id, trade_date, open, high, low, close, prev_close, chng, pct_chng, volume, value_cr, w52_high, w52_low, d30_pct_chng, d365_pct_chng)
SELECT id, trade_date, open, high, low, ltp, prev_close, chng, pct_chng, volume, value_cr, w52_high, w52_low, d30_pct_chng, d365_pct_chng
FROM km_index_symbols
WHERE trade_date IS NOT NULL
ON CONFLICT (index_id, trade_date) DO NOTHING;

-- Move equity OHLC data
INSERT INTO km_equity_eod (equity_id, trade_date, open, high, low, close, prev_close, chng, pct_chng, volume, value_cr, w52_high, w52_low, d30_pct_chng, d365_pct_chng)
SELECT id, trade_date, open, high, low, ltp, prev_close, chng, pct_chng, volume, value_cr, w52_high, w52_low, d30_pct_chng, d365_pct_chng
FROM km_equity_symbols
WHERE trade_date IS NOT NULL
ON CONFLICT (equity_id, trade_date) DO NOTHING;

-- ============================================================================
-- STEP 3: STRIP OHLC COLUMNS FROM MASTER TABLES
-- ============================================================================

-- Drop the unique constraint that includes trade_date first
ALTER TABLE km_index_symbols DROP CONSTRAINT IF EXISTS km_index_symbols_name_trade_date_key;
ALTER TABLE km_equity_symbols DROP CONSTRAINT IF EXISTS km_equity_symbols_symbol_trade_date_key;

-- Remove OHLC + trade_date columns from index master
ALTER TABLE km_index_symbols
    DROP COLUMN IF EXISTS trade_date,
    DROP COLUMN IF EXISTS open,
    DROP COLUMN IF EXISTS high,
    DROP COLUMN IF EXISTS low,
    DROP COLUMN IF EXISTS prev_close,
    DROP COLUMN IF EXISTS ltp,
    DROP COLUMN IF EXISTS chng,
    DROP COLUMN IF EXISTS pct_chng,
    DROP COLUMN IF EXISTS volume,
    DROP COLUMN IF EXISTS value_cr,
    DROP COLUMN IF EXISTS w52_high,
    DROP COLUMN IF EXISTS w52_low,
    DROP COLUMN IF EXISTS d30_pct_chng,
    DROP COLUMN IF EXISTS d365_pct_chng;

-- Remove OHLC + trade_date columns from equity master
ALTER TABLE km_equity_symbols
    DROP COLUMN IF EXISTS trade_date,
    DROP COLUMN IF EXISTS open,
    DROP COLUMN IF EXISTS high,
    DROP COLUMN IF EXISTS low,
    DROP COLUMN IF EXISTS prev_close,
    DROP COLUMN IF EXISTS ltp,
    DROP COLUMN IF EXISTS chng,
    DROP COLUMN IF EXISTS pct_chng,
    DROP COLUMN IF EXISTS volume,
    DROP COLUMN IF EXISTS value_cr,
    DROP COLUMN IF EXISTS w52_high,
    DROP COLUMN IF EXISTS w52_low,
    DROP COLUMN IF EXISTS d30_pct_chng,
    DROP COLUMN IF EXISTS d365_pct_chng;

-- Add unique constraints on identity columns (dedup masters)
-- First deduplicate any rows that now have identical name/symbol
DELETE FROM km_index_symbols a
    USING km_index_symbols b
    WHERE a.id > b.id AND a.name = b.name;

DELETE FROM km_equity_symbols a
    USING km_equity_symbols b
    WHERE a.id > b.id AND a.symbol = b.symbol;

ALTER TABLE km_index_symbols ADD CONSTRAINT km_index_symbols_name_key UNIQUE(name);
ALTER TABLE km_equity_symbols ADD CONSTRAINT km_equity_symbols_symbol_key UNIQUE(symbol);

-- ============================================================================
-- STEP 4: ADD FOREIGN KEYS (now that masters are clean)
-- ============================================================================

ALTER TABLE km_index_eod
    ADD CONSTRAINT fk_index_eod_index
    FOREIGN KEY (index_id) REFERENCES km_index_symbols(id) ON DELETE CASCADE;

ALTER TABLE km_equity_eod
    ADD CONSTRAINT fk_equity_eod_equity
    FOREIGN KEY (equity_id) REFERENCES km_equity_symbols(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 5: RLS POLICIES FOR EOD TABLES
-- ============================================================================

ALTER TABLE km_index_eod ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_equity_eod ENABLE ROW LEVEL SECURITY;

-- Read for all authenticated
CREATE POLICY "index_eod_read" ON km_index_eod
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equity_eod_read" ON km_equity_eod
    FOR SELECT TO authenticated USING (true);

-- Admin-only write
CREATE POLICY "index_eod_admin_write" ON km_index_eod
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "equity_eod_admin_write" ON km_equity_eod
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM km_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- DONE. Final schema:
--
-- km_index_symbols:  id, name (UNIQUE), category, created_at
-- km_equity_symbols: id, symbol (UNIQUE), index_names[], created_at
-- km_index_eod:      id, index_id (FK), trade_date, OHLC+volume+derived
-- km_equity_eod:     id, equity_id (FK), trade_date, OHLC+volume+derived
-- ============================================================================
