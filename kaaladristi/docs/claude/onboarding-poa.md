# Onboarding — Plan of Action (2026-09-07)

Agreed direction: **agentic IX, not chat**. VaNi onboards by *doing* — showing live
setups, inferring the persona from what the user acts on, assembling the workbench
in front of them, and leaving a reason to come back tomorrow. Astro is **not** in
the flow (not releasing yet). Persona vocabulary is persisted and editable in
Account. Reuse existing components; net-new code is deliberately small.

Mock (current, agentic IX): artifact `5e4bd055-a691-4e53-a893-7a888d10a5da`.
Discussion record: session 2026-09-07 (this file supersedes the chat).

Flow (settled order):
**What is VaNi → Your details → Personality → Scanners → How VaNi will guide → Plan & look**

The three priority recommendations bundled into this POA: first value on screen 1,
bookmark-not-plan as the exit, and "Show me" (tours) instead of videos.

---

## Phase 0 — Data contract (1 migration, owner runs) · ½ day · ✅ built 2026-09-07 (owner to run 204)

**Migration 204 `km_migration_204_profile_persona.sql`** (`ls App/DBscripts | sort`
first — numbering has drifted before):

```
km_profiles
  persona        TEXT  CHECK (persona IN ('investor','swing','intensity'))   -- derived + overridable
  acts_on        TEXT  CHECK (acts_on IN ('confirmed','early','extreme'))   -- pick-what-you'd-act-on
  hold_horizon   TEXT  CHECK (hold_horizon IN ('days','weeks','months'))
  concede_level  TEXT  CHECK (concede_level IN ('tight','swing_low','structure'))
  persona_set_at TIMESTAMPTZ
  guide_progress JSONB DEFAULT '{}'                                          -- {"stage_2_leaders": "2026-09-08", ...}
```

- Extend `kd_update_profile` (migration 143 idiom — `CASE WHEN p_updates ? 'persona' …`)
  with the six keys. `role/is_suspended/id/email` stay admin-only.
- `km_ux_events` (user_id, event, payload JSONB, at) + grants to `authenticated` +
  `NOTIFY pgrst`. Two events only: `first_bookmark`, `day2_return`. Nothing else.
- Frontend: `types/index.ts` `Profile` gains the six fields; `updateProfile()` unchanged.

Owner: run 204 in pgAdmin, confirm `SELECT kd_update_profile('{"persona":"swing"}')`
round-trips for a test account.

---

## Phase 1 — Persona engine + mapping config (pure TS, no UI) · ½ day · ✅ built 2026-09-07 (`constants/personaConfig.ts`, `scripts/qa/check-persona.mjs` wired into `npm run build`)

- `constants/personaConfig.ts` (constants-first rule):
  - `PERSONAS` — id, label, one-line voice ("Acts on confirmed strength, holds for weeks").
  - `derivePersona(acts_on, hold_horizon, concede_level)` — deterministic table, no LLM.
  - `PERSONA_SCANNERS: Record<Persona, ScanPresetId[]>` — 4 presets each, e.g.
    investor → `stage_2_leaders, quiet_accumulation, smart_money, conviction_flow`;
    swing → `breakout_surge, fresh_breakout, power_buy, stage_2_leaders`;
    intensity → `breakout_surge, gl_breakout, flower_pot_burst, power_buy`.
    Preset ids come from `SCAN_PRESETS` / `STUDIO_PRESET_IDS`, never retyped.
  - `PERSONA_TEMPLATE: Record<Persona, templateId>` bridging to
    `frameworkTemplates.ts getTemplateForICP` (investor/trader/both already exist;
    no new templates — `intensity` maps to trader).
  - `readingLine(fields)` — the strip text ("You act on confirmed strength, hold for
    weeks, concede at the 22-day low → swing trader").
- Unit test file next to it (vitest, if present; else a `scripts/qa/` node check)
  covering the derive table — 27 combinations, every one lands on a persona.

---

## Phase 2 — ProfileSetup rework (reorder + 2 new steps) · 2 days · ✅ built 2026-09-07

Built as specified with these notes: six steps (1 What is VaNi + details · 2 Personality ·
3 Scanners · 4 How VaNi will guide · 5 Plan · 6 Look). New components live in
`components/domain/Onboarding/` (ReadingStrip, ActsOnPicker, ConcedeChart, LiveIntroCard,
TryItSort, PersonalityScreen, GuideStep, ui) + `hooks/useOnboardingScans.ts` +
`config/onboardingCards.ts` (card-only descriptors for Stage 2 / Quiet Rising Flow, which have
no Studio page). `StudioCard` is now exported from BreakoutSurgeTable with a `stacked` prop
(forces the phone layout inside narrow columns — the desktop ledger overlapped at ≤560px).
`cardSortOptions`/`sortForCards` moved to `config/scannerStudio.ts`. Persona is saved at step-2
exit; `icp_mode` is set to `technical` at step 3 (astro toggle removed from the flow; resume
signal unchanged). Step 4's "Show me" buttons are descriptive until Phase 3 ships `/guide` —
a tour cannot leave `/setup` before `onboarded` flips. Dev-only `?step=N` deep link on `/setup`
for the screenshot harness. `services/uxEvents.ts` records `first_bookmark` from the bookmark
store (any page) and exposes `maybeRecordDay2Return` for Phase 5.
**Note for owner:** the starter templates still place Panchak + Six-Day Outlook (astro) blocks —
those are the existing `frameworkTemplates.ts` contents, untouched here; decide whether the
investor/hybrid templates should drop astro blocks while astro is unreleased.

`views/ProfileSetup.tsx` — keep the `step` machine, keep Screen1 orb/name/mobile,
keep Screen3 build animation, keep Screens 4/5 (PricingCards, ThemeSettings).

| Step | Screen | What changes | Reuses |
|---|---|---|---|
| 1 | What is VaNi + Your details | **Add one live Studio card under the orb**, stamped with the trade date (top row of the first persona-agnostic preset, Breakout Surge). Falls back to the static intro if `executeScan` errors or backend offline. | `Screen1`, `ScanCardWrapper bare`, `StudioCard` from `BreakoutSurgeTable.tsx`, `executeScan`, `useLastTradingDate` |
| 2 | Personality (new, replaces ICP Screen2) | Three live cards (one from each of `confirmed/early/extreme` presets) → "Which would you act on?"; hold-horizon three-chip; concede-level on a real chart (three horizontal price lines, tap one). **Reading strip** updates after each tap; persona chip is tappable to override. **Skip → investor.** Astro/technical `icpMode` toggle removed from the flow (kept in Account → Appearance, default `technical`). | `StudioCard`, `TradingChart createPriceLine`, `Screen2` typing animation, `personaConfig` |
| 3 | Scanners (workbench assembles) | Existing Screen3 animation, template chosen by `PERSONA_TEMPLATE`. Dimmed blocks = real inactive Catalog items via `WorkspaceBlock` inactive state. **"Try it": one sort chip on the assembling Studio card is live** (`cardSortOptions` / `sortForCards`). | `Screen3 buildAnimBlocks`, `getTemplateForICP`, `WorkspaceBlock`, `frameworkStore.applyTemplate` |
| 4 | How VaNi will guide (new) | "Pick one name to watch this week" — the three ranked picks from step 2's fetch, one `BookmarkToggle` each. Under it: the persona's 4 scanners as a checklist with **Show me** buttons (deep-link `/scan?preset=…&tour=1`). Writes `first_bookmark` event. Skip allowed. | `BookmarkToggle`, `useBookmarks`, `useTour`, `personaConfig` |
| 5 | Plan & look | Unchanged (PricingCards → ThemeSettings → `onboarded=true`). Persona fields are written **at step 2 exit**, not at the end, so an abandon still leaves a persona. | `Screen4/5` |

Commit rule per step: `updateProfile({acts_on, hold_horizon, concede_level, persona, persona_set_at})`
at step-2 exit; `updateProfile({onboarded:true})` at step-5 exit as today.

Phone: design every new element at 390px first (`qa-mobile.mjs --element` for each step).

---

## Phase 3 — "How to use DristiQ" + Show me · 1 day · ✅ built 2026-09-07

Built: `views/GuidePage.tsx` at `/guide`, sidebar item "How to use DristiQ" (after Workspace).
Show me = navigate to the real page with `?tour=1&guide=<key>`; `components/ui/PageTour.tsx` and
`views/WorkspacePage.tsx` honour it (forced start, `useTour` gained `onDone`) and
`services/guideProgress.ts markGuideWalked` writes `guide_progress`. Rows: the persona's 4 scanners +
Workspace + Study (`/chart/index/1`).

- New route `/guide` (`views/GuidePage.tsx`) + nav item "How to use DristiQ" (top nav,
  after Workspace; also linked from BetaWelcomeModal).
- Content = the persona's 4 scanners + Chart + Workspace as a checklist. Each row:
  one-line "why this scanner for you", a **Show me** button that navigates to the real
  page with `?tour=1` and starts that page's existing `useTour` config on live data,
  and a ✓ when `guide_progress[preset]` is set (written by the tour's `onDestroyed`).
- No videos. Tours ride the DOM and survive layout changes.
- "Change how you invest" link → Account tab (Phase 4).

---

## Phase 4 — Account "How you invest" tab · ½ day · ✅ built 2026-09-07

Built: `components/domain/Onboarding/HowYouInvestPanel.tsx` under Account (`?tab=invest`,
`&rerun=1` opens the three live picks). Saving changes what the Guide and Morning Brief follow; the
workbench is deliberately NOT rebuilt (no silent overwrite of a customised framework). Existing users
(`onboarded` without `persona`) get a "Tell VaNi how you invest (30s)" card in BetaWelcomeModal.

`views/AccountPage.tsx` `TABS` gains `{ id: 'invest', label: 'How you invest' }`:
reading strip (read-only) + three choosers (same components as step 2, no live cards
needed — chips only) + persona override + **"Re-run the three picks"** (re-executes
the three presets, shows the cards, lets the user re-answer) + guide progress (N of 6
walked). Saves through `updateProfile`.

---

## Phase 5 — Morning Brief continuity · ½ day · ✅ built 2026-09-07 (frontend-only, deviation)

Built as a deterministic browser-side line instead of an LLM prompt change:
`components/workspace/ContinuityLine.tsx` inside VaNiMorningBrief (pinned strip + modal) for the first
`CONTINUITY_DAYS` (14) after `persona_set_at` — "{Persona}s on DristiQ are watching {first scanner}
today. The name you picked, X, closed ₹… (+y%). N of 6 guide walks done." No per-user LLM cost, no
backend change, never drifts from the persona vocabulary. `day2_return` is written from WorkspacePage
mount via `services/uxEvents.ts maybeRecordDay2Return`.

- `POST /api/vani/daily` request gains optional `persona` and `first_bookmark_symbol`
  (frontend already knows both). Backend (`pipeline2_api.py vani_daily` →
  `vani_assemblers`) prepends one persona-aware line for the first 14 days after
  `persona_set_at`: "Swing traders on DristiQ are watching Stage 2 Leaders today. The
  name you picked yesterday, X, closed +1.8% above its Golden Line."
- Cache key already includes the date; add persona to the key so the line is per-persona,
  not per-user (no per-user LLM cost).
- `day2_return` event: written once by the Workspace page when `now - persona_set_at`
  is between 1 and 3 days and no event exists.

---

## Phase 6 — QA + ship · 1 day · ⏳ typecheck / theme gate / persona check green; harness screenshots at 390 + 1280 for /setup steps 1–4, /guide, /account?tab=invest reviewed. Owner: run migration 204, `./deploy.sh`, then walk /setup on a fresh account and the Account tab on an existing one.

- `npm run typecheck && npm run lint && npm run build` (theme gates run in build).
- `scripts/qa/qa-mobile.mjs` on `/setup` steps 1–5, `/guide`, `/account?tab=invest`.
- Skip-path test: skip everything after Your details → workspace is populated (investor).
- Backend offline test: step 1 renders static intro; step 2 falls back to chip-only.
- Deploy: owner runs migration 204 first, then `./deploy.sh` (frontend + pipeline-api2).
- Existing users: `persona IS NULL` → BetaWelcomeModal shows one card "Tell VaNi how you
  invest (30s)" linking to `/account?tab=invest`. No forced re-onboard.

---

## Out of scope (do not drift)

- Astro anywhere in onboarding (owner decision, not releasing yet).
- Any chat UI. The reading strip is VaNi's only "voice" in the flow.
- New scanner presets, new templates, new card families — the B+E Studio card is the card.
- Risk questionnaire beyond the three choosers.
- Videos.

## Sequencing + effort

| Phase | Depends on | Effort |
|---|---|---|
| 0 Migration 204 | — (owner runs) | ½ d |
| 1 personaConfig | — | ½ d |
| 2 ProfileSetup | 0, 1 | 2 d |
| 3 Guide + Show me | 1 | 1 d |
| 4 Account tab | 0, 1 | ½ d |
| 5 Morning Brief line | 0 | ½ d |
| 6 QA + ship | all | 1 d |

Phases 1, 3, 4, 5 are independent of each other and can run in parallel once 0 is
applied. Critical path: 0 → 2 → 6. Total ≈ 6 working days for one builder.

## Measure

Two numbers, from `km_ux_events`: **time to first bookmark** (signup → `first_bookmark`)
and **day-two return** (`day2_return` / signups). Read them from the admin Users page
later; no dashboard in this sprint.

## Open (owner to confirm before Phase 2)

1. Which preset supplies the step-1 card (proposed: Breakout Surge, top row by 5D score).
2. The three "act on" presets for step 2 (proposed: confirmed = Stage 2 Leaders,
   early = Quiet Accumulation, extreme = Breakout Surge).
3. Whether Plan (pricing) stays as step 5 or moves to the first gated action.
