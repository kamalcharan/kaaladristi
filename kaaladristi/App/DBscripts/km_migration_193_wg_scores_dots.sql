-- =====================================================================
-- Migration 193 — scores + dots on km_wg_journeys
-- Target DB: kaala_dristi_db
--
-- WHY
-- ---
-- The Discovery tabs can render Score 5D / Score 22D / RVOL and the
-- SVD/SBD/SYD dot, but km_wg_journeys never carried them, so the columns
-- were blank with no error and no cause visible — the same
-- dash-with-no-explanation shape the scanner contract audit exists to
-- catch, one table further out.
--
-- These are DISPLAY fields taken from the stock's latest EOD row, exactly
-- like close / pct_chng / delivery_pct / magic_rs already are. They play no
-- part in the journey state machine: the wake test is price vs the
-- multi-year ceiling at or above the Golden Line, and sleep is alignment
-- <= 1. Nothing in the walk reads a dot.
--
-- Carrying the dot here is also the groundwork for the GL breakout / GL
-- retest work: those need the dot next to a Golden-Line event, and this
-- puts the dot on the row. The GL events themselves still need gl_150
-- persisted on km_equity_eod — the Golden Line is computed in memory
-- inside compute_wg_journeys.py and thrown away, so nothing can currently
-- scan on it.
-- =====================================================================

BEGIN;

ALTER TABLE km_wg_journeys
    ADD COLUMN IF NOT EXISTS score_5d  NUMERIC,
    ADD COLUMN IF NOT EXISTS score_22d NUMERIC,
    ADD COLUMN IF NOT EXISTS rvol      NUMERIC,
    ADD COLUMN IF NOT EXISTS dot_svd   BOOLEAN,
    ADD COLUMN IF NOT EXISTS dot_sbd   BOOLEAN,
    ADD COLUMN IF NOT EXISTS dot_syd   BOOLEAN;

COMMENT ON COLUMN km_wg_journeys.score_5d IS
    'Display only, from the latest km_equity_eod row. Not an input to the journey state machine.';
COMMENT ON COLUMN km_wg_journeys.dot_svd IS
    'Display only, from the latest km_equity_eod row. The walk does not read dots.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Populate: cd App/backend && python scripts/compute_wg_journeys.py
