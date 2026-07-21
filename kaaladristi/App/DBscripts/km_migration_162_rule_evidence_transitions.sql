-- km_migration_162_rule_evidence_transitions.sql
-- Target: kaala_dristi_db
--
-- Adds the boundary-day TRANSITION study to km_rule_evidence (owner insight
-- 2026-07-21: "Mercury is not about bearish or bullish — it is about trend
-- change... usually previous day high or low break will happen... fusion").
--
-- The transition claim lives at window BOUNDARIES (station day, ingress day,
-- combust entry/exit), not interiors. Per rule the compute script stores, per
-- boundary kind ('day' for point rules, 'start'/'end' for range rules):
--   n, flip_pct (5-session short-trend flipped, prior |trend| >= 1%),
--   break_pct (close beyond previous day's high/low), flip_given_break_pct,
--   plus the matched base rates.
-- Live prototype (2026-07-21, NIFTY 2008+): flips run +3..+6 pts above the
-- 49.8% base consistently across five Mercury event families — a small,
-- direction-consistent tilt. Watch days, not signals; the break confirms.

BEGIN;

ALTER TABLE km_rule_evidence ADD COLUMN IF NOT EXISTS transitions JSONB;

NOTIFY pgrst, 'reload schema';

COMMIT;
