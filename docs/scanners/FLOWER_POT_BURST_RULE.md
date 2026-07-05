# FLOWER POT BURST — DristiQ Scanner Rule Document

**Rule ID:** SCANNER_FLOWER_POT_BURST  
**Version:** 1.0  
**Category:** Short Term / Intraday to Swing (48–96 hours)  
**Universe:** Full NSE universe (post-stage filter)  
**Scan Frequency:** Daily (EOD, after bhav copy download)  
**Signal Table:** `km_rule_signals` (rule_code = 'FPB_SETUP', 'FPB_BURST', 'FPB_CRACKED')

---

## Conceptual Definition

A **Flower Pot Burst** is an energy compression and release event. The stock has been coiling in a tightening range — like soil compressing in a pot — with volume dying and volatility contracting. Then in a single session (occasionally two), explosive energy releases: massive candle, massive volume, strong close near HOD.

The metaphor is precise:
```
The Pot    = tight compression range, low volatility, dying volume
The Soil   = sustained delivery volume quietly building underneath
The Burst  = single explosive candle breaking the compression
The Flower = sustained move over 48–96 hours that follows
The Crack  = fakeout — pot breaks but nothing grows
```

**This is an energy release story, not a trend story.**

It is fundamentally different from:
- Daily breakout: trend continuation from existing momentum
- Weekly breakout: structural trend change over weeks
- Waking Giant Phase 2: institutional push after months of accumulation

The Flower Pot Burst cares only about **compressed volatility releasing violently in the short term.**

---

## Three-Phase Signal Architecture

```
PHASE 0 — FPB_SETUP    : Compression forming (detectable 5–15 days before burst)
PHASE 1 — FPB_BURST    : Burst day confirmed (EOD signal)
PHASE 2 — FPB_CRACKED  : Day 2 failure — fakeout identified (risk management)
```

---

## Phase 0 — FPB_SETUP (Compression Forming)

Detects stocks entering the coiling phase. Watchlist alert — not a trade signal.

### Condition 1: Volatility Contraction

```
ATR_15D = Average True Range over last 15 days
ATR_60D = Average True Range over last 60 days

ATR_compression = ATR_15D / ATR_60D
```

**Threshold:**
```
ATR_compression < 0.5    : Significant compression (ATR halved vs 60D norm)
ATR_compression < 0.35   : Extreme compression (highest conviction setup)
```

### Condition 2: Range Contraction

```
Range_10D = MAX(high, last 10D) - MIN(low, last 10D)
Range_pct  = Range_10D / close

Candle_body_avg_15D = avg(|close - open|, last 15D)
Candle_body_avg_60D = avg(|close - open|, last 60D)

Body_compression = Candle_body_avg_15D / Candle_body_avg_60D
```

**Threshold:**
```
Range_pct < 0.08         : Price coiled within 8% range for 10 days
Body_compression < 0.5   : Average candle body halved vs norm
```

### Condition 3: Volume Death

```
Vol_5D_avg  = avg(volume, last 5 days)
Vol_22D_avg = avg(volume, last 22 days)

Vol_death = Vol_5D_avg / Vol_22D_avg
```

**Threshold:**
```
Vol_death < 0.5          : Volume more than halved — market ignoring this stock
Vol_death < 0.35         : Near-total silence — extreme setup quality
```

### Condition 4: MagicRS Flat (Coiled, Not Trending)

```
RS_5D_delta = MagicRS_today - MagicRS_5D_ago

|RS_5D_delta| < 1       : RS neither rising nor falling — coiled
```

Not falling (not a dying stock) and not already rising (not already moving) = coiled.

### Phase 0 fires when ALL of:
```
ATR_compression < 0.5
AND Range_pct < 0.08
AND Vol_death < 0.5
AND |RS_5D_delta| < 1
AND stage NOT in (Stage 3, Stage 4)   -- not in distribution or markdown
AND close > 20           -- minimum price filter (avoid sub-₹20 illiquid stocks)
```

**Phase 0 Output:**
```
Signal: FPB_SETUP
Fields:
  - atr_compression
  - range_pct_10D
  - vol_death_ratio
  - body_compression
  - rs_current
  - setup_day_count   (how many consecutive days meeting above criteria)
  - compression_quality_score = (1 - atr_compression) 
                               + (1 - vol_death_ratio) 
                               + (1 - range_pct_10D / 0.08)
                               (higher = tighter compression)
```

---

## Phase 1 — FPB_BURST (Burst Day)

Only evaluated on stocks with active FPB_SETUP signal (within last 22D).  
Evaluated EOD after bhav copy is processed.

### Condition 1: Volume Explosion

```
Vol_burst_ratio = today_volume / avg(volume, 22D)
```

**Threshold:**
```
Vol_burst_ratio ≥ 3.0    : Minimum burst confirmation
Vol_burst_ratio ≥ 5.0    : High conviction burst
Vol_burst_ratio ≥ 8.0    : Extreme — highest conviction
```

### Condition 2: Candle Range Expansion

```
Today_range      = high - low
Avg_range_15D    = avg(high - low, last 15 days)

Range_expansion  = Today_range / Avg_range_15D
```

**Threshold:**
```
Range_expansion ≥ 2.0    : Candle at least double the recent average range
Range_expansion ≥ 3.0    : High conviction expansion
```

### Condition 3: Strong Close (Not a Wick)

```
Close_strength = (close - low) / (high - low)
```

**Threshold:**
```
Close_strength ≥ 0.70    : Closing in top 30% of day's range
Close_strength ≥ 0.85    : Closing near HOD — maximum strength
```

This is critical. A burst candle that closes near the LOW is a trap (selling into the spike). A burst candle closing near HOD means buyers absorbed everything and still bid.

### Condition 4: Breaking Out of Compression Range

```
Compression_high = MAX(high, last 10D prior to today)

close > compression_high    : Closing above 10D range (breaking out, not faking)
```

### Condition 5: Delivery Quality (Soil Confirmation)

```
delivery_pct_today > 45     : Real buyers, not intraday speculation
delivery_pct_today > 60     : High conviction institutional participation
```

### Optional: Soil Stir Check (Pre-Burst Warning, Day -1 to -3)

Detected retroactively to confirm quality:
```
In 1–3 days before burst day:
  volume slightly above avg (1.1–1.5x) — not a spike
  delivery_pct > 55%
  price barely moved (< 1.5% day move)
```

Presence of soil stir = institutional absorption happening before burst.  
Add to FPB_BURST confidence scoring if detected.

### Phase 1 fires when ALL of:
```
FPB_SETUP active within last 22D
AND Vol_burst_ratio ≥ 3.0
AND Range_expansion ≥ 2.0
AND Close_strength ≥ 0.70
AND close > compression_high
AND delivery_pct_today > 45
```

**Burst Quality Score:**
```
FPB_quality = (Vol_burst_ratio / 3.0)          -- volume multiplier
            × (Range_expansion / 2.0)           -- range multiplier  
            × Close_strength                     -- close quality
            × (delivery_pct_today / 50)         -- delivery quality
            × (1 + soil_stir_present × 0.3)    -- soil stir bonus

FPB_quality < 1.5   : Marginal burst
FPB_quality 1.5–2.5 : Good burst
FPB_quality > 2.5   : Strong burst — high conviction
```

**Phase 1 Output:**
```
Signal: FPB_BURST
Fields:
  - vol_burst_ratio
  - range_expansion
  - close_strength
  - delivery_pct_today
  - soil_stir_detected (boolean)
  - compression_quality_score (from Phase 0)
  - fpb_quality_score
  - burst_candle_high
  - burst_candle_low
  - burst_candle_close
  - setup_to_burst_days   (how many days from FPB_SETUP to FPB_BURST)
```

---

## Phase 2 — FPB_CRACKED (Day 2 Failure Detection)

The most important risk management signal. Evaluated on Day 1 after FPB_BURST.

### The Crack Test

```
burst_midpoint = (burst_candle_high + burst_candle_low) / 2

Day2_close < burst_midpoint    : CRACKED — price gave back majority of burst
Day2_close ≥ burst_midpoint    : HOLDING — burst is sustaining
```

**Additional Crack Signals:**
```
Day2_volume < 0.7 × Vol_burst_day       : Volume didn't follow — no buyers Day 2
Day2_close < burst_candle_open          : Gave back everything (full reversal)
Day2_high < burst_candle_close          : Couldn't even reach burst close level
```

**CRACKED if any 2 of:**
```
Day2_close < burst_midpoint
Day2_volume < 0.7 × burst_volume
Day2_high < burst_candle_close
```

**HOLDING (Flower Blooming) if:**
```
Day2_close ≥ burst_midpoint
AND Day2_volume ≥ 0.5 × burst_volume    (sustained participation)
AND Day2_close not below burst_candle_open
```

**Phase 2 Output:**
```
Signal: FPB_CRACKED or FPB_HOLDING
Fields:
  - day2_close
  - day2_volume
  - burst_midpoint
  - crack_detected (boolean)
  - crack_severity: FULL / PARTIAL / NONE
```

---

## KaalaDristi Atmospheric Gate

The atmospheric layer is a **quality gate** on FPB_BURST, not a pre-filter.

```
CONFIRMED BURST — HIGH CONVICTION:
  FPB_BURST fires (quality ≥ 1.5)
  + dc_score ≥ 65 on burst day
  + No override: Rahu Kala NOT active during market session
  + Moon not in: Jyeshtha, Ashlesha, Moola, Bharani
  → ★★★ FLOWER POT BURST — ENTER WITH CONVICTION

BURST — PROCEED WITH CAUTION:
  FPB_BURST fires
  + dc_score 40–64
  → ★★ FLOWER POT BURST — SMALLER POSITION, TIGHT SL

CRACKED POT WARNING:
  FPB_BURST fires
  + dc_score < 40
  OR Vyatipata / Vaidhriti active on burst day
  OR Rahu Kala during peak volume window
  → ★ FLOWER POT — WAIT FOR DAY 2 CONFIRMATION ONLY
  (High probability of FPB_CRACKED outcome)
```

**Key Insight:** A Flower Pot Burst on a Vyatipata day has historically been a trap pattern across markets. The atmospheric gate here acts as a **cracked pot predictor**, not just a timing tool.

---

## When Flower Pot Burst Meets Waking Giant

The highest conviction setup in the DristiQ screener suite.

```
WAKING_GIANT_P2 active (within last 30D)
AND FPB_BURST fires on same stock
AND KaalaDristi dc_score ≥ 65
= GIANT AWAKENING BURST — Maximum Conviction
```

This combination means:
- Months of institutional accumulation (Giant Phase 1) ✓
- Push initiated, RS divergence confirmed (Giant Phase 2) ✓
- Compression coil formed on top of that base ✓
- Energy released in single session ✓
- Atmospheric window aligned ✓

Entry here is the earliest, highest-conviction positional trade available in the system.

---

## Entry, Hold and Exit Framework

**Entry Timing:**
```
Aggressive:  Buy burst candle close (EOD, same day)
             Risk: Day 2 might crack
             Reward: Best price, full move captured

Conservative: Buy Day 2 if FPB_HOLDING confirmed (not cracked)
              Risk: 2–5% higher entry
              Reward: Cracked pots eliminated, far fewer losers
```

**Recommended:** Conservative entry unless KaalaDristi ★★★ and FPB_quality > 2.5.

**Stop Loss:**
```
Hard SL: Below burst_candle_low (closing basis)
Soft SL: Below burst_midpoint (tighter, for Day 2 entries)
```

**Hold Period:**
```
Minimum: 2 trading days (let the flower open)
Maximum: 5 trading days (this is a short-term trade, not positional)
Review:  Day 3 EOD — if momentum hasn't continued, exit regardless
```

**Targets:**
```
T1: 8–12% from entry   (typical 48–96 hour burst target)
T2: Previous resistance level (nearest overhead supply)
T3: Only if KaalaDristi remains elevated AND volume sustains
```

**Mandatory Exit Triggers:**
```
FPB_CRACKED fires                       → Exit immediately at open
Volume collapses Day 2 or Day 3         → Exit same day close
KaalaDristi dc_score drops below 35     → Exit, atmospheric window closed
Stock up 15%+ in single session         → Book partial, trail rest
```

---

## Indicator Behaviour on Flower Pot Burst

| Indicator | Compression Phase | Burst Day | Day 2 (Holding) | Day 2 (Cracked) |
|---|---|---|---|---|
| ATR | Falling to multi-month low | Spikes 3–5x | Elevated | Collapses back |
| Volume | Dying (0.3–0.5x avg) | Explosion (3–8x) | Sustained (1.5–2x) | Drops sharply |
| Delivery % | 35–45% | 55–70% | 50–60% | Falls to 30% |
| MagicRS | Flat, coiled | Jumps 1–2 pts | Continues rising | Reverses |
| Candle body | Shrinking | 3–5x avg body | Strong body | Reversal candle |
| RSI | 40–50 (neutral) | Crosses 60 | Holds 55–65 | Falls back to 45 |
| Bollinger Bands | Squeezing tight | Bands burst open | Upper band target | Price re-enters bands |
| Close vs Range | Variable | Top 30%+ of range | Near HOD again | Near LOD |

---

## Difference from Other Breakout Scanners

| Dimension | Breakout Surge | Daily Breakout | Flower Pot Burst |
|---|---|---|---|
| Setup duration | Days to weeks | Varies | 10–22 days compression |
| Volume signature | Rising volume base | Volume on break | Volume DYING then EXPLODING |
| ATR behaviour | Normal or rising | Normal | Contracting then spiking |
| Hold period | Days to weeks | Days | 48–96 hours |
| Fundamental gate | Not required | Not required | Not required |
| GL relationship | Often above GL | Varies | Irrelevant |
| Key risk | Chasing | False break | Day 2 crack |
| Best atmospheric | High dc_score | High dc_score | Critical — gates crack vs bloom |

---

## Screener Position in Full DristiQ Suite

```
Waking Giants Phase 1    : Months before move — accumulation alert
Waking Giants Phase 2    : Weeks before — push initiated
  ↓ optional overlap ↓
Flower Pot Burst Setup   : Days before — coil detected
Flower Pot Burst         : Today — energy releases
  ↓ if Day 2 holds ↓
Breakout Surge           : Catches the continuation
  ↓ if it sustains ↓
Stage 2 Leaders          : Confirms new uptrend
```

Flower Pot Burst sits between the Waking Giant positional setup and the Breakout Surge continuation — it is the **trigger moment** in the chain.

---

## Data Requirements

### Already Available in km_equity_eod:
- close, open, high, low, volume
- ema_20, ema_50, sma_150
- atr_14
- magic_rs (daily)
- stage_classification
- rsi_14

### Needs Addition:
- `delivery_volume` — from NSE bhav copy
- `delivery_pct` — delivery_volume / volume × 100
- `atr_15d` — separate shorter ATR window
- `candle_body_avg_15d` — rolling average body size
- `vol_5d_avg` — 5-day volume average (shorter window)
- `compression_quality_score` — computed during FPB_SETUP
- `fpb_quality_score` — computed during FPB_BURST

### Signal State Tracking:
- `km_fpb_active` — tracks which stocks currently have FPB_SETUP active
  - symbol, setup_date, compression_score, burst_date (null until fires), status

---

## Scan Cadence

```
Daily (EOD):
  Step 1: Run FPB_SETUP scan on full NSE universe
          Update km_fpb_active table
          
  Step 2: Run FPB_BURST scan on km_fpb_active stocks only
          Fire FPB_BURST signal if conditions met
          
  Step 3: Run FPB_CRACKED / FPB_HOLDING scan on yesterday's burst stocks
          Update signal status
          
  Step 4: Apply KaalaDristi atmospheric gate
          Add confidence tier to surfaced signals

  Step 5: Check for Giant + Burst overlap
          Flag GIANT_AWAKENING_BURST if both active
```

---

## Rule Confidence Tracking

Record in `km_rule_confidence` per signal:

```
fpb_burst_to_holding_rate        : What % of bursts held Day 2?
fpb_atmospheric_gate_impact      : Did ★★★ bursts hold more than ★ bursts?
fpb_quality_score_correlation    : Does higher quality score = better outcome?
avg_move_day1_to_day3            : Average % move from burst close to Day 3
crack_rate_by_dc_score           : Do low dc_score days crack more?
giant_overlap_vs_standalone      : Giant+Burst combo outperformance vs Burst alone?
```

Minimum 50 signals before confidence rating is published.

---

## Naming Convention for Alerts

```
FPB_SETUP:          "[SYMBOL] — Flower Pot Forming | Compression Day N"
FPB_BURST:          "[SYMBOL] — 🌸 Flower Pot BURST | Quality: X.X | ★★★"
FPB_HOLDING:        "[SYMBOL] — Burst Holding | Day 2 Confirmed"
FPB_CRACKED:        "[SYMBOL] — ⚠️ Cracked Pot | Exit Signal"
GIANT_BURST:        "[SYMBOL] — 🌋 GIANT AWAKENING BURST | Max Conviction"
```
