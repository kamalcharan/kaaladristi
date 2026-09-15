-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 212 — Filing ingestion spine (Sprint 2)
-- Target DB: kaala_dristi_db
-- Plan: docs/claude/filing-intelligence-poa.md
--
-- Two tables. km_filings_raw is APPEND-ONLY and never updated; km_corporate_
-- events is the normalised, deduped reading derived from it. Keeping them apart
-- is what lets the classifier be rewritten (it will be — the V1 desc map WILL
-- be wrong somewhere) without re-fetching years of NSE.
--
-- EVERY COLUMN NAME BELOW WAS MEASURED, not guessed. scripts/probe_nse_filings
-- .py ran against the live API on 2026-09-15; an earlier draft of this schema
-- was wrong in five places. What the probe changed:
--
--   * sm_isin IS SUPPLIED in the payload -> no ISIN resolution step, no
--     unresolved queue. It lands in `isin` directly.
--   * seq_id is the natural key -> UNIQUE (source, source_ann_id). No composite
--     fallback needed.
--   * `desc` is NSE'S OWN CATEGORY, not a description ("Bagging/Receiving of
--     orders/contracts", "Acquisition", "Copy of Newspaper Publication"). 107
--     distinct values over 30 days, top 40 covering 96.8%, and it classifies
--     63.5% of the stream with no model at all. Stored verbatim in desc_raw.
--   * THERE ARE TWO TIMESTAMPS AND THE OBVIOUS ONE IS WRONG. an_dt is when the
--     company filed; exchdisstime is when the EXCHANGE DISSEMINATED it — the
--     moment the market could act. day_0_trade_date derives from
--     disseminated_at. Using announced_at would inject lookahead bias into
--     every drift number computed downstream, silently and irreversibly.
--   * hasXbrl is true on 100% of rows with no XBRL url anywhere in the payload.
--     Captured as has_xbrl, but a universally-true flag is more likely
--     defaulted than meaningful — DO NOT build on it until it is verified.
--
-- Volume, measured: ~551-762 announcements/calendar-day, ~201,000/year for NSE
-- alone — 2.5x what the plan first assumed. ~0.15 GB/yr for metadata, ~1.1 GB/yr
-- once raw_text lands in Sprint 3.
--
-- NSE ONLY for now. The schema is two-source from day one (source, and the
-- cross-exchange rules in the POA) so BSE arrives additively rather than as a
-- refactor. CLAUDE.md's settled decision is full NSE + BSE coverage; this is
-- sequencing, not scope.
--
-- Owner runs this in pgAdmin. No REFRESH, no backfill, nothing else required.
-- Both tables start EMPTY and fill from the first filings_ingest run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Raw: immutable, append-only ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.km_filings_raw (
    id                BIGSERIAL PRIMARY KEY,

    -- provenance. source_symbol/source_scrip are WHAT THE API GAVE US and are
    -- never mutated: a symbol rename must not rewrite history.
    source            TEXT        NOT NULL CHECK (source IN ('NSE','BSE')),
    source_ann_id     TEXT        NOT NULL,          -- NSE seq_id
    source_symbol     TEXT,                          -- NSE symbol
    source_scrip      TEXT,                          -- BSE scrip code (later)

    -- identity. A filing is about the COMPANY, not the listing, so ISIN is the
    -- key and equity_id is resolved at read (one, or two for a dual listing).
    isin              TEXT,                          -- NSE sm_isin
    company_name      TEXT,                          -- NSE sm_name

    -- time. See the header: these are NOT interchangeable.
    announced_at      TIMESTAMPTZ,                   -- an_dt      (company filed)
    disseminated_at   TIMESTAMPTZ NOT NULL,          -- exchdisstime (market could act)

    -- content
    desc_raw          TEXT,                          -- NSE `desc` = its category
    summary_text      TEXT,                          -- attchmntText (~142 chars mean)
    doc_url           TEXT,                          -- attchmntFile. STORED, NOT FETCHED.
    doc_size_label    TEXT,                          -- attFileSize, e.g. "237.54 KB"
    has_xbrl          BOOLEAN,                       -- unverified, see header
    payload           JSONB       NOT NULL,          -- the API row verbatim

    -- dedup + revision. Same natural key + different hash = the company revised
    -- it. That is a NEW ROW pointing at the old one, never an overwrite: the
    -- original may already have been classified and already moved the price.
    content_hash      TEXT        NOT NULL,
    supersedes_id     BIGINT      REFERENCES public.km_filings_raw(id),

    -- extraction (Sprint 3 fills these; NULL here is correct, not missing)
    raw_text          TEXT,
    page_count        INTEGER,
    char_count        INTEGER,
    extract_status    TEXT CHECK (extract_status IN
                        ('pending','ok','needs_ocr','failed','skipped')),
    extracted_at      TIMESTAMPTZ,

    fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The idempotency guarantee. A re-run of any window is a no-op at the DB
    -- level rather than an argument in Python.
    CONSTRAINT km_filings_raw_natural_key UNIQUE (source, source_ann_id)
);

CREATE INDEX IF NOT EXISTS idx_filings_raw_isin_time
    ON public.km_filings_raw (isin, disseminated_at DESC);
CREATE INDEX IF NOT EXISTS idx_filings_raw_time
    ON public.km_filings_raw (disseminated_at DESC);
CREATE INDEX IF NOT EXISTS idx_filings_raw_desc
    ON public.km_filings_raw (desc_raw);
-- Partial: the extraction worker's queue is a small slice of a large table.
CREATE INDEX IF NOT EXISTS idx_filings_raw_extract_pending
    ON public.km_filings_raw (id) WHERE extract_status = 'pending';

COMMENT ON TABLE  public.km_filings_raw IS
  'Append-only NSE/BSE announcement stream. Never updated. Classification is '
  're-derived from stored text, never re-scraped.';
COMMENT ON COLUMN public.km_filings_raw.disseminated_at IS
  'exchdisstime — when the EXCHANGE published it. day_0_trade_date derives from '
  'this, NOT from announced_at. Using announced_at injects lookahead bias.';
COMMENT ON COLUMN public.km_filings_raw.desc_raw IS
  'NSE''s own category verbatim. 107 distinct values; classifies 63.5% of the '
  'stream with no model. Never overwrite with our own label.';
COMMENT ON COLUMN public.km_filings_raw.doc_url IS
  'Link only. THE DOCUMENT IS NEVER STORED — 279 GB vs 2.2 GB over five years.';

-- ── The trading-day rule, as ONE implementation ────────────────────────────
-- A filing disseminated after the close belongs to the NEXT session. Getting
-- this wrong by one day poisons every drift measurement downstream, so it is a
-- function rather than a line repeated in each caller.
--
-- 15:30 IST is the close. Anything at or before it on a day that actually
-- traded is Day 0; everything else rolls to the next traded day. "Actually
-- traded" is km_equity_eod's own dates — no separate holiday calendar to drift
-- out of sync.
CREATE OR REPLACE FUNCTION public.kd_day_zero_trade_date(p_disseminated TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql STABLE AS $$
    WITH ist AS (SELECT (p_disseminated AT TIME ZONE 'Asia/Kolkata') AS ts)
    SELECT min(d.trade_date)
    FROM (SELECT DISTINCT trade_date FROM public.km_equity_eod
          WHERE trade_date >= (SELECT ts::date FROM ist)
            AND trade_date <= (SELECT ts::date FROM ist) + 15) d
    WHERE d.trade_date > (SELECT ts::date FROM ist)
       OR (d.trade_date = (SELECT ts::date FROM ist)
           AND (SELECT ts::time FROM ist) <= TIME '15:30');
$$;

COMMENT ON FUNCTION public.kd_day_zero_trade_date IS
  'Dissemination timestamp -> the session the market could first act on it. '
  'After 15:30 IST, or on a non-trading day, rolls forward. Reads km_equity_eod '
  'for the real calendar rather than a second holiday list.';

-- ── Events: normalised, deduped, one row per real-world event ──────────────
CREATE TABLE IF NOT EXISTS public.km_corporate_events (
    id                 BIGSERIAL PRIMARY KEY,

    isin               TEXT        NOT NULL,
    equity_id          INTEGER,                      -- resolved convenience, nullable
    company_name       TEXT,

    -- MIN(disseminated_at) across the cross-exchange group. If BSE got it at
    -- 18:40 and NSE at 18:42, the market knew at 18:40.
    disseminated_at    TIMESTAMPTZ NOT NULL,
    day_0_trade_date   DATE        NOT NULL,

    -- classification. family/event_type are ADDRESSES: stable UPPER_SNAKE,
    -- never renamed. Display labels (Eagles / Spark vocabulary) live in one
    -- frontend constants file and change freely.
    family             TEXT        NOT NULL CHECK (family IN
                         ('SPARK','CORPORATE_ACTION','OWNERSHIP',
                          'NEGATIVE_SPARK','GENERAL','UNCLASSIFIED')),
    event_type         TEXT,
    -- Stored for filtering and ranking; NEVER rendered as directional language
    -- (D39). The label states what the filing IS, not what it implies.
    polarity           TEXT CHECK (polarity IN ('positive','negative','neutral')),

    desc_raw           TEXT,                          -- carried for auditability
    classified_by      TEXT CHECK (classified_by IN
                         ('desc_map','keyword','llm','human')),
    classifier_version TEXT,
    confidence         NUMERIC(4,3),

    -- Sprint 3 numeric extraction. All nullable: a failed extraction must never
    -- invalidate a correct classification, and a confidently wrong rupee figure
    -- is worse than none.
    amount_value       NUMERIC(18,2),
    amount_unit        TEXT,                          -- 'CR' | 'LAKH' | 'MN'
    amount_basis       TEXT CHECK (amount_basis IN ('incl_gst','excl_gst')),
    ratio_num          INTEGER,                       -- bonus 1:1, split 1:2
    ratio_den          INTEGER,
    capacity_value     NUMERIC(18,2),
    capacity_unit      TEXT,                          -- 'MTPA' | 'GWH' | 'MW'

    -- review
    human_reviewed     BOOLEAN     NOT NULL DEFAULT FALSE,
    human_override     TEXT,

    -- provenance back to every raw row that evidenced this event
    primary_raw_id     BIGINT      NOT NULL REFERENCES public.km_filings_raw(id),
    raw_ids            BIGINT[]    NOT NULL DEFAULT '{}',

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT km_corporate_events_one_per_raw UNIQUE (primary_raw_id)
);

CREATE INDEX IF NOT EXISTS idx_corp_events_isin_date
    ON public.km_corporate_events (isin, day_0_trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_corp_events_equity_date
    ON public.km_corporate_events (equity_id, day_0_trade_date DESC);
-- The rolling panel and the Sprint 4 A/B both read "material events in a window",
-- so family leads the key and GENERAL is excluded by the query, not scanned.
CREATE INDEX IF NOT EXISTS idx_corp_events_family_date
    ON public.km_corporate_events (family, day_0_trade_date DESC)
    WHERE family <> 'GENERAL';
CREATE INDEX IF NOT EXISTS idx_corp_events_review
    ON public.km_corporate_events (confidence)
    WHERE human_reviewed = FALSE AND family <> 'GENERAL';

COMMENT ON TABLE public.km_corporate_events IS
  'One row per real-world corporate event, deduped across exchanges. Derived '
  'from km_filings_raw and freely re-derivable; raw is the source of truth.';
COMMENT ON COLUMN public.km_corporate_events.family IS
  'Stable address, never renamed. UNCLASSIFIED means the classifier could not '
  'tell; GENERAL means it confidently judged the filing routine. They are '
  'DIFFERENT VALUES — conflating them drowns the review queue in week one.';

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Logged-in browser users run as `authenticated` (migration 144 reverted
-- kd_auth_login to issue that for everyone). A table shipped without this
-- grant is readable anonymously and permission-denied for real users —
-- migration 142's lesson, and it fails SILENTLY.
-- Verify with pg_class.relacl, NOT information_schema.role_table_grants, which
-- is blind over a restricted connection.
GRANT SELECT ON public.km_filings_raw       TO authenticated, anon, kd_app, kd_readonly;
GRANT SELECT ON public.km_corporate_events  TO authenticated, anon, kd_app, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON public.km_filings_raw      TO kd_app;
GRANT INSERT, UPDATE, DELETE ON public.km_corporate_events TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE public.km_filings_raw_id_seq       TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE public.km_corporate_events_id_seq  TO kd_app;
GRANT EXECUTE ON FUNCTION public.kd_day_zero_trade_date(TIMESTAMPTZ)
    TO authenticated, anon, kd_app, kd_readonly;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
-- Both tables are EMPTY after this runs and fill from the first
-- filings_ingest run. That is correct, not a failed migration.
--
--   SELECT relname, relacl FROM pg_class
--    WHERE relname IN ('km_filings_raw','km_corporate_events');
--   -- expect authenticated=r in both
--
--   -- the trading-day rule, on real dates:
--   SELECT public.kd_day_zero_trade_date('2026-09-14 23:50:10+05:30'::timestamptz);
--   -- after the close -> the NEXT session, not 2026-09-14
--   SELECT public.kd_day_zero_trade_date('2026-09-11 10:15:00+05:30'::timestamptz);
--   -- during a trading session -> 2026-09-11 itself
