# Astro implementation audit — 4 October 2026

## Scope and evidence

Read-only source audit of main at 34e6e7e: Rule Engine, Catalog, Almanac, chart overlays, VaNi, public astro routes, generators and canonical migrations 234–236. Includes supplied production screenshots and migration verification results. No live DB/session inspection or user-analytics query was performed. This report changes no application behavior. Findings below distinguish executed/live code paths from static orphan candidates; source references do not establish production usage volumes.

Decision: stop adding parallel readers. Consolidate the event contract and then delete replaced implementations in the same change. Existing effort is not a retention criterion. Public launch scope is Mercury and Venus, including their supported conjunction classifications. Other planetary research is not automatically proven obsolete by being outside that scope.

## Findings requiring correction

| Priority | Finding and evidence | Consequence | Disposition |
| --- | --- | --- | --- |
| High | No frontend references to `/api/astro/venus/calendar` or the canonical Mercury/Venus calendar views were found. `services/mercuryAlmanac.ts:59`, `services/mercuryStory.ts:36`, and `services/astroOverlayService.ts:137` read legacy rules/transits directly. | Clean DB records do not automatically yield consistent public screens. New Venus visibility records have no ordinary frontend selection path. | Replace these readers with one shared canonical event adapter; delete the superseded reconstruction functions. |
| High | `mercuryAlmanac.ts` turns a retrograde window's `end_date` into “stations direct.” `mercuryStory.ts` and backend `lib/astro_narration.py:51` infer direct motion by default. | Missing records can appear as known direct motion; period endpoints can stand in for separately calculated station events. | Use canonical station points and recorded daily motion. Missing coverage must remain unknown. |
| High | Catalog query checks `catalog_visible`, `is_active`, and not deleted in `pages/RuleEngine/ruleService.ts:84`. Group overlay expansion checks visibility/deletion but omits active in `astroOverlayService.ts:238`; individual `fetchRuleMeta` does not apply those eligibility checks. | A hidden or inactive saved selection can still resolve differently from the visible Catalog. | One resolver and eligibility policy for selection, expansion and rendering. Define historical saved-item behavior explicitly. |
| High | Catalog group allowlist is `Mercury,Gola` in `constants/astroGroupOverlays.ts:24`; Almanac enables Mercury/Bayer/Gola and disables Venus in `views/AlmanacPage.tsx:50`. These are independent of Rule Engine visibility. | Public scope differs by screen and excludes a completed planet. | Mercury/Venus only in the public astro navigation and selectors. Preserve one admin publication authority rather than inventing another boolean. |
| High | `services/almanacVix.ts:32` finds the last close on/before any event date, including future dates. `AlmanacPage.tsx:535` invokes it for future rows. | Future events display today's/latest VIX as though it were event-date context. Screenshot matches this code path. | Future event context unavailable; historical carry-back must include the actual source session and staleness. Do not alter astronomical dates. |
| High | `ruleService.ts:200` computes only completed and future starts, with no ongoing interval query; global 5,000-row limits apply before per-rule reduction. | Active events disappear between Last and Next, and crowded histories can omit a rule's nearest record. | Server-side previous/ongoing/upcoming by canonical family, with selected-date context and bounded per-family results. |
| High | VaNi backend label now names Mercury/Venus, but `config/vaniIntents.ts:133` and `MercuryStoryRibbon.tsx:50` still name Mercury. Ribbon DOES call `openWithIntent('index.astro_now')`. | Label/content mismatch, not an unwired button. Prior conversational uncertainty about the trigger was incorrect. | One selected-event intent contract and shared labels. Keep the existing trigger/store; remove duplicate naming and reconstruction. |
| Medium | `astroOverlayService.ts` admits chart overlays by legacy rule type, while `frameworkConstants.ts:26` includes `planet_manifestation`; RuleList offers `Manifest` unconditionally. | Empty obsolete filters persist; true point events can be classified as panel content instead of chart markers. | Derive supported families from event definitions; use `shape` for rendering. Manifestation remains unresolved, not silently relabelled. |
| Medium | Selected groups expand broadly by tag, and individual selections are appended separately in `fetchAstroBands`. No final occurrence deduplication is present. | A group plus one of its members can repeat the same event; planet tags mix facts and research hypotheses. | Explicit group membership and deduplication by occurrence identity; explain specialised conjunction classification without adding a duplicate crossing marker. |
| Medium | `useAstroOverlayBands.ts` fixes a two-year lookback relative to now. It is not driven by chart/replay bounds. Date helpers in story and Last/Next use UTC `toISOString()`; public calendar convention is IST. | Older chart history can omit events and “today” can differ near IST midnight. | Pass actual chart bounds and as-of date; centralize IST date handling and preserve non-session events. |
| Medium | `astro_narration.py` and `mercuryStory.ts` retain separate Mercury readiness logic and historical-evidence assumptions. `build_astro_readiness_text` only appends a canonical Venus reader. | Recent work created a transitional combination, not a unified system. Reconstructed Mercury can disagree with canonical Venus/Almanac. | Replace the combined adapter internals with one structured Mercury/Venus context, then remove old Mercury narrator/reader duplication. |
| Medium | Rule-discovery CLI invokes Venus refresh, but `_run_discovery_bg` in `pipeline2_api.py:3740` calls `discover_rule` directly. That function skips the seven canonical Venus codes. | Admin discovery can complete without refreshing the canonical data, while CLI behavior differs. | Route explicit canonical refresh through one maintenance service, or clearly mark those rules externally generated. “No matches” is not “refresh succeeded.” |
| Medium | Generic discovery still excludes weekends for numerous astro conditions. Mercury/Venus canonical identities are guarded from those paths. | Enabling additional planets prematurely reintroduces missing calendar days. | Restrict public launch scope now; audit each next family before enabling it. Do not remove weekday-specific conditions from rules whose actual definition is weekday-dependent. |
| Medium | Mercury visibility generation still contains `ALMANAC_OVERRIDES` and calibrated source substitution (`generate_mercury_windows.py:110,459`); Venus generation explicitly has no overrides. | Mercury and Venus do not yet share a universal no-override policy. | Make provenance explicit. If calculation-only policy is extended to Mercury, recompute with a reviewed diff; do not silently rewrite its history in UI work. |
| Medium | Angular combustion is derived from stored flags; canonical period metadata includes motion from the starting sample, not all days. `min_separation_deg` in the Venus daily calendar means Mercury–Venus separation, even on a combustion row. | Generic tooltips can mislabel motion or interpret the wrong separation as Sun–Venus combustion distance. | Typed per-family payloads: explicit `motion_at_start`, daily selected state, and planet-pair-qualified angles. Omit irrelevant fields. |
| Medium | `/astro-calendar` and `/planetary-intel` are real routes in `src/App.tsx:129,162`, alongside `/almanac`. `astroCalendar.ts` reads `km_astro_calendar`; `/inference` and `/rule-eval` use `dc_inference`/evaluation RPCs. Astro-calendar VaNi uses that older inference layer. | More parallel astronomy/market interpretation surfaces exist than the initial route list suggests. | Consolidate the public event calendar into Almanac. Keep research editing/evaluation only in an explicitly admin research area if needed; preserve data and deep-link behavior during retirement. |

## Keep / replace / remove inventory

| Asset | Decision | Completion condition |
| --- | --- | --- |
| Canonical event definitions, visibility method provenance, occurrence dates and precision | Keep and tighten | One shared Mercury/Venus reader; no inferred replacements for missing facts. |
| Rule Engine administration and catalog publication control | Keep | Link event families to the existing publication authority; do not make astronomy an arbitrary bullish/bearish rule just to fit old columns. |
| Catalog shell, search, selection controls, theme, saved-framework persistence | Reuse | Supported event families replace the raw research-rule table for public astro selection. |
| Almanac range controls and timeline/list presentation | Reuse | One generic planet/event-family renderer replaces Mercury/Bayer/Gola-specific public branching. |
| `mercuryAlmanac.ts`, `mercuryStory.ts` bespoke reconstruction | Replace, then delete | All callers migrated; date/precision tests pass; no parallel fallback. |
| `astro_narration.py` legacy Mercury-specific reconstruction | Replace, then delete superseded function/constants | Canonical structured context supplies narration for both planets. |
| `astroOverlayService.ts` rule/tag selection logic | Replace for canonical public scope | One resolver honors publication, shape and occurrence identity. Preserve general chart renderer, not duplicate datasource logic. |
| Independent launch allowlists / stale Manifest UI option | Remove or derive | Shared catalog response supplies enabled families and groups. Admin may still inspect pending definitions separately. |
| Public outcome/probability/confidence columns on basic planetary events | Remove | Research metrics only appear for a named hypothesis with relevant evidence. |
| Saved `astro_rule:*` / `astro_group:*` selections | Migrate, not discard | Explicit legacy-ID map; unsupported selections marked retired; actual manifestation is not mapped to sign journey by name. Legacy code 197 may identify journey only through the reviewed canonical mapping. |
| Bayer/Gola/Panchak/other planet public selectors | Remove from current public launch | Admin data/history preserved. Do not delete live research dependencies merely to hide UI. |
| Extra public astro-calendar/planetary-intel experience | Retire or redirect after caller audit | Existing URLs and navigation lead to the canonical calendar; required admin editing remains accessible. |
| Migration scripts, backups and generated event history | Keep | They are recovery/reproducibility assets, not runtime orphan code. Never edit applied migrations to enact a new cleanup. |
| New diagnostic scripts (`compare_venus_visibility.py`, `validate_venus_reference.py`) | Consolidate into validation tooling | One generator owns model parameters; validation imports it, rather than maintaining copied arrays. Keep reference fixtures as tests, not another production calendar. |

## Apparent orphan code — deletion candidates, not yet proven dead

Repository search found `AstroIntelligencePanel` and `AstroSignalWeekPanel` only in their definitions and the domain barrel export. `MajorTransitBanner`, `MinorTransitBar`, and `DailyEventStrip` are children of that apparent orphan panel. Remove this tree if an import-graph/build check confirms no namespace/dynamic consumers; then prune helper exports only when their own consumers are gone.

The frontend directory also contains a root-level prototype `App.tsx`/`CalendarView.tsx`, while production `index.html` loads `src/main.tsx`. Audit that prototype tree's build/package entry references as a unit before deleting it. Conversely, `src/views/CalendarView.tsx` and `PlanetaryIntelView.tsx` ARE routed and are not dead files.

No absence of textual imports is treated as permission to drop DB tables, RPCs, server jobs or persisted user data. No live scheduler inventory or DB dependency graph was available in this audit.

## Target model

Four distinct concepts:

1. **Event definition:** planet(s), family, human-readable name, point/period, method and status. Public launch: supported Mercury/Venus families.
2. **Occurrence:** actual calendar date/timestamp or sample bracket, stable identity, provenance and coverage. No exchange-calendar shifting.
3. **Publication and selection:** one admin-controlled authority; shared Catalog/Almanac/overlay eligibility; saved choices resolve explicitly.
4. **Market context / research:** price, breadth, ROC, VIX and relative strength with their own data dates; optional hypotheses kept separate from astronomical facts.

VaNi explains the selected occurrence/context. It must not be a fifth calculation system. Catalog answers what to follow; Almanac answers when; chart shows the same occurrence against index price. Point and period views represent the same episode, not extra evidence.

## Execution order and removal gates

1. **Definition/contract pass:** list the exact Mercury/Venus public families and legacy-ID mappings; normalize field semantics; expose canonical Mercury alongside Venus. Implement publication linkage. Preserve raw source/reference history.
2. **Correctness pass:** fix future market-context carry-forward, explicit coverage/unknown states, IST dates, ongoing periods and bracket precision. Validate around weekend, month/year and station boundaries.
3. **Consumer replacement:** Catalog, Almanac, overlays and VaNi use the same resolver. Scope to indexes including curated indexes. Migrate saved selections and remove the old readers in this same slice.
4. **Retirement pass:** remove obsolete public selectors/filter constants, duplicate labels and retired routes (with appropriate redirects). Delete orphan tree only after reference/build confirmation. Consolidate diagnostic constants into generator-owned settings.
5. **Acceptance:** one occurrence ID/date/name agrees across all four surfaces; Mercury+Venus group selection causes no duplicate crossings; exact time and daily bracket remain visibly different; no future VIX; inactive/hidden selection behavior is consistent; old bookmarks/selections handled explicitly; mobile/light/dark views tested. Negative checks: no legacy reader imports and no direct public astro reads from old transit tables for migrated families.

Do not mark this complete merely because new UI renders. Completion requires the old path to be removed, the persisted-state migration to work, and the same data to agree across consumers. Backend/live deployment checks and usage analytics are still needed before deleting externally callable research endpoints or database objects.
