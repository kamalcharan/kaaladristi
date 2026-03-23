# Kāla-Drishti — Data Engine POA
## Priority: Market Data Pipeline (ICICI Breeze)

---

## Scope

Build a production-grade data pipeline that covers:
- **All NSE + BSE Equities** — EOD (1-day) + 15-minute intraday
- **All Indices** — NSE indices + TRI (Total Return Index) variants — EOD + 15-min
- **Primary source**: ICICI Breeze API
- **Fallback source**: Yahoo Finance (EOD only, no intraday)

---

## What Exists Today

| Component | Status | Gaps |
|---|---|---|
| `km_index_symbols` | 93 NSE indices seeded | No TRI indices, no BSE indices |
| `km_equity_symbols` | 1,380 NSE equities seeded | No BSE-only stocks, no `exchange` column |
| `km_index_eod` | ~14K rows (4 indices backfilled) | Missing 89 indices worth of data |
| `km_equity_eod` | ~7.5K rows (1 equity backfilled) | Missing 1,379 equities |
| **Intraday table** | **Does not exist** | No 15-min candle storage |
| `breeze_eod_downloader.py` | Works for 1-day candles | No intraday support, no BSE, no TRI |
| `populate_vendor_codes.py` | Maps NSE→Breeze ISEC codes | No BSE code mapping |
| `yfinance_historical.py` | Works as fallback for EOD | No intraday capability |

---

## Plan — 6 Steps

### Step 1: Schema Updates (Supabase SQL)

**1a. Add `exchange` column to master tables**
```sql
ALTER TABLE km_equity_symbols ADD COLUMN exchange TEXT DEFAULT 'NSE';
ALTER TABLE km_equity_symbols ADD COLUMN bse_code TEXT;  -- BSE scrip code
ALTER TABLE km_index_symbols ADD COLUMN exchange TEXT DEFAULT 'NSE';
ALTER TABLE km_index_symbols ADD COLUMN is_tri BOOLEAN DEFAULT FALSE;
```

**1b. Create intraday tables**
```sql
CREATE TABLE km_index_intraday (
    id          BIGSERIAL PRIMARY KEY,
    index_id    INTEGER NOT NULL REFERENCES km_index_symbols(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,          -- candle open time (IST stored as UTC)
    interval    TEXT NOT NULL DEFAULT '15m',    -- '15m', '5m', '1h' etc.
    open        NUMERIC,
    high        NUMERIC,
    low         NUMERIC,
    close       NUMERIC,
    volume      BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(index_id, ts, interval)
);

CREATE TABLE km_equity_intraday (
    id          BIGSERIAL PRIMARY KEY,
    equity_id   INTEGER NOT NULL REFERENCES km_equity_symbols(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    interval    TEXT NOT NULL DEFAULT '15m',
    open        NUMERIC,
    high        NUMERIC,
    low         NUMERIC,
    close       NUMERIC,
    volume      BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(equity_id, ts, interval)
);
```
- Add indexes on `ts`, `index_id`/`equity_id`
- Add RLS policies (same pattern as EOD tables)
- Add partitioning strategy note: monthly partitions when data exceeds 50M rows

**1c. Create a `km_data_sync_log` table** (track what was downloaded, when, status)
```sql
CREATE TABLE km_data_sync_log (
    id          BIGSERIAL PRIMARY KEY,
    sync_type   TEXT NOT NULL,        -- 'eod_equity', 'eod_index', 'intraday_equity', 'intraday_index'
    symbol      TEXT NOT NULL,
    exchange    TEXT NOT NULL,
    from_date   DATE,
    to_date     DATE,
    rows_fetched INTEGER DEFAULT 0,
    rows_upserted INTEGER DEFAULT 0,
    status      TEXT NOT NULL,        -- 'success', 'failed', 'partial', 'no_data'
    error_msg   TEXT,
    duration_ms INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Step 2: Master Data Expansion

**2a. Seed BSE equities**
- Breeze SDK exposes BSE scrip master after `generate_session()`
- Extract BSE-listed stocks, add to `km_equity_symbols` with `exchange = 'BSE'`
- For dual-listed stocks (most are), add `bse_code` to existing NSE row instead of duplicating

**2b. Seed TRI indices**
- Breeze supports TRI variants for major indices (NIFTY 50 TRI, NIFTY BANK TRI, etc.)
- Add ~20-30 TRI index rows to `km_index_symbols` with `is_tri = TRUE`
- Map TRI Breeze codes in `vendor_codes`

**2c. Update `populate_vendor_codes.py`**
- Add BSE exchange code mapping
- Add TRI index Breeze code mapping
- Add `--exchange nse|bse|both` flag

---

### Step 3: Unified Breeze Downloader (Core Script)

Refactor `breeze_eod_downloader.py` into a single **`breeze_downloader.py`** that handles all modes:

```
python breeze_downloader.py --mode eod    --asset equity --exchange NSE --days 365
python breeze_downloader.py --mode eod    --asset index  --days 365
python breeze_downloader.py --mode 15m    --asset equity --exchange NSE --days 30
python breeze_downloader.py --mode 15m    --asset index  --days 30
python breeze_downloader.py --mode eod    --asset equity --exchange BSE --days 365
python breeze_downloader.py --mode eod    --asset index  --tri-only --days 365
python breeze_downloader.py --mode backfill --asset equity --from 2020-01-01
```

**Key design:**
- Shared `BreezeClient` wrapper (session init, retry, rate limiting)
- Shared `SupabaseREST` client (extracted to `lib/supabase_client.py`)
- Interval mapping: `eod` → `'1day'`, `15m` → `'15minute'`
- Chunking: Breeze returns max 1000 candles per request
  - EOD: 1000 days per chunk (~4 years)
  - 15m: 1000 candles = ~38 trading days per chunk (26 candles/day × 38 ≈ 1000)
- Batch upsert to Supabase (500 rows per POST)
- Sync log: every download logged to `km_data_sync_log`
- Resume capability: check last sync date per symbol, only fetch delta

**Rate limiting strategy:**
- Breeze API: 0.5s between requests
- Supabase: no limit (service role key)
- If 429 from Breeze: exponential backoff (2s, 4s, 8s, 16s)

---

### Step 4: Shared Library (`lib/`)

Extract common code from existing scripts into reusable modules:

```
App/backend/
├── lib/
│   ├── __init__.py
│   ├── supabase_client.py    -- SupabaseREST class (deduplicated from 3 scripts)
│   ├── breeze_client.py      -- BreezeConnect wrapper with retry + session mgmt
│   ├── config.py             -- env loading, constants
│   └── sync_logger.py        -- km_data_sync_log writer
├── breeze_downloader.py      -- unified downloader (replaces breeze_eod_downloader.py)
├── populate_vendor_codes.py  -- updated with BSE + TRI
├── yfinance_historical.py    -- kept as fallback
└── requirements.txt          -- updated deps
```

---

### Step 5: Historical Backfill Strategy

**EOD data (max history via Breeze):**

| Asset | Exchange | Target History | Est. Rows |
|---|---|---|---|
| 1,380 NSE equities | NSE | 20 years | ~7M rows |
| ~500 BSE-only equities | BSE | 10 years | ~1.25M rows |
| 93 NSE indices | NSE | 20 years | ~465K rows |
| ~25 TRI indices | NSE | 10 years | ~62K rows |
| **Total EOD** | | | **~8.8M rows** |

**15-min intraday data (Breeze gives ~1 year max for intraday):**

| Asset | Candles/Day | Days | Est. Rows |
|---|---|---|---|
| 1,380 NSE equities × 26 candles × 250 days | | 1 year | ~9M rows |
| 93 indices × 26 candles × 250 days | | 1 year | ~605K rows |
| **Total Intraday** | | | **~9.6M rows** |

**Execution order:**
1. Index EOD (smallest, fastest — validate pipeline)
2. TRI Index EOD
3. Equity EOD (NSE) — run in batches of 100 symbols
4. Equity EOD (BSE-only)
5. Index 15-min intraday
6. Equity 15-min intraday — largest, run last

---

### Step 6: Daily Sync Runner

Create `daily_sync.py` — orchestrates daily data refresh:

```
python daily_sync.py                    # run all daily syncs
python daily_sync.py --eod-only         # just EOD
python daily_sync.py --intraday-only    # just 15-min
```

**Logic:**
- After market close (3:30 PM IST + buffer = 4:00 PM IST)
- Fetch today's EOD for all symbols
- Fetch today's 15-min candles for all symbols
- Log results to `km_data_sync_log`
- Report summary (success/fail counts)

**Future:** Wire to cron or GitHub Actions for automation

---

## Execution Order

| # | Task | Depends On | Est. Effort |
|---|---|---|---|
| 1 | Schema updates (SQL) | — | Small |
| 2 | Extract shared lib (`lib/`) | — | Small |
| 3 | Seed TRI indices + BSE equities | Step 1 | Small |
| 4 | Build unified `breeze_downloader.py` | Steps 1, 2 | Medium |
| 5 | Historical backfill (run it) | Steps 3, 4 | Large (runtime) |
| 6 | Daily sync runner | Step 4 | Small |

---

## Out of Scope (for now)

- Rules Engine / Risk Engine — built AFTER data pipeline is solid
- Frontend changes — no UI work in this phase
- Ephemeris / planetary data — separate workstream
- Real-time streaming — future phase (Breeze WebSocket)
