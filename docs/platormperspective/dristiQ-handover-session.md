# DristiQ — Mentor Handover Brief
**For:** New Claude session acting as mentor to Claude Code
**From:** Current Claude session
**Date:** May 2026
**Read this entire document before responding to anything.**

---

## Who You Are In This Session

You are **Claude acting as a product + technical mentor** to Claude Code.

Charan (the product owner) will relay information between you and Claude Code. You do not have direct access to the codebase. Claude Code does the actual work. Your job is to:

- Give Claude Code precise, unambiguous implementation instructions
- Ask Claude Code the right audit questions to understand what exists
- Identify structural problems before they become implementation mistakes
- Keep Claude Code aligned with the UX and interaction spec
- Catch drift — when implementation diverges from design intent, name it and correct it
- Identify stale code that should be removed — dead weight slows everything down

You are **not** here to write code. You are here to make sure the right code gets written — and the wrong code gets removed.

---

## Who Charan Is

Charan is the product owner of DristiQ. He is technically knowledgeable but not a programmer. He works as the relay between you and Claude Code.

**His working methodology — follow this exactly:**
1. **Discuss first** — align on scope before any building
2. **Get facts** from Claude Code via Charan as relay
3. **Give precise instructions** to Claude Code via Charan
4. **Review output** — Charan shares results back
5. **Iterate or lock** — no revisiting locked decisions

**How Charan communicates:**
- Casual, fast, sometimes abbreviated
- He will correct you if you ask too many questions instead of acting
- He expects you to read between the lines and be decisive
- When he says "go ahead" — go ahead, don't ask more questions
- When he says "let me see" — he wants to review before you proceed
- One question at a time maximum — never a list of questions

---

## What DristiQ Is

DristiQ (formerly Kāla-Drishti) is a **market intelligence data platform** for Indian equity traders and investors. It combines Vedic astro-market rules, technical indicators, proprietary widgets, and market scanners into a composable framework a user builds and owns.

**Core philosophy (never violate):**
> Astro signals = advance warning. Technicals = confirmation.

**Product character:**
> DristiQ is a data platform — not an opinionated signal product. Users build their own framework. VaNi is the agent that helps them build it and explains what it finds.

**VaNi** is the product's AI agent — not a chatbot. VaNi acts on the UI: places blocks, highlights chart zones, surfaces data, detects confluence. VaNi never blocks — every action is dismissable.

---

## The Full UX Package (Already Designed and Locked)

These HTML files are the complete visual reference. Claude Code must read them before touching any frontend:

| File | What it shows |
|------|--------------|
| `dristiQ-onboarding-v2.html` | VaNi introduction → ICP question → live framework build → instrument selector |
| `dristiQ-workspace.html` | Composable canvas — view mode + edit mode + catalog drawer + VaNi Action Island |
| `dristiQ-catalog.html` | Five catalog sections + rule deep dive panel |
| `dristiQ-correlation.html` | VaNi Correlation Block on workspace |
| `dristiQ-correlation-v2.html` | Four type-specific correlation views with shared anatomy |
| `dristiQ-business-model.html` | Instrument selector, pricing page, inline gate, beta workspace |
| `dristiQ-adaptive-correlation.html` | Four adaptive shapes for unknown combinations |

**Full interaction specification:**
`dristiQ-interaction-spec.md` — 16 sections. Read in full. This is the source of truth.

---

## Current State of the Product

The product is at **stage 75** — four major sprints completed this session. The mission remains: **harness and extend what's there, not rebuild from scratch.**

---

## Completed Sprints (Do Not Rebuild)

### ✅ Sprint 1 — Foundation
- CLAUDE.md updated — M063–M088 documented, next migration: **089**
- Dead code cleared — 431 lines removed (geminiService, BacktestView, TransmissionView, DashboardView v1, supabase shim, VaNiCard legacy, AstroSignalBadge legacy)
- LLM consolidated — single routing path via `ai_client.py`, Qwen3 live
- `vn_interaction_log` table created in `vani_db` — interaction logging active
- Thumbs up/down feedback wired — writes `user_rating` to `vn_interaction_log`
- 5 domain skills installed at `/mnt/skills/user/` on Charan's laptop

### ✅ Sprint 2 — Framework Phase 1
- `frameworkConstants.ts` — all block types, placement types, tier types as `as const` arrays. **Never define these inline — always import from this file.**
- `catalogItems.ts` — 15 static catalog items (indicators + widgets). Astro rules come from DB dynamically, not this file.
- `framework.ts` — TypeScript interfaces: `UserFramework`, `FrameworkBlock`, `ChartOverlay`, `GridPosition`
- `user_frameworks` table — Migration **M088**, live in `kaala_dristi_db`
- `frameworkStore.ts` — Zustand store, `isBlockActive()` / `isOverlayActive()` are the **sole source of truth** for active state. No component derives this independently.
- Framework API endpoints — `GET/POST/PUT /api/framework/{user_id}` in `pipeline2_api.py`, JWT auth via `lib/auth.py`
- `useAddToFramework.ts` — universal hook, handles tier gate + placement routing

### ✅ Sprint 3 — Framework Phase 2 (Onboarding + Workspace Canvas)
- `frameworkTemplates.ts` — 4 ICP templates (investor/trader/hybrid_weighted/hybrid_balanced)
- Onboarding replaced — `ProfileSetup.tsx` is now a 4-screen VaNi flow (Introduction → ICP Question → Build Animation → Instrument Selector)
- Onboarding forced for all users — routing checks `onboarded AND has framework (version > 1)`, not just `onboarded` flag
- `applyTemplate()` → `saveFramework()` → redirect: immediate save before redirect prevents timing gap
- `/workspace` route — `WorkspacePage` + `WorkspaceCanvas` + `WorkspaceBlock`
- 12×10 CSS Grid canvas — view mode + edit mode + drag/resize via `@dnd-kit/core`
- Chart overlay pill strip in workspace topbar
- Instrument selector for free tier — live query from `km_equity_symbols` ordered by `mcap_cr DESC NULLS LAST`

### ✅ Sprint 4 — Catalog
- `/catalog` route with 5 sections: Master Frameworks / Astro Rules / Indicators / Widgets / Scanners
- **Astro Rules** — reuses `ruleService.ts` queries, same React Query cache as `/rules`. Cache shared, zero duplicate network calls.
- **Indicators** — 3-column grid from `CATALOG_ITEMS`, `useAddToFramework()` wired
- **Widgets** — live Nifty 50 previews via `useNiftyPulse()` hook (`NIFTY_50_ID = 1`). `BreadthRocChart` and `SixDayOutlookCompact` render directly (self-fetching). `OrderFlowCard`, `SmartMoneyCard`, `MagicRsSubchart` wrapped with Nifty 50 data.
- **Scanners** — 8 cards from `SCAN_PRESETS`, navigate to `/scanner/:id`
- **DeepDivePanel** — Mode A (Astro Rule: backtesting stats + yearly chart + "Full Analysis →" link to `/rules/:id`) / Mode B (Indicator/Widget: metadata only)
- **CatalogDrawer** — slides in from workspace, reuses section components, 3 entry points wired (+ overlay pill, add-zone placeholders, empty state link)
- **CatalogActionIsland** — floating pill on `/catalog`, shows block count, navigates to `/workspace`
- Correlation slider clipping fixed — `minHeight: 0` on flex scroll container in `VisualPulsePage`

---

## Infrastructure Reality

### Two-VPS Setup

| VPS | IP | Role | Status |
|-----|----|------|--------|
| Main | 187.127.136.65 | PostgreSQL 17 + PostgREST + Nginx + DristiQ FastAPI | Live ✓ |
| LLM | 72.60.222.136 | Qwen3 4B + N8N + Traefik | Live ✓ |

### LLM — Qwen3 is Live, Use It

VaNi calls Qwen3 at `https://llm.dristiq.io`. Never call Anthropic API for VaNi.

```
Endpoint:  https://llm.dristiq.io/v1/chat/completions
API Key:   vk-llm-d0efccfd15c0b8fd72214d0b9182032f84106b43
Format:    OpenAI-compatible
```

**Critical rule:** Always include `/no_think` in the system prompt. Without it, Qwen3 includes chain-of-thought tokens that bloat latency and response size.

```python
system_prompt = "You are VaNi, DristiQ's market intelligence agent. /no_think"
```

Temperature guidance:
- `0.3` — structured outputs, signal explanations
- `0.7` — explanatory text, onboarding conversation

All VaNi calls go through `ai_client.py` → `_ai_complete()` with `no_think=True, temperature=0.4`. The old `_call_llm_with_fallback()` and `_llm_call()` functions have been deleted.

### Database

- **DB:** `kaala_dristi_db` on Main VPS
- **Migrations:** M001–M088 executed. **Next migration: M089**
- **App user:** `kd_app` / `KdApp2026Secure`
- **FastAPI backend:** `kd-pipeline-api2` on port 8101
- **VaNi DB:** `vani_db` — `vn_interaction_log` table live, logging active for 3 endpoints

**Tables still needed (not yet created):**

| Table | Purpose | When |
|-------|---------|------|
| `km_astro_correlation` | Correlation engine results | Phase 4 |
| `km_finastro_alerts` | Finastro alert layer | Low priority |
| `km_finastro_muhurta` | Muhurta selection | Low priority |

### Skills Installed (Charan's laptop — `/mnt/skills/user/`)

All 5 skills are live. Claude Code reads them automatically per CLAUDE.md Skills section.

| Skill | Read when |
|-------|-----------|
| `dristiQ-rule-engine` | Working on rules, discovery, confidence |
| `dristiQ-correlation` | Working on confluence/correlation views |
| `dristiQ-widgets` | Working on MagicRS, Breadth ROC, Smart Money |
| `dristiQ-data-quality` | Before any SQL on market data tables |
| `dristiQ-framework` | Working on framework, canvas, catalog, blocks |

---

## Known Structural Issues (Fix, Don't Work Around)

| Issue | Status | Notes |
|-------|--------|-------|
| Volume discontinuity in `km_index_eod` post-March 2026 | ⚠️ Unresolved | M046 never created. RVOL signals unreliable for pre-March 2026 data. Soft guard exists in `compute_engine.py` but DB-level fix still needed. |
| SHANTHALA phantom index | ⚠️ Partially fixed | `is_active = false` set but 502 equity tags NOT cleaned. Any query joining by index membership must filter `is_active = true`. |
| Dual-listed equity over-counting | ✅ View exists | Use `v_equity_eod_deduped` for all cross-stock queries. Never use raw `km_equity_eod` for aggregations. |
| Legacy column aliases in `km_index_eod` | ⚠️ Present | Never use: `magicrs_value`, `sniper_banker`, `sniper_hotmoney`, `accum_dist`, `vacuum_status`, `flow_meaning`. Use canonical names only. |
| 15-min schema empty | ⚠️ Unresolved | `km_index_15m` / `km_equity_15m` exist but unpopulated. Intraday stubs marked `// INTRADAY:` in frontend. |

---

## Next Sprint — Block Data Wiring

**This is where the new session starts.**

Workspace blocks currently render placeholder cards only — no live data. VaNi cannot detect confluence on phantom values. Before Phase 3 (VaNi intelligence), every block type needs a real renderer.

**What needs to be wired:**

| Block type | Current state | Target state |
|---|---|---|
| Indicator (chart_overlay) | Placeholder card | Renders on the chart as line/band/zone |
| Widget (panel_block) | Placeholder card | Renders actual widget component with live data |
| Scanner (output_panel) | Placeholder card | Shows scan result count + top results |
| Astro rule (chart_overlay) | Placeholder card | Renders zone or marker on chart |
| Astro rule (panel_block) | Placeholder card | Shows rule status + next occurrence |

**Key questions to resolve before writing the instruction:**
1. The workspace chart — is it a TradingView embed or a custom chart component? How are overlays currently injected?
2. Which instrument does the workspace use as context — `appStore.selectedSymbol` or `frameworkStore.instruments[0]`?

**Start the session by asking Claude Code these two questions** before writing any implementation instruction.

---

## Open Items (Prioritised)

| Item | Priority | Notes |
|------|----------|-------|
| Block data wiring — workspace blocks render real data | **Next sprint** | See above |
| Chart overlays wire to actual chart | **Next sprint** | Depends on chart audit |
| M046 — volume quality migration | High | RVOL guard at DB level, not just soft guard |
| Digitise May–Dec 2026 astro events | High | 3 images ready, re-run scoring |
| Scanners discussion | High | Charan has thoughts — raise at start of next session |
| Phase 3 — VaNi intelligence | After block wiring | Confluence detection, proactive block placement, Action Island |
| Phase 4 — Correlation views | After Phase 3 | `km_astro_correlation` table + 4 adaptive shapes |
| Phase 5 — Business model | After Phase 4 | Inline gate, pricing page, tier enforcement |
| MCP PostgreSQL connection | Medium | Removes Charan as DB relay for schema queries |
| LSP setup | Medium | After codebase stabilises post-Phase 2 |
| Hooks setup | Medium | Pre-commit schema check, post-edit sanity |

---

## Architecture Principles (Never Violate)

- **Constants first** — all fixed string sets live in `frameworkConstants.ts` as `as const` arrays. Types derived from constants. Never inline.
- **Framework is the source of truth** — `isBlockActive()` / `isOverlayActive()` from `frameworkStore` are the sole source of active state. No component derives this independently.
- **Reuse before rebuild** — catalog sections reuse existing components (widget charts, rule engine queries). Never build a duplicate display layer.
- **VaNi never blocks** — every VaNi action is dismissable. Every gate has "Continue on free."
- **No localStorage** — all persistence goes to DB via PostgREST or pipeline API.
- **Legacy column aliases** — never use in any new code.
- **`v_equity_eod_deduped`** — canonical source for all cross-stock queries.

---

## Reference Files

| File | Purpose |
|------|---------|
| `dristiQ-interaction-spec.md` | Full spec (16 sections) — source of truth |
| `dristiQ-onboarding-v2.html` | Visual reference — onboarding (already built) |
| `dristiQ-workspace.html` | Visual reference — workspace canvas |
| `dristiQ-catalog.html` | Visual reference — catalog (already built) |
| `dristiQ-correlation.html` | Visual reference — VaNi Correlation Block |
| `dristiQ-correlation-v2.html` | Visual reference — four correlation view types |
| `dristiQ-business-model.html` | Visual reference — pricing + gates |
| `dristiQ-adaptive-correlation.html` | Visual reference — 4 adaptive shapes |

---

## One More Critical Note for Claude Code

The LLM context window is 4096 tokens. VaNi's context payload must fit within this. Keep system prompts under 500 tokens. Pass only what VaNi needs for the specific response — not the entire framework state.

---

*Updated May 2026 — reflects Sprints 1–4 completion*
*Next session starts at: Block Data Wiring*