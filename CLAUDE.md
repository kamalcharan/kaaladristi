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

Latest migration: **149** (`km_migration_149_auth_schema_shim.sql`). ⚠ **The RLS layer is written in the Supabase idiom (`auth.uid()`/`auth.role()`/`auth.jwt()` + `public.is_admin()`), but this is SELF-HOSTED PostgREST with NO `auth` schema — 8 migrations REFERENCE `auth.*` and none DEFINED it, so every `auth.*`-based policy silently ERRORED at evaluation until migration 149 created the shim over `current_setting('request.jwt.claims', true)` (the same idiom the working `kd_update_profile` uses). This was masked because most tables have RLS OFF and admin writes go through FastAPI as `kd_app`; it only bit `km_index_constituents` (the rare RLS-ON table with an `is_admin()` write policy). See migrations 148/149 below.** Prior detail — migration 142 (`km_migration_142_index_constituents_grants.sql`) — **CONFIRMED FIX** for Sector Rotation → index detail Constituents + Flow Map tabs showing "Unable to load flow data"/empty for regular users while admin saw them fine. Root cause: `km_index_constituents` was created in migration 022 with RLS + a permissive read policy (`USING (true)`) but ZERO table-level GRANTs; the historical blanket grant script that gave `authenticated` SELECT on every other data table MISSED this one table. Logged-in browser users run PostgREST as DB role `authenticated` (verified from a live user JWT: `role` claim = `authenticated` for a profile-role=`user` account — the running `kd_auth_login` issues `authenticated`, the migration-003 behavior, NOT the profile role), so `authenticated` hit permission-denied while admin worked via broader/owner privileges. RLS was NOT the cause (`SET ROLE authenticated; SELECT count(*)` returns all rows). Migration 142 grants SELECT to `authenticated`/anon/kd_app/admin/kd_readonly + `NOTIFY pgrst`; the decisive line is the `authenticated` grant. migration 149 is `km_migration_149_auth_schema_shim.sql` — creates `auth.uid()/role()/email()/jwt()` over `request.jwt.claims` so `is_admin()` (and every `auth.*` policy) resolves on self-hosted PostgREST instead of erroring (see the ⚠ note at the top of this entry); migration 148 is `km_migration_148_index_constituents_write_grants.sql` — grants INSERT/UPDATE/DELETE on `km_index_constituents` + USAGE on its id sequence to `authenticated`/`admin`/`kd_app` (RLS `idx_const_write USING is_admin()` stays the real admin-only gate) so admin custom-index saves work; needed because migration 144 moved admins onto the `authenticated` DB role which only had SELECT (migration 142). migrations 145–147 are breadth_movers / transit_event_fields / scan_results_matview. **CORRECTION (2026-07-14):** an earlier version of this note claimed migrations 143/144 were "throwaway…DELETED" on a wrong `user`-role theory — that is FALSE. 143 (`km_migration_143_profile_self_update.sql` — the `kd_update_profile` SECURITY DEFINER RPC used by `updateProfile`) and 144 (`km_migration_144_restore_authenticated_role.sql` — reverts `kd_auth_login` to issue JWT role `authenticated` for everyone, since PostgREST's authenticator isn't a member of `user`/`admin`, and switches `idx_const_write` from a JWT-role check to `is_admin()`) are both LIVE and load-bearing. Migration 144 is exactly why direct-PostgREST admin constituent writes broke: before it, admins ran as the DB role `admin` (full grants); after it they run as `authenticated`. migration 141 is `km_migration_141_profile_mode.sql` — `km_profiles.mode TEXT` (dark/light/system, default 'dark'): makes color-mode preference follow a user across devices the same way `theme` already does via migration 091 — `updateProfile({ mode })` on change in ThemeSettings, re-applied via `applyProfileTheme()` in authStore on login/session restore; supersedes the never-wired `dark_mode BOOLEAN` column from migration 091, left in place unused; migration 140 is `km_migration_140_users_admin.sql` — Users admin: `km_profiles.is_suspended` + `kd_auth_login` rejects suspended accounts at next login + `km_admin_audit` action log; feeds the admin-only /users page (list, suspend, plan reassign, subscription extend, physical delete via `/api/admin/users/*` FastAPI endpoints with server-side role check); migration 139 is `km_migration_139_confidence_benchmarks.sql` — `km_rule_confidence_bench`: per-benchmark rule validation, PK (rule_id, benchmark_index_id); windows stay universal, `score_benchmark_confidence()` in confidence_scoring.py measures each window on each index's closes (≥250 bars, curated included) vs the active-inference hypothesis; runs nightly 19:00, on Compute Confidence, and per-rule on inference save/delete; read by the chart tooltip (viewed index's row, NIFTY 50 fallback) and /rules/:id BenchConfidenceStrip; migration 138 is `km_migration_138_confidence_hypothesis.sql` — km_rule_confidence gains `hypothesis_source` ('inference'|'base_bias') + `hypothesis_impact`: records WHICH hypothesis the matched/confidence numbers were tested against; stamped by `rescore_rules()` in confidence_scoring.py, which re-derives `matched` from stored returns × the current hypothesis on inference save, inference delete, nightly 19:00 scoring, and manual Compute Confidence; migration 137 is `km_migration_137_patterns_grants_profile_roles.sql` — grants km_rule_patterns/km_rule_inference to profile roles admin/user, the JWT roles PostgREST actually runs as; migration 136 is `km_migration_136_inference_versioning.sql` — km_rule_inference versioning: one ACTIVE hypothesis per (rule_a, rule_b) scope, auto-supersede on save with frozen validation snapshot; migration 135 widens `km_rule_inference` to the full /inference capture shape: 12-value market_impact vocabulary, expert `confidence` 1-10, `applicability_scope`/`applicability` JSONB, `notes`; migration 134 created the table, 133 restricts Catalog visibility to Mercury/Mars/Saturn/Jupiter/Bayer/MajorTransit-tagged rules)

**Extended table inventory** (breadth/astro/rule/risk/scan/rolling-metric tables, inactive & missing indices): `docs/claude/db-tables.md`

### Deprecated Tables — DO NOT USE

| Table | Rows | Why Deprecated |
|---|---|---|
| `km_index_master` | 13 | Redundant subset of `km_index_symbols` (93). Only has 13 indices with yahoo tickers. |
| `km_index_composition` | 89 | FK references `km_index_master`. All `sector` and `weight_pct` are NULL. Useless data. |

**Use instead**: `km_index_symbols` for index master, `km_equity_symbols.index_names[]` for index→equity mapping.
Frontend `masterData.ts` still references these legacy tables — to be migrated.

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
- **Theme**: 3 themes in `src/config/theme/themes/`, user-switchable (Settings), server-persisted (`km_profiles.theme/mode`). **DARK-LOCKED FOR LAUNCH** — `LIGHT_MODE_ENABLED = false` in `src/stores/themeStore.ts` + a mirrored flag in `index.html` (sync pair; flip both to re-enable light). Light mode is fully built + owner-calibrated but not release-cleared.
- **Theme/Glass-UX — READ BEFORE ANY THEME/UX WORK**: `kaaladristi/docs/claude/glass-ux-status.md` (canonical rules: settled header decisions, bug classes + gates, light composition rules) and `kaaladristi/docs/claude/theme-session-2026-07-12.md` (2026-07-12 session record: why light took 5 sessions, owner calibration picks, the dark-lock rationale, the two sanctioned paths for finishing light — do NOT resume light as another calibration loop). `npm run check:theme` gates (phantom vars, dark fills, literal ratchet) run inside `npm run build`. QA screenshot harness: `scripts/qa/`.
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
6d2. `compute_custom_index_eod(trade_date)` RPC (migration 119) — synthesises `km_index_eod` rows for `category='custom'` (user-built sector-basket) indices from their constituents so Sector Rotation 5D/22D/66D always populate. Runs after 6d so the newest bar keeps a value.
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

**Confluence shapes (CorrelationDrawer)**: `docs/claude/vani-status.md` — ZONE_CONFLUENCE tested; EVENT_OVERLAP / EVENT_IN_STATE / THRESHOLD_CROSS untested.

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
Next migration number: **151**.

**Target database**: most migrations target `kaala_dristi_db`. Migrations that target `vani_db` must say so explicitly in the file header (example: migration 092).

---

## Framework System
The user-configurable layer — blocks, widgets, scanners, astro overlays on the Workspace canvas (`/workspace`, 12×10 grid, dnd-kit, Zustand `frameworkStore`, `user_frameworks` table, migration 088, JWT API `GET/POST/PUT /api/framework/{user_id}`).

**Full reference** (key files, templates, onboarding, canvas, DB schema): `docs/claude/framework-catalog.md`

Three rules that apply to EVERY frontend edit:

### Constants-First Rule
**Never define block/placement/tier/data-source types inline.** Always import from `src/constants/frameworkConstants.ts` (e.g. `PLACEMENT_TYPES`), items from `src/constants/catalogItems.ts`.

### Active State Rule
**`isBlockActive(catalogItemId)` / `isOverlayActive(catalogItemId)` from `useFrameworkStore` are the single source of truth** for whether an item is in the framework. Never derive from `blocks[]` / `chart_overlays[]`.

### Legacy Column Aliases — Never Use in New Code
`km_index_eod` legacy duplicates → canonical: `magicrs_value`→`magic_rs`, `magicma_value`→`magic_ma`, `sniper_banker`→`sniper_inst`, `sniper_hotmoney`→`sniper_hot`, `accum_dist`→`accum_distrib`, `vacuum_status`→`vacuum_flag`, `flow_meaning`→`flow_type`.

## Catalog System
`/catalog` → `CatalogPage.tsx` — 5 tabs (Master Frameworks / Astro Rules / Indicators / Widgets / Scanners) + `DeepDivePanel` (fixed, z-300) + `CatalogActionIsland` + `CatalogDrawer` (Workspace-launched, z-200).

**Full reference** (section components, data sources, shared React Query keys, DeepDive modes, widgets): `docs/claude/framework-catalog.md`

Must-know conventions:
- Astro rules are NOT in `catalogItems.ts` — synthetic ID `astro_rule:${rule.rule_code}` (full compound ID is the store lookup key).
- Range rule types (`RANGE_RULE_TYPES` in `frameworkConstants.ts`) → `chart_overlay`/`astro_zone`; point types (`POINT_RULE_TYPES`) → `panel_block`.
- **`compound` routing is explicit**: only `PNK*` codes get overlay treatment — never make that check generic.
- Catalog + Rules pages share React Query keys `['rule-engine','rules']` / `['rule-engine','confidence']` (`src/pages/RuleEngine/ruleService.ts`).

## Rules Engine
```
km_astro_rule_master → scripts/rule_discovery.py → km_rule_signals → km_rule_confidence
```
Discovery reads `is_active=TRUE AND data_source='available'` rules; each `rule_type` has a typed discovery function driven by `conditions` JSONB. Uses `KD_DB_PASSWORD` env (host hardcoded). UI: `/rules` + `/rules/:id` (`src/pages/RuleEngine/`).

**Full reference** (rule-type→function table, Risk Engine prototype, Bayer rules status, Astro Market-Book 2026 scoring + endpoints): `docs/claude/rules-engine.md`

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

**The pipeline emits 6 bands** (migration 069, `magic_rs − magic_ma`), ordered
bullish→bearish. Plain `Neutral` is a legacy value kept in the DB CHECK
constraint but **no longer written**. On a typical day `Neutral Bull` +
`Neutral Bear` are ~47% of the universe — any consumer that only knows the 5-band
scheme (Strong/Mild Bull, Neutral, Mild/Strong Bear) blanks nearly half the
market. **Every zone consumer must know all 7 keys** (the canonical
`ZONE_LABELS` in `signalScale.ts` already does; `scanEngine.ts VALID_ZONES` was
fixed 2026-07-13).

| DB value | Display label (`signalScale.ts`) | Color class |
|---|---|---|
| `Strong Bull` | Leading | `text-risk-green` |
| `Mild Bull` | Improving | `text-risk-green/70` |
| `Neutral Bull` | Neutral | `text-risk-green/40` |
| `Neutral` *(legacy, not emitted)* | Neutral | `text-muted` |
| `Neutral Bear` | Neutral | `text-risk-red/40` |
| `Mild Bear` | Weakening | `text-risk-red/70` |
| `Strong Bear` | Lagging | `text-risk-red` |

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
`km_industry_eod` (migration 033, PK trade_date+industry, ≥5 stocks, dedup via `v_equity_eod_deduped` preferring NSE) — wired into daily pipeline. Dashboard 3-column panel (Rotating In / Leading / Rotating Out, lookback 5d). Vocabulary: `sniper_inst`→"Smart Money", SBD→"Accumulation Signature", SVD→"Volume Drive", SYD→"Distribution Signal".

**Full reference** (columns, pipeline order, panel logic): `docs/claude/industry-rotation.md`

## Critical Lessons (Patterns That Burned Us)


These are in `LESSONS_LEARNED.md` in full; summary for quick reference:

- **Threshold calibration**: always check actual data distribution before setting numeric thresholds. `sniper_inst` ranges 0–40 (not 0–100). Run `SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY col) FROM table` first.
- **Silent NULL columns**: a column can exist with no error but be NULL for all rows. Any RPC that silently returns 0 rows (no exception) is a landmine. Verify both index AND equity tables.
- **BSE numeric symbols**: 82% of equity universe has numeric scrip codes. Always use `displaySymbol(stock)` from `lib/symbolUtils.ts` for UI. Filter numeric codes out of TradingView exports.
- **Scan filter polarity**: inequality direction is critical. `close < w52Low * 1.25` means "not extended from lows". If you invert it, you exclude healthy stocks and get zero results.
- **PostgREST boolean filters**: use `is.true` / `is.false` (not `eq.true`). The QueryBuilder has an `is()` method for this.
- **PostgREST grants — JWT role is the PROFILE role, not 'authenticated'**: migration 096 patched `kd_auth_login` to embed the km_profiles role (`admin`/`user`) as the JWT role claim, so PostgREST runs logged-in browser queries as DB role `admin`/`user`. A new table granted only to `authenticated, anon, kd_app` is readable ANONYMOUSLY but permission-denied for logged-in users (hit on `km_rule_patterns`, 2026-07-07 — fixed in migration 137). Every new PostgREST-read table must grant to `admin, "user"` as well.
- **The live `kd_auth_login` issues JWT `role`=`authenticated` for everyone** (found 2026-07-09 by decoding a live user token: `role`=`authenticated` for a profile-role=`user` account). Despite migrations 096/140 in the repo (which would embed the profile role `admin`/`user`), the RUNNING function is the migration-003 behavior — so in practice logged-in browser users are the `authenticated` DB role, NOT `user`/`admin`. Consequence: the "grant new PostgREST-read tables to `admin`/`user`" advice above describes intended-but-not-live behavior; what actually matters on this deployment is that **`authenticated` has SELECT**. There is no `user` DB role (`has_table_privilege('user',…)` errors) and the app does not need one. Verify the live `kd_auth_login` before trusting the profile-role-as-DB-role model.
- **Diagnostic hygiene — don't read grant/permission state AFTER applying a candidate fix and then conclude from it.** The 2026-07-09 Constituents/Flow Map bug was fixed correctly on the first try (migration 142: `km_index_constituents` was missing its `authenticated` SELECT grant — migration 022 shipped RLS + policies but zero table GRANTs, and the blanket grant script missed this one table). It was then MIS-re-diagnosed for several rounds because the grant dumps analyzed were taken after 142 had already added `authenticated`, making it look like `authenticated` always had access — spawning throwaway "missing `user` role" migrations 143/144 (since deleted). Snapshot the broken state first, or reason from the fix that worked.
- **RLS on pipeline-computed tables**: don't add RLS to aggregate tables (`km_industry_eod`, etc.) — they contain no user data and RLS creates silent access bugs when `kd_app` role differs from `authenticated`.
- **`auth.*` is Supabase-only — this deployment shimmed it in migration 149 (2026-07-14)**: RLS policies and `public.is_admin()` call `auth.uid()`/`auth.role()`/`auth.jwt()`, which exist on Supabase but NOT on self-hosted PostgREST. For a long time no migration DEFINED them (8 referenced, 0 defined), so every `auth.*`-based policy *errored at evaluation* — hidden because most tables have RLS OFF and admin writes go via FastAPI (`kd_app`). It surfaced as "permission denied"→then a silent `is_admin()` error on `km_index_constituents` (the one RLS-ON table with an `is_admin()` write policy) when custom-index saves (direct PostgREST) broke. Migration 149 defines `auth.uid/role/email/jwt` over `current_setting('request.jwt.claims', true)` — the same idiom `kd_update_profile` uses. If you add a new RLS policy, `auth.uid()`/`is_admin()` now work; if `is_admin()` ever "does nothing," first check the `auth` schema still exists. Also: two DB roles matter — logged-in users are `authenticated` (migration 144 reverted `kd_auth_login` to issue that for everyone, admins included), so any RLS-ON table needing admin writes must grant the verb to `authenticated` AND rely on `is_admin()` for authorization (e.g. migration 148).
- **Coverage metrics**: `coverage_pct NUMERIC(5,2)` overflows on multi-date RPC results. Use `NUMERIC(7,2)` and cap at 999.99 in Python.
- **KaalaDristi voice is observational**: "Strength Confluence" not "Power Buy". Surface conditions, don't issue trade commands.
- **D39 — ROC badge language (SEBI)**: ROC badge states use neutral participation vocabulary — `expanding / slowing / turning / contracting / warming_up`. Never use bull/bear/uptrend/downtrend in any badge, label, or tooltip. `ROC_BADGE_MAP` in `BreadthRocChart.tsx` is the single source of truth.
- **D40 — Breadth formula uses ema_20 + sma_50 + sma_150**: `fetchIndexBreadth` uses `ema_20` (true EMA) for p20, and `sma_50`/`sma_150` (SMAs) for p50/p150. This is a conscious deviation from Breadth_ROC_Spec_v1.0 §2 which specifies EMA50/EMA150 — those columns don't exist in `km_equity_eod`. Adding them is deferred; the signal quality difference at these window lengths is minimal.
- **D41 — custom index synthetic EOD + index returns are now wired into the PRODUCTION daily run** (migration 119): the production scheduler is **pipeline2** (`daily_run` job at 18:00 IST → `orchestrator.DAILY_STEPS`), which calls the legacy `run_nse_pipeline` with `skip_indicators=True` — so legacy compute steps (including 6d/6d2) NEVER run in production. The real fix is the pipeline2 dimension **`index_returns`** (`handlers.handle_index_returns`), which runs `compute_all_index_returns` → `compute_custom_index_eod(from,to)` (RPC, migration 119) → `compute_all_index_scores` in that order, so Sector Rotation 5D/22D/66D + scores populate for ALL indices (standard and `category='custom'`) every run. Legacy steps 6d/6d2 remain for CLI/backfill use only. `scripts/compute_custom_index_eod.py` now calls the same RPC (full history, or a fast `--from YYYY-MM-DD [--to YYYY-MM-DD]` range) and remains the backfill to run when a new custom index is created (it also refreshes scores via `compute_all_index_scores()`). Still open: the pipeline step computes equal-weight `close/ret_5d/22d/66d` only — `rsi_14` and `flow_type` require Step 0d/0e extension (B78), so the signal badge in SectorRotationTable stays blank for custom indices until B78 is resolved.
- **D42 — Custom Index Discover (Path 2) architecture**: Admin types a theme name → Sonnet scans liquid active NSE stocks → identifies matching companies using training knowledge → suggests sector lord + zodiac sign from `km_sector_lords`/`km_sector_zodiac` → admin reviews, edits, saves. Qwen3 is not suitable for this task (insufficient knowledge of Indian mid/small caps). Claude Sonnet is the only viable LLM for Path 2. Backend endpoint at `POST /api/custom-index/discover` deployed; architecture rework (B76) needed before production use. Discovered themes persist in staging table `km_discovered_themes` (migration 120, status `new`→`used`/`dismissed`); DiscoverPage loads `status='new'` rows on mount via `GET /api/custom-index/themes`, updates via `PATCH /api/custom-index/themes/{id}` — no LLM re-invoke needed to revisit past recommendations. Universe = active NSE + **BSE-only additions** (ISIN has no active NSE listing, ≥ ₹1 Cr daily turnover — 167 of 2,900 qualified at calibration 2026-07-05); `delivery_surge_x` never fires for BSE (no delivery data), so BSE scores out of 4 signals. `CustomIndexCreatePage` mirrors the same NSE-priority ISIN dedup and renders BSE scrips via `displaySymbol()` + BSE badge (universe fetch shared via `services/equityUniverse.ts`). Discover passes existing custom-index names + all staged theme names to the LLM as exclusions (no token waste re-proposing known themes). `CustomIndexManagePage` (`/custom-index/:id/manage`, ✎ Manage button on list page) edits an existing index: manual add/remove of constituents (direct PostgREST on `km_index_constituents`) + `POST /api/custom-index/{id}/suggest` for AI new-stock suggestions scoped to that theme (constituents excluded from the universe SQL). `CustomIndexManagePage` and the list page both have an **⚡ Calculate** button → `POST /api/custom-index/{id}/compute` (migration 122 adds `p_index_id` scoping to `compute_custom_index_eod`): recomputes this index's full synthetic EOD history + refreshes all index scores on demand, so a newly created/edited custom index reflects in Sector Rotation immediately instead of waiting for the next daily pipeline run. Migration 123 extends the synthesis with `pct_chng` (AVG of constituents — heatmap micro-trend bars, %Chg column) and `value_cr` (SUM — heat tooltip traded value); without it curated rows render flat micro-trends and "—" %Chg. **Targeted discovery** (`POST /api/custom-index/target`, migration 121): admin types a theme name → LLM classifies the FULL liquid universe (no signal gate — `_fetch_liquid_universe`) into **core** (direct revenue exposure) vs **ecosystem** (suppliers/enablers); persisted with `source='targeted'` + `detail` JSONB; DiscoverPage renders the core/eco split with a 🎯 badge. The original `/discover` flow remains signal-first (clusters only currently-signaling stocks; no core/eco distinction).
- **D43 — `km_sector_zodiac` table added in migration 118**: Maps sectors to zodiac signs (many-to-many). Columns: `id SERIAL PK`, `sector_id FK → km_sectors`, `zodiac_id FK → km_zodiac_signs`, `UNIQUE(sector_id, zodiac_id)`. 51 mappings seeded. Used for astro tagging of custom indices in Path 2 discovery.
- **No-fallback note — constituent warm-up exclusion**: `fetchIndexBreadth` excludes constituents with `ema_20/sma_50/sma_150 = 0 or null` from each ratio's denominator. This is hygiene (new listings without sufficient price history), not a fallback — the denominator is the count of stocks with valid data, not total stock count.
- **PostgreSQL `CREATE OR REPLACE VIEW` ordinal rule**: new columns must be appended to the end of the SELECT list. Inserting in the middle shifts all subsequent columns and causes a `cannot change name of view column` error (hit in migration 117).

---

## Known Issues

### 📋 FOR REVIEW (owner) — Data depth: enriched signals only ~1.5–2 yr deep
`DATA_DEPTH_AUDIT.md` (2026-07-12, read-only MCP audit). Raw **prices** are complete
~26 yr both exchanges (NSE 1996→, BSE 2000→), but the **enriched layer is shallow**:
`delivery_pct` exists only ~2025+ for NSE and ~2024+ for BSE (BSE backfill in
progress); `ema_20` is null before ~2025 on **both** exchanges (added late, computed
forward only) — and since scanners drop `ema_20 IS NULL` rows, that single column caps
scanner history. `delivery_surge_x`/score are 0 for BSE until the rolling-metrics
recompute runs. **Decision flagged:** a full 26-yr BSE delivery backfill is low-value
in isolation (NSE delivery is only ~1.5 yr; `ema_20` only ~2025+) — the 2-yr BSE
backfill matches current depth and reaches NSE parity. True "deep history" is a
separate post-launch initiative (ema_20 + NSE delivery + BSE delivery to the same
depth + rolling recompute). Owner to decide target enriched-history depth. Details +
per-year coverage tables in the audit doc.

### 📋 FOR REVIEW (owner) — Industry Rotation spec (ranking basis + peer RS)
`industryrotation.md` (repo root, 2026-07-14) — implementation-review spec for `/industry-transition`. Documents that `industry_rank` is ranked **purely by `avg_magic_rs`** (single line in `compute_all_industry_composites`; all other aggregate columns are display-only), that this behaves like a ~22-day/structural clock and diverges from the house **5D/22D** language by 80–150 rank positions (live evidence table included), and the resulting UX inconsistency vs Sector Rotation (return-momentum clock). Proposes: add `avg_ret_5d/avg_ret_22d` to `km_industry_eod`, lead ranking with a return clock (keep Magic RS as a cross-check/sort), and a layered benchmark model. **Owner decision captured: peer-relative Magic RS will be a selectable benchmark on BOTH single-stock and index views** (default NIFTY 500) — `compute_magic_rs_batch` already supports equity-vs-index and index-vs-index; blocker is a curated `industry → sector-index` mapping table (`index_names[]` is too sparse). Phased plan + open questions in the doc. Charan to review before build.

### 📋 FOR REVIEW (owner) — Pulse/Study UX rework
`kaaladristi/docs/PulseUX.md` documents the equity **Study** page rework into a decision-first workbench (Read → Snapshot → Evidence → Chart), the two-layer Pulse/Study contract, every widget, and a before/after. Charan to review. Open/deferred items are listed there (Conviction latest-bar pipeline fix, selectable Magic RS benchmark, Conviction scrubber-awareness, Big Money threshold calibration, Correlation-for-indexes, Pulse-mode retirement).

### 📋 FOR REVIEW (owner) — Astro-Technical Alignment hidden on Market Structure
The **Astro-Technical Alignment** card (`MarketWeatherCard`) was **hidden** from the Market Structure page's *Today's Structure* tab (`views/MarketStructureView.tsx` → `TodayStructureTab`) at the owner's request (2026-07-09), pending a rework of the astro × breadth "confluence" UX. The proposed astro-confluence layer (breadth regime × astro window → historical positive-day frequency, + a forward 6-day strip) is designed but **not built** — it lands as Layer 4 of the Market Breadth page (mock reviewed). The **Historical Confluence** tab is untouched and keeps the existing breadth × ROC × nak-vara content. The component still renders on `/dashboard`; only the Market Structure usage was removed. Re-enable by restoring `<MarketWeatherCard date={date} />` in `TodayStructureTab`.

### 📋 FOR REVIEW (owner) — RS-Rotation scanner spec
`docs/claude/Rsspec.md` specs a **Relative-Strength Rotation scanner** (RRG-style: Magic RS × its momentum → Leading / Weakening / Lagging / Improving quadrants). Positions it as the leading-indicator complement to Stage 2 Leaders — it adds the **Improving** (early relative turn) and **Weakening** (relative fade) quadrants that none of the current 9 scanners surface — with SEBI-safe presets (`Rotating Into Strength`, `Leadership Fading`), a multi-timeframe "aligned rotation" confluence (Magic RS is native on daily `km_equity_eod` / weekly 075 / monthly 076), the one new data need (`magic_rs_roc`), and the 4-step scanner integration. **Not built** — Charan to review the open questions at the end. The RS-Rotation *chart* (daily, single stock) IS built and live: `components/domain/RotationGraph.tsx`, wired into `views/ChartView.tsx` under the Magic RS pills (`/chart/equity/:id`, daily; layout provisional, to realign).

### ⏳ PENDING (owner) — Sector Rotation Overview synthesis strip: astro window segment
The Overview-tab synthesis strip (`IndexDetailPage.tsx` → `SynthesisStrip`) composes an auto line — "Money flowing into X/Y stocks · Breadth reads {Greed/Neutral/Fear} (score) · Momentum {expanding/contracting}". The spec's fourth segment — "Astro window [label]" — is **intentionally hidden** because the Overview tab has no astro data source wired in. Owner (Charan) to decide the source (DC inference / astro calendar for the trade date) before it's added. Re-enable by extending `SynthesisStrip` once a source exists.

### ⚠ VaNi Correlation Cache + Delete Flow (CorrelationPage) — BROKEN, needs fresh debug session
Admin "clear cache" DELETE + removeQueries doesn't evict — next "Ask VaNi" returns cached response with no LLM call. Suspected: React Query observer not destroyed / backend `_corr_insight_cache` key mismatch. Full trace notes + cache design: `docs/claude/known-issues.md`.

### Volume Scale Discontinuity (km_index_eod)
NIFTY 50 volume jumps ~500K→~400M/day at 2026-03-25 → false LOW_VOLUME/VACUUM signals pre-discontinuity. Guard applied (migration 031); root cause unknown. Detail: `docs/claude/known-issues.md`.

## Git Convention


- Feature branches: `claude/<feature>-<id>`
- Develop on the assigned branch, push when done
- PR into `main`

---

## Visual Pulse — UX Challenge Spec
Metaphor-driven index/equity dashboards (`/pulse/:indexId`, `/pulse/equity/:equityId`) — every indicator maps to a real-world visual metaphor; 4-5 s go/no-go glance. VP-1 (RSI Signal Tower) must iterate until right before VP-2+.

**Full spec** (metaphor table, milestones VP-1→VP-10): `docs/claude/visual-pulse.md` + `docs/visual-pulse-spec.md`

## VaNi Morning Brief — Implementation Status (June 2026)
`POST /api/vani/daily` — panchang card first, max 3 cards, per-item LLM calls, in-memory `_vani_cache` (24h TTL — final design). Detail: `docs/claude/vani-status.md`

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

## Parked — Pending Review
Parked items (scanConvictionFlow/scanBreakoutSurge VaNi rule migration, BAY-R14 publishing checklist), deferred UX/story-telling sprint tables, Unified Rule Architecture direction (do not build yet), and the pending SEBI astro-label review (**no directional language in badges/labels — see D39**): `docs/claude/backlog-deferred.md`

## Scanner Data Gaps — Future Work
Coverage gaps for `mcap_cr` (BSE ~12%), `ret_*`/`rel_*`/`avg_amt_*` per-scanner population status, materialized-view plan (Option C post-beta), breakout event detection (B55): `docs/claude/scanner-data-gaps.md`
