BEGIN;

-- Migrate existing April 2026 data from dc_inference/km_astro_events
-- into km_astro_calendar_2026 with standardized market_impact enum

INSERT INTO km_astro_calendar_2026 (
  display_name, start_date, start_time, end_date, end_time,
  market_impact, inference, applicability, notes
)
SELECT
  astro_event,
  start_date,
  start_time::TIME,
  end_date,
  end_time::TIME,
  CASE market_impact
    WHEN 'major_positive'  THEN 'strong_bullish'
    WHEN 'minor_positive'  THEN 'minor_bullish'
    WHEN 'bullish'         THEN 'bullish'
    WHEN 'bearish'         THEN 'bearish'
    WHEN 'minor_negative'  THEN 'minor_bearish'
    WHEN 'major_negative'  THEN 'strong_bearish'
    WHEN 'neutral'         THEN 'neutral'
    ELSE                        'neutral'
  END,
  inference,
  COALESCE(
    jsonb_build_object(
      'scope', applicability_scope,
      'sectors', COALESCE(applicability->'equity'->'sectors', '["all"]'::jsonb)
    ),
    '{"scope":["equity"],"sectors":["all"]}'::jsonb
  ),
  notes
FROM dc_inference
WHERE year = 2026
ON CONFLICT DO NOTHING;

-- Verify migration
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM km_astro_calendar_2026;
  RAISE NOTICE 'km_astro_calendar_2026 row count after migration: %', v_count;
END $$;

COMMIT;
