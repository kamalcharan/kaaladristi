-- Migration 018: Add tithi and nakshatra change times to km_daily_panchang
-- These columns are populated by the panchang computation pipeline.
-- When a tithi or nakshatra changes mid-day, end time is stored in IST.
-- NULL means the element spans the full day without a mid-day change.

ALTER TABLE km_daily_panchang
  ADD COLUMN IF NOT EXISTS tithi_end_ist      TIME,   -- IST time when current tithi ends
  ADD COLUMN IF NOT EXISTS nakshatra_end_ist  TIME;   -- IST time when current nakshatra ends

COMMENT ON COLUMN km_daily_panchang.tithi_end_ist     IS 'IST time when the morning tithi changes. NULL if no mid-day change.';
COMMENT ON COLUMN km_daily_panchang.nakshatra_end_ist IS 'IST time when the morning nakshatra changes. NULL if no mid-day change.';
