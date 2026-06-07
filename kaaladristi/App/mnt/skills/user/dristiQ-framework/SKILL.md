---
name: dristiQ-framework
description: >
  Encodes the DristiQ Framework system — the user's personal composable workspace.
  Use this skill whenever building the user_frameworks table, the "Add to Framework"
  action, block placement routing, the composable canvas, catalog integration, or
  VaNi's proactive block placement. Triggers on: any work touching user_frameworks DB,
  framework CRUD endpoints, Add to Framework action, block types, grid layout,
  framework persistence, tier-based access to framework features, or VaNi-placed blocks.
  IMPORTANT: Nothing in this skill exists yet — this is a build spec, not existing code.
---

# DristiQ Framework System

**Status: Not yet implemented. Zero existing code.**
All dashboard state is currently ephemeral (Zustand, no persist middleware).
This skill is the complete build specification for Phase 1 + Phase 2.

---

## Core Concept

The Framework is the user's personal slice of the DristiQ platform.
It is a first-class database entity — persisted, versioned, tier-controlled.

> Dashboard = "here is the data."
> Framework = "I have laid it out for you so you understand better."

VaNi builds the first framework during onboarding. The user owns and modifies it after.

---

## Database Schema (Phase 1 — Build This First)

### user_frameworks table (create in kaala_dristi_db)

```sql
CREATE TABLE user_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Framework',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  instruments TEXT[] NOT NULL DEFAULT ARRAY['NIFTY50'],
  blocks JSONB NOT NULL DEFAULT '[]',
  chart_overlays JSONB NOT NULL DEFAULT '[]',
  template_id TEXT,
  tier_at_creation TEXT NOT NULL
);

CREATE INDEX ON user_frameworks (user_id);
```

### TypeScript Interface

```typescript
interface UserFramework {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  version: number
  instruments: string[]        // e.g. ["NIFTY50", "RELIANCE", "HDFCBANK"]
  blocks: FrameworkBlock[]
  chart_overlays: ChartOverlay[]
  template_id?: string
  tier_at_creation: TierType
}

interface FrameworkBlock {
  id: string
  type: 'indicator' | 'widget' | 'scanner' | 'astro_rule' | 'vani_correlation'
  catalog_item_id: string
  placement: 'chart_overlay' | 'panel_block' | 'output_panel'
  grid_position: GridPosition
  config: Record<string, any>
  added_by: 'user' | 'vani'   // vani-placed blocks: purple glow + "VaNi ✦" badge
  added_at: string
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

---

## Persistence Rules

- Framework auto-saves on every block add/remove/move — `version` increments each save
- Free tier: 1 framework, max 3 instruments (Nifty fixed + 2 user-selected)
- Paid/Beta tier: unlimited frameworks, unlimited instruments
- Deleting a framework requires confirmation — cannot be undone
- Framework is always preserved regardless of tier change or expiry — never delete on downgrade

---

## "Add to Framework" Universal Action

This action fires from: Catalog item card, Rule Engine row, Workspace block header,
Correlation view, Deep Dive panel.

```
User taps "Add to Framework"
  → Check tier gate (Section: Tier Gates)
  → If allowed:
      → Determine placement via Placement Routing (see below)
      → If chart_overlay: add to framework.chart_overlays[], activate on chart
      → If panel_block: add to framework.blocks[], render in right panel
      → Show success: button state → "✓ Active" (teal)
      → VaNi notices the addition (see VaNi Trigger: reactive)
  → If gated:
      → Fire Inline Gate
```

Button states: "Add to Framework" → "✓ Active" (never remove from this button — use block header for removal)

---

## Placement Routing

| Building Block Type | Placement | Chart treatment |
|---|---|---|
| Astro Rule (period-based: Panchak, Retrograde) | chart_overlay | Shaded zone |
| Astro Rule (event-based: Sankranti) | chart_overlay | Vertical marker |
| Indicator (EMA, RSI, MACD, Bollinger) | chart_overlay | Line or band |
| Widget (MagicRS, Breadth ROC, Smart Money) | panel_block | Right panel block |
| Scanner (Conviction Flow, Strength Confluence) | output_panel | Produces result set |

Overlay items also appear as badges in the chart topbar overlay strip.
Panel blocks appear in the composable right panel.
Output panels produce result sets (stock lists, sector lists).

---

## Canvas Grid System (Phase 2)

12-column × 10-row CSS Grid.

**Default VaNi Hybrid template layout:**
| Block | Grid Position |
|---|---|
| Chart | col 1–8, row 1–9 |
| MagicRS | col 9–12, row 1–3 |
| Astro Events | col 9–12, row 4–6 |
| Six-Day Outlook | col 9–12, row 7–9 |
| Conviction Flow | col 1–4, row 9–11 |
| Breadth ROC | col 5–12, row 9–11 |

Minimum block size: 2 cols × 1 row.

**Canvas Modes:**
- View Mode (default): clean, data-forward, no drag handles
- Edit Mode (activated by "Edit Canvas" button): grid lines ghost in, drag handles appear,
  resize handles appear, ✕ remove buttons appear, Add-zone placeholders appear in empty cells
- On "Done Editing": saves layout to framework, closes catalog drawer if open

---

## VaNi-Placed Blocks

Blocks placed by VaNi (not user) have:
- `added_by: 'vani'` in the FrameworkBlock object
- Purple glow border in the UI
- "VaNi ✦" badge
- User must never confuse VaNi-placed vs user-placed — visual distinction is non-negotiable

VaNi Correlation Block (auto-placed when 2+ overlays are simultaneously active + n≥3 historical instances):
- Inserted at top of right panel, above other blocks
- `type: 'vani_correlation'`
- Contains confluence rule pills, current status, stats, outcome distribution, instance rows
- Has "Dismiss" button — suppresses same confluence for 24hrs (stored in `vani_suppressions` table)

---

## Tier Gates

| Tier | Framework access |
|---|---|
| Free | 1 framework, 3 instruments max (Nifty + 2), 1 admin template, cannot add rules/widgets |
| Trial | Full access for 3 days |
| Quarterly | Full access |
| Annual | Full access + extras |
| Beta | Same as Annual — `tier = 'beta'` treated as `'annual'` in all gate checks |

**Actions gated on free tier:**
- Adding more than 2 instruments
- Adding any rule/widget/scanner to framework
- Opening any correlation view
- Accessing full backtesting history (>1 year)
- Opening framework builder

**Actions always free (never gated):**
- Browsing Catalog (view only)
- Viewing Workspace with default template
- VaNi onboarding flow
- Instrument selector (up to 2)
- Pricing page

**Inline Gate behaviour:**
- Blurs workspace behind it (backdrop-filter: blur 8px + dark overlay)
- Spring animation slide-in from center
- Always has "Continue on free tier" dismiss option — never a hard block
- VaNi copy is contextual to what was attempted (not generic "upgrade now")
- Framework is always preserved on tier expiry — never lost

---

## Onboarding → Framework Build Sequence

VaNi asks one question: "How do you participate in markets?"
Options: Investor / Trader / Both (blend slider)

Template mapping:
| Answer | Starter Template |
|---|---|
| Investor | Six-Day Outlook + MagicRS + Panchak + Conviction Flow |
| Trader | EMA 20/50 + RSI + Breadth ROC + Conviction Flow |
| Both (70/30+) | Full Hybrid — all 6 blocks |
| Both (50/50) | Balanced — 3 astro + 3 technical |

Build animation: each block appears at 350ms intervals.
After all blocks: "Your framework is ready. Everything here can be changed."
Two actions: "Start here →" (accepts) or "Browse Master Frameworks" (goes to Catalog).

---

## State Persistence (target state)

| State | Persists | Where |
|---|---|---|
| Framework (blocks, layout, instruments) | Across sessions | DB: user_frameworks |
| VaNi dismissed correlations | 24 hours | DB: vani_suppressions (to be created) |
| Saved observations | Permanently | DB: user_observations (to be created) |
| Chart timeframe selection | Session only | Local state |
| Active benchmark in correlation view | Session only | Local state |

**Current state (before Phase 1 is built):**
Everything is ephemeral. Only Supabase auth survives reload.
`appStore.ts` and `vaniStore.ts` are Zustand without persist middleware.

---

## Implementation Order (strictly follow this)

**Phase 1 — Foundation:**
1. `user_frameworks` table + migration
2. Framework CRUD endpoints in `pipeline2_api.py`
3. "Add to Framework" universal action + placement routing
4. Catalog nav restructure (add Catalog section, move Rule Engine to Astro Rules)
5. Free tier gate logic
6. Beta user tier check

**Phase 2 — Canvas:**
1. Composable workspace grid (CSS Grid 12×10)
2. Edit mode toggle + visual transformation
3. Block drag + resize (grid-snapping)
4. Chart overlay toggle from topbar strip

**Phase 3 — VaNi Intelligence:**
1. Confluence detection (2+ overlays active simultaneously)
2. VaNi Correlation Block drop onto canvas
3. Proactive Action Island observations
4. Chart historical instance markers

**Phase 4 — Correlation Views:**
(See dristiQ-correlation skill)

---

## Key Implementation Rules

- **Framework first.** Every Catalog item's "active" state derives from the framework,
  never from a local flag or localStorage. If a block is in `framework.blocks[]`, it's active.
- **VaNi never blocks.** Every VaNi action is dismissable. Every gate has "Continue on free."
- **No localStorage.** All persistence goes to DB via PostgREST or pipeline API.
- **Combinations section exists as nav container now.** Show "Coming Soon" state.
  Do not build the feature yet.
