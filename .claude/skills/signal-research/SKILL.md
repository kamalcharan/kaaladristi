---
name: signal-research
description: Measure a candidate trading signal against the live Kāla-Drishti database before any scanner is built or re-calibrated. Use when asked to research, validate, calibrate or re-check a signal or a scanner gate — PEAD / post-result drift, volume spurts, RS percentile, filing events, breakout thresholds, or any "is X worth building / should we change this threshold" question. Also use before editing a shipped gate (PEAD_MIN_REACTION_PCT, a matview arm's predicate, a kd_scan_presets row), because a gate changes only on a measurement this procedure produced.
---

# Signal research

Every threshold in this product is supposed to be **measured, never chosen**.
This is the procedure that produces a measurement good enough to change one,
and the list of ways this particular dataset will lie to you if you skip a
step.

⚠ **This skill does not change code.** It produces a dated findings section in
a `docs/claude/*.md`. Changing the scanner is a separate, ordinary task that
cites those numbers. Keeping the two apart is what stops a number from being
invented to justify an edit already decided on.

## The seven traps

Each one has already produced a wrong number in this repo. They are not
hypothetical.

1. **Same-date universe median, always.** Subtract the median forward return
   of all NSE active non-ETF stocks on that same date. Otherwise two weeks of
   a rising tape manufactures an edge out of nothing.
2. **Median AND mean — report both.** One unadjusted split dominates a mean.
   The gap between them is itself a finding: the big-move × filing study had
   unfiled ≥+15% at mean **+3.29** against median **−0.69**. A mean-based
   table said the opposite thing.
3. **Corporate actions.** `km_corporate_actions` is EMPTY, so closes are raw.
   Drop any forward window containing a 0.55× / 1.80× single-session cliff and
   **print the count** — including when it is zero. A study that does not
   mention cliffs has not checked them.
4. **Horizon vs available history.** Print, per candidate horizon, how many
   events carry the FULL window. If that is 0 the horizon is *unmeasurable*,
   not "not yet run" — say so instead of silently truncating.
5. **Survivorship.** A stock with no bar at t+h is counted and reported.
   Silently excluding delisted names biases every result upward.
6. **Contrast against a control, never a bare number.** "Bucket X returns
   +2%" means nothing. "+2% against −0.7% for the same population without the
   condition" is a finding.
7. **Split the sample.** By month, or first half vs second half. A result
   present in one half and absent in the other is a regime artifact. The
   `rs_percentile` top bucket was **+4.38 in 2023 and −2.31 in 2024-25**.

## Method

Run in order. Stop and report if a step's n collapses.

### 1. Envelope first, hypothesis second

Before testing anything, establish what the data can answer: first event date,
latest bar, sessions available, and events-with-full-window per candidate
horizon. **Choose the horizon from that table, not from the literature.**

### 2. Reproduce the shipped calibration

If the signal already has a gate, re-derive the bucket table that justified
it. **If it does not reproduce, stop** — the data moved and the gate is no
longer backed by anything.

### 3. Test the hypothesis as a contrast

Same population with and without the condition. Report n, median excess, mean
excess, % positive for both sides.

### 4. Decide — and be willing to decide "no"

A gate moves only if the contrast is **both** larger than the spread between
neighbouring buckets **and** stable across the split sample.

⚠ **"No threshold" is a valid, sometimes correct outcome.** The breakout
cooldown study ended there: the gap distribution across 566 entries was
12.5 / 9.2 / 20.8 / 40.8% — no cliff anywhere, so any N would have been taste
wearing the costume of a rule.

### 5. Write it up before touching code

Append a dated section to the relevant `docs/claude/*.md`: the envelope, the
full bucket table with n, the contrast, the split-sample check, cliff drops,
and **what you decided not to do**. Every number carries its denominator.

## Running it

`scripts/signal_study.py` is the read-only harness (writes nothing). It does
the envelope, the bucket table with same-date-universe excess, the cliff
filter and the split-sample check for the two event sources that exist today:
`--source results` (`kd_result_returns`) and `--source filings`
(`km_corporate_events`).

```bash
cd App/backend && DB_PRIMARY=... python ../../.claude/skills/signal-research/scripts/signal_study.py \
    --source results --horizon 20 --buckets -5,-2,2,5
```

⚠ **Port 5432 is not reachable from the cloud container.** Run it on the VPS,
or reproduce the same SQL through the read-only `kaala-postgres` MCP for
exploratory work. The MCP **rejects `percentile_cont`** — use the
`row_number()` median idiom (the script and this skill both do).

⚠ A runaway SELECT through the MCP once wedged the server for hours, and
killing the client does **not** stop the database: `pg_cancel_backend(pid)`
from `pg_stat_activity`, not Ctrl+C.

## Worked example — Post-Result Drift (the live one)

**The scanner is the price-reaction HALF of PEAD.** Textbook PEAD is two legs:
an earnings **surprise** vs an expectation, and a price reaction that
**agrees** with it (the concordant filter). There is no consensus, estimate,
EPS, XBRL or fundamentals table in this database — checked, zero matches. So:

- The reaction is a proxy for surprise, but a noisy one — it also carries
  guidance, positioning and mood. The concordant filter exists to drop the
  cases where the two disagree, and **we keep those in**. Expect a weaker
  effect than the literature and never imply otherwise in copy.
- **Say "Post-Result Drift", not "PEAD", in anything user-facing.**

Facts measured 2026-09-24, so they are not re-derived by accident:

| | |
|---|---|
| Shipped gate | reaction `> +5%` |
| Reproduced 2026-09-24 by the harness | see the table below — the gate holds |
| **60-session hold is UNMEASURABLE** | 53 sessions exist since the first Day 0; **0** events carry 60 |
| MagicRS adds nothing | react ≥5% with RS rising +0.80% vs falling +0.59%, n=42 |
| Filing count adds nothing | 1 / 2 / 3+ filings on Day 0 → +0.03 / +0.01 / −0.10 |
| Short side is real, unbuilt | every band below +2% measured −1.5 to −1.9% |
| **One season only** | 86/223/339/469/**979**/199 results per week Jul–Aug, then **three weeks of ZERO**, then 7 and 6 |

**Reproduction run, 2026-09-24, horizon 20, excess per event vs the same-date
universe median** (this is step 2 of the method, done):

| reaction bucket | n | median excess | mean excess | % positive |
|---|---|---|---|---|
| < −5% | 292 | −0.55 | +2.62 | 48.3 |
| −5 … −2% | 554 | −0.59 | +1.46 | 45.7 |
| −2 … +2% | 833 | −0.30 | +1.37 | 48.5 |
| +2 … +5% | 288 | +0.72 | +2.29 | 52.8 |
| **≥ +5%** | **277** | **+1.72** | +4.99 | **56.3** |

0 cliff-contaminated windows in any bucket. The gate reproduces and the
gradient is monotone from −5% upward, so **+5% stands**.

⚠ **This run is itself the clearest demonstration of trap 2.** Every bucket
has a POSITIVE mean, including the three with negative medians. A mean-based
version of this table reads "every reaction band is profitable" — the exact
opposite conclusion, from the same rows.

⚠ Excess is computed **per event, then medianed** (+1.72). The earlier figure
of +1.54 pts subtracted one universe median from one bucket median; per-event
is the more correct statistic and the two should not be quoted
interchangeably.

Two mechanics the harness already respects:

- **Reaction and drift are never merged.** `reaction_pct` is Day −1 → Day 0;
  `drift_pct` is Day 0 → end. Measuring from Day −1 folds the announcement
  jump into the drift — reporting an effect never measured.
- **One row per RESULT, not per announcement.** `kd_result_returns` applies
  migration 216's de-duplication (427 of 2,733 rows were a second Day 0 for a
  result already counted). Never query `km_corporate_events` for a drift study.

### The known gap, deliberately without a procedure

The honest fix for the missing leg is a **SUE**, and it does **not** need
analyst consensus — the original Bernard & Thomas / Foster SUE was a *seasonal
random walk on the company's own past EPS* (actual vs same quarter last year
plus trend, scaled by the stdev of past surprises).

That needs XBRL actuals — `has_xbrl` is TRUE on every result filing and NSE
publishes it, but we store only the boolean and the PDF URL — plus ~8 quarters
of history against the ~1 quarter we hold. **No steps are written for it here
on purpose**: a procedure for data that does not exist is one nobody can
follow and nobody trusts. Revisit when the quarters exist.

## After the write-up, when the scanner does change

- The PEAD gate lives in **two places that must move together**:
  `PEAD_MIN_REACTION_PCT` in `services/scanEngine.ts` and the
  description/tooltip in `kd_scan_presets` (a migration). The DB row wins; the
  array is only the offline fallback.
- `scripts/qa/check-pead-scanner.mjs` asserts the gate value, the absence of an
  RS filter, the corporate-action filter and the ordering. **Update the test in
  the same change** and put the new measured numbers in its header.
- A short leg is a **separate preset**, not a flag: empty-state copy, ordering
  and column set all differ, and one list holding both directions cannot be
  sorted honestly.
