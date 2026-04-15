-- ============================================================
-- Migration 037 · Ensure all indicator columns are FLOAT8
--
-- The indicator columns on km_index_eod and km_equity_eod may
-- have been created with constrained NUMERIC types (e.g.,
-- NUMERIC(10,2)) by an older schema setup. When OBV accumulates
-- over 300 bars of 400M+ volume, or when RSS spread reaches
-- large absolute values, constrained NUMERIC overflows.
--
-- This migration ALTERs every numeric indicator column to FLOAT8
-- on both EOD tables. FLOAT8 handles ±1.8e308 — no overflow
-- possible with financial data.
--
-- Safe to run multiple times (ALTER TYPE to same type is a no-op
-- if already FLOAT8).
-- ============================================================

-- ╔════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Diagnostic — check current column types          ║
-- ║  Run this SELECT first to see what's wrong:               ║
-- ║                                                           ║
-- ║  SELECT column_name, data_type, numeric_precision,        ║
-- ║         numeric_scale                                     ║
-- ║  FROM information_schema.columns                          ║
-- ║  WHERE table_name = 'km_index_eod'                        ║
-- ║    AND column_name IN ('obv','obv_sma_20','rvol','tvol',  ║
-- ║        'sma_8','rsi_14','sniper_inst','rss_spread',       ║
-- ║        'magic_rs','magic_rs_sma144','magic_ma')           ║
-- ║  ORDER BY column_name;                                    ║
-- ║                                                           ║
-- ║  Any row showing numeric_precision IS NOT NULL = problem  ║
-- ╚════════════════════════════════════════════════════════════╝


-- ── km_index_eod: ensure FLOAT8 on all indicator columns ─────

-- SMAs
ALTER TABLE km_index_eod ALTER COLUMN sma_8   TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_10  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_21  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_40  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_50  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_55  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_89  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_150 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_200 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sma_233 TYPE FLOAT8;

-- Oscillators
ALTER TABLE km_index_eod ALTER COLUMN rsi_14 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN rsi_9  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN mfi_14 TYPE FLOAT8;

-- ATR
ALTER TABLE km_index_eod ALTER COLUMN atr_10 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN atr_14 TYPE FLOAT8;

-- OBV (most likely overflow candidate — accumulates volume)
ALTER TABLE km_index_eod ALTER COLUMN obv       TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN obv_sma_20 TYPE FLOAT8;

-- Volume ratios
ALTER TABLE km_index_eod ALTER COLUMN rvol TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN tvol TYPE FLOAT8;

-- Pivots
ALTER TABLE km_index_eod ALTER COLUMN pivot_pp TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN pivot_r1 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN pivot_r2 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN pivot_r3 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN pivot_s1 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN pivot_s2 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN pivot_s3 TYPE FLOAT8;

-- Sniper Dragon
ALTER TABLE km_index_eod ALTER COLUMN sniper_inst TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sniper_hot  TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN sniper_rsi  TYPE FLOAT8;

-- RSS
ALTER TABLE km_index_eod ALTER COLUMN rss_spread TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN rss_value  TYPE FLOAT8;

-- MagicRS
ALTER TABLE km_index_eod ALTER COLUMN magic_rs       TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN magic_rs_sma144 TYPE FLOAT8;
ALTER TABLE km_index_eod ALTER COLUMN magic_ma        TYPE FLOAT8;


-- ── km_equity_eod: same treatment ────────────────────────────

-- SMAs
ALTER TABLE km_equity_eod ALTER COLUMN sma_8   TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_10  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_21  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_40  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_50  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_55  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_89  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_150 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_200 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sma_233 TYPE FLOAT8;

-- Oscillators
ALTER TABLE km_equity_eod ALTER COLUMN rsi_14 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN rsi_9  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN mfi_14 TYPE FLOAT8;

-- ATR
ALTER TABLE km_equity_eod ALTER COLUMN atr_10 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN atr_14 TYPE FLOAT8;

-- OBV
ALTER TABLE km_equity_eod ALTER COLUMN obv       TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN obv_sma_20 TYPE FLOAT8;

-- Volume ratios
ALTER TABLE km_equity_eod ALTER COLUMN rvol TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN tvol TYPE FLOAT8;

-- Pivots
ALTER TABLE km_equity_eod ALTER COLUMN pivot_pp TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN pivot_r1 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN pivot_r2 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN pivot_r3 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN pivot_s1 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN pivot_s2 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN pivot_s3 TYPE FLOAT8;

-- Sniper Dragon
ALTER TABLE km_equity_eod ALTER COLUMN sniper_inst TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sniper_hot  TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN sniper_rsi  TYPE FLOAT8;

-- RSS
ALTER TABLE km_equity_eod ALTER COLUMN rss_spread TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN rss_value  TYPE FLOAT8;

-- MagicRS
ALTER TABLE km_equity_eod ALTER COLUMN magic_rs       TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN magic_rs_sma144 TYPE FLOAT8;
ALTER TABLE km_equity_eod ALTER COLUMN magic_ma        TYPE FLOAT8;


-- ── Notify PostgREST ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
