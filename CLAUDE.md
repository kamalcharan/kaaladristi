# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Kāla-Drishti — Claude Code Context

Market analysis and forecasting platform combining NSE/BSE market data with planetary/astronomical intelligence.

---

## Commands

### Frontend (`App/frontend/`)
```bash
npm install          # install dependencies
npm run dev          # dev server on port 5173 (0.0.0.0)
npm run build        # production Vite bundle → dist/
npm run typecheck    # tsc --noEmit (no build artifacts)
npm run lint         # ESLint
```

### Backend (`App/backend/`)
```bash
pip install -r requirements.txt
uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101   # active API server
```

### Docker (from repo root)
```bash
docker-compose up --build    # frontend (3001) + backend (8101) + nginx (80)
```

### Backend tests (standalone — no pytest config)
```bash
cd App/backend
python test_ephemeris.py        # Swiss Ephemeris / pyswisseph
python test_nse_industry.py     # NSE industry data
python test_bse.py              # BSE data
python scripts/rule_discovery_test.py   # quick rule discovery (2026 only)
```

### One-shot backfill scripts
```bash
cd App/backend/scripts
KD_DB_PASSWORD=... python rule_discovery.py             # all history
KD_DB_PASSWORD=... python rule_discovery.py 2026        # single year
KD_DB_PASSWORD=... python backfill_d365.py              # d365_pct_chng
KD_DB_PASSWORD=... python backfill_supertrend.py        # supertrend_dir
```

---

## Architecture

```
kaaladristi/
├── App/
│   ├── backend/           # Python — data pipeline + FastAPI sidecar
│   │   ├── lib/           # Shared: db_client, breeze_client, config, sync_logger, ai_client, ai_prompts, auth, pg_client, data_assemblers, vani_assemblers, vani_intents, vani_cache, health_checks
│   │   ├── pipeline/      # Downloaders (NSE/BSE bhav, FII/DII), processors, utils
│   │   ├── pipeline2/     # Pipeline2 orchestrator (handlers, scheduler, worker, health)
│   │   ├── engine/        # Risk engine (risk_engine.py) + correlations
│   │   ├── scripts/       # One-shot data scripts: rule_discovery.py, rule_discovery_test.py
│   │   ├── indicators/    # Technical indicator compute functions
│   │   ├── pipeline2_api.py # FastAPI sidecar — port 8101 (CURRENT — run this)
│   │   ├── pipeline_api.py  # OLD FastAPI sidecar — DO NOT RUN (superseded by pipeline2_api.py)
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

- **DB**: `kaala_dristi_db` on VPS, accessed via `DB_PRIMARY` env var
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
| `km_profiles` | User profiles + roles + `tier` column (RLS-controlled); migration 090 adds `tier TEXT DEFAULT 'free'` |
| `user_subscriptions` | Payment subscription rows; one per purchase (migration 090); `tier`, `started_at`, `expires_at` |

Latest migration: **095** (`km_migration_095_delivery_columns.sql`)

| Table | Description |
|---|---|
| `km_market_breadth` | EMA-based breadth score (migration 020) |
| `km_breadth_roc` | ROC momentum breadth oscillator (migration 021) |
| `km_index_constituents` | Index→Equity mapping with sector/weight (migration 022, FK → `km_index_symbols`) |
| `km_industry_eod` | Daily industry-level aggregation from equity EOD (migration 033, PK: trade_date + industry) |
| `km_astro_rule_master` | Timeless Vedic astro-market rule registry (migration 047); extended by migration 062 with `conditions` JSONB, `scope`, `outcome`, `probability_label`, `data_source`, `is_deleted` |
| `km_astro_calendar_2026` | 2026 event instances with market_impact (migration 048) |
| `km_astro_daily_signal` | Computed net astro signal per date (migration 049) |
| `km_daily_panchang` | Daily Vedic panchang (vara, nakshatra, tithi, yoga, paksha, dlnl_match, is_ekadashi, is_purnima, hemisphere_event) — source for rule discovery |
| `km_planetary_positions` | Daily planet positions (planet, longitude, sign_name, nakshatra_name, speed, retrograde, combust, vargottam) |
| `km_planetary_aspects` | Daily planetary aspects (planet_1, planet_2, aspect_type, orb, exact) |
| `km_rule_signals` | Discovered rule signal instances (date, rule_id, signal, strength, details, conditions_snapshot, actual_market_return, matched) |
| `km_rule_confidence` | Per-rule backtested confidence (rule_id PK, total_occurrences, matched_count, confidence_score) |
| `km_rule_transits` | Contiguous transit periods per rule; start_date, end_date, duration_days, nifty_return_pct, matched (migration 064) |
| `km_rule_confidence_yearly` | Per-year win-rate breakdown per rule; transits, matched, win_pct, avg_return, avg_duration (migration 064) |
| `km_astro_events` | Per-day astro event log; event_type, planet, from_value, to_value, severity (migration 071) |
| `km_candidate_rules` | Proposed-rule staging area before promotion to km_astro_rule_master; 12 rows (migration 071) |
| `km_daily_snapshots` | Per-day per-symbol JSONB snapshot store; one row per (date, symbol) (migration 071) |
| `km_factor_correlation_stats` | Factor × index volatility/return correlation stats; 29 rows (migration 071) |
| `km_indicator_compute_log` | Pipeline run log for indicator compute jobs; tracks symbols_count, rows_computed, status (migration 071) |
| `km_moon_intraday` | Intraday moon position 09:15–15:30 IST; longitude, nakshatra, gandanta flag; 59,900 rows (migration 071) |
| `km_risk_scores` | Risk Engine 4-dim composite output per (date, symbol); structural, momentum, volatility, deception, regime (migration 071) |
| `km_rules` | Legacy/technical rules registry (18 rows) — distinct from km_astro_rule_master; pre-migration discipline (migration 071) |
| `km_sector_sensitivity` | Per factor_type × sector sensitivity pct (migration 071) |
| `km_technical_signals` | Technical signal instances per (asset_type, symbol_id, trade_date, signal_type) — schema only, never populated (migration 071) |
| `km_score_calibration` | Score normalizer registry; one row per score_name, stores divisor/percentile for Plan Score etc. (migration 072) |
| `kd_scan_presets` | Scanner preset definitions — id, name, description, tooltip, sort_order, result_limit. One row per scan. Source of truth for `fetchScanPresets()`. Mutations via direct SQL migration only. |
| `km_equity_eod` (extended) | New columns added migration 094/095: `w52_high`, `w52_low`, `lifetime_high`, `avg_amt_5d`, `avg_amt_22d`, `delivery_surge_x`, `d30_pct_chng`, `d365_pct_chng`. All populated by `compute_rolling_metrics_for_date()` in pipeline step 6g. |
| `km_equity_weekly` / `km_equity_monthly` | Also carry `lifetime_high` column (migration 094). |

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

## Two Databases

The project uses **two separate PostgreSQL instances**:

| Instance | Env var | Purpose |
|---|---|---|
| `kaala_dristi_db` | `DB_PRIMARY` | All market data, pipeline, user, rule, and framework tables |
| `vani_db` | `VANI_DB_URL` | VaNi AI layer only: `vn_interaction_log`, `vani_observation_cache` |

Migration 092 (`km_migration_092_vani_observation_cache.sql`) targets **`vani_db`**, not the main DB.
All other migrations target `kaala_dristi_db`.

---

## Environment Variables

All env vars live in `App/.env` (single file for both frontend and backend).
See `App/frontend/.env.example` for the full template.

```
DB_PRIMARY=postgresql://...          # Python backend only
JWT_SECRET=...                       # matches PostgreSQL app.jwt_secret
VITE_POSTGREST_URL=http://VPS:3000   # frontend
VITE_PIPELINE_API_URL=http://...:8101
VITE_THEME=kaaladristi               # or tech-ai or jade-thorn
BREEZE_API_KEY=...
BREEZE_API_SECRET=...
BREEZE_SESSION_TOKEN=...
VANI_DB_URL=postgresql://...   # vani_db — separate from DB_PRIMARY
RAZORPAY_KEY_ID=...            # backend only
RAZORPAY_KEY_SECRET=...        # backend only
VITE_RAZORPAY_KEY_ID=...       # frontend public key
```

---

## Frontend

- **Stack**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS, React Query, Recharts, lightweight-charts
- **Theme**: Driven by `VITE_THEME` env var — 3 themes in `src/config/theme/themes/`
- **Routes/Views**: **Workspace (`/workspace`)**, Dashboard, Markets, Chart, DC Calendar, Inference, Rule Eval, Scanner, Settings, Visual Pulse (Index), Visual Pulse (Equity), **Intraday (`/intraday/:indexId`)**, Manipulation Watch, Industry Transition
- **Gemini**: `src/services/geminiService.ts` — secondary AI integration (alongside VaNi/Anthropic), currently limited use
- **Settings sub-pages**: Index Catalog, Equity Catalog, Commodity Catalog, Market Data Hub, Pipeline Dashboard

### Equity Visual Pulse (`/pulse/equity/:equityId`)

Equity-specific Visual Pulse page — separate from index VP (`/pulse/:indexId`).
Shares atomic components (chart, astro strip, slider, 4 sidebar cards) but adds:
- **Magic RS subchart** with zone bands (canvas-based, synced with price chart slider)
- **Multi-timeframe pills** (1D/1W/1M RS change dots with all-green glow)
- **Pump/Dump banner** (conditional, uses same thresholds as Manipulation Watch)
- **Scan Presence card** (which of the 6 scanner presets include this stock)
- **Industry Context card** (rotation status, percentile, rank within industry)
- **Edge cases**: inactive/delisted badge, stale BSE data indicator, limited history overlay, missing RS placeholder

Equity-only components: `components/domain/VisualPulse/equity/`
Data hook: `hooks/useEquityVisualPulse.ts` (metadata + 130 bars + DC inferences + industry context)
Scan check: `hooks/useScanPresence.ts` (runs all 6 scans to check membership)

### Intraday Cockpit (`/intraday/:indexId`)

Time-aware decision page modeled on Finastro Screen 1. EOD-now,
intraday-ready (every intraday-specific element has a `// INTRADAY:`
marker for future swap when `km_index_15m` is populated).

Components: `components/domain/Intraday/`
- `IntradayPage` — shell w/ single 1Hz clock source
- `IntradayHeader` — symbol + price + IST clock + Rahu/Abhijit pills
- `TopStrip` — 9-cell panchang strip (Session/Yoga/Tithi/Moon/YogaCh/Rahu/Abhijit/Time/LP)
- `AlertStrip` — next event resolver + active-window banner + verdict
- `PanchangBand` — SVG timeline 09:15–15:30 with zones + cursor
- `ConfluenceDial` — SVG ring 0–10 + 3-bar breakdown (Tech/Panchang/Planetary)
- `ConflictEngineCard` — 7-case verdict with stats citation
- `PanchangSidebar`, `PlanetsSidebar` — 9-graha table (canonical Vedic order)
- `IndicatorPanels` — 4 collapsible (Confluence / Order Flow+RSSI / Smart Money / Magic RS)
- `LPBadge` — placeholder until LP webhook lands

Pure logic: `services/conflictEngine.ts`, `services/confluenceScore.ts`, `services/intradayTime.ts`
Data hooks: `hooks/useIntraday.ts`, `hooks/useLastTradingDate.ts`, `hooks/usePlanetaryPositions.ts`
Spec: `docs/dristiq/intraday_page_spec.md`

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
- **Pipeline API**: `uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101` ← **always run this**
- **Health endpoint**: `GET /api/pipeline2/health`

> **⚠ Do not run `pipeline_api.py`** — it is the old v1 file, superseded by `pipeline2_api.py`.
> The frontend calls `/api/pipeline2/` routes which only exist in `pipeline2_api.py`.
> If the backend crashes and is restarted, make sure to start `pipeline2_api.py`, not `pipeline_api.py`.

### Daily Pipeline Steps (daily_pipeline.py — `run_nse_pipeline`)

Steps run sequentially for a trade date:
1–5. Download + ingest (NSE/BSE bhav, FII/DII)
6. `compute_all_pending_indicators()` — PostgreSQL RPC, sets `indicators_computed_at`
6a. `compute_all_magic_rs()` for equities
6b. `compute_all_flow_intelligence()`
6c. `compute_all_industry_composites()`
6d. Index returns (ret_5d/ret_22d/ret_66d)
6e. Weekly aggregate (Fridays only)
6f. Monthly aggregate (last calendar day only)
**6g. `compute_rolling_metrics_for_date(db, trade_date)`** — populates `d30_pct_chng`, `d365_pct_chng`, `avg_amt_5d`, `avg_amt_22d`, `delivery_surge_x`, `w52_high`, `w52_low`, `lifetime_high`. This step exists because the PostgreSQL RPC (step 6) sets `indicators_computed_at` but never computes these rolling columns.

### One-Shot Backfill Scripts

All scripts live in `App/backend/scripts/`. Run with `KD_DB_PASSWORD=...` env var (uses hardcoded VPS host `187.127.136.65`). Key scripts: `backfill_d365.py` (supports `--date YYYY-MM-DD`), `backfill_supertrend.py`, `backfill_rolling_metrics.py`, `backfill_vani_flags.py`, `rule_discovery.py` (accepts optional year arg), and transit generators: `generate_bayer_windows.py`, `generate_gandanta_windows.py`, `generate_mercury_windows.py`, `generate_panchak_windows.py`, `generate_venus_windows.py`.

### Running locally
```bash
# Set DB_PRIMARY + BREEZE_* in App/.env
cd App/backend && uvicorn pipeline2_api:app --port 8101
```

---

## Docker

```bash
# From kaaladristi/ dir
docker-compose up --build
```

Services: `frontend` (port 3001), `backend` (port 8101), `nginx` (port 80 reverse proxy).

**Two nginx configs**:
- `App/frontend/nginx.conf` — SPA routing + proxies `/api/` → `kd-pipeline-api2:8101`, `/db/` → `vikuna-postgrest:3000`
- `nginx/nginx.conf` — VPS-level config with gzip, explicit route matching for `/api/pipeline2/`, `/api/astro/`, `/api/panchang/`, `/api/ai/`, `/api/vani/`

**Docker compose** runs both pipeline-api (v1, legacy, port 8100) and pipeline-api2 (v2, active, port 8101) as separate containers. Only `pipeline-api2` is wired into nginx routing.

---

## Field Formulas

Source of truth for proprietary indicator math. Implemented in pipeline; displayed via `src/config/fieldConfig.ts`.

### RSS (`rss_value`)
Source: LuckyPop RSSI Pine Script
```
E1     = SMA(close, 10)
E2     = SMA(close, 40)
Spread = E1 - E2
RS     = RSI(Spread, 5)
RSS    = SMA(RS, 3)   ← stored as rss_value
```
Range 0–100. Overbought > 80, Oversold < 20.
Signal: RSS new high before price new high = early momentum (not yet in pipeline).

### Institution (`sniper_inst`)
Source: Sniper Dragon Pine Script
`1.5 × (RSI(9) − 61)`, clamped 0–50.
Above 35 = strong institutional presence.

### Hot Money (`sniper_hot`)
Source: Sniper Dragon Pine Script
`1.0 × (RSI(4) − 15)`, clamped 0–50.
Frequently hits cap of 50 in trending markets — not a bug, working as designed.

### MagicRS (`magic_rs`)
Source: LuckyPop SuperMagic Pine Script
144-bar RS of stock vs CNX500, normalized as % above/below SMA(60).
Zones stored in `magic_rs_zone` (Title Case): Strong Bull · Mild Bull · Neutral · Mild Bear · Strong Bear.
Base threshold: 6% with ATR adaptive factor.

---

## Current Plan

Active sprint: **Rules Engine**.

| Component | Status | Description |
|---|---|---|
| DB schema (migration 062) | Done | `km_astro_rule_master` extended, `km_rule_signals` backtesting cols, `km_rule_confidence` table |
| Rule discovery script | Done | `App/backend/scripts/rule_discovery.py` — populates `km_rule_signals` from all active rules |
| Rule Engine UI | In progress | React pages `/rules` (list) and `/rules/:id` (detail) |
| Backtesting | Todo | Fill `actual_market_return` + `matched` in `km_rule_signals`, compute `km_rule_confidence` |
| Risk Engine | Prototype | `App/backend/engine/risk_engine.py` — 4-dimension score (structural/momentum/volatility/deception) |

EOD pipeline (Steps 5-8 from PLAN.md) is parked while Rules Engine is active.

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
| API endpoints | `App/backend/pipeline2_api.py` | `GET /api/ai/*` — fetch + cache per-date insights |
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

### VaNi Confluence Shapes — CorrelationDrawer.tsx

| Shape | Visualization | Test status |
|---|---|---|
| `ZONE_CONFLUENCE` | Active callout + Gantt duration bars + 5D return histogram | **Tested** — triggered by default ICP templates |
| `EVENT_OVERLAP` | Dual SVG track timeline (teal/orange/purple) + stats row + instance list | **UNTESTED** — requires two simultaneous astro rule overlays as chart_overlays |
| `EVENT_IN_STATE` | Current state callout + conditional return table + event breakdown grid | **UNTESTED** — requires astro rule + magic_rs/order_flow/smart_money/breadth_roc overlay pair |
| `THRESHOLD_CROSS` | Falls through to plain InstanceList | **UNTESTED** — requires astro rule + rsi_14/rsi_9 overlay pair |

Backend `states[]`: `EVENT_IN_STATE` now returns `state` per instance (from `magic_rs_zone`, `flow_type`, `sniper_inst` level, or `breadth_roc` direction). Frontend shows fallback label "(backend state pending)" if `state` field missing.

### Adding a New VaNi Skill
1. Add `_SKILL_SYSTEM` constant + register in `SKILLS` dict in `lib/ai_prompts.py`
2. Add `GET /api/ai/<skill-name>` endpoint in `pipeline2_api.py`
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
Next migration number: **096**.

**Target database**: most migrations target `kaala_dristi_db`. Migrations that target `vani_db` must say so explicitly in the file header (example: migration 092).

---

## Framework System

The Framework is the user-configurable layer that lets traders build their own view of the market by adding indicators, widgets, scanners, and astro overlays.

### Key Files

| File | Purpose |
|---|---|
| `App/frontend/src/constants/frameworkConstants.ts` | Single source of truth for all enum-like types — `BlockType`, `PlacementType`, `ChartOverlayType`, `DataSourceType`, `TierType`, etc. |
| `App/frontend/src/constants/catalogItems.ts` | Static registry of all known indicators and widgets (`CATALOG_ITEMS`, `CATALOG_MAP`, helpers) |
| `App/frontend/src/constants/frameworkTemplates.ts` | 4 ICP starter templates (investor, trader, hybrid_weighted, hybrid_balanced) + `getTemplateForICP()` selector |
| `App/frontend/src/types/framework.ts` | TypeScript interfaces: `UserFramework`, `FrameworkBlock`, `ChartOverlay`, `GridPosition`, `PartialFramework` |
| `App/frontend/src/stores/frameworkStore.ts` | Zustand store — all framework state and mutations; `applyTemplate()` action wholesale-replaces blocks/overlays with VaNi attribution |
| `App/frontend/src/hooks/useAddToFramework.ts` | Public hook for adding items — handles tier gate and placement routing |
| `App/frontend/src/views/WorkspacePage.tsx` | `/workspace` route — framework loader, overlay pill strip, page header, mounts WorkspaceCanvas |
| `App/frontend/src/components/domain/Workspace/WorkspaceCanvas.tsx` | 12×10 CSS grid canvas, DnD drag-to-reposition (dnd-kit), edit mode with grid overlay + add-zone placeholders |
| `App/frontend/src/components/domain/Workspace/WorkspaceBlock.tsx` | Individual block card — grid-positioned, VaNi glow, drag handle (edit mode), right-click context menu |
| `App/backend/lib/auth.py` | `get_current_user_id()` FastAPI dependency — verifies HS256 JWT, returns `sub` as UUID string |

### Database

**`user_frameworks`** table — migration 088, `kaala_dristi_db`.
Schema: `id` (UUID PK), `user_id` (UUID), `name`, `version` (server-incremented), `instruments` (TEXT[]), `blocks` (JSONB), `chart_overlays` (JSONB), `template_id`, `tier_at_creation`.
RLS enabled — users can only read/write their own row.

API endpoints (all JWT-protected, caller_id must match path user_id):
- `GET  /api/framework/{user_id}` — fetch or auto-create default
- `POST /api/framework/{user_id}` — explicit create
- `PUT  /api/framework/{user_id}` — update; server controls `version` and `updated_at`

### VaNi Onboarding (ProfileSetup.tsx)

`views/ProfileSetup.tsx` is a 4-screen state machine (`Step = 1 | 2 | 3 | 4`):

| Screen | Content | Tier gate |
|---|---|---|
| 1 | Morphing VaNi orb, name/phone pre-fill from `authStore.profile` | All users |
| 2 | ICP question (Investor / Trader / Both + blend slider) | All users |
| 3 | Block-by-block animation showing selected template, VaNi narration log | All users |
| 4 | Equity selector — live query `km_equity_symbols` mcap_cr DESC, pick 2 | Free tier only; paid/beta go straight to `/workspace` |

**Template selection** (`getTemplateForICP`): investor → INVESTOR, trader → TRADER, both + blend ≥ 70 → HYBRID_WEIGHTED, both + blend < 70 → HYBRID_BALANCED.

**"Start here →"** calls `applyTemplate()` → `updateProfile({onboarded:true})` → free users go to Screen 4, paid/beta go to `/workspace`.

### ICP Templates (frameworkTemplates.ts)

| Template | Blocks | Chart overlays |
|---|---|---|
| INVESTOR | Market Breadth, Astro Calendar, MagicRS Index, Astro Panchak | EMA 20, Panchak (astro_zone) |
| TRADER | Conviction Flow, RSI 14, Breadth ROC, MagicRS Index | EMA 20, SMA 50 |
| HYBRID_WEIGHTED | Conviction Flow, Market Breadth, Astro Calendar, MagicRS Index, Breadth ROC | EMA 20, Panchak (astro_zone) |
| HYBRID_BALANCED | Market Breadth, Conviction Flow, Breadth ROC, MagicRS Index, Astro Calendar, Astro Panchak | EMA 20, SMA 50, Panchak (astro_zone) |

All blocks have `added_by: 'vani'` — rendered with purple glow + "VaNi ✦" badge in WorkspaceBlock.

### Workspace Canvas

- **Grid**: 12 columns × 10 rows, `CELL_HEIGHT_REM = 6`
- **Drag**: `@dnd-kit/core` `PointerSensor` (activationConstraint: distance 8). `useDraggable` lives inside `WorkspaceBlock` — `setNodeRef` on block outer div, `listeners + attributes` on drag handle only. Never wrap blocks in a `display:contents` container (breaks dnd-kit bounding box).
- **Edit mode**: shows GridOverlay + AddZone placeholders; "Done Editing" calls `saveFramework()`
- **Overlay strip**: horizontal scrolling pills above canvas; `toggleOverlayVisibility(catalogItemId)` from `useFrameworkStore()` on click

### Constants-First Rule

**Never define block types, placement types, tier types, or data source types inline in components.** Always import from `frameworkConstants.ts`. Adding a new type means editing that file only — all consuming code picks it up automatically.

```typescript
// WRONG — inline string literal
if (item.placement === 'chart_overlay') { ... }

// RIGHT — always import the constant
import { PLACEMENT_TYPES } from '@/constants/frameworkConstants'
```

### Active State Rule

**`isBlockActive(catalogItemId)` and `isOverlayActive(catalogItemId)` from `useFrameworkStore` are the single source of truth for whether an item is active in the framework.** No component, hook, or service should independently derive this from `blocks[]` or `chart_overlays[]` — always call these two functions.

### Adding a New Catalog Item

1. Add the `CatalogItem` entry to `CATALOG_ITEMS` in `catalogItems.ts`
2. Use only canonical column names — never legacy aliases (see below)
3. Set `applicable_to`, `tier_required`, `placement`, and `overlay_type` correctly
4. Astro rules are **not** in `catalogItems.ts` — they come from `km_astro_rule_master` dynamically

### Legacy Column Aliases — Never Use in New Code

`km_index_eod` contains old column names from early migrations. These are duplicates of the canonical columns and must never be referenced in new frontend or backend code:

| Legacy alias | Canonical column |
|---|---|
| `magicrs_value` | `magic_rs` |
| `magicma_value` | `magic_ma` |
| `sniper_banker` | `sniper_inst` |
| `sniper_hotmoney` | `sniper_hot` |
| `accum_dist` | `accum_distrib` |
| `vacuum_status` | `vacuum_flag` |
| `flow_meaning` | `flow_type` |

---

## Catalog System

### Route & Entry Point

`/catalog` → `src/views/CatalogPage.tsx` — 5-tab subnav (left 200px) + right content area + fixed-position overlays.

```
CatalogPage
├── subnav tabs (Master Frameworks / Astro Rules / Indicators / Widgets / Scanners)
├── content area  → mounts active section component
├── DeepDivePanel (position: fixed, z-index 300) — slides in on row/card click
└── CatalogActionIsland (position: fixed, z-index 150) — floating pill, appears when framework non-empty
```

### Section Components & Data Sources

| Tab | Component | Data source |
|---|---|---|
| Master Frameworks | `MasterFrameworksSection` | `FRAMEWORK_TEMPLATES` static constant |
| Astro Rules | `CatalogAstroSection` | `ruleService.ts` — `fetchRules()` + `fetchConfidence()`, React Query keys `['rule-engine','rules']` and `['rule-engine','confidence']` |
| Indicators | `IndicatorsSection` | `getCatalogItemsByType('indicator')` from `catalogItems.ts` |
| Widgets | `WidgetsSection` | `getCatalogItemsByType('widget')` + `getCatalogItemsByType('scanner')` from `catalogItems.ts`; live previews via `useNiftyPulse()` |
| Scanners | `ScannersSection` | `SCAN_PRESETS` from `scanEngine.ts`; card click navigates to `/scanner/:id` |

### Shared Data Layer — Astro Rules

`CatalogAstroSection` and the Rules Engine page (`/rules` → `RuleList.tsx`) share the same React Query cache:

```typescript
// Same keys in both components — only one network request ever made
queryKey: ['rule-engine', 'rules']      // fetchRules() from ruleService.ts
queryKey: ['rule-engine', 'confidence'] // fetchConfidence() from ruleService.ts
```

Both `fetchRules` and `fetchConfidence` live in `src/pages/RuleEngine/ruleService.ts`. `RuleList.tsx` exports `OutcomeBadge`, `TypeChip`, `ConfidenceCell`, `RULE_TYPE_LABELS`, `PROB_STYLES` for reuse in `CatalogAstroSection`.

### Astro Rule → Framework ID Convention

Astro rules are not in `catalogItems.ts`. When added to the framework they are stored as synthetic `CatalogItem` entries with a compound ID:

```typescript
id: `astro_rule:${rule.rule_code}`   // e.g. "astro_rule:SP-TAU-VEN-BUL"
```

- `isBlockActive` / `isOverlayActive` in `frameworkStore` use this full compound ID as the lookup key.
- Range rule types (`planet_transit`, `planet_state`, `planet_conjunction`, `vedh`, `planet_manifestation`) → `placement: 'chart_overlay'`, `overlay_type: 'astro_zone'`.
- Point rule types (`nakshatra_vara`, `tithi_alone`, `eclipse`, `compound`) → `placement: 'panel_block'`.
- `RANGE_RULE_TYPES` and `POINT_RULE_TYPES` are the canonical constants in `frameworkConstants.ts`.
- **`compound` routing is explicit, not generic**: only `PNK*` compound rules get overlay treatment (date-range zones). All other compound rules (BAY-*, SEA-*, HEM-*, VOL-*) are panel blocks. To add a future compound group as overlay, add it explicitly: `rule.rule_code.startsWith('PNK') || rule.rule_code.startsWith('XXX')` — do NOT make the check generic.

### DeepDivePanel

`src/components/domain/Catalog/DeepDivePanel.tsx` — fixed slide-in from the right (width 380px, z-index 300). Two modes driven by `DeepDiveItem` union type:

**Mode A — Astro Rule** (`mode: 'astro_rule'`):
- Fetches `km_rule_confidence` and `km_rule_confidence_yearly` for the rule's DB `id`
- Shows: remarks, conditions tags, placement note, backtesting stats grid, yearly win-rate bar chart
- Secondary CTA: **"Full Analysis →"** — navigates to `/rules/${item.id}` and closes panel
- Primary CTA: **"+ Add to Framework"** / **"✓ In Framework"** in the footer

**Mode B — Catalog Item** (`mode: 'catalog_item'`):
- Static metadata only: description, block_type, placement, applicable_to, tier, DB column
- Primary CTA: **"+ Add to Framework"** / **"✓ In Framework"** / **"🔒 Paid tier required"**

### CatalogDrawer

`src/components/domain/Catalog/CatalogDrawer.tsx` — slides in from the right (width 440px, z-index 200), launched from the Workspace (below DeepDivePanel's z-index 300).

Three tabs: **Indicators | Widgets | Astro Rules**. Mounts the exact same section components (`IndicatorsSection`, `WidgetsSection`, `CatalogAstroSection`) with no `onSelect` prop — `+ Add` / `✓ Active` buttons work, deep-dive is not available inside the drawer. "Full Catalog →" link navigates to `/catalog` and closes.

Wired into `WorkspaceCanvas.tsx` via three entry points:
- `+ overlay` pill in the canvas topbar
- `AddZone` placeholders in edit mode
- "Add blocks from the Catalog" link in the empty-canvas state

### CatalogActionIsland

`src/components/domain/Catalog/CatalogActionIsland.tsx` — floating pill rendered at the bottom of `CatalogPage`. Slides up when `framework.blocks.length + framework.chart_overlays.length > 0`, hidden otherwise.

Shows live block count + overlay count from `useFrameworkStore()`. Pulse dot turns amber while `isSaving`. "Open Workspace →" navigates to `/workspace`.

Positioning: `left: 50%; transform: translateX(calc(-50% + 210px))` — 110px for main sidebar (220px ÷ 2) + 100px for catalog subnav (200px ÷ 2).

### useNiftyPulse() Hook

`src/hooks/useNiftyPulse.ts` — thin wrapper over `useVisualPulse(NIFTY_50_ID)` where `NIFTY_50_ID = 1`.

Used by the three live widget wrappers in `src/components/domain/Catalog/widgets/`:

| File | Wraps | Compute functions used |
|---|---|---|
| `MagicRsWidget.tsx` | `MagicRsSubchart` | none — maps bars to `MagicRsDataPoint[]` |
| `OrderFlowWidget.tsx` | `OrderFlowCard` | `computeRssSignals()` from `visualPulseEngine.ts` |
| `SmartMoneyWidget.tsx` | `SmartMoneyCard` | `computeSmartMoney()`, `computeDots()` from `visualPulseEngine.ts` |

All three wrappers use the same React Query key `['visual-pulse-bars', 1]` — only one network request regardless of how many are visible simultaneously. Static narrative `"NIFTY 50 · Live"` is passed to both `OrderFlowCard` and `SmartMoneyCard` (empty string risks broken layout since both components reserve space for the narrative prop).

### Legacy Column Aliases — Confirmed

Already documented in the Framework System section above. The catalog codebase strictly uses canonical column names only. No new code may reference legacy aliases.

---

## Rules Engine

### Architecture

```
km_astro_rule_master  →  scripts/rule_discovery.py  →  km_rule_signals
                                                              ↓
                                                     km_rule_confidence  (backtesting)
```

**Rule discovery** (`App/backend/scripts/rule_discovery.py`):
- Reads all `is_active=TRUE AND data_source='available'` rules from `km_astro_rule_master`
- Each rule has a `rule_type` and a `conditions` JSONB that drives a typed discovery function
- Inserts matching dates into `km_rule_signals` with `ON CONFLICT DO NOTHING`
- Uses `KD_DB_PASSWORD` env var (not `DB_PRIMARY`); hardcoded host `187.127.136.65`

```bash
# Run discovery for all history
cd App/backend/scripts
KD_DB_PASSWORD=... python rule_discovery.py

# Run for a single year (test mode)
KD_DB_PASSWORD=... python rule_discovery.py 2026

# Quick test via wrapper
python rule_discovery_test.py   # runs 2026 only
```

### Rule Types

| `rule_type` | Discovery function | Conditions keys |
|---|---|---|
| `nakshatra_vara` | `discover_nakshatra_vara` | `vara`, `nakshatra_lord`, `day_lord_equals_nakshatra_lord` |
| `planet_transit` | `discover_planet_in_nakshatra` / `discover_relative_position` | `planet`, `nakshatra`, `same_sign`, `position`, `aspect_type` |
| `planet_state` | `discover_planet_state` | `planet`, `condition` (combust/retrograde/vargottam/reducing_speed), `planets_retrograde`, `planets_alone` |
| `planet_conjunction` | `discover_conjunction` | `planet_1`, `planet_2`, `aspect_type` |
| `vedh` | `discover_vedh` | `planet`, `vedh_of`, `mutual_vedh` |
| `tithi_alone` | `discover_tithi` | `tithi_base`, `paksha`, `is_ekadashi`, `is_purnima` |
| `compound` | panchak / yog / seasonal / sign routers | `panchak_day`, `yoga`, `event`, `sign` |
| `eclipse` | `discover_eclipse` | `eclipse_type` (lunar/solar) |

### Risk Engine (Prototype)

`App/backend/engine/risk_engine.py` — 4-dimension composite score (0-100):
- **Structural** (0-25): Saturn/Jupiter retrogrades + aspects
- **Momentum** (0-25): Mars retrograde + Mars-Saturn/Mars-Rahu
- **Volatility** (0-25): Moon in high-risk nakshatras + gandanta + malefic clustering
- **Deception** (0-25): Mercury/Venus retrograde + Mercury-Rahu

Regime: Accumulation (≤30) / Expansion (≤50) / Distribution (≤70) / Capital Protection (>70).
Currently reads from SQLite (`schema.py`), not the Postgres stack. Prototype only.

### Rule Engine UI

Routes: `/rules` (list) and `/rules/:id` (detail).
Component files: `src/pages/RuleEngine/RuleList.tsx`, `RuleDetail.tsx`, `index.ts`.
Data: PostgREST on `187.127.136.65:3000`.
- List: `GET /km_astro_rule_master?is_deleted=eq.false&is_active=eq.true&select=...`
- Detail: `GET /km_astro_rule_master?id=eq.{id}&select=*` + `GET /km_rule_confidence?rule_id=eq.{id}` + `GET /km_rule_signals?rule_id=eq.{id}&order=date.desc&limit=50`

---

## Signal Vocabulary — Canonical Source of Truth

**Always import from `App/frontend/src/constants/signalScale.ts`.** Never define signal labels, colors, or type unions inline in components.

### 1. Market Impact Scale (`MarketImpact` type)

Used for: `km_astro_calendar.market_impact`, `km_astro_daily_signal.net_signal`, dropdown options, badge colors.

| DB key | Display label | Color class |
|---|---|---|
| `strong_bullish` | Strong Bull | `text-risk-green` |
| `bullish` | Bullish | `text-risk-green` |
| `mild_bullish` | Mild Bull | `text-risk-green/70` |
| `neutral` | Neutral | `text-slate-400` |
| `turning` | Turning | `text-risk-amber` |
| `mild_bearish` | Mild Bear | `text-risk-red/70` |
| `bearish` | Bearish | `text-risk-red` |
| `strong_bearish` | Strong Bear | `text-risk-red` |

**Note:** The old `minor_bullish` / `minor_bearish` keys are **deprecated**. Migration 056 renames them in the DB.

### 2. MagicRS Zones

Used for: `km_equity_eod.magic_rs_zone`, `km_index_eod.magic_rs_zone` (Title Case, DB-computed).

| DB value | Display label | Color class |
|---|---|---|
| `Strong Bull` | Strong Bull | `text-risk-green` |
| `Mild Bull` | Mild Bull | `text-risk-green/70` |
| `Neutral` | Neutral | `text-muted` |
| `Mild Bear` | Mild Bear | `text-risk-red/70` |
| `Strong Bear` | Strong Bear | `text-risk-red` |

### 3. Flow Types

Used for: `km_equity_eod.flow_type`, `km_index_eod.flow_type` (UPPER_SNAKE, DB-computed).

| DB value | Display label | Color class |
|---|---|---|
| `FRESH_LONGS` | Fresh Longs | `text-risk-green` |
| `FRESH_SHORTS` | Fresh Shorts | `text-risk-red` |
| `SHORT_COVERING` | Short Covering | `text-risk-amber` |
| `LONG_LIQUIDATION` | Long Liquidation | `text-risk-red/80` |
| `LOW_VOLUME` | Low Volume | `text-muted` |
| `MIXED` | Mixed | `text-muted` |

### Imports

```typescript
import {
  type MarketImpact,
  SIGNAL_LABELS,      // MarketImpact → display label
  impactToColor,      // impact → 'green' | 'red' | 'amber' | 'slate'
  SIGNAL_CLASSES,     // color → { text, bg, border } Tailwind classes
  IMPACT_OPTIONS,     // ordered array of all MarketImpact values
  ZONE_LABELS,        // MagicRS zone → { label, color }
  FLOW_LABELS,        // flow type → { label, color }
  flowLabel,          // (flowType?) → { label, color } with fallback
} from '@/constants/signalScale';
```

---

## Scanner System (`/scan`)

### Architecture

All scan logic is pure TypeScript — no backend RPC. The scan engine fetches broad market data once and filters it client-side.

```
services/scanEngine.ts   ← all 9 scan functions + data fetching + types
hooks/useScan.ts         ← React Query wrappers: useScan(), useAllScanCounts(), useScanPresets()
views/ScanView.tsx       ← page, sort, TradingView export, per-preset layouts
kd_scan_presets (DB)     ← preset metadata (name/description/tooltip/limit); fetched via fetchScanPresets()
```

### 9 Current Scan Presets

| ID | Display Name |
|---|---|
| `power_buy` | Strength Confluence |
| `power_sell` | Weakness Confluence |
| `smart_money` | Smart Money Loading |
| `fresh_breakout` | Fresh Breakouts |
| `quiet_accumulation` | Quiet Accumulation |
| `distribution_warning` | Distribution Warnings |
| `conviction_flow` | Conviction Flow |
| `breakout_surge` | Breakout Surge |
| `stage_2_leaders` | Stage 2 Leaders |

**Adding a new scan**: (1) add `ScanDefinition` entry to `SCAN_PRESETS` in `scanEngine.ts`, (2) implement `scanXxx(bundle)` function, (3) register in the `SCAN_HANDLERS` dispatch map, (4) insert DB row via SQL migration into `kd_scan_presets`.

### Key Scan Engine Patterns

- **`ScanDataBundle`**: all data loaded once (symbols map, industry EOD, equity snapshots), passed to every scan function.
- **`buildNsePreferredIds(symbols)`**: returns `Set<number>` of equity IDs where NSE is preferred over BSE for dual-listed stocks — apply to scans with `universe: 'NSE_ONLY'` to prevent numeric BSE scrip codes appearing in results.
- **`displaySymbol(stock)`** in `lib/symbolUtils.ts`: BSE stocks have numeric symbols (e.g. `500325`). Always use `displaySymbol()` for UI rendering; it derives a short human-readable name from `company_name` when symbol is purely numeric.
- **`VaNiOpportunityConfig`**: fetched from `kd_vani_opportunity_config` DB table; `vaniOpportunity: boolean` flag set per stock based on ATR reward/risk gate.
- **`ExchangeFilter`**: `'combined' | 'NSE' | 'BSE'` — passed to `executeScan()` and `getAllScanCounts()`.
- **`ScanTimeframe`**: `'daily' | 'weekly' | 'monthly'` — determines which EOD table (daily/weekly/monthly) to pull from.

### TradingView Export

All 9 scans have a `TradingViewExportButton` component (in `ScanView.tsx`) that:
- Copies `NSE:SYMBOL,NSE:SYMBOL,...` to clipboard
- Downloads a `.txt` file
- Filters out purely numeric symbols (BSE scrip codes) from the export

### New Columns Available for Scan Filters (migration 094/095)

These are now populated daily via pipeline step 6g:

| Column | Meaning |
|---|---|
| `d30_pct_chng` | % price change over 30 calendar days |
| `d365_pct_chng` | % price change over 365 calendar days (calendar-date bisect, ±30 day tolerance) |
| `avg_amt_5d` | 5-day avg delivery amount in Cr |
| `avg_amt_22d` | 22-day avg delivery amount in Cr |
| `delivery_surge_x` | `avg_amt_5d / avg_amt_22d` — recent vs baseline delivery |
| `w52_high` / `w52_low` | 52-week (252-bar) rolling high/low |
| `lifetime_high` | Expanding max from each stock's first record |

### Stage 2 Leaders (Weinstein) Filter Logic

`w52_low_gate`: close must be `< w52Low * 1.25` (not extended from lows). **Note**: the gate is `close < threshold`, meaning stocks already too extended are excluded — the inequality direction is critical. An inverted gate caused zero results (bug fixed in session 2026-06-02).

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

## Critical Lessons (Patterns That Burned Us)

These are in `LESSONS_LEARNED.md` in full; summary for quick reference:

- **Threshold calibration**: always check actual data distribution before setting numeric thresholds. `sniper_inst` ranges 0–40 (not 0–100). Run `SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY col) FROM table` first.
- **Silent NULL columns**: a column can exist with no error but be NULL for all rows. Any RPC that silently returns 0 rows (no exception) is a landmine. Verify both index AND equity tables.
- **BSE numeric symbols**: 82% of equity universe has numeric scrip codes. Always use `displaySymbol(stock)` from `lib/symbolUtils.ts` for UI. Filter numeric codes out of TradingView exports.
- **Scan filter polarity**: inequality direction is critical. `close < w52Low * 1.25` means "not extended from lows". If you invert it, you exclude healthy stocks and get zero results.
- **PostgREST boolean filters**: use `is.true` / `is.false` (not `eq.true`). The QueryBuilder has an `is()` method for this.
- **RLS on pipeline-computed tables**: don't add RLS to aggregate tables (`km_industry_eod`, etc.) — they contain no user data and RLS creates silent access bugs when `kd_app` role differs from `authenticated`.
- **Coverage metrics**: `coverage_pct NUMERIC(5,2)` overflows on multi-date RPC results. Use `NUMERIC(7,2)` and cap at 999.99 in Python.
- **KaalaDristi voice is observational**: "Strength Confluence" not "Power Buy". Surface conditions, don't issue trade commands.

---

## Known Issues

### ⚠ NEEDS REVIEW — VaNi Correlation Cache + Delete Flow (CorrelationPage)
- Detected: 2026-06-02
- Status: **Broken — needs fresh session to debug end-to-end**
- Problem 1: Admin "clear cache" button calls `DELETE /api/vani/correlation-insight/{a}/{b}/{shape}` on backend + `queryClient.removeQueries` + resets `refreshCount`/`vaniTriggered`. But subsequent "Ask VaNi" still returns cached response in ~1s without LLM call — backend logs confirm no LLM hit.
- Problem 2: After delete, UI was auto-triggering VaNi (should be manual-only). Fixed by resetting `vaniTriggered=false` on delete. But cache problem persists.
- Suspected root cause: React Query observer not destroyed cleanly by `removeQueries` when query is still mounted; or backend `_corr_insight_cache` dict not being evicted correctly (shape mismatch in URL encoding?).

### How VaNi Correlation Caching Works (current design)
- **Backend**: `_corr_insight_cache: dict` — module-level Python dict, keyed by `corr_insight:{sorted_a}:{sorted_b}:{shape}`. Permanent until server restart. No TTL.
- **Backend DELETE**: `DELETE /api/vani/correlation-insight/{item_a}/{item_b}/{shape}` — sorts pair alphabetically, builds same key, calls `_corr_insight_cache.pop(key, None)`. Returns `{'deleted': 1}` if found.
- **Frontend cache**: React Query with key `['corr-insight', itemA, itemB, result?.shape, refreshCount]`, `staleTime: Infinity`. Only fires when `vaniTriggered && !!result`.
- **Force refresh**: `refreshCount` incremented in query key — backend receives `force_refresh: true` in body when `refreshCount > 0`, skips cache lookup. (NOT currently used in delete flow.)
- **Manual-only trigger**: `vaniTriggered` state — starts `false`, set `true` only on "Ask VaNi" button click. Delete resets it to `false`.
- **Review needed**: Trace full delete → re-ask cycle with backend logs open. Confirm shape value in DELETE URL matches shape in POST cache key. Confirm `removeQueries` with partial key `['corr-insight', itemA, itemB, result?.shape]` actually removes all variants.

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

---

## VaNi Morning Brief — Implementation Status (June 2026)

`POST /api/vani/daily` — sequential per-item processing, panchang always card 1.

### Architecture
- **Card order**: panchang → confluences (priority) → astro rules (fill remaining). Max 3 cards.
- **LLM calls**: one call per item (max_tokens=150), sequential. Panchang, astro rules, and confluences each get a tailored user message.
- **Cache**: `_vani_cache` — in-memory Python dict, keyed by `item_key` (e.g. `panchang:2026-06-01`, `rule:astro_rule:CON-SUN-MER-TRN:2026-06-01`). 24h TTL. Cleared on restart. **Decision: in-memory is sufficient** — morning brief is ephemeral; no Redis, no DB cache needed. Closed.
- **Action routing**: each observation carries `action` + `action_target`; frontend navigates on click (`/rules/:id`, `/correlation/:a/:b`, `/panchang`).
- **Prompt iteration**: system prompt rule 8 forbids: potential, may, could, might, volatility, shift, strategy, communication. Panchang sentence 1 uses exact format template; sentence 2 is verbatim signal count.
- **Prompts centralised**: `_VANI_MORNING_BRIEF_SYSTEM` and `_VANI_CORRELATION_INSIGHT_SYSTEM` both live in `lib/ai_prompts.py` as named `Skill` entries in `SKILLS` registry. `pipeline2_api.py` references via `_AI_SKILLS['vani_morning_brief']` and `_AI_SKILLS['vani_correlation_insight']`.

### Still deferred
- Morning brief — screener top 3% feed (depends on screener session)
- Prompt quality iteration may continue — share raw log output after each backend restart to verify Qwen3 output

---

## VaNi Correlation Insight — Implementation Status (June 2026)

`POST /api/vani/correlation-insight` — JWT-auth, sync, permanent in-memory cache.

### Architecture
- **Endpoint**: `POST /api/vani/correlation-insight` in `pipeline2_api.py`
- **Cache**: `_corr_insight_cache: dict` — module-level, keyed by `corr_insight:{sorted_a}:{sorted_b}:{shape}`. Permanent until server restart (pair insight rarely changes). No TTL.
- **Request model**: `CorrelationInsightRequest` — `item_a`, `item_b`, display names, descriptions, shape, n_instances, hit_rate, avg returns, currently_active.
- **Prompt**: `vani_correlation_insight` skill in `lib/ai_prompts.py`. Returns `{"insight": "..."}`. 2–3 sentences, forbidden-word guard, returns `null` on violation (no fallback text).
- **Logging**: writes to `vn_interaction_log` via `_log_interaction`.
- **Frontend**: `CorrelationPage.tsx` left panel — `useQuery` with `staleTime: Infinity`, fires once `result` loads. Renders loading shimmer → insight card with accent left-border, ✦ VaNi label, cached/fresh badge, italic Fraunces text. Position: between Outcome Split and Walk mode CTA.
- **Helpers**: `resolveDisplayName(id)` and `resolveDescription(id)` pull from `CATALOG_MAP` for indicator/widget items, fall back to `fmtId` for astro rules.

### Pending — debug not yet confirmed
- **Fix 4 debug logs** are still in `CorrelationPage.tsx` (4 `console.log` lines before `return`). Remove after confirming insight fires.
- Confirm `POST /api/vani/correlation-insight` appears in backend logs after navigating to `/correlation/ema_20/sma_50`. The query has `enabled: !!result` — if `result` is undefined at mount, it never fires.

---

## CorrelationPage — Left Panel Structure (June 2026)

Top to bottom (after `result` loads):
1. **Pattern Confidence** — `<ConfidenceDial n_instances hit_rate />` (label rendered inside component)
   - Thresholds: Strong (n≥30, hit≥65%) · Good (n≥15, hit≥60%) · Moderate (n≥8 or hit≥55%) · Low (n<8)
   - `hit_rate` = `max(bullish, bearish) / resolved` — computed in page
2. **Stats 2×2 grid** — Total Instances · Resolved · 5D Avg Return · 22D Avg Return
3. **DataQualityPill** — EOD DATA · {days_covered} days · {year_from}–{year_to} · {coverage_pct}% — conditional on `result.coverage_pct != null`
4. **Outcome Split** — bull/bear proportional fill bar
5. **VaNi Insight** — loading shimmer → insight card (LLM-generated, fetched from `/api/vani/correlation-insight`)
6. **Walk mode CTA** — tier-gated
7. **Dismiss correlation** button

### Component files
| File | Purpose |
|---|---|
| `components/correlation/ConfidenceDial.tsx` | SVG clock arc, props: `n_instances` + `hit_rate` |
| `components/correlation/DataQualityPill.tsx` | One-line EOD data coverage pill |

---

## Deferred — UX Review + Story-telling Session
- Full workspace UX review — story-telling, information hierarchy, user guidance
- LLM inference notes — replace template strings with Qwen3 calls (temperature 0.3,
  /no_think) with template fallback on failure. Covers all four correlation shapes.
- Action Island observations — wire VaNi live state text
- "Mark on chart" — CorrelationDrawer stub button needs to highlight overlap instances on WorkspaceChart (not yet wired)
- Companion: dristiQ-interaction-spec.md Section 6.4 + 16.6

## Deferred — UX & Story-telling Sprint (June 2026)

| Item | Why deferred | When |
|------|-------------|------|
| Morning brief — screener top 3% feed | Depends on screener session | After screener session |
| Master Frameworks catalog section | Full feature — LLM briefing, admin creation, user templates | Post cashflow |
| Astro Rules catalog improvements | Separate session | Next astro session |
| Scanners catalog | Separate session | Next scanners session |
| ~~LLM inference notes — correlation drawer~~ | **Done** — `POST /api/vani/correlation-insight` built; frontend wired in `CorrelationPage.tsx`. Debug confirmation pending in next session. | Done |
| VaNi catalog explanations via Qwen3 | Use hardcoded texts for now | Post cashflow |
| Walk mode — mark on chart | Phase 6 | After Walk mode |
| Save observation — correlation page | Phase 6 | After Walk mode |
| Screener — filters, dashboard integration, UX rethink | Separate design session | After UX sprint |
| EVENT_OVERLAP visualization — untested | Needs two simultaneous astro overlays | When test data available |
| EVENT_IN_STATE visualization — untested | Needs astro rule + state widget pair | When test data available |
| ~~Morning brief cache strategy review~~ | **Closed** — in-memory `_vani_cache` confirmed as final approach | Done |
| ~~CatalogDrawer compatibility~~ | **Done** — widened to 520px, `compact` prop added to `IndicatorsSection` (2-col grid) and `WidgetsSection`. | Done |

## Product Direction — Unified Rule Architecture (Do Not Build Yet)
- All overlays (astro, technical, compound) to be treated as first-class rules
- Single rule registry covers astro_rule, tech_rule, compound_rule types
- Discovery, correlation engine, and VaNi cache to operate on the same rule abstraction
- Enables NLP queries: "what happens when SMA 20 crosses SMA 50 above EMA 200"
- Enables indicator behaviour analysis N days before/after astro rule trigger
- Pre-condition: technical indicators need transit/signal rows in km_rule_signals equivalent
- Target: post-cashflow, requires separate design session

## Astro Market-Book 2026

Three new tables as of migrations 047-050:
- `km_astro_rule_master` — timeless rule registry (600+ rules planned)
- `km_astro_calendar_2026` — 2026 event instances with market_impact
- `km_astro_daily_signal` — computed net signal per date

Scoring: strong_bull=+3, bull=+2, minor_bull=+1, neutral=0,
         minor_bear=-1, bear=-2, strong_bear=-3
Turning date flagged regardless of score.

Recompute signals after any calendar insert/update:
```sql
SELECT compute_astro_daily_signals('2026-01-01', '2026-12-31');
```

API endpoints:
- `GET /api/astro/daily-signal?date=YYYY-MM-DD` — single date, includes active_events array
- `GET /api/astro/signals?from=YYYY-MM-DD&to=YYYY-MM-DD` — range, max 90 days, used by calendar view

---

## Payments

- Provider: Razorpay
- Keys: `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (backend, in .env — not committed); `VITE_RAZORPAY_KEY_ID` (frontend public key)
- Flow: `POST /api/payments/create-order` → Razorpay checkout modal → `POST /api/payments/verify` → tier upgrade in `km_profiles` + row in `user_subscriptions`
- Frontend service: `src/services/razorpayService.ts` — `createOrder`, `openCheckout`, `verifyPayment`
- Test mode: use Razorpay test keys during development (`rzp_test_*`)
- Live keys: Charan provides before production launch
- On successful verify: `km_profiles.tier` updated, `user_subscriptions` row inserted with `expires_at`
- After verify: frontend calls `refreshProfile()` → gate disappears, beta/paid UI activates automatically

---

## Bayer Rules — Implementation Status

Reference: "Stock & Commodity Traders Hand-Book of Trend Determination" — George Bayer, 1940.

### Mapped to existing rules (Bayer tag added via migration 101):
- Rule 1  → TRN-MER-MAN-TRN      Mercury direction change
- Rule 4A → TRN-MER-RIS-W-BUL   Mercury stations direct
- Rule 9  → TR-MER-CMB-E-BEA    Mercury combust east
- Rule 21 → CON-MER-VEN-CD-BEA  Retro Venus + Direct Mercury conjunction
- Rule 22 → CON-SUN-MER-TRN     Sun conjunct Retro Mercury

### New rules created with transit data (migration 101 + generate_bayer_windows.py):
- Rule 2  → BAY-R02-MAR-MER-SPD  Mars-Mercury geocentric speed diff ≈ 59min
- Rule 3  → BAY-R03-VEN-RET      Venus retrograde periods (island pattern)
- Rule 6  → BAY-R06-MAR-1635     Mars crosses 16°35' in any zodiac sign
- Rule 14 → BAY-R14-VEN-LON      Venus longitude unit cycle (unit = 1°9'13'')
- Rule 27 → BAY-R27-MER-SPD      Mercury speed crosses 59min or 1°58' threshold

### Transit generation scripts:
- `App/backend/scripts/generate_bayer_windows.py` — covers all 5 new rules above
- Run after migration 101: `DB_PRIMARY=... python3 generate_bayer_windows.py`

### Rules NOT yet implemented (source material needed):
- Rules 4B, 5, 7, 8, 10-13, 15-20, 23-26, 28-30, 31-48
- Require original Bayer 1940 handbook for accurate definition
- Do NOT guess or approximate — wait for verified source material

---

## Parked — Pending Review

### scanConvictionFlow + scanBreakoutSurge — VaNi rule migration deferred
- Status: still using inline `is_vani` local variable as fallback
- Blocked on: `is_vani_surge` and `is_vani_breakout` columns not yet in ScanDataBundle EOD SELECT
- What's needed:
  1. Add `is_vani_surge` and `is_vani_breakout` to the `km_equity_eod` SELECT in `loadDailyBundle()`
  2. Add both fields to `EquityEodSnapshot` type in `types/index.ts`
  3. Replace inline `is_vani` block in `scanConvictionFlow` and `scanBreakoutSurge`
     with `computeVaniOpportunity(eod, SCAN_PRESETS.find(p => p.id === '...').vani_rule)`
- File: `App/frontend/src/services/scanEngine.ts`
  - `scanConvictionFlow` lines ~915–919 (inline `is_vani` flag)
  - `scanBreakoutSurge` lines ~990–994 (inline `is_vani` flag)
  - `loadDailyBundle()` EOD SELECT ~line 163 (add the two columns)
- Until then: VaNi chip counts for conviction_flow and breakout_surge
  continue to use the existing inline logic (no regression)

### BAY-R14-VEN-LON (Venus Longitude Unit Cycle — Bayer Rule 14)
- Status: catalog_visible = false (hidden from users)
- Transit rows: 12,963 (fires every 1-2 days — too frequent)
- Confidence scoring: NOT RUN — nifty_return_pct = NULL
- Body rendering: uses standard AstroRuleBlockContent (no code change needed)
- Action required before publishing:
  1. Run confidence_scoring.py for BAY-R14 rule_id
  2. Review scored data — does the correlation hold?
  3. If valid: flip catalog_visible = true
  4. If too noisy: consider aggregating to weekly signal
     instead of daily unit completions
- Reference: Bayer Rule 14, Venus geocentric longitude
  unit = 1°9'13" (1.1536°), key reversal signal for
  banking stocks per Bayer 1940 handbook

---

## Scanner Data Gaps — Future Work

### ret_5d, ret_22d, ret_66d
- Populated: scanConvictionFlow ✓, scanBreakoutSurge
  (ret_5d, ret_22d only — ret_66d missing) ✓
- NOT populated: all direct-query stage scanners
  (stage_2_leaders, stage_2_watch, vani_opportunity,
  stage_4_leaders, stage_3_watch, vani_exit_watch)
- Reason: requires eodHistory[] multi-bar lookback
  which direct-query scanners don't fetch
- Fix: add history fetch to direct-query scanners
  OR use materialized views (Option C post-beta)

### rel_5d/22d/66d_n50, rel_5d/22d/66d_n500
- Populated: NONE — hardcoded null at every call site
  in scanEngine.ts (both bundle and direct-query scanners)
- Sprint 6 fix: removed rel_5d_n50/rel_5d_n500 from
  OPTIONAL_COLS in ScanTable.tsx so column picker no
  longer offers them. They will be re-enabled when
  the rel_* pipeline is built.
- Fix: compute from eodHistory[] against index benchmarks
  OR use a materialized view (Option C post-beta)

### avg_amt_5d, avg_amt_22d
- Populated: scanConvictionFlow ✓,
  fetchStage2Leaders ✓, fetchStage4Leaders ✓
- NOT populated: fetchStage3Watch, fetchVaNiExitWatch,
  fetchStage2Watch, fetchVaNiOpportunity,
  all other bundle scans
- Fix: add avg_amt columns to DB fetch for missing
  direct-query scanners (migration 095 already added
  the DB columns)

### ret_66d missing from breakout_surge
- scanBreakoutSurge computes ret_5d and ret_22d
  from eodHistory but stops at 22 bars
- ret_66d not computed — extend history walk to 66 bars

### Column picker
- Built in Sprint 5 (C29) as gear popover in ScanTable.tsx toolbar
- Uses useState<Set<string>> for hidden optional columns
- Per-preset localStorage persistence via `scan_cols:{presetId}` key

### Materialized Views / Scanner Cache
- Current approach: PostgREST direct queries,
  client-side computation (Option A)
- Post-beta: move to kd_scan_results table with
  nightly pipeline writes (Option C)
- Trigger: when user count grows beyond beta

### Breakout Event Detection
- breakout_level and pct_from_breakout are computed
  client-side only (20-bar rolling high)
- breakout_price, breakout_date, ageing do not exist
- Backlog B55: build breakout event detection pipeline
  to store true breakout price, date, and ageing in DB
