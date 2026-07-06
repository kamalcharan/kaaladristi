# POA — Pulse / Study Two-Layer Charting + Stock Cockpit

**Date:** 2026-07-06 · **Status:** Approved direction, phased build
**Origin:** Visual Pulse audit (9 items) + Decision-Layer/Study-Layer discussion (owner + Claude session)

---

## The Contract (governs every phase — non-negotiable)

| | **Pulse** (Decision Layer) | **Study** (Study Layer) |
|---|---|---|
| Question | "Is this worth my attention?" | "Let me verify and explore" |
| Read time | 4–5 seconds | Open-ended |
| Configurable | **Never** — curated, identical for every user | **Always** — catalog overlays, timeframes, zoom |
| Output | A verdict (VaNiSentence) | Evidence only — no verdicts |
| Surfaces | `/pulse/:indexId`, `/pulse/equity/:equityId` | `/chart/:type/:id` (the cockpit), My Space chart |

**Two rules that keep the layers from converging:**
1. The decision layer takes **no widgets**. The study layer gives **no verdicts** (except the traveling verdict chip in its header).
2. Same data at both ends is fine; the *presentation contract* is the differentiation, not the feature list.

**UX principles for the whole POA:** one verdict vocabulary product-wide (the 5-state signal + VaNiSentence); no dead controls (every visible control does something on this surface); every empty state explains itself; scores before percentages; SEBI-observational copy only; Pulse renders < 1s, cockpit interactive < 2.5s.

---

## Phase 0 — Name the layers (small, do first — everything else inherits it)

| # | Item | Detail |
|---|---|---|
| 0.1 | **Pulse \| Study switch** | Two-position segmented control in the header of both stock surfaces. Pulse position on VP pages, Study position on ChartView. Switching navigates between `/pulse/equity/:id` ↔ `/chart/equity/:id` (and index equivalents), preserving the instrument. |
| 0.2 | **Cross-CTAs with context** | VP: verdict sentence gains a `Study this →` button. ChartView header: compressed **verdict chip** (signal badge + one-line VaNiSentence) fetched from the same source VP uses — the decision context travels; it is the ONLY decision element allowed on Study. |
| 0.3 | **Catalog labeling** | Chart-indicator and overlay cards in `/catalog` get a small `STUDY CHARTS` tag; DeepDivePanel copy explains the two layers in one sentence. |
| 0.4 | **Teach it once** | One line in BetaWelcomeModal + a one-time coach mark on first VP visit: "Pulse gives the 5-second verdict. Study is where you verify it." (localStorage-dismissed, same pattern as ScanStartHereHint.) |

**Verify:** switch round-trips without losing the instrument; verdict chip matches VP's sentence exactly; catalog tags render on all 3 themes.

---

## Phase 1 — Study Cockpit v1 (the big one: assemble evidence around the chart)

Evolve `ChartView` (`/chart/:type/:id`) into the cockpit. Layout:

```
[Pulse|Study]  SYMBOL · verdict chip                    [⛶]
[Stat strip: Price·Range | Momentum | Liquidity | Returns]
[──────────── TradingChart ────────────][ Right rail       ]
[  overlays follow the user's catalog  ][ ✦ Scan Presence  ]
[  selections (isOverlayActive)        ][ Sector membership ]
[                                      ][ Delivery vs Traded]
[ VaNi instrument insight (indigo panel)                    ]
```

| # | Item | Detail |
|---|---|---|
| 1.1 | **Stat strip** — 4 cards | Price + day range bar (`close/pct_chng/high/low`); Momentum (RSI 14 + % from 20/50/150 DMA); Liquidity (volume, delivery qty, delivery %, mcap); Returns (5D/22D/66D). All columns exist in `km_equity_eod`. NOTE: reference product's "Trades" count is not stored — use Volume unless `tvol` proves to be trade count (verify in DB). |
| 1.2 | **Scan Presence card upgrade** | `useScanPresence` iterates DB presets via `getPresetMeta`/`useScanPresets` (14 scans, merged breakout, current names — the "all 6 scans" era is over); chips show scan name + ✦ when the stock is a VaNi Highlight in that scan; chips link to the scanner. Reuse on both VP (existing card) and cockpit. |
| 1.3 | **Sector/Index membership card** (NEW) | Official indices from `km_equity_symbols.index_names[]` + curated themes from `km_index_constituents`. Each chip links to `/sector-rotation/:id` and carries the sector's current pulse signal dot (reuse `flowSignal` — "this stock sits in a Money-Entering sector" at a glance). |
| 1.4 | **Delivery vs Traded (10D) widget** (NEW) | Per-day paired bars: `deliv_value_cr` vs `value_cr`, delivery-% label, traded value right column (per reference screenshot). Pure render from existing columns. |
| 1.5 | **Framework overlays on the cockpit chart** | ChartView stops using its own indicator toggles and respects the user's framework `chart_overlays` exactly like `WorkspaceChart` — "what I turned on in Catalog follows me everywhere." Constants-first + isOverlayActive rules apply. |
| 1.6 | **VaNi instrument insight** | Existing `instrument_insight` skill endpoint rendered in the indigo VaNiInsight panel below the chart. |

**Verify:** stat strip numbers cross-check against the scanner table for the same stock/date; membership chips land on the right drilldowns; overlays toggled in Catalog appear on the cockpit without a reload (React Query invalidation).

---

## Phase 2 — Chart UX pass (lands on cockpit AND My Space — shared component)

Priority order inside `TradingChart`:

| # | Item |
|---|---|
| 2.1 | Crosshair hover legend: OHLC + volume + delivery % readout |
| 2.2 | Range presets: 3M / 6M / 1Y / All |
| 2.3 | **D/W/M timeframe toggle** — equity weekly/monthly tables are populated (`km_equity_weekly/monthly`); **pre-check required:** confirm index weekly/monthly aggregates exist before showing the toggle on index charts (owner DB query) |
| 2.4 | Delivery-shaded volume bars (opacity/darkness ∝ delivery %) — turns the volume pane into a conviction pane |
| 2.5 | Fullscreen toggle |

**Verify:** every improvement visible on both `/chart` and My Space; W/M candles cross-checked against a known stock's weekly close.

---

## Phase 3 — Big Money Zones (differentiator; calibrate before building — house rule)

| # | Item | Detail |
|---|---|---|
| 3.1 | **Calibration first** | Owner runs percentile query on `deliv_value_cr / (avg_amt_66d)` ratios + absolute ₹ Cr distribution to set: spike multiplier (provisional ≥ 5×) AND absolute floor (provisional ≥ ₹25 Cr) so microcaps don't fire. |
| 3.2 | **Detection + render** | Client-side over the chart's loaded history: qualifying days become (a) a horizontal price zone band on the chart at that day's range, (b) rows in a "Big Money Days" rail card: `23 May · ₹305 Cr delivered · 8× normal`. |
| 3.3 | **SEBI copy** | Observational only: "heavy delivery day — a price zone where large money changed hands." NO "acts as support / won't fall below." Optionally the honest stat: "price has closed above this zone N of M sessions since." |
| 3.4 | *(Parked)* `kd_stock_events` table | Shared infrastructure with backlog B55 (breakout events). Only if/when zones need to appear outside the stock page (scanner columns, alerts). |

---

## Phase 4 — Polish + verification sweep

Mobile: stat strip 2×2, rail stacks below chart, VP stays the mobile-first surface. Theme check across all 3 themes. GlossaryTerm/tooltips on new labels (Delivery %, DMA, RS %ile). Full journey test: Discovery → Highlights row → Pulse (verdict) → Study this → cockpit → sector chip → rotation drilldown → back.

---

## Sequencing & effort

```
Phase 0  (S)  →  Phase 1 (L, the core)  →  Phase 2 (M)  →  Phase 3 (M)  →  Phase 4 (S)
```

Each phase = one PR + owner verification checklist before the next. Phases 2 and 3 can swap if Big Money is wanted sooner — both depend only on Phase 1.

## Open items needing owner input (blocking their phase only)

1. **Phase 2.3:** confirm index weekly/monthly data exists (DB check) — else toggle ships equity-only.
2. **Phase 3.1:** calibration query results for spike multiplier + floor.
3. Whether "Trades" count exists anywhere in ingested bhav data (`tvol`?) — else Liquidity card uses Volume.

## Explicitly out of scope here (separate tracks, already parked)

Scanner session items (Strength/Caution Magic-RS ranking, SEBI vocabulary sweep + disclaimer footer, equity score return-gate fix), scanner heat view, Option C precomputed scans.
