# ICP and scanner experience update

The saved km_profiles persona remains the shared user context. No new tenant store or database fields are introduced. Saving validates the returned persona and answers and updates authStore from the saved response, preserving existing enriched profile metadata. A failed save cannot show success or enable the updated Guide link.

Onboarding and Account use the same two plain-language questions: holding period and discovery preference. Still exploring/help me explore leave the existing nullable fields unset. Holding period determines the initial persona when present; discovery preference supplies a starting persona otherwise; a manual profile choice overrides this. Optional exit preferences remain saved but no longer determine persona. Saved persona and answers are restored when unfinished onboarding resumes. Current workspaces are preserved when preferences change.

New workspace templates contain the four scanners shown for that persona, placed below the template's other blocks. Existing templates are not mutated. Scanner block titles use public scanner names.

Category defaults:
- Investor: Price Action Golden Line Retest; Stage Analysis Stage 2 Leaders; Flow Conviction Flow; Market Quiet Rising Flow; Discovery Waking Giants.
- Swing: Price Action Breakout Surge; Stage Analysis Stage 2 Leaders; Flow Strength Confluence; Market Leading Flow; Discovery Waking Giants.
- High-intensity: Price Action Flower Pot Burst; Stage Analysis Stage 2 Leaders; Flow Volume Drive; Market Leading Flow; Discovery Waking Giants.

The recommendations include the four core scanners and the category starting points. The category selector replaces the scanner sidebar. Sibling tabs remain in stable order, with a visible count and recommendation badges. Explicit scanner URLs are preserved. If a configured category default is unavailable, use that category's existing default.

Price Action VaNi opens on demand from the header; stock-row questions reuse the companion space. Wide screens can pin it beside results; phones use a sheet. Existing intent payloads, filters, evidence and feedback remain unchanged. Flower Pot Burst retains its own API and answer format.

Validation: persona derivation and nullable choices; starter scanner/template consistency; actual Account-to-Guide UI for all three personas; saved category defaults; failed saves; mobile overflow; scanner dialog/pinning, original seven intents, depth/filter separation, evidence, light/dark desktop/mobile; typecheck and production/theme build. Browser tests use isolated synthetic profiles and mocked APIs. Live deployment and beta feedback remain necessary; no production profile records were edited during testing.
