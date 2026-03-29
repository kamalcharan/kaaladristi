-- ============================================================================
-- KĀLA-DRISHTI: Migration 001 — Data Engine Schema
-- Adds: exchange/TRI columns, adjusted price columns, corporate actions,
--        intraday tables (15m), sync log
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- 1. MASTER TABLE EXTENSIONS
-- ============================================================================

-- Equity masters: add exchange, bse_code, isin
ALTER TABLE km_equity_symbols ADD COLUMN IF NOT EXISTS exchange TEXT DEFAULT 'NSE';
ALTER TABLE km_equity_symbols ADD COLUMN IF NOT EXISTS bse_code TEXT;
ALTER TABLE km_equity_symbols ADD COLUMN IF NOT EXISTS isin TEXT;

-- Index masters: add exchange, is_tri
ALTER TABLE km_index_symbols ADD COLUMN IF NOT EXISTS exchange TEXT DEFAULT 'NSE';
ALTER TABLE km_index_symbols ADD COLUMN IF NOT EXISTS is_tri BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. ADJUSTED PRICE COLUMNS ON EQUITY EOD
-- ============================================================================
-- Indices don't need adjustment (NSE adjusts them automatically)

ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS adj_factor NUMERIC DEFAULT 1.0;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS adj_open NUMERIC;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS adj_high NUMERIC;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS adj_low NUMERIC;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS adj_close NUMERIC;

-- ============================================================================
-- 3. CORPORATE ACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_corporate_actions (
    id              BIGSERIAL PRIMARY KEY,
    equity_id       INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    ex_date         DATE NOT NULL,
    action_type     TEXT NOT NULL,       -- 'BONUS', 'SPLIT', 'DIVIDEND', 'DEMERGER', 'RIGHTS'
    ratio_from      NUMERIC,             -- e.g. 2 for 2:1 bonus (2 new for 1 old)
    ratio_to        NUMERIC,             -- e.g. 1
    old_fv          NUMERIC,             -- old face value (splits)
    new_fv          NUMERIC,             -- new face value (splits)
    dividend_amt    NUMERIC,             -- per share (dividends)
    adj_factor      NUMERIC NOT NULL,    -- multiplier for pre-ex-date prices
    source          TEXT DEFAULT 'BSE',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(equity_id, ex_date, action_type)
);

CREATE INDEX IF NOT EXISTS idx_corp_actions_symbol ON km_corporate_actions(symbol);
CREATE INDEX IF NOT EXISTS idx_corp_actions_ex_date ON km_corporate_actions(ex_date);
CREATE INDEX IF NOT EXISTS idx_corp_actions_equity ON km_corporate_actions(equity_id);

ALTER TABLE km_corporate_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corp_actions_read" ON km_corporate_actions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "corp_actions_admin_write" ON km_corporate_actions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. INTRADAY TABLES (15-minute candles)
-- ============================================================================
-- Separate tables per asset type (not a generic interval column)
-- Schema created now, populated in Phase 2

CREATE TABLE IF NOT EXISTS km_index_15m (
    id          BIGSERIAL PRIMARY KEY,
    index_id    INTEGER NOT NULL REFERENCES km_index_symbols(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    open        NUMERIC,
    high        NUMERIC,
    low         NUMERIC,
    close       NUMERIC,
    volume      BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(index_id, ts)
);

CREATE INDEX IF NOT EXISTS idx_index_15m_ts ON km_index_15m(ts);
CREATE INDEX IF NOT EXISTS idx_index_15m_index ON km_index_15m(index_id);

ALTER TABLE km_index_15m ENABLE ROW LEVEL SECURITY;

CREATE POLICY "index_15m_read" ON km_index_15m
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "index_15m_admin_write" ON km_index_15m
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


CREATE TABLE IF NOT EXISTS km_equity_15m (
    id          BIGSERIAL PRIMARY KEY,
    equity_id   INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    open        NUMERIC,
    high        NUMERIC,
    low         NUMERIC,
    close       NUMERIC,
    volume      BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(equity_id, ts)
);

CREATE INDEX IF NOT EXISTS idx_equity_15m_ts ON km_equity_15m(ts);
CREATE INDEX IF NOT EXISTS idx_equity_15m_equity ON km_equity_15m(equity_id);

ALTER TABLE km_equity_15m ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equity_15m_read" ON km_equity_15m
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equity_15m_admin_write" ON km_equity_15m
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. DATA SYNC LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS km_data_sync_log (
    id              BIGSERIAL PRIMARY KEY,
    sync_type       TEXT NOT NULL,        -- 'eod_equity', 'eod_index', 'intraday_equity', 'intraday_index', 'corp_actions'
    symbol          TEXT NOT NULL,
    exchange        TEXT NOT NULL DEFAULT 'NSE',
    from_date       DATE,
    to_date         DATE,
    rows_fetched    INTEGER DEFAULT 0,
    rows_upserted   INTEGER DEFAULT 0,
    status          TEXT NOT NULL,        -- 'success', 'failed', 'partial', 'no_data'
    error_msg       TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_type ON km_data_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_symbol ON km_data_sync_log(symbol);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON km_data_sync_log(created_at);

ALTER TABLE km_data_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_read" ON km_data_sync_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "sync_log_admin_write" ON km_data_sync_log
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- DONE. Run this in Supabase SQL Editor.
-- All statements are idempotent (safe to re-run).
-- ============================================================================
