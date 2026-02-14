# Kāla-Drishti — Progress Report

**Branch**: `claude/init-kaaladristi-2yfoi`
**Date**: 2026-02-14

---

## What Was Built

### 1. Database Schema (Supabase)

**Tables created** (`App/DBscripts/km_clean_rebuild.sql`):
- `km_index_symbols` — 93 NSE indices (master table)
- `km_equity_symbols` — 1,380 NSE equities with `index_names TEXT[]` for membership
- `km_index_eod` — Index end-of-day OHLCV time-series (FK → `km_index_symbols`)
- `km_equity_eod` — Equity end-of-day OHLCV time-series (FK → `km_equity_symbols`)
- `km_profiles` — User profiles with role-based access

**RLS policies** (`App/DBscripts/km_fix_rls_recursion.sql`):
- All tables have RLS enabled
- Read access for authenticated users
- Admin write via `public.is_admin()` SECURITY DEFINER function (fixes infinite recursion)

**Seed data** (`App/DBscripts/`):
- `km_seed_masters.sql` — 93 indices + 1,380 equities
- `km_seed_index_eod.sql` — sample index EOD rows
- `km_seed_equity_eod_part[1-3].sql` — equity EOD rows

**Vendor codes**: Added `vendor_codes JSONB` column to both symbol tables for mapping to external APIs (Yahoo Finance, ICICI Breeze, etc.)

### 2. Data Pipeline (Python)

**yfinance Historical Downloader** (`App/backend/yfinance_historical.py`):
- Downloads 20-30 years of historical OHLCV data from Yahoo Finance
- Reads symbol masters from Supabase, resolves Yahoo tickers via `vendor_codes`
- Upserts into `km_index_eod` / `km_equity_eod` with conflict handling
- Retry with exponential backoff for rate limiting
- Supports `--type index|equity` and `--limit N` flags

**Data loaded in production DB**:
| Index | Trading Days | Date Range |
|-------|-------------|------------|
| NIFTY 50 | 4,517 | ~2006–2026 |
| NIFTY BANK | 4,241 | ~2007–2026 |
| NIFTY 500 | 5,014 | ~2005–2026 |
| RELIANCE (equity) | 7,561 | ~1996–2026 |

**ICICI Breeze Downloader** (`App/backend/breeze_eod_downloader.py`):
- Alternative data source via ICICI Breeze API
- Stock code resolution with SDK extraction fallback
- Supports `--diagnose` and `--breeze-code` flags

### 3. Frontend — Markets View (React + TypeScript)

**New files**:
- `App/frontend/src/services/eodData.ts` — Supabase queries for index symbols + EOD data
- `App/frontend/src/hooks/useEodData.ts` — React Query hook with 10-min stale time
- `App/frontend/src/components/domain/IndexPriceChart.tsx` — Recharts AreaChart with:
  - Gradient fill (green/red based on trend)
  - Custom OHLC tooltip with volume
  - Time range selector (1M / 3M / 6M / 1Y / 5Y / MAX)
  - Auto-downsampling for large datasets (>500 points)
  - Responsive Y-axis formatting (e.g., "25.1k")
- `App/frontend/src/views/MarketsView.tsx` — Full Markets page with:
  - Symbol switcher (NIFTY / BANKNIFTY / NIFTY IT / NIFTY FMCG)
  - Stats bar: current close, daily change, Day H/L, 52W H/L
  - Loading skeleton, error handling, empty state guidance

**Modified files**:
- `App/frontend/src/types/index.ts` — Added `KmIndexSymbol`, `KmIndexEod`, `ChartDataPoint`, `IndexStats`, `TimeRange` types
- `App/frontend/src/hooks/index.ts` — Barrel export for `useIndexChart`
- `App/frontend/src/components/domain/index.ts` — Barrel export for `IndexPriceChart`

### 4. Settings View Refactor

- Refactored Settings into card-grid layout with drill-in pattern
- Added Sector Lords configuration card

### 5. Auth & Supabase Integration

- Supabase client setup with environment variables
- Auth context with login/logout flows
- Service role key for admin operations

---

## Architecture Decisions

1. **Separated master tables from EOD**: `km_index_symbols` (identity) + `km_index_eod` (time-series) instead of a single flat table. Enables clean FK relationships and efficient queries.

2. **vendor_codes JSONB**: Each symbol can store multiple vendor mappings (`{"yahoo": "^NSEI", "breeze": "NIFTY"}`) — extensible to new data sources.

3. **SECURITY DEFINER for admin checks**: Avoids RLS infinite recursion by wrapping the admin check in a function that bypasses RLS.

4. **React Query for data fetching**: 10-minute stale time for EOD data (doesn't change intraday), 30-minute garbage collection.

5. **Supabase `.range(0, 9999)`**: Overrides default 1000-row limit for large time-series queries.

---

## Known Issues & Next Steps

### To Run Locally
```bash
# Load data (run from App/backend/)
python3 yfinance_historical.py --type index --limit 5

# Start frontend (run from App/frontend/)
npm run dev
```

### Supabase SQL to Run (if not already done)
- `App/DBscripts/km_clean_rebuild.sql` — Create tables
- `App/DBscripts/km_seed_masters.sql` — Seed 93 indices + 1,380 equities
- `App/DBscripts/km_fix_rls_recursion.sql` — Fix RLS infinite recursion

### Future Work
- **Candlestick charts** with SMA overlays, SuperTrend, volume bars (PineScript blueprint saved)
- **Equity charts** — extend Markets view to show individual stock charts
- **Planetary overlays** — combine ephemeris data with price charts
- **Backtest engine** — correlate astronomical events with market movements
- **Real-time data** — integrate live market feeds
- **Recommendation engine** — port PineScript LuckyPop logic to TypeScript

---

## Commits on Feature Branch

```
1038ea3 Fix infinite RLS recursion in km_profiles admin policy
f11e53f Fix vendor_codes JSON string parsing and update NIFTY 500 ticker
ae33d5d Fix Supabase query: use .range() for 10k row limit, .maybeSingle(), add debug logs
5283a59 Add Markets view with real index price charts from Supabase
5fbf3db Switch to yf.download() and increase retry backoff
0e706b3 Add retry with backoff for yfinance rate limiting
03500e0 Add yfinance historical downloader for 20-30yr backfill
417232e Separate vendor code mapping from EOD download (long-term design)
91838fa Add --diagnose and --breeze-code flags, SDK extraction fallback
988c619 Add vendor_codes JSONB column and fix ISEC stock code resolution
2ae7097 Add ISEC stock code resolution for Breeze API
cc30cc8 Replace supabase-py with lightweight REST client using requests
ed6d2f3 Add clean rebuild SQL for fresh table creation
e619798 Add ICICI Breeze EOD downloader for index and equity data
67a87d1 Restructure DB: separate master tables from EOD time-series
38e61e0 Add seed script and generated SQL for index + equity symbols
5b8bf4b Add service role key to .env
10e183e Add migration scripts for km_index_symbols and km_equity_symbols
30a4034 Add SeedData folder
8d4d22c Refactor Settings into card grid with drill-in pattern
```
