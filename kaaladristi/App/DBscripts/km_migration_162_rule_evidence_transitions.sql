-- km_migration_162_rule_evidence_transitions.sql
-- Target: kaala_dristi_db
--
-- Adds the boundary-day TRANSITION study to km_rule_evidence (owner insight
-- 2026-07-21: "Mercury is not about bearish or bullish — it is about trend
-- change... usually previous day high or low break will happen... fusion").
--
-- The transition claim lives at window BOUNDARIES (station day, ingress day,
-- combust entry/exit), not interiors — and the influence is an ORB, not a
-- stamp ("the impact will be +/- 2 days — checking a single day is a
-- mistake"). Per boundary kind ('day' for point rules, 'start'/'end' for
-- range rules) the compute script stores:
--   n, flip_pct               5-session trend AFTER the ±2-session zone
--                             flipped vs the trend entering it (prior
--                             |trend| >= 1%)
--   confirm_given_flip_pct    a prev-day-H/L break-and-close INSIDE the zone
--                             in the new trend's direction (fusion confirm)
-- plus matched base rates.
-- Orb prototype (2026-07-21, NIFTY 2008+, base flip 48.9%): sign-ingress
-- days carry the real tilt (56.4%, n=241, ~2.3 sigma); combust-entry and
-- retro-station single-day tilts washed out under the orb test. Watch days,
-- not signals; the break confirms.

BEGIN;

ALTER TABLE km_rule_evidence ADD COLUMN IF NOT EXISTS transitions JSONB;

NOTIFY pgrst, 'reload schema';

COMMIT;
