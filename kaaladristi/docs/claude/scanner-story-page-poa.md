# Scanner Story-Page POA

**Date:** 2026-08-22 · **Status:** design contract, pre-build · **Reference:** owner's KPL / Solara / Kronox annotated-chart images (2026-08-22 session), WealthLab S2 Screen layout.

## Why this exists

Current scanners hand the user a **row**. The row is engine-out — the criteria that fired. The user still has to reverse-engineer *"is this a good setup for me? Where do I enter? What confirms the thesis? Where do I exit?"* — all of which live in the chart, not the row.

The owner-shared examples (KPL, Solara, Kronox) all follow the same pattern: **annotated weekly chart + Setup Summary + Persona-based Entry Zones + What-Confirms checklist + Best Exit from previous cycle**. That's the deliverable — one page that answers the decision the row is asking the user to make.

Owner decision (2026-08-22 session):
- **UX-first sequence** — build the Story Page against **Stage 2 Leaders** (data already exists), then wire Waking Giants into it. De-risks the new UX before committing to a new scanner.
- **Two personas** — Long-Term Investor + Swing Trader (matches the reference images).

## Scope in one sentence

**Extend the existing Thesis tab** on `/chart/equity/:id` with a **scanner-arrival view** that renders the annotated-chart research shown in the reference images. Same tab, one more axis of adaptation (`setup=<preset>`) alongside the existing position / watchlist / none states.

## Decisions locked (2026-08-22)

- **Surface:** the **existing Thesis tab** on `/chart/equity/:id` (do NOT create a new tab — one already exists, deep-linkable via `?tab=thesis`, already relationship-aware).
- **New axis:** URL param `?setup=<preset>` (e.g. `?tab=thesis&setup=stage_2`). When present, the tab renders the scanner-arrival view described here, layered *before* / *alongside* the existing position/watchlist/cold read (see composition below).
- **Personas:** LT Investor + Swing Trader.
- **v1 coverage:** Stage 2 Leaders only. Flower Pot Burst / Waking Giants wire in via new adapters (no tab changes) once the UX is validated.
- **Do NOT rebuild:** existing `services/thesis.ts` (`computeThesis`, `buildPillars`, `buildStoryEvents`), existing `ThesisTab.tsx` chrome (VaNi narration surface, position form) — all preserved. The scanner-arrival view is a new SECTION rendered inside the current tab, not a replacement.

## Composition inside the existing Thesis tab

The tab today branches on `relationship` (`position` / `watchlist` / `none`). The scanner-arrival view is a **new section** rendered at the top of the tab whenever `?setup=<preset>` is present in the URL. It composes cleanly with what's already there:

```
┌────────── Thesis tab body ───────────┐
│                                       │
│  [ NEW ]  Scanner-Arrival Section     │  ← only when ?setup=<preset>
│    · Annotated Weekly Chart          │    reads SetupData from adapter
│    · Setup Summary card              │
│    · Persona Entries (LT / Swing)    │
│    · What Confirms checklist         │
│                                       │
│  ─────────────────────────────────    │
│                                       │
│  [ EXISTING ]  Relationship view      │  ← today's tab content, unchanged
│    · Verdict hero + Pillars          │    (position P&L, or watchlist read,
│    · Signal timeline                 │     or cold-setup read)
│    · Position form / P&L / posture   │
│    · VaNi narration                  │
│                                       │
└───────────────────────────────────────┘
```

Effect: a scanner sends the user in with `?setup=stage_2`, they land on Thesis and immediately see the annotated setup answering "why am I looking at this?". Scrolling reveals the deeper thesis engine (pillars, signals, P&L if held). If the user later adds a position, the scanner-arrival section stays available above; the position content lands below as it does today.

## Reusability contract — the adapter pattern

**One page, per-preset adapter.** All setup-specific logic (entry zones, what-confirms criteria, cycle labels, narrative tone) lives in a per-preset adapter module. Adding a new setup = writing one adapter file; the ThesisTab code and the four new presentation components never branch on preset name.

```
components/domain/StockCockpit/
  ThesisTab.tsx                  ← existing; mounts <ScannerArrivalView> above today's content
                                    when ?setup=<preset> is present
  ScannerArrival/
    ScannerArrivalView.tsx       ← the new section shell
    AnnotatedWeeklyChart.tsx     ← universal chart renderer
    SetupSummary.tsx             ← universal right-column card
    PersonaEntries.tsx           ← universal 2-column entries card
    WhatConfirms.tsx             ← universal checklist card

services/thesis/
  setupAdapter.ts                ← the SetupData contract (types) + dispatcher
  adapters/
    stage2.ts                    ← Stage 2 Leaders (v1)
    wakingGiants.ts              ← later
    flowerPot.ts                 ← later

hooks/
  useSetupData.ts                ← fetches weekly OHLC + latest EOD, calls the
                                    right adapter, returns SetupData
```

Note: co-located under the existing `StockCockpit/` folder to keep the tab's components together, not a separate `Thesis/` folder that would confuse ownership.

**The `SetupData` contract (draft):**

```ts
interface SetupData {
  header:       { symbol, name, exchange, close, pct_chng, rs_percentile, phase };
  keyLevels:    { pivot, immediateResistance, majorResistance,
                  immediateSupport, strongSupport, ema50 };
  currentSituation: { verdict, narrative /* 2-3 lines */ };
  chartAnnotations: {
    cycleLabels:  Array<{ from, to, label, tone }>;   // "Old Stage 2" etc.
    entryZones:   Array<{ priceLow, priceHigh, label, persona, tone }>;
    horizontalLines: Array<{ price, label, tone }>;    // key levels on chart
  };
  personas: {
    ltInvestor: Array<{ entryNo, price, label, rationale }>;  // 3 entries
    swingTrader: Array<{ entryNo, price, label, rationale }>; // 3 entries
  };
  whatConfirms: Array<{ label, state: 'met'|'pending'|'failed', explain }>;
  investorTip?: string;   // one-liner, template-filled per stock
}
```

**Rule:** no `if (preset === 'stage_2')` inside `ThesisTab.tsx` or its four child components. Ever. Adapter is the only place preset semantics live.

**Adapter signature:**

```ts
type SetupAdapter = (
  weekly: WeeklyBar[],
  latest: EquityEodRow,
  symbol: EquitySymbolRow,
) => SetupData;
```

That's the whole contract. Waking Giants ships as one new file — `adapters/wakingGiants.ts` — that reads the same inputs plus WG-specific columns (from its future signals table) and returns the same shape.

## Layout (grounded in the reference images)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER  Symbol · Company · Exchange badge                        │
│         Phase pill · RS %ile · Last close · Day %                 │
├──────────────────────────────────────────────────────────────────┤
│  ANNOTATED WEEKLY CHART                    │  SETUP SUMMARY       │
│  · Weekly candles (5y)                     │  Primary Structure   │
│  · EMA 50 overlay                          │  Base Type           │
│  · Historical cycle labels                 │  Current Stage       │
│    (Old Stage 2 · Long Stage 1 · attempt)  │  Current Pattern     │
│  · Entry zones shaded (green/amber)        │  Major Resistance    │
│  · Numbered entry markers (1,2,3)          │  Immediate Support   │
│  · Key-level horizontal lines              │  Current View        │
│                                            │                      │
│                                            │  CURRENT SITUATION   │
│                                            │  (2-3 lines, narrative) │
├────────────────────────┬───────────────────┴──────────────────────┤
│ LONG-TERM INVESTOR     │ SWING TRADER      │ WHAT CONFIRMS THIS?  │
│ Entry 1: ₹X (safest)   │ Entry 1: ₹X       │ ✓ Weekly close > ... │
│ Entry 2: ₹Y (early)    │ Entry 2: ₹Y       │ ✓ Above 50 EMA       │
│ Entry 3: ₹Z (chase)    │ Entry 3: ₹Z       │ ○ Volume conf...     │
└────────────────────────┴───────────────────┴──────────────────────┘
```

## Data readiness (verified 2026-08-22)

Every field the design needs is present on `km_equity_eod` for the latest date:

| Field | Column | Populated |
|---|---|---|
| Pivots (PP, R1, R2, S1, S2) | `pivot_pp/r1/r2/s1/s2` | ✅ |
| Trend MAs | `sma_50`, `sma_150`, `ema_20` | ✅ |
| 52-week envelope | `w52_high`, `w52_low` | ✅ |
| Weinstein stage | `stage` | ✅ |
| Relative strength | `magic_rs`, `rs_percentile`, `magic_rs_zone` | ✅ |
| Weekly OHLC | `km_equity_weekly` | ✅ (3,787 stocks, back to Jan 2020 — 5y+) |

No new pipeline step needed for the v1 layout. Historical cycle labels (Old Stage 2 / Long Stage 1 / attempt) derive from `stage` transitions on weekly bars — computed client-side from the weekly series.

## Key-level → UI mapping

Straight translation of the reference images to our data:

| Label on page | Data source |
|---|---|
| Pivot / Break | `pivot_pp` |
| Immediate Resistance | `pivot_r1` |
| Major Resistance | `min(pivot_r2, w52_high)` |
| Immediate Support | `pivot_s1` |
| Strong Support | `max(pivot_s2, sma_150)` |
| 50 EMA (weekly) | rolling SMA(50) of `km_equity_weekly.close` (compute client-side) |

## Entry-zone logic (Stage 2 Leaders v1)

**Long-Term Investor** (structural, higher probability, later entry):
- **Entry 1 — Best historical:** on the breakout above prior consolidation high, with weekly close AND weekly volume expansion. Ideal but often already past.
- **Entry 2 — Early / higher-risk:** end of base / reclaim of 50 EMA (weekly).
- **Entry 3 — Add-on:** healthy pullbacks / continuation bases in Stage 2.

**Swing Trader** (opportunistic, faster resolution, tighter risk):
- **Entry 1:** breakout above pivot_r1 with rvol > 1.5.
- **Entry 2:** early continuation pullback to pivot_pp (mid-range).
- **Entry 3:** deeper pullback to pivot_s1 / 20 EMA (still in Stage 2 zone).

The numeric prices per entry are derived per stock from the columns above; the *text* pattern above is the template.

## What-Confirms checklist (Stage 2 Leaders v1)

Six criteria, each computable today:

| # | Criterion | Data |
|---|---|---|
| 1 | Weekly close above 50 EMA | `km_equity_weekly.close` vs rolling SMA(50) |
| 2 | Weekly close above prior consolidation high | derived from weekly max over window |
| 3 | RS percentile in top quartile | `km_equity_eod.rs_percentile ≥ 75` |
| 4 | Weekly close is a higher high vs 22-week lookback | `km_equity_weekly.close` walk |
| 5 | Weekly volume ≥ 1.5× 10-week avg on breakout bar | `km_equity_weekly.volume` |
| 6 | Above sma_150 (long-term filter) | `km_equity_eod.sma_150` |

Each row renders ✓ (met) / ○ (pending) / ✗ (failed) with a one-line hover explanation.

## Current Situation (2-3 line narrative)

Generated by extending the existing VaNi infra (`services/vaniNarrate.ts`). Prompt is fed:
- Phase (Setup / Breakout / Continuation / Exhaustion — derived from checklist + trend)
- 1-2 salient recent moves (from the existing `services/storyEvents.ts` engine)
- Nearby levels (distance to r1 / s1)

Non-predictive, observational (SEBI D39 rule) — same tone as existing VaNi.

## Historical-cycle labels (annotated chart)

Client-side pass over `km_equity_weekly` walking `stage` transitions. Label rules:
- Contiguous run of `S2` weeks ≥ 26 → "Old Stage 2 Strong Uptrend" (spanning start-end of the run).
- Contiguous run of `S4` weeks ≥ 20 → "Distribution / Peak → Stage 4 Markdown" (spanning start-end).
- Contiguous run of `S1` / `S1_CANDIDATE` weeks ≥ 26 → "Long Stage 1 Re-accumulation".
- Latest run: label based on today's stage + prior stage.

Renders as `lightweight-charts` price-line / area annotation.

## Implementation phases

Numbered so each phase ships an independently-mergeable slice. Every phase builds toward "click a Stage 2 Leaders row → land on Thesis tab with the annotated setup at the top." The existing tab keeps working the whole time.

### Phase 1 — Adapter contract + Stage 2 adapter (session 1)
`services/thesis/setupAdapter.ts` — the `SetupData` TypeScript type + a `getSetupAdapter(key)` dispatcher.
`services/thesis/adapters/stage2.ts` — reads `(weekly, latest, symbol)`, returns `SetupData`: key levels, cycle labels, entry zones (six entries across two personas), what-confirms checklist. Deterministic, no async, no LLM.
**Ships without any UI changes** — adapter is testable in isolation.

### Phase 2 — AnnotatedWeeklyChart component (session 1-2)
`components/domain/StockCockpit/ScannerArrival/AnnotatedWeeklyChart.tsx` — takes `bars + chartAnnotations` and renders the annotated weekly chart with EMA 50 overlay, cycle-label bands, entry-zone shading, numbered entry markers, key-level horizontal lines.

### Phase 3 — Setup Summary + Persona + What-Confirms cards (session 2)
Three universal presentation components under the same folder. All read from `SetupData` — no branching on preset. Rendered as three sections in the ScannerArrivalView shell.

### Phase 4 — Data hook + ScannerArrivalView shell (session 2-3)
`hooks/useSetupData.ts` — fetches `km_equity_weekly` (5y for this equity) + `km_equity_eod` latest, calls the right adapter via `getSetupAdapter(setupKey)`, returns a fully-derived `SetupData`.
`ScannerArrivalView.tsx` — composes the four components using data from the hook. Loading + error states + "no setup for this stock" fallback.

### Phase 5 — Wire into existing ThesisTab (session 3)
Read `?setup=<preset>` from the URL inside `ThesisTab.tsx`. When present, mount `<ScannerArrivalView setup={preset} equityId={equityId} />` at the top of the tab body, above the existing relationship view. Zero regressions on the current position/watchlist/none flows.

### Phase 6 — Wire from Stage 2 Leaders row click (session 3)
`views/ScanView.tsx`: for the `stage_2_leaders` preset, the row-click URL becomes `/chart/equity/:id?tab=thesis&setup=stage_2`. Other scanners unchanged — they still open the default chart tab.

### Phase 7 — Handoff-ready for Waking Giants / Flower Pot Burst (later)
When each new scanner ships, add one adapter file (`adapters/wakingGiants.ts`, `adapters/flowerPot.ts`) and route its row click to `?setup=waking_giants` / `?setup=flower_pot`. The tab, chart component, and three cards never change.

## Non-goals (v1)

- Interactive drawing tools, "add my own annotation" — later.
- Backtest overlay showing where each entry would have been triggered historically — later.
- Portfolio integration (buy/sell buttons, order routing) — never in this scope.
- Multi-timeframe views on one page (weekly + daily side-by-side) — v2 if users ask.
- Persona configuration — the two personas are hard-coded v1; user-selectable presets later.

## Success criteria

- Any Stage 2 Leaders row click lands on a page with a labeled weekly chart, a filled Setup Summary, both persona columns populated with real prices, and the What-Confirms checklist reading correct pass/fail status.
- Zero regressions on `/chart/equity/:id` default view (Setup is an opt-in tab).
- Page LCP ≤ 1.5s on a warm cache (weekly chart is 260 rows × 6 fields — tiny).
- Copy is SEBI-compliant (observational; no "BUY" / "TARGET" / "SL" directives — labels borrow the reference images' vocabulary: "Entry 1 — best historical", "Add-on", etc.).

## Open questions (owner input needed before Phase 5)

1. ~~New route or extend the existing chart route?~~ **DECIDED 2026-08-22:** extend the existing Thesis tab.
2. **Which scanners get Setup mode in v1?** Stage 2 Leaders is the pilot. Enable Flower Pot Burst on day one, or wait? *Recommendation: pilot Stage 2 Leaders only.*
3. **"Investor Tip" green box copy** — owner-authored per setup type, or LLM-generated per stock? *Recommendation: template + LLM-fill.*

## Related in-repo work

- Existing `components/domain/StockCockpit/StoryMode.tsx` — animated replay of past events (different pattern, kept as-is; may be reused as an "Event Replay" side action on the Setup page later).
- `services/vaniNarrate.ts` — existing narrative surface, extended in Phase 2.
- `services/storyEvents.ts` — existing event detection engine, sampled for the Current Situation narrative.
- `docs/claude/poa-storyteller-2026-07-18.md` — earlier Story Engine POA (Reversal Engine + Position Thesis). This POA is complementary — a different surface for the same underlying signal engine.
