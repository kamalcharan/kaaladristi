# Astro Signal Validation — Findings

**Date:** 2026-07-10 · **Scope:** empirical test of whether astro state predicts NIFTY / equity market behaviour, on 30 years of data (`kaala_dristi_db`, live queries).
**Verdict:** No astro configuration tested produced a **repeating** market edge. The data corrections made along the way are real and kept; the predictive claims are not.
**Status:** Astro validation is **on hold** after this pass. Findings below are the record.

---

## 1. Method

Data science discipline applied throughout: a pattern only counts if it **repeats** — across instances (enough occurrences, consistent outcome) **and** across time (holds decade-by-decade, not once). Every candidate was run against 30 years and split by decade. Guardrail: with many astro states to test, some *will* look significant by chance (multiple comparisons), so the per-decade repetition gate was mandatory, not optional.

Response variables tested: daily return, daily range (volatility), gap magnitude, up-day frequency, tail/crash clustering, and forward 5-day continuation conditioned on a technical setup.

---

## 2. What was tested, and what came back

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| 1 | Combustion **stage ladder** (Prākṛta→Ghora = graded volatility) | **False** | Volatility does not climb by stage; middle stages *calmer* than baseline. Only Ghora elevated in aggregate (vol 1.577 vs 1.332). |
| 2 | It's specifically **retro-ghora** (inferior conjunction) | Elevated in **aggregate only** | retro-ghora vol 2.075, range 1.686 (+17%), direction-neutral (up-day 51.6 ≈ 52.4 baseline). Direct-ghora calm (1.291); retrograde-alone calm (1.277). The *interaction*, not either factor. |
| 3 | **Per-decade robustness** of retro-ghora | **NULL — killed it** | 2000s sensitivity 1.80 (on **15 days**, crash era); 2010s **1.01**; 2020s **0.93**. The whole effect was one small-sample decade. Not repeating. |
| 4 | **Sector selectivity** (Mercury → IT / broking) | **Not supported** | Broad/midcap indices most sensitive (NIFTY 50 1.20, MIDCAP 50 1.19); the "Mercury sectors" middling (IT 1.09, BANK 1.08, FINSERV 1.05). Systemic-not-sectoral, and not robust (see #3). |
| 5 | **Retrograde family**, all 5 planets, per-decade | **NULL for direction** | Every planet's retro-vs-base return flips sign across decades (Saturn: +/−/+ on 947-day samples; Mars −0.13/+0.12/−; etc.). Only marginal, weak volatility tendencies: Venus retro >1.0 all decades, Jupiter <1.0 all decades — too small to use. |
| 6 | Astro times **tail events** (crashes cluster under a planet) | **NULL** | Crash days (<−3%, n=79) were **30.4%** Saturn-retro vs **37.3%** baseline — if anything *under*-represented. No planet over-clusters in the tails. |
| 7 | Astro as **conditional trigger** on a technical setup (Mercury accelerating × prior-day-high → continue vs turn) | **NULL** | Accelerating 55.7% continuation vs decelerating 54.6% — a 1.1-pt gap inside the ±1.4-pt noise band. Astro adds nothing to the setup. |
| 8 | The **technical setup itself** has an edge (20-day-high breakout × RSI, CA-cleaned NSE) | **NULL** | Win rate ~49% (below coin-flip) across RSI bands; median forward 5-day return slightly negative; RSI doesn't differentiate (strong 49.6 vs overbought 48.8). |

**Throughline:** every time the *astro* component was isolated, it was flat. The only structure that recurred was **technical** (a mild ~55% next-day follow-through after a new high) — and even that vanished under a stricter breakout definition. Simple single-factor patterns, astro or technical, are efficient-away in this market.

---

## 3. Two infrastructure gaps this surfaced (the real blockers)

Every validation eventually hit one of these — they must be fixed before *any* signal (astro, technical, or their fusion) can earn a defensible track record:

1. **Corporate-action contamination.** Raw `km_equity_eod.close` is not split/bonus-adjusted. A first-pass forward-return study produced impossible averages (+22% to +34% over 5 days) — splits/bonuses/bad prints. Any return-based backtest over the full universe is poisoned until prices are CA-adjusted (adjustment data exists in `km_corporate_actions.adj_factor`) or setups are guarded (NSE-only + price floor + per-move cap made the numbers sane).
2. **Scanner flags not backfilled.** `is_vani_breakout` / `is_vani_surge` / `is_vani_s2` etc. exist only for a short recent window (~300 rows), computed nightly. There is no 30-year membership history, so the multi-factor scanner setups — *the product's actual signal* — cannot be graded historically.

**These are the same gap the launch audit flagged (W4, "zero effectiveness measurement"), now proven from the inside.** The unlock is one job: **backfill the composite scanner flags across 30 years on CA-adjusted prices.** Then the multi-factor confluence (which is where any real edge would live, not single factors) becomes testable, and astro can be fairly tested as a *refinement on a proven setup* rather than a signal hunting in a vacuum.

---

## 4. Product positioning (honest, SEBI-safe)

- **Astro is a context/informational layer, not a predictive signal.** Show the almanac — Mercury combust / retrograde / sign-change with exact times and stages — as factual educational context ("Mercury is at inferior conjunction, a period some traders watch"). Attach **no** directional or probability claim; there is no validated edge to cite.
- **The scanners are the signal asset** — multi-factor confluence is the only place an edge is likely — **but they cannot claim a hit rate until the backfill + CA-adjustment land.** Until then, present them as screens ("these stocks meet these conditions"), not as forecasts.
- Do not ship the illustrative combustion multipliers (Ghora ×0.50 etc.) or any astro weight — they are unvalidated and, where tested, false.

---

## 5. What was actually fixed and kept (the productive output)

The astro *data* is now clean and correct, even though it carries no signal claim:

- **Mercury windows deduped & rebuilt** — combust 335 → 259 windows (astronomically correct: ~6.3 Sun-conjunctions/yr × 41 yr). Root cause found: append-only `ON CONFLICT (rule_id, start_date) DO NOTHING` across an ephemeris regeneration created shifted-date duplicates (73 pairs on `TR-MER-CMB-E-BEA` alone). Fixed with a **reconciling generator** (delete-then-rebuild per rule, one transaction, safe to re-run).
- **DN weekday off-by-one fixed** — `EXTRACT(DOW)` is Sunday=0 but the code passed Monday=0, so every nakshatra-vara window sat one day early (DN-MON rows on Sundays) — the likely cause of their degenerate 0%/100% confidence.
- **Migration 146** — event fields on `km_rule_transits`: `start_ts`/`end_ts` (exact times via Swiss Ephemeris bisection), `sign`, `motion`, `direction` (east/west), `combustion_type` (5 bands), `sun_sep_min`. Typed/queryable for correlation.
- **Combust arc set to 15°** (matches the owner almanac; 14° gave a ~1-day-narrow window) — reverse-engineered from the sheet's own boundary timestamps (15.20° / 14.82°).
- **Sign convention = Lahiri sidereal** (the sheet's labels were +1 sign; Lahiri is the astronomical/government standard and what the DB uses).
- **DB space** — dropped 7 never-scanned indexes on `km_equity_eod` (28 GB → 22.5 GB); reindexed `km_rule_patterns`. Orphan/log tables were clean (no junk).
- **Catalog scoped to Mercury** for a clean test slice (`catalog_visible=false` on all non-Mercury; group-overlay pills allowlisted to Mercury).

---

## 6. Open items (for when astro resumes)

1. **Backfill scanner flags on CA-adjusted prices** — the prerequisite for all effectiveness measurement (astro or technical). Highest-leverage.
2. **Confluence hypothesis (parked)** — astro state × *another* strong trigger (Saturn / eclipse / Mars), tested against the backfilled setups. Single-factor astro is null; interaction is untested.
3. **Multi-factor scanner validation** — once flags are backfilled, grade the composite setups; only then test whether any astro state lifts a *proven* setup.
4. Slower planets (Saturn/Jupiter *transits*, not just retrograde) over longer horizons — untested here.

Until then: astro stays **informational**, the almanac data is trustworthy, and no predictive claim ships.
