BEGIN;

-- Grant read access on the three new astro tables to PostgREST roles
GRANT SELECT ON km_astro_rule_master    TO authenticated, anon;
GRANT SELECT ON km_astro_calendar_2026  TO authenticated, anon;
GRANT SELECT ON km_astro_daily_signal   TO authenticated, anon;

-- Pipeline / backend role gets full access
GRANT ALL ON km_astro_rule_master    TO kd_app;
GRANT ALL ON km_astro_calendar_2026  TO kd_app;
GRANT ALL ON km_astro_daily_signal   TO kd_app;

-- Sequence access for inserts
GRANT USAGE, SELECT ON SEQUENCE km_astro_rule_master_id_seq   TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE km_astro_calendar_2026_id_seq TO kd_app;

-- Scoring function — backend and authenticated users may call it
GRANT EXECUTE ON FUNCTION compute_astro_daily_signals(DATE, DATE) TO authenticated, kd_app;

COMMIT;
