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
    **Revised (v8) — Tier A's plumbing was invisible on the page itself.**
    Owner asked "I don't see VaNi on the page, how did you put it?" — fair:
    `ScanVaNiPublisher` renders `null`; the only VaNi entry point was the
    small global "Ask VaNi" pill in `Layout.tsx`'s header, shared by every
    route. Production's own `/scanner/breakout_surge` additionally has
    on-page VaNi elements (the "✦ VaNi Highlight 15" pill, "✦ VaNi explains
    this screener" button) that this preview never had. Went back to the
    original reference (`VaNi_Scanner.html`, the prototype reviewed earlier
    this session) and found a second agreed piece not yet built: a
    **`vaniBlock` — an inline "VaNi read" summary sitting directly on the
    page**, not one click away, with a short paragraph plus a quick-action
    button ("Apply highlights"). Added as `VaNiReadPanel` (local component,
    `BreakoutSurgeStudio.tsx`) — fires `scanner.read_results` once per
    trading date via `useVaNiAsk()`, using the exact same Tier A
    `cohort_stats` wired in above, renders directly below the cohort stat
    strip. Includes an "Apply VaNi Highlights" button wired to the existing
    `quick.hl` toggle. Found and fixed one real pre-existing type gap along
    the way: `VaNiAskRequest` (`useVaNiChat.ts`) was missing `total_count?:
    number` even though `VaNiChatPanel.tsx` already sent it (via object
    spread, which skips TS's excess-property check on a literal — my direct
    literal usage caught it). Also introduced two `#fff` literals fixed to
    Tailwind's `text-white` class (same pattern `Layout.tsx`'s own VaNi
    button already uses) to keep the theme-standard ratchet clean.
    **Revised again (v9) — deployed to the VPS, owner reviewed the live
    "VaNi Read" block and flagged 3 gaps against what production already
    has:**
    - **Feedback (thumbs up/down) was missing.** `VaNiFeedback.tsx` already
      exists (self-contained, `logId` prop, posts to `/api/vani/feedback`,
      remembers the vote in `localStorage`) and is what `VaNiChatPanel.tsx`
      uses per-message — `VaNiReadPanel` just never rendered it. Added,
      gated on `askMutation.data.log_id` being present.
    - **No follow-up ("also ask") intents.** `VaNiChatPanel.tsx` has its own
      "also ask" section (`remainingIntents`) below each answer. Added the
      same idea here, scoped to two real, low-effort actions rather than
      reimplementing the full intent list: "What does this screener show?"
      calls `useVaNiStore().openWithIntent('scanner.explain_preset')`
      (opens the real global panel with that intent queued — the exact
      mechanism the header pill's own intents already use), and "Ask VaNi
      about a stock in this scan" just opens the panel
      (`useVaNiStore().toggle()`) for free-form follow-up.
    - **Collapse/truncate.** The full two-paragraph response was always
      shown in full — a genuinely long block for a stat-strip page. Added
      `expanded` state defaulting to closed, `-webkit-line-clamp: 3` when
      collapsed, "Show more ▼ / Show less ▲" toggle. Right instinct on its
      own terms (real length, this page's own density) — checked
      `VaNiInsight.tsx` (the Skills-system's own reusable insight panel,
      dashboard/panchang/breadth cards) hoping to point at an existing
      precedent to match, but it does **not** truncate anywhere; this is a
      new pattern for the product, not copied from elsewhere, worth knowing
      if `VaNiInsight.tsx`'s own long responses get the same complaint later.
    **Reverted (v10) — `VaNiReadPanel` deleted entirely.** Owner's question
    cut straight through v8/v9: "we already have VaNi space, intents are
    opening the right drawer — why so many kinds of UX... they can come in
    the same space right?" Correct call, and it undoes v8/v9's whole
    premise. `VaNiReadPanel` was a second, parallel rendering surface —
    its own loading state, its own response text, its own feedback buttons,
    its own follow-up buttons — duplicating what `VaNiChatPanel.tsx` (the
    one real, working VaNi surface, reached via `Layout.tsx`'s global "Ask
    VaNi" pill on every route) already does correctly. The actual, narrower
    problem this whole VaNi thread was solving — the drawer having nothing
    real to answer from on this page — was already fixed back in v7's
    `ScanVaNiPublisher` wiring (publishes `scanContext` + `cohortStats` to
    `vaniStore.ts`) and v7's Tier A backend work (real full-cohort facts
    reach `scanner.read_results`'s prompt). Once `scanContext` is published,
    `VaNiChatPanel.tsx`'s own filter
    (`!i.intentId.startsWith('scanner.') || !!scanContext`) already surfaces
    `scanner.explain_preset` / `scanner.read_results` in the SAME drawer
    every other page uses — feedback, follow-ups ("also ask"), everything,
    for free, no page-specific code. `VaNiReadPanel` and its imports
    (`useVaNiAsk`, `toVaNiScanRows`, `useVaNiStore`, `VaNiFeedback`) are
    removed from `BreakoutSurgeStudio.tsx`; `ScanVaNiPublisher` (the real
    fix) stays exactly as it was. Net effect: this page now behaves
    identically to every other scanner page for VaNi — same entry point,
    same drawer, same intents, same feedback — which is the correct,
    boring, consistent answer, not a new pattern.
    **Restored again (v11) — on-page card is back, this time correctly.**
    v10's read of the owner's feedback was wrong on one count: the "why so
    many kinds of UX" complaint wasn't "delete the on-page card, drawer
    only" — it was "don't build a SECOND bespoke card that duplicates the
    real one." Confirmed once the owner shared the original reference
    mockup (`VaNi_Scanner.html`'s `vaniBlock` — an always-visible card with
    rotating pill follow-ups) and said plainly: "i prefer on-page as user
    will see it." Between v7 (`docs/claude/vani-common-component.md`, the
    audit that made `VaNiInsight` the one common component across
    ChartView/Dashboard/Panchang/Breadth/rule-popovers) and v10, the fix
    needed was always available — just never applied here. `ScannerVaNiCard`
    (local to `BreakoutSurgeStudio.tsx`) now owns ONLY the
    `scanner.read_results` fetch (same payload/cohort_stats as v8/v9) and a
    pill row of page-specific actions; all rendering — header, loading
    state, body, feedback via `logId` — is `<VaNiInsight>` itself, zero
    reinvention this time. Pills: "Start with the N Highlights →" (applies
    the `hl` quick filter), "My Watchlist" (applies `watch`), "What does
    this screener show?" (opens the drawer with `scanner.explain_preset`
    queued), "Ask a follow-up →" (opens the drawer plain). Deliberately does
    **not** include the mockup's "Why so many breakouts?" / "Which to
    skip?" / "What changed vs yesterday?" pills — those need new backend
    VaNi intents (prompts + registration in `vani_intents.py`) that don't
    exist yet; faking buttons with no real backend behind them would be
    worse than omitting them. Mobile: pill row wraps
    (`flexWrap: 'wrap'`), no fixed widths anywhere in the card — reasonable
    on paper, genuinely unverified from this environment (no device to
    check on), same open item as Phase 3 below.
    **Revised again (v12) — real deployed-page review, four findings, one
    of them a repeat of the exact thing v10 was supposed to fix:**
    - **Wall of text.** `format_scanner_user_message()`'s prompt asks for
      "2 short paragraphs" (`vani_assemblers.py`), and the model was
      producing that structure — but `VaNiInsight.tsx`'s `<p>` had no
      `whitespace-pre-line`, so plain HTML collapsed the `\n\n` between
      paragraphs into one unbroken block. Fixed in `VaNiInsight.tsx` itself
      (one Tailwind class) — benefits every existing usage
      (ChartView/Dashboard/Panchang/Breadth), not just this page, since
      they'd have had the identical silent flattening.
    - **Collapsible wasn't visible.** v11's rewrite of `ScannerVaNiCard`
      called `<VaNiInsight insight={...} isLoading={...} logId={...} />`
      without the `collapsible`/`collapsedHeight` props — the feature
      built into `VaNiInsight` for exactly this (`vani-common-component.md`
      v7) was simply never wired up here. Added
      `collapsible collapsedHeight={110}`.
    - **"Selected intent text not visible" + "right drawer opens again."**
      One root cause: "What does this screener show?" still called
      `useVaNiStore().openWithIntent('scanner.explain_preset')` — v11's own
      doc comment claimed the pill route was fixed, but only "Ask a
      follow-up" was actually reconsidered; the explain pill still opened
      the drawer, the exact thing flagged in v10 as the problem. Owner,
      verbatim: "existing VaNi space should be used rather than right
      draw." Rebuilt: `ScannerVaNiCard` now holds two independent
      `useVaNiAsk()` instances (`scanner.read_results`,
      `scanner.explain_preset`) and a local `activeIntent` toggle — both
      intents render in the SAME `<VaNiInsight>` slot, swapped in place,
      no drawer for either. `scanner.explain_preset` fires lazily on first
      click, not eagerly. The two toggle pills ("Today's Results" / "What
      does this screener show?") now have a distinct filled `activePillStyle`
      so which one is currently shown is visually unambiguous — likely what
      "selected intent text is not visible" was actually pointing at:
      there was no active-state styling at all before, drawer or not.
      "Ask a follow-up →" is **removed** — it only ever routed to the
      drawer too, and there's no honest inline alternative for genuinely
      free-form questions without a text-input UI, which is real, separate
      scope, not something to fake here.
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

**v8 additions:**
- `App/frontend/src/views/BreakoutSurgeStudio.tsx` — new local
  `VaNiReadPanel` component, the inline on-page "VaNi read" summary from
  `VaNi_Scanner.html`'s `vaniBlock` pattern
- `App/frontend/src/hooks/useVaNiChat.ts` — added `total_count?: number` to
  `VaNiAskRequest` (pre-existing type gap; the field was already sent by
  `VaNiChatPanel.tsx`, just never declared on the type)
- `App/frontend/src/services/scanEngine.ts` — separately, fixed the
  `fetchBreakoutSurge()` universe leak found while verifying Tier A against
  live data (see the ⚠ note near the top of this doc)

**v9 additions** — all inside `VaNiReadPanel` in `BreakoutSurgeStudio.tsx`,
plus reusing (not modifying) two existing components:
- `VaNiFeedback` (`components/domain/VaNi/VaNiFeedback.tsx`) — imported and
  rendered as-is
- `useVaNiStore().openWithIntent` / `.toggle()` — used to route the two
  follow-up buttons into the existing global panel, no store changes needed

**v10: `VaNiReadPanel` deleted.** `BreakoutSurgeStudio.tsx` reverted to
Phase 2 Tier A's actual shape — `ScanVaNiPublisher` only, no on-page VaNi
UI. The now-unused imports (`useEffect`'s `useRef` sibling, `useVaNiAsk`,
`toVaNiScanRows`, `useVaNiStore`, `VaNiFeedback`, `ScanDefinition`,
`CohortStats`) were removed with it. `useVaNiChat.ts`'s `total_count?`
type-gap fix and `scanEngine.ts`'s universe-leak fix (both found as
byproducts of building v8/v9) are unaffected — genuinely separate, real
fixes kept as-is.

**v11: `ScannerVaNiCard` added** (`BreakoutSurgeStudio.tsx`) — the on-page
card, restored, built on `VaNiInsight` (import added back) instead of
reinvented. `useVaNiAsk`, `toVaNiScanRows`, `useVaNiStore`, `ScanDefinition`,
`CohortStats` imports return; `VaNiFeedback` does not (`VaNiInsight` renders
it internally via its own `logId` prop, so this file never imports it
directly).

**v12:**
- `App/frontend/src/components/domain/VaNiInsight.tsx` — added
  `whitespace-pre-line` to the body `<p>` (paragraph-break fix, benefits
  every usage, not just this page)
- `App/frontend/src/views/BreakoutSurgeStudio.tsx` — `ScannerVaNiCard`
  rewritten: `useVaNiStore` import and `openWithIntent`/`toggle` usage
  removed entirely (no more drawer routing from this card); two
  `useVaNiAsk()` instances + local `activeIntent` state added instead;
  `collapsible collapsedHeight={110}` added to the `<VaNiInsight>` call
  that was missing it; "Ask a follow-up →" pill removed.

**v13 — owner-specified VaNi intent set (2026-08-29).** Two rounds of owner
feedback on v12's actual rendered output ("i still see long paragraph...what
does the user gain from this message?") landed on a full redesign of what
VaNi says on this page, not another rendering fix:

1. **Bullet-format rewrite, `scanner.explain_preset` + `scanner.read_results`
   (`vani_intents.py` system prompts, `vani_assemblers.py`
   `format_scanner_user_message()` instruction text — both had to change in
   lockstep, since the LLM sees the system prompt's format rule AND the user
   message's own "write N paragraphs" instruction, and only the system
   prompt had been touched in the first pass).** Both intents now require 1
   opening line + short bullet points (`'• '`-prefixed) instead of "2 short
   paragraphs," with `read_results` capped at **AT MOST ONE bullet naming
   1-2 stocks** (was "2-4 individual names," part of what made responses
   read dense). `explain_preset` relabeled `"What does this screener show?"`
   → `"How to use this scanner"`. Overrides `_VANI_RULES`' house-wide
   "no bullet points" rule per-intent via `.replace(...)`, the same pattern
   `read_results` already used to bump its word count — not a new mechanism.
   Cache-context `'v'` bumped 2→3 (explain_preset) / 3→4 (read_results) so
   old paragraph-shaped cache entries can never be served under the new format.

2. **Owner's explicit intent list, built as real registered VaNi intents —
   corrected mid-design after the owner rejected a "static" shortcut.** I
   initially proposed making the two glossary questions hardcoded frontend
   strings, bypassing VaNi entirely for speed. Owner, verbatim: **"there is
   nothing called static......static is actually handled by inserting the
   record into the DB, so that LLM is never invoked and cache is used."**
   Rebuilt around the existing `km_vani_cache` / `warm-scanner-explainers`
   seed pattern instead:
   - **`scanner.your_view`** ("Your View", owner's 1st-priority intent) —
     personalized: bookmarked stocks in today's results (lead item, or
     "none" stated plainly — never skipped), the top 1-2 stocks by 5D-vs-22D
     momentum acceleration, and the VaNi-highlight count for the full
     cohort. Genuinely varies per user, so `build_scanner_cache_context()`
     hashes the bookmarked-symbol list + accelerator list (not the shared
     row list) — two users with the same bookmarks correctly share a cache
     entry, two with different ones correctly don't, no `user_id` needed.
     `cache_ttl_hours=6` (shorter than `read_results`'s 24 — bookmarks can
     change mid-session). Bookmarks/acceleration are computed **client-side**
     in `BreakoutSurgeStudio.tsx` from data the page already has
     (`useBookmarkStore()` + `score_5d`/`score_22d` already on every row,
     mirroring `ScanFilterBar`'s own `accelerating` gate) — no new fetch.
   - **`scanner.how_bookmarks_work`** / **`scanner.legend_vani_dot`** —
     universal glossary answers (owner's 3rd/4th intents), same for every
     user/screener/date. `build_scanner_cache_context()` hashes these to a
     **constant** (`{'v': 1, 'intent': intent_id}`), ignoring preset/date/
     rows entirely — turns out genuinely global, not "duplicated once per
     preset" as first assumed, since the cache key collapses to one row
     regardless of which preset's context was used to build the message.
     New admin endpoint `POST /api/vani/warm-help-intents` seeds both:
     loops active presets only to find one that assembles cleanly (every
     `scanner.*` intent still requires *a* `preset_id` at the API layer),
     generates once, and every subsequent preset/request hits that same
     cache row. Mirrors `warm-scanner-explainers`'s LLM-call +
     `_sebi_post_filter` + digit-rejection + `_vani_pcache_set` pattern
     exactly — no new seeding mechanism invented.
   - **Deliberately deferred, not built this round:** "new items since
     yesterday" (owner's 2nd sub-item under "Your View") needs Tier B
     (`scannerenhancement.md`) — day-over-day scan-membership tracking via a
     scheduled job + membership table — which does not exist yet; faking it
     from a single day's snapshot would be worse than omitting it. The
     owner's open 5th-intent invitation ("any other which you can
     recommend") was left for a future round rather than guessed at here.
- Files touched: `App/backend/lib/vani_intents.py` (prompt rewrites + 3 new
  `VaNiIntent` definitions), `App/backend/lib/vani_assemblers.py`
  (`assemble_scanner_context()` gains `bookmarked_symbols`/
  `top_accelerators` params; `build_scanner_cache_context()` gains 3 new
  branches; `format_scanner_user_message()` gains 3 new branches + aligned
  instruction text for the 2 rewritten intents), `App/backend/pipeline2_api.py`
  (`VaNiAskRequest` gains `bookmarked_symbols`/`top_accelerators`; new
  `POST /api/vani/warm-help-intents` endpoint), `App/frontend/src/hooks/
  useVaNiChat.ts` (matching optional fields on the TS `VaNiAskRequest`),
  `App/frontend/src/views/BreakoutSurgeStudio.tsx` (`ScannerVaNiCard`:
  3 more `useVaNiAsk()` instances, `ScannerIntentKey` union widened,
  client-side bookmark/accelerator computation, new pills — "Your View",
  relabeled "How to use this scanner", a small help cluster for the 2
  glossary pills).
- `npm run typecheck` and `npm run build` (theme-standard ratchet
  unaffected: 371 hex + 276 rgba, unchanged) both pass clean.
- **Not yet run:** the `warm-help-intents` seed call itself, and a live
  click-through of all 5 pills against the deployed backend — this
  environment has no way to execute Python or hit the running FastAPI/LLM
  service; owner to run the seed call and verify on the VPS deployment, the
  same verification path used for every prior round of this doc.

**v14 — two owner-reported bugs from a live v13 screenshot (2026-08-29).**

1. **Pill text getting clipped ("Toda[y's Results]" cut off mid-word).**
   Root cause: `pillStyle` set `whiteSpace: 'nowrap'` on every pill button.
   `flexWrap: 'wrap'` on the row only wraps BETWEEN items — a single item
   with `nowrap` text that's wider than the row's available width (a real
   risk now that the row holds 7 pills, several with long labels like "How
   do bookmarks work?") simply overflows its row. This page has no local
   scroll affordance to recover that overflow, and `globals.css` sets
   `body { overflow-x: hidden }` as a site-wide reset — so the overflowing
   part of the button was invisibly clipped, not scrollable-but-hidden. Not
   a screenshot crop; a real layout bug. Fixed in `BreakoutSurgeStudio.tsx`:
   `pillStyle` drops `whiteSpace: 'nowrap'` and adds `maxWidth: '100%'` — a
   label that doesn't fit now wraps onto a second line inside its own pill
   instead of extending past the row edge. Worse-looking in the rare case a
   pill wraps, but text can no longer silently vanish.

2. **`scanner.explain_preset` reads as generic screening theory, not
   onboarding.** Owner, verbatim, quoting the live response ("Pair this
   with: relative volume..., sector rotation..., prior support levels..."):
   "is wrong..........highest 22D to 5D intent is not available..........we
   have to tell user how to understand this scanner.......like an
   onboarding, this is not sufficient." Root cause: the v13 prompt told the
   model to name "supporting factors a reader would typically check
   alongside this list" with no constraint on WHAT those factors could be —
   so it filled the slot with textbook vocabulary (relative volume, sector
   rotation, prior support levels) that isn't anything a reader can actually
   click on this page, while the real tool that answers exactly that
   question — the Accelerating filter (5-day vs 22-day pace, i.e. the "22D
   to 5D" the owner is asking for) — went unmentioned, alongside Real Volume
   Behind, Leading Industry, and the VaNi Highlight dot. Fixed by handing
   the model a FIXED, closed list of this page's real on-page tools (new
   `_SCANNER_ONPAGE_TOOLS` constant, `vani_assemblers.py`) and instructing
   it to name 2-3 of THOSE by their exact on-page label, never a generic
   substitute — plus a new bullet pointing at "Your View" (the v13 addition)
   as the personalized next step. This is genuinely onboarding now: it
   walks the reader to the actual clickable tools on the page, not abstract
   screening concepts. `_SCANNER_ONPAGE_TOOLS` is written as shell-wide prose
   (not preset-specific) since these stat tiles/pills are the same shape
   across any scanner page reusing this component — flagged in its own
   comment to keep in sync if a tile's label ever changes.
- Files touched: `App/frontend/src/views/BreakoutSurgeStudio.tsx` (pill
  style fix), `App/backend/lib/vani_intents.py` (`scanner.explain_preset`
  system prompt rewritten, `max_tokens` 350→380, word target 80→100),
  `App/backend/lib/vani_assemblers.py` (new `_SCANNER_ONPAGE_TOOLS`
  constant; `format_scanner_user_message()`'s explain_preset branch sends
  the tools list + a 3rd bullet instruction; cache-context `'v'` for
  explain_preset bumped 3→4).
- `python3 -c "import ast; ast.parse(...)"` on both backend files,
  `npm run typecheck`, and `npm run build` (ratchet unchanged: 371 hex + 276
  rgba) all pass clean.
- **Still not verified live** — same gap as v13: this environment can't run
  the backend or hit the LLM. `explain_preset`'s cache-context `'v'` bump
  means its old seeded answer is dead on the content hash; the very next
  "How to use this scanner" ask (from any user) regenerates it live and
  re-caches — no manual seed re-run needed for this one (that's only what
  `warm-scanner-explainers` is for, and it's naturally idempotent-safe to
  re-run too). Owner to confirm both fixes: a real narrow-viewport
  screenshot for the pill fix, and a fresh "How to use this scanner" click
  for the onboarding rewrite.

**v15 — two more bugs from a follow-up screenshot, both on the primary
"Start with the N Highlights →" pill (2026-08-29).**

1. **Invisible button text, not clipped text.** The screenshot showed a
   solid pill with genuinely NO visible label (not even a partial letter) —
   different from v14's cut-off-mid-word symptom. Root cause: `pillStyle`
   sets `color: 'var(--indigo)'` inline; `primaryPillStyle` spread it and
   only overrode `background`/`border`/`fontWeight`, so it still carried
   that inline `color`. The button separately had `className="text-white"`
   — but an inline `style` prop always wins over a class for the same CSS
   property, no matter the class, so `text-white` was silently losing.
   Result: indigo text on an indigo background, perfectly invisible. First
   fix attempt hardcoded `color: '#fff'` into the style object — reverted
   before shipping, since it tripped the theme-standard ratchet (a NEW hex
   literal line, even though `'#fff'` already exists elsewhere for the
   identical case in `Layout.tsx`'s "Ask VaNi" button — the ratchet counts
   matching *lines*, not unique values, so every new line pays regardless
   of precedent). Real fix: destructure `color` OUT of the spread
   (`const { color: _pillTextColor, ...pillShape } = pillStyle`) so nothing
   inline competes with `className="text-white"` any more — no new literal,
   and it uses the Tailwind utility as originally intended instead of
   fighting it.
2. **"Nothing happens when clicked."** The click itself was always wired
   correctly (`onApplyHighlights` sets `quick.hl = true`, which the `filtered`
   `useMemo`-equivalent chain already read) — but the VaNi card sits well
   above the actual results table (past the stat-tile grid), so applying the
   filter produced zero visible change anywhere near the click. Fixed by
   adding a `resultsRef` on the filter-bar/table row and calling
   `scrollIntoView({ behavior: 'smooth', block: 'start' })` from both
   `onApplyHighlights` and `onApplyWatchlist` — `scrollMarginTop: 88` clears
   `Layout.tsx`'s sticky topbar so the scrolled-to row doesn't land
   underneath it.
- Files touched: `App/frontend/src/views/BreakoutSurgeStudio.tsx` only.
- `npm run typecheck` and `npm run build` (ratchet unchanged: 371 hex + 276
  rgba, confirming the destructure approach avoids the literal) pass clean.
  `npm run lint` errors on a pre-existing missing `eslint.config.js` in this
  repo, unrelated to this change.

**v16 — `scanner.why_highlighted`: a real explanation, not just a filter
(2026-08-29).** Owner push-back, verbatim: "you are using this as a
filter.........VaNi intent is for explanation -- tell why those 15 (each
stock name or something else) are picked to be highlighted." Confirmed via
`AskUserQuestion`: aggregate stats + 1-2 named examples (not all 15 — stays
inside the same 1-2-name convention every other intent on this page already
uses, to avoid reading as a curated stock list), as a NEW intent fired by
the Highlights button itself (in addition to, not instead of, its existing
filter-apply + scroll).

**Bug found while building it: `legend_vani_dot`'s glossary answer was
factually wrong, not just vague.** It claimed the highlight dot means "a
stock whose reward-to-risk structure, measured against its own ATR, sits in
a favorable zone." Tracing `computeVaniOpportunity()` in `scanEngine.ts`
shows that's a different, unrelated mechanism (the `reward`/`rewardPct`
fields used elsewhere, e.g. Visual Pulse) — the REAL gate is keyed per
preset by `vani_rule`, and there are ~10 different rules across presets
(RVOL + 52-week-high proximity, SVD + delivery conviction, a Golden Line
event, oversold, etc. — see `computeVaniOpportunity`'s switch and
`backfill_vani_flags.py`'s SQL). For `breakout_surge` specifically the rule
is `is_vani_surge_or_breakout`: RVOL surge + closeness to the 52-week high +
healthy RS, nothing to do with ATR. Fixed `legend_vani_dot` (system prompt
in `vani_intents.py` AND the matching instruction text in
`format_scanner_user_message()` — both had the same wrong claim, so both
needed fixing) to describe the SHAPE honestly ("an extra, screener-specific
quality bar... the exact combination varies by screener") instead of
asserting one mechanism universally. Cache-context bumped to `v: 2` for this
intent specifically (not `how_bookmarks_work`, which was never wrong) so the
old incorrect cached answer can never be served again.

**`scanner.why_highlighted` implementation:**
- `computeHighlightExplainFacts()` (new, `breakoutSurgeInsights.ts`) — over
  the FULL day's cohort (`all`, matching `computeCohortStats()`'s scope, not
  whatever's currently filtered into view): count, average RVOL, average
  closeness to each stock's own 52-week high, average Magic RS, and up to 2
  named examples ranked by RVOL. Pure client-side computation, no new fetch,
  same "compute in code, narrate in prose" principle this file's docstring
  already states.
- `ScannerVaNiCard` gains a 6th `useVaNiAsk()` instance
  (`whyHighlightedMutation`) and a `showWhyHighlighted()` handler; the
  "Start with the N Highlights →" button's `onClick` now calls BOTH
  `onApplyHighlights()` (existing filter+scroll) AND `showWhyHighlighted()`
  — one click, two effects, both real. `allStocks` (the full unfiltered
  cohort) threads down from `BreakoutSurgeStudio` as a new prop alongside
  the already-filtered `rowsForContext`.
- New intent `scanner.why_highlighted` (`vani_intents.py`): opening line +
  count/shape, then 2 bullets — name the 1-2 given examples with their real
  RVOL/closeness-to-high numbers, then state plainly this is a measurement
  of unusual participation, never a buy signal. `cache_ttl_hours=24` (daily
  facts, not personalized, not universal).
- `assemble_scanner_context()` gains `highlight_facts` param +
  `_clean_highlight_facts()` sanitizer; `build_scanner_cache_context()` and
  `format_scanner_user_message()` get matching branches, including a
  zero-count path ("nothing highlighted today") instead of describing
  criteria in the abstract when the cohort is empty.
- `VaNiAskRequest` (both `pipeline2_api.py` and `useVaNiChat.ts`) gains a
  matching optional `highlight_facts` field.
- Not pre-seeded via `warm-help-intents` — unlike the two glossary intents,
  this one's answer genuinely changes every trading day (real per-day
  facts), so it stays on the normal 24h cache path like `read_results`.
- Files touched: `App/frontend/src/services/breakoutSurgeInsights.ts`,
  `App/frontend/src/views/BreakoutSurgeStudio.tsx`,
  `App/frontend/src/hooks/useVaNiChat.ts`, `App/backend/lib/vani_intents.py`,
  `App/backend/lib/vani_assemblers.py`, `App/backend/pipeline2_api.py`.
- `python3 -c "import ast; ast.parse(...)"` on all 3 backend files,
  `npm run typecheck`, and `npm run build` (ratchet unchanged: 371 hex + 276
  rgba) all pass clean. Not verified live — same standing gap as every prior
  round: this environment can't run the backend or hit the LLM.

**v17 — "My Watchlist" had the same gap "Start with the N Highlights" had
before v16, plus a loading-consistency ask (2026-08-29).** Owner, verbatim:
"'my watch listh' intent wont work -- and also put a nice loader for vani
for sometime and then load the content, irrespective of cached or LLM."

1. **"My Watchlist" was filter-only, same as Highlights used to be.** Its
   `onClick` applied the `watch` quick-filter and scrolled, but never fired
   any VaNi intent — reads as "won't work" once the Highlights button sets
   the expectation that a highlight-adjacent action also explains itself.
   Fixed the same way v16 fixed Highlights, but with less new code needed:
   `scanner.your_view` already covers exactly "your bookmarked stocks in
   today's results" as its lead bullet, so the fix is just wiring the
   button's `onClick` to also call the existing `showYourView()` — no new
   intent, no backend change. The pill also picks up `activePillStyle` when
   `your_view` is the active intent, matching the "Your View" pill's own
   highlighting (both trigger the same underlying intent).
2. **Loading floor.** A cache hit (either glossary intent, or any repeat
   ask) can resolve in well under 100ms; a live LLM call takes a couple of
   seconds — with no floor, the spinner either flashes or doesn't appear at
   all for a cache hit, an inconsistent feel with no visible cause to the
   user. New `useMinVaNiLoading()` hook (`BreakoutSurgeStudio.tsx`) holds
   `isLoading` true for at least `MIN_VANI_LOADING_MS` (700ms) from the
   moment a mutation starts, independent of when it actually resolves — a
   genuinely slow call is unaffected (if still pending once 700ms has
   passed, that's just the real state). Content is withheld while holding
   (`insight={showLoading ? undefined : ...}`), not just the spinner shown
   early, so text can't flash in before the floor elapses. Applied to both
   the main card (bound to whichever intent is currently `active`) and,
   separately, to the action-pills-visible gate (`readDone`, bound
   specifically to `readMutation` since it fires eagerly regardless of
   which intent is selected) — otherwise the pills could pop in before the
   card's own held content finishes its beat.
- Files touched: `App/frontend/src/views/BreakoutSurgeStudio.tsx` only.
- `npm run typecheck` and `npm run build` (ratchet unchanged: 371 hex + 276
  rgba) pass clean. Not verified live — same standing gap as every prior
  round.

**v18 — VaNi masthead card shipped product-wide, plus scanner-preview's own
mobile fit (2026-09-02).**

1. **`VaNiInsight.tsx` masthead redesign, implemented.** The card style
   proposed and approved earlier in the "VaNi Card Identity" artifact —
   replaces the v1 low-alpha tint + left rail (which read as barely-there on
   Jade Thorn light's parchment ground) with a masthead band (a small filled
   badge + "VANI वाणी" wordmark, on a tint of the theme's own accent) sitting
   above a plain elevated card body (`var(--kd-card)`). Every color is a
   token (`--accent-indigo`, `--kd-card`, `--border`), so it inherits any
   theme automatically — no new literals, ratchet unaffected. Since this is
   the ONE shared component every VaNi surface uses, this single file change
   reaches everywhere at once: every scanner intent on this page, every
   Dashboard/Panchang/Breadth/Chart card, and the side drawer. `fadeTo`'s
   default changed from `var(--bg)` (page background, correct for the old
   near-transparent tint) to `var(--kd-card)` (the new body's own solid
   background) — no caller currently overrides `fadeTo`, so this was a safe
   change, not a breaking one.
   - Verified visually the same way as the v15/v17 rounds: a temporary
     unauthenticated preview route rendering `VaNiInsight` directly with
     sample text (real Breakout Surge copy) + a loading state, screenshotted
     via Playwright, confirmed against the approved mockup, then reverted
     (`git diff` on `App.tsx` confirms no residual changes).
2. **Scanner-preview's own mobile fit** (separate from the v17 app-shell
   fix, which only covered the sidebar/topbar — this page's own content had
   never been touched for mobile). Owner's assumption confirmed correct on
   inspection, not just guessed at:
   - The page's own `ScanTable` already had a contained internal horizontal
     scroll (`overflowX: 'auto'` + `FloatingHScrollbar`) — NOT broken, just
     dense (expected for a data table on a phone; the existing `viewMode:
     'cards'` toggle is the better mobile path, unchanged here).
   - Two REAL gaps fixed: (a) the header row (title/description +
     Download/TradingView export buttons) had no `flexWrap` — the buttons
     are `flexShrink: 0`, so on a narrow screen the pair alone could exceed
     the available width with no way to scroll back to them
     (`body{overflow-x:hidden}`, no local scroll region there) — same
     clipping failure mode as the v14/v15 button bugs, just a different
     row. Added `flexWrap: 'wrap'` so the buttons drop to their own line
     instead. (b) the outer page padding (`28px 32px 48px`, inline, fixed)
     wasted ~17% of a 375px phone's width on side padding alone — replaced
     with responsive Tailwind classes (`px-4 pt-7 pb-12 sm:px-6 md:px-8`).
   - The stat-tile grid (`repeat(auto-fit, minmax(160px, 1fr))`) and the
     filter/exchange-tabs row (already `flexWrap: 'wrap'`) were already
     fine — CSS grid `auto-fit` and an existing wrap both degrade correctly
     without help.
- Files touched: `App/frontend/src/components/domain/VaNiInsight.tsx`,
  `App/frontend/src/views/BreakoutSurgeStudio.tsx`.
- `npm run typecheck` and `npm run build` (ratchet unchanged: 371 hex + 276
  rgba) pass clean. The masthead redesign was visually verified live (see
  above); the two mobile fixes were verified by code review against the
  same `body{overflow-x:hidden}` failure pattern already proven twice this
  thread, not by a live mobile screenshot of this specific page (no live
  scan data reachable from this environment to render the real table/tiles).

**v19 — production-breaking hooks-order bug from the v17 loading-floor
change, found live (2026-09-02).** Owner report: "whenever i try accesing
preview scanner - it goes to landing pabe" — but every other page in the
product worked fine on the same active session, ruling out an auth/session
issue (`ProtectedRoute` gates every protected route identically; nothing
route-specific there).

Root cause: v17 added two `useMinVaNiLoading()` calls (plus the
`mutationByIntent`/`active`/`readShowLoading`/`readDone` block that feeds
them) to `ScannerVaNiCard`, but placed them AFTER the pre-existing
`if (!dataDate) return null` early return, not before it. `dataDate` is
`null` on the first render (before `useScan`'s query resolves) and becomes
truthy once real data arrives — so on the first render those two hooks are
never called at all, and on the very next render they suddenly are. React
requires the exact same hooks in the exact same order on every render of a
component; a changed hook COUNT between renders is a hard error ("Rendered
fewer hooks than expected"), not a warning — it unmounts the component, and
since nothing local catches it, crashes up to the app's top-level
`ErrorBoundary`. This reproduces on essentially every real visit, the
moment scan data arrives — which is why it looked total/instant rather
than intermittent. (The exact "goes to landing page" symptom vs. the
ErrorBoundary's own "Something went wrong" fallback screen wasn't traced
further — the hooks violation is unambiguously wrong regardless of the
precise resulting UI state, so it was fixed on that basis rather than
chasing the redirect mechanism.)

Fixed by moving the `mutationByIntent`/`active`/`readShowLoading`/
`readDone`/`showLoading` block (including both `useMinVaNiLoading()` calls)
to before the `if (!dataDate) return null` line, so every hook in this
component is now called unconditionally on every render regardless of
`dataDate`. Also re-audited both `ScannerVaNiCard` and the outer
`BreakoutSurgeStudio` component end-to-end for any other conditional-hook
pattern — none found; this was the only one.
- Files touched: `App/frontend/src/views/BreakoutSurgeStudio.tsx` only.
- `npm run typecheck` and `npm run build` (ratchet unchanged) pass clean.
  Not verified against a live render — same standing gap as the mobile fit
  fixes above; owner to confirm the preview page loads once redeployed.
