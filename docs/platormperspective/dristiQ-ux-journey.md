# DristiQ — UX Journey
**Version:** 2.0 — Framework-First Platform
**Date:** May 2026
**Status:** For Review & Lock

---

## Product Philosophy (Locked)

DristiQ is a **living data platform** — not an opinionated signal product.
The platform continuously grows (rules, indicators, widgets, scans). The user owns a personal **Framework** — their slice of the platform, built their way.

> "The platform grows. Your framework grows. At your own pace."

**Three zones:**
| Zone | Purpose |
|------|---------|
| **Workspace** | Your framework — chart + composable blocks |
| **Catalog** | Everything available to add — rules, indicators, widgets, frameworks |
| **Views** | Dashboard, Scanner, Visual Pulse, Planetary Intel — existing surfaces |

**VaNi** is the agent connecting all three — onboards, watches, surfaces, acts.

---

## Building Blocks (Platform Layer)

| Type | Examples | Behaviour on Chart |
|------|----------|-------------------|
| **Indicators** | RSI, MACD, EMA, Bollinger | Continuous — draws as line/band |
| **Technical Rules** | Triangle breakout, Morning Star, Evening Star | Event-based — fires as flag/marker |
| **Astro Rules** | Panchak, Mercury Retrograde, Sankranti, Perigee | Period/event-based — shaded zone or marker |
| **Widgets** | MagicRS, ROC, Smart Money | Proprietary computed — panel block |
| **Scans** | Conviction Flow, Strength Confluence | Output-based — produces result set |

---

## Navigation Structure (Locked)

```
WORKSPACE          ← user's personal framework (new primary surface)

VIEW
  Dashboard
  Scanner
  Market Structure
  Planetary Intel

CATALOG            ← new top-level section
  Astro Rules
  Scanners
  Indicators
  Widgets
  Master Frameworks

ADMIN
  Markets
  Industry Transition
  Manipulation Watch
  Panchang
  Visual Pulse
  Inference DB
```

---

## UX Journey — All Stages

---

### Stage 1 — Registration & ICP Discovery

**Entry point:** User registers for the first time.
**VaNi activates immediately.** Not a form. Not a wizard. VaNi speaks.

**ICP signals VaNi captures (3 lightweight questions):**

1. **Identity** — Are you primarily an investor, a trader, or both?
   - Active Investor (weeks to months)
   - Active Trader (days to swing)
   - Both — (slider: e.g. 70% Investor / 30% Trader)

2. **Decision style** — How do you currently read the market?
   - Pure Technical
   - Astro-guided
   - Combination of both
   - Still exploring

3. **Instruments** — What do you primarily watch?
   - Nifty / BankNifty
   - Equities
   - Both

**VaNi behaviour:** Each answer is a tap — never typing. As soon as answer 3 is received, VaNi doesn't ask more. It acts.

> *"Got it. Building your starting framework."*

---

### Stage 2 — Live Framework Build (The Wow Moment)

VaNi builds the starter framework **visibly on screen** — blocks appear one by one on the workspace.

The user watches their workspace come alive. Not a loading spinner. VaNi is working.

**Build sequence (example for Hybrid / Both / Equities):**
1. Chart loads — Nifty, daily timeframe
2. EMA 20 + EMA 50 overlay appears
3. MagicRS widget block appears on right panel
4. Panchak rule overlay activates on chart — historical zones visible
5. Conviction Flow scan block appears — today's results loaded
6. Six-day Astro Outlook block appears

**After build — VaNi says:**
> *"This is your starting point. Everything here can be changed, added to, or removed. It's yours."*

**Two actions available:**
- ✓ **Start here** — accept framework, enter workspace
- ↓ **Browse Master Frameworks** — see curated templates before deciding

---

### Stage 3 — Master Frameworks (Catalog Entry)

User lands in **Catalog → Master Frameworks.**

A curated set of framework templates, each with:
- Name + tagline (e.g. "The Astro Purist — Purely planetary, no noise")
- Building blocks it contains (pills: Panchak, Mercury, Saturn Transit...)
- Gamified stats: Most Popular / Highest Correlation / Most Signals This Month
- Preview — skeleton of how workspace will look

**User can:**
- Select a template → workspace builds live (same animation as Stage 2)
- Or return to VaNi's recommended framework

**No pressure to be perfect.** Every template can be modified after.

---

### Stage 4 — The Workspace (Primary Surface)

This is where a user spends 80% of their time.

**Layout:**
```
┌─────────────────────────────────────┬──────────────────┐
│                                     │  BLOCK 1         │
│         CHART (TradingView)         │  e.g. MagicRS    │
│                                     ├──────────────────┤
│  [overlays active on chart]         │  BLOCK 2         │
│                                     │  e.g. Scan       │
├─────────────────────────────────────┤  Results         │
│  INDICATOR PANEL                    ├──────────────────┤
│  e.g. MagicRS line, ROC             │  BLOCK 3         │
│                                     │  e.g. Astro      │
│                                     │  Events Today    │
└─────────────────────────────────────┴──────────────────┘
         [ VaNi Action Island — bottom pill ]
```

**Right panel blocks are composable:**
- User can add, remove, reorder blocks
- Each block is a Catalog item plugged in
- Blocks are either **chart-linked** (click stock in scan → loads on chart) or **standalone**

**VaNi Action Island (bottom):**
- Shows VaNi's current observation in one line
- Tap to expand — VaNi explains or acts
- Never intrusive. Always present.

---

### Stage 5 — Catalog Discovery

User wants to explore and add more building blocks.

**Entry:** Left nav → Catalog → any section

**Catalog sections:**

**Astro Rules**
- 216 rules (and growing), filterable by Type / Outcome / Probability / Confidence
- Each rule has: name, conditions, historical backtesting, confidence score, signal count
- **Key action: "Add to Framework"** — rule immediately becomes available as chart overlay + block

**Indicators**
- Standard technical indicators with plain-language explanations
- Configurable parameters (e.g. RSI period)
- **Key action: "Add to Framework"**

**Widgets**
- Proprietary signals (MagicRS, ROC, Smart Money etc.)
- Explained as DristiQ IP — what they measure, why they matter
- **Key action: "Add to Framework"**

**Scanners**
- Conviction Flow, Strength Confluence, and others
- Configurable filters
- **Key action: "Add to Framework"** → becomes an output block in workspace

**Master Frameworks**
- Curated combinations — gamified
- User can adopt whole framework or cherry-pick blocks from it

---

### Stage 6 — Rule → Framework (The Checkout Moment)

This is the most critical interaction in the product. Zero friction.

**Flow:**
1. User is in Catalog → Astro Rules
2. Finds "Mercury Retrograde" — reads backtesting, builds conviction
3. Taps **"Add to Framework"**
4. Rule is immediately available in their workspace:
   - As a **chart overlay toggle** (shaded zones on price chart)
   - As a **block option** in right panel (list of upcoming Mercury events)
5. VaNi notices the addition:
   > *"Mercury Retrograde added. 23 historical instances on Nifty — want me to show them on the chart?"*
6. User taps Yes → instances highlighted on chart instantly

**No navigation required. No save button. It just works.**

---

### Stage 7 — Correlation & Discovery

User has rules overlaid on chart. VaNi acts — not waits.

**VaNi's proactive behaviour:**
- Rule activated on chart → VaNi surfaces hit rate automatically
- Two rules overlaid together → VaNi notices confluence:
  > *"Panchak + RSI overbought aligned 8 times since 2015. Nifty fell in 6 of those. Want the breakdown?"*
- User says Yes (one tap) → VaNi drops a Correlation Block onto the workspace showing the detail

**Correlation Block contains:**
- Historical instances (bar chart — same as Rule Engine deep dive)
- Hit rate, avg return, best/worst case
- Current status — is this condition active right now?

**User builds conviction through seeing, not being told.**

---

### Stage 8 — Framework Evolution (Ongoing)

The framework is never finished. It grows as the user grows.

**Ongoing behaviours:**

- **Platform adds new rules** → VaNi notifies user if a new rule matches their ICP:
  > *"New rule added to Catalog — Jupiter Direct in Taurus. Historically strong for your instrument profile. Want to explore?"*

- **User pins observations** → any VaNi insight can be saved as a note on the framework

- **Framework versioning** — user can see their framework at any point in time (what was active, what wasn't)

- **Sharing** (future) — user can publish their framework as a Master Framework for others to adopt

---

## VaNi Touchpoint Summary

| Stage | VaNi Action | Type |
|-------|------------|------|
| Onboarding | Captures ICP, builds starter framework live | Proactive / Builder |
| Workspace load | Summarises current framework state in one line | Observer |
| Rule added to framework | Surfaces historical context immediately | Reactive |
| Two rules overlap on chart | Detects confluence, offers correlation | Proactive |
| New catalog item matches ICP | Notifies user | Proactive |
| User idle on chart | Notices something in data, flags it | Proactive |
| User taps Action Island | Expands to explain current observation | On-demand |

**VaNi is never a chatbot. VaNi acts on the UI, places blocks, highlights chart zones, surfaces data — conversation is the exception, not the mode.**

---

## Screens to Build (HTML Layer)

| Screen | Priority | Notes |
|--------|----------|-------|
| Onboarding — VaNi ICP flow | P0 | 3-question sequence + build animation |
| Workspace — Framework loaded | P0 | Chart + composable right panel + VaNi island |
| Catalog — Master Frameworks | P1 | Template cards with gamified stats |
| Catalog — Astro Rules | P1 | Existing screen, add "Add to Framework" CTA |
| Correlation Block | P1 | Output of VaNi correlation discovery |
| Framework Builder — Draw Your Own | P2 | Empty canvas + Catalog drawer |

---

## What Goes to Claude Code

Once HTML is locked:

1. **Framework object** — new DB entity: user_frameworks (user_id, blocks[], layout, created_at, version)
2. **"Add to Framework" action** — universal across Catalog, triggers workspace update
3. **VaNi agent hooks** — proactive triggers: rule added, confluence detected, new catalog item
4. **Workspace composable panel** — replace fixed right panel with block system
5. **Onboarding flow** — ICP capture, template selection, live build animation
6. **Catalog nav item** — new top-level section, consolidating Rules Engine + Scanners + new sections

---

*Document status: DRAFT — pending Charan review and lock*
