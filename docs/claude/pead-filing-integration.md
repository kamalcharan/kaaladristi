# PEAD + Filing Intelligence — how it reaches the product (2026-09-23)

The UI discussion the filing-intelligence handover was waiting on. Every
number below was measured on the live DB this session. Nothing is built.

---

## 0. The finding that shapes the whole design

**Only ONE filing class has positive forward drift.** Measured over Jul-Aug
2026, median 20-session drift from Day 0, against a universe median of
**-0.59%**:

| Filing class | n | 20d drift | vs market | Role |
|---|---|---|---|---|
| **Result reaction > +5%** | 278 | +0.95% | **+1.54** | **SCANNER** |
| Result reaction +2 to +5% | 288 | +0.16% | +0.75 | weak |
| Result reaction < +2% | 1,679 | -1.5 to -1.9% | -0.9 to -1.3 | avoid |
| ACQUISITION | 215 | -1.99% | **-1.40** | context only |
| LARGE_ORDER | 185 | -3.20% | **-2.61** | context only |
| LITIGATION | 86 | -2.90% | **-2.31** | WARNING |
| REGULATORY_ACTION | 129 | -2.22% | -1.63 | WARNING |
| INSOLVENCY | 61 | -2.22% | -1.63 | WARNING |
| AUDITOR_CHANGE | 147 | -0.70% | -0.11 | noise |

⚠ **The "Spark" scanner concept does not survive measurement.** LARGE_ORDER
pops **+2.07% on Day 0 and gives back 3.20% over the next month** — the same
pop-then-fade shape as `dot_svd`. A scanner listing LARGE_ORDER names would be
a losing list, exactly like the SVD arm of `volume_drive`.

⚠ **SPARK is also 82% management churn** — MGMT_CHANGE (1,454) + MGMT_EXIT
(797) of 2,742. Surfacing "SPARK" as a badge mostly says "a director resigned".

So the vocabulary has to split three ways, and they are NOT the same surface:

- **PEAD** → a scanner. Measured, positive, actionable.
- **Negative sparks** → a warning badge. Measured, negative, avoidable.
- **Everything else** → chart context. Answers *why did this bar move*, and
  must never be presented as a reason to act.

---

## 1. Corpus shape — why most of it is context, not signal

31,294 events over 2,337 stocks in 2.5 months (~5 filings per stock per month):

| family | n | share |
|---|---|---|
| UNCLASSIFIED | 14,318 | 45.8% |
| GENERAL (newspaper ads etc.) | 12,326 | 39.4% |
| SPARK | 2,742 | 8.8% |
| OWNERSHIP | 754 | 2.4% |
| CORPORATE_ACTION | 601 | 1.9% |
| NEGATIVE_SPARK | 553 | 1.8% |

**85% is noise or unclassified.** Any surface that shows "filings" without
filtering will show newspaper publication copies.

⚠ **Density rule, applied up front** (the `slice(-8)` lesson): at ~5 events per
stock per month, filings are a HIGH-FREQUENCY member of any shared stream. If
they enter `buildStoryEvents` unfiltered they will evict journey milestones and
Big Money days from "Recent signals" and dominate `signals[0]`, which is the
Thesis tab's headline sentence. Only **results + SPARK + NEGATIVE_SPARK**
(6,023 events, ~1.6 per affected stock per month) may enter the story stream.
GENERAL and UNCLASSIFIED belong in a separate list, never the priority stream.

---

## 2. Three surfaces

### 2a. SCANNER — "Post-Result Drift"

The only filing-derived scanner the data supports.

```
Membership: a result announcement with reaction_pct >= 5
            and day_0_trade_date within the last 20 sessions
Source:     kd_result_returns(from, to, 20)   -- migration 215, already live
Filter:     NOT suspect_corporate_action      -- mandatory, km_corporate_actions is EMPTY
```

Needs **no new column and no new table**. `kd_result_returns` already computes
reaction and drift; migration 216 already de-duplicates to one row per meeting.

Columns worth showing: reaction %, sessions since Day 0, drift so far,
`sibling_announcements` (how many outcomes that board meeting produced).

⚠ **It is SEASONAL and must say so.** Weekly counts of qualifying events:

| week | results | reaction >= 5% |
|---|---|---|
| 2026-07-13 | 86 | 12 |
| 2026-07-27 | 339 | 46 |
| **2026-08-10** | **979** | **104** |
| 2026-08-17 | 199 | 18 |
| 2026-09-14 | 7 | **1** |
| 2026-09-21 | 5 | **0** |

On 2026-09-23 there is exactly ONE live candidate in the entire market. The
empty state must read **"No results filed in the last 20 sessions — next season
begins late October"**, never "no opportunities". This is the `fpbEvents`
starvation lesson: a window with nothing to look at must not read as a market
with nothing in it.

⚠ **Do NOT add MagicRS to the membership rule.** Measured: react>=5% + RS
rising = +0.80%, RS falling = +0.59% (n=42). Within noise. Adding it would
halve the list for no measured gain and imply a confluence that was tested and
is not there.

### 2b. WARNING BADGE — negative sparks

Not a scanner; a **flag on rows that already appear elsewhere**. A stock in
Stage 2 Leaders that filed a litigation disclosure last week is the case this
exists for.

```
Flag when: family='NEGATIVE_SPARK'
           AND event_type IN ('LITIGATION','REGULATORY_ACTION','INSOLVENCY')
           AND day_0_trade_date within the last 20 sessions
```

⚠ **AUDITOR_CHANGE is excluded** — measured -0.11 pts vs market, i.e. nothing.
Including it because it *sounds* alarming would train users to ignore the badge.

The badge states the event and its date. It does not say "avoid" — that is a
directional instruction. "Regulatory action disclosed 4 sessions ago" is a
fact; what the user does with it is theirs.

### 2c. CHART VIEW — the "why" layer

This is where the other 85% earns its place, and the only honest framing for
it: **filings explain a bar, they do not predict the next one.**

- Markers on the price chart at `day_0_trade_date` (never `disseminated_at` —
  Day 0 is when the market could act).
- Click a marker → the filing's `desc_raw` and dissemination timestamp.
- A "Filings" tab beside Data/Thesis listing everything for the loaded window,
  including GENERAL and UNCLASSIFIED, grouped by day.

⚠ **Only results + SPARK + NEGATIVE_SPARK become story EVENTS** (priority
stream). The rest live in the tab. See the density rule in §1.

⚠ **Intraday timestamps are the honest detail here.** OPTIEMUS's three filings
on its +20% day were disseminated at 12:26, 12:32 and 12:38 IST — mid-session.
The chart's bar is daily, so the marker sits on the day; the tooltip should
carry the time, because "the filing landed at 12:26 and the stock closed at the
circuit" is the actual explanation of that bar.

### 2d. FILINGS PAGE — the browsable corpus

Owner reference: the broker-style Corporate Announcements page (tabs + symbol +
date range + category chips).

**This needs NO classifier and NO LLM.** `desc_raw` already holds NSE's own
subject taxonomy: **117 distinct values, ZERO NULLs**, every filing categorised
at ingest. The page is a `GROUP BY desc_raw`.

⚠ **Read `desc_raw`, NOT `family`.** Our `family` column is LOSSIER than the raw
data it was derived from — 45.8% of rows sit in `UNCLASSIFIED` while carrying a
perfectly good subject line:

| `desc_raw` | n | our `family` |
|---|---|---|
| Outcome of Board Meeting | 3,090 | UNCLASSIFIED |
| General Updates | 3,185 | UNCLASSIFIED |
| Press Release | 1,606 | UNCLASSIFIED |
| Credit Rating | 268 | UNCLASSIFIED |
| Dividend | 91 | UNCLASSIFIED |

`family` exists to drive the SIGNAL layer (§2a/§2b) and is fine for that. It
must not become the page's category axis, or the page shows "Unclassified" on
nearly half its rows while NSE told us exactly what each one was.

**117 raw values is too many chips.** They group to ~20-25 display categories
via a constants-first map (`constants/filingCategories.ts`, the same discipline
as `signalScale.ts`) — never an inline switch. Direct matches to the owner's
reference page already present in the data: Acquisition · Board/Meeting Updates ·
Record Date · Change in Auditors · Change in Management/Director · Insolvency ·
Order (`Bagging/Receiving of orders/contracts`) · Spurt in Volume · Rating
Updates · Dividend · ESOP · Clarification · Result Update.

**Tabs**, and this is where our page beats a flat category list — the
"high priority" tab is **measured, not asserted**:

| Tab | Contents | Basis |
|---|---|---|
| **All** | everything, newest first | — |
| **High Priority** | result reaction >= +5%, plus Litigation / Regulatory Action / Insolvency | the ONLY classes with measured drift (§0) |
| **Conference Call** | `Analysts/Institutional Investor Meet/Con. Call Updates` | 4,987 rows — the single largest filing type |
| **Results** | `is_result_announcement` + reaction/drift columns | migration 214/215 |

⚠ **`Copy of Newspaper Publication` (3,827) is pure noise** and should be
collapsed under an "Administrative" group that is OFF by default. So should
`Certificate under SEBI (Depositories and Participants) Regulations` (971),
`Trading Window` (247) and `Structural Digital Database` (65).

⚠ **Every row shows its dissemination TIME, not just the date.** Day 0 is the
session the market could act; the time says whether it landed mid-session.
OPTIEMUS's three filings on its +20% day were 12:26 / 12:32 / 12:38 IST.

Filters: symbol, date range, category chips, exchange. All server-side —
31,294 rows and growing, so this is a paged PostgREST read, never a
fetch-everything-and-filter-in-the-browser page.

---

## 3. Where it helps the decision

The user's stated problem is that scanners are post-mortem. Filings do not fix
that — Day 0 is still after the close for most announcements. What they change
is **the question a user can answer.**

| Question | Answered by |
|---|---|
| *Why did this stock move today?* | chart filing markers (§2c) — new capability |
| *Is there a reason to expect follow-through?* | PEAD scanner (§2a) — measured +1.54 |
| *Is there something I should know before I act?* | warning badge (§2b) — measured -1.6 to -2.3 |
| *Should I buy this because they won a big order?* | **NO** — measured -2.61 |

That last row is the most valuable thing in this document. The intuitive
product ("show me companies that won large orders") is a losing screen, and
only measurement would have caught it.

---

## 4. What is NOT needed

- **Sprint 3 (Qwen document extraction) is NOT a prerequisite for any of the
  above, and its value is LOWER than the POA assumed.** The PEAD signal is the
  price REACTION, not the filing's content. And the 45.8% `UNCLASSIFIED` share
  is not a gap in the DATA — those rows carry a clean `desc_raw`; it is a gap
  in our own `family` MAP, which a lookup table fixes for free. What extraction
  would actually add is reading INSIDE a PDF (order value, acquisition size) —
  a genuine capability, but a refinement of the *why* layer, not a blocker for
  anything in §2. Re-scope it accordingly.
- **No new `family` values.** Fix the map, do not extend the taxonomy.
- **No new table, no new column** for the scanner. `kd_result_returns` and
  `km_corporate_events` already carry everything.
- **No VaNi intent is required to ship.** If one is added later it must receive
  precomputed comparisons as words, never raw drift numbers (the signed-number
  lesson).

---

## 5. Caveats that must travel with any build

1. **One results season.** Day 0 spans 2026-07-10 to 2026-09-22 only. The PEAD
   effect could be a Q1-FY27 artifact. Re-measure after the October season
   before treating +1.54 as durable.
2. **`km_corporate_actions` is EMPTY.** `suspect_corporate_action` (8 of 2,310
   today) is the only guard against a bonus being read as drift.
3. **29 result events have a NULL equity_id** and are invisible to every join.
4. **Weeks of 2026-08-24, 08-31, 09-07 have zero result rows.** Probably a real
   post-deadline lull; unverified. Confirm before the empty-state copy claims
   seasonality as the explanation.
5. **BSE is absent** from the filing ingest entirely.
6. Sample sizes for the spark classes are 61-215 over one season. The
   DIRECTION is consistent (every non-result class is negative) but individual
   magnitudes should not be quoted to users.

---

## 6. Build order

| # | Item | New storage | Evidence |
|---|---|---|---|
| 1 | PEAD scanner preset + seasonal empty state | none | +1.54 pts, n=278 |
| 2 | Negative-spark warning badge | none | -1.6 to -2.3 pts |
| 3 | Filings page (tabs + chips over `desc_raw`) | none | 117 categories, 0 NULL |
| 4 | Chart filing markers + per-stock Filings tab | none | context, not signal |
| 5 | Re-measure after October results season | — | closes caveat 1 |
| — | "Large order" / "Spark" scanner | — | **REFUSED — measured -2.61** |
