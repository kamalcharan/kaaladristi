# Scanner Story-Page POA

**Date:** 2026-08-22 · **Status:** design contract, pre-build · **Reference:** owner's KPL / Solara / Kronox annotated-chart images (2026-08-22 session), WealthLab S2 Screen layout.

## Why this exists

Current scanners hand the user a **row**. The row is engine-out — the criteria that fired. The user still has to reverse-engineer *"is this a good setup for me? Where do I enter? What confirms the thesis? Where do I exit?"* — all of which live in the chart, not the row.

The owner-shared examples (KPL, Solara, Kronox) all follow the same pattern: **annotated weekly chart + Setup Summary + Persona-based Entry Zones + What-Confirms checklist + Best Exit from previous cycle**. That's the deliverable — one page that answers the decision the row is asking the user to make.

Owner decision (2026-08-22 session):
- **UX-first sequence** — build the Story Page against **Stage 2 Leaders** (data already exists), then wire Waking Giants into it. De-risks the new UX before committing to a new scanner.
- **Two personas** — Long-Term Investor + Swing Trader (matches the reference images).

## Scope in one sentence

Extend `/chart/equity/:id` with a **Setup tab** that renders the annotated-chart research view shown in the reference images, for any stock the caller marks as a "setup" (Stage 2 Leaders v1; Flower Pot Burst / Waking Giants / others plug in later via the same view).

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

Numbered so each phase ships an independently-mergeable slice.

### Phase 1 — Annotated weekly chart component (session 1)
`components/domain/StoryPage/AnnotatedWeeklyChart.tsx` — takes `(bars, keyLevels, entryZones, cycleLabels)` and renders. Pure component, storybook-ready with mock data.

### Phase 2 — Setup Summary + Current Situation card (session 1-2)
`components/domain/StoryPage/SetupSummary.tsx` — right-column card. Reads a `SetupData` object; no fetching inside.
`services/setupNarrative.ts` — 2-3 line narrative generator (VaNi-backed).

### Phase 3 — Persona split + What-Confirms (session 2)
`components/domain/StoryPage/PersonaEntries.tsx` — LT / Swing three-column card.
`components/domain/StoryPage/WhatConfirms.tsx` — checklist card.
Both take pre-computed inputs.

### Phase 4 — Data hook + page shell (session 2-3)
`hooks/useSetupData.ts` — fetches `km_equity_weekly` (last 5y) + `km_equity_eod` latest + walks the stage series → returns the fully-derived `SetupData` object.
`views/StoryPageView.tsx` — new page composing the four components.

### Phase 5 — Wire into `/chart/equity/:id` (session 3)
Add "Setup" tab. Enable it when the referring scanner is Stage 2 Leaders (URL param `?from=stage_2_leaders` or `?setup=stage_2`). Default tab stays the existing chart.

### Phase 6 — Wire from the scanner list (session 3)
`views/ScanView.tsx`: row click for Stage 2 Leaders sends the user to `/chart/equity/:id?setup=stage_2`. All other scanners continue to open the current chart view (no regression).

### Phase 7 — Handoff-ready for Waking Giants (later)
When WG ships its own preset, the row click sends `?setup=waking_giants`. `useSetupData` learns a `wg` variant of entry-zone / what-confirms logic. Same view, different setup semantics.

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

1. **New route or extend the existing chart route?** Extending keeps deep-link continuity; a new `/setup/:id` route is cleaner. Recommendation: extend + `?setup=<preset>` URL param.
2. **Which scanners get Setup mode in v1?** Stage 2 Leaders is the pilot. Should we also enable it for Flower Pot Burst on day one, or wait until WG lands? Recommendation: pilot only Stage 2 Leaders — measure page load, feedback, then enable FPB.
3. **Copy of the "Investor Tip" green box in the reference images.** It's a house-voice one-liner. Owner-authored per setup type, or LLM-generated? Recommendation: template + LLM-fill per stock context.

## Related in-repo work

- Existing `components/domain/StockCockpit/StoryMode.tsx` — animated replay of past events (different pattern, kept as-is; may be reused as an "Event Replay" side action on the Setup page later).
- `services/vaniNarrate.ts` — existing narrative surface, extended in Phase 2.
- `services/storyEvents.ts` — existing event detection engine, sampled for the Current Situation narrative.
- `docs/claude/poa-storyteller-2026-07-18.md` — earlier Story Engine POA (Reversal Engine + Position Thesis). This POA is complementary — a different surface for the same underlying signal engine.
