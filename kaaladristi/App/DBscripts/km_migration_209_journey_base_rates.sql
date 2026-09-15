-- km_migration_209_journey_base_rates.sql
--
-- Nightly base rates for the Waking Giants journey arc.
--
-- WHY THIS TABLE EXISTS
-- --------------------
-- JourneyStrip and (next) VaNi both cite the recorded outcome of a journey:
-- how often a wake goes on to confirm, how long confirmed arcs run against
-- unconfirmed ones. Those four numbers were TYPED INTO the component. They are
-- derived from km_wg_journeys, which changes every night as arcs close and
-- confirm, so a hardcoded figure goes stale silently — nothing breaks, the UI
-- simply keeps citing a frequency that is no longer true, and in six months
-- nobody can say where "58.5%" came from.
--
-- The numbers are a UNIVERSE-LEVEL CONSTANT: one value for every stock, every
-- user, every chart. So they are computed once per night, not per render.
--
-- WHO WRITES IT
-- -------------
-- scripts/compute_wg_journeys.py, inside the SAME transaction as the
-- km_wg_journeys DELETE + INSERT it summarises. That is deliberate and is the
-- point of the design: a summary written by a different job than the rows it
-- describes can drift from them, and this session already paid for that lesson
-- once (the fix path not cascading to derived dimensions — migration-era note
-- in CLAUDE.md). Same writer, same transaction, cannot disagree.
--
-- It follows that a `fix` on the wg_journeys dimension recomputes this too,
-- with no new edge in orchestrator.DIMENSION_DEPENDENTS.
--
-- HISTORY, NOT A SINGLETON
-- ------------------------
-- Keyed by as_of so the series is inspectable: "was the confirm rate different
-- when this reading was written" is answerable, and a sudden move in the base
-- rate is itself a signal that the journey engine changed behaviour. One row a
-- day over five years is ~1,800 rows; the storage argument for a singleton
-- does not exist.
--
-- Target database: kaala_dristi_db.

BEGIN;

CREATE TABLE IF NOT EXISTS public.km_journey_base_rates (
  as_of                 date PRIMARY KEY,

  -- Denominator first. Every rate below is over closed arcs that carry BOTH a
  -- wake and a sleep date — a journey still running has no outcome to count,
  -- and one archived without ever waking never entered the population.
  closed_total          integer NOT NULL,
  confirmed_total       integer NOT NULL,
  confirmed_pct         numeric(5,2),

  -- Days from the wake to confirmation, over confirmed arcs only.
  avg_days_to_confirm   integer,

  -- The asymmetry that makes the rate worth showing at all: on 2026-09-14,
  -- 494 days against 38.
  avg_life_confirmed    integer,
  avg_life_unconfirmed  integer,

  -- Window the population covers, so a reader can see how far back it reaches.
  oldest_wake           date,
  newest_close          date,

  -- Live journeys at write time — not part of any rate, but it says how much
  -- of the pool is still open and therefore not yet counted anywhere above.
  open_journeys         integer,

  computed_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.km_journey_base_rates IS
  'Nightly recorded outcome of Waking Giants journeys. Written by '
  'scripts/compute_wg_journeys.py in the same transaction as km_wg_journeys. '
  'Observational frequencies over closed arcs — never a forecast.';

-- Read path. Logged-in browser users run PostgREST as the DB role
-- `authenticated` (migration 144 reverted kd_auth_login to issue that for
-- everyone, admins included), so THIS is the grant that decides whether the
-- strip renders. Migration 022 shipped a table with policies and zero grants
-- and it took migration 142 to find out; do not repeat it.
GRANT SELECT ON public.km_journey_base_rates TO authenticated, anon, kd_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.km_journey_base_rates TO kd_app;

-- No RLS. This is a pipeline aggregate over no user data, and RLS on tables of
-- this kind has produced silent access bugs here before when kd_app and
-- authenticated diverged.

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Seed the current reading so the UI has a row before the next nightly run.
-- Identical to the aggregate compute_wg_journeys.py writes; re-running it is
-- harmless (ON CONFLICT overwrites the same day's row).
INSERT INTO public.km_journey_base_rates (
  as_of, closed_total, confirmed_total, confirmed_pct, avg_days_to_confirm,
  avg_life_confirmed, avg_life_unconfirmed, oldest_wake, newest_close, open_journeys)
SELECT
  CURRENT_DATE,
  count(*),
  count(*) FILTER (WHERE confirm_date IS NOT NULL),
  round(100.0 * count(*) FILTER (WHERE confirm_date IS NOT NULL) / NULLIF(count(*), 0), 1),
  round(avg(confirm_date - wake_date) FILTER (WHERE confirm_date IS NOT NULL))::int,
  round(avg(sleep_date - wake_date)  FILTER (WHERE confirm_date IS NOT NULL))::int,
  round(avg(sleep_date - wake_date)  FILTER (WHERE confirm_date IS NULL))::int,
  min(wake_date),
  max(sleep_date),
  (SELECT count(*) FROM public.km_wg_journeys WHERE is_current)
FROM public.km_wg_journeys
WHERE NOT is_current AND wake_date IS NOT NULL AND sleep_date IS NOT NULL
ON CONFLICT (as_of) DO UPDATE SET
  closed_total         = EXCLUDED.closed_total,
  confirmed_total      = EXCLUDED.confirmed_total,
  confirmed_pct        = EXCLUDED.confirmed_pct,
  avg_days_to_confirm  = EXCLUDED.avg_days_to_confirm,
  avg_life_confirmed   = EXCLUDED.avg_life_confirmed,
  avg_life_unconfirmed = EXCLUDED.avg_life_unconfirmed,
  oldest_wake          = EXCLUDED.oldest_wake,
  newest_close         = EXCLUDED.newest_close,
  open_journeys        = EXCLUDED.open_journeys,
  computed_at          = now();

-- Verification — expected on 2026-09-14: 595 / 348 / 58.5 / 29 / 494 / 38.
-- SELECT * FROM km_journey_base_rates ORDER BY as_of DESC LIMIT 1;
