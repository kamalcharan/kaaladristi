# Pulse / Study UX — Equity analysis surfaces

Status: **for owner review** (Charan). Written 2026-07-09.
Scope: the equity Pulse/Study two-layer system, with a full rework of **Study**
into a decision-first workbench. Index Study is untouched (chart-centric).

---

## 1. What it is — the two-layer contract

Every stock (and index) surface has one segmented control, `PulseStudySwitch`,
that flips between two layers of the same instrument:

| Layer | Route | Role |
|---|---|---|
| **Pulse** | `/pulse/equity/:id` | **Decision layer** — the 4–5 second curated verdict. Never configurable, same for everyone. |
| **Study** | `/chart/equity/:id?name=` | **Study layer** — open-ended evidence: overlays, timeframes, zoom, all the signal widgets, a time scrubber. |

> Owner direction: Pulse mode will likely be **retired** later — Study has been
> made self-sufficient so it can stand alone. (`ChartView` now carries the full
> pulse widget set for equities.)

The **verdict** (`corrState` from `visualPulseEngine`) is computed from a
confluence of astro / technical / smart-money reads; it travels with the user
as the header chip and now leads the Study page (see the Decision Band).

---

## 2. The widgets (Study, equity)

Grouped by the tier they now live in.

### Decision Band (top)
- **VaNi read** (`InstrumentIntelligence`) — plain-language AI narration, with
  inline highlight chips (signed %, x-multipliers, n/50 institutional, status
  flags). Rendering-only; VaNi generation untouched.
- **Verdict** — Pulse state + tagline (Aligned / Diverging / …), color-coded.

### Snapshot strip (4 cards, `StatStrip`)
- **Conviction** — Score 5D vs 22D + Accelerating/Fading + Delivery Surge.
- **Momentum** — RSI(14) tone + distance from 20/50/150-DMA.
- **Liquidity** — Volume · Delivery % · Market Cap.
- **Returns** — 5D / 22D / 66D.

### Evidence tiers
- **Flow Heatmap** (`StockFlowHeatmap`) — this stock's daily money-flow
  conviction as a single-row heatmap; reuses the Sector-Rotation cell style
  (5-state `flowSignal` colors + Score-5D number). **5D / 22D / 66D** toggle,
  default 22D.
- **Industry Context** — rotation status / percentile / rank within industry.
- **Order Flow** (`OrderFlowCard`) — flow type + RVOL + RSS zone + narrative.
- **Smart Money** (`SmartMoneyCard`, flip) — Institution / Hot Money + SVD/SBD/SYD
  dots + Aligned/Diverging read.
- **Big Money Days** (`BigMoneyCard`) — sessions where delivered value ran ≥5×
  the stock's 66-day norm **and** in its own top delivered days; entry/exit
  footprint + aftermath stat. Spans two rows. Honest empty state when none
  (BSE-only scrips → none, no delivery data).
- **Delivery vs Traded** — delivery ratio trend (accumulation vs churn).
- **Scan Presence** — which of the 9 scanner presets include this stock today.
- **Member Of** (`SectorMembershipCard`) — indices/themes the stock belongs to,
  each chip carrying a live sector-pulse signal word (Strong/Building/Fading/…).

### Chart tier (last)
- **Price chart** (`TradingChart`, framework overlays + astro bands + Big-Money
  ₹ markers) with D/W/M + range selector + fullscreen.
- **Magic RS** (`MagicRsSubchart`, flip) — RS vs NIFTY 500.
- **Momentum · RSI / MFI** (`CockpitIndicatorPanels`, momentum only).
- **RSI Divergence** (`DivergenceCard`).

### Player
- **Timeline scrubber** (`TimelineSlider`) — scrub any past candle; Smart Money
  and Magic RS recompute for that bar (they use `pulseBars`, scrubber-aware).

### Flip cards
`SignalFlipCard` = one card that flips **Widget ⇄ Chart** (default Widget), so a
signal is never shown as both a chart and a widget. Used for **Smart Money** and
**Magic RS**. Chart faces share `SignalLineChart`.

---

## 3. Before → After (Study layout)

### Before
- Two-column grid: **chart top-left**, a scrolling **evidence rail on the right**
  (with its own inner scrollbar).
- Signals were **duplicated**: Smart Money / Magic RS / Conviction each rendered
  as both a rail card *and* a Cockpit line panel below the chart.
- VaNi narration sat **below** the chart.
- Header carried a "Current Price" stat card (redundant with the header price).

### After — decision-first, single stacked flow
```
HEADER            name · price · Pulse|Study · stats
DECISION BAND     VaNi read ........................ + Verdict
SNAPSHOT          Conviction · Momentum · Liquidity · Returns
EVIDENCE  Row A   Flow Heatmap 80% · Industry 20%
          Row B   Order Flow · Smart Money(flip) · ┌ Big Money ┐
          Row C   Delivery (wide) ················· └ (spans)  ┘
          Row     Scan Presence · Member Of
CHART             Price 70% · (Magic RS / RSI-MFI / Divergence) 30%
PLAYER            ════════ scrubber ════════
```

**Principle:** *Read → Snapshot → Evidence → Chart.* Each tier answers the
question the previous one raises: what's the story? → by how much? → on what
evidence? → prove it on the chart.

### What changed, concretely
- Chart moved from top-left to the **bottom** (decision cards lead).
- Evidence **rail removed** → full-width tiers; **no inner scrollbar** (page
  scrolls).
- Duplicated signals **merged into flip cards** (Widget ⇄ Chart); the standalone
  Cockpit Smart Money / Magic RS / Conviction panels were removed (Momentum
  panel kept).
- **Conviction shown once** (Snapshot strip); the Flow Heatmap covers conviction
  over time.
- **Current Price card dropped** (price is in the header) → replaced by Conviction.
- **Correlation card hidden on equity** (returns for indexes later).
- **VaNi moved to the top** as the Decision Band.
- Big Money got an **honest empty state**; its threshold is now **self-relative**
  (own top-2% of delivered days, not a flat ₹25 Cr floor).

---

## 4. Guiding rules applied
- **No fallback — pass or fail.** Missing data shows honestly (blank / empty
  state), never a substituted value. (The blank Conviction case is a *data* gap
  — latest-bar scores lag ingestion — to be fixed in the pipeline, not masked.)
- **No repetition.** A signal appears in exactly one place (flip cards enforce
  chart-vs-widget).
- **Same themes.** All new UI uses theme tokens (works across the 3 themes +
  light/dark).

---

## 5. Open / deferred (owner to decide)
- **#5 Conviction latest-bar blank** — pipeline fix: compute `score_5d/22d` for
  the latest trade date so it "passes" instead of showing blank.
- **#8 Magic RS benchmark** — make it selectable (any index / sector-rotation
  item) via on-the-fly RS recompute; today it's fixed vs CNX500 (NIFTY 500).
- **Conviction scrubber-awareness** — `pulseBars` carries no scores, so the
  Conviction snapshot isn't Player-linked; would need `score_5d/22d` added to
  `useEquityVisualPulse`.
- **#3 Big Money thresholds** — the top-2% / 5× constants are provisional;
  verify per-stock event counts on live data.
- **Correlation for indexes** — index Study has none of the pulse cards wired
  yet.
- **Pulse mode retirement** — Study is now self-sufficient; retire when ready.
- **Decision Band polish** — the VaNi card nested in the indigo band may read
  boxy; de-chrome if needed.

---

## 6. Key files
- `views/ChartView.tsx` — Study page (this layout).
- `components/domain/VisualPulse/equity/EquityVisualPulsePage.tsx` — Pulse page.
- `components/domain/PulseStudySwitch.tsx` — the two-layer toggle.
- `components/domain/StockCockpit/` — `StatStrip`, `SignalFlipCard`,
  `SignalLineChart`, `CockpitIndicatorPanels`, `BigMoneyCard`,
  `DeliveryVsTraded`, `SectorMembershipCard`, `ScanPresenceCard`.
- `components/domain/StockFlowHeatmap.tsx` — single-stock flow heatmap.
- `services/visualPulseEngine.ts` — snapshot / correlation / dots engine.
- `services/bigMoney.ts` — Big Money detection (self-relative).
