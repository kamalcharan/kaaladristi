# Trading-System Layers, the Swing Filter, and the Pullback Checklist

**Status: NOTHING IS BUILT. This is a review document.** Owner (Charan) raised
three related things in one session (2026-09-22/23); this records the capability
audit against the live schema so the build decision can be made from facts
rather than from memory. No migration, no column, no scanner has been created
for any of it.

**Where the claims come from.** Everything marked ✅/❌ below was checked against
the repo (migration files, `personaConfig.ts`, `scanEngine.ts`, the migration-205
matview source). **The funnel is now MEASURED** — see §0, added 2026-09-23 once
the MCP recovered. It settles the central design question, and it settles it
against the obvious reading of the spec.

---

## 0. The measured funnel (2026-09-23, bar = 2026-09-22)

NSE, active, ETFs excluded. **Universe 3,044.**

| Stage | Count |
|---|---|
| Within 10% of 52-week high (`pct_below_52w_high <= 10`) | 547 |
| +30% in 3 months (`ret_66d >= 30`) | 365 |
| **Both** | **218** |
| + Stage 2 (`stage = 'S2_CANDIDATE'`) | **161** |
| + above `ema_20` (trend proxy for the DEMA leg) | **159** |

⚠ **Stage 2 is stored as `S2_CANDIDATE`.** There is no plain `'S2'` value —
the column holds `S1` / `S2_CANDIDATE` / `S3` / `S4` / `UNKNOWN`. A filter
written against `'STAGE_2'` or `'S2'` returns zero and looks like "no stock
qualifies" rather than a typo. It cost a query here; it would cost a scanner
silently.

### 0.1 ⚠ All four filters AND-ed returns ZERO — measured, not predicted

§2.2 argued filters 1–2 (movement) and filter 4 (stillness) are near-disjoint.
Measured directly on the 159 watchlist names — computing `atr15/atr60` and
`vol5/vol22` from raw bars, NOT via Flower Pot membership (which would have been
circular, since that arm holds only 33 rows today):

| Of the 159 | Count |
|---|---|
| ATR compressed (`atr15/atr60 < 0.8`) | **1** |
| Volume dead (`vol5/vol22 < 0.6`) | 28 |
| **Both (= "tight range candles")** | **0** |
| Best ATR ratio anywhere in the watchlist | 0.80 — exactly at the gate |

A stock that has run +30% into its 52-week high is essentially never in
Flower-Pot-grade compression on the same bar. **One name in 159 clears even the
ATR leg alone.**

**This settles the design.** Filter 4 cannot be a watchlist filter — as an
`AND` it returns an empty list on a perfectly ordinary session, which would read
to a user as a broken screen. It is the **trigger**, evaluated over time on the
watchlist, exactly as the owner's own spec says ("entry still comes from a tight
trigger bar"). The spec was right; the naive implementation of it is not.

### 0.2 What the count implies for the surface

**159 is too many for a per-stock checklist to be the entry point.** So:

- **Steps 1–3 become a scanner** (a preset, or a saved filter over existing
  ones — still open, §5 Q7). 159 on this session; it will breathe with the
  market.
- **The 8-step checklist is a PANEL** you open on one candidate from that list,
  not a universe-wide ranked run. That answers §5 Q5 for the common case,
  though a ranked run remains possible later once swing pivots exist.

---

## 1. The five-layer frame vs. what the ICP actually stores

Owner shared a five-layer trading framework. Mapping it to the migration-204
persona fields (`src/constants/personaConfig.ts`):

| Layer | ICP field today | Verdict |
|---|---|---|
| **1. Game & Timeframe** (intraday/swing/positional/investing) | `hold_horizon` = days \| weeks \| months | **Covered.** It is already the first onboarding question, which is exactly what the frame says it should be. Intraday is the weak leg — `km_equity_15m` is schema-only. |
| **2. Setup** (VCP, Momentum Burst, Pullback, Episodic Pivot, Flat Base) | `acts_on` = confirmed \| early \| extreme | **Wrong axis.** `acts_on` measures *aggressiveness*, not *pattern*. The ICP never asks which setup the user trades. |
| **3. Process** (selection, entry, stop, size, risk, exit) | `concede_level` only | **The gap.** See §1.2. |
| **4. Market Awareness** (uptrend / pullback / choppy / risk-off) | nothing | Not in the ICP, though the product owns the best data in the app for it. |
| **5. Mindset** (probabilities, batches) | nothing | `km_journey_base_rates` is the raw material, unframed. |

### 1.1 You already own four of the five named setups

A naming problem, not a capability problem:

| Their vocabulary | Existing feature |
|---|---|
| VCP (volatility contraction) | **Flower Pot coil** — `atr15/atr60 < 0.8` *is* volatility contraction |
| Momentum Burst | `breakout_surge` / `volume_drive` |
| Pullback | `gl_retest` |
| Episodic Pivot | **the filing / PEAD layer** (migrations 212–217) — a gap on news is an episodic pivot |
| Flat Base | Stage 1–2 base + compression |

A trader who thinks in this vocabulary opens DristiQ, sees "Flower Pot Burst"
and "Golden Line Retest", and cannot find their setup. This is also where the
pending **Eagles / Spark** naming decision should be taken — there are now two
candidate vocabularies and this is the one users already speak.

### 1.2 `concede_level` is a stop-loss question being spent on breadth

The sharpest single finding. Onboarding asks *where would you concede you were
wrong* — `tight` (10-day low) / `swing_low` (22-day) / `structure` (Golden
Line). That is **Layer 3's Stop Loss, asked in plain language.**

Its only current job is selecting which breadth leg the opening brief
highlights (`constants/breadthLegs.ts`, `_CONCEDE_LEG` in `vani_assemblers.py`).
CLAUDE.md already flags the double duty: *"Two different jobs for one column."*

The same stored answer could drive a per-stock stop reference — *"your line on
this name is ₹412, 4.1% below"* — which is arithmetic on the user's own stated
rule. **Do not remove either job**; the point is that one of them is unused.

### 1.3 "Pick one pattern — not ten"

`PERSONA_SCANNERS` hands each persona **four** starter scanners out of 24. The
frame's core discipline is the opposite. Proposal: add **one** onboarding
question — *which setup do you trade?* — over the five named patterns, and let
it pick **one** default scanner (the rest stay browsable).

### 1.4 Layer 4 is the strongest asset and the least connected

The product tells the user the market phase (breadth score, ROC state,
Greed/Fear). It does not tell them **whether their setup works in that phase**,
which is the whole point of the layer.

The mechanism half-exists: the autorun brief already maps `acts_on` → which
breadth leg matters, and already says things like *breakouts depend on the short
leg, so a thin 20 row means those setups fire against the tape*. Generalising
that from `acts_on` to an explicit setup yields the most valuable sentence the
product could say, and it stays observational:

> *"Pullbacks are your setup. Breadth is 39.3 and falling four sessions — this
> is the phase pullbacks fail in."*

It is also the only thing in the frame that tells a user to **do nothing**,
which is what the red RISK-OFF chip is for.

### 1.5 Layer 5 already exists, unlabelled

"Think in probabilities / in batches" is `km_journey_base_rates` — *348 of 595
wakes confirmed*, always with its denominator, explicitly fenced against being
read as a per-stock forecast. The mechanism was built before there was a frame
for it.

---

## 2. The Swing Filter (a smaller watchlist)

Owner's four criteria, as stated:

1. Within 10% of 52-week high or lifetime high
2. +30% in 3 months
3. Rising 11/21 DEMA
4. Tight range candles

…then look for Pullback / Breakout / Anticipation, entry from a tight trigger
bar with a 3–5% stop.

### 2.1 Audit

| Filter | Status | Backing |
|---|---|---|
| Within 10% of 52WH / lifetime high | ✅ | `w52_high`, `lifetime_high` (migration 094) — and **`pct_below_52w_high` is already stored** (migration 112), which is the filter directly |
| +30% in 3 months | ✅ | `ret_66d` on `km_equity_eod` (migration 112, filled nightly by step 6g). ⚠️ **not** `d30_pct_chng`, which is 30 *calendar* days |
| Rising 11/21 DEMA | ❌ | No DEMA anywhere in the repo (grep-verified; the apparent hits are "demand"/"on demand"). Nearest: `ema_20`, `sma_21/50/55/150` |
| Tight range candles | ✅ | Flower Pot: `atr15/atr60 < 0.8` **and** `vol5/vol22 < 0.6`, plus `fpb_tight_today` on the matview |

The three setups are already shipped scanners: **breakout** →
`breakout_surge`/`gl_breakout`, **pullback** → `gl_retest`, **anticipation** →
the Flower Pot coil phase (a coil *is* an anticipation setup).

### 2.2 The structural tension — and the owner's own spec resolves it

Filters 1 and 2 select for **movement** (near highs, +30% in three months).
Filter 4 selects for **stillness** (ATR at 0.8×, volume dead at 0.6×). A stock
that just ran 30% into its highs is usually *not* in volume-death compression on
the same bar, so `AND`-ing all four may return near-nothing on most sessions —
and when it does fire, it will skew toward names whose +30% is stale.

But **tight range appears twice in the owner's own spec** — as filter 4 *and* as
the entry trigger. Resolve it that way:

- **Filters 1–3 = the watchlist.** A persistent *state*: strong stock, near
  highs, trending.
- **Filter 4 = the trigger**, evaluated on that watchlist per setup.

This also avoids a usability failure: an all-four `AND` list would change
membership daily as compression comes and goes, so the user could never build
familiarity with the names on it. A watchlist that churns every session is not a
watchlist.

### 2.3 Before building the DEMA column

Settle whether **DEMA** is the requirement or whether *"short-term trend is
rising"* is. If the latter, `ema_20` slope plus the existing `magic_rs_align`
(0–3, migration 219) may cover it with zero new storage. If DEMA's lower lag is
specifically wanted, that is a real reason and the column earns its place.

If it is built: **warm-up sized in bars, not calendar days** (the migration-169
lesson) — DEMA-21 needs ~60 bars to stabilise, and the weekly/monthly tables
need their own floors.

---

## 3. The High-Probability Pullback Checklist

Owner's eight steps, audited:

| # | Item | Status |
|---|---|---|
| **1** | Near 10% 52WH | ✅ `pct_below_52w_high` |
| | 3/6-month high | ⚠️ not stored; a 66/126-bar rolling max, trivial |
| | +30% in 3 months | ✅ `ret_66d` |
| **2** | Stage 2 | ✅ `stage` + `stage_since` (migrations 097 / 191) |
| | Key EMAs rising | ⚠️ `ema_20`/`sma_50`/`sma_150` exist; slope derivable |
| | **Prior advance of 30%+** | ❌ needs swing pivots — §3.1 |
| **3** | **Pullback is 30–40% of prior advance** | ❌ needs swing pivots — §3.1 |
| **4** | Between 11 and 51 DEMA, prefer 21 | ❌ DEMA absent |
| **5** | Tight bars | ✅ `atr15/atr60` |
| | "Linear" bars | ⚠️ not in product; measurable as R² of a fit over the advance |
| | Volume dries into the pullback low | ✅ `vol5/vol22` |
| **6** | Demand Tail, IB, NR4/NR7 | ⚠️ pure OHLC — **derive on read, no storage** |
| **7** | Stop below trigger low, max 3–5% | ✅ arithmetic |
| **8** | Size from entry + stop distance | ✅ arithmetic |
| | Max 1% portfolio risk | ❌ **account size is stored nowhere** — §3.3 |

### 3.1 ⚠ The real dependency is SWING PIVOT DETECTION, not DEMA

Steps 2 and 3 both need it, and it does not exist.

**`ret_66d` is not a substitute for "prior advance".** A stock can be +30% over
66 days having advanced 80% and given back 28%. Those are different numbers, and
step 3 needs the second:

```
retracement = (swing_high - close) / (swing_high - swing_low)
```

Without pivots this is not computable at all — and step 3 is the heart of the
checklist, the thing separating a healthy pullback from a failing stock.

So the build order is the inverse of how it looks: **DEMA is three columns of
recursion; swing detection is the actual project.**

⚠ **It carries a repaint trap.** A swing high is not confirmed until N bars pass
without exceeding it, so the most recent pivot is always provisional. Get this
wrong and the checklist repaints — a stock reads "35% retracement, passes" today
and "52%, fails" next week because the pivot moved. This is the same
prior-only discipline that `stage_since` and Big Money already enforce
(`backfill_big_money.py`: *"prior-only also means a past bar never repaints from
data that arrived after it"*). Any pivot implementation must state, per bar,
whether the pivot is **confirmed or provisional**, and the UI must not present a
provisional one as settled.

Swing pivots are reusable well beyond this checklist — Golden Line, the journey
arc and Flower Pot would all benefit.

### 3.2 Steps 5 and 6 need no storage

Demand Tail, Inside Bar and NR4/NR7 are OHLC predicates on the bar and its
neighbours — exactly the shape of `services/priceActionEvents.ts`, which derives
six scanners on read from columns already on the row. "Linear" is an R² over
closes already fetched.

⚠ Whatever derives them **must be given warm-up bars**, or it reports "no
trigger" on a window too short to have looked — the `fpbEvents` starvation
lesson, and `fetchEquityWarmupBars()` is the existing mechanism.

### 3.3 Step 8 is a product decision, not an engineering one

1%-of-portfolio sizing needs the user's **capital**, which the product has never
asked for. Two options:

- server-side on `km_profiles` — most useful, but it is financial PII on the VPS
- **browser-local only** — the calculator works, nothing leaves the device, and
  it never enters a VaNi prompt or `km_vani_cache`

Recommendation: **local-only.** It costs nothing analytically and preserves the
privacy posture already enforced structurally (VaNi analytics are categorical
only — never positions, prices or names).

### 3.4 The compliance line for Layer 3

"The real work" is the layer the SEBI posture makes uncomfortable. The
defensible split is **arithmetic vs. advice**:

- ✅ *You said you concede at the 22-day low. That is ₹412, 4.1% away. At 1%
  account risk that is N shares.* — the user supplied the rule; the product did
  the maths.
- ❌ *Buy here, stop ₹412, target ₹480.*

Position sizing is a calculator, not a recommendation. This is the same posture
as the rest of the product and is what allows Layer 3 to be entered at all.

### 3.5 Form factor — a checklist is a surface the product does not have

Scanners produce **lists**; cards produce **readings**. A checklist is **eight
rows, for one stock**. It needs **three** states, not two:

```
✅ Stage 2   ✅ +34% in 3 months   ✅ volume dried up
❌ retracement 51% — deeper than the 30–40% band
⊘  location — DEMA not computed
```

That third state is the house discipline applied to a new surface: a row that
cannot be measured must **say so**, never quietly pass and never quietly fail.
Same rule as the Flower Pot coverage line and the bulk-deal `windowUncovered`.

---

## 4. Suggested build order

1. ~~Measure the funnel~~ **DONE 2026-09-23 — see §0.** 159 names clear steps
   1–3; all four AND-ed returns **0**. Step 1 becomes a scanner, the checklist
   becomes a per-stock panel, and filter 4 moves to the trigger.
2. **Swing pivot detection**, confirmed/provisional flagged. Unblocks steps 2
   and 3 and is reusable.
3. **Derive-on-read triggers** (Demand Tail / IB / NR4 / NR7 / linearity) — no
   migration, follows `priceActionEvents.ts`, needs warm-up.
4. **DEMA 11/21/51** — only if §2.3 concludes DEMA specifically, not "trend
   rising".
5. **Checklist surface** with the three-state rows.
6. **Risk + size calculators**, local-only capital, arithmetic-not-advice.
7. **ICP: the setup question** (§1.3) and the setup × market-phase line (§1.4).

Steps 3 and 7 are independently shippable and cheap; 2 is the long pole.

---

## 5. Open questions for the owner

1. **"3 Entry Tactics near Range candle"** — undefined here; cannot be built
   from the description.
2. **Is DEMA the requirement, or "trend rising"?** (§2.3)
3. **Swing pivot rule** — what confirms a pivot? (N bars, % threshold, ATR
   multiple?) This determines the repaint behaviour.
4. **Capital: stored or local-only?** (§3.3)
5. **Checklist as a per-stock panel, or a universe-wide ranked scanner?**
6. **Rename the scanners to the five named setups?** (§1.1) — and does that
   settle or conflict with Eagles / Spark?
7. Does the swing filter ship as a **new scanner preset**, or as a **saved
   filter** over existing ones?

---

## 6. Data caveats that apply to all of the above

- **`km_corporate_actions` is EMPTY (D44).** `ret_66d` over unadjusted closes
  shows phantom +30% / −50% moves on splits and bonuses. Tolerable nuisance for
  a live daily screen; **disqualifying for any historical validation** of these
  rules until Sprint 3b populates it. Swing pivots are affected the same way — a
  split cliff manufactures a fake swing.
- **Enriched-layer depth.** `ema_20` starts ~2025-04 and NSE `delivery_pct`
  ~2025, so any backtest of the full checklist is capped at roughly 1.5 years
  even though raw prices go back 26 (`DATA_DEPTH_AUDIT.md`).
- **Thresholds.** 30–40% retracement and 3–5% stop come from the owner's own
  method, so they are not invented — but the house rule still applies: check the
  distribution before hard-coding, and accept that the data may refuse to supply
  a clean cut (the Price Action cooldown precedent, where the correct answer was
  *no threshold at all*).
