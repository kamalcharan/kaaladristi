-- ============================================================================
-- Migration 233 — km_filing_read_checks: a SECOND OPINION on a filing read
-- ============================================================================
-- Target: kaala_dristi_db
--
-- Owner, 2026-09-29: "system will run for qwen ... for selected options, we
-- will run haiku ... and then compare." So the reader stays local (Qwen) for
-- every filing, and a paid Haiku read is something an admin ASKS for on chosen
-- rows. This table holds that second reading. It never touches
-- km_filing_reads — the primary verdict is the record the product shows; the
-- check sits beside it so the two can be compared row by row and in aggregate.
--
-- Direction is not fixed. 883 of the 960 primary verdicts on 2026-09-29 were
-- Haiku's (the backfill ran on Anthropic before the reader moved local), so
-- for those rows the free second opinion is a LOCAL check. A check row records
-- which backend gave it; the agreement view pairs the primary with the check
-- whichever way round they are, and labels the sides by model rather than by
-- table.
--
-- UNIQUE (event_id, backend): one second opinion per backend per event. A
-- repeat request on a done row is refused by the API (a paid verdict is a
-- record); a failed row is reset to pending and retried.
--
-- Holds no data on apply. Rows appear when an admin asks for a check.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.km_filing_read_checks (
    id               BIGSERIAL PRIMARY KEY,
    event_id         BIGINT NOT NULL
                     REFERENCES public.km_corporate_events(id) ON DELETE CASCADE,
    backend          TEXT NOT NULL CHECK (backend IN ('anthropic','local')),
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','done','failed')),
    attempts         INTEGER NOT NULL DEFAULT 0,
    last_error       TEXT,
    requested_by     UUID,                       -- km_profiles.id of the admin who asked
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,
    -- the verdict, same shape as km_filing_reads (NULL until status = 'done')
    impact           TEXT CHECK (impact IN ('positive','negative','neutral','unclear')),
    magnitude        TEXT CHECK (magnitude IN ('major','notable','minor','unknown')),
    amount_value     NUMERIC,
    amount_unit      TEXT,
    amount_basis     TEXT,
    relative_to      TEXT CHECK (relative_to IN ('mcap','revenue') OR relative_to IS NULL),
    relative_pct     NUMERIC,
    role             TEXT,
    headline         TEXT,
    reasoning        TEXT,
    evidence_quote   TEXT,
    confidence       NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    -- audit
    model            TEXT,
    reader_version   TEXT NOT NULL DEFAULT 'v1',
    page_count       INTEGER,
    pages_read       INTEGER,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    cost_usd         NUMERIC(10,5),
    UNIQUE (event_id, backend)
);

CREATE INDEX IF NOT EXISTS idx_filing_read_checks_status
    ON public.km_filing_read_checks (status, requested_at);

COMMENT ON TABLE public.km_filing_read_checks IS
  'A second reading of a filing by the OTHER backend, requested by an admin. '
  'Sits beside km_filing_reads (the primary verdict) so the two can be compared. '
  'Never replaces the primary.';

-- ── the comparison ──────────────────────────────────────────────────────
-- One row per (event, check) where both verdicts are done. `haiku_*` and
-- `local_*` are assigned by MODEL, not by which table the verdict sits in,
-- so a Haiku-primary/local-check pair and a local-primary/Haiku-check pair
-- read the same way.
CREATE OR REPLACE VIEW public.v_filing_read_agreement AS
SELECT r.event_id,
       e.event_type,
       e.family,
       e.company_name,
       c.backend                                         AS check_backend,
       CASE WHEN c.backend = 'anthropic' THEN c.impact    ELSE r.impact    END AS haiku_impact,
       CASE WHEN c.backend = 'anthropic' THEN c.magnitude ELSE r.magnitude END AS haiku_magnitude,
       CASE WHEN c.backend = 'anthropic' THEN c.headline  ELSE r.headline  END AS haiku_headline,
       CASE WHEN c.backend = 'local'     THEN c.impact    ELSE r.impact    END AS local_impact,
       CASE WHEN c.backend = 'local'     THEN c.magnitude ELSE r.magnitude END AS local_magnitude,
       CASE WHEN c.backend = 'local'     THEN c.headline  ELSE r.headline  END AS local_headline,
       (r.impact    = c.impact)    AS agree_impact,
       (r.magnitude = c.magnitude) AS agree_magnitude,
       c.cost_usd                                        AS check_cost_usd,
       c.finished_at                                     AS checked_at
  FROM public.km_filing_read_checks c
  JOIN public.km_filing_reads r ON r.event_id = c.event_id AND r.status = 'done'
  JOIN public.km_corporate_events e ON e.id = c.event_id
 WHERE c.status = 'done';

GRANT SELECT ON public.km_filing_read_checks TO authenticated, kd_app, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON public.km_filing_read_checks TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE public.km_filing_read_checks_id_seq TO kd_app;
GRANT SELECT ON public.v_filing_read_agreement TO authenticated, kd_app, kd_readonly;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── verify ──────────────────────────────────────────────────────────────
-- SELECT count(*) FROM km_filing_read_checks;                      -- 0 on apply
-- SELECT check_backend, count(*), avg(agree_impact::int)
--   FROM v_filing_read_agreement GROUP BY 1;                        -- fills as checks finish
