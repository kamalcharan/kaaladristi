# Astro context in ChartView

There is one chart experience: ChartView owns TradingChart, historical price paging, technical events, SVD/SBD/SYD dots, swing flags, replay, RSI/MFI, MagicRS and framework overlays.

Calendar event links now open /chart/index/:id with canonical event identity and calendar date. Saved /astro/study links redirect there, preserving index, event, date, sign and observation mode. The separate AstroStudyPage renderer and its stylesheet have been deleted. ChartAstroControls and useChartAstroContext handle event metadata and selection only; they do not render charts or fetch market indicators.

Selecting an event loads stored market rows around its historical date through the existing paginated indicator service. Panning left uses ChartView's existing history loader. Framework planet overlays can be combined using the existing + Overlay drawer. The selected canonical occurrence is included without modifying the saved framework. The named event uses the existing overlay renderer; its date never moves to a trading session.

As of event limits market rows to the event date (or today for an upcoming event). Explore what followed includes recorded observations through today, so scrolling right is not capped at an artificial post-event window, and is explicitly retrospective. Weekend readings use the last completed trading session on or before the event date. Stored missing indicators remain unavailable. Current VaNi prose is not presented as a historical reading; breadth requires an exact matching date. Event-day observations are EOD, not intraday knowledge at the event timestamp. Historical data can contain later revisions.

## Verification

- npm run typecheck
- npm run build
- node scripts/qa/check-astro-study.cjs
- node scripts/qa/check-astro-study-browser.mjs: actual ChartView via Calendar helper and saved Study redirect, weekend alignment, observation cutoff, shared overlays/widgets/signals, previous/next occurrence and loader.
- node scripts/qa/check-chart-history-browser.mjs: shared TradingChart marker layout, event bands, 40 candles, mobile clusters and history paging.

Browser checks use controlled fixtures, not production records. No migration or backend deployment is required. Breadth/ROC narrative and historical sector ratio comparisons remain additional work; this consolidation does not invent those datasets or evidence.
