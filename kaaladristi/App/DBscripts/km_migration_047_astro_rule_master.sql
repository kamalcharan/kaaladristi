BEGIN;

CREATE TABLE km_astro_rule_master (
  id            SERIAL PRIMARY KEY,
  rule_code     TEXT UNIQUE NOT NULL,
  rule_type     TEXT NOT NULL CHECK (rule_type IN (
                  'planet_conjunction','planet_transit','planet_state',
                  'tithi_alone','tithi_vara','tithi_nakshatra',
                  'nakshatra_vara','moon_position','eclipse',
                  'planet_speed','planet_manifestation','vedh','compound'
                )),
  display_name  TEXT NOT NULL,
  planet_1      TEXT,
  planet_2      TEXT,
  sign          TEXT,
  nakshatra     TEXT,
  tithi         TEXT,
  vara          TEXT,
  planet_state  TEXT CHECK (planet_state IN (
                  'combust','retrograde','vargottam',
                  'exalted','debilitated','direct','manifestation',NULL
                )),
  base_bias     TEXT NOT NULL CHECK (base_bias IN (
                  'bullish','bearish','volatile','turning','neutral'
                )),
  applicability JSONB NOT NULL DEFAULT '{"scope":["equity"],"sectors":["all"]}',
  probability   TEXT CHECK (probability IN ('high','reasonable','low','good')),
  source_page   INT,
  remarks       TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE km_astro_rule_master IS
  'Timeless Vedic astro-market rules. Each row is one rule pattern with its historical market bias. 600+ rules planned.';

COMMIT;
