-- ============================================================
-- Migration 073 · Index Returns Columns + RPC
--
-- Adds ret_5d / ret_22d / ret_66d to km_index_eod and provides
-- a PostgreSQL RPC to populate them via LAG window functions.
--
-- These mirror the per-equity returns used in scanner presets
-- so that index-level weekly/monthly scanner support can reuse
-- the same filter logic.
-- ============================================================

BEGIN;

-- ── Add return columns to km_index_eod ───────────────────────

ALTER TABLE km_index_eod
  ADD COLUMN IF NOT EXISTS ret_5d  NUMERIC,
  ADD COLUMN IF NOT EXISTS ret_22d NUMERIC,
  ADD COLUMN IF NOT EXISTS ret_66d NUMERIC;

-- ── RPC: compute returns for one index ───────────────────────
-- Uses LAG window so a single pass populates all three periods.
-- Call with p_from_date to limit the update window (e.g. backfill
-- only the last 90 days).

CREATE OR REPLACE FUNCTION compute_index_returns(
  p_index_id  INT,
  p_from_date DATE DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  updated INT := 0;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      close,
      LAG(close,  5) OVER w AS c5,
      LAG(close, 22) OVER w AS c22,
      LAG(close, 66) OVER w AS c66,
      trade_date
    FROM km_index_eod
    WHERE index_id = p_index_id
      AND close IS NOT NULL
    WINDOW w AS (ORDER BY trade_date)
  )
  UPDATE km_index_eod e
  SET
    ret_5d  = CASE WHEN r.c5  > 0 THEN ROUND(((r.close / r.c5  - 1) * 100)::NUMERIC, 2) END,
    ret_22d = CASE WHEN r.c22 > 0 THEN ROUND(((r.close / r.c22 - 1) * 100)::NUMERIC, 2) END,
    ret_66d = CASE WHEN r.c66 > 0 THEN ROUND(((r.close / r.c66 - 1) * 100)::NUMERIC, 2) END
  FROM ranked r
  WHERE e.id = r.id
    AND (p_from_date IS NULL OR r.trade_date >= p_from_date);

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;


-- ── RPC: compute returns for ALL indices ─────────────────────

CREATE OR REPLACE FUNCTION compute_all_index_returns(
  p_from_date DATE DEFAULT NULL
)
RETURNS TABLE(index_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT i.index_id
    FROM km_index_eod i
    WHERE i.close IS NOT NULL
    ORDER BY i.index_id
  LOOP
    index_id    := r.index_id;
    rows_updated := compute_index_returns(r.index_id, p_from_date);
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ── Permissions ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION compute_index_returns(INT, DATE)     TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_index_returns(DATE)      TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
