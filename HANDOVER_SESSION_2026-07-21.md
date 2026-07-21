# Session Handover — 2026-07-21

Branch: `claude/init-and-ping-neu9k6` (merged to `main` at end of session, PR #189).
Scope: Thesis tab signal-feed correctness, a new cross-cutting "Clean Breakaway"
signal, scanner/VaNi UX + accuracy fixes. **8 commits, frontend + docs only —
no backend or DB changes this session.**

---

## Deploy note

**Frontend-only.** No migrations, no `pipeline2_api` changes. A rebuild +
redeploy of the frontend is the only step needed to ship this session's work.

---

## What shipped this session

### Thesis tab (`services/thesis.ts`, `ThesisTab.tsx`)
- **"Recent Warnings" was silently bear-only** — `thesis.ts` filtered
  `buildStoryEvents()`'s output down to `tone === 'bear'` before the UI ever
  saw it, so the feed only ever showed deterioration even while a stock was
  actively confirming higher. Removed the filter; renamed to "Recent
  Signals"; added a tone dot per row (independent of the existing per-kind
  color) so direction reads at a glance.
- **Fixed a numerator/denominator bug producing "4/3"** — `alignedNow`
  counted every pillar with `aligned === true` regardless of whether it had
  data, while `total` excluded no-data pillars. Liquidity's `aligned` flag
  reads `delivery_surge_x` while its displayed value reads `delivery_pct` —
  on bars where one is null and the other isn't, the pillar voted in the
  numerator while excluded from the denominator. Added `alignedRatio()` to
  derive both sides from the same `withData` set, reused for the entry
  scorecard and the trend comparison (same unguarded pattern existed there
  too).

### New "Clean Breakaway" signal (`services/storyEvents.ts`)
- Detects when `magic_rs` separates from its own `magic_ma` in a clean,
  mostly one-directional move over 8 sessions (slope + day-over-day
  agreement ratio), vs. a choppy move that happens to land in the same zone.
  Fires once on the transition, bull/bear symmetric.
- **Three consumers from one detection, no extra wiring**: the Thesis signal
  feed, a chart marker in Chart & Replay Story Mode (`StoryMode.tsx` already
  consumes `StoryEvent` generically), and a new "Clean read" section on the
  RS-Rotation panel (`RotationGraph.tsx` + `ChartView.tsx`).
- Registered in the Catalog (`constants/catalogItems.ts`) as an indicator —
  **metadata only**. See "Not done" below.

### RS-Rotation panel (`RotationGraph.tsx`)
- First pass added a quadrant-durability stat + transitions list in the
  panel's dead space — **caught on review as redundant** (it just restated
  what the trail's dot colors already show). Replaced with the Clean
  Breakaway read instead: a different pair of series (RS vs its own MA, not
  RS vs momentum), so it's genuinely new information.

### Bookmark toggle race (`stores/bookmarkStore.ts`)
- The 2026-07-19 fix (`4753bba`) closed one ordering of the load/toggle race
  but not the reverse: a `load()` already in flight when the user clicks
  (the common case on a scanner page — several `BookmarkToggle` mounts
  trigger one real fetch) could resolve *after* a fast toggle's optimistic
  entry had already been cleared by `settle()`, letting the stale pre-click
  server snapshot win. Reproduced live on Breakout Surge (a bookmark star
  flashed on then reverted, nothing written to `km_user_bookmarks` —
  confirmed via DB query, not a guess). Replaced the clear-on-settle map
  with a `confirmed: Map<equityId, {want, at}>` ledger keyed by timestamp —
  `load()` now compares its own start time against each entry instead of
  presence/absence, so ordering of which call resolves first no longer
  matters.

### Scanner UI (`ScanView.tsx`)
- Moved "VaNi explains this screener" into the title row (top-right of the
  `<h1>`) instead of its own line below the description/tooltip.
- Removed the dismissible "New to scanners? Strength Confluence..." banner
  entirely (component + its localStorage-dismiss logic).
- Net: ~2 rows of vertical space recovered above the results table.

### VaNi scanner date accuracy (`VaNiChatPanel.tsx`, `usePipelineStatus.ts`, `dateUtils.ts`)
- "Read today's results" is only accurate when the confirmed pipeline date
  is literally today — usually isn't (EOD data lands after close). Button
  now reads "Read 20 Jul 2026 results" using the real confirmed date.
- Fixed the underlying leak this exposed: the raw ISO date (`2026-07-20`)
  was sent as the scanner's `data_date` and echoed verbatim into VaNi's
  "As of the {date} close…" opener. Now sends a human-formatted date for
  that display-only field.
- **Did not** touch the generic `date` field used by equity/dashboard
  intents — those drive real backend date lookups (`target_date=date_str`
  in `pipeline2_api.py`) and must stay ISO. Checked this explicitly before
  shipping; an earlier draft of the fix would have broken it.
- Added `dateUtils.fmtDateLong` ("20 Jul 2026") and pointed
  `usePipelineStatus.latestDataDateFormatted` at it — consolidates a third,
  hand-rolled duplicate of the same format that lived inline in
  `DataFreshnessChip.tsx` (now reads from the shared hook).

### Docs
- `docs/claude/VIX-Upgrade.md` — parked proposal. India VIX is tracked and
  displayed (Sector Rotation header, Workspace ticker rail) but is not a
  scoring input anywhere; `risk_engine.py`'s `score_volatility` is 100%
  Vedic-astrology-derived, a naming collision worth fixing regardless of
  which tier (if any) gets built. Two-tier plan + Tier 2's impact analysis
  in the doc. Cross-referenced from `CLAUDE.md`'s Known Issues.

---

## Not done / flagged during the session

- **Clean Breakaway on the Workspace "+ Overlay" chart** (the user-configurable
  canvas, distinct from Story Mode) — the Catalog entry is registered but
  inert there. `TradingChart.tsx`'s `workspaceMode` overlay rendering only
  knows how to draw continuous db-column lines (`OVERLAY_COL` map) today,
  not an event list. Wiring this up means real surgery on a shared,
  1000+ line chart component — scoped as its own follow-up rather than
  rushed without the ability to visually verify it in this environment.
- **Breakout Surge's VaNi explainer cache is stale relative to the current
  tooltip** — two old `km_vani_cache` rows for `scanner.explain_preset` +
  Breakout Surge only describe "closed above a 20-day high," never
  mentioning the ₹50 price floor / NSE+BSE exchange preference / Score 5D
  ranking that the *current* live tooltip already documents. Nothing is
  broken (a fresh ask misses the stale cache and regenerates live), but
  nobody's verified the explanation reads well once it accounts for the
  fuller criteria. Flagged, not fixed.
- **VIX Upgrade** — parked per the doc above, owner to revisit.

---

## Next session: Astro layer

Owner's stated focus for the next session. No specific scope was defined in
this session — starting from a clean slate. Existing orientation points
already in the repo that likely intersect:
- Rules Engine (`docs/claude/rules-engine.md`, `km_astro_rule_master` →
  `scripts/rule_discovery.py` → `km_rule_signals` → `km_rule_confidence`).
- Astro Calendar / DC inference (`dc_inference`, `dc_lookup` tables; CLAUDE.md
  Rules Engine section).
- Astro overlays on charts (`useAstroOverlayBands.ts`, `astroOverlayService.ts`,
  the `astro_zone` `ChartOverlay` type) — the same overlay pipeline this
  session's Clean Breakaway work deliberately did NOT touch (see "Not done").
- Catalog's Astro Rules tab (`CatalogAstroSection.tsx`) — synthetic
  `astro_rule:${rule_code}` IDs, not in `catalogItems.ts`.

Recommend starting the next session by asking the owner what specifically
"astro layer" means before assuming scope — the term could point at any of
the above, or something new.
