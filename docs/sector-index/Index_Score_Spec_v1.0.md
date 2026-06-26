# Index / Theme Scoring — Reverse-Engineered Specification

**Version:** 1.0
**Scope:** Scoring and aggregate columns for the Index/Theme cards across both index families — **Custom Index** (user-defined themes, e.g. *Affordable Housing*) and **Sectoral Index** (real published indices, e.g. *Nifty Auto*).
**Status:** Validated against live data as of 25 Jun 2026. Two open items flagged in §7 before freeze.

---

## 1. Executive summary

Every Score in both index families is **one skeleton**:

> a positive directional return, plus a volume-surge bonus, with two independent kill-switches.

```
Score_N = ret_N + surge_N      if ret_N > 0
        = 0                     if ret_N ≤ 0

surge_N = max( 0 , ( recentAvgAmt / baselineAvgAmt − 1 ) × 100 )
```

What differs between the two families is **not the formula** but **two parameters**: where `ret_N` comes from, and which window is used as the surge `baselineAvgAmt`. Hard-coding a single window will silently corrupt half the scores, because the **stock-level surge baseline is 66-day for Custom Index but 22-day for Sectoral Index**. This is the single most important point in this document.

---

## 2. The shared skeleton (universal — both families, stock and index level)

For a window `N` (the product surfaces N = 5 and N = 22):

- **`ret_N`** — the N-session close-to-close return, in percent.
- **`surge_N`** — `max(0, (recentAvgAmt / baselineAvgAmt − 1) × 100)`, where `recentAvgAmt` is the mean daily traded value (₹ Cr) over the last N sessions and `baselineAvgAmt` is the mean daily traded value over a longer baseline window (see §3).
- **Return gate** — if `ret_N ≤ 0`, the entire score is **0**, regardless of volume. A volume spike cannot rescue a down name.
- **Surge floor** — the `max(0, …)` means that if recent volume is *below* the baseline, the surge contributes **0**; the score then equals the return alone.

Two independent ways a score lands at a "bare return" or zero:

| Condition | Result | Mechanism |
|---|---|---|
| `ret_N ≤ 0` | Score = 0 | Return gate |
| `ret_N > 0` and recent volume < baseline | Score = `ret_N` | Surge floor |
| `ret_N > 0` and recent volume > baseline | Score = `ret_N + surge_N` | Full formula |

---

## 3. The two parameter profiles

| Parameter | **Custom Index** (equal-weight family) | **Sectoral Index** (real-index family) |
|---|---|---|
| Reference theme | Affordable Housing | Nifty Auto |
| **Stock-level `ret_N`** | constituent's own N-day return | constituent's own N-day return |
| **Stock-level surge baseline (5D score)** | **66-day** avg amount | **22-day** avg amount |
| **Stock-level surge baseline (22D score)** | **66-day** avg amount | **66-day** avg amount *(presumed — see §7)* |
| **Index-level `ret_N`** | **equal-weight mean** of constituent N-day returns | the **real index's own** N-day return (from the published Close series) |
| **Index-level surge baseline (5D score)** | **22-day** (the displayed `% Amt Chg`) | **22-day** (the displayed `% Amt Chg`) |
| **Index "Close"** | equal-weight mean of constituent closes (`Avg Close`) | the real index level |

### Key asymmetries to internalize

1. **Stock-level 5D surge baseline diverges by family: 66D (custom) vs 22D (sectoral).** This is the freeze-blocker. Same skeleton, different lookback.
2. **Index-level surge baseline is 22D for *both* families** (it is exactly the `% Amt Chg` column). Only the *stock-level* baseline diverges.
3. Because of (1) and (2), in the **Custom Index** family a theme's headline (index) score will **not** reconcile with the mean of its constituents' scores — the index surge uses a 22D baseline while its constituents use 66D. In the **Sectoral** family the 5D baseline is 22D at both levels, but the index return is the real cap-weighted move (not a constituent mean), so they still won't reduce to a simple average.

---

## 4. Aggregate / index-card columns (universal definitions)

Let the index have constituents `c = 1..K`.

- **`5D+`** — count of constituents with `ret_5 > 0`.
- **`5D Avg Amt (Cr.)`** — `Σ_c (5-day average daily amount of c)`. Despite the "Avg" label, the index aggregation is a **sum across constituents** of each stock's own 5-day-*averaged* amount. Same for **`22D Avg Amt (Cr.)`** with the 22-day average.
- **`% Amt Chg`** — `(5D Avg Amt − 22D Avg Amt) / 22D Avg Amt × 100`.
- **Direction dots** (`1D% / 5D% / 22D% / 66D%`) — green if the return over that lookback is `> 0`, red if `≤ 0`.
- **Custom Index only:** `Avg Close` = equal-weight mean of constituent closes; `Avg RSI` = equal-weight mean of constituent RSI.
- **Sectoral Index only:** `Close` and `RSI` are the real index's own values.

### Index Score (same skeleton on index-level series)

```
IndexScore_N = IndexRet_N + max(0, IndexSurge_N)      if IndexRet_N > 0
             = 0                                       if IndexRet_N ≤ 0

IndexSurge_5  = % Amt Chg = (5D Avg Amt − 22D Avg Amt) / 22D Avg Amt × 100
IndexRet_N    = equal-weight mean of constituent returns   (Custom Index)
              = real index N-session return                (Sectoral Index)
```

---

## 5. Validation evidence

### 5.1 Custom Index — Affordable Housing (5 constituents, as of 25 Jun 2026)

Aggregates (equal-weighted), all exact:

| Column | Computed | Shown |
|---|---|---|
| Avg Close | 846.79 | 846.79 |
| Avg RSI | 59.07 | 59.07 |
| 5D+ | 3 | 3 |
| 5D Avg Amt (Σ of constituent 5D avgs) | 91.45 | 91.44 |
| 22D Avg Amt (Σ of constituent 22D avgs) | 67.24 | 67.25 |
| % Amt Chg | +35.97% | +35.97% |
| **Index 5D Score** | 0.29 + 35.97 = **36.26** | 36.26 |
| **Index 22D Score** | 5.08 + ~0 = **5.08** | 5.08 |

Stock-level scores (surge baseline = **66-day** avg amount):

| Stock | history | 5D pred / shown | 22D pred / shown | Note |
|---|---|---|---|---|
| APTUS | 220 rows (full 66D) | 0.00 / 0.00 | **1.88 / 1.88** | exact; 5D gated (ret −1.72) |
| AAVAS | 72 rows (full 66D) | 55.16 / 55.51 | **46.50 / 46.44** | within rounding |
| INDIA SHELTER | 76 rows (full 66D) | 0.00 / 0.00 | 0.00 / 0.00 | both gated (returns negative) |
| AADHAR | full history | 193.91 / 194.30 | 43.46 / 43.64 | within rounding |
| HOME FIRST | full history | **3.28 / 3.28** | 15.29 / 15.31 | 5D surge floored (recent vol < 66D) |

**Pre-registered prediction confirmed:** before receiving AADHAR's full history, the formula back-solved its 66-day baseline to **12.07 Cr** and predicted the (then-unseen) 6 oldest days would average **~8.6 Cr**. Actual full-history values: baseline **12.09 Cr**, missing days averaged **8.82 Cr**. The model predicted data it had not been shown.

Residuals (≤ 0.4 on scores up to 194, i.e. < 0.2%) are entirely attributable to the displayed `Amt Inv` being rounded to two decimals; with unrounded source data they go to zero.

### 5.2 Sectoral Index — Nifty Auto (as of 25 Jun 2026)

Stock-level scores (surge baseline = **22-day** avg amount; surge = `(X Times − 1) × 100`, where `X Times = 5D Amt / 22D Amt`). **14 of 14 constituents matched, max residual 0.004:**

| Stock | 5D% | surge | pred | shown |
|---|---|---|---|---|
| BHARATFORG | 5.09 | 43.77 | 48.86 | 48.86 |
| SONACOMS | 0.89 | 30.96 | 31.85 | 31.85 |
| MARUTI | 2.61 | 28.48 | 31.09 | 31.09 |
| BOSCHLTD | 0.61 | 13.61 | 14.22 | 14.22 |
| UNOMINDA | 1.87 | 12.17 | 14.04 | 14.04 |
| MOTHERSON | 4.24 | 0.00 (floored, X<1) | 4.24 | 4.24 |
| TVSMOTOR | 3.68 | 0.00 (floored) | 3.68 | 3.68 |
| M&M | 3.49 | 0.00 (floored) | 3.49 | 3.49 |
| EXIDEIND | 2.38 | 0.85 | 3.23 | 3.23 |
| ASHOKLEY | 2.57 | 0.00 (floored) | 2.57 | 2.57 |
| BAJAJ-AUTO | −2.22 | — | 0.00 (gated) | 0.00 |
| EICHERMOT | −0.17 | — | 0.00 (gated) | 0.00 |
| HEROMOTOCO | −1.58 | — | 0.00 (gated) | 0.00 |
| TIINDIA | −7.05 | — | 0.00 (gated) | 0.00 |

Both kill-switches independently reconfirmed here: four stocks gated by negative return; four (MOTHERSON, TVS, M&M, ASHOK) floored by below-baseline volume.

`% Amt Chg` reproduced exactly on **all 7 sectoral indices** in the snapshot (Auto +5.67, Bank −19.00, Commodities −11.20, Consumer Durables +1.42, CPSE −28.57, Energy −27.74, Financial Services −13.76).

**Index return source resolved:** Nifty Auto's 5D Score 7.15 minus its +5.67 surge implies an index 5D return of **+1.48%**. The equal-weight mean of constituents' 5D% is **+1.17%** (ruled out — too low); the MCap-weight mean of the available 14 is **+1.63%** (brackets 1.48). The +1.48% is the real free-float index move off the published Close (26977.75). Equal-weighting applies only where no real index exists (the Custom themes). The index `5D Avg Amt` of 5720.07 equals the **sum** of the 15 constituent 5D amounts (14 supplied sum to 2817.82; the missing Tata Motors fills the remaining 2902.25 exactly), confirming the sum-based index amount definition.

---

## 6. Reference implementation (pseudocode)

```python
def score_window(ret_pct, recent_avg_amt, baseline_avg_amt):
    if ret_pct <= 0:
        return 0.0
    surge = max(0.0, (recent_avg_amt / baseline_avg_amt - 1.0) * 100.0)
    return ret_pct + surge

# ---- STOCK level ----
# Custom Index theme constituent:
score_5  = score_window(ret_5,  avg_amt(last=5),  baseline=avg_amt(last=66))
score_22 = score_window(ret_22, avg_amt(last=22), baseline=avg_amt(last=66))

# Sectoral Index constituent:
score_5  = score_window(ret_5,  avg_amt(last=5),  baseline=avg_amt(last=22))
score_22 = score_window(ret_22, avg_amt(last=22), baseline=avg_amt(last=66))  # see §7

# ---- INDEX level (both families) ----
idx_5d_avg_amt  = sum(stock.avg_amt(last=5)  for stock in constituents)
idx_22d_avg_amt = sum(stock.avg_amt(last=22) for stock in constituents)
pct_amt_chg     = (idx_5d_avg_amt - idx_22d_avg_amt) / idx_22d_avg_amt * 100

idx_ret_5  = equal_weight_mean(ret_5  over constituents)   # Custom Index
#          = real_index_return(window=5)                   # Sectoral Index

index_score_5 = score_5_ret_plus_surge(idx_ret_5, surge = max(0, pct_amt_chg))
```

---

## 7. Open items / decisions before freeze

1. **Confirm the Sectoral 22D-score surge baseline.** The 22D scores in the Nifty Auto data are not equal to the raw 22D% returns, so the 22D surge uses a baseline longer than 22D — almost certainly **66-day**, but the supplied data lacks a 66D-amount column to prove it. Pull one sectoral stock's 66D average amount to lock this cell.

2. **Decide whether to unify the Custom-family stock vs index surge baseline.** Today the index surge uses 22D while its constituents use 66D, so a theme's headline score will not reconcile with the mean of its constituents' scores. Either accept the asymmetry (and document it in-product) or align both to one window.

3. **Residuals are display-rounding only.** All non-zero residuals trace to two-decimal rounding of `Amt Inv`. Compute scores off unrounded source series and they vanish.

4. **Out of scope — the displayed `Amt Surge (X)` column** (the per-day multiple shown in the stock detail view) uses a **different, much longer baseline** (~3–4 Cr per the Affordable Housing names, consistent with a ~200-day / 1-year average daily value). It is **not** the surge term that drives the Score and must not be substituted for it.

---

## 8. Summary of what is frozen

Confirmed and stable across both families:

- Score skeleton: `ret + surge`, gated on return, floored on surge.
- Index amounts: `5D/22D Avg Amt` = sum of constituents' N-day-average daily amounts.
- `% Amt Chg` = (5D − 22D) / 22D, and it is the index-level surge term for both families.
- `5D+` = count of positive 5D movers; direction dots = sign of return per lookback.
- Custom Index aggregates: equal-weight `Avg Close` and `Avg RSI`; equal-weight constituent returns feed the index score.
- Sectoral Index: real index Close / RSI / return feed the index score.

Parameterized (must be set per surface):

- **Stock-level 5D surge baseline:** 66D for Custom, 22D for Sectoral.
- **Stock-level 22D surge baseline:** 66D for Custom; presumed 66D for Sectoral (item §7.1).
- **Index-level return source:** equal-weight mean (Custom) vs real index return (Sectoral).
