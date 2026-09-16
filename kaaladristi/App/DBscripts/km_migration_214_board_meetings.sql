-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 214 — km_board_meetings: the anchor for returns_since_result
-- Target DB: kaala_dristi_db
-- Plan: docs/claude/filing-intelligence-poa.md
--
-- WHY A SECOND FEED. returns_since_result needs the date a company announced
-- results. Measured on 28,076 announcements over six weeks of results season,
-- the announcements feed CANNOT supply it:
--
--   * There is no 'Financial Results' desc. A result is filed as 'Outcome of
--     Board Meeting' (3,013 rows) — legally that is what it is.
--   * That category also carries dividends, fundraising and appointments, and
--     its attchmntText is boilerplate naming only the event type.
--   * Three discriminators tested, none works: filename says 'result' on 13%,
--     'fin' on 16%, and hasXbrl is TRUE on 3,013 of 3,013 — a defaulted flag.
--
-- /api/corporate-board-meetings does supply it. It is the PRIOR INTIMATION —
-- a company must declare, in advance, that it will meet and what for:
--
--   bm_purpose  13 clean values: 'Financial Results', 'Dividend', 'Fund
--               Raising', 'Buyback', 'Board Meeting Intimation' (generic), …
--   bm_desc     plain text that names the purpose even when bm_purpose is
--               generic: "…to inter-alia consider and approve the Audited
--               Financial results of the Company for the Yearly ended March
--               2026." 262 of 481 carry the generic purpose, so bm_desc is not
--               a nicety — it is most of the coverage.
--   sm_isin     joins straight to km_filings_raw and km_equity_symbols.
--
-- ⚠ THE MEETING DATE IS NOT DAY 0. This feed is the intimation: bm_date is when
-- the board WILL meet. The result reaches the market when the OUTCOME is filed,
-- which is an announcement with its own exchdisstime. So Day 0 still comes from
-- km_filings_raw via kd_day_zero_trade_date, and this table only answers WHICH
-- 'Outcome of Board Meeting' rows are results. Dating from bm_date would put
-- Day 0 before the market could act — the lookahead bias this plan keeps
-- guarding against, arriving through a side door.
--
-- Owner runs in pgAdmin. Starts EMPTY, fills from the first board-meetings
-- ingest. No REFRESH, no backfill.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.km_board_meetings (
    id              BIGSERIAL PRIMARY KEY,

    isin            TEXT,                      -- sm_isin
    symbol          TEXT,                      -- bm_symbol
    company_name    TEXT,                      -- sm_name

    meeting_date    DATE        NOT NULL,      -- bm_date  (WILL meet; NOT Day 0)
    intimated_at    TIMESTAMPTZ NOT NULL,      -- bm_timestamp (when declared)

    purpose_raw     TEXT,                      -- bm_purpose, verbatim
    desc_raw        TEXT,                      -- bm_desc, verbatim

    -- Derived, and re-derivable: both source columns are kept above, so a
    -- better rule can reclassify without re-fetching.
    is_results      BOOLEAN     NOT NULL DEFAULT FALSE,
    -- 'purpose' when bm_purpose named it outright, 'desc' when only the free
    -- text did. Stored so the split is MEASURABLE rather than assumed — if
    -- 'desc' carries most of it, the keyword rule is load-bearing and its
    -- wording matters.
    results_basis   TEXT CHECK (results_basis IN ('purpose','desc')),

    attachment_url  TEXT,                      -- XBRL xml (real, unlike hasXbrl)
    ixbrl_url       TEXT,
    payload         JSONB       NOT NULL,
    content_hash    TEXT        NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A meeting can be re-intimated (the feed carries oriiginalMeetingDate (NSE's own spelling) and
    -- proposedMeetingDate, so rescheduling is a real case). Keyed to let a
    -- reschedule land as its own row rather than overwrite the first notice.
    CONSTRAINT km_board_meetings_natural_key
        UNIQUE (symbol, meeting_date, intimated_at)
);

CREATE INDEX IF NOT EXISTS idx_bm_isin_date
    ON public.km_board_meetings (isin, meeting_date DESC);
-- The join this table exists for: results meetings near an announcement date.
CREATE INDEX IF NOT EXISTS idx_bm_results
    ON public.km_board_meetings (isin, meeting_date DESC) WHERE is_results;

COMMENT ON TABLE public.km_board_meetings IS
  'NSE prior board-meeting intimations. Identifies WHICH "Outcome of Board '
  'Meeting" announcements are results; Day 0 still comes from the outcome '
  'announcement''s exchdisstime, never from meeting_date.';
COMMENT ON COLUMN public.km_board_meetings.meeting_date IS
  'When the board WILL meet. NOT Day 0 — the market acts when the outcome is '
  'disseminated, which is a different row in km_filings_raw.';

-- ── Mark result announcements ──────────────────────────────────────────────
-- km_corporate_events gains the flag the join produces. Nullable on purpose:
-- NULL means "not yet evaluated", FALSE means "evaluated, not a result". Same
-- distinction as GENERAL vs UNCLASSIFIED — collapsing them would make an
-- un-ingested period indistinguishable from a quiet one.
ALTER TABLE public.km_corporate_events
    ADD COLUMN IF NOT EXISTS is_result_announcement BOOLEAN,
    ADD COLUMN IF NOT EXISTS board_meeting_id BIGINT
        REFERENCES public.km_board_meetings(id);

CREATE INDEX IF NOT EXISTS idx_corp_events_result
    ON public.km_corporate_events (isin, day_0_trade_date DESC)
    WHERE is_result_announcement;

GRANT SELECT ON public.km_board_meetings TO authenticated, anon, kd_app, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON public.km_board_meetings TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE public.km_board_meetings_id_seq TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
--   SELECT relname, relacl FROM pg_class WHERE relname = 'km_board_meetings';
--   -- expect authenticated=r
--
-- After the first ingest, the number that decides whether the keyword rule is
-- load-bearing:
--   SELECT results_basis, count(*) FROM km_board_meetings
--    WHERE is_results GROUP BY 1;
--   -- a large 'desc' share means the free-text rule carries the feature, and
--   -- its wording deserves the same scrutiny as a threshold.
