---

## Sprint 10 — Sector Rotation Phase A
> NSE index-level rotation page. No AI, no Custom Index. Backend-first.

**Goal:** Build `/sector-rotation` as a dedicated page showing NSE index data from `km_index_eod` across three tabs (Broad Market / Sectoral / Thematic) with rotation signals, sortable columns, VIX header band, row drill-down drawer, and chart toggle.

**Spec doc:** `docs/specs/DristiQ_SectorRotation_Spec_v1.0.docx`

**Status: 🔨 IN PROGRESS**

---

### Phase A — Backend

| Step | Task | Status | Notes |
|---|---|---|---|
| SR-B1 | Migration: add `avg_amt_5d`, `avg_amt_22d`, `avg_amt_66d`, `score_5d`, `score_22d` to `km_index_eod` | ⬜ | Same column semantics as `km_equity_eod`. Migration number: next available. |
| SR-B2 | Extend `compute_all_index_returns` RPC (or new RPC `compute_all_index_scores`) to compute avg_amt + score columns from `value_cr` | ⬜ | LAG window per index. score formula: surge²×25 where surge = avg_amt_5d/avg_amt_22d (if surge ≥ 1). Mirrors equity pipeline. |
| SR-B3 | Backfill `km_index_eod` — run new RPC for all historical dates for all active indices | ⬜ | Run as standalone script after SR-B2. Verify coverage for index_ids 1–94. |
| SR-B4 | Verify India VIX data in `km_index_eod` for `index_id = 94` | ⬜ | Check: `SELECT trade_date, close FROM km_index_eod WHERE index_id = 94 ORDER BY trade_date DESC LIMIT 5;` |

### Phase A — Frontend

| Step | Task | Status | Notes |
|---|---|---|---|
| SR-F1 | New route `/sector-rotation` — add to router + sidebar link | ⬜ | Sidebar position: between Discovery and My Space. |
| SR-F2 | `SectorRotationPage.tsx` — page shell with VIX header band + tab strip | ⬜ | VIX from `km_index_eod WHERE index_id = 94`. Color: <15 green, 15–20 amber, >20 red. Tabs: Broad Market / Sectoral / Thematic. |
| SR-F3 | `services/sectorRotation.ts` — new service file | ⬜ | `fetchSectorIndices(category)` → `km_index_eod JOIN km_index_symbols` filtered by category. `fetchVix()` → index_id=94 latest close. |
| SR-F4 | `hooks/useSectorRotation.ts` — new hook file | ⬜ | `useSectorIndices(category)`, `useVix()`. TanStack Query, staleTime 5 min. |
| SR-F5 | `SectorRotationTable.tsx` — main data table component | ⬜ | Columns (mandatory): Index name, Close, %Chg, 1D%, 5D%, 22D%, 66D%, RSI, Score 5D, Score 22D, Avg Amt 5D, Avg Amt 22D, % Amt Chg (computed), Signal badge. Sortable by all columns. Alternating row bg. Horizontal scroll on mobile. |
| SR-F6 | Rotation signal badge logic + extend `FLOW_LABELS` / `signalScale` constants | ⬜ | Rotating In → 'Flow Entering' (green): ret_5d>0 AND score_5d>score_22d AND pct_amt_chg>15%. Rotating Out → 'Flow Exiting' (red): ret_5d<0 AND score_5d<score_22d AND pct_amt_chg<-15%. Leading → 'Sustained Flow' (amber): ret_22d>5% AND rsi_14>55 AND not rotating out. |
| SR-F7 | Optional column picker (O, H, L, Points, Volume, Turnover, MagicRS, FlowType, Sniper, 66D Avg Amt) | ⬜ | Toggle icon top-right of table. Same pattern as ScanTable column picker. |
| SR-F8 | Row click → `IndexDrawer.tsx` side panel | ⬜ | Contents: index name + category badge + signal badge, 22D sparkline (recharts LineChart), key metrics strip, top 10 constituent stocks from `useIndexConstituents(indexId)` with flow_type + rsi_14 + score_5d, "View Chart" link → `/workspace?index={indexId}`. |
| SR-F9 | Chart view toggle | ⬜ | Table \| Chart button top-right. Chart = recharts LineChart of ret_5d per index. Click row in table → adds to chart overlay (max 5 indices). |
| SR-F10 | History date picker | ⬜ | Calendar input top-right. On select: re-fetch `km_index_eod` for that trade_date. Default = latest available date. Tabs 1–3 only. |
| SR-F11 | Tab 3 (Thematic) — show all 38 thematic indices, sortable, no favourites | ⬜ | Same table component as Tabs 1–2. category = 'thematic market index'. |
| SR-F12 | Workspace URL param — verify `/workspace?index=X` pre-selects index in IndexDropdown | ⬜ | If not supported, add URL param read to WorkspacePage as small enhancement. |

### Phase A — Column Category Mapping

| Tab | `km_index_symbols.category` filter | Key indices |
|---|---|---|
| Broad Market | `'index'`, `'broad market index'` | NIFTY 50 (1), NIFTY 500 (8), NIFTY NEXT 50 (5), NIFTY MIDCAP 150 (13), NIFTY MICROCAP 250 (11) |
| Sectoral | `'sectoral index'` | AUTO (18), IT (25), PHARMA (32), BANK (2), FMCG (23), METAL (27), REALTY (35), PSU BANK (34) |
| Thematic | `'thematic market index'` | DEFENCE (66), EV (62), CPSE (60), HOUSING (63), COMMODITIES (57), ENERGY (61) |

### Phase A — New Files

| File | Type | Notes |
|---|---|---|
| `App/frontend/src/views/SectorRotationPage.tsx` | View | Main page |
| `App/frontend/src/components/domain/SectorRotationTable.tsx` | Component | Shared across all 3 tabs |
| `App/frontend/src/components/domain/IndexDrawer.tsx` | Component | Row click side panel |
| `App/frontend/src/services/sectorRotation.ts` | Service | Data fetching |
| `App/frontend/src/hooks/useSectorRotation.ts` | Hook | TanStack Query wrappers |

### Phase A — Reused (no changes needed)

| Asset | Where reused |
|---|---|
| `useIndexConstituents(indexId)` from `hooks/useMasterData.ts` | IndexDrawer constituent list |
| `FlowChip` from `IndustryRotationPanel.tsx` | Signal badge rendering |
| `fieldConfig.ts` | Column labels, formatters, color rules for shared fields |
| `FLOW_LABELS`, `ZONE_LABELS` from `constants/signalScale` | Extend for new rotation signal labels |
| `km_index_symbols` via PostgREST | Index name + category lookup |

### Phase A — Deferred to Phase B

| Item | Notes |
|---|---|
| P/E, P/B, Div Yield columns | Pipeline parses from NSE file but `km_index_eod` schema lacks columns. Add migration in Phase B. |
| Custom Index tab (Tab 4) | Requires `km_custom_index`, `km_custom_index_constituents`, `km_custom_index_eod` tables + Claude API integration. Full spec in Section 8 of spec doc. |
| Stock Tags (`km_equity_tags`) | Foundational for Custom Index Mode B. Separate backlog item. |
| Planetary events strip | Below VIX band. Links transits to sector impact. Phase B. |
| Rotation alerts | Push notification when signal badge changes. Phase B. |
| My Space widget | Sector Rotation panel as draggable workspace block. V2. |
| Strategy index tab | `category = 'strategy market index'`. 19 indices, low priority. |
| `SectorRotationFlow.tsx` in Discovery tab | Leave as-is. Address when Discovery tab is redesigned. |

---

### Backlog additions (from this session)

Add to section 4 Backlog:

| # | Item | Type | Dependency | Notes |
|---|---|---|---|---|
| B56 | Sector Rotation Phase B — Custom Index + Stock Tags | Feature | SR Phase A complete | Admin-only custom baskets. Claude API Mode A (user search) + Mode B (proactive discovery). Spec: Section 8 of SectorRotation_Spec_v1.0.docx |
| B57 | Stock Tags (`km_equity_tags`) — business model tags per equity | Data | None | Foundation for Custom Index Mode B. Each stock gets: business_type, supply_chain_position, theme_affinity[]. Generated by Claude, stored in DB, refreshed infrequently. |
| B58 | Screener URL per stock on `km_equity_symbols` | Data | None | Add `screener_url TEXT` column. Enables direct link to Screener.in from stock drawer. |
| B59 | User analytics — stock view/click/watchlist tracking | Feature | None | Who has shown interest in which stocks. Foundation for analysis reports post-MVP. |
| B60 | Analysis Reports per stock — AI-generated research | Feature | Post-MVP | Claude-generated research brief per stock. Triggered on-demand. |

---

### Locked Decisions (from this session)

Add to section 2 Locked Decisions:

| # | Decision | Rationale |
|---|---|---|
| D21 | Sector Rotation uses `km_index_eod` not `km_industry_eod` | Industry Rotation = stock classification aggregation. Sector Rotation = NSE index-level data. Two different things. |
| D22 | `km_index_symbols.category` column drives Sector Rotation tab grouping | Already encodes Broad / Sectoral / Thematic / Strategy. No new config needed. |
| D23 | Custom Index is Admin-created only — shared with all users | No user-specific baskets. Admin manages create/edit/deactivate via Settings. |
| D24 | Custom Index LLM = Claude API (not Qwen3) | Niche theme identification requires stronger reasoning. Infrequent on-demand calls — cost justified. |
| D25 | VIX displayed in header band above all tabs — not as a table column | Context layer, not data layer. Color-coded: <15 green, 15–20 amber, >20 red. index_id = 94 in `km_index_symbols`. |
| D26 | All Sector Rotation tabs sortable by all columns — no favourites, no presets | Show all indices per tab. User sorts to find what they need. |
| D27 | `km_index_composition` is deprecated — never use | FK points to old `km_index_master`. `km_index_constituents` is the live production table. |
| D28 | P/E, P/B, Div Yield deferred — NSE file provides data but schema gap exists | Add to `km_index_eod` in a future migration after Phase A is stable. |
