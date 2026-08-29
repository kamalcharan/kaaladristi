# Breakout Surge — VaNi-Led Scanner Redesign (Preview)

**Status:** Phase 0 (scaffolding) and Phase 1 (structural UI) built. Phase 2
(VaNi narration) and beyond not started.
**Route:** `/scanner-preview/breakout-surge` — direct-URL only, intentionally
**not** in `Sidebar.tsx` nav. Reachable by a logged-in user who types the URL;
invisible otherwise. Do not add a nav entry until Phase 3 QA passes.
**Depends on:** the "compute in code, narrate in prose" architecture already
designed in `docs/claude/scannerenhancement.md` (status there: designed, not
built) — Phase 2 Tier B of this plan is that doc's build, not new design.

## Why a new page instead of editing the real Scanner

The real `/scanner/:presetId` route (`ScanView.tsx` + `ScanTable.tsx` +
`ScanFilterBar.tsx`) serves all ~20 scan presets through shared rendering
code. A redesign of Breakout Surge's *display* touched none of that
intentionally — this page reuses the real data path
(`useScan('breakout_surge', exchangeFilter)`, the same hook the real Scanner
page calls) but owns its own presentation layer, so the other 19 scanners
have zero blast radius while this is being proven out.

This is also the first real instance of a pattern discussed but not yet
retrofitted anywhere else: one declarative field spec per scanner
(`services/breakoutSurgeSpec.ts`), instead of the four independent id-keyed
lookups the real `ScanTable.tsx`/`ScanFilterBar.tsx`/`ScanView.tsx` currently
each reinvent (`PRESET_COL_OVERRIDES`, `DEFAULT_SORT`, `getFilterGroup`, the
per-preset card dispatch). Not retrofitting those files now — proving the
pattern here first is the point.

## Phases

- **Phase 0 (done):** route + `views/BreakoutSurgeStudio.tsx` +
  `services/breakoutSurgeSpec.ts`. Renders real rows from `useScan()`, no
  cohort strip/VaNi/badges yet — just proves the real-data pipeline works
  end to end.
- **Phase 1 (done):** cohort stat strip, VaNi Highlight tier (reusing the
  real `ScanCardWrapper` / `VaniBadge` / `ScanSectionLabel` from
  `ScanCardShell.tsx`, not reinventing them), watchlist/position badges
  (`useBookmarkStore`, already globally available), Table/Cards toggle, and
  the per-row inline "why" expand (the strongest idea from the reference
  prototype walkthrough — cheaper than a split-view or slide-over, no
  routing/state-architecture change). `services/breakoutSurgeInsights.ts`
  holds the cohort-stat math and `buildWhyTags()` — deterministic, no LLM
  call yet; `buildWhyTags()` mirrors the same boolean logic
  `backfill_vani_flags.py` uses for `is_vani_surge`/`is_vani_breakout`.
  Mobile field curation for the Cards view (a genuinely trimmed field set,
  not just the table restacked) is still owed — current Cards view shows
  close/1D%/score only, not yet reviewed on a real phone.
- **Phase 2 — stabilise VaNi, two tiers:**
  - **Tier A (no new backend):** cohort stats (% accelerating, % RVOL>3,
    leading industry, VaNi Highlight count) computed client-side from the
    *full* fetched result set (not a sample), fed to VaNi only as
    precomputed facts to phrase. Fixes `scannerenhancement.md`'s documented
    failure mode (no comparison point, 25-of-270 sample mismatch) for free,
    since there's no comparison point needed and no sampling.
  - **Tier B (real backend work, own timeline):** "up from N yesterday",
    "new today", "sustaining N sessions" — needs the scheduled job +
    membership table `scannerenhancement.md` already designed. Ship without
    this line first; slot it in later without touching the frontend again.
- **Phase 3:** QA against several real trading days including a bad one
  (few/zero results, illiquid-heavy day); real mobile device check.
- **Phase 4:** review gate with the owner, then pick scanner #2 and repeat —
  each subsequent scanner should be faster once the field-spec pattern from
  Phase 0 is proven.

## Files touched so far (Phase 0 + 1)

- `App/frontend/src/views/BreakoutSurgeStudio.tsx` (new)
- `App/frontend/src/services/breakoutSurgeSpec.ts` (new)
- `App/frontend/src/services/breakoutSurgeInsights.ts` (new, Phase 1)
- `App/frontend/src/App.tsx` (added the one route, added the one import)

Nothing in `ScanTable.tsx`, `ScanFilterBar.tsx`, `ScanView.tsx`, or
`Sidebar.tsx` was touched.
