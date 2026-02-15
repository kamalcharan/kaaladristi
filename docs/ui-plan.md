# KaalaDrishti UI Plan

## Current State

### What's DONE and working
| View / Component | Status | Data Source |
|---|---|---|
| **Landing Page** | Complete | Hardcoded (risk preview = 68) |
| **Auth Flow** | Complete | Supabase Auth |
| **Profile Setup** | Complete | Supabase `km_profiles` |
| **Dashboard** | Complete | `VITE_DATA_MODE=snapshot` → Edge `/snapshot` |
| **Markets (EOD Charts)** | Complete | Edge `/eod-chart` or direct Supabase |
| **Settings (Sector Lords)** | Complete | Supabase master tables |
| **Sidebar + Layout** | Complete | Zustand stores |
| **Symbol Switcher** | Complete | 4 symbols (NIFTY, BANKNIFTY, NIFTYIT, NIFTYFMCG) |
| **UI Kit** | Complete | Card, Badge, Button, Progress, Skeleton |
| **Domain Components** | Complete | RiskGauge, FactorCard, RegimeBadge, MiniBarChart, IndexPriceChart |

### What's STUB / PLACEHOLDER
| View | Current State |
|---|---|
| **Calendar** | "Coming Soon" card |
| **Transmission** | "Coming Soon" card |
| **Backtest** | "Coming Soon" card |

### Data Available in Supabase NOW
| Table | Rows | Symbols |
|---|---|---|
| `km_daily_snapshots` | ~13,152 | 4 symbols, 2007-2026 |
| `km_risk_scores` | ~13,152 | 4 symbols, 2007-2026 |
| `km_index_eod` | ~30,000+ | 93 indices, 1996-2026 |
| Master tables (planets, nakshatras, etc.) | Seeded | All reference data |

### Architecture Already Built
- **Edge Functions**: `/snapshot`, `/calendar`, `/eod-chart`, `/proofs` (deployed)
- **Hooks**: `useSnapshot()`, `useCalendarMonth()`, `useSnapshotAsDayRisk()`, etc.
- **Data Mode**: `VITE_DATA_MODE=snapshot` is active (real data flowing)

---

## Phase 1: Dashboard Enhancements (Priority: HIGH)

The Dashboard works but only shows risk gauge + factor cards + week outlook + sector bars + historical proofs. It needs the Panchang strip, planetary events, signal panel, and date navigation to be truly useful.

### 1.1 Date Navigation
- **Location**: Dashboard header, next to SymbolSwitcher
- **Controls**: `<` Previous day | Date picker (calendar dropdown) | Next day `>`
- **Behavior**: Updates `appStore.selectedDate`, triggers snapshot refetch
- **Constraint**: Only allow dates with snapshots (2007-09-17 to 2026-02-21)
- **URL sync**: `/dashboard?date=2026-02-15&symbol=NIFTY` (shareable deep links)
- **Default**: Most recent available date
- **Files to modify**: `Layout.tsx` (header), `appStore.ts` (date state), `DashboardPage.tsx`

### 1.2 Panchang Summary Strip
- **Location**: Top of Dashboard, below header
- **Layout**: Horizontal row of 7 compact glass cells
- **Content** (all from `snapshot.panchang`):
  ```
  | Tithi        | Nakshatra  | Yoga       | Vara      | DLNL    | Sunrise | Sankranti |
  | Shukla       | Rohini     | Siddha     | Guru-var  | Match   | 06:42   | --        |
  | Dashami      | (Moon)     | (Auspicious)| Thursday |         |         |           |
  ```
- **Styling**: Glass card, JetBrains Mono for values, muted text for labels
- **DLNL highlight**: When `dlnl_match=true`, cell glows gold with pulse animation
- **Tooltip**: Each cell explains the panchang element on hover
- **Data**: `usePanchangFromSnapshot(date, symbol)` -- ZERO extra fetch
- **New component**: `components/domain/PanchangStrip.tsx`

### 1.3 Active Planetary Events Banner
- **Location**: Below Panchang strip (conditional -- only when events exist)
- **Content** (from `snapshot.events` + `snapshot.aspects`):
  ```
  Mercury Retrograde (Day 12 of 21) | Mars-Saturn square (exact today) | Moon entering Gandanta
  ```
- **Styling**: Amber/red border based on max severity
- **Auto-hide**: When no notable events, banner is not rendered
- **Data**: `useEventsFromSnapshot()` + `useAspectsFromSnapshot()` -- ZERO extra fetch
- **New component**: `components/domain/EventsBanner.tsx`

### 1.4 Signal Intelligence Panel
- **Location**: Below the 4 factor cards
- **Layout**: Two-column card
- **Left**: Net Signal Meter (horizontal gauge from -5 to +5)
  - Shows `snapshot.signals.net_score` and `classification`
  - Color: green for bullish, red for bearish, gray for neutral
- **Right**: Fired Rules List
  - Each rule: arrow icon (up=bullish/down=bearish) + name + strength badge
  - From `snapshot.signals.rules[]`
  - Show `fired_count` of `total_rules`
- **Data**: `useSignalsFromSnapshot()` -- ZERO extra fetch
- **New component**: `components/domain/SignalPanel.tsx`

### 1.5 Enhanced Dashboard Layout (Desktop 2-Column)
Current layout is single-column stacked. Reorganize for information density:
```
+----------------------------------------------------------+
| [Symbol Switcher]                    [Date Navigation]    |
+----------------------------------------------------------+
| [Panchang Strip -- full width]                            |
+----------------------------------------------------------+
| [Planetary Events Banner -- conditional, full width]      |
+----------------------------+-----------------------------+
| Risk Gauge (Hero)          | AI Explanation               |
| Score: 67                  | "Elevated risk due to..."    |
| Regime: Distribution       |                              |
|                            | [Signal Intelligence Panel]  |
| [4 Factor Mini-Gauges]     | Net: +2.4 Bullish            |
| STR:18 MOM:15 VOL:20 DEC:14| 5 rules fired               |
+----------------------------+-----------------------------+
| [7-Day Outlook]              [Sector Heatmap]             |
+----------------------------------------------------------+
| [Historical Proof Cards -- scrollable]                    |
+----------------------------------------------------------+
```
- **Responsive**: Collapses to single column on mobile (<768px)
- **Files**: Refactor `DashboardView.tsx` layout with CSS Grid

### 1.6 Enhanced Sector Sensitivity
- **Current**: Horizontal progress bars
- **Enhanced**: Grid layout (4 cols), each cell = sector name + bar + direction arrow
- **Sort**: By impact magnitude (strongest first)
- **Color intensity**: Proportional to `volatility_multiplier`
- **Tooltip**: Explain sector-planet relationship
- **Data**: `useSectorsFromSnapshot()` -- already available

---

## Phase 2: Calendar View (Priority: HIGH)

Replace the "Coming Soon" stub with a full monthly risk calendar.

### 2.1 Monthly Grid
- **File**: Replace `CalendarView.tsx` stub
- **Layout**: 7-column grid (Mon-Sun), 4-6 rows for the month
- **Data**: `useCalendarMonth(year, month, symbol)` via Edge `/calendar`
- **Navigation**: `<` Prev month | Month/Year display | Next month `>`
- **Prefetch**: When navigating, prefetch prev+next month in background

### 2.2 Day Cell Design
Each calendar cell contains:
- **Date number** (top-left)
- **Risk score dot** (color-coded green/amber/red, size proportional)
- **Moon nakshatra** (abbreviated, bottom)
- **Event icons** (conditional):
  - Retrograde indicator
  - DLNL match star
  - Sankranti marker
- **Non-trading days**: Dimmed background, no risk dot
- **Cell background**: Very subtle tint based on risk score

### 2.3 Day Detail Panel
- **Trigger**: Click any calendar day
- **Type**: Slide-out panel (right side) or modal
- **Content**:
  - Date + risk score + regime badge
  - Mini risk gauge
  - Full panchang (tithi, nakshatra, yoga, vara, DLNL, sunrise)
  - Active events (retrogrades, aspects)
  - "View Full Dashboard" link (navigates to Dashboard with that date)
- **Data**: Individual day data from the calendar month response

### 2.4 Risk Heatmap Toggle
- **Button**: "Heatmap" toggle in calendar header
- **Effect**: Cell backgrounds become solid color intensity = risk score
- **Legend**: Color bar at bottom (0 green -> 50 amber -> 100 red)
- **Purpose**: Spot high-risk clusters at a glance

### 2.5 Week View Toggle
- **Alternative**: Show only 1 week (7 columns, 1 row)
- **More space per day**: Show full panchang + planet positions + fired rules
- **Use case**: Sunday evening week-ahead planning

---

## Phase 3: Markets View Enhancements (Priority: MEDIUM)

The Markets view works with price charts. Add planetary overlays.

### 3.1 Risk Score Overlay
- **Secondary Y-axis** (right side) on the existing area chart
- **Line**: Risk score as stepped/smooth line behind price area
- **Color**: Line color changes with risk level (green/amber/red segments)
- **Toggle**: Checkbox "Show Risk Score" (off by default)
- **Data**: Fetch risk scores for the displayed date range from snapshots

### 3.2 Event Markers on Chart
- **Vertical bands**: Mercury Retrograde periods (subtle red tint)
- **Vertical dashed lines**: Mars-Saturn aspects at exact date
- **Small markers**: Gandanta days, Sankranti dates
- **Legend**: Toggle each event type on/off independently
- **Tooltip**: Hover marker to see event details

### 3.3 Regime Background Shading
- **Behind price area**: Subtle background tint per regime
  - Accumulation = faint green
  - Expansion = faint amber
  - Distribution = darker amber
  - Capital Protection = faint red
- **Toggle**: "Show Regime Bands" checkbox
- **Purpose**: See which market periods coincided with which risk regimes

### 3.4 Multi-Index Comparison
- **Toggle**: "Compare Indices" mode
- **When active**: Show 2-4 indices normalized to 100 at start
- **Purpose**: See divergence between indices during high-risk periods
- **Constraint**: Max 4 lines (NIFTY, BANKNIFTY, NIFTYIT, NIFTYFMCG)

### 3.5 Enhanced Stats Panel
Add to existing stats bar:
- Average risk score for displayed period
- Count of Capital Protection days
- Regime distribution pie chart for the period

---

## Phase 4: Transmission View (Priority: MEDIUM)

Replace the "Coming Soon" stub with the risk transmission flow visualization.

### 4.1 Three-Column Flow Layout
```
FACTORS (Left)           SECTORS (Middle)         INDEX (Right)
+---------------+        +-----------+
| Mercury Retro | -----> | Banking   | ---+
| +8pts         |        | 1.3x vol  |    |
+---------------+        +-----------+    |    +------------------+
                                          +--> | NIFTY 50         |
+---------------+        +-----------+    |    | Score: 67        |
| Mars-Saturn   | -----> | IT        | ---+    | Regime: Distrib. |
| +10pts        |        | 1.5x vol  |    |    +------------------+
+---------------+        +-----------+    |
                                          |
+---------------+        +-----------+    |
| Moon Gandanta | -----> | Pharma    | ---+
| +6pts         |        | 0.8x vol  |
+---------------+        +-----------+
```

### 4.2 Factor Nodes (Left)
- **Data**: `snapshot.risk` (factor breakdown) + `snapshot.events` + `snapshot.aspects`
- **Show**: Planet icon, factor name, point contribution, risk dimension
- **Only active factors**: Hide factors contributing 0 points

### 4.3 Sector Nodes (Middle)
- **Data**: `snapshot.sectors` + `km_sector_lords` (master, cached)
- **Show**: Sector name, volatility multiplier, ruling planet(s), direction

### 4.4 Connection Lines (SVG)
- **Thickness**: Proportional to impact magnitude
- **Color**: Risk color (green/amber/red)
- **Hover**: Highlight connected nodes
- **Animation**: Gentle pulse showing flow direction

### 4.5 Index Impact (Right)
- **Show**: Summary risk gauge + regime badge + score breakdown
- **Data**: `snapshot.risk` + `snapshot.market`

---

## Phase 5: Backtest View (Priority: MEDIUM)

Replace the "Coming Soon" stub with historical accuracy validation.

### 5.1 Accuracy Dashboard (Top Cards)
```
| Overall Accuracy | Cap.Protect Hit Rate | Crash Detection | Active Rules |
| 54.2%            | 73%                  | 8/11            | 24 of 36     |
```
- **Data**: Computed from `/proofs` endpoint aggregations

### 5.2 Regime Performance Table
```
REGIME              | DAYS  | AVG RETURN | DOWN%  | WORST DAY
Accumulation        | 2,847 | +0.05%     | 46.8%  | -3.1%
Expansion           | 1,523 | +0.02%     | 49.1%  | -4.2%
Distribution        | 1,089 | -0.03%     | 53.4%  | -5.8%
Capital Protection  |   312 | -0.08%     | 58.0%  | -12.1%
```
- **Visual**: Colored rows matching regime colors
- **Validation**: Down% should increase monotonically (proves model works)

### 5.3 Score vs Return Scatter Plot
- **X-axis**: Risk Score (0-100)
- **Y-axis**: Actual return (%)
- **Points**: Color-coded by risk level
- **Trend line**: Negative correlation overlay
- **Time filter**: Filter by year range
- **Data**: Join `km_risk_scores` + `km_index_eod`

### 5.4 Notable Events Timeline
- Horizontal timeline with markers for major crashes
- Each marker: date, event name, risk score, hit/miss
- Purpose: "Did the model see it coming?"

### 5.5 Rolling Accuracy Chart
- **Line chart**: Monthly rolling 90-day accuracy window
- **Baseline**: 50% line (random guessing)
- **Purpose**: Show accuracy consistency over time

---

## Phase 6: Settings Enhancements (Priority: LOW)

### 6.1 Master Data Tabs
Add tabs to Settings for browsing reference data:
- **Planets**: 9 planets with attributes, lordships
- **Nakshatras**: 27 nakshatras with lords, nature, pada info
- **Zodiac Signs**: 12 signs with lords, elements
- **Rules**: Read-only view of active rules for non-admins

### 6.2 Admin Routes (admin only)
- `/admin/rules` -- Rule explorer (toggle active/inactive, view fire history)
- `/admin/discoveries` -- Candidate rules review queue (promote/reject)
- `/admin/health` -- Pipeline status, data freshness, row counts

---

## Phase 7: Polish & UX (Priority: LOW, do incrementally)

### 7.1 Morning Briefing Modal
- Shows on first visit of the day
- Quick summary: risk score, signal, active events
- "View Dashboard" or "Dismiss" actions
- Dismissed state stored in `localStorage`

### 7.2 Risk Alert Badges
- Red dot on sidebar "Dashboard" when risk > 70
- Browser tab title: "KD: 71 - Capital Protection"
- Dynamic favicon (green/amber/red dot)

### 7.3 Keyboard Navigation
- Arrow keys: navigate dates on Dashboard
- `/`: Focus symbol switcher
- `Escape`: Close modals
- `1-6`: Quick nav to views

### 7.4 Performance
- `React.lazy()` for Calendar, Transmission, Backtest views
- Virtualization for lists > 100 items
- Bundle analysis with `vite-plugin-visualizer`

### 7.5 Accessibility
- ARIA labels on all interactive elements
- Color contrast WCAG AA compliance
- Screen reader summaries for charts
- `prefers-reduced-motion` respect

### 7.6 Responsive Breakpoints
- Mobile (<640px): Single column, bottom nav
- Tablet (640-1024px): Collapsed sidebar (icons), 1-2 col
- Desktop (1024-1440px): Full sidebar + 2-col dashboard
- Wide (>1440px): Max-width container

---

## Implementation Order (Recommended)

| Step | Phase | Scope | Why First |
|---|---|---|---|
| 1 | 1.1 | Date Navigation | Unlocks historical browsing of 18 years of data |
| 2 | 1.2 | Panchang Strip | Core differentiator, data already in snapshot |
| 3 | 1.3 | Events Banner | High-value info, data in snapshot |
| 4 | 1.4 | Signal Panel | Completes the intelligence picture |
| 5 | 1.5 | Dashboard 2-col Layout | Information density improvement |
| 6 | 2.1-2.5 | Calendar View (full) | Second most-used view after Dashboard |
| 7 | 3.1-3.3 | Markets Overlays | Risk + regime overlays on price charts |
| 8 | 4.1-4.5 | Transmission View | Explainability layer |
| 9 | 5.1-5.5 | Backtest View | Trust-building through transparency |
| 10 | 6-7 | Settings + Polish | Nice-to-have refinements |

---

## New Files to Create

| File | Purpose |
|---|---|
| `components/domain/PanchangStrip.tsx` | Horizontal panchang data strip |
| `components/domain/EventsBanner.tsx` | Active planetary events banner |
| `components/domain/SignalPanel.tsx` | Net signal meter + fired rules list |
| `components/domain/DatePicker.tsx` | Date navigation with prev/next arrows |
| `components/domain/CalendarGrid.tsx` | Monthly calendar grid component |
| `components/domain/CalendarDayCell.tsx` | Individual calendar day cell |
| `components/domain/DayDetailPanel.tsx` | Slide-out panel for calendar day detail |
| `components/domain/TransmissionFlow.tsx` | Three-column flow diagram |
| `components/domain/FactorNode.tsx` | Factor node in transmission view |
| `components/domain/SectorNode.tsx` | Sector node in transmission view |
| `components/domain/FlowConnection.tsx` | SVG connection lines |
| `components/domain/AccuracyCard.tsx` | Backtest accuracy metric card |
| `components/domain/RegimeTable.tsx` | Regime performance data table |
| `components/domain/ScatterPlot.tsx` | Score vs return scatter chart |

## Files to Modify

| File | Changes |
|---|---|
| `views/DashboardView.tsx` | Add PanchangStrip, EventsBanner, SignalPanel; refactor to 2-col grid |
| `views/DashboardPage.tsx` | Add date navigation; wire URL params |
| `views/CalendarView.tsx` | Replace stub with full calendar implementation |
| `views/TransmissionView.tsx` | Replace stub with flow visualization |
| `views/BacktestView.tsx` | Replace stub with accuracy dashboard |
| `views/SettingsView.tsx` | Add master data tabs |
| `domain/Layout.tsx` | Add DatePicker to header |
| `stores/appStore.ts` | Add date validation logic |
| `App.tsx` | Add admin routes |

---

## Design Tokens (Already Established)

```
Background:     #030712
Card Surface:   rgba(255,255,255,0.03)
Borders:        rgba(255,255,255,0.06)
Accent Indigo:  #6366f1
Accent Violet:  #8b5cf6
Risk Green:     #10b981 (score <= 40)
Risk Amber:     #f59e0b (score 41-70)
Risk Red:       #ef4444 (score > 70)
Text Primary:   rgba(255,255,255,0.95)
Text Secondary: rgba(255,255,255,0.60)
Fonts:          Inter (body), Playfair Display (titles), JetBrains Mono (data)
```

## Scale Budget (per page load, 2000 users)

| Page | Edge Calls | Cache | Target Load |
|---|---|---|---|
| Dashboard | 1 (`/snapshot`) | 5 min | <1s |
| Calendar | 1 (`/calendar`) | 30 min | <1.5s |
| Markets | 1 (`/eod-chart`) | 10 min | <2s |
| Backtest | 1 (`/proofs`) | 60 min | <2s |
| Transmission | 0 (reuses snapshot) | -- | <0.5s |
