-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 152 — Foolproof custom-index synthesis (return-chained level)
-- Target DB: kaala_dristi_db
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PROBLEM (POA Phase 1, diagnosed on index_id 115 "Wealth Management"):
--   compute_custom_index_eod() synthesised the level as a RAW-PRICE AVERAGE
--   -- AVG(constituent close) -- over whatever constituents had data each day.
--   Custom-index constituents list at STAGGERED dates and very different price
--   scales (e.g. this basket: SHAREINDIA ~177, NUVAMA ~1863). So every time a
--   new stock listed, the basket LEVEL JUMPED (NUVAMA joining in 2023, ARSSBL
--   in 2025) -- producing disconnected candle clusters and a 89 -> 3145 scale
--   drift, and a chart whose price axis ran negative. Raw-price averaging is
--   never a valid index construction.
--
-- FIX — return-chained synthesis (rebased to 1000):
--   For each date t (ascending), per custom index:
--     present   = constituents with a valid close (>0) on BOTH t and t-1
--     basketRet = AVG( close[t]/close[t-1] - 1 )  over `present`  (equal weight,
--                 clamped to +/-50% as a sanity guard against bad prints)
--     level[t]  = 1000 * cumulative-product(1 + basketRet)   [via EXP(SUM(LN))]
--   A new constituent contributes only once it has two consecutive closes, so
--   joining NEVER jumps the level; gaps/delistings just drop a name from
--   `present` for that day. pct_chng and ret_5d/22d/66d are derived from the
--   chained level, so they are internally consistent with it.
--
-- INTEGRITY GUARDS ("foolproof"):
--   1. Bad-value guard — constituent rows with close <= 0 / NULL are excluded.
--   2. Coverage gate   — a date is emitted only when at least
--                        GREATEST(2, CEIL(0.5 * total_constituents)) constituents
--                        contribute a return (honest gap beats a fake print;
--                        also drops the single-constituent early era).
--   3. Sanity clamp    — per-constituent daily return clamped to +/-50% (also
--                        keeps LN(1+ret) finite).
--   4. Base discipline — rebased to 1000 at the first COVERAGE-PASSING date.
--
-- WINDOWED RECOMPUTE: the chained level needs full history to seed level[t-1],
-- so the function always computes the whole series internally and only UPSERTs
-- rows inside [p_from_date, p_to_date] (or all, when NULL). Signature is
-- unchanged, so pipeline2 handle_index_returns and
-- scripts/compute_custom_index_eod.py keep calling it as-is.
--
-- OUT OF SCOPE (separate work, B78): rsi_14 / flow_type / magic_rs / score_*
-- for custom indices. This migration guarantees the PRICE SERIES only.
--
-- BACKFILL AFTER APPLYING:
--   SELECT compute_custom_index_eod();          -- full history, all custom idx
--   SELECT compute_all_index_scores();          -- refresh scores
-- (or run scripts/compute_custom_index_eod.py, which calls the same RPC.)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.compute_custom_index_eod(
  p_from_date date    DEFAULT NULL,
  p_to_date   date    DEFAULT NULL,
  p_index_id  integer DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  affected INT := 0;
BEGIN
  WITH cons AS (
    -- Constituent set per active custom index (+ its total count for the gate).
    SELECT c.index_id, c.equity_id,
           COUNT(*) OVER (PARTITION BY c.index_id) AS total_cons
    FROM km_index_constituents c
    JOIN km_index_symbols s ON s.id = c.index_id
    WHERE s.category = 'custom'
      AND s.is_active = true
      AND (p_index_id IS NULL OR c.index_id = p_index_id)
  ),
  px AS (
    -- Valid constituent closes + each constituent's previous close.
    SELECT cons.index_id, cons.total_cons, e.equity_id, e.trade_date,
           e.close, e.volume, e.value_cr,
           LAG(e.close) OVER (PARTITION BY cons.index_id, e.equity_id
                              ORDER BY e.trade_date) AS prev_close
    FROM cons
    JOIN km_equity_eod e ON e.equity_id = cons.equity_id
    WHERE e.close > 0
  ),
  day_ret AS (
    -- Per index/date: equal-weight basket return over constituents present both
    -- days (clamped), plus coverage count and aggregate volume/value.
    SELECT index_id, trade_date,
           MAX(total_cons) AS total_cons,
           COUNT(*) FILTER (WHERE prev_close IS NOT NULL AND prev_close > 0) AS ret_n,
           AVG(CASE WHEN prev_close IS NOT NULL AND prev_close > 0
                    THEN LEAST(0.5, GREATEST(-0.5, close / prev_close - 1))
               END) AS basket_ret,
           SUM(volume)   AS volume,
           SUM(value_cr) AS value_cr
    FROM px
    GROUP BY index_id, trade_date
  ),
  gated AS (
    -- Coverage gate: enough constituents contributing a return.
    SELECT *
    FROM day_ret
    WHERE ret_n >= GREATEST(2, CEIL(0.5 * total_cons))
      AND basket_ret IS NOT NULL
  ),
  chained AS (
    -- Cumulative-product level, rebased to 1000 at the first gated date.
    SELECT index_id, trade_date, basket_ret, volume, value_cr,
           1000 * EXP(SUM(LN(1 + basket_ret))
                      OVER (PARTITION BY index_id ORDER BY trade_date)) AS lvl
    FROM gated
  ),
  bars AS (
    SELECT index_id, trade_date, basket_ret, volume, value_cr, lvl,
           LAG(lvl)     OVER w AS prev_lvl,
           LAG(lvl, 5)  OVER w AS lvl_5,
           LAG(lvl, 22) OVER w AS lvl_22,
           LAG(lvl, 66) OVER w AS lvl_66
    FROM chained
    WINDOW w AS (PARTITION BY index_id ORDER BY trade_date)
  )
  INSERT INTO km_index_eod (index_id, trade_date, open, high, low, close,
                            pct_chng, volume, value_cr, ret_5d, ret_22d, ret_66d)
  SELECT
    index_id,
    trade_date,
    COALESCE(prev_lvl, lvl)                AS open,
    GREATEST(COALESCE(prev_lvl, lvl), lvl) AS high,
    LEAST(COALESCE(prev_lvl, lvl), lvl)    AS low,
    lvl                                    AS close,
    ROUND((basket_ret * 100)::numeric, 4)  AS pct_chng,
    volume,
    value_cr,
    CASE WHEN lvl_5  > 0 THEN ROUND(((lvl / lvl_5  - 1) * 100)::numeric, 4) END AS ret_5d,
    CASE WHEN lvl_22 > 0 THEN ROUND(((lvl / lvl_22 - 1) * 100)::numeric, 4) END AS ret_22d,
    CASE WHEN lvl_66 > 0 THEN ROUND(((lvl / lvl_66 - 1) * 100)::numeric, 4) END AS ret_66d
  FROM bars
  WHERE (p_from_date IS NULL OR trade_date >= p_from_date)
    AND (p_to_date   IS NULL OR trade_date <= p_to_date)
  ON CONFLICT (index_id, trade_date) DO UPDATE SET
    open     = EXCLUDED.open,
    high     = EXCLUDED.high,
    low      = EXCLUDED.low,
    close    = EXCLUDED.close,
    pct_chng = EXCLUDED.pct_chng,
    volume   = EXCLUDED.volume,
    value_cr = EXCLUDED.value_cr,
    ret_5d   = EXCLUDED.ret_5d,
    ret_22d  = EXCLUDED.ret_22d,
    ret_66d  = EXCLUDED.ret_66d;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;

-- ── Data-health view — feeds the Manage-page health strip + a quick audit ────
-- Per custom index: bar coverage, level range, worst day move, and any bars the
-- (post-fix) series still flags as suspect (|pct_chng| near the clamp ceiling).
CREATE OR REPLACE VIEW v_custom_index_health AS
SELECT
  s.id   AS index_id,
  s.name AS index_name,
  COUNT(e.*)                               AS bars,
  MIN(e.trade_date)                        AS first_bar,
  MAX(e.trade_date)                        AS last_bar,
  ROUND(MIN(e.close), 2)                   AS min_close,
  ROUND(MAX(e.close), 2)                   AS max_close,
  COUNT(*) FILTER (WHERE e.close <= 0)      AS bad_close_bars,
  COUNT(*) FILTER (WHERE ABS(e.pct_chng) >= 40) AS suspect_jump_bars,
  (SELECT COUNT(*) FROM km_index_constituents c WHERE c.index_id = s.id) AS constituents
FROM km_index_symbols s
LEFT JOIN km_index_eod e ON e.index_id = s.id
WHERE s.category = 'custom'
GROUP BY s.id, s.name;

GRANT SELECT ON v_custom_index_health TO authenticated, anon, kd_app;
NOTIFY pgrst, 'reload schema';
