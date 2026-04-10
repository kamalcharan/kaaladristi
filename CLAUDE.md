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

Latest migration: **021** (`km_migration_021_breadth_roc.sql`)

| Table | Description |
|---|---|
| `km_market_breadth` | EMA-based breadth score (migration 020) |
| `km_breadth_roc` | ROC momentum breadth oscillator (migration 021) |

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
- **Routes/Views**: Dashboard, Markets, Chart, DC Calendar, Inference, Rule Eval, Settings
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
Next migration number: **022**.

---

## Git Convention

- Feature branches: `claude/<feature>-<id>`
- Develop on the assigned branch, push when done
- PR into `main`
