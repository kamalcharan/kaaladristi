-- ============================================================
-- Migration 013 · Pipeline Infrastructure
-- Delivery columns, pipeline run tracking, trading calendar
-- ============================================================

-- ── 1. Delivery columns on equity EOD ───────────────────────
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS delivery_qty BIGINT;
ALTER TABLE km_equity_eod ADD COLUMN IF NOT EXISTS delivery_pct NUMERIC;

-- ── 2. Trading Calendar ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS km_trading_calendar (
  trade_date    DATE NOT NULL,
  exchange      TEXT NOT NULL DEFAULT 'NSE',
  is_holiday    BOOLEAN NOT NULL DEFAULT FALSE,
  holiday_name  TEXT,
  status        TEXT DEFAULT 'pending',  -- pending / completed / failed / no_data / holiday
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trade_date, exchange)
);

CREATE INDEX IF NOT EXISTS idx_trading_cal_status
  ON km_trading_calendar(status);

-- ── 3. Pipeline Run Log (per-step tracking) ─────────────────
CREATE TABLE IF NOT EXISTS km_pipeline_runs (
  id            SERIAL PRIMARY KEY,
  trade_date    DATE NOT NULL,
  exchange      TEXT NOT NULL DEFAULT 'NSE',
  step          TEXT NOT NULL,           -- download / extract / parse / insert / delivery / indicators / views
  status        TEXT NOT NULL,           -- queued / running / completed / failed / skipped
  rows_count    INTEGER DEFAULT 0,
  duration_ms   INTEGER,
  error_msg     TEXT,
  metadata      JSONB,                   -- file paths, retry count, unmatched symbols etc.
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  UNIQUE(trade_date, exchange, step)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date
  ON km_pipeline_runs(trade_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status
  ON km_pipeline_runs(status);

-- ── Permissions ─────────────────────────────────────────────
GRANT ALL ON km_trading_calendar TO authenticated, kd_app, anon;
GRANT ALL ON km_pipeline_runs TO authenticated, kd_app, anon;
GRANT USAGE, SELECT ON SEQUENCE km_pipeline_runs_id_seq TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';
