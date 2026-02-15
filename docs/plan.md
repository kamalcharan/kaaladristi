# KĀLA-DRISHTI ENGINE BUILD PLAN
## "Build the Brain" — Analytics, Correlation, Rules & Pattern Discovery

**Created**: 15 Feb 2026
**Focus**: Core engine pipeline — from raw data generation to validated, backtested intelligence
**Philosophy**: Generate → Verify → Correlate → Score → Discover → Validate → Repeat

---

## CURRENT STATE ASSESSMENT

### What EXISTS (code written)
| Component | File | Status |
|-----------|------|--------|
| Ephemeris Generator | `generate_ephemeris.py` | Code ready, **never run** |
| Panchang Generator | `generate_panchang.py` | Code ready, **never run** |
| Risk Engine | `engine/risk_engine.py` | Code ready, **never run on real data** |
| Correlation Engine | `engine/correlations.py` | Code ready, **never run** |
| Signal Engine | `engine/signal_engine.py` | Code ready, **never run** |
| Discovery Engine | `engine/discovery_engine.py` | Code ready, **never run** |
| Market Data (Supabase) | `km_index_eod` table | NIFTY 1990-2026 loaded via yfinance pipeline |
| Master Tables | All reference data | Populated (planets, nakshatras, sectors, rules) |
| Given Rules | `rules` table | 18 domain rules loaded |

### What's EMPTY (tables with no data)
| Table | Depends On |
|-------|-----------|
| `planetary_positions` | generate_ephemeris.py → Supabase |
| `planetary_aspects` | generate_ephemeris.py → Supabase |
| `astro_events` | generate_ephemeris.py → Supabase |
| `moon_intraday` | generate_ephemeris.py → Supabase |
| `daily_panchang` | generate_panchang.py → Supabase |
| `risk_scores` | risk_engine.py (needs positions + aspects + moon) |
| `factor_correlation_stats` | correlations.py (needs positions + aspects + moon + market) |
| `rule_signals` | signal_engine.py (needs panchang + positions + aspects + rules) |
| `candidate_rules` | discovery_engine.py (needs panchang + market) |
| `sector_sensitivity` | Future (needs correlation + sector mappings) |

### Data Flow Dependency Chain
```
Step 1: generate_ephemeris.py → Supabase (planetary_positions, planetary_aspects, astro_events, moon_intraday)
           ↓
Step 2: generate_panchang.py → Supabase (daily_panchang)
           ↓
Step 3: correlations.py → factor_correlation_stats     ← needs km_index_eod + ephemeris
Step 4: risk_engine.py → risk_scores                   ← needs ephemeris + moon_intraday
Step 5: signal_engine.py → rule_signals                ← needs panchang + positions + aspects + rules
Step 6: discovery_engine.py → candidate_rules          ← needs panchang + km_index_eod
Step 7: Backtest & validate everything
```

**Database**: Supabase (PostgreSQL) is the single source of truth. No SQLite.

---

## PHASE 1: DATA GENERATION & SEEDING
### "Fill the tanks before starting the engine"

**Goal**: Generate all astronomical data for 1990-01-01 to 2030-12-31 (41 years), load directly into Supabase, verify integrity.

**Database**: Supabase (PostgreSQL) — all data goes here. No intermediate SQLite.

#### Step 1.1 — Generate Ephemeris & Load to Supabase
- **Run**: `generate_ephemeris.py` for date range 1990-01-01 to 2030-12-31
- **Generates + uploads to Supabase tables directly**:
  - `planetary_positions` — ~9 planets × ~14,975 days = ~134,775 records
  - `planetary_aspects` — 7 aspect pairs × daily = ~45,000+ records
  - `astro_events` — retrograde stations, sign changes = ~3,000+ records
  - `moon_intraday` — 4 times/day × ~14,975 days = ~59,900 records
- **Verification**:
  - [ ] Mercury retrograde count: expect ~120-130 periods (3-4/year × 41 years)
  - [ ] Mars retrograde count: expect ~20 periods (every ~2 years)
  - [ ] Saturn retrograde count: expect ~41 periods (1/year)
  - [ ] Moon nakshatra changes: ~14,975 daily changes
  - [ ] Aspect counts: conjunction/opposition/square should be ~1,500+ each
  - [ ] Gandanta flags: expect ~500-700 occurrences
  - [ ] Spot-check: Pick 5 known dates, verify positions against published ephemeris
- **Supabase verification**:
  - [ ] Row counts in Supabase match generated counts
  - [ ] No NULL longitudes or signs
  - [ ] Retrograde flags: true/false only
  - [ ] Date range: 1990-01-01 to 2030-12-31 continuous (every calendar day)
  - [ ] Unique constraint: no duplicate (date, planet) pairs

#### Step 1.2 — Generate Panchang & Load to Supabase
- **Run**: `generate_panchang.py` for 1990-01-01 to 2030-12-31
- **Generates + uploads directly to Supabase**: `daily_panchang` — ~14,975 records
- **Each record contains**: sunrise, tithi, nakshatra, yoga, karana, vara, DLNL match, sankranti, hemisphere events
- **Verification**:
  - [ ] DLNL match ~11% of days (1/9 probability)
  - [ ] Sankranti count: ~492 (12/year × 41 years)
  - [ ] Purnima count: ~492 (~12/year)
  - [ ] Amavasya count: ~492
  - [ ] Ekadashi count: ~984 (2/month × 12 × 41)
  - [ ] Vara distribution: ~14.3% each day
  - [ ] Paksha: ~50/50 Shukla/Krishna
  - [ ] Spot-check: 5 dates against published Panchang (drikpanchang.com)
- **Supabase verification**:
  - [ ] Row count in Supabase = ~14,975
  - [ ] No NULL tithi/nakshatra/yoga/vara fields
  - [ ] Date is PRIMARY KEY — no duplicates
  - [ ] Tithi num range: 1-30
  - [ ] Nakshatra num range: 1-27
  - [ ] Yoga num range: 1-27

#### Step 1.3 — Verify Market Data in Supabase
- **Check**: `km_index_eod` table has clean NIFTY data
- **Source**: yfinance pipeline (already built) or Breeze API
- **Required coverage**: 1990 to present (trading days only)
- **Verification**:
  - [ ] NIFTY 50: data from ~1996 onwards (earliest available)
  - [ ] BANKNIFTY: data from ~2007 onwards
  - [ ] No NULL close prices
  - [ ] `daily_return` computed for all rows (except first)
  - [ ] `daily_range_pct` computed: (high-low)/close × 100
  - [ ] No weekend/holiday dates (sanity check)
  - [ ] Count: expect ~7,000-7,500 trading days for NIFTY (1996-2026)
  - [ ] Spot-check: 5 known crash dates (2008 Lehman, 2020 COVID, etc.)
- **If gaps exist**: Re-run yfinance pipeline to backfill

#### Step 1.4 — Cross-Validation: Panchang ↔ Ephemeris (in Supabase)
- **Purpose**: Ensure panchang and ephemeris agree — query Supabase directly
- **Checks**:
  - [ ] Moon nakshatra in `daily_panchang` matches Moon nakshatra in `planetary_positions` (at sunrise)
  - [ ] Sun sign in `daily_panchang` matches Sun sign in `planetary_positions`
  - [ ] Sankranti dates in panchang match sign-change events in `astro_events`
  - [ ] DLNL: vara_lord matches nakshatra_lord on DLNL=1 days
- **Method**: SQL queries joining panchang ↔ ephemeris tables in Supabase

**Phase 1 Exit Criteria**:
- All 5 ephemeris/panchang tables populated in Supabase with 41 years of data (1990-2030)
- Market data (km_index_eod) verified and complete
- All verification checks pass
- Cross-validation confirms consistency across Supabase tables

---

## PHASE 2: CORRELATION ENGINE
### "Prove or disprove every factor with data"

**Goal**: Run every factor against 35+ years of NIFTY returns. Measure statistical significance. Separate signal from noise.

#### Step 2.1 — Compute Baseline Statistics
- **Date range**: 1990-01-01 to 2029-12-31 (keep 2026-2029 as out-of-sample for forward testing)
- **Metrics**:
  - Total trading days
  - % down days (close < prev close)
  - Average daily return
  - Average daily range %
  - Standard deviation of returns
- **Output**: Baseline numbers for comparison

#### Step 2.2 — Run Correlation Engine (All 40+ Factors)
- **Run**: `correlations.py` for NIFTY, date range 1990-2029
- **Factors tested** (5 categories):

  **Retrogrades (5)**:
  | Factor | Expected Effect | Min Samples |
  |--------|----------------|-------------|
  | Mercury Retrograde | Bearish (false signals) | 80+ |
  | Mars Retrograde | Bearish (blocked momentum) | 13+ |
  | Saturn Retrograde | Bearish (structural instability) | 27+ |
  | Jupiter Retrograde | Mild bearish | 27+ |
  | Venus Retrograde | Mild bearish | 10+ |

  **Hard Aspects (8)**:
  | Factor | Expected Effect |
  |--------|----------------|
  | Mars-Saturn (conj/opp/sq) | Strong bearish |
  | Mars-Rahu | Bearish (reckless aggression) |
  | Mercury-Rahu | Bearish (amplified false signals) |
  | Saturn-Rahu | Bearish (structural + shadow) |
  | Jupiter-Saturn | Neutral to bearish |
  | Sun-Saturn | Mild bearish |
  | Sun-Mercury | Neutral |
  | Mercury-Saturn | (add new — communication + restriction) |

  **Moon Nakshatras (27 + groups)**:
  | Factor | Expected Effect |
  |--------|----------------|
  | Moon in Ardra | High volatility |
  | Moon in Moola | High volatility |
  | Moon in Jyeshtha | Bearish tendency |
  | Moon in Ashlesha | Deceptive moves |
  | Moon Gandanta | Extreme volatility |
  | All 27 individually | Varies |

  **Panchang Elements**:
  | Factor | Expected Effect |
  |--------|----------------|
  | Each of 30 tithis | Varies |
  | Each of 27 yogas | Varies |
  | Each of 7 varas | Varies |
  | DLNL match days | Bullish? |
  | Sankranti days | Volatile |
  | Purnima | Varies |
  | Amavasya | Bearish tendency |
  | Ekadashi | Varies by paksha |

- **Output**: `factor_correlation_stats` table populated

#### Step 2.3 — Statistical Significance Analysis
- **For each factor, compute**:
  - Z-score: `(factor_down% - baseline_down%) / sqrt(p*(1-p)/n)`
  - Classification:
    - |z| ≥ 2.58 → **Highly Significant** (p < 0.01)
    - |z| ≥ 1.96 → **Significant** (p < 0.05)
    - |z| ≥ 1.64 → **Marginal** (p < 0.10)
    - |z| < 1.64 → **Not Significant**
  - Effect size: delta(down%) vs baseline
  - Volatility impact: factor_range / baseline_range

#### Step 2.4 — Factor Report Card
- **Generate a ranked report**:
  ```
  RANK | FACTOR              | N    | DOWN% | Δ vs BASE | Z-SCORE | SIG LEVEL     | VOL MUL
  -----|---------------------|------|-------|-----------|---------|---------------|--------
  1    | Mars-Saturn Aspect  | 67   | 56.2% | +7.3pp    | 2.89    | HIGHLY SIG    | 1.18x
  2    | Mercury Retrograde  | 89   | 53.1% | +4.2pp    | 2.14    | SIGNIFICANT   | 1.15x
  3    | Moon in Ardra       | 52   | 52.8% | +3.9pp    | 1.72    | MARGINAL      | 1.22x
  ...  | ...                 | ...  | ...   | ...       | ...     | ...           | ...
  ```
- **Key decisions from this report**:
  - Which factors to KEEP in risk engine (significant ones)
  - Which factors to REMOVE (not significant, noise)
  - Which factors need WEIGHT ADJUSTMENT
  - New factors to ADD (if any nakshatra/tithi shows unexpected significance)

#### Step 2.5 — Calibrate Risk Engine Weights
- **Based on correlation results, adjust risk_engine.py**:
  - If Mercury Retrograde z-score = 2.14 but Saturn Retrograde z-score = 0.8 → reduce Saturn weight
  - If Moon in Ardra is strongest nakshatra signal → ensure it gets max volatility points
  - If Mars-Saturn is the strongest aspect → keep at 10 points
  - If a factor is NOT significant → reduce to 0 or remove
- **Document every weight change with statistical justification**

**Phase 2 Exit Criteria**:
- All 40+ factors tested with statistical rigor
- Factor report card generated and reviewed
- Risk engine weights calibrated to match empirical evidence
- Clear separation: significant factors vs noise
- `factor_correlation_stats` table fully populated

---

## PHASE 3: RISK ENGINE EXECUTION
### "Score every trading day for 40 years"

**Goal**: Compute risk scores for every NIFTY trading day (1990-2029). Validate against actual market outcomes.

#### Step 3.1 — Run Risk Engine (Full Historical)
- **Run**: `risk_engine.py` for NIFTY, 1990-01-01 to 2029-12-31
- **For each trading day, compute**:
  - Structural Risk (0-25)
  - Momentum Risk (0-25)
  - Volatility Risk (0-25)
  - Deception Risk (0-25)
  - Composite Score (0-100)
  - Regime: Accumulation / Expansion / Distribution / Capital Protection
- **Output**: `risk_scores` table → ~7,500+ rows
- **Verification**:
  - [ ] Score range: 0-100 for composite, 0-25 for each dimension
  - [ ] Regime distribution: expect most days in Accumulation/Expansion (market is mostly up)
  - [ ] No NULL scores
  - [ ] Continuous date coverage (trading days only)

#### Step 3.2 — Regime Distribution Analysis
- **Expected distribution** (rough):
  | Regime | Score Range | Expected % |
  |--------|------------|-----------|
  | Accumulation | 0-30 | ~40-50% |
  | Expansion | 31-50 | ~25-30% |
  | Distribution | 51-70 | ~15-20% |
  | Capital Protection | 71-100 | ~5-10% |
- **If Capital Protection > 15%**: Weights too aggressive, recalibrate
- **If Capital Protection < 3%**: Weights too conservative, recalibrate

#### Step 3.3 — Regime vs Market Returns Validation
- **For each regime, compute actual NIFTY performance**:
  ```
  REGIME              | DAYS | AVG RETURN | DOWN% | AVG RANGE | WORST DAY
  --------------------|------|-----------|-------|-----------|----------
  Accumulation        | 2800 | +0.05%    | 47%   | 1.2%      | -3.1%
  Expansion           | 1500 | +0.02%    | 49%   | 1.5%      | -4.2%
  Distribution        | 1000 | -0.03%    | 53%   | 1.8%      | -5.8%
  Capital Protection  | 300  | -0.08%    | 58%   | 2.5%      | -12.1%
  ```
- **Success criteria**:
  - [ ] Down% increases monotonically: Accum < Expan < Distrib < CapProtect
  - [ ] Avg return decreases: Accum > Expan > Distrib > CapProtect
  - [ ] Avg range increases: Accum < Expan < Distrib < CapProtect
  - [ ] Capital Protection captures major crashes (2008, 2020, etc.)

#### Step 3.4 — Event Validation (Known Crisis Dates)
- **Test against known market events**:
  | Date | Event | Expected Regime | Expected Score |
  |------|-------|----------------|---------------|
  | 2008-09-15 | Lehman Brothers | Capital Protection | 70+ |
  | 2008-10-24 | Global crash bottom | Capital Protection | 80+ |
  | 2020-03-23 | COVID crash bottom | Distribution+ | 60+ |
  | 2016-11-08 | Demonetization | Varies | 40+ |
  | 2004-05-17 | Election shock | Distribution+ | 50+ |
  | Normal bull days | Random calm days | Accumulation | 0-30 |
- **Purpose**: Sanity check — does the engine "see" risk before/during crises?

#### Step 3.5 — Dimension Contribution Analysis
- **For high-risk days (score > 70), analyze which dimensions drive the score**:
  - How often is Structural the primary driver? (Saturn/Jupiter retrogrades)
  - How often is Momentum? (Mars retrograde + aspects)
  - How often is Volatility? (Moon nakshatras + gandanta)
  - How often is Deception? (Mercury retrograde + aspects)
- **Purpose**: Understand if the model is balanced or over-reliant on one dimension

**Phase 3 Exit Criteria**:
- `risk_scores` populated for 25+ years
- Regime distribution is reasonable (not all one bucket)
- Regime → market performance shows clear monotonic relationship
- Major crashes captured by high-risk regimes
- No dimension dominates > 60% of high-risk scores

---

## PHASE 4: SIGNAL ENGINE & RULES EVALUATION
### "Test every rule against every trading day"

**Goal**: Fire all 18 given rules across 40 years of data. Measure each rule's predictive accuracy. Aggregate daily signals.

#### Step 4.1 — Build Day Context for Full History
- **For each trading day (1990-2029)**:
  - Merge `daily_panchang` + `planetary_positions` + `planetary_aspects`
  - Build the evaluation context dict (tithi, vara, nakshatra, planet_signs, retrogrades, aspects, etc.)
- **Output**: Context objects for ~7,500 trading days
- **Verification**:
  - [ ] Every trading day has a context (no gaps)
  - [ ] Context contains all required fields
  - [ ] planet_signs has all 9 planets for every day

#### Step 4.2 — Evaluate All 18 Given Rules
- **Run**: `signal_engine.py` evaluate_all_rules() for each day
- **For each rule × each day**:
  - Does the condition tree evaluate to True?
  - If yes: record (date, rule_id, signal, strength) in `rule_signals`
- **Output**: `rule_signals` table populated
- **Expected fire rates**:
  | Rule Category | Example | Expected Fire Rate |
  |--------------|---------|-------------------|
  | DLNL | Day Lord = Nakshatra Lord | ~11% of days |
  | MSV | Mercury between Sun-Venus | ~15-25% of days |
  | Hemisphere | Equinox/Solstice windows | ~8-16 days/year |
  | Sign | Planet co-presence | Varies (5-30%) |
  | Panchang | Tithi/Nakshatra rules | Varies |

#### Step 4.3 — Per-Rule Accuracy Analysis
- **For each rule, compute**:
  | Metric | Description |
  |--------|------------|
  | Fire count | How many days did this rule fire? |
  | Signal direction | Bullish or Bearish? |
  | Actual down% when fired | % of fire-days where market went down |
  | Avg return when fired | Average NIFTY return on fire-days |
  | Accuracy | Did signal direction match actual move? |
  | Lift vs baseline | How much better than random? |
- **Generate Rule Scorecard**:
  ```
  RULE         | FIRES | SIGNAL  | DOWN% | ACCURACY | LIFT
  -------------|-------|---------|-------|----------|------
  DLNL_001     | 680   | Bullish | 46.2% | 53.8%   | +4.9pp
  ASP_001      | 120   | Bearish | 55.8% | 55.8%   | +6.9pp
  PAN_001      | 340   | Bearish | 51.2% | 51.2%   | +2.3pp
  ```

#### Step 4.4 — Daily Signal Aggregation
- **For each trading day, aggregate all fired rules**:
  - Net signal score = Σ(signal_value × strength) for all fired rules
  - Classification: Super Bullish (>3), Bullish (1-3), Neutral (-1 to 1), Bearish (-3 to -1), Super Bearish (<-3)
- **Validate aggregated signal vs actual market**:
  - [ ] Super Bearish days: down% should be highest
  - [ ] Super Bullish days: down% should be lowest
  - [ ] Clear monotonic relationship

#### Step 4.5 — Rule Pruning & Strength Tuning
- **Based on accuracy analysis**:
  - Rules with accuracy < 50% → deactivate or flip signal
  - Rules with accuracy > 55% → increase strength
  - Rules with very low fire count (< 20) → flag for monitoring (insufficient data)
  - Rules that never fire → investigate condition logic bugs
- **Update `rules` table with tuned strengths**

**Phase 4 Exit Criteria**:
- All 18 rules evaluated across 40 years
- `rule_signals` table populated
- Per-rule accuracy known and documented
- Aggregated daily signal shows predictive power
- Underperforming rules deactivated or adjusted
- Rule strengths tuned to empirical accuracy

---

## PHASE 5: DISCOVERY ENGINE
### "Let the data reveal what domain knowledge missed"

**Goal**: Scan 40 years of Panchang × Market data for new patterns. Generate candidate rules. Validate statistically.

#### Step 5.1 — Run All 6 Pattern Scanners
- **Scanner 1: TithiScanner**
  - Test all 30 tithis (15 base × 2 pakshas) against NIFTY returns
  - Min samples: 20 per tithi
  - Expected: ~200 observations per tithi
  - Look for: tithis with |z| > 1.96

- **Scanner 2: NakshatraScanner**
  - Test all 27 nakshatras
  - Min samples: 20
  - Expected: ~230 observations per nakshatra
  - Cross-reference with correlation engine's Moon nakshatra results

- **Scanner 3: VaraTithiScanner**
  - Test all 7 × 15 = 105 vara-tithi combinations
  - Min samples: 10 (small cells)
  - Expected: ~60 observations per combination
  - Look for: interaction effects (e.g., Monday + Ashtami is different from Tuesday + Ashtami)

- **Scanner 4: DLNLScanner**
  - Validate the DLNL theory with statistical rigor
  - Compare DLNL=1 days vs DLNL=0 days
  - Expected: ~1,000+ DLNL days in 40 years
  - This is the core domain hypothesis — does it actually work?

- **Scanner 5: SankrantiScanner**
  - Test overall sankranti effect (all 324 events)
  - Test per-sign sankranti (12 groups × ~27 each)
  - Look for: specific signs where Sun entry is volatile

- **Scanner 6: YogaScanner**
  - Test all 27 yogas
  - Min samples: 20
  - Expected: ~230 per yoga
  - Cross-reference with yoga nature (auspicious/inauspicious from `yogas` table)

#### Step 5.2 — Collect & Rank Discoveries
- **Aggregate all significant patterns** (z ≥ 1.96):
  ```
  PATTERN                    | Z-SCORE | SIG LEVEL    | N    | DOWN% | AVG RET
  ---------------------------|---------|-------------|------|-------|--------
  Krishna Ekadashi           | 2.78    | HIGHLY SIG  | 78   | 56.0% | -0.045%
  Vara=Friday + Ashtami      | 2.45    | SIGNIFICANT | 32   | 62.5% | -0.068%
  Moon in Magha              | 2.12    | SIGNIFICANT | 245  | 53.1% | -0.022%
  Yoga=Vyatipata             | 2.08    | SIGNIFICANT | 230  | 52.6% | -0.019%
  ...
  ```

#### Step 5.3 — Create Candidate Rules
- **For each significant discovery**:
  - Generate conditions JSON (composable condition tree)
  - Assign signal (based on direction: bearish if down% > baseline, bullish if <)
  - Assign initial strength (based on z-score magnitude)
  - Save to `candidate_rules` table with full stats
- **Expected output**: 15-40 candidate rules

#### Step 5.4 — Review & Promote Candidates
- **For each candidate, evaluate**:
  - Is it a real pattern or spurious correlation? (domain knowledge check)
  - Does it overlap with existing rules? (avoid double-counting)
  - Is the sample size adequate? (>30 preferred)
  - Is the effect size meaningful? (>3pp lift)
- **Promote approved candidates**:
  - Move to `rules` table with `source='discovered'`
  - Set initial strength conservatively (1-2)
  - Add historical_note with discovery stats

#### Step 5.5 — Re-Run Signal Engine with Expanded Rule Set
- After promoting new rules, re-run Phase 4 (signal evaluation)
- Compare accuracy before/after adding discovered rules
- **Success metric**: Net signal accuracy improves by ≥1-2pp

**Phase 5 Exit Criteria**:
- All 6 scanners run successfully
- Significant patterns identified and documented
- Candidate rules created and reviewed
- Best candidates promoted to active rules
- Signal engine re-run with expanded rule set shows improvement

---

## PHASE 6: INTEGRATED BACKTESTING & VALIDATION
### "Does the whole system work end-to-end?"

**Goal**: Combine risk scores + signal scores into a unified daily intelligence output. Backtest against market. Measure real-world predictive value.

#### Step 6.1 — Build Combined Daily Intelligence Table
- **For each trading day, create**:
  ```
  date | risk_score | risk_regime | signal_score | signal_class | actual_return | actual_direction
  ```
- **Join**: `risk_scores` + aggregated `rule_signals` + `market_daily`
- **This is the master validation table**

#### Step 6.2 — 2D Accuracy Matrix (Risk × Signal)
- **Cross-tabulate risk regime vs signal direction**:
  ```
                    | Super Bullish | Bullish | Neutral | Bearish | Super Bearish
  ------------------|---------------|---------|---------|---------|---------------
  Accumulation      |   45% down    | 47% dn  | 49% dn  | 51% dn  | 54% down
  Expansion         |   47% down    | 49% dn  | 51% dn  | 53% dn  | 56% down
  Distribution      |   49% down    | 51% dn  | 53% dn  | 55% dn  | 59% down
  Capital Protect   |   52% down    | 54% dn  | 57% dn  | 60% dn  | 65% down
  ```
- **Success**: Clear gradient in both directions (higher risk + bearish signal = more down days)

#### Step 6.3 — Out-of-Sample Test (2026+ Data)
- **Purpose**: We trained on 1990-2025. Test on 2026 onwards (out-of-sample window).
- **Run risk engine + signal engine on 2026+ dates**
- **Compare predictions vs actual NIFTY performance**
- **This is the acid test** — does it generalize?

#### Step 6.4 — Rolling Window Stability Test
- **Test if correlations are stable across time**:
  - Run correlation engine on 1996-2005 only
  - Run again on 2005-2015 only
  - Run again on 2015-2025
  - **Check**: Are the same factors significant across all windows?
  - **If yes**: Robust pattern (keep)
  - **If no**: Regime-dependent or spurious (flag/reduce weight)

#### Step 6.5 — Generate Engine Performance Report
- **Final metrics**:
  | Metric | Value | Target |
  |--------|-------|--------|
  | Overall signal accuracy | ? | > 52% |
  | Capital Protection capture rate | ? | > 70% of major crashes |
  | Risk-Return monotonicity | ? | Clear gradient |
  | Factor stability (3 windows) | ? | > 60% factors stable |
  | Out-of-sample accuracy | ? | > 50% (better than coin flip) |
  | Rules with > 55% accuracy | ? | > 50% of active rules |

**Phase 6 Exit Criteria**:
- Combined intelligence table generated
- 2D accuracy matrix shows meaningful gradient
- Out-of-sample test passes (>50% accuracy)
- Rolling window shows factor stability
- Performance report generated with clear metrics
- System is validated and ready for production use

---

## PHASE 7: ENGINE HARDENING & PRODUCTION READINESS
### "Make it reliable, repeatable, and extensible"

#### Step 7.1 — Orchestration Script
- Create `run_pipeline.py` — master script that runs phases 1-6 in order
- Supports: `--phase 1-6`, `--date-range`, `--symbol`, `--dry-run`
- Logs all outputs, handles errors gracefully
- Idempotent: can re-run any phase without data corruption

#### Step 7.2 — Daily Update Pipeline
- Create `daily_update.py` — runs every morning before 9:00 AM IST
- Steps:
  1. Generate today's ephemeris + panchang
  2. Compute today's risk score
  3. Evaluate today's signal (all active rules)
  4. Generate today's intelligence output
  5. Push to Supabase for frontend consumption

#### Step 7.3 — Data Quality Monitoring
- Add validation checks at each pipeline stage
- Alert on: NULL values, missing dates, score out of range
- Weekly: Re-run discovery engine for new patterns

#### Step 7.4 — Engine API Layer
- Create simple Python API (Flask/FastAPI) or direct Supabase functions
- Endpoints:
  - `GET /risk/{date}/{symbol}` → risk score + regime
  - `GET /signals/{date}` → fired rules + net signal
  - `GET /panchang/{date}` → full panchang
  - `GET /intelligence/{date}` → combined risk + signal + panchang

---

## EXECUTION TIMELINE

| Phase | Description | Dependency | Estimated Effort |
|-------|------------|------------|-----------------|
| **Phase 1** | Data Generation & Seeding | None | Foundation |
| **Phase 2** | Correlation Engine | Phase 1 | Analysis |
| **Phase 3** | Risk Engine Execution | Phase 1 + 2 | Computation |
| **Phase 4** | Signal Engine & Rules | Phase 1 + 3 | Evaluation |
| **Phase 5** | Discovery Engine | Phase 1 + 4 | Discovery |
| **Phase 6** | Integrated Backtesting | Phase 3 + 4 + 5 | Validation |
| **Phase 7** | Hardening & Production | Phase 6 | Engineering |

```
Phase 1 ──────────────────────────────┐
                                       ├──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
                                       │                                              │
                                       └──────────────────────────────────────────────→ Phase 6 ──→ Phase 7
```

---

## VERIFICATION PHILOSOPHY

Every phase has explicit verification criteria because:

1. **Astronomical data must be accurate** — A wrong Moon nakshatra corrupts DLNL, risk scores, and signals downstream
2. **Statistical claims must be honest** — A z-score of 1.5 is NOT significant, no matter how exciting the pattern looks
3. **The chain is only as strong as its weakest link** — If ephemeris data is wrong, everything built on it is wrong
4. **Backtest ≠ Forward performance** — Phase 6 out-of-sample test is the real validation
5. **Domain knowledge + Data = Power** — Neither alone is sufficient. The engine uses domain knowledge (given rules) validated by data (correlation engine) and extended by data (discovery engine)

---

## DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-15 | Use Lahiri ayanamsa | Standard for Indian Vedic astrology |
| 2026-02-15 | Ujjain as base location | Traditional Hindu astronomical meridian |
| 2026-02-15 | 1990-2025 training, 2026+ out-of-sample | Max history (NIFTY from ~1996) + forward validation |
| 2026-02-15 | Ephemeris/Panchang range: 1990-2030 | Covers all market data + 4 years forward |
| 2026-02-15 | Supabase is the single database | No SQLite — all engines read/write Supabase directly |
| 2026-02-15 | Z ≥ 1.96 for significance | Standard statistical threshold (p < 0.05) |
| 2026-02-15 | Min 20 samples per factor | Below 20, statistics are unreliable |
| | | |

---

*This plan is a living document. Update the Decision Log as choices are made during execution.*

---
---

# KĀLA-DRISHTI UI/UX BUILD PLAN
## "Build the Face" — From Raw Intelligence to Actionable Insight

**Created**: 15 Feb 2026
**Updated**: 15 Feb 2026 — Added Scale Infrastructure (Edge Layer + Snapshots) for 2000+ users
**Focus**: Frontend experience — dashboards, visualizations, interactions, and real-time data presentation
**Philosophy**: Data → Insight → Context → Action — every pixel earns its place
**Scale Target**: 2000+ concurrent users, all hitting the same daily data

---

## SCALE ARCHITECTURE OVERVIEW

### The Problem
```
TODAY (breaks at ~200 users):
  2000 browsers ──→ Supabase REST API ──→ PostgreSQL
                    (no caching, no edge layer)
                    (every user = identical query hitting DB)
```

### The Solution: Edge Layer + Daily Snapshots
```
AFTER (handles 2000+ users):

  Python Pipeline (runs daily 7:30 AM IST)
      ↓
  Generates Snapshots (pre-computed JSON per date/symbol)
      ↓
  Upserts to km_daily_snapshots table in Supabase
      ↓
  Supabase Edge Function "/api/snapshot" (Deno)
      ├── In-memory cache (Map with 5-min TTL)
      ├── Reads snapshot from km_daily_snapshots
      └── Returns JSON to ALL 2000 users from cache
      ↓
  React App (React Query, 5-min stale time)
      ├── Single fetch per (date, symbol) → cached for 5 min
      ├── Master data → cached forever (Infinity gcTime)
      └── EOD charts → paginated by date range (not .range(0,9999))
```

### Why Snapshots?
- **Dashboard data is identical for all users** — risk score, panchang, signals, factors for "NIFTY on 15-Feb-2026" is the same JSON for everyone
- **One pre-computed blob** replaces 6+ separate table queries
- **Edge Function cache** means 2000 users = 1 DB read (cache hit for the rest)
- **CDN-friendly** — snapshots are immutable once computed (yesterday's score never changes)

### Query Reduction Math
| Without Snapshots (per user) | With Snapshots (per user) |
|-----|------|
| 1. `risk_scores WHERE date/symbol` | 1. `GET /api/snapshot?date=X&symbol=Y` |
| 2. `daily_panchang WHERE date` | (everything in one blob) |
| 3. `planetary_positions WHERE date` | |
| 4. `planetary_aspects WHERE date` | |
| 5. `astro_events WHERE date range` | |
| 6. `rule_signals JOIN rules WHERE date` | |
| 7. `sector_sensitivity WHERE date/symbol` | |
| **= 7 queries × 2000 users = 14,000 DB queries** | **= 1 cached edge response × 2000 users = ~1 DB query** |

---

## CURRENT FRONTEND STATE

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.3 |
| Language | TypeScript (strict) | 5.8 |
| Build | Vite | 6.2 |
| Routing | React Router DOM | 7.13 |
| State (server) | TanStack React Query | 5.90 |
| State (client) | Zustand | 5.0 |
| Styling | Tailwind CSS | 3.4 |
| Charts | Recharts | 3.7 |
| Animations | Framer Motion | 12.x |
| UI Primitives | Radix UI | Latest |
| Icons | Lucide React | 0.562 |
| Backend | Supabase (Auth + DB + Edge Functions) | 2.95 |
| AI | Google Gemini | 1.34 |

### What's BUILT (frontend code exists)
| View/Component | File | Status |
|---------------|------|--------|
| Landing Page | `views/LandingPage.tsx` | **Working** — auth forms, animated background |
| Profile Setup | `views/ProfileSetup.tsx` | **Working** — onboarding flow |
| Dashboard Page | `views/DashboardPage.tsx` | **Working** — uses MOCK data |
| Dashboard View | `views/DashboardView.tsx` | **Working** — risk gauge, factors, outlook |
| Markets View | `views/MarketsView.tsx` | **Working** — EOD charts from REAL Supabase data |
| Calendar View | `views/CalendarView.tsx` | **Stub** — placeholder "Coming Sprint 2" |
| Transmission View | `views/TransmissionView.tsx` | **Stub** — placeholder "Coming Sprint 3" |
| Backtest View | `views/BacktestView.tsx` | **Stub** — placeholder "Coming Sprint 3" |
| Settings View | `views/SettingsView.tsx` | **Working** — master data reference tables |
| Layout + Sidebar | `components/domain/Layout.tsx` | **Working** — sidebar nav, 6 routes |
| Risk Gauge | `components/domain/RiskGauge.tsx` | **Working** — animated circular gauge (4 sizes) |
| Factor Cards | `components/domain/FactorCard.tsx` | **Working** — 4-factor breakdown |
| Index Price Chart | `components/domain/IndexPriceChart.tsx` | **Working** — area chart, multiple time ranges |
| Symbol Switcher | `components/domain/SymbolSwitcher.tsx` | **Working** — NIFTY/BANKNIFTY/NIFTYIT/NIFTYFMCG |
| Regime Badge | `components/domain/RegimeBadge.tsx` | **Working** — 4 regime states |
| Mini Bar Chart | `components/domain/MiniBarChart.tsx` | **Working** — 7-day outlook |
| Protected Route | `components/domain/ProtectedRoute.tsx` | **Working** — auth guard |
| UI Kit | `components/ui/*` | **Working** — Card, Badge, Progress, Skeleton |

### What's MOCK (needs real data connection)
| Data Layer | Current Source | Target Source |
|-----------|---------------|--------------|
| Daily Risk Score | `services/riskData.ts` (seeded random) | **Snapshot** → `km_daily_snapshots.risk` |
| Factor Breakdown | `services/riskData.ts` (seeded random) | **Snapshot** → `km_daily_snapshots.risk.factors` |
| 7-Day Outlook | `services/riskData.ts` (seeded random) | **Snapshot** → `km_daily_snapshots.outlook` |
| Historical Proofs | `services/riskData.ts` (seeded random) | **Edge Function** → `/api/proofs?symbol=X` |
| Sector Impacts | Hardcoded in DashboardView | **Snapshot** → `km_daily_snapshots.sectors` |
| AI Explanation | Not connected | **Snapshot** → `km_daily_snapshots.explanation` (pre-generated) |
| Rule Signals | Not shown yet | **Snapshot** → `km_daily_snapshots.signals` |
| Panchang Display | Not shown yet | **Snapshot** → `km_daily_snapshots.panchang` |
| Planetary Positions | Not shown yet | **Snapshot** → `km_daily_snapshots.planets` |

### What's MISSING (views not built)
| View | Priority | Depends On |
|------|----------|-----------|
| Calendar (Panchang + Risk) | High | Phase 0 (Edge) + Engine Phase 1 data |
| Transmission (Factor Flow) | Medium | Engine Phase 2 + 3 data |
| Backtest (Accuracy Reports) | Medium | Engine Phase 6 data |
| Rule Explorer (Admin) | Low | Engine Phase 4 data |
| Discovery Dashboard (Admin) | Low | Engine Phase 5 data |
| Notifications / Alerts | Low | Engine Phase 7 daily pipeline |

---

## DESIGN SYSTEM (Established)

### Color Palette
```
Background:     #030712 (kd-bg)        — deep space black
Card Surface:   rgba(255,255,255,0.03)  — subtle elevation
Borders:        rgba(255,255,255,0.06)  — whisper borders

Accent Indigo:  #6366f1                 — primary action
Accent Violet:  #8b5cf6                 — secondary accent
Accent Cyan:    #06b6d4                 — data highlights
Accent Gold:    #fbbf24                 — premium/featured

Risk Green:     #10b981                 — score ≤ 40 (Accumulation)
Risk Amber:     #f59e0b                 — score 41-70 (Distribution/Expansion)
Risk Red:       #ef4444                 — score > 70 (Capital Protection)

Text Primary:   rgba(255,255,255,0.95)
Text Secondary: rgba(255,255,255,0.60)
Text Muted:     rgba(255,255,255,0.40)
```

### Typography
| Role | Font | Usage |
|------|------|-------|
| Primary | Inter | Body text, labels, navigation |
| Display | Playfair Display | Page titles, hero numbers |
| Mono | JetBrains Mono | Data values, scores, dates |

### Component Variants (CVA)
- **Card**: default, elevated, glass, accent — with optional hover effects
- **Risk Gauge**: hero (200px), summary (120px), mini (64px), tiny (40px)
- **Regime Badge**: accumulation (green), expansion (amber-light), distribution (amber), capital-protection (red)

### Animation Principles
- **Purposeful**: Every animation communicates state change (score loading, regime shift)
- **Fast feedback**: 200ms for micro-interactions, 400-800ms for data transitions
- **Framer Motion**: Complex orchestrated animations (gauge fill, card stagger)
- **CSS keyframes**: Ambient background effects (orbital dots, pulse-live indicator)

---

## UI/UX PHASE 0: SCALE INFRASTRUCTURE
### "Build the highway before the traffic arrives"

**Goal**: Create the Edge Function layer, daily snapshot system, DB optimizations, and security hardening — so every subsequent phase is scale-ready from day one.

**Depends On**: Engine Phase 1 (tables exist) — but infrastructure can be built in parallel

**Scale Target**: 2000+ concurrent users, <2s Dashboard load, <1 DB query per user per page load

---

#### Step 0.1 — Daily Snapshot Table

Create `km_daily_snapshots` — the **single pre-computed JSON blob** that powers the entire Dashboard for a given (date, symbol).

**SQL**: `App/DBscripts/km_daily_snapshots.sql`
```sql
CREATE TABLE km_daily_snapshots (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        DATE NOT NULL,
  symbol      TEXT NOT NULL,
  version     INT NOT NULL DEFAULT 1,
  snapshot    JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, symbol)
);

CREATE INDEX idx_snapshots_date_symbol ON km_daily_snapshots (date, symbol);
CREATE INDEX idx_snapshots_date ON km_daily_snapshots (date);

ALTER TABLE km_daily_snapshots ENABLE ROW LEVEL SECURITY;
-- Public read (same data for all users)
CREATE POLICY "snapshots_read" ON km_daily_snapshots FOR SELECT USING (true);
-- Only service role can write (pipeline only)
CREATE POLICY "snapshots_write" ON km_daily_snapshots FOR INSERT WITH CHECK (false);
CREATE POLICY "snapshots_update" ON km_daily_snapshots FOR UPDATE WITH CHECK (false);
```

**Snapshot JSON structure** (one blob per date/symbol):
```json
{
  "date": "2026-02-15",
  "symbol": "NIFTY",
  "version": 1,
  "risk": {
    "composite_score": 67,
    "regime": "distribution",
    "structural": 18,
    "momentum": 15,
    "volatility": 20,
    "deception": 14,
    "explanation": "Elevated risk due to Mars-Saturn square..."
  },
  "panchang": {
    "tithi_num": 10, "tithi_name": "Dashami", "paksha": "Shukla",
    "nakshatra_name": "Rohini", "nakshatra_pada": 3,
    "yoga_name": "Siddha", "vara": "Guru",
    "dlnl_match": true, "is_sankranti": false,
    "sunrise": "06:42"
  },
  "planets": [
    {"planet": "Sun", "longitude": 326.42, "sign": "Aquarius", "nakshatra": "Shatabhisha", "retrograde": false},
    {"planet": "Mercury", "longitude": 318.11, "sign": "Aquarius", "nakshatra": "Dhanishtha", "retrograde": true},
    ...
  ],
  "aspects": [
    {"planet_1": "Mars", "planet_2": "Saturn", "aspect_type": "square", "orb": 0.8, "exact": true}
  ],
  "events": [
    {"event_type": "retrograde_start", "planet": "Mercury", "severity": "high", "day_number": 12, "total_days": 21}
  ],
  "signals": {
    "net_score": 2.4,
    "classification": "mildly_bullish",
    "fired_count": 5,
    "total_rules": 18,
    "rules": [
      {"code": "DLNL_001", "name": "Day Lord = Nakshatra Lord", "signal": "bullish", "strength": 3},
      {"code": "ASP_001", "name": "Mars-Saturn Square", "signal": "bearish", "strength": 4}
    ]
  },
  "sectors": [
    {"sector": "Banking", "volatility_multiplier": 1.3, "direction": "bearish"},
    {"sector": "IT", "volatility_multiplier": 1.5, "direction": "bearish"}
  ],
  "outlook": [
    {"date": "2026-02-15", "score": 67, "regime": "distribution"},
    {"date": "2026-02-16", "score": 58, "regime": "expansion"},
    ...
  ],
  "market": {
    "close": 22456.80, "prev_close": 22521.35,
    "change": -64.55, "pct_change": -0.29,
    "high": 22589.10, "low": 22401.50,
    "w52_high": 24150.00, "w52_low": 19500.00
  }
}
```

**Why JSONB?**: One row, one read, one response. No joins. Postgres JSONB is indexed and fast. The snapshot is pre-computed — no runtime aggregation needed.

---

#### Step 0.2 — Snapshot Generator (Python)

**File**: `App/backend/snapshot_generator.py`

**Purpose**: Run after the daily pipeline completes — reads from all computed tables, builds the JSON blob, upserts to `km_daily_snapshots`.

**Logic**:
```
for each symbol in [NIFTY, BANKNIFTY, NIFTYIT, NIFTYFMCG]:
  for each date in [today, today+1, ..., today+6]:  # 7-day outlook window
    risk   = SELECT * FROM km_risk_scores WHERE date=D AND symbol=S
    panch  = SELECT * FROM km_daily_panchang WHERE date=D
    planets = SELECT * FROM km_planetary_positions WHERE date=D
    aspects = SELECT * FROM km_planetary_aspects WHERE date=D
    events = SELECT * FROM km_astro_events WHERE event_date=D
    signals = SELECT rs.*, r.* FROM km_rule_signals rs JOIN km_rules r ON ...
    sectors = SELECT * FROM km_sector_sensitivity WHERE ...
    market = SELECT * FROM km_index_eod WHERE trade_date=D AND index_id=...
    explanation = generate_explanation(risk, panch, events)  # template-based or Gemini

    snapshot = build_snapshot_json(risk, panch, planets, aspects, events, signals, sectors, market)
    UPSERT INTO km_daily_snapshots (date, symbol, snapshot) VALUES (D, S, snapshot)
```

**Runs**: Daily at 7:30 AM IST (after ephemeris + risk engine pipeline completes)
**For 4 symbols × 7 days = 28 snapshots generated per run** (takes ~30 seconds)
**Backfill**: Can run historically to pre-generate snapshots for all past dates

**Explanation Generation** (embedded in snapshot, not runtime Gemini call):
- **Template-based first**: "Elevated risk ({score}) driven primarily by {top_factor}. {regime_description}. {notable_event_if_any}."
- **Gemini enhancement (optional)**: For today's snapshot only, call Gemini to polish the explanation
- **Stored in snapshot**: The explanation is cached — no per-user Gemini API calls

---

#### Step 0.3 — Supabase Edge Functions (API Layer)

**Directory**: `App/supabase/functions/`

**Purpose**: Thin Deno-based edge functions that serve snapshots with in-memory caching. These are the ONLY endpoints the frontend calls for Dashboard data.

**Edge Function 1: `api/snapshot`**
```typescript
// supabase/functions/snapshot/index.ts
// GET /api/snapshot?date=2026-02-15&symbol=NIFTY

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const symbol = url.searchParams.get('symbol') || 'NIFTY';

  const cacheKey = `${date}:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    });
  }

  // One DB query — returns the pre-computed snapshot
  const { data, error } = await supabase
    .from('km_daily_snapshots')
    .select('snapshot')
    .eq('date', date)
    .eq('symbol', symbol)
    .single();

  if (data) {
    cache.set(cacheKey, { data: data.snapshot, expires: Date.now() + CACHE_TTL });
  }

  return new Response(JSON.stringify(data?.snapshot || null), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  });
});
```

**Edge Function 2: `api/calendar`**
```typescript
// GET /api/calendar?year=2026&month=2&symbol=NIFTY
// Returns 28-31 mini-snapshots for the entire month (for CalendarView)
// Cached per month — month data is immutable for past months

const { data } = await supabase
  .from('km_daily_snapshots')
  .select('date, snapshot->risk->composite_score, snapshot->risk->regime, snapshot->panchang')
  .eq('symbol', symbol)
  .gte('date', monthStart)
  .lte('date', monthEnd);
```

**Edge Function 3: `api/eod-chart`**
```typescript
// GET /api/eod-chart?symbol=NIFTY&from=2025-01-01&to=2026-02-15
// Returns paginated EOD data for charts (replaces .range(0, 9999))
// Downsamples to max 500 points server-side for chart performance

const { data } = await supabase
  .from('km_index_eod')
  .select('trade_date, open, high, low, close, volume')
  .eq('index_id', indexId)
  .gte('trade_date', from)
  .lte('trade_date', to)
  .order('trade_date', { ascending: true });

// Downsample if > 500 rows (LTTB algorithm or simple every-nth)
return downsample(data, 500);
```

**Edge Function 4: `api/proofs`**
```typescript
// GET /api/proofs?symbol=NIFTY&regime=capital_protection&limit=20
// Returns historical accuracy proofs (pre-computed, cached 1hr)
// Joins risk_scores + km_index_eod — expensive but cached

// Cache for 1 hour — proofs don't change until new data comes in
```

**Deployment**: `supabase functions deploy snapshot calendar eod-chart proofs`

---

#### Step 0.4 — Database Index Optimizations

**File**: `App/DBscripts/km_scale_indexes.sql`

Add missing compound indexes identified during the scale audit:

```sql
-- CRITICAL: km_index_eod queries almost always filter by (index_id, trade_date)
-- Current: separate indexes on each column → sequential scan for combined queries
-- Fix: compound index for the most common access pattern
CREATE INDEX IF NOT EXISTS idx_index_eod_compound
  ON km_index_eod (index_id, trade_date DESC);

-- Same for equities
CREATE INDEX IF NOT EXISTS idx_equity_eod_compound
  ON km_equity_eod (equity_id, trade_date DESC);

-- Snapshot lookups (primary access path for frontend)
-- Already covered by UNIQUE(date, symbol), but add explicit for clarity
-- The UNIQUE constraint creates an implicit index

-- Calendar view: month-range queries on snapshots
CREATE INDEX IF NOT EXISTS idx_snapshots_month
  ON km_daily_snapshots (symbol, date);
```

**Drop redundant indexes** (the compound index subsumes the single-column index):
```sql
-- After verifying compound index is used by query planner:
-- DROP INDEX IF EXISTS idx_index_eod_index;  -- subsumed by compound
-- DROP INDEX IF EXISTS idx_equity_eod_equity; -- subsumed by compound
```

---

#### Step 0.5 — Security Hardening

**Critical fixes before any user sees the app**:

1. **Remove service key from frontend `.env`**:
   ```
   # App/frontend/.env
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   # DELETE: VITE_SUPABASE_SERVICE_KEY (MUST NOT be in frontend code)
   ```
   - Service key lives ONLY in backend `.env` and Supabase Edge Function secrets
   - Run `git log --all -p -- '*.env'` to check if it was ever committed — if so, rotate the key

2. **Lock down rule tables** (currently any authenticated user can INSERT/UPDATE/DELETE):
   ```sql
   -- App/DBscripts/km_rule_security.sql
   DROP POLICY IF EXISTS "allow_insert_rules" ON km_rules;
   DROP POLICY IF EXISTS "allow_update_rules" ON km_rules;
   DROP POLICY IF EXISTS "allow_delete_rules" ON km_rules;

   CREATE POLICY "admin_write_rules" ON km_rules
     FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

   -- Same for km_rule_signals and km_candidate_rules
   ```

3. **Rate limiting on Edge Functions**:
   ```typescript
   // Simple per-IP rate limiter in edge functions
   const RATE_LIMIT = 60; // requests per minute per IP
   const rateLimiter = new Map<string, { count: number; resetAt: number }>();
   ```

4. **CORS configuration**:
   ```typescript
   // Edge functions only accept requests from our domain
   const ALLOWED_ORIGINS = ['https://kaaladristi.com', 'http://localhost:5173'];
   ```

---

#### Step 0.6 — Frontend Caching Strategy (React Query Tuning)

Update all hooks to work with Edge Functions and optimize cache times for scale:

| Data Type | Source | staleTime | gcTime | Refetch |
|-----------|--------|-----------|--------|---------|
| **Daily Snapshot** | Edge: `/api/snapshot` | 5 min | 30 min | On window focus |
| **Calendar Month** | Edge: `/api/calendar` | 30 min | 2 hours | Never (immutable past) |
| **EOD Chart** | Edge: `/api/eod-chart` | 10 min | 30 min | On range change |
| **Master Data** | Direct Supabase | 1 hour | Infinity | Once per session |
| **Historical Proofs** | Edge: `/api/proofs` | 1 hour | 2 hours | Never |
| **User Profile** | Direct Supabase | 5 min | 30 min | On auth change |

**Key changes from current**:
- EOD: Replace `.range(0, 9999)` with Edge Function that paginates by date range
- Risk/Panchang/Signals: All from snapshot (1 fetch, not 6)
- Calendar: Batch fetch for entire month (not per-day queries)
- Debounce symbol/date changes: 300ms debounce before fetching

---

#### Step 0.7 — Supabase Connection Pooler (Supavisor)

Enable Supabase's built-in connection pooler for burst traffic:

- **Supabase Dashboard** → Settings → Database → Connection Pooling → Enable
- **Mode**: Transaction mode (recommended for serverless/edge functions)
- **Pool size**: Default (Supabase manages based on plan)
- **Edge functions**: Use the pooler connection string (port 6543) instead of direct (port 5432)
- **Frontend (REST API)**: Already pooled by Supabase's PostgREST — no change needed

---

**Phase 0 Exit Criteria**:
- [ ] `km_daily_snapshots` table created with RLS
- [ ] `snapshot_generator.py` generates snapshots for all 4 symbols × 7 days
- [ ] Edge Function `/api/snapshot` serves cached snapshots with <100ms response
- [ ] Edge Function `/api/calendar` serves month data
- [ ] Edge Function `/api/eod-chart` serves paginated + downsampled EOD data
- [ ] Edge Function `/api/proofs` serves cached historical accuracy
- [ ] Compound indexes added to `km_index_eod` and `km_equity_eod`
- [ ] Service key removed from frontend `.env`
- [ ] Rule tables locked to admin-only writes
- [ ] Rate limiting active on edge functions
- [ ] React Query hooks updated for edge function endpoints
- [ ] Load test: 100 concurrent requests to `/api/snapshot` → all return <200ms

---

## UI/UX PHASE 1: DATA CONNECTION LAYER
### "Swap mock for real — make the dashboard breathe real data"

**Goal**: Replace all mock/seeded data services with real data from Edge Functions + snapshots. The frontend already renders beautifully — it just needs real numbers from the pre-computed snapshot.

**Depends On**: Phase 0 (Edge Functions deployed) + Engine Phase 1 (ephemeris/panchang populated) + Engine Phase 3 (risk_scores populated) + Snapshot generator running

**Key Principle**: The frontend makes ONE fetch to `/api/snapshot` and gets EVERYTHING the Dashboard needs. No multiple Supabase queries. No direct table access for Dashboard data.

#### Step 1.1 — Snapshot Service + Hook

**New file**: `services/snapshotService.ts`
```typescript
// Single fetch that powers the entire Dashboard
export async function fetchDailySnapshot(date: string, symbol: string): Promise<DailySnapshot> {
  const res = await fetch(`${EDGE_URL}/api/snapshot?date=${date}&symbol=${symbol}`);
  return res.json();
}
```

**New file**: `hooks/useSnapshot.ts`
```typescript
export function useSnapshot(date: string, symbol: string) {
  return useQuery({
    queryKey: ['snapshot', date, symbol],
    queryFn: () => fetchDailySnapshot(date, symbol),
    staleTime: 5 * 60 * 1000,  // 5 min
    gcTime: 30 * 60 * 1000,     // 30 min
  });
}
```

**Derived hooks** (zero additional fetches — all extract from the snapshot):
```typescript
export function useRiskFromSnapshot(date: string, symbol: string) {
  const { data } = useSnapshot(date, symbol);
  return data?.risk;  // { composite_score, regime, structural, momentum, volatility, deception, explanation }
}

export function usePanchangFromSnapshot(date: string, symbol: string) {
  const { data } = useSnapshot(date, symbol);
  return data?.panchang;
}

export function useSignalsFromSnapshot(date: string, symbol: string) {
  const { data } = useSnapshot(date, symbol);
  return data?.signals;
}

// etc. for planets, aspects, events, sectors, outlook, market
```

#### Step 1.2 — Replace Mock Risk Data
- **File**: `services/riskData.ts`
- **Current**: Returns seeded random data via `seededRandom()`
- **Replace**: `fetchDayRisk()` → `useRiskFromSnapshot()` (from snapshot)
- **Replace**: `fetchWeekRisk()` → `data.outlook` (7-day array already in snapshot)
- **Replace**: `fetchHistoricalProofs()` → `fetch('/api/proofs?symbol=X')` (edge function)
- **Keep**: `riskData.mock.ts` for offline/dev mode
- **Verification**:
  - [ ] Dashboard loads with real risk score for today's date
  - [ ] Factor breakdown (4 dimensions) matches engine-computed values
  - [ ] 7-day outlook shows next 7 days from snapshot
  - [ ] Loading states (Skeleton) display during fetch
  - [ ] Error states display on fetch failure

#### Step 1.3 — Replace Mock Panchang/Planetary/Signal Data
- All data comes from the SAME snapshot blob — no new services needed
- **DashboardView**: Extract `snapshot.panchang`, `snapshot.planets`, `snapshot.signals`, `snapshot.sectors` from the single `useSnapshot()` hook
- **Zero additional network requests** — this is the power of pre-computed snapshots

#### Step 1.4 — Connect EOD Chart to Edge Function
- **File**: `services/eodData.ts`
- **Current**: `supabase.from('km_index_eod').select('*').range(0, 9999)`
- **Replace**: `fetch('/api/eod-chart?symbol=X&from=Y&to=Z')`
- **Benefits**:
  - Server-side downsampling (max 500 points) → faster chart rendering
  - Date-range pagination instead of row-count pagination
  - Cached at edge for repeated queries
- **Debounce**: 300ms debounce on time range / symbol changes

#### Step 1.5 — Connect Explanation (Pre-generated, not Runtime)
- **Current plan was**: Call Gemini API per user per render
- **New plan**: Explanation is **pre-generated** in the snapshot by `snapshot_generator.py`
- **Template**: "Today's risk score is {score} ({regime}). {top_factor_explanation}. {notable_event}."
- **Gemini polish**: Optional — run once during snapshot generation, not per-user
- **Result**: `snapshot.risk.explanation` — already a string, zero API calls at render time
- **Scale impact**: 0 Gemini API calls vs 2000 calls/day (massive cost saving)

#### Step 1.6 — Dev Mode Toggle (Mock vs Real)
- **Config**: `VITE_DATA_MODE=snapshot|mock` in `.env`
- **When `mock`**: Use existing seeded random data (for frontend dev without backend)
- **When `snapshot`**: Use edge functions (production mode)
- **Implementation**: Service factory pattern — `getDataService()` returns mock or real based on config

**Phase 1 Exit Criteria**:
- All mock data replaced with snapshot-powered data
- Dashboard loads from ONE edge function call (< 200ms)
- EOD chart uses edge function with server-side downsampling
- Explanation is pre-generated (no per-user Gemini calls)
- Dev mode toggle works for offline development
- No regressions — existing UI renders identically with real data
- **Load verified**: 100 simulated users → all get <2s Dashboard load

---

## UI/UX PHASE 2: DASHBOARD ENHANCEMENTS
### "The command center — everything a trader needs at a glance"

**Goal**: Enhance the existing Dashboard with richer data sections, better information density, and new intelligence panels.

#### Step 2.1 — Panchang Summary Strip
- **Location**: Top of Dashboard, below the SymbolSwitcher
- **Layout**: Horizontal strip with 6-7 compact data cells
- **Content**:
  ```
  ┌─────────┬───────────┬────────────┬──────────┬──────────┬──────────┬──────────┐
  │ Tithi   │ Nakshatra │ Yoga       │ Vara     │ DLNL     │ Sunrise  │ Sankranti│
  │ Shukla  │ Rohini    │ Siddha     │ Guru-vār │ ✓ Match  │ 06:42    │ —        │
  │ Dashami │ (Moon)    │ (Auspicious)│ Thursday │          │          │          │
  └─────────┴───────────┴────────────┴──────────┴──────────┴──────────┴──────────┘
  ```
- **Styling**: Glass card, mono font for values, secondary text for labels
- **Interaction**: Tooltip on each cell explaining the panchang element
- **DLNL highlight**: When DLNL=1, the cell glows gold with `pulse-live` animation

#### Step 2.2 — Active Planetary Events Banner
- **Location**: Below Panchang strip (only shown when events are active)
- **Content**: Active retrogrades, major aspects, sign changes happening today
- **Examples**:
  ```
  ⚠ Mercury Retrograde (Day 12 of 21) · Mars □ Saturn (exact today) · Moon entering Gandanta
  ```
- **Styling**: Subtle amber/red border based on severity
- **Data**: From `astro_events` + `planetary_aspects` where date = today
- **Collapse**: Auto-hide when no notable events active

#### Step 2.3 — Signal Intelligence Panel
- **Location**: New section below Factor Cards
- **Layout**: Card with two columns
- **Left column — Net Signal Meter**:
  ```
  ┌────────────────────────────────────┐
  │ Daily Signal Score                 │
  │                                    │
  │  ◄━━━━━━━━━━●━━━━━━━━━━━━━━━━━►  │
  │  -5   Bearish   0   Bullish   +5  │
  │                                    │
  │  Net Score: +2.4 (Bullish)         │
  │  Active Rules: 5 of 18 fired       │
  └────────────────────────────────────┘
  ```
- **Right column — Fired Rules List**:
  ```
  ┌────────────────────────────────────┐
  │ Rules Fired Today                  │
  │                                    │
  │ ▲ DLNL Match (Strength: 3)        │
  │ ▲ MSV Active (Strength: 2)        │
  │ ▼ Mars-Saturn Square (Strength: 4)│
  │ ▲ Yoga: Siddha (Strength: 1)      │
  │ ▼ Moon in Ashlesha (Strength: 2)  │
  └────────────────────────────────────┘
  ```
- **Color coding**: ▲ green for bullish signals, ▼ red for bearish signals
- **Interaction**: Click a rule to see its historical accuracy in a tooltip/modal

#### Step 2.4 — Enhanced Sector Sensitivity Heatmap
- **Current**: Simple horizontal progress bars
- **Enhanced**:
  - Grid layout: 4 columns × N rows
  - Each cell: sector name + impact bar + direction arrow
  - Color intensity proportional to impact magnitude
  - Sort by impact (strongest first)
  - Tooltip: "Banking sector sees 1.3x volatility during Mercury Retrograde periods"
- **Data**: From `sector_sensitivity` table (real data)

#### Step 2.5 — Historical Proof Enhancement
- **Current**: Horizontal scroll cards showing past dates
- **Enhanced**:
  - Add a small inline accuracy chart (last 30 high-risk predictions → hit/miss)
  - Show rolling accuracy percentage: "73% of Capital Protection days saw >1% decline"
  - Color-code each proof card: green border if prediction was correct, red if not
  - Add "Similar day" matching: "Today's profile is similar to 14-Mar-2023 (score: 72, actual: -2.1%)"

#### Step 2.6 — Dashboard Layout Refinement
- **Current layout** (single column, stacked):
  ```
  [Symbol Switcher]
  [Risk Gauge Hero + Regime + Explanation]
  [4 Factor Cards in 2x2 grid]
  [7-Day Outlook Bar Chart]
  [Sector Sensitivity Bars]
  [Historical Proof Cards]
  ```
- **Enhanced layout** (information-dense, 2-column on desktop):
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ [Symbol Switcher]                     [Date Picker]          │
  ├──────────────────────────────────────────────────────────────┤
  │ [Panchang Strip — full width]                                │
  ├──────────────────────────────────────────────────────────────┤
  │ [Planetary Events Banner — conditional]                      │
  ├────────────────────────────────┬─────────────────────────────┤
  │                                │                             │
  │  Risk Gauge (Hero)             │  AI Explanation              │
  │  Score: 67                     │  "Today carries elevated     │
  │  Regime: Distribution          │   risk due to Mars-Saturn    │
  │                                │   square and Moon entering   │
  │  [4 Factor Mini-Gauges]        │   Gandanta zone..."          │
  │  STR: 18  MOM: 15             │                             │
  │  VOL: 20  DEC: 14             │  [Signal Intelligence Panel] │
  │                                │  Net: +2.4 Bullish           │
  │                                │  5 rules fired               │
  ├────────────────────────────────┴─────────────────────────────┤
  │ [7-Day Outlook]                    [Sector Heatmap]          │
  ├──────────────────────────────────────────────────────────────┤
  │ [Historical Proof Cards — scrollable]                        │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Responsive**: Collapses to single column on mobile (< 768px)

#### Step 2.7 — Date Navigation
- **Add date picker** to Dashboard header (next to Symbol Switcher)
- **Controls**: Previous day / Next day arrows + calendar dropdown
- **Constraint**: Only allow dates that exist in `risk_scores` table
- **Default**: Today's date (from `appStore.selectedDate`)
- **URL sync**: `/dashboard?date=2026-02-15&symbol=NIFTY` for shareable links

**Phase 2 Exit Criteria**:
- Panchang strip displays real data
- Planetary events banner shows active retrogrades/aspects
- Signal panel shows fired rules with net score
- Sector heatmap uses real data
- Historical proofs show accuracy metrics
- Date navigation works with URL sync
- Layout is information-dense on desktop, clean on mobile

---

## UI/UX PHASE 3: CALENDAR VIEW
### "See risk across time — the astro-financial almanac"

**Goal**: Build the Calendar view — a monthly grid where each day shows its risk score, panchang summary, and notable events. Think of it as a financial Panchang.

**Depends On**: Engine Phase 1 (panchang) + Phase 3 (risk scores)

#### Step 3.1 — Monthly Grid Layout
- **File**: `views/CalendarView.tsx` (replace stub)
- **Structure**:
  ```
  ┌──────────────────────────────────────────────────────────┐
  │  ◄  February 2026  ►           [Month] [Week] [Symbol]  │
  ├──────┬──────┬──────┬──────┬──────┬──────┬──────┤
  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun  │
  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
  │      │      │      │      │      │      │  1   │
  │      │      │      │      │      │      │ ●42  │
  │      │      │      │      │      │      │ Rohini│
  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
  │  2   │  3   │  4   │  5   │  6   │  7   │  8   │
  │ ●38  │ ●45  │ ●52  │ ●71⚠│ ●68  │      │      │
  │ Mrgsh│ Ardra│ Punrv│ Pushya│Ashle│      │      │
  │      │      │ ☿℞   │ ♂□♄ │      │      │      │
  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
  │ ...                                              │
  └──────────────────────────────────────────────────────────┘
  ```

#### Step 3.2 — Day Cell Design
- **Each calendar cell contains**:
  - **Date number** (top-left)
  - **Risk score dot** (color-coded: green/amber/red, size proportional to score)
  - **Moon nakshatra** (abbreviated, bottom)
  - **Event icons** (if any):
    - ☿℞ = Mercury Retrograde
    - ♂□♄ = Mars-Saturn square
    - 🔴 = Gandanta
    - ⭐ = DLNL match
    - ◉ = Sankranti
  - **Weekend/holiday**: Dimmed background (non-trading days have no risk score)
- **Cell background**: Very subtle gradient based on risk score (barely tinted green → amber → red)
- **Hover**: Expand to show full details tooltip
- **Click**: Navigate to Dashboard for that date

#### Step 3.3 — Day Detail Panel (Side Panel or Modal)
- **Triggered by**: Clicking a calendar day
- **Content**:
  ```
  ┌─────────────────────────────────┐
  │ Thursday, 5 Feb 2026            │
  │                                 │
  │ Risk Score: 71 (Cap. Protection)│
  │ [Mini Risk Gauge]               │
  │                                 │
  │ ── Panchang ──                  │
  │ Tithi: Shukla Ashtami           │
  │ Nakshatra: Pushya               │
  │ Yoga: Vyatipata                 │
  │ Vara: Guru-vār                  │
  │ DLNL: No match                  │
  │ Sunrise: 06:58 IST              │
  │                                 │
  │ ── Planetary Events ──          │
  │ • Mars □ Saturn (exact)         │
  │ • Mercury Retrograde (Day 8)    │
  │                                 │
  │ ── Signals ──                   │
  │ Net: -3.2 (Bearish)             │
  │ 4 rules fired                   │
  │                                 │
  │ [View Full Dashboard →]         │
  └─────────────────────────────────┘
  ```

#### Step 3.4 — Week View Toggle
- **Alternative layout**: 7 columns but only 1 row (current week)
- **More space per day**: Shows full panchang + planet positions + fired rules
- **Useful for**: Week-ahead planning (Sunday evening ritual)

#### Step 3.5 — Risk Heatmap Overlay
- **Toggle**: "Show Risk Heatmap" button
- **Effect**: Calendar cells become a pure heatmap — background color intensity = risk score
- **Legend**: Color bar at bottom (0 green → 50 amber → 100 red)
- **Purpose**: Quickly spot high-risk clusters (e.g., "next week looks rough")

#### Step 3.6 — Calendar Data Fetching (via Edge Function)
- **Source**: Edge Function `/api/calendar?year=2026&month=2&symbol=NIFTY`
- **Returns**: Array of mini-snapshots (score, regime, panchang summary) for all days in the month
- **Scale benefit**: One edge function call per month, cached for 30 min — 2000 users = 1 DB query
- **Hook**: `useCalendarMonth(year, month, symbol)` — single hook for all calendar data
  ```typescript
  useQuery({
    queryKey: ['calendar', year, month, symbol],
    queryFn: () => fetchCalendarMonth(year, month, symbol),
    staleTime: 30 * 60 * 1000,   // 30 min (past months never change)
    gcTime: 2 * 60 * 60 * 1000,  // 2 hours
  })
  ```
- **Prefetch**: When user navigates to a month, prefetch prev + next month in background
- **Past months**: Cache indefinitely (immutable — yesterday's panchang never changes)
- **Current month**: Cache 30 min (today's snapshot may update)

**Phase 3 Exit Criteria**:
- Monthly calendar grid renders with risk scores and panchang data
- Day cells show risk dot, nakshatra, and event icons
- Click opens detailed day panel
- Week view toggle works
- Risk heatmap overlay shows score intensity
- Smooth month navigation with data prefetching
- **Scale verified**: Month load from cache in <100ms

---

## UI/UX PHASE 4: TRANSMISSION VIEW
### "See HOW risk flows — from planets to sectors to your portfolio"

**Goal**: Build a visual flow diagram showing how planetary factors transmit risk through sectors to market indices. This is the "explainability" layer — users see WHY the score is what it is.

**Depends On**: Engine Phase 2 (correlations) + Phase 3 (risk scores) + Phase 4 (signals)

#### Step 4.1 — Three-Column Flow Layout
- **File**: `views/TransmissionView.tsx` (replace stub)
- **Structure**:
  ```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Risk Transmission Flow — 15 Feb 2026 — NIFTY 50                    │
  ├──────────────────┬────────────────────┬──────────────────────────────┤
  │   FACTORS        │   SECTORS          │   INDEX IMPACT              │
  │                  │                    │                              │
  │ ┌──────────┐     │  ┌──────────┐     │                              │
  │ │☿ Mercury │─────┼─→│ Banking  │─────┼──┐                          │
  │ │Retrograde│     │  │ 1.3x vol │     │  │                          │
  │ │ +8pts    │     │  └──────────┘     │  │   ┌───────────────────┐  │
  │ └──────────┘     │                    │  ├──→│ NIFTY 50          │  │
  │                  │  ┌──────────┐     │  │   │ Score: 67         │  │
  │ ┌──────────┐     │  │ IT       │─────┼──┤   │ Regime: Distrib.  │  │
  │ │♂□♄ Mars- │─────┼─→│ 1.5x vol │     │  │   │ [Risk Gauge]      │  │
  │ │Saturn Sq │     │  └──────────┘     │  │   └───────────────────┘  │
  │ │ +10pts   │     │                    │  │                          │
  │ └──────────┘     │  ┌──────────┐     │  │                          │
  │                  │  │ Pharma   │─────┼──┘                          │
  │ ┌──────────┐     │  │ 0.8x vol │     │                              │
  │ │☽ Moon in │─────┼─→└──────────┘     │                              │
  │ │ Gandanta │     │                    │                              │
  │ │ +6pts    │     │  ┌──────────┐     │                              │
  │ └──────────┘     │  │ Auto     │     │                              │
  │                  │  │ 1.1x vol │     │                              │
  │ ┌──────────┐     │  └──────────┘     │                              │
  │ │ DLNL     │     │                    │                              │
  │ │ Match    │     │  (+ 8 more        │                              │
  │ │ -3pts    │     │   sectors...)      │                              │
  │ └──────────┘     │                    │                              │
  ├──────────────────┴────────────────────┴──────────────────────────────┤
  │ Factor legend: Hover any node for details. Line thickness = impact  │
  └──────────────────────────────────────────────────────────────────────┘
  ```

#### Step 4.2 — Factor Nodes (Left Column)
- **Data source**: `snapshot.risk` (factor breakdown) + `snapshot.events` + `snapshot.aspects` — ALL from the same snapshot, zero extra queries
- **Each node shows**:
  - Planet icon/glyph
  - Factor name (e.g., "Mercury Retrograde")
  - Point contribution to composite score
  - Which risk dimension it belongs to (Structural/Momentum/Volatility/Deception)
- **Color**: Matches dimension color
- **Only show active factors**: Don't show factors contributing 0 points

#### Step 4.3 — Sector Nodes (Middle Column)
- **Data source**: `snapshot.sectors` + `km_sector_lords` (master data, cached forever)
- **Each node shows**:
  - Sector name
  - Volatility multiplier (e.g., "1.3x")
  - Ruling planet(s)
  - Direction indicator (more bearish / more volatile)
- **Connection lines**: From factor → sector based on planet lordship
  - E.g., Mercury Retrograde → Banking (Mercury rules Virgo → Banking sector lord is Mercury)
- **Sort**: By impact magnitude (most affected sectors first)

#### Step 4.4 — Index Impact (Right Column)
- **Data source**: `snapshot.risk` composite + `snapshot.market`
- **Shows**: Summary risk gauge + regime badge + score breakdown
- **Connection lines**: From all sectors → index (weighted by sector weight in index)
- **NIFTY composition**: Use `km_index_composition` to weight sector contributions

#### Step 4.5 — Interactive Connections
- **SVG/Canvas connections**: Animated flowing lines between columns
- **Line thickness**: Proportional to impact magnitude
- **Line color**: Risk color (green → amber → red based on contribution)
- **Hover factor**: Highlight only sectors connected to that factor
- **Hover sector**: Highlight its ruling planet(s) and its index contribution
- **Animation**: Lines gently pulse to show "flow" direction (left → right)

#### Step 4.6 — Alternate: Sankey Diagram
- **If three-column is too complex**: Use a Sankey diagram
- **Library option**: `recharts` doesn't have Sankey — consider `d3-sankey` or `@nivo/sankey`
- **Same data flow**: Factors → Sectors → Index
- **Advantage**: Natural flow visualization with proportional widths
- **Decision**: Evaluate during implementation — start with three-column, upgrade to Sankey if needed

**Phase 4 Exit Criteria**:
- Three-column flow diagram renders with real data
- Factor nodes show active contributors only
- Sector nodes show sensitivity from Supabase
- Connection lines animate and respond to hover
- Users can trace "why is the score high?" visually
- Works on desktop (1200px+); simplified view on tablet

---

## UI/UX PHASE 5: BACKTEST VIEW
### "Show me the receipts — historical accuracy and validation"

**Goal**: Build the Backtest view showing how well the engine predicted market movements historically. Build confidence through transparency.

**Depends On**: Engine Phase 6 (backtesting completed)

#### Step 5.1 — Accuracy Dashboard
- **File**: `views/BacktestView.tsx` (replace stub)
- **Top-level metrics cards**:
  ```
  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
  │ Overall    │ │ Cap.Protect│ │ Crash      │ │ Active     │
  │ Accuracy   │ │ Hit Rate   │ │ Detection  │ │ Rules      │
  │            │ │            │ │            │ │            │
  │ 54.2%      │ │ 73%        │ │ 8/11       │ │ 24         │
  │ ▲ +5.3pp   │ │ score>70   │ │ major      │ │ of 36      │
  │ vs random  │ │ days       │ │ crashes    │ │ discovered │
  └────────────┘ └────────────┘ └────────────┘ └────────────┘
  ```

#### Step 5.2 — Regime Performance Table
- **The key validation table** from Engine Phase 3 Step 3.3:
  ```
  REGIME              │ DAYS  │ AVG RETURN │ DOWN%  │ AVG RANGE │ WORST DAY
  ────────────────────┼───────┼───────────┼────────┼──────────┼──────────
  Accumulation        │ 2,847 │ +0.05%    │ 46.8%  │ 1.21%    │ -3.1%
  Expansion           │ 1,523 │ +0.02%    │ 49.1%  │ 1.48%    │ -4.2%
  Distribution        │ 1,089 │ -0.03%    │ 53.4%  │ 1.82%    │ -5.8%
  Capital Protection  │   312 │ -0.08%    │ 58.0%  │ 2.51%    │ -12.1%
  ```
- **Visual**: Colored rows matching regime colors
- **Monotonicity indicators**: ✓ checkmarks if each metric increases/decreases as expected

#### Step 5.3 — Score vs Return Scatter Plot
- **Chart type**: Scatter plot (Recharts ScatterChart)
- **X-axis**: Risk Score (0-100)
- **Y-axis**: Actual NIFTY return (%)
- **Points**: One per trading day (downsampled to ~2,000 for performance)
- **Color**: Risk color (green/amber/red) based on score
- **Trend line**: Overlay showing negative correlation (higher score → lower return)
- **Interactive**: Hover a point to see date + score + return
- **Time filter**: Dropdown to filter by year range (1996-2000, 2001-2010, 2011-2020, 2021-2026)

#### Step 5.4 — Notable Events Timeline
- **Layout**: Horizontal timeline with markers
- **Events**: Major crashes + their risk scores
  ```
  ──●────────●──────●─────────────────●──────●────────●──►
   2004     2008    2008             2016    2020    2022
   Election Lehman  Bottom           DeMo    COVID   Ukraine
   Shock    Crisis  Recovery                 Crash   War
   Score:52 Score:81 Score:34         Score:45 Score:72 Score:61
   ✓        ✓       ✓                ✗       ✓       ✓
  ```
- **Each event card** (on hover/click): Date, event name, risk score, regime, actual market move, hit/miss
- **Purpose**: "Did we see it coming?"

#### Step 5.5 — 2D Accuracy Matrix (Risk × Signal)
- **The cross-tabulation heatmap** from Engine Phase 6 Step 6.2:
  ```
                    │ Super Bull │ Bullish │ Neutral │ Bearish │ Super Bear │
  ──────────────────┼───────────┼─────────┼─────────┼─────────┼────────────┤
  Accumulation      │  45% dn   │ 47% dn  │ 49% dn  │ 51% dn  │  54% dn   │
  Expansion         │  47% dn   │ 49% dn  │ 51% dn  │ 53% dn  │  56% dn   │
  Distribution      │  49% dn   │ 51% dn  │ 53% dn  │ 55% dn  │  59% dn   │
  Capital Protect   │  52% dn   │ 54% dn  │ 57% dn  │ 60% dn  │  65% dn   │
  ```
- **Cell coloring**: Green (low down%) → Red (high down%) — intensity gradient
- **Interactive**: Click a cell to see the specific days that fall in that bucket

#### Step 5.6 — Rolling Accuracy Chart
- **Chart type**: Line chart (Recharts LineChart)
- **X-axis**: Time (monthly rolling windows)
- **Y-axis**: Accuracy % (rolling 90-day window)
- **Lines**: Overall accuracy + per-regime accuracy
- **Purpose**: Show whether accuracy is consistent or varies over time
- **Bands**: Shade the 50% baseline — everything above = beating random

#### Step 5.7 — Rule Performance Table
- **Sortable data table** with columns:
  - Rule name, source (given/discovered), fire count, signal direction
  - Accuracy %, lift vs baseline, z-score, significance level
- **Filters**: By category (DLNL, Aspect, Panchang, etc.), by significance level
- **Sort**: Default by z-score descending
- **Row click**: Expand to show rule details + condition tree

**Phase 5 Exit Criteria**:
- Accuracy dashboard renders with real backtest results
- Regime performance table shows monotonic relationship
- Scatter plot displays score vs return correlation
- Notable events timeline shows major crashes
- 2D matrix heatmap is interactive
- Rolling accuracy chart shows consistency over time
- Rule performance table is sortable and filterable

---

## UI/UX PHASE 6: MARKETS VIEW ENHANCEMENTS
### "Price charts with planetary overlays"

**Goal**: Enhance the existing Markets view with planetary event overlays on price charts. Let users see when retrogrades, aspects, and high-risk periods overlap with price action.

**Current State**: Working area chart with EOD prices, time range selector, basic stats.

#### Step 6.1 — Risk Score Overlay
- **Add secondary Y-axis** to existing chart (right side)
- **Line**: Risk score as a line (stepped or smooth) behind the price area
- **Color**: The line color changes with risk level (green/amber/red segments)
- **Toggle**: Checkbox "Show Risk Score" — off by default to keep chart clean

#### Step 6.2 — Event Markers on Chart
- **Vertical lines/bands** on the price chart for planetary events:
  - **Mercury Retrograde periods**: Subtle red-tinted vertical bands
  - **Mars-Saturn aspects**: Vertical dashed line at exact date
  - **Gandanta days**: Small diamond markers on the date axis
  - **Sankranti**: Small circle markers
- **Legend**: Toggle each event type on/off
- **Tooltip**: Hover on a marker to see "Mercury Retrograde begins (21 days)"

#### Step 6.3 — Regime Background Shading
- **Behind the price chart area**: Subtle background tint per regime
  - Accumulation = very faint green
  - Expansion = very faint amber
  - Distribution = faint amber
  - Capital Protection = faint red
- **Toggle**: "Show Regime Bands" checkbox
- **Purpose**: At a glance, see which market periods coincided with which risk regimes

#### Step 6.4 — Multi-Index Comparison
- **New toggle**: "Compare Indices"
- **When active**: Show 2-4 indices on the same chart (normalized to 100 at start)
- **Purpose**: See if BANKNIFTY diverges from NIFTY during high-risk periods
- **Max 4 lines**: NIFTY, BANKNIFTY, NIFTYIT, NIFTYFMCG

#### Step 6.5 — Enhanced Stats Panel
- **Current**: 52-week high/low, daily change
- **Add**:
  - Average risk score for the displayed period
  - Count of Capital Protection days in period
  - Correlation stat: "Risk score explains X% of volatility in this period"
  - Current regime distribution pie chart for the displayed period

**Phase 6 Exit Criteria**:
- Risk score overlay renders as secondary axis line
- Event markers display retrogrades, aspects on chart
- Regime background shading works
- Multi-index comparison toggle functions
- Enhanced stats panel shows risk-related metrics
- All overlays are toggleable and performant

---

## UI/UX PHASE 7: ADMIN & SETTINGS ENHANCEMENTS
### "Control panel for the engine operators"

**Goal**: Build admin-only views for rule management, discovery review, and engine monitoring. Only accessible to users with `role = 'admin'` in their profile.

#### Step 7.1 — Rule Explorer
- **New route**: `/admin/rules`
- **Layout**: Data table with all rules (given + discovered)
- **Columns**: ID, name, category, source, signal, strength, fire rate, accuracy, z-score, status (active/inactive)
- **Actions**:
  - Toggle active/inactive
  - Edit strength
  - View condition tree (JSON rendered as visual tree)
  - View fire history (which dates this rule fired)
- **Access**: Admin only (check `authStore.isAdmin`)

#### Step 7.2 — Discovery Review Queue
- **New route**: `/admin/discoveries`
- **Layout**: Card grid of candidate rules from `candidate_rules` table
- **Each card**:
  - Pattern description
  - Statistical metrics (z-score, sample size, effect size)
  - "Promote to Rule" / "Reject" action buttons
- **Workflow**: Admin reviews discovered patterns, promotes or rejects

#### Step 7.3 — Engine Health Dashboard
- **New route**: `/admin/health`
- **Monitoring panels**:
  - Data pipeline status: Last run time for each engine phase
  - Data freshness: Latest date in each table
  - Row counts: All key tables with expected vs actual counts
  - Error log: Recent pipeline errors
- **Purpose**: Quick check that the daily pipeline is running correctly

#### Step 7.4 — Settings View Enhancement
- **Current**: Master data reference tables (Sector Lords)
- **Add tabs**:
  - Planets — list of 9 planets with their attributes
  - Nakshatras — 27 nakshatras with lords, nature, pada info
  - Zodiac Signs — 12 signs with lords, element, quality
  - Sectors — Sector-planet lordship mappings
  - Index Composition — Which sectors make up each index
  - Rules — Read-only view of active rules for non-admins

**Phase 7 Exit Criteria**:
- Rule explorer is functional for admins
- Discovery review queue allows promote/reject workflow
- Engine health dashboard shows pipeline status
- Settings has comprehensive master data tabs
- Non-admin users cannot access admin routes

---

## UI/UX PHASE 8: NOTIFICATIONS & REAL-TIME
### "Don't make them check — tell them when it matters"

**Goal**: Push intelligence to users rather than making them come look.

**Depends On**: Engine Phase 7 (daily pipeline running)

#### Step 8.1 — Morning Briefing Card
- **Trigger**: When user opens app on a new day
- **Content**: Modal/drawer with today's quick summary
  ```
  ┌─────────────────────────────────────────┐
  │ ☀ Good Morning — 15 Feb 2026            │
  │                                         │
  │ NIFTY Risk: 67 (Distribution)           │
  │ Signal: +2.4 (Mildly Bullish)           │
  │                                         │
  │ Active Events:                          │
  │ • Mercury Retrograde (Day 12)           │
  │ • Mars □ Saturn (exact today)           │
  │                                         │
  │ Key Insight: Despite bearish planetary   │
  │ configuration, DLNL match today         │
  │ historically cushions downside.          │
  │                                         │
  │ [View Dashboard]  [Dismiss]             │
  └─────────────────────────────────────────┘
  ```
- **Dismissable**: Once dismissed, doesn't show again until next day
- **Storage**: `localStorage` flag with today's date

#### Step 8.2 — Risk Alert Badges
- **Sidebar navigation**: Show a red dot on "Dashboard" when today's risk > 70
- **Tab title**: Update browser tab to "⚠ KD: 71 - Capital Protection" when risk is high
- **Favicon**: Dynamic favicon — green/amber/red dot based on today's risk level

#### Step 8.3 — Supabase Realtime Subscription (Future)
- **When daily pipeline runs**: Subscribe to `risk_scores` table changes
- **On new score**: Auto-refresh dashboard without manual reload
- **Technology**: Supabase Realtime (PostgreSQL LISTEN/NOTIFY)
- **Scope**: Only subscribe to today's date + selected symbol

#### Step 8.4 — Push Notifications (Future - PWA)
- **Progressive Web App** manifest for installability
- **Service Worker**: Register for push notifications
- **Triggers**:
  - Morning briefing at 8:30 AM IST
  - Score change > 20 points intraday (if intraday engine exists)
  - Regime change (e.g., Expansion → Capital Protection)
- **Note**: PWA is a stretch goal — implement after core UX is solid

**Phase 8 Exit Criteria**:
- Morning briefing modal shows on first visit of the day
- Risk alert badges appear in sidebar and browser tab
- (Future) Realtime subscription auto-refreshes data
- (Future) PWA push notifications work on mobile

---

## UI/UX PHASE 9: POLISH & PERFORMANCE
### "The last 10% that makes it feel professional"

#### Step 9.1 — Skeleton Loading States
- **Every view**: Show skeleton cards/charts while data loads
- **Stagger**: Skeleton elements appear with slight delay cascade (50ms each)
- **Existing**: Skeleton component exists in `components/ui/Skeleton.tsx` — use it everywhere

#### Step 9.2 — Empty States
- **When no data exists** for a date/symbol:
  - Friendly illustration + message: "No risk data available for this date"
  - Suggest action: "Try selecting a trading day" or "Data pipeline may still be running"
- **When user is new**: Guided tour overlay (tooltips pointing to key UI elements)

#### Step 9.3 — Error Boundaries
- **React Error Boundary**: Wrap each view in an error boundary
- **Fallback UI**: "Something went wrong" card with retry button
- **Logging**: Report errors to console (or future error tracking service)

#### Step 9.4 — Keyboard Navigation
- **Arrow keys**: Navigate dates (← previous day, → next day) on Dashboard
- **`/` key**: Focus symbol switcher
- **`Escape`**: Close modals/panels
- **`1-6` keys**: Quick nav to views (1=Dashboard, 2=Markets, etc.)

#### Step 9.5 — Performance Optimization
- **React.lazy**: Code-split views (Calendar, Transmission, Backtest are heavy)
- **Virtualization**: If any list > 100 items, use `@tanstack/react-virtual`
- **Chart downsampling**: Already implemented in IndexPriceChart — apply to scatter plots too
- **Image optimization**: Lazy-load any illustrations/avatars
- **Bundle analysis**: Run `vite-plugin-visualizer` to find heavy dependencies

#### Step 9.6 — Accessibility (a11y)
- **ARIA labels**: All interactive elements (buttons, links, form controls)
- **Color contrast**: Verify all text meets WCAG AA (4.5:1 ratio) — especially risk colors on dark background
- **Screen reader**: Chart data should have `aria-label` summaries
- **Focus indicators**: Visible focus rings on all interactive elements (not just browser default)
- **Reduced motion**: Respect `prefers-reduced-motion` — disable Framer Motion animations

#### Step 9.7 — Responsive Design Audit
- **Breakpoints**:
  - Mobile (< 640px): Single column, bottom nav instead of sidebar
  - Tablet (640-1024px): Sidebar collapsed to icons, 1-2 column content
  - Desktop (1024-1440px): Full sidebar + 2-column dashboard
  - Wide (> 1440px): Full sidebar + 3-column max-width container
- **Touch targets**: Minimum 44px tap targets on mobile
- **Charts**: Use `ResponsiveContainer` (already used) — verify on small screens

**Phase 9 Exit Criteria**:
- All views have loading skeletons and empty states
- Error boundaries prevent white-screen crashes
- Keyboard navigation works for power users
- Lighthouse performance score > 90
- WCAG AA compliance for color contrast
- Responsive on mobile/tablet/desktop/wide

---

## EXECUTION TIMELINE (UI/UX)

| Phase | Description | Depends On | Priority | Scale Impact |
|-------|------------|-----------|----------|-------------|
| **UI Phase 0** | Scale Infrastructure (Edge + Snapshots) | Engine Phase 1 (tables exist) | **CRITICAL — DO FIRST** | Enables all other phases to handle 2000+ users |
| **UI Phase 1** | Data Connection Layer | Phase 0 + Engine Phase 3 | **Critical** | 1 fetch per Dashboard load (not 7) |
| **UI Phase 2** | Dashboard Enhancements | UI Phase 1 | **High** | All data from snapshot — zero extra queries |
| **UI Phase 3** | Calendar View | UI Phase 1 | **High** | Edge `/api/calendar` — 1 query per month |
| **UI Phase 4** | Transmission View | Engine Phase 2 + 3 + 4 | **Medium** | Data from snapshot — zero extra queries |
| **UI Phase 5** | Backtest View | Engine Phase 6 | **Medium** | Edge `/api/proofs` — cached 1hr |
| **UI Phase 6** | Markets Enhancements | UI Phase 1 | **Medium** | Edge `/api/eod-chart` — server-side downsampling |
| **UI Phase 7** | Admin & Settings | Engine Phase 4 + 5 | **Low** | Admin-only — low traffic, direct Supabase OK |
| **UI Phase 8** | Notifications & Realtime | Engine Phase 7 | **Low** | Supabase Realtime — connection-pooled |
| **UI Phase 9** | Polish & Performance | All UI Phases | **Ongoing** | Bundle splitting, virtualization |

```
                                    ┌──────────────────────────────────┐
                                    │  UI PHASE 0: INFRASTRUCTURE      │
                                    │  (Edge Functions + Snapshots +   │
                                    │   DB Indexes + Security)         │
                                    │  CAN START IN PARALLEL WITH      │
                                    │  ENGINE PHASE 1                  │
                                    └──────────────┬───────────────────┘
                                                   │
Engine Phase 1 ──→ Engine Phase 3 ──→ UI Phase 1 (Data Connection via Snapshots)
                                          │
                                          ├──→ UI Phase 2 (Dashboard — snapshot-powered)
                                          ├──→ UI Phase 3 (Calendar — edge /api/calendar)
                                          ├──→ UI Phase 6 (Markets — edge /api/eod-chart)
                                          │
Engine Phase 2+4 ─────────────────────────┴──→ UI Phase 4 (Transmission — snapshot-powered)
Engine Phase 6 ──────────────────────────────→ UI Phase 5 (Backtest — edge /api/proofs)
Engine Phase 4+5 ────────────────────────────→ UI Phase 7 (Admin — direct Supabase OK)
Engine Phase 7 ──────────────────────────────→ UI Phase 8 (Notifications)
                                              UI Phase 9 (Polish — continuous)
```

### Parallel Work Streams
```
WEEK 1-2:  Engine Phase 1 (Data Gen)  ║  UI Phase 0 (Infrastructure)
           ─────────────────────────  ║  ────────────────────────────
           Run ephemeris + panchang   ║  Build Edge Functions
           Verify data                ║  Build snapshot table + generator
                                      ║  Add DB indexes
                                      ║  Security hardening
                                      ║
WEEK 3:    Engine Phase 2 (Correlations) ║ UI Phase 1 (Connect to Snapshots)
           ──────────────────────────── ║ ──────────────────────────────────
           Run all 40+ factors          ║ Replace mock with snapshot service
                                        ║ Connect EOD chart to edge function
                                        ║
WEEK 4+:   Engine Phase 3-7             ║ UI Phase 2-9
           ────────────────             ║ ──────────────
           Risk engine, signals, etc.   ║ Dashboard, Calendar, etc.
```

---

## KEY DESIGN PRINCIPLES

1. **Data density over decoration** — Traders want information, not aesthetics. Every element must convey data.
2. **Progressive disclosure** — Show the score first, factors on demand, planetary details on drill-down.
3. **Color is meaning** — Green/amber/red are exclusively for risk levels. Never use them decoratively.
4. **Transparency builds trust** — Show accuracy stats, backtest results, and factor contributions. Don't hide the model's limitations.
5. **Speed is a feature** — Dashboard must load in < 2 seconds. Use skeletons, caching, and prefetching aggressively.
6. **Scale by default** — Every feature is designed for 2000+ concurrent users. No direct DB queries from browser for high-traffic data. Edge cache everything.
7. **Snapshot-first architecture** — Pre-compute once, serve to all. The daily pipeline pays the compute cost; users pay zero.
8. **Mobile is secondary** — Primary users are desktop traders checking before market open. Mobile is "quick glance" only.
9. **Animations with purpose** — Risk gauge fill animation shows score "computing". Regime transitions show state change. No gratuitous motion.
10. **Indian context** — Vara names in Hindi/Sanskrit, Nakshatra names transliterated, IST timezone default, Indian number formatting (lakhs/crores).

---

## SCALE BUDGET (per page load at 2000 users)

| Page | Edge Calls | DB Queries (with cache) | Response Size | Target Load Time |
|------|-----------|------------------------|---------------|-----------------|
| **Dashboard** | 1 (`/api/snapshot`) | 0-1 (cache hit) | ~5 KB JSON | < 1s |
| **Calendar** | 1 (`/api/calendar`) | 0-1 (cache hit) | ~15 KB JSON | < 1.5s |
| **Markets** | 1 (`/api/eod-chart`) | 0-1 (cache hit) | ~25 KB JSON | < 2s |
| **Backtest** | 1 (`/api/proofs`) | 0-1 (cache hit) | ~10 KB JSON | < 2s |
| **Transmission** | 0 (uses snapshot from Dashboard) | 0 | 0 (already loaded) | < 0.5s |
| **Settings** | 1 (direct Supabase, master data) | 1 | ~3 KB | < 1s |

**Total for 2000 users opening Dashboard simultaneously**: ~1-5 DB queries (rest are cache hits)

---

## UI/UX DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-15 | Dark theme only (no light mode) | Financial terminals are traditionally dark; reduces eye strain during pre-market hours |
| 2026-02-15 | Inter + Playfair Display + JetBrains Mono | Inter for readability, Playfair for gravitas, JetBrains for data precision |
| 2026-02-15 | Recharts for charts (not D3 direct) | Recharts provides React-native chart components with good customization; D3 too low-level |
| 2026-02-15 | Radix UI for primitives | Accessible, unstyled, composable — pairs perfectly with Tailwind |
| 2026-02-15 | Mock data first, swap to real | Allows frontend development in parallel with engine pipeline |
| 2026-02-15 | Calendar as monthly grid (not list) | Financial calendars are always grid — traders think in weeks |
| 2026-02-15 | Three-column flow for Transmission | More intuitive than Sankey for non-technical users; evaluate Sankey later |
| 2026-02-15 | Desktop-first responsive | Primary use case is pre-market analysis on desktop; mobile is secondary |
| 2026-02-15 | **Snapshot architecture for scale** | 2000+ users hitting identical daily data = pre-compute once, serve from cache. Reduces 14,000 DB queries to ~1 per cache window |
| 2026-02-15 | **Supabase Edge Functions as API layer** | Deno-based edge functions provide in-memory caching, rate limiting, CORS, and server-side downsampling without a separate API server |
| 2026-02-15 | **Pre-generated explanations (not per-user Gemini)** | At 2000 users, per-user Gemini calls = $$$. Template explanation in snapshot + optional Gemini polish once/day |
| 2026-02-15 | **Edge over CDN** | Edge Functions allow dynamic cache invalidation (when today's snapshot updates) vs static CDN which requires cache purging |
| 2026-02-15 | **Date-range pagination for EOD (not .range(0,9999))** | Row-count pagination sends 10K rows over wire. Date-range + server-side downsampling sends max 500 points |
| 2026-02-15 | **Service key removed from frontend** | CRITICAL security — service key bypasses all RLS. Must live only in backend/.env and Edge Function secrets |
| | | |

---

*This UI/UX plan extends the Engine Build Plan. Both are living documents — update the Decision Logs as choices are made during execution.*

---

## SESSION BOOKMARK — 15 Feb 2026

### Status: READY TO MERGE TO MAIN

**Branch**: `claude/init-project-code-QyjXu`
**Last commit**: `a7692a6` — Restore original dashboard layout with mock data fallback
**Merge conflicts**: Resolved locally (useEodData.ts, useRiskData.ts, DashboardView.tsx)

---

### What Was Completed This Session

#### Engine (Backend)
| Item | Commits | Status |
|------|---------|--------|
| Ephemeris generator (1990–2030) | `23458f0`, `c7c1927` | Code ready, output generated |
| Panchang generator (1990–2030) | `157882f`, `a3853c4` | Code ready, output generated |
| All 4 engines migrated to Supabase | `31fff56` | SQLite fully removed |
| Risk engine: all symbols | `363724f` | Fixed (was NIFTY-only) |
| Rule seeder (km_rules) | `85cd5cf` | Working |
| RLS policies for rule tables | `bd259f2` | Applied |
| DB scripts: ephemeris tables | `faac3ca` | SQL ready |
| DB scripts: computed tables | `b21462e` | SQL ready |

#### UI/UX Phase 0: Scale Infrastructure
| Item | Commits | Status |
|------|---------|--------|
| Snapshot table + generator | `3f0f094`, `77fc387`, `1a062cb` | SQL-based generator in Supabase |
| Snapshot seed data (4 symbols) | `8555361` | Seeded |
| Edge Functions (snapshot, calendar, eod-chart, proofs) | `3f0f094`, `da6bfd8` | Self-contained, deployable |
| Edge function env fix | `8855250`, `2f45baf` | Fixed SUPABASE_ prefix + URL fallback |
| .env.example added | `2f45baf` | No secrets in frontend |

#### UI/UX Phase 1–2: Dashboard
| Item | Commits | Status |
|------|---------|--------|
| Dual-mode hooks (snapshot + mock fallback) | `3f0f094`, `a7692a6` | useEodData, useRiskData, useSnapshot |
| Date picker + last trading day default | `58e2e80`, `49b0d8c` | Working |
| Panchang strip | `58e2e80` | Working (visible to all users) |
| Events banner + aspects (admin-only) | `58e2e80` | Working |
| Signal panel (admin-only) | `58e2e80` | Working |
| 2-column layout | `58e2e80` | Working |
| Risk gauge redesign (posture-first) | `99e204b` | Institutional tone |
| AI chat widget (Gemini) | `a0d322a` | Working |
| Index Overview + CalendarStrip | `661a3d8` | 5 instruments, admin/user gates |
| Detail page with chart + tech confluence | `63faacf` | Built then reverted to mock fallback |
| Mock data fallback restored | `a7692a6` | Dashboard works without live snapshots |

---

### What's NOT Done Yet (Engine — tables still empty in Supabase)

These generators have **code written** but have **never been run** against Supabase:

1. **`generate_ephemeris.py`** — needs to run for 1990–2030, populates: `planetary_positions`, `planetary_aspects`, `astro_events`, `moon_intraday`
2. **`generate_panchang.py`** — needs to run for 1990–2030, populates: `daily_panchang`
3. **`correlations.py`** — needs ephemeris + market data → `factor_correlation_stats`
4. **`risk_engine.py`** — needs ephemeris + moon → `risk_scores`
5. **`signal_engine.py`** — needs panchang + positions + aspects + rules → `rule_signals`
6. **`discovery_engine.py`** — needs panchang + market → `candidate_rules`

**Dependency chain**: Run in order 1 → 2 → 3 → 4 → 5 → 6

Until these run, the frontend uses **mock/seeded data**. The snapshot architecture is ready to serve real data once the engine pipeline populates the tables.

---

### Next Session — Pick Up Here

1. **Merge `claude/init-project-code-QyjXu` → `main`** (conflicts resolved, ready to merge)
2. **Engine Phase 1**: Run `generate_ephemeris.py` against Supabase (1990–2030) — this is the critical path blocker
3. **Engine Phase 1**: Run `generate_panchang.py` against Supabase (1990–2030)
4. **Engine Phase 2–4**: Run correlation → risk → signal engines in sequence
5. **Run snapshot generator**: `bulk_generate_snapshots()` to backfill `km_daily_snapshots` with real data
6. **Flip `VITE_DATA_MODE=snapshot`**: Frontend automatically switches from mock to real data
7. Continue with **UI/UX Phase 3** (Calendar View) and **Phase 4** (Transmission View)

---

### Key Architecture Decisions Locked In
- **Snapshot-first**: One pre-computed JSONB blob per (date, symbol) — no per-user queries
- **Dual-mode hooks**: `VITE_DATA_MODE` env var toggles between `snapshot` (Edge Functions) and `mock` (seeded random)
- **Edge Functions**: 4 functions deployed (snapshot, calendar, eod-chart, proofs) — thin caching layer over Supabase
- **Admin/User gates**: Planetary events, aspects, signals visible to admin only; panchang + risk visible to all
- **Mock fallback**: Dashboard always works even without live data — critical for development
