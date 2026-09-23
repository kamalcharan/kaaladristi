-- ═══════════════════════════════════════════════════════════════════════════
-- Stage entry repair — BACKUP and ROLLBACK
-- Run STEP 1 in pgAdmin BEFORE running repair.py. Keep STEP 2 unrun unless
-- the verification fails.
--
-- The repair writes exactly seven columns, all derived. It does NOT touch
-- `stage`, `close`, or anything a scanner filters membership on — only the
-- "in stage since / entry price / % since entry" family.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── STEP 1 · BACKUP (run this first) ──────────────────────────────────────
-- ~37k rows across the 5 affected sessions. Seconds, no locks held after.

CREATE TABLE km_equity_eod_stage_backup_20260923 AS
SELECT id,
       trade_date,
       equity_id,
       stage,                  -- for reference; the repair does not write it
       stage_confirmed,
       stage_since,
       stage_since_close,
       stage_bars,
       stage_run_bars,
       stage_since_censored,
       pct_from_stage_entry
FROM km_equity_eod
WHERE trade_date >= '2026-09-16';

CREATE UNIQUE INDEX ON km_equity_eod_stage_backup_20260923 (id);

-- Confirm it captured the broken state before you proceed:
SELECT trade_date, count(*) AS rows,
       round(avg(stage_bars),1) AS mean_run, max(stage_bars) AS max_run
FROM km_equity_eod_stage_backup_20260923
GROUP BY trade_date ORDER BY trade_date;
-- Expect mean_run 1.0–2.8. If it already shows 20+, the repair has run and
-- this backup is capturing the GOOD state — drop it and re-read before acting.


-- ─── STEP 2 · ROLLBACK (only if verification fails) ────────────────────────
-- Puts every one of the seven columns back exactly as it was.

-- BEGIN;
-- UPDATE km_equity_eod t
-- SET stage_confirmed      = b.stage_confirmed,
--     stage_since          = b.stage_since,
--     stage_since_close    = b.stage_since_close,
--     stage_bars           = b.stage_bars,
--     stage_run_bars       = b.stage_run_bars,
--     stage_since_censored = b.stage_since_censored,
--     pct_from_stage_entry = b.pct_from_stage_entry
-- FROM km_equity_eod_stage_backup_20260923 b
-- WHERE t.id = b.id;
-- -- check the row count matches the backup before committing
-- COMMIT;


-- ─── STEP 3 · VERIFY (after repair.py) ─────────────────────────────────────
SELECT trade_date, count(*) AS s2,
       round(avg(stage_bars),1) AS mean_run,
       max(stage_bars) AS max_run,
       min(stage_since) AS oldest_entry
FROM km_equity_eod
WHERE stage = 'S2' AND trade_date >= '2026-09-15'
GROUP BY trade_date ORDER BY trade_date;
-- PASS: 09-16 onward show mean_run climbing ~28, 29, 30, 31, 32,
--       max_run in the hundreds, oldest_entry in 2024-2025.
-- FAIL: still 1.0-2.8 with oldest_entry 2026-09-17  -> run STEP 2.

-- Spot check one name you know:
SELECT s.symbol, e.stage, e.stage_since, e.stage_since_close,
       e.pct_from_stage_entry, e.stage_bars
FROM km_equity_eod e JOIN km_equity_symbols s ON s.id = e.equity_id
WHERE e.trade_date = '2026-09-22' AND s.symbol = 'TBZ' AND s.exchange = 'NSE';
-- PASS: 2026-07-31 · 276.34 · ~+141 · 36
-- FAIL: 2026-09-22 · 665.35 · 0.00 · 1


-- ─── STEP 4 · CLEANUP (only once you are satisfied, days later) ────────────
-- DROP TABLE km_equity_eod_stage_backup_20260923;
