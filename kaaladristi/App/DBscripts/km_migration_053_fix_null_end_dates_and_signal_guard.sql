-- ============================================================================
-- Migration 053: Fix NULL end_dates + harden compute_astro_daily_signals()
-- ============================================================================
-- Problem: 6 rows in km_astro_calendar_2026 have end_date = NULL but are
-- single-day point-in-time events. The scoring function treated NULL as
-- "ongoing forever", causing these events to accumulate and corrupt net_score
-- for every future date (e.g. Apr 20 showing active_event_count = 26 instead
-- of ~8).
--
-- Fix:
--   Step 1 — Set end_date = start_date for the 6 affected rows.
--   Step 2 — Add a 7-day NULL guard to compute_astro_daily_signals() so any
--             future accidentally-NULL rows cannot accumulate beyond a week.
--   Step 3 — Recompute all 2026 signals.
-- ============================================================================

BEGIN;

-- ── Step 1: Fix the 6 bad rows ───────────────────────────────────────────────

UPDATE km_astro_calendar_2026
SET end_date = start_date
WHERE end_date IS NULL
  AND (display_name, start_date) IN (
    ('Moon on Mrigsira on Monday',     '2026-05-18'),
    ('Asadh Shukla Ekadashi on Friday','2026-07-24'),
    ('Uttra Falguni Nakshatra',         '2026-09-11'),
    ('Uttra Falguni Nakshatra',         '2026-09-12'),
    ('Krishna Dwitiya Kshay Tithi',     '2026-10-29'),
    ('Ekadashi on Friday Kshay',        '2026-11-20')
  );

-- Verify: must be exactly 6
DO $$
BEGIN
  ASSERT (
    SELECT COUNT(*) FROM km_astro_calendar_2026
    WHERE end_date IS NULL
      AND (display_name, start_date) IN (
        ('Moon on Mrigsira on Monday',     '2026-05-18'),
        ('Asadh Shukla Ekadashi on Friday','2026-07-24'),
        ('Uttra Falguni Nakshatra',         '2026-09-11'),
        ('Uttra Falguni Nakshatra',         '2026-09-12'),
        ('Krishna Dwitiya Kshay Tithi',     '2026-10-29'),
        ('Ekadashi on Friday Kshay',        '2026-11-20')
      )
  ) = 0,
  'ERROR: Some rows were not updated — check (display_name, start_date) values';
END $$;

-- ── Step 2: Replace compute_astro_daily_signals() with NULL guard ────────────
--
-- Guard added to the WHERE clause inside the CTE:
--   AND NOT (end_date IS NULL AND start_date < v_date - INTERVAL '7 days')
--
-- Rationale: genuine long-running transits always have an explicit end_date
-- in our data. Only a truly unknown-end event from the current week should
-- be treated as ongoing. Anything NULL older than 7 days is a data error.

CREATE OR REPLACE FUNCTION compute_astro_daily_signals(
  p_from_date DATE DEFAULT '2026-01-01',
  p_to_date   DATE DEFAULT '2026-12-31'
) RETURNS void AS $$
DECLARE
  v_date DATE;
BEGIN
  v_date := p_from_date;
  WHILE v_date <= p_to_date LOOP
    INSERT INTO km_astro_daily_signal (
      trade_date, active_event_ids, active_event_count,
      strong_bullish_count, bullish_count, minor_bullish_count,
      neutral_count, minor_bearish_count, bearish_count, strong_bearish_count,
      turning_date, net_score, net_signal,
      primary_event, secondary_event, computed_at
    )
    WITH active AS (
      SELECT
        id, display_name, market_impact,
        ROW_NUMBER() OVER (ORDER BY
          CASE market_impact
            WHEN 'strong_bullish' THEN 1
            WHEN 'strong_bearish' THEN 1
            WHEN 'bullish'        THEN 2
            WHEN 'bearish'        THEN 2
            WHEN 'turning'        THEN 3
            ELSE 4
          END
        ) AS rn
      FROM km_astro_calendar_2026
      WHERE start_date <= v_date
        AND (end_date IS NULL OR end_date >= v_date)
        -- Guard: NULL end_date older than 7 days is a data error, not an ongoing transit
        AND NOT (end_date IS NULL AND start_date < v_date - INTERVAL '7 days')
    )
    SELECT
      v_date,
      COALESCE(array_agg(id), '{}'),
      COUNT(*)::INT,
      COUNT(*) FILTER (WHERE market_impact = 'strong_bullish')::INT,
      COUNT(*) FILTER (WHERE market_impact = 'bullish')::INT,
      COUNT(*) FILTER (WHERE market_impact = 'minor_bullish')::INT,
      COUNT(*) FILTER (WHERE market_impact = 'neutral')::INT,
      COUNT(*) FILTER (WHERE market_impact = 'minor_bearish')::INT,
      COUNT(*) FILTER (WHERE market_impact = 'bearish')::INT,
      COUNT(*) FILTER (WHERE market_impact = 'strong_bearish')::INT,
      BOOL_OR(market_impact = 'turning'),
      SUM(CASE market_impact
        WHEN 'strong_bullish' THEN  3
        WHEN 'bullish'        THEN  2
        WHEN 'minor_bullish'  THEN  1
        WHEN 'neutral'        THEN  0
        WHEN 'minor_bearish'  THEN -1
        WHEN 'bearish'        THEN -2
        WHEN 'strong_bearish' THEN -3
        ELSE 0 END),
      CASE
        WHEN BOOL_OR(market_impact = 'turning') THEN 'turning'
        WHEN SUM(CASE market_impact
                   WHEN 'strong_bullish' THEN 3 WHEN 'bullish' THEN 2
                   WHEN 'minor_bullish'  THEN 1 ELSE 0 END) -
             SUM(CASE market_impact
                   WHEN 'strong_bearish' THEN 3 WHEN 'bearish' THEN 2
                   WHEN 'minor_bearish'  THEN 1 ELSE 0 END) >= 4 THEN 'strong_bullish'
        WHEN SUM(CASE market_impact
                   WHEN 'strong_bullish' THEN 3 WHEN 'bullish' THEN 2
                   WHEN 'minor_bullish'  THEN 1 ELSE 0 END) -
             SUM(CASE market_impact
                   WHEN 'strong_bearish' THEN 3 WHEN 'bearish' THEN 2
                   WHEN 'minor_bearish'  THEN 1 ELSE 0 END) >= 2 THEN 'bullish'
        WHEN SUM(CASE market_impact
                   WHEN 'strong_bullish' THEN 3 WHEN 'bullish' THEN 2
                   WHEN 'minor_bullish'  THEN 1 ELSE 0 END) -
             SUM(CASE market_impact
                   WHEN 'strong_bearish' THEN 3 WHEN 'bearish' THEN 2
                   WHEN 'minor_bearish'  THEN 1 ELSE 0 END) >= 1 THEN 'mild_bullish'
        WHEN SUM(CASE market_impact
                   WHEN 'strong_bullish' THEN 3 WHEN 'bullish' THEN 2
                   WHEN 'minor_bullish'  THEN 1 ELSE 0 END) -
             SUM(CASE market_impact
                   WHEN 'strong_bearish' THEN 3 WHEN 'bearish' THEN 2
                   WHEN 'minor_bearish'  THEN 1 ELSE 0 END) <= -4 THEN 'strong_bearish'
        WHEN SUM(CASE market_impact
                   WHEN 'strong_bullish' THEN 3 WHEN 'bullish' THEN 2
                   WHEN 'minor_bullish'  THEN 1 ELSE 0 END) -
             SUM(CASE market_impact
                   WHEN 'strong_bearish' THEN 3 WHEN 'bearish' THEN 2
                   WHEN 'minor_bearish'  THEN 1 ELSE 0 END) <= -2 THEN 'bearish'
        WHEN SUM(CASE market_impact
                   WHEN 'strong_bullish' THEN 3 WHEN 'bullish' THEN 2
                   WHEN 'minor_bullish'  THEN 1 ELSE 0 END) -
             SUM(CASE market_impact
                   WHEN 'strong_bearish' THEN 3 WHEN 'bearish' THEN 2
                   WHEN 'minor_bearish'  THEN 1 ELSE 0 END) <= -1 THEN 'mild_bearish'
        ELSE 'neutral'
      END,
      MIN(display_name) FILTER (WHERE rn = 1),
      MIN(display_name) FILTER (WHERE rn = 2),
      NOW()
    FROM active
    ON CONFLICT (trade_date) DO UPDATE SET
      active_event_ids     = EXCLUDED.active_event_ids,
      active_event_count   = EXCLUDED.active_event_count,
      strong_bullish_count = EXCLUDED.strong_bullish_count,
      bullish_count        = EXCLUDED.bullish_count,
      minor_bullish_count  = EXCLUDED.minor_bullish_count,
      neutral_count        = EXCLUDED.neutral_count,
      minor_bearish_count  = EXCLUDED.minor_bearish_count,
      bearish_count        = EXCLUDED.bearish_count,
      strong_bearish_count = EXCLUDED.strong_bearish_count,
      turning_date         = EXCLUDED.turning_date,
      net_score            = EXCLUDED.net_score,
      net_signal           = EXCLUDED.net_signal,
      primary_event        = EXCLUDED.primary_event,
      secondary_event      = EXCLUDED.secondary_event,
      computed_at          = NOW();

    v_date := v_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compute_astro_daily_signals IS
  'Computes net astro signal for each date in range from km_astro_calendar_2026. Run after any insert/update to calendar. Upserts into km_astro_daily_signal. Guard: NULL end_date older than 7 days is excluded (data error, not ongoing transit).';

-- ── Step 3: Recompute all 2026 signals ───────────────────────────────────────

SELECT compute_astro_daily_signals('2026-01-01', '2026-12-31');

COMMIT;

-- ── Step 4: Verify Apr 20 ─────────────────────────────────────────────────────
-- Expected: active_event_count drops from 26 to ~8

SELECT
  trade_date, net_signal, net_score,
  strong_bullish_count, bullish_count,
  bearish_count, strong_bearish_count,
  active_event_count,
  primary_event, secondary_event
FROM km_astro_daily_signal
WHERE trade_date = '2026-04-20';

-- ── Step 5: Spot-check April 2026 ────────────────────────────────────────────
-- Expected: varied signals, not flat -5 strong_bearish every day

SELECT trade_date, net_signal, net_score, active_event_count
FROM km_astro_daily_signal
WHERE trade_date BETWEEN '2026-04-01' AND '2026-04-30'
ORDER BY trade_date;

-- ── Sanity: confirm no remaining NULL end_dates in the calendar ───────────────

SELECT id, display_name, start_date
FROM km_astro_calendar_2026
WHERE end_date IS NULL
ORDER BY start_date;
-- Should return 0 rows after this migration.
