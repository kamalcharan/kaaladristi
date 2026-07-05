# Parked / Deferred / Product Direction — Full Reference

> Moved verbatim from CLAUDE.md.

## Parked — Pending Review
### scanConvictionFlow + scanBreakoutSurge — VaNi rule migration deferred
- Status: still using inline `is_vani` local variable as fallback
- Blocked on: `is_vani_surge` and `is_vani_breakout` columns not yet in ScanDataBundle EOD SELECT
- What's needed:
  1. Add `is_vani_surge` and `is_vani_breakout` to the `km_equity_eod` SELECT in `loadDailyBundle()`
  2. Add both fields to `EquityEodSnapshot` type in `types/index.ts`
  3. Replace inline `is_vani` block in `scanConvictionFlow` and `scanBreakoutSurge`
     with `computeVaniOpportunity(eod, SCAN_PRESETS.find(p => p.id === '...').vani_rule)`
- File: `App/frontend/src/services/scanEngine.ts`
  - `scanConvictionFlow` lines ~915–919 (inline `is_vani` flag)
  - `scanBreakoutSurge` lines ~990–994 (inline `is_vani` flag)
  - `loadDailyBundle()` EOD SELECT ~line 163 (add the two columns)
- Until then: VaNi chip counts for conviction_flow and breakout_surge
  continue to use the existing inline logic (no regression)

### BAY-R14-VEN-LON (Venus Longitude Unit Cycle — Bayer Rule 14)
- Status: catalog_visible = false (hidden from users)
- Transit rows: 12,963 (fires every 1-2 days — too frequent)
- Confidence scoring: NOT RUN — nifty_return_pct = NULL
- Body rendering: uses standard AstroRuleBlockContent (no code change needed)
- Action required before publishing:
  1. Run confidence_scoring.py for BAY-R14 rule_id
  2. Review scored data — does the correlation hold?
  3. If valid: flip catalog_visible = true
  4. If too noisy: consider aggregating to weekly signal
     instead of daily unit completions
- Reference: Bayer Rule 14, Venus geocentric longitude
  unit = 1°9'13" (1.1536°), key reversal signal for
  banking stocks per Bayer 1940 handbook

---

## Deferred — UX Review + Story-telling Session
- Full workspace UX review — story-telling, information hierarchy, user guidance
- LLM inference notes — replace template strings with Qwen3 calls (temperature 0.3,
  /no_think) with template fallback on failure. Covers all four correlation shapes.
- Action Island observations — wire VaNi live state text
- "Mark on chart" — CorrelationDrawer stub button needs to highlight overlap instances on WorkspaceChart (not yet wired)
- Companion: dristiQ-interaction-spec.md Section 6.4 + 16.6

## Deferred — UX & Story-telling Sprint (June 2026)
| Item | Why deferred | When |
|------|-------------|------|
| Morning brief — screener top 3% feed | Depends on screener session | After screener session |
| Master Frameworks catalog section | Full feature — LLM briefing, admin creation, user templates | Post cashflow |
| Astro Rules catalog improvements | Separate session | Next astro session |
| Scanners catalog | Separate session | Next scanners session |
| ~~LLM inference notes — correlation drawer~~ | **Done** — `POST /api/vani/correlation-insight` built; frontend wired in `CorrelationPage.tsx`. Debug confirmation pending in next session. | Done |
| VaNi catalog explanations via Qwen3 | Use hardcoded texts for now | Post cashflow |
| Walk mode — mark on chart | Phase 6 | After Walk mode |
| Save observation — correlation page | Phase 6 | After Walk mode |
| Screener — filters, dashboard integration, UX rethink | Separate design session | After UX sprint |
| EVENT_OVERLAP visualization — untested | Needs two simultaneous astro overlays | When test data available |
| EVENT_IN_STATE visualization — untested | Needs astro rule + state widget pair | When test data available |
| ~~Morning brief cache strategy review~~ | **Closed** — in-memory `_vani_cache` confirmed as final approach | Done |
| ~~CatalogDrawer compatibility~~ | **Done** — widened to 520px, `compact` prop added to `IndicatorsSection` (2-col grid) and `WidgetsSection`. | Done |

## Product Direction — Unified Rule Architecture (Do Not Build Yet)
- All overlays (astro, technical, compound) to be treated as first-class rules
- Single rule registry covers astro_rule, tech_rule, compound_rule types
- Discovery, correlation engine, and VaNi cache to operate on the same rule abstraction
- Enables NLP queries: "what happens when SMA 20 crosses SMA 50 above EMA 200"
- Enables indicator behaviour analysis N days before/after astro rule trigger
- Pre-condition: technical indicators need transit/signal rows in km_rule_signals equivalent
- Target: post-cashflow, requires separate design session

## Pending SEBI Review — Astro Labels
Astro signal labels (Nak-Vara: Bullish/Bearish,
AstroStrip Bearish legend etc.) use directional
language in an astro context. Deferred — needs
separate product decision on appropriate
SEBI-safe language for astro signals.
Files to review:
- components/domain/ConfluenceDotGrid.tsx lines 114-115
- components/domain/VisualPulse/AstroStrip.tsx line 148
- constants/signalScale.ts ZONE_LABELS — values use "Uptrend/Downtrend"
  (e.g. "Strong Uptrend", "Mild Downtrend"). These feed IndexScoreCard
  (IndexDetailPage) and any other component using ZONE_LABELS inline
  styles. Needs SEBI-safe zone vocabulary aligned with the astro label
  decision. Added Sprint 12 (B70 IndexScoreCard).
Review in Sprint 13 (Astro Integration sprint).
