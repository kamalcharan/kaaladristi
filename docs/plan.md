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
