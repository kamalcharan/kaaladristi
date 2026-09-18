-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 217 — bulk / block deals
-- Target DB: kaala_dristi_db
-- Plan: docs/claude/filing-intelligence-poa.md  (Sprint 2, last item)
--
-- `client_name` is the point. It is the ONLY field anywhere in this plan that
-- names the buyer, which is what turns "a documented institutional buy on a
-- Waking Giants name" from a phrase into a join we can run.
--
-- ── SOURCE: THE CSV, NOT THE JSON API — measured, not preferred ────────────
-- /api/historicalOR/bulk-block-short-deals answers 200 and is unusable:
-- probed 2026-09-18, it returned EXACTLY 70 rows for a 30-day window, for a
-- 1-year window, for block_deals, and for every single trading day tested
-- (17th, 16th, 15th, 11th, 10th). bulk.csv for the same 17-SEP session holds
-- **212**. 70 is a page cap that bites on ONE DAY, so that endpoint cannot
-- deliver a complete session and would silently drop two rows in three.
--
-- A cap that answers 200 with a plausible short payload is worse than an error.
-- It is the same shape as the universe gap that ran green for months because
-- 1,334 rows arrived consistently every night.
--
-- ── NO NATURAL KEY. REPLACE THE DAY. ──────────────────────────────────────
-- There is no seq_id and no composed key is safe: (date, symbol, client, side)
-- collapsed a REAL pair in the probe — HDFC MUTUAL FUND bought ASTERDM twice
-- on 19-AUG, almost certainly two schemes under one AMC name. Widening the key
-- to include qty and price only moves the damage: a corrected quantity would
-- then insert a second row instead of revising the first.
--
-- So there is no UNIQUE constraint here at all. These are an exchange-published
-- COMPLETE DAILY REPORT, not company-authored filings that get revised, so
-- idempotency comes from replacing a date's rows wholesale inside one
-- transaction. A re-run is exact, and two genuinely identical deals both
-- survive because nothing is de-duplicated.
--
-- ── km_bulk_deal_days: "we looked and found nothing" vs "we never looked" ──
-- Replace-the-day cannot distinguish a quiet session from an un-ingested one —
-- both are zero rows. That is the GENERAL-vs-UNCLASSIFIED mistake again, and
-- for a feed with no backfill it matters more, because an absent early history
-- must never read as a market where nothing happened. A coverage row per
-- (source, deal_type, deal_date) records that the day WAS fetched and what it
-- held; absent means never fetched. ~500 rows a year.
--
-- ⚠ DAY 0 IS NOT THE DEAL DATE. NSE publishes bulk deals after the close, so a
-- deal done on the 17th is public that evening and actionable on the 18th.
-- day_0_trade_date comes from kd_day_zero_trade_date (migration 212) with a
-- post-15:30 timestamp — ONE implementation of the after-the-close rule, reused
-- rather than rewritten. Dating a deal to its own session would credit the
-- market with knowing something it could not yet see.
--
-- ⚠ NO ISIN IN THE FEED. Every other table in this plan keys on ISIN because a
-- filing is about the COMPANY, not the listing. These rows carry only a symbol,
-- so isin/equity_id are RESOLVED at ingest and stay nullable, with the
-- unresolvable tail counted and reported the way the filings ingest does.
--
-- ⚠ NO BACKFILL EXISTS. The daily CSV is one day and the JSON caps at 70 even
-- for one session. Collection starts from the first run; anything earlier has
-- to come from another source. km_bulk_deal_days is what makes that limit
-- legible instead of looking like a quiet market.
--
-- Owner runs in pgAdmin. Both tables start EMPTY, no REFRESH, no backfill.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.km_bulk_deals (
    id               BIGSERIAL PRIMARY KEY,

    source           TEXT NOT NULL CHECK (source IN ('NSE','BSE')),
    deal_type        TEXT NOT NULL CHECK (deal_type IN ('BULK','BLOCK')),

    deal_date        DATE NOT NULL,          -- the session the trade happened
    -- The session the market could first ACT on it. NULL until that session
    -- exists in km_equity_eod — deferred, exactly like a filing disseminated
    -- after the close, and filled on a later pass.
    day_0_trade_date DATE,

    symbol           TEXT NOT NULL,
    security_name    TEXT,
    isin             TEXT,                   -- resolved from symbol, nullable
    equity_id        INTEGER,

    client_name      TEXT NOT NULL,          -- the reason this table exists
    buy_sell         TEXT NOT NULL CHECK (buy_sell IN ('BUY','SELL')),
    quantity         BIGINT,
    price            NUMERIC(18,4),          -- weighted average trade price
    remarks          TEXT,

    payload          JSONB NOT NULL,
    fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now()

    -- DELIBERATELY NO UNIQUE CONSTRAINT. See the header: any composed key
    -- either collapses a real pair or turns a correction into a duplicate.
    -- Idempotency is replace-the-day, in one transaction.
);

CREATE INDEX IF NOT EXISTS idx_bulk_deals_day
    ON public.km_bulk_deals (source, deal_type, deal_date);
CREATE INDEX IF NOT EXISTS idx_bulk_deals_isin_date
    ON public.km_bulk_deals (isin, deal_date DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_deals_symbol_date
    ON public.km_bulk_deals (symbol, deal_date DESC);
-- The join this table exists for: a named buyer near a chain event.
CREATE INDEX IF NOT EXISTS idx_bulk_deals_day0_buy
    ON public.km_bulk_deals (day_0_trade_date DESC) WHERE buy_sell = 'BUY';

COMMENT ON TABLE public.km_bulk_deals IS
  'NSE bulk/block deals from the daily CSV archive. NO unique constraint: '
  'idempotency is replace-the-day, because no composed key is safe (the probe '
  'found one AMC buying the same stock twice on one session).';
COMMENT ON COLUMN public.km_bulk_deals.day_0_trade_date IS
  'The session the market could first act. NSE publishes after the close, so '
  'this is the NEXT trading day, via kd_day_zero_trade_date. Never deal_date.';
COMMENT ON COLUMN public.km_bulk_deals.price IS
  'BD_TP_WATP — a weighted AVERAGE trade price, not a single execution.';

-- ── Coverage: a fetched-but-quiet day is not an un-fetched one ────────────
CREATE TABLE IF NOT EXISTS public.km_bulk_deal_days (
    source      TEXT NOT NULL CHECK (source IN ('NSE','BSE')),
    deal_type   TEXT NOT NULL CHECK (deal_type IN ('BULK','BLOCK')),
    deal_date   DATE NOT NULL,
    row_count   INTEGER NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source, deal_type, deal_date)
);

COMMENT ON TABLE public.km_bulk_deal_days IS
  'One row per day actually fetched. row_count = 0 means the session was '
  'checked and held no deals; an ABSENT row means it was never fetched. '
  'Without this the two are indistinguishable, and since this feed has no '
  'backfill, an un-collected past would read as a quiet market.';

GRANT SELECT ON public.km_bulk_deals, public.km_bulk_deal_days
   TO authenticated, anon, kd_app, kd_readonly;
GRANT INSERT, UPDATE, DELETE ON public.km_bulk_deals, public.km_bulk_deal_days
   TO kd_app;
GRANT USAGE, SELECT ON SEQUENCE public.km_bulk_deals_id_seq TO kd_app;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification ───────────────────────────────────────────────────────────
--   SELECT relname, relacl FROM pg_class
--    WHERE relname IN ('km_bulk_deals','km_bulk_deal_days');
--   -- expect authenticated=r  (information_schema is BLIND here — CLAUDE.md)
--
-- After the first ingest — the completeness check the JSON endpoint failed:
--   SELECT deal_type, deal_date, row_count FROM km_bulk_deal_days
--    ORDER BY deal_date DESC, deal_type;
--   -- a BULK day near 70 would mean the CSV is capped too; the probe measured
--   -- 212 on 17-SEP, so it is not.
--
-- The join this is for — a named buyer on a stock that just woke:
--   SELECT d.deal_date, d.symbol, d.client_name, d.quantity
--     FROM km_bulk_deals d JOIN km_wg_journeys j ON j.equity_id = d.equity_id
--    WHERE d.buy_sell = 'BUY' AND j.wake_date BETWEEN d.deal_date - 30
--                                                 AND d.deal_date + 30;
