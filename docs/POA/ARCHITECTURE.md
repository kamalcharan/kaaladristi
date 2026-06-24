# DristiQ — Architecture Reference
> Living document. Read this before touching any code.
> Location in repo: `/docs/poa/ARCHITECTURE.md`
> Last updated: 2026-06-19

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + TypeScript | Vite build |
| Styling | Tailwind CSS + CSS custom properties | Theme via CSS vars on `<html>` |
| State | Zustand | Multiple stores — see Section 4 |
| Charts | lightweight-charts | Via `TradingChart` component |
| Drag/resize | `@dnd-kit/core` | Workspace canvas only |
| Backend | FastAPI | Python |
| Database | PostgreSQL 17 | |
| API layer | PostgREST | Direct table/view queries from frontend |
| Auth | JWT via `lib/auth.py` | `python-jose` |
| LLM | Qwen3 4B | Self-hosted at `llm.dristiq.io` via `ai_client.py` |
| Payments | Razorpay | Subscription model |
| Hosting | Hostinger VPS | Two servers |

---

## 2. Frontend — Route Map

```
PUBLIC
  /                          LandingPage
  /login                     LoginPage

AUTHENTICATED — NOT ONBOARDED (no Layout shell)
  /setup                     ProfileSetup (4-screen wizard)

AUTHENTICATED — ONBOARDED (inside Layout shell)
  /workspace                 WorkspacePage       ← post-login landing
  /catalog                   CatalogPage
  /correlation/:a/:b         CorrelationPage
  /dashboard                 DashboardV3Page
  /scanner                   ScanView
  /scanner/:presetId         ScanView
  /chart/:type/:id           ChartView
  /pulse/:indexId            VisualPulsePage
  /pulse/equity/:equityId    EquityVisualPulsePage
  /intraday/:indexId         IntradayPage
  /market-structure          MarketStructureView
  /planetary-intel           PlanetaryIntelView
  /rules + /rules/:id        RuleList / RuleDetail
  /panchang                  PanchangView
  /pricing                   PricingPage
  /account                   AccountPage

ADMIN ONLY
  /markets, /inference, /rule-eval, /astro-calendar
  /manipulation-watch, /industry-transition
  /settings, /data-pipeline, /admin/panchang
```

---

## 3. Layout Shell

**File:** `Layout.tsx`

```
Layout
├── Sidebar (220px expanded / 52px collapsed)
│   ├── Brand wordmark
│   ├── Nav items (VIEW section)
│   ├── Nav items (ADMIN section — hidden for non-admins)
│   ├── Theme dots (3 swatches)
│   └── Footer: avatar + name + plan + sign out
├── Topbar (sticky, 48px)
│   ├── SearchStrip (280px pill, left)
│   ├── DataFreshnessChip (right)
│   └── Ask VaNi button → opens VaNiChatPanel
└── <Outlet /> — page content renders here
    Floating panels:
    ├── VaNiChatPanel (slides from right)
    └── JobMonitor (background pipeline monitor)
```

**Do not modify sidebar or topbar during Sprint 4.** Tab bar sits between topbar and page content inside WorkspacePage only — not in Layout.

---

## 4. State Management — Zustand Stores

### frameworkStore
**Purpose:** User's personal framework — the canvas, blocks, overlays, selected index.

| Key field | Type | Notes |
|---|---|---|
| `framework.blocks` | Block[] | All canvas blocks including chart block |
| `framework.chart_overlays` | Overlay[] | Active chart overlays |
| `framework.blocks[type='chart'].config.instrument` | `{symbol, id, type}` | Selected index — persisted to DB |
| `switchPrimaryIndex(instrumentRef)` | function | Updates selected index + triggers `saveFramework()` |
| `saveFramework()` | function | Debounced 800ms, writes to `user_frameworks` in DB |
| `isBlockActive()` | function | Canonical check for block visibility |
| `isOverlayActive()` | function | Canonical check for overlay visibility |

**Rule:** No component independently derives active block/overlay state. Always use `isBlockActive()` / `isOverlayActive()`.

### authStore
**Purpose:** Auth state, user profile.

| Key field | Notes |
|---|---|
| `profile` | Full `km_profiles` row |
| `profile.icp_mode` | ⬜ To be added in Sprint 4 step 4.1–4.2 |
| `profile.theme` | Current theme ID |
| `profile.tier` | 'free' \| 'beta' \| 'quarterly' \| 'yearly' |
| SIGNED_OUT listener | Resets `framework`, `vaniCorrelations`, `_suppressedUntil` |

### chartSyncStore
**Purpose:** Walk mode chart synchronization.
**Status:** ⚠️ Walk mode parked — TradingChart does not read from this store. `visibleFrom`/`visibleTo` updates don't propagate to lightweight-charts. Full spec in CLAUDE.md.

---

## 5. Component Inventory — Reusable Components

### Drop-in Ready (pass props, works anywhere)

| Component | File | Props | Data Source | Notes |
|---|---|---|---|---|
| `MarketWeatherCard` | `components/domain/DashboardV3/MarketWeatherCard.tsx` | `{ date?: string }` | `useMarketWeather(date)` | Has expandable historical context panel |
| `PanchangamCard` | `components/domain/PanchangamCard.tsx` | `{ date: string }` | `usePanchang(date)` | Live IST clock inside |
| `MarketBreadthChart` | `components/domain/MarketBreadthChart.tsx` | None | `useMarketBreadth(days)` | Period selector (22D/44D/66D) is internal |
| `BreadthRocChart` | `components/domain/BreadthRocChart.tsx` | None | `useBreadthRoc(days)` | ROC-13, ROC-55, SMA-5, 4-state momentum bias |
| `SectorRotationFlow` | `components/domain/DashboardV3/SectorRotationFlow.tsx` | None | `useIndustryRotation()` | 3-lane: Leading/Rotating In/Rotating Out. ⚠️ Bug: zone color mismatch (see Section 8) |
| `PingsColumn` | `components/domain/DashboardV3/PingsColumn.tsx` | `{ date: string }` | `useDashboardPings(date)` | Aggregates rotation + astro + outlook |
| `SixDayOutlookCompact` | `components/domain/DashboardV3/SixDayOutlookCompact.tsx` | `{ date: string }` | Internal | — |
| `CurrentSkyRail` | `components/domain/DashboardV3/CurrentSkyRail.tsx` | `{ date: string }` | Internal | — |
| `NakVaraSignals` | `components/domain/DashboardV3/NakVaraSignals.tsx` | `{ date: string }` | Internal | Astro ICP only |
| `DensityToggle` | `components/domain/DashboardV3/DensityToggle.tsx` | `{ density, onChange }` | None | Pure display |

### Needs Extraction Before Reuse

| Component | Current Location | Action Required |
|---|---|---|
| `IndexDropdown` | Inline in `WorkspaceCanvas.tsx` lines 254–361 | Extract to `components/domain/IndexDropdown.tsx` — no logic changes |

### Partial — Needs Refactor

| Component | Issue | Action |
|---|---|---|
| `TickerRail` | 4 indices hardcoded (NIFTY 50, NIFTY BANK, NIFTY 500, India VIX) | Refactor to accept index list as prop or read from store |

### Self-contained Pages (not extractable as-is)

| Component | Notes |
|---|---|
| `MarketStructureView` | Full page. Embeds MarketWeatherCard + MarketBreadthChart + BreadthRocChart + NakVaraSignals + ConfluenceDotGrid |
| `IndustryTransitionView` | Full page, admin-only route. Heavy fetch (6 dates parallel, ~8000 stocks). Has 3-min in-memory cache |

---

## 6. Scanner Architecture

**File:** `App/frontend/src/services/scanEngine.ts`

### Key Functions
| Function | Purpose |
|---|---|
| `SCAN_PRESETS[]` | Scanner definitions array |
| `computeVaniOpportunity()` | Centralized VaNi chip computation — use this, never inline |
| `fetchStage2Leaders()` | S2 scanner |
| `fetchStage2Watch()` | S2_CANDIDATE scanner |
| `fetchVaNiOpportunity()` | VaNi top 25 |
| `fetchStage4Leaders()` | S4 death cross |
| `fetchStage3Watch()` | S3 convergence |
| `fetchVaNiExitWatch()` | S4 bottom 25 RS |
| `scanConvictionFlow()` | Delivery surge scanner — VaNi computed inline ⚠️ |
| `scanBreakoutSurge()` | 20-bar breakout scanner — VaNi computed inline ⚠️ |

### ScanDataBundle EOD SELECT — Current Columns
```
equity_id, trade_date, open, high, low, close, prev_close, pct_chng,
volume, value_cr, rvol, tvol, rsi_14,
magic_rs, magic_rs_zone, flow_type, accum_distrib,
sniper_inst, sniper_hot, rss_value, rss_spread,
sma_150, volume_divergence_flag, ema_20, atr_14,
delivery_pct, delivery_qty, w52_high, sma_50, sma_200,
w52_low, supertrend_dir, lifetime_high
```

**Missing from SELECT** (backlog item B03):
- `is_vani_surge` — not fetched
- `is_vani_breakout` — not fetched

### VaNi Rule → Column Mapping
| vani_rule value | DB column | Status |
|---|---|---|
| `is_vani_s2` | `is_vani_s2` | ✅ Computed nightly |
| `is_vani_surge_or_breakout` | `is_vani_surge` OR `is_vani_breakout` | ⚠️ Not in SELECT |
| `is_vani_smart` | `is_vani_smart` | ⚠️ Not wired (smart_money scanner) |
| `is_vani_delivery` | `is_vani_delivery` | ✅ Available |

### Stage Definitions
| Stage | Condition |
|---|---|
| S2 | `close > sma_50 AND sma_50 > sma_200 AND sma200_rising = true` + 52W position gates |
| S2_CANDIDATE | `close > sma_50 AND sma_50 > sma_200` (no gates) |
| S3 | Above sma_200, sma_50 converging (< 15% gap) |
| S4 | `close < sma_200` |

---

## 7. Data Layer

### Key Tables
| Table | Purpose | Notes |
|---|---|---|
| `km_equity_eod` | Daily EOD data per stock | Primary data table |
| `v_equity_eod_deduped` | Deduped view | **Canonical source for all cross-stock queries** |
| `km_equity_symbols` | Stock master | `exchange = 'NSE'`, `symbol ~ '^[A-Z]'` for clean NSE symbols |
| `km_index_eod` | Index EOD data | Includes NIFTY 50, NIFTY 500, NIFTY BANK etc. |
| `km_index_symbols` | Index master | `is_active = true` filter for dropdown |
| `km_industry_eod` | Industry-level aggregated data | Used by all rotation components |
| `km_equity_weekly` | Weekly OHLCV + indicators | 60 columns, mirrors km_equity_eod |
| `km_equity_monthly` | Monthly OHLCV + indicators | 60 columns, mirrors km_equity_eod |
| `km_profiles` | User profiles | See column list below |
| `user_frameworks` | User canvas state | `blocks` JSONB, `chart_overlays` JSONB |
| `kd_scan_presets` | Scanner definitions | `vani_rule` column drives VaNi chip |
| `km_config` | Platform config | Added migration 092 |
| `vn_interaction_log` | VaNi interaction logging | In `vani_db` — feeds future fine-tuning |

### km_profiles Columns
```
id, full_name, display_name, email, phone, avatar_url,
role, onboarded, created_at, updated_at,
tier, theme, dark_mode, expires_at
⬜ icp_mode  ← to be added Sprint 4 step 4.1
```

### Pipeline Step Order
```
6h → backfill_stage_classification.py  (stage + is_vani_s2)
6j → backfill_vani_flags.py            (all other is_vani_* flags)
6k → backfill_rs_percentile.py         (rs_percentile)
```

### Index Selector Data Source
```sql
SELECT id, name FROM km_index_symbols WHERE is_active = true ORDER BY name ASC
```
Used by `fetchActiveIndices()` in `services/indexPickerService.ts`.

### Industry Rotation Data Source
```
km_industry_eod (today)     → industry_rank, dominant_flow_type, avg_magic_rs, stock_count
km_industry_eod (5D ago)    → rank at lookback for delta computation
Rotation logic: client-side (not DB)
  rank_change >= 5  → Rotating In
  rank <= total/4   → Leading
  rank_change <= -5 → Rotating Out
Lookback: INDUSTRY_ROTATION_LOOKBACK_DAYS = 5 (hardcoded — see backlog B13)
```

---

## 8. Known Bugs — Fix Before Shipping

| # | Bug | Location | Fix |
|---|---|---|---|
| BUG-01 | Zone color never matches in SectorRotationFlow StockDrawer | `SectorRotationFlow.tsx` | DB stores `'Strong Bull'` (Title Case) but code checks `'strong_bull'` (snake_case). Normalize to match DB |
| BUG-02 | `is_vani_surge` + `is_vani_breakout` not in ScanDataBundle | `scanEngine.ts` line 168 | Add to EOD SELECT |
| BUG-03 | `smart_money` scanner `vani_rule = null` | `kd_scan_presets` DB row | Set `vani_rule = 'is_vani_smart'` |
| BUG-04 | `/transmission` and `/history` in sidebar but no route | `Sidebar.tsx` | ✅ Resolved — removed from sidebar nav (no routes exist; re-add when features are built) |
| BUG-05 | ISIN dedup not verified on all 6 new scanners | `scanEngine.ts` | Verify `fetchStage2Leaders()` ISIN dedup pattern applied to all 6 |
| BUG-06 | Industry drill-down fetches RSI/flow/rvol/sniper but doesn't render them | `IndustryRotationPanel.tsx` | Render the already-fetched fields |
| BUG-07 | No click-through from drill-down stock to Visual Pulse | `IndustryRotationPanel.tsx` | Add navigation to `/pulse/equity/:equityId` |

---

## 9. Theming System

**Engine:** `applyTheme()` in `src/config/theme/index.ts`
**Startup:** Runs synchronously before React mounts — no flash of wrong theme.

### Available Themes
| Theme ID | Primary Accent | Background |
|---|---|---|
| `kaaladristi` | `#818cf8` indigo | `#0b1120` deep navy |
| `tech-ai` | `#06d5cd` cyan-teal | `#0a1818` dark |
| `jade-thorn` | `#3aad7e` jade green | `#0a0f0d` near-black |

### Key CSS Variables (use these in all new components)
```css
--bg                  /* page background */
--card                /* card background */
--card-soft           /* slightly lighter card */
--border              /* default border */
--border-strong       /* emphasized border */
--accent              /* primary accent (indigo) */
--accent-dim          /* accent at ~15% alpha */
--accent-glow         /* accent at ~8% alpha */
--gold                /* secondary accent */
--bull                /* green / positive */
--bear                /* red / negative */
--text-primary        /* primary text */
--text-secondary      /* secondary text */
--text-muted          /* muted/disabled text */
--font-display        /* Fraunces — headings only */
--font-body           /* Inter — all body text */
--font-mono           /* JetBrains Mono — numbers/data */
```

### Rules
- Dark-only in production (`applyThemeById` always passes `prefersDark: true`)
- Never import `themeStore` to read colors in components — use CSS vars
- Never hardcode hex colors in components — always use CSS var tokens
- Font families are fixed across all themes — never override

---

## 10. VaNi — Language & Prompt Rules

| Rule | Detail |
|---|---|
| Never directional | VaNi never says "buy", "sell", "will rise", "will fall" |
| Forbidden phrases | Phrase-level blocks — e.g. "potential rise", "potential upside". Not blanket word bans |
| Prompts location | All centralized in `lib/ai_prompts.py` as `SKILLS` registry |
| LLM directive | `/no_think` must be included in all Qwen3 calls |
| Temperature | Controlled via `ai_client.py` |
| Interaction logging | Every VaNi call logged to `vn_interaction_log` in `vani_db` |
| Cache pattern | Midnight batch primary; on-demand fallback if no cache (decided Sprint 4 planning) |
| Cache invalidation | Metric-change trigger — not TTL-based (decided Sprint 4 planning) |

---

## 11. Code Patterns — Always Follow

### Constants First
```typescript
// All fixed string sets as `as const` arrays
// Types derived from constants
// Reference: frameworkConstants.ts pattern
const SCAN_CATEGORIES = ['breakout', 'stage', 'reversal', 'momentum'] as const;
type ScanCategory = typeof SCAN_CATEGORIES[number];
```

### Never Hardcode Index IDs
```typescript
// WRONG
const nifty500Id = 3;

// RIGHT
const { id } = await fetchIndexByName('NIFTY 500');
```

### Framework Store as Sole Source of Truth
```typescript
// WRONG — component derives its own state
const isActive = blocks.find(b => b.type === 'chart');

// RIGHT — always use store functions
const isActive = frameworkStore.isBlockActive('chart');
```

### Legacy Column Names — NEVER USE
```
magicrs_value    → use magic_rs
sniper_banker    → use sniper_inst
sniper_hotmoney  → use sniper_hot
accum_dist       → use accum_distrib
vacuum_status    → (deprecated)
flow_meaning     → (deprecated)
```

### Stale Code Removal
- Mandatory at every phase — not optional
- If a component is replaced, delete the old one
- If a data fetch is moved to a hook, remove the inline fetch

### Migration Rules
- Run manually — no automated tooling
- Never assume a migration has run
- Always verify with a SELECT before writing code that depends on a new column

---

## 12. Reusability Anti-Patterns — What We've Found

| Anti-pattern | Where Found | Correct Approach |
|---|---|---|
| 4 implementations of industry rotation | `IndustryRotationPanel`, `SectorRotationStrip`, `SectorRotationFlow`, `IndustryTransitionView` | Consolidate to single hook + 1-2 display variants (backlog B41) |
| VaNi computed inline per scanner | `scanConvictionFlow`, `scanBreakoutSurge` | Use `computeVaniOpportunity()` always |
| Component defined inline in parent | `IndexDropdown` inside `WorkspaceCanvas.tsx` | Extract to own file before reuse |
| Hardcoded ticker list | `TickerRail` — 4 hardcoded indices | Fetch from `km_index_symbols` or accept as prop |
| Atmospheric badge duplicated | Only on Stage 2 Leaders, needs copy to 5 others | Single `AtmosphericBadge` component, import everywhere |
| Data fetched but not rendered | Industry drill-down fetches 6 fields, renders 4 | Audit fetched vs rendered on every component |
| Thresholds in code | VaNi thresholds in `scanEngine.ts` | Move to DB (`kd_scan_presets` or new table) — backlog B06 |

---

## 13. Session Handover Checklist

Before ending any session:
1. Update `POA.md` — mark completed steps, update sprint status
2. Note the exact next step with file + line references if possible
3. Note any open questions or unresolved decisions
4. Note any new bugs discovered
5. Paste session handover block:

```
SESSION HANDOVER
================
Date: YYYY-MM-DD
Active Sprint: Sprint N — [Name]
Last completed: [Step X.Y — description]
Next step: [Step X.Z — description + file reference]
Open questions:
  - [question 1]
  - [question 2]
New bugs found:
  - [BUG-XX: description]
POA: /docs/poa/POA.md
Architecture: /docs/poa/ARCHITECTURE.md
```
