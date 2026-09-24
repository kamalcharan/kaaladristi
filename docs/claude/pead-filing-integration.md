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

---

## MEASURED 2026-09-24 — what the filing layer is actually worth

Four questions, answered against the live DB. The headline is one measured
discriminator and two refuted intuitions.

### 1. The signal is `big Day 0 move` **×** `a filing on that day`

The filing does not predict a move. What it does is tell a big move apart from
a big move that reverts — and it only earns its keep at the extreme. Day 0 =
the session the market could act; forward return = 5 sessions from Day 0's
close, minus the **same-date universe median** so market direction cancels;
NSE active non-ETF; Day 0 spans 2026-07-10 → 2026-09-23 (~52 sessions).

| Day 0 move | no filing that day | a filing that day | difference |
|---|---|---|---|
| < +5% | 0.00 (n=116,869) | 0.00 (n=15,163) | 0 |
| +5 … +10% | +0.08 (n=3,739) | **+0.54** (n=555) | +0.46 |
| +10 … +15% | −1.04 (n=511) | −1.02 (n=115) | ~0 |
| **≥ +15%** | **−0.69** (n=348) | **+2.59** (n=70) | **+3.28 pts** |

Median excess return, percentage points, 5 sessions.

A +15% day with nothing filed **mean-reverts**. A +15% day with a filing
**continues**. 55.7% of the filed cases are positive against 46.8% unfiled.

⚠ **Read the median, not the mean.** Unfiled ≥+15% has mean +3.29 against
median −0.69 — a handful of runaway names carrying a population that typically
gives back. Filed is mean +2.76 against median +2.59, i.e. a well-behaved
distribution. A mean-based version of this table says the opposite thing.

⚠ **Not monotone.** +10…15% is negative in BOTH columns. With n=115/511 over
2.5 months that is as likely to be sample as structure, but it means this is a
*threshold at +15%*, not a gradient — do not build a "the bigger the move the
better" ranking on it.

⚠ **Corporate actions are clean here, and that was checked, not assumed.**
`km_corporate_actions` is still EMPTY (D44), so the 0.55×/1.80× single-session
cliff gate was applied to every forward window: **0 of 418** ≥+15% events
carried a cliff, so n is unchanged and the result is not a split artifact.

⚠ 2.5 months, ~1.3 qualifying events a session. This is one market phase.

### 2. REFUTED — a filing CLUSTER is not a signal

OPTIEMUS filed **three** announcements inside twelve minutes on its +20% day,
which makes "several filings in one session" look like the tell. It is not:

| filings on Day 0 | n | median excess (5 sessions) |
|---|---|---|
| 1 | 10,050 | +0.03 |
| 2 | 3,038 | +0.01 |
| 3 or more | 2,815 | **−0.10** |

Flat, and very slightly *worse* with more. 2,815 events filed 3+ in a session
and carried no edge at all. **Count the price reaction, never the filings.**
Same shape as the `rvol < 0.9` result: the visible feature of one specimen is
not what separated it from the population.

### 3. Ingest schedule, and the latency that follows from it

Scheduled (`pipeline2/scheduler.py`, IST, every day — filings do not stop for
weekends): **filings 06:10 / 09:10 / 12:10 / 20:10 / 23:10**, **board meetings
07:40 / 21:40**, **bulk deals 08:20 / 22:20**. All deliberately outside
12:30–19:30, where `daily_run` and both gap sweeps live, and staggered to
:10/:40/:20 so three NSE fetchers never share a minute.

Observed, 5 days to 2026-09-24 — the **20:10 slot is the whole day**: it lands
434–641 rows and takes 50–110 minutes, so its rows carry `fetched_at` in the
21:00 or 22:00 hour; the 23:10 slot spills past midnight. The other four slots
land 1–66 rows each.

**Latency on what matters — a filing disseminated during market hours**
(09:15–15:30), live period since 2026-09-17, excluding the one-time 09-16
backfill: **n=960, mean lag 342 minutes (5.7 hours), max 602**. Only **282 of
960 (29.4%)** are in our database before that same session's close.

So a mid-session filing is, more often than not, a *tomorrow* fact for us —
which is consistent with the rule in §1 being a Day+1-onward rule, and is the
reason it is stated that way. Closing the intraday gap needs a slot inside
12:30–19:30, which is the window the scheduler avoids on purpose.

### 4. OPTIEMUS INFRACOM — the filing→price link, established

| when | what |
|---|---|
| 09-21 | close **590.75**. rvol 0.72, MagicRS 26.16 and *falling*, no dots, flow NULL. **No pre-signal whatsoever.** |
| 09-22 12:26 | `General Updates` — binding term sheet with **Nothing Electronics** |
| 09-22 12:32 | `Press Release` — *"CMF by Nothing and Optiemus Group Expand Partnership to Build India's First End-to-End R&D Smartphone Capability"* |
| 09-22 12:38 | `Others` — the same term sheet again |
| 09-22 close | **708.90, +20.00%** — close = high = upper circuit. Volume 8.05M vs a 189k norm, **rvol 19.24**. dot_sbd AND dot_svd. |
| 09-22 **21:48** | ⚠ the three filings reach our DB — **9.2 hours after dissemination, 6.3 hours after the close**, and ~3.8 hours after that day's bhavcopy |
| 09-23 | opens **800** (+12.9% gap), closes **828.35, +16.85%**, volume 10.6M |
| 09-23 14:37 | corporate guarantee to IndusInd raised ₹50.07 Cr → ₹100 Cr — a *consequence*, not the driver |

**+40.2% over two sessions from the 09-21 close**, and the entire first leg
happened between 12:26 and the close of the day the news landed.

Two honest readings of this specimen:

- **The Day 0 leg was never catchable in an EOD product**, and no amount of
  faster filing ingest changes that — the stock was locked at +20% within the
  session. What §1 says is tradeable is the **Day+1 continuation**, which here
  was +16.85%, and which the data says is only worth taking when a filing
  exists. OPTIEMUS is a textbook instance of the filed ≥+15% bucket.
- **There was a footprint four sessions earlier, and it was not a filing.**
  09-16 gapped from 566.25 to open 600 (+6%) on rvol 1.52 with FRESH_LONGS and
  a stage lift S3 → S2_CANDIDATE, and 09-17 added +2.89% the same way — with
  **no announcement on file** to explain either. (OPTIEMUS also has no 09-15
  bar although the market traded that session.) n=1; not a rule. But it is the
  case for the `wg_journeys` / Big Money layer rather than the filing layer.
