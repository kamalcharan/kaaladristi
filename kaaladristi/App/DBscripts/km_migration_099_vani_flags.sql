-- Migration 099: VaNi flag columns for all screeners
-- Adds is_vani_* BOOLEAN columns to km_equity_eod for each screener.
-- is_vani_s2 already exists (migration 097) — all others added here.
-- Populated nightly by pipeline step 6h (backfill_vani_flags.py).
-- Run on kaala_dristi_db.

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS is_vani_strength   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_breakout   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_surge      BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_flow       BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_rs         BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_52wh       BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_ath        BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_delivery   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_ema20      BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_overbought BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_oversold   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_distrib    BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_weakness   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_score5d    BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_score22d   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_hightrade  BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_52wl       BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vani_smart      BOOLEAN DEFAULT false;

-- Verify after running:
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'km_equity_eod'
--   AND column_name LIKE 'is_vani_%'
-- ORDER BY column_name;
-- Expected: 19 rows (is_vani_s2 + 18 above)
