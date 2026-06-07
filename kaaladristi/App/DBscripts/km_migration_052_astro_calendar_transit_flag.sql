BEGIN;

-- Add is_transit flag to km_astro_calendar_2026
ALTER TABLE km_astro_calendar_2026
  ADD COLUMN IF NOT EXISTS is_transit BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_astro_cal_2026_transit
  ON km_astro_calendar_2026(is_transit, start_date)
  WHERE is_transit = true;

-- Cap turning-date events to a single day (they should never span multiple days)
UPDATE km_astro_calendar_2026
SET end_date = start_date
WHERE market_impact = 'turning'
  AND (end_date IS NULL OR end_date > start_date);

COMMENT ON COLUMN km_astro_calendar_2026.is_transit IS
  'True for multi-day planetary transits (sign ingresses, eclipses, conjunctions). Shown as timeline bars in AstroSignalWeekPanel.';

COMMIT;
