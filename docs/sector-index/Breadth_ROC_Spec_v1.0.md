# Market Breadth & ROC (Greed–Fear) — Tier Specification

**Version:** 1.0
**Companion to:** `Index_Score_Spec_v1.0` (money/return axis) and `MoneyFlow_Heatmap_Spec_v1.0` (flow axis). This document specifies the **participation + momentum** axis — Breadth and its Rate of Change — and, critically, **how it behaves as it moves up and down the index hierarchy**.
**Status:** Draft for build. Open items in §11.

---

## 1. Governing principle

**Greed–Fear is a crowd statistic. It is only defined where there is a crowd.**

Breadth answers "what fraction of a population is healthy" — that requires a population. Consequently:

- Breadth and its Greed–Fear gauge live at **every population tier**: the NSE universe, an index, a sector, a custom theme.
- At the **single stock** (n = 1) breadth degenerates — a percentage of one is a coin flip. The stock level is therefore **out of scope for breadth** and is served instead by the existing per-stock tools: **RSI, RSS, and flow/surge analysis**.

This non-overlap is deliberate and is the architecture's strength: each tier uses the instrument that fits its population, and the handoff happens exactly where breadth stops being meaningful.

| Tier | Greed–Fear (Breadth + ROC) | Stock tools (RSI / RSS / flow) |
|---|---|---|
| NSE universe | ✅ regime | — |
| Index / sector / theme | ✅ rotation map | — |
| Single stock | ❌ (degenerate) | ✅ extension + timing |

---

## 2. Breadth Score — the snapshot ("where you are")

For a population of `N` constituents, with each constituent's Close and its EMA20 / EMA50 / EMA150:

```
p20  = count(Close > EMA20)  / N            # short-term participation
p50  = count(Close > EMA50)  / N            # medium-term participation
p150 = count(Close > EMA150) / N            # long-term participation

BreadthScore = 100 × ( 0.50·p20 + 0.30·p50 + 0.20·p150 )       # 0–100
```

Weighting is **50 % short / 30 % medium / 20 % long** — recent participation matters most.

**Zones (contrarian coloring):**

| Score | Zone | Colour | Reading |
|---|---|---|---|
| > 55 | Greed | red | most names extended; crowded |
| 35–55 | Neutral | amber | mixed participation |
| < 35 | Fear | green | most names beaten down; historically a recovery setup |

> The 35 / 55 cutoffs are **absolute and NSE-calibrated**. They are valid only at the full-universe tier. At every sub-population tier they must be replaced by per-index relative thresholds (§4). This is the single most important management rule in this spec.

Breadth is a **snapshot**: it states the present, not the direction. Direction is ROC's job.

---

## 3. ROC — the momentum ("which way you're heading")

ROC measures the **rate** at which the population is accelerating or decelerating, rather than its present level. Per the product definition, it is computed across two speeds plus a smoother:

- **ROC 13 (fast line)** — short-term pulse; reacts quickly.
- **ROC 55 (slow line)** — structural participation trend; moves slowly.
- **SMA-Breadth (amber line)** — a 5-day SMA of the fast line, to filter noise.

**Zero line is the pivot:** above zero, the average constituent is accelerating upward; below zero, decelerating. Distance from zero is intensity.

**4-state badge** (where "above SMA" means ROC 13 is above its own 5-day SMA):

| State | Condition | Meaning |
|---|---|---|
| **Bull** | ROC 13 > 0 **and** above SMA | positive and strengthening |
| **Caution** | ROC 13 > 0 **and** below SMA | positive but losing steam |
| **Recovering** | ROC 13 ≤ 0 **and** above SMA | negative but turning up |
| **Bear** | ROC 13 ≤ 0 **and** below SMA | negative and worsening |

> **Confirm the ROC basis against the live implementation (§11.1).** Two defensible definitions exist: (a) **average of per-constituent price ROC** — each stock's n-period rate of change, meaned across the population (matches the product wording "at what rate are stocks accelerating… on average"); or (b) **ROC of the Breadth Score line itself**. They are not interchangeable. This spec assumes (a); flag if the build uses (b).

---

## 4. Threshold normalization across tiers (management-critical)

Breadth granularity is `1/N` per EMA. A single constituent crossing one EMA moves the blended score by up to `weight × (100/N)`:

| Population | Single short-EMA cross | Worst case (name clears all 3 EMAs at once) |
|---|---|---|
| ~2000 (NSE) | ~0.025 pt | ~0.05 pt |
| 50 | ~1.0 pt | ~2.0 pt |
| 15 (Nifty Auto) | ~3.3 pt | ~6.7 pt |
| 5 (Affordable Housing) | ~10 pt | ~20 pt |

So absolute 35 / 55 bands, tuned on a 2000-stock universe, **misfire badly on small populations** — a 5-name theme can swing two-thirds of the way across the gauge on one stock's wiggle, and the ROC of that is spiky noise.

**Rule — below the universe tier, zones are relative to the index's own history, not absolute:**

```
zone(index, today) = percentile_rank( BreadthScore_today ,
                                       BreadthScore over trailing L sessions of THIS index )
```

Default bands (configurable, preserving the contrarian coloring):

| Percentile of own history | Zone |
|---|---|
| ≥ 70th | Greed (red) |
| 30th – 70th | Neutral (amber) |
| ≤ 30th | Fear (green) |

So "Nifty Auto is in Greed" means *greedy for Nifty Auto* — which is exactly what a rotation trader wants — and the gauge behaves consistently whether the index has 5 members or 50.

**Minimum-constituent guard.** Below ~8–10 constituents, either suppress the Greed–Fear gauge or widen its ROC smoothing, because per-name noise dominates. Never present a 5-name theme's raw breadth on the same absolute scale as the NSE gauge.

**History floor.** Percentile zones need a trailing distribution; require ≥ ~`L_min` sessions (default ~126) before switching a sub-population from absolute to percentile mode. Until then, show absolute zones with a "provisional / short history" flag.

---

## 5. Equal-weight is mandatory

Breadth is **one constituent, one vote.** Do **not** float- or cap-weight it to "match" the index level.

The entire value of breadth sitting next to the existing per-sector **Score** (which is cap-weighted and money-driven, per `Index_Score_Spec_v1.0`) is that equal-weight participation **disagrees** with it. Nifty Auto's index can be green, its Score high, while breadth collapses — because Maruti + M&M + Bajaj carry the cap-weighted index while the other twelve names sit below their EMAs. That is a **narrow rally**, and only equal-weight breadth detects it. Weight breadth to agree with the index and you delete the very divergence this widget exists to surface.

---

## 6. The three orthogonal axes

At any index/sector/theme tier the product now reads three independent dimensions:

| Axis | Question | Source |
|---|---|---|
| **Money** | is capital flowing in? | Score / surge (`Index_Score_Spec`) |
| **Participation** | is the move broad? | Breadth (this spec, equal-weight) |
| **Momentum** | is it accelerating? | ROC (this spec) |

They are designed to disagree. Agreement is confirmation; disagreement is the signal.

---

## 7. Breadth × ROC divergence matrix (the payoff)

| Breadth | ROC | Reading |
|---|---|---|
| High (Greed) | falling, near zero | broad **but** fading → **distribution beginning** |
| Low (Fear) | rising, crossing zero | underwater **but** worst is over → **recovery starting** |
| Rising | rising | participation **and** momentum aligned → **strong confirmation** |
| Falling | falling | broad deterioration → **avoid** |

**This pattern repeats fractally** — it reads the same way for the whole market, for one sector, and (with stock tools substituted for breadth) conceptually for one name. That gives a clean top-down funnel:

```
Market regime  →  which sectors  →  which names
(universe         (index/sector      (stock: RSI / RSS / flow
 breadth+ROC)      breadth+ROC)        — handoff point)
```

Breadth tells you where each rung sits; ROC tells you which way it's heading; the handoff to RSI/RSS/flow happens precisely where breadth degenerates.

---

## 8. Data inputs & computation depth

Per constituent, per session: `Close`, `EMA20`, `EMA50`, `EMA150` (already present in exports), plus the `Close` series for ROC.

| Quantity | History required |
|---|---|
| Breadth snapshot | 1 session (needs EMA150 → ~150 sessions of price upstream) |
| ROC 55 | ≥ 55 sessions |
| SMA-Breadth | 5 sessions of ROC 13 |
| Percentile zones | ≥ `L_min` (default ~126) sessions of the index's own breadth |

---

## 9. Edge cases & hygiene

- **Missing long EMA.** New listings / short history have no EMA150 (seen as `EMA150 = 0` in early export rows). Exclude such names from **that** participation ratio's denominator rather than counting them as "below"; document the per-EMA denominator.
- **Index membership changes.** Percentile history ideally uses each date's *as-of* membership; if using current membership throughout, accept and disclose mild survivorship drift.
- **Small-n.** Enforce the §4 minimum-constituent guard; do not render absolute Greed–Fear on tiny themes.
- **Equal-weight integrity.** No weighting creeps in via data joins — verify the participation count is unweighted.
- **ROC warm-up.** Suppress the badge until ROC 55 and the 5-day SMA have full windows; show "warming up," not a misleading state.

---

## 10. Configuration parameters

| Param | Default | Notes |
|---|---|---|
| `emaWindows` | 20 / 50 / 150 | participation EMAs |
| `weights` | 0.50 / 0.30 / 0.20 | short / medium / long |
| `absoluteZones` | 35 / 55 | **universe tier only** |
| `zoneMode` (sub-tier) | percentile | vs absolute fallback |
| `percentileBands` | 30 / 70 | Fear ≤30th, Greed ≥70th |
| `percentileLookback L` | 252 | trailing sessions for own-history zones |
| `historyFloor L_min` | 126 | below this, absolute + provisional flag |
| `minConstituents` | 8–10 | below this, suppress or widen smoothing |
| `rocFast / rocSlow` | 13 / 55 | fast / slow lines |
| `smaWindow` | 5 | smoother on the fast line |
| `rocBasis` | per-constituent avg | vs breadth-line ROC (§11.1) |

---

## 11. Open items

1. **Confirm `rocBasis`** against the production calculation (average of per-stock ROC vs ROC of the breadth line). Everything in §3 assumes the former.
2. **Tune `percentileBands` and `L`** on real per-index breadth history so the relative Greed–Fear frequency matches the product's intent (the absolute 35/55 split is not symmetric — decide whether percentile bands should preserve that skew or move to clean tertiles).
3. **Decide membership handling** for percentile history (as-of vs current).

---

## 12. Summary

- Greed–Fear (Breadth + ROC) ships at **every index/sector/theme tier**; the **stock tier is intentionally excluded** and handed to RSI / RSS / flow.
- Breadth is **equal-weight, always** — that is what makes it diverge usefully from the cap-weighted Score.
- Absolute 35 / 55 zones are **universe-only**; sub-populations use **percentile-of-own-history** zones with a **minimum-constituent guard**, so a 5-name theme and the full NSE both behave sensibly.
- Breadth states *where* a tier is; ROC states *where it's heading*; their divergence — and its divergence from the money axis — is the diagnostic the product is built to surface.
