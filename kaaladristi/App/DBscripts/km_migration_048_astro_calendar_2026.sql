BEGIN;

CREATE TABLE km_astro_calendar_2026 (
  id                SERIAL PRIMARY KEY,
  rule_id           INT REFERENCES km_astro_rule_master(id) ON DELETE SET NULL,
  display_name      TEXT NOT NULL,
  start_date        DATE NOT NULL,
  start_time        TIME,
  end_date          DATE,
  end_time          TIME,
  market_impact     TEXT NOT NULL CHECK (market_impact IN (
                      'strong_bullish','bullish','minor_bullish','neutral',
                      'turning','minor_bearish','bearish','strong_bearish'
                    )),
  inference         TEXT,
  market_hours_only BOOLEAN DEFAULT false,
  applicability     JSONB NOT NULL DEFAULT '{"scope":["equity"],"sectors":["all"]}',
  month             INT GENERATED ALWAYS AS (EXTRACT(MONTH FROM start_date)::INT) STORED,
  year              INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM start_date)::INT) STORED,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_astro_cal_2026_start  ON km_astro_calendar_2026(start_date);
CREATE INDEX idx_astro_cal_2026_end    ON km_astro_calendar_2026(end_date);
CREATE INDEX idx_astro_cal_2026_month  ON km_astro_calendar_2026(month, year);
CREATE INDEX idx_astro_cal_2026_impact ON km_astro_calendar_2026(market_impact);

COMMENT ON TABLE km_astro_calendar_2026 IS
  '2026 instantiation of astro rules. Each row is one event firing with exact dates/times and market impact. Feeds km_astro_daily_signal via scoring function.';

COMMIT;
