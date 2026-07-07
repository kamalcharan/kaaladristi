-- Migration 136: km_rule_inference versioning — active / superseded
--
-- Item 2 of the frozen inference-lifecycle POA (owner, 2026-07-07).
-- Best-practice hypothesis-of-record (champion pattern): exactly ONE active
-- inference per scope; saving a new one AUTO-supersedes the previous —
-- no manual flag management. Superseded rows are never deleted: each keeps
-- a frozen validation snapshot ("v1: +ve, held 36% of 18 — superseded
-- 2026-07-08") so the rule page shows the learning trajectory.
--
-- Scope = (rule_a_id, rule_b_id): a rule's single-rule inference and each
-- of its pair inferences are independent scopes, each with its own active.
--
-- validation JSONB (written by the API at supersede time — frozen, never
-- recomputed): { outcome, evidence: {n, ...}, confidence_tier, frozen_at }

BEGIN;

ALTER TABLE km_rule_inference
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active'
                                         CHECK (status IN ('active','superseded')),
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation    JSONB;

-- Backfill BEFORE the unique index: keep only the most recent row per scope
-- active; everything older becomes superseded history (no snapshot — they
-- predate the snapshot mechanism; the API freezes snapshots from now on).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY rule_a_id, COALESCE(rule_b_id, 0)
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM km_rule_inference
)
UPDATE km_rule_inference i
SET status = 'superseded', superseded_at = now()
FROM ranked
WHERE i.id = ranked.id AND ranked.rn > 1;

-- One active hypothesis per scope, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS uq_km_rule_inference_active
  ON km_rule_inference (rule_a_id, COALESCE(rule_b_id, 0))
  WHERE status = 'active';

COMMENT ON COLUMN km_rule_inference.status IS
  'active = hypothesis of record for its (rule_a, rule_b) scope; superseded = history, kept with frozen validation snapshot';
COMMENT ON COLUMN km_rule_inference.validation IS
  'Frozen at supersede time by the API: {outcome, evidence, confidence_tier, frozen_at}. Never recomputed.';

NOTIFY pgrst, 'reload schema';

COMMIT;
