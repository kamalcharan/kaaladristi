# NSE FILINGS INTELLIGENCE — DristiQ Implementation Specification

**Document ID:** INTEL_NSE_FILINGS  
**Version:** 1.0  
**Type:** Implementation Specification + Data Architecture  
**Related Scanners:** Strategic Rebirth, Waking Giants  
**Primary Table:** `km_corporate_filings`

---

## Why Filings Matter

NSE corporate filings are the **earliest structured signal** of a company's strategic direction change. They precede price movement by days to weeks. A filing that the market misreads or ignores becomes the Day 0 trigger for a PEAD drift — but only if you read it correctly.

```
Standard screener approach:
  Watch price → price breaks out → buy
  = Enter at Day 30–45 of the move

DristiQ filings approach:
  Filing detected → classified → PEAD watch starts
  → GL accumulation confirms → enter
  = Enter at Day 15–22 of the move

Edge: 15–30 day earlier entry
      Better price, wider upside, same risk
```

### The Solara Example

```
Filing: Discontinuing ibuprofen manufacturing (bulk API exit)
Market read: Revenue will fall — negative
DristiQ read: Strategic Exit signal — PEAD trigger TYPE 1

Without filings intelligence:
  You see revenue fall in next quarter → confused or negative
  Entry: Day 45+ if you ever enter

With filings intelligence:
  Filing detected Day 0 → SR_CANDIDATE fires immediately
  PEAD watch begins → GL accumulation monitored
  Entry: Day 15–22 optimal window
```

---

## NSE Filing Sources

### Source 1 — NSE EDGAR API (Primary)

```
Base URL: https://www.nseindia.com/api/

Key endpoints:
  /corporates-announcements
    Parameters: symbol, from_date, to_date, category
    Returns: JSON array of announcements with metadata
    
  /corporates-financial-results
    Parameters: symbol, period
    Returns: quarterly/annual financial results filings
    
  /corporates-bulk-deals
    Returns: bulk and block deal disclosures
    
  /corporates-shareholding-patterns
    Parameters: symbol, quarter
    Returns: quarterly SHP data (promoter/FII/DII/retail)

Rate limits: Implement 2-second delay between requests
Auth: Session cookie required (rotate regularly)
Format: JSON — fully parseable
```

### Source 2 — NSE Direct PDF + XML Downloads

```
Newer filings: structured XML alongside PDF
Category codes for filtering:
  30000 — Board Meeting outcomes
  501   — Press Release  
  401   — Analyst/Investor Meet update
  601   — Agreements / MoUs
  701   — Change in Management
  801   — Acquisition / Disposal of Assets
  901   — Restructuring
  1001  — Regulatory / Statutory
```

### Source 3 — BSE Filings (Secondary, cross-reference)

```
BSE API more accessible than NSE for some filing types
Use as cross-reference when NSE API returns incomplete data
BSE XBRL filings have more structured financial data
```

---

## km_corporate_filings — Table Schema

```sql
km_corporate_filings:

  -- Identity
  filing_id           SERIAL PRIMARY KEY
  symbol              VARCHAR(20) NOT NULL
  exchange            VARCHAR(5) DEFAULT 'NSE'  -- NSE / BSE
  
  -- Filing metadata
  filing_date         DATE NOT NULL
  filing_time         TIME
  category_code       VARCHAR(10)
  category_name       VARCHAR(100)
  headline_text       TEXT NOT NULL             -- original NSE headline
  filing_url          TEXT                      -- direct link to document
  document_type       VARCHAR(10)               -- PDF / XML / HTML
  
  -- Classification (DristiQ computed)
  signal_tag          VARCHAR(30)               -- classified signal type
                                                -- NULL if no signal detected
  signal_strength     INTEGER                   -- 1 (weak) to 5 (strong)
  signal_keywords     TEXT[]                    -- matched keywords
  human_reviewed      BOOLEAN DEFAULT FALSE     -- Charan validated?
  human_override      VARCHAR(30)               -- manual override of auto-tag
  
  -- PEAD linkage
  pead_trigger        BOOLEAN DEFAULT FALSE     -- starts a PEAD watch?
  trigger_type        VARCHAR(30)               -- maps to PEAD trigger taxonomy
  pead_tracker_id     INTEGER                   -- FK → km_pead_tracker (set on confirm)
  
  -- Processing
  raw_text_extracted  TEXT                      -- extracted text from PDF/XML
  processed           BOOLEAN DEFAULT FALSE
  processed_at        TIMESTAMP
  
  -- Timestamps
  created_at          TIMESTAMP DEFAULT NOW()
  updated_at          TIMESTAMP DEFAULT NOW()

-- Indexes
CREATE INDEX idx_filings_symbol ON km_corporate_filings(symbol);
CREATE INDEX idx_filings_date ON km_corporate_filings(filing_date DESC);
CREATE INDEX idx_filings_signal ON km_corporate_filings(signal_tag) WHERE signal_tag IS NOT NULL;
CREATE INDEX idx_filings_pead ON km_corporate_filings(pead_trigger) WHERE pead_trigger = TRUE;
```

---

## Signal Tag Classification

### Complete Signal Tag Taxonomy

```
STRATEGIC_EXIT
  Company exits a product line, segment, or geography
  Usually revenue-negative short term, quality-positive medium term
  = TYPE 1 PEAD trigger (earnings misread)
  Strength: 4–5
  Examples: Solara exits ibuprofen, company divests non-core subsidiary

VALUE_CHAIN_UPGRADE
  Company enters higher-margin product/service
  Revenue-positive AND margin-positive
  = TYPE 1 PEAD trigger (market underestimates mix improvement)
  Strength: 4–5
  Examples: Aeroflex adds data center cooling skids

CAPACITY_EXPANSION
  New plant, greenfield, brownfield, capacity addition
  After long pause = significant signal (company investing again)
  Strength: 3–4
  Examples: New manufacturing facility after 3+ years of no capex

REGULATORY_APPROVAL
  USFDA ANDA approval, EMA clearance, CDSCO product license,
  ASME certification, nuclear/defence qualification
  = CAPABILITY_DISCOVERY trigger (hidden moat now documented)
  Strength: 4–5
  Examples: DEE ASME certification, Solara USFDA product approval

ORDER_WIN
  Large order received, long-term supply agreement signed,
  repeat order (confirms sustained demand)
  NSE mandate: disclose if > material threshold
  Strength: 3–5 (depends on size relative to revenue)

PROMOTER_BUYING
  Open market purchase by promoter
  Creeping acquisition
  Cross-reference with bulk deal data
  = Insider conviction signal
  Strength: 4–5
  Examples: Promoter buys 0.5%+ in open market

DEBT_REDUCTION
  Prepayment of term loan/NCD
  Pledge release by promoters
  Credit rating upgrade
  = Balance sheet repair signal
  Strength: 3–5 (pledge release = very high signal)

BALANCE_SHEET_REPAIR
  QIP completed (dilution done, now clean)
  Rights issue fully subscribed
  Asset monetisation (non-core sale)
  Working capital improvement disclosure
  Strength: 3–4

CAPABILITY_DISCLOSURE
  Investor presentation / analyst meet revealing hidden moat
  Technical capability paper published
  New certification / accreditation announced
  = Often triggers capability discovery PEAD
  Strength: 3–4

MANAGEMENT_CHANGE
  New CEO/MD with specific domain expertise
  Appointment of industry-specific independent director
  = Directional change signal (positive or negative)
  Strength: 2–4 (context dependent)

NEGATIVE_SIGNALS (tracked but not PEAD triggers):
  PROMOTER_SELLING      → promoter offloading shares
  PLEDGE_INCREASE       → promoters pledging more shares
  REGULATORY_ACTION     → SEBI/NCLT/tax notices
  DEBT_INCREASE         → new large borrowing
  AUDIT_QUALIFICATION   → auditor qualified or resigned
  These are reverse signals — remove from Giants watchlist if present
```

---

## Keyword Detection Engine — V1

Rule-based keyword matching on headline_text. Catches 80% of high-signal filings without NLP.

```python
FILING_SIGNAL_RULES = {

  "STRATEGIC_EXIT": {
    "keywords": [
      "discontinue", "discontinuing", "exit", "divest", "divestment",
      "wind down", "winding down", "discontinue manufacturing",
      "sell business unit", "focus on core", "divesting",
      "strategic review completed", "non-core asset sale"
    ],
    "strength": 4,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  "VALUE_CHAIN_UPGRADE": {
    "keywords": [
      "new product launch", "higher margin product", "new segment entry",
      "technology upgrade", "value added product", "premium product line",
      "new application", "expanded portfolio", "new end market"
    ],
    "strength": 4,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  "CAPACITY_EXPANSION": {
    "keywords": [
      "new plant", "greenfield", "brownfield", "capacity addition",
      "new facility", "plant expansion", "capital expenditure",
      "new manufacturing", "capacity enhancement", "new production line"
    ],
    "strength": 3,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  "REGULATORY_APPROVAL": {
    "keywords": [
      "USFDA", "USFDA approval", "EMA approval", "EMA clearance",
      "CDSCO approval", "product approval", "ANDA approval",
      "manufacturing license", "ASME", "ASME certification",
      "nuclear qualification", "defence qualification",
      "DRDO approval", "HAL qualified", "ISRO qualified",
      "certified vendor", "approved vendor list"
    ],
    "strength": 5,
    "pead_trigger": True,
    "trigger_type": "CAPABILITY_DISCOVERY"
  },

  "ORDER_WIN": {
    "keywords": [
      "order received", "order win", "contract awarded",
      "supply agreement", "long term agreement", "long-term agreement",
      "repeat order", "export order", "new customer",
      "letter of intent", "LOI received", "purchase order"
    ],
    "strength": 3,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  "PROMOTER_BUYING": {
    "keywords": [
      "acquisition of shares", "open market purchase",
      "promoter acquires", "creeping acquisition",
      "increased stake", "bought shares from open market"
    ],
    "strength": 4,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  "DEBT_REDUCTION": {
    "keywords": [
      "debt repaid", "prepayment of loan", "NCD redemption",
      "early repayment", "credit rating upgrade",
      "pledge released", "pledge reduction", "debt free",
      "zero debt", "repaid term loan", "prepaid external"
    ],
    "strength": 4,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  "BALANCE_SHEET_REPAIR": {
    "keywords": [
      "QIP proceeds", "rights issue", "QIP completed",
      "rights issue subscribed", "asset sale proceeds",
      "monetisation of asset", "working capital improvement",
      "NPA resolved", "one time settlement"
    ],
    "strength": 3,
    "pead_trigger": True,
    "trigger_type": "EARNINGS_MISREAD"
  },

  # NEGATIVE signals — reverse watchlist
  "PROMOTER_SELLING": {
    "keywords": [
      "promoter sells", "promoter disposed", "stake sale by promoter"
    ],
    "strength": -4,
    "pead_trigger": False,
    "watchlist_action": "REVIEW_REMOVE"
  },

  "PLEDGE_INCREASE": {
    "keywords": [
      "pledge created", "shares pledged", "pledge increased",
      "additional pledge"
    ],
    "strength": -3,
    "pead_trigger": False,
    "watchlist_action": "FLAG_CAUTION"
  },
}
```

### Keyword Matching Function (Python)

```python
def classify_filing(headline_text: str) -> dict:
    """
    Classify a filing headline and return signal tag + strength.
    Returns None if no signal detected.
    """
    headline_lower = headline_text.lower()
    
    results = []
    
    for signal_tag, rule in FILING_SIGNAL_RULES.items():
        matched_keywords = [
            kw for kw in rule["keywords"]
            if kw.lower() in headline_lower
        ]
        
        if matched_keywords:
            results.append({
                "signal_tag": signal_tag,
                "signal_strength": rule["strength"],
                "matched_keywords": matched_keywords,
                "pead_trigger": rule.get("pead_trigger", False),
                "trigger_type": rule.get("trigger_type"),
                "watchlist_action": rule.get("watchlist_action"),
            })
    
    if not results:
        return None
    
    # Return highest strength signal if multiple match
    return max(results, key=lambda x: abs(x["signal_strength"]))


def process_filing_batch(filings: list) -> list:
    """
    Process a batch of filings from NSE API.
    Returns list of classified filings ready for DB insert.
    """
    classified = []
    
    for filing in filings:
        classification = classify_filing(filing["headline"])
        
        row = {
            "symbol": filing["symbol"],
            "filing_date": filing["date"],
            "category_code": filing["category_code"],
            "category_name": filing["category_name"],
            "headline_text": filing["headline"],
            "filing_url": filing["url"],
            "signal_tag": classification["signal_tag"] if classification else None,
            "signal_strength": classification["signal_strength"] if classification else None,
            "signal_keywords": classification["matched_keywords"] if classification else [],
            "pead_trigger": classification["pead_trigger"] if classification else False,
            "trigger_type": classification["trigger_type"] if classification else None,
            "processed": True,
            "processed_at": datetime.now(),
        }
        classified.append(row)
    
    return classified
```

---

## Ingestion Pipeline Architecture

### Daily Pull (Post-Market, 4:30 PM onwards)

```
Step 1: Pull new filings from NSE API
        For all symbols in:
          km_giants_watchlist (priority)
          km_equity_symbols (full universe, lower priority)
        Window: last 24 hours
        
Step 2: Classify each filing
        Run keyword matching
        Assign signal_tag, signal_strength
        Flag pead_trigger = TRUE if applicable
        
Step 3: Insert into km_corporate_filings
        Deduplicate on (symbol, filing_date, headline_text)
        
Step 4: For pead_trigger = TRUE filings:
        Check if symbol already in km_pead_tracker
        If NOT: create SR_CANDIDATE signal in km_rule_signals
                create km_pead_tracker record (Day 0)
        If YES: check if this is a compound trigger
                update trigger_count, trigger_dates[]
                if compound: fire SR_COMPOUND signal
                
Step 5: Human review queue
        Flag signal_strength >= 4 for Charan review
        human_reviewed = FALSE → appears in review dashboard
        30-second review: confirm or override signal_tag
        
Step 6: Negative signal processing
        signal_strength < 0 → check against watchlists
        REVIEW_REMOVE → flag for Charan to remove from watchlist
        FLAG_CAUTION → add caution flag to km_giants_watchlist
```

### Hermes Agent Integration (V2)

```
Qwen3 4B at llm.dristiq.com handles:
  High-frequency RSS monitoring (economic, market news)
  Structured JSON extraction from NSE API responses
  Keyword pre-classification before DB insert
  Writing to km_corporate_filings

Claude API (fallback for complex cases) handles:
  Full PDF text extraction and analysis
  Complex multi-paragraph filing interpretation
  "Is this filing strategically significant?" deeper analysis
  Cases where keyword matching is ambiguous

Human gate (always present):
  signal_strength >= 4 → mandatory Charan review
  Negative signals → mandatory review before watchlist action
  New signal_tag type not in taxonomy → flag for taxonomy update
```

---

## Shareholding Pattern Intelligence

SHP data (quarterly) provides additional signal quality:

```sql
km_shareholding_patterns:
  symbol
  quarter                   -- Q1FY27, Q4FY26 etc
  promoter_holding_pct
  promoter_pledge_pct
  fii_holding_pct
  dii_holding_pct
  retail_holding_pct
  
  -- Computed deltas vs previous quarter
  promoter_delta            -- positive = buying
  fii_delta                 -- positive = institutional interest rising
  dii_delta
  pledge_delta              -- negative = pledge reducing (positive signal)
  
  -- Flags
  promoter_buying_flag      -- promoter_delta > 0.5%
  fii_entering_flag         -- fii_delta > 1% (significant new interest)
  pledge_reducing_flag      -- pledge_delta < -2% (stress reducing)
  pledge_danger_flag        -- promoter_pledge_pct > 40% (danger zone)
```

### SHP Signals for Waking Giants

```
HIGH CONVICTION additions to Giants watchlist:
  promoter_buying_flag = TRUE
  AND pledge_reducing_flag = TRUE
  AND fii_entering_flag = TRUE
  = All three insiders and institutions moving positively

CAUTION — review existing watchlist positions:
  pledge_danger_flag = TRUE
  OR promoter_delta < -2% (significant selling)
  OR fii_delta < -3% (institutions exiting)
```

---

## Bulk Deal Intelligence

Bulk and block deals are the most direct institutional signal:

```sql
km_bulk_deals:
  deal_id
  symbol
  deal_date
  deal_type             -- BULK / BLOCK
  client_name           -- buyer or seller name
  deal_side             -- BUY / SELL
  quantity
  price
  value_crore           -- deal value in crore
  
  -- Classification
  is_institutional      -- boolean (FII/DII/MF name detected)
  is_promoter           -- boolean (promoter name match)
  deal_significance     -- LOW / MEDIUM / HIGH / VERY_HIGH
                           (based on value relative to avg daily volume)
```

### Bulk Deal × Waking Giants Cross

```sql
-- High-value institutional buys on dormant stocks
SELECT
  b.symbol,
  b.deal_date,
  b.client_name,
  b.value_crore,
  b.deal_significance,
  w.dormancy_score,
  w.gl_acc_days
FROM km_bulk_deals b
JOIN km_giants_watchlist w ON b.symbol = w.symbol
WHERE b.deal_side = 'BUY'
  AND b.deal_significance IN ('HIGH', 'VERY_HIGH')
  AND b.deal_date >= NOW() - INTERVAL '30 days'
  AND w.status = 'ACTIVE'
ORDER BY b.value_crore DESC;
```

A high-value institutional buy on a Waking Giant watchlist stock is one of the strongest possible confirmations — smart money is literally documented buying the dormant company.

---

## Filing Intelligence × PEAD Correlation

Historical research to build confidence tiers:

```sql
-- Which signal_tags have highest PEAD success rate?
SELECT
  f.signal_tag,
  COUNT(DISTINCT p.tracker_id) AS pead_triggers_fired,
  AVG(p.close_pct_move) AS avg_drift_magnitude,
  AVG(p.pead_day) AS avg_drift_duration,
  COUNT(*) FILTER (WHERE p.close_pct_move > 15) AS wins,
  ROUND(
    COUNT(*) FILTER (WHERE p.close_pct_move > 15) * 100.0 /
    NULLIF(COUNT(*), 0), 1
  ) AS win_rate_pct
FROM km_corporate_filings f
JOIN km_pead_tracker p ON f.pead_tracker_id = p.tracker_id
WHERE p.status IN ('CLOSED_SUCCESS', 'CLOSED_FAILED')
GROUP BY f.signal_tag
ORDER BY avg_drift_magnitude DESC;
```

Expected ranking based on session observations:
```
REGULATORY_APPROVAL     : Highest magnitude (capability unlocked = new TAM)
PROMOTER_BUYING         : Highest conviction (insider signal)
STRATEGIC_EXIT          : High magnitude (misread creates large PEAD)
DEBT_REDUCTION          : Reliable but lower magnitude
ORDER_WIN               : Variable (depends on order size / revenue ratio)
VALUE_CHAIN_UPGRADE     : High magnitude when confirmed by next result
CAPACITY_EXPANSION      : Long lead time — PEAD may start 2–3 quarters later
```

---

## Implementation Priority

```
PHASE 1 (Launch — this week):
  □ km_corporate_filings table created
  □ Manual entry for known signals:
      Solara ibuprofen exit (retroactive)
      DEE ASME capability disclosure (retroactive)
      Aeroflex cooling skid launch (retroactive)
  □ Basic keyword classifier Python function
  □ Human review queue in DristiQ UI
  
PHASE 2 (Post-launch, Week 2–3):
  □ NSE API daily pull automated (cron job)
  □ Bulk deal table + daily ingestion
  □ SHP quarterly pull automated
  □ Cross-reference with Giants watchlist automated

PHASE 3 (Post-MVP):
  □ Hermes agent integration
  □ PDF text extraction for deeper analysis
  □ Confidence tier calculation from historical data
  □ Signal_tag taxonomy expansion based on new observations
```

---

## SEBI Compliance Note

All filing intelligence is presented as:

```
"Filing detected — classified as [SIGNAL_TAG]"
"Historical pattern: this filing type precedes X% moves in Y days"
"Atmospheric observation — not investment advice"

NOT:
"Buy this stock because of this filing"
"Expected return following this filing type"
"Recommended action"
```

The filing intelligence layer surfaces information and historical patterns. The trader makes all decisions independently.

---

*Document Version 1.0 — June 2026*  
*Companion to: STRATEGIC_REBIRTH_RULE.md, PEAD_FRAMEWORK.md*  
*Suite: WAKING_GIANTS | FLOWER_POT_BURST | STRATEGIC_REBIRTH |*  
*PLANETPULSE | PEAD_FRAMEWORK | NSE_FILINGS_INTELLIGENCE*
