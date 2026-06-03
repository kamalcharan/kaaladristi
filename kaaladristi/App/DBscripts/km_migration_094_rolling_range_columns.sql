-- Migration 094: Add lifetime_high column + backfill w52_high, w52_low, lifetime_high
-- w52_high / w52_low may already exist from a prior migration; lifetime_high is new.

-- ── Step 1: Add columns if missing ────────────────────────────────────────
ALTER TABLE km_equity_eod
  ADD COLUMN IF NOT EXISTS w52_high      NUMERIC,
  ADD COLUMN IF NOT EXISTS w52_low       NUMERIC,
  ADD COLUMN IF NOT EXISTS lifetime_high NUMERIC;

-- ── Step 2: Backfill all three in one pass ─────────────────────────────────
-- Uses window functions — runs over the full km_equity_eod table.
-- Expected runtime: 3–10 minutes depending on VPS IO.
-- w52_high / w52_low  : 252-bar rolling window (≈ 1 trading year)
-- lifetime_high       : expanding max from each stock's first record

UPDATE km_equity_eod e
SET
  w52_high      = sub.w52_high,
  w52_low       = sub.w52_low,
  lifetime_high = sub.lifetime_high
FROM (
  SELECT
    id,
    MAX(high) OVER (
      PARTITION BY equity_id
      ORDER BY trade_date
      ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
    ) AS w52_high,
    MIN(low) OVER (
      PARTITION BY equity_id
      ORDER BY trade_date
      ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
    ) AS w52_low,
    MAX(high) OVER (
      PARTITION BY equity_id
      ORDER BY trade_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS lifetime_high
  FROM km_equity_eod
) sub
WHERE e.id = sub.id;

-- ── Step 3: Verify ─────────────────────────────────────────────────────────
-- Run manually after the UPDATE completes:
--
-- SELECT
--   COUNT(*) AS total_rows,
--   COUNT(w52_high) AS with_w52_high,
--   COUNT(w52_low) AS with_w52_low,
--   COUNT(lifetime_high) AS with_lifetime_high
-- FROM km_equity_eod
-- WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod);

-- ── Step 4: Index for fast range queries ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_km_equity_eod_w52_high
  ON km_equity_eod (equity_id, trade_date, w52_high)
  WHERE w52_high IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_km_equity_eod_lifetime_high
  ON km_equity_eod (equity_id, trade_date, lifetime_high)
  WHERE lifetime_high IS NOT NULL;
