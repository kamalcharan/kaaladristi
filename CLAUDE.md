# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Kāla-Drishti — Claude Code Context

Market analysis and forecasting platform combining NSE/BSE market data with planetary/astronomical intelligence.

---

## Settled Decisions — DO NOT RE-OPEN

Owner decisions that are final. Do not re-litigate these, do not present them as
open questions, do not ask the owner to choose again. Implement against them.

### Universe: FULL NSE + BSE COVERAGE

The target universe is **every listed equity on both exchanges** — not index
members, not a curated liquid subset. Any gap between that and what's in
`km_equity_symbols` is a **bug to fix**, never a design choice to confirm.

This has been restated by the owner many times and keeps resurfacing because
nothing recorded it. It is recorded here now.

**✅ LARGELY MET as of 2026-09-23 — the block below is the 2026-08-03 audit and
its numbers are STALE. Re-measured on the 2026-09-22 bar: `km_equity_symbols`
holds **3,839 NSE** rows (all active) and **3,392 get bars on the day**, against
the 1,445 / 1,334 recorded below. The NSE side of this decision has been
delivered — the ~2,100 figure it calls the real universe has been passed.**
**Do not spend a session "fixing" the root cause described below without
re-measuring first.** The DECISION is unchanged and still not open for
discussion; what changed is that the gap it describes is largely closed. Still
worth confirming separately: BSE coverage, and whether the newly-admitted
symbols got their history backfilled and breadth rebuilt (the two things this
decision says it implies).

**Prior state (audited 2026-08-03) — superseded, kept for the root-cause trail:**

- `km_equity_symbols` holds **1,445 NSE** rows; only **1,334** get bars on a
  given day. The real NSE listed universe is ~2,100+.
- Root cause: the NSE master was seeded from **index membership**, not the
  listed universe — `seed_equity_metadata.py` sources from NSE *index* APIs
  (NIFTY TOTAL MARKET 750 → NIFTY 500 → sectorals). The only INSERT path is the
  one-time `DBscripts/seed_index_equity.py`. A stock in no index was never
  eligible to enter the master, and **no ongoing path adds one**.
- `pipeline/processors/symbol_matcher.py:52-54` silently drops every bhavcopy
  symbol not already in the master — the master *is* the universe filter
  (`parser.py:100`). Daily: **3,440 parsed → 1,334 inserted → 2,104 dropped.**
- Consequence: smallcaps that aren't index members can never appear in any
  scanner. This is why big movers "don't come into DristiQ".

**Implied by this decision (do not re-ask):** admit all equity series, backfill
history for newly-registered symbols, and rebuild breadth history afterwards
(universe size moves every breadth denominator — see D44).

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
python test_vani_routing.py     # VaNi wire test: which backend, what prompt
```

### VaNi / research companion suites (`unittest`, no DB, no LLM)

```bash
cd App/backend
python -m unittest test_sector_vani test_market_structure_vani \
  test_sector_leadership test_leadership_intents test_leadership_pipeline \
  test_scanner_explanation test_sector_flow_intents test_fpb_actions \
  test_highlight_story test_custom_index_rebuild test_pipeline_cascade
# 98 tests — last green 2026-09-14
python -m unittest test_dimension_watermarks   # +22, migration 210
python -m unittest test_journey_fields         # +20, migration 211 (needs numpy/pandas)
```

These run on synthetic fixtures: no PostgreSQL, no model call, no network.
`test_vani_routing.py` is the exception — it stands up a stub
OpenAI-compatible server and asserts **on the wire**.

### Frontend QA harness (`scripts/qa/`, headless Chromium)

```bash
cd App/frontend
PYTHON=python3 node scripts/qa/check-sector-contracts.mjs   # needs Python (scan_contract)
node scripts/qa/check-market-structure.mjs
node scripts/qa/check-scanner-vani.mjs
node scripts/qa/check-scanner-introductions.mjs
node scripts/qa/check-scanner-authority.mjs      # 40 DB-authority cases
node scripts/qa/check-fpb-actions.mjs
node scripts/qa/check-sector-ui.mjs              # needs Vite on loopback :4318
node scripts/qa/check-vani-panel.mjs             # companion open/closed; needs Vite on :5174
node scripts/qa/check-scrollbars.mjs            # scrollbar contrast, 2 themes x 2 modes
node scripts/qa/check-page-overflow.mjs         # 33 routes x 390/1280px; needs Vite on :5173
```

⚠ **Only `check-theme-standard.mjs` and `check-persona.mjs` run inside
`npm run build`.** Everything else in `scripts/qa/` is manual — a green build
proves nothing about them. `check-sector-ui.mjs` renders the real route
components against synthetic responses at 320/390/768/1440 px in light and dark
with all external requests blocked; set `SECTOR_QA_BROWSER` for a non-default
Chromium and `SECTOR_QA_OUTPUT` to keep its screenshots.

### One-shot backfill scripts
```bash
cd App/backend/scripts
KD_DB_PASSWORD=... python rule_discovery.py             # all history
KD_DB_PASSWORD=... python rule_discovery.py 2026        # single year
KD_DB_PASSWORD=... python backfill_d365.py              # d365_pct_chng
KD_DB_PASSWORD=... python backfill_supertrend.py        # supertrend_dir
python scripts/backtest_rs_percentile.py               # READ-ONLY study, writes nothing
```

---

## Architecture


```
kaaladristi/
├── App/
│   ├── backend/           # Python — data pipeline + FastAPI sidecar
│   │   ├── lib/           # Shared: db_client, breeze_client, config, sync_logger, ai_client, ai_prompts, auth, pg_client, data_assemblers, vani_assemblers, vani_intents, vani_cache, health_checks
│   │   │                  #   research companions: market_structure_vani, sector_vani, sector_flow_intents,
│   │   │                  #   sector_leadership, sector_leadership_intents, scanner_explanation
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
│   │       ├── components/  # UI + domain components (domain/VaNi/ = research companions)
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
| `km_vani_cache` | Persistent VaNi answer cache (migration 038) — key includes intent id + version + depth + period + snapshot hash |
| `km_sector_leadership_snapshots` | Published longer-term leadership payloads (migration 208); PK `trade_date+category+months`, `months IN (3,6,12)` |
| `km_leadership_generation` | Single-row generation counter (migration 208); bumped by membership/catalog triggers to invalidate every snapshot |
| `km_leadership_observations` | Previous published leadership payloads, keyed by snapshot id (migration 207) |
| `km_custom_index_revisions` | Per-custom-index `revision` vs `computed_revision` (migration 207) — detects a stale calculation |
| `km_custom_index_membership_log` | Append-only add/remove log for custom indices, seeded with a `baseline` row (migration 207) |
| `km_custom_index_history_archive` | Archived synthetic bars per custom-index revision (migration 207) |

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
- **Theme/Glass-UX — READ BEFORE ANY THEME/UX WORK**: `kaaladristi/docs/claude/glass-ux-status.md` (canonical rules: settled header decisions, bug classes + gates, light composition rules) and `kaaladristi/docs/claude/theme-session-2026-07-12.md` (2026-07-12 session record: why light took 5 sessions, owner calibration picks, the dark-lock rationale, the two sanctioned paths for finishing light — do NOT resume light as another calibration loop). `npm run check:theme` gates (phantom vars, dark fills, literal ratchet) run inside `npm run build`. QA screenshot harness: `scripts/qa/` (`qa-screenshots.mjs` desktop, `qa-mobile.mjs` 390px phone pass, `qa-overflow.mjs`, `qa-diff.mjs`). The harness seeds a JWT-shaped auth token with a far-future `exp` — `services/auth.ts tokenExpired()` treats any unparseable token as expired and bounces to the landing page, which is why an opaque placeholder token silently captured the login screen for every route (fixed 2026-09-06).
- **Onboarding (2026-09-07, agentic IX — plan + status: `docs/claude/onboarding-poa.md`)**: `/setup` is a six-step persona flow (What is VaNi + details → Personality → Scanners → How VaNi will guide → Plan → Look); persona vocabulary in `src/constants/personaConfig.ts` (mirrors migration 204 CHECKs, gated by `npm run check:persona`). **Derivation was simplified 2026-09-13** (`docs/icp-scanner-experience.md`): onboarding and Account now ask the same two plain-language questions — holding period and discovery preference. Holding period sets the starting persona; discovery preference covers "still exploring"; an explicit persona choice overrides both. The old weighted table is gone and exit preferences no longer classify (but still drive the breadth leg — see Critical Lessons). New workspace templates append that persona's four starter scanners below the template's other blocks; existing templates are never mutated, screens in `components/domain/Onboarding/`, `/guide` "How to use DristiQ" (Show me = real page + `?tour=1&guide=<key>`), Account → "How you invest" tab, Morning Brief `ContinuityLine`. Astro is deliberately absent from the flow.
- **VaNi companion — collapsible, one preference (2026-09-18)**: the companion
  column on Market Structure, both Sector Rotation modes, the sector detail
  page, the scanner Studios, Flower Pot and the `/workspace` docked pane
  collapses to a 52px rail, and the content column takes the freed ~300px.
  There is exactly ONE stored value (`kd_vani_panel`, `constants/vaniPanel.ts`
  + `stores/vaniPanelStore.ts`, localStorage like `kd_sidebar_collapsed`) —
  the collapse control on the panel and the **Always open / Always closed**
  switch in Account → Appearance write the same key, so a collapse is still in
  force on the next page and after a reload. Read it through
  `useVaNiPanelOpen()`, never by comparing `mode` to a string.
  ⚠ Two things are load-bearing. **The collapse control lives in `VaNiBrand`**
  (default `collapsible`, opt out with `collapsible={false}` — the mobile
  sector dialog does, it already has a Close): that is what makes it one
  implementation across six headers instead of six copies. And
  **`ScannerCompanionShell` returns null when closed**, not just hidden by
  `Layout` — the scanner companions are *portalled* into `#scanner-vani-host`
  and a shell that finds no host falls back to rendering INLINE, so hiding the
  column alone would move the panel into the results column instead of freeing
  the width. `Layout` shows the rail on every `/scanner*` path, wider than the
  24-preset `scannerDocked` regex, because `/scanner` and `/scanners/:presetId`
  mount that shell with no dock. The nav rail also stops being force-collapsed
  while the companion is closed — that forcing only existed to make room for
  it. **Closed is not off**: the rail carries three ascending bars animating in
  sequence ("chat is live") and is the one element on a collapsed page painted
  in the theme accent — a neutral rail with a static chevron reads as a layout
  control, not a companion waiting to be asked. Motion is on the bars, never on
  VaNi's face (the `.vani-consulting` rule), and `prefers-reduced-motion`
  **stops** it rather than slowing it, leaving the bars at full strength — the
  honest resting state for a live indicator. Guarded by
  `scripts/qa/check-vani-panel.mjs` (5 routes; asserts the content actually
  widens, the choice survives a reload, no 390px overflow, the indicator is
  present + animated + on `--accent`, and that reduced motion silences it),
  verified to fail against eight sabotages.
- **Routes/Views**: **Workspace (`/workspace`)**, **Guide (`/guide`)**, **Market Structure (`/market-structure`)**, **Sector Rotation (`/sector-rotation`, `/sector-rotation/:indexId`)**, Dashboard, Markets, Chart, DC Calendar, Inference, Rule Eval, Scanner (`/scan`), Settings, Visual Pulse (Index), Visual Pulse (Equity), **Intraday (`/intraday/:indexId`)**, Manipulation Watch, Industry Transition
- **Research companions**: Market Structure, Sector Rotation (Current Flow · Longer-Term Leadership), the scanner Studios and Flower Pot each carry a persistent VaNi panel — see **VaNi Research Companions**. `/sector-rotation` historical views carry `?asof=YYYY-MM-DD`; Flower Pot cohort links carry `fpb_intent`/`fpb_group`/`fpb_asof`/`exchange`.
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

### Discovery milestones reach the chart (2026-09-14)

`km_wg_journeys` stores six dated milestones; the story layer read two.
`confirm_date` — the Ascent moment, the payoff the engine exists to find — had
never been drawn anywhere, and `sleep_date` closes an arc the chart simply
stopped following. Both now emit as `discovery` events, and
`components/domain/StockCockpit/JourneyStrip.tsx` renders the arc in the Thesis
tab. Zero schema change: every value was already stored.

⚠ **Never read journeys with `is_current` alone.** `sleep_date` exists only on
an ARCHIVED row — a current journey has not slept — so that filter structurally
hides the end of every completed arc. `fetchStockJourneys` returns all of them
(capped at 12; 755 stocks hold one, 226 two, one holds 43) and
`buildStoryEvents` walks the set. PGHL's real arc — woke 2026-07-09, confirmed
07-31, slept 08-31 — fits in one chart window and was invisible before this.

**Stage transitions read `stage_since`**, not a bar-to-bar diff:
`stage_since === trade_date` is the classifier's own record. It survives gaps in
the loaded series, catches a stock that leaves a stage and returns to it, and —
because `addStageEvent` is now called for bar 0 as well — catches a transition
on the first loaded bar, which no diff can see. The diff stays as the fallback
for series carrying no `stage_since` (resampled weekly/monthly bars, indices).
The UNKNOWN suppression is unchanged.

**Base rates are read, never remembered.** `JourneyStrip`'s closing sentence
cites how often a wake goes on to confirm. Those figures were typed into the
component and would have gone stale silently — they move every night as arcs
close. They now come from `km_journey_base_rates` (migration 209). Two rules the
tests enforce: a rate always carries its **denominator** ("348 of 595"), never a
bare percentage; and with no reading the frequency clause is **dropped**, never
replaced by a remembered number — a confidently wrong base rate is worse than
none. The figures may not appear in the component's executable code at all.

**VaNi narrates the arc, not just the marker.** The fact block VaNi is given
(`buildThesisFacts` in `ThesisTab.tsx`) carried the story events and nothing
about the arc they belong to. `services/journeyFacts.ts` is now the **only**
place a journey sentence is written — `baseRateLine` moved there out of
`JourneyStrip.tsx`, because the strip's footnote and VaNi's narration are one
comparison and two phrasings of one comparison drift apart on the same screen.
The Thesis tab assembles the facts **once** and shares them across the narrate
button, the question box, and a "✦ Where is this in its journey?" chip (shown
only when there is both an arc and a nightly reading).

Two properties in that block are load-bearing, neither visible in a type:

1. **Every comparison is a WORD before the model sees it** — ABOVE / BELOW,
   UP / DOWN, "53 days after its wake". The model never receives `base_high`
   and `close` to subtract, nor a signed percentage to read the sign of. Same
   failure class as the first live autorun, which read `-0.0361` and wrote
   "the fast reading is slightly above the slow reading".
2. **The frequency is fenced.** "58.5% of 595 confirmed" is one sentence from
   "this stock has a 58.5% chance", a forecast about a specific security. The
   facts carry an explicit line saying it is not that, `_VANI_NARRATE_SYSTEM`
   forbids the restatement however the facts are worded, and
   `/api/ai/vani-narrate` now applies `_sebi_post_filter` (it had been skipping
   it). No reading → no fence sentence, because there is nothing to fence.

Guarded by `scripts/qa/check-journey-events.mjs` (manual, like the rest of
`scripts/qa/`), verified to fail against a dropped confirm/close emission, a
reverted stage diff, a hardcoded base-rate fallback, a flipped ceiling side, a
raw signed number handed to the model, and a dropped frequency fence.

### Flower Pot is derived on read — and now with warm-up (2026-09-15)

⚠ **Do NOT add `fpb_*` columns to `km_equity_eod`.** `fpbEvents()` in
`services/storyEvents.ts` already derives the whole gate — coil, burst and
shatter — from the loaded bars, and `breakawayEvents()` does the same for
`rs_breakaway`. Checked line by line against the `flower_pot_burst` matview arm,
the two **agree**: identical thresholds (0.8 / 0.08 / 0.6 / 2 / ≥60 bars / >20 /
not S3-S4) and identical windows (atr15/atr60, vol5/vol22, hi10/lo10,
`lag(magic_rs,5)`, the 22-bar prior-setup lookback, `lag(vol22,1)` and
`lag(avgrng15,1)` on release). Storing them would be a **third** implementation
of one eligibility rule, for a backfill ceiling (coil ~2022 on `magic_rs`,
release 2025 on `delivery_pct`) the derivation already has.

**The real defect: there is no warm-up on the chart's fetch.** `fpbEvents`
needs 61 bars and returns `[]` below that; `getStartDate` fetches exactly the
requested range. So Flower Pot is evaluable on **nothing at 1M** (~21 bars),
**2 of 62 bars at 3M**, 64 of 124 at 6M, 188 of 248 at 1Y. Measured on a 1-in-23
NSE sample (36 coil starts over a year), a 6M window loses **2 of its 28** coil
starts to the blind first 60 bars. None of it was visible — the chart showed no
coils and VaNi reported none.

`storyCoverage(bars)` and `blindLeadingBars(bars)` make the blind zone sayable,
and `buildThesisFacts` hands it to VaNi as an explicit **"NOT EVALUATED in this
window — do not report these as absent"** line naming the requirement *and* the
actual bar count. **A window too short to look must never read as a stock with
nothing in it.**

**The warm-up fetch is now in (2026-09-15).** `fetchEquityWarmupBars()` asks
for `STORY_WARMUP_BARS` (= `FPB.MIN_BARS`, 60) bars strictly BEFORE the display
start; `buildStoryEvents(bars, …, warmup)` derives over prefix + window, drops
every event inside the prefix and **rebases** the survivors so a returned
`barIndex` still indexes the display window. On a 3M SOLARA window the blind
head goes 60 → 0 and the non-FPB event stream is unchanged, +0 / −0.

Four properties are load-bearing — none of them is visible in a type:

1. **`rows` is never widened.** The prefix is its OWN query (`['chart-warmup',
   …]`), because `rows` drives ~25 consumers — the chart, the stat strip, the
   scrubber, the Data tab, the export, the "N days · from · to" footer — and
   widening the range hands all of them 60 bars the user did not ask for. The
   prefix is consumed by the derivation and discarded.
2. **Rebasing happens ONCE, on the finished array**, not per emitter. A dozen
   emitters index `bars`; offsetting each one means one of them is eventually
   written against the wrong origin, and every marker then lands 60 sessions
   from the bar it describes — which reads as a data bug, not an off-by-N.
3. **`warmup = 0` is a no-op.** Every pre-existing call site passes nothing.
4. **Same columns, or the warm-up is worse than none.** Both fetches go through
   `runEquityEodSelect`, so a prefix bar can never be missing a column the
   derivation reads — that would evaluate to nothing, which is the exact
   silence the warm-up exists to remove.

`storyCoverage(bars, warmup)` now reports the **remaining** gap, so a fully
warmed window disclaims nothing (a disclaimer that is always there stops being
read) while a partial warm-up still names what is left. It keeps earning its
place: MAX starts at the stock's first bar and weekly/monthly bars get no
prefix, so a blind head is still real in those paths.

Covered by `scripts/qa/check-price-action-events.mjs` §6c–6f, verified to fail
against nine sabotages including a rebase removed, a prefix event leaking
through, an undersized warm-up, a prefix fetched ascending (the stock's first
bars ever, a different decade), a merged-instead-of-additive query, and
`fpbEvents` starved of the prefix — the last of which silently returns Flower
Pot to reporting an absence it never measured.

### Stirring is a TALLY, never a run — and the schema now says so (2026-09-15)

`km_wg_journeys.stir_days` counts qualifying bars inside the **last 60
sessions**. Those bars are scattered. Measured across all **1,048 stirring
stocks** on 2026-09-14: **9.4 qualifying bars over a 41.3-bar span, only 29
(2.8%) contiguous.**

So there is no "stirring since" date, and `stir_start_date` was **refused**
rather than built — a field name implying continuity over a scattered tally is a
lie told by the schema, and careful UI copy cannot undo it. Migration 211 adds
the honest pair instead: **`stir_first_date`** (earliest qualifying bar) and
**`stir_window_bars`** (the denominator, capped at what the stock actually has —
a recent listing must not report a 60-bar window it never had). The reading is
"9 qualifying sessions since 12 June, out of 41". **Never render
`stir_first_date` alone** — that reconstructs the claim this refuses to store.

The frontend already had the bug: `JourneyStrip` rendered `` `${stir_days} days` ``
— "24 days", read as three weeks of continuous stirring. Now `24 / 41`, with the
bare count (never an invented denominator) when no window is recorded.
`journeyFacts` gives VaNi the same pair plus *"scattered bars, not a continuous
run"*, because a bare count is exactly what a model turns into a duration.

⚠ **The delivery gate is RELATIVE, so uniformly high delivery qualifies on
nothing** — the median rises with it and nothing clears `median × 1.15`. This is
the `sniper_inst` lesson inside the stirring rule. "High delivery = stirring" is
the intuitive reading and it is wrong; a test pins it.

**`turn_date` on an archived journey is a derivation, not a copy.** The
snapshot's turn is explicitly *"a property of NOW, anchored to the CURRENT
unbroken run above the Golden Line"*, which a closed arc does not have — so
`turn_at(i)` is now **one implementation with two callers**: the snapshot asks
it at the last bar, an archived arc at its **wake** bar. A wake requires
`close >= GL`, so the wake bar is always inside a run and that run holds the turn
which led into it. Asking at the *sleep* bar returns NULL for exactly the arcs
worth inspecting, because losing the Golden Line is frequently why one slept.
Before this, 560 current rows carried a turn and **0 archived rows did**.
`turn_date`/`turn_close`/`gl_dist_pct` are existing columns — they were simply
never written, so none of that needed SQL.

Guarded by `test_journey_fields.py` (20 tests) and `check-journey-events.mjs`,
verified to fail against twelve regressions.

### The six Price Action scanners are derived on read (2026-09-14)

Breakout Surge, Breakdown Surge and the Weekly/Monthly Movers and Decliners each
qualify on **one predicate over columns already stored on the bar row** — the
`km_scan_results` arms verbatim. `services/priceActionEvents.ts` turns that into
dated events; no column, no migration, no nightly job.

The columns reach each stock's **first bar** — RELIANCE 1996-01-02, TCS
2002-08-13 — so these events carry 26 years of history where `ema_20` carries
2025 onward. Validated against the DB bar for bar: the same derivation as SQL
and as TypeScript over live SOLARA bars returns 22 events, identical dates,
types and order.

⚠ **The reference-reset guard is mandatory.** `pct_wtd` is measured against
`prev_week_close`, which changes every Monday; `pct_mtd` likewise every month. A
naive sign-change test fires a **phantom** crossing on the first bar of each
period, where the two sides were measured against different reference prices and
nothing happened. On SOLARA's last 123 bars: 17 of 35 weekly and 3 of 17 monthly
are phantom — twenty fabricated events out of fifty-two. Never drop
`prev_week_close` / `prev_month_close` from a fetch; they are not decoration,
they are the only way to tell a crossing from a rollover. Two further rules: one
crossing per period per direction (6 of 14 monthly), and **NULL is never zero**.

**A cooldown was drafted and rejected, on measurement.** Re-entries cluster —
SOLARA cleared its 20-day high five times in fifteen days — so "suppress within
N bars" is the obvious fix. The gap distribution across a 1-in-37 NSE sample
(566 entries) is 12.5% / 9.2% / 20.8% / 40.8%: **no cliff anywhere**, so any N
would be taste wearing the costume of a rule. The edge is emitted faithfully and
density is paid for by priority — `price_action` sits at the BOTTOM of the story
priority table and can never displace a journey milestone or a Big Money day.

**Density broke a list that had no priority rule.** `thesis.ts` picked "Recent
signals" with `slice(-8)`, safe only while every kind was rare. At 22 Price
Action events per 74 bars against 4 of everything else, all eight rows would
have filled with "above last week's close" — and the tab's headline sentence
reads `signals[0]`. It now ranks by priority, cuts, then restores recency for
display. The chart never had this bug because `eventAtBar` already resolved a
shared bar by priority; the list simply had no equivalent.

⚠ **`is_vani_surge` is NOT the Breakout Surge scanner.** The flag is
`rvol > 5 AND close >= w52_high * 0.95 …` — 52-WEEK-high proximity plus volume;
the scanner is 20-day-high geometry. On 2026-09-11 the scanner held 200 stocks
and the flag fired on 8. The chart titled it "Breakout surge" — the scanner's
name on a different rule. Both flags are now titled for what they measure, and
what they actually DO is decide the scanner's HIGHLIGHT (`vani_flag`), not its
membership. Guarded by `scripts/qa/check-price-action-events.mjs`, verified to
fail against all eight regressions above.

### `fix` jobs cascade to their dependents (2026-09-14)

`DAILY_STEPS` gets the order right nightly. The **`fix` path did not**: a fix
job repaired one dimension and stopped, so every dimension derived from it kept
a value computed from the superseded data. Measured over six weeks:
`vani_flags` 162 fix jobs, `nse_magic_rs` 160, `nse_equity_indicators` 128 —
against **zero** for `gl_events`, `big_money`, `dots`, `wg_journeys` and
`scan_refresh`. Fixes land 1–6 days after the bar.

A fill-rate check cannot see this — `gl_events` and `big_money` are in
`health.DIMENSIONS` and report `ok` because their columns are *populated*, just
not *current*. Presence, not correctness, again.

`orchestrator.DIMENSION_DEPENDENTS` now declares the recompute graph
(evidence-backed edges only), `dependents_closure()` walks it transitively in
DAILY_STEPS order, and `validate_dependents()` runs **at import** so a bad name
or a cycle is a startup error. `worker._cascade_dependents()` enqueues the
closure after any non-failing fix.

Three properties that are load-bearing — do not "simplify" them away:

1. **Forced.** `_handle_script` nullifies a dimension's columns only when
   `force` is set; unforced, a derived handler can skip exactly the rows that
   went stale. The cost is that a failed recompute leaves NULL rather than
   stale — deliberately the better failure, because NULL drops the fill rate
   and the gap sweep retries, while stale-but-populated is invisible forever.
2. **A cascade never cascades.** The closure is computed in one pass and its
   jobs carry `created_by='cascade'`, which the function refuses to expand.
   Without this, one repaired column starts a self-feeding chain.
3. **`integrity_checks` is not a dependent** — a nightly whole-day sweep, not a
   per-dimension derivative.

⚠ **Two cascade defects caused the 2026-09-22 Stage 2 Leaders outage; both
fixed 2026-09-23.** The closure is enqueued in ONE pass as SIBLING jobs, all
`force=True`, sharing a `created_at`, with no ordering between them. On
2026-09-16 AND 09-22 `rolling_metrics` and `stage_classification` ran
concurrently, both `UPDATE km_equity_eod`, and **deadlocked**.
`rolling_metrics` lost — but its forced nullify had already COMMITTED, so
`w52_high`/`w52_low`/`lifetime_high` were NULL for the whole bar;
`stage_classification` then COMPLETED against those NULLs and, because the S2
gate needs both non-NULL, demoted all 7,520 rows to `S2_CANDIDATE` (0 S2 vs
~1,030 the day before). Now: **a dependent whose parent's fix failed for that
date within `PIPELINE2_PARENT_FAIL_WINDOW_MIN` (120) does not run** — it ends
as `status='deferred'`, **terminal on purpose**: `_claim_job` orders by
`created_at`, which a deferral does not change, so re-queueing hands the same
job back on the next poll and starves everything behind it (the loop only
sleeps when nothing was processed). The parent's own repair re-cascades it.
And **a failed fix writes its own CRITICAL `km_integrity_findings` row
immediately** (`_record_failure_finding`, same `check_key` the sweep uses).
That closes a ~23-hour blind spot: `integrity_checks` is the LAST daily step
(~19:07) while the gap sweep fires 19:30 and its cascade 19:31+, so every
cascade failure was created after that day's sweep finished — 09-16's outage
was correctly reported, on 09-17. ⚠ `lib/alerting.py` still no-ops unless
`ALERT_WEBHOOK_URL` or `ALERT_EMAIL_TO`+`SMTP_*` are set, so a critical finding
is still PULL-only until that is configured.

### ⚠ Repairing `stage` does NOT repair `stage_since` — the carry is a chain (2026-09-23)

The sequel to the outage above, and a worse bug than it: Stage 2 came back and
**every leader read "in stage since 22 Sept", entry price = that day's close,
% since entry = 0.00** — a stock that entered Stage 2 in March presented as one
that entered yesterday, which is the exact opposite of what the column is
consulted for.

`stage_since` / `stage_since_close` / `pct_from_stage_entry` / `stage_run_bars`
are a **FORWARD CARRY**: each bar reads the single prior classified bar
(`_SQL_INCREMENTAL` in `scripts/backfill_stage_entry.py`) and either extends its
run or opens a new one. So three things follow, and all three bit at once:

1. **Repairing the `stage` LABEL repairs nothing else.**
   `backfill_stage_classification.py --date … --full` writes `stage`,
   `sma200_rising`, `is_vani_s2` — and stops. pipeline2's
   `handle_stage_classification` runs stage **and** the entry carry as ONE unit,
   with a comment saying exactly why; **the standalone repair script was that
   split**, so a hand-repaired bar kept an entry date derived from the value
   that had just been replaced.
2. **It does not repair any LATER bar**, because each already stored a value
   carried from the corrupted predecessor. Fixing only the newest bar is the
   obvious move and is **not enough** — proved on a throwaway cluster: it left
   the entry date at the echo bar.
3. **A label that flips BACK breaks the run a second time.** That echo is the
   bar nobody repairs, because nothing was ever wrong with its own inputs.

Measured on the live DB (baseline ~450 stage entries per session):
**09-16 → 1,395** (deadlock) · **09-17 → 1,245** (the echo) · 09-18 455 ·
09-21 406 · **09-22 → 1,379** (deadlock). On the 09-22 bar, **983 rows** carried
`stage_since = 2026-09-22` with a stage **identical to 09-21's** — all S2, all
`pct_from_stage_entry` 0.00.

⚠ **No matview is involved.** The five Stage scanners read `km_equity_eod`
directly (`km_scan_results` has 107 columns and not one named `*stage*`), so the
data fix is visible immediately and **no `REFRESH` heals it**.

**Fixed:** `backfill_stage_entry.py` gains `--from/--to` (`replay_range`), which
replays the carry **ascending over every classified session in range, read from
the table** — never a generated calendar, because a skipped holiday breaks the
chain silently — and defaults `--to` to the latest bar, warning when it would
stop short. `backfill_stage_classification.py --date` now runs the entry carry
for that date (parity with the handler) and names the follow-up replay; `--full`
points at `--restart`. Its `__main__` guard also moved to the bottom of the
file: it had sat ABOVE `compute_stage_entry_for_date`, harmless until `main()`
called it.

**To repair a bar by hand, in this order:**
```bash
cd App/backend
python scripts/backfill_rolling_metrics.py     --date <D>      # if w52_* are NULL
python scripts/backfill_stage_classification.py --date <D> --full
python scripts/backfill_stage_entry.py --from <D>              # through the latest bar
```
Guarded by `test_stage_entry_repair.py` (10 tests, no DB), verified to fail
against five regressions, plus a throwaway-cluster fixture that reproduces the
983-row shape and proves the replay restores the clean baseline and is
idempotent.

Knobs (env): `PIPELINE2_CASCADE` (`on`), `PIPELINE2_PARENT_FAIL_WINDOW_MIN` (`120`), `PIPELINE2_CASCADE_MAX` (`25`; the
longest real chain, from `nse_eod_download`, is 22 — 21 before the
`rolling_metrics` → `stage_classification` edge was added 2026-09-23), `PIPELINE2_CASCADE_DEBOUNCE_MIN`
(`30`). Guarded by `test_pipeline_cascade.py`, verified to fail against both an
unforced enqueue and a re-expanding cascade. Plan + rollout watch:
`docs/claude/thesis-events-poa.md`.

### Per-dimension watermarks — the cascade is now provable (2026-09-14)

The cascade above makes the recompute happen. **Nothing recorded that it did.**
A row derived from superseded inputs has every column populated, every invariant
satisfied and a healthy fill rate — it is simply wrong, invisibly. Presence, not
correctness, one more time.

The gap was wider than "no watermark". `run_daily` builds a `StepOutcome` for
each of its 22 dimensions and the worker stores **none of them individually** —
they fold into one aggregate `km_jobs` row (dimension NULL) plus a
`progress_text` string. `fix` jobs do carry `(dimension, trade_date)`;
`km_pipeline_runs` carries the LEGACY step names, which pipeline2 mostly skips.
So nothing could answer *"when was `nse_magic_rs` last computed for
2026-09-11"*.

`km_dimension_watermarks` (migration 210) answers it. `pipeline2/watermarks.py`
stamps from `run_daily` and `_run_fix`, and **inverts `DIMENSION_DEPENDENTS`** —
one declaration, two directions: the cascade walks it down to decide what to
recompute, `check_derivation_staleness` walks it up to find what should have
been recomputed and was not. That check is a **fifth check class**: every other
check asks whether a value is present, plausible or moving; none could ask
whether it is *current*. It catches the three cases the cascade structurally
cannot — a fix applied while `PIPELINE2_CASCADE` was off, a cascade job enqueued
then failed, and a backfill run straight against the DB.

Three calibration decisions, each the difference between a check that gets read
and one that gets muted — **do not "tidy" any of them**:

1. **Absent is UNKNOWN, never stale.** The table starts empty and fills forward;
   `stale_derivations` INNER JOINs both watermarks. A LEFT JOIN would report
   every un-stamped dimension on night one — thousands of findings, muted by
   night two.
2. **`partial` stamps; `failed` never does.** A partial compute ran against the
   inputs as they stood, which is the only question a watermark answers.
   **2,184 partial fix jobs are on record** — refusing them would make most
   dimensions read permanently stale within a week.
3. **Warning with a 60-second floor, not critical.** Parents finish seconds
   before children inside one run; measured real staleness is **1–6 days**.
   Same calibration reasoning as `CASH_EQUITY_SERIES`.

Guarded by `test_dimension_watermarks.py` (22 tests), verified to fail against
all seven properties plus both wiring guards (the stamp being removed, and the
lazy import reverting to relative — which breaks `test_leadership_pipeline`,
since it compiles `run_daily` on its own via `ast`/`exec` where a relative
import has no `__package__`).

⚠ `indicators_computed_at` is unchanged and still not a watermark: written under
`WHERE indicators_computed_at IS NULL`, so re-runs skip stamped rows, and
`backfill_vani_flags.py` touches no timestamp at all. It measures a different
thing (did the legacy RPC visit this row) and `pipeline2/health.py` already
refuses to trust it.

### `leadership_snapshot` — publication is gated on a fully clean run

`pipeline2/orchestrator.py run_daily()` publishes longer-term sector readings
**only when `outcome.overall_status == 'completed'`** (`lib.sector_leadership.
refresh_snapshots`, reported as the `leadership_snapshot` step at 99%).

That gate is the design, not caution: if any enrichment step failed, publishing
would present partial evidence as a finished reading. Instead the **earlier
dated snapshots are retained** and the incomplete session simply is not
published. A failed publication is recorded as its own failed step — it never
turns a successful index calculation into a failure, and vice versa. Fix the
failed source step and re-run the daily pipeline (or
`python scripts/refresh_sector_leadership.py`) afterwards.

Publication is **transactional across all five category scopes × three display
windows** — there is no partially published batch. Stale membership generations
and custom-index revisions are rejected rather than published.

### One-Shot Backfill Scripts

All scripts live in `App/backend/scripts/`. Run with `KD_DB_PASSWORD=...` env var (uses hardcoded VPS host `187.127.136.65`). Key scripts: `backfill_d365.py` (supports `--date YYYY-MM-DD`), `backfill_supertrend.py`, `backfill_rolling_metrics.py`, `backfill_vani_flags.py`, `rule_discovery.py` (accepts optional year arg), and transit generators: `generate_bayer_windows.py`, `generate_gandanta_windows.py`, `generate_mercury_windows.py`, `generate_panchak_windows.py`, `generate_venus_windows.py`.

`refresh_sector_leadership.py` is the exception to the pattern — it uses the
deployed database configuration rather than `KD_DB_PASSWORD`, and it is the
**only** way to prepare historical leadership dates:

```bash
cd App/backend
python scripts/refresh_sector_leadership.py                       # latest session, all 5 scopes × 3 windows
python scripts/refresh_sector_leadership.py --from 2026-06-01 --to 2026-09-11
```

Opening `/sector-rotation` on an unprepared date shows a preparation message —
it **never** triggers the heavy calculation on a page load. After any basket
membership or catalog edit, every snapshot across all dates is invalidated by
the migration-208 trigger: the next daily run republishes the latest session,
but earlier dates you still want must be re-prepared with `--from/--to`.

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
Source: LuckyPop SuperMagic Pine Script (`App/frontend/pinescript/magicRS.txt`,
and the same constants in `luckypop.txt`).

```
rs       = close_stock / close_CNX500
magic_rs = ((rs / SMA(rs, 144)) - 1) * 100     -- the ratio vs its OWN 144-bar mean
magic_ma = SMA(magic_rs, 60)
```

⚠ **`magic_rs >= 0` does NOT mean "beating NIFTY 500."** It means the RS ratio is
above its own 144-bar average — so a stock that has lost ground against the index
for two years crosses zero the moment its ratio ticks above that depressed mean.
Any label derived from the sign must say what it measures, not "outperforming".

Zones are stored in `magic_rs_zone` — **7 keys, not 5**; the canonical list is
`ZONE_LABELS` in `signalScale.ts` (see Signal Vocabulary). `magic_rs_short`
(21-bar RS, 10-bar MA) is a separate, coarser series and is the ONLY one weekly
and monthly carry.

**Zone thresholds are FIXED at 6.0 / 9.0 — a deliberate deviation from Pine, not
a porting gap.** The script scales both by `vol_factor = ATR(14)/SMA(ATR(14),100)`,
the stock's own volatility against its own norm; we do not, and should not.
Measured on 2026-09-18 across 4,518 scored rows:

| | fixed (ours) | adaptive (Pine) |
|---|---|---|
| bands agree | **92.5%** | — |
| bullish↔bearish sign reversals | **0** | — |
| bullish-zone population | 1,100 | 1,092 (**−0.7%**) |
| bearish-zone population | 965 | 1,074 (**+11.3%**) |
| `= 'Strong Bull'` (gates `is_vani_strength`) | 771 | 765 |

The adaptive threshold never reverses a directional call — every disagreement is
to or from "neither", and the bullish side, where the scanners live, moves by
8 stocks out of 1,100. Against that, implementing it costs a 13.2M-row zone
backfill plus a cascade recompute of `flow_type` → vani flags → matview.

And the fixed band is the better fit for what we actually do: Pine reads ONE
stock on ONE chart, where normalising by that stock's own volatility is right;
we screen ~4,500 at once, where a fixed band means `Strong Bull` means the same
thing on every row. Under Pine's, two rows both labelled Strong Bull can carry
`v_diff` of 6 and 15 — the same comparability problem `rs_percentile` exists to
solve for `magic_rs`.

**Do not re-open this without new measurement.** The query that produced the
table above is in the migration 219 header.

---

## Current Plan


### Filing Intelligence — Sprint 2 SHIPPED 2026-09-18 · ⏳ OWNER REVIEW PENDING

**Handover: `docs/claude/filing-intelligence-handover.md`.**
Plan of record: `docs/claude/filing-intelligence-poa.md`.

The *why* layer behind the chain DristiQ already sees (Stirring → Waking Giants
→ Volume Drive → Breakout Surge → Ascent). Live on the VPS: **28,363 filing
events**, **2,719 result announcements** over 2,303 meetings, post-result drift
derived on read, and **bulk deals with the buyer's name**. Migrations 212–217
applied; three pipeline2 dimensions running (`filings_ingest` 06/09/12/20/23:10,
`board_meetings_ingest` 07/21:40, `bulk_deals_ingest` 08/22:20 IST).
60 tests in `test_filing_intelligence.py`.

⚠ **NOTHING IS ON A SCREEN, and that is deliberate** — owner: *"POA focuses on
making all things data-ready — UI layer mention it but we won't build it, it
needs deep discussion and I have my own thoughts for it."*

**⏳ THE OWNER WILL REVIEW THIS SESSION'S WORK LATER — for the UI layer and the
other open activities.** Do not start any of it unprompted. What is waiting on
that review, in full, is the *What needs your decision* section of the handover:
where filings surface (NOT the Morning Brief — the pipeline runs several times a
day and the brief would keep changing; the steer was "3–4 days of filing
intelligence at any point in time"), the **Eagles** / **Spark** vocabulary
(settled in principle, never rendered), what a user does with a bulk deal, and
whether PEAD is its own scanner or a column on the existing ones. Plus the
smaller open items: bulk-deal history (none exists — probe written, unrun),
205 outcome announcements still NULL, Sprint 3 (document extraction via Qwen),
Sprint 3b (populate `km_corporate_actions`), and BSE.

⚠ Two rules any consumer of this data must keep: **Day 0 is when the market
could ACT** (from `exchdisstime` via `kd_day_zero_trade_date`, never the filing
time), and **`suspect_corporate_action` must be filtered on in any drift study**
until `km_corporate_actions` is populated.

---

### Thesis events — PARKED 2026-09-15, Phases 1–3 shipped

`docs/claude/thesis-events-poa.md`. Phases 1c, 2, 3a and 3b are on
`claude/tender-euler-2j7ab5`: journey milestones + base rates, the six Price
Action scanners derived on read, per-dimension watermarks (migration 210), the
honest stirring pair (migration 211), and the chart warm-up fetch.

**Phase 4 — VaNi narration per family — is NOT started and is parked at the
owner's call.** The POA's rules for it stand unchanged when it resumes:
pre-compute every comparison into a word, name the evidence gap, and treat
*"nothing here matches how you work"* as a valid reading rather than a failure.

**How to run everything this sprint added** — backend (`cd App/backend`, no DB,
no network, no LLM): `python -m unittest test_dimension_watermarks`,
`test_journey_fields` (needs numpy/pandas), `test_pipeline_cascade`, the ten
companion suites, plus `python test_vani_routing.py` and
`python -m pyflakes lib/ pipeline2/ pipeline2_api.py scripts/`. Frontend
(`cd App/frontend`): `npm run typecheck`, `npm run build`, and the four pure-node
guards `check-price-action-events.mjs`, `check-journey-events.mjs`,
`check-sector-horizons.mjs`, `check-persona.mjs`. All green 2026-09-15 (36 + 20
+ 84 backend tests). ⚠ Ten `scripts/qa/` checks call Playwright with
`channel: 'chrome'` and need Chrome installed — they cannot run in the cloud
container, which has Chromium at `/opt/pw-browsers/chromium` only. That is an
environment limit, not a failure.

**UI verification is OPEN — nothing here has been seen in a browser.** Stocks
picked from the live DB on 2026-09-15:

| Check | Where | What proves it |
|---|---|---|
| Warm-up reaches the derivation | `/chart/equity/599` (IPCALAB) at **1M** | A Flower Pot marker appears at all. At 1M the window is ~21 bars, so before this change `fpbEvents` returned `[]` without evaluating anything — a marker was structurally impossible. Also ORIENTHOT 39696, PANACHE 39713, AMBER 77. |
| Rebase is exact | same stock, 1M → 3M → 6M | The marker stays on its own date instead of sliding |
| Evidence gap shrank | Thesis tab, ask VaNi | No "NOT EVALUATED" line for Flower Pot at 1M; still present on **MAX** (no prefix there, correctly) |
| Journey arc | `/chart/equity/39897` (SOTL) at 6M | turn 05-04 → wake 07-23 → **confirm 09-01**, all three in one window |
| A COMPLETED arc | `/chart/equity/39767` (PGHL) at 6M | wake 07-09, confirm 07-31, **slept 08-31** — the end the `is_current` filter used to hide |
| Base rate is read, not remembered | any journey stock, Thesis | The footnote cites **"348 of 595"** with its denominator |
| Priority trim | `/chart/equity/40012` (SOLARA) at 3M | "Recent signals" is not eight rows of "above last week's close" |

⚠ **Two things will look unfinished until the next `wg_journeys` run, and are
not bugs.** Verified on the live DB 2026-09-15: `stir_first_date` and
`stir_window_bars` are populated on **0 of 1,697** rows, so `JourneyStrip`
correctly shows the bare count ("21") rather than "21 / 41" — that IS the
designed fallback. Archived `turn_date` is likewise still NULL (PGHL included);
the `turn_at()` derivation lands on the same run. `km_journey_base_rates` DOES
carry its row (as_of 2026-09-14 — 348 of 595, 58.50%, 29 days average), so the
base-rate check is live now.

The warm-up and story-event work is **frontend-only**. Phase 1c's VaNi side is
not: `/api/ai/vani-narrate` gaining `_sebi_post_filter` and the two
`_VANI_NARRATE_SYSTEM` rules need the backend deployed and the API restarted.

---

Prior sprint: **VaNi research companions** (2026-09-12 → 09-14) — Market
Structure, Sector Rotation (Current Flow + Longer-Term Leadership), the Price
Action / Stage / Flow / Market / Discovery scanner defaults, and scanner
highlight authority. All shipped on `claude/tender-euler-2j7ab5`; per-increment
handoffs are the `docs/*.md` files listed under **VaNi Research Companions**.
Verified green 2026-09-14: 84 backend tests, `test_vani_routing.py`, typecheck,
theme + persona gates, `check-sector-contracts.mjs`.

⚠ **Deployment is not a frontend-only push.** Frontend and backend must be
pulled and deployed **together** for every one of these increments (intent
versions, evidence loaders and cache keys are matched pairs), and the API must
be restarted. The sector evidence loader requires the **direct PostgreSQL
client** — a PostgREST-only backend does not support it.

**DB side is done** (verified live 2026-09-14): migrations 207 and 208 are
applied, both invalidation triggers are enabled, and
`refresh_sector_leadership.py` has published 15 snapshots (5 scopes × 3
windows) for `2026-09-11` — which is the latest bar in `km_index_eod` and
`km_equity_eod`, so leadership is in step. Only that one date is prepared; use
`--from/--to` for historical sessions. Details and the one real finding this
turned up — **there is no Haiku fallback in the deployed config, both paths are
Qwen** — are under Known Issues.

Parked sprint: **Astro Layer — Mercury slice** (2026-07-21 →). Narrative contract, launch decisions, yardstick design (VIX as one of several), and the combust-method finding + calibration subtask: **`docs/claude/astro-story.md`**. Companion: `MERCURY_SLICE_PLAN.md` (repo root). Launch catalog scope shipped as migration 160 (Variant B: 13 Mercury + 6 slow-planet almanac rules) — owner runs it in pgAdmin (kaala-postgres MCP is read-only).

Prior sprint: **Rules Engine**.

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

## VaNi Research Companions (2026-09-12 → 09-14)

The second VaNi generation. Where `GET /api/ai/*` returns **one insight under
one card**, a *companion* is a persistent panel beside a research page that
opens on an automatic default reading and offers a short menu of follow-ups.
Four pages have one: Market Structure, Sector Rotation (two modes), the
scanner Studios, and Flower Pot Burst.

Everything below routes through the existing `POST /api/vani/ask` — **no new
endpoints were added.** Intents are registered in backend modules and answered
by a per-family `answer()` function.

| Family | Backend module | Version | Page |
|---|---|---|---|
| `structure.*` (8 intents) | `lib/market_structure_vani.py` | 2 | `/market-structure` |
| `sector.*` / `sector.leadership.*` | `lib/sector_vani.py` | 8 | `/sector-rotation` |
| leadership evidence | `lib/sector_leadership.py`, `lib/sector_leadership_intents.py` | — | `/sector-rotation` |
| current-flow projection | `lib/sector_flow_intents.py` | — | `/sector-rotation` |
| `scanner.*` default copy | `lib/scanner_explanation.py` | — | `/scan` |

Frontend: `components/domain/VaNi/` (companions, evidence cards, learning
illustrations, brand/mascot), `config/marketStructureIntents.ts`,
`constants/scannerIntroductions.ts`, `lib/structureStates.ts`,
`lib/sectorFlow.ts`, `lib/sectorHorizonStory.ts`, `services/sectorLeadership.ts`,
`services/sectorPersonal.ts`, `stores/marketStructureStore.ts`,
`stores/sectorResearchStore.ts`.

Handoff docs, one per increment: `docs/market-structure-vani-handoff.md`,
`docs/sector-rotation-handoff.md`, `docs/sector-leadership-review.md`,
`docs/vani-intent-todo.md`, `docs/scanner-default-explanations.md`,
`docs/scanner-highlight-authority.md`, `docs/icp-scanner-experience.md`,
`docs/breakout-surge-beta.md`, `docs/flowerpot-result-actions.md`,
`docs/vani-analytics.md`.

### Three intent kinds — and only one of them costs a model call

This is the load-bearing distinction. Do not add an intent without deciding
which kind it is.

1. **`STATIC`** — fixed educational copy in a dict (`STATIC` in
   `market_structure_vani.py` / `sector_vani.py`), or shipped in the frontend
   bundle (`constants/scannerIntroductions.ts`). **Bypasses the LLM entirely.**
   No cache entry, no expiry, no recurring request. Change the copy → bump the
   content version (`SCANNER_INTRODUCTION_VERSION`, currently 8).
2. **Read-only evidence** — e.g. `sector.context`, `sector.pulse.context`.
   Returns authoritative computed data. **No LLM.**
3. **Grounded synthesis** — Qwen first, configured cloud fallback. The model
   receives a *validated snapshot plus precomputed comparisons*, never raw rows
   to interpret (see the signed-number lesson below).

### `allow_cloud_fallback` — a real change to `ai_client.complete_with_source`

`prefer_local=True` used to mean *Qwen only*: on Qwen failure it returned
`(None, None)` and the caller had no answer. The Market Structure family needed
Qwen-first **with** the configured cloud fallback, so `complete_with_source`
gained a separate `allow_cloud_fallback: bool = False`.

**Every older caller keeps Qwen-only behaviour** — the default is `False` on
purpose. Opt in explicitly; do not flip the default. Your configured cloud
provider/model must point at Haiku for the fallback to be the intended one.

### Cache + single-flight

Grounded answers use the **persistent** `km_vani_cache` table (migration 038)
via `lib/vani_cache.py` — not the in-memory `_vani_cache` the Morning Brief
uses. The cache key includes **intent id, intent version, explanation depth,
period, and a hash of the exact data snapshot**, so a same-date data correction
changes the key and cannot serve a stale reading. Bumping a family's `VERSION`
invalidates every cached answer in it — that is the intended mechanism when a
prompt's framing was wrong.

`single_flight()` in `market_structure_vani.py` (reused by `sector_vani.py`)
deduplicates concurrent identical generations: 64 local lock stripes, plus a
PostgreSQL **advisory lock** across API workers when the db client exposes a
real connection. A worker that cannot take the lock raises `ReadingInProgress`
rather than holding the HTTP request, and the client polls. PostgREST-only
deployments still deduplicate within each process.

### Sector Rotation: two modes, and they must not be merged

`/sector-rotation` has **Current Flow** (default) and **Longer-Term
Leadership**. They are separate readings on separate bases and a basket can be
*Running broadly* while its current flow is *Fading*. **Never compose them into
one score** — several prompts say so explicitly, and the tests assert it.

Longer-Term groups are explicit research rules, not a ranking:
*Running broadly* (W/M agreement ≥ 8 completed weekly observations, ≥ 60%
Stage 2 Leaders among classified constituents, ≥ 5 classified, ≥ 80% membership
coverage) · *Building* (agreement, requirements unmet) · *Cooling* (agreement
lost within the preceding 26 weekly observations) · *Limited coverage* ·
*Unavailable* · *Not aligned*. A measured Leader share below 60% is a
**shortfall, not missing data**.

Reads are cheap by construction: the page and VaNi both read one **published
snapshot** (`km_sector_leadership_snapshots`) plus a snapshot hash. Rendering
the table performs no constituent scanning, no index calculation and no LLM
call. All the heavy work happens in the refresh job.

### The launch menu is deliberately smaller than the implementation

`docs/vani-intent-todo.md` is the source of truth for what is *visible*: one
automatic default plus **three** follow-ups per mode. Eight further intents
(`sector.leaving`, `sector.read`, `sector.compare`, `sector.learn`,
`sector.taxonomy`, `sector.leadership.persistence`, `.support`, `.learn`) are
**hidden, not deleted** — their frontend definitions, backend handlers and
evidence calculations are all live and regression-tested. Deferred items are
hidden outright, never shown as disabled or "coming soon".

### Analytics

`lib/vaniAnalytics.ts` + `hooks/useVaniAnalytics.ts` emit nine categorical
PostHog events through the existing wrapper (`product=dristiq`,
`analytics_version=1`). Dictionary and the dashboards to build:
`docs/vani-analytics.md`.

**Privacy is enforced structurally, not by convention**: events carry only
categorical dimensions and timing — never request/response bodies, stock
names/IDs, positions, prices or tokens. Link destinations are *classified*
before capture, explicit events override PostHog's automatic URL/referrer with
a synthetic route, and VaNi containers carry `ph-no-capture` to keep autocapture
out of the DOM text. Personal "Connected to your stocks" results stay in an
account-keyed browser query and **never enter a shared prompt or response
cache**.

Counting rule that matters: `source=automatic` is the default brief opening by
itself. Keep it **out of the numerator** for adoption — only `manual`/`external`
selections are deliberate usage.

---

## SQL Migration Convention


New migrations go in `App/DBscripts/km_migration_NNN_description.sql`.
Run them directly in pgAdmin, DBeaver, or `psql` — **no Python wrapper scripts**.
Next migration number: **222** (disk is at 221). **221** = `km_migration_221_pead_drift_preset.sql` — the **Post-Result Drift (PEAD)** scanner preset. Holds NO DATA and creates NO TABLE: membership is DERIVED ON READ from `kd_result_returns` (migration 215) with 216's one-row-per-board-meeting de-duplication. ⚠ **The +5% gate is MEASURED, not chosen** — 2,245 results, median 20-session drift from Day 0 against a universe median of −0.59%: `>+5%` **+0.95% (+1.54 pts, n=278)**, `+2..+5%` +0.16%, `−2..+2%` −1.61%, `−5..−2%` −1.87%, `<−5%` −1.52%. A 2.8-point spread, and the drift is negative across all three bands below +2%. ⚠ **NO MagicRS gate, deliberately**: react≥5% with RS rising measured +0.80% vs +0.59% falling (n=42) — within noise, so bolting it on halves the list for nothing. ⚠ **Its own `events` category (sort 6) because the scanner is SEASONAL** — 104 qualifying names in the week of 2026-08-10 and **ONE on 2026-09-23**; an empty list inside Price Action would make that family look broken four weeks in five, and the empty state must read "no results filed in the last 20 sessions", never "no opportunities" (the fpbEvents starvation lesson). ⚠ `vani_side` NULL — it does not enter the Workspace Discovery union. ⚠ `suspect_corporate_action` filtering stays mandatory while `km_corporate_actions` is EMPTY. NSE-only (the filing ingest has no BSE). Owner runs it in pgAdmin; no REFRESH, no backfill. Guarded by `scripts/qa/check-pead-scanner.mjs` (8 checks), verified to fail against a loosened gate, an added RS filter, a dropped corporate-action filter, a softened throw, a reversed ordering and a moved category. **220** = `km_migration_220_scan_rs_momentum_projection.sql`. **219** = `km_migration_219_magic_rs_momentum.sql` — MagicRS momentum on the HOUSE CLOCK (5/22/66 BARS), stored on **every table that carries a MagicRS series**, so one number reaches a scanner, the chart widget and a VaNi fact. `km_equity_eod` + `km_index_eod` get `magic_rs_chg_5d/_22d/_66d` + `magic_rs_align` (long 144-bar series); `km_equity_weekly` + `km_equity_monthly` get `magic_rs_short_chg_*` + `magic_rs_short_align`, **named differently because those tables carry a different measure** (21-bar short RS — the long one needs 145 bars and monthly holds 80, migration 169). `km_wg_journeys` gets the long four too, because the Discovery tabs read that table directly and never touch the matview. All four columns are projected onto **all 17 matview arms** so the 16 matview-served scanners can see them — without that the columns would reach only the 5 Stage scanners that read `km_equity_eod` directly. ⚠ **POINT differences, never percent** (magic_rs is already a percentage deviation; Pine's own "5-Bar Momentum" is `magicrs - magicrs[5]`). ⚠ **Bars are THAT TABLE's bars** — 66 on the monthly table is 66 MONTHS, which needs ~88 monthly bars, so most symbols get NULL there and `align` with it. That is the honest reading, not a gap to fill. ⚠ **Warm-up is sized per cadence, not in calendar days** (the 169 lesson, applied up front): 66 bars is ~95 calendar days daily, ~460 weekly, ~2,000 monthly — so the floor is `-400` / `-1400` / full-history per table. One `-400` for all would have written NULL on weekly and monthly while looking like it ran; the fixture proves the weekly floor by recovering a 66-week change. ⚠ **align is NULL unless all three parts are measurable** (the `stir_days` denominator lesson), and NULL at either end of a LAG yields a NULL change, never 0. ⚠ **`magic_rs_align` is NOT Pine's 6/3/1 strength score** — `calculateStrengthPoints()` scores three CHART TIMEFRAMES and wants 60m/D/W on a daily chart; the 60m leg needs `km_equity_15m` (schema-only). This is three lookbacks on ONE series, 0-3. **The widget now READS these columns; the browser subtraction is deleted** — it used to derive them from whatever bars the chart had loaded, so the same stock read differently at different zoom levels. Do not reintroduce a fallback subtraction for the pre-backfill window: a blank says the pipeline has not computed it, a locally-derived number that disagrees with every other surface hides the gap. Changes no existing value; no scanner's membership or ordering moves. Matview arms generated **by script** from 218 with an assert that all 17 were touched (218 silently patched 16 — `flower_pot_burst` ends `FROM fpb f` and `gl_retest` aliases its tail), every arm aliased, and the file ends with the two `REFRESH` statements per the 205 convention. Verified on a throwaway PostgreSQL 16 cluster across all four tables: arithmetic matches an independent recompute, a NULL five bars back yields NULL not 0, a 40-bar monthly stock correctly refuses `chg_66d`, a re-run writes 0 rows, and an unsupported table raises. Owner runs it in pgAdmin, then `python scripts/compute_magic_rs_momentum.py --all`. **218** = `km_migration_218_gl_universe_and_retest_window.sql` — the Golden Line pair covers **NSE and BSE**, and `gl_retest` reads a **seven-session window** instead of today's bar. Measured before the change: gl_retest returned ZERO rows, and had on 20 of the previous 40 sessions — NSE-only + single-bar left **0.75 qualifying stocks per session**, and 73% of every retest found since 1 Jul was BSE (83 vs 30). Both changes together: **31 events over 22 stocks** in the last 7 sessions. Adds `gl_event_date` / `gl_sessions_since` / `gl_move_since_pct` (signed % from the retest bar's close to today's) to all 17 UNION arms. ⚠ **The 5% "still at the line" gate is a UI toggle, NOT a matview filter** — membership is "a retest happened in the window", which is a fact; 5% of drift is a preference. ⚠ **`gl_event_date` is the RETEST bar; `trade_date` is TODAY** — every other column on the row is today's. ⚠ **`gl_days_above` is the retest bar's value**, not a live count (the `stir_days` lesson: a count whose anchor is not stated gets read as something else). ⚠ **`delivery_pct` is NULL on every BSE bar** (0 of 4,115 vs NSE's 3,105 of 3,371), so most retest rows carry no delivery at all — nothing, UI or VaNi, may narrate delivery for a BSE row. The file also **UPDATEs `kd_scan_presets.universe`**, because `getPresetMeta()` reads the DB row first and the `SCAN_PRESETS` array is only the offline fallback — changing the array alone leaves the BSE tab disabled. Generated by script from migration 205 (not hand-edited) and verified by applying it, with fixtures, to a throwaway PostgreSQL 16 cluster. Owner runs it in pgAdmin; it ends with the two REFRESH statements per the 205 convention. **217** = `km_migration_217_bulk_deals.sql` — `km_bulk_deals` + `km_bulk_deal_days`. `client_name` is the point: the ONLY field in the filing plan that names the buyer, which makes "a documented institutional buy on a Waking Giants name" a join rather than a phrase. ⚠ **The CSV archive is the source and the JSON API is NOT** — measured 2026-09-18, `/api/historicalOR/bulk-block-short-deals` returned EXACTLY 70 rows for a 30-day window, a 1-year window, block_deals, AND every single trading day probed, while `bulk.csv` for the same 17-SEP session held 212. 70 is a page cap that bites on one day, so the API answers 200 with a payload silently missing two rows in three. ⚠ **No UNIQUE constraint, deliberately**: no composed key is safe — (date, symbol, client, side) collapsed a REAL pair in the probe (HDFC MUTUAL FUND bought ASTERDM twice on one session, two schemes under one AMC name), and widening it to qty+price only turns a correction into a duplicate. These are an exchange-published COMPLETE DAILY REPORT, so idempotency is **replace-the-day** in one transaction; nothing is de-duplicated, so an identical pair survives. `km_bulk_deal_days` separates "we looked and found nothing" (row_count 0) from "never fetched" (absent) — which matters more here than anywhere because **there is no backfill**: the CSV holds one day and the API caps at 70 even for one, so collection starts from the first run and an un-collected past must not read as a quiet market. ⚠ `day_0_trade_date` is the NEXT session, never `deal_date` — NSE publishes after the close, via `kd_day_zero_trade_date` with an 18:00 IST stamp (one implementation of that rule). No ISIN in the feed, so isin/equity_id resolve from the symbol and the unresolvable tail is counted. Owner runs it in pgAdmin; both tables start EMPTY. **216** = `km_migration_216_result_drift_dedup.sql` — one drift row per RESULT, not per announcement. Measured on the first live board-meeting backfill: 2,733 result events over **2,306 distinct meetings = 1.19 per meeting** (1→1,953, 2→298, 3→41, 4→9, 5→5), because one board meeting approves results AND declares a dividend AND appoints an auditor and each outcome is filed separately — so **427 of 2,733 rows were a second Day 0 for a result already counted**, over-weighting 353 companies by 15.6% in any cross-sectional study. ⚠ The FLAG is not wrong and is unchanged: those announcements really did come out of a results meeting, so the de-duplication lives in `kd_result_returns` where the double-counting harm is, not in `is_result_announcement`. The EARLIEST dissemination survives (it can never be later than when the market could first act) and `sibling_announcements` reports how many the meeting produced — a 15.6% phenomenon that vanished without a number would be unauditable. Two quarters close together stay two rows: two meetings, two ids. Holds no data; DROP/CREATE of a view and a function. **215** = `km_migration_215_result_drift.sql` — `returns_since_result`, DERIVED: `kd_result_returns(from, to, horizon_sessions)` + the `v_result_drift` view over it. No table, no dimension, no cascade edge — a third copy of a derivable number is how two readings of one rule start to disagree. ⚠ Two properties: **reaction_pct (Day −1 → Day 0) and drift_pct (Day 0 → end) are never merged** — measuring drift from Day −1 folds the announcement jump into it, which is how a PEAD study reports an effect it never measured; and **`suspect_corporate_action` must be filtered on in any study**, because `km_corporate_actions` is still EMPTY (D44) so a split inside the span reads as a genuine −50% drift, and results season is exactly when boards declare bonuses (same 0.55×/1.80× gate as `adjust_close_cliffs()`; it FLAGS rather than adjusts, to avoid a third implementation of corporate-action handling). The view is capped to ~120 days on purpose — a read path must not walk every bar since every result ever recorded; history is a function call. Owner runs it in pgAdmin; nothing else, it holds no data. **214** = `km_migration_214_board_meetings.sql` — `km_board_meetings` + `km_corporate_events.is_result_announcement`/`board_meeting_id`. The announcements feed CANNOT date a result: measured on 28,076 rows, there is no 'Financial Results' desc (a result is filed as 'Outcome of Board Meeting', 3,013 rows, alongside dividends and fundraising) and all three discriminators failed — filename 13%, 'fin' 16%, `hasXbrl` TRUE on 3,013 of 3,013. The PRIOR INTIMATION does say why the board is meeting, so it is a metadata join: no PDF, no classifier, no LLM. ⚠ `meeting_date` is NOT Day 0 — Day 0 stays with the outcome announcement's `exchdisstime` via `kd_day_zero_trade_date`. `results_basis` records whether `bm_purpose` named results outright (9.4%) or only the free text did (54.5% carry the generic 'Board Meeting Intimation'), so the keyword rule's weight is measurable rather than assumed. Owner runs it in pgAdmin; starts EMPTY, fills from the first `board_meetings_ingest`. **213** = `km_migration_213_derivation_check_class.sql` — adds `'derivation'` to the `km_integrity_findings` check-class CHECK. Migration 210 shipped `check_derivation_staleness` emitting that class while 178's constraint still listed four; `persist()` batches in one transaction, so one rejected row lost the whole sweep. **212** = `km_migration_212_filings_ingest.sql` — the filing-intelligence spine: `km_filings_raw` (append-only, never updated) + `km_corporate_events` (normalised, deduped) + `kd_day_zero_trade_date()`. ⚠ Day 0 derives from `exchdisstime` (exchange DISSEMINATION), never `an_dt` (company filing) — off by one there injects lookahead bias into every drift number downstream. Plan: `docs/claude/filing-intelligence-poa.md`. Prior: **211** = `km_migration_211_journey_stir_window.sql` — `km_wg_journeys.stir_first_date` + `stir_window_bars`, so the Stirring reading states a rate WITH its denominator ("9 of 41"). Deliberately NOT `stir_start_date`: `stir_days` is a tally over the last 60 bars and those bars are scattered (9.4 across a 41.3-bar span, 2.8% contiguous over 1,048 stocks), so a start date would be false for 97% of the population. Both NULL on archived rows — stirring is a property of now. ADD COLUMN nullable-no-default on ~1,700 rows is instant; values appear on the next wg_journeys run, no backfill, nothing to REFRESH. Owner runs it in pgAdmin. **210** = `km_migration_210_dimension_watermarks.sql` — `km_dimension_watermarks` (dimension, trade_date, computed_at, status, source, job_id, rows_affected), ~7,500 rows a year: WHEN each pipeline2 dimension was last computed for a date. Compared against a dimension's PARENTS (`DIMENSION_DEPENDENTS` inverted) it detects a row derived from superseded inputs — which no fill-rate check can see. Starts EMPTY on purpose (absent is unknown, never stale) and fills from the next daily run; `'partial'` stamps, `'failed'` never does. Grants SELECT to `authenticated`/anon/kd_app/kd_readonly. Owner runs it in pgAdmin; no REFRESH, no backfill. **209** = `km_migration_209_journey_base_rates.sql` — `km_journey_base_rates`, the nightly recorded outcome of the Waking Giants arc (closed/confirmed counts, confirm %, days to confirm, confirmed vs unconfirmed lifespan), keyed by `as_of` so the series is inspectable. Written by `scripts/compute_wg_journeys.py` **inside the same transaction** as the `km_wg_journeys` DELETE+INSERT it summarises, so a `fix` on the `wg_journeys` dimension recomputes it for free and the summary can never describe a different population than the rows on screen. Grants SELECT to `authenticated`/anon/kd_app (the migration-142 lesson) and seeds the current reading, so the UI has a row before the next nightly run. No RLS. Owner runs it in pgAdmin; nothing else required. **208** = `km_migration_208_leadership_snapshots.sql` — published sector-leadership snapshots: `km_sector_leadership_snapshots` (PK trade_date+category+months, months IN (3,6,12)) + `km_leadership_generation` + statement-level triggers on `km_index_constituents` and `km_index_symbols` that bump the generation, so any membership or catalog edit invalidates every published snapshot across all dates at once. Apply AFTER 207, then run `python scripts/refresh_sector_leadership.py`. **207** = `km_migration_207_sector_leadership.sql` — `km_custom_index_revisions` (revision vs computed_revision, so a stale calculation is detectable), `km_custom_index_membership_log` (seeded with a `baseline` row per custom index before later add/remove actions), `km_leadership_observations` (previous published payloads) and `km_custom_index_history_archive`. Neither migration deletes existing data or rewrites index prices, and neither recreates `km_scan_results`. Prior: 206 — `km_migration_206_onboarding_version.sql`, version-stamped re-onboarding: `km_profiles.onboarding_version INT DEFAULT 0` + the key added to `kd_update_profile`'s whitelist + a TARGETED stamp of `1` for everyone who already carries `persona_set_at` (2 of 17 on 2026-09-12). Replaces migration 165's blanket `onboarded = false`. Sending a cohort back through setup is now: bump `ONBOARDING_VERSION` in `src/constants/onboarding.ts`, then stamp whoever is exempt. Owner runs it in pgAdmin; no REFRESH needed; 205 — `km_migration_205_fpb_card_columns.sql`, Flower Pot card columns + ETFs out of the whole matview: mutual-fund units (`isin LIKE 'INF%'`) leave `active`/`wg_pool`/the exclusion-count universe, `km_equity_symbols.is_etf` is set from the same rule (it had been FALSE on all 16,938 rows since the column existed), the `flower_pot_burst` arm LEFT JOINs `stock` so it carries the shared card's columns instead of typed NULLs, three new columns `fpb_hi10`/`fpb_lo10`/`fpb_tight_today`, and `d_pct` stops being NULL on sixteen of the seventeen arms; **owner runs it then `REFRESH MATERIALIZED VIEW km_scan_results;` and `REFRESH MATERIALIZED VIEW km_scan_exclusion_counts;`**; measured effect on the 2026-09-07 bar: flower_pot_burst 106→68 rows with 67 of 68 carrying an industry, breakdown_watch 441→364, breakout_surge 295→277, conviction_flow stays at its cap of 50 with 12 real stocks replacing fund units; 204 = `km_migration_204_profile_persona.sql`, onboarding persona persistence: `km_profiles.persona/acts_on/hold_horizon/concede_level/persona_set_at/guide_progress`, `kd_update_profile` whitelist, `km_ux_events`; vocabulary mirrored in `src/constants/personaConfig.ts` and gated by `npm run check:persona` inside `npm run build`; plan: `docs/claude/onboarding-poa.md`; 203 = `km_migration_203_index_breadth.sql`, per-index breadth table + `compute_index_breadth()`; owner runs it then `python scripts/backfill_index_breadth.py`; 202 = `km_migration_202_gl_matview_arms.sql`, Golden Line arms + GL/Big Money bar columns on `km_scan_results`; 195/197/200/202/205 recreate the `km_scan_results` matview `WITH NO DATA`. **Convention as of 205 (gap audit C3): a migration that recreates it ENDS with the two `REFRESH` statements as executable SQL, after `COMMIT`** — a comment asking the next person to remember failed twice (200 on 2026-09-06, 205 on 2026-09-07), and each time every matview-served preset answered PostgREST with "materialized view has not been populated", which the UI shows as "Failed to run scan." on eleven scanners at once. Order matters: `km_scan_results` first, `km_scan_exclusion_counts` second (it SELECTs from the first); 200b is a suffixed duplicate). Older history: (166 = `km_migration_166_golarambh_almanac.sql` — Golārambha family: 4 generator-fed `planet_state` Sun rules (Uttara/Dakshina Gola halves + equinox ±1d turn windows, tag 'Gola'), windows from `scripts/generate_golarambh_windows.py` (TROPICAL equinox crossings — deliberately not the sidereal sankranti), almanac body in AlmanacPage + `astro_group:Gola` overlay; 165 = force-reonboard theme; 164 = forgot-password token leak; 163 = pricing GST beta default; NOTE 161/162 have DUPLICATE numbers (rule_evidence + scan_presets at 161, rule_evidence_transitions + user_bookmarks at 162); 160 = Mercury-slice launch catalog scope; see `docs/claude/astro-story.md`. ⚠ Numbering drifted: duplicates also at 152/153 and no 155 — always `ls App/DBscripts/ | sort` before picking a number, don't trust this line alone.)

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
services/scanEngine.ts   ← scan functions + data fetching + types
hooks/useScan.ts         ← React Query wrappers: useScan(), useAllScanCounts(), useScanPresets()
views/ScanView.tsx       ← page, sort, TradingView export, per-preset layouts
views/ScannerStudio.tsx  ← Studio layout for STUDIO_DESCRIPTORS presets
config/scannerStudio.ts  ← per-preset Studio descriptors (cards, levels, filters)
kd_scan_presets (DB)     ← preset metadata (name/description/tooltip/limit); fetched via fetchScanPresets()
km_scan_results (matview) ← the authoritative row source for the DB-served presets
```

### 24 Scan Presets, 5 Categories

`category` / `category_label` / `category_sort` live on each `ScanDefinition`
in `SCAN_PRESETS`. The `/scan` page renders them as category radio buttons
with sibling tabs (`docs/icp-scanner-experience.md`) — the older scanner
sidebar is gone.

| Category (`sort`) | ID | Display Name |
|---|---|---|
| **Price Action** (1) | `breakout_surge` | Breakout Surge |
| | `breakdown_watch` | Breakdown Surge *(ID kept on purpose — migration 189)* |
| | `weekly_movers` | Weekly Movers |
| | `monthly_movers` | Monthly Movers |
| | `weekly_decliners` | Weekly Decliners |
| | `monthly_decliners` | Monthly Decliners |
| | `flower_pot_burst` | Flower Pot Burst |
| | `gl_breakout` | Golden Line Breakout |
| | `gl_retest` | Golden Line Retest |
| **Stage Analysis** (2) | `stage_2_watch` | Stage 2 Watch |
| | `stage_2_leaders` | Stage 2 Leaders |
| | `stage_3_watch` | Stage 3 Watch |
| | `stage_4_leaders` | Stage 4 Leaders |
| | `vani_exit_watch` | VaNi Weakness Watch |
| **Flow** (3) | `power_buy` | Strength Confluence |
| | `conviction_flow` | Conviction Flow |
| | `volume_drive` | Volume Drive |
| **Market** (4) | `smart_money` | Smart Money Loading |
| | `quiet_accumulation` | Quiet Rising Flow |
| | `distribution_warning` | Falling Flow Warnings |
| | `power_sell` | Weakness Confluence |
| **Discovery** (5) | `wg_stirring` | Stirring |
| | `waking_giants` | Waking Giants |
| | `wg_ascent` | Ascent |

Display names drifted from the old ones — `quiet_accumulation` is now
**Quiet Rising Flow**, `distribution_warning` is **Falling Flow Warnings**.
The IDs are addresses (`?setup=` URLs, adapter registry keys,
`PRESET_COL_OVERRIDES`), so they never follow a rename. `fresh_breakout` no
longer exists.

**Adding a new scan**: (1) add `ScanDefinition` entry to `SCAN_PRESETS` in `scanEngine.ts`, (2) implement `scanXxx(bundle)` function, (3) register in the `SCAN_HANDLERS` dispatch map, (4) insert DB row via SQL migration into `kd_scan_presets`, (5) if it should carry a Studio layout, add a `StudioDescriptor` — and remember `lib/scan_contract.py` parses that file.

### ⚠ Highlight authority: the DB decides, the browser never reconstructs

Shipped 2026-09-13 (`docs/scanner-highlight-authority.md`). Breakout Surge
(and its old daily alias), Breakdown Surge, Weekly/Monthly Movers,
Weekly/Monthly Decliners and Flower Pot Burst read **`km_scan_results`
exclusively**. The frontend maps `vani_flag` — *including `false`* — and never
recomputes highlight eligibility. Flower Pot keeps its phase-specific columns
without overriding the flag.

The old client-side reconstructions were **deleted**, not left dormant:
`fetchBreakoutSurge`, `fetchBreakdownWatch`, `fetchPeriodMovers` and the whole
`computeFpbStock`/`fetchFlowerPotBurstClientSide` compression calculation —
~950 lines out of `scanEngine.ts`. Two implementations of one eligibility rule
is how a scanner silently disagrees with its own badge count.

Failure semantics are deliberate: a failed request or an invalid/missing flag
**fails visibly**; a successful empty result stays empty; an empty badge count
never falls back to the legacy scanner. Golden Line and the other families are
outside this change and still compute client-side.

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
- **`information_schema.role_table_grants` is BLIND over a restricted connection — read `pg_class.relacl`** (2026-09-14). Checking migration 209's grants through the read-only `kaala-postgres` MCP returned only `kd_readonly` for `km_journey_base_rates`, which looks exactly like the migration-142 failure (table shipped with zero `authenticated` grant). It was wrong: that view exposes only grants where the **current role** is grantor or grantee, so a `kd_readonly` connection can never see anyone else's. `relacl` told the truth in one query — `{vikuna_admin=arwdDxtm, anon=r, kd_app=arwd, kd_readonly=r, authenticated=r}`, every grant present. Use `pg_class.relacl` or `has_table_privilege('<role>', …)`; both are role-independent. This matters most for exactly the tables where it is tempting to skip the check, because a missing SELECT on a read-optional table fails **silently** by design.
- **Measure before inventing a threshold — and accept the answer when the data refuses to supply one** (2026-09-14). Price Action breakout re-entries cluster (SOLARA cleared its 20-day high five times in fifteen days), so a "suppress a repeat within N bars" cooldown looked obviously right. The gap distribution across a 1-in-37 NSE sample, 566 entries, came back 12.5% / 9.2% / 20.8% / 40.8% — smooth, no cliff, no natural break. The correct outcome of checking the distribution is sometimes **no threshold at all**: any N would have been taste wearing the costume of a rule, silently dropping real events. Density got solved structurally instead (bottom priority in the story table). The house rule is "check the distribution first"; this is the case where checking it says *don't*.
- **A rare-event assumption is load-bearing even where nothing states it** (2026-09-14). `thesis.ts` picked its "Recent signals" with `slice(-8)` — correct for years, because every event kind was rare. Phase 2 added a kind that fires 22 times in 74 bars and the list would have filled with it, evicting the Big Money day and the journey confirmation, and degrading the tab's headline sentence (which reads `signals[0]`). Nothing in the type or the call site said "this assumes events are rare". When adding a high-frequency member to a shared stream, audit every CONSUMER that trims it, not just the producer — the chart was already immune because `eventAtBar` resolved by priority; the list had no equivalent rule.
- **A derivation starved of warm-up reports "none", not "I could not look"** (2026-09-15). `fpbEvents` needs 61 bars and returns `[]` below that; the chart fetched exactly the user's range, so Flower Pot was **never evaluated once on a 1M chart** and reached 2 of 62 bars on a 3M one. Nothing errored, nothing looked wrong — the absence was indistinguishable from a genuine absence, which is the worst shape a data bug can take. Before adding storage to "fix" a missing signal, check whether the derivation is merely being starved: the cure is usually warm-up bars, not columns. And whatever the cure, make the blind zone **sayable** (`storyCoverage`) so the gap can be named rather than silently reported as zero.
- **An affordance can be present, reserve its space, and still be invisible — and "it works in dark" is not evidence** (2026-09-18). The global scrollbar thumb was `rgba(255,255,255,0.22)` in BOTH modes, with no `[data-mode="light"]` sibling although every other mode-sensitive value in `globals.css` has one. Over the light canvas it composites to **1.03:1 against its own background**. Nothing errored, the gutter was always reserved, and the scanner table clipped its last two columns with a bar you could not see to drag. Dark measured **1.97:1** — thin but perceptible, which is exactly why it survived seven months and got patched around TWICE locally (`.market-structure-history-scroll`, `.flow-scroll`, whose comments both said "override the global translucent-white scrollbar") instead of fixed at the root. Three things worth keeping: (1) **the standard properties beat the pseudo-elements** — on Chrome 121+/Safari 18.4+, setting `scrollbar-width` or `scrollbar-color` makes that element's `::-webkit-scrollbar` rules *ignored*, and this app sets both on `*`, so the entire webkit block is dead on a current browser and must not be used to size a layout; (2) **a per-theme body-copy token is not a UI-contrast token** — `--text-muted` measured a fine 3.48:1 on Vikuna Black light and **2.34:1 on Jade Thorn light**, so the thumb derives from `--text-primary` (by definition the highest-contrast ink in every palette) at a measured alpha, light 55% / dark 42%, verified 3.5–3.9:1 on `--bg` AND `--card` across both themes; (3) **verify in a browser, and check the measurement before the code** — headless Chromium here paints no scrollbars at all so screenshots prove nothing, and the first contrast script reported a correct dark thumb as 1.04:1 because Chrome serialises `color-mix()` as `color(srgb r g b / a)` with **0–1** channels while hex/`rgb()` are 0–255. Same lesson as the BreadthLadder stub. Guarded by `scripts/qa/check-scrollbars.mjs`, verified to fail against the original white literal, a `--text-muted` thumb, a dropped light override, and the stray brace that silently killed the `*` rule.
- **`body { overflow-x: hidden }` does not clip an element — it deletes the window's horizontal scrollbar** (2026-09-18). On `body`, with `html` left at `visible`, that value PROPAGATES TO THE VIEWPORT. So anything wider than the page was unreachable *and* unannounced. Measured across all 33 routes before removing it: at 1440px **nothing** overflowed, so the rule protected nothing on desktop; at 390px exactly four routes did, and every one was content a phone user could not get to — `/account` **+233px** (the whole tab strip past "Plan & Billing"), `/panchang` +77px (month/year controls), `/astro-calendar` +63px (header actions), `/workspace` +50px. The worst was not in any page: **Layout gave `/workspace` `flex-row` at every width** while every other docked route stacks, so a fixed 360px VaNi pane plus 32px padding needed 408px and the workspace column computed to **width 0, pushed off the right edge** — the phone showed a VaNi pane and no workspace at all. Fixed at the source in `Tabs` (underline variant is a scroll rail, not a wrap — the active tab's 2px `borderBottom` aligns to the container border via `-mb-px`, so a wrapped row leaves it floating), `PageHeader`, `PanchangView`, `WorkspacePage` and `Layout`, then the rule was deleted. ⚠ **Never reinstate it to silence an overflow** — a page-wide horizontal scrollbar is the symptom, the offending row is the bug. Guarded by `scripts/qa/check-page-overflow.mjs`, which asserts three separate things because the first version asserted only the last one: every route **renders** (a JSX syntax error in `PageHeader` made all 33 routes 500 and the sweep cheerfully reported "ok" — a blank page overflows nothing, and a check that cannot fail is worse than no check), the viewport is **not clipped** (else the sweep is blind, and reinstating the clip becomes the way to make it pass), and nothing **overflows**. Verified to fail against six sabotages, each with its own message: FAIL / CLIP / DEAD.
- **The hardcoded array is the FALLBACK; the DB row is the live metadata** (2026-09-18). `getPresetMeta()` reads `kd_scan_presets` first and only falls back to `SCAN_PRESETS` in `scanEngine.ts`. Changing `universe` in the array to admit BSE would have shipped a scanner whose matview served BSE rows and whose UI refused to show them, because `ScannerStudio` disables the BSE tab from `meta.universe`. Anything that array and that table both carry has to move in the same migration. Same shape as the `is_etf` column that was FALSE on all 16,938 rows: the definition lived in one place and the consumer read another.
- **A UNION takes its column NAMES from the first arm** (2026-09-18). Adding three columns to all 17 arms of `km_scan_results` as bare `NULL::date, NULL::int, NULL::numeric` produced columns actually named `date`, `int4` and `numeric` — Postgres named them after the cast, because only the first arm (`power_buy`) aliases anything. The matview created without complaint and `SELECT gl_event_date` then failed. Alias in every arm. Two more traps in the same migration, both caught only by running it: replacing the file header cut away the `BEGIN;` and the two `DROP MATERIALIZED VIEW IF EXISTS … CASCADE;` statements, so it could not run against a database that already had the view; and one of the 17 arms (`flower_pot_burst`) terminates `FROM fpb f` rather than `FROM x WHERE rnk <= N`, so a regex over the common shape silently patched 16. **Generate a matview recreate by script from the previous one, then apply it to a throwaway cluster with fixtures before shipping** — `/usr/lib/postgresql/16/bin/` is present in the dev container.
- **RLS on pipeline-computed tables**: don't add RLS to aggregate tables (`km_industry_eod`, etc.) — they contain no user data and RLS creates silent access bugs when `kd_app` role differs from `authenticated`.
- **`auth.*` is Supabase-only — this deployment shimmed it in migration 149 (2026-07-14)**: RLS policies and `public.is_admin()` call `auth.uid()`/`auth.role()`/`auth.jwt()`, which exist on Supabase but NOT on self-hosted PostgREST. For a long time no migration DEFINED them (8 referenced, 0 defined), so every `auth.*`-based policy *errored at evaluation* — hidden because most tables have RLS OFF and admin writes go via FastAPI (`kd_app`). It surfaced as "permission denied"→then a silent `is_admin()` error on `km_index_constituents` (the one RLS-ON table with an `is_admin()` write policy) when custom-index saves (direct PostgREST) broke. Migration 149 defines `auth.uid/role/email/jwt` over `current_setting('request.jwt.claims', true)` — the same idiom `kd_update_profile` uses. If you add a new RLS policy, `auth.uid()`/`is_admin()` now work; if `is_admin()` ever "does nothing," first check the `auth` schema still exists. Also: two DB roles matter — logged-in users are `authenticated` (migration 144 reverted `kd_auth_login` to issue that for everyone, admins included), so any RLS-ON table needing admin writes must grant the verb to `authenticated` AND rely on `is_admin()` for authorization (e.g. migration 148).
- **Warm-up windows sized in CALENDAR DAYS are cadence-blind** (migration 169, 2026-08-06). `compute_indicators_batch` (`300 days`) and `compute_magic_rs_batch` (`350 days`) are also called on `km_equity_weekly`/`km_equity_monthly` by `pipeline/compute/_indicator_chain.py`. The same window loads ~43 weekly bars and ~10 monthly bars, below every indicator's minimum (`IF i >= 50`, `IF i >= 20`, Wilder-14) — so they wrote NULL **while still stamping `indicators_computed_at = NOW()`**, making the row look computed. After the 2026-08-06 backfill: monthly `rsi_14`/`ema_20`/`sma_50` were 0/3,257 for May–Jul even for RELIANCE and TCS, which hold all 80 monthly bars. magic_rs failed harder — long MagicRS sits inside `IF n >= 145` (weekly never reached it) and monthly tripped `IF n < 22 THEN RETURN 0` before writing anything, which is why monthly `magic_rs` had been NULL *since the table existed*. Two consequences worth remembering: (1) a resume marker written unconditionally is worse than none — `... AND indicators_computed_at IS NULL` in the UPDATE means a re-run **skips** the rows it corrupted, so any fix must clear the stamp first; (2) **monthly long MagicRS is structurally impossible** — 145 monthly bars is ~12 years and the deepest symbol has 80, so monthly carries `magic_rs_short` only. When a function is shared across timeframes, size every lookback by bar count, not by date arithmetic.
- **Coverage metrics**: `coverage_pct NUMERIC(5,2)` overflows on multi-date RPC results. Use `NUMERIC(7,2)` and cap at 999.99 in Python.
- **Monitoring gap CLOSED 2026-08-24 (migration 178)**: `lib/integrity_checks.py` adds the three missing check classes (reconciliation / invariant / staleness) + step-failure detection; `lib/alerting.py` adds the alert channel that did not exist (opt-in `ALERT_WEBHOOK_URL`, or `ALERT_EMAIL_TO` + `SMTP_*`; no-ops when unset); findings persist to `km_integrity_findings`; the `integrity_checks` pipeline2 dimension runs LAST and reports **failed** on any critical finding, so a silent data bug turns the Pipeline Dashboard red. Calibration that matters: reconciliation scores CASH-EQUITY series only (via the `unmatched_by_series` metadata) — NSE legitimately drops ~279 debt/bond symbols a day (GB/GS/TB/N*/SG/Y*/Z*), so a raw unmatched% check would cry wolf nightly and get muted; the equity-only view is silent today and fires critical at 61% on the universe-gap shape. Run manually: `python scripts/run_integrity_checks.py [--dry-run|--test-alert]`. **First live run (2026-08-24) immediately paid for itself twice**: it caught that migration 178's cleanup was incomplete (monthly bars carry each stock's OWN last trading day, so 80 partial-August rows survived on 08-03/08-04 — fixed in migration 179, and the check now counts the whole month) and that `dot_svd/dot_sbd/dot_syd` had gone all-FALSE again since 2026-08-03 because `scripts/compute_dots.py` was never wired into pipeline2 at all — Volume Drive was inert. Now the `dots` dimension, running before `scan_refresh`. Original audit finding kept below for context.
- **Health checks measure PRESENCE, not CORRECTNESS — and nothing pushes** (audited 2026-08-03). All ~20 checks in `lib/health_checks.py` / `pipeline2/health.py` reduce to column fill-rate, row count, or step exceptions. The 19:30 gap sweep auto-enqueues `fix` jobs for `missing`/`partial` days — it is a self-healing loop, not a monitoring loop, and only logs on its own infra failure. There is **no alert channel anywhere in the backend** (`grep alert|notify|smtp|telegram|webhook` over `pipeline2/`+`lib/` → zero hits); the Pipeline Dashboard is pull-only. Consequence: three real bugs ran green for months — NSE `value_cr` inflated 1e5× (column 100% populated → green), 2,104 NSE symbols dropped daily (1,334 rows arrive consistently → green), and `dot_svd`/`dot_sbd`/`dot_syd` all-`false` since 2026-04-06 (columns populated, just degenerate → green). Worst part: `unmatched_count: 2104` **is already written to `km_pipeline_runs.metadata` every run and nothing ever reads it**. Three check classes are missing: **reconciliation** (parsed vs inserted — would have fired at 61% on day one), **invariant/plausibility** (e.g. `value_cr ≈ volume*close/1e7`, cross-exchange consistency), and **signal staleness** (boolean column with zero TRUE across the universe for N days). Add the check class, not just the one-off fix.
- **KaalaDristi voice is observational**: "Strength Confluence" not "Power Buy". Surface conditions, don't issue trade commands.
- **D39 — ROC badge language (SEBI)**: ROC badge states use neutral participation vocabulary — `expanding / slowing / turning / contracting / warming_up`. Never use bull/bear/uptrend/downtrend in any badge, label, or tooltip. `ROC_BADGE_MAP` in `BreadthRocChart.tsx` is the single source of truth.
- **D40 — Breadth formula uses ema_20 + sma_50 + sma_150**: `fetchIndexBreadth` uses `ema_20` (true EMA) for p20, and `sma_50`/`sma_150` (SMAs) for p50/p150. This is a conscious deviation from Breadth_ROC_Spec_v1.0 §2 which specifies EMA50/EMA150 — those columns don't exist in `km_equity_eod`. Adding them is deferred; the signal quality difference at these window lengths is minimal. NOTE this describes the per-index CONSTITUENT breadth only — the market-wide `km_market_breadth` score (D44) is all-EMA, computed in Python, and is a different pipeline.
- **D44 — Market-wide breadth read ~8 pts low; fixed 2026-07-24** (`compute_market_breadth.py`, `compute_breadth_roc.py`, new `lib/breadth_common.py`): breadth score was 35.8 vs 43.4 at the reference source (Value Picker) on the same day. Three stacked causes: (1) **phantom denominators** — pandas `ewm` over the calendar pivot carries EMAs through NaN closes, so ~120 delisted/suspended NSE stocks kept "valid" EMAs forever and counted as *below MA* in every pct denominator (~−3 pts); EMAs are now computed per stock over its own traded bars (`_ema_traded_bars`) so a non-traded day has no EMA and drops out of numerator+denominator. (2) **unadjusted corporate actions** — `km_corporate_actions` is EMPTY (0 rows), closes are raw bhavcopy; splits/bonuses (64 traded stocks with >40% one-day cliffs in the trailing year) inflate long-memory EMAs so stocks read "below 150-EMA" for months post-split, and registered fake −50% movers/ROC on ex-dates. `adjust_close_cliffs()` in `lib/breadth_common.py` back-adjusts single-day moves <0.55× or >1.80× (impossible as genuine moves under NSE ±20% price bands; ignores gaps >10 sessions so suspension-returns aren't misclassified). Populating `km_corporate_actions` with real adj_factors is the structural fix — owner decision, affects sma_150/w52_high/d365_pct_chng too. (3) **label bug** — `MarketBreadthChart`/`BreadthHeatmap` said "50 SMA/150 SMA" but the data is all-EMA; labels fixed. Remaining ~3-pt gap vs Value Picker is universe size (our 1,322 traded NSE vs their 1,466 — they include young listings in all denominators, we require full warmup). After deploying, re-run `python compute_market_breadth.py --all` and `python compute_breadth_roc.py --all` to rebuild history. `pipeline2/handlers.py` import surface (`load_closes/compute_breadth/upsert`) unchanged — re-exported via `lib/breadth_common.py`.
- **D41 — custom index synthetic EOD + index returns are now wired into the PRODUCTION daily run** (migration 119): the production scheduler is **pipeline2** (`daily_run` job at 18:00 IST → `orchestrator.DAILY_STEPS`), which calls the legacy `run_nse_pipeline` with `skip_indicators=True` — so legacy compute steps (including 6d/6d2) NEVER run in production. The real fix is the pipeline2 dimension **`index_returns`** (`handlers.handle_index_returns`), which runs `compute_all_index_returns` → `compute_custom_index_eod(from,to)` (RPC, migration 119) → `compute_all_index_scores` in that order, so Sector Rotation 5D/22D/66D + scores populate for ALL indices (standard and `category='custom'`) every run. Legacy steps 6d/6d2 remain for CLI/backfill use only. `scripts/compute_custom_index_eod.py` now calls the same RPC (full history, or a fast `--from YYYY-MM-DD [--to YYYY-MM-DD]` range) and remains the backfill to run when a new custom index is created (it also refreshes scores via `compute_all_index_scores()`). Still open: the pipeline step computes equal-weight `close/ret_5d/22d/66d` only — `rsi_14` and `flow_type` require Step 0d/0e extension (B78), so the signal badge in SectorRotationTable stays blank for custom indices until B78 is resolved.
- **D42 — Custom Index Discover (Path 2) architecture**: Admin types a theme name → Sonnet scans liquid active NSE stocks → identifies matching companies using training knowledge → suggests sector lord + zodiac sign from `km_sector_lords`/`km_sector_zodiac` → admin reviews, edits, saves. Qwen3 is not suitable for this task (insufficient knowledge of Indian mid/small caps). Claude Sonnet is the only viable LLM for Path 2. Backend endpoint at `POST /api/custom-index/discover` deployed; architecture rework (B76) needed before production use. Discovered themes persist in staging table `km_discovered_themes` (migration 120, status `new`→`used`/`dismissed`); DiscoverPage loads `status='new'` rows on mount via `GET /api/custom-index/themes`, updates via `PATCH /api/custom-index/themes/{id}` — no LLM re-invoke needed to revisit past recommendations. Universe = active NSE + **BSE-only additions** (ISIN has no active NSE listing, ≥ ₹1 Cr daily turnover — 167 of 2,900 qualified at calibration 2026-07-05); `delivery_surge_x` never fires for BSE (no delivery data), so BSE scores out of 4 signals. `CustomIndexCreatePage` mirrors the same NSE-priority ISIN dedup and renders BSE scrips via `displaySymbol()` + BSE badge (universe fetch shared via `services/equityUniverse.ts`). Discover passes existing custom-index names + all staged theme names to the LLM as exclusions (no token waste re-proposing known themes). `CustomIndexManagePage` (`/custom-index/:id/manage`, ✎ Manage button on list page) edits an existing index: manual add/remove of constituents (direct PostgREST on `km_index_constituents`) + `POST /api/custom-index/{id}/suggest` for AI new-stock suggestions scoped to that theme (constituents excluded from the universe SQL). `CustomIndexManagePage` and the list page both have an **⚡ Calculate** button → `POST /api/custom-index/{id}/compute` (migration 122 adds `p_index_id` scoping to `compute_custom_index_eod`): recomputes this index's full synthetic EOD history + refreshes all index scores on demand, so a newly created/edited custom index reflects in Sector Rotation immediately instead of waiting for the next daily pipeline run. Migration 123 extends the synthesis with `pct_chng` (AVG of constituents — heatmap micro-trend bars, %Chg column) and `value_cr` (SUM — heat tooltip traded value); without it curated rows render flat micro-trends and "—" %Chg. **Targeted discovery** (`POST /api/custom-index/target`, migration 121): admin types a theme name → LLM classifies the FULL liquid universe (no signal gate — `_fetch_liquid_universe`) into **core** (direct revenue exposure) vs **ecosystem** (suppliers/enablers); persisted with `source='targeted'` + `detail` JSONB; DiscoverPage renders the core/eco split with a 🎯 badge. The original `/discover` flow remains signal-first (clusters only currently-signaling stocks; no core/eco distinction).
- **D43 — `km_sector_zodiac` table added in migration 118**: Maps sectors to zodiac signs (many-to-many). Columns: `id SERIAL PK`, `sector_id FK → km_sectors`, `zodiac_id FK → km_zodiac_signs`, `UNIQUE(sector_id, zodiac_id)`. 51 mappings seeded. Used for astro tagging of custom indices in Path 2 discovery.
- **No-fallback note — constituent warm-up exclusion**: `fetchIndexBreadth` excludes constituents with `ema_20/sma_50/sma_150 = 0 or null` from each ratio's denominator. This is hygiene (new listings without sufficient price history), not a fallback — the denominator is the count of stocks with valid data, not total stock count.
- **`v_equity_eod_deduped` cannot take an `equity_id` filter inside its DISTINCT ON — read the table when the ids are explicit** (2026-09-07). The Workspace "breadth & momentum" panel (`fetchIndexBreadth`) filtered the deduped view to an index's constituents; Postgres sorted the ENTIRE active universe for the lookback window (~290k rows × every column) before filtering to 50 stocks — 3.9 s for NIFTY 50 on a quiet DB vs 8 ms from `km_equity_eod` via `idx_equity_eod_equity_date`. The 252-session lookback (2026-08-28) quadrupled the sort and the panel stopped loading. Constituents are explicit equity_ids (one listing each), so the ISIN dedup was never needed; the fetch now reads the table in 10k-row pages (NIFTY 500 × 404 days is ~136k rows — one unbounded request is at the mercy of PostgREST max-rows, which truncates silently from the NEWEST dates). Rule: the deduped view is for universe-wide reads; a filter on a non-DISTINCT column does not push down. **Same day, owner decision "pipeline enabled and consistent": migration 203 adds `km_index_breadth` (index_id, trade_date — the same pct_above/score/thrust/ROC numbers the browser computed) filled nightly by pipeline2 dimension `index_breadth` via `compute_index_breadth(from, to, index_id)`, backfilled by `scripts/backfill_index_breadth.py`, refreshed for one index by the custom-index Calculate endpoint. `fetchIndexBreadth` reads the table first and keeps the constituent computation only as the fallback for an index with no rows yet.** Market-wide breadth (`km_market_breadth`) is a separate, all-NSE, EMA-based pipeline (D44); per-index uses ema_20/sma_50/sma_150 (D40).
- **Two pipelines against one DB collide on the step advisory lock** (2026-09-07). `km_pipeline_runs` showed the VPS scheduler AND a Windows dev-machine run (`D:\projects\…`) both processing 2026-09-03; the second `nse_magic_rs` waited 600 s on `_step_lock` and recorded `failed`, the step then completed normally, and the nightly `integrity_checks` still reported the day critical. `check_step_failures` now downgrades a failure to warning when a later job for the same dimension + trade_date completed. Do not run `daily_pipeline` locally against `DB_PRIMARY` while the VPS scheduler window (12:30–19:30 IST) is open. Same session: `check_scanner_contract` had raised "scan contract source missing" every night since deploy — the backend image has no frontend source; docker-compose now bind-mounts `./App/frontend/src` read-only at `/frontend/src` (redeploy with `docker-compose up -d` to pick it up).
- **Two breadth pipelines, one chart component — they are NOT comparable** (2026-09-09). `MarketBreadthChart` renders both, which is why `/workspace` and `/market-structure` invite a comparison they cannot survive. `/market-structure` passes no `data` prop and self-fetches `km_market_breadth` (ALL NSE, ~2,944 stocks, all three legs EMA, computed in pandas over **cliff-adjusted** closes — D44). `/workspace`, `/chart/index/:id` and `/sector-rotation/:id` inject `useIndexBreadth` → `km_index_breadth` (one index's constituents, `ema_20` + **`sma_50`** + **`sma_150`** — D40 and migration 203's own header — read from stored columns computed on RAW closes, so no corporate-action adjustment). Weights are the same (0.50/0.30/0.20); nothing else is. On 2026-09-09: All NSE 43.25 over 2,944, NIFTY 50 25.20 over 50. **Do not "fix" a divergence between these two — they measure different things on different bases.** Fixed the same day: the chart hardcoded "50 EMA/150 EMA" for both sources (the exact mislabel D44 fixed for market-wide, reintroduced by the per-index path) — labels now follow a `maBasis` prop defaulting from whether the series was injected. Also: the 22D/44D/66D toggle only ever changed the CHART SPAN, never the headline score or the MA pills (those read `data[data.length-1]`, the newest bar, which is the same bar at every window) — and on injecting pages it changed nothing at all, because the parent fetched at a fixed 66 while the toggle keyed only a discarded internal fetch. Both charts now fetch the max window once, gated on the external-data CONTRACT (`data` **or** `isLoading` passed — not on whether data has arrived, or the query still fires once during load), and slice locally.
- **PostgreSQL `CREATE OR REPLACE VIEW` ordinal rule**: new columns must be appended to the end of the SELECT list. Inserting in the middle shifts all subsequent columns and causes a `cannot change name of view column` error (hit in migration 117).
- **One eligibility rule, one implementation — delete the loser** (2026-09-13). Seven Price Action scanners had their qualifying logic in TWO places: the `km_scan_results` matview arms AND ~950 lines of TypeScript in `scanEngine.ts` (`fetchBreakoutSurge`, `fetchBreakdownWatch`, `fetchPeriodMovers`, `computeFpbStock`/`fetchFlowerPotBurstClientSide`). Two implementations of one rule do not stay in agreement; they disagree silently, and the badge count is where it shows. The fix was not to reconcile them but to **delete the client-side ones** and map `vani_flag` straight through — *including `false`*, because "no flag" and "flag is false" are different answers and only the DB knows which. Matching failure semantics matter as much as the happy path: a failed request or a missing/invalid flag now **fails visibly**, a successful empty result stays empty, and an empty badge count never silently falls back to the old path. `docs/scanner-highlight-authority.md`.
- **Never publish a derived reading from an incomplete source run** (2026-09-12). `run_daily` publishes leadership snapshots only on `overall_status == 'completed'`, and publication is transactional across all 5 scopes × 3 windows. The tempting alternative — publish what succeeded — produces a reading that looks finished and is not, which is strictly worse than yesterday's clearly-dated snapshot. Retaining the older dated snapshot is the correct degraded state. A failed publication is also its own step: it must not mark a successful index calculation as failed, nor be hidden by one.
- **Read paths must not be able to trigger heavy work** (2026-09-12). Sector leadership renders from one published JSON payload plus a snapshot hash — no constituent scanning, no index calculation, no LLM call on the read. An unprepared date shows a preparation message instead of computing on demand. The moment a page load *can* run the expensive job, one impatient refresh becomes an outage.
- **A prompt is not a safe place to do arithmetic, and a "Use:" list is not a vocabulary** — both already cost us a wrong answer in production (see the signed-number entry under Known Issues). The research companions apply the same rule at scale: every comparison is precomputed into a sentence before the model sees it, and the model receives a *validated snapshot*, never rows to interpret. Where two readings exist on different bases (Current Flow vs Longer-Term Leadership; per-index vs market-wide breadth), the prompts are explicitly forbidden from combining them into one score — and the tests assert it, because a plausible-sounding merge is exactly what a small model will volunteer.
- **Version the cache key, not just the content** (2026-09-12). `km_vani_cache` keys include intent id + intent **version** + depth + period + a hash of the exact data snapshot. This buys two things a TTL cannot: a same-date data correction changes the hash so a stale reading can never be served, and bumping a family's `VERSION` retires every misleading cached explanation in one line. Both `sector_vani.VERSION` (8) and `market_structure_vani.VERSION` (2) have already been bumped for exactly that reason.
- **`prefer_local` meant Qwen-ONLY, and that was load-bearing for older callers** (2026-09-12). Market Structure needed Qwen-first *with* cloud fallback, so `complete_with_source` gained a separate `allow_cloud_fallback: bool = False` rather than changing what `prefer_local` does. Widening the existing flag would have silently moved every older Qwen-only caller onto a paid cloud path on each Qwen hiccup. When a flag's meaning needs to change for one caller, add the second flag.
- **`concede_level` no longer derives the persona — but still selects the breadth leg** (2026-09-13). The weighted persona table (hold_horizon 2, acts_on/concede_level 1.5 each) is **gone**: onboarding now asks two plain-language questions, holding period sets the starting persona, discovery preference covers "still exploring", and exit preferences are saved as research settings that no longer classify anyone. What did NOT change is the ICP→breadth-leg mapping (`constants/breadthLegs.ts` / `_CONCEDE_LEG` in `vani_assemblers.py`): `tight`→20 EMA, `swing_low`→50 EMA, `structure`→150 EMA still keys the opening brief. Two different jobs for one column — do not "clean up" one by removing the other. `npm run check:persona` still gates the migration-204 vocabulary.

---

## Known Issues

### ✅ Research companions: DB state verified live (2026-09-14)

Migrations **207 and 208 are applied and working** — checked against the live
DB, not assumed:

- All six tables exist (`km_custom_index_revisions`,
  `km_custom_index_membership_log`, `km_leadership_observations`,
  `km_custom_index_history_archive`, `km_leadership_generation`,
  `km_sector_leadership_snapshots`).
- Both migration-208 invalidation triggers are installed and **enabled**
  (`km_leadership_membership_changed` on `km_index_constituents`,
  `km_leadership_catalog_changed` on `km_index_symbols`).
- `km_leadership_generation.generation = 0` — no membership or catalog edit has
  invalidated a snapshot since the migration landed.
- **15 published snapshots = 5 category scopes × 3 windows**, exactly as the
  publication contract requires, all for `2026-09-11`.
- That date **is** the latest bar in both `km_index_eod` and `km_equity_eod`,
  so leadership is fully in step with the pipeline — no gap, nothing to
  re-prepare. 38 custom-index revision rows, **0 stale**
  (`revision <> computed_revision`).
- Only one date is prepared. Historical date selection still needs
  `refresh_sector_leadership.py --from … --to …` for whichever earlier
  sessions you want to inspect.

The companions have also been **exercised live**: `km_vani_cache` holds 35
`sector.*` and 17 `structure.*` entries with real `hit_count`s, newest
2026-09-13. So the earlier "no live model invocation" caveat is retired — but
see the routing finding immediately below, which that live data exposed.

Still genuinely open (fixtures only, unchanged):

- **Live model answers not yet reviewed** for the four index-detail questions
  at each explanation depth, including the unavailable-data and small-sample
  paths (`docs/vani-intent-todo.md`).
- **Contrast/spacing not confirmed on every product theme** — automated
  coverage is dark/light at mobile and desktop widths only.
- **Cross-worker advisory locking and phone interaction** were never exercised
  outside fixtures.
- `scripts/refresh_sector_leadership.py` live run duration is unmeasured.

Pre-existing build warnings (bundle size, Browserslist age, one ambiguous
Tailwind class) are unchanged and were not introduced here.

### ⚠ There is no Haiku fallback in the deployed config — both paths are Qwen

Found 2026-09-14 by reading `km_vani_cache` on the live DB. The companions
were built to be **Qwen-first with a configured cloud fallback**, and
`docs/market-structure-vani-handoff.md` states the precondition plainly:
*"Your configured cloud provider/model must point to Haiku."* On this
deployment it does not.

`llm_model` is written from `_AI_MODEL` (the `AI_MODEL` env var) whenever the
answer did not come from the dedicated local path, so the cache records the
configured cloud model directly. Recent rows say:

| `llm_provider` | `llm_model` | entries (30d) | what it really is |
|---|---|---|---|
| `openai` | `Qwen3-4B-Q4_K_M.gguf` | 43 | `_primary_complete` → **local Qwen**, via its OpenAI-compatible API |
| `qwen-local` | `qwen-local` | 3 | `_fallback_complete` → local Qwen |
| `qwen-local` | `claude-haiku-4-5` | 33 | older `scanner.*`/`fpb.*` writers (they stamp the config constant, not the served model) |
| `anthropic` | `claude-haiku-4-5` | 36 | **last one 2026-09-04** — before the provider was switched |

So `AI_PROVIDER` is an OpenAI-compatible endpoint serving `Qwen3-4B-Q4_K_M.gguf`.
`allow_cloud_fallback=True` therefore falls back **to the same Qwen server** —
it is redundancy, not a second opinion, and no answer has been served by
Anthropic since 2026-09-04.

Two consequences worth acting on:

1. **`_fallback_complete` is failing most of the time.** `prefer_local=True`
   tries it first, yet only 3 of 30 recent sector answers carry
   `provider='qwen-local'`; the other 27 (and all 13 `structure.*`) were
   rescued by the fallback branch. The feature looks healthy precisely because
   the fallback works — the primary local path quietly is not. `scanner.*`
   does reach `qwen-local` normally, so this is specific to the companion
   path (its prompts are far larger — snapshot plus precomputed comparisons).
2. **`llm_provider` and `llm_model` cannot be read as a pair.** Two writers
   populate them with different conventions, which is how the "qwen-local +
   claude-haiku-4-5" combination exists at all — a combination the companion
   modules' own conditional makes impossible. Trust `llm_provider` for the
   branch and treat `llm_model` as "the configured model at write time".

Neither is fixed here — both are deployment/instrumentation issues, not code
this session changed.

### ⚠ `prefer_local` still does not reach the legacy `/api/ai/*` family

Unchanged and re-verified 2026-09-14: `pipeline2_api.py` has **15 `_ai_complete(`
call sites**. The `/api/vani/ask` family and the five `fpb.*` endpoints route
Qwen-first and apply `_sebi_post_filter`; the remaining legacy `GET /api/ai/*`
endpoints — panchang-insight, breadth-insight, breadth-roc-insight,
instrument-insight, market-pulse-insight — still go straight to the cloud
provider **and still skip the SEBI filter**. `allow_cloud_fallback` exists in
exactly three places (`ai_client.py`, `market_structure_vani.py`,
`sector_vani.py`) and was deliberately not spread further.

### Onboarding: version-stamped re-onboarding + the step-3 skip (2026-09-12)

Owner: onboarding "does not lead to theme and pricing pages", and existing
users must be forced through it again. Options discussed; owner picked
**version stamp + targeted first run**.

**The skip — confirmed and fixed.** `ProfileSetup.handleBrowse` ("Customize
in Catalog →" on step 3) did `setStep(6)`, jumping past step 4 (How VaNi will
guide) AND step 5 (Plan). Anyone taking that exit finished onboarding having
never been shown pricing. `browseIntent` already remembers to land them in
the catalog at the end, so the short-circuit bought nothing; it now walks
4 → 5 → 6 like "Start here →". Theme was always reached on that path — step 6
is where `onboarded` flips — so **if you also lost the theme step, that is a
second defect and I have not found it.**

**Version stamping, not another blanket clear.** Migration 165 did
`UPDATE km_profiles SET onboarded = false`: works once, indiscriminate, and
it disarms the ProfileSetup guard that stops a user re-walking the wizard.
`onboarding_version` (migration 206) records which flow a profile completed;
`needsOnboarding()` in `constants/onboarding.ts` is the single predicate both
ProtectedRoute and the wizard's own guard use — if they disagreed the user
would bounce between /setup and /workspace forever. `finishOnboarding` stamps
the version in the same write that flips `onboarded`, for the same reason.
Version 1 = the persona/ICP flow; the version log in that file must say what
each bump was for.

**Why bother: 15 of 17 profiles carry no ICP.** That is what makes the VaNi
opening brief personal (`concede_level` → breadth leg), so without the
re-onboard almost every user gets the generic market read.

**"Keep my current workspace →"** — step 3's third exit, shown only to a
returning user who arrived with their own arrangement. `applyTemplate`
REPLACES blocks and chart_overlays wholesale and both other exits call it, so
without this a version bump resets every customised workbench. ProfileSetup's
own guard comment records that exact bug from the last forced re-onboard.

**Two traps in deciding "do they have a workspace", both found by test, both
would have shipped:**

1. Reading `framework.blocks` at render time answers *has*, not *had* — the
   wizard can add blocks before step 3 reveals its actions. Latched once on
   first load instead.
2. `blocks.length > 0` is **never false**: `loadFramework` bootstraps a
   default NIFTY 50 chart block into any framework lacking one and saves it
   (`frameworkStore` ~line 262), so a brand-new user reads as having one
   block. The bootstrap is exactly one chart block, so the real test is
   anything beyond that: `length > 1 || some(b => b.type !== 'chart')`.
   That stray `PUT /api/framework` on step 3 is this bootstrap — additive,
   pre-existing, not a template overwrite.

**Phone is forced** (owner, 2026-09-12: *"if there is no phone number we will
force it now"*). 16 of 17 profiles have none and step 1 blocks on a valid
Indian mobile, so the re-onboard collects them. Two places would have let a
user slip past, both fixed:

* **The resume rule.** `persona_set_at && step < 3 → setStep(3)` skipped step
  1, the only screen that captures a phone — so a profile with a persona and
  no number would never be asked. It now refuses to resume unless the stored
  phone passes `isValidIndianMobile`.
* **The migration's exemption.** Stamping everyone with `persona_set_at`
  exempted them permanently. It now requires a valid phone too: of the two
  persona-holders on 2026-09-12 only one had a number, so the stamp exempts
  **1 profile and sends 16 back** (dry-run verified against live data).

The SQL phone test mirrors `lib/phone.ts` exactly, length conditions
included. A plain `^(\+?91|0)` strip looks equivalent and is not — it mangles
a genuine ten-digit mobile starting 91 (`9123456789` → `23456789`, rejected)
while the wizard accepts it, bouncing that user to re-enter a number the app
already considers valid. Both forms were run against the DB before choosing.

No frontend test runner exists, so both rules are covered by Playwright
against the dev server: six routing cases (including both bounce-loop
directions) and four visibility cases for the preserve exit.

### 📋 VaNi docked pane — autorun brief (2026-09-11)

The docked pane on `/workspace` opens on a **reading of the day**, not a menu.
Three blocks, owner-specified: today's panchangam as a CARD (the same
`PanchangamCard` the dashboard renders — never re-narrated in prose), then
VaNi's read of market participation, then the questions. VIX is deliberately
absent: display-only today, scoring parked behind `docs/claude/VIX-Upgrade.md`.

**`dashboard.autorun`** is a real intent with `autorun: true` in
`config/vaniIntents.ts`, which excludes it from every chip list
(`getAutorunIntent()` reads it instead). It covers breadth + ROC only, in
~110 words, and is `complexity='low'` so it routes to Qwen through the shared
`/api/vani/ask` path (`prefer_local`, `_sebi_post_filter` — both already on
that branch). The frontend calls it through `useVaNiAutorun`, a **query**
not a mutation: the docked pane remounts as the user moves between workspace
tabs, and a mutation would re-POST on every one of them.

### ⚠ Every dashboard/astro/industry intent prompt was being discarded

Found 2026-09-11 while verifying the autorun's Qwen routing, and it is the
**third** silent failure in this same plumbing. `vani_ask` read
`if scanner or equity: intent.system_prompt  else: _VANI_ASK_SYSTEM` — so
all 10 `dashboard.*`, 4 `astro_calendar.*` and 4 `industry_transition.*`
intents ran the generic prompt and their own registry prompt never reached a
model. **~31,000 characters of hand-written instruction, sent nowhere.**

Nothing errored. Every one of those intents answered — in the same shape,
because they were all running the same prompt. That generic prompt caps
output at *"exactly 3-4 sentences"* and demands a closing sentence on the
macro/transit backdrop, which most dashboard formatters supply no transit
data for; so a two-paragraph breadth intent could only ever come back short
with an invented or omitted astro tail, and rule 7 could fire
*"Insufficient atmospheric data for this period."* on perfectly good breadth
numbers. This is very likely part of what `docs/claude/scannerenhancement.md`
recorded as VaNi reading "generic/repeats daily".

Fixed: the selection is now `vani_ask_system(intent)` — a **named function**,
not an inline branch, precisely because a branch buried mid-handler cannot be
tested without a DB and a live LLM. The intent prompt is authoritative;
`_VANI_ASK_SYSTEM` survives only as the fallback for an intent carrying none.
Compliance did not weaken — the hard prohibitions that lived only in the
generic prompt moved to `_VANI_GROUNDING` and now apply to **every** intent,
each registry prompt already ends with `_VANI_RULES`, and `_sebi_post_filter`
is still the enforcing backstop. One deliberate loosening: the generic
prompt's ban on the bare words "up" and "down" is not carried over — D39
prohibits directional *market* language (bull/bear/uptrend/downtrend) in
badges and labels, not English words that prose about moving averages cannot
avoid.

**`test_vani_routing.py`** (standalone, no DB, no pytest — `python
test_vani_routing.py`) now guards this. It asserts **on the wire**: which
backend was called and what it was sent, against a stub OpenAI-compatible
server standing in for Qwen. Verified to FAIL against both historical bugs
(prompt discarded → "own prompt sent"/"not generic"; `prefer_local` ignored →
"cloud untouched").

Two traps it was built around, both of which produced a false PASS first:

1. **A stub reached via the cloud-first path is indistinguishable from
   `prefer_local`** — cloud errors, falls back to local, same server, same
   `provider='qwen-local'` return. So the test counts cloud *attempts*
   directly by spying on `_primary_complete`, plus a control case proving
   the tripwire can fire.
2. **A test that rebuilds the logic tests nothing.** The first version
   assembled `intent.system_prompt + grounding` itself and asserted that
   substring appeared somewhere in `pipeline2_api.py`. It passed against the
   broken code it was written to catch, because the broken version contained
   that substring too — inside the branch that skipped dashboard intents.
   It now executes the production `vani_ask_system` and asserts `vani_ask`
   still calls it.

**Still open** (unchanged): `prefer_local` reaches only the `/api/vani/ask`
family. Every legacy `GET /api/ai/*` endpoint — panchang-insight,
breadth-insight, market-pulse-insight and the rest — still routes to the
cloud and still skips the SEBI filter.

**Date resolution — a real bug, fixed here.** `vani_ask` defaulted an absent
`req.date` to the IST **calendar** day and passed it into every assembler.
`assemble_market_pulse_context` has an `ema_20`-gated fallback
(`latest_confirmed_date`) but it only fires when `target_date is None`, so
the guard never ran for a VaNi intent. Between the bhavcopy ingest and the
indicator step — and all day on a holiday — that date either has no row or
has one whose indicator columns are still NULL, and VaNi narrated it as
today. `vani_ask` now resolves the confirmed bar itself when the caller
sends no date (`km_equity_eod` for `equity.*`, `km_index_eod` otherwise); an
explicit `req.date` is still honoured verbatim.

**Owner triage of the eight dashboard intents** (2026-09-11), encoded as
flags rather than deletions so re-enabling is one line:
`coveredByAutorun` on #1 market_summary, #2 regime_explain, #4 warnings,
#5 breadth_explain — hidden **only where the brief runs** (the docked pane);
still offered in the overlay drawer on `/dashboard`, where nothing has
answered them. `provisional` on #3 rotation_overview (industry work
incomplete — sorts last whatever its displayOrder). `hidden` on
#6 panchangam_outlook (astro on hold).

#7 and #8 were kept but **are not the same question**: #7 reads the breadth
LEVEL (position), #8 the ROC (velocity) — on 2026-09-11 the level was flat
while the oscillator decelerated for a third session, which is exactly when
one is dull and the other is the signal. Both were relabelled to ask what
the brief did NOT already answer: "Which timeframe is breadth moving on?"
and "Is participation accelerating or fading?" #7's second paragraph was
asking #8's question of the wrong dataset and now stops at participation
width. #8's old label ("Is momentum supporting longs or shorts?") put a
directional stance in the chip text — the D39 surface — and its prompt body
instructed the model to say which side conditions favour; both are gone.

**New: `dashboard.breadth_divergence`** — "Which part of the market is
carrying it?", the one thing the single-line brief structurally cannot
carry. Reads `km_index_breadth` (migration 203) for a segment ladder —
NIFTY 50 / NEXT 50 / MIDCAP 100 / 500 / BANK — so every row shares one
basis. On 2026-09-11: NIFTY BANK 37.9 vs NIFTY 50 21.4, a 16.5-point spread
inside a market whose headline read 39.3. **The prompt is explicitly
forbidden from subtracting the all-NSE figure from an index row**: per-index
is ema_20+sma_50+sma_150 on raw closes (D40), market-wide is all-EMA on
cliff-adjusted closes (D44) — different basis AND different universe. That
is the trap the two-breadth-pipelines lesson warns about, one prompt away
from being narrated as a finding. NIFTY SMLCAP 100 is absent from
`km_index_breadth` and is deliberately not in the ladder.

Also fixed while here: `_fmt_breadth_momentum` fed the model
"positive — bullish momentum breadth" in its own prompt input, handing it
the exact vocabulary `_VANI_RULES` bans two paragraphs later. Both
momentum formatters now name the oscillator state through `_roc_state()`,
which mirrors `ROC_BADGE_MAP` in `BreadthRocChart.tsx` — expanding /
slowing / turning / contracting / warming up.

**Componentisation** (owner: "you will end up creating different components
if reusability is not here"). `components/domain/VaNi/` now holds
`types.ts` (shared `ChatMessage`), `VaNiMessage.tsx` (+ `VaNiAvatar`,
`VaNiThinking`), `VaNiIntentButton.tsx` and `VaNiIntentTray.tsx`.
`VaNiChatPanel` had hand-maintained copies of the intent button in three
places and the answer bubble inline; the brief needed a fourth and a second
bubble. The tray is **pinned below the scroll area in docked mode** — the
brief is taller than the pane, so an inline list put every question below
the fold — and it replaces what used to be three separate inline surfaces
(empty state, follow-up, "all answered"). The overlay drawer is untouched:
it opens deliberately, with a question already in mind, so it neither
autoruns nor uses the tray.

### The opening brief is a DECISION aid, keyed to the user's ICP (2026-09-12)

Owner, on the first live brief: *"it is not about numbers only, it is about
how we help the user to decide something"*, and *"we have ICP of each user —
how can we tell this with related to ICP"*.

The brief was describing a market. It should orient a person toward the
decision they are about to make. The product had already promised this and
was not keeping it — `GuideStep.tsx` (setup step 4, "How VaNi will guide
you") tells the user *"Tomorrow's Morning Brief opens with the name you
pick."*

**The mapping that makes it work.** Onboarding asks where the user would
concede they were wrong, and every answer NAMES A PRICE LINE at a timeframe
breadth is already measured at. So the ICP selects which breadth row is
*theirs*:

| `concede_level` | line | breadth leg |
|---|---|---|
| `tight` | 10-day low | 20 EMA share |
| `swing_low` | 22-day low | 50 EMA share |
| `structure` | Golden Line (150-day) | 150 EMA share |

On 2026-09-11 — 35.7% held the 20 EMA, 41.4% the 50, 45.4% the 150 — that is
a broken tape to someone conceding at the 10-day low and a largely intact one
to someone conceding at the Golden Line. **Identical numbers, opposite
meaning.** `acts_on` adds the second half: breakouts depend on the short leg,
so a thin 20 row means those setups fire against the tape; compression
(coils, quiet accumulation) tolerates a dull tape; confirmed-strength names
need the long leg, which is the one still holding.

`src/constants/breadthLegs.ts` owns the mapping (constants-first);
`_CONCEDE_LEG` / `_ACTS_ON_READ` in `vani_assemblers.py` mirror it. The ICP
travels on the request the same way `bookmarked_symbols` already does — the
client sends the viewer's own context, no user lookup or auth plumbing
server-side. Absent ICP (onboarding skipped) the brief stays market-level
rather than inventing a reader; a test pins that.

The autorun prompt is now **(1) what kind of day this is → (2) what it means
for the way YOU work, and what would change it**, second person, with the
standing ban extended: no buy/sell/wait/size/reduce/avoid, *"not even
softened as 'caution is warranted'"*. The ICP is part of the React Query key,
so changing "How you invest" changes tomorrow's brief.

**`BreadthLadder.tsx`** — the picture, above the prose. Three bars (short /
medium / long), the viewer's own row marked "yours" and coloured by whether
that timeframe is thin, plus a trajectory strip stating the move
("−5.3 over 4 sessions"). Three percentages are the whole story and prose
buries them. Theme tokens only — `check:theme` rejects literals.

**Harness note, worth remembering:** the ladder first rendered 42/46/49
(the OLDEST bar) and it looked like a component bug. It was the stub:
`fetchMarketBreadth` queries `trade_date` DESC and `.reverse()`s to
oldest-first, so a stub returning ascending rows gets flipped. The component
was right. Same lesson as the diagnostic-hygiene entry — fix the test before
you "fix" the code.

### ⚠ Small models must never be handed a signed number to interpret

First live autorun, 2026-09-11 close. VaNi wrote: *"The fast and slow
readings agree, with the fast reading slightly above the slow reading."*
`roc_13` was **0.0235** against `roc_55` of **0.0596** — the fast reading was
well BELOW the slow one. A confident, specific, inverted factual claim.

The plumbing was fine. `_fmt_autorun` emitted only
`Fast/slow spread: -0.0361` and expected the model to read the sign. Qwen
did not. Everything the brief was *about* — thrust fading, four straight
falling sessions — was missed for the same reason: the data block gave rows
and left the derivation to the model.

**Rule: pre-compute every comparison into a sentence.** The formatters now
write "The FAST reading (+0.0235) is BELOW the slow reading (+0.0596)",
"BELOW its signal line", "Breadth is FALLING in every one of the last 4
sessions: 43.2 → 39.3, a change of -3.9 points". The model copies a
relationship; it never derives one. That moves the risk from the model into
our arithmetic, so the arithmetic is now tested —
`check_derived_statements()` in `test_vani_routing.py` pins the wording to
the numbers across fast-under-slow, fast-over-slow and both-negative cases,
and is verified to fail on a flipped comparison.

`_fmt_breadth_momentum` carried two more of the same class, both fixed:
`SMA_BREADTH: (confirming ROC_13)` whenever the two merely shared a **sign**
— true on exactly the days the fast reading sits UNDER its signal line, the
thing that makes the state 'slowing'; and `ROC_13 (positive — participation
rising)` on any positive value, while breadth fell four sessions running. A
positive but shrinking rate of change is deceleration, not growth.

**Second defect, same brief:** it closed with *"Capital is flowing towards
the market."* — unsupported, and directionally positive on a day every
measure fell. Source: `_VANI_RULES` ended with
`"Use: 'elevated caution', … 'capital is flowing toward'."` A small model
reads a list under **Use:** as fill-in-the-blank and bolts one on as a
flourish. Reframed as a *permitted* vocabulary, explicitly "NOT a checklist",
plus "every sentence must be supported by a number or a state given in the
data; if you cannot point to the line that backs a sentence, delete it."
This applies to **every** intent, not just the autorun — expect the whole
family to get less generic. Guarded by a test.

### 📋 NEXT SESSION (owner + Claude) — Flower Pot: VaNi intents (the card, tiles and ETF fix shipped)

Session 2026-09-07 (2). Full record of the prior audit: `docs/claude/scanner-gap-audit-2026-09-06.md` §11.

**⚠ OWNER MUST RUN — nothing below is visible until this happens:**

```
km_migration_205_fpb_card_columns.sql          -- in pgAdmin
REFRESH MATERIALIZED VIEW km_scan_results;
REFRESH MATERIALIZED VIEW km_scan_exclusion_counts;
```

Until it runs the Flower Pot card shows "—" for its two level slots and empty
Score 5D/22D bars, and the "Tight Today" tile hides itself (the column reads
NULL, and a confident zero would be worse than no tile). Verification queries
are at the tail of the migration.

**Shipped this session:**

- **ETFs out of every scanner.** `is_etf` had been FALSE on all 16,938 rows
  since the column existed, so nothing could filter on it. Indian ISINs split
  cleanly — `INE` = company shares, `INF` = mutual-fund units — and the
  exclusion now sits in the matview's `active` CTE, `wg_pool` and the
  exclusion-count universe, with `is_etf` set from the same rule for consumers
  outside the view. It was never a Flower Pot problem alone: 77 of 441
  breakdown_watch rows, 12 of 50 conviction_flow, 18 of 295 breakout_surge.
  Flower Pot was worst because it selects FOR stillness — a liquid ETF parked
  at ₹999.99 scores maximum compression, so the five "tightest coils" on the
  page were LIQUIDETF, LIQUID, IVZINNIFTY, LIQUIDPLUS and BANKADD. After 205:
  106 → 68 rows, 67 of 68 carrying an industry (was 59 of 102).
- **The shared B+E card on all three phases** (D5). `config/flowerPotCards.ts`
  holds three card-only descriptors — hero Tightness on coils, Quality on
  releases, both level slots the 10-day range (`fpb_hi10`/`fpb_lo10`, the
  scanner's own geometry: the burst gate IS `close > hi10_prior`). They live
  outside `STUDIO_DESCRIPTORS` on purpose: membership there routes a preset
  into `ScannerStudio` and is parsed by `lib/scan_contract.py`, and per gap
  audit §5 this page's three-phase layout is not to be unified.
- **`fpbRowToScanStock` now delegates** to `scanRowToScanStock` and overlays
  the fpb columns. It used to hand-write every field and pass null for the
  shared ones, which was right while the arm projected typed NULLs and would
  now be throwing real values away. `lib/scan_contract.py`'s `mapper_fields`
  follows the spread (it would otherwise report 70 fields as gaps on a mapper
  that is strictly more complete).
- **Six stat tiles**, the same `ScanStatTile` the Studios use — extracted from
  `views/ScannerStudio.tsx` to `components/domain/ScanStatTile.tsx` rather
  than copied. Coiling Now · Tight Today · Bursts · Shatters · Live Releases ·
  Reached Target.
- **Performance = every release since 1 Apr 2026** (owner call), not the 9-day
  rolling window. `FPB_PERFORMANCE_SINCE` in ScanView. EXPIRED releases now
  appear as "Window closed" chips: with the no-move outcomes hidden, "6 of 10
  reached target" was a rate over the decisive outcomes only. On 2026-09-07
  the journal held 17 settled releases and the page showed 2.
- **`d_pct` populated on sixteen arms** (conviction_flow was the lone
  exception). The Studio XLS export gained a "D% from EMA20" column last
  session which had therefore always exported blank.
- **"Tight today"** — the arm's gate is `is_burst OR is_shatter OR
  setup_recent10 = 1`, i.e. compressed on ANY of the last ten sessions. On
  2026-09-04 only 26 of 102 rows still met the ATR and volume-death legs; 3
  scored 0.00 tightness. `fpb_tight_today` makes that visible instead of
  leaving a card whose hero reads 0.00 on a row labelled "coiling".

**VaNi intents for Flower Pot — SHIPPED (2026-09-09). All five live.**

`fpb.new_coils`, `fpb.recent_outcomes`, `fpb.why_watch_coil`,
`fpb.coiling_industries`, `fpb.coil_confluence_outlook` — each registered in
`lib/vani_intents.py`, served by a `GET /api/ai/fpb-*` endpoint, and offered as
a chip on `components/domain/FpbVaNiCard.tsx`. That card mirrors
ScannerStudio's `ScannerVaNiCard` markup but is a separate component: the seven
`scanner.*` intents POST a facts payload through `useVaNiAsk`, the `fpb.*` ones
are plain GETs returning `{insight, ai}`. Hooks take an `enabled` flag so a
question fetches only on chip click — never four LLM calls per page load.

**`new_coils` did NOT need the membership snapshot.** The earlier plan said it
required `compute_scan_membership_snapshot.py` extended plus a backfill,
because `flower_pot_burst` is the one preset with no rows in
`km_scan_membership_daily`. That premise was wrong: `km_scan_results` holds a
single `trade_date` (it is current-state), but the compression gate is
recomputable from raw `km_equity_eod` history, so the endpoint derives both
bars itself. Membership is **tight on that bar** — a name leaving the list
stopped meeting the gate, it did not break out. The standalone query was
validated against the matview (both return 8 tight coils for 2026-09-08).

**Three bugs found while wiring these — all silent, all expensive:**

1. **`_VaNi_INTENTS` vs `_VANI_INTENTS`.** All four original endpoints looked
   up a name that is defined nowhere. Every call raised NameError → 500 →
   the card's `insight: null` → "VaNi has nothing to report for this question
   today", the same string it shows for genuinely empty data. `pyflakes` finds
   this in one second. **Run `python -m pyflakes` on the backend before
   believing any "no data" symptom** — it also flags five live undefined names
   in `lib/integrity_checks.py` — **fixed 2026-09-14**. `db_meta` was READ at
   C1b and only ASSIGNED fifteen lines later, so `check_scanner_contract`
   raised NameError on its first statement **every run** since the commit that
   removed `MIN_AVG_AMT_22D_CR`; `run_all` converted the crash into a bland
   `checker_error_*` warning, so the guard looked present while being blind on
   exactly the contract drift it exists to catch. `unmeasured_n` was the orphan
   of the deleted liquidity floor and is removed with it.
2. **`fpb.recent_outcomes` queried columns that do not exist.**
   `km_fpb_active` has `status` and `release_date`; the query used
   `fpb_outcome` and `released_at`, and tested `'REACHED_TARGET'` where the
   column stores `'TARGET_HIT'`. `'STOPPED'` had no branch at all.
3. **The `fpb.*` endpoints never reached Qwen.** They used the legacy
   `_ai_complete` path, whose `prefer_local` defaults to False, so every answer
   came from the cloud provider. All five intents are `complexity='low'` and
   now pass `prefer_local=(skill.complexity == 'low')` via
   `complete_with_source`, matching `/api/vani/ask`. They also skipped
   `_sebi_post_filter` entirely and served raw model output; that is now
   applied.

**Still open** (re-verified 2026-09-14, now **15** `_ai_complete(` call sites —
see the dedicated entry at the top of Known Issues): every legacy
`GET /api/ai/*` endpoint outside the `/api/vani/ask` and `fpb.*` families still
routes to the cloud and still skips the SEBI filter.

**D1 (no `vani_rule`) stays deferred**, unchanged: tightness is now stored per
day on the matview but still not on `km_equity_eod`, and `km_fpb_active` needs
~60 releases before the coil-tightness × Magic RS candidate is testable.

Also still open from the audit: E1 real-device phone pass, E3 "Backend offline"
pill overlapping the scanner Action Island on a phone.

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

### 📋 FOR REVIEW (owner) — Trading-system layers, swing filter, pullback checklist (NOTHING BUILT)

`docs/claude/pullback-system-poa.md` — capability audit for three things the
owner raised together (2026-09-22/23): a five-layer trading frame mapped onto
the ICP, a four-filter swing watchlist, and an eight-step High-Probability
Pullback Checklist. **No migration, no column, no scanner exists for any of
it.** Every ✅/❌ was checked against the repo; every row count is marked
**MEASURED 2026-09-23** (the MCP recovered after a container restart) and the
numbers settle the central design question — §0 of the doc.

**On the 2026-09-22 bar, NSE active non-ETF, universe 3,044:** within 10% of the
52-week high 547 · +30% in 3 months 365 · **both 218** · + Stage 2 (`stage='S2'`)
**155** · + above `ema_20` **153**. ⚠ **CORRECTED 2026-09-23** — this line read
161/159 and claimed *"Stage 2 is stored as `S2_CANDIDATE`, there is no plain
`'S2'`"*. **Backwards.** Both exist: `S2` is the full Weinstein gate (MA stack +
rising sma_200 + the 52-week gates), `S2_CANDIDATE` is the MA alignment
**without** them — 155 vs 6 of the 218, so filtering on the candidate returns the
weak tail, not the leaders. The original measurement was taken on the 09-22 bar
*during the Stage 2 outage*, when every `S2` had been demoted, so `stage='S2'`
returned zero. **A broken bar and a nonexistent enum look identical from one
query** — check a value's population across several sessions before concluding it
is never written.

⚠ **All four swing filters AND-ed return ZERO.** Computed directly from raw bars
for those names (not via Flower Pot membership, which would be circular —
that arm holds 33 rows today): **1** is ATR-compressed, 28 are volume-dead,
**0** are both, and the best ATR ratio in the whole watchlist is 0.80, exactly
at the gate. A stock that has run +30% into its 52-week high is essentially
never in Flower-Pot-grade compression on the same bar. So filter 4 ("tight range
candles") **cannot be a watchlist filter** — as an `AND` it empties the list on
an ordinary session, which reads as a broken screen. It is the TRIGGER, exactly
as the owner's own spec said ("entry still comes from a tight trigger bar").
159 is also too many for a checklist to be the entry point: steps 1–3 want to be
a scanner, and the 8-step checklist is a PANEL opened on one candidate from it.

Four findings worth carrying even if none of it is built:

- **The missing primitive is SWING PIVOT DETECTION, not DEMA.** Checklist steps
  2 and 3 ("prior advance of 30%+", "pullback is 30–40% of the prior advance")
  both need swing highs/lows, and `ret_66d` is **not** a substitute — a stock
  can be +30% over 66 days having advanced 80% and given back 28%. Those are
  different numbers and the retracement needs the second. DEMA is three columns
  of recursion; pivots are the actual project, and they carry a **repaint trap**
  (a swing high is unconfirmed until N bars pass without exceeding it, so the
  latest pivot is always provisional — the same prior-only discipline
  `stage_since` and `backfill_big_money.py` already enforce).
- **`concede_level` is a stop-loss question being spent on breadth.** "Where
  would you concede you were wrong" (tight / swing_low / structure) IS the
  Process layer's stop loss, asked in plain language — and its only job today is
  picking the opening brief's breadth leg. The same answer could drive a
  per-stock stop reference. Do not remove either job; one of them is simply
  unused.
- **Four of the five named setups already ship under other names**: VCP =
  Flower Pot coil, Momentum Burst = breakout_surge/volume_drive, Pullback =
  gl_retest, Episodic Pivot = the filing/PEAD layer (212–217), Flat Base =
  Stage 1–2. A naming/IA problem, not a capability one — and the place to settle
  the pending **Eagles / Spark** vocabulary, since this is the one users speak.
- **Layer 3 (stop, size, risk) is the gap, and the compliance line is
  arithmetic vs advice**: "you said you concede at the 22-day low; that is ₹412,
  4.1% away, N shares at 1% risk" is maths on the user's own rule. A price
  target is not. Position sizing also needs **account capital, which is stored
  nowhere** — recommendation is browser-local only, never server-side, never in
  a VaNi prompt or `km_vani_cache`.

Steps 5–6 (Demand Tail / Inside Bar / NR4 / NR7 / "linear" bars) need **no
storage** — pure OHLC, the `priceActionEvents.ts` derive-on-read pattern, but
they must be given warm-up bars or they report "no trigger" on a window too
short to have looked (the `fpbEvents` starvation lesson). The checklist also
wants a surface the product does not have: eight rows for ONE stock, with
**three** states — pass, fail, and *not measurable* — because a row that cannot
be measured must say so rather than quietly pass or quietly fail.

⚠ Applies to all of it: `km_corporate_actions` is still EMPTY (D44), so
`ret_66d` and any swing pivot over unadjusted closes carry phantom moves on
splits/bonuses. A nuisance for a live daily screen; **disqualifying for
historical validation** until Sprint 3b. Open questions (entry-tactic
definition, DEMA vs "trend rising", the pivot confirmation rule, capital
storage, panel vs scanner) are listed in the doc.

### 📋 FOR REVIEW (owner) — Signal discovery: PEAD measured, volume-spurt calibrated, volume_drive half broken (2026-09-23)

**`docs/claude/signal-discovery-2026-09-23.md`** — four signals measured on the
live DB in one session. Nothing built. Three are ready to build, one is
explicitly refused.

**PEAD IS REAL AND CHEAPER THAN THE POA ASSUMED.** 2,245 result announcements
bucketed by Day 0 price reaction, median drift over the NEXT 20 sessions
against a universe median of **−0.59%**: reaction **> +5% → +0.95% (+1.54 pts
excess, n=278)**; every band below +2% → −1.5 to −1.9% (−0.9 to −1.3 pts). A
**2.8-point spread**, threshold sharp at +5%. ⚠ **Sprint 3 (Qwen document
extraction) is NOT a prerequisite** — the signal is the price REACTION, not the
filing's content, and Day 0 + prices are already stored. ⚠ **MagicRS adds
nothing** (+0.80 vs +0.59, n=42) — do not bolt it on. ⚠ **The scanner is
SEASONAL**: 104 qualifying events in the week of 2026-08-10, **1 on
2026-09-23**. An empty list must read "no results filed in the last 20
sessions", never "no opportunities" (the fpbEvents starvation lesson). Only
2.5 months of history exists (Day 0 spans 07-10 → 09-22), so this is ONE
results season and could be a Q1-FY27 artifact.

**⚠ `volume_drive` IS HALF BROKEN — fix before adding anything.** It is
`dot_svd OR dot_sbd` on the latest bar, no lookback. The **SVD arm is a
measurable FADE**: 89% of its names are already up ≥10% on the day they appear,
median forward 5-day **−2.61% against a universe −0.81% (−1.80 pts)**, only 37%
positive. Structural, not bad luck — SVD's definition REQUIRES `pct_chng > 9`,
so it can only fire after the move. **This also makes "SVD during compression"
impossible by construction**: if the owner's Pine SVD fires inside a box it is
a DIFFERENT indicator needing its own definition. The SBD arm is marginal
(+0.68 pts median). Minimum fix: split the preset so the scanner stops
recommending its own worst cohort. Honest framing for SBD: **6.7× lift on a
≥10% next-day move** (5.4% vs 0.8% base) with a MEDIAN outcome of ~zero — a
lottery-ticket list, not a trend list.

**VOLUME SPURT COUNT — calibrated on two independent dates.** How OFTEN beats
how BIG: `5× on ≥1 day` scores **1.02 / 1.08 lift** (noise — and that is what
volume_drive does today), while `2× on ≥6 days` scores 1.27. Window calibrated
with one shared baseline: **22 days wins all four matched-size comparisons**;
44 days is flat at every threshold (old spurts only dilute); 10 days is too
short. **`≥8` beats `≥6` on stability** (1.32/1.32 vs 1.37/1.21). Direction is
required — volume is blind, and 4+ spurts with RS rising beat RS falling on
both dates (17.4 vs 14.6, 20.8 vs 16.1). Rule: **`vol_spurt_count_22d >= 8 AND
magic_rs_chg_22d > 0`**, ONE new column. ⚠ The live `rvol` divides by a 50-bar
mean that INCLUDES today — it read **19.2** on OPTIEMUS 09-22 when the true
spurt vs prior-bar median was **~52×**. Use prior bars only, and median not
mean (29× vs 52× on the same day).

**`rs_percentile` — 20-year answer, and it is NOT a ranking.** 61
non-overlapping 22-session windows, **153,556 stock-windows**, 2006→2026.
Bucket median minus same-date universe median: <50 **−0.16**, 50–70 **+0.64**,
70–80 +0.60, 80–90 +0.05, 90–95 +0.54, 95–100 **+0.36**. **Not monotone** —
bucket 2 beats the top decile; top−bottom spread only +0.52 pts. **It is a
negative FILTER (exclude <50), not a ranking — do not build a top-decile RS
scanner.** Regime swing dwarfs the effect: top bucket +4.38 in 2023, −2.31 in
2024-25. ⚠ `scripts/backtest_rs_percentile.py` still has NOT been run (port
5432 unreachable from the cloud container); the methodology was reproduced in
SQL via the read-only MCP, so Spearman rho and the phase-3 scanner-overlap test
remain open.

**Two population results that overturn the intuitive read**, both measured over
366 big movers vs a 43,843-bar base: **`delivery_pct ≥ 50%` has 0.98× lift**
(pure noise) and **`rvol < 0.9` has 0.58× lift** — big movers are preceded by
ACTIVE days, not compressed ones. ⚠ **OPTIEMUS is a specimen, not a template**:
on 09-21 it had none of the winning features (no dots, LOW_VOLUME, rvol 0.72),
its last SBD was 19 sessions earlier, and what actually caught it was the
15-minute MagicRS/SVD turn at **09:45** plus three filings at 12:26/12:38 —
all of which the EOD layer sees 5.75 hours late. Do not calibrate a screen to
it.

**Data defects found in passing:** `2026-08-25` has **0 SBD / 0 SVD / 0 SYD
across all 3,006 rows** (the `dots` dimension did not run, nothing reported
it); `bm_ratio` is NULL before 2026-09-04 so Big Money cannot be backtested at
all; `km_corporate_actions` still EMPTY.

### 📋 FOR REVIEW (owner) — Is an rs_percentile scanner worth building? (script written, NOT YET RUN)

`scripts/backtest_rs_percentile.py` — read-only, writes nothing. Answers the
question in three parts, because a result that answers only the first is noise:
does the top bucket beat the **same-date universe median** (so market direction
cancels); is the gradient **monotone** across six buckets (reported as Spearman
rho + top−bottom spread, since strict monotonicity over six buckets fails on one
inversion); and does it add anything **over the shipped scanners** (phase 3,
overlap — not yet written).

**Phase 0, measured on the live DB 2026-09-18: `rs_percentile` reaches back to
**2006-02-22** — **13.2 million bars**, twenty years — while `ema_20` starts
2025-04-01. So a pure RS screen can be tested roughly twenty times deeper than
any shipped scanner can run. ⚠ **Depth is not quality**: `km_corporate_actions`
is EMPTY (D44), so `magic_rs` itself was computed on unadjusted closes over that
whole window. The cliff filter drops a window that CONTAINS a split; it cannot
repair an `rs_percentile` distorted by one beforehand. Always compare a deep run
against `--from 2024-01-01` before believing either.

⚠ **First live run HUNG** (45 min, no output past Phase 0) and the script was
fixed: the calendar now comes from `km_index_eod` (a few thousand rows) instead
of a `DISTINCT` over all 13.2M; the forward-window CTE is bounded by calendar
date as well as by row number, so it no longer ranks every future bar for ~5,000
stocks per sample date; `--max-dates` (default 60) thins the sample EVENLY
across the range, because sixty dates spread over twenty years is a better study
than sixty consecutive recent ones; and every date prints progress with an ETA,
since a study that is silent for 45 minutes cannot be told from a hung one.

⚠ **Ctrl+C did not kill the first run, and killing the client did not stop the
DATABASE.** psycopg2 blocks inside libpq, so SIGINT is queued rather than
delivered until the query returns; and PostgreSQL keeps executing a query after
its client dies, usually noticing only when it tries to return results. A
runaway SELECT therefore holds server resources indefinitely — which is the most
likely reason the read-only MCP timed out on everything for hours that day.
Fixed in the script: `set_wait_callback(wait_select)` puts psycopg2 in green
mode so Ctrl+C issues a real `PQcancel` and stops BOTH sides, plus a
session-level `statement_timeout` (300s) that also covers Phase 0 and the
calendar lookup, which a per-statement `SET LOCAL` inside the loop did not.
⚠ A Ctrl+C and a `statement_timeout` BOTH arrive as `QueryCanceled` and mean
opposite things (stop everything / skip this date); they are told apart by
PostgreSQL's message, or Ctrl+C silently skips one date per press. **If a run is
ever stuck again: `pg_cancel_backend(pid)` from `pg_stat_activity`, not just
Ctrl+C.**

⚠ **The result is still NOT IN.** The read-only `kaala-postgres`
MCP was wedged when it was written — every tool on that server, including
metadata calls, timed out at 60s while the host itself answered in ~1.2s. Run it
and the numbers are real; until then there is no result, and no number in this
entry.

Five traps it handles, each one already recorded elsewhere in this file:
**corporate actions** (`km_corporate_actions` is EMPTY — D44 — so any window
containing a 0.55×/1.80× single-session cliff is DROPPED, not adjusted, and the
count is printed); **survivorship** (a stock with no bar at t+h is counted and
reported, because silently excluding delisted names biases the result upward);
**overlapping windows** (sample dates are spaced ≥ horizon apart and the number
of independent periods is printed, with a warning below 8); **median not mean**
(one unadjusted split dominates a mean; both are shown and a wide gap is itself
the signal); and **depth** — a pure RS screen needs neither `ema_20` nor
delivery, so it can be tested EARLIER than any shipped scanner can run, and
phase 0 measures that window rather than assuming it.

Validated end-to-end against a throwaway PostgreSQL 16 cluster with a fixture
carrying a known answer: it caught the engineered 1:2 split (1 cliff drop) and
the engineered delisting (1 no-exit-bar), recovered the engineered gradient
(rho +0.77, top−bottom +3.67 pts, 62% vs 28% hit rate), and correctly refused to
call it strictly monotone.

### 📋 FOR REVIEW (owner) — RS-Rotation scanner spec
`docs/claude/Rsspec.md` specs a **Relative-Strength Rotation scanner** (RRG-style: Magic RS × its momentum → Leading / Weakening / Lagging / Improving quadrants). Positions it as the leading-indicator complement to Stage 2 Leaders — it adds the **Improving** (early relative turn) and **Weakening** (relative fade) quadrants that none of the current 9 scanners surface — with SEBI-safe presets (`Rotating Into Strength`, `Leadership Fading`), a multi-timeframe "aligned rotation" confluence (Magic RS is native on daily `km_equity_eod` / weekly 075 / monthly 076), the one new data need (`magic_rs_roc`), and the 4-step scanner integration. **Not built** — Charan to review the open questions at the end. The RS-Rotation *chart* (daily, single stock) IS built and live: `components/domain/RotationGraph.tsx`, wired into `views/ChartView.tsx` under the Magic RS pills (`/chart/equity/:id`, daily; layout provisional, to realign).

### 📋 FOR REVIEW (owner) — Scanner Enhancement: trend signals (New/Sustaining/Rising RVOL) + date filter
`docs/claude/scannerenhancement.md` — VaNi's `scanner.read_results` narration was live-tested and found generic/repeats daily (no comparison point, narrates a 25-row sample as if it were the full 270-row result set). Design: three pre-computed (not live-computed) signals — **new today** (entered the qualifying set since yesterday, UI badge + VaNi callout), **sustaining** (held favorable status across last N sessions), **rising RVOL** (volume trend) — written by a scheduled job right after the daily pipeline, same pattern as `rolling_metrics`/`stage_classification`/`magic_rs`. Complexity splits sharply: **low** for scanners whose qualifying logic is a simple stored-column SQL filter (Breakout Surge, Conviction Flow, Stage family) — one job, a small membership table, set-diffs; **real work** for the bundle scanners (Power Buy, Smart Money, etc.) whose logic lives only in `scanEngine.ts` TypeScript, not ported to SQL. Recommended initial scope: the low-complexity family only. A **date filter** (view any previous day's scan results) piggybacks on the same membership table for scanners in that set — practical and small for the simple family, a real refactor for bundle scanners (touches the date-resolution code hardened this session — see the mid-pipeline blackout and multi-day staleness fixes). **Not built** — owner to confirm scope (lookback window, exact "sustaining" definition, initial scanner set) before implementation. Depends on VaNi-in-scanners (shipped — `lib/vani_intents.py`'s `scanner.explain_preset`/`scanner.read_results`).

### 📋 FOR REVIEW (owner) — VIX Upgrade (India VIX is display-only, not a scoring input)
`docs/claude/VIX-Upgrade.md` (2026-07-21) — India VIX (`km_index_symbols.id=94`) is tracked and ingested automatically via the generic NSE all-indices bhavcopy, but is used **only as a display widget** today (Sector Rotation header band, Workspace ticker rail) — nothing computes or scores anything about index behavior from it. **Naming trap**: `risk_engine.py`'s `score_volatility` dimension sounds VIX-adjacent but is 100% Vedic-astrology-derived (Moon nakshatra risk, Gandanta, malefic aspects) — zero VIX/ATR/realized-volatility anywhere in it. Proposes two tiers: **Tier 1** — a cheap observational VIX-regime badge reusing existing `km_index_eod` data, no new ingestion; **Tier 2** — feed VIX level/ROC into the still-unbuilt Market Breadth Layer 4 astro-confluence work as a third signal alongside breadth + astro. Tier 2's impact (documented in full): multiplies confluence complexity on an already-paused 2-signal design (Astro-Technical Alignment card, hidden 2026-07-09 pending rework), thins historical sample sizes when slicing by VIX-band × breadth × astro simultaneously, raises the stakes on the `risk_engine.py` naming collision (two live "volatility" concepts if shipped), and depends on Layer 4 being resolved first — not independently buildable. Cross-cutting: `score_volatility` should be renamed (e.g. `lunar_risk`) regardless of which tier ships. **Parked — owner to revisit.** Open decisions in the doc: which tier first, whether to verify VIX data quality (open backlog item SR-B4) before building on it, and rename timing.

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

⚠ **Two different caches, do not confuse them.** The Morning Brief's
`_vani_cache` is in-process and TTL-based. The research companions use the
**persistent `km_vani_cache` table** (migration 038, `lib/vani_cache.py`) with
snapshot-hash + intent-version keys and no TTL — see **VaNi Research
Companions**. A fix to one is not a fix to the other.

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
