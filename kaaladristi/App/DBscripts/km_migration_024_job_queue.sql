-- ============================================================
-- Migration 024 · Job Queue Table
-- Decouples heavy work from the API process.
-- API inserts jobs, standalone worker.py picks them up.
-- ============================================================

CREATE TABLE IF NOT EXISTS km_jobs (
    id            SERIAL PRIMARY KEY,
    job_type      TEXT NOT NULL,           -- fix:indicators, fix:nse_equities, fix:fii_dii, etc.
    params        JSONB DEFAULT '{}',      -- {days: 60, strategy: 'smart'}
    status        TEXT NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed | cancelled
    progress      TEXT,                    -- human-readable: "Processing NIFTY 50..."
    progress_pct  INTEGER DEFAULT 0,       -- 0-100
    result        JSONB,                   -- {rows_updated: 123, errors: [...]}
    error_msg     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    created_by    TEXT DEFAULT 'ui'        -- ui | scheduler | manual
);

CREATE INDEX IF NOT EXISTS idx_km_jobs_status ON km_jobs(status);
CREATE INDEX IF NOT EXISTS idx_km_jobs_created ON km_jobs(created_at DESC);

-- ── Permissions ─────────────────────────────────────────────
GRANT ALL ON km_jobs TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_jobs_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
