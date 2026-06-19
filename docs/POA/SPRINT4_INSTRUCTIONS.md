# Sprint 4 — Workspace Shell Redesign
# Execution Instructions for Claude Code
# Read ARCHITECTURE.md before starting any step.
# Do ONE step at a time. Report back after each step before proceeding.

---

## STEP 4.1 — Migration: add `icp_mode` to `km_profiles`

### What to do
Run this migration manually on the database:

```sql
ALTER TABLE km_profiles
ADD COLUMN icp_mode TEXT NOT NULL DEFAULT 'astro'
CHECK (icp_mode IN ('astro', 'technical'));
```

### Verify
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'km_profiles' AND column_name = 'icp_mode';
```

Expected: one row returned, `data_type = 'text'`, `column_default = 'astro'`

Also verify existing users all got the default:
```sql
SELECT COUNT(*) FROM km_profiles WHERE icp_mode IS NULL;
```
Expected: 0

### Report back
Paste the output of both SELECT statements above.
Do NOT proceed to Step 4.2 until confirmed.

---

## STEP 4.2 — Update profile type + authStore

### What to do
1. Find the TypeScript type definition for `km_profiles` / `UserProfile`.
   It will be in one of: `types/`, `store/authStore.ts`, `services/auth.ts`

2. Add `icp_mode` field:
```typescript
icp_mode: 'astro' | 'technical';
```

3. In `authStore` — verify that when profile is fetched from DB,
   `icp_mode` is included in the SELECT. If the profile fetch uses
   `SELECT *` it will work automatically. If it selects specific
   columns, add `icp_mode` to the column list.

4. No other changes. Do not modify any UI yet.

### Verify
Console log `authStore.profile.icp_mode` on workspace load.
It should return `'astro'` for all existing users.

### Report back
- File paths where type was updated
- Confirm `icp_mode` appears in profile object at runtime
Do NOT proceed to Step 4.3 until confirmed.

---

## STEP 4.3 — Extract IndexDropdown to standalone component

### What to do
1. Open `WorkspaceCanvas.tsx`
2. Find the `IndexDropdown` component defined inline at lines 254–361
3. Extract it to a new file: `src/components/domain/IndexDropdown.tsx`
4. Copy the component definition exactly — NO logic changes
5. Import it back into `WorkspaceCanvas.tsx` to replace the inline definition
6. Verify workspace still works identically after extraction

### Rules
- Zero logic changes — pure file extraction
- Keep all existing props, state, and store references identical
- The component must still read from `frameworkStore.switchPrimaryIndex()`
- The component must still call `fetchActiveIndices()` from `indexPickerService.ts`

### Verify
- Open `/workspace`, confirm index dropdown still works
- Switch index, confirm chart updates
- No console errors

### Report back
- Confirm new file path: `src/components/domain/IndexDropdown.tsx`
- Confirm `WorkspaceCanvas.tsx` now imports from that file
Do NOT proceed to Step 4.4 until confirmed.

---

## STEP 4.4 — WorkspacePage shell: 3-tab structure

### What to do
This is the main structural change. Read carefully.

**In `WorkspacePage.tsx`:**

1. Add tab state at the top of the component:
```typescript
const icpMode = useAuthStore(s => s.profile?.icp_mode ?? 'astro');
const [activeTab, setActiveTab] = useState<'today' | 'discovery' | 'myspace'>(
  icpMode === 'technical' ? 'discovery' : 'today'
);
```

2. Add tab bar JSX — insert between `<header>` (topbar) and the main content area.
   The tab bar sits INSIDE WorkspacePage, NOT in Layout.tsx:

```tsx
<nav className="tab-bar">
  <button
    className={`tab ${activeTab === 'today' ? 'active' : ''}`}
    onClick={() => setActiveTab('today')}
  >
    <span className="tab-icon">◐</span>
    Today
    {icpMode === 'astro' && <span className="icp-dot" />}
  </button>
  <button
    className={`tab ${activeTab === 'discovery' ? 'active' : ''}`}
    onClick={() => setActiveTab('discovery')}
  >
    <span className="tab-icon">⊙</span>
    Discovery
  </button>
  <button
    className={`tab ${activeTab === 'myspace' ? 'active' : ''}`}
    onClick={() => setActiveTab('myspace')}
  >
    <span className="tab-icon">⊞</span>
    My Space
  </button>

  {/* Right side of tab bar */}
  <div className="tab-bar-right">
    <AtmosphericBadge />
    <span className="date-chip">{formatDate(today)}</span>
  </div>
</nav>
```

3. Wrap existing content sections in tab panels:
```tsx
{/* TODAY TAB */}
{activeTab === 'today' && (
  <div className="tab-panel" id="panel-today">
    {/* Step 4.5 will fill this */}
    <div>Today tab — coming in Step 4.5</div>
  </div>
)}

{/* DISCOVERY TAB */}
{activeTab === 'discovery' && (
  <div className="tab-panel" id="panel-discovery">
    {/* Step 4.6 will fill this */}
    <div>Discovery tab — coming in Step 4.6</div>
  </div>
)}

{/* MY SPACE TAB */}
{activeTab === 'myspace' && (
  <div className="tab-panel" id="panel-myspace">
    {/* Step 4.7 will move WorkspaceCanvas here */}
    <div>My Space tab — coming in Step 4.7</div>
  </div>
)}
```

4. Add tab bar styles using existing CSS vars:
```css
.tab-bar {
  display: flex;
  align-items: stretch;
  height: 44px;
  background: var(--card-soft);
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
  position: sticky;
  top: 48px; /* topbar height */
  z-index: 39;
}

.tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 20px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab:hover { color: var(--text-secondary); }

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
  font-weight: 500;
}

.icp-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold);
  flex-shrink: 0;
}

.tab-bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-chip {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
```

### Rules
- Do NOT modify Layout.tsx
- Do NOT move or change WorkspaceCanvas yet — that is Step 4.7
- Do NOT remove Morning Brief yet — that is Step 4.5
- The AtmosphericBadge import: find where it currently exists
  (likely on Stage 2 Leaders / ScanView) and import the same component.
  If it is not a standalone component yet, just render a placeholder
  `<div className="atmospheric-placeholder" />` for now.

### Verify
- `/workspace` loads with 3 tabs visible
- Clicking each tab switches the panel
- Astro users see gold dot on Today tab
- Technical users land on Discovery tab by default
- No console errors

### Report back
- Screenshot of tab bar rendered
- Confirm AtmosphericBadge status (imported or placeholder)
Do NOT proceed to Step 4.5 until confirmed.

---

## STEP 4.5 — Tab 1 (Today): assemble components

### What to do
Fill the Today tab panel with existing components.

**ICP-aware layout:**

```tsx
{activeTab === 'today' && (
  <div className="tab-panel today-panel">

    {/* Morning Brief — pinned strip, NOT modal */}
    <VaNiMorningBrief pinned />

    {/* Astro band — Astro ICP only */}
    {icpMode === 'astro' && <CurrentSkyRail date={today} />}

    {/* Market Pulse — always show */}
    <MarketWeatherCard date={today} />

    {/* Index Chart — always show */}
    <IndexDropdown />
    {/* TradingChart reads instrument from frameworkStore — no prop needed */}

    {/* Breadth — always show */}
    <MarketBreadthChart />
    <BreadthRocChart />

    {/* Astro detail — Astro ICP only */}
    {icpMode === 'astro' && <PanchangamCard date={today} />}
    {icpMode === 'astro' && <SixDayOutlookCompact date={today} />}
    {icpMode === 'astro' && <NakVaraSignals date={today} />}

  </div>
)}
```

**Morning Brief change:**
- `VaNiMorningBrief` currently renders as a modal trigger
- Add a `pinned` prop to `VaNiMorningBrief`:
  - When `pinned={true}` → renders as an inline strip (always visible)
  - When `pinned={false}` (default) → existing modal behavior (used in My Space / legacy)
- Do NOT remove the modal trigger from My Space yet — that is Step 4.7
- The pinned strip should show the brief content directly,
  not a "View Morning Brief" button

**`today` variable:**
```typescript
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
```

### Rules
- Import all components from their existing files — no copies
- Do not modify any of the imported components internally
- If a component needs a prop it doesn't have, add the prop with a default
  rather than modifying the component's internals
- Layout: vertical stack with consistent spacing using `var(--border)` dividers

### Verify
- Today tab shows all components
- Astro mode: all 9 components visible
- Technical mode: 5 components visible (brief, weather, chart, breadth x2)
- No console errors
- Morning Brief shows as inline strip, not modal trigger

### Report back
- Screenshot of Today tab in astro mode
- Screenshot of Today tab in technical mode
Do NOT proceed to Step 4.6 until confirmed.

---

## STEP 4.6 — Tab 2 (Discovery): SectorRotationFlow + scanner widgets

### What to do

**Part A — SectorRotationFlow drop-in:**
```tsx
{activeTab === 'discovery' && (
  <div className="tab-panel discovery-panel">

    <div className="section-label">Sector & Industry Rotation</div>
    <SectorRotationFlow />

    <div className="section-label">Scanner Widgets</div>
    {/* Part B below */}

  </div>
)}
```

**Fix BUG-01 during this step:**
In `SectorRotationFlow.tsx` StockDrawer — find where zone color is checked.
The DB stores `'Strong Bull'`, `'Strong Bear'` (Title Case).
The code checks `'strong_bull'`, `'strong_bear'` (snake_case).
Fix: normalize the comparison:
```typescript
// WRONG
if (zone === 'strong_bull')

// RIGHT
if (zone?.toLowerCase().replace(' ', '_') === 'strong_bull')
// OR normalize on read:
const normalizedZone = zone?.toLowerCase().replace(/ /g, '_');
```

**Part B — Scanner mini-widgets:**
Create new component: `src/components/domain/ScannerWidget.tsx`

```typescript
interface ScannerWidgetProps {
  presetId: string;        // e.g. 'stage_2_leaders'
  title: string;           // e.g. 'Stage 2 Leaders'
  columns: WidgetColumn[]; // which columns to show in mini-table
  maxRows?: number;        // default 4
}

interface WidgetColumn {
  key: string;             // field name from ScanStock
  label: string;           // column header
  format?: 'price' | 'pct' | 'number' | 'text';
}
```

The widget:
- Reuses existing scan hooks (e.g. `useStage2Leaders()`, `useConvictionFlow()`)
- Shows a 4-row mini-table with column headers
- Shows VaNi chip if preset has `vani_rule` set
- Shows stock count from result
- "View all →" navigates to `/scanner/:presetId`
- On row click → navigates to `/pulse/equity/:equityId`

**Default scanner widgets to show in Discovery tab:**
1. Stage 2 Leaders — columns: Symbol, Close, MRS, RS%, D%
2. Conviction Flow — columns: Symbol, Close, Surge×, 5D Avg, D%
3. VaNi Opportunity — columns: Symbol, Close, MRS, Stage, D%

### Verify
- Discovery tab shows SectorRotationFlow + 3 scanner widgets
- Zone colors correct in SectorRotationFlow (BUG-01 fixed)
- "View all →" navigates correctly to scanner
- Row click navigates to stock pulse page
- No console errors

### Report back
- Screenshot of Discovery tab
- Confirm BUG-01 fix — show before/after zone color
Do NOT proceed to Step 4.7 until confirmed.

---

## STEP 4.7 — Tab 3 (My Space): drop WorkspaceCanvas in

### What to do

1. Move the existing `WorkspaceCanvas` (and all its children) into the
   My Space tab panel:

```tsx
{activeTab === 'myspace' && (
  <div className="tab-panel myspace-panel">
    <WorkspaceCanvas
      onMorningBrief={() => setActiveTab('today')}
    />
  </div>
)}
```

2. Remove Morning Brief modal trigger from My Space:
   - The "☀ Morning Brief" button in WorkspaceCanvas topbar:
     instead of opening the modal, it now switches to Today tab
   - Pass `onMorningBrief` callback from WorkspacePage:
     `() => setActiveTab('today')`
   - Remove `VaNiMorningBrief` modal render from WorkspacePage
     (it now lives as pinned strip in Today tab only)
   - Remove `useMorningBriefAutoShow` hook call from WorkspacePage
     (auto-show behavior moves to Today tab)

3. In Today tab (Step 4.5) — add auto-show logic:
```typescript
// Auto-switch to Today tab once per day (replaces old modal auto-show)
useEffect(() => {
  const key = `vani_today_shown:${profile.id}:${today}`;
  if (!localStorage.getItem(key)) {
    setActiveTab('today');
    localStorage.setItem(key, '1');
  }
}, [profile.id, today]);
```

### Rules
- WorkspaceCanvas internal code is NOT modified
- Only the wiring (callback + modal removal) changes in WorkspacePage
- IndexDropdown extracted in Step 4.3 is already being used in WorkspaceCanvas
  — no duplicate needed

### Verify
- My Space tab shows the canvas correctly
- "☀ Morning Brief" button in canvas switches to Today tab (not modal)
- Morning Brief modal no longer appears anywhere
- Canvas drag/drop still works
- Framework saves still work
- No console errors

### Report back
- Screenshot of My Space tab with canvas
- Confirm morning brief modal is gone
Do NOT proceed to Step 4.8 until confirmed.

---

## STEP 4.8 — ProfileSetup wizard: add ICP question

### What to do
In `ProfileSetup.tsx` screen 2 (currently Investor/Trader/Both + blend slider):

1. Add a second question below the existing ICP question:
```
"Your analysis style:"
  [☽ Astro-aware]   [⊙ Technical only]
```

2. Store selection in local component state: `icpMode: 'astro' | 'technical'`
   Default: `'astro'`

3. On `applyTemplate()` (the "Start here →" button):
   - Include `icp_mode: icpMode` in the profile update call
   - This writes to `km_profiles.icp_mode`

4. Style the toggle buttons using existing CSS vars:
   - Selected: `background: var(--accent-dim); border-color: var(--accent); color: var(--accent)`
   - Unselected: `background: transparent; border-color: var(--border); color: var(--text-muted)`

### Rules
- Do not change any existing onboarding screens
- Do not change the template application logic
- Only add the new question + wire the new field

### Verify
- Create a new test account, go through onboarding
- Select "Technical only" → confirm `icp_mode = 'technical'` saved in DB
- Log in → confirm workspace lands on Discovery tab
- Select "Astro-aware" → confirm `icp_mode = 'astro'` saved in DB
- Log in → confirm workspace lands on Today tab

### Report back
- Screenshot of updated onboarding screen 2
- DB query result confirming icp_mode saved correctly:
  `SELECT email, icp_mode FROM km_profiles WHERE email = 'test@...'`
Do NOT proceed to Step 4.9 until confirmed.

---

## STEP 4.9 — Atmospheric badge on all scanners

### What to do
1. Find where `AtmosphericBadge` (or equivalent) is currently rendered
   in ScanView / Stage 2 Leaders. Get the component name and file path.

2. If it is a standalone component already:
   - Import and render it in ScanView at the top of results
     for ALL presets, not just Stage 2 Leaders

3. If it is inline JSX in Stage 2 Leaders:
   - Extract to `src/components/domain/AtmosphericBadge.tsx`
   - Import in ScanView and render for all presets

4. The badge should appear consistently:
   - In the tab bar (already added in Step 4.4)
   - At the top of every scanner result

### Verify
- Open each scanner preset
- Atmospheric badge visible on all of them
- Badge shows correct favorable/neutral/unfavorable state
- No console errors

### Report back
- Screenshot showing badge on at least 3 different scanners
- Confirm file path of AtmosphericBadge component
This is the final step of Sprint 4.

---

## STEP 4.10 — Sprint 4 QA

### What to do
Run through this checklist and report status of each item:

**Tab structure:**
- [ ] 3 tabs visible on workspace load
- [ ] Correct default tab per ICP mode
- [ ] Tab switching works without page reload
- [ ] Tab state does not persist across sessions (intentional — fresh each login)

**Today tab:**
- [ ] Morning Brief shows as pinned strip
- [ ] All astro components visible in astro mode
- [ ] Astro components hidden in technical mode
- [ ] Index dropdown works, chart updates on selection
- [ ] MarketBreadthChart and BreadthRocChart render

**Discovery tab:**
- [ ] SectorRotationFlow renders correctly
- [ ] Zone colors correct (BUG-01 fixed)
- [ ] 3 scanner widgets visible
- [ ] "View all →" navigates to correct scanner
- [ ] Row click navigates to stock pulse page

**My Space tab:**
- [ ] WorkspaceCanvas renders correctly
- [ ] Drag/drop works
- [ ] Framework saves work
- [ ] Morning Brief button switches to Today tab (not modal)

**Onboarding:**
- [ ] ICP question appears on screen 2
- [ ] Selection saves to km_profiles.icp_mode
- [ ] Correct default tab on first login

**Atmospheric badge:**
- [ ] Visible on all scanner presets
- [ ] Visible in tab bar

### Report back
Full checklist with pass/fail per item.
Any fails → fix before closing Sprint 4.
