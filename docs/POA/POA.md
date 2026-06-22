# DristiQ — Plan of Action (POA)
> Living document. Updated every session. Single source of truth for all work items.
> Location in repo: `/docs/poa/POA.md`
> Last updated: 2026-06-22

---

## 1. Product Vision

DristiQ is a Vedic astro-market intelligence data platform for Indian equity traders and investors. It combines Vedic astrology/panchang data, technical indicators, proprietary widgets, and market scanners into a composable framework canvas. The core philosophy: astro signals provide advance warning; technicals provide confirmation. DristiQ is a "weather report" — never a signal or buy/sell recommendation engine. VaNi is the AI companion — agentic, canvas-aware, language-constrained to never make directional calls.

---

## 2. Locked Decisions
> These are final. Never revisited without explicit agreement.

| # | Decision | Rationale |
|---|---|---|
| D1 | DristiQ is a framework/data platform, not a signal engine | Core philosophy |
| D2 | VaNi never makes directional calls | Product constraint |
| D3 | Astro signals = advance warning; technicals = confirmation. Never collapse these two layers | Architecture principle |
| D4 | magic_rs benchmarked against NIFTY 500, hardcoded by name lookup | Confirmed from codebase |
| D5 | ICP mode stored in `km_profiles.icp_mode` column (not localStorage) | Consistent with theme storage pattern |
| D6 | ICP default = 'astro' for existing users | Migration default |
| D7 | Index preference persisted via frameworkStore + user_frameworks DB | Existing pattern, reuse |
| D8 | Workspace tab default: astro ICP → Today tab; technical ICP → Discovery tab | UX decision |
| D9 | Morning Brief moves from modal → pinned strip in Today tab | UX decision |
| D10 | Tab 3 (My Space) = current WorkspaceCanvas, no new features for MVP | Simplicity |
| D11 | UX design first → wire existing data → identify gaps → build gaps → cleanup | Build order |
| D12 | Scanner-specific filters (not universal filters) | UX decision |
| D13 | VaNi inference: midnight batch primary, on-demand fallback if no cache | Architecture decision |
| D14 | Smart cache invalidation on metric change, not TTL-based | Architecture decision |
| D15 | Forbidden phrases are phrase-level blocks, not blanket word bans | VaNi language constraint |
| D16 | All VaNi prompts centralized in `lib/ai_prompts.py` as SKILLS registry | Code pattern |
| D17 | Index IDs never hardcoded — always name-based lookup | Code pattern |
| D18 | Migrations run manually — no automated migration tooling | Infra constraint |
| D19 | `v_equity_eod_deduped` is canonical source for all cross-stock queries | Data pattern |
| D20 | Walk mode deferred post-cashflow | Parked |

---

## 3. Active Sprint
> Current focus. One sprint at a time.

### Sprint 7 — Field Config + StockCard ✅ COMPLETE

**Goal:** Centralise all field display logic into `src/config/fieldConfig.ts` so ScanTable and StockCard share one source of truth for labels, tooltips, formatters, and color rules.

**Status: ✅ COMPLETE**

| Step | Task | Status | Notes |
|---|---|---|---|
| 7.1 | Create `fieldConfig.ts` — labels, tooltips, formatFn, colorFn, thresholds for all 30 fields. Refactor ScanTable to import from it. | ✅ | ScanTable: 516 → 393 lines. fieldConfig: 520 lines. Zero new TS errors. |
| 7.2 | Wire StockCard to fieldConfig | ✅ | colorToBg/colorToBorder helpers; MrsPill, SignalTower, StageBadge, flow_type, RSI, rvol, zone pill all use getColor/formatValue/getLabel. RSI >70 corrected to bear (overbought). sniper_hot label → 'Hot Money'. |
| 7.3 | Wire ConvictionFlowCards + BreakoutSurgeCards to fieldConfig | ✅ | delivery_surge_x 3-level color; avg_amt labels → 'Score 5D'/'Score 22D'; rsi/rss/pct_from_breakout/rvol all use getColor. |
| 7.4 | MiniTower bars for score fields in ScanTable + MRS zone dot | ✅ | MiniTower.tsx created; score50/score100 cells show 5-bar tower + number; sniper_hot → gold; rss_value → accent; MRS dot 7px. |
| C43 | **Bug fix**: `mcap_cr: null` → `sym.mcap_cr ?? null` in `buildStockFromEod()` | ✅ | ManipulationWatch now shows correct MCap. Only that path was affected — all other scanners already read sym.mcap_cr correctly. Sprint 7. |
| 7.5 | Auto-generate tooltips from fieldConfig — remove hardcoded strings in StockCard | ✅ | SignalTower tooltip prop → `getTooltip('sniper_inst'/'sniper_hot') ?? ''`. MrsPill title → `<Tooltip>` component wrapping. Added `getTooltip` + `Tooltip` imports to StockCard. |
| 7.6 | Final audit + add missing fields to fieldConfig (d_pct, deliv_value_cr, ret_66d) | ✅ | w52_high already present. Exceptions confirmed: pctColor/distColor in card tables for return fields are intentional simple +/- coloring, not field-config violations. |

---

### Sprint 4 — Workspace Shell Redesign ✅ COMPLETE
**Goal:** Replace the current single-canvas workspace with a 3-tab shell (Today / Discovery / My Space). Wire existing components. No new backend work except `icp_mode` migration.

**Status: ✅ COMPLETE**

| Step | Task | Status | Notes |
|---|---|---|---|
| 4.1 | Migration: add `icp_mode` to `km_profiles` | ✅ | `DEFAULT 'astro'`, CHECK constraint |
| 4.2 | Update profile type + authStore to include `icp_mode` | ✅ | Follows after 4.1 |
| 4.3 | Extract `IndexDropdown` from `WorkspaceCanvas.tsx` | ✅ | Lines 254–361, pure extraction, no logic change |
| 4.4 | WorkspacePage shell: add 3-tab state + tab bar UI | ✅ | `activeTab: 'today' \| 'discovery' \| 'myspace'` |
| 4.5 | Tab 1 (Today): assemble existing components, ICP-aware | ✅ | See component matrix below |
| 4.6 | Tab 2 (Discovery): SectorRotationFlow + scanner widgets | ✅ | Fix zone color bug during this step |
| 4.7 | Tab 3 (My Space): drop WorkspaceCanvas in, remove Morning Brief | ✅ | Zero logic changes |
| 4.8 | ProfileSetup wizard: add Astro/Technical ICP question | ✅ | Screen 2, save to `icp_mode` |
| 4.9 | Atmospheric badge: move to tab bar (visible all tabs) | ✅ | Currently only on Stage 2 Leaders |
| 4.10 | QA + review | ✅ | Charan reviews each tab before sign-off |

**Tab 1 (Today) — Component Matrix:**
| Component | File | Astro ICP | Tech ICP | Notes |
|---|---|---|---|---|
| VaNiMorningBrief | WorkspacePage.tsx | ✅ | ✅ | Pinned strip, not modal |
| MarketWeatherCard | DashboardV3/MarketWeatherCard.tsx | ✅ | ✅ | Pass date |
| MarketBreadthChart | MarketBreadthChart.tsx | ✅ | ✅ | Self-contained |
| BreadthRocChart | BreadthRocChart.tsx | ✅ | ✅ | Self-contained |
| IndexDropdown + Chart | WorkspaceCanvas.tsx (extract) | ✅ | ✅ | Reuse frameworkStore |
| PanchangamCard | PanchangamCard.tsx | ✅ | ❌ | Pass date |
| CurrentSkyRail | DashboardV3/CurrentSkyRail.tsx | ✅ | ❌ | Pass date |
| SixDayOutlookCompact | DashboardV3/SixDayOutlookCompact.tsx | ✅ | ❌ | Pass date |
| NakVaraSignals | DashboardV3/NakVaraSignals.tsx | ✅ | ❌ | Pass date |

**Tab 2 (Discovery) — Component Matrix:**
| Component | File | Status | Notes |
|---|---|---|---|
| SectorRotationFlow | DashboardV3/SectorRotationFlow.tsx | ✅ Drop-in | Fix zone color bug: 'strong_bull' → 'Strong Bull' |
| Scanner mini-widgets | New component | 🔨 Build | 4-row mini-table per scanner, "View all →" to /scanner/:id |

**Bug to fix in this sprint:**
- `SectorRotationFlow` StockDrawer: zone color never matches — DB stores `'Strong Bull'` but code checks `'strong_bull'`

---

## 4. Backlog
> All known work items. Prioritized. Not yet in a sprint.

### P0 — Critical (next sprint candidates)

| # | Item | Type | Dependency | Notes |
|---|---|---|---|---|
| ~~B01~~ | ~~ISIN dedup on all 6 new scanners~~ | ~~Bug Fix~~ | ~~None~~ | → C27 |
| ~~B02~~ | ~~Table view for all scanners~~ | ~~UX Build~~ | ~~None~~ | → C29 |
| ~~B03~~ | ~~`is_vani_surge` + `is_vani_breakout` missing from ScanDataBundle EOD SELECT~~ | ~~Bug Fix~~ | ~~None~~ | → C28 |
| ~~B04~~ | ~~Scanner-specific filters~~ | ~~Architecture~~ | ~~B02 (table view)~~ | → C30 |

### P1 — Important

| # | Item | Type | Dependency | Notes |
|---|---|---|---|---|
| B05 | Show "vs N500" label on MagicRS everywhere in UI | Clarity Fix | None | magic_rs is always vs NIFTY 500 — users don't know this |
| B06 | 3-tier config: Admin → User → Session thresholds | Architecture | None | Thresholds move from code → DB |
| B07 | User saved filters per scanner | Feature | B04 | Named filter sets per scanner per user |
| B08 | VaNi midnight batch + on-demand fallback | Feature | None | Midnight generates inference; on-demand if no cache |
| B09 | Smart cache invalidation (metric-change trigger) | Architecture | B08 | Regenerate only when key metric changes, not daily |
| ~~B10~~ | ~~Atmospheric badge on all scanners~~ | ~~Bug Fix~~ | ~~None~~ | → C19 |
| B11 | Render fetched fields in industry drill-down | Quick Win | None | RSI, flow_type, rvol, sniper already fetched but not shown |
| B12 | Click-through from drill-down stock → Visual Pulse page | Quick Win | None | Dead end currently |
| B13 | Lookback filter 5D/22D/66D on sector rotation | Feature | None | Currently hardcoded at 5D |
| B14 | RS vs MagicRS distinction in UI | Clarity | None | Two different things, currently conflated |
| B15 | Admin UI for VaNi thresholds | Feature | B06 | Per-scanner threshold management |
| B16 | smart_money scanner vani_rule = null | Bug Fix | None | No VaNi chip showing — needs `vani_rule = 'is_vani_smart'` |

### P2 — Next Phase

| # | Item | Type | Dependency | Notes |
|---|---|---|---|---|
| B17 | Heatmap view for scanners | UX Build | B02 | Third view mode after table + card |
| B18 | Graphical VaNi inference — Level 1 (annotated sparkline) | Feature | B08 | First phase of 4-level VaNi visual |
| B19 | Graphical VaNi inference — Level 2 (radar chart) | Feature | B18 | 5-6 dimensions per stock |
| B20 | Graphical VaNi inference — Level 3 (composite visual brief) | Feature | B19 | Sparkline + radar + 3-line summary |
| B21 | Graphical VaNi inference — Level 4 (full VaNi chat per stock) | Feature | B20 | User can ask follow-up questions |
| B22 | Missing scanners: Weekly Breakouts | Build | None | close > highest close in 20D, rvol > 2 |
| B23 | Missing scanners: Monthly Breakouts | Build | B22 | Monthly timeframe variant |
| B24 | Missing scanners: Daily Breakdown | Build | None | Short mirror of fresh_breakout |
| B25 | Missing scanners: Weekly Breakdown | Build | B24 | Weekly timeframe variant |
| B26 | Missing scanners: Monthly Breakdown | Build | B25 | Monthly timeframe variant |
| B27 | Missing scanners: Oversold with Volume | Build | None | Reversal category |
| B28 | Missing scanners: Overbought High Volume | Build | None | Reversal category |
| B29 | Missing scanners: High Trade Scan | Build | None | Highest turnover stocks |
| B30 | Missing scanners: High 5D Amount near EMA30 | Build | None | Market Activity category |
| B31 | Missing scanners: Stocks 5% Up Today | Build | None | Momentum category |
| B32 | Missing scanners: Stocks Down 5% Today | Build | None | Momentum category |
| B33 | Missing scanners: Stocks Up 20% 5D | Build | None | Momentum category |
| B34 | Missing scanners: Stocks Down 20% 5D | Build | None | Momentum category |
| B35 | Missing scanners: Relative Strength Scan | Build | None | Standalone RS scanner |
| B36 | Missing scanners: Top 100 by 5D Score | Build | None | Sort conviction_flow by avg_amt_5d DESC |
| B37 | Missing scanners: Top 100 by 22D Score | Build | None | Sort conviction_flow by avg_amt_22d DESC |
| B38 | Astro confluence on sector/industry view | Feature | None | Favorable/unfavorable badge per sector |
| B39 | VaNi sector-level commentary | Feature | B08 | Sector-level VaNi narrative |
| B40 | Heatmap for sector rotation | UX Build | None | Sectors as colored cells |
| B41 | Consolidate 4 rotation implementations | Tech Debt | None | IndustryRotationPanel, SectorRotationStrip, SectorRotationFlow, IndustryTransitionView |
| B42 | Stage 2 Watch: review pct_above_150 filter removal | Review | None | Now shows very extended stocks (120%+) |
| B43 | Stage 4 Leaders: add sma_50 < sma_200 server-side | Improvement | None | Currently death cross is client-side |
| B44 | VaNi Opportunity threshold review | Review | None | 12 stocks today — rs>80 may be too strict |
| B45 | Product-led onboarding UX — guided exploration flow | Feature | Sprint 4 | Full onboarding redesign post workspace shell |
| B46 | User-specific VaNi thresholds | Feature | B06, B15 | Users override admin defaults |
| B47 | Community saved filters (users share filter sets) | Feature | B07 | Optional — review post MVP |

### P3 — Future

| # | Item | Type | Notes |
|---|---|---|---|
| B48 | Multi-benchmark RS (Midcap 150 etc.) | Future | `p_benchmark_id` param exists in SQL, not wired |
| B49 | Morning Star / Evening Star pipeline flags | Future | `is_vani_morning_star`, `is_vani_evening_star` in backfill_vani_flags.py |
| B50 | Walk mode full implementation | Future | Blocked: TradingChart does not read from chartSyncStore. Full spec in CLAUDE.md |
| B51 | Unified Rule Architecture Phase A | Future | Technical rules in registry. Spec at docs/architecture/unified-rule-architecture.md |
| B52 | Unified Rule Architecture Phase B | Future | Unified correlation engine. Depends on Phase A |
| B53 | Master Frameworks catalog section | Future | Deferred post-cashflow |
| B54 | VaNi fine-tuning dataset | Ongoing | Every VaNi interaction logged to vn_interaction_log in vani_db from day one |
| B55 | Breakout event detection pipeline | Future | Store true `breakout_price`, `breakout_date`, ageing in DB. Currently all computed client-side as 20-bar rolling high only. |

---

## 5. Parked Items
> Explicitly deferred. Reason documented.

| # | Item | Reason | Revisit When |
|---|---|---|---|
| P01 | Walk mode | Blocking: TradingChart doesn't read chartSyncStore. Full spec in CLAUDE.md | Post-cashflow |
| P02 | Unified Rule Architecture (Phase A + B) | Deferred post-cashflow | Post-cashflow |
| P03 | Master Frameworks catalog | Deferred post-cashflow | Post-cashflow |
| P04 | Morning brief screener feed | Deferred to screener session | Screener sprint |
| P05 | User workspace customization (Tab 3) | Post-MVP simplicity decision | V2 |
| ~~P06~~ | ~~scanConvictionFlow + scanBreakoutSurge vani_rule migration~~ | ~~Blocked: is_vani_surge + is_vani_breakout missing from ScanDataBundle~~ | → C28 (B03 complete) |
| P07 | NSE data gap (876 of 1380 stocks) | Pipeline ingestion issue in bhav copy downloader — investigation ongoing | When pipeline fixed |

---

## 6. Completed
> Done and verified.

| # | Item | Sprint | Notes |
|---|---|---|---|
| C01 | Razorpay subscription model | Sprint 3 | Quarterly ₹1,999 / Yearly ₹4,999 / Trial ₹199 |
| C02 | `rs_percentile` column + nightly compute (step 6k) | Sprint 3 | 0-100 percentile on km_equity_eod |
| C03 | `vani_rule` column on kd_scan_presets | Sprint 3 | Drives VaNi chip logic |
| C04 | `computeVaniOpportunity()` helper | Sprint 3 | Centralized VaNi chip computation |
| C05 | stage_2_leaders scanner | Sprint 3 | 367 stocks, sort: magic_rs DESC |
| C06 | stage_2_watch scanner | Sprint 3 | 100 stocks, sort: rs_percentile DESC |
| C07 | vani_opportunity scanner | Sprint 3 | 25 stocks, sort: rs_percentile DESC |
| C08 | stage_4_leaders scanner | Sprint 3 | 200 stocks, sort: rs_percentile ASC |
| C09 | stage_3_watch scanner | Sprint 3 | 100 stocks, sort: convergence ASC |
| C10 | vani_exit_watch scanner | Sprint 3 | 25 stocks, sort: rs_percentile ASC |
| C11 | Morning brief sequential LLM calls + cache | Sprint 3 | Per-item calls, cache-aware serving |
| C12 | Forbidden phrase enforcement (phrase-level) | Sprint 3 | Not blanket word ban |
| C13 | Intra-day panchang transition alerts | Sprint 3 | Added to morning brief |
| C14 | Cross-user Zustand state leak fix | Sprint 3 | auth SIGNED_OUT listener resets framework |
| C15 | km_equity_weekly + km_equity_monthly tables | Previous | 60 columns each, full historical backfill |
| C16 | Weekly/monthly bar aggregation pipeline | Previous | 94.4% weekly, 76.7% monthly coverage |
| C17 | Alpha Edge formula validated | Sprint 3 | rs>50, NSE, any stage |
| C18 | magic_rs benchmark confirmed: NIFTY 500 | This session | Hardcoded by name lookup at runtime |
| C19 | Atmospheric badge extracted + added to all scanners and workspace tab bar | Sprint 4 | — |
| C20 | BUG-01 fixed — SectorRotationFlow zone color mismatch (Title Case vs snake_case) | Sprint 4 | — |
| C21 | Workspace 3-tab shell (Today / Discovery / My Space) | Sprint 4 | — |
| C22 | icp_mode column added to km_profiles | Sprint 4 | — |
| C23 | IndexDropdown extracted to standalone component | Sprint 4 | — |
| C24 | VaNiMorningBrief pinned mode added | Sprint 4 | — |
| C25 | ProfileSetup ICP question added | Sprint 4 | — |
| C26 | ScannerWidget component created | Sprint 4 | — |
| C27 | B01 — ISIN dedup verified on all 6 scanners, no fixes needed. VaNi Opportunity edge case noted in Known Risks. | Sprint 5 | — |
| C28 | B03 — `is_vani_surge` + `is_vani_breakout` added to ScanDataBundle EOD SELECT. convictionFlow and breakoutSurge VaNi migrated to `computeVaniOpportunity()`. | Sprint 5 | — |
| C29 | B02 — `ScanTable.tsx` built with preset-specific column sets, column picker, sortable headers, RSI/RSS/5D-vs-22D highlighting, Table/Cards toggle. | Sprint 5 | — |
| C30 | B04 — `ScanFilterBar.tsx` built with preset-specific filter groups, client-side filtering, industry multi-select, collapsible UI. | Sprint 5 | — |
| C31 | `fetchStage2Watch` + `fetchVaNiOpportunity` expanded from 9 to 36 columns — matches `fetchStage2Leaders`. | Sprint 5 | — |
| C32 | VaNi flags backfill run manually (6h + 6j) for 2026-06-19. `is_vani_*` columns now populated. | Sprint 5 | — |
| C33 | Scanner horizontal scroll fixed — `width: max-content` + `minWidth: 100%` on table element. | Sprint 6 | — |
| C34 | Font/visibility improvements across ScanTable — row height 40, symbol 13px/600, company 11px. | Sprint 6 | — |
| C35 | VaNi Opportunity fixed — switched from `rs_percentile > 80` to `is('is_vani_s2', true)`. | Sprint 6 | — |
| C36 | rel_5d_n50/rel_5d_n500 removed from column picker — always null for all scanners. | Sprint 6 | — |
| C37 | `stage` added to bundle SELECT + buildScanStock mapper — Breakout Surge now shows real S1/S2/S3/S4. | Sprint 6 | — |
| C38 | `breakout_surge` PresetGroup introduced — ret_5d/ret_22d optional cols only for breakout_surge. | Sprint 6 | — |
| C39 | A/D blank root cause diagnosed — BUG-08 confirmed. Pipeline covers 1.2% of equity universe. Frontend correct. | Sprint 6 | — |
| C40 | Terminology standard locked and applied — Institution, Hot Money, Accum/Dist across ScanTable. Surge× label added to ConvictionFlowCards hero. | Sprint 6 | — |
| C41 | Tooltip component built (`src/components/ui/Tooltip.tsx`) — reusable, themed, arrow-positioned, 300ms delay. | Sprint 6 | — |
| C42 | Tooltips added to all ScanTable column headers with full explanations. | Sprint 6 | — |
| C43 | Bug fix: `mcap_cr: null` hardcoded in `buildStockFromEod()` → `sym.mcap_cr ?? null`. ManipulationWatch MCap now correct. | Sprint 7 | — |
| C44 | `fieldConfig.ts` created — single source of truth for all field labels, tooltips, types, thresholds, colors. 33 fields defined. | Sprint 7 | — |
| C45 | `ScanTable.tsx` refactored to use fieldConfig — 123 lines removed. | Sprint 7 | — |
| C46 | `StockCard.tsx` wired to fieldConfig — colors, labels, tooltips standardized. | Sprint 7 | — |
| C47 | `ConvictionFlowTable` + `BreakoutSurgeTable` wired to fieldConfig — 45 lines removed. | Sprint 7 | — |
| C48 | `MiniTower` component built — vertical bar chart for score fields in table view. Same visual language as card SignalTower. | Sprint 7 | — |
| C49 | All StockCard tooltips auto-generated from fieldConfig — no hardcoded strings remain for shared fields. | Sprint 7 | — |
| C50 | Visual language standardized across Table and Card views — same color thresholds, same labels, same tower bars. | Sprint 7 | — |
| C51 | Institution=green, Hot Money=gold, RSS=indigo — distinct color language per signal type locked in fieldConfig. | Sprint 7 | — |
| C52 | MRS zone dot added to ScanTable — colored 7px dot before number matches card zone color. | Sprint 7 | — |

---

## 11. Known Risks (not bugs)
> Observed edge cases that don't cause incorrect behavior today but could surface under specific conditions. Monitor over time.

| # | Risk | Location | Detail |
|---|---|---|---|
| KR01 | `fetchVaNiOpportunity` applies `.limit(25)` server-side before client-side ISIN dedup | `scanEngine.ts` — `fetchVaNiOpportunity()` | If the top 25 server-side rows contain dual-listed pairs, dedup reduces final count below 25. Other scanners fetch larger limits (100–500) then dedup to target. Low priority — monitor. |
| KR02 | HOT$ (`sniper_hot`) showing 50.00 uniformly across all stocks | `km_equity_eod.sniper_hot` | May be DB default or pipeline artifact. Needs backend pipeline investigation before next sprint. |
| BUG-08 | `compute_all_flow_intelligence()` covers only ~64 of 5,346 stocks (1.2%) on 2026-06-19. A/D column shows — for 98.8% of stocks. Backend pipeline investigation needed. Frontend rendering is correct. | `km_equity_eod.accum_distrib`, pipeline step 6d | Confirmed via DB query: 5,282 NULL vs 64 non-null on 2026-06-19. Values that exist are correct (ACCUMULATION/DISTRIBUTION). |
| BUG-09 | `sniper_hot` = 50.00 uniformly across all stocks. Pipeline compute artifact. Backend investigation needed. | `km_equity_eod.sniper_hot` | Same class of issue as BUG-08. Pipeline step not covering full equity universe. |
| ~~BUG-10~~ | ~~RSS showing high values in Stage 2 Leaders~~ | withdrawn | **Not a bug** — strong momentum stocks have high RSS by design. RSS is a momentum oscillator; Stage 2 leaders are the strongest stocks in the market. High RSS is correct behavior. |

---

## 7. Scanner Inventory
> Current state of all scanners.

| Scanner ID | Name | Category | Status | Result Count | Sort | VaNi Rule |
|---|---|---|---|---|---|---|
| stage_2_leaders | Stage 2 Leaders | Stage | ✅ Live | 367 | magic_rs DESC | is_vani_s2 |
| stage_2_watch | Stage 2 Watch | Stage | ✅ Live | 100 | rs_percentile DESC | is_vani_s2 |
| vani_opportunity | VaNi Opportunity | Stage | ✅ Live | 25 | rs_percentile DESC | is_vani_s2 |
| stage_4_leaders | Stage 4 Leaders | Stage | ✅ Live | 200 | rs_percentile ASC | — |
| stage_3_watch | Stage 3 Watch | Stage | ✅ Live | 100 | convergence ASC | — |
| vani_exit_watch | VaNi Exit Watch | Stage | ✅ Live | 25 | rs_percentile ASC | — |
| power_buy | Power Buy | Existing | ✅ Live | — | — | is_vani_s2 |
| power_sell | Power Sell | Existing | ✅ Live | — | — | — |
| smart_money | Smart Money | Existing | ✅ Live | — | — | null ⚠️ |
| fresh_breakout | Fresh Breakout | Breakout | ✅ Live | — | — | — |
| quiet_accumulation | Quiet Accumulation | Existing | ✅ Live | — | — | — |
| distribution_warning | Distribution Warning | Existing | ✅ Live | — | — | — |
| conviction_flow | Conviction Flow | Delivery | ✅ Live | 50 | delivery_surge_x DESC | is_vani_surge_or_breakout |
| breakout_surge | Breakout Surge | Breakout | ✅ Live | 50 | rvol DESC | is_vani_s2 |

**Missing scanners to build** — see B22–B37 in backlog.

---

## 8. Data Infrastructure
> Key tables, columns, pipeline steps. Reference before any query work.

| Item | Detail |
|---|---|
| Canonical cross-stock source | `v_equity_eod_deduped` |
| RS benchmark | NIFTY 500 (hardcoded by name lookup) |
| Stage computation | `backfill_stage_classification.py` (pipeline step 6h) |
| VaNi flags | `backfill_vani_flags.py` (pipeline step 6j) |
| RS percentile | `backfill_rs_percentile.py` (pipeline step 6k) |
| NSE clean symbol filter | `symbol ~ '^[A-Z]'` |
| Weekly/Monthly tables | `km_equity_weekly`, `km_equity_monthly` |
| VaNi interaction log | `vn_interaction_log` in `vani_db` |
| LLM endpoint | `llm.dristiq.io` (Qwen3 4B, self-hosted) |
| LLM directive | `/no_think` must be in all Qwen3 calls |
| Legacy columns (NEVER use) | `magicrs_value`, `sniper_banker`, `sniper_hotmoney`, `accum_dist`, `vacuum_status`, `flow_meaning` |

---

## 9. Session Handover Format
> Paste this at the start of each new session.

```
SESSION START
POA: /docs/POA/POA.md
Architecture: /docs/POA/ARCHITECTURE.md
Active Sprint: Sprint 4 — Workspace Shell Redesign
Last completed step: [FILL IN]
Next step: [FILL IN]
Open questions: [FILL IN]
```

---

## 10. Session Handover

```
SESSION HANDOVER
================
Date: 2026-06-22
Active Sprint: Sprint 7 — COMPLETE
Last completed: fieldConfig + visual language standardization
                across all views. 7.6 audit + 3 fields added.
Next sprint: Sprint 8 — Backend pipeline fixes + Missing scanners
Next steps in priority order:
  BACKEND (needs VPS session):
  - BUG-08: compute_all_flow_intelligence() covers only 1.2%
            of stocks — A/D unusable
  - BUG-09: sniper_hot = 50 uniformly — pipeline cap
            investigation
  FRONTEND:
  - B05: Show vs N500 label on MagicRS in UI
  - B11: Render fetched fields in industry drill-down
  - B12: Click-through drill-down → Visual Pulse
  - B13: Lookback filter 5D/22D/66D on rotation
  - B16: smart_money vani_rule = null fix
  - B22-B26: Missing breakout/breakdown scanners
  - BUG-04: Dead sidebar links (/transmission, /history)
Open questions:
  - When will pipeline run for 2026-06-22 market data?
    Manual backfill needed (6h → 6j → 6k) for Monday's data
New bugs found: None this sprint
POA: /docs/POA/POA.md
Architecture: /docs/POA/ARCHITECTURE.md
  - BUG-08: A/D pipeline under-population
  - BUG-09: sniper_hot uniform value
POA: /docs/poa/POA.md
Architecture: /docs/poa/ARCHITECTURE.md
```
