# SEBI Sweep Skill

## Purpose
Audit and replace non-SEBI-compliant language across 
DristiQ frontend. SEBI regulations prohibit directional 
investment recommendations in unregistered platforms.
This skill enforces neutral, factual language everywhere.

## When to Use
- Before any sprint completion
- After adding new UI text, labels, tooltips, badges
- When onboarding new components or pages
- When VaNi generates new language
- Run as final check before any production deployment

## Governing Principles (from POA.md D1, D2, D15)
- D1: DristiQ is a data platform, not a signal engine
- D2: VaNi never makes directional calls
- D15: Forbidden phrases are phrase-level blocks, 
       not blanket word bans

## Forbidden — Visible UI Labels Only
These are forbidden as VISIBLE text in the UI.
Not forbidden as variable names, DB columns, 
code comments, or type definitions.

### Directional Signal Words
| Forbidden | Replace With |
|-----------|-------------|
| Strong Bull | Strong Uptrend |
| Strong Bear | Strong Downtrend |
| Bull | Uptrend |
| Bear | Downtrend |
| Bullish | Positive |
| Bearish | Negative |
| Buy | Entry (if signal context) |
| Sell | Exit (if signal context) |
| Buy signal | Entry signal |
| Sell signal | Exit signal |

### Flow / Activity Words
| Forbidden | Replace With |
|-----------|-------------|
| Accumulation | Rising Flow |
| Distribution | Falling Flow |
| Hot (as in "hot money signal") | Elevated |
| White-hot | Peak Flow |
| Accumulating | Flow Increasing |
| Distributing | Flow Decreasing |

### Recommendation Words
| Forbidden | Replace With |
|-----------|-------------|
| Recommended | Observed |
| Signal to buy | Condition met |
| Signal to sell | Condition met |
| Target | Reference level |
| Stop loss | Risk level |

## Safe Words (never flag these)
These are factual and SEBI-safe:
- Positive / Negative (return direction)
- Rising / Falling (factual price direction)
- Above / Below (factual comparison)
- Strong / Weak (flow intensity, not direction)
- High / Low (factual levels)
- Flow Entering / Flow Exiting (factual)
- Uptrend / Downtrend (factual description)
- Score (computed metric, not recommendation)
- Surge (factual volume description)
- MagicRS (proprietary metric name — safe)
- Stage 1/2/3/4 (Weinstein stage labels — safe)
- VaNi (proprietary AI name — safe)

## Scope
Search: App/frontend/src/ 
File types: .tsx .ts .jsx .js
Target: visible UI text only

Exclude from search:
- Variable names and identifiers
- Type definitions and interfaces  
- DB column names
- Code comments
- Import statements
- CSS class names
- console.log statements

## Audit Procedure

### Step 1 — Search
Run grep for each forbidden term (case insensitive):
  grep -rn --include="*.tsx" --include="*.ts" \
    -i "strong bull\|strong bear\|bullish\|bearish\|\
accumulation\|distribution\|buy signal\|sell signal" \
    App/frontend/src/

### Step 2 — Triage
For each match determine:
  VISIBLE: shown to user in UI → flag for replacement
  INTERNAL: variable/type/comment → skip

### Step 3 — Report
Output format:
  FILE | LINE | CURRENT TEXT | PROPOSED REPLACEMENT | VISIBLE?

### Step 4 — Confirm
Present report. Wait for confirmation before any changes.

### Step 5 — Replace
Apply only confirmed replacements.
Use str_replace for surgical changes — never sed on 
entire files.
One replacement at a time, verify each.

### Step 6 — Verify
Re-run grep to confirm zero remaining violations.
Report: "SEBI sweep complete — 0 violations found"

## VaNi Language Rules (additional)
VaNi text must also comply. Additional rules for 
AI-generated text:
- Never say "you should buy/sell"
- Never say "this is a buying opportunity"  
- Never say "expect price to rise/fall"
- Always say "data shows", "pattern indicates", 
  "historically correlates with"
- Always end sector commentary with:
  "This is not investment advice. 
   DristiQ is a data correlation platform."

## Audit Frequency
- Sprint completion: mandatory
- New component: recommended
- VaNi prompt change: mandatory
- Production deploy: mandatory

## Output
After sweep completion, add to commit message:
  "chore: SEBI sweep — N violations fixed"

If zero violations:
  "chore: SEBI sweep — 0 violations confirmed clean"
