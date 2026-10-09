-- ============================================================================
-- Migration 238 — every filing gets a verdict: tiers + four decision fields
-- ============================================================================
-- Target: kaala_dristi_db. Adds columns to km_filing_reads; holds no data.
--
-- Owner, 2026-10-09: "all filings needs inference — definitely some are low
-- priority — others are -ve or +ve — can we also know why". Until now only
-- four "material" families were read, so board outcomes (results), press
-- releases and credit ratings never reached a model: 5,689 open since July.
--
-- tier — set at enqueue by lib/filing_reader.py, from the exchange's label:
--   routine  the label settles it (trading window, AGM notice, newspaper copy,
--            depository certificate, record date, ESOP, allotment …). NO model
--            call: the row is written done/neutral with read_source = 'rule'
--            and a one-line reason for that label. "Routine by type", never
--            presented as a reading of the document.
--   high     material families + board outcomes, press releases, credit
--            ratings, agreements, capacity, licences … on an active NSE
--            listing at or above the scanner mcap floor. Read first.
--   low      everything else (General Updates, analyst-meet notes, routine
--            appointments, exchange-query replies, small companies). Read
--            only when no high-tier row is waiting, on the LOW lane.
--
-- The four fields (reader v2) — all taken FROM the filing, never computed:
--   touches       which part of the business it touches (a fixed vocabulary)
--   company_view  what the company itself says about the impact, e.g.
--                 "no material impact" — or 'Not stated'
--   timeframe     when the filing says the effect lands — or 'Not stated'
--   watch_next    the next dated step the filing names — or 'Nothing stated'
--
-- Filings before FILING_READ_FROM (default 2026-09-01) that were never read
-- are recorded as status='skipped', triage_reason 'not analysed: …' (owner:
-- "mark Aug for not to analyse"), so "never looked at" stays countable.
--
-- Existing rows default to tier 'high' — every row written before this
-- migration was a material-family read, which is the high tier.
--
-- Rollback: DROP the five columns and the index; restore the read_source
-- CHECK from migration 231 (after clearing rows with read_source = 'rule').
-- ============================================================================

BEGIN;

ALTER TABLE public.km_filing_reads
    ADD COLUMN IF NOT EXISTS tier         TEXT NOT NULL DEFAULT 'high',
    ADD COLUMN IF NOT EXISTS touches      TEXT,
    ADD COLUMN IF NOT EXISTS company_view TEXT,
    ADD COLUMN IF NOT EXISTS timeframe    TEXT,
    ADD COLUMN IF NOT EXISTS watch_next   TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.km_filing_reads'::regclass
                      AND conname = 'km_filing_reads_tier_check') THEN
        ALTER TABLE public.km_filing_reads
            ADD CONSTRAINT km_filing_reads_tier_check
            CHECK (tier IN ('high', 'low', 'routine'));
    END IF;
END $$;

DO $$
DECLARE c TEXT;
BEGIN
    SELECT conname INTO c
      FROM pg_constraint
     WHERE conrelid = 'public.km_filing_reads'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%read_source%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.km_filing_reads DROP CONSTRAINT %I', c);
    END IF;
END $$;

ALTER TABLE public.km_filing_reads
    ADD CONSTRAINT km_filing_reads_read_source_check
    CHECK (read_source IN ('text', 'pdf', 'ocr', 'rule') OR read_source IS NULL);

-- The claim query: pending rows, high tier first, newest first.
CREATE INDEX IF NOT EXISTS idx_filing_reads_claim
    ON public.km_filing_reads (status, tier);

COMMENT ON COLUMN public.km_filing_reads.tier IS
  'routine = the exchange label settles it, no model call (read_source rule); '
  'high = read first; low = read when no high-tier row waits. Set at enqueue.';
COMMENT ON COLUMN public.km_filing_reads.touches IS
  'Which part of the business the filing touches (reader v2 vocabulary).';
COMMENT ON COLUMN public.km_filing_reads.company_view IS
  'What the company itself says about the impact, as the filing states it, or Not stated.';
COMMENT ON COLUMN public.km_filing_reads.timeframe IS
  'When the filing says the effect lands, or Not stated.';
COMMENT ON COLUMN public.km_filing_reads.watch_next IS
  'The next dated step the filing names, or Nothing stated.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT tier, status, count(*) FROM km_filing_reads GROUP BY 1, 2 ORDER BY 1, 2;
