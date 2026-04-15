# Kāla-Drishti — Claude Code Context

Market analysis and forecasting platform combining NSE/BSE market data with planetary/astronomical intelligence.

---

## Architecture

```
kaaladristi/
├── App/
│   ├── backend/           # Python — data pipeline + FastAPI sidecar
│   │   ├── lib/           # Shared: db_client, breeze_client, config, sync_logger
│   │   ├── pipeline/      # Downloaders (NSE/BSE bhav, FII/DII), processors, utils
│   │   ├── pipeline_api.py  # FastAPI sidecar — port 8100
│   │   ├── breeze_downloader.py  # Unified EOD downloader (ICICI Breeze)
│   │   ├── daily_pipeline.py     # Orchestrator for daily market data sync
│   │   └── requirements.txt
│   ├── frontend/          # React + TypeScript + Vite
│   │   └── src/
│   │       ├── views/     # Page-level components
│   │       ├── services/  # Supabase/PostgREST query functions
│   │       ├── hooks/     # React Query hooks
│   │       ├── components/  # UI + domain components
│   │       └── config/theme/  # 3-theme system (kaaladristi / tech-ai / jade-thorn)
│   └── DBscripts/         # SQL migrations (km_migration_NNN_*.sql)
├── docker-compose.yml
└── nginx/
```

---

## Database (Self-hosted PostgreSQL + PostgREST)

- **DB**: `ki_prime_db` on VPS, accessed via `DB_PRIMARY` env var
- **API layer**: PostgREST on port 3000 (JWT-secured)
- **Python backend**: direct psycopg2 via `lib/db_client.py`
- **Frontend**: PostgREST REST API via `services/postgrest.ts`

### Key Tables

| Table | Description |
|---|---|
| `km_index_symbols` | 93 NSE indices master + `vendor_codes` JSONB |
| `km_equity_symbols` | ~1,380 NSE equities master + `vendor_codes` JSONB |
| `km_index_eod` | Index OHLCV end-of-day time-series |
| `km_equity_eod` | Equity OHLCV end-of-day time-series |
| `km_index_15m` | 15-min intraday (schema only — Phase 2) |
| `km_equity_15m` | 15-min intraday (schema only — Phase 2) |
| `km_corporate_actions` | Bonus/split/dividend events + adj_factor |
| `km_data_sync_log` | Pipeline run audit log |
| `dc_inference` | Planetary DC (Dasha Cycle) inference rules |
| `dc_lookup` | Lookup values for DC inferences |
| `km_profiles` | User profiles + roles (RLS-controlled) |

Latest migration: **035** (`km_migration_035_pipeline_coverage.sql`)

| Table | Description |
|---|---|
| `km_market_breadth` | EMA-based breadth score (migration 020) |
| `km_breadth_roc` | ROC momentum breadth oscillator (migration 021) |
| `km_index_constituents` | Index→Equity mapping with sector/weight (migration 022, FK → `km_index_symbols`) |
| `km_industry_eod` | Daily industry-level aggregation from equity EOD (migration 033, PK: trade_date + industry) |

### Deprecated Tables — DO NOT USE

| Table | Rows | Why Deprecated |
|---|---|---|
| `km_index_master` | 13 | Redundant subset of `km_index_symbols` (93). Only has 13 indices with yahoo tickers. |
| `km_index_composition` | 89 | FK references `km_index_master`. All `sector` and `weight_pct` are NULL. Useless data. |

**Use instead**: `km_index_symbols` for index master, `km_equity_symbols.index_names[]` for index→equity mapping.
Frontend `masterData.ts` still references these legacy tables — to be migrated.

### Inactive Indices

| Index | Why Inactive |
|---|---|
| `SHANTHALA` | Not a real NSE index. Mark `is_active = false`. 502 equities tagged with it in `index_names[]` — to be cleaned. |

### Missing Indices — To Be Added Later

| Index | Category | Notes |
|---|---|---|
| `NIFTY SME EMERGE` | thematic market index | 503 stocks in SeedData CSV. Not yet in `km_index_symbols` or `km_equity_symbols.index_names[]`. Activate when SME data pipeline is ready. |

---

## Environment Variables

All env vars live in `App/.env` (single file for both frontend and backend).
See `App/frontend/.env.example` for the full template.

```
DB_PRIMARY=postgresql://...          # Python backend only
JWT_SECRET=...                       # matches PostgreSQL app.jwt_secret
VITE_POSTGREST_URL=http://VPS:3000   # frontend
VITE_PIPELINE_API_URL=http://...:8100
VITE_THEME=kaaladristi               # or tech-ai or jade-thorn
BREEZE_API_KEY=...
BREEZE_API_SECRET=...
BREEZE_SESSION_TOKEN=...
```

---

## Frontend

- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, React Query, Recharts, lightweight-charts
- **Theme**: Driven by `VITE_THEME` env var — 3 themes in `src/config/theme/themes/`
- **Routes/Views**: Dashboard, Markets, Chart, DC Calendar, Inference, Rule Eval, Scanner, Settings
- **Settings sub-pages**: Index Catalog, Equity Catalog, Commodity Catalog, Market Data Hub, Pipeline Dashboard

### Running locally
```bash
cd App/frontend
npm install
npm run dev
```

---

## Backend / Pipeline

- **Language**: Python 3.11+
- **Data sources**: NSE bhav copy, BSE bhav copy, ICICI Breeze API, Yahoo Finance (fallback), NSE FII/DII
- **Pipeline API**: `uvicorn pipeline_api:app --host 0.0.0.0 --port 8100`
- **Health endpoint**: `GET /api/pipeline/health`

### Running locally
```bash
cd App/backend
pip install -r requirements.txt
# Set DB_PRIMARY + BREEZE_* in App/.env
uvicorn pipeline_api:app --port 8100
```

---

## Docker

```bash
# From kaaladristi/ dir
docker-compose up --build
```

Services: `frontend` (port 3001), `backend` (port 8100), `nginx` (port 80 reverse proxy).

---

## Current Plan (PLAN.md)

Working through a 7-step EOD data pipeline build:

| Step | Status | Description |
|---|---|---|
| 1 | Done | Schema updates (corp actions, sync log, intraday tables, adj columns) |
| 2 | Done | Shared lib (`lib/`) extracted |
| 3 | Partial | Master data expansion (BSE equities, TRI indices) |
| 4 | Done | `breeze_downloader.py` unified EOD downloader |
| 5 | Todo | `corp_actions_loader.py` — fetch BSE corporate actions |
| 6 | Todo | `adj_factor_calculator.py` — apply price adjustments |
| 7 | Todo | Historical backfill (~8.8M rows) |
| 8 | Todo | Daily sync runner |

**Phase 2** (after EOD solid): 15-min intraday, Rules Engine, ephemeris overlays.

---

## VaNi — AI Intelligence Layer

**VaNi** (वाणी, *Vāṇī*) is the branded AI intelligence layer of Kāla-Drishti.
The name means *voice / speech* in Sanskrit — also an epithet of Saraswati (goddess of knowledge).

VaNi implements **PRD FR-05: Natural Language Explanation** — factual, educational,
non-predictive insights explaining *why* risk is elevated or low in astronomical terms.

### Architecture

| Layer | File | Purpose |
|---|---|---|
| Skill registry | `App/backend/lib/ai_prompts.py` | `Skill(system, max_tokens)` named tuples per skill |
| AI client | `App/backend/lib/ai_client.py` | Vendor-agnostic HTTP client (Anthropic / OpenAI) |
| API endpoints | `App/backend/pipeline_api.py` | `GET /api/ai/*` — fetch + cache per-date insights |
| UI component | `src/components/domain/VaNiInsight.tsx` | Reusable panel shown below any data card |

### Current Skills

| Key | Endpoint | Feeds |
|---|---|---|
| `panchang_insight` | `/api/ai/panchang-insight?date=` | PanchangamCard |
| `breadth_insight` | `/api/ai/breadth-insight` | MarketBreadthChart |
| `breadth_roc_insight` | `/api/ai/breadth-roc-insight` | BreadthRocChart |
| `instrument_insight` | `/api/ai/instrument-insight?id=&type=` | ChartView (Phase 4) |
| `market_pulse_insight` | `/api/ai/market-pulse-insight` | DashboardView (Phase 4) |

### Tone Rules (all skills)
- Factual · Educational · Non-predictive
- Never: buy / sell / target price / guaranteed / certain
- Always explain in **astronomical terms**, not stock attribution
- Safe vocabulary: "elevated caution", "favorable window", "structural stress",
  "historically correlated with", "risk is heightened"

### Adding a New VaNi Skill
1. Add `_SKILL_SYSTEM` constant + register in `SKILLS` dict in `lib/ai_prompts.py`
2. Add `GET /api/ai/<skill-name>` endpoint in `pipeline_api.py`
3. Add `use<SkillName>Insight()` React Query hook in `hooks/useDashboardExtras.ts`
4. Drop `<VaNiInsight insight={...} isLoading={...} />` below any card

### Env Vars
```
AI_ENABLED=true
AI_PROVIDER=anthropic          # anthropic | openai
AI_API_KEY=sk-ant-...
AI_MODEL=claude-haiku-4-5      # any model the provider supports
```

---

## SQL Migration Convention

New migrations go in `App/DBscripts/km_migration_NNN_description.sql`.
Run them directly in pgAdmin, DBeaver, or `psql` — **no Python wrapper scripts**.
Next migration number: **038**.

---

## Industry Rotation MVP (Sprint: 2026-04-14)

### km_industry_eod (Migration 033)

Per-industry per-trade_date aggregation from `km_equity_eod JOIN km_equity_symbols ON industry`.
PK: `(trade_date, industry)`. Filter: stock_count >= 5, excludes "Shell Companies".

Columns: `stock_count`, `avg_magic_rs`, `pct_strong_bull`, `pct_strong_bear`,
`pct_accumulation`, `pct_distribution`, `dominant_flow_type`, `avg_sniper_inst`,
`pct_with_recent_svd`, `pct_with_recent_sbd`, `pct_with_recent_syd`,
`pct_volume_div_up`, `pct_volume_div_down`,
`industry_rank`.

**Pipeline integration**: Already wired in `daily_pipeline.py`. Execution order:
1. `compute_all_pending_indicators()` (indicators)
2. `compute_all_magic_rs('km_index_eod', 'index_id')` (index MagicRS — existing)
3. `compute_all_magic_rs('km_equity_eod', 'equity_id')` (equity MagicRS — migration 034)
4. `compute_all_flow_intelligence()` (flow intelligence)
5. `compute_all_industry_composites(trade_date)` (industry composites)

**Deduplication**: `v_equity_eod_deduped` view (migration 034) deduplicates dual-listed
stocks by ISIN, preferring NSE over BSE. ~1,628 dual-listed stocks reduced to one row
per company per date. The compute function uses this view.

**Per-exchange tracking**: `nse_as_of_date`, `bse_as_of_date`, `nse_stock_count`,
`bse_stock_count` columns track which exchange data contributed to each row.

### Industry Rotation Panel

Dashboard component showing 3-column rotation view:
- **Rotating In**: rank improved 5+ in last 5 trading days
- **Leading**: top quartile by avg_magic_rs
- **Rotating Out**: rank dropped 5+ in last 5 trading days

Tap industry → expands inline showing top 10 stocks by magic_rs.

Lookback constant: `INDUSTRY_ROTATION_LOOKBACK_DAYS = 5` (V2: user-toggleable).

### Scanner (`/scan`)

Six preset scans combining industry rotation + stock-level signals:
1. **Power Buy** — strong stocks in rotating-in/leading industries
2. **Power Sell** — weak stocks in rotating-out/lagging industries
3. **Smart Money Loading** — high accumulation + rising sniper_inst + RSS recovery
4. **Fresh Breakouts** — 20-day highs + RVOL > 2 in top-quartile industries
5. **Quiet Accumulation** — contrarian: non-top industries with rising accumulation
6. **Distribution Warnings** — ex-Strong Bull degrading + SYD/volume divergence

All scan logic in `services/scanEngine.ts` — pure TypeScript, no backend RPC.
Tap stock row → modal detail card (price, RS, flow, dots).

### KaalaDristi Vocabulary

| Internal Term | Display Label |
|---|---|
| `sniper_inst` | Smart Money |
| SBD signal | Accumulation Signature |
| SVD signal | Strong Volume Drive / Volume Drive |
| SYD signal | Distribution Signal |

---

## Known Issues

### Volume Scale Discontinuity (km_index_eod)
- Detected: 2026-04-13
- Affected: index_id = 1 (NIFTY 50), possibly others
- Symptom: Pre-2026-03-25 volume ~500K/day vs post-2026-03-25 ~400M/day
- Impact: RVOL near-zero for pre-discontinuity dates causing false LOW_VOLUME and VACUUM_DOWN signals
- Workaround: RVOL < 0.1 AND TVOL > 0.5 guard in compute_flow_intelligence()
- Root cause: Unknown — possibly data source change or index reconstitution. Needs investigation.
- Status: Guard applied in migration 031. Root cause investigation pending.

---

## Git Convention

- Feature branches: `claude/<feature>-<id>`
- Develop on the assigned branch, push when done
- PR into `main`

---

## Visual Pulse — UX Challenge Spec

**Goal:** A trader glances at the screen and makes a go/no-go decision in 4-5 seconds.
No chart reading. No number parsing. Pure visual intuition.

### Design Principle

Every technical indicator is mapped to a **real-world metaphor** that humans
process instantly. Numbers become shapes. Trends become motion. Conviction becomes density.

### Visual Language

| Indicator | Data Source | Metaphor | Visual |
|---|---|---|---|
| **RSI** | `rsi_14` | Cell signal tower | 1-5 bars. Everyone knows weak vs strong signal. RSI 20→1 bar, RSI 80→5 bars |
| **MagicRS** | `magic_rs`, `magic_rs_zone` | Ocean wave | Rising wave = outperforming NIFTY 500. Sinking = drowning. Height = strength |
| **Order Flow** | `flow_type`, `vacuum_flag`, `accum_distrib` | River current | Blue rushing = fresh longs. Draining = liquidation. Dry riverbed = vacuum |
| **Sniper Dragon** | `sniper_inst`, `sniper_hot` | Sonar/Radar | Big blip = institutional. Lightning = hot money. Scattered dots = retail only |
| **RVOL/TVOL** | `rvol`, `tvol` | Crowd/Stadium | Packed = high conviction. Empty seats = nobody backing this move |
| **SuperTrend** | `supertrend_dir` | Wind flag | Flag direction = trend. Strong wind = clear trend. Calm = choppy |
| **DOT Signals** | `dot_svd`, `dot_sbd`, `dot_syd` | Stacked traffic lights | 3 lights for 3 timeframes. All green = go. Mixed = caution |
| **DC Inference** | `dc_inference` | Sky/Celestial | Sun = astro favorable. Eclipse = danger. Stars aligned = strong support |
| **Breadth** | `km_market_breadth` | Forest/Ecosystem | Green forest = broad participation. Dying trees = narrow, fragile market |

### Composition

All metaphors sit together as a **landscape scene** or **dashboard strip** on the
index chart page, below the price header. The trader sees:

```
Sky (astro) + Wind (trend) + Wave (RS) + River (flow) + Signal tower (RSI) + Stadium (volume) + Sonar (who)
```

One cohesive visual scene — not 7 separate widgets.

### Data Availability

All data exists in `km_index_eod` / `km_equity_eod` and `dc_inference`.
Frontend currently fetches most columns but only displays a few.
Missing from frontend fetch: `flow_type`, `vacuum_flag`, `accum_distrib`.

### Milestones

| # | Milestone | Scope | Status |
|---|---|---|---|
| VP-1 | **Prototype: RSI Signal Tower** | Single SVG component. Map RSI 0-100 to 1-5 animated bars. Test on chart page. Get the visual language right. | Todo |
| VP-2 | **MagicRS Wave** | Animated wave SVG. Height from magic_rs value. Color from zone. | Todo |
| VP-3 | **Order Flow River** | Flow direction + intensity from flow_type + RVOL. Vacuum = dry. | Todo |
| VP-4 | **Sniper Sonar** | Radar pings for inst/hot/retail presence. Size = magnitude. | Todo |
| VP-5 | **DOT Traffic Lights** | 3 stacked circles. SVD/SBD/SYD mapped to green/amber/red. | Todo |
| VP-6 | **Volume Stadium** | Crowd density visualization from RVOL/TVOL. | Todo |
| VP-7 | **DC Sky** | Celestial backdrop from dc_inference. Sun/clouds/eclipse. | Todo |
| VP-8 | **Compose Scene** | Arrange all metaphors into one cohesive visual strip. | Todo |
| VP-9 | **Index Heatmap** | Constituent grid below the scene. MagicRS zone + change% per stock. | Todo |
| VP-10 | **VaNi Narration** | AI reads the visual state and generates 1-line summary for accessibility. | Todo |

### Iteration Rule

VP-1 (RSI Signal Tower) must go through **multiple design iterations** until the
visual language feels right. Only then proceed to VP-2. Once one metaphor works,
the pattern applies to all others.

Detailed spec for each milestone: see `docs/visual-pulse-spec.md`

### Iteration Rule

VP-1 (RSI Signal Tower) must go through **multiple design iterations** until the
visual language feels right. Only then proceed to VP-2. Once one metaphor works,
the pattern applies to all others.
