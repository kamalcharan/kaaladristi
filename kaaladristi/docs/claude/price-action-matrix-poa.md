# Price Action — Rolling-Window Breakout / Breakdown (POA)

Scoping doc for expanding the **Price Action** category beyond the single live
preset (`breakout_surge`).

Owner direction (2026-08-25), in two steps:

1. Breakout and breakdown, on a daily / weekly / monthly clock.
2. **Correction — the clocks are ROLLING DAY WINDOWS, not period-close bars.**
   "Weekly" means a **5–7 day** breakout; "monthly" means a **22–25 day**
   breakout. Computed on daily bars, refreshed **every day**.

Status: **not built.** This doc is the plan, and the measured evidence that
changes part of it.

---

## 1. The rolling reframe — why it is the better design

The period-close reading (`km_equity_weekly` / `km_equity_monthly`) is the
wrong instrument for this, and the rolling reframe removes three problems at
once:

| Problem with period-close bars | Under rolling windows |
|---|---|
| `week_end`/`month_end` hold each stock's OWN last traded day, so a naive `max(period_end)` filter silently drops **99 weekly rows (2.9%)** and **142 monthly (4.3%)**, skewed illiquid — a universe gap against the Settled Decision, same class as migration 179 | **Gone.** One row per symbol per trading day, keyed on `trade_date`. |
| Refreshes only at period close — on 2026-08-25 the newest monthly bar is 2026-07-31, so a "monthly" screener shows July for 25 days | **Gone.** Every screener updates nightly. |
| Needs 4 new columns on 2 extra tables + an extended weekly/monthly indicator chain | **Only `km_equity_eod`.** |

Everything below therefore reads **`km_equity_eod` only**. The weekly/monthly
tables stay as they are (they remain right for Waking Giants' multi-clock
alignment and for weekly Volume Shockers — different features).

The vocabulary also lines up with the house standard already on the Breakout
Surge table: `score_5d`/`score_22d`, `ret_5d`/`ret_22d`,
`avg_amt_5d`/`avg_amt_22d`. A 5D / 22D breakout is the same language.

---

## 2. ⚠ The windows are NESTED, not independent

Mathematically, a 22-day window contains the 5-day window. **Any stock making a
22-day high is necessarily also making a 5-day high.** So:

```
{5D breakout}  ⊃  {22D breakout}  ⊃  {66D breakout}  ⊃  {52W high}
```

These are not six independent screeners — they are **one signal at four
depths**. Shipping them as separate tabs means the 5D list silently contains
every row of the 22D list, and a user comparing them sees duplication rather
than distinction.

Measured on 2026-08-24 (close ≥ ₹50, ≥26 bars, universe 4,905):

| Window | Breakouts | Breakdowns |
|---|---|---|
| 5D | 1,053 | 1,264 |
| 7D | 875 | — |
| 20D *(= today's `breakout_surge`)* | 565 | — |
| 22D | 554 | 559 |
| 25D | 527 | — |

Note 20D / 22D / 25D differ by <7%. **The live `breakout_surge` already IS the
"monthly" screener** in this framing — there is no separate 22–25 day screener
to build, only a possible relabel.

---

## 3. ⚠ Measured edge — the shallow windows have none

Forward test, all breakout instances Jan 2025 – Jul 2026, close ≥ ₹50, ≥67 bars
of history, green day, measured against the close 22 trading days later.
Tiers are exclusive (each row counted at its deepest window only):

| Tier | n | Fwd 22d | % up |
|---|---|---|---|
| No breakout (baseline) | 229,115 | +1.04% | 48.5% |
| **5D high only** | 108,917 | +1.02% | **48.6%** |
| **22D high** | 44,741 | +0.74% | **47.4%** |
| **66D high** | 52,672 | +1.50% | **53.6%** |

Read plainly: **a 5-day breakout has no forward edge, and a 22-day breakout is
marginally worse than doing nothing.** Only when the breakout reaches back
~3 months (66 bars) does a real tilt appear.

That is not an argument against building the feature — a short-window breakout
is a legitimate *observational* filter, and users ask for it. It IS an argument
against presenting 5D and 22D as premium standalone screeners, and against any
copy implying they predict anything.

### The 52-week tier — looks spectacular, is contaminated

A first pass showed the `close >= w52_high` tier at **+22.4% fwd22d, 69.7% up**
(n=3,193). **Do not use that number.** Verification found:

- Only **536 distinct symbols** across 3,193 events — ~6 events per symbol,
  the same run counted on consecutive days.
- **162 events (5%) show >100% forward returns**, max 221%.
- The top outliers are **all one stock** — AHLWEST, Apr 2026, appearing 15+
  times at an *identical* 221%: a circuit-locked illiquid name in a sustained
  run, re-counted every day of it.

`w52_high` is also computed with `min_periods=1`, so a recently-listed symbol
gets a "52-week high" from a handful of bars — the migration-169 warm-up class.

The directional tilt is probably real; **the magnitude is an artifact.** Before
any 52W tier is quoted or shipped it needs event de-duplication (one event per
run, not per day), a liquidity gate, and a `nbars >= 252` gate.

---

## 3a. Reverse-engineered: the owner's live weekly-breakout output

The owner supplied a weekly-breakout export (2026-08-24, ~190 rows) and asked
what it actually computes. Recovered exactly, verified against the DB:

**`Breakout` = the PREVIOUS WEEK'S CLOSE.** Not a rolling high, not a 5-7 day
high — a one-period lookback against the close.

Evidence:

- 20 of 20 sampled `Breakout` values equal the symbol's close on 2026-08-21
  (the prior Friday). Only 4 of 20 coincidentally equal our stored 20-day
  `breakout_level`.
- Cross-checked against `km_equity_weekly` for `week_end = 2026-08-21`:
  RATNAMANI 2354.40, SIEMENS 3920.00, MUTHOOTFIN 3022.00, ITC 269.40,
  LTFOODS 427.60 — all exact matches to `weekly_close` (and NOT to
  `weekly_high`, which is 2425.00 / 3988.50 / 3055.10 / 278.20 / 437.00).

Therefore **`% from Breakout` = week-to-date return**, and the list is
"every stock trading above last week's close, sorted by week-to-date gain".

**`D%` is identical to `% from Breakout` in every row — this is a Monday
artifact, NOT a bug.** 2026-08-24 was the first session of the week, so
week-to-date == day change. They diverge Tue-Fri. Both mappings are correct:
`d_pct` <- `pct_chng`, and the breakout columns are read straight from the row.

**Universe filter recovered:** NSE, `mcap_cr >= ~14,000`. The smallest caps in
the export are ANURAS 14,293 / APOLLO 14,312 / TI 14,318 / CEATLTD 14,424, with
nothing below 14,000. Reproducing that gate returns **199 rows** against the
export's ~190 — a match.

### Compatibility verdict

**Display layer: 100% compatible.** Every column in the export already exists
in `km_equity_eod` — Score 5D/22D, Avg Amt Inv 5D/22D, RSI, EMA 20, D%, MCap,
52W High, % Below 52W H, 5D%, 22D%, 66D%. Nothing new to compute.

**Signal layer: much looser than ours.** A one-period close comparison is
momentum ("up on the week"), not a breakout. It admits structurally weak names:
ITC appears at +0.11% while sitting **-36.8% below its 52-week high**;
HDFCBANK -28.6%; INFY -34.6%. Our 20-day `pct_from_breakout` correctly scores
those as **-6.68 / -3.31 / -5.10** — i.e. not breaking out of anything.

**Build cost: near zero.** Previous week's close is one `LAG` over
`km_equity_weekly` (or the last daily close where `week_start` < current),
joined to today's daily row. No new pipeline columns, no backfill.

### Strictness ladder, measured on 2026-08-24 (NSE, close >= 50, mcap >= 14k Cr, universe 475)

| Definition | Rows |
|---|---|
| Above previous week's **close** *(the export's rule)* | **199** |
| Above previous week's **high** | 41 |
| Above the **20-week high** | 44 |

The export's rule returns 42% of the eligible universe. The two stricter rules
return ~9% and are the ones that read as an actual breakout.

**Recommendation:** ship the export's rule if it is what the owner wants, but
name it for what it measures — *Week-to-Date Leaders* / *Above Last Week's
Close* — and keep "breakout" for a rule with a real lookback. Both are cheap;
they can ship side by side, and the `% from Breakout` header should read
`% WTD` under the loose rule so the column is not mislabelled.

### 3b. The monthly export — same family, confirmed

The owner then supplied the **monthly** export (same date, ~250 rows). It
resolves the family completely:

**`Breakout` = the PREVIOUS MONTH'S CLOSE** (2026-07-31). 15 of 15 sampled
values match exactly — RATNAMANI 2358.90, SIEMENS 3760.00, WELCORP 1650.60,
PTCIL 17737.00, URBANCO 129.39, RELIANCE 1307.80, TITAN 4875.20, SBIN 1027.40,
BOSCHLTD 41085.00. So `% from Breakout` = **month-to-date return**.

(MUTHOOTFIN's 3119.60 equals our stored 20-day `breakout_level` by coincidence
— July's close happened to be the 20-day high. One row agreeing is not the rule.)

**The two exports prove each other.** In the weekly export every `D%` was
positive; in the monthly, 141 of 259 rows are **red today**. That is exactly
what the hypothesis predicts: the weekly export ran on a Monday, so
week-to-date == day change and a WTD > 0 filter forces a green day; the monthly
filter (MTD > 0) says nothing about today. An internal consistency check that
could not pass by accident.

### The family, stated plainly

Both screeners are **period-to-date momentum**, not breakouts:

| | Weekly export | Monthly export |
|---|---|---|
| `Breakout` reference | previous **week's** close (Fri 08-21) | previous **month's** close (Jul 31) |
| `% from Breakout` | week-to-date return | month-to-date return |
| Filter | close > prev week close | close > prev month close |
| Sort | `D%` descending | `D%` descending |
| Universe | NSE, `mcap_cr >= ~14,000` | same |
| Export rows / we reproduce | ~190 / **199** | ~250 / **259** |

`D%` is the plain daily change in both, correctly mapped (`d_pct` <- `pct_chng`).

### Strictness ladder — monthly, same date (universe 473)

| Definition | Rows |
|---|---|
| Above previous month's **close** *(the export's rule)* | **259** (55% of universe) |
| Above previous month's **high** | 124 |
| Above the **12-month high** | 84 |

The pattern holds from the weekly case: the export's rule admits over half the
eligible universe, because "up on the month" is a low bar. The stricter rules
land at 26% and 18%.

### What this means for the build

The whole family is **one fetcher with a parameterised reference close**:
`prev_week_close` / `prev_month_close`, both derivable from `km_equity_eod`
alone (last close before the current period start) or read from
`km_equity_weekly`/`km_equity_monthly`. **No new columns, no backfill, no
pipeline change** — the cheapest thing in this document.

Recommended: ship them as **Week-to-Date** and **Month-to-Date** movers, with
the column headed `% WTD` / `% MTD`, and keep the word *breakout* for the
lookback-based rules in section 4. Same data, honest label, and the two
families can sit side by side in Price Action.

---

## 4. Recommended shape — one screener, four depths

The data supports **depth as a column, not as six tabs**:

- **Breakout Watch** (daily, rolling) — every stock closing above a prior-N-day
  high, with a **Breakout Depth** column showing the deepest window cleared:
  `5D · 22D · 66D · 52W`. Sortable and filterable, default sort deepest-first.
- **Breakdown Watch** (daily, rolling) — the mirror, `breakdown_level` = prior
  N-day *minimum* of close, depth column `5D · 22D · 66D · 52W low`.

This gives the user everything the 2×3 matrix would have, without the nesting
duplication, in two presets instead of six — and the depth column is exactly
the dimension the forward test says carries the information.

**If the owner still prefers separate screeners**, the honest split is by
depth, not by clock: `Breakout 5D` / `Breakout 22D` / `Breakout 66D+`, each
filtered to its *exclusive* tier so the lists do not overlap. Same columns,
same compute — purely a presentation choice.

---

## 5. What has to be built

| # | Change | Scope |
|---|---|---|
| 1 | `breakout_level_5/22/66` + `breakdown_level_5/22/66` on `km_equity_eod` (plus `pct_from_*`) | migration |
| 2 | Compute them in `compute_rolling_range()`, **sized in bars, `min_periods` = full window** | `indicators/compute_engine.py` |
| 3 | Backfill history | one-shot script |
| 4 | `breakout_depth` / `breakdown_depth` derived label | compute or fetcher |
| 5 | Two direct-query fetchers + preset rows + `fieldAvailability` column sets | frontend + migration |
| 6 | Warm-up gate (`nbars >= window`) asserted in the contract audit | `lib/scan_contract.py` |

Existing `breakout_level` (20-bar) stays as-is so the live preset is untouched;
the new columns are additive. Direct-query family, not the matview — it
inherits every display column and avoids the column-contract bug class (see
`scanner-integrity-poa.md`).

`min_periods=1` on the current formula means a 3-bar stock gets a trivially
cleared "20-day high". Harmless on deep daily history, **material for the 66D
and 52W tiers** — gate on bar count, per the migration-169 lesson.

---

## 6. Naming (SEBI — D39)

Breakout/breakdown describe structure and are fine; the framing must stay
observational. Depth labels are neutral by construction (`5D`, `22D`, `66D`,
`52W`). Descriptions state the condition — "closing above the highest close of
the prior 22 sessions" — never an implication.

---

## 7. Open decisions (owner)

1. **One screener with a depth column, or three exclusive-tier screeners?** (§4)
2. **Which depths ship** — 5 / 22 / 66 / 52W as above, or add 7D and 132D?
3. **Close vs intraday high.** Current formula uses the prior N-bar high **of
   close**. An intraday-high definition fires earlier and more often; changing
   it would alter the **live** daily preset, so decide deliberately.
4. **Breakdown ranking** — daily breakdowns run 480–1,264/day. Rank by weakest
   `score_5d`, by depth below the level, or by delivery-backed conviction?
5. **Liquidity floor** — still removed platform-wide (migration 181). These
   inherit that; revisit as one decision, not per-preset.

---

## 8. Verification before merge

1. Warm-up gate honoured — zero rows whose level derives from fewer bars than
   its window.
2. Nesting assertion — every 22D-tier row is also above its 5D level (proves
   the tier logic is exclusive and correctly ordered).
3. De-duplicated re-test of the 52W tier (one event per run + liquidity gate)
   before any depth-tier performance claim reaches the UI.
4. `python scripts/audit_scanner_contract.py` — all presets × 5 dimensions green.
5. `python scripts/run_integrity_checks.py --dry-run` — zero new findings.
