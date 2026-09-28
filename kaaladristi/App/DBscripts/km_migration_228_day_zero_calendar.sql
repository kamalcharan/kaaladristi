-- ============================================================================
-- Migration 228 — Day 0 is a CALENDAR question, not a "does the bar exist" one
-- ============================================================================
-- Target: kaala_dristi_db.  Owner runs it in pgAdmin.  Holds no data beyond
-- five calendar rows; no REFRESH, no backfill.  Deploy the backend with it
-- (scripts/ingest_nse_filings.py gains reconcile_day_zero, which this
-- function's provisional answer depends on) and then run one ingest pass:
--
--     docker exec kd-pipeline-api2 python scripts/ingest_nse_filings.py --days 5
--     docker exec kd-pipeline-api2 python scripts/ingest_nse_bulk_deals.py --backfill-day0
--
-- WHY (2026-09-28): the Filings page showed nothing after Friday 25 Sep
-- 15:29:59. The ingest was fine — 1,308 raw filings had been fetched since
-- Friday's close, the last batch Monday 12:10 — and every one of them had zero
-- events, because migration 212's kd_day_zero_trade_date reads sessions out of
-- km_equity_eod and the next session (Monday) has no bar until the 18:00 run.
-- derive_events called that "deferred" and it was: every weekday, everything
-- filed after 15:30 (the larger half of the stream) was invisible until the
-- NEXT evening, and from Friday 15:30 to Monday ~20:10 the page went dark for
-- ~53 hours while the market could act on Monday morning. "3-4 days of filing
-- intelligence at any point in time" cannot survive that.
--
-- The 212 rule conflated two questions:
--   (a) which session could the market ACT on this?  — a calendar question,
--       answerable the moment the filing is fetched;
--   (b) do we HOLD that session's bar?               — a data question.
-- Only (a) is Day 0. (b) matters to the return math, and kd_result_returns
-- already answers it honestly: no Day 0 bar → NULL reaction, NULL drift.
-- Assigning Day 0 before the bar lands introduces no lookahead anywhere.
--
-- THE RULE, unchanged in substance: at or before 15:30 IST on a day that
-- trades → that day; otherwise the next trading day.  What changes is how
-- "trading day" is answered when no bar exists yet:
--   1. A traded bar in km_equity_eod within 15 days is AUTHORITATIVE — the
--      historical answer is byte-for-byte what 212 returned.
--   2. Only when the candidate is AFTER the latest bar in the table (i.e. the
--      session genuinely has not happened yet) is the answer PLANNED from the
--      calendar: the next Mon-Fri not marked a holiday/no_data/weekend in
--      km_trading_calendar for NSE.
--   3. A candidate at or before the latest bar with no bar within 15 days is a
--      historical gap and stays NULL, exactly as before.
--
-- ⚠ A PLANNED Day 0 is PROVISIONAL and is RECONCILED, not trusted. Once the
-- bar lands, rule 1 takes over and the answer may differ (an unlisted holiday:
-- no bar Monday, first bar Tuesday). reconcile_day_zero() in the filings
-- ingest and backfill_day0() in the bulk-deals ingest re-derive every row whose
-- Day 0 sits inside the last ~10 sessions on EVERY pass and rewrite the ones
-- that moved. A wrong seed therefore costs a few days of a provisional date on
-- one row set, never a permanent error — and the seed below is exactly what
-- makes that window short.
--
-- ⚠ CORRECTED 2026-09-28 after the first live run of sync_nse_holidays.py:
-- the seed originally carried Balipratipada on 9 Nov; NSE's holiday master
-- says 10 Nov (its spelling, 'Diwali-Balipratipada'). If this file was
-- applied before the correction, remove the stray row:
--   DELETE FROM km_trading_calendar WHERE trade_date = DATE '2026-11-09'
--     AND status = 'holiday';
-- The sync script is the authority; the seed only covers the gap until it runs.
-- ⚠ The seeded rows are NSE's published 2026 trading holidays for the rest of
-- the year (the eleven already past — 15 Jan, 26 Jan, 3 Mar, 26 Mar, 31 Mar,
-- 3 Apr, 14 Apr, 1 May, 28 May, 26 Jun, 14 Sep — all match rows the pipeline
-- had already marked from "no bhav published"). They are UPSERTED with a guard
-- that never overwrites a date that actually traded (status completed/partial).
-- 2027 is NOT seeded: run scripts/sync_nse_holidays.py on the VPS (the cloud
-- container has no route to nseindia.com) when NSE publishes the list, or let
-- reconciliation absorb it a day at a time.
--
-- Validated on a throwaway PostgreSQL 16 cluster (test_filing_intelligence.py
-- DayZeroCalendar, 9 tests): Friday-evening → Monday; a seeded holiday is
-- skipped; a weekend is skipped; mid-session before the bar lands → today;
-- historical answers unchanged; a historical gap still NULL; the planned
-- answer is idempotent once the bar lands; a surprise holiday is corrected by
-- reconcile; a 16-day gap refuses to guess.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.kd_day_zero_trade_date(p_disseminated TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql STABLE AS $$
    WITH ist AS (
        SELECT (p_disseminated AT TIME ZONE 'Asia/Kolkata') AS ts
    ), cand AS (
        -- The first calendar day this filing could be acted on.
        SELECT CASE WHEN ts::time <= TIME '15:30' THEN ts::date
                    ELSE ts::date + 1 END AS d
        FROM ist
    ), latest AS (
        SELECT max(trade_date) AS d FROM public.km_equity_eod
    ), traded AS (
        -- Rule 1: a bar that exists is the answer. Identical to migration 212.
        SELECT min(trade_date) AS d
        FROM public.km_equity_eod
        WHERE trade_date >= (SELECT d FROM cand)
          AND trade_date <= (SELECT d FROM cand) + 15
    ), planned AS (
        -- Rule 2: the next weekday the calendar does not rule out.
        SELECT min(g::date) AS d
        FROM generate_series((SELECT d FROM cand)::timestamp,
                             ((SELECT d FROM cand) + 15)::timestamp,
                             interval '1 day') AS g
        WHERE extract(dow FROM g) BETWEEN 1 AND 5
          AND NOT EXISTS (
                SELECT 1 FROM public.km_trading_calendar c
                 WHERE c.trade_date = g::date
                   AND c.exchange = 'NSE'
                   AND (c.is_holiday
                        OR c.status IN ('holiday', 'no_data', 'weekend')))
    )
    SELECT COALESCE(
        (SELECT d FROM traded),
        -- Rule 3: plan ONLY for a session that has not happened yet. A gap
        -- inside recorded history is a gap, not a session to invent.
        CASE WHEN (SELECT d FROM cand) > COALESCE((SELECT d FROM latest),
                                                  DATE '1900-01-01')
             THEN (SELECT d FROM planned) END);
$$;

COMMENT ON FUNCTION public.kd_day_zero_trade_date IS
  'Day 0 = the session the market could ACT on a filing: at/before 15:30 IST '
  'on a trading day → that day, else the next trading day. A traded bar within '
  '15 days is authoritative (migration 212 rule); when the session has not '
  'happened yet it is PLANNED from km_trading_calendar (weekdays minus NSE '
  'holidays) and reconciled once the bar lands (migration 228). NULL only for a '
  'gap inside recorded history.';

-- ── NSE 2026 trading holidays, remainder of the year ─────────────────────
-- Guard: never touch a date the pipeline recorded as traded.
INSERT INTO public.km_trading_calendar (trade_date, exchange, is_holiday, holiday_name, status)
SELECT d, ex, TRUE, n, 'holiday'
FROM (VALUES
        (DATE '2026-10-02', 'Mahatma Gandhi Jayanti'),
        (DATE '2026-10-20', 'Dussehra'),
        (DATE '2026-11-10', 'Diwali-Balipratipada'),
        (DATE '2026-11-24', 'Prakash Gurpurb Sri Guru Nanak Dev'),
        (DATE '2026-12-25', 'Christmas')
     ) AS h(d, n)
CROSS JOIN (VALUES ('NSE'), ('BSE')) AS x(ex)
ON CONFLICT (trade_date, exchange) DO UPDATE
   SET is_holiday   = TRUE,
       holiday_name = EXCLUDED.holiday_name,
       status       = 'holiday'
 WHERE public.km_trading_calendar.status IS DISTINCT FROM 'completed'
   AND public.km_trading_calendar.status IS DISTINCT FROM 'partial';

COMMIT;

-- Verify:
--   SELECT kd_day_zero_trade_date('2026-09-25 16:00+05:30');   -- 2026-09-28
--   SELECT kd_day_zero_trade_date('2026-10-01 16:00+05:30');   -- 2026-10-05 (2 Oct is a holiday)
--   SELECT trade_date, exchange, holiday_name FROM km_trading_calendar
--    WHERE is_holiday AND trade_date > current_date ORDER BY 1;
