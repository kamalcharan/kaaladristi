# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Kāla-Drishti — Claude Code Context

Market analysis and forecasting platform combining NSE/BSE market data with planetary/astronomical intelligence.

---

## Architecture

```
kaaladristi/
├── App/
│   ├── backend/           # Python — data pipeline + FastAPI sidecar
│   │   ├── lib/           # Shared: db_client, breeze_client, config, sync_logger, ai_client
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

Latest migration: **090** (`km_migration_090_tier_subscriptions.sql`)

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
VITE_PIPELINE_API_URL=http://...:8101
VITE_THEME=kaaladristi               # or tech-ai or jade-thorn
BREEZE_API_KEY=...
BREEZE_API_SECRET=...
BREEZE_SESSION_TOKEN=...
```

---

## Frontend

- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, React Query, Recharts, lightweight-charts
- **Theme**: Driven by `VITE_THEME` env var — 3 themes in `src/config/theme/themes/`
- **Routes/Views**: **Workspace (`/workspace`)**, Dashboard, Markets, Chart, DC Calendar, Inference, Rule Eval, Scanner, Settings, Visual Pulse (Index), Visual Pulse (Equity), **Intraday (`/intraday/:indexId`)**, Manipulation Watch, Industry Transition
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

### Running locally
```bash
cd App/backend
pip install -r requirements.txt
# Set DB_PRIMARY + BREEZE_* in App/.env
uvicorn pipeline2_api:app --port 8101
```

---

## Docker

```bash
# From kaaladristi/ dir
docker-compose up --build
```

Services: `frontend` (port 3001), `backend` (port 8101), `nginx` (port 80 reverse proxy).

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
Next migration number: **089**.

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
| LLM inference notes — correlation drawer | Story-telling + LLM session | After this sprint |
| VaNi catalog explanations via Qwen3 | Use hardcoded texts for now | Post cashflow |
| Walk mode — mark on chart | Phase 6 | After Walk mode |
| Save observation — correlation page | Phase 6 | After Walk mode |
| Screener — filters, dashboard integration, UX rethink | Separate design session | After UX sprint |
| EVENT_OVERLAP visualization — untested | Needs two simultaneous astro overlays | When test data available |
| EVENT_IN_STATE visualization — untested | Needs astro rule + state widget pair | When test data available |
| Morning brief cache strategy review | Currently in-memory only (lost on restart); Charan to decide: keep as-is, add Redis, or DB-backed cache | Charan to finalize |
| CatalogDrawer compatibility | Drawer (440px) mounts IndicatorsSection + WidgetsSection directly — both are cramped, not in sync with new catalog UX. Fix: add `compact?: boolean` prop to switch to single-column layout. Deferred from UX sprint. | Next session |

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
