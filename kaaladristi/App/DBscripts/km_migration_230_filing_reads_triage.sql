-- ============================================================================
-- Migration 230 — km_filing_reads: a `skipped` status and its reason
-- ============================================================================
-- Target: kaala_dristi_db.  Owner runs it in pgAdmin, then deploys the backend.
-- Holds no data; one status value and one nullable column.
--
-- WHY (2026-09-28, the day the reader went live): the first 14 reads cost
-- $0.07 and 12 of them were ESOP grants, debenture allotments and AGM
-- housekeeping — every one neutral+minor, every one knowable from the
-- exchange's own type label without opening the document. Owner: "hitting
-- everything for LLM is just waste of money." lib/filing_reader.py now gates
-- twice BEFORE a model is paid for:
--
--   gate 0 (metadata, at enqueue + a prune of rows already queued): never
--          RECORD_DATE / ESOP / ALLOTMENT / AUTHORISED_CAPITAL, and only an
--          active NSE listing with mcap >= FILING_READ_MIN_MCAP_CR (100, the
--          scanner floor). Out-of-scope PENDING rows are DELETED by the prune
--          — the 229 seed queued every material event; ~3,700 of its 5,252
--          leave on the first pass after deploy. A row that was already read,
--          failed, unreadable or skipped is a record and is never pruned.
--   gate 1 (the extracted text, before the model): MGMT_CHANGE / MGMT_EXIT
--          are read only when a KEY person (CEO/CFO/COO/MD/WTD/chair/promoter)
--          is the subject of a management action; AUDITOR_CHANGE only on a
--          resignation / casual vacancy / removal / qualified opinion.
--
-- A gate-1 refusal is recorded as status='skipped' with `triage_reason`, so a
-- filing that was looked at and judged not worth a read is distinguishable
-- from one never looked at (pending) and from one read (done). The text is
-- still stored on km_filings_raw — the extraction is free and keeps its value.
--
-- Measured effect on the six-month queue: 5,232 → ~1,500 candidates for the
-- model (~$7 at Haiku instead of ~$26), ~30 a day instead of ~85.
-- ============================================================================

BEGIN;

-- The 229 CHECK was declared inline; find it by definition rather than by
-- an assumed auto-generated name.
DO $$
DECLARE c TEXT;
BEGIN
    SELECT conname INTO c
      FROM pg_constraint
     WHERE conrelid = 'public.km_filing_reads'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.km_filing_reads DROP CONSTRAINT %I', c);
    END IF;
END $$;

ALTER TABLE public.km_filing_reads
    ADD CONSTRAINT km_filing_reads_status_check
    CHECK (status IN ('pending', 'reading', 'done', 'failed', 'unreadable', 'skipped'));

ALTER TABLE public.km_filing_reads ADD COLUMN IF NOT EXISTS triage_reason TEXT;

COMMENT ON COLUMN public.km_filing_reads.triage_reason IS
  'Why gate 1 (lib/filing_reader.triage) refused to send this document to the '
  'model. Set only when status = skipped. NULL on every other status.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify (after the next ingest pass or backfill run has pruned):
--   SELECT status, count(*) FROM km_filing_reads GROUP BY 1;
--   SELECT triage_reason, count(*) FROM km_filing_reads WHERE status = 'skipped' GROUP BY 1;
