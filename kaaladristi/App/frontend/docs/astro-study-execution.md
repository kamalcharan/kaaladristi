# Astro Study: first review boundary

Implemented on codex/astro-study. No database migration or backend deployment needed for this stage; existing published-event APIs must be deployed.

## Reuse audit
- Almanac remains EventWorkspace in calendar mode; /almanac URLs and query parameters remain valid. /astro adds the menu entry, /astro/study is separate from ChartView.
- Published occurrences: services/astroEvents.ts, /api/astro/events, same visibility and client calendar horizon as Almanac. No fallback legacy events or synthetic production dates.
- TradingChart uses TradingView Lightweight Charts, not the hosted TradingView widget. Study uses the same workspace-mode price chart, CockpitOverlayStrip and CatalogDrawer as ChartView. MagicRsSubchart inside SignalFlipCard and CockpitIndicatorPanels supply the current MagicRS and momentum widgets; legacy fused subpanes are not used.
- MagicRS is stored versus CNX500 (ChartView documents this). It is not a new sector/NIFTY ratio calculation.
- km_index_eod via the existing authenticated PostgREST adapter supplies the same indicator columns as ChartView. Bounded paginated reads avoid the server row limit and use historical dates instead of today-relative ranges. No auth, schema or grants changed.
- Existing chart popovers now carry canonical event identity/index/date to Study. Opening Study does not change saved Workspace overlays or framework configuration.

## Historical contract
- Astronomical dates/timestamps remain untouched, including weekends and sample brackets.
- Initial market snapshot is the last recorded trading session on/before the event date. It is explicitly EOD, not intraday knowledge at event time.
- As-of mode excludes rows after the event date in the request AND renderer. Switching back while a query loads cannot expose later cached rows.
- Missing stored indicators are unavailable, never filled from current values. Data may reflect later historical corrections; this is not a versioned point-in-time archive.
- Event selection and session/index/replay mode use URL parameters. Viewport is preserved when earlier data arrives. A new occurrence/index resets chart state.
- White-space dates on all chart panes preserve event coordinates without inventing market observations.

## Remaining stages (TODO)
- Breadth/ROC story: prior condition, selected-session change, persistence/divergence after the event; compact price context plus synchronized existing breadth/ROC components. VIX and universe labels; show true historical coverage.
- Historical sector leadership and up-to-three normalized ratio comparisons. Audit benchmark identity, adjusted price series and curated membership history first. Distinguish flows, relative returns and participation.
- VaNi contextual intents, QWEN/Haiku routing, cache keys by event/session/index/data version, loader, feedback and analytics integration. This page does not yet call an LLM.
- Calendar's upcoming/active/past UX refinement after the technical study review.

## Verification
- npm run typecheck
- npm run build (Windows scripts need Git Bash for their grep expressions)
- node scripts/qa/check-astro-workspace.cjs
- node scripts/qa/check-astro-study.cjs
- node scripts/qa/check-astro-study-browser.mjs (headless Edge by default; ASTRO_QA_BROWSER may override)

Browser test uses controlled fixtures, not production data. It renders the real chart and tests EOD weekend alignment, replay cutoff, session stepping, fullscreen escape, earlier occurrences/history and mobile width. Live historical values still require user comparison with deployed records.

## User review
1. Astro > Calendar > Dates > Study market context; repeat from a ChartView event popover.
2. Confirm event date/index survive navigation and refresh; use sign filter and previous occurrence.
3. Compare close, MagicRS/MagicMA and RSI with ChartView on exactly the same session/index.
4. Reveal later sessions, step forward, then return to As of event: no later candle/indicator should remain.
5. Test a weekend and a missing-history event; inspect explicit EOD/source labels.
6. Pan left or load an earlier year; verify stable viewport. Test fullscreen/Escape and mobile.
7. Confirm Workspace selections and normal ChartView behavior remain intact.

## Review corrections
- The initial branch used legacy TradingChart indicator panes and one fixed occurrence band. Replaced with the actual current ChartView widgets and shared Catalog/overlay strip.
- Multiple published Mercury/Venus records are loaded through useAstroOverlayBands for the study dates. Explicit study focus can be unpinned; it is deduplicated against active planet overlays by canonical event key.
- Framework overlay changes use the existing shared preferences. Merely opening Study does not mutate them.
- Momentum and MagicRS Chart-face now accept optional historical selection callbacks/date guides; default ChartView callers keep their existing behavior. MagicRS Widget receives the historical active index and stored momentum/zone columns.


## ChartView history and event clarity

ChartView daily history loads adjacent 500-session pages when the user pans to the left edge, or selects Earlier history. Pages include stored indicators and extend the astro overlay query automatically. Zoom and visible dates are preserved; range, timeframe or instrument changes start a fresh viewport. Weekly/monthly retain their existing full-history behavior. Initial and older-history loads have visible status; failures offer retry and exhausted history is identified.

Technical events default to five major labelled events within the visible window. Users can filter categories, show all events grouped by session, or hide story annotations. Clicking a grouped marker opens the session's explanations. Signal dots and swing pivots are independently opt-in; replay continues using the full event sequence. Index story annotations no longer require an equity setup to render. This removes a rendering gate; it does not invent missing index scanner or journey data.

Verification: check-chart-history.cjs covers stock/index boundaries, chronological ordering, missing indicators and failures. check-chart-history-browser.mjs covers grouped-marker interaction, preserved viewport and actual left-edge panning; Astro Study browser regression verifies existing overlays/widgets continue working.


## Restore technical visibility (owner correction)

All story-event categories and candle signal markers are visible by default again. The Major only mode and its event suppression were removed. Existing callout promotion still chooses a small set of labels; every other story event remains represented by the session markers. Optional user filters, grouped-session explanations and continuous history remain. SVD/SBD/SYD, swing pivots and Big Money candle markers are restored without an icon redesign.
