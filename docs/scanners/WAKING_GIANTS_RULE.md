# WAKING GIANTS — DristiQ Scanner Rule Document

**Rule ID:** SCANNER_WAKING_GIANTS  
**Version:** 1.0  
**Category:** Positional / Swing (Weeks to Months)  
**Universe:** Giants Watchlist (~100–150 NSE stocks, quarterly refresh)  
**Scan Frequency:** Weekly (Monday morning before market open)  
**Signal Table:** `km_rule_signals` (rule_code = 'WAKING_GIANT_P1', 'WAKING_GIANT_P2')

---

## Conceptual Definition

A **Waking Giant** is a legacy company (20+ years in operation) that has been dormant on the price chart for an extended period — not because the business is broken, but because the market had no catalyst to re-rate it. The awakening is triggered by an **external force** (policy change, sector re-rating, new demand curve for an old product, geopolitical shift) rather than the company's own actions.

The setup is fundamentally different from a momentum or breakout play:
- The company didn't change — the world around it changed
- The price chart looks dead — but the business fundamentals are intact
- Institutional accumulation happens silently over weeks before price moves
- The eventual move is violent because supply has been fully absorbed

**Archetype examples:** Shivalik Bimetal (SBCL) — EV/energy metering demand for shunt resistors. Walchandnagar Industries (WALCHANNAG) — India's nuclear energy mission re-rating a 100-year-old engineering company.

---

## Two-Phase Signal Architecture

Waking Giants fires in two sequential phases. Phase 2 is only valid if Phase 1 preceded it.

```
PHASE 1 — Silent Accumulation    (weeks to months before price moves)
PHASE 2 — Push Initiated         (days to weeks before breakout)
```

Phase 1 alone = WATCHLIST ALERT  
Phase 2 alone without Phase 1 = IGNORE (could be anything)  
Phase 1 + Phase 2 in sequence = WAKING GIANT CONFIRMED

---

## Layer 0 — Giants Master Watchlist (Quarterly Refresh)

This is the pre-filter universe. Run once per quarter. Stored in `km_giants_watchlist`.

### Giant Identification Criteria

**Age Gate (Legacy):**
```
NSE listing date OR incorporation year ≤ current year - 20
Minimum 20 years in operation
```

**Size Gate (Real Business):**
```
Market cap ≥ ₹200 Crore (not a shell)
Average daily traded value ≥ ₹1 Crore (liquid enough)
```

**Dormancy Gate (Sleeping):**
```
Current price ≤ 60% of 3-year high
Stage classification = Stage 1 OR Stage 4
SMA_150 slope near flat (|slope| < 0.05% per day over 66D)
```

**Fundamental Alive Gate (Giant is breathing):**
```
Revenue CAGR 3Y > -10%            (not collapsing)
EBITDA positive in 2 of last 3 years
Debt/Equity < 2.0                  (not over-leveraged)
Promoter holding delta (last 4Q) > -3%  (not fleeing)
Dividend paid in ≥ 2 of last 5 years   (returns capital = real business)
```

**Exclusion:**
```
Stocks under regulatory action (ASM/GSM lists)
Promoter pledge > 50%
Revenue declining 3 consecutive years
```

---

## Phase 1 — Silent Accumulation Signal

### Indicator 1: GL Accumulation Days (Primary Signal)

The number of trading days in the last 66D where consistent delivery volume occurred within the Golden Line band.

**GL Band definition:**
```
GL_band_upper = SMA_150 × 1.03
GL_band_lower = SMA_150 × 0.97
```

**GL Accumulation Day criteria (each day must satisfy ALL):**
```sql
close BETWEEN (sma_150 * 0.97) AND (sma_150 * 1.03)
AND delivery_pct > 50
AND volume > 0.8 × avg(volume, 22D)
```

**GL Accumulation Score:**
```
GL_acc_days     = COUNT of qualifying days in last 66D
GL_density_1    = COUNT of qualifying days in days 45–66 ago (oldest third)
GL_density_2    = COUNT of qualifying days in days 23–44 ago (middle third)
GL_density_3    = COUNT of qualifying days in days 1–22 ago  (recent third)

GL_acceleration = GL_density_3 / MAX(GL_density_1, 1)
                  (how much more active recently vs earliest period)

GL_score = GL_acc_days × GL_acceleration
```

**Thresholds:**
```
GL_acc_days < 5              : Ignore
GL_acc_days 5–9              : Watchlist candidate
GL_acc_days 10–14            : Accumulation in progress
GL_acc_days 15–20            : High conviction accumulation
GL_acc_days > 20             : Institutional loading — Phase 1 fires
GL_acceleration > 1.5        : Accelerating (bonus confirmation)
```

**Phase 1 fires when:**
```
GL_acc_days ≥ 15
AND GL_acceleration ≥ 1.0   (not decelerating)
AND stock is on Giants Watchlist
```

### Indicator 2: Volume Consistency Check (Supporting)

Not a spike — a sustained elevation. Distinguishes institutional accumulation from operator activity.

```
Vol_22D_avg  = avg(volume, last 22D)
Vol_66D_avg  = avg(volume, prior 66D, i.e., days 23–88)

Vol_elevation = Vol_22D_avg / Vol_66D_avg

Vol_CV_22D   = stddev(volume, 22D) / avg(volume, 22D)
               (Coefficient of Variation — low = consistent)
```

**Interpretation:**
```
Vol_elevation > 1.5 AND Vol_CV_22D < 0.5  : Sustained institutional accumulation
Vol_elevation > 2.0 AND Vol_CV_22D > 0.8  : One-time spike, not accumulation
```

Supporting confirmation for Phase 1 — not standalone trigger.

### Indicator 3: MagicRS Weekly Timeframe (Early Warning)

During dormancy, MagicRS will be 1/6 or 2/6. The weekly timeframe turns before daily.

```
RS_weekly_now     = MagicRS score on weekly aggregation
RS_weekly_4W_ago  = MagicRS score 4 weeks prior

RS_weekly_delta = RS_weekly_now - RS_weekly_4W_ago
```

**Phase 1 confirmation:**
```
RS_weekly_delta ≥ 1   (weekly RS improved by at least 1 point)
While RS_daily still ≤ 3/6  (daily hasn't caught up yet)
```

Weekly turning before daily = institutional timeframe responding first.

### Phase 1 Signal Output

```
Signal: WAKING_GIANT_P1
Strength: GL_score (numeric)
Fields stored in km_rule_signals:
  - gl_acc_days
  - gl_acceleration
  - vol_elevation
  - vol_cv_22d
  - rs_weekly_delta
  - rs_daily_current
  - sma_150_slope
  - days_below_3yr_high
```

---

## Phase 2 — Push Initiated Signal

Phase 2 only evaluated on stocks that have an active Phase 1 signal (within last 30D).

### Indicator 1: RS Slope Angle Divergence (Primary Signal)

The daily MagicRS suddenly accelerates while weekly MagicRS is still lagging. This gap is the institutional push fingerprint.

```
RS_slope_daily  = (MagicRS_daily_today - MagicRS_daily_10D_ago) / 10
RS_slope_weekly = (MagicRS_weekly_today - MagicRS_weekly_4W_ago) / 4

Slope_divergence       = RS_slope_daily - RS_slope_weekly
Slope_divergence_10D   = same calculation 10 days ago

Slope_divergence_jump  = Slope_divergence - Slope_divergence_10D
```

**Thresholds:**
```
Slope_divergence < 0.3          : Normal, no signal
Slope_divergence 0.3–0.6        : Daily waking, watch
Slope_divergence > 0.6          : Real push beginning
Slope_divergence_jump > 0.3
in single week                  : Sudden acceleration — Phase 2 trigger
```

**Phase 2 primary condition:**
```
Slope_divergence > 0.6
AND Slope_divergence_jump > 0.3 in last 5D
AND Phase 1 signal active within last 30D
```

### Indicator 2: Golden Line Multiple Attempt Pattern

The volume pattern at GL across multiple tests. Third or later test with rising volume = supply being exhausted.

```
GL_test_count   = number of times price touched GL band in last 66D
                  and was rejected (closed below GL after touching)

GL_vol_attempt_1 = avg volume on first GL test (days when price in band, earliest)
GL_vol_attempt_2 = avg volume on second GL test
GL_vol_attempt_latest = avg volume on most recent GL test

GL_vol_trend = GL_vol_attempt_latest / GL_vol_attempt_1
```

**Signal:**
```
GL_test_count ≥ 3               : Multiple attempts (supply being absorbed)
GL_vol_trend > 1.3              : Each attempt with more volume
Latest test: close > SMA_150    : Finally crossing (not just touching)
Volume on cross > 2× 22D avg   : Conviction cross
```

### Indicator 3: Monthly Candlestick Pattern (Confluence Gate)

Not a filter — a confidence multiplier. Check monthly timeframe for:

```
Morning Star         : 3-candle reversal (doji + gap + bullish engulf)
Hammer / Dragonfly   : Long lower wick, small body, near monthly low
Bullish Engulfing    : Current month candle engulfs prior red candle
Monthly close > 3-month high : First time in 6+ months
```

```
monthly_pattern_score:
  Morning Star = 3
  Bullish Engulfing = 2
  Hammer = 2
  Monthly close > 3M high = 1
  No pattern = 0
```

Monthly pattern score ≥ 2 = HIGH CONFIDENCE Phase 2.

### Phase 2 Signal Output

```
Signal: WAKING_GIANT_P2
Strength: composite (slope_divergence × gl_vol_trend × monthly_pattern_score)
Fields:
  - slope_divergence
  - slope_divergence_jump
  - gl_test_count
  - gl_vol_trend
  - monthly_pattern_code
  - monthly_pattern_score
  - phase1_signal_date (reference back)
  - phase1_to_phase2_days (how long between phases)
```

---

## KaalaDristi Atmospheric Gate

Applied on top of Phase 2 confirmation before alert is surfaced to trader.

```
CONFIRMED WAKING GIANT (High Conviction):
  Phase 1 ✓ + Phase 2 ✓
  + dc_score ≥ 65 today
  + No override: Vyatipata, Vaidhriti, Rahu Kala not active
  + Moon nakshatra: not Jyeshtha, Ashlesha, Moola
  → SURFACE AS: ★★★ WAKING GIANT — ATMOSPHERIC ALIGNED

WAKING GIANT (Watch):
  Phase 1 ✓ + Phase 2 ✓
  + dc_score 40–64
  → SURFACE AS: ★★ WAKING GIANT — MONITOR ENTRY

WAKING GIANT (Caution):
  Phase 1 ✓ + Phase 2 ✓
  + dc_score < 40 OR override active
  → SURFACE AS: ★ WAKING GIANT — AWAIT BETTER WINDOW
```

---

## Entry, Hold and Exit Framework

**Entry:**
```
Primary:    Sniper signal on GL retest (2–4 weeks after Phase 2)
            GL held as support on retest + low volume pullback
Secondary:  Phase 2 confirmation close (more aggressive, wider SL)
```

**Stop Loss:**
```
Below GL (SMA_150) on closing basis
OR below Phase 2 trigger candle low
Whichever is tighter
```

**Hold Period:**
```
Minimum: 22 trading days (give the giant time to stretch)
Maximum: Until Stage 2 is confirmed in DristiQ classification
         OR until distribution signals appear
```

**Target:**
```
T1: 3-year high (where it was before sleeping)
T2: All-time high (if fundamentals support re-rating)
```

**Exit Signals:**
```
Weekly MagicRS begins declining after reaching 5/6
Volume dries up after 3+ weeks of sustained move
Monthly distribution candle forms
KaalaDristi dc_score sustained below 35 for 5+ consecutive days
```

---

## Indicator Behaviour Summary

| Indicator | During Dormancy | Phase 1 | Phase 2 | Post-Breakout |
|---|---|---|---|---|
| MagicRS Daily | 1–2/6, flat | 2–3/6, weekly turns | Daily jumps, weekly lags | Both rising, gap closes |
| MagicRS Weekly | 1/6, dead | Begins turning | Still lagging daily | Catches up |
| SMA_150 (GL) | Sloping down | Goes FLAT | Price tests from below | Price crosses, GL curls up |
| GL Acc Days | 0–3 | 10–20, rising | 15–25, accelerating | Price above GL |
| Volume | Below avg | Consistently 1.2–1.5x | Spike on GL cross 2–3x | Sustained elevated |
| Delivery % | 35–45% | 50–60% rising | 60–70%+ | Normalises |
| ATR | Low, compressed | Still low | Expanding | High |
| Monthly Candle | Red / Doji | Doji / Hammer forming | Morning Star / Engulf | Strong bullish |
| RS Slope Gap | Near zero | Slight daily tilt | Diverges sharply | Gap closes from above |

---

## Separation Test: Sleeping Giant vs Dying Company

Both look identical on price chart. Fundamental gate separates them.

| Signal | Sleeping Giant | Dying Company |
|---|---|---|
| Revenue | Flat / mildly down | Falling 3+ years |
| EBITDA | Positive, compressing | Negative / turning negative |
| Debt | Stable / reducing | Spiralling |
| Promoter | Stable / quietly buying | Creeping down |
| Dividend | Paid regularly | Stopped |
| Order Book | Exists, thin | Empty / cancelled |
| Delivery % at GL | Rising quietly | Erratic / low |

---

## Data Requirements

### Already Available in km_equity_eod:
- close, volume, high, low
- sma_150 (GL)
- ema_20, ema_50
- magic_rs (daily)
- stage_classification
- atr_14

### Needs Addition:
- `delivery_volume` — from NSE bhav copy (daily file)
- `delivery_pct` — delivery_volume / total_volume × 100
- `magic_rs_weekly` — weekly aggregated RS score
- `gl_acc_days` — computed rolling column (66D window)
- `gl_acceleration` — derived from gl_acc_days distribution
- `rs_slope_daily` — 10D slope of daily magic_rs
- `rs_slope_weekly` — 4W slope of weekly magic_rs
- `slope_divergence` — rs_slope_daily - rs_slope_weekly

### New Tables:
- `km_giants_watchlist` — quarterly refreshed master list
- `km_giants_signals` — Phase 1 and Phase 2 signal history

---

## Scan Cadence

```
Quarterly:  Rebuild km_giants_watchlist (fundamental refresh)
Weekly:     Run Phase 1 scan on entire watchlist (Monday pre-open)
Weekly:     Run Phase 2 scan on Phase 1 active stocks (same run)
Daily:      Apply KaalaDristi atmospheric gate on Phase 2 stocks only
```

---

## Rule Confidence Tracking

On each signal, record in `km_rule_confidence`:
```
phase1_to_breakout_rate     (did Phase 1 lead to eventual breakout?)
phase2_to_move_rate         (did Phase 2 lead to 8%+ move in 22D?)
atmospheric_gate_lift       (did KaalaDristi gate improve hit rate?)
avg_days_phase1_to_phase2   (how long between phases historically?)
avg_hold_to_target          (trading days from entry to T1?)
```

Minimum 30 signals before confidence rating is published.
