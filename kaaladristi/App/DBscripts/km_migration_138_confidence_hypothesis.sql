-- Migration 138: km_rule_confidence — record WHICH hypothesis was tested
--
-- Item 3 of the frozen inference-lifecycle POA (owner, 2026-07-07):
-- scoring retargets from the fossil base_bias to the rule's ACTIVE
-- inference (base_bias only as fallback when no inference exists).
-- The confidence row must therefore say which hypothesis produced its
-- numbers — "65% of 23" means nothing without "tested against what".
--
--   hypothesis_source: 'inference' | 'base_bias'
--   hypothesis_impact: the tested claim's value at scoring time
--                      (12-value inference vocabulary, or the rule's
--                       outcome/base_bias when no inference exists)
--
-- Written by confidence scoring (nightly 19:00 job, manual Compute
-- Confidence, and the automatic per-rule re-score on inference save).

BEGIN;

ALTER TABLE km_rule_confidence
  ADD COLUMN IF NOT EXISTS hypothesis_source TEXT
    CHECK (hypothesis_source IN ('inference', 'base_bias')),
  ADD COLUMN IF NOT EXISTS hypothesis_impact TEXT;

COMMENT ON COLUMN km_rule_confidence.hypothesis_source IS
  'What the matched/confidence numbers were tested against: the rule''s active inference, or the seeded base_bias fallback';

NOTIFY pgrst, 'reload schema';

COMMIT;
