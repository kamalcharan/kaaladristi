# Scanner Story Page — Plan of Action (v2, 2026-08-23)

> v1 of this doc described a Thesis-tab section with a bespoke SVG chart.
> That architecture was replaced during the 2026-08-23 session at the
> owner's direction: **one chart, one overlay, Story View and Story Play
> are two modes of the same thing**. This v2 describes what is BUILT and
> what remains. History lives in git (branch `claude/scanner-story-page`).

## What this feature is

A scanner row-click lands the user on `/chart/equity/:id?tab=chart&setup=<preset>`
— the Chart & Replay tab with a **Story View / Story Play** toggle:

- **Story View** — the chart carries the full editorial annotation layer
  (below), and an editorial sidebar renders under it: masthead (company +
  phase pill + thesis line), Current Situation + LT Lens + Swing Lens
  cards, What Confirms checklist, Editor's Note.
- **Story Play** — the SAME chart with the SAME annotations; the existing
  animated replay (storyBubble walking event-to-event + scrubber) is the
  clock. One substrate, two clocks.

The toggle appears only when `?setup=` is present. Without it the chart
behaves exactly as before (no overlay, native price lines).

## Architecture (BUILT — do not re-litigate)

```
km_equity_weekly + km_equity_eod + km_equity_symbols
        │
        ▼
useSetupData (hooks/useSetupData.ts)
  · weekly bars (5y) + latest EOD + identity
  · km_equity_eod.stage fetched per-day and stamped onto weekly bars
        │
        ▼
setupAdapter contract (services/thesis/setupAdapter.ts)
  · SETUP_ADAPTERS registry — one adapter file per preset
  · adapter(weekly, latest, identity) → SetupData
        │
        ├────────────► ScannerArrivalView  (editorial SIDEBAR only — no chart)
        │
        ▼
ChartView derives the overlay bundle (setupOverlayCore/Full)
  · cycleBands  — from adapter cycleLabels (stage-walk, else price-shape fallback)
  · levels      — structural key levels
  · callouts    — persona zones + anchorDate (last bar whose range touched the zone)
  · bigMoney    — detectBigMoneyDays clusters
  · storyPins   — buildStoryEvents (universal substrate) + top-5 promoted
        │
        ▼
TradingChart (components/charts/TradingChart.tsx)  ←— THE one chart
        │
        ▼
AnnotationOverlay (components/charts/AnnotationOverlay.tsx)  ←— THE one overlay
```

### AnnotationOverlay — the editorial layer

Absolutely-positioned div (z-index 10 — **required**: lightweight-charts
canvases carry z-index 1/2 and paint over anything lower) containing an
SVG layer + HTML callout boxes. Everything repositions on pan/zoom via
priceScale/timeScale subscriptions. Layers:

1. **Cycle bands** — tinted regime rectangles with vertical Fraunces
   labels ("OLD STAGE 2 UPTREND" …), font auto-fit to plot height.
2. **Setup level segments** — SHORT right-edge rails with compact mono
   labels (`560 MAJOR R`), vertically anti-collided. Full-width native
   price lines are suppressed when the overlay is active (they read as
   generic S/R clutter — owner call).
3. **Story pins** — dots at each storyEvent's bar; **promoted** events
   (top-5 by priority) render as slim kind-colored callout boxes
   (`▲ Longs Building`) instead.
4. **Big Money badges** — ₹Cr pills on a top rail, dashed leader to the
   bar, two staggered rows when bars cluster. Native BM axis labels are
   suppressed when the overlay is active.
5. **Persona callouts** — numbered persona-colored badge AT the anchor
   bar; storyBubble-styled HTML box floats nearby with a leader line.

**Placement engine**: one collision engine for all boxes. Obstacles:
other boxes, BM badges, and the **candle envelope** (sampled silhouette
of visible bars from `series.data()` + visible logical range) — pass 1
places boxes in empty sky, pass 2 relaxes to box-avoidance only.
Candidates: above/below the anchor, then a left-fan with vertical
offsets (~40 spots) so clustered anchors spread instead of stacking.

### Verification harness (USE IT — this is the law of this feature)

`overlay-test.html` + `src/dev/overlayTest.tsx`: mounts TradingChart
with 500 mock daily bars (uptrend → crash → base → breakout archetype)
plus every overlay layer. `npm run dev` → open `/overlay-test.html`.
Screenshot with Playwright (`playwright-core` is in node_modules,
Chromium at `/opt/pw-browsers/chromium`). **Every overlay/layout change
must be screenshot-verified in the harness before pushing** — the
z-index bug shipped invisible three times because nothing was rendered
before push.

### SEBI voice (enforced in adapter copy + sidebar)

Personas are reading LENSES, zones are "zones of setup activation",
never entries. No SIZE, stops, targets, or directive verbs
(add/buy/trade). `sebiSafeRationale()` in ScannerArrivalView strips
stragglers.

## Adapter contract — adding a scanner

1. Create `services/thesis/adapters/<preset>.ts` exporting a
   `SetupAdapter`. Reuse helpers (`smaFromEnd`, `priorMaxFromEnd`,
   `trailingWindow`) and the shared cycle-label builders in stage2.ts
   (stage-walk + `buildFromPriceShape` fallback — extract to a shared
   module when writing adapter #2).
2. Register it in `services/thesis/adapters/index.ts`.
3. Nothing else. ScanView wires row-clicks from the registry
   (`preset.id in SETUP_ADAPTERS` → `&tab=chart&setup=<id>`), and the
   chart/overlay/sidebar consume whatever the adapter emits.

Per-adapter guardrails (all presets):
- Persona zone range guard: drop zones outside 0.70–1.45 × close.
- Emit `investorTip` in observational voice.
- ≥6 What-Confirms items; structural + dynamic mix.

## Status

| Piece | State |
|---|---|
| Chart + overlay engine | ✅ shipped, harness-verified |
| Story View / Story Play toggle + editorial sidebar | ✅ |
| Adapters — ALL 14 presets (the 8 above + stage_2_watch, volume_drive, stage_3_watch, stage_4_leaders, vani_exit_watch, flower_pot_burst) | ✅ complete 2026-08-23 |
| ScanView wiring | ✅ registry-driven across ALL 6 navigation paths + 5 card sites |
| Bearish lens headings (personaMeta: Holder / Pressure) | ✅ |
| Fullscreen exit (Esc + pinned ✕) | ✅ |
| flower_pot_burst coil-phase adapter (weekly coil proxies, Burst/Shatter phases, coil-boundary zones) | ✅ |
| Direct-load lens picker (no `?setup=`: pick from scan membership) | ⬜ |
| Light-mode tuning of band tints | ⬜ (tokens exist; values dark-calibrated) |
| Zone rectangles (dashed base boxes, reference decks) | ⬜ deferred |
| Multi-pane monthly+weekly split (Solara deck) | ⬜ deferred |

## Roll-out — COMPLETE (2026-08-23)

All three waves shipped. 8 presets covered; the ScanView registry
auto-wires every scan surface. Each adapter's What-Confirms mirrors
its matview gates (migration 170), industry-level gates that need
scan-side history say so explicitly instead of faking a check, and
bearish presets carry Holder/Pressure lens headings via personaMeta
with explicit invalidation zones (SEBI-observational throughout).

Remaining candidates (owner to prioritize):
· direct-load lens picker · light-mode band tints · zone rectangles ·
  multi-pane split (see Status table)
