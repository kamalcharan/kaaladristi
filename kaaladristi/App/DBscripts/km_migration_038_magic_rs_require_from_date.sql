-- ============================================================
-- Migration 038 · compute_all_magic_rs requires p_from_date
--
-- Migration 026 hardcoded v_from_date := CURRENT_DATE - INTERVAL '90 days'
-- when p_from_date was NULL. Any Magic RS gap older than 90 days was
-- physically unreachable from the UI — the RPC silently clipped the
-- scan window. Force-recompute on a 100-day-old gap would look like
-- "ran successfully, zero rows updated".
--
-- This migration replaces compute_all_magic_rs with a version that
-- REQUIRES p_from_date. Callers must pass a date explicitly. The NULL
-- fallback is removed.
--
-- Callers updated in same commit:
--   - daily_pipeline.py:251  → passes p_from_date = trade_date
--   - worker.py handle_fix_magic_rs already uses compute_magic_rs_batch
--     per symbol with p_from_date; that path is unchanged. The only
--     caller of compute_all_magic_rs itself was the NSE scheduler path.
-- ============================================================

CREATE OR REPLACE FUNCTION compute_all_magic_rs(
  p_table         TEXT,
  p_id_col        TEXT,
  p_benchmark_id  INT  DEFAULT NULL,
  p_from_date     DATE DEFAULT NULL
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r           RECORD;
  v_benchmark INT := p_benchmark_id;
  v_from_date DATE := p_from_date;
BEGIN
  -- p_from_date is now REQUIRED. The 90-day fallback in migration 026
  -- was a landmine — older gaps became unreachable from the UI.
  IF v_from_date IS NULL THEN
    RAISE EXCEPTION 'compute_all_magic_rs: p_from_date is required (use a concrete date — the 90-day default was removed in migration 038)';
  END IF;

  -- Auto-detect benchmark: find NIFTY 500 ID
  IF v_benchmark IS NULL THEN
    IF p_table = 'km_index_eod' THEN
      SELECT id INTO v_benchmark FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1;
    END IF;
  END IF;

  IF v_benchmark IS NULL THEN
    RAISE NOTICE 'compute_all_magic_rs: no benchmark found';
    RETURN;
  END IF;

  -- Process symbols with missing magic_rs on/after the requested date
  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I WHERE magic_rs_zone IS NULL AND trade_date >= $1 AND %I != $2',
    p_id_col, p_table, p_id_col
  ) USING v_from_date, v_benchmark LOOP
    symbol_id := r.sid;
    rows_updated := compute_magic_rs_batch(p_table, p_id_col, r.sid, v_benchmark, v_from_date);
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_all_magic_rs(TEXT, TEXT, INT, DATE) TO authenticated, kd_app, anon;

-- Drop the old 3-arg overload so ambiguous callers fail loudly rather
-- than silently resolving to the old 90-day-clamped path.
DROP FUNCTION IF EXISTS compute_all_magic_rs(TEXT, TEXT, INT);

NOTIFY pgrst, 'reload schema';
