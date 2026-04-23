-- Migration 060: Add nakshatra_end_time to km_panchang_calendar
-- Traditional panchang always shows when a nakshatra ends ("Rohini till 18:45").
-- This is distinct from nakshatra_change_time (trading-window intra-day transition).
-- nakshatra_end_time is computed by searching forward up to 30 hours from 09:15 IST.
-- Format: 'HH:MM' if same day, 'HH:MM+1' if it ends after midnight into next day.

ALTER TABLE km_panchang_calendar
    ADD COLUMN IF NOT EXISTS nakshatra_end_time TEXT;

COMMENT ON COLUMN km_panchang_calendar.nakshatra_end_time IS
    'When the nakshatra active at 09:15 IST ends. Format: HH:MM (same day) or HH:MM+1 (past midnight). Computed by forward binary search up to 30h.';
