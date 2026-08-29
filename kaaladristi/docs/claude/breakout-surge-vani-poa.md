# Breakout Surge — VaNi-Led Scanner Redesign (Preview)

**Status:** Phase 0, Phase 1, and Phase 2 Tier A built. Phase 2 Tier B and
Phase 3+ not started.

## ⚠ Real bug found and fixed 2026-08-29: universe leak, NOT introduced by this preview

`kaala-postgres` MCP (read-only, live prod DB) was used to verify the Phase
2 Tier A work against real 2026-08-28 data, and surfaced a pre-existing bug
in `scanEngine.ts`'s `fetchBreakoutSurge()` — the SAME fetcher the real
production `/scanner/breakout_surge` page uses, so this was live before any
of this preview-page work started, not something the preview introduced.

**What was found:** `fetchBreakoutSurge()` never called `passesUniverse()`
to enforce the preset's declared `NSE_ONLY` universe — unlike its sibling
"direct query" fetchers (`fetchBreakdownWatch`, `fetchPeriodMovers`,
`fetchGlEvents`), which all have this exact gate with a comment describing
the identical failure mode found on `weekly_movers` on 2026-08-25 (139/500
rows were BSE-only leakage). Verified live for 2026-08-28:
- ISIN-deduped, `Combined` exchange tab: **386 rows** (275 NSE + 111 BSE)
- `km_scan_results` matview (the source of the tab-count badge): **252**

So the badge next to "Breakout Surge" and the actual rows rendered in the
table under it have been showing two different numbers — the table included
134 BSE-only stocks that don't belong in an NSE_ONLY-declared screener.
**Fixed** in `scanEngine.ts` by adding the same `passesUniverse(sym.exchange,
declaredUniverse)` gate its sibling fetchers already have.

Separately verified: the VaNi Highlight count (15) reported in Phase 2 Tier
A holds identically whether computed over the leaked 386-row cohort or the
correct NSE-only 275-row one — none of the 15 highlighted rows were BSE
duplicates, so the Tier A cohort-facts work above did not need correction.

**Not yet resolved:** 275 (raw NSE, ISIN-deduped) vs. 252 (matview) is a
smaller, second gap — likely an additional matview-side filter (mcap? an
active-symbol flag? a different dedup rule?) not yet traced. Worth a follow-up.

**Broader pattern flagged, not fixed here (scope discipline — this doc is
Breakout Surge only):** grepping `scanEngine.ts` for `passesUniverse(sym.
exchange` shows only 3 of ~10 direct-query fetchers call it
(`fetchBreakdownWatch`, `fetchPeriodMovers`, `fetchGlEvents`).
`fetchVolumeDrive`, `fetchStage2Leaders`, `fetchStage2Watch`,
`fetchStage4Leaders`, `fetchStage3Watch`, `fetchVaNiExitWatch`,
`fetchFlowerPotBurst`/`fetchFlowerPotBurstClientSide`, and `fetchWgJourneys`
were not individually checked for whether their preset's declared universe
actually needs the gate (some are `NSE_BSE`, no restriction needed) — but
several (Stage family, VaNi Exit Watch, Flower Pot Burst, Waking Giants) are
declared `NSE_ONLY` per `SCAN_PRESETS` and are worth auditing the same way.
Flagging for the owner rather than fixing unilaterally across scanners this
plan doesn't own.
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
  **Revised again (v6) — the real issue was the MagicRS dot's COLOR, not
  the sort, plus exchange filter was missing entirely:**
  - Owner sent a screenshot: values were correctly descending (76.3 → 65.5)
    but the dot colors weren't — green, green, **red** (69.8), green, plus
    two **gray** dots (73.3, 66.1) indistinguishable from green at a
    glance. Root cause: `fieldConfig.ts`'s `magic_rs.colorFn` colors by
    `magic_rs_zone` (`magic_rs − magic_ma` — trend vs. the stock's OWN
    average), a real, deliberate, documented signal used correctly by the
    card/chart views — but in a *table*, sitting directly next to the
    sorted magic_rs number, a value can be zone-red while numerically
    between two zone-green neighbors, and reads as a sort bug even though
    it isn't one.
  - Dispatched a research agent to find the exact cause of the gray dots
    (real `magic_rs`, no zone): confirmed in
    `compute_magic_rs_batch` (`km_migration_169_...sql`, daily warm-up path
    unchanged from 026/069) — `magic_rs` starts at bar 144, `magic_ma`
    (SMA-60 of `magic_rs`) needs ≥40 valid `magic_rs` values in its trailing
    60-bar window, clearing around bar ~183. Zone is only set when BOTH are
    non-null. So bars ~144–183 get a real MagicRS number with no zone yet —
    a genuine, benign, self-resolving warm-up gap, not a bug.
  - Fix, scoped to `ScanTable.tsx`'s table rendering only: the MagicRS
    dot/text now colors by the SIGN of the number actually shown and sorted
    on (`magicRsSignColor()` — bull/bear/faint-for-no-data), not by zone.
    It can never visually disagree with the sorted number again, and there
    is no more "gray, unclassified" third state for a populated value —
    only bull, bear, or genuinely-no-data. `fieldConfig.ts`'s zone-based
    `getColor()` is untouched and still governs every other consumer
    (cards, charts, the leaderboard) — this is a **shared-component
    change** (`ScanTable.tsx`, used by all ~20 scanners), scoped narrowly to
    one column's color logic, not a change to the house zone vocabulary.
  - **Exchange filter (Combined/NSE/BSE) was missing from this page
    entirely** — added via a new `components/domain/ExchangeTabs.tsx`
    (extracted from `ScanView.tsx`'s private component, same pattern as
    `ScannerExportButtons.tsx`), wired with the same `universe === 'NSE_ONLY'
    → disable BSE` rule production uses for this preset.
- **Phase 2 — stabilise VaNi, two tiers:**
  - **Tier A — done.** This page had **zero** VaNi scanner functionality
    before this round: `usePageContext.ts`'s route→page map happens to match
    `/scanner-preview/...` to `'scanner'` (its `/^\/scanner/` regex has no
    trailing boundary), but `VaNiChatPanel.tsx` hides every `scanner.*`
    intent until a `scanContext` is published (`!i.intentId.startsWith
    ('scanner.') || !!scanContext`) — and this page never rendered a
    `ScanVaNiPublisher`, so "What does this screener show?" / "Read today's
    results" were invisible, and the stock-lookup gate had nothing to check
    membership against. Fixed by adding `ScanVaNiPublisher` (previously
    completely missing — same "missing from this page" pattern as the
    exchange filter above).
    Separately, traced the actual `scanner.read_results` backend prompt
    (`vani_assemblers.py`) and found the documented `scannerenhancement.md`
    failure mode precisely: `format_scanner_user_message()`'s VaNi-highlight
    count was `sum(1 for r in ctx['rows'] if r['vani'])` — counted only
    within the 25-row sample `ScanVaNiPublisher`/`_SCANNER_MAX_ROWS` caps at,
    not the true full-cohort count. For Breakout Surge that's a real ~15 vs.
    whatever happens to fall in the top-25-by-score. Fixed end to end:
    - `services/breakoutSurgeInsights.ts`'s `computeCohortStats()` (already
      built for the stat strip) is now ALSO published as
      `VaNiScanContext.cohortStats` (new optional field, `vaniStore.ts`) via
      `ScanVaNiPublisher`'s new optional `cohortStats` prop.
    - `VaNiChatPanel.tsx` forwards it as `cohort_stats` on `scanner.
      read_results` asks; `useVaNiChat.ts`'s `VaNiAskRequest` type gained
      the matching optional field.
    - Backend: `VaNiAskRequest.cohort_stats` (pipeline2_api.py) →
      `assemble_scanner_context(..., cohort_stats=...)` →
      `format_scanner_user_message()` now uses the TRUE
      `vani_highlight_count` when present, and appends a "Full-cohort facts"
      block (% accelerating, % on real volume, leading industry) so the
      model is GIVEN these facts instead of inferring them from the 25-row
      sample — the other half of `scannerenhancement.md`'s "compute in
      code, narrate in prose" principle, not just the count fix.
    - Fully backward-compatible: `cohort_stats` is optional everywhere; when
      absent (every scanner except this one, for now), the prompt text is
      byte-identical to before. `build_scanner_cache_context()`'s `'v'`
      marker bumped 2→3 since the persistent cache hash now includes
      `cohort_stats` (busts existing 24h-TTL cache entries once on deploy,
      harmless).
    - No live DB/API access from this environment to verify the actual LLM
      output — typechecked, built (theme-standard clean), and Python
      syntax-checked (`ast.parse`), but the real prompt/response round-trip
      is unverified. Worth a manual check on the deployed page.
  - **Tier B (real backend work, own timeline):** "up from N yesterday",
    "new today", "sustaining N sessions" — needs the scheduled job +
    membership table `scannerenhancement.md` already designed. Ship without
    this line first; slot it in later without touching the frontend again.
- **Phase 3:** QA against several real trading days including a bad one
  (few/zero results, illiquid-heavy day); real mobile device check.
- **Phase 4:** review gate with the owner, then pick scanner #2 and repeat —
  each subsequent scanner should be faster once the field-spec pattern from
  Phase 0 is proven.

## Files touched so far

- `App/frontend/src/views/BreakoutSurgeStudio.tsx` (new; rewritten in v3 to
  use `ScanTable` + `BreakoutSurgeCards`; rewritten again in v4 to use the
  real `ScanFilterBar`/`applyFilters`/`DEFAULT_FILTERS`; v7 (Phase 2 Tier A)
  adds `ScanVaNiPublisher` + `cohortStats`)
- `App/frontend/src/services/breakoutSurgeInsights.ts` (new, Phase 1 —
  cohort stats + `isHighlight()`; `buildWhyTags()` currently unused since
  the why-expand panel was dropped in v3, kept for possible Phase 2 reuse)
- `App/frontend/src/components/domain/ScannerExportButtons.tsx` (new —
  `DownloadXlsButton`/`TradingViewExportButton`, extracted from ScanView.tsx)
- `App/frontend/src/components/domain/ExchangeTabs.tsx` (new, v6 —
  extracted from ScanView.tsx, same pattern as ScannerExportButtons.tsx)
- `App/frontend/src/App.tsx` (added the one route, added the one import)
- `App/frontend/src/services/breakoutSurgeSpec.ts` — created in v1/v2,
  **deleted in v3** (superseded by `fieldAvailability.ts`, see above)

`ScanFilterBar.tsx`, `ScanView.tsx`, and `Sidebar.tsx` remain untouched.
`ScanTable.tsx` got two small, deliberate shared changes: v5 (VaNi Highlight
row background) and v6 (MagicRS dot/text colored by sign instead of zone,
table-only — see above). Everything else about it, including
`FloatingHScrollbar.tsx`, is still used as-is, read-only.

**Phase 2 Tier A additions** — all additive/optional, shared files included:
- `App/frontend/src/stores/vaniStore.ts` — new optional
  `VaNiScanCohortStats` type + `VaNiScanContext.cohortStats?` field
- `App/frontend/src/components/domain/ScanVaNiPublisher.tsx` — new optional
  `cohortStats` prop, forwarded into the store
- `App/frontend/src/hooks/useVaNiChat.ts` — new optional `cohort_stats`
  field on `VaNiAskRequest`
- `App/frontend/src/components/domain/VaNiChatPanel.tsx` — forwards
  `scanContext.cohortStats` as `cohort_stats` on `scanner.read_results` asks
- `App/backend/pipeline2_api.py` — new optional `VaNiAskRequest.cohort_stats`,
  passed through to `assemble_scanner_context`
- `App/backend/lib/vani_assemblers.py` — `assemble_scanner_context()` gains
  `cohort_stats` param; `format_scanner_user_message()` uses the true count
  + appends a full-cohort-facts block when present; cache-context `'v'`
  bumped 2→3
