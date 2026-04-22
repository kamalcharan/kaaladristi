-- ============================================================================
-- Migration 056: Rename minor_bullish/minor_bearish → mild_bullish/mild_bearish
--
-- Aligns km_astro_calendar.market_impact with the canonical signal vocabulary
-- used everywhere else in the product (km_astro_daily_signal net_signal,
-- frontend signalScale.ts, scanner, etc.).
--
-- Steps:
--   1. Drop the old CHECK constraint (still referencing minor_*).
--   2. Migrate existing rows.
--   3. Add the new CHECK constraint with mild_* values.
-- ============================================================================

-- 1. Drop old check constraint (name may vary — use pg_constraint to be safe)
DO $$
DECLARE
  _con TEXT;
BEGIN
  SELECT conname INTO _con
    FROM pg_constraint
   WHERE conrelid = 'km_astro_calendar'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) LIKE '%minor_bullish%';
  IF _con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE km_astro_calendar DROP CONSTRAINT ' || quote_ident(_con);
  END IF;
END $$;

-- 2. Rename existing values
UPDATE km_astro_calendar SET market_impact = 'mild_bullish' WHERE market_impact = 'minor_bullish';
UPDATE km_astro_calendar SET market_impact = 'mild_bearish' WHERE market_impact = 'minor_bearish';

-- 3. Add updated CHECK constraint
ALTER TABLE km_astro_calendar
  ADD CONSTRAINT km_astro_calendar_market_impact_check CHECK (
    market_impact IN (
      'strong_bullish', 'bullish', 'mild_bullish',
      'neutral', 'turning',
      'mild_bearish', 'bearish', 'strong_bearish'
    )
  );

NOTIFY pgrst, 'reload schema';
