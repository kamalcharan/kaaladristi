-- =============================================================================
-- Migration 167 — Rescale NSE km_equity_eod.value_cr to true Crores
-- Target database: kaala_dristi_db
-- =============================================================================
--
-- WHAT WAS WRONG
-- --------------
-- parse_nse_bhav() divided the bhavcopy turnover column by 100, on the
-- assumption it reported Lakhs. That was correct for the legacy NSE bhavcopy
-- ('TOTTRDVAL', Lakhs) but NSE moved to the UDiFF format, where 'TtlTrfVal'
-- reports **Rupees**. _NSE_BHAV_MAP funnels both headers into the same field, so
-- /100 was applied to Rupees — leaving every NSE equity row inflated by exactly
-- 1e5 relative to true Crores.
--
-- Measured on 2026-07-31 before the fix:
--     exchange   avg stored value_cr    avg volume*close/1e7    ratio
--     BSE                       2.38                    2.39      1.0   (correct)
--     NSE               8,567,714.81                   85.80   99,857   (1e5x)
--
-- Wrong for every NSE equity bar since the UDiFF cutover (~2025-06).
-- BSE was never affected — parse_bse_bhav() already divides by 1e7.
--
-- WHY IT WAS NEVER CAUGHT
-- -----------------------
-- Every health check measures column fill-rate, row count, or step exceptions.
-- value_cr was 100% populated the whole time, so the dashboard read green.
-- See CLAUDE.md "Health checks measure PRESENCE, not CORRECTNESS".
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- Divides NSE km_equity_eod.value_cr by 1e5 so it holds true Crores, matching
-- BSE. Idempotent by construction: it only touches rows whose stored value is
-- implausible against the volume*close identity, so a second run is a no-op.
--
-- km_index_eod is NOT touched — the index bhavcopy column is already labelled
-- 'Turnover (Rs. Cr.)' and is ingested unscaled (NIFTY 50 on 2026-07-31 reads
-- 34,459.53 Cr, which is correct).
--
-- ORDER OF OPERATIONS — IMPORTANT
-- -------------------------------
--   1. Deploy the code change first (parser.py + compute_engine.py +
--      scripts/backfill_rolling_metrics*.py). Until it is deployed, each nightly
--      run re-inserts NSE rows at the old 1e5 scale.
--   2. Run this migration.
--   3. Re-run rolling metrics over history so avg_amt_5d / avg_amt_22d /
--      delivery_surge_x / deliv_value_cr are rebuilt on the corrected scale:
--          cd App/backend/scripts
--          KD_DB_PASSWORD=... python backfill_rolling_metrics_fast.py
--      This also fixes BSE, whose delivery values were ~1e7x understated by the
--      old compute_engine formula (no BSE stock has ever cleared Conviction
--      Flow's avg_amt_22d floor as a result).
--
-- ROLLBACK
--   UPDATE km_equity_eod e SET value_cr = value_cr * 1e5
--     FROM km_equity_symbols s
--    WHERE s.id = e.equity_id AND s.exchange = 'NSE' AND e.value_cr IS NOT NULL;
-- =============================================================================

BEGIN;

-- ── Before ────────────────────────────────────────────────────────────────
\echo '--- BEFORE ---'
SELECT s.exchange,
       count(*)                            AS rows_with_value,
       round(avg(e.value_cr), 2)           AS avg_stored_value_cr,
       round(avg(e.volume * e.close / 1e7), 2) AS avg_true_value_cr
  FROM km_equity_eod e
  JOIN km_equity_symbols s ON s.id = e.equity_id
 WHERE e.trade_date = (SELECT max(trade_date) FROM km_equity_eod)
   AND e.value_cr IS NOT NULL AND e.volume > 0 AND e.close > 0
 GROUP BY s.exchange;

-- ── Rescale ───────────────────────────────────────────────────────────────
-- Guard: only rows at least 1000x above the volume*close identity are rescaled.
-- Genuine crore-scale rows sit near 1.0, so already-corrected data is skipped
-- and re-running this migration changes nothing.
UPDATE km_equity_eod e
   SET value_cr = e.value_cr / 1e5
  FROM km_equity_symbols s
 WHERE s.id = e.equity_id
   AND s.exchange = 'NSE'
   AND e.value_cr IS NOT NULL
   AND e.volume > 0
   AND e.close  > 0
   AND e.value_cr > (e.volume * e.close / 1e7) * 1000;

-- ── After ─────────────────────────────────────────────────────────────────
\echo '--- AFTER (ratio should be ~1.0 on both exchanges) ---'
SELECT s.exchange,
       count(*)                                AS rows_with_value,
       round(avg(e.value_cr), 2)               AS avg_stored_value_cr,
       round(avg(e.volume * e.close / 1e7), 2) AS avg_true_value_cr,
       round(avg(e.value_cr) / NULLIF(avg(e.volume * e.close / 1e7), 0), 3) AS ratio
  FROM km_equity_eod e
  JOIN km_equity_symbols s ON s.id = e.equity_id
 WHERE e.trade_date = (SELECT max(trade_date) FROM km_equity_eod)
   AND e.value_cr IS NOT NULL AND e.volume > 0 AND e.close > 0
 GROUP BY s.exchange;

COMMIT;
