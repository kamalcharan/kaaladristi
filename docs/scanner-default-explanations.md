# Price Action default explanations — first cut

Automatic introductions are enabled for Breakout Surge, Flower Pot Burst, Weekly Movers, Monthly Movers, Breakdown Surge, Weekly Decliners and Monthly Decliners. Golden Line Breakout and Golden Line Retest are explicitly excluded.

The existing VaNi shell opens Explain [scanner] with three sections: what it finds, how to read the results, and a qualification. Understand the signals expands the relevant educational context. Existing action questions and their response controls are unchanged; selecting an action collapses the introduction. Reopening an introduction does not change filters or call an API.

Content is maintained in src/constants/scannerIntroductions.ts, version 4, and shipped with the frontend bundle. There is no time-based expiry, generated-text cache or recurring LLM request. Increment the content version when the copy or underlying rules change. This educational text has no session-specific stocks or counts.

The introductions distinguish scanner admission from supporting metrics. Weekly/monthly changes reference the prior period close; 5D/22D scores are not day-over-day acceleration; RSI is not an admission condition; MagicRS supplies relative-strength context against NIFTY 500. No proprietary calculation is exposed.

Frontend deployment only. Validation: check-scanner-introductions.mjs covers all seven auto-open introductions, Golden Line exclusion, zero API calls and responsive layouts in both modes. check-scanner-vani.mjs checks existing action requests, filters, depth and evidence. No production records or model calls are used by these tests.

All seven supported scanners now use theme-aware SVG teaching illustrations and four expandable signal cards. Each card explains the reading, its relevance and its limits. Diagrams are labelled as illustrative, contain no live values and expose no proprietary calculation. Daily diagrams show a range break; weekly and monthly diagrams compare the latest close with the previous period close. Golden Line remains excluded, and VaNi Highlight is unchanged. Browser checks cover keyboard expansion and capture light/dark mobile/desktop previews.

Flower Pot visuals explicitly distinguish COIL, upside BURST and downside SHATTER. Both directions are labelled and illustrated; neither is presented as a guaranteed outcome. Signal cards and phase explanations use the same terminology.
