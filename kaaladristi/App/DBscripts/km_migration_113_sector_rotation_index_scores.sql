-- ============================================================
-- Migration 113 — Sector Rotation Phase A (SR-B1 + SR-B2)
-- Sprint 10: Sector Rotation
-- Target DB: kaala_dristi_db
-- ============================================================
--
-- SR-B1: Add avg_amt + score columns to km_index_eod
-- SR-B2: Create compute_all_index_scores() RPC
--
-- Run order: SR-B1 first (STEP 1), then SR-B2 (STEP 2).
-- Backfill (SR-B3): after both steps run, call:
--   SELECT * FROM compute_all_index_scores();
--
-- pct_amt_chg is NOT stored — frontend computes it as
--   (avg_amt_5d - avg_amt_22d) / avg_amt_22d * 100
-- ============================================================


-- ── STEP 1 (SR-B1): Add columns to km_index_eod ──────────────────────────────

ALTER TABLE km_index_eod
  ADD COLUMN IF NOT EXISTS avg_amt_5d   NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_amt_22d  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_amt_66d  NUMERIC,
  ADD COLUMN IF NOT EXISTS score_5d     NUMERIC,
  ADD COLUMN IF NOT EXISTS score_22d    NUMERIC;


-- ── STEP 2 (SR-B2): Create compute_all_index_scores() RPC ─────────────────────
--
-- Computes rolling avg_amt and score columns for km_index_eod.
-- Amount basis: value_cr (index-level traded value in ₹ Cr).
-- Window sizes: 5 / 22 / 66 trading-day bars, inclusive of current bar.
--
-- Score formula (spec Section 3.2):
--   surge_5d  = avg_amt_5d  / avg_amt_22d
--   score_5d  = surge_5d²  × 25  if surge_5d  ≥ 1, else 0
--   surge_22d = avg_amt_22d / avg_amt_66d
--   score_22d = surge_22d² × 25  if surge_22d ≥ 1, else 0
--
-- p_from_date (optional):
--   NULL → update all historical rows (full backfill)
--   DATE → update only rows on or after this date (nightly use)
--   The window CTE always scans full history so rolling averages
--   are correct even when p_from_date is recent.
--
-- Returns: one row per index_id — count of rows updated.

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

  -- PASS 2: derive scores from the rolling averages
  with_scores AS (
    SELECT
      c.id,
      c.index_id,
      c.trade_date,
      c.new_avg_amt_5d,
      c.new_avg_amt_22d,
      c.new_avg_amt_66d,

      -- score_5d: surge_5d² × 25 when surge ≥ 1, else 0
      CASE
        WHEN c.new_avg_amt_5d  IS NULL
          OR c.new_avg_amt_22d IS NULL
          OR c.new_avg_amt_22d = 0
          THEN NULL
        WHEN c.new_avg_amt_5d / c.new_avg_amt_22d >= 1.0
          THEN ROUND(POWER(c.new_avg_amt_5d / c.new_avg_amt_22d, 2) * 25, 2)
        ELSE 0
      END AS new_score_5d,

      -- score_22d: surge_22d² × 25 when surge ≥ 1, else 0
      CASE
        WHEN c.new_avg_amt_22d IS NULL
          OR c.new_avg_amt_66d IS NULL
          OR c.new_avg_amt_66d = 0
          THEN NULL
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


-- ── STEP 3: Verify columns exist ───────────────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'km_index_eod'
  AND column_name IN (
    'avg_amt_5d', 'avg_amt_22d', 'avg_amt_66d',
    'score_5d', 'score_22d'
  )
ORDER BY column_name;
