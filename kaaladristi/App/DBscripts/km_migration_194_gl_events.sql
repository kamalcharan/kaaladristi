-- =====================================================================
-- Migration 194 — Golden Line events on km_equity_eod
-- Target DB: kaala_dristi_db
--
-- The Golden Line is sma_150 — a 150-BAR mean of close (migration 014:
-- v_sum / 150), the same series compute_wg_journeys.py recomputes in memory
-- as gl_arr. It has been on this table all along; nothing new is needed to
-- see it, only to record what happens AT it.
--
-- TWO EVENTS, owner-specified
--
--   BREAKOUT  yesterday's close was at or below the Golden Line, today's is
--             above it, and today prints SVD or SBD. One bar, one event: the
--             volume confirms the cross itself.
--
--   RETEST    the bar's LOW reaches or breaks the Golden Line while the CLOSE
--             holds above it, on an SVD/SBD day, after the stock has already
--             held above the line for at least GL_RETEST_MIN_DAYS_ABOVE
--             prior sessions. The precondition is what makes it a retest of
--             an established reclaim rather than chop around the line.
--
-- BREAKOUT wins if both somehow match: a bar whose prior close was below the
-- line cannot be retesting a reclaim it has not made yet.
--
-- gl_days_above is stored, not just used: "held the line for 40 sessions" is
-- worth reading on its own, and it is the number the retest rule is built on,
-- so it should be inspectable rather than buried in a WHERE clause.
--
-- ORDERING — the reason this is its own pipeline step
--
-- The events need BOTH sma_150 (from the indicator steps) and the SVD/SBD
-- dots. `dots` is step 35 of 38, well after rolling_metrics at 22, so this
-- cannot ride along with the rolling metrics: it would compute against
-- yesterday's dots and silently miss every event on the day it happened.
-- handle_gl_events runs between `dots` and `scan_refresh`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FOUR SEPARATE TRANSACTIONS, deliberately. The first draft wrapped the
-- whole file in one, so a lock timeout on ANY table discarded everything --
-- including the preset rows, which take no meaningful lock at all. Run them
-- in order; if one fails on a lock, clear the blocker and re-run just that
-- part. Every statement is IF NOT EXISTS / ON CONFLICT, so re-running a part
-- that already succeeded is a no-op.
-- ---------------------------------------------------------------------

-- (1) km_equity_eod columns.
--
-- POLLED, not queued. ADD COLUMN on a nullable column with no default is a
-- catalogue change — instant once it holds the lock. The whole difficulty is
-- ACQUIRING it: ACCESS EXCLUSIVE needs every other lock on the table released
-- at the same instant, and km_equity_eod is the busiest table here (PostgREST
-- readers, the pipeline, any running backfill). A plain ALTER can starve
-- indefinitely, and while it waits it blocks every NEW reader behind it — the
-- migration stops looking like a lock and starts looking like an outage.
--
-- So: a short lock_timeout and a retry loop. Each attempt gives up after 2
-- seconds and releases the queue, so readers keep flowing between attempts,
-- then retries after 1 second — two thirds of the wall clock is spent trying,
-- which matters when the gap you need is momentary.
--
-- 200 attempts is about ten minutes. Exhausting that is a FINDING, not a
-- longer wait: it means the lock is held continuously, and the thing to do is
-- look at what holds it (pg_locks joined to pg_stat_activity on
-- 'km_equity_eod'::regclass shows HOLDERS; pg_blocking_pids shows nothing
-- here because this loop is only ever waiting for two seconds at a time) and
-- stop it — a running backfill, the pipeline scheduler, or a client left in
-- an open transaction.

-- Fail fast instead of queueing. An ALTER waiting on ACCESS EXCLUSIVE also
-- blocks every read that arrives behind it, so a migration parked on a
-- zombie transaction takes the Waking Giants tabs down with it and looks
-- like a slow migration rather than a lock. 30s, then an error that names
-- the problem. Seen live: migration 192 sat 20 minutes behind an orphaned
-- DELETE from a crashed compute run.
SET lock_timeout = '2s';

DO $do$
DECLARE tries int := 0;
BEGIN
  LOOP
    tries := tries + 1;
    BEGIN
      ALTER TABLE km_equity_eod
          -- Signed distance from the Golden Line. Positive = above.
          ADD COLUMN IF NOT EXISTS pct_from_gl   NUMERIC(10,2),
          -- 'BREAKOUT' | 'RETEST' | NULL
          ADD COLUMN IF NOT EXISTS gl_event      VARCHAR(16),
          -- Consecutive sessions closed above the Golden Line, this bar included.
          ADD COLUMN IF NOT EXISTS gl_days_above INTEGER;
      RAISE NOTICE 'km_equity_eod: columns added (attempt %)', tries;
      EXIT;
    EXCEPTION WHEN lock_not_available THEN
      IF tries >= 200 THEN
        RAISE EXCEPTION
          'km_equity_eod still locked after % attempts (~10 min). Something is holding a long transaction — find it with pg_blocking_pids() rather than waiting.', tries;
      END IF;
      IF tries % 20 = 0 THEN
        RAISE NOTICE 'km_equity_eod still busy after % attempts — a reader stream, not one stuck txn', tries;
      END IF;
      PERFORM pg_sleep(1);
    END;
  END LOOP;
END
$do$;

COMMENT ON COLUMN km_equity_eod.pct_from_gl IS
    'Signed % distance of close from the Golden Line (sma_150). Positive = above.';
COMMENT ON COLUMN km_equity_eod.gl_event IS
    'BREAKOUT = crossed above the Golden Line on an SVD/SBD day. RETEST = touched it intraday, closed above, on an SVD/SBD day, after 10+ sessions holding it.';

-- No COMMIT here: parts 1 and 3 run their DO blocks in autocommit, so each
-- retry releases the lock queue between attempts. Wrapping them in an
-- explicit transaction would hold whatever they had already taken across
-- every pg_sleep, which is the queueing behaviour this replaces.

-- (2) The partial index — both scanners filter on the event being present,
-- and events are rare, so it stays small. CONCURRENTLY cannot run inside a transaction block, which is
-- why it sits outside one: a plain CREATE INDEX on km_equity_eod takes a
-- lock that blocks writes for the whole build on a table of this size, and
-- the nightly pipeline writes to it. This form is slower but takes no
-- blocking lock. If it ever fails it leaves an INVALID index behind --
-- DROP INDEX idx_equity_eod_gl_event; and run it again.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equity_eod_gl_event
    ON km_equity_eod (trade_date, gl_event) WHERE gl_event IS NOT NULL;

-- (3) km_wg_journeys columns. This is the table a crashed compute run can
-- leave locked by an orphaned DELETE, so it is isolated: a lock timeout here
-- must not cost the rest of the migration.
SET lock_timeout = '2s';

-- ---------------------------------------------------------------------
-- Journey-side columns. The Waking Giants tabs show the GL event against a
-- journey, and the turn — the moment the stock crossed the Golden Line with
-- the weekly clock already green, which is where the move actually began.
-- The wake (clearing the multi-year ceiling) is confirmation and runs late:
-- measured across the eight 2026 wakes, a median of 62 sessions and most of
-- the move after the turn. SPARC turned 8 Apr at Rs 136 and did not "wake"
-- until 6 Jul at Rs 262.
-- ---------------------------------------------------------------------
DO $do$
DECLARE tries int := 0;
BEGIN
  LOOP
    tries := tries + 1;
    BEGIN
ALTER TABLE km_wg_journeys
    ADD COLUMN IF NOT EXISTS gl_event      VARCHAR(16),
    ADD COLUMN IF NOT EXISTS gl_days_above INTEGER,
    -- The turn: first bar of the CURRENT unbroken run above the Golden Line
    -- at which the weekly clock was already green. NULL once the line is
    -- lost, so it never reports a turn a stock has since given back.
    ADD COLUMN IF NOT EXISTS turn_date     DATE,
    ADD COLUMN IF NOT EXISTS turn_close    NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS pct_from_turn NUMERIC(10,2);
      RAISE NOTICE 'km_wg_journeys: columns added (attempt %)', tries;
      EXIT;
    EXCEPTION WHEN lock_not_available THEN
      IF tries >= 200 THEN
        RAISE EXCEPTION
          'km_wg_journeys still locked after % attempts (~10 min). Most likely an orphaned DELETE from a crashed compute run — terminate it with pg_terminate_backend().', tries;
      END IF;
      IF tries % 20 = 0 THEN
        RAISE NOTICE 'km_wg_journeys still busy after % attempts', tries;
      END IF;
      PERFORM pg_sleep(1);
    END;
  END LOOP;
END
$do$;

COMMENT ON COLUMN km_wg_journeys.turn_date IS
    'Where the move began: the Golden Line was crossed and held with the weekly clock green. Earlier than wake_date, which is the multi-year-ceiling confirmation.';

-- (4) Preset rows + the VaNi rule. Row-level writes on a tiny table; nothing
-- here can block, and it is the part most worth not losing to someone else's
-- lock.
BEGIN;

-- =====================================================================
-- Scanner presets. Price Action, because both are price-structure events.
-- Copy is D39-observational: no directive verbs, no bull/bear words.
-- =====================================================================
INSERT INTO public.kd_scan_presets (
    id, name, description, tooltip,
    sort_order, result_limit, is_active,
    category, category_label, category_color, category_sort,
    universe, timeframe,
    vani_rule, vani_side, vani_short_label, vani_cap,
    is_default_tab
) VALUES
(
    'gl_breakout',
    'Golden Line Breakout',
    'Stocks closing back above the 150-day Golden Line on a volume-drive or accumulation bar',
    'The close crossed from at-or-below the Golden Line (150-bar mean close) to above it, on a session printing SVD or SBD. The volume signature lands on the crossing bar itself, so the reclaim carries evidence rather than being a drift across the line. Observational conditions, not a recommendation.',
    21, 200, TRUE,
    'price_action', 'Price Action', '#f59e0b', 1,
    'NSE_ONLY', 'daily',
    'gl_event_any', 'strength', 'GL', 12,
    FALSE
),
(
    'gl_retest',
    'Golden Line Retest',
    'Stocks that came back to the Golden Line and held it on a volume-drive or accumulation bar',
    'After holding above the Golden Line for at least ten sessions, the bar''s low reached or broke it while the close stayed above, on a session printing SVD or SBD. The line was tested and held with volume behind it. Observational conditions, not a recommendation.',
    22, 200, TRUE,
    'price_action', 'Price Action', '#f59e0b', 1,
    'NSE_ONLY', 'daily',
    'gl_event_any', 'strength', 'GL', 12,
    FALSE
)
ON CONFLICT (id) DO UPDATE SET
    name             = EXCLUDED.name,
    description      = EXCLUDED.description,
    tooltip          = EXCLUDED.tooltip,
    sort_order       = EXCLUDED.sort_order,
    result_limit     = EXCLUDED.result_limit,
    is_active        = EXCLUDED.is_active,
    category         = EXCLUDED.category,
    category_label   = EXCLUDED.category_label,
    category_color   = EXCLUDED.category_color,
    category_sort    = EXCLUDED.category_sort,
    universe         = EXCLUDED.universe,
    timeframe        = EXCLUDED.timeframe,
    vani_rule        = EXCLUDED.vani_rule,
    vani_side        = EXCLUDED.vani_side,
    vani_short_label = EXCLUDED.vani_short_label,
    vani_cap         = EXCLUDED.vani_cap,
    is_default_tab   = EXCLUDED.is_default_tab,
    updated_at       = now();

-- The Discovery tabs had vani_rule NULL since migration 177, so the chip
-- could never light and the VaNi filter button did nothing there. Owner:
-- the highlight is earned by a Golden Line event with SVD/SBD behind it.
UPDATE public.kd_scan_presets
SET vani_rule        = 'gl_event_any',
    vani_side        = 'strength',
    vani_short_label = 'GL',
    vani_cap         = 12,
    updated_at       = now()
WHERE id IN ('waking_giants', 'wg_ascent', 'wg_stirring');

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Populate (run AFTER commit; symbol-batched, resumable):
--   cd App/backend && python scripts/backfill_gl_events.py
--   python scripts/backfill_gl_events.py --verify
