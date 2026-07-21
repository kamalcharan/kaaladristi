# VIX Upgrade — proposal (parked, 2026-07-21)

Owner asked to revisit how India VIX is used in the platform. This document
captures the audit findings and the proposal discussed, for when we pick this
back up.

## Current state (verified)

- India VIX **is** tracked — `km_index_symbols.id = 94` — and flows in
  automatically through the generic NSE all-indices bhavcopy download. No
  special ingestion exists or is needed.
- It is used **only as a display widget** today:
  - Sector Rotation page header band (`views/SectorRotationPage.tsx`), color
    bands `<15` calm / `15–20` caution / `>20` elevated.
  - Workspace ticker rail (`components/domain/DashboardV3/TickerRail.tsx`),
    with inverted change-color logic (VIX up = bearish, unlike price tickers).
- **Naming collision**: `App/backend/engine/risk_engine.py`'s "volatility"
  scoring dimension (`score_volatility`) sounds VIX-adjacent but is **100%
  Vedic-astrology-derived** — Moon nakshatra risk, Gandanta, malefic aspect
  clustering. Zero ATR, zero realized volatility, zero VIX anywhere in that
  file. Someone reading the risk breakdown could reasonably assume VIX already
  feeds risk scoring. It does not.
- Nothing in the product computes or scores anything *about* index behavior
  using VIX — it is a number next to the index, not a factor.
- Open backlog item **SR-B4** (`docs/sector-index/SR_POA_addition.md`) just
  asks to "verify India VIX data in `km_index_eod`" — even that basic
  data-quality check has not been done.
- No doc anywhere proposes feeding VIX into `risk_engine.py`'s scoring.

## Proposal — two tiers

### Tier 1 — Observational overlay (small, reuses existing data)

A VIX-regime badge/callout on index pages: `VIX 14.2 · calm` with an
observational note such as "historically, index forward returns in this VIX
band have leaned [X]" — computed entirely from data already in
`km_index_eod`. No new ingestion, no new pipeline step. Matches the existing
VaNi tone rules (factual, educational, non-predictive) and could sit next to
the badge Sector Rotation already has, or on Market Structure / Dashboard.

### Tier 2 — Real volatility-regime factor (large, changes what the engine measures)

Feed VIX level + rate-of-change into the breadth/confluence work already
parked FOR REVIEW — the hidden Astro-Technical Alignment card and the planned
Market Breadth Layer 4 astro-confluence strip — as a genuine "is the market's
fear gauge elevated right now" input alongside astro/breadth signals, not
just a badge.

**Impact of Tier 2, discussed 2026-07-21:**

1. **Multiplies confluence complexity, doesn't add to it cleanly.** Layer 4
   (astro × breadth) is already "designed but not built," and the
   Astro-Technical Alignment card was hidden by the owner (2026-07-09)
   pending a rework of that *two*-signal confluence concept. Adding VIX as a
   third signal means redesigning how three signals weight against each
   other — scope creep on an already-paused feature. Building VIX in before
   the two-signal design is settled risks redoing this work once that
   design changes.
2. **Thin statistical samples.** Slicing 20+ years of history by VIX band
   **and** breadth regime **and** astro window simultaneously leaves very
   few historical instances per cell — the same "check the actual
   distribution before setting thresholds" lesson already learned the hard
   way on `sniper_inst`, compounded by India VIX likely having a shorter
   real history than the 26-year price series. Thin cells produce numbers
   that read as precise but aren't statistically meaningful.
3. **Raises the stakes on the naming collision.** Today there is one
   dormant, misleadingly-named "volatility" dimension (astrology). If Tier 2
   ships, there would be **two** live "volatility" concepts in the product
   at once — astro and VIX-based — a much sharper user-confusion risk than
   today's unused one. The `risk_engine.py` rename (see below) stops being
   hygiene and becomes a pre-ship requirement.
4. **SEBI-safe wording gets harder.** Combining a fear-gauge index with
   breadth and astro into one confluence read is an easy place to drift from
   "observational" into "directional forecast" — the same tightrope the D39
   ROC badge language and VaNi tone rules exist to police, with more
   variables now in play.
5. **Not independently buildable.** Tier 2 depends on Layer 4 actually
   getting resolved — it's "help design and build Layer 4, and fold VIX into
   that design," a multi-session initiative, not a bounded feature.

### Cross-cutting: the `risk_engine.py` rename

Regardless of which tier (or neither) is pursued, `score_volatility`'s
astrology dimension should be renamed away from "volatility" (e.g.
`lunar_risk` / `astro_volatility`) so the naming collision stops being a
landmine independent of any VIX work.

## Open decisions (owner to weigh in on when revisited)

1. Tier 1 first (cheap, reuses existing data) vs. going straight for Tier 2's
   scope?
2. Should SR-B4 (verify VIX data quality) be done as its own standalone check
   before building anything on top of it?
3. Does the `risk_engine.py` rename happen now (cheap, low-risk) regardless of
   tier, or wait until VIX and the astro-volatility dimension are known to
   interact (or not)?

## Status

**Parked** — owner wants to revisit later. No code changes made as part of
this proposal.
