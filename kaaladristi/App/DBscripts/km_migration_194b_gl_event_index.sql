-- =====================================================================
-- Migration 194b — the Golden Line event index
-- Target DB: kaala_dristi_db
--
-- SEPARATE FILE, and it has to be. CREATE INDEX CONCURRENTLY cannot run
-- inside a transaction block, and pgAdmin's Query Tool wraps a
-- multi-statement script in one, so this cannot live alongside the DDL in
-- migration 194 — it would fail the whole file.
--
-- RUN IT ALONE, in its own Query Tool tab, with nothing else in the editor.
--
-- OPTIONAL. Both GL scanners filter trade_date = <date> AND gl_event =
-- <event>, and idx_equity_eod_trade_date already narrows that to one
-- session's ~7,500 rows. This index makes that lookup cheaper; it does not
-- make it possible. Skip it until the scanners are actually slow.
--
-- CONCURRENTLY takes no blocking lock, so it is safe during market hours and
-- alongside the nightly pipeline. It costs two passes over a 17M-row, 26 GB
-- table — expect 5-20 minutes.
--
-- If it fails partway it leaves an INVALID index behind. Check with:
--   SELECT indexrelid::regclass, indisvalid FROM pg_index
--   WHERE indexrelid = 'idx_equity_eod_gl_event'::regclass;
-- and if indisvalid is false:
--   DROP INDEX idx_equity_eod_gl_event;
-- then run this again.
-- =====================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equity_eod_gl_event
    ON km_equity_eod (trade_date, gl_event) WHERE gl_event IS NOT NULL;
