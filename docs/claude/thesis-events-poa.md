# Thesis events — plan of action

**Status:** audited 2026-09-14, not built. Owner decision pending on Phase 3 scope.
**Mock:** https://claude.ai/code/artifact/80f26d82-6a67-4d80-9a08-987cffe5b89e
(SOLARA, 132 real bars, every scanner event computed with its verified predicate)

Owner framing, 2026-09-14: *"this provides better context to VaNi to tell story
to the user."* That is the goal this plan optimises for. Chart markers are a
by-product; the deliverable is a queryable event history VaNi can narrate from.

---

## The finding that orders everything

Across 132 real SOLARA sessions there are **84 events**. Exactly **four** are
stored anywhere: one Golden Line breakout, one Big Money day, one Stage 2 entry,
one journey turn. Everything else is recomputed in the browser on each page load
or never surfaced.

But storing more is not automatically worth doing, because the families differ
enormously in measured value:

| Family | Base rate | Read |
|---|---|---|
| **Discovery** | 595 closed journeys · **58.5% reached Ascent** · confirmed life **494 days** vs **38** unconfirmed · confirmation at **day 29** | large, measurable asymmetry |
| **Price Action** | 13,776 breakouts · **46.0%** higher after 5 sessions vs a **46.2%** all-bar control (**47.2%** with delivery surge) | indistinguishable from the tape |

Base length before a wake is **3.7 years for confirmed vs 4.0 for failed** — how
long a stock slept says nothing about whether its wake holds. That intuition can
only be retired by stored outcomes.

**So the sequence is: surface Discovery first (it already exists and it earns its
place), derive Price Action second (navigation, not edge), and add new columns
last and narrowly.**

Caveat on the Price Action figure: one 2.5-month window, one horizon, no regime
control. Directional enough to rank families; not a validated edge.

---

## Phase 0 — Make the fix path cascade · ✅ BUILT 2026-09-14

Shipped on `claude/tender-euler-2j7ab5`. 98 backend tests green
(84 existing + 14 new).

**What landed**

- `pipeline2/orchestrator.py` — `DIMENSION_DEPENDENTS` (the recompute graph,
  one evidence-backed edge per entry), `dependents_closure()` (transitive, one
  pass, returned in DAILY_STEPS order) and `validate_dependents()`, which runs
  **at import** so an unknown dimension name or a cycle is a startup error
  rather than a fix job that dies at 2am half-way through a cascade.
- `pipeline2/worker.py` — `_cascade_dependents()`, called from `_run_fix` after
  a non-failing fix, alongside the existing `_reconcile_daily_run_after_fix`.
- `test_pipeline_cascade.py` — 14 tests, no DB, no network.

**Measured closures**

| Repaired dimension | Cascade |
|---|---|
| `vani_flags` | 2 — `scan_refresh`, `scan_membership_snapshot` |
| `stage_classification` | 4 |
| `dots` | 4 — reaches `gl_events`, `wg_journeys` |
| `nse_magic_rs` | 8 — reaches `gl_events`, `scan_refresh`, `wg_journeys` |
| `nse_eod_download` | 21 — the whole compute chain |
| `scan_refresh` | 0 (leaf — membership reads `km_equity_eod` directly) |

**Three decisions worth knowing**

1. **The cascade is forced.** `_handle_script` only nullifies a dimension's
   columns when `force` is set; an unforced re-run can look at its own
   populated column and skip exactly the rows that went stale — the original
   bug wearing a different hat. Accepted cost: if a forced recompute then
   fails, the column is left NULL rather than stale. That is the better
   failure — a NULL drops the fill rate and the gap sweep enqueues another
   fix, whereas stale-but-populated is invisible forever.
2. **A cascade never cascades.** The closure is transitive and computed in one
   pass, so the full set is written at once and those rows carry
   `created_by='cascade'`, which `_cascade_dependents` refuses to expand. One
   repaired column cannot start a self-feeding chain.
3. **`integrity_checks` is deliberately not a dependent.** It is a nightly
   whole-day sweep, not a per-dimension derivative.

**Operational knobs** (env, no deploy needed to change)

| Var | Default | Purpose |
|---|---|---|
| `PIPELINE2_CASCADE` | `on` | kill switch (`off`/`0`/`false`/`no`) |
| `PIPELINE2_CASCADE_MAX` | `25` | cap per parent fix; full chain is 21 |
| `PIPELINE2_CASCADE_DEBOUNCE_MIN` | `30` | suppress a re-enqueue that just ran |

De-duplication is two-layer: skip a dependent already `queued`/`running` for
that date (the `gap_sweep` pattern), then skip one whose cascade job completed
inside the debounce window — which collapses the burst when several inputs are
repaired for the same date.

**Watch on first deploy.** `gap_sweep` wrote 1,353 fix jobs in six weeks
(~32/day). Expect job volume to rise; the queued/running de-dupe should absorb
most of it, because gap-sweep fixes for one date arrive as a batch and the
worker is serial. If it does not, lower `PIPELINE2_CASCADE_MAX` or set
`PIPELINE2_CASCADE=off` and reopen this phase.

```sql
-- after a day of running
SELECT created_by, dimension, count(*) FROM km_jobs
WHERE job_type='fix' AND created_at > now() - interval '1 day'
GROUP BY 1,2 ORDER BY 3 DESC;
```

`gl_events`, `big_money`, `dots`, `wg_journeys` and `scan_refresh` appearing
with `created_by='cascade'` is the pass condition — those five had **zero** fix
jobs in the six weeks before this.

**Still open in this phase.** No per-dimension watermark was added.
`indicators_computed_at` remains unusable (written under
`WHERE indicators_computed_at IS NULL`, so re-runs skip stamped rows) and
`backfill_vani_flags.py` still touches no timestamp. The cascade makes the
recompute happen; it does not yet let a reader ask "what version of the inputs
is this row derived from". Phase 3 needs that answer — revisit before adding
stored event columns.

---

### Original analysis (kept for context)

Do not add a single derived column before this is done.

**The defect.** The daily run is correctly ordered —
`nse_equity_indicators → nse_magic_rs → vani_flags → dots → gl_events →
big_money → scan_refresh → scan_membership_snapshot → wg_journeys` — so derived
events are computed after their inputs. But the `fix` path does not cascade.
Over six weeks of fix jobs:

| Dimension | Fix jobs | Role |
|---|---|---|
| `vani_flags` | **162** | input |
| `nse_magic_rs` | **160** | input |
| `nse_equity_indicators` | **128** | input |
| `gl_events` · `big_money` · `dots` · `wg_journeys` · `scan_refresh` | **0** | derived |
| `stage_classification` | 1 (last 2026-07-31) | derived |

Inputs are corrected ~160 times; the events derived from them are never
recomputed. Fix jobs land **1–6 days after the bar** (2026-09-01 was still being
rewritten on 09-07). So `gl_event` and `bm_event` on any corrected date are
computed from superseded inputs, and nothing says so.

**Why it is blocking.** Adding nine more derived columns multiplies today's
silent-rot exposure by ~5. It is also the answer to "how do we know what is
latest" — a same-row derived column cannot drift from its inputs *if written
together*; it drifts precisely when the writer is skipped.

**Work.** Declare downstream dependencies in `pipeline2/orchestrator.py` so a
`fix` on an input dimension re-runs its dependents for that `trade_date`.

**Watch for.** `indicators_computed_at` is not a usable watermark — it is written
under `WHERE indicators_computed_at IS NULL`, so re-runs skip stamped rows
(2026-09-01's stamp stops at 09-02 while fixes ran to 09-07). And
`backfill_vani_flags.py` issues a bare `UPDATE … SET is_vani_x = (…)` touching
no timestamp at all. Either add a real per-dimension watermark or drive the
cascade from `km_jobs`.

**Done when.** A `fix` on `vani_flags` for date D produces a `gl_events` (and
`big_money`, `dots`) job for D, visible in `km_jobs`.

---

## Phase 1 — Surface what is already stored · zero schema change

Highest value per unit of work in the whole plan. No migration, no backfill.

### ✅ 1a + 1b BUILT 2026-09-14

Frontend only, no migration, no backfill. Build + theme + persona gates green,
typecheck clean, 98 backend tests unaffected.

- `services/indicatorData.ts` — `fetchStockJourney` → **`fetchStockJourneys`**,
  returning every arc (current and archived) with the full milestone set, plus
  `currentJourney()`. `stage_since` added to `EQUITY_EXTRA_COLS`.
- `services/storyEvents.ts` — `StoryJourney` widened; the builder accepts one
  journey or many; **`Journey confirmed`** and **`Journey closed`** join the
  `discovery` kind; stage transitions now read `stage_since`.
- `components/domain/StockCockpit/JourneyStrip.tsx` — new. The five-milestone
  arc, clocks, distance to the base ceiling, and the base rate.
- `scripts/qa/check-journey-events.mjs` — verified to fail against all three
  regressions it guards.

**1c (part) — base rates are computed nightly, not typed in.** Owner call: the
four figures JourneyStrip cites move every night, so `km_journey_base_rates`
(migration 209) stores them, written by `compute_wg_journeys.py` **in the same
transaction as the journeys it summarises**. Same writer, same transaction —
the summary cannot describe a different population than the arcs on screen, and
the wg_journeys `fix` cascade recomputes it with no new dependency edge. The
script's SQL and the migration's seed are asserted byte-identical after
normalisation.

Two rules the check enforces, both more important than the storage choice:
a rate carries its **denominator**, and a missing reading **drops the clause**
rather than defaulting to a remembered number.

**1c (rest) — VaNi is given the arc, not just a marker.** ✅ Built.

The gap was not that VaNi lacked an intent. It was that the fact block VaNi
narrates (`buildThesisFacts`) carried the arc's *story events* — "Journey woke"
as a bare timeline entry — and nothing about the arc those events belong to:
no state, no base, no distance to the ceiling, and none of the recorded
frequencies. VaNi could name the milestone and say nothing about what it meant.

- `services/journeyFacts.ts` — **new, and the only place a journey sentence is
  written.** `baseRateLine` moved here out of `JourneyStrip.tsx`: the strip's
  footnote and VaNi's narration are one comparison, and two phrasings of one
  comparison on the same screen drift apart. `journeyFacts()` emits the block
  VaNi receives.
- `ThesisTab.tsx` — assembles the facts **once** and shares them across the
  narrate button, the free-form question box and the new chip. Three separate
  assemblies would let VaNi answer two questions about one stock from two
  different pictures of it.
- **"✦ Where is this in its journey?"** — a chip on the Thesis VaNi row, shown
  only when there is both an arc and a nightly reading to cite. Its question is
  a fixed constant, so the phrasing is reviewed once and the answer is
  cacheable.
- `_VANI_NARRATE_SYSTEM` gained two rules; `/api/ai/vani-narrate` gained
  `_sebi_post_filter`, which it had been skipping.

**The two properties that are actually load-bearing**, neither visible in a
type, both sabotage-tested:

1. **Every comparison is resolved into a WORD before the model sees it** —
   ABOVE / BELOW, UP / DOWN, "53 days after its wake". The model is never handed
   `base_high 852.40` and `close 749.15` to subtract, nor a signed percentage to
   read the sign of. That is not hypothetical caution: it is the same failure as
   the first live autorun, which read `-0.0361` and wrote "the fast reading is
   slightly above the slow reading".
2. **The frequency is fenced.** "58.5% of 595 confirmed" is one sentence away
   from "this stock has a 58.5% chance", which is a forecast about a specific
   security. The fact block carries an explicit line saying it is not that, the
   prompt forbids the restatement however the facts are worded, and
   `_sebi_post_filter` is the backstop. With no reading, the fence sentence has
   nothing to fence and does not appear.

`check-journey-events.mjs` covers both, verified to fail against a flipped
ceiling side, a raw signed number, a dropped fence, and a remembered base rate.

**The `is_current` trap.** `sleep_date` only ever exists on an archived row, so
filtering to `is_current` structurally hid the end of every completed arc.
PGHL's real journey — woke 2026-07-09, confirmed 07-31, slept 08-31 — is one
chart window and was entirely invisible. METROPOLIS holds eight rows, five of
them wakes that died inside two days.

**A correction worth keeping.** The first version justified `stage_since` as
"catches a transition on the first bar of the window". That was false: the
event loop starts at `i = 1`, so neither implementation could see it — and the
test passed against the bar-diff, the exact trap CLAUDE.md warns about. The fix
was to make the claim true (`addStageEvent` is now called for bar 0, where only
a stored `stage_since` can speak) rather than to soften the comment. `stage_since`
also survives gaps in the loaded series and a stock that leaves a stage and
returns to it, neither of which a diff can see.

### 1a · Discovery milestones (the big one)

`km_wg_journeys` already journals six milestones. `storyEvents.ts` reads **two**.

| Field | Current rows | Archived rows | Surfaced today |
|---|---|---|---|
| `base_start` | 1,102 | 595 | no |
| `turn_date` | 560 | **0** | yes |
| `wake_date` | 102 | 595 | yes |
| `confirm_date` | 75 | 348 | **no** |
| `sleep_date` | 0 *(correct)* | 595 | **no** |
| `gl_event_date` | 94 | **0** | no |

`confirm_date` is the Ascent moment — the payoff of the entire engine — and it
has never appeared on a chart. Add `confirm` and `sleep` to the `discovery`
story kind, and add a journey panel to the Thesis (mock has one).

SOLARA is the worked example: Stirring, 5.3-year base, turned 2026-08-21 from
₹616.90, +21.4% since, 6/6 clocks, ceiling ₹852.40 — **₹103.25 / 13.8% away**.
All of it stored. None of it reaches the user.

### 1b · Stage transitions from `stage_since`

A transition is `stage_since = trade_date` — a WHERE clause, not a `LAG`.
~450/day universe-wide, ~100% populated back to 2018. `storyEvents` re-derives
by diffing bars, so transitions outside the loaded window are invisible.
Keep the existing `UNKNOWN` suppression.

### 1c · Base-rate panels in VaNi

The 595-journey numbers above are one query. They convert a marker ("this
happened") into a decision aid ("this happened 595 times, 58.5% confirmed,
confirmation lands around day 29"). This is the single highest-leverage VaNi
content change available and it needs no new data.

⚠ **Open — `km_journey_base_rates` grants are unverified.** Migration 209
contains `GRANT SELECT … TO authenticated, anon, kd_app`, but
`information_schema.role_table_grants` returned only `kd_readonly` when read
over the read-only MCP connection. That view shows only grants where the
current role is grantor or grantee, so this may be a visibility artefact of
that connection rather than a real gap — the definitive read is `pg_class.relacl`
or `has_table_privilege('authenticated', …)`, and the DB has been timing out
since. It matters because logged-in browser users run PostgREST as
`authenticated`: if the grant genuinely did not apply, `fetchJourneyBaseRates`
returns null for everyone and the frequency clause silently disappears — which
is the designed degraded state, so **nothing would look broken**. That is the
migration-142 failure mode precisely. Re-check before treating 1c as closed.

---

## Phase 2 — Derive Price Action on read · zero schema change

Six of the nine Price Action scanners are one `LAG` over columns already on the
bar row. Do **not** give them columns.

| Scanner | Predicate | History |
|---|---|---|
| Breakout Surge | `pct_chng > 0 AND pct_from_breakout > 0` | 2018 |
| Breakdown Surge | `pct_chng < 0 AND pct_from_breakdown < 0` | 2020 |
| Weekly Movers / Decliners | `pct_wtd` 0-cross | 2018 |
| Monthly Movers / Decliners | `pct_mtd` 0-cross | 2018 |

Golden Line Breakout / Retest are already stored (`gl_event`).

### ⚠ The reference-reset guard is mandatory

`pct_wtd` measures against `prev_week_close`, which changes every Monday;
`pct_mtd` likewise every month. A naive `LAG(pct_wtd > 0)` fires a phantom
crossing on the first bar of each period.

**Measured on SOLARA alone: 33 phantom crossings suppressed in six months** —
about a third of its raw Price Action stream. Suppress the event when
`prev_week_close` / `prev_month_close` moved between bars.

Also de-duplicate repeat crossings inside one period (6 more on SOLARA), or a
stock that oscillates around last week's close fires "weekly breakout" daily.

### Two naming traps to fix while here

1. **`is_vani_breakout` is not the Breakout Surge scanner.** It is
   `rvol > 3 AND close > sma_150 AND rsi_14 BETWEEN 50 AND 78 AND magic_rs > 20
   AND close >= w52_high * 0.95`. On 2026-09-11: scanner = **200 stocks**, flag =
   **8**, overlap = **6**. On SOLARA's 132 bars the flag fired **0 times** while
   the scanner condition fired **14**. The chart's "Fresh breakout" marker is
   showing a different rule.
2. **Membership ≠ event.** The scanner list applies display gates
   (`close >= 50`, `ema_20 IS NOT NULL`, ISIN dedup, top-500 cap). Those belong
   to the *list*, not the stock's history — and `ema_20` is 0% populated before
   2025 while the geometry runs to 2018. Store the bare condition; apply gates at
   query time.

---

## Phase 3 — New columns · narrow, and the only migration

Four things genuinely need storing. Everything else is already on the row.

### 3a · `km_equity_eod` — Flower Pot + breakaway

Flower Pot spans a 60-bar window, so nothing about it is derivable from row +
previous row. It is the only Price Action scanner with **zero history** today —
its columns live on `km_scan_results`, which holds one date.

- **COIL:** `atr15/atr60 < 0.8` AND `(hi10−lo10)/close < 0.08` AND
  `vol5/vol22 < 0.6` AND `|magic_rs − magic_rs[−5]| < 2` AND `nbars ≥ 60` AND
  `close > 20` AND `stage NOT IN ('S3','S4')`
- **BURST:** coiled within prior 22 bars AND `vol_burst ≥ 3` AND
  `range_exp ≥ 2` AND `close_strength ≥ 0.7` AND `close > hi10_prior` AND
  `delivery_pct > 45`
- **SHATTER:** same, `close_strength ≤ 0.3` AND `close < lo10_prior`

Persist per bar: `fpb_phase`, `fpb_compression_score`, `fpb_atr_compression`,
`fpb_vol_death`, `fpb_setup_days`, `fpb_hi10`, `fpb_lo10`, `fpb_tight_today`;
on release only `fpb_vol_burst`, `fpb_range_exp`, `fpb_close_strength`,
`fpb_quality`. Plus `rs_breakaway` (magic_rs separating from `magic_ma`).

**Split backfill ceiling:** coil needs `magic_rs` (~95% to 2022) → backfills to
~2022. Release needs `delivery_pct`, which is **0% before 2024**, 53% in 2024,
89% in 2025 → releases realistically start 2025.

### 3b · `km_wg_journeys` — `stir_start_date`, and persist on archive

- **`stir_start_date`** — the one genuinely missing Discovery field. `stir_days`
  is a rolling count recomputed each run, so the scanner built for *early*
  detection cannot say when it began. Ceiling 2024 (`delivery_pct`).
- **Persist `turn_date` and `gl_event_date` at archive.** Both are live-only:
  560 and 94 current rows carry them, **0 archived rows do**. On a closed journey
  you can never see where the turn was.

### Cost

`km_equity_eod` is **147 columns, 16.65M rows, 19 GB heap + 8.4 GB indexes**,
PostgreSQL 17.11, unpartitioned. `ADD COLUMN` nullable-no-default is
metadata-only — instant. The **backfill** is the cost: batch by date, per family,
to each family's real ceiling. Never one 16.65M-row `UPDATE`.

---

## Phase 4 — VaNi narration

Only after Phases 1–3 land for a family. The mock shows the target shape: one
automatic opening read keyed to the viewer's ICP, then follow-ups.

**ICP keying already exists.** `concede_level` names a price line at a timeframe
(`tight`→20 EMA, `swing_low`→50, `structure`→150 — `constants/breadthLegs.ts` /
`_CONCEDE_LEG`), and `acts_on` names which events matter. Same numbers, three
readings. The mock demonstrates all three on SOLARA.

**Three rules the mock encodes, all from existing lessons:**

1. **Pre-compute every comparison.** The model copies a relationship; it never
   derives one. Never hand it a signed number.
2. **Name the evidence gap.** The Swing persona's answer is *"there is no base
   rate to give you"* — `bm_event` holds 9 trading days. An assistant that says
   what it cannot answer is what makes the answers it does give believable.
3. **"Nothing here matches how you work" is a valid reading.** The
   high-intensity persona gets no coil in 132 sessions. That is a decision.

This also fixes a recorded defect: `scanner.read_results` was found
*"generic/repeats daily"* because it has no comparison point. Events **are** the
comparison point.

---

## Open decisions for the owner

1. **Flow events — column, derive, or drop?** 1,256/day universe-wide, 42% of the
   whole stream, lowest priority, dominated by `LOW_VOLUME ↔ X` churn. On SOLARA
   "Fresh longs" fires 3× in 9 sessions, each just volume re-crossing a
   threshold — and on 2026-09-07 it duplicates the Big Money event on the same
   bar. Recommend: derive, and require the previous *labelled* flow to differ.
2. **Does the Thesis STRUCTURE strip keep top billing?** It is built on
   `bm_event` — **9 trading days** of history, the one family that can never be
   base-rated. Discovery has 595 outcomes and is not shown. Recommend trading
   prominence until `bm_event` has history.
3. **Backfill `bm_event`?** Everything before 2026-09-01 is NULL. Without it the
   thesis headline stays un-evidenced.
4. **Verify the Discovery archive floor.** Oldest wake is 2021-09-30, but the
   engine loads 15 years and detects 2-year bases, so a 2015 wake *should* be
   reconstructible. Either the pool had none, or the archive was pruned — the
   data cannot distinguish the two.
5. **Phase 3 scope** — all of 3a+3b, or Discovery only (3b) first?

---

## Verification per phase

| Phase | Check |
|---|---|
| 0 | `fix` on `vani_flags` for D creates dependent jobs for D in `km_jobs` |
| 1 | SOLARA chart shows the journey turn; a confirmed journey shows `confirm_date`; a slept one shows `sleep_date` |
| 2 | Re-run the SOLARA extract: 14 breakouts, 12 weekly crossings, **33 resets suppressed** |
| 3 | Coil count on a known compressed name matches `km_scan_results` for the current date |
| 4 | `test_vani_routing.py` extended with a derived-statement check per new family |

Existing gates still apply: `python -m unittest` (84 tests),
`npm run typecheck`, `npm run build` (theme + persona), and the manual
`scripts/qa/` harness — which does **not** run inside the build.

---

## Evidence appendix

All figures measured against the live DB on 2026-09-14.

- 84 events / 132 SOLARA bars; 4 stored; 50 from Price Action, none rendering
- 33 phantom weekly/monthly crossings suppressed; 6 repeat-in-period
- 0 coils in 132 sessions; 4 Magic RS breakaways (latest 2026-08-20, one session
  before the journey turned)
- `bm_event`: 2026-09-01 → 09-11 only, 430 rows, 287 stocks, kinds
  `entry`/`exit`/`mixed`
- 18 `is_vani_*` flags exist; `storyEvents` uses 5
- `km_scan_membership_daily`: 8 Price Action presets, 17 dates, top-N capped
  (weekly/monthly movers exactly 500/day), WHERE clause hand-copied from
  migration 197 — a second implementation already drifting
- Daily universe event volume: flow 1,256 · conviction 776 · stage 459 ·
  zone 351 · scan flags 95 · bm 49 · gl 29 ≈ **3,015/day**, ~750K/year
