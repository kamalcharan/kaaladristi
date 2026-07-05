-- ============================================================
-- Migration 122 · Custom Index EOD — Per-Index Scoping
--
-- Adds an optional p_index_id parameter to compute_custom_index_eod()
-- (migration 119) so a single custom index can be recomputed on demand
-- from the UI ("Calculate" button) instead of only via the nightly
-- pipeline step or the full/date-ranged backfill script.
--
-- Existing callers (daily pipeline step, backfill script) pass only
-- p_from_date/p_to_date positionally — p_index_id defaults to NULL,
-- preserving today's "all custom indices" behavior unchanged.
--
-- Target database: kaala_dristi_db
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS compute_custom_index_eod(DATE, DATE);

CREATE OR REPLACE FUNCTION compute_custom_index_eod(
  p_from_date DATE DEFAULT NULL,
  p_to_date   DATE DEFAULT NULL,
  p_index_id  INT  DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  affected INT := 0;
BEGIN
  INSERT INTO km_index_eod (index_id, trade_date, close, ret_5d, ret_22d, ret_66d)
  SELECT
    c.index_id,
    e.trade_date,
    AVG(e.close)   AS close,
    AVG(e.ret_5d)  AS ret_5d,
    AVG(e.ret_22d) AS ret_22d,
    AVG(e.ret_66d) AS ret_66d
  FROM km_index_constituents c
  JOIN km_equity_eod   e ON e.equity_id = c.equity_id
  JOIN km_index_symbols s ON s.id = c.index_id
  WHERE s.category = 'custom'
    AND s.is_active = true
    AND (p_from_date IS NULL OR e.trade_date >= p_from_date)
    AND (p_to_date   IS NULL OR e.trade_date <= p_to_date)
    AND (p_index_id  IS NULL OR c.index_id = p_index_id)
  GROUP BY c.index_id, e.trade_date
  ON CONFLICT (index_id, trade_date) DO UPDATE SET
    close   = EXCLUDED.close,
    ret_5d  = EXCLUDED.ret_5d,
    ret_22d = EXCLUDED.ret_22d,
    ret_66d = EXCLUDED.ret_66d;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ── Permissions ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION compute_custom_index_eod(DATE, DATE, INT) TO authenticated, kd_app, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
