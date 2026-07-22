# Session Handover — 2026-07-23

Branch: `claude/handover-astro-orientation-tu3vgz` — **fully merged to `main`**
(PRs #202–#215, all merged incrementally during the session; verified no diff
remains between the branch and `main`). Scope: finished Mercury Almanac (Phase
B), fixed a real date-generation bug, built and then redesigned a second
Almanac type (Bayer Rules), widened the free-tier astro pricing window.
**Frontend + one Python script + docs. No new migrations.**

---

## Deploy note

**Frontend rebuild/redeploy is the main step.** One backend file changed
(`App/backend/scripts/generate_mercury_windows.py`) — already run once by the
owner mid-session and confirmed correct on live data. **`compute_rule_evidence.py`
has NOT been re-run since 2026-07-21** (checked live: `km_rule_evidence.computed_at`
is still `2026-07-21 21:26:46 IST` for every row) — run this on the VPS before
trusting any THE PATTERN / evidence-read text, since it's still scored against
the pre-fix transit dates.

```
KD_DB_PASSWORD=... python compute_rule_evidence.py
```

---

## What shipped this session

### Mercury Almanac — Phase B closed out (`AlmanacPage.tsx`, `mercuryAlmanac.ts`)
- Three-lane timeline (Journey/Motion/Combust) was already live at session
  start; this session added: day-lord (vara) tag per event + lane segment
  (pure calendar fact, not a scored signal), India VIX level/trend per row
  (explicitly labeled reference-only), a static Mercury-ruled-sectors line,
  window-length "Nd" badges + combust stage text matching the owner's Excel,
  Sanskrit rashi names (Panchang style) with English in tooltips, a
  two-column event-row split with color-coded VIX arrows, the branded
  `DristiQLoader`, and **Live/Month/Year navigation** (history unrestricted,
  future still tier-gated).
- **Real bug found + fixed**: `generate_mercury_windows.py`'s retrograde,
  sign-transit (Journey), and station-direct generators derived
  `start_date`/`end_date` from a coarse once-daily (11:00 IST)
  classification table instead of the precise ephemeris timestamp computed
  right alongside it — landed a day early whenever the true event fell
  before that day's snapshot (caught live: a "stations direct" event showed
  23 Jul instead of the true 24 Jul 04:28 IST). Fixed at the generator
  (`ist_date_of(ts)`, the same method Combust already used) so every
  downstream consumer — `km_rule_transits`, chart bands, evidence, the
  Almanac — inherits the fix from one source. Owner ran the script and
  confirmed corrected dates live.

### Bayer Rules — a second Almanac type, redesigned once mid-build
- First pass gave Bayer's 9 rules (of 10 tagged `Bayer`; `BAY-R14-VEN-LON`
  excluded as a near-continuous oscillator, not a discrete event) one lane
  each — **copying Mercury's timeline metaphor, which the owner correctly
  rejected**: Mercury's lanes work because they're complementary faces of
  ONE continuous story; Bayer's 9 rules are independent trading claims with
  no shared narrative.
- **Rebuilt as a rule-status grid** (`services/bayerAlmanac.ts`'s
  `fetchBayerStatus`, `AlmanacPage.tsx`'s `BayerRulesBody`): one card per
  rule — active today or not, next occurrence (horizon-gated), the evidence
  read (`buildRuleRead`, same honesty gate as Mercury), Bayer's own 1940
  claimed bias explicitly marked unverified.
- Then added a **per-rule timeline drill-down** ("Timeline ▸" on each card):
  a single rule's own history over time IS coherent, unlike merging all 9,
  so this reuses the exact `TimelineLane` component + a new
  Live/Month/Year-browsable single-lane view (`fetchBayerRuleWindows`).
  Extracted `useAlmanacRange`/`AlmanacRangeNav` out of Mercury's body so
  both share the nav logic.
- **Type-selector dropdown** on the Almanac page: Mercury / Bayer Rules
  live; Venus / Panchak / Major Transits shown disabled (principle: one
  rule-set provably correct before the next).

### Ribbon simplification (`MercuryStoryRibbon.tsx`)
- Dropped the horizon-clamped "next:" event tail and "+N this quarter" lock
  chip. Ribbon now states only Mercury's current chapter + WATCH chip; a
  new "◈ full calendar →" link routes to `/almanac`, which now owns
  "what's coming."

### Pricing — astro forward-horizon widened (`frameworkConstants.ts`)
- `ASTRO_HORIZON_DAYS`: free/quarterly **5 → 7 days** (1 week). Annual/
  trial/beta unchanged at 90. One constant, propagates everywhere via the
  shared `useAstroHorizon()` hook (ribbon, chart pins, Mercury Almanac,
  Bayer grid + drill-down) — confirmed as the intended model: pricing gates
  the forward WINDOW, not feature access itself (every astro overlay stays
  `tier_required: 'free'`, `/almanac` has no tier check beyond login).

---

## Not done / flagged during the session

- **`compute_rule_evidence.py` re-run** — see Deploy note above. Blocking
  for trusting any evidence text right now.
- **Almanac has no VaNi page context** — `usePageContext.ts`'s `PATH_MAP`
  has zero entry for `/almanac`, falls back to generic dashboard questions
  on the global "Ask VaNi" button. Not a trivial copy of the `/workspace`
  fix (that pattern is in the repo from a prior session) — the Almanac now
  serves two types via one dropdown, and needs its own VaNiPage + probably
  a type-aware intent, not a straight reuse of `index.astro_now`. Real
  design work, flagged not built.
- **Bayer's ~35+ remaining rules** (4B, 5, 7, 8, 10-13, 15-20, 23-26,
  28-48) stay blocked — `docs/claude/rules-engine.md` is explicit: original
  1940 George Bayer handbook needed, do not guess/approximate. Only path
  forward is the owner sourcing the material.
- **`BAY-R14-VEN-LON`** (Venus longitude unit cycle) deliberately excluded
  from the Bayer grid — 12,963 windows across the backfill, essentially
  always-on rather than a discrete event, and sits at its own base rate
  (52.8% vs 53.0%) anyway. Revisit only with a different presentation
  (e.g. a cycle-phase strip), not as a card.
- **Live visual verification** — every Almanac/Bayer surface built this
  session has been typecheck/theme/build-clean but not personally screen-
  tested by me (no credentials/deployed environment in this sandbox); the
  owner has been testing live throughout and driving fixes from real
  screenshots — that pattern should continue for anything shipped just
  before this handover (the pricing horizon change, the Bayer redesign).

---

## Reference

- **Living plan**: `docs/POA/POA-astro-layer-mercury-launch.md` — updated
  throughout this session (Phase B closed, Phase D — Bayer — added and
  then corrected, Phase C horizon table updated, the VaNi gap logged).
  Read this first before starting new astro work.
- **Narrative/decision log**: `docs/claude/astro-story.md` (not touched
  this session — still reflects state as of 2026-07-22).
- **Bayer rule mapping + blocked list**: `docs/claude/rules-engine.md`
  "Bayer Rules — Implementation Status".
