-- ============================================================
-- Migration 039 · Date-scoped bulk compute RPCs
--
-- Context: Task 2 added force-recompute via per-symbol RPC loops. That was
-- correct but too slow — ~1,900 HTTP round-trips for a single NSE equity
-- day. Task 2.5 switches the force path to the bulk RPCs, which requires
-- those RPCs to actually honour a target date.
--
-- Three problems fixed here:
--
-- 1. compute_all_pending_indicators (migration 025:297) has a hardcoded
--    90-day clamp (`v_from_date := CURRENT_DATE - INTERVAL '90 days'`) and
--    accepts no date parameters. Older gaps are physically unreachable.
--    Fix: add p_from_date + p_to_date. When both are provided the clamp
--    is bypassed. When NULL, fall back to the legacy 90-day window so
--    daily_pipeline.py's scheduler calls continue to work unchanged.
--
-- 2. compute_all_flow_intelligence (migration 031:276) has NO date scoping
--    at all. Its SELECT is `SELECT DISTINCT id FROM table` and the
--    per-symbol call is passed no p_from_date — so it re-UPDATEs every
--    row of every symbol's history, every time. Acceptable for the daily
--    scheduler (new data only); disastrous for force mode at scale.
--    Fix: add p_from_date + p_to_date. Scoping is opt-in (NULL preserves
--    legacy behaviour).
--
-- 3. compute_all_magic_rs in migration 038 accidentally dropped the
--    cross-table benchmark routing that migration 034 had added. Calling
--    it for km_equity_eod would look up NIFTY 500 prices from
--    km_equity_eod (where indices don't exist) and silently return zero
--    rows. Fix: restore migration 034's routing. The p_from_date
--    requirement from migration 038 is preserved.
--
-- After this migration, force-recompute on 2026-04-17 Index Indicators
-- (92 rows) should complete in ~1-5 seconds and NSE Equity Indicators
-- (~1,900 rows) in ~10-30 seconds — all the per-symbol loop happens
-- inside one Postgres call with no HTTP overhead per symbol.
--
-- Apply manually on the VPS:
--   docker exec -i <pg_container> psql -U postgres -d ki_prime_db \
--     < App/DBscripts/km_migration_039_bulk_compute_date_scoping.sql
-- ============================================================


-- ╔════════════════════════════════════════════════════════════╗
-- ║ 1. compute_all_pending_indicators — date-scoped bulk       ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_all_pending_indicators(
  p_table     TEXT DEFAULT 'km_index_eod',
  p_id_col    TEXT DEFAULT 'index_id',
  p_from_date DATE DEFAULT NULL,
  p_to_date   DATE DEFAULT NULL
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r           RECORD;
  v_from_date DATE;
  v_to_date   DATE;
BEGIN
  -- Resolve window:
  --   both provided  → use as-is (force path, any window)
  --   only from      → from .. CURRENT_DATE
  --   only to        → (CURRENT_DATE - 90) .. to
  --   neither        → legacy 90-day clamp (scheduler path)
  v_from_date := COALESCE(p_from_date, CURRENT_DATE - INTERVAL '90 days');
  v_to_date   := COALESCE(p_to_date,   CURRENT_DATE);

  IF v_from_date > v_to_date THEN
    RAISE EXCEPTION 'compute_all_pending_indicators: p_from_date (%) must be <= p_to_date (%)',
      v_from_date, v_to_date;
  END IF;

  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I '
    'WHERE indicators_computed_at IS NULL '
    '  AND trade_date BETWEEN $1 AND $2',
    p_id_col, p_table
  ) USING v_from_date, v_to_date LOOP
    symbol_id := r.sid;
    rows_updated := compute_indicators_batch(
      p_table, p_id_col, r.sid, v_from_date
    );
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║ 2. compute_all_flow_intelligence — date-scoped bulk        ║
-- ╚════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION compute_all_flow_intelligence(
  p_table     TEXT DEFAULT 'km_index_eod',
  p_id_col    TEXT DEFAULT 'index_id',
  p_from_date DATE DEFAULT NULL,
  p_to_date   DATE DEFAULT NULL
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r           RECORD;
  v_where_sql TEXT;
  v_sql       TEXT;
BEGIN
  -- When dates are provided, only iterate symbols with EOD rows in that
  -- range — avoids a full-history rewrite for 2000+ symbols.
  -- When dates are NULL, preserve legacy behaviour (process all symbols).
  IF p_from_date IS NOT NULL OR p_to_date IS NOT NULL THEN
    IF p_from_date IS NULL OR p_to_date IS NULL THEN
      RAISE EXCEPTION 'compute_all_flow_intelligence: pass both p_from_date and p_to_date (or neither)';
    END IF;
    IF p_from_date > p_to_date THEN
      RAISE EXCEPTION 'compute_all_flow_intelligence: p_from_date (%) must be <= p_to_date (%)',
        p_from_date, p_to_date;
    END IF;
    v_sql := format(
      'SELECT DISTINCT %I AS sid FROM %I WHERE trade_date BETWEEN $1 AND $2',
      p_id_col, p_table
    );
    FOR r IN EXECUTE v_sql USING p_from_date, p_to_date LOOP
      symbol_id := r.sid;
      rows_updated := compute_flow_intelligence(
        p_table, p_id_col, r.sid, p_from_date
      );
      RETURN NEXT;
    END LOOP;
  ELSE
    v_sql := format('SELECT DISTINCT %I AS sid FROM %I', p_id_col, p_table);
    FOR r IN EXECUTE v_sql LOOP
      symbol_id := r.sid;
      rows_updated := compute_flow_intelligence(p_table, p_id_col, r.sid);
      RETURN NEXT;
    END LOOP;
  END IF;
END;
$$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║ 3. compute_all_magic_rs — restore benchmark routing        ║
-- ╚════════════════════════════════════════════════════════════╝
-- Migration 034 added cross-table benchmark lookup so equity MagicRS
-- could use NIFTY 500 prices from km_index_eod. Migration 038 rewrote
-- compute_all_magic_rs to require p_from_date but dropped the routing,
-- breaking equity MagicRS in the bulk path (bench prices loaded from
-- km_equity_eod where they don't exist → 0 rows written, silently).
-- Restore the routing and keep p_from_date required.

CREATE OR REPLACE FUNCTION compute_all_magic_rs(
  p_table         TEXT,
  p_id_col        TEXT,
  p_benchmark_id  INT  DEFAULT NULL,
  p_from_date     DATE DEFAULT NULL
)
RETURNS TABLE(symbol_id INT, rows_updated INT) LANGUAGE plpgsql AS $$
DECLARE
  r              RECORD;
  v_benchmark    INT  := p_benchmark_id;
  v_from_date    DATE := p_from_date;
  v_bench_table  TEXT;
  v_bench_id_col TEXT;
BEGIN
  IF v_from_date IS NULL THEN
    RAISE EXCEPTION 'compute_all_magic_rs: p_from_date is required (removed in migration 038; the old 90-day default was a landmine)';
  END IF;

  -- Auto-detect benchmark
  IF v_benchmark IS NULL THEN
    SELECT id INTO v_benchmark FROM km_index_symbols WHERE name = 'NIFTY 500' LIMIT 1;
  END IF;
  IF v_benchmark IS NULL THEN
    RAISE NOTICE 'compute_all_magic_rs: no benchmark found (NIFTY 500 missing from km_index_symbols)';
    RETURN;
  END IF;

  -- Route benchmark price lookup: equities need km_index_eod, indices stay
  -- on the same table.
  IF p_table = 'km_index_eod' THEN
    v_bench_table  := NULL;
    v_bench_id_col := NULL;
  ELSE
    v_bench_table  := 'km_index_eod';
    v_bench_id_col := 'index_id';
  END IF;

  FOR r IN EXECUTE format(
    'SELECT DISTINCT %I AS sid FROM %I '
    'WHERE magic_rs_zone IS NULL AND trade_date >= $1 AND %I != $2',
    p_id_col, p_table, p_id_col
  ) USING v_from_date, v_benchmark LOOP
    symbol_id := r.sid;
    rows_updated := compute_magic_rs_batch(
      p_table, p_id_col, r.sid, v_benchmark, v_from_date,
      v_bench_table, v_bench_id_col
    );
    RETURN NEXT;
  END LOOP;
END;
$$;


-- ╔════════════════════════════════════════════════════════════╗
-- ║ Permissions                                                ║
-- ╚════════════════════════════════════════════════════════════╝

GRANT EXECUTE ON FUNCTION compute_all_pending_indicators(TEXT, TEXT, DATE, DATE) TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_flow_intelligence(TEXT, TEXT, DATE, DATE) TO authenticated, kd_app, anon;
GRANT EXECUTE ON FUNCTION compute_all_magic_rs(TEXT, TEXT, INT, DATE)             TO authenticated, kd_app, anon;

-- Drop the old 2-arg overloads so ambiguous callers fail loudly rather
-- than silently resolving to a clamp-bearing path.
DROP FUNCTION IF EXISTS compute_all_pending_indicators(TEXT, TEXT);
DROP FUNCTION IF EXISTS compute_all_flow_intelligence(TEXT, TEXT);

NOTIFY pgrst, 'reload schema';
