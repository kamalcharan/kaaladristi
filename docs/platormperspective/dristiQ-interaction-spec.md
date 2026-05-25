# DristiQ — Interaction Specification
**Version:** 2.0 — Framework-First Platform
**Date:** May 2026
**For:** Claude Code implementation
**Companion files:** dristiQ-onboarding-v2.html · dristiQ-workspace.html · dristiQ-catalog.html · dristiQ-correlation.html · dristiQ-correlation-v2.html · dristiQ-business-model.html

---

## 1. Product Philosophy (Non-negotiable)

DristiQ is a **living data platform** — not an opinionated signal product. The platform grows continuously (rules, indicators, widgets, scanners). The user owns a personal **Framework** — their slice of the platform, built their way.

> VaNi is never a chatbot. VaNi acts on the UI — places blocks, highlights chart zones, surfaces data. Conversation is the exception, not the mode.

**Astro signals = advance warning. Technicals = confirmation.** This layering must never be collapsed or conflated in any UX surface.

---

## 2. Three Product Zones

| Zone | Purpose | Primary Screen |
|------|---------|----------------|
| **Workspace** | User's personal framework — chart + composable blocks | dristiQ-workspace.html |
| **Catalog** | Everything available to add — rules, indicators, widgets, frameworks | dristiQ-catalog.html |
| **Views** | Dashboard, Scanner, Visual Pulse, Planetary Intel — existing surfaces | existing codebase |

VaNi connects all three — onboards, watches, surfaces, acts.

---

## 3. User Tiers & Access Gates

### Tier Definitions

| Tier | Price | Duration | Access Level |
|------|-------|----------|--------------|
| Free | ₹0 | 1 week | Limited (see below) |
| Trial | ₹199 | 3 days | Full |
| Quarterly | ₹1,999 | 3 months | Full |
| Annual | ₹4,999 | 1 year | Full + extras |
| Beta | ₹0 | Until public launch | Full |

### Free Tier Restrictions

| Feature | Free | Paid/Trial |
|---------|------|-----------|
| Instruments | Nifty 50 (fixed) + 2 user-selected equities | Unlimited |
| Correlation history | 1 year | 6yr+ |
| Master Frameworks | 1 template (admin-configured) | All 12+ |
| Catalog | Browse only — cannot add to framework | Full add/remove |
| Framework builder | View only | Full |
| VaNi observations | Limited — no proactive confluence detection | Full |
| Correlation views | Locked | All types |
| Benchmark comparison | Locked | All benchmarks |

### Gate Trigger Logic

Every gated action follows this sequence:

```
User attempts gated action
  → Check user tier
  → If paid/beta: proceed normally
  → If free:
      → Check if feature is in free allowance
      → If yes: proceed
      → If no: fire Inline Gate (see Section 8)
```

**Actions that trigger the Inline Gate on free tier:**
- Adding more than 2 instruments
- Adding any rule/widget/scanner to framework
- Opening any correlation view
- Accessing full backtesting history (>1 year)
- Switching benchmark in correlation view
- Opening framework builder
- Accessing any Master Framework other than admin default

**Actions that are always free (never gated):**
- Browsing Catalog sections (view only)
- Viewing the Workspace with default template
- VaNi onboarding flow
- Instrument selector (up to 2)
- Pricing page

---

## 4. Registration & Onboarding Flow

**Reference:** dristiQ-onboarding-v2.html

### 4.1 Screen Sequence

```
Registration (email + password)
  ↓
S1 — VaNi Introduction (full screen, morphing orb)
  ↓
S2 — Single ICP Question (tap-based, no typing)
  ↓
S3 — VaNi Builds Framework Live (block-by-block animation)
  ↓
  ├── Free tier → S4 Instrument Selector
  └── Paid/Beta → S5 Workspace (framework loaded)
```

### 4.2 ICP Question Logic

VaNi asks one question: **"How do you participate in markets?"**

Options: `Investor` / `Trader` / `Both` (shows blend slider)

**Template mapping:**

| Answer | Starter Template |
|--------|-----------------|
| Investor | Six-Day Outlook + MagicRS + Panchak + Conviction Flow |
| Trader | EMA 20/50 + RSI + Breadth ROC + Conviction Flow |
| Both (70/30+) | Full Hybrid — all 6 blocks |
| Both (50/50) | Balanced — 3 astro + 3 technical |

Template selection is VaNi's decision — user does not choose. User reacts and can modify after.

### 4.3 Build Animation Sequence

Each block appears at 350ms intervals. VaNi narrates each placement in the right panel. Build sequence:

1. EMA 20/50 → "Starting with trend context — baseline direction first."
2. MagicRS → "Adding DristiQ's proprietary relative strength signal."
3. Panchak → "Overlaying Panchak on the chart — caution zones visible on price."
4. Conviction Flow → "Running the scanner — today's results will load here."
5. Breadth ROC → "Market momentum oscillator — tells you when the tide is turning."
6. Six-Day Outlook → "Forward astro calendar — what's coming in the next 6 days."

After all 6 blocks: VaNi says "Your framework is ready. Everything here can be changed."

Two actions: **"Start here →"** (accepts) or **"Browse Master Frameworks"** (goes to Catalog).

### 4.4 Instrument Selector (Free Tier Only)

Shown between S3 (build) and workspace entry, only for free tier users.

- Nifty 50: pre-selected, locked, cannot be removed
- User selects exactly 2 more from search/suggestions
- Continue button disabled until exactly 2 selected
- Selections persisted to `user_framework.instruments[]`

---

## 5. Framework Object (Data Model)

The Framework is a first-class database entity.

```typescript
interface UserFramework {
  id: string
  user_id: string
  name: string                    // default: "My Framework"
  created_at: timestamp
  updated_at: timestamp
  version: number                 // increments on each save
  instruments: string[]           // equity symbols — ["NIFTY50", "RELIANCE", "HDFCBANK"]
  blocks: FrameworkBlock[]        // ordered array of canvas blocks
  chart_overlays: ChartOverlay[]  // rules/indicators active on chart
  template_id?: string            // if derived from a master template
  tier_at_creation: TierType
}

interface FrameworkBlock {
  id: string
  type: 'indicator' | 'widget' | 'scanner' | 'astro_rule' | 'vani_correlation'
  catalog_item_id: string         // references catalog item
  placement: 'chart_overlay' | 'panel_block' | 'output_panel'
  grid_position: GridPosition     // col_start, col_end, row_start, row_end
  config: Record<string, any>     // item-specific config (e.g. RSI period)
  added_by: 'user' | 'vani'       // vani-placed blocks have distinct visual treatment
  added_at: timestamp
}

interface ChartOverlay {
  catalog_item_id: string
  type: 'astro_zone' | 'astro_marker' | 'indicator_line' | 'indicator_band'
  visible: boolean
  color?: string
}

interface GridPosition {
  col_start: number   // 1-12
  col_end: number
  row_start: number   // 1-10
  row_end: number
}
```

### 5.1 Framework Persistence Rules

- Framework auto-saves on every block add/remove/move
- Version increments on each save
- Free tier: 1 framework only, 3 instrument max (Nifty fixed + 2)
- Paid tier: unlimited frameworks, unlimited instruments
- Beta tier: same as paid
- Deleting a framework prompts confirmation — cannot be undone

### 5.2 "Add to Framework" Universal Action

This action fires from: Catalog item card, Rule Engine row, Workspace block header, Correlation view, Deep Dive panel.

```
User taps "Add to Framework"
  → Check tier gate (see Section 3)
  → If allowed:
      → Determine placement type (see Placement Routing below)
      → If chart_overlay: add to framework.chart_overlays[], activate on chart
      → If panel_block: add to framework.blocks[], render in right panel
      → Show success feedback (button state changes to "✓ Active")
      → VaNi notices the addition (see VaNi Trigger Map, Section 6)
  → If gated:
      → Fire Inline Gate
```

### 5.3 Placement Routing

| Building Block Type | Placement |
|--------------------|-----------|
| Astro Rule (period-based: Panchak, Retrograde) | chart_overlay → shaded zone |
| Astro Rule (event-based: Sankranti) | chart_overlay → vertical marker |
| Indicator (EMA, RSI, MACD, Bollinger) | chart_overlay → line/band |
| Widget (MagicRS, Breadth ROC, Smart Money) | panel_block |
| Scanner (Conviction Flow, Strength Confluence) | output_panel |

Overlay items also appear as badges in the chart topbar overlay strip. Panel blocks appear in the composable right panel. Output panels produce result sets (stock lists, sector lists).

---

## 6. VaNi Trigger Map

VaNi is always watching the workspace. These are the conditions that trigger VaNi to act — silently or with a notification.

### 6.1 Proactive Triggers (VaNi acts without being asked)

| Trigger Condition | VaNi Action | Where |
|------------------|-------------|-------|
| Two chart overlays are simultaneously active | Check historical confluence. If n≥3 instances found → drop Correlation Block on canvas | Workspace canvas |
| New Catalog item added matching user ICP | Surface notification in Action Island | Action Island |
| RSI crosses 70 or 30 while Panchak is active | Immediately drop Confluence Correlation Block | Workspace canvas |
| User has been on workspace >5 min with no interaction | Surface one observation from active framework data | Action Island |
| Active astro rule period ending within 24hrs | Update Action Island text | Action Island |

### 6.2 Reactive Triggers (VaNi responds to user action)

| User Action | VaNi Response |
|------------|---------------|
| Adds rule to framework | Surfaces hit rate + last 3 instances in Action Island |
| Clicks chart historical marker | Shows instance details in tooltip (date, return, duration) |
| Opens Correlation View | Pre-loads inference for current state in VaNi card |
| Taps Action Island | Expands tooltip with full observation + 2 action buttons |
| Taps "Show on chart" in correlation tooltip | Marks all historical instances as dots on chart |
| Framework has 0 blocks | VaNi suggests "Start with a template?" |

### 6.3 VaNi Correlation Block Trigger

**Fires when:** 2+ chart overlays are simultaneously active AND historical confluence n≥3.

**Block placement:** Inserted at top of right panel, above other blocks. Visually distinct — purple glow border, "VaNi ✦" badge, `added_by: 'vani'`.

**Block content:**
- Confluence rule pills (e.g. `Panchak ∩ RSI > 70`)
- Current status (Active Now / Approaching)
- Stats: instances, bearish/bullish split, avg return, avg duration
- Outcome distribution bar
- Instance rows (most recent 5 + "N more")
- VaNi inference note (plain language)
- "Instances marked on chart" toggle → fires chart marker overlay
- "Save observation" → persists to `user_observations[]`
- "Dismiss" → removes block, suppresses same confluence for 24hrs

**Block is dismissable.** User can remove it. VaNi will not re-surface the same confluence within 24 hours.

### 6.4 VaNi Inference Generation

VaNi inference notes are **not AI-generated at runtime.** They are **template strings** populated with computed values from the correlation engine.

Template example:
```
"{{indicator}} at {{current_value}} sits in the {{bucket_name}} — 
historically {{direction}} with {{avg_return}} avg {{timeframe}} return 
across {{n}} clean instances. {{context_note}}"
```

`context_note` is selected from a predefined set based on:
- Current market state (breadth direction, RSI zone)
- Active astro rules
- Data quality score

If data quality < 95% for a stat, VaNi appends: "Note: {{n_excluded}} instances excluded due to data quality — interpret with appropriate caution."

---

## 7. Canvas & Block System

**Reference:** dristiQ-workspace.html

### 7.1 Canvas Modes

**View Mode (default):**
- Clean, data-forward
- No drag handles visible
- Blocks render with live data
- VaNi Action Island shows current observation
- Right-click or long-press on block → context menu (Edit / Remove / View in Catalog)

**Edit Mode (activated by "Edit Canvas" button in topbar):**
- Grid lines ghost in (CSS background-image grid)
- All blocks elevate (box-shadow + subtle lift)
- Drag handles appear on block hover (top-left ⠿)
- Resize handles appear on block hover (bottom-right)
- ✕ remove buttons appear on block hover
- Add-zone placeholders appear in empty grid cells
- Action Island morphs — gold border, builder assistant text
- Catalog drawer becomes accessible via "+ Add block" zones

**Mode toggle:**
- Button label: "Edit Canvas" → "Done Editing"
- Button state: normal → active (vani purple fill)
- On "Done Editing": saves layout to framework, closes catalog drawer if open

### 7.2 Grid System

12-column × 10-row CSS Grid.

**Default VaNi layout (Hybrid template):**

| Block | Grid Position |
|-------|--------------|
| Chart | col 1–8, row 1–9 |
| MagicRS | col 9–12, row 1–3 |
| Astro Events | col 9–12, row 4–6 |
| Six-Day Outlook | col 9–12, row 7–9 |
| Conviction Flow | col 1–4, row 9–11 |
| Breadth ROC | col 5–12, row 9–11 |

Blocks can span variable columns and rows. Minimum block size: 2 cols × 1 row.

### 7.3 Block Communication with Chart

When a block is clicked (in View Mode):
- If block is a scanner output → clicking a stock row loads that stock onto the chart with all active overlays applied
- If block is an astro events list → clicking an event highlights its zone on the chart
- If block is a VaNi Correlation Block → toggling "Instances marked on chart" adds/removes dot markers

Chart overlay strip (topbar) reflects all active overlays. Clicking an overlay badge toggles its visibility on the chart (does not remove from framework).

### 7.4 Catalog Drawer (from Workspace)

Opens from: "+ overlay" badge in topbar, "+ Add block" add-zones, any Catalog nav item in sidebar.

Slides in from right — canvas shifts left (300px right margin added).

Catalog drawer in workspace context shows:
- Search
- Tabs: All / Astro / Technical / Widgets / Scanners
- Items marked "✓ Active" if already in framework
- "+ Add" button routes to placement logic (Section 5.3)
- Does NOT navigate away from workspace

---

## 8. Inline Gate

**Reference:** dristiQ-business-model.html (s-gate screen)

### 8.1 Gate Trigger

Fires when free tier user attempts a gated action (see Section 3).

### 8.2 Gate Behaviour

- Blurs workspace behind it (backdrop-filter: blur 8px + dark overlay)
- Gate card slides in from center with spring animation
- Never a hard block — always has "Continue on free tier" dismiss option
- VaNi speaks contextually about what was attempted (not generic "upgrade" copy)

### 8.3 Gate Card Content

| Element | Content |
|---------|---------|
| VaNi message | Explains specifically what they tried to access and what they'd unlock |
| Locked feature tag | Shows feature name + minimum tier required |
| Unlock preview | 4 bullet points of what Trial unlocks right now |
| Free tier remaining bar | Visual indicator of days left on free week |
| Primary CTA | "Try everything for 3 days · ₹199 one-time" |
| Secondary CTA | "See all plans →" → Pricing page |
| Dismiss | "Continue on free tier" — closes gate, returns to workspace |

### 8.4 Gate Copy Personalisation

Gate message is contextual — varies by what triggered it:

| Trigger | VaNi Message |
|---------|-------------|
| Tried to add rule to framework | "VaNi can't add rules to your framework on the free tier. Upgrade to build your own combination — or try the Trial for 3 days." |
| Tried to open correlation view | "Full correlation history needs a paid plan. Your free tier shows 1 year — the full 6yr+ picture is where the real patterns emerge." |
| Tried to add 3rd instrument | "Free tier is limited to Nifty + 2 instruments. Upgrade to watch any equity, index, or sector." |
| Free week expired | "Your free week has ended. Everything you built is saved — pick up where you left off." |

---

## 9. Catalog System

**Reference:** dristiQ-catalog.html

### 9.1 Catalog Sections

| Section | Content | Items |
|---------|---------|-------|
| Master Frameworks | Curated templates, gamified | 12+ |
| Astro Rules | 216 Vedic astro-market rules | 216 |
| Indicators | Technical data columns from DB | 24 |
| Widgets | DristiQ proprietary signals | 8 |
| Scanners | Output panels / scan results | 11 |
| Combinations | User-defined named setups | Coming |

### 9.2 Rule Deep Dive Panel

Opens from: clicking any row in Astro Rules table, clicking any Catalog item.

Slides in from right — content area shifts left.

**Panel content:**
- Rule type + name + conditions
- Backtesting chart (per-transit performance bars)
- Stats grid: confidence, historical instances, hit rate, avg return, best/worst day
- Correlation with current framework (how does this rule perform when user's active indicators are also present)
- VaNi inference note
- VaNi inference confidence score (bar)
- "Add to Framework" CTA — full width, primary button

**"Add to Framework" from deep dive:**
- Routes through placement logic (Section 5.3)
- Button state changes: "Add to Framework" → "✓ Added to Framework" (teal)
- Panel stays open — user can continue reading

### 9.3 Master Frameworks

Each framework card shows:
- Mini workspace preview (SVG skeleton of block layout)
- Name + tagline
- Block pills (astro / technical / widget / scanner)
- Stats: correlation %, signal count, active user count
- Gamification badge: Most Popular / Highest Correlation / Most Signals

**"Use this →" action:**
- Replaces user's current framework with selected template
- If user has a custom framework: confirm dialog "This will replace your current framework. Continue?"
- VaNi builds the new framework live (same animation as onboarding S3)
- User's instrument selection is preserved — template applies to their instruments

---

## 10. Correlation Views

**Reference:** dristiQ-correlation-v2.html

### 10.1 Shared Anatomy (all four views)

Every correlation view has these elements in this order:

1. **Corr Header** — type badge, title, current value/state callout (top right)
2. **Controls Bar** — benchmark selector + timeframe toggle + compare button
3. **Data Quality Bar** — coverage %, day count, ⓘ tooltip with exclusion details
4. **Compare Strip** — shown only when compare mode active, shows both benchmarks
5. **Main Content** — two-column: left = visualization (unique per type), right = VaNi inference card
6. **VaNi Inference Card** — always right column, always same structure (orb + label + body + confidence footer)

### 10.2 View Types

| View | Data Shape | Central Visualization |
|------|-----------|----------------------|
| MagicRS | Value buckets (0-20, 20-40, 40-60, 60-80, 80-100) | Horizontal bar chart per bucket + return distribution histogram |
| Breadth ROC | Four states (Rising/Falling × Above/Below zero) | State quadrant cards + ROC line chart |
| Conviction Flow | Scan appearances → outcome distribution | Return histogram + astro context comparison table |
| RSI | Three zones (OB/Neutral/OS) | Zone cards + timeline + reversal timing distribution |

### 10.3 Benchmark Selector

Available benchmarks: Nifty 50 / Nifty 500 / Bank Nifty

Switching benchmark:
- Reruns correlation against selected index
- All stats update (avg returns, hit rates, n values)
- VaNi inference updates to reference the new benchmark
- Action Island updates
- Data quality bar updates (each benchmark has its own quality stats)

### 10.4 Compare Mode

Activated by "⊞ Compare" button. Shows a second benchmark selector.

Compare strip appears between controls and main content showing:
- Side-by-side return for both benchmarks
- Delta column
- VaNi one-liner about the difference

In the main visualization:
- Secondary benchmark shown as outlined/dashed overlay on primary bars
- State cards show both values
- Zone cards show comparison value

### 10.5 Data Quality Bar

Every correlation view has a global data quality bar showing:
- Overall coverage (e.g. 98.7%)
- Exact day counts (e.g. "1,563 of 1,584 days")
- Date range (e.g. "Jan 2020 – May 2026")
- ⓘ hover tooltip listing specific exclusion reasons

Individual stat panels (buckets, zones, states) show their own quality bar when their sample has lower coverage than the global figure.

VaNi inference always references data quality: "Note: X instances excluded due to Y — interpret with appropriate caution" when any stat's quality < 95%.

**Known data quality issues to surface (from existing codebase audit):**
- Volume discontinuity in km_index_eod post-March 2026 — affects RVOL-dependent signals
- SHANTHALA phantom index — 502 equities, should be flagged/excluded
- Dual-listed equity over-counting — deduped view must be canonical source

---

## 11. Business Model Integration

**Reference:** dristiQ-business-model.html

### 11.1 Beta User Experience

Beta users see:
- Full product access — same as Annual tier
- Beta badge in topbar (β · "Beta Access") — persistent, subtle gold pill
- Hover tooltip: "You're a founding member. Full access free until public launch."
- Workspace footer bar: "Beta Access — free until public launch. You'll be notified before anything changes."
- No paywall, no gate, no pricing page unless user voluntarily navigates there

Beta user `tier` field = `'beta'`. All gate checks treat `'beta'` as `'annual'`.

### 11.2 Free User Experience

Free users see:
- Instrument selector post-onboarding (Nifty + 2 user-selected)
- 1 admin-configured default template on workspace
- VaNi builds framework from that template — same animation
- Inline gate fires on any restricted action (see Section 8)
- Free week countdown visible in workspace (subtle, not alarming)
- At week end: gate fires with "Your free week has ended" copy, workspace preserved

### 11.3 Pricing Page Entry Points

User reaches pricing page from:
- Inline gate "See all plans →" button
- Inline gate primary CTA → Trial ₹199
- Beta badge tooltip (informational — no hard push)
- Settings / Account menu

### 11.4 Trial → Paid Conversion

After 3-day Trial:
- User's framework, instruments, observations all preserved
- Gate fires with "Your trial has ended. Everything is saved."
- Pricing page shown with Quarterly and Annual CTAs
- No data loss — framework is always preserved regardless of tier

---

## 12. Navigation Structure

```
WORKSPACE          ← primary surface (user's framework)

VIEW
  Dashboard
  Scanner
  Market Structure
  Planetary Intel

CATALOG
  Master Frameworks
  Astro Rules
  Indicators
  Widgets
  Scanners
  Combinations     ← coming, container exists

ADMIN
  Markets
  Industry Transition
  Manipulation Watch
  Panchang
  Visual Pulse
  Inference DB
```

Catalog is a **new top-level nav section** — not a submenu. It consolidates the existing Rule Engine (now "Astro Rules") and Scanners, plus adds Indicators, Widgets, Master Frameworks, and the future Combinations section.

---

## 13. State Persistence

| State | Persists | Where |
|-------|---------|-------|
| User framework (blocks, layout, instruments) | Across sessions | DB: user_frameworks |
| Chart timeframe selection | Session only | Local state |
| Active benchmark in correlation view | Session only | Local state |
| VaNi dismissed correlations | 24 hours | DB: vani_suppressions |
| Saved observations | Permanently | DB: user_observations |
| Free tier day count | Continuously | DB: user_subscriptions |
| Catalog "added" state | Framework-linked | DB: user_frameworks.blocks |

---

## 14. Claude Code Implementation Notes

### Priority Order

**Phase 1 — Foundation (implement first):**
1. Framework object — DB schema + CRUD
2. "Add to Framework" universal action + placement routing
3. Catalog nav restructure (add Catalog section, move Rule Engine)
4. Free tier gate logic
5. Beta user tier check

**Phase 2 — Canvas:**
1. Composable workspace grid
2. Edit mode toggle + visual transformation
3. Block drag + resize (grid-snapping)
4. Chart overlay toggle from topbar strip

**Phase 3 — VaNi Intelligence:**
1. Confluence detection (2+ overlays active simultaneously)
2. VaNi Correlation Block drop onto canvas
3. Proactive Action Island observations
4. Chart historical instance markers

**Phase 4 — Correlation Views:**
1. Shared anatomy (header, controls, quality bar, VaNi card)
2. MagicRS bucket view
3. Breadth ROC state view
4. Conviction Flow outcome view
5. RSI zone view
6. Benchmark switching
7. Compare mode

**Phase 5 — Business Model:**
1. Instrument selector (free tier)
2. Pricing page
3. Inline gate (contextual copy per trigger)
4. Beta badge + workspace beta bar

### Key Principles for Implementation

- **VaNi never blocks.** Every VaNi observation is dismissable. Every gate has a "Continue on free" option.
- **Framework first.** Every Catalog item's "active" state is derived from the framework, not a local flag.
- **Data quality is visible.** Every correlation stat shows its quality. Never hide low-quality data — show it with context.
- **Astro overlays live on the chart.** Indicators and astro rules with `placement: 'chart_overlay'` render on TradingView (or chart surface), not as panel blocks.
- **Benchmark switching recomputes.** Not a filter on existing data — a full requery against the selected index.
- **VaNi blocks are visually distinct.** `added_by: 'vani'` blocks always have purple glow border + "VaNi ✦" badge. User cannot confuse VaNi-placed with user-placed.
- **Combinations section is a container now.** Build the nav item, show "Coming Soon" state. Do not build the feature yet.

---

## 15. Open Questions for Implementation

These were not resolved during UX design and will need decisions during implementation:

1. **TradingView integration** — Are astro overlays injected into TradingView via Pine Script, or rendered as HTML overlay on top of the TradingView iframe?
2. **Real-time VaNi triggers** — Is confluence detection run on page load, on a polling interval, or event-driven (when overlays change)?
3. **Correlation recompute** — When user switches benchmark, is correlation data pre-computed per benchmark in DB, or computed at request time?
4. **Framework versioning** — How many versions are retained? Is version history user-visible?
5. **Admin template configuration** — Which admin interface controls the free tier default template? Is this an existing admin screen or new?
6. **VaNi inference templates** — Where are the inference template strings stored? DB, config file, or hardcoded?

---

*Spec status: Complete — pending Claude Code review and implementation*
*Companion HTML files contain all visual references. Read spec first, then reference HTML for visual detail.*

---

## 16. Adaptive Correlation Engine

**Reference:** dristiQ-adaptive-correlation.html

### 16.1 Two-Path Rendering System

Every correlation query follows one of two paths. The user never sees which path fired — the experience is seamless either way.

```
User has 2+ overlays active on workspace
  ↓
VaNi confluence detection fires
  ↓
Is this a known combination?
  ├── YES → render pre-built view directly
  │         (MagicRS bucket / RSI zones /
  │          Breadth states / Scanner outcomes)
  └── NO  → Shape Classifier
              ↓
            Assign to Shape 1, 2, 3, or 4
              ↓
            Populate adaptive template
              ↓
            Generate VaNi inference
              ↓
            Render
```

**Known combinations** — pre-built, purpose-designed views from Section 10:
- MagicRS alone → bucket chart
- Breadth ROC alone → state quadrants
- RSI alone → zone cards
- Conviction Flow alone → outcome histogram

**Unknown combinations** — anything that does not match a pre-built view → goes through adaptive engine.

### 16.2 Shape Classifier Logic

The classifier reads the types of building blocks being combined and assigns a shape.

```typescript
function classifyShape(blockA: BuildingBlock, blockB: BuildingBlock): Shape {

  const isEventBased = (b) =>
    b.type === 'astro_rule' || b.type === 'technical_rule_event'

  const isThreshold = (b) =>
    b.type === 'indicator' && b.config.threshold !== undefined

  const isZone = (b) =>
    b.type === 'indicator' && b.config.zone !== undefined ||
    b.type === 'widget'

  const isStateBased = (b) =>
    b.type === 'widget' && b.config.states !== undefined

  // Shape 1: Both event-based
  if (isEventBased(blockA) && isEventBased(blockB))
    return 'EVENT_OVERLAP'

  // Shape 2: One event + one threshold
  if (isEventBased(blockA) && isThreshold(blockB) ||
      isEventBased(blockB) && isThreshold(blockA))
    return 'THRESHOLD_CROSS'

  // Shape 3: Both zone/continuous
  if ((isZone(blockA) || isThreshold(blockA)) &&
      (isZone(blockB) || isThreshold(blockB)))
    return 'ZONE_CONFLUENCE'

  // Shape 4: Event + state-based
  if (isEventBased(blockA) && isStateBased(blockB) ||
      isEventBased(blockB) && isStateBased(blockA))
    return 'EVENT_IN_STATE'

  // Fallback: treat as ZONE_CONFLUENCE
  return 'ZONE_CONFLUENCE'
}
```

### 16.3 Four Shape Templates

Each shape has a fixed visual template. The template is data-driven — all values come from the correlation query result, nothing is hardcoded.

---

#### Shape 1 — Event Overlap
**Condition:** Both building blocks are event/period-based.
**Examples:** Mercury Retrograde + Panchak · Panchak + Saturn Transit · Perigee + Panchak

**Query returns:**
- List of overlap instances (start_date, end_date, duration_days)
- For each instance: 5D/22D/3M Nifty return
- Overall stats: n, bearish_count, bullish_count, avg_return, avg_duration

**Visualization:**
1. Stats row — n instances, bearish/bullish split, avg return, avg overlap duration
2. Outcome distribution bar — % bearish vs bullish
3. Dual timeline — two parallel tracks showing each rule's active periods, overlap periods highlighted in purple with outcome dots
4. Instance list — each overlap with date, duration, proportional return bar, outcome badge
5. Active overlap indicator — if currently overlapping, shown as pulsing dot + "Currently overlapping · Day N"

---

#### Shape 2 — Threshold Cross
**Condition:** One event/period-based + one threshold-based indicator.
**Examples:** Mercury Retrograde + RSI > 70 · Panchak + RSI < 30 · Saturn Transit + MACD crossover

**Query returns:**
- List of instances where threshold was crossed DURING the event period
- For each instance: event details (which day of event), indicator value at cross, 5D/22D return
- Overall stats: n, bearish_count, avg_return, avg_days_to_reversal

**Visualization:**
1. Stats row — n instances, bearish split, avg return, avg days to reversal
2. Combo chart — indicator line over time with event periods shaded; gold dots at threshold crossings within event zones; current crossing in purple
3. Instance cards (2-column grid) — each crossing with: date, event context (day N of event), indicator value, return, contextual note
4. Active crossing shown as pulsing card

---

#### Shape 3 — Zone Confluence
**Condition:** Both are continuous indicators, each with zone definitions.
**Examples:** RSI > 70 + MagicRS > 60 · RSI < 30 + Breadth ROC below zero · MACD positive + MagicRS > 60

**Query returns:**
- List of periods where both zones were simultaneously true
- For each period: start_date, end_date, duration_days, 5D/22D return
- Overall stats: n, positive_rate, avg_return, avg_duration, fat_tail_indicator

**Visualization:**
1. Current state callout — are we in confluence now? If yes, show day count and both indicator values
2. Stats row — n periods, avg return, positive rate, avg duration
3. Gantt chart — horizontal bars for each confluence period, colour-coded by outcome (green/red), current period pulsing in purple
4. Return distribution histogram — spread of outcomes across all periods
5. Note: if positive_rate is near 50%, VaNi surfaces this as a volatility signal rather than directional signal

---

#### Shape 4 — Event in State
**Condition:** One event-based + one state-based indicator.
**Examples:** Sankranti + Breadth ROC state · Mercury Retrograde + RSI zone · Perigee + MagicRS bucket

**Query returns:**
- For each event instance: what state was the indicator in at firing
- For each state: n instances, avg_5D, avg_22D, positive_rate
- Current instance: what state is the indicator in right now

**Visualization:**
1. Stats row — total instances, overall avg return, overall positive rate, number of states detected
2. Event breakdown grid — all instances as small cells, colour-coded by state at firing; hover shows detail; current instance pulsing
3. Conditional return table — rows = states, columns = 5D/22D/3M; current state row highlighted
4. Contextual note — which state is best/worst; what state we're currently in
5. This shape is the most informative for understanding how market context modulates astro event outcomes

---

### 16.4 Shared Anatomy (all 4 adaptive shapes)

Every adaptive view has these elements in this exact order — consistent with known views (Section 10.1):

1. **VaNi Detection Banner** — "VaNi detected [combination]. Here's what history says."
   - Dismissable after 5 seconds (fades automatically)
   - Never shown for known combinations

2. **Combination Header**
   - Shape tag (e.g. "Event Overlap · Both rules are period-based")
   - Combination pills showing the two building blocks with operator (∩ / + / →)
   - One-line description of what the query means
   - Instance count (top right)

3. **Controls Bar** — benchmark selector + timeframe toggle + "Save this combination" CTA

4. **Data Quality Bar** — same pattern as known views; shows quality per building block + combined quality

5. **Adaptive Visualization** — unique per shape (Sections 16.3 above)

6. **VaNi Inference Card** — always right column; always same structure (orb + label + body + confidence footer)

7. **Action Island** — summarises the key finding in one line

---

### 16.5 "Save this Combination" Action

When a user saves a combination:
- Stored as a `user_combination` DB object
- Named automatically: "[BlockA] + [BlockB]" (user can rename)
- Appears in Catalog → Combinations section (coming feature)
- Next time both blocks are active simultaneously, VaNi loads the saved view directly instead of recomputing from scratch
- Saved combinations are private by default; future: option to publish to Master Frameworks

```typescript
interface UserCombination {
  id: string
  user_id: string
  name: string                  // auto-generated, user-editable
  block_a_id: string            // catalog item ID
  block_b_id: string            // catalog item ID
  shape: ShapeType              // classifier result, stored at save time
  last_result: CorrelationResult // cached last query result
  created_at: timestamp
  last_run_at: timestamp
}
```

---

### 16.6 VaNi Inference Generation for Adaptive Views

Same template-string approach as known views (Section 6.4), but with shape-specific templates.

**Shape 1 template:**
```
"[BlockA] and [BlockB] have overlapped [n] times since [start_year] —
with [bearish_n] of [n] producing [direction] outcomes on [benchmark]
over the following [timeframe].
[context_note]
[current_status]"
```

**Shape 2 template:**
```
"[indicator] crossing [threshold] during [event] has occurred [n] times
since [start_year]. In [hit_n] of those, [benchmark] [direction] within
[timeframe] — avg [direction] of [avg_return].
[mechanism_note]
[current_status]"
```

**Shape 3 template:**
```
"[BlockA] and [BlockB] both in elevated zones simultaneously — [n] periods
since [start_year]. The distribution is [balanced|skewed]: [positive_rate]
positive, [negative_rate] negative.
[volatility_note_if_balanced]
[current_status]"
```

**Shape 4 template:**
```
"[event]'s outcome is [strongly|moderately] conditioned by the [indicator]
state at the time of firing.
[best_state_note]
[current_state_note]
[interpretation]"
```

`context_note`, `mechanism_note`, `volatility_note`, `interpretation` are selected from predefined sets based on computed values (hit rate, sample size, current market context).

---

### 16.7 Minimum Instance Threshold

If a combination has fewer than 3 historical instances, the adaptive engine does not render a correlation view. Instead VaNi says:

> "Only [n] historical instances found for this combination — not enough to draw reliable conclusions. I'll watch for more data as history builds."

The combination is still saved if the user requests it, but marked as `insufficient_data: true`.

---

### 16.8 Three or More Building Blocks

The adaptive engine supports combinations of 3+ building blocks. The shape classifier runs pairwise on all combinations and selects the most informative shape:

```
BlockA + BlockB + BlockC
  → Classify (A,B), (A,C), (B,C)
  → Select shape with highest information value:
      EVENT_IN_STATE > THRESHOLD_CROSS > EVENT_OVERLAP > ZONE_CONFLUENCE
  → Run query for selected pair as primary
  → Remaining block shown as context filter
```

For 3+ blocks, VaNi notes: "Showing [BlockA] + [BlockB] as primary correlation. [BlockC] used as context filter."

---

*Section 16 added May 2026 — Adaptive Correlation Engine*
*Companion file: dristiQ-adaptive-correlation.html*
