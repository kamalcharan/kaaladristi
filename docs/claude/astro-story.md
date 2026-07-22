# Astro Layer — Narrative Contract & Launch Decisions

> **The founding use case (owner, 2026-07-21):** *"70% of times I get good
> profit — I take Mercury on break. This signal tells me in advance saying
> event is coming, so be ready. It is not about bull or bear — it is about
> READINESS."* Every Mercury surface serves this: advance notice of watch
> days, the ±2d zone, the prev-day high/low as the reference level. The
> product never says which way — it says WHEN to be ready.

**Date:** 2026-07-21 · **Status:** direction agreed with owner; Mercury slice first.
Companion references: `MERCURY_SLICE_PLAN.md` (repo root), `docs/claude/rules-engine.md`,
`docs/claude/VIX-Upgrade.md`, `docs/finastro/` (owner's almanac sheets + source PDFs).

---

## 1. Positioning — the story we tell users

> **Markets already trade a calendar — expiry week, Fed days, earnings dates.
> Kāla-Drishti adds one more layer of recurring dates to that calendar, and
> shows you the receipts for each one.**

Never pitched as "astrology predicts the market." The Mercury rule set is
mostly `turning`/`volatile` bias — timing and volatility events, not direction
calls. That is the story, not a weakness: astro windows are **pre-computable
recurring dates** (known to 2030, to the minute, Swiss Ephemeris), presented
the way traders already treat known calendar events. Skeptics can read it as
cycle analysis; believers get the full panchang depth. Both are served by the
same surfaces.

## 2. The two-layer contract (the core design decision)

Owner's articulation (2026-07-21): *"I was trying to give data science and
decision making, and that is not the right way."* Resolved as:

**The data science is the editor, not the interface.**

- **Surface (what users live in):** the almanac and chart bands. Language of
  time and texture — "Mercury runs combust Jul 3–23," "station direct
  Thursday." No numbers pushed at the user, no decisions issued. Orientation,
  not advice — which also keeps it SEBI-clean by construction (see D39
  vocabulary rules).
- **Basement (internal + one click deep):** confidence scoring, VIX change,
  range expansion, turn frequency. Its primary job is **editorial** — deciding
  which rules are worthy of the almanac at all (this is how the degenerate
  DN-* day rules got cut from launch). Users see evidence only when they ask
  "why should I care about this window?" — the band-click tooltip, not the
  headline.

The owner's own Excel almanac (`docs/finastro/mercury.jpg`) is the proof of
concept: no p-values, just dates, signs, lords — an orientation document he
actually trades from. The product almanac is that document, productized.

## 3. Yardsticks (plural) — how the basement measures observational rules

The confidence engine's directional hypothesis test leaves `turning`/`volatile`
rules with `scored_windows=0` by design. The evidence layer for exactly those
rules comes from **volatility/turn measurables**, VIX being one of several:

1. **Realized range expansion** — daily range inside window vs baseline.
   **Primary deep-history yardstick**: computable from 26 years of NIFTY OHLC.
2. **VIX change** — did India VIX close higher inside the window vs the 20
   sessions before it? **SR-B4 done (2026-07-21): series is clean but SHALLOW**
   — `km_index_eod` id=94 has 280 rows, 2025-06-02 → present only (no nulls,
   no gaps >4d, range 9.15–27.89). Only ~4 Mercury combust windows overlap it,
   so VIX is the *recent-era cross-check + live badge*, NOT the historical
   evidence backbone. (A ~2008-onward VIX backfill from NSE archives would
   upgrade it — separate ingestion task, not required for launch.)
3. **Turn frequency** — did the index print a local top/bottom inside the
   window? (the natural test for `turning` rules).
4. **Directional matched %** — the existing `km_rule_confidence` machinery,
   for the minority of rules with a real directional hypothesis.

This is VIX-Upgrade **Tier 1 fused into the astro layer** — not Tier 2's
three-signal confluence redesign, which stays parked.

**5. Boundary-day transitions (added 2026-07-21 — owner: "Mercury is not
about bearish or bullish… it is about trend change… usually previous day
high or low break will happen… fusion", and "the impact will be ±2 days —
checking a single day is a mistake").** The transition claim lives at window
BOUNDARIES (station day, ingress day, combust entry/exit), not interiors —
and the influence is an **orb**: event ±2 sessions is the transition ZONE.
Migration 162 + the evidence script store, per boundary kind: the flip rate
of the 5-session trend AFTER the zone vs before it (prior |trend| ≥ 1%), and
the fusion confirmation — a prev-day-H/L break-and-close INSIDE the zone in
the new trend's direction, given a flip — each with base rates.
**Orb-framed result (NIFTY 2008+, base flip 48.9%):** the single-day
prototype's +3..+6 pt tilt across five families REDISTRIBUTED under the
stricter orb test — **sign ingress (the Journey, the owner's most detailed
almanac table) is the real carrier: 56.4% (n=241, ~2.3σ)**; combust-entry
(47.7%) and retro-station (50.0%) washed out. Product framing: **boundary
days are WATCH DAYS, not signals — the break inside the zone is the
confirmation** ("fusion": astro says when to watch, quant says whether it
fired). Seed of the future alert layer (VaNi: "Mercury enters Leo tomorrow —
watch the previous day's high/low over the next two sessions").

## 4. Surfaces — three acts

| Act | Tier | Surface | Status |
|---|---|---|---|
| 1. "The sky has a clock" | Free | Sky Regime strip (exists) + a small active-window badge ("☿ Mercury combust · ends Jul 23"). Free users see *that* a window exists, never what it historically meant. | Badge: build |
| 2. "See it on your own chart" | Premium | Catalog → Mercury group overlay → bands on My Space + Study (exists, shared `TradingChart` pipeline). Build-new: **evidence tooltip** on band click — "17th combust window since 2008 · VIX closed higher in 12 of last 20 · range 1.3× median" (extend `OverlayExplainPopover`). | Overlay: live · Tooltip: build |
| 3. "Know what's ahead" | Premium **flagship** | The **Almanac view** — forward calendar of windows (next 90 days) with historical texture per window type; the owner's Excel productized. VaNi narrates it in the Morning Brief. | Build |

**Premium gate:** rides the existing paid tier (`InlineGate` already gates
`add_rule`). Free = awareness; paid = evidence + overlays + forward almanac.

## 5. Launch scope decisions (owner sign-off 2026-07-21)

- **Variant B** (Mercury + 6 healthy slow-planet almanac rules) — the almanac
  needs its seasonal backdrop; Mercury is the minute hand, Mars/Jupiter/Saturn
  are the hour hands. **Only Mercury gets the evidence treatment**; the 6 stay
  visible but plain until their slices are verified.
- **W2** — deactivate 3 broken rules; **W4** — hide 5 degenerate-confidence
  DN-* day rules (kept `is_active` for scoring continuity). **W3 (blanket
  deactivation) skipped** per plan recommendation.
- Live DB was found already at strict Variant A (18 Mercury rules visible,
  executed in a prior session). Delta shipped as
  **`km_migration_160_mercury_launch_catalog_scope.sql`** → run in
  pgAdmin/psql (MCP connector is read-only). Post-migration: 19 visible
  (13 Mercury + 6 almanac).

## 6. Combust windows — method finding (IMPORTANT, blocks the Almanac view)

The owner's almanac combust table (`mercury.jpg`, "Mercury Combust & Rise") is
**not a fixed combustion arc**. Measured Sun–Mercury separation at the sheet's
own 2026 boundaries ranges **9.8°–16.8°** (computed with the pipeline's own
Swiss Ephemeris + Lahiri setup — see `App/backend/scripts/verify_combust_method.py`):

| Sheet boundary | Implied orb | Motion |
|---|---|---|
| Jan 4 start | 10.35° | direct |
| Feb 28 start | 12.81° | retro |
| May 2 start | 13.76° | direct |
| Jul 2 start | 15.78° | retro |
| Oct 27 start | 16.80° | retro |
| Dec 15 start | 9.76° | direct |

Conclusions:
- Sheet source is **Drik Panchang-style visibility computation** (Budha
  Asta/Udaya — heliacal set/rise), which is location-dependent and produces
  variable ecliptic orbs by construction. Owner confirmed Drik Panchang
  inspiration.
- This refutes: the generator's flat 15° arc (v2 calibrated it against the
  Jul-2026 row, which *coincidentally* sits near 15° — inferior conjunctions
  cross the glare zone fast, so almost any orb fits there; superior
  conjunctions then drift by days), and also the classical Surya-Siddhanta
  fixed 14°-direct/12°-retro approximation.
- A modern arcus-visionis model (swe.heliacal_ut, default params, Delhi/Ujjain)
  gets within 2–3 days on some boundaries but skips events on others — not a
  drop-in match.
- The Motion (retrograde) and Journey (sign transit) tables match the DB **to
  the minute** — combust is the only visibility-based table, hence the only
  divergent one.
- Trivia: the sheet's LORD column on combust/motion rows = weekday lord of the
  start date (Jan 4 Sunday → Sun, Jul 2 Thursday → Jupiter, …).

**CALIBRATED (2026-07-21, city = Ujjain, owner-confirmed):** a parameter sweep
over the Swiss Ephemeris VR visibility model converges at extinction
`ktot=0.24` + observer Snellen ratio `3.25` (constants `CALIB_DATM`/`CALIB_DOBS`
in `verify_combust_method.py`). Result vs the owner's 2026 sheet: **6/13
boundaries exact-day, mean |Δ| ≈ 0.9 d, worst 3 d — and on exact-day matches
the time-of-day agrees within minutes** (e.g. model 05:49 vs sheet 05:48),
i.e. this is essentially Drik's model with slightly different visibility
constants. Kālāṁśa time-degree thresholds were tested and refuted: boundary
gaps are phase-dependent (bright pre-superior Mercury visible at ~10 td, faint
post-inferior crescent needs ~14–15 td), which only a magnitude-aware model
reproduces.

**Regeneration plan for `TR-MER-CMB-E-BEA` (next session):**
- 1990–2030 backfill: calibrated heliacal model (±1–3 d edge fuzz on 15–48 d
  windows is acceptable for historical stats; consistent and unbiased).
- Almanac display years (2025–2027): small override table anchored to the
  owner's sheet / Drik Panchang published dates, so the product almanac
  matches the owner's almanac exactly.
- `generate_mercury_windows.py` gets a `detect='visibility'` mode replacing
  the flat 15° arc for this rule; keep windows asta→udaya (combust = invisible
  period). Re-score after regeneration (nightly job or POST
  /api/confidence/compute).

**THE ACTIVE POA: `docs/POA/POA-astro-layer-mercury-launch.md`** — owner
decision 2026-07-21: this session's pipeline (`km_rule_evidence`, base rates,
orb transitions) IS the baseline; earlier attempts (Pattern Engine /
`km_rule_patterns`) are legacy, admin-only, not built upon. Forward phases:
free badge → Almanac view → VaNi narration → slow-planet replication → Venus.

## 7. Build order (proposed)

1. ~~Run migration 160~~ **DONE 2026-07-21** — owner ran it, Catalog shows 19.
2. ~~SR-B4 VIX data-quality check~~ **DONE 2026-07-21** — clean but only 13.5
   months deep; see §3 (realized range promoted to primary yardstick).
3. `TR-MER-CMB-E-BEA` regeneration — **generator updated (v3 visibility
   detection + ALMANAC_OVERRIDES; dry-run verified: all 7 almanac-2026 windows
   reproduce the owner's sheet exactly, incl. day counts 32/16/21/22/26/15/34).
   REMAINING: owner runs `DB_PRIMARY=... python3 generate_mercury_windows.py`
   on the VPS** — reconciling run wipes + rebuilds ALL Mercury rule windows
   1990–2030 (designed behavior), then the 19:00 confidence job (or POST
   /api/confidence/compute) re-scores. Verify with
   `python3 generate_mercury_windows.py --dry-run-combust 2025 2027` first if
   desired (no DB needed).
4. ~~Evidence computation~~ **BUILT 2026-07-21** — migration 161
   (`km_rule_evidence`, one row per rule, grants incl. `authenticated`) +
   `scripts/compute_rule_evidence.py` (range ratio vs 60-session baseline,
   direction counts, ±10-session turn frequency, VIX overlap — every measure
   paired with its matched-length BASE RATE) — wired into the 19:00 IST
   transit-scoring job after benchmark confidence. **Owner: run migration 161,
   then the script once** (`DB_PRIMARY=... python3 compute_rule_evidence.py`)
   to seed rows before tonight's job.
   **⚠ Honest-numbers finding (prototyped live before building):** Mercury
   windows are largely IN LINE with NIFTY's unconditional behavior on coarse
   measures — combust range ratio 1.005, closed-higher 61% vs a drifting-index
   base rate of ≈ the same. The copy contract absorbs this: thresholds in
   `patternLines()` (TradingChart.tsx) only allow an effect claim when it
   clears the base rate (range ≥1.15× or ≤0.85×, direction ±8 pts, turn ±10
   pts); otherwise the card says "in line with usual". Publishing the null is
   part of the product's credibility — the astro layer's primary value is
   ORIENTATION (§2), and any measured deviation that does clear the bar is
   surfaced with its base rate beside it. Finer cuts (combustion stage,
   direction, per-benchmark) are stored in `slices` JSONB for the almanac.
5. ~~Evidence tooltip~~ **BUILT 2026-07-21** — band tooltip in
   `TradingChart.tsx` rewritten: THIS WINDOW ✓/✗/"not scored yet" verdicts
   RETIRED from the user surface (upcoming windows keep their opening date);
   new THE PATTERN block renders threshold-driven evidence copy; base-bias
   "moved as expected" grading retired, expert-inference track record kept
   under an INFERENCE label. THIS CHART line unchanged.
6. Almanac view (flagship premium surface) + free active-window badge.
7. VaNi Morning Brief window narration.

## 8. VaNi unification + a caught accuracy bug (2026-07-22)

Owner correction on the interaction model: local (ribbon) and global
("Ask VaNi" header button) must show and answer the SAME intents, not two
disconnected systems. Investigation found the chart page had **zero VaNi
wiring** — no page registered in `lib/vani_intents.py` / `config/vaniIntents.ts`,
so the global button fell back to the dashboard's 8 generic questions on
any chart. Fixed with the *existing* scanner/equity pattern, not a new one:

- New intent **`index.astro_now`** (`page="index_vp"` — already the
  registered page for `/chart/index/:id` per `usePageContext.ts`, it just
  had no intents) registered in both the backend and frontend registries.
- **Deterministic, no LLM** (`lib/astro_narration.py`) per owner directive:
  *"we don't need LLM everywhere... insert the data into the cache
  table... LLM won't be invoked."* Computed server-side, written straight
  into the existing persistent `km_vani_cache` — the same mechanism
  `scanner.explain_preset`/`equity.*` already use — so the LLM branch in
  `vani_ask()` is never reached for this intent in practice.
  The ribbon's click now calls `useVaNiStore().openWithIntent('index.astro_now')`
  — the same store the header button reads from — replacing the earlier
  bespoke popover trigger. One system, one source of truth.
- **Right-click stays separate** (`OverlayExplainPopover` + `RuleEvidenceRead`,
  deterministic, client-side) — it answers a different, more granular
  question ("why does THIS specific band matter") than the chart-level
  "what's Mercury doing right now." Not unified; revisit if wanted later.

**⚠ Accuracy bug caught while wiring this (same session, before it shipped
to users):** the chart ribbon, canvas ticks, and the first draft of
`astro_narration.py` all marked BOTH sign-ingress AND motion boundaries
(retrograde-turn, station-direct) as "watch days." Re-checking against
`km_rule_evidence`: `TR-MER-RET` start/end sit at **50.9%/47.1% vs a 48.9%
base** — INSIDE the ±5pt honesty threshold, i.e. ordinary days. Only
`TRN-MER-MAN-TRN` 'start' (56.1% vs 48.9%) actually clears it. Fixed across
all three surfaces (ribbon, canvas ticks, narration) in one pass — motion
and combust boundaries now render as orientation only, never the WATCH
framing. Exactly the failure mode principle #2 exists to prevent, caught
by manually tracing the logic against live data before shipping rather
than after.
