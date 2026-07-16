-- km_migration_160_compute_rpc_deadlock_fix.sql
-- Target database: kaala_dristi_db
--
-- Root-cause fix for the recurring "deadlock detected" error on
-- nse_magic_rs (and latent risk on the sibling indicator/flow RPCs), which
-- kept km_trading_calendar.status stuck at 'partial' for NSE across
-- 2026-07-13/15/16 and, downstream, froze every scanner reading through
-- fetchRecentDates() at the last fully-'completed' day.
--
-- ROOT CAUSE (confirmed via pg_get_functiondef on the live functions):
--   compute_all_magic_rs / compute_all_flow_intelligence /
--   compute_all_pending_indicators all do:
--     FOR r IN EXECUTE 'SELECT DISTINCT <id_col> AS sid FROM <table> WHERE ...'
--     LOOP  ... UPDATE <table> SET ... WHERE <id_col> = r.sid AND trade_date = ...
--   with NO ORDER BY on the symbol-selection query, and the entire
--   multi-symbol UPDATE loop runs inside ONE transaction (handlers.py's
--   _rpc() does a single cur.execute() + one conn.commit() after — row
--   locks acquired mid-loop are held until the whole call finishes).
--
--   km_jobs shows ~20 'fix' jobs for magic_rs-family dimensions across
--   2026-07-14/15/16 all queued in a single batch (identical created_at
--   microsecond). If 2+ of those get claimed by concurrent worker
--   processes, each invocation iterates equity/index IDs in an order
--   Postgres does not guarantee is stable — two concurrent invocations
--   can lock the same rows in reverse order and deadlock (exactly the
--   observed "process A waits on B; B waits on A" error, on a
--   km_equity_eod UPDATE from magic_rs). Also: nse_magic_rs and
--   bse_magic_rs are NOT exchange-scoped inside the RPC at all (no
--   exchange param) — they process the FULL km_equity_eod symbol set,
--   so any two magic_rs-family jobs, not just same-named ones, contend
--   for the same rows.
--
-- FIX (two layers, both cheap and behavior-preserving otherwise):
--   1. pg_advisory_xact_lock(hashtext(function_name), hashtext(p_table))
--      at the top of each function — serializes concurrent invocations of
--      the SAME function against the SAME table (transaction-scoped, no
--      manual unlock, released automatically on commit/rollback/error).
--      Different tables (km_equity_eod vs km_index_eod) still run
--      concurrently; different functions (magic_rs vs indicators vs flow)
--      still run concurrently — only genuinely colliding work serializes.
--   2. ORDER BY <id_col> added to the symbol-selection query in all three
--      — defense in depth: even if the advisory lock is ever bypassed by
--      a future call path, consistent lock-acquisition order across
--      invocations is the standard fix for this deadlock class.
--
-- No signature or return-type change — safe CREATE OR REPLACE, no
-- application code changes required.

CREATE OR REPLACE FUNCTION public.compute_all_magic_rs(
  p_table text, p_id_col text,
  p_benchmark_id integer DEFAULT NULL::integer,
  p_from_date date DEFAULT NULL::date
)
RETURNS TABLE(symbol_id integer, rows_updated integer)
LANGUAGE plpgsql
AS $function$
DECLARE
  r              RECORD;
  v_benchmark    INT  := p_benchmark_id;
  v_from_date    DATE := p_from_date;
  v_bench_table  TEXT;
  v_bench_id_col TEXT;
BEGIN
  -- Serialize concurrent invocations against the same table — see
  -- migration 160 header for the deadlock this prevents.
  PERFORM pg_advisory_xact_lock(hashtext('compute_all_magic_rs'), hashtext(p_table));

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
    'WHERE magic_rs_zone IS NULL AND trade_date >= $1 AND %I != $2 '
    'ORDER BY 1',
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
$function$;


CREATE OR REPLACE FUNCTION public.compute_all_flow_intelligence(
  p_table text DEFAULT 'km_index_eod'::text,
  p_id_col text DEFAULT 'index_id'::text,
  p_from_date date DEFAULT NULL::date,
  p_to_date date DEFAULT NULL::date
)
RETURNS TABLE(symbol_id integer, rows_updated integer)
LANGUAGE plpgsql
AS $function$
DECLARE
  r           RECORD;
  v_where_sql TEXT;
  v_sql       TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('compute_all_flow_intelligence'), hashtext(p_table));

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
      'SELECT DISTINCT %I AS sid FROM %I WHERE trade_date BETWEEN $1 AND $2 ORDER BY 1',
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
    v_sql := format('SELECT DISTINCT %I AS sid FROM %I ORDER BY 1', p_id_col, p_table);
    FOR r IN EXECUTE v_sql LOOP
      symbol_id := r.sid;
      rows_updated := compute_flow_intelligence(p_table, p_id_col, r.sid);
      RETURN NEXT;
    END LOOP;
  END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.compute_all_pending_indicators(
  p_table text DEFAULT 'km_index_eod'::text,
  p_id_col text DEFAULT 'index_id'::text,
  p_from_date date DEFAULT NULL::date,
  p_to_date date DEFAULT NULL::date
)
RETURNS TABLE(symbol_id integer, rows_updated integer)
LANGUAGE plpgsql
AS $function$
DECLARE
  r           RECORD;
  v_from_date DATE;
  v_to_date   DATE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('compute_all_pending_indicators'), hashtext(p_table));

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
    '  AND trade_date BETWEEN $1 AND $2 '
    'ORDER BY 1',
    p_id_col, p_table
  ) USING v_from_date, v_to_date LOOP
    symbol_id := r.sid;
    rows_updated := compute_indicators_batch(
      p_table, p_id_col, r.sid, v_from_date
    );
    RETURN NEXT;
  END LOOP;
END;
$function$;
