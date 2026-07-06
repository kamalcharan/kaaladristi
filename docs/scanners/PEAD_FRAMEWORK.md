# PEAD RESEARCH FRAMEWORK — DristiQ Intelligence Document

**Document ID:** INTEL_PEAD_FRAMEWORK  
**Version:** 1.0  
**Type:** Research Framework + Implementation Specification  
**Related Scanners:** Strategic Rebirth, Waking Giants, Flower Pot Burst  
**Primary Table:** `km_pead_tracker`

---

## What Is PEAD

**Post Earnings Announcement Drift (PEAD)** is one of the most robust and replicated anomalies in financial markets research. Originally documented by Ball and Brown (1968) and extensively validated since:

```
After a POSITIVE earnings surprise:
  Stock price continues drifting UP for 60–90 days
  Market does not immediately price in the full good news
  Slow institutional belief updating drives the drift

After a NEGATIVE earnings surprise:
  Stock price continues drifting DOWN for 60–90 days
  Same mechanism in reverse

Why it persists:
  Day 0 (announcement):  Algos and fast money react immediately
  Day 1–5:               Analysts update models, revise targets
  Day 6–22:              Fund managers rebalance portfolios
  Day 23–66:             Retail and slower institutional money follows
  Day 66–90:             Full consensus repricing complete
```

PEAD is not a glitch. It is a **structural feature of how information diffuses through markets** — different participant types update their beliefs at different speeds.

---

## DristiQ Extension — Beyond Earnings PEAD

Standard PEAD research focuses on earnings announcements. DristiQ extends the framework to three trigger types, all of which produce the same 60–90 day drift mechanism:

```
TYPE 1 — EARNINGS MISREAD
TYPE 2 — POLICY CATALYST  
TYPE 3 — GEOPOLITICAL THEME
```

The drift mechanism is identical across all three. What changes is:
- The Day 0 event
- The information asymmetry (who reads it correctly)
- The speed of retail discovery
- The duration of the drift

---

## The Three PEAD Trigger Types

### TYPE 1 — Earnings Misread

```
What happens:
  Company reports quarterly result
  HEADLINE metric looks bad (revenue falls, PAT flat)
  UNDERLYING metric is improving (margins, EBITDA, cash flow)
  Market reads NEGATIVE
  Smart money reads POSITIVE

Information asymmetry:
  Retail: reads revenue line → sells or ignores
  Smart money: reads margin trajectory → buys quietly

PEAD drift:
  Price drifts up as institutional buyers accumulate
  Retail remains confused for 30–45 days
  Analyst reports eventually validate the thesis
  Retail discovery begins Day 45–60
  Full repricing by Day 90

NSE Reference Example:
  Solara Active Pharma
  Event: Exited ibuprofen manufacturing (low-margin bulk API)
  Market read: Revenue falling — company shrinking
  Smart money read: Low-margin drag removed, EBITDA expanding
  Drift: Consistent heatmap green for 3 months
  
Typical drift duration: 60–90 days
Typical magnitude: 20–60% depending on degree of misread
```

### TYPE 2 — Policy Catalyst

```
What happens:
  Government policy / legislation announced
  Creates new TAM or strategic relevance for existing company
  Company's existing capability suddenly irreplaceable
  Market hasn't connected the dots yet
  Smart money researches, positions quietly

Information asymmetry:
  Retail: reads policy as macro news → ignores sector
  Smart money: maps policy to specific company capability → buys

PEAD drift:
  Policy announced (Day 0)
  Smart money positions Day 0–15
  Analyst research surfaces Day 15–45
  Retail discovery Day 45–60
  Full repricing Day 60–90

NSE Reference Examples:
  DEE Development Engineers
  Event: SHANTI Bill + India Nuclear Energy Mission (100GW by 2047)
  Market read: Another power sector company
  Smart money read: Only private sector company with ASME Section IX
                    certification and BoTIP zone capability for nuclear
  
  Walchandnagar Industries
  Event: Same nuclear policy window
  Market read: Old industrial company, thin growth
  Smart money read: 116-year-old factory with defence-grade machining
                    and ₹938 crore live order book

Typical drift duration: 90–180 days (longer than earnings PEAD)
Typical magnitude: 50–150% (policy creates new multi-year TAM)
```

### TYPE 3 — Geopolitical Theme

```
What happens:
  Global event creates supply/demand disruption
  Niche Indian manufacturer sits at intersection
  Thematic capital rotates in
  Company then compounds with fundamental delivery

Information asymmetry:
  Retail: reads geopolitical news → buys obvious large caps
  Smart money: maps disruption to niche capability holder → buys dormant

PEAD drift:
  Geopolitical event (Day 0)
  Thematic capital rotation Day 0–22
  Company's Q result confirms capability Day 22–45
  Management guidance adds second PEAD wave Day 45–66
  Viral analyst research adds third wave Day 66–90

NSE Reference Example:
  Aeroflex Industries
  Trigger 1 (Day 0): US-Iran tensions → liquid/gas infrastructure stress
  Trigger 2 (Day 22): Q4 FY26 result — 617 liquid cooling skids ₹21.2Cr
  Trigger 3 (Day 45): FY27 guidance 30–35% growth, higher-margin mix
  = Compounding PEAD — three waves in one 90-day window
  = 3-month golden run of consistent heatmap green

Typical drift duration: 60–120 days
Typical magnitude: 40–120%
```

---

## Compounding PEAD — The Golden Run Pattern

When multiple PEAD triggers fire within a 66-day window on the same stock, the drift waves overlap and compound:

```
Single trigger PEAD:
  One drift wave — 60–90 days
  Magnitude: X%
  
Compounding PEAD (2 triggers within 66D):
  Two overlapping drift waves
  Duration: 90–120 days
  Magnitude: 1.5–2.5x single trigger
  Consistency: Heatmap green across all timeframes throughout
  
Compounding PEAD (3 triggers within 66D):
  Three overlapping drift waves
  Duration: 120–180 days
  Magnitude: 2–4x single trigger
  = The "golden run" you observe as 3–4 months of consistent green

Compound flag:
  trigger_count >= 2
  AND all triggers within 66D window
  AND all in same direction
  AND all_timeframes_green throughout
```

### Compound PEAD Combinations Observed

```
POLICY + CAPABILITY_DISCOVERY:
  DEE — nuclear policy + viral analyst thread on ASME capability
  Mechanism: institutional buys on policy, retail buys on research
  Double drift: 2 distinct buyer pools entering at different speeds

GEOPOLITICAL + VALUE_CHAIN_UPGRADE:
  Aeroflex — US-Iran tensions + data center cooling pivot
  Mechanism: thematic capital + fundamental confirmation
  Triple drift: geo buyers + earnings buyers + guidance buyers

STRATEGIC_EXIT + EARNINGS_MISREAD:
  Solara — ibuprofen exit + margin expansion misread
  Mechanism: both triggers on same result — amplified drift
  Duration: full 90-day cycle on a single quarterly result
```

---

## The Heatmap Fingerprint

Consistent multi-timeframe green is the **visible fingerprint of PEAD** in DristiQ's heatmap system.

```
5D green:   Smart money positioned (Day 1–5 after trigger)
22D green:  Analysts revised, institutional rebalancing (Day 6–22)
66D green:  Drift fully running, all participant types joining (Day 23–66)

All three simultaneously green:
  You are in the MID phase of a PEAD drift (Day 23–60)
  Most runway remaining
  Lowest information risk
  = OPTIMAL ENTRY WINDOW
```

### Heatmap Fingerprint — PEAD vs Momentum

```
Momentum stock heatmap green:
  Already known, already priced in
  Everyone sees it, crowded trade
  High reversal risk
  Price near ATH

PEAD stock heatmap green:
  Structural drift in progress
  Market still catching up
  Price still well below ATH
  GL accumulation days building
  = The divergence between heatmap and price is the signal
```

### Entry Windows by Heatmap State

```
5D green only:
  PEAD Day 1–5 — very early
  Smart money just entering
  Risk: thesis not yet confirmed
  Position: small starter only

5D + 22D green:
  PEAD Day 15–22 — early-mid
  Analysts revising
  GL accumulation building
  Position: 50% of target size

All three green:
  PEAD Day 23–60 — MID PHASE
  Full institutional rebalancing
  GL accumulation confirmed
  RS slope divergence appearing
  Position: full size — OPTIMAL

All three green + price near ATH:
  PEAD Day 75–90 — LATE
  Retail discovery complete
  Watch for Flower Pot Burst (terminal event)
  Position: only FPB burst play, not new positional
```

---

## PEAD Tracker — Data Architecture

### km_pead_tracker Table

```sql
km_pead_tracker:
  
  -- Identity
  tracker_id          SERIAL PRIMARY KEY
  symbol              VARCHAR(20) NOT NULL
  
  -- Trigger
  day_0_date          DATE NOT NULL        -- event date (filing/result/geo)
  trigger_type        VARCHAR(30)          -- EARNINGS_MISREAD / POLICY_CATALYST /
                                           -- GEOPOLITICAL_THEME / CAPABILITY_DISCOVERY /
                                           -- VALUE_CHAIN_UPGRADE / STRATEGIC_EXIT /
                                           -- COMPOUND
  trigger_description TEXT                 -- human readable summary of Day 0 event
  filing_ref_id       INTEGER              -- FK → km_corporate_filings
  geo_event_id        INTEGER              -- FK → km_geopolitical_events
  planet_window_id    INTEGER              -- FK → km_astro_observation_windows
  
  -- PEAD cycle tracking (updated daily)
  pead_day            INTEGER              -- current day in drift (0-90+)
  pead_phase          VARCHAR(10)          -- EARLY / MID / LATE / POST
  drift_pct_total     DECIMAL(6,2)         -- total price move since Day 0
  
  -- Heatmap readings (updated daily)
  return_5d           DECIMAL(6,2)
  return_22d          DECIMAL(6,2)
  return_66d          DECIMAL(6,2)
  heatmap_5d_green    BOOLEAN
  heatmap_22d_green   BOOLEAN
  heatmap_66d_green   BOOLEAN
  all_timeframes_green BOOLEAN             -- all three TRUE simultaneously
  consecutive_green_days INTEGER           -- days all three green in a row
  
  -- GL accumulation (from Waking Giants framework)
  gl_acc_days         INTEGER              -- qualifying delivery vol days at GL
  gl_acceleration     DECIMAL(4,2)         -- recent vs early density ratio
  
  -- RS divergence
  rs_slope_daily      DECIMAL(6,4)
  rs_slope_weekly     DECIMAL(6,4)
  slope_divergence    DECIMAL(6,4)
  
  -- Compound tracking
  trigger_count       INTEGER DEFAULT 1    -- how many PEAD triggers fired
  trigger_dates       DATE[]               -- array of trigger dates
  compound_flag       BOOLEAN              -- trigger_count >= 2 within 66D
  
  -- Flower Pot watch
  fpb_setup_active    BOOLEAN DEFAULT FALSE
  fpb_burst_triggered BOOLEAN DEFAULT FALSE
  fpb_burst_date      DATE
  
  -- Status
  status              VARCHAR(20)          -- ACTIVE / CLOSED_SUCCESS /
                                           -- CLOSED_FAILED / MONITORING
  close_date          DATE
  close_pct_move      DECIMAL(6,2)         -- final move on close
  close_reason        TEXT
  
  -- Timestamps
  created_at          TIMESTAMP DEFAULT NOW()
  updated_at          TIMESTAMP DEFAULT NOW()
```

### Key Computed Queries

```sql
-- Active PEAD stocks in MID phase (optimal entry window)
SELECT 
  symbol,
  trigger_type,
  pead_day,
  drift_pct_total,
  gl_acc_days,
  slope_divergence,
  trigger_count,
  compound_flag
FROM km_pead_tracker
WHERE status = 'ACTIVE'
  AND pead_phase = 'MID'
  AND all_timeframes_green = TRUE
  AND drift_pct_total < 40    -- still has runway
ORDER BY compound_flag DESC, gl_acc_days DESC;

-- Compound PEAD stocks (highest conviction)
SELECT
  symbol,
  trigger_count,
  trigger_dates,
  drift_pct_total,
  pead_day,
  consecutive_green_days
FROM km_pead_tracker
WHERE compound_flag = TRUE
  AND status = 'ACTIVE'
  AND all_timeframes_green = TRUE
ORDER BY trigger_count DESC, consecutive_green_days DESC;

-- PEAD stocks approaching terminal event (Flower Pot watch)
SELECT
  symbol,
  pead_day,
  drift_pct_total,
  fpb_setup_active
FROM km_pead_tracker
WHERE pead_phase = 'LATE'
  AND status = 'ACTIVE'
  AND all_timeframes_green = TRUE
ORDER BY pead_day DESC;

-- Historical performance by trigger type
SELECT
  trigger_type,
  COUNT(*) AS total_signals,
  AVG(close_pct_move) AS avg_move,
  AVG(pead_day) AS avg_days_held,
  COUNT(*) FILTER (WHERE close_pct_move > 15) AS wins,
  ROUND(COUNT(*) FILTER (WHERE close_pct_move > 15) * 100.0 / COUNT(*), 1) AS win_rate_pct
FROM km_pead_tracker
WHERE status IN ('CLOSED_SUCCESS', 'CLOSED_FAILED')
GROUP BY trigger_type
ORDER BY avg_move DESC;
```

---

## PEAD Phase Calendar

For each active PEAD stock, DristiQ tracks the expected timeline:

```
Day 0:         Trigger event (filing / result / geo event)
               km_pead_tracker record created

Day 1–5:       EARLY phase begins
               Monitor: 5D heatmap turning green?
               Monitor: GL accumulation starting?
               Signal: SR_CANDIDATE

Day 5–22:      EARLY phase continues
               Monitor: 22D heatmap turning?
               Monitor: GL acceleration?
               Monitor: RS weekly delta?
               Signal: SR_PEAD_ACTIVE (EARLY)

Day 23–60:     MID phase — optimal entry window
               Confirm: All three timeframes green?
               Confirm: GL accumulation ≥ 10 days?
               Confirm: RS slope divergence > 0.3?
               Signal: SR_PEAD_ACTIVE (MID) ★★

Day 23–60:     Check for COMPOUND trigger
               Second filing / result / geo event in same stock?
               If yes: SR_COMPOUND fires ★★★

Day 60–90:     LATE phase
               Watch: Flower Pot Burst compression forming?
               Watch: Volume dying after sustained run?
               Watch: Monthly distribution candle?
               Signal: FPB_SETUP if compression detected

Day 90+:       POST phase
               Decision: Exit or continue?
               New base forming OR Stage 2 confirmed?
               Close km_pead_tracker record with outcome
```

---

## PEAD + Planetary Observation Windows

The most powerful PEAD setups occur when the trigger event coincides with an active planetary observation window for that sector:

```
Pre-PEAD planetary alert:
  km_astro_observation_windows active
  + Sector matches correlated_sectors[]
  + Dormant stock in that sector
  = Planetary pre-positioning BEFORE Day 0

  Example: Saturn in Pisces active
           (fluid handling / maritime sector alert)
           + Aeroflex dormant in fluid handling
           + US-Iran tensions Day 0
           = Saturn in Pisces PREDICTED the Aeroflex opportunity
             before the geopolitical trigger fired

Post-PEAD planetary confirmation:
  Active PEAD drift
  + Planetary window still open
  + dc_score ≥ 65
  = Extended runway — drift likely to continue
  
  Active PEAD drift
  + Planetary window CLOSING
  + New negative configuration beginning
  = PEAD may truncate early — tighten exit

```

---

## PEAD Research Workstream — Historical Validation

### Last 4 Incidents (Priority — NSE data available)

For each incident, study:
1. What transits were active ±15 days
2. Which sectors moved in 5D, 22D, 66D after event
3. Which stocks showed GL accumulation in those sectors
4. What was the lag from transit to GL accumulation start
5. What was the lag from GL accumulation to price move

```
Incident 1: COVID Declaration (March 11, 2020)
  Study sectors: Pharma, IT (WFH), FMCG, Defence, Auto
  PEAD question: Which sectors had positive PEAD (not crash recovery)?
  Expected: Pharma API, IT services (positive PEAD despite market crash)

Incident 2: Russia-Ukraine War (February 24, 2022)
  Study sectors: Defence, Metals, Energy, Pharma, IT
  PEAD question: Which stocks had 60–90D sustained drift post-event?
  Expected: Defence (HAL, BEL), Metals (positive early), 
            Pharma API (Russia supply disruption)

Incident 3: Hamas October 7 (October 7, 2023)
  Study sectors: Defence, Oil & Gas, Maritime, Safe Transfer
  PEAD question: Which NSE stocks had sustained green after event?
  Expected: Defence manufacturing, Aeroflex (fluid/safe transfer)

Incident 4: Red Sea Shipping (December 15, 2023)
  Study sectors: Shipping, Fluid Handling, LNG, Port logistics
  PEAD question: This is the Aeroflex PEAD trigger — validate the drift
  Expected: Aeroflex sustained green confirmed, GL accumulation start date
```

### Output Format for Each Incident

```sql
-- Insert into km_pead_tracker for historical incidents
INSERT INTO km_pead_tracker (
  symbol, day_0_date, trigger_type, trigger_description,
  pead_day, pead_phase, drift_pct_total, status, close_date,
  close_pct_move, close_reason
)
VALUES (
  'AEROFLEX', '2023-12-15', 'GEOPOLITICAL_THEME',
  'Red Sea shipping attacks — Saturn in Pisces active — fluid/safe transfer demand',
  90, 'POST', 85.0, 'CLOSED_SUCCESS', '2024-03-15',
  85.0, 'PEAD complete, Flower Pot Burst fired, Stage 2 confirmed'
);
```

---

## PEAD Signal Confidence Tracking

```sql
-- In km_rule_confidence:
pead_early_to_mid_rate      : Did EARLY phase stocks reach MID phase?
pead_mid_success_rate        : MID phase entry → 15%+ gain in 66D?
pead_compound_outperformance : Compound vs single trigger performance gap
pead_trigger_type_ranking    : Which trigger type has highest magnitude?
pead_heatmap_entry_value     : Does all-three-green entry beat 5D-only?
pead_gl_correlation          : Higher GL acc days = better PEAD outcome?
pead_fpb_terminal_rate       : What % of PEAD plays end with FPB burst?
pead_planet_window_extension : Does active planet window extend drift?
```

---

## PEAD — The SEBI-Safe Framing

PEAD is an academic research concept — not a buy/sell recommendation:

```
What DristiQ says:
  "PEAD drift pattern observed — Day [N] of cycle"
  "Historical pattern: 60–90 day drift post [trigger type]"
  "All three heatmap timeframes green — drift mid-phase"
  "Atmospheric conditions consistent with continued drift"

What DristiQ never says:
  "Buy this stock"
  "Price target ₹X"
  "Expected return Y%"

Academic backing:
  Ball and Brown (1968) — original PEAD documentation
  Bernard and Thomas (1989) — PEAD persistence validation
  Hundreds of replications across global markets including India
  DristiQ: extension to policy and geopolitical triggers (original)
```

---

*Document Version 1.0 — June 2026*  
*Companion to: STRATEGIC_REBIRTH_RULE.md, WAKING_GIANTS_RULE.md,*  
*FLOWER_POT_BURST_RULE.md, PLANETPULSE_RULE.md*
