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

This was originally meant to also pilot a declarative-field-spec pattern
(one spec per scanner, instead of the four independent id-keyed lookups
`ScanTable.tsx`/`ScanFilterBar.tsx`/`ScanView.tsx` each reinvent) — that spec
file (`services/breakoutSurgeSpec.ts`) was built in Phase 1 v1/v2 but
**deleted in v3** once it turned out `fieldAvailability.ts`'s existing
per-category column config already covers Breakout Surge correctly. The
four-lookup duplication problem in the real scanner files is unchanged and
still open; this page doesn't solve it, it just doesn't need to for one
scanner.

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
  **Revised after a real review pass on the deployed page**: added a real
  header row + click-to-sort (was unlabeled columns, fixed sort only),
  filter chips (was missing entirely), a bookmark toggle wired to
  `useBookmarkStore.toggle` (was read-only status, no action), XLS/TV
  export (`components/domain/ScannerExportButtons.tsx`, extracted from
  ScanView.tsx's private buttons rather than modifying that file), and a
  Cards view that's an actual grid with vertically-stacked fields (was the
  table restacked with fewer fields — the exact "not curated, just
  restacked" anti-pattern found in the real `StockCard.tsx` earlier this
  session, reproduced by accident). Field list also reconsidered around
  interpretation, not copied from a generic set: added `pct_from_breakout`
  (the scanner's own signature metric, previously missing) and `score_22d`
  alongside `score_5d`. Still owed: real mobile device check (not yet done
  from this session — no way to verify on an actual phone here).
  **Revised again (v3) — row rendering now reuses real production
  components instead of a hand-built table/cards.** The v2 fix above was
  itself a partial miss: it rebuilt `TableView`/`CardView` from scratch
  without checking whether the real `ScanTable.tsx` (sort, column-visibility
  gear, proven interactions) and `BreakoutSurgeTable.tsx`'s
  `BreakoutSurgeCards` (a component already purpose-built for this exact
  scanner — VaNi tier vs. rest split, card layout) could just be imported.
  They can, and now are. Two consequences:
  - `services/breakoutSurgeSpec.ts` (the declarative field-spec file) is
    **deleted** — `ScanTable` sources its columns from
    `fieldAvailability.ts`'s `price_action` category default, which
    *already* includes `pct_from_breakout` and `score_22d` alongside
    `score_5d`/`rsi_14`/`magic_rs`. The "field rethink" in the v2 note above
    had reinvented something already correctly designed in the real app —
    no separate spec file needed. The "one spec per scanner" pattern
    mentioned in the *Why a new page* section below is **not** what shipped
    here; `fieldAvailability.ts`'s existing per-category config already
    solves it.
  - Two v1/v2 features are **dropped**, not ported: the per-row bookmark
    star toggle and the inline "why" expand panel. Neither `ScanTable` nor
    `BreakoutSurgeCards` support them. Row click now navigates to
    `/chart/equity/:id?...&setup=breakout_surge`, matching the exact
    convention the real `ScanView.tsx` uses. Adding the star/expand back
    means a deliberate, reviewed change to the shared
    `ScanCardWrapper`/`ScanTable` components themselves (touching code the
    other ~19 scanners depend on) — a decision for the owner, not something
    to smuggle into this page's fork. **Open question for the owner.**
  **Revised again (v4) — real bug fix + real ScanFilterBar, after an owner
  review of the deployed v3 page against the production Scanner:**
  - **Bug: VaNi Highlights read 0 instead of the real 15.**
    `isHighlight()` checked `r.is_vani_surge || r.is_vani_breakout` — raw DB
    columns `scanEngine.ts`'s breakout_surge query fetches only to compute
    `vaniOpportunity` internally; they're never copied onto the returned
    `ScanStock`, so the check always read `undefined`. Fixed to read
    `r.vaniOpportunity` (`breakoutSurgeInsights.ts`), the field that's
    actually populated by the same underlying rule. `buildWhyTags()` had
    the identical latent bug on `r.is_vani_breakout` — fixed by re-deriving
    the same condition from real `sma_50`/`sma_150` columns instead.
  - **Missing user-adjustable filters, and the 252-vs-243 count gap — one
    root cause.** v1–v3 had only quick toggle chips; production's real
    `ScanFilterBar` (MCap min/max, industry multi-select, Score 5D/22D min,
    Accelerating, RVOL min, %-from-breakout min/max, 5D move cap) plus its
    `applyFilters()`/`DEFAULT_FILTERS` (`{ mcapMin: 100 }`, applied on load)
    is now wired in exactly as `ScanView.tsx` uses it. The count gap was
    never a bug — 252 is the true unfiltered cohort (unchanged, still what
    "Broke Out Today" shows), 243 is production's *filtered* view under its
    default ₹100 Cr floor, which this page now also applies by default.
  - The hand-built `IndustryFilterTile` from the last note is **deleted** —
    `ScanFilterBar`'s own industry multi-select already does this, over
    every industry, not just the top one. "Leading Industry" is now a plain
    stat tile again, with a click-to-filter shortcut into that same
    `filters.industries` field. "Accelerating" and "Real Volume Behind"
    tiles were also rewired off a second local boolean onto the shared
    `filters.accelerating`/`filters.rvolMin` fields — clicking the tile and
    typing into the filter panel now drive the identical state, not two
    competing filter systems.
  **Revised again (v5) — one deliberate shared-component change, plus a
  page-local fix, plus one investigated-and-not-a-bug:**
  - **VaNi Highlight rows now get a distinct background in table view**
    (`color-mix(in srgb, var(--gold) 7%, var(--card))`, mixed against
    `--card` rather than transparent so the sticky symbol column stays
    opaque under horizontally-scrolled cells). This is a change to the
    **shared** `ScanTable.tsx` — every scanner using the table view gets it,
    not just Breakout Surge. Low-risk (purely additive background, matches
    the gold tint `BreakoutSurgeCards` already uses for its own VaNi tier),
    but flagging it as shared-file scope per this doc's own convention.
  - **Horizontal scroll forcing a full vertical scroll first**: traced to
    this *page's* own `maxWidth: 1200` container — `ScanView.tsx`'s content
    area has no width cap (`flex: 1` + padding only), so the same column set
    hits horizontal overflow far more on this preview page than on
    production. The cap is removed. `ScanTable.tsx` already ships a
    `FloatingHScrollbar` (portaled, pinned to the viewport bottom, shown
    only while the table's own scrollbar is off-screen) — that mechanism
    was not touched, since nothing in it looked broken; the fix is that
    this page was making it work harder than necessary.
  - **MagicRS sort ("+29 then -27 back to back") — investigated, no bug
    found.** `ScanTable.tsx`'s `compareValues()` already coerces both sides
    with `Number()` and does a numeric subtraction before ever falling back
    to string comparison — this is itself a documented fix for exactly this
    failure class, and `magic_rs` arrives as a real `number` (via
    scanEngine.ts's `toNum()`) for this preset, not a formatted string. Ran
    the comparator standalone against `[29, 18, 15, 7, 2, -3, -27, 0, null]`
    descending: correct output, sign-aware, nulls last. Most likely
    explanation for what was seen: Breakout Surge's ~243-stock cohort is
    selected *for* a bullish price event, so genuinely few of them carry a
    negative MagicRS — a real gap between the last positive stragglers and
    the rare negative outliers is plausible, not a sort defect. No DB
    access from this environment to fetch the actual day's values and
    confirm the gap directly — flagged back to the owner rather than
    guessing at a fix for code that already tests correct.
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

- `App/frontend/src/views/BreakoutSurgeStudio.tsx` (new; rewritten in v3 to
  use `ScanTable` + `BreakoutSurgeCards`; rewritten again in v4 to use the
  real `ScanFilterBar`/`applyFilters`/`DEFAULT_FILTERS`)
- `App/frontend/src/services/breakoutSurgeInsights.ts` (new, Phase 1 —
  cohort stats + `isHighlight()`; `buildWhyTags()` currently unused since
  the why-expand panel was dropped in v3, kept for possible Phase 2 reuse)
- `App/frontend/src/components/domain/ScannerExportButtons.tsx` (new —
  `DownloadXlsButton`/`TradingViewExportButton`, extracted from ScanView.tsx)
- `App/frontend/src/App.tsx` (added the one route, added the one import)
- `App/frontend/src/services/breakoutSurgeSpec.ts` — created in v1/v2,
  **deleted in v3** (superseded by `fieldAvailability.ts`, see above)

`ScanFilterBar.tsx`, `ScanView.tsx`, and `Sidebar.tsx` remain untouched.
`ScanTable.tsx` got one small, deliberate shared change in v5 (VaNi
Highlight row background, see above) — everything else about it, including
`FloatingHScrollbar.tsx`, is still used as-is, read-only.
