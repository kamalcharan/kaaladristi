-- Migration 061: Change calendar_label from custom enum to TEXT
-- The original POSITIVE/NEGATIVE/VOLATILE enum is replaced with the standard
-- MarketImpact vocabulary (strong_bullish, bullish, mild_bullish, neutral,
-- turning, mild_bearish, bearish, strong_bearish) used everywhere else.

ALTER TABLE km_panchang_day_notes
    ALTER COLUMN calendar_label TYPE TEXT;

-- Drop the old enum (only if nothing else references it)
DROP TYPE IF EXISTS panchang_calendar_label;

-- Add a check constraint so only valid values can be stored
ALTER TABLE km_panchang_day_notes
    ADD CONSTRAINT chk_panchang_notes_label CHECK (
        calendar_label IN (
            'strong_bullish', 'bullish', 'mild_bullish',
            'neutral', 'turning',
            'mild_bearish', 'bearish', 'strong_bearish'
        )
    );
