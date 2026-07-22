# POA — Astro Layer (THE plan we follow)

**Date:** 2026-07-21 · **Status:** ACTIVE — this is the baseline POA for all astro-layer work
**Owner decision (2026-07-21):** *"I made multiple attempts and left in middle. What we do
[this session] will be what we need to baseline."* Earlier astro attempts (Pattern Engine,
astro calendar scoring, etc.) are **LEGACY** — kept running where harmless, never built upon.
**Narrative + decision log:** `docs/claude/astro-story.md` (the "why"; this POA is the "what next").

---

## 1. The baseline (canon — build on THIS, nothing else)

```
km_astro_rule_master  (all rules; catalog_visible = user-facing shelf)
        ↓ generators (generate_mercury_windows.py — combust = calibrated
          Ujjain visibility model + ALMANAC_OVERRIDES for display years)
km_rule_transits      (windows 1990–2030, event fields: sign/motion/stage/direction)
        ↓ compute_rule_evidence.py  (nightly 19:00 job + standalone)
km_rule_evidence      (per-rule: window texture + boundary transitions,
                       EVERY measure paired with its base rate)
        ↓
TradingChart band tooltip  (THE PATTERN + transition lines, threshold-driven copy)
        ↓ next
Almanac view · free badge · VaNi narration
```

### Non-negotiable principles (settled; do not relitigate without owner)

0. **Astro is INDEX-ONLY (owner 2026-07-22).** The evidence is NIFTY-
   benchmarked; on a stock chart the layer is noise and complication. Equity
   charts render NO astro bands/ribbon/ticks even when the user's framework
   carries the overlay (enforced in ChartView + WorkspaceChart; Catalog
   metadata says `index`). **Interaction model (same date):** hover = the
   one-second glance line · **clicking the ☿ ribbon = the discoverable full
   read** ("read ▸" affordance) · right-click a band = unadvertised shortcut
   to the same popover. The popover is also where VaNi's card self-appears
   when narration ships — one door for both.

1. **Two-layer contract:** surface = orientation (almanac language, no verdicts);
   basement = evidence (base-rate-anchored, one click deep). Data science is the
   editor, not the interface.
2. **No claim without a base rate.** Every measure ships with its matched base
   rate; copy thresholds live in code (`patternLines()`: range ≥1.15×/≤0.85×,
   direction ±8 pts, turn ±10 pts) — below threshold the card says "in line
   with usual". Publishing nulls is part of the brand.
3. **Transitions are orbs, not stamps.** Event ±2 sessions is the zone; trend
   compared entering vs leaving; prev-day H/L break inside the zone is the
   confirmation ("fusion": astro = when to watch, quant = whether it fired).
4. **One planet at a time, provably correct end-to-end** before the next
   (Mercury now; Venus is slice #2). The 6 slow-planet almanac rules stay
   visible (Variant B) but get no evidence claims until their slice is done.
5. **Product almanac == owner's almanac** for display years (override tables
   anchored to the owner's Drik-Panchang/Ujjain sheets); calibrated model for
   history.
6. **SEBI voice everywhere:** observational counts, never direction commands.

### Confirmed signal map (live data, NIFTY 2008+, base flip 48.9%)

| Phenomenon | Role in product | Evidence |
|---|---|---|
| Sign ingress (Journey) | **WATCH DAYS** — transition marker | flip 56.1% (n=246, ~2.3σ); rule's own 'end' boundary = 47.5% control ✓ |
| Monday + Mercury nakshatra | watch-day candidate | flip 60.7% (n=107) — strongest tilt; needs a second look before promotion |
| Combust | **ORIENTATION** — you're in the glare zone | all measures in line with base; windows match owner almanac to the minute |
| Retrograde, conjunctions, stations | orientation | in line with base on coarse measures |

### VaNi unification (owner 2026-07-22, built same session)
Owner correction to the interaction model: local (ribbon) and global
("Ask VaNi" header button) must show and answer the SAME intents — not two
disconnected systems. Investigation found the chart page had ZERO VaNi
wiring (no page registered, global button fell back to dashboard's generic
questions). Fixed with the existing scanner/equity pattern, not a new one:
- New intent `index.astro_now` (`page="index_vp"`, already the registered
  page for `/chart/index/:id` per `usePageContext.ts` — just never had
  intents) in both `lib/vani_intents.py` and `config/vaniIntents.ts`.
- **Deterministic, no LLM** (`lib/astro_narration.py`) — owner directive:
  "we don't need LLM everywhere... insert into cache... LLM won't be
  invoked." Computed server-side, written straight into the existing
  persistent `km_vani_cache` (same mechanism `scanner.explain_preset` /
  `equity.*` already use) — the LLM branch in `vani_ask()` is never reached
  for this intent.
  The ribbon's click now calls `useVaNiStore().openWithIntent('index.astro_now')`
  — the SAME store the header button reads — instead of a bespoke popover.
  One system.
- **Bug caught during this build** (see astro-story.md correction,
  2026-07-22): the original ribbon/ticks marked motion boundaries as watch
  days without checking their own evidence. Fixed in the same pass.
- **Not unified**: the right-click per-band deep-dive (`OverlayExplainPopover`
  + `RuleEvidenceRead`, deterministic, client-side) stays separate — it
  answers a different question ("why does THIS specific band matter" vs
  "what's Mercury doing right now"). Revisit if the owner wants it folded
  into the same VaNi intent system too.

### Legacy (do NOT build on; cleanup candidates)

- **Pattern Engine** (`km_rule_patterns`, `pattern_study.py`, admin PatternsTab,
  `POA-astro-pattern-engine.md`) — abandoned mid-attempt; clean/peer split
  starves Mercury-scale samples and no base rates stored. Stays admin-only.
  Do not re-run for Mercury. Ideas worth salvaging later (level-break forward
  returns, reaction curves) get rebuilt INTO `km_rule_evidence` if/when wanted.
- `km_astro_calendar` / `km_astro_daily_signal` scoring, `dc_inference` manual
  calendar — untouched, not part of this pipeline.
- Duplicate conjunction rules (`CON-MER-VEN-BEA`/`CON-MER-VEN-CD-BEA`/
  `CON-VEN-MER-BEA` — identical 45 windows): dedup in a cleanup pass.

---

## 2. Forward phases (owner rescope 2026-07-21: MERCURY ONLY until it's fully
in place; VaNi narration LATER; the three deliverables are chart storytelling,
the calendar, and the pricing gateway)

### Phase A — Storytelling on the chart
Mercury's narrative arc rendered on the user's own chart (Study + My Space,
shared `TradingChart` pipeline — already the band substrate):
1. **Boundary markers** — ✅ **BUILT 2026-07-21**: watch-day ticks (bottom
   stub + ◈, planet-colored) on ingress days and station days in the
   TradingChart canvas — past AND horizon-visible future.
2. **Story ribbon** — ✅ **BUILT 2026-07-21** (`MercuryStoryRibbon.tsx` +
   `services/mercuryStory.ts`): Study chart (inline) + My Space chart
   (floating overlay chip). *"☿ direct in Cancer · combust (ghora) until
   24 Jul · next: enters Leo 6 Aug ◈"* — horizon-clamped, 🔒 "+N this
   quarter" for free/quarterly.
3. **Readiness state** — ✅ **BUILT 2026-07-21** (the founding use case:
   *"signal tells me in advance — event is coming, be ready; not bull or
   bear, READINESS"*): when a watch-day's ±2d orb contains today, the ribbon
   leads with an accent chip — *"◈ WATCH ±2d · enters Leo 6 Aug · prev-day
   H/L in focus."*
4. THE PATTERN tooltip (done) stays the click-through evidence layer.
**Phase A: COMPLETE.** A user on any chart reads where Mercury's story was,
is, whether TODAY is inside a watch zone, and (within tier horizon) what's
next — without leaving the chart.

### Phase B — The Calendar (presentation decided: the owner's Excel as lanes)
Route `/almanac`. Not a month grid — a **three-lane timeline**, which is
exactly the owner's own Excel rendered as UI (Motion / Combust & Rise /
Journey are the three tables in the sheet):
- **Lane 1 · Journey:** sign segments as colored spans (ingress boundaries =
  watch-day ticks).
- **Lane 2 · Motion:** direct/retrograde spans (stations as ticks).
- **Lane 3 · Combust:** glare-zone windows (asta/udaya edges, stage label).
- **Today cursor** vertical line; past is dimmed; future extends exactly to
  the tier horizon, then fades into a locked/blurred zone with the upgrade
  prompt ("Unlock the full quarter").
- **Event list** below the lanes: chronological rows with exact IST
  timestamps + the threshold-driven texture line (shared `patternLines()`
  helper extracted from TradingChart into a service).
- **Window detail on click:** full evidence read from `km_rule_evidence`.
**DoD:** owner can retire the Excel for Mercury 2026 planning; every number
traces to `km_rule_transits`/`km_rule_evidence`; horizon gate visibly works
per tier.

### Phase C — Pricing gateway (forward-horizon gating)
How far ahead a user can see astro events (ribbon "next:" tail + calendar
future zone + any upcoming-window surface):

| Tier | Forward horizon (owner-confirmed 2026-07-21) |
|---|---|
| `free` | next 5 days (today + 4) |
| `quarterly` | next 5 days (today + 4) |
| `annual` | next 90 days |
| `trial` / `beta` | same as annual (90 days) |

- **History is unrestricted for every tier** (owner-confirmed).
- One constant map `ASTRO_HORIZON_DAYS` in `frameworkConstants.ts`; a single
  `useAstroHorizon()` hook reads profile tier → days; every astro surface
  clamps through it.
- Launch enforcement is client-side (consistent with every existing tier gate
  incl. InlineGate); noted caveat: PostgREST reads of `km_rule_transits` are
  not horizon-restricted server-side — a server-enforced `/api/almanac`
  endpoint is the post-launch hardening path if it matters.
**DoD:** switching tier on a test profile visibly changes the ribbon tail and
the calendar's locked zone; free user sees today-only + gate.
**Status:** foundation ✅ BUILT 2026-07-21 — `ASTRO_HORIZON_DAYS`
(`frameworkConstants.ts`) + `useAstroHorizon()` hook; `TradingChart` clamps
ALL future astro rendering (bands, future pins, tooltips) through it; ribbon
"next:" tail + lock chip obey it. Remaining: the Almanac future zone (with
Phase B) and the post-launch server-side enforcement note.

### Later (explicitly deferred by owner, in this order of likelihood)
- **VaNi narration** of watch days / Morning Brief lines — after A–C.
- **Slow-planet ingress replication check** — only after Mercury is fully in
  place; then Venus slice (same pipeline; request owner's Venus sheet then).

### Parked (unchanged)
VIX ~2008 backfill · pseudo-sector history · stock-level astro stats ·
Workspace Clean Breakaway overlay wiring · dormant-table/code cleanup sweep
(owner flagged 2026-07-21 — schedule as its own session).

---

## 3. Run model (unchanged, proven this session)

Build on branch → typecheck/py_compile → merge to `main` on owner's word →
owner runs migrations in pgAdmin + scripts on VPS → verify live via read-only
MCP → findings recorded in `astro-story.md`. Migration numbering: ALWAYS
`ls App/DBscripts/ | sort` first (numbering has drifted).
