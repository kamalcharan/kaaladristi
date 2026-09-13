# Scanner highlight authority

Breakout Surge (including its old daily alias), Breakdown Surge, Weekly/Monthly Movers, Weekly/Monthly Decliners and Flower Pot Burst use km_scan_results exclusively. The frontend maps vani_flag, including false, and never reconstructs highlight eligibility. Flower Pot keeps its phase-specific columns without overriding the flag.

A failed request or invalid/missing flag fails visibly. A successful empty result stays empty. Empty badge counts do not invoke the legacy scanner. The old direct-query implementations and Flower Pot calculation were removed. Golden Line and other scanner families are outside this change.

Breakout Surge's existing why-highlighted intent now includes shared evidence cards with counts, up to three stock links and measured context. Existing filters remain active. Model instructions distinguish supporting observations from unprovided database qualifying rules. Highlight response cache version is bumped and includes exact supplied facts to avoid reusing stale metric descriptions. Database eligibility rules have not changed.

PostHog events: scanner_load_failed (source and categorical reason), scanner_intent_selected (intent, session, exchange and highlight count), scanner_highlight_explanation_shown/failed, scanner_evidence_opened, scanner_highlight_stock_opened. These use the existing product analytics wrapper and require configured PostHog credentials. No response text or raw errors are sent.

Validation: 40 browser database-authority cases cover eight IDs, request failures, empty results, missing flags, true and false flags and absence of alternate queries. Existing VaNi browser tests cover light/dark mobile/desktop interactions. Typecheck, production build and backend scanner/routing tests pass. Live VPS database, LLM and analytics delivery still require deployment verification; no live rules were inferred or changed.

Highlight presentation revision: the headline uses a prominent count badge; model prose is rendered inside a themed reading card with highlighted stock names and numbers. Supporting cards show averages, coverage counts, RSI and score-horizon context. The model receives these same coverage and mixed-evidence counts. The old generic interface paragraph is removed, and failed model calls retain the visible error/retry state. Highlight cache version 3 invalidates older responses. Browser checks use mocked model text; live response quality remains a VPS validation item.
