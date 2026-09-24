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

---

## MEASURED 2026-09-24 (2) — ingest idempotency, taxonomy growth, and two real gaps

### Re-running the ingest is free — it never deletes and never duplicates

`km_filings_raw` is **append-only with a content-hash short-circuit**, so the
20:10 slot cannot damage what 06:10/09:10/12:10 already wrote:

1. Every announcement carries NSE's own `seq` as `source_ann_id`, under a
   **UNIQUE (source, source_ann_id)**.
2. Before inserting, the ingest SELECTs that key and compares `content_hash`.
   Identical → `continue`, **no DB statement at all**. Not an upsert that
   rewrites the row, not a delete-and-reinsert: nothing happens.
3. Changed content (NSE revised the filing) → a **new row** with
   `supersedes_id` pointing at the old one. The original is never modified.
4. `derive_events()` classifies only raw rows that have no event yet, so
   `km_corporate_events` is incremental too.

The window is `PIPELINE_WINDOW_DAYS = 5` — deliberately much wider than the gap
between runs, because a re-fetch costs nothing and a too-narrow window loses a
filing permanently.

Verified live across two reads ~40 minutes apart on 2026-09-24, spanning the
06:10 and 09:10 slots: raw 31,803 → 32,484, events 31,962, and
**`count(*) = count(DISTINCT primary_raw_id)` exactly** — every event maps to
its own raw row, so nothing was re-derived. 177 events share an
(isin, disseminated_at, desc_raw) triple, which is two genuinely distinct
filings at the same timestamp, not a duplicate: the distinct-primary equality
rules that out.

⚠ **One real defect, currently 0.012% of rows.** A *second* revision of the
same announcement is silently dropped. The lookup is
`WHERE source_ann_id = seq`, which always finds the ORIGINAL row, and the new
row is keyed `seq#r{revisions}` where `revisions` counts revisions **within
this run**. So revision 2 in a later run recomputes the same `#r1` suffix and
loses to `ON CONFLICT DO NOTHING`. It also means `supersedes_id` always points
at the original rather than forming a chain. Live today: **4 revision rows out
of 32,484**, so this is recorded, not fixed.

### The tags are a PREDEFINED snapshot, and the backend already has the honest bucket

`constants/filingCategories.ts` holds **117 exact NSE subject strings in 18
groups** — a hand-built snapshot, no learning, no growth. Measured against the
live DB 2026-09-24: **117 distinct `desc_raw`, 0 unmapped, 0 stale.** Complete
today.

**But NSE does add subjects.** Nine of those 117 first appeared mid-August, all
after the corpus started on 07-10: `Reasons for Delayed/Non-submission of
Financial Results` (08-07), `Offer for sale` (08-03), `Forfeiture` (08-04),
`Addendum` (08-11), `Redemption` / `One time settlement` / `Extension of Annual
General Meeting` (08-13), `Postponement of commercial production/operations`
(08-14), `Delay/default in the payment of fines/penalties/dues etc. to
authority` (08-17). So the map goes stale by arithmetic, not by neglect.

⚠ **A new subject lands in `Other` silently, and nothing raises a hand.**
`groupForDesc` returns `OTHER_GROUP_ID` on a miss, `check-filings.mjs` is a
pure-node test with no DB so it structurally cannot see a new value, and no
`integrity_checks` class counts unmapped subjects. This is the
presence-not-correctness shape again: the page keeps working and a category
quietly under-reports.

The BACKEND does it right and is the model to copy. `lib/filing_taxonomy.py`
separates **`GENERAL`** ("confidently routine, discard") from
**`UNCLASSIFIED`** ("the map does not know"), with its own file comment
explaining that conflating them fills the review queue with noise in week one
and gets it ignored by week two — the same distinction as "flag is false" vs
"no flag". Live family split over 31,962 events:

| family | n | share |
|---|---|---|
| `UNCLASSIFIED` | 14,522 | **45.4%** |
| `GENERAL` | 12,714 | 39.8% |
| `SPARK` | 2,782 | 8.7% |
| `OWNERSHIP` | 774 | 2.4% |
| `CORPORATE_ACTION` | 603 | 1.9% |
| `NEGATIVE_SPARK` | 567 | 1.8% |

So the *classified* intelligence layer covers **14.8%** of the stream. The
45.4% is not a bug — it is the queue Sprint 3 was scoped to send to Qwen.

### ⚠ Fund raising: the TAG exists, the INTELLIGENCE does not

Asked directly, and the answer splits. The frontend group **`capital` /
"Capital Raise"** carries 13 subjects including `Preferential issue`,
`Qualified Institutional Placement`, `Rights Issue`, `Issue of Securities`,
`Increase in Authorised Capital`, `Conversion`, `FCCBs`, `Utilisation of
Funds`. Nothing is missing from the Filings page — it filters all of them.

**`lib/filing_taxonomy.py` maps exactly ONE of them.**

| desc_raw | n | family | event_type |
|---|---|---|---|
| Allotment of Securities | 211 | `OWNERSHIP` | `ALLOTMENT` |
| Issue of Securities | 53 | **`UNCLASSIFIED`** | NULL |
| Qualified Institutional Placement | 13 | **`UNCLASSIFIED`** | NULL |
| Preferential issue | 13 | **`UNCLASSIFIED`** | NULL |
| Utilisation of Funds | 9 | **`UNCLASSIFIED`** | NULL |
| Rights Issue | 9 | **`UNCLASSIFIED`** | NULL |
| Increase in Authorised Capital | 5 | **`UNCLASSIFIED`** | NULL |
| Conversion | 4 | **`UNCLASSIFIED`** | NULL |
| Offer for sale | 3 | **`UNCLASSIFIED`** | NULL |
| FCCBs | 1 | **`UNCLASSIFIED`** | NULL |

A QIP and a preferential allotment are among the most consequential things a
smallcap files — who is buying, at what price, and how much dilution — and
today they carry no `family`, no `event_type` and no `polarity`, so no scanner,
VaNi fact or drift study can reason about one. **Fixing it is ~10 lines in
`DESC_MAP`, not an LLM**: these are exact NSE strings with unambiguous
meanings. It is the cheapest unclaimed intelligence in the layer. Not done here
— it needs the owner's call on polarity, which is genuinely contested (a QIP is
capital in, and dilution).

### PEAD and filing intelligence are DIFFERENT questions on overlapping rows

| | PEAD (migration 221) | the filed big-move rule |
|---|---|---|
| event | a **results** announcement only | **any** filing |
| Day 0 gate | reaction **> +5%** | move **≥ +15%** |
| horizon | **20 sessions** | 5 sessions |
| measured | +0.95% vs universe −0.59% → **+1.54 pts**, n=278 | median **+2.59** vs **−0.69** unfiled → **+3.28 pts**, n=70 |
| predictability | **scheduled** — the board-meeting intimation says the date in advance | **unscheduled** |
| what it is | slow drift after a known, recurring event | continuation after an unforeseeable repricing |

Overlap, measured: of **78** filed ≥+15% stock-days, **47 are results-driven
and 31 are not**. So at the extreme they share ~60% of their rows — but at
PEAD's own +5% gate the filed population is 555 stock-days against PEAD's 278
results, i.e. PEAD is the narrower, results-only slice.

They are worth keeping as two scanners in one **Events** category rather than
merging: the drift horizons differ by 4×, one can be waited for and the other
cannot, and merging them would put a 20-session drift and a 5-session
continuation under one ordering. OPTIEMUS is the pure non-results case — a
binding term sheet, no earnings anywhere near it.

---

## SHIPPED 2026-09-24 — taxonomy v2: the fund-raising cluster is classified

The gap named above is closed. `lib/filing_taxonomy.py` grows from 31 to 40
`DESC_MAP` entries and stamps `TAXONOMY_VERSION = 'v2'`.

**Fund raising → `OWNERSHIP`, polarity `NEUTRAL`:** `Qualified Institutional
Placement` → `QIP`, `Preferential issue` → `PREFERENTIAL_ISSUE`, `Rights Issue`
→ `RIGHTS_ISSUE`, `Issue of Securities` → `ISSUE_OF_SECURITIES`, `FCCBs` →
`FCCB`, `Conversion` → `CONVERSION`, plus two that are deliberately their own
event types.

**Proceeds reports → `GENERAL` / `FUND_UTILISATION`:** `Monitoring Agency
Report` (350), `Statement of deviation(s) or variation(s) under Reg. 32` (182),
`Utilisation of Funds` (9) — **541 rows leave the LLM queue for nothing.**

### Polarity is NEUTRAL, and that is measured

Pooled over the six raise subjects, median 5-session excess return against the
same-date universe median: **−0.85 pts (n=62)**. Against `Allotment of
Securities` at **+0.48 (n=169)** and the proceeds trio at **−0.27 (n=441)**.

So "capital in" has the sign backwards, and 62 rows will not carry "dilution"
either. The price reaction carries direction (the +15% rule above); the label
states what was filed. Same reasoning the resignation entries already carry.

### Three distinctions that look like inconsistencies and are not

1. **An OFS is not a fund raise.** An existing holder sells: the shares change
   hands, the company receives nothing, nobody is diluted. Sharing an
   `event_type` with a QIP would make every "capital raised" figure wrong. Own
   type, `OFS`. (n=2 live — far too few to measure.)
2. **`Increase in Authorised Capital` is enabling headroom**, not money
   received, so `AUTHORISED_CAPITAL` lets a consumer exclude it rather than
   count a resolution as a raise.
3. **A proceeds report is a CONSEQUENCE of a raise**, filed quarterly about one
   that already happened. Counting it as a raise turns one event into many —
   the migration-216 shape, where 427 of 2,733 result rows were a second Day 0
   for one result.

**Refused, and the refusal is tested:** `Giving guarantees/indemnity/ becoming a
surety for third party` (39 — OPTIEMUS filed one the day after its +20% bar) is
a contingent *liability*, not a raise, and its direction is genuinely contested;
`Redemption` (1) and `Forfeiture` (4) turn on the document. All three sit in the
frontend's "Capital Raise" chip and stay `UNCLASSIFIED`. Placing them to make
the group look complete is the failure the test pins.

### ⚠ Extending the map does NOT repair what is already stored

`derive_events` selects `WHERE e.id IS NULL` — rows with no event yet — so a new
entry reaches only **future** filings. Measured at the time of this change:
**14,522 of 31,962 events were UNCLASSIFIED**, all `classified_by='desc_map'`.
A scanner on the new event types would have seen almost nothing while the change
looked applied. Identical shape to repairing `stage` without repairing
`stage_since`.

`reclassify_events(conn)` closes it, and **runs on every ingest pass**, which
makes the map self-healing — a future `DESC_MAP` addition needs no manual
backfill. Four load-bearing guards, each one a removable-looking line inside one
`UPDATE`:

1. **Only `classified_by='desc_map'`.** An `llm` or `human` label is a
   judgement the deterministic lookup must never stomp. All 31,962 rows are
   `desc_map` today, which is exactly when this guard is easy to omit and
   impossible to notice missing.
2. **Only rows still `UNCLASSIFIED`.** It re-labels an *absence*; revising an
   answer the map already gave is a deliberate migration, not an ingest side
   effect.
3. **Only where the map now has an entry**, so a quiet run writes 0 rows.
4. **The dating is never touched** — not `day_0_trade_date`, not
   `disseminated_at`, not `is_result_announcement`, not `board_meeting_id`. Day
   0 carries lookahead risk and has exactly one implementation
   (`kd_day_zero_trade_date`); re-deriving it here would be a second.

`derive_events` also stops hardcoding `'v1'`, so a new row and a re-labelled row
are traceable to the same map.

**To apply on the VPS** — or do nothing and the 20:10 slot does it:

```bash
cd App/backend
python scripts/ingest_nse_filings.py --reclassify   # no NSE fetch, prints the count
```

Verified on a throwaway PostgreSQL 16 cluster with a fixture covering all four
guards: 3 of 8 rows re-labelled, an `llm` row and a `human` row untouched, an
already-classified row not revised, a still-unmappable row untouched, every
dating column byte-identical, and a second run writing 0. 15 new tests in
`test_filing_intelligence.py` (60 → 75), verified to fail against nine
sabotages: QIP marked positive, OFS sharing the raise type, a proceeds report
mapped as a raise, a contested subject placed, the version left at v1, the
llm/human guard removed, the unclassified-only guard removed, the reclassify
call dropped from `run()`, and a dating column added to the UPDATE.

⚠ **Nothing renders this.** No UI reads `family` or `event_type` yet — this is
the data-ready layer the owner's steer asked for, and the Filings page already
filtered these subjects through its own `capital` chip.

---

## MEASURED 2026-09-24 (3) — the 60-session question, answered by proxy

The 20-session horizon was never chosen; it was all the filing history allowed
(53 sessions exist, 0 result events carry 60). That left an open question the
scanner could not answer about itself: **would a longer hold be better?**

It is answerable **without filings** — by asking what a large single-day move
does over time in this market generally. That needs only price bars, so it runs
over years instead of one quarter.

**Method.** 14 sample dates spaced 65 sessions apart (so the windows are
independent), 2023-01-02 → 2026-06-09. Cohort: every NSE active non-ETF stock
that moved **≥ +5% in a day** for any reason. Excess = the stock's forward
return minus the **same-date universe median** of every stock in the same
universe. Windows containing an implausible single-session move are excluded.

| horizon | n | **median excess** | mean excess | % positive |
|---|---|---|---|---|
| 5 sessions | 692 | **−0.98** | +0.72 | 43.9 |
| 20 sessions | 691 | **−1.13** | +1.17 | 45.2 |
| 60 sessions | 683 | **−1.98** | +3.35 | 46.0 |

### A generic +5% day is NEGATIVE at every horizon, and worsens with time

So the answer to "should the hold be 60 sessions" is **no** — and the reason is
not a data limit. Whatever carries a stock after a big day in this market, it
decays into underperformance, and a longer hold buys more of that, not less.
The literature's 60-day hold is a US large-cap finding; it does not transfer
here on this evidence.

### The more important result: the RESULT is the whole signal

Put the two cohorts side by side at the same horizon:

| cohort on Day 0 | n | median excess, 20 sessions |
|---|---|---|
| ≥ +5% day for **any** reason | 691 | **−1.13** |
| ≥ +5% day **on a results day** | 277 | **+1.72** |

**A 2.85-point separation.** The move is not the edge — the move is common and
mean-reverting. What separates the two populations is that one of them had a
results announcement underneath it.

This is a far stronger validation of the scanner than the bucket table alone:
the bucket table showed the gate ordering results *against each other*, and
this shows the whole results cohort standing apart from the market's ordinary
behaviour after an identical price move.

⚠ It also sharpens what the scanner must never imply. **"Stock jumped 5%" is a
losing screen** (−1.13). Only "jumped 5% *because results landed*" is not. Any
copy, VaNi line or derivative screen that drops the results condition and keeps
the move inherits −1.13.

### Two properties of this run worth keeping

- **Mean rises while median falls at every horizon** (+0.72 → +1.17 → +3.35
  against −0.98 → −1.13 → −1.98). A handful of runaway names pull the mean up
  while the typical stock in the cohort loses ground, and the gap *widens* with
  the horizon. A mean-based version of this table concludes "hold longer, it
  gets better" — the exact opposite of the truth.
- **14 independent windows across three years**, so this is not one regime. The
  PEAD result above it is still one season; this one is not.

### What is still not measured

The proxy answers *generic* big movers at 60 sessions. It does **not** prove
results-day drift also turns negative by 60 — that needs a second and third
results season, and the earliest honest answer is Q2 FY27 plus one more.
Nothing in this table suggests extending the horizon, so **20 stands**.

---

## ⚠ MEASURED 2026-09-24 — the XBRL archive and our reactions DO NOT OVERLAP

The surprise leg was previously recorded as blocked on "we hold ~1 quarter
against the ~8 a SUE needs". That was the wrong blocker. Measured against NSE
directly (`scripts/probe_nse_xbrl.py`, read-only, run on the VPS — the cloud
container has no route to nseindia.com):

**What works.** `api/corporates-financial-results?index=equities&period=Quarterly`
returns JSON, and each row carries the finished document url itself:

    "xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_..._.xml"

So `corporates-financial-results-data` is NOT needed — it demands
`params, seq_id, industry, ind, format` and answers nothing without them, but
the listing has already handed over the file. Fetched documents parse with a
plain regex on the local tag name: `RevenueFromOperations`,
`ProfitLossForPeriod`, `DateOfStartOfReportingPeriod`,
`DateOfEndOfReportingPeriod`. **No LLM, no PDF, no Sprint 3 dependency.**

⚠ **EPS was NOT in the sampled document** — only revenue and profit. Profit is a
usable level for a seasonal random walk (arguably better: no dilution noise) but
it is not an EPS and must never be reported as one. The first probe run printed
*"documents yielding an EPS-shaped figure: 1/1"* on exactly that document,
because its counter incremented on any wanted tag. A check that cannot fail.

**`from_date`/`to_date` filter the FILING date, not the reporting period.**
Proved from the distributions rather than assumed: the Jan–Mar 2025 window
returns 3,865 rows whose broadcast months are Jan-2025 (1,212), Feb-2025
(2,547), Mar-2025 (106) — summing exactly — while their *reporting* quarters
spread back to 2022Q3 (late filers). The bare listing's 3,816 rows are all
reporting quarter **2024Q4**, broadcast from Jan-2025 to Jul-2026.

**And the cliff, which is the finding.** Documents per aligned calendar quarter:

| filing window | rows | with xbrl |
|---|---|---|
| Apr–Jun 2026 | 7 | 1 |
| Jan–Mar 2026 | 15 | 4 |
| Oct–Dec 2025 | 59 | 12 |
| Jul–Sep 2025 | 8 | 3 |
| Apr–Jun 2025 | 28 | 8 |
| **Jan–Mar 2025** | **3,865** | **3,865 (100%)** |
| Oct–Dec 2024 | 3,737 | 3,735 |
| Jul–Sep 2024 | 3,650 | 3,648 |
| Apr–Jun 2024 | 3,459 | 3,454 |
| Jan–Mar 2024 | 3,482 | 3,482 |
| Oct–Dec 2023 | 3,372 | 3,372 |
| Jul–Sep 2023 | 3,327 | 3,327 |

**7 dense quarters, ending March 2025.** The filter demonstrably works, so 7
rows for a whole quarter is the endpoint's own content, not our query.

⚠ **Our Day 0 reaction records start 2026-07-10.** The dense archive ends
2025-03. **The two spans do not overlap at all**, so a surprise cannot be joined
to a reaction in either direction today. Archive depth was never the blocker;
the blocker is that the deep part is in a different era from our prices-plus-
announcements records.

⚠ **Do not read "12/12 quarters" from an earlier run of this script.** Its
threshold was ">= 1 document", which a 7-row quarter satisfies.
`DENSE_QUARTER_MIN = 500` now splits the sweep 7 dense / 5 sparse.

**Hypothesis, NOT checked:** the cliff lands exactly at 2024Q4, which is when
SEBI's Integrated Filing (Financials) regime replaced standalone results
filings. If that is the cause, current-era financials are on another route and
the two eras splice into one continuous series. Confirm before assuming.

**Two paths, and they answer different questions.**

* **Backfill Day 0 for 2023-07 → 2025-03** from the announcements archive. Gives
  the dense XBRL span something to join, so it answers *does a surprise leg add
  anything over the price reaction alone* — the question that decides whether
  any of this is worth building. It does NOT produce a live scanner.
* **Find the current-era financials route.** Required for a LIVE surprise, and
  worth nothing if the first path says the leg does not earn its place.

Measure first. The one thing already measured in this direction says MagicRS
added nothing to the reaction (+0.80 vs +0.59, n=42), and the filing-cluster and
`rvol < 0.9` hypotheses both died on contact.

**Unaffected by all of the above:** the shipped Post-Result Drift scanner is the
price-reaction half, and that half measured well — results-day +5% **+1.72
(n=277)** against any-reason +5% **−1.13 (n=691)**. Nothing here changes it.

---

## ⚠ MEASURED 2026-09-24 — the +5% gate's excess is ONE WINDOW, not a season

Run on the VPS (`App/backend/scripts/sql/pead_split_sample.sql`, then
`pead_split_q3_per_date.sql`). The MCP was wedged all session, so this was run
directly against the DB.

**The sanity header reproduced the published population exactly** — 2,245 events,
278 in the `>= +5%` band, universe ~2,800 per date, Day 0 2026-07-10 → 08-21. So
what follows is about the data, not the query.

**Split-sample by event count (split at 2026-08-10):**

| band | H1 median (n) | H2 median (n) | |
|---|---|---|---|
| **>= +5%** | **+0.82 (187)** | **+5.95 (91)** | 7x apart |
| +2..+5% | −0.56 (182) | +2.40 (106) | sign flip |
| −2..+2% | −0.17 (459) | −0.45 (374) | stable |
| −5..−2% | −0.62 (279) | −0.72 (275) | stable |
| < −5% | −1.30 (171) | +0.67 (121) | sign flip |

⚠ **H2 IS ONE EPISODE.** Per-date, top band: 08-11 (n=21) +6.65 · 08-12 (11)
+16.84 · 08-13 (24) +7.56 · 08-14 (17) +3.67 · 08-17 (17) +1.42 · 08-18 (1)
+7.17. **Six dates, four of them CONSECUTIVE sessions holding 73 of the 91
events, and all six positive.** Consecutive Day 0 dates share essentially one
20-session forward window (all ending ~09-08 to 09-11), so the +5.95 is one
observation wearing n=91 — not 91 of anything.

⚠ **H1 is the honest reading and it is a coin flip**: 22 dates, **12 positive /
10 negative**, medians from −7.18 to +27.75. Its +0.82 is flattered by two tiny
dates — 07-21 (n=7, +11.33) and **07-24 (n=2, +27.75)**. Strip those and H1 sits
around zero.

⚠ **Roughly TWO independent periods exist in the whole sample.** Day 0 spans six
weeks against a 20-session horizon; non-overlapping windows need Day 0 dates 20
sessions apart. `signal-research` warns below 8. **n=278 is 278 stocks, not 278
observations** — the single most misleading number in this file before now.

⚠ **The extremes both rose in H2 while the middle sat still.** Bands 1 and 5 are
the big-|reaction| bands; a symmetric lift in both is the signature of volatile
names outperforming in that window, which is not drift. Direction still carries
extra weight (band 5 beats band 1 by 2.1 pts in H1, 5.3 in H2), so it is not
purely beta — but part of the headline plausibly is.

**What this does and does not change.**

* **The gate does NOT move.** `>= +5%` is still the best band in BOTH halves
  (+0.82 vs −0.17 in H1; +5.95 vs −0.45 in H2). The RANKING survives; there is
  no evidence for a different threshold, and changing one on this would be
  fitting to a fortnight.
* **The shipped scanner is unaffected.** Membership is "a result, inside 20
  sessions, reaction >= +5%" — a fact about what happened, not a forecast.
* **The recorded EFFECT SIZE is superseded.** Migration 221's header and the
  earlier entries in this file carry **+1.54 pts** as a point estimate. The
  honest statement is a range of roughly **0 to +6 pts depending on the window**,
  on ~2 independent periods. Do not quote +1.54 as the expected edge, in a VaNi
  line, a tooltip, or a decision to extend this layer.
* **The next real test is the OCTOBER results season** — the first Day 0 dates
  whose forward windows do not overlap this sample at all. Calendar-bound, not
  blocked.

### The volatility read is confirmed, and the SHORT leg is refused

Query 4 (`pead_split_q4_volatility.sql`), same sample, split at 2026-08-10.
Buckets by the SIZE of the reaction ignoring sign, then by sign inside each:

| size | direction | H1 median (n) | H2 median (n) | shift |
|---|---|---|---|---|
| big \|r\|>=5 | down | −1.55 (181) | **+0.57 (136)** | +2.1 |
| big \|r\|>=5 | up | +0.82 (187) | **+5.95 (91)** | +5.1 |
| small \|r\|<5 | down | −0.44 (521) | −0.46 (479) | **+0.0** |
| small \|r\|<5 | up | −0.33 (389) | +0.15 (261) | +0.5 |

⚠ **SMALL movers are IDENTICAL across the halves** (−0.44/−0.46, −0.33/+0.15), so
the H2 window did not lift the market — the same-date universe median already
removes that. It lifted **big movers specifically, in BOTH directions.** That is
the volatility episode measured rather than suspected, and it is why the top
band's absolute excess cannot be quoted.

**What DOES survive the split: the up-vs-down spread among big reactions** —
**+2.37 pts in H1** (+0.82 vs −1.55) and **+5.38 in H2** (+5.95 vs +0.57). Same
sign, both clearly positive, magnitude 2x apart. Direction is real; its size is
not. Note this is a RELATIVE statement: it says a big move up beat a big move
down, not that either beat the market, and only the relative form is stable.

⚠ **THE SHORT LEG IS REFUSED ON EVIDENCE.** It was on the pending list at
−0.55/−0.59 pts from the whole-sample table. Split apart:

* `< −5%` **FLIPS SIGN**: −1.30 (H1) → **+0.67 (H2)**. The band a short leg would
  be built on is the *least* stable in the whole table.
* `−5..−2%` is stable (−0.62 / −0.72) but worth only ~0.65 pts — below the
  dispersion of everything around it, and a screen on it would spend a preset on
  noise.

So "the bands below +2% measure −0.55/−0.59, build the short leg" was reading a
pooled average over two halves that disagree. Do not build it. If it is revisited
after October, the test is the split, not the pooled number.
