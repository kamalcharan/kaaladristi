# Sprint 1 · Item 1 — Chain lag measurement

**Run 2026-09-15 against the live DB. Read-only.**
Purpose: derive the Day-0 join window from our own market rather than importing
"60–90 days" from Ball & Brown.

---

## ⚠ Item 3 completed itself during this session

`km_wg_journeys` was rewritten at **19:33 IST on 2026-09-15** — a nightly run
landed mid-analysis. Figures taken before it are superseded:

| | Before the run | After |
|---|---|---|
| `turn_date` on confirmed arcs | 61 of 423 | **388 of 423** |
| `turn → wake` | **−83.7 days** (nonsense) | **+68.3 days** |

The negative lag was the documented `turn_at()` state: archived arcs had no turn,
so the only rows carrying one were *current* journeys where turn is "a property
of now" and therefore lands after the wake. That run derived turn at the wake bar
for archived arcs, and the sign corrected itself.

**`stir_first_date` was never broken.** It is NULL on archived rows *by design*
(migration 211 — stirring is a property of now) and is populated on **1,048 of
1,100 current rows**. The earlier "0 of 1,697" reading was a wrong framing, not a
defect.

**So Sprint 1 item 3 is substantially done.** The remaining hole is
`gl_event_date`: 0 on all 594 archived rows, 89 of 1,100 current.

---

## Journey population (2026-09-15, 1,694 rows)

| | n | turn | stir | gl | wake | confirm | sleep |
|---|---|---|---|---|---|---|---|
| current STIRRING | 711 | 309 | 711 | 65 | — | — | — |
| current HIBERNATING | 286 | 116 | 245 | 18 | — | — | — |
| current ASCENDING | 75 | 59 | 67 | 5 | 75 | 75 | — |
| current WAKING | 28 | 28 | 25 | 1 | 28 | — | — |
| **archived ASCENDING** | **348** | 329 | 0 | 0 | 348 | 348 | 348 |
| **archived WAKING** | **246** | 151 | 0 | 0 | 246 | — | 246 |

Archived ASCENDING ÷ all archived = 348/594 = **58.6%**, which reconciles with
the recorded base rate.

---

## The two segments behave completely differently

Closed (archived) journeys only:

| Segment | n | ≤0 | 1–15 | 16–30 | 31–60 | 61–120 | >120 | mean |
|---|---|---|---|---|---|---|---|---|
| **turn → wake** | 480 | 17 | 80 | 51 | 88 | 81 | **163** | 100.6 d |
| **wake → confirm** | 348 | 0 | **126** | **141** | 34 | 41 | 6 | 29.0 d |

- **wake → confirm is tight**: 267 of 348 (**77%**) inside 30 days. Consistent
  with the recorded 29-day median. This is a fast feedback loop — good for the
  A/B, because an outcome is known within a month of the wake.
- **turn → wake is diffuse**: mean 100.6 days, **34% beyond 120 days**, and the
  buckets (80 / 51 / 88 / 81 / 163) are near-flat with a long tail. **No cliff
  anywhere.**

### Consequence for the Day-0 join window

A 30-day window captures only **148 of 480 (31%)** of turn→wake intervals; ~120
days captures about two-thirds. If sparks propagate on a similar timescale,
**the join window has to be ~90–120 days, not the 30–60 the PEAD literature
implies.**

And because the distribution supplies no natural break, any single number is
taste — the same answer the Price Action cooldown got. **The window should be a
parameter the A/B sweeps, not a constant someone picks.** A wide window also
admits more coincidental joins, which raises rather than lowers the need for the
matched control.

---

## Suggestive, NOT established: the lag may predict the outcome

| turn → wake | confirmed | never confirmed | confirm rate |
|---|---|---|---|
| ≤ 30 days | 110 | 38 | **74.3%** |
| > 120 days | 89 | 74 | **54.6%** |
| all with a turn | 329 | 151 | 68.5% |

A ~20-point spread between the extremes, with the mean lag 95.4 days for
confirmed against 112.0 for unconfirmed.

**⚠ Do not act on this yet.** The subset is selected: **94.5% of confirmed arcs
carry a `turn_date` versus 61.4% of unconfirmed ones**, so presence of a turn is
itself correlated with the outcome and part of the spread may be that artifact
rather than the lag. It needs the same matched control this plan specifies for
the Sprint 4 A/B — same mcap band, same sector, same period.

Worth chasing, because if it survives it is a free predictor requiring no new
data at all.

### Replicated independently

`base_years` is **3.63 (confirmed) vs 3.71 (never confirmed)** — identical. How
long a stock slept says nothing about whether its wake holds. Lifespan after the
wake is **505 days vs 59**, the asymmetry the Discovery layer was built on.

---

## Not yet measured

The middle of the chain — volume drive, big money and breakout relative to the
wake — needs a join to `km_equity_eod` (16.7M rows, 60.8% cache hit rate). Held
deliberately: the nightly run wrote at 19:33 and its cascade may still be
draining, and the owner has reported the DB going unresponsive during pipeline
processing. To be run in a quiet window, bounded to archived journeys of the last
24 months rather than the full table.

---

# Middle of the chain — measured 2026-09-15 (DB quiet, 0 active queries)

## Item 2 was mis-scoped, and the measurement did not need it

The POA said to extend `km_scan_membership_daily` to the Discovery and Stage
families "so the chain can be measured". **That premise is wrong.** Measured:

| Chain step | Source | History |
|---|---|---|
| `volume_drive` | `km_equity_eod.dot_svd` / `dot_sbd` | **1996-03-14, 7,006 days** |
| `stage_2_watch` | `km_equity_eod.stage` | **1996-10-22, 7,060 days** |
| Discovery | `km_wg_journeys` wake/confirm/sleep | full, per arc |

All three are already historical. The chain is measurable **today**, directly
from source, with no new table and no backfill.

`km_scan_membership_daily` exists for a different job, stated in its own header:
day-over-day *"which stocks are new to this scan since yesterday"* diffs for the
Phase 3 VaNi features. Extending it to Discovery/Stage is real **product** work
— new-today badges on those scanners — but it is **not a Sprint 1 dependency**
and was built into the plan on a false premise. Re-scoped accordingly.

## Volume drive leads the wake, and its presence predicts confirmation

Archived (closed) arcs, volume-drive day in the 120 sessions before the wake:

| | arcs | with VD before wake | % | mean lead |
|---|---|---|---|---|
| **CONFIRMED** | 348 | 296 | **85.1%** | 68.8 d |
| **never confirmed** | 246 | 154 | **62.6%** | 69.0 d |

Read as a base rate:

| Volume drive in the 120d before the wake? | arcs | confirmed | **confirm rate** |
|---|---|---|---|
| **Yes** | 450 | 296 | **65.8%** |
| **No** | 144 | 52 | **36.1%** |
| all | 594 | 348 | 58.6% |

**Presence of prior volume drive nearly doubles the confirmation rate** —
36.1% → 65.8%. The *lead time* carries no information (68.8 vs 69.0 days,
identical); only presence does.

### Why this one is cleaner than the turn-lag finding

The turn-lag result earlier in this document is selection-biased: `turn_date` is
present on 94.5% of confirmed arcs against 61.4% of unconfirmed, so some of its
spread is missing-data differential.

This one has no such differential. **Every archived arc has a `wake_date`
(594/594)**, and `km_equity_eod` carries full history for all of them, so
`with_vd` is a measured property rather than a data-availability artifact.

### Confound checked and cleared

CLAUDE.md records `dot_svd`/`dot_sbd` going **all-FALSE from 2026-04-06 to
2026-08-24** (`compute_dots.py` was never wired into pipeline2). Had unconfirmed
arcs clustered there, the gap would be an artifact. Coverage by year:
**2019–2025 all 243–251 days; 2026 has 173 of ~178 elapsed** — the dead window
was backfilled after the fix. Uniform across the whole sample.

### One caveat that does survive

Archived confirmed arcs skew ~6 months older (mean wake year 2022.84 vs 2023.35)
because a confirmed arc needs ~505 days to complete and archive, while an
unconfirmed one closes in ~59. That is survivorship structure in the sample. It
is small against a five-year span with uniform dots coverage, so the finding
stands — but the spark A/B must control for it rather than inherit it.

## What this gives Sprint 4

This is the **template for the spark A/B**, run end to end on data we already
have: a binary antecedent, a fixed lookback, a confirm-rate split, a coverage
confound explicitly checked, and the selection bias named rather than assumed
away. The spark version substitutes a filing for the volume-drive day.

It also suggests a **free predictor needing no new data at all** — prior volume
drive as a confirmation filter on Waking Giants — worth its own validation pass
with a matched control.
