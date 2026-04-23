-- Migration 058: Panchang Calendar table
-- Stores 09:15 IST panchang data for each trading/calendar day.
-- Populated by generate_panchang_2026.py (Lahiri sidereal, Swiss Ephemeris).
-- NOT sunrise-based (unlike km_daily_panchang).

CREATE TABLE IF NOT EXISTS km_panchang_calendar (
    trade_date              DATE        PRIMARY KEY,

    -- Day
    weekday                 TEXT        NOT NULL,           -- 'Monday' … 'Sunday'

    -- Tithi
    tithi                   TEXT        NOT NULL,           -- e.g. 'Shukla Panchami'
    tithi_end_time          TEXT,                           -- HH:MM IST if change during trading hours

    -- Moon Rashi
    moon_rashi              TEXT        NOT NULL,           -- Sanskrit: 'Mesha', 'Vrishabha' …
    moon_rashi_next         TEXT,                           -- Next rashi if change today
    moon_rashi_change_time  TEXT,                           -- HH:MM IST of rashi change

    -- Nakshatra
    nakshatra               TEXT        NOT NULL,           -- e.g. 'Rohini'
    nakshatra_next          TEXT,                           -- Next nak if change today
    nakshatra_change_time   TEXT,                           -- HH:MM IST of nak change

    -- Nak Lord at 09:15 IST
    nak_lord                TEXT        NOT NULL,           -- 'Moon', 'Mars' …

    -- Metadata
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION km_panchang_calendar_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_panchang_calendar_updated_at ON km_panchang_calendar;
CREATE TRIGGER trg_panchang_calendar_updated_at
    BEFORE UPDATE ON km_panchang_calendar
    FOR EACH ROW EXECUTE FUNCTION km_panchang_calendar_set_updated_at();

-- PostgREST access
GRANT SELECT ON km_panchang_calendar TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON km_panchang_calendar TO authenticated;
