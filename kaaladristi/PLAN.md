# Kāla-Drishti — Data Engine POA
## Priority 1: EOD Data Pipeline (ICICI Breeze)
## Priority 2: 15-min Intraday (separate phase, after EOD is solid)

---

## Scope

Build a production-grade data pipeline that covers:
- **All NSE + BSE Equities** — EOD (1-day) OHLCV
- **All Indices** — NSE indices + TRI (Total Return Index) variants — EOD
- **Corporate Actions** — Bonus, Split, Dividend tracking + price adjustment
- **Primary source**: ICICI Breeze API (returns **unadjusted** prices)
- **Fallback source**: Yahoo Finance (EOD only, returns adjusted prices)

---

## Critical Finding: Corporate Actions

**Breeze API returns UNADJUSTED data only.** There is no parameter to get adjusted prices.
([GitHub Issue #200](https://github.com/Idirect-Tech/Breeze-Python-SDK/issues/200))

This means a 2:1 bonus on RELIANCE shows as a sudden 50% price drop in raw data.
We **must** handle this ourselves.

### Strategy: Store Raw + Adjustment Factor

```
┌──────────────────────────────────────────────────────────────┐
│  CORPORATE ACTIONS HANDLING                                  │
│                                                              │
│  1. Store RAW unadjusted OHLCV from Breeze (source of truth)│
│  2. Maintain km_corporate_actions table (bonus/split/div)    │
│  3. Compute cumulative adjustment_factor per symbol per date │
│  4. Store adj_close in EOD table (raw_close × adj_factor)    │
│  5. Recompute adj_close when new corp action discovered      │
│                                                              │
│  Sources for corporate action data:                          │
│  - BSE website (most structured, ~90% overlap with NSE)      │
│  - NSE corporate filings page (free text, harder to parse)   │
│  - BseIndiaApi Python library (unofficial but reliable)      │
└──────────────────────────────────────────────────────────────┘
```

**Adjustment factor logic:**
- **Stock Split (5:1)**: adj_factor = 1/5 = 0.2 for all dates BEFORE ex-date
- **Bonus (2:1)**: adj_factor = 1/3 = 0.333 for all dates BEFORE ex-date
- **Factors are cumulative**: if a stock had a 2:1 bonus in 2020 and a 5:1 split in 2025, pre-2020 data gets factor = 0.2 × 0.333 = 0.0667
- **adj_close = raw_close × cumulative_adj_factor**

---

## What Exists Today

| Component | Status | Gaps |
|---|---|---|
| `km_index_symbols` | 93 NSE indices seeded | No TRI indices, no BSE indices |
| `km_equity_symbols` | 1,380 NSE equities seeded | No BSE-only stocks, no `exchange` column |
| `km_index_eod` | ~14K rows (4 indices backfilled) | Missing 89 indices worth of data |
| `km_equity_eod` | ~7.5K rows (1 equity backfilled) | Missing 1,379 equities |
| **Intraday tables** | **Do not exist** | Phase 2 — separate tables |
| **Corporate actions table** | **Does not exist** | No bonus/split/dividend tracking |
| `breeze_eod_downloader.py` | Works for 1-day candles | No BSE, no TRI, no corp action handling |
| `populate_vendor_codes.py` | Maps NSE→Breeze ISEC codes | No BSE code mapping |
| `yfinance_historical.py` | Works as fallback for EOD | No corp action awareness |

---

## Plan — 7 Steps (EOD First)

### Step 1: Schema Updates (Supabase SQL)

**1a. Add columns to master tables**
```sql
-- Equity masters
ALTER TABLE km_equity_symbols ADD COLUMN exchange TEXT DEFAULT 'NSE';
ALTER TABLE km_equity_symbols ADD COLUMN bse_code TEXT;       -- BSE scrip code
ALTER TABLE km_equity_symbols ADD COLUMN isin TEXT;           -- unique across NSE/BSE

-- Index masters
ALTER TABLE km_index_symbols ADD COLUMN exchange TEXT DEFAULT 'NSE';
ALTER TABLE km_index_symbols ADD COLUMN is_tri BOOLEAN DEFAULT FALSE;
```

**1b. Add adjusted price columns to EOD tables**
```sql
-- Equity EOD — add adjustment columns
ALTER TABLE km_equity_eod ADD COLUMN adj_factor NUMERIC DEFAULT 1.0;
ALTER TABLE km_equity_eod ADD COLUMN adj_open NUMERIC;
ALTER TABLE km_equity_eod ADD COLUMN adj_high NUMERIC;
ALTER TABLE km_equity_eod ADD COLUMN adj_low NUMERIC;
ALTER TABLE km_equity_eod ADD COLUMN adj_close NUMERIC;
```
Note: Index EOD does NOT need adjustment — indices are already adjusted by NSE.

**1c. Create corporate actions table**
```sql
CREATE TABLE km_corporate_actions (
    id              BIGSERIAL PRIMARY KEY,
    equity_id       INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    ex_date         DATE NOT NULL,
    action_type     TEXT NOT NULL,       -- 'BONUS', 'SPLIT', 'DIVIDEND', 'DEMERGER', 'RIGHTS'
    ratio_from      NUMERIC,             -- e.g., 2 (for 2:1 bonus = 2 new shares for 1 old)
    ratio_to        NUMERIC,             -- e.g., 1
    old_fv          NUMERIC,             -- old face value (for splits)
    new_fv          NUMERIC,             -- new face value (for splits)
    dividend_amt    NUMERIC,             -- dividend per share (for dividends)
    adj_factor      NUMERIC NOT NULL,    -- multiplier: 0.5 for 1:1 bonus, 0.2 for 5:1 split
    source          TEXT DEFAULT 'BSE',  -- where we got this data
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(equity_id, ex_date, action_type)
);

CREATE INDEX idx_corp_actions_symbol ON km_corporate_actions(symbol);
CREATE INDEX idx_corp_actions_ex_date ON km_corporate_actions(ex_date);
```

**1d. Create sync log table**
```sql
CREATE TABLE km_data_sync_log (
    id              BIGSERIAL PRIMARY KEY,
    sync_type       TEXT NOT NULL,        -- 'eod_equity', 'eod_index', 'corp_actions'
    symbol          TEXT NOT NULL,
    exchange        TEXT NOT NULL,
    from_date       DATE,
    to_date         DATE,
    rows_fetched    INTEGER DEFAULT 0,
    rows_upserted   INTEGER DEFAULT 0,
    status          TEXT NOT NULL,        -- 'success', 'failed', 'partial', 'no_data'
    error_msg       TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**1e. Create intraday tables (schema only — populated in Phase 2)**
```sql
CREATE TABLE km_index_15m (
    id          BIGSERIAL PRIMARY KEY,
    index_id    INTEGER NOT NULL REFERENCES km_index_symbols(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    open        NUMERIC,
    high        NUMERIC,
    low         NUMERIC,
    close       NUMERIC,
    volume      BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(index_id, ts)
);

CREATE TABLE km_equity_15m (
    id          BIGSERIAL PRIMARY KEY,
    equity_id   INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    open        NUMERIC,
    high        NUMERIC,
    low         NUMERIC,
    close       NUMERIC,
    volume      BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(equity_id, ts)
);
```
- Separate tables per interval (not a generic `interval` column) — cleaner indexes, no mixed data
- Indexes on `ts`, `index_id`/`equity_id`
- RLS policies (same pattern as EOD tables)

---

### Step 2: Shared Library (`lib/`)

Extract duplicated code from 3 existing scripts into reusable modules:

```
App/backend/
├── lib/
│   ├── __init__.py
│   ├── supabase_client.py    -- SupabaseREST class (one copy, not three)
│   ├── breeze_client.py      -- BreezeConnect wrapper with retry + session mgmt
│   ├── config.py             -- env loading, constants, paths
│   └── sync_logger.py        -- km_data_sync_log writer
├── breeze_downloader.py      -- unified EOD downloader (replaces breeze_eod_downloader.py)
├── corp_actions_loader.py    -- fetch + load corporate actions from BSE
├── adj_factor_calculator.py  -- compute adj_factor and update EOD tables
├── populate_vendor_codes.py  -- updated with BSE + TRI
├── yfinance_historical.py    -- kept as fallback
└── requirements.txt          -- updated deps
```

---

### Step 3: Master Data Expansion

**3a. Seed BSE equities**
- Breeze SDK exposes BSE scrip master after `generate_session()`
- For dual-listed stocks (~90%), add `bse_code` + `isin` to existing NSE row
- For BSE-only stocks, insert new rows with `exchange = 'BSE'`

**3b. Seed TRI indices**
- Add ~20-30 TRI index rows to `km_index_symbols` with `is_tri = TRUE`
- Map TRI Breeze codes in `vendor_codes`

**3c. Update `populate_vendor_codes.py`**
- Add BSE exchange code mapping
- Add TRI index Breeze code mapping
- Add `--exchange nse|bse|both` flag

---

### Step 4: Unified EOD Downloader (`breeze_downloader.py`)

Single script for all EOD downloads:

```
python breeze_downloader.py --asset equity --exchange NSE --days 365
python breeze_downloader.py --asset equity --exchange BSE --days 365
python breeze_downloader.py --asset index  --days 365
python breeze_downloader.py --asset index  --tri-only --days 365
python breeze_downloader.py --asset equity --symbol RELIANCE --from 2000-01-01
python breeze_downloader.py --asset equity --batch 1-100    # symbols 1-100
```

**Key design:**
- Uses `lib/breeze_client.py` for session + retry
- Uses `lib/supabase_client.py` for DB ops
- Chunking: max 1000 candles per Breeze request (~4 years of EOD)
- Batch upsert: 500 rows per Supabase POST
- Sync log: every download logged to `km_data_sync_log`
- Resume: check last `trade_date` per symbol, only fetch delta
- `--batch N-M` flag: download symbols N through M (for parallel runs)

**Rate limiting:**
- 0.5s between Breeze API calls
- Exponential backoff on 429: 2s → 4s → 8s → 16s

---

### Step 5: Corporate Actions Pipeline

**5a. `corp_actions_loader.py`** — Fetch corporate actions

```
python corp_actions_loader.py --from 2000-01-01        # full history
python corp_actions_loader.py --days 30                 # recent only
python corp_actions_loader.py --symbol RELIANCE          # single stock
```

**Sources (in priority order):**
1. [BSE Corporate Actions page](https://www.bseindia.com/corporates/corporates_act.html) — most structured
2. [BseIndiaApi Python library](https://github.com/BennyThadikaran/BseIndiaApi) — programmatic access
3. [NSE Corporate Filings](https://www.nseindia.com/companies-listing/corporate-filings-actions) — fallback

**For each action, compute `adj_factor`:**

| Action | adj_factor formula | Example |
|---|---|---|
| Bonus 2:1 | 1 / (1 + ratio_from/ratio_to) | 1/(1+2) = 0.333 |
| Bonus 1:1 | 1 / (1 + 1/1) | 0.5 |
| Split 10→2 (5:1) | new_fv / old_fv | 2/10 = 0.2 |
| Split 10→5 (2:1) | new_fv / old_fv | 5/10 = 0.5 |
| Demerger | market-derived (manual) | ~0.91 for RIL/JFSL |

**5b. `adj_factor_calculator.py`** — Apply adjustments to EOD data

```
python adj_factor_calculator.py --symbol RELIANCE    # recompute one stock
python adj_factor_calculator.py --all                # recompute everything
```

**Logic:**
1. For each equity, get all corporate actions sorted by ex_date DESC
2. Compute cumulative adj_factor per date range
3. UPDATE `km_equity_eod` SET adj_factor, adj_open, adj_high, adj_low, adj_close
4. adj_close = close × cumulative_factor

---

### Step 6: Historical Backfill (EOD)

**Execution order — validate small, then scale:**

| # | What | Est. Rows | Priority |
|---|---|---|---|
| 1 | Index EOD (93 NSE indices) | ~465K | Run first — validates pipeline |
| 2 | TRI Index EOD (~25 indices) | ~62K | Small, quick |
| 3 | Corporate Actions (all equities) | ~50K events | Must run BEFORE equity EOD adjustment |
| 4 | Equity EOD (1,380 NSE) — batches of 100 | ~7M | Largest batch |
| 5 | Equity EOD (BSE-only ~500) | ~1.25M | After NSE is done |
| 6 | Run adj_factor_calculator | updates ~7M rows | After corp actions + EOD loaded |
| **Total** | | **~8.8M rows** | |

---

### Step 7: Daily Sync Runner

`daily_sync.py` — orchestrates daily refresh after market close:

```
python daily_sync.py                    # run all daily syncs
python daily_sync.py --eod-only         # just EOD
```

**Logic:**
1. After market close (4:00 PM IST buffer)
2. Fetch today's EOD for all indices + equities
3. Check for new corporate actions (upcoming ex-dates)
4. If new corp action found → recompute adj_factor for affected symbol
5. Log results to `km_data_sync_log`
6. Report summary

**Future:** cron / GitHub Actions for automation

---

## Execution Order Summary

| # | Task | Depends On | Priority |
|---|---|---|---|
| 1 | Schema updates (SQL) | — | **Now** |
| 2 | Extract shared lib (`lib/`) | — | **Now** |
| 3 | Master data expansion (BSE + TRI) | Step 1 | **Now** |
| 4 | Build `breeze_downloader.py` (EOD) | Steps 1, 2 | **Now** |
| 5 | Build `corp_actions_loader.py` | Steps 1, 2 | **Next** |
| 6 | Build `adj_factor_calculator.py` | Steps 1, 5 | **Next** |
| 7 | Historical backfill (run it) | Steps 3, 4, 5, 6 | **Next** |
| 8 | Daily sync runner | Steps 4, 5 | **After backfill** |

---

## Phase 2 (After EOD is solid)

- 15-min intraday downloads (tables created in Step 1e, populate later)
- Rules Engine / Risk Engine
- Frontend changes
- Ephemeris / planetary data
- Real-time streaming (Breeze WebSocket)

---

## Sources

- [Breeze API - Unadjusted Data Issue](https://github.com/Idirect-Tech/Breeze-Python-SDK/issues/200)
- [BSE Corporate Actions](https://www.bseindia.com/corporates/corporates_act.html)
- [BseIndiaApi Python](https://github.com/BennyThadikaran/BseIndiaApi)
- [NSE Corporate Filings](https://www.nseindia.com/companies-listing/corporate-filings-actions)
- [Breeze Python SDK](https://github.com/Idirect-Tech/Breeze-Python-SDK)
