# Signal discovery — measured results + build plan (2026-09-23)

Every number here was measured on the live DB this session. Where a claim could
not be measured it says so. Nothing in this document is built.

---

## 0. The one-paragraph summary

Four candidate signals were measured. **PEAD is the strongest and the cheapest**
— a +5% price reaction to a results announcement is followed by ~1.5 points of
excess return over 20 sessions, and it needs NO document extraction. **Repeated
volume spurts** are a real but modest right-tail tilt (~1.32x). **`rs_percentile`
is a negative filter, not a ranking** — 20 years of data say so. And the shipped
**`volume_drive` scanner is half broken**: its SVD arm is a measurable fade.

---

## 1. PEAD — MEASURED, REAL, AND CHEAPER THAN PLANNED

### The finding

Bucketing 2,245 result announcements (Jul-Aug 2026) by their Day 0 price
reaction, then measuring the median drift over the NEXT 20 sessions. Universe
median over the same window was **-0.59%**, so that is the baseline:

| Day 0 reaction | n | 20-day drift | vs market |
|---|---|---|---|
| < -5% | 292 | -1.52% | -0.93 |
| -5 to -2% | 554 | -1.87% | **-1.28** |
| -2 to +2% | 833 | -1.61% | -1.02 |
| +2 to +5% | 288 | +0.16% | +0.75 |
| **> +5%** | **278** | **+0.95%** | **+1.54** |

A **2.8-point spread**. The threshold is sharp at **+5%**: below it, drift is
negative and roughly flat across three bands; above it, positive.

### Three things this changes

1. **Sprint 3 (Qwen document extraction) is NOT a prerequisite.** The signal is
   the *price reaction*, not the content of the filing. Everything needed is
   already stored: the Day 0 date (from the board-meeting join, migration 214)
   and the reaction (prices). The POA assumed extraction had to come first. It
   does not.
2. **MagicRS adds nothing to it.** react>=5% + RS rising = +0.80%; react>=5% +
   RS falling = +0.59% (n=42). Within noise. The reaction does all the work.
   Do not bolt RS onto this scanner to make it look richer.
3. **The scanner is SEASONAL and will be empty most of the year.** Measured
   weekly counts of reaction>=5% events:

   | week | results | react>=5% |
   |---|---|---|
   | 2026-07-13 | 86 | 12 |
   | 2026-07-27 | 339 | 46 |
   | **2026-08-10** | **979** | **104** |
   | 2026-08-17 | 199 | 18 |
   | 2026-09-14 | 7 | **1** |
   | 2026-09-21 | 5 | **0** |

   On 2026-09-23 there is exactly **ONE** live candidate in the whole market.
   A scanner that is full in Aug and empty in Sep is correct, not broken — but
   it MUST say which it is. An empty PEAD list during a results gap has to read
   "no results filed in the last 20 sessions", never "no opportunities".
   This is the fpbEvents starvation lesson in a new place.

### What PEAD needs to ship

Nothing new in the database. `kd_result_returns(from, to, horizon)` already
computes reaction and drift (migration 215), and 216 de-duplicates to one row
per meeting.

- A preset reading `kd_result_returns` for Day 0 within the last N sessions
  and `reaction_pct >= 5`.
- An explicit **coverage line** driven by result-event count in the window,
  not by row count of the scanner.
- `suspect_corporate_action` MUST be filtered (only 8 of 2,310 today, but
  `km_corporate_actions` is still EMPTY so the flag is the only protection).

### PEAD caveats

- **Only 2.5 months of history.** Day 0 spans 2026-07-10 to 2026-09-22. One
  results season. The effect could be a Q1-FY27 artifact.
- Weeks of 2026-08-24, 08-31 and 09-07 have **zero** result rows. Plausible
  (post-deadline lull) but unverified — worth confirming it is a real gap in
  filings and not an ingest gap.
- 29 result events have a NULL equity_id and are invisible to any join.
- One horizon (20 sessions) tested. Persistence beyond that is unmeasured.

---

## 2. VOLUME SPURT COUNT — calibrated

### The finding

A single volume spurt is worthless. Repeated spurts are the signal.

Measured on two independent entry dates, forward ~1 month, "hit" = gained 10%+:

| Rule | List size | Date 1 lift | Date 2 lift |
|---|---|---|---|
| 5x on >=1 day | ~1,400 | **1.02** | **1.08** |
| 10x on >=1 day | ~830 | 1.09 | 1.16 |
| 3x on >=4 days | ~830 | 1.24 | 1.17 |
| 5x on >=3 days | ~585 | 1.36 | **1.12** |
| 3x on >=6 days | ~520 | 1.36 | 1.27 |
| **3x on >=8 days (22d window)** | ~365 | **1.32** | **1.32** |
| 3x >=6d + RS rising | ~310 | 1.46 | 1.37 |

**How often beats how big.** 10x once = 1.09. 2x six times = 1.27.

### Window calibration (one shared baseline, only window length varied)

| matched list size | 10-day | 22-day | 44-day |
|---|---|---|---|
| ~550 (date 1) | 1.32 | **1.37** | 1.24 |
| ~550 (date 2) | 1.20 | **1.21** | 1.17 |
| ~400 (date 1) | 1.30 | **1.32** | 1.25 |
| ~400 (date 2) | 1.27 | **1.32** | 1.22 |

**22 days wins all four comparisons.** 44 days is flat at every threshold
(16.3/16.5/16.6 on date 1) — spurts from two months ago carry no information
and only dilute recent ones. 10 days is too short to distinguish accumulation
from a couple of busy sessions.

**>=8 is preferred over >=6** on stability: 1.32/1.32 versus 1.37/1.21. Same
average lift, half the regime variance, shorter list.

### Direction: MagicRS is required

Volume is direction-blind — heavy volume into a decline is distribution.
Measured, 4+ spurts:

| | RS rising | RS falling |
|---|---|---|
| Date 1 | 17.4% | 14.6% |
| Date 2 | 20.8% | 16.1% |

The two ingredients stack: volume adds ~5 points, RS direction ~3-4 on top.

### What it needs

ONE new column. Everything else (`magic_rs`, `magic_rs_chg_22d`,
`magic_rs_align`) is live back to at least 2024-01-02.

```
vol_spurt_count_22d = days in last 22 bars where
                      volume >= 3 * median(volume, prior 126 bars)

Scanner: vol_spurt_count_22d >= 8 AND magic_rs_chg_22d > 0
```

Four rules the implementation must keep, each already burned this project:
- **Prior bars only** — never include today in its own baseline. The live
  `rvol` does (`(i-49)..i`), which is why it read 19.2 on OPTIEMUS when the
  true spurt was ~52x.
- **Median, not mean.** OPTIEMUS 2026-09-22: 29x on the mean, 52x on the
  median. Past spurt days inflate a mean baseline.
- **Warm-up sized in BARS, not calendar days** (the migration-169 lesson).
- **NULL when history is short** — never 0, never 1.

### Volume spurt caveats

- Two entry dates, both flat-to-down markets. One horizon.
- The **3x multiple** and the **126-bar baseline length** are still unmeasured
  picks. Only the window and the count are calibrated.
- It is a right-tail tilt: ~1-in-5 instead of ~1-in-7, with a FLAT average
  return. Presented as "these will run" it will disappoint.

---

## 3. `volume_drive` IS HALF BROKEN — fix before adding anything

`fetchVolumeDrive` is `dot_svd OR dot_sbd` on the latest bar. No lookback.

| Cohort | n | Move already gone on entry day | Median fwd 5d | vs universe (-0.81%) |
|---|---|---|---|---|
| **SVD** | 57 | **89% already >=10%** | **-2.61%** | **-1.80 pts** |
| SBD | 309 | 66% already >=5% | -0.13% | +0.68 pts |

**The SVD arm is a measurable fade**, not merely late. Those names are up
~15% on the day they appear and give back more than the market over the next
week; only 37% are positive. It is structural: SVD's definition REQUIRES
`pct_chng > 9`, so it can only ever fire after the move.

⚠ This also means **"SVD during compression" is impossible by construction** —
if the owner's Pine SVD fires inside a box, it is a DIFFERENT indicator and
needs its own definition and calibration before anything is built on it.

The compression thesis was tested directly and did not hold:

| SBD band | n | median fwd 5d |
|---|---|---|
| quiet (<3%) — the compression case | 27 | **-2.71%** |
| mid (3-7%) | 166 | **+0.87%** |
| loud (>=7%) | 116 | -0.71% |

The quiet cohort is the worst, not the best (n=27 — suggestive, not settled).

**Minimum fix: split the preset.** SBD and SVD have opposite forward signs and
are currently merged into one list, so the scanner recommends its own worst
cohort. Reframe SBD honestly: **6.7x lift on a >=10% next-day move** (5.4% vs
0.8% base) with a MEDIAN outcome of ~zero. Both true. "1 in 19 pops" is
honest; "these are moving" is not.

---

## 4. `rs_percentile` — the 20-year answer

61 non-overlapping 22-session windows, **153,556 stock-windows**, 2006-02-22 to
2026-08-24. Bucket median minus same-date universe median:

| Bucket | RS %ile | avg excess | windows beating universe |
|---|---|---|---|
| 1 | <50 | **-0.16** | 19/61 (31%) |
| 2 | 50-70 | **+0.64** | 40/61 (66%) |
| 3 | 70-80 | +0.60 | 40/61 |
| 4 | 80-90 | +0.05 | 36/61 |
| 5 | 90-95 | +0.54 | 34/61 |
| 6 | 95-100 | +0.36 | 36/61 |

**NOT monotone.** Ranking is 2 > 3 > 5 > 6 > 4 > 1. Bucket 2 beats the top
decile. Top-minus-bottom spread is +0.52 pts.

**Conclusion: `rs_percentile` is a negative FILTER, not a ranking.** The only
clean break in twenty years is below-50 versus above-50. Sorting a scanner by
`rs_percentile` and taking the top decile is **not supported**. Excluding
`rs_percentile < 50` is.

Regime dependence dwarfs the effect — top-bucket excess by period:

| 2006-12 | 2012-16 | 2016-17 | 2018-19 | 2019-21 | 2021-22 | 2023 | 2024-25 | 2026 |
|---|---|---|---|---|---|---|---|---|
| -0.77 | +1.22 | +2.22 | -0.32 | +0.26 | +1.55 | **+4.38** | **-2.31** | -0.01 |

A 6.7-point swing between adjacent periods. Any "RS leadership" scanner looks
brilliant for a year and broken the next.

⚠ Method note: `scripts/backtest_rs_percentile.py` was NOT run — port 5432 is
unreachable from the cloud container. The methodology was reproduced in SQL
through the read-only MCP. Spearman rho and the phase-3 scanner-overlap test
still require running the script on the VPS. Survivorship (0.7-2.6% of stocks
per window have no exit bar) concentrates in low-RS names and therefore biases
AGAINST the result above, not for it. `percentile_cont` is blocked by the MCP
validator, so medians were computed via `row_number`.

---

## 5. OPTIEMUS — the specimen, and why it is NOT the template

Anatomy of the 2026-09-22 +20% circuit (id 875):

1. **08-24**: 18x value thrust (Rs 126 Cr vs Rs 6.9 Cr norm), SBD, FRESH_LONGS.
2. **08-25 to 09-09**: three weeks of volume death (rvol 0.20-0.56), price -9%,
   but `rs_percentile` never left 79.6-91.6 — it fell LESS than the market.
3. **09-16/17**: delivery 57.2%/49.4%, bm_ratio 2.05/1.51, FRESH_LONGS,
   magic_rs 19.7 -> 32.2.
4. **09-18**: enters S2 (verified genuine, not the corruption). Two quiet bars.
5. **09-22**: +20.00% circuit, 42.6x volume, bm_ratio 11.32, closed at 99.4%
   of its 52-week high, **and three filings at 12:26 / 12:32 / 12:38 IST**
   (all `UNCLASSIFIED`: "General Updates", "Press Release", "Others").

⚠ **On 09-21 OPTIEMUS had NONE of the winning population features**: dot_sbd
false, dot_svd false, flow LOW_VOLUME, rvol 0.72, delivery 39.6%. Its last SBD
was 19 sessions earlier. The population signature for a big mover is an
**active** bar the day before (SBD 6.7x lift); OPTIEMUS's was quiet, thin and
low-delivery — the profile that measures 0.58x and 0.98x.

**Do not calibrate a screen to this stock.** It was caught intraday (MagicRS +
SVD turned at 09:45 on the 15-minute chart) and by news. `km_equity_15m` is
schema-only, so the EOD layer's first look at that day is the 15:30 close,
5.75 hours late.

Two population results worth keeping, both of which overturn intuitive reads:
- **delivery_pct >= 50% has 0.98x lift** — pure noise, measured twice.
- **rvol < 0.9 (quiet) has 0.58x lift** — big movers are preceded by ACTIVE
  days, not compressed ones.

---

## 6. Data defects found in passing

1. **`2026-08-25`: 0 SBD / 0 SVD / 0 SYD across all 3,006 rows.** The `dots`
   dimension did not run and nothing reported it. Every other session in the
   window has ~55/8/5.
2. **`km_corporate_actions` is still EMPTY** (0 rows). Disqualifying for
   historical validation of anything using unadjusted closes (D44).
3. **`bm_ratio` is NULL before 2026-09-04** — the Big Money dimension has ~3
   weeks of history and cannot be backtested at all.
4. Three consecutive weeks with zero result events (Aug 24 / 31 / Sep 7) —
   probably a real post-deadline lull, unverified.

---

## 7. Build order

| # | Item | Evidence | Cost | Status |
|---|---|---|---|---|
| 1 | **Split `volume_drive`** (SVD out of the buy list) | measured -1.80 pts | a few lines | ready |
| 2 | **PEAD scanner** | +1.54 pts excess, n=278 | 0 new columns | ready |
| 3 | **Volume spurt scanner** | 1.32x, calibrated both dates | 1 new column | ready |
| 4 | Fix `2026-08-25` dots gap | — | one backfill | ready |
| 5 | Run `backtest_rs_percentile.py` on VPS | closes rho + overlap | — | blocked here |
| — | RS-ranking scanner | **measured weak** | — | **do not build** |
| — | Sprint 3 Qwen extraction as a PEAD prerequisite | **not required** | — | **de-scoped** |

### What is still owner-decision, not measurement

- Whether PEAD is its own preset or a column on existing ones. The seasonality
  measurement argues for **its own preset** — a column that is NULL for 40
  weeks a year is worse than a list that honestly says "no results this month".
- The **Eagles / Spark** vocabulary (settled in principle, never rendered).
- Whether `km_equity_15m` gets populated. Parked by the owner. Everything in
  section 5 says it is the only route to an OPTIEMUS-class catch.
