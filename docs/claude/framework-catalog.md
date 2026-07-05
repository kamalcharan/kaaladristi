# Framework & Catalog System — Full Reference

> Moved verbatim from CLAUDE.md (kept lean). The always-apply rules (constants-first, active-state, legacy column aliases) remain in CLAUDE.md.

## Framework System
The Framework is the user-configurable layer that lets traders build their own view of the market by adding indicators, widgets, scanners, and astro overlays.

### Key Files

| File | Purpose |
|---|---|
| `App/frontend/src/constants/frameworkConstants.ts` | Single source of truth for all enum-like types — `BlockType`, `PlacementType`, `ChartOverlayType`, `DataSourceType`, `TierType`, etc. |
| `App/frontend/src/constants/catalogItems.ts` | Static registry of all known indicators and widgets (`CATALOG_ITEMS`, `CATALOG_MAP`, helpers) |
| `App/frontend/src/constants/frameworkTemplates.ts` | 4 ICP starter templates (investor, trader, hybrid_weighted, hybrid_balanced) + `getTemplateForICP()` selector |
| `App/frontend/src/types/framework.ts` | TypeScript interfaces: `UserFramework`, `FrameworkBlock`, `ChartOverlay`, `GridPosition`, `PartialFramework` |
| `App/frontend/src/stores/frameworkStore.ts` | Zustand store — all framework state and mutations; `applyTemplate()` action wholesale-replaces blocks/overlays with VaNi attribution |
| `App/frontend/src/hooks/useAddToFramework.ts` | Public hook for adding items — handles tier gate and placement routing |
| `App/frontend/src/views/WorkspacePage.tsx` | `/workspace` route — framework loader, overlay pill strip, page header, mounts WorkspaceCanvas |
| `App/frontend/src/components/domain/Workspace/WorkspaceCanvas.tsx` | 12×10 CSS grid canvas, DnD drag-to-reposition (dnd-kit), edit mode with grid overlay + add-zone placeholders |
| `App/frontend/src/components/domain/Workspace/WorkspaceBlock.tsx` | Individual block card — grid-positioned, VaNi glow, drag handle (edit mode), right-click context menu |
| `App/backend/lib/auth.py` | `get_current_user_id()` FastAPI dependency — verifies HS256 JWT, returns `sub` as UUID string |

### Database

**`user_frameworks`** table — migration 088, `kaala_dristi_db`.
Schema: `id` (UUID PK), `user_id` (UUID), `name`, `version` (server-incremented), `instruments` (TEXT[]), `blocks` (JSONB), `chart_overlays` (JSONB), `template_id`, `tier_at_creation`.
RLS enabled — users can only read/write their own row.

API endpoints (all JWT-protected, caller_id must match path user_id):
- `GET  /api/framework/{user_id}` — fetch or auto-create default
- `POST /api/framework/{user_id}` — explicit create
- `PUT  /api/framework/{user_id}` — update; server controls `version` and `updated_at`

### VaNi Onboarding (ProfileSetup.tsx)

`views/ProfileSetup.tsx` is a 4-screen state machine (`Step = 1 | 2 | 3 | 4`):

| Screen | Content | Tier gate |
|---|---|---|
| 1 | Morphing VaNi orb, name/phone pre-fill from `authStore.profile` | All users |
| 2 | ICP question (Investor / Trader / Both + blend slider) | All users |
| 3 | Block-by-block animation showing selected template, VaNi narration log | All users |
| 4 | Equity selector — live query `km_equity_symbols` mcap_cr DESC, pick 2 | Free tier only; paid/beta go straight to `/workspace` |

**Template selection** (`getTemplateForICP`): investor → INVESTOR, trader → TRADER, both + blend ≥ 70 → HYBRID_WEIGHTED, both + blend < 70 → HYBRID_BALANCED.

**"Start here →"** calls `applyTemplate()` → `updateProfile({onboarded:true})` → free users go to Screen 4, paid/beta go to `/workspace`.

### ICP Templates (frameworkTemplates.ts)

| Template | Blocks | Chart overlays |
|---|---|---|
| INVESTOR | Market Breadth, Astro Calendar, MagicRS Index, Astro Panchak | EMA 20, Panchak (astro_zone) |
| TRADER | Conviction Flow, RSI 14, Breadth ROC, MagicRS Index | EMA 20, SMA 50 |
| HYBRID_WEIGHTED | Conviction Flow, Market Breadth, Astro Calendar, MagicRS Index, Breadth ROC | EMA 20, Panchak (astro_zone) |
| HYBRID_BALANCED | Market Breadth, Conviction Flow, Breadth ROC, MagicRS Index, Astro Calendar, Astro Panchak | EMA 20, SMA 50, Panchak (astro_zone) |

All blocks have `added_by: 'vani'` — rendered with purple glow + "VaNi ✦" badge in WorkspaceBlock.

### Workspace Canvas

- **Grid**: 12 columns × 10 rows, `CELL_HEIGHT_REM = 6`
- **Drag**: `@dnd-kit/core` `PointerSensor` (activationConstraint: distance 8). `useDraggable` lives inside `WorkspaceBlock` — `setNodeRef` on block outer div, `listeners + attributes` on drag handle only. Never wrap blocks in a `display:contents` container (breaks dnd-kit bounding box).
- **Edit mode**: shows GridOverlay + AddZone placeholders; "Done Editing" calls `saveFramework()`
- **Overlay strip**: horizontal scrolling pills above canvas; `toggleOverlayVisibility(catalogItemId)` from `useFrameworkStore()` on click

### Constants-First Rule

**Never define block types, placement types, tier types, or data source types inline in components.** Always import from `frameworkConstants.ts`. Adding a new type means editing that file only — all consuming code picks it up automatically.

```typescript
// WRONG — inline string literal
if (item.placement === 'chart_overlay') { ... }

// RIGHT — always import the constant
import { PLACEMENT_TYPES } from '@/constants/frameworkConstants'
```

### Active State Rule

**`isBlockActive(catalogItemId)` and `isOverlayActive(catalogItemId)` from `useFrameworkStore` are the single source of truth for whether an item is active in the framework.** No component, hook, or service should independently derive this from `blocks[]` or `chart_overlays[]` — always call these two functions.

### Adding a New Catalog Item

1. Add the `CatalogItem` entry to `CATALOG_ITEMS` in `catalogItems.ts`
2. Use only canonical column names — never legacy aliases (see below)
3. Set `applicable_to`, `tier_required`, `placement`, and `overlay_type` correctly
4. Astro rules are **not** in `catalogItems.ts` — they come from `km_astro_rule_master` dynamically

### Legacy Column Aliases — Never Use in New Code

`km_index_eod` contains old column names from early migrations. These are duplicates of the canonical columns and must never be referenced in new frontend or backend code:

| Legacy alias | Canonical column |
|---|---|
| `magicrs_value` | `magic_rs` |
| `magicma_value` | `magic_ma` |
| `sniper_banker` | `sniper_inst` |
| `sniper_hotmoney` | `sniper_hot` |
| `accum_dist` | `accum_distrib` |
| `vacuum_status` | `vacuum_flag` |
| `flow_meaning` | `flow_type` |

---

## Catalog System
### Route & Entry Point

`/catalog` → `src/views/CatalogPage.tsx` — 5-tab subnav (left 200px) + right content area + fixed-position overlays.

```
CatalogPage
├── subnav tabs (Master Frameworks / Astro Rules / Indicators / Widgets / Scanners)
├── content area  → mounts active section component
├── DeepDivePanel (position: fixed, z-index 300) — slides in on row/card click
└── CatalogActionIsland (position: fixed, z-index 150) — floating pill, appears when framework non-empty
```

### Section Components & Data Sources

| Tab | Component | Data source |
|---|---|---|
| Master Frameworks | `MasterFrameworksSection` | `FRAMEWORK_TEMPLATES` static constant |
| Astro Rules | `CatalogAstroSection` | `ruleService.ts` — `fetchRules()` + `fetchConfidence()`, React Query keys `['rule-engine','rules']` and `['rule-engine','confidence']` |
| Indicators | `IndicatorsSection` | `getCatalogItemsByType('indicator')` from `catalogItems.ts` |
| Widgets | `WidgetsSection` | `getCatalogItemsByType('widget')` + `getCatalogItemsByType('scanner')` from `catalogItems.ts`; live previews via `useNiftyPulse()` |
| Scanners | `ScannersSection` | `SCAN_PRESETS` from `scanEngine.ts`; card click navigates to `/scanner/:id` |

### Shared Data Layer — Astro Rules

`CatalogAstroSection` and the Rules Engine page (`/rules` → `RuleList.tsx`) share the same React Query cache:

```typescript
// Same keys in both components — only one network request ever made
queryKey: ['rule-engine', 'rules']      // fetchRules() from ruleService.ts
queryKey: ['rule-engine', 'confidence'] // fetchConfidence() from ruleService.ts
```

Both `fetchRules` and `fetchConfidence` live in `src/pages/RuleEngine/ruleService.ts`. `RuleList.tsx` exports `OutcomeBadge`, `TypeChip`, `ConfidenceCell`, `RULE_TYPE_LABELS`, `PROB_STYLES` for reuse in `CatalogAstroSection`.

### Astro Rule → Framework ID Convention

Astro rules are not in `catalogItems.ts`. When added to the framework they are stored as synthetic `CatalogItem` entries with a compound ID:

```typescript
id: `astro_rule:${rule.rule_code}`   // e.g. "astro_rule:SP-TAU-VEN-BUL"
```

- `isBlockActive` / `isOverlayActive` in `frameworkStore` use this full compound ID as the lookup key.
- Range rule types (`planet_transit`, `planet_state`, `planet_conjunction`, `vedh`, `planet_manifestation`) → `placement: 'chart_overlay'`, `overlay_type: 'astro_zone'`.
- Point rule types (`nakshatra_vara`, `tithi_alone`, `eclipse`, `compound`) → `placement: 'panel_block'`.
- `RANGE_RULE_TYPES` and `POINT_RULE_TYPES` are the canonical constants in `frameworkConstants.ts`.
- **`compound` routing is explicit, not generic**: only `PNK*` compound rules get overlay treatment (date-range zones). All other compound rules (BAY-*, SEA-*, HEM-*, VOL-*) are panel blocks. To add a future compound group as overlay, add it explicitly: `rule.rule_code.startsWith('PNK') || rule.rule_code.startsWith('XXX')` — do NOT make the check generic.

### DeepDivePanel

`src/components/domain/Catalog/DeepDivePanel.tsx` — fixed slide-in from the right (width 380px, z-index 300). Two modes driven by `DeepDiveItem` union type:

**Mode A — Astro Rule** (`mode: 'astro_rule'`):
- Fetches `km_rule_confidence` and `km_rule_confidence_yearly` for the rule's DB `id`
- Shows: remarks, conditions tags, placement note, backtesting stats grid, yearly win-rate bar chart
- Secondary CTA: **"Full Analysis →"** — navigates to `/rules/${item.id}` and closes panel
- Primary CTA: **"+ Add to Framework"** / **"✓ In Framework"** in the footer

**Mode B — Catalog Item** (`mode: 'catalog_item'`):
- Static metadata only: description, block_type, placement, applicable_to, tier, DB column
- Primary CTA: **"+ Add to Framework"** / **"✓ In Framework"** / **"🔒 Paid tier required"**

### CatalogDrawer

`src/components/domain/Catalog/CatalogDrawer.tsx` — slides in from the right (width 440px, z-index 200), launched from the Workspace (below DeepDivePanel's z-index 300).

Three tabs: **Indicators | Widgets | Astro Rules**. Mounts the exact same section components (`IndicatorsSection`, `WidgetsSection`, `CatalogAstroSection`) with no `onSelect` prop — `+ Add` / `✓ Active` buttons work, deep-dive is not available inside the drawer. "Full Catalog →" link navigates to `/catalog` and closes.

Wired into `WorkspaceCanvas.tsx` via three entry points:
- `+ overlay` pill in the canvas topbar
- `AddZone` placeholders in edit mode
- "Add blocks from the Catalog" link in the empty-canvas state

### CatalogActionIsland

`src/components/domain/Catalog/CatalogActionIsland.tsx` — floating pill rendered at the bottom of `CatalogPage`. Slides up when `framework.blocks.length + framework.chart_overlays.length > 0`, hidden otherwise.

Shows live block count + overlay count from `useFrameworkStore()`. Pulse dot turns amber while `isSaving`. "Open Workspace →" navigates to `/workspace`.

Positioning: `left: 50%; transform: translateX(calc(-50% + 210px))` — 110px for main sidebar (220px ÷ 2) + 100px for catalog subnav (200px ÷ 2).

### useNiftyPulse() Hook

`src/hooks/useNiftyPulse.ts` — thin wrapper over `useVisualPulse(NIFTY_50_ID)` where `NIFTY_50_ID = 1`.

Used by the three live widget wrappers in `src/components/domain/Catalog/widgets/`:

| File | Wraps | Compute functions used |
|---|---|---|
| `MagicRsWidget.tsx` | `MagicRsSubchart` | none — maps bars to `MagicRsDataPoint[]` |
| `OrderFlowWidget.tsx` | `OrderFlowCard` | `computeRssSignals()` from `visualPulseEngine.ts` |
| `SmartMoneyWidget.tsx` | `SmartMoneyCard` | `computeSmartMoney()`, `computeDots()` from `visualPulseEngine.ts` |

All three wrappers use the same React Query key `['visual-pulse-bars', 1]` — only one network request regardless of how many are visible simultaneously. Static narrative `"NIFTY 50 · Live"` is passed to both `OrderFlowCard` and `SmartMoneyCard` (empty string risks broken layout since both components reserve space for the narrative prop).

### Legacy Column Aliases — Confirmed

Already documented in the Framework System section above. The catalog codebase strictly uses canonical column names only. No new code may reference legacy aliases.

---
