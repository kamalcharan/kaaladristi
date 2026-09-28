-- ============================================================================
-- Migration 229 — km_filing_reads: the READ of a material filing
-- ============================================================================
-- Target: kaala_dristi_db.  Owner runs it in pgAdmin, then deploys the backend
-- (lib/filing_reader.py + the step in ingest_nse_filings.py) with
-- ANTHROPIC_API_KEY set in App/.env, then on the VPS:
--
--     docker exec kd-pipeline-api2 python scripts/backfill_filing_reads.py --from 2026-03-28
--
-- Plan of record: docs/claude/filing-intelligence-poa.md, "Sprint 3 — REVISED
-- 2026-09-28: the read".  Owner: "it is not about 5% gate... it is about
-- intelligence. Read the content of the filings, check if it will have +ve or
-- -ve impact over the company, report."
--
-- ONE ROW PER MATERIAL EVENT, FROM THE MOMENT IT IS FETCHED.  The row is
-- created `pending` when the event is derived (enqueue_pending runs on every
-- ingest pass and the seed below covers the six-month history), so "yet to
-- start" is a real row the dashboard can count, never an absence.  It moves
-- through `reading` to `done` / `failed` / `unreadable`; `failed` is retried by
-- the next pass until FILING_READ_MAX_ATTEMPTS, `unreadable` (no document, not
-- a PDF, the exchange link gone) is terminal.
--
-- The verdict is the impact on the COMPANY as the filing states it, with the
-- sentence it rests on quoted beside it.  It is not a price forecast; the
-- drift shown next to it on the scanner is measured from bars, never from this
-- table.  `reader_version` keys the result so a prompt change is a re-queue
-- that never loses the previous verdict (the 212 classifier_version rule).
--
-- GENERAL and UNCLASSIFIED events never get a row.  The seed covers the four
-- material families since 2026-03-28: 5,252 events measured on 2026-09-28.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.km_filing_reads (
    id               BIGSERIAL PRIMARY KEY,
    event_id         BIGINT NOT NULL UNIQUE
                     REFERENCES public.km_corporate_events(id) ON DELETE CASCADE,

    -- the status row's clock
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','reading','done','failed','unreadable')),
    attempts         INTEGER NOT NULL DEFAULT 0,
    last_error       TEXT,
    queued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,

    -- the verdict (NULL until status = 'done')
    impact           TEXT CHECK (impact IN ('positive','negative','neutral','unclear')),
    magnitude        TEXT CHECK (magnitude IN ('major','notable','minor','unknown')),
    amount_value     NUMERIC,
    amount_unit      TEXT,                       -- 'INR_CR' | 'PCT' | 'SHARES' | NULL
    amount_basis     TEXT,                       -- what the number is: 'order_value','deal_value','stake_pct',...
    relative_to      TEXT CHECK (relative_to IN ('mcap','revenue') OR relative_to IS NULL),
    relative_pct     NUMERIC,
    role             TEXT,                       -- acquirer | target | promoter | non_promoter | new_client | repeat_client | NULL
    headline         TEXT,
    reasoning        TEXT,
    evidence_quote   TEXT,
    confidence       NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

    -- audit
    model            TEXT,
    reader_version   TEXT NOT NULL DEFAULT 'v1',
    read_source      TEXT CHECK (read_source IN ('text','pdf') OR read_source IS NULL),
    page_count       INTEGER,
    pages_read       INTEGER,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    cost_usd         NUMERIC(10,5)
);

CREATE INDEX IF NOT EXISTS idx_filing_reads_status
    ON public.km_filing_reads (status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_filing_reads_verdict
    ON public.km_filing_reads (impact, finished_at DESC)
    WHERE status = 'done';

COMMENT ON TABLE public.km_filing_reads IS
  'One read per material corporate event: the filing''s impact on the COMPANY '
  'as the document states it, with the quoted evidence. Not a price forecast. '
  'A row exists from fetch (pending) so "yet to start" is countable.';
COMMENT ON COLUMN public.km_filing_reads.evidence_quote IS
  'Verbatim sentence(s) from the document the verdict rests on — what makes the '
  'read auditable and what the user sees on expand.';

-- ── Grants (migration-142 lesson: `authenticated` must have SELECT) ──────
GRANT SELECT ON public.km_filing_reads TO authenticated, anon, kd_app, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON public.km_filing_reads TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE public.km_filing_reads_id_seq TO kd_app;

-- ── Seed: a pending row for every material event in the six-month window ─
-- Idempotent (ON CONFLICT on the UNIQUE event_id). The reader's
-- enqueue_pending() does the same for new events on every pass.
INSERT INTO public.km_filing_reads (event_id, queued_at)
SELECT e.id, now()
  FROM public.km_corporate_events e
 WHERE e.family IN ('SPARK','NEGATIVE_SPARK','OWNERSHIP','CORPORATE_ACTION')
   AND e.disseminated_at >= DATE '2026-03-28'
ON CONFLICT (event_id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT status, count(*) FROM km_filing_reads GROUP BY 1;     -- all pending after apply
--   SELECT count(*) FROM km_corporate_events e
--    WHERE e.family IN ('SPARK','NEGATIVE_SPARK','OWNERSHIP','CORPORATE_ACTION')
--      AND e.disseminated_at >= DATE '2026-03-28';                  -- same number
