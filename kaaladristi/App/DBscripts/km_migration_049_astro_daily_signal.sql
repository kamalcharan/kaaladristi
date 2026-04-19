BEGIN;

CREATE TABLE km_astro_daily_signal (
  trade_date            DATE PRIMARY KEY,
  active_event_ids      INT[] DEFAULT '{}',
  active_event_count    INT DEFAULT 0,
  strong_bullish_count  INT DEFAULT 0,
  bullish_count         INT DEFAULT 0,
  minor_bullish_count   INT DEFAULT 0,
  neutral_count         INT DEFAULT 0,
  minor_bearish_count   INT DEFAULT 0,
  bearish_count         INT DEFAULT 0,
  strong_bearish_count  INT DEFAULT 0,
  turning_date          BOOLEAN DEFAULT false,
  net_score             NUMERIC(6,2) DEFAULT 0,
  net_signal            TEXT CHECK (net_signal IN (
                          'strong_bullish','bullish','mild_bullish','neutral',
                          'mild_bearish','bearish','strong_bearish','turning'
                        )),
  primary_event         TEXT,
  secondary_event       TEXT,
  sector_signals        JSONB DEFAULT '{}',
  computed_at           TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE km_astro_daily_signal IS
  'Computed net astro signal per calendar date. Scoring: strong_bull=+3, bull=+2, minor_bull=+1, neutral=0, minor_bear=-1, bear=-2, strong_bear=-3. Turning date flagged regardless of score.';

-- Scoring function
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
  'Computes net astro signal for each date in range from km_astro_calendar_2026. Run after any insert/update to calendar. Upserts into km_astro_daily_signal.';

COMMIT;
