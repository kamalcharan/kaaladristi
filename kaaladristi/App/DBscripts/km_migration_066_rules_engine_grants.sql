-- Migration 066: PostgREST grants for Rules Engine tables
-- km_rule_signals, km_rule_confidence, km_rule_transits, km_rule_confidence_yearly
-- were created in migrations 062/064 without grants, making them unreadable via PostgREST.

GRANT SELECT ON km_rule_signals           TO authenticated, anon;
GRANT SELECT ON km_rule_confidence        TO authenticated, anon;
GRANT SELECT ON km_rule_transits          TO authenticated, anon;
GRANT SELECT ON km_rule_confidence_yearly TO authenticated, anon;

GRANT ALL ON km_rule_signals           TO kd_app;
GRANT ALL ON km_rule_confidence        TO kd_app;
GRANT ALL ON km_rule_transits          TO kd_app;
GRANT ALL ON km_rule_confidence_yearly TO kd_app;

-- Sequence grant for km_rule_transits (BIGSERIAL id column)
-- km_rule_confidence_yearly has a composite PK (rule_id, year) — no sequence
GRANT USAGE, SELECT ON SEQUENCE km_rule_transits_id_seq TO kd_app;
