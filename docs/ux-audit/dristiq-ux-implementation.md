# DristiQ — UX & Story-telling Implementation Brief
**For:** Claude Code  
**From:** Design session with Charan  
**Date:** June 2026  
**HTML references:** `dristiq-morning-workspace.html`, `dristiq-correlation-fullpage.html`, `dristiq-catalog.html`  
**Branch:** claude/quirky-maxwell-j19oE  

---

## How to read this document

This document covers three surfaces redesigned during the UX story-telling session. For each surface:
- What exists today
- What changes and why
- Exact implementation instructions
- What is deferred and why

Read the three HTML files alongside this document — they are the visual source of truth. When this document and the HTML differ, the HTML wins.

**Core principle that drives every decision in this document:**

> VaNi surfaces. User decides.  
> VaNi never makes directional calls, never says "bullish" or "bearish" as a recommendation, never tells the user what to do. VaNi identifies what is active, what the data shows historically, and what is approaching. The user draws their own conclusions.

---

## Surface 1 — Morning Workspace Load

**Reference:** `dristiq-morning-workspace.html`

### What exists today

- `WorkspaceActionIsland` shows hardcoded text: "VaNi is watching your framework"
- No context is surfaced on workspace load
- User opens the workspace and sees data with no orientation

### What changes

#### 1.1 — VaNi Morning Brief card in right panel

**Location:** `WorkspaceBlock.tsx` — add a new block type `vani_morning_brief` OR render as a pinned non-block component at the top of the right panel in `WorkspaceCanvas.tsx`.

Recommend: render as a fixed component above the block grid in the right panel — not a draggable block, not in `blocks[]`, not persisted to DB. It is a session-computed surface that regenerates on each workspace load.

**Component:** Create `src/components/workspace/VaNiMorningBrief.tsx`

**What it shows — three items max, in priority order:**

1. Any astro rule currently active from `frameworkStore.framework.chart_overlays` — rule name, day count if period-based, link to view on chart
2. Any confluence pair currently active or approaching from `frameworkStore.vaniCorrelations` — pair names, instance count, link to open correlation drawer
3. Six-Day Outlook signal for today if `six_day_outlook` block exists in framework — signal classification, rule count, link to block

**Language rules (strictly enforced):**
- "Panchak — Day 3 of 5" ✓
- "SMA 50 ∩ Conjunction — both overlays active · 81 instances" ✓
- "Six-Day Outlook — 2 rules firing today" ✓
- "Bearish lean" ✗ — never
- "Watch price" ✗ — never
- "Likely to move lower" ✗ — never

Each item has:
- A colored left indicator dot (gold for astro, accent for confluence, neutral for outlook)
- Title (factual state)
- One-line description (what it means structurally, not directionally)
- Instance count or day count as a mono badge
- "View →" link that navigates to the relevant surface

**Visibility:** Show only if at least one item has data. If framework has no overlays and no correlations detected, hide the component entirely — do not show an empty state.

**Interaction:** Clicking "Full morning context" or tapping the component expands a modal (see Section 1.2).

---

#### 1.2 — Morning modal (expanded state)

Triggers on: VaNi Brief card click, Action Island click, auto-show on first workspace load of the day.

**Auto-show logic:**
- Show once per calendar day per user
- Store last-shown date in `localStorage` as `vani_morning_shown:{userId}:{date}` 
- Do NOT auto-show if user dismissed it today already
- Auto-show after 1.2s delay (gives workspace time to render)

**Modal content:**

Header:
```
✦ VaNi
What's active in your framework as markets open today.
[date · time IST]
```

Body — same three items as the brief card but expanded:
- Each item in a card row with colored left bar
- Status badge (Active now / Approaching / Today)
- Factual description — 2 sentences max
- Instance count stat badge
- "View →" action link

Footer:
- "Enter workspace →" (primary, closes modal)
- "Dismiss" (secondary, closes modal, suppresses auto-show for today)

**Language rule:** Every observation must pass this test — could it be published as a weather report with no directional financial implication? If yes, it belongs. If no, rewrite.

---

#### 1.3 — Action Island live state

**Location:** `WorkspaceActionIsland.tsx`

Replace hardcoded "VaNi is watching your framework" with computed state.

**State logic:**

| Condition | Island text | Chips |
|-----------|-------------|-------|
| No active rules, no correlations | "VaNi is watching your framework" | none |
| Active astro rule(s) | "N rule(s) active in your framework" | rule name chip |
| Confluence detected | "N confluences in your framework" | pair name chip · instance count chip |
| Both active rules + confluence | "N things active in your framework" | most significant chip |

Chips use `font-mono` 10px. Colors:
- Astro rule chip: `caution-bg` + `caution` text
- Confluence chip: `accent-glow` + accent text

**Text style:** Fraunces serif, italic, 13px — "VaNi is speaking" voice.

**Click:** Opens morning modal.

---

#### 1.4 — Morning brief intelligence layer (DEFERRED)

The morning brief will eventually show top-3% results from user's saved screener filters. This is deferred until the Screener session is complete.

When implemented:
- Screener results feed into the morning brief as a fourth section
- Only available on Quarterly+ tier
- Morning brief without screener feed = free tier experience

Do not build this now. Add to CLAUDE.md deferred items.

---

## Surface 2 — Correlation Full Page

**Reference:** `dristiq-correlation-fullpage.html`

### What exists today

- `CorrelationDrawer` slides in from right, 420px wide
- ZONE_CONFLUENCE shape has Gantt + histogram
- VaNi inference is template-generated
- "Mark on chart" and "Save observation" are disabled stubs

### What changes

#### 2.1 — Full page route

Add route `/correlation/:itemA/:itemB` to `App.tsx`.

New component: `src/views/CorrelationPage.tsx`

**Entry points:**
- Confluence pill in workspace topbar → `navigate('/correlation/itemA/itemB')`
- "Open full view →" button in `CorrelationDrawer` (add this button to drawer footer)
- Action Island click when single correlation active → navigate directly

**Back navigation:** "← Workspace" button in topbar returns to `/workspace`. Browser back also works.

**Pair navigation:** Top-right of topbar shows prev/next pair buttons if multiple correlations detected. Read from `frameworkStore.vaniCorrelations`.

**The CorrelationDrawer stays** for quick glance. Add "Open full view →" to its footer. Full page is the deep-dive destination.

---

#### 2.2 — Left panel (identity + confidence + VaNi)

**Pair identity section:**
- Two overlay pills showing item names with their chart colors
- ∩ separator
- Shape badge (ZONE_CONFLUENCE / EVENT_OVERLAP / EVENT_IN_STATE / THRESHOLD_CROSS)
- Status badge (Approaching / Active now / Historical only)

**Clock confidence dial:**

Create `src/components/correlation/ConfidenceDial.tsx`

This replaces the `DataQualityBar` on the full-page view (keep DataQualityBar in the drawer for compact display).

```
Clock positions:
12 o'clock = Strong   (n >= 30, coverage >= 95%)
3 o'clock  = Good     (n 15–29)
6 o'clock  = Moderate (n 8–14)  
9 o'clock  = Low      (n < 8)
```

SVG implementation: circle with `stroke-dasharray` / `stroke-dashoffset` showing fill level. Needle not needed — fill level communicates the position clearly.

Center text: strength label + "n=XX"

Legend beside dial: four rows showing 12/3/6/9 with track bars and labels.

**Stats grid:** 2×2 grid — Total instances, Resolved count, 5D Avg, 22D Avg. Use Fraunces for values.

**Outcome split bar:** Proportional bull/bear fill. Labels show counts ("48 up / 32 down"), not percentages.

**VaNi inference:** Same template-generated text as today. LLM upgrade is deferred to story-telling+LLM session (tracked in CLAUDE.md).

**Actions:**
- "Walk mode" button — see Section 2.5
- "Save as Walk widget" button — see Section 2.5
- "Dismiss" — removes from `vaniCorrelations`

---

#### 2.3 — Visualisation selector (VaNi skill)

**Location:** Top of right panel, full-width bar.

Label: "✦ VaNi suggests for [SHAPE] · n=[N]:"

**The skill logic** (implement as a pure TypeScript function, not an LLM call):

```typescript
function recommendVisualisations(
  shape: CorrelationShape,
  n_instances: number,
  has_duration_variance: boolean
): VisualisationOption[]
```

Rules:
- `n >= 20`: Instance Grid is rank 1 — pattern visible at scale
- `n < 20`: Table is rank 1 — too few instances for grid to be meaningful  
- `ZONE_CONFLUENCE` with `has_duration_variance`: Timeline is rank 2
- Any shape: Distribution is always available, ranked by n (higher n = higher rank)
- Table is always available as last option

Return ordered array of: `{ id, label, icon, recommended: boolean }`

**UI:** Pill buttons in a horizontal scrollable strip. The top-ranked option gets a "VaNi pick" label above it (absolutely positioned, small mono text). Selected pill gets accent border.

**User preference persisted:** Store selected viz per pair in `localStorage` as `corr_viz:{itemA}:{itemB}`. On next open, restore their preference.

---

#### 2.4 — Four visualisation views

All four views render in the right panel canvas. Switch is instantaneous — data is already loaded.

**View 1 — Instance Grid (default for n>=20)**

Grid of squares, one per instance. Layout: `flex-wrap`, 20×20px squares, 4px gap.

Colors:
- Bull outcome: `var(--bull)`, opacity 0.8
- Bear outcome: `var(--bear)`, opacity 0.8  
- Current/approaching: `var(--accent)`, pulsing glow animation
- No outcome (null return): `var(--text-3)`, no hover

Hover tooltip (fixed position, follows mouse): date · duration · 5D return · outcome

Above grid: three summary boxes — "N closed higher" (bull), "N closed lower" (bear), "N approaching/in progress" (accent).

Below grid: plain-language framing using Fraunces — "81 times this combination appeared." subtitle explains what the colors mean.

**View 2 — Timeline (Gantt)**

Same as current CorrelationDrawer ZONE_CONFLUENCE viz. Promote it to this view.

Keep the 5D return histogram below the Gantt.

**View 3 — Distribution**

5D return bucketed into 6 ranges: `<-2%, -2 to -1%, -1 to 0%, 0 to +1%, +1 to +2%, >+2%`

Bar chart, neg bars = `var(--bear)`, pos bars = `var(--bull)`.

Below chart: one sentence describing the most common bucket. Factual only — "The most common outcome is a 5D return between +1% and +2%, appearing in 26 of 80 resolved instances."

**View 4 — Table**

All instances, sorted most recent first. Columns: Start date, Duration, 5D return, 22D return, Outcome badge.

Sticky header. "Approaching" instance row at top, special styling (accent border).

---

#### 2.5 — Walk mode (PRICE-GATED)

**Walk mode** is the fifth visualisation option in the selector. VaNi recommends it for users who are new to a combination (first time viewing, or n < 30 where the grid doesn't tell the story clearly).

**What it does:**
- Timeline scroller (`src/components/domain/VisualPulse/TimelineSlider.tsx`) takes over the workspace chart
- Scrubs through all instances chronologically
- Chart zooms to each instance's date range (start date to end date + 22D forward)
- The two overlays remain visible on the chart for that period
- Instance Grid square for the active instance pulses
- Caption bar below chart: "Instance N of 81 · [date] · [duration] · 5D: [return]"
- Controls: ← Previous · ▶ Play · → Next · ✕ Exit walk mode

**Entry point:** "Walk through all 81 instances on chart →" button at bottom of left panel (and in viz selector as "Walk Mode" option).

**Pricing gate:** Trial+ only. Free users see the button, tap it, InlineGate appears with context: "Walk mode lets you explore all N instances on the chart — seeing each confluence period in its historical context. Available on Trial and above."

**Save as Walk widget:**
- Saves the correlation pair as a `vani_walk` block in `frameworkStore.blocks[]`
- Block renders in workspace right panel as a compact card: pair name + instance count + "Walk →" button
- Tapping "Walk →" from the workspace block navigates to `/correlation/:itemA/:itemB` and auto-activates Walk mode
- Pricing gate: Quarterly+ only. InlineGate context: "Save Walk widgets to your workspace to re-visit any correlation's history at any time."

**Backend:** Walk mode reads from the existing correlation instances already returned by `POST /api/correlation/compute`. No new endpoint needed. The instance dates drive the chart navigation.

**Chart integration:** `WorkspaceChart.tsx` needs a new prop: `walkInstance?: { start_date: string, end_date: string }`. When set, chart zooms to that date range. `TradingChart.tsx` needs to support `setVisibleRange` from lightweight-charts v5 API.

---

## Surface 3 — Catalog Redesign

**Reference:** `dristiq-catalog.html`

### What exists today

- Single "Indicators" section mixing chart overlays and panel indicators
- Single "Widgets" section with locked cards dimmed to 0.4 opacity
- Static descriptions on all cards — no VaNi explanation
- No color picker at card level
- DeepDivePanel VaNi placeholder is empty

### What changes

#### 3.1 — Navigation structure

**Replace** the current 5-tab catalog subnav with this structure:

| Nav item | Content | Note |
|----------|---------|------|
| Master Frameworks | Coming soon placeholder | Locked — future feature |
| Astro Rules | Existing table — unchanged for now | Separate session |
| Chart Indicators | Renamed from "Indicators" | See 3.2 |
| Intelligence Widgets | Renamed from "Widgets" | See 3.3 |
| Scanners | Coming soon placeholder | Separate session |

**Nav style:** Left subnav, 180px fixed. Gold left border on active item (matches current). Collapsible — add a `‹` toggle button at top of subnav. When collapsed, shows only icons (or just hides). User preference saved in `localStorage`.

**Master Frameworks placeholder:**
```
Master Frameworks
Coming in a future release. Build your own framework 
from the Catalog, or let VaNi suggest a starting point 
during onboarding.
```

**Scanners placeholder:**
```
Scanners
Screener and scanner session coming soon.
```

Remove the 4 hardcoded template cards from `MasterFrameworksSection`. The ICP onboarding templates stay as backend logic — never shown in catalog.

---

#### 3.2 — Chart Indicators section

**Section header:**
- Title: "Chart *Indicators*" (Fraunces, italic on second word)
- Description: "Technical indicators drawn directly on the price chart as lines, bands, or zones. Pick a color before adding — you can change it anytime from the overlay strip."
- Tag: "● All free tier" (bull green)

**Card layout:** 3-column grid.

**Each indicator card has:**

1. **Color strip** — 3px top border in the indicator's default color
2. **Type chips** — "CHART OVERLAY" + "INDICATOR" (mono, uppercase, surface-2 background)
3. **Name** — Fraunces, 17px
4. **VaNi one-liner** — cached explanation, 11.5px, `text-2`, italicized key phrase in accent color
5. **Mini preview SVG** — simplified line/band showing what the indicator looks like on a chart. Height: 36px. Label: "NIFTY 50 · 1Y". Each indicator has its own path shape (see HTML for reference paths)
6. **Footer:** catalog_item_id badge + color swatch (with popover) + Add/Added button

**Color swatch popover:**
- 8 swatches (see HTML for default palette)
- Clicking a swatch updates: card color strip, swatch preview, and saves the color preference to `frameworkStore` (not just local state — persist with the overlay when added)
- SuperTrend exception: "SuperTrend uses bull/bear colors from your theme — not configurable."

**Add button states:**
- `btn-add`: accent-glow background, "+" Add
- `btn-added`: bull-bg background, "✓ added" — shown when `isOverlayActive(id)` is true

**Card click:** Opens DeepDivePanel (existing behavior). Color swatch click: `event.stopPropagation()` — does not open panel.

---

#### 3.3 — Intelligence Widgets section

Rendered below Chart Indicators in the same content area when "Chart Indicators" nav item is active. They are siblings in the same scroll view, separated by a section header.

**Section header:**
- Title: "Intelligence *Widgets*"
- Description: "Proprietary DristiQ signals rendered as panel blocks in your workspace. These don't draw on the chart — they run alongside it."
- Tag: "◑ Some paid tier" (caution amber)

**Card layout:** 2-column grid.

**Free widget card (MagicRS, Breadth ROC):**
- Header: icon + name + "Free" badge (bull green)
- Live preview component (existing — `MagicRsWidget`, `BreadthRocChart`)
- VaNi one-liner: "✦ [factual one-line explanation]" — see Section 3.5 for text
- Footer: catalog_item_id + "Add to framework" button

**Locked widget card (Smart Money, Order Flow, Six-Day Outlook):**

Do NOT just dim the card. Show a lock overlay that communicates value:

```
[lock icon]
[Widget name — Fraunces italic]
[2-sentence plain-language description of what it does and why it's useful]
[Unlock with Trial → CTA button]
```

Behind the overlay, show the blurred live preview (filter: blur(3px), opacity: 0.5). The user can see *something* is there, just not what exactly.

The card itself is still clickable (cursor: pointer) — clicking opens DeepDivePanel where they can read the full VaNi explanation and see the upgrade CTA.

---

#### 3.4 — DeepDivePanel changes

**Color section (indicators only):**

Add a new section at the top of the DeepDivePanel scroll area (above VaNi explanation):

```
CHART COLOR
[color preview square 36×36] [8 color swatches]
This color appears on your chart. You can change it 
anytime from the overlay pill strip.
```

Only show this section when `item.placement === 'chart_overlay'`. Hide for widgets and panel blocks.

Color picker wired to the same state as the card-level picker — they should stay in sync.

**VaNi explanation section (replaces empty placeholder):**

```
[VaNi orb] VaNi explains     cached · updated rarely
[Fraunces italic explanation text — see Section 3.5]
[Works/Limits tags]
```

"cached · updated rarely" label (mono, text-3, right-aligned) tells the user this is pre-computed, not a live call. Manages expectations — this is the same text every time they open this item.

**Works/Limits tags:**
- Green tags: "✓ [use case]" — when this indicator works well
- Red tags: "✗ [limitation]" — when it doesn't
- Max 3 tags total
- See Section 3.5 for all tag content

**Existing sections stay:** Details grid (type/placement/tier/applies to), preview, Add button.

---

#### 3.5 — VaNi cached explanations

These are the exact texts to store. They are **not** LLM-generated at runtime — store them in `catalogItems.ts` as a `vani_explanation` field and `vani_tags` array on each item. They will be generated by Qwen3 once in a batch job and hardcoded.

**For now, use these texts directly (written during design session):**

| Item | vani_explanation | tags |
|------|-----------------|------|
| EMA 20 | "EMA 20 gives more weight to the last 20 sessions than older data, so it reacts faster to price changes than a simple moving average. Think of it as a short-term memory of the market — it tells you the recent direction without the noise of individual sessions. When price crosses above EMA 20, the short-term tide has turned." | ✓ Trending markets · ✓ Entry timing · ✗ Choppy sideways markets |
| EMA 60 | "EMA 60 is the bridge between short-term noise and medium-term trend. It moves slower than EMA 20 but faster than SMA 50, making it useful for identifying when the intermediate trend is changing direction. Popular with swing traders looking for a balance between responsiveness and stability." | ✓ Swing trading · ✓ Trend confirmation · ✗ Very short-term timing |
| SMA 50 | "SMA 50 is the line institutional desks watch most carefully on weekly timeframes. It acts as a gravitational reference — price tends to return to it in trending markets. Unlike EMA, it weighs every one of the last 50 sessions equally, so it moves more slowly and filters out short-term noise. If price is above SMA 50, the medium-term structure is intact." | ✓ Medium-term structure · ✓ Support/resistance · ✗ Short-term signals |
| SMA 150 | "SMA 150 is DristiQ's primary trend filter — it's the line all internal scans use to classify whether the market is in a constructive phase or not. When Nifty is above SMA 150, scans weight bullish signals more heavily. When below, caution signals get priority. This is the most important line in your framework if you follow the system." | ✓ Primary trend filter · ✓ Scan classification · ✗ Timing entries |
| SMA 200 | "SMA 200 is the most widely watched line in global equity markets. Fund managers, algorithms, and retail traders all reference it. When a major index trades below SMA 200, institutional risk models flag it as a structural concern. Its power comes from the fact that everyone is watching it — making it a self-fulfilling reference point." | ✓ Long-term structure · ✓ Institutional reference · ✗ Timing entries |
| SuperTrend | "SuperTrend is a trend-following band built on ATR (volatility). It flips between two states — green below price means the trend is up, red above price means the trend is down. Unlike moving averages, it adjusts its distance from price based on how volatile the market is, so it stays closer in calm markets and wider in choppy ones." | ✓ Clear trend identification · ✓ Volatile markets · ✗ Sideways markets |
| Pivot Levels | "Pivot levels are mathematically derived support and resistance zones calculated from the prior period's high, low, and close. They don't look at price history beyond one period — they simply define where the market statistically tends to find reaction points. Price doesn't always obey them, but it notices them." | ✓ Intraday reference · ✓ Short-term S/R · ✗ Trend following |
| ATR 14 | "ATR 14 measures how much Nifty moves on average over the last 14 sessions — pure volatility, no direction. When ATR is high, the market is making large swings. When low, it's in a compression phase. It doesn't tell you which way price will go, only how much room it typically takes to move." | ✓ Volatility context · ✓ Position sizing · ✗ Not directional |
| MagicRS | "MagicRS is DristiQ's proprietary relative strength signal. It measures how Nifty is moving relative to its own historical volatility rhythm — not against another index. A positive reading means Nifty is expressing more strength than its recent average. A negative reading means it's underperforming its own baseline. It's a mirror of the market's internal momentum, not a comparison to anything external." | ✓ Momentum context · ✓ Intraday + swing · ✗ Not a buy/sell signal |
| Breadth ROC | "Breadth ROC measures the rate of change in how many stocks are participating in a move. When Breadth ROC is rising, the advance is broadening — more stocks are joining. When it's falling, the move is narrowing to fewer names. A rising index with falling Breadth ROC is a divergence worth noting." | ✓ Market-wide participation · ✓ Divergence detection · ✗ Single stock analysis |
| Smart Money | "Smart Money tracks institutional accumulation and distribution patterns on Nifty. It classifies volume into informed vs uninformed flow by looking at when and how blocks trade. When Smart Money is in accumulation, large participants are systematically absorbing supply. This is the signal that often precedes a sustained directional move." | ✓ Institutional flow · ✓ Swing context · ✗ Not real-time tick data |
| Order Flow | "Order Flow classifies each session's volume into buyer-initiated vs seller-initiated transactions. When buyers are dominant, sessions close in the upper half of their range on rising volume. It tells you whether the tape is being driven by urgency to buy or urgency to sell — which is different from price direction alone." | ✓ Session context · ✓ Volume analysis · ✗ Not predictive alone |
| Six-Day Outlook | "Six-Day Outlook is a forward astro calendar — it shows which of your active rules are firing across the next 6 trading days before they happen. This is the planning surface. Instead of reacting to what fired today, you see what's coming. It turns the astro signal layer from reactive to anticipatory." | ✓ Forward planning · ✓ Rule confluence preview · ✗ Not a trading calendar |

**How to store:** Add two new fields to the `CatalogItem` interface in `framework.ts`:

```typescript
interface CatalogItem {
  // ... existing fields
  vani_explanation?: string
  vani_tags?: Array<{ text: string; type: 'works' | 'limit' }>
}
```

Add the texts above to each item in `catalogItems.ts`.

**Future upgrade:** Once the product is generating cashflow, replace these hardcoded texts with Qwen3-generated explanations stored in a `catalog_explanations` DB table, keyed by `catalog_item_id`. The frontend reads from DB first, falls back to `catalogItems.ts` if not found.

---

## Pricing gates summary

| Feature | Free | Trial | Quarterly | Annual |
|---------|------|-------|-----------|--------|
| Morning brief — framework state | ✓ | ✓ | ✓ | ✓ |
| Morning brief — screener top 3% | — | — | ✓ | ✓ |
| View correlation data | ✓ | ✓ | ✓ | ✓ |
| Correlation full page | ✓ | ✓ | ✓ | ✓ |
| Instance Grid / Table / Distribution | ✓ | ✓ | ✓ | ✓ |
| Walk mode | — | ✓ | ✓ | ✓ |
| Save as Walk widget | — | — | ✓ | ✓ |
| Chart Indicators | ✓ | ✓ | ✓ | ✓ |
| MagicRS, Breadth ROC widgets | ✓ | ✓ | ✓ | ✓ |
| Smart Money, Order Flow, Six-Day Outlook | — | ✓ | ✓ | ✓ |

InlineGate context strings to add:

```typescript
// In InlineGate.tsx gateContext map:
'walk_mode': "Walk mode lets you explore all N instances on the chart — seeing each confluence period in its historical context. Available on Trial and above.",
'save_walk_widget': "Save Walk widgets to your workspace to re-visit any correlation's history at any time. Available on Quarterly and above.",
```

---

## What is deferred — do not build now

Add these to CLAUDE.md deferred section:

| Item | Why deferred | When |
|------|-------------|------|
| Morning brief — screener top 3% feed | Depends on screener session completion | After screener session |
| Master Frameworks catalog section | Full feature — LLM briefing, admin creation, user templates | Post cashflow |
| Astro Rules catalog improvements | Separate session | Next astro session |
| Scanners catalog | Separate session | Next scanners session |
| LLM inference notes (correlation) | Story-telling + LLM session | After this sprint |
| VaNi catalog explanations via Qwen3 | Post cashflow, use hardcoded texts for now | After cashflow |
| Walk mode chart markers | Phase 6 | After Walk mode |
| Save observation (correlation) | Phase 6 | After Walk mode |

---

## Implementation sequence

Do these in order. Do not start a step until the previous step is confirmed working.

**Step 1 — catalogItems.ts schema update**
- Add `vani_explanation` and `vani_tags` to `CatalogItem` interface
- Populate all 13 items with texts from Section 3.5
- No UI changes yet — just data

**Step 2 — Catalog nav restructure**
- Rename "Indicators" → "Chart Indicators"
- Rename "Widgets" → "Intelligence Widgets"  
- Master Frameworks → coming soon placeholder
- Scanners → coming soon placeholder
- Subnav collapsible toggle

**Step 3 — Indicator cards**
- Color strip
- VaNi one-liner (reads from `vani_explanation`)
- Mini preview SVG (per item, see HTML)
- Color swatch popover
- Color persists to framework on add

**Step 4 — Widget cards**
- Lock overlay redesign (blur + value communication)
- VaNi one-liner on free widgets

**Step 5 — DeepDivePanel**
- Color section (chart overlays only)
- VaNi explanation section with works/limits tags
- Wire to `catalogItems.ts` data

**Step 6 — Correlation full page**
- Route `/correlation/:itemA/:itemB`
- Left panel (identity + clock dial + stats + VaNi)
- `ConfidenceDial` component
- Viz selector with skill function
- Four visualisation views
- "Open full view →" in existing CorrelationDrawer

**Step 7 — Walk mode (after Step 6)**
- Pricing gate first
- Chart `walkInstance` prop
- Timeline scroller integration
- Instance Grid sync

**Step 8 — Morning brief**
- `VaNiMorningBrief` component
- Morning modal
- Action Island live state
- Auto-show once-per-day logic

---

## Architecture notes for Claude Code

**No new DB tables required for this sprint.** All data comes from:
- `frameworkStore` (user's framework state)
- `vaniCorrelations` in `frameworkStore` (already computed)
- `catalogItems.ts` (static, extended with vani fields)
- `POST /api/correlation/compute` (existing endpoint)

**`ConfidenceDial` is a pure SVG component.** No library needed. Input: `{ n_instances: number, coverage_pct: number }`. Output: SVG with computed `stroke-dashoffset`.

**Viz selector skill is a pure TypeScript function.** No LLM call. Lives in `src/utils/correlationVizSkill.ts`.

**Walk mode reuses `TimelineSlider` from `src/components/domain/VisualPulse/`** — do not rebuild the scrubbing mechanic. Wire it to correlation instance dates instead of intraday session data.

**Morning brief auto-show** uses `localStorage` only — not DB. Pattern: `vani_morning_shown:{userId}:{YYYY-MM-DD}`. Check on `WorkspacePage` mount, show modal if key not present for today.

---

*Document version: 1.0 — June 2026*  
*Covers: Morning Workspace, Correlation Full Page, Catalog Redesign*  
*HTML references: dristiq-morning-workspace.html, dristiq-correlation-fullpage.html, dristiq-catalog.html*
