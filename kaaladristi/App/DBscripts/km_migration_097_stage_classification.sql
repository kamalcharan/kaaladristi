-- Migration 097: Stage classification columns on km_equity_eod
-- Adds sma200_rising, stage, is_vani_s2 — populated nightly by pipeline step 6h.
-- Run on kaala_dristi_db.

ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS sma200_rising  BOOLEAN,
    ADD COLUMN IF NOT EXISTS stage          VARCHAR(20),
    ADD COLUMN IF NOT EXISTS is_vani_s2     BOOLEAN;

COMMENT ON COLUMN km_equity_eod.sma200_rising IS
    'True when sma_200 > sma_200[20 bars ago] — rising 200-day MA';

COMMENT ON COLUMN km_equity_eod.stage IS
    'Weinstein stage: S2 / S2_CANDIDATE / S1 / S3 / S4 / NULL (insufficient data)';

COMMENT ON COLUMN km_equity_eod.is_vani_s2 IS
    'True only when stage=S2 AND magic_rs>40, rvol>1.5, rsi_14 50-80, pct_of_ath>=75%, pct_of_52wh>=85%';

-- Indexes for screener filtering
CREATE INDEX IF NOT EXISTS idx_km_equity_eod_stage
    ON km_equity_eod (stage, trade_date);

CREATE INDEX IF NOT EXISTS idx_km_equity_eod_is_vani_s2
    ON km_equity_eod (is_vani_s2, trade_date)
    WHERE is_vani_s2 = true;
