# Theme / Glass UX Session Handover — 2026-07-09

Branch: `claude/themes-direction-continuation-p8ux7u` (merged to `main`).
Read this before touching theme/light-mode work again — it'll save you from re-diagnosing things already ruled in or out this session.

## State: dark mode is good. Light mode is not done.

The Settings menu item is **hidden from the sidebar nav** (`Sidebar.tsx`, Admin
section) as of this session, specifically because light-mode issues there
aren't resolved yet and dark mode looked fine. The route (`/settings`,
`SettingsView.tsx`) still works if you navigate directly — it's just not
linked, so users don't land on it mid-fix. Unhide it by removing the comment
block around the `/settings` nav entry once light mode is actually done.

## What this session did (in order, each already committed to main)

1. **Renamed "Vikuna Black" theme** (was "KD Black"/"DristiQ") and adopted the
   *Glass UX & Theme Standard* reference's real color values instead of the
   old ad hoc palette. Two source files you should read before touching
   theming again:
   - `glassuxreference.html` — a live HTML demo of the target design system
     (paste from the user; not committed to the repo — ask for it again if
     you need it, or check if it's been added to `docs/` since).
   - `GLASSUXTHEMESTANDARD.md` — the prescriptive spec (same caveat).
   **Do not rely on a prior session's summarized notes about these two docs.**
   This session did exactly that for a while and burned several rounds
   chasing a wrong theory before re-reading the literal spec text. If a
   future session's summary describes what the spec says, re-fetch the real
   files before trusting it.

2. Server-persisted theme (`km_profiles.theme`, migration 091) + mode
   (`km_profiles.mode`, migration 141) — synced across devices via
   `updateProfile()`/`applyProfileTheme()` in `authStore.ts`.

3. Structural token layer, 5 new UI primitives (`PageHeader`, `EmptyState`,
   `Modal`, `Tabs`, `StatCard`), `NoiseOverlay`, no-FOUC script in
   `index.html`, `npm run check:theme` enforcement script.

4. Migrated ~16/23 views to the shared `PageHeader` component.

5. A long light-mode bug hunt (see below) — this is the part still unresolved.

## The light-mode bug hunt — what's actually fixed vs. still open

The user reported "light mode is a mess" after dark mode was praised as
improved. This took **five separate wrong-then-right diagnostic passes**.
Read this list before adding a sixth:

| # | Theory | Verdict |
|---|---|---|
| 1 | Card.tsx's glass variant was a no-op (backdrop-blur over the *solid* `--card` instead of the translucent `--kd-card`) | **Real bug, fixed.** `bg-kd-card` (Tailwind class) maps to solid `--card`; the actual translucent value is `--kd-card` (`surface.glass`), only reachable via the arbitrary-value class `bg-[var(--kd-card)]`. |
| 2 | Jade Thorn / Tech AI's light `surface.glass` was a never-calibrated 4-5% colored wash | Partially right diagnosis, wrong fix — see #3. |
| 3 | "Make light-mode glass fully opaque (`#ffffff`)" | **Wrong. Reverted.** The actual spec's own reference (`glassuxreference.html`) hardcodes `rgba(255,255,255,.75)` for light mode in every one of its 4 example themes. Going opaque was *my* deviation from spec, not a fix. |
| 4 | Real spec deviations, found only after re-reading the literal spec doc: (a) card blur was 24-40px (Tailwind `blur-xl`/`blur-2xl`) vs. spec's documented 16px, (b) the ambient `body::before` atmosphere gradient used 2 fixed-pixel blooms anchored dead-center over every `PageHeader`, colored by a hardcoded 10-15% cut of raw brand hex — instead of the spec's 3 viewport-relative blooms driven by each theme's own (previously unused!) `surface.primarySubtle` token | **Fixed.** `Card.tsx` blur → `blur-lg` (16px), `globals.css` atmosphere rewritten to 3-bloom/spec-positioned, `config/theme/index.ts` now wires `--atmosphere-primary`/`--atmosphere-accent` from each theme's real tokens. |
| 5 | `--text-faint` (25% opacity of `primaryText`, used in ~64 components) is illegible in light mode — contrast math: ~1.8:1, under WCAG's 3:1 floor | **Fixed.** Light mode now uses 45% instead of 25%; dark mode untouched. |
| 6 | `WorkspaceBlock.tsx`'s container had `background: 'rgba(13,17,23,.9)'` **hardcoded, unconditionally**, for every non-VaNi block type on `/workspace` — a literal solid near-black box regardless of theme/mode | **Fixed.** Non-VaNi blocks now use `var(--card)`. VaNi blocks (`added_by==='vani'` or `type==='vani_correlation'`) intentionally kept dark — their pale purple accent badges are calibrated for a dark backdrop, matching VaNi's fixed brand identity elsewhere (not a bug, a documented exception). |
| 7 | Two `DashboardV3` cards (`MarketWeatherCard`, `TodaysSky`) had a flat `rgba(0,0,0,0.15)` panel fill — subtle darkening on a dark card, muddy gray smudge on white | **Fixed.** New `--panel-recess` token (`config/theme/index.ts`), scales alpha per mode instead of one fixed cut. |

**As of the last message before this handover, the user had not yet
confirmed #6/#7 fixed it** — those were pushed and the user moved straight to
"hide Settings, merge, handover" rather than re-testing. **Treat #6/#7 as
unverified in the live app.** They're well-reasoned and typecheck-clean, but
get a fresh screenshot before assuming they're the last word.

## Diagnostic lessons — read before debugging light mode again

- **There is no live browser/DB access in this sandbox.** Every visual claim
  in this session was verified either via a hand-built static HTML mockup +
  Playwright screenshot (approximating the real layering, not the live app),
  or by asking the user for a screenshot / a `getComputedStyle(...)`
  DevTools one-liner. Don't claim something is "confirmed fixed" without one
  of those two — an isolated mockup can validate an isolated *hypothesis*,
  it cannot confirm the live app renders correctly.
- **`--kd-card` (translucent) vs `--card` (solid) is a recurring trap.**
  Tailwind's `bg-kd-card` utility class maps to the *solid* `--card`. The
  actual glass value lives in `--kd-card` and is only reachable via
  `bg-[var(--kd-card)]` (arbitrary value) or an inline `style`. Any new glass
  surface must use the arbitrary-value form or it silently renders solid.
- **Grep for hardcoded dark-assumption literals before touching theme
  tokens.** The two biggest "light mode is messy" bugs this session
  (`WorkspaceBlock`'s black box, the two `rgba(0,0,0,0.15)` panel fills)
  were **not** theme-config problems at all — they were literal hardcoded
  colors in component code that happened to look fine only because dark
  mode was the only mode anyone had tested. Useful greps:
  `grep -rn "background:\s*['\"]#\|background:\s*['\"]rgba" src/components src/views | grep -v "var(--"`
  and check every hit's surrounding context for whether it's (a) legitimately
  theme-agnostic chrome (tooltips, shadows, VaNi's fixed purple identity —
  all previously confirmed intentional) or (b) an actual bug.
- **The user's screenshots are ground truth; my mockups are not.** When a
  fix is reported "done" and the user comes back with "no improvement" or
  "still messy," don't re-theorize from the same mockup — ask for a fresh
  screenshot or a specific DevTools check, and update the theory based on
  what it actually shows, not what it "should" show.

## Suggested next steps for light mode

1. Get a fresh screenshot of `/workspace` and the Dashboard in light mode,
   post the #6/#7 fixes above, to confirm they actually landed.
2. If still messy, grep the same hardcoded-literal pattern across the rest
   of `components/domain/` and `views/` — there are very likely more
   instances of the "hardcoded near-black/near-white fill" bug class beyond
   the 3 found this session, just not yet hit by manual page-by-page review.
3. Once light mode is confirmed clean on the core user-facing pages
   (Dashboard, Workspace, Scanner, Catalog, Visual Pulse), unhide the
   Settings nav item in `Sidebar.tsx`.
4. Re-run `npm run check:theme` and `npm run typecheck` before calling it done.
