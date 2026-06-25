-- ============================================================
-- Migration 114 — Fix score_5d / score_22d NULL vs zero
-- Target DB: kaala_dristi_db
-- ============================================================
--
-- Problem: score_5d and score_22d were NULL when:
--   (a) avg_amt data is missing (early rows / zero-delivery stocks)
--   (b) surge < 1 in the equity pipeline (returned p5d instead of 0)
--
-- Fix: score is always 0 or positive, never NULL.
--   surge ≥ 1  →  surge² × 25
--   surge < 1  →  0
--   missing    →  0
--
-- This migration fixes compute_all_index_scores() for (a).
-- backfill_rolling_metrics_fast.py is fixed separately for (a)+(b).
--
-- After running this migration, re-run the backfill scripts:
--   python3 App/backend/scripts/backfill_rolling_metrics_fast.py --from 2026-06-24 --to 2026-06-24
--   python3 App/backend/scripts/backfill_index_scores.py
-- ============================================================

CREATE OR REPLACE FUNCTION compute_all_index_scores(
  p_from_date DATE DEFAULT NULL
)
RETURNS TABLE(out_index_id INT, rows_updated INT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH

  -- PASS 1: rolling averages over ALL history (no date filter)
  -- so window functions have full look-back for every row.
  computed AS (
    SELECT
      e.id,
      e.index_id,
      e.trade_date,

      -- 5-bar window: current bar + 4 preceding
      AVG(e.value_cr) OVER (
        PARTITION BY e.index_id
        ORDER BY e.trade_date
        ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
      ) AS new_avg_amt_5d,

      -- 22-bar window: current bar + 21 preceding
      AVG(e.value_cr) OVER (
        PARTITION BY e.index_id
        ORDER BY e.trade_date
        ROWS BETWEEN 21 PRECEDING AND CURRENT ROW
      ) AS new_avg_amt_22d,

      -- 66-bar window: current bar + 65 preceding
      AVG(e.value_cr) OVER (
        PARTITION BY e.index_id
        ORDER BY e.trade_date
        ROWS BETWEEN 65 PRECEDING AND CURRENT ROW
      ) AS new_avg_amt_66d

    FROM km_index_eod e
  ),

  -- PASS 2: derive scores — always 0 or positive, never NULL
  with_scores AS (
    SELECT
      c.id,
      c.index_id,
      c.trade_date,
      c.new_avg_amt_5d,
      c.new_avg_amt_22d,
      c.new_avg_amt_66d,

      -- score_5d: surge²×25 when surge≥1, else 0 (never NULL)
      CASE
        WHEN c.new_avg_amt_5d  IS NULL
          OR c.new_avg_amt_22d IS NULL
          OR c.new_avg_amt_22d = 0
          THEN 0
        WHEN c.new_avg_amt_5d / c.new_avg_amt_22d >= 1.0
          THEN ROUND(POWER(c.new_avg_amt_5d / c.new_avg_amt_22d, 2) * 25, 2)
        ELSE 0
      END AS new_score_5d,

      -- score_22d: surge²×25 when surge≥1, else 0 (never NULL)
      CASE
        WHEN c.new_avg_amt_22d IS NULL
          OR c.new_avg_amt_66d IS NULL
          OR c.new_avg_amt_66d = 0
          THEN 0
        WHEN c.new_avg_amt_22d / c.new_avg_amt_66d >= 1.0
          THEN ROUND(POWER(c.new_avg_amt_22d / c.new_avg_amt_66d, 2) * 25, 2)
        ELSE 0
      END AS new_score_22d

    FROM computed c
  ),

  -- UPDATE: write back to km_index_eod, filtered by p_from_date if set
  updated AS (
    UPDATE km_index_eod e
    SET
      avg_amt_5d  = ws.new_avg_amt_5d,
      avg_amt_22d = ws.new_avg_amt_22d,
      avg_amt_66d = ws.new_avg_amt_66d,
      score_5d    = ws.new_score_5d,
      score_22d   = ws.new_score_22d
    FROM with_scores ws
    WHERE e.id = ws.id
      AND (p_from_date IS NULL OR ws.trade_date >= p_from_date)
    RETURNING e.index_id
  )

  SELECT
    u.index_id::INT AS out_index_id,
    COUNT(*)::INT   AS rows_updated
  FROM updated u
  GROUP BY u.index_id
  ORDER BY u.index_id;

END;
$$;


-- ── Verify ─────────────────────────────────────────────────────────────────────
-- After re-running backfill scripts, run this to confirm zero NULLs on 2026-06-24:
--
-- SELECT
--   COUNT(*) FILTER (WHERE score_5d  IS NULL) AS null_score_5d,
--   COUNT(*) FILTER (WHERE score_22d IS NULL) AS null_score_22d,
--   COUNT(*) AS total_rows
-- FROM km_index_eod
-- WHERE trade_date = '2026-06-24';
