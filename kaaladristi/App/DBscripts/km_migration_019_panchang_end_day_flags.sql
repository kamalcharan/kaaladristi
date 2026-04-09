-- Migration 019: add next-day flags for panchang end times
-- When tithi or nakshatra changes past midnight IST, these are set TRUE.
-- The stored HH:MM:SS end time is then interpreted as the NEXT calendar day.

ALTER TABLE km_daily_panchang
  ADD COLUMN IF NOT EXISTS tithi_end_next_day     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nakshatra_end_next_day  BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN km_daily_panchang.tithi_end_next_day    IS 'TRUE when tithi_end_ist falls on the next calendar day (past midnight IST).';
COMMENT ON COLUMN km_daily_panchang.nakshatra_end_next_day IS 'TRUE when nakshatra_end_ist falls on the next calendar day (past midnight IST).';
