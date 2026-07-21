# Astro Layer — Narrative Contract & Launch Decisions

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

1. **VIX change** — did India VIX close higher inside the window vs the 20
   sessions before it? (India VIX history starts ~2008; windows before that
   fall back to the next two measures. Precondition: run backlog item SR-B4 —
   verify VIX data quality in `km_index_eod` id=94 — before building on it.)
2. **Realized range expansion** — daily range inside window vs baseline.
3. **Turn frequency** — did the index print a local top/bottom inside the
   window? (the natural test for `turning` rules).
4. **Directional matched %** — the existing `km_rule_confidence` machinery,
   for the minority of rules with a real directional hypothesis.

This is VIX-Upgrade **Tier 1 fused into the astro layer** — not Tier 2's
three-signal confluence redesign, which stays parked.

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

**Defined subtask (next session):** calibrate a visibility criterion (e.g.
planet-altitude-when-Sun-at-−X°, or kālāṁśa time-degrees) against the sheet's
13 timestamped 2026 boundaries; regenerate `TR-MER-CMB-E-BEA` windows with the
matched method so product almanac == owner's almanac. **Open question for
owner: which city is set on their Drik Panchang** (times suggest event-time
stamps at Mercury's own rise/set; city changes dates by ±1 day). Fallback
hybrid: import Drik Panchang published dates for display years, calibrated
model for the 26-year backtest history.

## 7. Build order (proposed)

1. Run migration 160 (owner, pgAdmin) → verify Catalog shows 19.
2. SR-B4 VIX data-quality check (small, read-only) — unblocks yardstick #1.
3. Combust method calibration + `TR-MER-CMB-E-BEA` regeneration (§6).
4. Evidence computation: per-window-type stats (VIX Δ, range ratio, turn
   frequency) for the 13 launch Mercury rules — table or matview.
5. Evidence tooltip on band click (extend `OverlayExplainPopover`).
6. Almanac view (flagship premium surface) + free active-window badge.
7. VaNi Morning Brief window narration.
