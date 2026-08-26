-- =====================================================================
-- km_migration_179_partial_month_cleanup.sql
-- Target database: kaala_dristi_db
-- Finish the partial-monthly-bar cleanup migration 178 started
-- =====================================================================
-- Migration 178 deleted the 2026-08-05 rows, which was the bulk of the
-- partial August bar (3,184 rows) — but NOT all of it. Monthly bars are
-- stamped with each stock's OWN last trading day in the period, so an
-- illiquid stock whose last August trade was the 3rd or 4th carries a
-- bar dated 2026-08-03 / 2026-08-04. 80 such rows survived (35 + 45) and
-- the integrity sweep caught them on its first live run — which is
-- exactly the behaviour the sweep exists for.
--
-- The rule this encodes: NO monthly bar may exist inside a month that is
-- still in progress, whatever day it is stamped with. Code-side this is
-- already prevented (pipeline/compute/monthly_bars.py refuses to write a
-- period still open); this clears the residue.
--
-- Idempotent and self-limiting: it only ever touches the current month,
-- and only while that month is still open. August's real bar is written
-- by the normal month-end run.

DELETE FROM km_equity_monthly
WHERE trade_date >= DATE_TRUNC('month', CURRENT_DATE)::date
  AND CURRENT_DATE < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;

-- Verify (expect 2026-07-31 until the month-end run writes August):
--   SELECT MAX(trade_date) FROM km_equity_monthly;
