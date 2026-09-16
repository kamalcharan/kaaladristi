-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 213 — allow check_class 'derivation' on km_integrity_findings
-- Target DB: kaala_dristi_db
--
-- LIVE FAILURE, 2026-09-16 19:05 IST. The nightly integrity_checks step failed:
--
--   new row for relation "km_integrity_findings" violates check constraint
--   "km_integrity_findings_check_class_check"
--   Failing row: (…, 'stale_derivation_wg_journeys', 'derivation', 'warning',
--                 'wg_journeys @ 2026-09-15',
--                 'wg_journeys for 2026-09-15 was computed 2 hours BEFORE its
--                  input…', {"parent": "nse_magic_rs", …})
--
-- The check itself WORKED. It caught exactly what it was built to catch — a
-- dimension derived from inputs that were recomputed after it — and then could
-- not record the finding, because the constraint from migration 178 still lists
-- only the ORIGINAL FOUR classes:
--
--   reconciliation | invariant | staleness | step_failure
--
-- `check_derivation_staleness` (the "fifth check class", added with the
-- per-dimension watermarks in migration 210) emits check_class='derivation'
-- at lib/integrity_checks.py:360. Migration 210 shipped the check logic and the
-- watermark table but never extended the CHECK that the finding writes through,
-- so the fifth class has been unwritable since the day it landed. It only
-- surfaced now because this is the first night a derivation actually went stale.
--
-- ⚠ THE BLAST RADIUS IS THE WHOLE SWEEP, NOT ONE FINDING. persist() in
-- scripts/run_integrity_checks.py uses execute_batch inside a single
-- transaction, so one rejected row aborts the batch: EVERY finding from that
-- night is lost, and the step reports failed. A red Pipeline Dashboard for a
-- schema reason rather than a data reason is precisely how a monitoring layer
-- gets muted — the failure mode the integrity work exists to prevent.
--
-- Owner runs this in pgAdmin. Instant: a CHECK swap on a table holding ~64 rows.
-- No REFRESH, no backfill. The next integrity_checks run records the finding
-- it has been unable to write.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.km_integrity_findings
    DROP CONSTRAINT IF EXISTS km_integrity_findings_check_class_check;

ALTER TABLE public.km_integrity_findings
    ADD CONSTRAINT km_integrity_findings_check_class_check
    CHECK (check_class = ANY (ARRAY[
        'reconciliation'::text,   -- parsed vs inserted
        'invariant'::text,        -- plausibility / cross-source consistency
        'staleness'::text,        -- a signal column gone degenerate
        'step_failure'::text,     -- a pipeline step reported failed
        'derivation'::text        -- migration 210: computed BEFORE its own
                                  -- input. The only class that asks whether a
                                  -- value is CURRENT rather than present —
                                  -- which no fill-rate check can see.
    ]));

COMMENT ON COLUMN public.km_integrity_findings.check_class IS
  'reconciliation | invariant | staleness | step_failure | derivation. '
  'ADDING A CLASS MEANS EDITING THIS CONSTRAINT — migration 210 added the '
  'derivation check and did not, so it could not write a finding for its '
  'entire life and took the whole nightly sweep down with it the first time '
  'it had something to say.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'km_integrity_findings_check_class_check';
--   -- expect all FIVE classes
--
-- Then re-run the sweep; it should persist rather than fail:
--   cd App/backend && python3 scripts/run_integrity_checks.py
--
--   SELECT check_class, count(*) FROM km_integrity_findings GROUP BY 1;
--   -- 'derivation' rows should now appear
--
-- The finding itself is REAL and worth acting on separately: wg_journeys for
-- 2026-09-15 was computed before nse_magic_rs, its parent. Either the cascade
-- did not fire or it fired in the wrong order.
