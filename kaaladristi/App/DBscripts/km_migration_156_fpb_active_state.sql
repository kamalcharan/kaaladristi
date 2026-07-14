-- km_migration_156_fpb_active_state.sql
-- Target DB: kaala_dristi_db
--
-- Flower Pot Burst — position-management state layer (the day-2 hold/crack call).
--
-- The scanner surfaces a release (🌸 Burst up / 💥 Flower Pot Shatter down) at
-- EOD, but the decision that matters is made the NEXT session: did the release
-- HOLD (the move is real) or CRACK (it reversed)? This table remembers each
-- release and its levels so the following day's bar can be judged against it,
-- and it carries the stop / target so the UI can show "what to do".
--
-- Direction-symmetric:
--   UP   (burst)   HOLD = stays above the burst midpoint on real volume;
--                  stop = below the release low; target ~ +10%.
--   DOWN (shatter) HOLD = stays below the shatter midpoint on real volume;
--                  stop = above the release high; target ~ -10%.
--   CRACKED = reversed (≥2 of: back past midpoint, volume didn't follow,
--             couldn't hold the release close).
--
-- Populated by maintain_fpb_active(p_date), called daily by the pipeline AFTER
-- km_scan_results is refreshed (it reads today's releases from the matview and
-- joins the day's candle for the OHLCV levels). See the pipeline note at the end.

BEGIN;

CREATE TABLE IF NOT EXISTS km_fpb_active (
  id               SERIAL PRIMARY KEY,
  equity_id        INTEGER NOT NULL,
  symbol           TEXT,
  direction        TEXT NOT NULL CHECK (direction IN ('UP','DOWN')),
  release_date     DATE NOT NULL,
  release_open     NUMERIC,
  release_high     NUMERIC,
  release_low      NUMERIC,
  release_close    NUMERIC,
  release_volume   BIGINT,
  release_midpoint NUMERIC,
  sl_level         NUMERIC,
  target_level     NUMERIC,
  quality          NUMERIC,
  -- ACTIVE (release day) → HOLDING | CRACKED (day 2) → TARGET_HIT | STOPPED | EXPIRED
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  last_eval_date   DATE,
  last_close       NUMERIC,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equity_id, release_date, direction)
);

CREATE INDEX IF NOT EXISTS ix_km_fpb_active_recent ON km_fpb_active (release_date DESC);
CREATE INDEX IF NOT EXISTS ix_km_fpb_active_status ON km_fpb_active (status);

-- ── maintenance function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION maintain_fpb_active(p_date DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Record new releases fired on p_date (read from the refreshed matview +
  --    the day's candle for OHLCV). Idempotent via the UNIQUE constraint.
  INSERT INTO km_fpb_active (
    equity_id, symbol, direction, release_date,
    release_open, release_high, release_low, release_close, release_volume,
    release_midpoint, sl_level, target_level, quality, status,
    last_eval_date, last_close)
  SELECT
    r.equity_id, r.symbol,
    CASE WHEN r.fpb_phase = 'BURST' THEN 'UP' ELSE 'DOWN' END,
    r.trade_date,
    e.open, e.high, e.low, e.close, e.volume,
    (e.high + e.low) / 2.0,
    CASE WHEN r.fpb_phase = 'BURST' THEN e.low  ELSE e.high END,          -- stop
    CASE WHEN r.fpb_phase = 'BURST' THEN round(e.close * 1.10, 2)
                                    ELSE round(e.close * 0.90, 2) END,     -- ~10% target
    r.fpb_quality, 'ACTIVE',
    r.trade_date, e.close
  FROM km_scan_results r
  JOIN km_equity_eod e ON e.equity_id = r.equity_id AND e.trade_date = r.trade_date
  WHERE r.preset_id = 'flower_pot_burst'
    AND r.fpb_phase IN ('BURST','SHATTER')
    AND r.trade_date = p_date
  ON CONFLICT (equity_id, release_date, direction) DO NOTHING;

  -- 2) Day-2 verdict for ACTIVE rows released before p_date: HOLD vs CRACK,
  --    evaluated against p_date's bar. Direction-symmetric.
  UPDATE km_fpb_active a
  SET status = CASE
        WHEN a.direction = 'UP' THEN
          CASE WHEN ( (b.close < a.release_midpoint)::int
                    + (b.volume < 0.7 * a.release_volume)::int
                    + (b.high  < a.release_close)::int ) >= 2 THEN 'CRACKED'
               WHEN b.high  >= a.target_level THEN 'TARGET_HIT'
               WHEN b.close <  a.sl_level     THEN 'STOPPED'
               ELSE 'HOLDING' END
        ELSE  -- DOWN
          CASE WHEN ( (b.close > a.release_midpoint)::int
                    + (b.volume < 0.7 * a.release_volume)::int
                    + (b.low   > a.release_close)::int ) >= 2 THEN 'CRACKED'
               WHEN b.low   <= a.target_level THEN 'TARGET_HIT'
               WHEN b.close >  a.sl_level     THEN 'STOPPED'
               ELSE 'HOLDING' END
      END,
      last_eval_date = p_date, last_close = b.close, updated_at = now()
  FROM km_equity_eod b
  WHERE a.equity_id = b.equity_id
    AND b.trade_date = p_date
    AND a.status = 'ACTIVE'
    AND a.release_date < p_date;

  -- 3) Manage still-open HOLDING rows on later sessions: target / stop only
  --    (the crack test is a day-2 concept; after that we trail to target/stop).
  UPDATE km_fpb_active a
  SET status = CASE
        WHEN a.direction = 'UP'   AND b.high  >= a.target_level THEN 'TARGET_HIT'
        WHEN a.direction = 'UP'   AND b.close <  a.sl_level     THEN 'STOPPED'
        WHEN a.direction = 'DOWN' AND b.low   <= a.target_level THEN 'TARGET_HIT'
        WHEN a.direction = 'DOWN' AND b.close >  a.sl_level     THEN 'STOPPED'
        ELSE 'HOLDING' END,
      last_eval_date = p_date, last_close = b.close, updated_at = now()
  FROM km_equity_eod b
  WHERE a.equity_id = b.equity_id
    AND b.trade_date = p_date
    AND a.status = 'HOLDING'
    AND a.release_date < p_date;

  -- 4) Expire anything still open past a 5-session swing window.
  UPDATE km_fpb_active
  SET status = 'EXPIRED', updated_at = now()
  WHERE status IN ('ACTIVE','HOLDING')
    AND release_date < p_date - INTERVAL '9 days';
END;
$$;

-- ── grants ──────────────────────────────────────────────────────────────────
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated','anon','kd_app','admin','kd_readonly']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON km_fpb_active TO %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kd_app') THEN
    GRANT INSERT, UPDATE ON km_fpb_active TO kd_app;
    GRANT USAGE ON SEQUENCE km_fpb_active_id_seq TO kd_app;
    GRANT EXECUTE ON FUNCTION maintain_fpb_active(DATE) TO kd_app;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── pipeline wiring (run after km_scan_results is refreshed each day) ─────────
--   SELECT maintain_fpb_active(CURRENT_DATE);
-- Backfill in date order so day-2 evaluation has yesterday's records:
--   DO $$ DECLARE d DATE;
--   BEGIN FOR d IN SELECT DISTINCT trade_date FROM km_equity_eod
--                  WHERE trade_date > CURRENT_DATE - INTERVAL '30 days' ORDER BY trade_date
--   LOOP PERFORM maintain_fpb_active(d); END LOOP; END $$;
-- (backfill only records releases from days the matview reflects — for true
--  history, the matview would need per-date snapshots; day-forward is the norm.)
--
-- Verify:
--   SELECT symbol, direction, release_date, status, sl_level, target_level
--   FROM km_fpb_active ORDER BY release_date DESC LIMIT 20;
