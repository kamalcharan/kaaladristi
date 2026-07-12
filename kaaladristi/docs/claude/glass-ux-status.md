# Glass UX Standard — Canonical Status & Decisions

Last updated: 2026-07-12 (session: phantom-var elimination + verification harness).
Read this BEFORE any theme/UX-consistency work. It exists because two prior
sessions re-diagnosed and re-litigated the same ground. Companion history:
`theme-handover-2026-07-09.md` (the light-mode bug hunt, diagnostic lessons).

---

## 1. PageHeader — the header-system decision table (SETTLED, do not re-litigate)

15 pages use the shared `PageHeader` (`components/ui/PageHeader.tsx`).
Every remaining bespoke header below was **deliberately assessed and kept**
(first in commit `cd31c27a`, re-confirmed 2026-07-12). Forcing PageHeader onto
these trades working, fit-for-purpose layouts for surface-level consistency:

| Page | Why bespoke is correct |
|---|---|
| WorkspacePage, ChartView, IndexDetailPage | Dense instrument/tool header bars (back button + dynamic name + interactive chips) — not a title pattern |
| VisualPulsePage, EquityVisualPulsePage, IntradayPage | Immersive full-bleed cockpit grids with their own mini top bars (4–5 s glance designs) |
| ScanView | Header sits below a category-pill selector strip in a compound layout |
| CatalogPage | Two-pane layout: own sub-sidebar + section-owned titles |
| CorrelationPage | Analysis-document layout (drill-down) |
| PanchangView, AdminPanchangView | Compact toolbar inside height-fitted calendar panels |
| PlanetaryIntelView, PricingPage | Narrow centered reading columns — full-bleed header clashes |
| RuleDetail | Entity summary card, not a page title |
| CustomIndexCreatePage | The `<h1>` is a sidebar form-panel label (grep false positive) |
| LandingPage, LoginPage, ProfileSetup | Public/auth/marketing — out of scope |

Consistency work on these pages = tokens + type roles (`--font-display`,
micro-label conventions), NOT the header component.

## 2. Bug classes eliminated 2026-07-12 (Phase 1) — keep them dead

1. **Phantom CSS vars** — vars consumed via `var(--x)` but never defined
   anywhere (neither `applyTheme` in `config/theme/index.ts`, nor
   `globals.css`, nor the FOUC script, nor a component-level definition).
   17 names / 75 sites existed (`--bg-card`, `--kd-panel`, `--surface`,
   `--font-sans`, `--font-serif`, `--teal`, `--vani`, `--*-rgb`, …).
   Symptom: fallback literal always rendered (permanent `#0d1117` boxes) or,
   with no fallback, **transparent backgrounds / wrong fonts in BOTH modes**.
   Detection: diff the used-var set against the defined-var set — mechanical,
   complete, no screenshots needed.
2. **Dark-assumption fills** — hardcoded `rgba(0,0,0,…)` / `#0f172a`-class
   backgrounds in component code. Fine in dark, broken in light. All 17
   remaining sites were triaged once: panel fills → `var(--panel-recess)`,
   modal scrims → `var(--overlay)`, chart tooltips → `var(--card)`.
   Sites that are correctly theme-agnostic (drawer scrims, contrast rings,
   recesses on colored chips, the fixed-dark landing page) carry a
   **`theme-agnostic:` comment marker** — leave marked sites alone, and mark
   any new intentional literal the same way.

## 3. Token vocabulary — the deployed contract

The app's emitted tokens are the `--kd-*` / `--bull`/`--bear`/`--caution` /
`--accent-*` / `--text-*` vocabulary written by `applyTheme()`
(`src/config/theme/index.ts`), NOT the reference standard's `--color-*` names.
**Do not rename pre-launch** — the mechanism (pure theme data → one mapper →
inline vars on `documentElement`, light+dark per theme, no-FOUC script in
`index.html`) matches the standard; only the names differ. Renaming is a
~300-site churn with zero user-visible value.

Known traps (also in `theme-handover-2026-07-09.md`):
- Tailwind `bg-kd-card` → **solid** `--card`; translucent glass is `--kd-card`,
  reachable only via `bg-[var(--kd-card)]` or inline style.
- `--vani: #9d8ff9` (globals.css) is VaNi's fixed identity — same in all
  themes/modes, on purpose.
- `--panel-recess` is the ONLY sanctioned "darkened inset" fill (per-mode).
- `--card-deep` is dark-fixed and has zero consumers — do not adopt it.

## 4. Verification harness (Phase 0) — how to SEE changes before claiming them

`npm run dev` renders every route with real theme CSS even with no backend:
auth is a localStorage `kd_session` blob; PostgREST/pipeline calls can be
stubbed. The Playwright harness (session scratchpad `harness/shoot.mjs`,
reusable pattern below) screenshots all 31 routes × dark+light × 3 themes:

- seed `localStorage`: `kd_session` (fake admin user), `kd-theme`, `kd-theme-mode`,
  `kd_welcome_ack_<userId>`;
- intercept `**/db/**` → `[]` (and `km_profiles` → a stubbed profile whose
  `theme`/`mode` fields drive the axis under test), `**/pipeline-api/**` → `{}`;
- screenshot each route, pixel-diff against a pre-change baseline
  (PIL `ImageChops.difference`; >12/255 channel delta = changed pixel).

Ground rule from the 07-09 handover, now enforceable: **no theme fix is
"done" without a harness diff or an owner screenshot.** Dark mode must show
~0.0% pixel delta on untouched pages (regression gate).

## 5. Open backlog (post-launch, deliberately deferred)

- ~850 hex/rgba literals outside `config/theme/` (hotspots: Catalog tree,
  VaNiMorningBrief, WorkspaceBlock, hand-rolled SVG charts) — being reduced
  in the launch sweep; the rest ratchets down via `check:theme`.
- `Button` / `StatCard` primitives exist with 0 importers (398 bespoke
  `<button>`s); `EmptyState` has 1 importer. Adoption sweep post-launch.
- Easing: 20 hardcoded `cubic-bezier(...)` across 8 curves vs the `--ease`
  token. Cosmetic; consolidate opportunistically.
- Font-mode axis (modern/classic) from the reference standard: not built.
  Three loaded-but-unused Google fonts in `index.html` await it.
- recharts → hand-built SVG (standard §6): indefinitely deferred; not
  user-visible, high risk.
