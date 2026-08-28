-- ============================================================================
-- km_migration_196_wg_gl_event_date.sql
-- Target DB: kaala_dristi_db
--
-- One column: km_wg_journeys.gl_event_date — WHEN the Golden Line event fired.
--
-- Until now gl_event was read off each stock's latest bar. A GL breakout is a
-- one-day event, so the chip had a one-day lifespan: BBTC and WHIRLPOOL broke
-- out on 2026-08-27, the next session's bar arrived, and both marks vanished.
-- The table went from 2 lit rows to 0 overnight with nothing wrong in the data.
--
-- compute_wg_journeys.py now reads the most recent event within 30 sessions
-- (owner call, 2026-08-28), which means a lit chip can be anywhere from
-- yesterday to six weeks old. Without a date, a stale mark and a fresh one look
-- identical — and freshness is the whole point of the wake-window filter. This
-- column carries the event's own bar date so the row can say how old it is.
--
-- km_wg_journeys holds ~1,113 rows, so the ALTER is instant. This is NOT the
-- km_equity_eod lock problem from migrations 192/194.
-- ============================================================================

BEGIN;

ALTER TABLE km_wg_journeys
  ADD COLUMN IF NOT EXISTS gl_event_date DATE;

COMMENT ON COLUMN km_wg_journeys.gl_event_date IS
  'Bar date of the Golden Line event in gl_event. NULL when no SVD/SBD-backed '
  'event fired within the 30-session lookback. Written by compute_wg_journeys.py.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Then re-run, in order:
--   python scripts/backfill_gl_events.py       (detection widened to +/-5 days)
--   python scripts/compute_wg_journeys.py
