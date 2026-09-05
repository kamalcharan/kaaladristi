-- ============================================================================
-- km_migration_200b_bm_event_index.sql
-- Target DB: kaala_dristi_db
--
-- Split out of migration 200 for the same reason 194b was split out of 194:
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and
-- pgAdmin's Query Tool wraps a multi-statement script in one -- so leaving it
-- in the main file fails halfway through no matter what the rest does.
--
-- Run this on its own, any time after migration 200. CONCURRENTLY takes no
-- blocking lock, so it is safe during market hours and during the nightly
-- pipeline. It can also be run BEFORE the Big Money backfill -- an index on a
-- column that is entirely NULL is simply empty, and it fills as the backfill
-- writes.
--
-- WHY THIS SHAPE, and why it differs from idx_equity_eod_gl_event
--
--   idx_equity_eod_gl_event is (trade_date, gl_event) because both GL
--   scanners ask "which stocks had an event ON this date".
--
--   Big Money is asked the other way round. The matview's bm_last CTE is a
--   DISTINCT ON (equity_id) ... ORDER BY equity_id, trade_date DESC -- "the
--   most recent event for each stock", which wants the equity leading and the
--   date descending. A (trade_date, bm_event) index would force a full scan of
--   every event row in history to answer it.
--
-- Partial, because bm_event is NULL on the overwhelming majority of bars (a
-- Big Money day is structurally rare -- around 5 a year on a stock that has
-- them at all). The index covers only the event rows, so it stays small
-- enough to sit in cache.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equity_eod_bm_event
    ON km_equity_eod (equity_id, trade_date DESC)
    WHERE bm_event IS NOT NULL;

-- Verify (expect a small index -- tens of MB at most, not hundreds):
--   SELECT pg_size_pretty(pg_relation_size('idx_equity_eod_bm_event'));
--   SELECT count(*) FROM km_equity_eod WHERE bm_event IS NOT NULL;
