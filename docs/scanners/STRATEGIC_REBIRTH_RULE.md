# STRATEGIC REBIRTH — DristiQ Scanner Rule Document

**Rule ID:** SCANNER_STRATEGIC_REBIRTH  
**Version:** 1.0  
**Category:** Long Play / Positional (6–18 months)  
**Universe:** Full NSE universe filtered by age (10+ years listed)  
**Scan Frequency:** Weekly (Sunday evening, before Monday open)  
**Signal Table:** `km_rule_signals` (rule_code = 'SR_CANDIDATE', 'SR_PEAD_ACTIVE', 'SR_COMPOUND')

---

## The DristiQ Weather Report Philosophy

DristiQ is a **weather report for markets** — not a buy/sell recommendation engine.

Just as a weather report reads atmospheric pressure, temperature, wind direction and humidity to forecast conditions, DristiQ reads:

```
Technical atmosphere    : Price structure, volume, momentum indicators
Fundamental atmosphere  : Business health, filing signals, PEAD cycle
Planetary atmosphere    : Celestial configurations, historical correlations
Geopolitical atmosphere : Event triggers, theme-sector mappings
```

Strategic Rebirth is the scanner that combines **all four atmospheric layers** into a single long-play identification framework. It is the most complete expression of the DristiQ weather report.

---

## Conceptual Definition

A **Strategic Rebirth** stock is a company (10+ years in operation) undergoing a **specific internal or external transformation** that the market has either misread, ignored, or not yet discovered. Unlike a Waking Giant (external catalyst wakes a dormant company) or a Flower Pot Burst (compressed energy releasing short-term), Strategic Rebirth is driven by a **documented inflection point** — a filing, result, or geopolitical event — that initiates a 60–90 day PEAD drift visible as consistent multi-timeframe heatmap green.

```
The company changes direction (or the world changes around it)
A specific document proves it (filing, result, policy)
The market misreads or is slow to price it in
Smart money positions quietly (GL accumulation builds)
PEAD drift runs 60–90 days
Consistent heatmap green is the visible fingerprint
DristiQ catches it early — ideally before Day 15 of drift
```

**Reference stocks from DristiQ observation:**
- Solara Active Pharma — exited ibuprofen manufacturing (strategic exit of low-margin ops)
- DEE Development Engineers — existing ASME capability aligned to nuclear BoTIP zone
- Aeroflex Industries — flexible hose manufacturer pivoting to data center liquid cooling
- Walchandnagar Industries — century-old engineering company re-rated by nuclear policy

---

## PEAD — The Core Mechanism

**Post Earnings Announcement Drift (PEAD)** is the documented tendency of stock prices to continue moving in the direction of an earnings or filing surprise for 60–90 days after the announcement — because the market is systematically slow to update its beliefs.

### Standard PEAD vs Strategic Rebirth PEAD

```
Standard PEAD:
  Earnings beat consensus → price drifts up 60–90 days
  Market was right direction, wrong magnitude
  Well-known, partially arbitraged away

Strategic Rebirth PEAD (DristiQ definition):
  Filing / result misread or ignored by market
  Smart money reads the CORRECT signal
  Price drifts up while majority still confused
  Longer and more stable than standard PEAD
  Harder to arbitrage because thesis requires deep reading
```

### The Three PEAD Trigger Types

**TYPE 1 — EARNINGS MISREAD:**
```
Company reports result
Headline metric looks bad (revenue falls, PAT flat)
Underlying metric improving (margins, EBITDA, cash flow)
Market reads NEGATIVE, smart money reads POSITIVE
PEAD drift upward while retail confused

Example: Solara Active Pharma
  Exited ibuprofen → revenue fell
  Market read: company shrinking
  Smart money read: low-margin drag removed,
                    EBITDA margin expanding ahead
```

**TYPE 2 — POLICY CATALYST:**
```
Government policy / legislation creates new TAM
Existing company capability suddenly strategically relevant
Market hasn't connected the dots yet
Smart money researches, positions quietly
PEAD drift as analysts and funds catch up

Example: DEE Development Engineers
  SHANTI Bill / nuclear energy mission announced
  DEE already holds ASME Section IX certification
  Inconel/Hastelloy fabrication, robotic welding,
  hydrostatic testing — exact BoTIP zone capability
  Market read: just another power sector company
  Smart money read: only qualified private vendor
                    for nuclear conventional island

Example: Walchandnagar Industries
  Same nuclear policy trigger
  116-year-old heavy engineering company
  Order book ₹938 Cr even during dormancy
```

**TYPE 3 — GEOPOLITICAL THEME:**
```
Global event creates supply/demand disruption
Niche Indian manufacturer sits at intersection
Thematic capital rotates in
Company then compounds with fundamental delivery

Example: Aeroflex Industries
  US-Iran tensions → liquid/gas infrastructure stress
  Aeroflex: stainless steel flexible hoses for safe
            liquid and gas transfer
  Geopolitical entry → then Q4 FY26 result adds
  data center liquid cooling thesis (617 skids, ₹21.2 Cr)
  Compounding PEAD: geopolitical + earnings + guidance
  = 3-month golden run of consistent heatmap green
```

### Compounding PEAD — The Golden Run Pattern

When multiple PEAD triggers fire within a 66-day window on the same stock:

```
Trigger 1 (Day 0):   Geopolitical event / policy announcement
Trigger 2 (Day ~22): Quarterly result confirms capability
Trigger 3 (Day ~45): Management guidance, analyst discovery,
                     viral research thread
Each trigger restarts drift energy
Net result: 3–4 months of consistent green
Longer and more stable than single-trigger PEAD
```

```
compound_pead = trigger_count >= 2
                within 66-day window
                all in same direction
                heatmap green throughout
```

---

## The Heatmap Fingerprint

Consistent multi-timeframe green on a Strategic Rebirth stock is **not the same** as momentum stock green.

```
Momentum stock consistent green:
  Already known, already priced in
  Everyone sees it, crowded trade
  High risk of reversal at any point

Strategic Rebirth consistent green:
  Something structural is changing
  5D green (smart money already in)
  22D green (analysts revising, funds rebalancing)
  66D green (institutional repricing underway)
  Price still well below ATH
  = PEAD drift in progress, not yet complete
```

**The entry window:**
```
All three timeframes green (5D + 22D + 66D)
AND price still 30–60% below 3-year high
AND GL accumulation days building
= Mid-PEAD entry — still significant runway remaining

5D green only:
= Day 1–5 of drift — very early, higher risk

All three green + price near ATH:
= Late PEAD — drift nearly complete, avoid
```

---

## Planetary Observation Windows — The Advance Warning Layer

This is DristiQ's most distinctive capability. Planetary configurations historically correlate with specific types of geopolitical events which impact specific sectors. This gives **advance observation windows** — weeks or months before the geopolitical trigger fires.

### The Four-Level Framework

```
LEVEL 1: Planetary Configuration
  Known months/years in advance from ephemeris
  Seeded in km_astro_observation_windows

LEVEL 2: Historical Geopolitical Correlation
  Derived from historical pattern study
  War/conflict, trade disruption, energy shock,
  infrastructure stress, supply chain breakdown

LEVEL 3: Sector Impact Mapping
  Which NSE sectors benefit or suffer
  Cross-referenced with km_sector_theme_map

LEVEL 4: Stock Pre-Positioning
  Dormant/rebirth candidates in correlated sectors
  Already meeting GL accumulation criteria
  = Pre-PEAD entry — before geopolitical event even fires
```

### Key Planetary-Geopolitical Correlations (Seed Data)

**Mars Configurations → Military/Conflict:**
```
Mars-Saturn conjunction:  Military escalation, border tensions
Mars entering Aries:      Initiation of conflict, aggressive action
Mars retrograde end:      Resumption of stalled conflicts
Observation window:       6–8 weeks
Sector impact:            Defence, aerospace, precision manufacturing,
                          strategic metals
NSE examples:             HAL, BEL, MTAR, Walchandnagar, DEE
```

**Saturn in Water Signs → Maritime/Liquid Disruption:**
```
Saturn in Pisces (2023–2026):
  Maritime disruption, liquid infrastructure stress
  Shipping lane conflicts, oil/gas supply disruption
  Water infrastructure scarcity
Sector impact:            Fluid handling, LNG, shipping, water treatment,
                          pipeline, safe transfer equipment
NSE examples:             Aeroflex, WABAG, Kirloskar, Gujarat Gas
Historical validation:    Red Sea shipping attacks (2024),
                          US-Iran tensions (2024–25)
```

**Jupiter Transits → Expansion Themes:**
```
Jupiter in Taurus:        Metal fabrication, manufacturing expansion
Jupiter in Gemini:        Engineering, technical companies, connectivity
Jupiter in Cancer:        Domestic industry, water, food, real estate
Observation window:       12–13 months per sign
Sector impact:            Matches sign themes above
```

**Rahu-Ketu Axis → Obsession and Disruption:**
```
Rahu in Pisces / Ketu in Virgo (2025–2026):
  Rahu: Obsession with liquids, chemicals, pharma, maritime
  Ketu: Disruption to precision work, health systems, analytics
Sector impact:            Pharma API, chemical processing,
                          precision manufacturing under stress
NSE examples:             Solara (API rebirth), Navin Fluorine
```

**Saturn-Neptune Configurations → Oil/Energy Disruption:**
```
Historically correlates with oil/gas supply disruption
Neptune rules liquids, petroleum, dissolution
Saturn rules restriction, scarcity
Combined = energy supply constraints
Sector impact:            Oil & gas, LNG, renewables, nuclear,
                          energy storage
```

### Observation Window Table Structure

```sql
km_astro_observation_windows:
  window_id
  start_date
  end_date
  planet_configuration      -- "Saturn in Pisces"
  configuration_type        -- TRANSIT/CONJUNCTION/OPPOSITION/
                               RETROGRADE/INGRESS
  historical_geopolitical   -- "Maritime disruption, liquid 
                               infrastructure stress"
  correlation_confidence    -- VALIDATED(n≥3) / INDICATIVE(n=2) /
                               UNVALIDATED(n=1)
  correlated_sectors[]      -- sector tags array
  correlated_themes[]       -- theme keywords array
  historical_examples[]     -- date-stamped real events
  observation_note          -- Charan's annotation
  active                    -- boolean
  linked_geopolitical_id    -- FK to km_geopolitical_events
  linked_sector_themes[]    -- FK to km_sector_theme_map
```

---

## Geopolitical Intelligence Layer

### Three-Tier Input Architecture

**Tier 1 — Human Intelligence (Always Primary):**
```
Charan observes geopolitical event
Pattern recognition: event → theme → sector → stock
This cannot be automated — 20+ years of contextual judgment
DristiQ amplifies this, never replaces it
```

**Tier 2 — Hermes Agent Monitoring:**
```
Hermes monitors RSS feeds:
  Reuters world news
  Ministry of External Affairs
  US State Department advisories
  OPEC/commodity body announcements
  NSE/SEBI circulars

Qwen3 4B handles:
  Keyword extraction from headlines
  Sector tag matching
  Writing to km_geopolitical_events
  High-frequency, structured tasks

Claude (API fallback) handles:
  Complex theme interpretation
  Multi-hop reasoning: event → commodity → sector → stock
  VIP analysis and deep research
  Generating theme keywords for km_sector_theme_map

Human confirmation gate:
  Hermes flags → Charan confirms with one tap
  Confirmed event triggers stock scan
  Lag from observation to watchlist: < 2 minutes
```

**Tier 3 — Planetary Pre-Warning:**
```
km_astro_observation_windows active window
+ Stock in correlated sector
+ GL accumulation days > 10
= PLANETARY PRE-POSITIONING ALERT
(Before geopolitical event even fires publicly)
```

### Geopolitical Events Table

```sql
km_geopolitical_events:
  event_id
  detected_at
  event_type          -- WAR/SANCTIONS/TRADE/SUPPLY_SHOCK/
                         POLICY/INFRASTRUCTURE
  region
  themes[]            -- affected sectors/commodities
  source_url
  hermes_summary      -- 2-3 line summary
  human_confirmed     -- boolean (Charan validates)
  confirmed_at
  trigger_type        -- TYPE1_EARNINGS/TYPE2_POLICY/TYPE3_GEOPOLITICAL
  linked_scan_id      -- which stock scan triggered
  linked_planet_window -- was this predicted by observation window?
```

### Sector-Theme Mapping Table

```sql
km_sector_theme_map:
  theme_keyword         -- "liquid infrastructure"
  sector_tags[]         -- NSE sector codes
  correlated_themes[]   -- adjacent themes
  example_stocks[]      -- known beneficiaries
  planet_windows[]      -- which planetary configs correlate
  last_triggered_date   -- when last used
  hit_rate             -- historical accuracy of mapping
```

**Seed mappings from DristiQ observations:**

```
"maritime disruption / liquid infrastructure":
  Saturn in Pisces, Rahu in Pisces
  Sectors: fluid handling, LNG, pipeline, water treatment
  Stocks: Aeroflex, WABAG, Gujarat Gas, Kirloskar

"nuclear energy / precision engineering":
  Jupiter in Gemini, Mars-Saturn (defence push)
  Sectors: heavy engineering, alloy fabrication, nuclear components
  Stocks: Walchandnagar, DEE, BHEL, MTAR

"API pharma / import substitution":
  Rahu in Pisces (pharma obsession), PLI policy
  Sectors: API manufacturing, CDMO, specialty chemicals
  Stocks: Solara, Laurus Labs, Divi's

"defence / aerospace":
  Mars configurations, Jupiter in Aries
  Sectors: defence manufacturing, aerospace components
  Stocks: HAL, BEL, Data Patterns, Paras Defence

"data center infrastructure":
  Herschel (Uranus) in Taurus (technology disrupting material world)
  Sectors: cooling systems, power infrastructure, cables
  Stocks: Aeroflex, Polycab, KEI, Sterlite Tech
```

---

## Signal Architecture — Three Phases

### Phase 0 — SR_CANDIDATE (Stock Identified)

Run weekly on full NSE universe (10+ year listed companies).

```
Age gate:
  Listed on NSE/BSE ≥ 10 years

Business alive gate:
  Revenue positive 2 of last 3 years
  EBITDA positive 1 of last 3 years
  Promoter holding delta (last 4Q) > -5%
  Not on ASM/GSM list

Dormancy / transformation gate (ANY ONE of):
  Price ≤ 65% of 3-year high (sleeping)
  OR stage = Stage 1 / Stage 4
  OR recent strategic filing detected
     (km_corporate_filings.signal_tag IS NOT NULL)
  OR active geopolitical trigger in correlated sector
  OR active planetary observation window + sector match

Heatmap early signal (optional, increases confidence):
  22D return > 0 AND 66D return > 0
  While price still < 3-year high by 25%+
  = Early PEAD drift starting
```

**SR_CANDIDATE output:**
```
trigger_type:     EARNINGS_MISREAD / POLICY_CATALYST / 
                  GEOPOLITICAL_THEME / CAPABILITY_DISCOVERY /
                  VALUE_CHAIN_UPGRADE / STRATEGIC_EXIT /
                  COMPOUND (multiple triggers)
filing_reference: linked km_corporate_filings record
geo_reference:    linked km_geopolitical_events record  
planet_reference: linked km_astro_observation_windows record
candidate_score:  composite (dormancy + trigger strength + 
                             heatmap + GL accumulation)
```

---

### Phase 1 — SR_PEAD_ACTIVE (Drift Confirmed)

Evaluated daily on SR_CANDIDATE stocks.

**PEAD tracker — core metrics:**

```sql
km_pead_tracker:
  symbol
  day_0_date            -- trigger event date
  trigger_type          -- from SR_CANDIDATE
  pead_day              -- current day in drift (0-90)
  
  -- Heatmap readings (updated daily)
  return_5d
  return_22d
  return_66d
  heatmap_5d_green      -- return_5d > 0
  heatmap_22d_green     -- return_22d > 0
  heatmap_66d_green     -- return_66d > 0
  all_timeframes_green  -- all three TRUE
  consecutive_green_days -- days all three green simultaneously
  
  -- GL accumulation (from Waking Giants framework)
  gl_acc_days           -- delivery vol days at GL band
  gl_acceleration       -- recent vs early density ratio
  
  -- RS divergence
  rs_slope_daily
  rs_slope_weekly
  slope_divergence
  
  -- PEAD phase
  pead_phase            -- EARLY(0-22)/MID(23-60)/LATE(61-90)
  drift_pct_total       -- total price move since Day 0
  
  -- Compound tracking
  trigger_count         -- how many PEAD triggers fired
  trigger_dates[]       -- dates of each trigger
  compound_flag         -- trigger_count >= 2 within 66D
  
  -- Flower Pot watch
  fpb_setup_active      -- boolean (compression forming?)
  fpb_burst_triggered   -- boolean
```

**SR_PEAD_ACTIVE fires when:**
```
all_timeframes_green = TRUE
AND consecutive_green_days >= 5
AND pead_day BETWEEN 5 AND 60   (not too early noise, not too late)
AND drift_pct_total < 40%       (still has runway)
AND gl_acc_days >= 8            (accumulation confirmed)
```

**PEAD Phase interpretation:**
```
EARLY (Day 0–22):
  5D green, 22D just turning
  Smart money positioning
  GL accumulation starting
  Entry: aggressive, wider SL
  
MID (Day 23–60):  ← SWEET SPOT
  All three timeframes green
  Institutional rebalancing
  GL accumulation well established
  RS divergence visible
  Entry: optimal risk/reward
  
LATE (Day 61–90):
  All green but 66D return now large
  Retail discovering the thesis
  Watch for Flower Pot Burst (terminal PEAD event)
  Entry: only for FPB burst play, not new positional
  
POST-PEAD (Day 90+):
  Drift complete
  New base forming OR
  Continuation into Stage 2 (Waking Giant territory)
```

---

### Phase 2 — SR_COMPOUND (Multiple Triggers Stacking)

The highest conviction signal in the Strategic Rebirth framework.

```
SR_COMPOUND fires when:
  trigger_count >= 2
  AND all triggers within 66D window
  AND all_timeframes_green = TRUE throughout
  AND compound_flag = TRUE
  AND pead_phase = MID
```

**Compound trigger combinations observed:**

```
POLICY + CAPABILITY_DISCOVERY:
  (DEE — nuclear policy + ASME capability thread)
  Policy creates new TAM
  Analyst discovers existing moat
  Double PEAD: institutional + retail discovery

GEOPOLITICAL + VALUE_CHAIN_UPGRADE:
  (Aeroflex — US-Iran + data center cooling pivot)
  External event creates initial thesis
  Company delivers fundamental confirmation
  Triple PEAD: geo + earnings + guidance

STRATEGIC_EXIT + EARNINGS_MISREAD:
  (Solara — ibuprofen exit + margin expansion)
  Company prunes low-margin ops
  Market reads revenue fall as negative
  Smart money reads margin improvement as positive
  PEAD runs on misread for full 90 days
```

---

## KaalaDristi Integration

The planetary layer applies at three levels for Strategic Rebirth:

### Level 1 — Observation Window Pre-Alert
```
Active km_astro_observation_windows entry
+ SR_CANDIDATE in correlated sector
= Pre-PEAD planetary alert
  "Conditions suggest [sector] stress/opportunity
   in coming [weeks/months] — candidates identified"
```

### Level 2 — Daily Atmospheric Gate on PEAD Stocks
```
SR_PEAD_ACTIVE stock
+ dc_score ≥ 65 today
+ No malefic override
= HIGH CONVICTION day to add/hold position

SR_PEAD_ACTIVE stock
+ dc_score < 35
+ Vyatipata/Vaidhriti active
= CAUTION day — avoid adding, tighten SL
```

### Level 3 — Compound Signal Enhancement
```
SR_COMPOUND fires
+ Active observation window for correlated sector
+ dc_score ≥ 65
= MAXIMUM CONVICTION — planetary, geopolitical,
  fundamental AND technical all aligned
= Strongest long-play signal in DristiQ suite
```

---

## Entry, Hold and Exit Framework

### Entry

```
Ideal entry window:
  PEAD Day 15–45 (MID phase)
  All three heatmap timeframes green
  GL accumulation days ≥ 10
  RS slope divergence appearing
  dc_score ≥ 60

Entry types by conviction:
  SR_CANDIDATE only:          Watch, no entry yet
  SR_PEAD_ACTIVE (EARLY):     Small starter position (25% of target size)
  SR_PEAD_ACTIVE (MID):       Full position (100% of target size)
  SR_COMPOUND (MID):          Full position + planetary aligned = add
  SR_PEAD_ACTIVE + FPB_BURST: Tactical top-up on burst
```

### Hold Framework

This is a **6–18 month play** — not managed by RSI or single candles.

```
Hold as long as:
  Fundamental thesis intact (filing/result confirms direction)
  Heatmap: at least 22D still green
  Stage not moving to Stage 3 (distribution)
  No reversal filing (management change, new debt, pledge surge)

Review triggers (not automatic exits):
  Quarterly result — does it confirm or contradict thesis?
  New filing — is it thesis-reinforcing or thesis-breaking?
  Planetary observation window closing — is next window negative?
  Analyst consensus shifting (no longer a hidden play)
```

### Exit Signals

```
HARD EXIT:
  Thesis-breaking filing (re-entering low-margin ops,
  debt exploding, promoter selling aggressively)
  Stage moves to confirmed Stage 3
  Heatmap: 66D turns negative after sustained green run
  Planetary observation window: new configuration
  historically negative for this sector activates

SOFT EXIT (partial):
  PEAD Day 90+ reached, FPB Burst has fired
  Target T1 hit (3-year high reached)
  All three heatmap timeframes very extended
  Next quarterly result coming — reduce before result

TRAIL STOP:
  After 30%+ gain: trail SL to entry price (capital protection)
  After 50%+ gain: trail SL to 20% above entry (lock profits)
  Hold for T2 (ATH) only if KaalaDristi remains constructive
  AND next observation window still sector-positive
```

### Targets

```
T1: 3-year high (where stock was before dormancy)
T2: All-time high (full re-rating)
T3: Fair value on new business metrics
    (revenue × sector P/Sales at improved margin)
    Applicable when VALUE_CHAIN_UPGRADE trigger active
    e.g. Aeroflex priced as industrial → re-priced as tech-adjacent
```

---

## How Strategic Rebirth Connects to Other Scanners

```
PLANETARY OBSERVATION WINDOW active
  ↓ advance warning (weeks/months ahead)
GEOPOLITICAL EVENT fires
  ↓
SR_CANDIDATE identified
  ↓ (weeks)
SR_PEAD_ACTIVE (MID phase) — entry window
  ↓ overlapping
WAKING_GIANT_P1 may also fire (if legacy company)
  ↓
SR_COMPOUND if second trigger fires
  ↓ (weeks to months later)
WAKING_GIANT_P2 — RS divergence, GL cross
  ↓
FLOWER_POT_BURST — terminal PEAD event
  ↓
BREAKOUT_SURGE — continuation
  ↓
STAGE_2_LEADERS — new uptrend confirmed
```

Strategic Rebirth is the **entry narrative**. The other scanners are **progression confirmations**. A stock travelling through all stages is the highest-conviction multi-month trade in DristiQ.

---

## Indicator Behaviour on Strategic Rebirth Stocks

| Indicator | Pre-Trigger | PEAD Early (0–22D) | PEAD Mid (23–60D) | PEAD Late (61–90D) |
|---|---|---|---|---|
| Heatmap 5D | Red/flat | Turns green | Green | Green, extended |
| Heatmap 22D | Red | Turning | Green | Green |
| Heatmap 66D | Red | Still red/flat | Turning green | Green |
| GL Acc Days | 0–5 | 5–10 building | 10–20 confirmed | 15–25, decelerating |
| MagicRS Daily | 1–2/6 | 2–3/6 | 3–4/6 | 4–5/6 |
| MagicRS Weekly | 1/6 flat | Starts turning | Lagging daily | Catching up |
| RS Slope Gap | Near zero | Small tilt | Diverging | Gap closing |
| Volume | Below avg | 1.2–1.5x consistent | Sustained 1.5x | Spike possible (FPB) |
| Delivery % | 35–45% | 50–55% rising | 55–65% sustained | Normalising |
| Stage | S1 or S4 | S1 recovering | S1→S2 transition | S2 early |
| Monthly candle | Red/Doji | Hammer/Doji | Morning Star | Bullish engulf |
| ATR | Low | Low-medium | Expanding | High (if FPB) |

---

## Corporate Filings Intelligence Layer

NSE filings are the primary source for TYPE 1 and TYPE 2 triggers.

### Filing Signal Classification

```sql
km_corporate_filings:
  symbol
  filing_date
  category_code
  headline_text
  filing_url
  signal_tag          -- classified signal type
  signal_strength     -- 1 (weak) to 5 (strong)
  human_reviewed      -- boolean
  pead_trigger        -- boolean (does this start a PEAD watch?)
  trigger_type        -- maps to PEAD trigger taxonomy

signal_tag values:
  STRATEGIC_EXIT        (Solara ibuprofen — exit low margin)
  VALUE_CHAIN_UPGRADE   (Aeroflex cooling skids — enter high margin)
  CAPACITY_EXPANSION    (capex after long pause)
  REGULATORY_APPROVAL   (USFDA, nuclear certification)
  ORDER_WIN             (large contract above disclosure threshold)
  PROMOTER_BUYING       (open market acquisition)
  DEBT_REDUCTION        (prepayment, pledge release)
  BALANCE_SHEET_REPAIR  (QIP complete, WC improvement)
  CAPABILITY_DISCLOSURE (investor presentation revealing hidden moat)
```

### Keyword Detection Rules (V1 — Rule Based)

```python
SIGNAL_KEYWORDS = {
  "STRATEGIC_EXIT": [
    "discontinue", "exit", "divest", "wind down",
    "discontinue manufacturing", "sell business unit",
    "focus on core"
  ],
  "VALUE_CHAIN_UPGRADE": [
    "new product", "higher margin", "new segment",
    "technology upgrade", "value added", "premium product"
  ],
  "REGULATORY_APPROVAL": [
    "USFDA", "EMA", "CDSCO", "ANDA", "product approval",
    "manufacturing license", "ASME", "certification received"
  ],
  "ORDER_WIN": [
    "order received", "contract awarded", "supply agreement",
    "long term agreement", "repeat order", "export order"
  ],
  "PROMOTER_BUYING": [
    "acquisition of shares", "open market purchase",
    "promoter acquires", "creeping acquisition"
  ],
  "DEBT_REDUCTION": [
    "debt repaid", "prepayment", "NCD redemption",
    "credit rating upgrade", "pledge released", "debt free"
  ]
}
```

---

## Data Requirements

### Already Available in km_equity_eod:
- OHLCV, SMA_150 (GL), EMA_20/50
- magic_rs (daily), stage_classification
- ATR, RSI, volume metrics

### Needs Addition:
- `delivery_volume`, `delivery_pct` — NSE bhav copy (shared with Waking Giants)
- `magic_rs_weekly` — weekly aggregated RS
- `return_5d`, `return_22d`, `return_66d` — rolling return columns
- `heatmap_5d_green`, `heatmap_22d_green`, `heatmap_66d_green` — boolean flags

### New Tables Required:
- `km_corporate_filings` — NSE filing ingestion + classification
- `km_geopolitical_events` — geopolitical trigger log
- `km_sector_theme_map` — theme to sector to stock mapping
- `km_astro_observation_windows` — planetary pre-warning windows
- `km_pead_tracker` — PEAD cycle tracking per stock

### New Signal Codes in km_rule_signals:
- `SR_CANDIDATE` — stock identified as rebirth candidate
- `SR_PEAD_ACTIVE` — drift confirmed, phase tagged
- `SR_COMPOUND` — multiple triggers stacking
- `SR_PLANET_PREALERT` — planetary window pre-positioning alert

---

## Scan Cadence

```
Weekly (Sunday):
  Rebuild SR_CANDIDATE list
  Check km_astro_observation_windows for active/new windows
  Cross-reference with km_sector_theme_map
  Surface planetary pre-positioning alerts

Daily (post bhav copy):
  Update km_pead_tracker for all active SR stocks
  Recalculate heatmap flags (5D/22D/66D)
  Check for new corporate filings → classify → trigger SR_CANDIDATE
  Apply KaalaDristi dc_score gate
  Check for SR_COMPOUND condition
  Check for FPB_SETUP forming on SR_PEAD_ACTIVE stocks

Quarterly:
  Review km_astro_observation_windows — update confidence tiers
  Add new historical correlations from recent geopolitical events
  Update km_sector_theme_map hit rates
  Refresh planetary calendar for next 2 quarters
```

---

## Rule Confidence Tracking

```
km_rule_confidence entries for Strategic Rebirth:

sr_candidate_to_pead_rate     : SR_CANDIDATE → PEAD_ACTIVE within 30D?
sr_pead_mid_success_rate      : MID phase entry → 15%+ gain in 66D?
sr_compound_outperformance    : Compound vs single-trigger performance gap
sr_planet_prealert_accuracy   : Did planetary window precede geopolitical event?
sr_trigger_type_performance   : Which trigger type has best hit rate?
sr_filing_signal_accuracy     : Does signal_tag correctly predict direction?
sr_fpb_terminal_rate          : What % of SR plays end with FPB burst?
sr_to_stage2_conversion       : What % become Stage 2 Leaders eventually?
```

Minimum 30 signals per trigger type before confidence rating published.

---

## Alert Naming Convention

```
SR_CANDIDATE:
  "[SYMBOL] — 🌱 Rebirth Candidate | [TRIGGER_TYPE] | Day 0"

SR_PEAD_ACTIVE (EARLY):
  "[SYMBOL] — PEAD Starting | Day [N] | 5D Green"

SR_PEAD_ACTIVE (MID):
  "[SYMBOL] — 🌊 PEAD Active | Day [N] | All Timeframes Green | ★★"

SR_COMPOUND (MID):
  "[SYMBOL] — 🔥 COMPOUND PEAD | [N] Triggers | Day [N] | ★★★"

SR_PLANET_PREALERT:
  "[SYMBOL] — 🪐 Planetary Pre-Alert | [Configuration] | [Sector]"

MAXIMUM CONVICTION:
  "[SYMBOL] — 🌋 STRATEGIC REBIRTH | Compound PEAD + Planetary + ★★★"
```

---

## DristiQ Is a Weather Report

Strategic Rebirth does not tell the trader what to buy. It reads the atmospheric conditions:

```
Technical atmosphere:   Heatmap green, GL accumulation, RS divergence
Fundamental atmosphere: Filing trigger, PEAD cycle day, business health
Geopolitical atmosphere: Event trigger type, theme-sector alignment
Planetary atmosphere:   Observation window, dc_score, override conditions
```

When all four atmospheres align in the same direction for the same stock — that is the DristiQ weather report at its most complete. The trader makes the decision. DristiQ makes the conditions visible.

---

*Document Version 1.0 — June 2026*  
*Part of DristiQ Scanner Rule Suite alongside WAKING_GIANTS_RULE.md and FLOWER_POT_BURST_RULE.md*  
*Next review: After 30 SR signals recorded in km_rule_confidence*
