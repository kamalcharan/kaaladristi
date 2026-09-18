# Filing Intelligence — plan of action

**Status: PROPOSED 2026-09-15. Nothing built. Four sprints.**

**Scope: DATA READINESS ONLY.** Every sprint below ends in a queryable dataset,
not a screen. The UI is described at the end so the data shape can be designed
against it — **it is explicitly NOT in scope and is not to be built.** The owner
is designing that layer and it needs its own discussion.

Supersedes the framing in `docs/scanners/PEAD_FRAMEWORK.md` and
`docs/scanners/NSE_FILINGS_INTELLIGENCE.md` (both v1.0, June 2026, spec-only —
verified against the live DB: zero tables, zero code). Those stay as reference
for the signal taxonomy; this records what we build and why.

Owner framing, 2026-09-15: *"companies make regular filings — so we will have
filing intelligence — PEAD may trigger later"*, and the reframe that orders the
whole plan: **the scanner sequence IS the filing's footprint.**

---

## The finding that orders everything

A trigger event is not a new scanner family sitting beside the existing ones. It
is the **missing first element of a chain we already observe end to end**:

```
TRIGGER EVENT (Day 0, a filing)   ← the only thing we do not have
   ↓
Stirring · Waking Giants · Volume Drive · Breakout Surge · Ascent · MagicRS zone
   ↑
   already computed nightly, already dated
```

`km_wg_journeys` already carries **six dated milestones** of exactly that chain —
`turn_date`, `stir_first_date`, `gl_event_date`, `wake_date`, `confirm_date`,
`sleep_date`. Nobody built them for PEAD; it is the same idea, half-built.

**So there is no `km_pead_tracker`.** Every column in that table's spec
(`pead_day`, `pead_phase`, `return_5d/22d/66d`, `all_timeframes_green`,
`gl_acc_days`) is a join between an event date and milestones we already store.
Same conclusion Phase 3a of the thesis-events sprint reached when it refused
twelve columns: derive it. A second phase model imported from a 1968 US paper
would be two implementations of one concept, in a repo that has a scar for
exactly that.

### Why this makes the whole thing measurable

`km_journey_base_rates` already records, nightly: **595 closed journeys, 58.5%
reach Ascent, 29 days wake→confirm.** So the hypothesis stops being "does
post-announcement drift exist" — unanswerable without analyst consensus we
cannot buy — and becomes:

> **Do journeys whose wake falls within N days of a material filing confirm at
> better than 58.5%?**

A clean A/B against a denominator already on screen. No SUE, no consensus
estimates, no new metric. This is the measurement the plan exists to reach, and
it is only reachable because the event was framed as the head of a chain.

---

## Naming — two layers, and keys outlive both

Owner decision, 2026-09-15:

| Layer | Word | Where it appears |
|---|---|---|
| **UI / feature** | **Eagles** | Section, category, chips — the watcher. Fits `Kāla-Drishti` = *time-vision*; the eagle is the sharpest sight in nature. Names STOCKS, following the Waking Giants precedent. |
| **Event** | **Spark** | The dated event itself — what woke the giant. |

**"CATALYST" is StockScans' branding and must not appear anywhere in the
product.**

**Sparks carry polarity.** Not every filing points the same way: promoter
selling, pledge increase, regulatory action, audit qualification, debt increase
and order cancellation are all real sparks with the opposite sign. So the event
carries `polarity` ∈ `positive | negative | neutral` — stored for filtering and
ranking, never rendered as directional language. D39 governs the label: state
what the filing IS ("promoter reduced holding"), never what it implies.

In the journey metaphor this is coherent — giants wake, and they also sleep. A
negative spark is what sends one back to sleep.

The house already has the key/label mechanism (`signalScale.ts`, and the rule
that scanner IDs are addresses that never follow a rename):

| Layer | Value | Changes? |
|---|---|---|
| `km_corporate_events.event_type` | `LARGE_ORDER`, `PROMOTER_SELLING`, … | **Never** — it is an address |
| `polarity` | `positive` / `negative` / `neutral` | Never |
| Display label | Eagles/Spark vocabulary | Freely, in one constants file |

**Consequence: vocabulary never blocks ingestion.** Build on stable
UPPER_SNAKE keys; labels live in one file, no migration. Constants First Rule —
never inline a label. And nothing in the copy may imply the spark *causes* the
move; that is a prediction, and the reason we cite base rates instead.

## The event taxonomy — five families, not one list

The owner's examples (*large order, management restructuring, bonus,
preferential allotment, general*) span several different kinds of event. Flattening
them would put a 1:1 bonus beside a ₹2,000 Cr order as the same sort of thing.

| Family | Examples | Consumes into |
|---|---|---|
| **TRIGGER** (8 types) | large order, management change, capex/capacity, acquisition/JV, approval/policy, first commercial production, strategy switch, theme | The chain → journeys, the A/B |
| **CORPORATE ACTION** | **bonus**, split, dividend, rights, buyback | `km_corporate_actions` + `adj_factor` |
| **OWNERSHIP / STRUCTURAL** | **preferential allotment**, QIP, promoter pledge, SAST | Dilution + smart-money |
| **NEGATIVE SPARK** | promoter selling, pledge increase, regulatory action, audit qualification, debt increase, order cancellation | The chain (opposite sign) + risk flags |
| **GENERAL** | board-meeting intimation, newspaper publication, trading-window closure | Classified routine, parked |

The eight TRIGGER types map 1:1 onto the reference deck's taxonomy, which covers
the same ground as our own eleven signal tags in fewer buckets. **Six of the
eight are filing-only, one is the fundamental panel, one we already have** —
which is why filings lead and fundamentals follow.

### The corporate-action arm fixes a year-old known bug

`km_corporate_actions` has **0 rows**. CLAUDE.md (D44) records the consequence in
detail: unadjusted closes produce phantom −50% movers on ex-dates, 64 traded
stocks with >40% one-day cliffs in a trailing year, and stocks reading below
their 150-EMA for months after a split. It names populating that table with real
`adj_factor`s as **"the structural fix"**, affecting `sma_150`, `w52_high` and
`d365_pct_chng` too.

Bonus and split announcements arrive in the filing stream. **This is the
highest-certainty payoff in the plan — the defect is already measured, there is
no hypothesis to validate.**

### ⚠ `GENERAL` and `NULL` are different values

`GENERAL` = confidently routine. `NULL` = could not tell. Most filings are
routine; if the classifier cannot separate the two, the review queue fills with
noise in week one and is ignored by week two. Same distinction the scanner work
already made: *"no flag" and "flag is false" are different answers, and only the
DB knows which.*

The review queue is prioritised by **confidence × materiality, never FIFO.** At
~80k filings/year with 5–10% material, nobody reviews the tail.

---

## Data explosion

Measured on the live DB, 2026-09-15.

**The explosion is already running, and it is not filings.**

| Source | Annual growth |
|---|---|
| `km_equity_eod` (7,496 rows/day × ~250 days, 1.62 KB/row all-in) | **~3.0 GB/yr** |
| `km_equity_weekly` + `km_equity_monthly` | ~0.3 GB/yr |
| `km_scan_membership_daily` extended to the chain (Sprint 1) | ~0.16 GB/yr |
| **Existing total** | **~3.5 GB/yr** |
| Tier A — announcement metadata | 0.06 GB/yr |
| Tier B — announcement text (TOAST-compressed) | 0.44 GB/yr |
| Tier C — quarterly fundamentals | ~0.005 GB/yr (22 MB initial) |
| Tier D — bulk/block deals | ~0.005 GB/yr |
| Tier E — shareholding pattern *(deferred — see below)* | ~0.01 GB/yr |
| **Everything this plan adds** | **~0.52 GB/yr** |

The filing layer adds **~15%** to annual growth. `km_equity_eod` alone grows six
times faster.

> ### ⛔ NEVER STORE THE DOCUMENT. Store the link and the extracted text.
> Five years of filings with blobs: **279 GB** — ten times the current database.
> Same five years as URL + extracted text: **2.2 GB**. Measured ratio on a real
> 88-page PDF: 16.3 MB in, 11.5 KB of text out. The PDF stays at NSE/BSE; if we
> ever need the original we re-fetch it.

**And there is more to reclaim than the plan consumes** — see the I/O finding
below.

---

## Sprint 1 — Prove the chain, probe the sources, fix the I/O

**No new tables. No new data. Nothing user-visible.**

1. **Measure the chain lags** on existing journeys: stir → wake → volume drive →
   breakout → confirm. Two outputs: whether the sequence is stable or stocks
   skip steps, and **how wide the Day-0 join window should be**. If stir→confirm
   runs ~90 days in our data that is a DristiQ-derived phase calendar; if it runs
   40, the reference framework's "60–90 day drift" is someone else's market and
   we would have been fitting a foreign constant.
2. **Extend `km_scan_membership_daily`** to the Discovery and Stage families. It
   currently covers **8 presets from 2026-08-20 (23 days)** and does NOT cover
   `wg_stirring`, `waking_giants`, `wg_ascent`, `stage_2_watch` or
   `volume_drive` — five of the six steps in the chain.
3. **Populate the front of the chain.** Of 423 confirmed arcs: 61 carry
   `turn_date`, **0 carry `stir_first_date`**, 5 carry `gl_event_date`. Measured
   `wake→confirm = 27.7 days` ✓ (consistent with the recorded 29) but
   `turn→wake = −83.7 days`, the documented `turn_at()` state. The half of the
   chain nearest the event is the half not yet measurable.
4. **Diagnose and remediate `km_equity_eod` I/O.** Measured:

   | | |
   |---|---|
   | `shared_buffers` | **2 GB** |
   | `effective_cache_size` | 4 GB (suggests ~8 GB RAM) |
   | `km_equity_eod` heap | **19 GB** — 9.5× shared_buffers |
   | its cache hit rate | **60.8%**, **435M** disk blocks read (~3.5 TB) |
   | every other table | 98–100% |

   One table accounts for essentially all disk I/O, and with 147 columns a scan
   pays for all of them to read six. **This is the likely cause of the reported
   "DB goes offline during pipeline processing".** Three moves, cheapest first:
   raise `shared_buffers` if the box has headroom; drop the dead indexes below;
   consider partitioning by year (structural, measure query patterns first).
5. **Index cleanup.** `km_equity_eod` carries 8.4 GB of indexes. Usage since
   stats began: `idx_equity_eod_pct_wtd` 1,444 MB / **14 scans**;
   `idx_equity_eod_pct_mtd` 1,266 MB / **12**;
   `idx_equity_eod_pct_from_breakdown` 768 MB / **7**. Plus
   `idx_equity_eod_equity` (967 MB) is a prefix-subset of
   `idx_equity_eod_equity_date` and takes 0.9% of its traffic, and
   `km_equity_eod_equity_id_trade_date_key` covers the same ground again for
   1,021 MB. **4–5 GB reclaimable — more than eight years of the entire filing
   layer**, and it stops them competing for a 2 GB buffer. `stats_reset` is NULL
   so counters are cumulative; watch two weeks before dropping, and check what
   depends on the UNIQUE constraint.
6. **VPS spike on the sources** — NSE + BSE announcements, bulk/block deals,
   XBRL results. Real historical depth, rate limits, formats, exact field names,
   and whether archive files beat the JSON APIs for backfill. **Must run on the
   VPS**: the cloud container's network policy returns `403 to CONNECT` for both
   exchanges. `pipeline/utils/nse_session.py` already handles the cookie/403
   dance in production — the hardest operational part is done.

**Exit:** a measured phase calendar, a go/no-go per source, the chain
instrumented, the I/O pain diagnosed, and more disk free than the plan consumes.

---

## ⚑ MEASURED ON THE VPS, 2026-09-15 — several assumptions below were wrong

`scripts/probe_nse_filings.py` run against the live NSE API. Everything in this
section is measured; the sections after it still carry some pre-probe figures
where noted.

### Volume is 2.5× what this plan assumed

| | assumed | **measured** |
|---|---|---|
| announcements / calendar day | ~300 | **551–762** |
| announcements / year (NSE) | 80,000 | **~201,000** |

Consequences, recomputed:

| | POA | measured |
|---|---|---|
| Tier A metadata /yr | 0.06 GB | **0.15 GB** |
| Tier B text /yr | 0.44 GB | **1.10 GB** |
| 5 yr, A + B | 2.19 GB | **5.51 GB** |
| **Qwen 12-mo backfill, no pre-filter** | 5.2 days | **14.0 days** |
| Qwen 12-mo backfill, 80% pre-filtered | 1.0 day | **2.8 days** |

Storage is still a non-issue — 5.5 GB over five years against `km_equity_eod`'s
27 GB and the 4–5 GB of dead indexes Sprint 1 reclaims. **The pre-filter is now
load-bearing rather than merely prudent**: unfiltered backfill is two weeks of
continuous inference on a model that also serves the live companions.

### Depth: at least 5 years, no cutoff reached

Sampled at −1/6/12/24/36/**60** months; every window returned rows (2,332–7,366
per 7-day sample). No zero-row boundary was hit, so the real limit is deeper than
5 years. **Take the deepest it serves** — a window the source ages out of cannot
be re-fetched later.

### The API accepts very large windows

1d → 1,476 · 7d → 5,334 · 30d → 20,108 · 90d → 53,738 · **180d → 99,162 in 7.0 s.**
No cap was hit. ⚠ The per-day rate falls as the window grows (762 → 551), which
is *either* seasonality (the −1mo sample landed in results season) *or* silent
truncation. `probe_nse_filings2.py` §B settles it, and the two have opposite
consequences for batching.

### ⚠ The schema in this POA is wrong in five places

Verbatim keys: `symbol` · `sm_name` · **`sm_isin`** · `an_dt` · `exchdisstime` ·
`sort_date` · `dt` · `desc` · `attchmntText` · `attchmntFile` · **`seq_id`** ·
`hasXbrl` · `attFileSize` · `fileSize` · `difference` · `smIndustry` · `bflag` ·
`csvName` · `old_new` · `orgid`.

1. **`sm_isin` is supplied in the payload.** The ISIN *resolution* step, the
   unresolved queue and the "251 BSE rows have no ISIN" concern all evaporate
   for NSE ingestion. Store it directly.
2. **`seq_id` is the natural key** (e.g. `106780146`). `UNIQUE (source, seq_id)`
   — no composite fallback needed.
3. **`desc` IS the category, not a description** — e.g. *"Analysts/
   Institutional Investor Meet/Con. Call Updates"*. **NSE pre-categorises every
   announcement.** If that taxonomy is small and clean it replaces most of the
   keyword classifier and collapses the backfill from 14 days to well under one.
   `probe_nse_filings2.py` §A measures it. **This is the single biggest cost
   lever in the plan** and it was not in the plan at all.
4. **There are TWO timestamps, and the plan picked the wrong one.**
   `an_dt` is when the company filed; **`exchdisstime` is when the exchange
   disseminated it** — the moment the market could act. `difference` gives the
   gap. **`day_0_trade_date` must derive from `exchdisstime`.** Using `an_dt`
   injects exactly the lookahead bias the non-negotiables warn about.
5. **`hasXbrl`** flags machine-readable structure — a likely shortcut into
   Sprint 4's quarterly panel. Capture it; it costs a boolean.

### `attchmntText`: classify yes, EXTRACT no

**79.7% carry ≥80 usable characters, mean 142, zero empty.** So ~80% classify
with no PDF fetch, no extraction and no OCR risk.

⚠ **But 142 characters is a category sentence, not content.** The sample reads
*"Vedant Fashions Limited has informed the Exchange about a schedule of meet with
the Institutional Investor/Analyst vide the enclosed Letter."* — no order value,
no capacity figure, no ratio. So:

> **Classification can skip the PDF. Numeric extraction cannot.**

Materiality ranking and the bonus/split ratios therefore still need the document
for the filings that matter, even though the bulk of the stream does not. Plan
the PDF path as the *minority* route it is, not the default.

### `desc` IS a taxonomy — 63.5% classifies with no model at all

Probe v2, 14,776 announcements over 30 days (**492/day**, consistent with v1):
**107 distinct `desc` values**, top 40 covering **96.8%**. NSE has already done
the categorisation. Mapped to our five families:

| From `desc` alone | rows | share |
|---|---|---|
| **GENERAL** (newspaper publication, shareholders meeting, analyst meet, trading window) | 7,142 | **48.3%** |
| SWITCH (appointment, resignation, change in management/directors) | 882 | 6.0% |
| CORPORATE ACTION (record date) | 421 | 2.8% |
| OWNERSHIP (allotment, ESOP, SEBI takeover regs) | 344 | 2.3% |
| NEGATIVE SPARK (insolvency, litigation, orders passed, auditor change) | 330 | 2.2% |
| SPARK (order wins, acquisition, merger) | 264 | 1.8% |
| **AMBIGUOUS** (General Updates 2,039 · Updates 1,302 · Board Meeting 544 · Press Release 440 · Credit Rating · Investor Presentation) | 4,922 | 33.3% |
| tail — 67 values | 471 | 3.2% |

**63.5% deterministic · 36.5% to the LLM.**

Two structural facts worth more than the percentages:

- **Almost half the stream is noise `desc` discards for free.** Newspaper
  publications and shareholder meetings alone are 33%.
- **The material spark stream is SMALL.** Order wins + acquisitions + mergers
  are 264 rows in 30 days — roughly **3,200 a year**. The ambiguous buckets hold
  more, but the thing we care about is a thin slice of a large stream. Sizing
  the review queue and the panel against 201,000/year is the wrong denominator.

Revised Qwen load (supersedes the 80%-keyword figures above):

| | |
|---|---|
| 12-month backfill | **73,390 items · 122 h · 5.1 days** |
| Daily | 180 items · **18 min/day** |

**Worse than the 2.8 days the 80% keyword assumption predicted**, because `desc`
resolves 63.5% rather than 80%. Still tractable, and a keyword pass over
`attchmntText` *within* the ambiguous buckets should cut it further — most of
"General Updates" is likely GENERAL. Measure that before assuming it.

### ✓ No truncation — large windows are safe

Probe v2 §B: a single 180-day call returned **99,162**; the two 90-day halves
covering the same span returned **45,848 + 53,314 = 99,162**. Exact match. The
declining per-day rate in v1 was seasonality — the −1mo sample landed in results
season.

**So backfill can use 180-day batches**: five years is ~10 calls, not hundreds.

### ⚠ `hasXbrl` is TRUE on 100% of rows — treat as unverified

Every one of 14,776 announcements carries `hasXbrl: true`, and no XBRL URL
appears among the 20 keys. A flag that is universally true is more likely
defaulted than meaningful. **Do not build on it until probe v3 confirms an XBRL
document is actually retrievable and carries structured values.** If it does, it
would address the numeric-extraction gap directly — which is exactly why it
should be verified rather than assumed.

### Bulk deals: endpoint unresolved

All four candidates failed (probe v2 §C): `/api/historical/bulk-deals` with and
without `optionType`, and `/api/historical/block-deals`, each **503 on all three
retries**; `/api/snapshot-capital-market-largedeal` answered 200 with **zero
rows**. The JSON API route appears dead — the remaining options are the
report-detail CSV download or the daily archive file. **Tier D is unscheduled
until one lands; it does not block Tier A.**

---

## Sprint 2 — Ingestion spine (Tier A + D)

**No LLM. No text extraction. No classifier. Zero extraction risk.**

### Tables

`km_filings_raw` — append-only, immutable, never updated:

```
source              'NSE' | 'BSE'
source_ann_id       the source's own identifier where it exists
source_symbol       'ANURAS'      -- what the API gave us, NEVER mutated
source_scrip        '543275'
isin                RESOLVED, NULLABLE
announced_at        TIMESTAMPTZ   -- 09-Sep-2026 18:42:11
category, headline
doc_url             TEXT          -- stored, NOT fetched
payload             JSONB         -- API response verbatim
content_hash        TEXT
supersedes_id       FK self       -- revisions, never overwrites
raw_text            NULL until Sprint 3
fetched_at
```

`km_corporate_events` — normalised, deduped, one row per real-world event, FKs
back to every raw row that evidenced it. Carries `day_0_trade_date`.

### The six rules that make it correct

1. **Key on ISIN, not `equity_id`.** A filing is about the **company**, not the
   listing — ANURAS on NSE and 543275 on BSE are two `equity_id`s, one company,
   one filing. Store the source identifier too (provenance, survives a symbol
   rename) and resolve `equity_id` at read. `isin` is nullable with an
   unresolved queue: NSE is clean (0 of 3,825 missing) but **251 active BSE rows
   carry no ISIN.**
2. **The UNIQUE constraint does the dedup, not application logic.**
   `(source, source_ann_id)`, falling back to
   `(source, source_symbol, announced_at, content_hash)`.
   `ON CONFLICT DO NOTHING` makes a re-run a no-op at the DB level.
3. **A revision is a new row with `supersedes_id`, never an overwrite.** Same
   natural key + different `content_hash` = the company revised it. The original
   may already have been classified and already moved the price; overwriting
   destroys the Day 0 we measured against.
4. **NSE ONLY in this sprint — BSE is sequenced later, not dropped.** Owner
   decision, 2026-09-15. This removes an entire class of complexity from the
   first build: the cross-exchange dedup rule below does not need to run at all
   while there is one source. It covers 3,443 active non-ETF NSE companies;
   3,855 BSE-only companies wait for the later sprint.
   **⚠ This is a SEQUENCING choice, not a scope narrowing.** CLAUDE.md's settled
   decision is full NSE + BSE coverage, and BSE filings must follow — the schema
   below is built for two sources from day one so that arrival is additive.
   **No mcap floor.** A `mcap_cr >= 700` filter was considered and rejected:
   `mcap_cr` is **16% NULL on NSE and 37% NULL on BSE**, so the filter would
   select on data availability rather than company size (the silent-NULL-column
   lesson); large caps file *more* than small ones so the volume saving is far
   below the 53% headcount saving; and smallcaps are exactly the population
   where slow repricing is supposed to live.
5. **Cross-exchange (BSE sprint): raw never dedups, events always do.** **2,521 ISINs are
   dual-listed — 33% of the active universe, two-thirds of the NSE list** — and
   the same letter is filed to both (the reference deck shows one addressed to
   BSE *and* NSE). Match on identical `content_hash` where the same PDF was
   filed twice; fall back to `(isin, category, announced_at within ~30 min)` plus
   headline similarity, with the window calibrated from real data. NSE wins for
   display, consistent with `buildNsePreferredIds` and `v_equity_eod_deduped`.
   **⚠ But `announced_at` for the event is `MIN()` across the group, not the
   preferred source's.** If BSE received it at 18:40 and NSE at 18:42, the market
   knew at 18:40. Getting this backwards biases every drift measurement by the
   inter-exchange filing lag.
6. **Store `announced_at`; DERIVE `day_0_trade_date`.** A result announced 16:30
   has Day 0 = *next* session. Off by one day here injects lookahead bias into
   every number downstream. This single field decides whether the study is
   trustworthy.

### Schedule — its own dimension, NOT part of EOD

**Announcements are not EOD-shaped.** Price data is one bar per day; filings are
a continuous stream and cluster *after* market close. `daily_run` fires at 18:00
IST, so an 18:42 filing would miss it **every single night** — silently, because
the row count would still look healthy.

A separate `filings_ingest` pipeline2 dimension, own watermark, no bhavcopy
dependency. **Slots: 06:00, 09:00, 12:00, 20:00, 23:00 IST** — five runs,
weighted to when companies actually file, and **none inside the 12:30–19:30 VPS
scheduler window** (CLAUDE.md records the collision: two pipelines on
`_step_lock`, one waited 600 s and recorded `failed`).

Because the job is idempotent, **cadence is a tuning knob, not a correctness
property** — tune from the measured arrival distribution after a few weeks.

It is structurally safe against the I/O problem above: ~300 rows per run,
INSERT-only, new small table, touches `km_equity_eod` not at all, takes no step
lock — against `daily_run`'s 7,496 rows × 147 columns of UPDATE.

~~Two things stay in the daily run as `DIMENSION_DEPENDENTS` entries:
`returns_since_result` (needs the day's close) and cache invalidation.~~

**⚠ CORRECTED ON BUILD (2026-09-16).** That sentence contradicts the bullet two
paragraphs below it — *"`returns_since_result` derived, not stored"* — and both
cannot hold: a `DIMENSION_DEPENDENTS` entry exists to be RECOMPUTED, which
presupposes storage. **Derived won.** Migration 215 ships it as
`kd_result_returns()` plus a `v_result_drift` view, with deliberately no
dimension, no nightly job and no cascade edge. If a measured read cost later
forces materialisation, that is a new decision with a number behind it.

### Also in this sprint

- **Bulk / block deals + insider (SAST) ingestion.** Daily structured reports,
  ~5 MB/yr, no parsing, no LLM, no classifier. Composes immediately: a
  documented institutional buy on a Waking Giants name, or on a stock that just
  entered Stage 2, is the strongest confirmation in the framework and we already
  hold both sides of that join.
- **`returns_since_result`** derived, not stored. **SHIPPED** — migration 215.

**Exit:** a queryable event history joined to the chain. No UI.

---

### Sprint 2 as built (2026-09-16)

| Item | State |
|---|---|
| `km_filings_raw` + `km_corporate_events` + `kd_day_zero_trade_date` | migration 212, applied |
| `filings_ingest` dimension, 5 slots outside 12:30–19:30 IST | shipped |
| 12-month NSE backfill | run: **28,076 announcements → 28,363 events**, 0 deferred, 0 unresolvable |
| `'derivation'` check class | migration 213, applied — 210 shipped a check the constraint rejected |
| Results identification | migration 214 — **needed a second feed**, see below |
| `returns_since_result` | migration 215, derived; **216** de-duplicates it per results meeting |
| Board-meeting backfill 2026-06-01..09-16 | run: **11,183 meetings**, 0 skipped, 2,829 events judged |
| Bulk / block deals | **BLOCKED**, probe written — `scripts/probe_nse_bulkdeals.py`. The four JSON candidates returned 503/empty, but that was never separated from a wrong referer, a wrong parameter name or a moved path, so the probe tests each of those AND the static CSV archives (a different server, so an API 503 says nothing about them). It reports STATUS CODES, because "403 everywhere" and "answers but empty" are different findings and lead to different next steps. |

#### The finding that changed the shape: a result has no category

The plan assumed the announcements stream could date a result. It cannot, and
this was only visible once 28,076 real rows existed to measure:

* There is **no `Financial Results` desc**. A result is filed as **`Outcome of
  Board Meeting`** — 3,013 rows in one season — because legally that is what it
  is: the board approves, the outcome is disclosed.
* That same category carries dividends, fundraising and appointments, and its
  `attchmntText` is boilerplate naming only the event type.
* Three discriminators were tested and **all three failed**: the PDF filename
  says 'result' on 13%, 'fin' on 16%, and `hasXbrl` is TRUE on **3,013 of
  3,013** — confirming probe v2's suspicion that it is a defaulted flag.

The fallback would have been fetching ~26,000 PDFs a year and reading them —
Sprint 3 work, and a different shape of answer. Instead
`/api/corporate-board-meetings` supplies the **prior intimation**: a company
must declare in advance that it will meet and what for. So it stays a metadata
join — no PDF, no classifier, no LLM.

**⚠ And the meeting date is never Day 0.** The intimation names a date the
market cannot act on. Day 0 stays with the outcome announcement's
`exchdisstime`, through `kd_day_zero_trade_date`. Dating from the intimation
would be the lookahead bias this plan keeps guarding against, arriving through
a side door.

#### Two calibration decisions worth not re-litigating

1. **`is_result_announcement` FALSE is a measurement, not a default.** An
   outcome whose company has no intimation of any kind in the tolerance window
   is left **NULL** and counted as `no_meeting`. SEBI LODR requires prior
   intimation for results, so that shape is far more likely a hole in our fetch
   than a company meeting unannounced — and FALSE never corrects itself,
   because the row stops being NULL and leaves the queue. Same rule as the
   starved-derivation lesson in CLAUDE.md.
2. **`reaction_pct` and `drift_pct` are never merged.** Reaction is Day −1 →
   Day 0, the repricing; drift is Day 0 → end, which is the entire phenomenon.
   Measuring drift from Day −1 folds the announcement jump into it and is how a
   PEAD study reports an effect it never measured.

#### What the first live backfill measured (2026-09-17)

11,183 board meetings over 2026-06-01..09-16, 2,829 outcome announcements
judged. Three guesses became numbers:

1. **The feed filters on the MEETING date.** 0 rows fell outside the requested
   window by `bm_date` against 2,149 by `bm_timestamp`. The 30-day intimation
   lead buffer was therefore unnecessary and is now 7 — kept only as a hedge if
   NSE ever switches the filter, since the coverage clip makes the extra rows
   free.
2. **The match tolerance was too loose.** Offsets of matched outcomes against
   their meeting date: −1 → 5, **0 → 2,698 (98.7%)**, +1 → 14, +2 → 3, +3 → 8,
   +4 → 5. SEBI LODR Reg 30 requires the outcome within 30 *minutes* of the
   meeting concluding, so +1 is a meeting that ran into the next day and +2..+4
   cannot be that meeting's outcome — 16 proximity mismatches. `MATCH_BACK_DAYS`
   went from a guessed 4 to a measured 1, and `--relink` exists so a tolerance
   change reaches history instead of applying only to future events.
   **Confirmed live on 2026-09-18**: relinking 2,829 judged events moved
   results 2,733 → 2,717 (−16) and not-results 96 → 95 (−1), with all 17
   landing in no-coverage (188 → 205).
   **Consequence worth expecting:** those 16 now read NULL rather than FALSE,
   because the coverage check shares the match window. That is the intended
   asymmetry — we failed to *place* them, we did not measure them, and NULL is
   the verdict that can still be corrected.
3. **The free-text rule is sound.** It carries 5,457 of 9,969 results
   classifications, and a random sample of ten was unambiguous in every case
   ("Unaudited Financial results", "Yearly Audited", "Quarterly Unaudited").
   So the headline **89.1% of board meetings are results meetings** is genuine
   seasonality, not over-firing: between June and September nearly every board
   meeting is convened to approve results.

One number did NOT come out clean, and migration 216 is the answer:
**1.19 announcements per results meeting** — see the migration header.

#### `--explain-revisions` — naming the field, not guessing it

Two board meetings report as revised on **every** run, which makes the `revised`
counter useless as a change signal and — if the moving field is `bm_desc` —
could flip a results verdict run to run.

`payload` is overwritten in place, so the prior value exists only *during* the
upsert: the diagnostic cannot be asked afterwards. The upsert now returns it
through a CTE, which shares the statement's snapshot and therefore sees the row
before the UPDATE lands, and `--explain-revisions` prints `field: was -> now`.

Two properties the tests pin:

* **`_HASH_KEYS` is one declaration and the diff reads exactly it.** A diff over
  a different set would report "nothing differs" on a real hash change — a
  diagnostic that closes the question with a wrong answer, which is worse than
  having none. A test walks every key and asserts each one moves the hash.
* **It says nothing about a plain insert.** A new row has no prior, so the
  "hash changed but nothing differs" warning would fire on all 11,183 rows of a
  backfill — which is how a real warning stops being read.

Run it during a fetch: `--days 120 --explain-revisions`.

**It answered on the first run, and the answer was not "an unstable field".**
NSE **repeats an intimation inside one window** under two document URLs — MUNJAL
SHOWA's 29-May meeting, identical in purpose, desc, dates and ISIN, differing
only in `attachment` (a `PIBM_`-prefixed path vs a plain one) and `ixbrl` (a
timestamp one second apart). The tell was A→B *and then* B→A in a single fetch:
two rows, one natural key, so the loop upserted both and the last writer won.

`_collapse_duplicates()` now keeps one row per natural key. Three properties:

* **The pick is order-independent** (sorted by the differing fields, not
  first-seen). NSE promises no order, and a rule that follows it rewrites the
  row whenever the order moves — the same non-zero counter, reached a
  different way.
* **It is arbitrary between two equally valid URLs, and says so.** Nothing in
  the payload names a canonical one, so the code does not pretend to know; the
  collapse is counted and reported instead of absorbed.
* **`attachment`/`ixbrl` stay in `_HASH_KEYS`.** A genuine re-upload of a
  corrected document IS a revision worth recording. Dropping them would have
  silenced this churn and that case together — a test pins it.

Nothing downstream was ever at risk: every classifying field was identical in
both copies, so `is_results` never moved.


#### ⚠ A missing commit wiped the result population once (2026-09-18)

Recorded because the test that should have caught it passed.

`--relink` committed its CLEAR and left the re-judgement's commit to a caller
the CLI branch did not have. A live run reported *"cleared 2,829 verdicts and
re-judged: 2,717 results / 95 not / 205 no coverage"* — and left **2**. The
destructive half was durable; the restoring half rolled back at `conn.close()`.

Two properties now prevent the shape, not just the instance:

1. **`link_result_announcements` commits its own write.** No caller can forget.
2. **Clear and re-judge are ONE transaction** — there is no commit between them,
   so a crash cannot leave the population NULL with nothing to put back. That
   state is also unrecoverable by re-running, because the linker only touches
   rows that are still NULL, which by then is all of them.

**The test lesson is the transferable part.** Every test here called the
function and then committed *itself* — so it passed whether or not the code
committed. A test that supplies what the caller forgot cannot see a missing
commit. The shape that can is **write → roll back → read**, and the strongest
version makes the operation CHANGE something first: a relink that commits
nothing rolls back to the old verdict, one that commits only its clear leaves
NULL, and only a correct relink leaves the new answer. The in-function counts
are read inside the transaction, so the report looks right in all three cases.

#### ⚠ The blocker Sprint 3b now owns

`km_corporate_actions` is **empty** (CLAUDE.md, D44), so closes are unadjusted
and a split inside a drift span reads as a genuine −50% move. Measured on the
live population: **10 of 2,733 rows (0.4%)** are flagged — lower than feared,
but `v_result_drift` only holds the last ~120 days, so these are short spans
with few bars to contain a cliff and a full-history study will see more. Results season is
exactly when boards declare bonuses, so this is not a corner case for this
metric. Every drift row carries `suspect_corporate_action` (the 0.55×/1.80×
gate from `adjust_close_cliffs()`), which **must be filtered on in any study**
until Sprint 3b populates the table. It flags rather than adjusts on purpose —
back-adjusting here would be a third implementation of corporate-action
handling, silently changing numbers a researcher is reading.

---

## Sprint 3 — Extraction + classification (Tier B)

### The extraction contract

Separate, retryable job — **never inside the fetch**, so a failed extraction
cannot lose the announcement.

```
download to temp → pdftotext -layout → store text → DELETE the PDF → keep doc_url
```

Store `page_count`, `char_count`, `extract_status` for later audit without
re-reading every row.

**⚠ The chars-per-page gate is mandatory.** Scanned/image PDFs have no text
layer; `pdftotext` returns near-nothing and *reports success*. Silent, not an
error. Demonstrated on a real 88-page document during this session: **130.5
chars/page against a floor of 250 → `needs_ocr`**, where trusting the text layer
would have stored it as a successfully-extracted filing containing nothing.
`needs_ocr` is a budgeted queue, never a pipeline blocker.

**Extract same-day.** NSE archive URLs move; capture the text while the link is
live. `doc_url` is for re-verification, re-extraction when the extractor
improves, and letting the user read the original — not the primary content path.

**Check `attchmntText` first.** NSE's announcement JSON usually carries a text
summary alongside the PDF link. For a large share of filings that plus the
headline may classify correctly with no PDF fetch at all — potentially making
this sprint considerably cheaper than budgeted. Quantify in the Sprint 1 spike.

Financial **tables** extract poorly even from good PDFs — which is the argument
for taking XBRL in Sprint 4 rather than parsing result PDFs.

### Classification — Qwen first, and SERIALIZED

**Qwen, not Sonnet, is the default.** D42's finding — that Qwen cannot identify
Indian mid/small caps — was about *generation from world knowledge* ("which
companies are in the nuclear supply chain"). Classification is a different task:
text is supplied, and the model only has to read it. Sonnet escalates only what
Qwen flags low-confidence.

**Because classification is then near-free, it runs on the FULL universe.** That
matters beyond cost: classifying only the stocks users look at would select on
the outcome, and bias the Sprint 4 A/B in exactly the way this plan criticises
elsewhere.

#### Capacity is the binding constraint, and backfill is the wall

Local Qwen has finite capacity and **must be driven serially — one request in
flight, never fanned out.** Modelled at ~6 s/call (estimate; measure in the
spike):

| | items | serial hours |
|---|---|---|
| Daily, every filing → Qwen | 300 | 0.5 |
| Daily, keyword first + Qwen residual | 60 | 0.1 |
| **Backfill 12 mo, every filing** | **75,600** | **126 (5.2 days)** |
| Backfill 12 mo, Qwen residual only | 15,120 | 25 (1.0 day) |

**So the keyword V1 pass is not a cost optimisation — it is the capacity
strategy.** Daily operation is trivial either way; the 12-month backfill is 5.2
days of continuous inference unfiltered, and about one day behind a keyword
pass.

#### Worker contract

- **One worker, one request in flight**, guarded by the existing
  `single_flight()` advisory lock so two cannot start.
- **Queue with explicit state**: `status` (queued/running/done/failed/
  needs_human), `attempts`, `next_attempt_at`, `last_error`, `priority`,
  `model_used`, `confidence`, **`classifier_version`**.
- **Auto-retry with exponential backoff** (1 min → 5 → 25), capped attempts,
  then `needs_human` rather than an infinite loop.
- **Priority ordering**: today's filings first, then relevance, then backfill
  drains behind everything.
- **⚠ Yield to the live product.** Qwen already serves the VaNi companions, and
  CLAUDE.md records that `_fallback_complete` is *already* failing most of the
  time on that path (larger prompts). A backfill firehose would make live
  readings worse. The worker runs in off-hours windows with a hard stop if
  latency degrades — the backfill is never more important than the product.
- **Truncate the input.** Headline + `attchmntText` + first N chars, never a
  30-page PDF. Prompt size is the known failure mode on this model.
- **`classifier_version` keys the result**, so a V2 re-classification is a clean
  re-queue that never loses V1's record.

#### Numeric extraction — a SECOND output, not a side-effect of classification

**Classification says *which category*; extraction says *how much*.** Different
tasks, and only the first was planned. `LARGE_ORDER` on *"Anawil secures
largest-ever ₹133.98 Cr order"* is easy; pulling out **133.98**, knowing it is
crores, and recognising that the ₹140.68 Cr figure is the same order including
GST, is structured extraction.

Without it, two things specified elsewhere in this plan cannot exist:

- **Materiality ranking** — the rolling panel is specified to rank by order size
  relative to revenue (the reference deck's own example is *"₹2,000 Cr order for
  a ₹500 Cr revenue business"*). No number, no ranking.
- **The `L` family's whole point** — a ₹5 Cr order and a ₹2,000 Cr order
  classify identically without it.

So the same Qwen pass emits an optional typed payload alongside the class:
`amount_value`, `amount_unit`, `amount_basis` (`incl_gst` / `excl_gst` / NULL),
`ratio_num` / `ratio_den` (bonus 1:1, split 1:2), `capacity_value` /
`capacity_unit` (MTPA, GWh). **Every field nullable — extraction failing must
never invalidate a correct classification.**

⚠ **Extraction accuracy is measured separately from classification accuracy.**
They fail differently: a model can pick the right category and the wrong number,
and a confidently wrong ₹ figure is worse than none — same class as the
signed-number lesson. A materiality number that cannot be trusted must be
absent, not approximate.

#### Accuracy is measured, not assumed

Hand-label ~200 filings once; run Qwen and Sonnet over the same set; compare.
Half a day, and it settles both the model choice and the confidence threshold
that gates publication. Keyword V1 handles the bulk regardless.

An **admin review queue** (internal tool, not product UI) with
`human_reviewed` / `human_override`, prioritised by confidence × materiality.

#### Gating — confidence threshold, per family (owner decision)

High-confidence classifications publish immediately; the rest queue.
**Corporate actions publish ungated** — bonus/split are keyword-detectable with
near-certainty and carry no interpretive risk. **Spark-family classifications
stay gated** until the classifier has a measured accuracy on real filings,
because those are the ones carrying an implied story.

**Exit:** classified events across the five families, with provenance to the
document. No product UI.

---

## Sprint 3b — The corporate-action adjustment chain

**Its own tracked item, deliberately not folded into Sprint 3.** It touches the
largest table in the database and the recompute cascade, and it is the piece
most likely to be quietly skipped if it hides inside a filings sprint.

Classifying "this is a 1:1 bonus" changes nothing on its own. The D44 fix is a
five-step chain and only the first step lives in Sprint 3:

| Step | Where |
|---|---|
| 1. Classify the corporate action | Sprint 3 |
| 2. Extract the ratio (1:1, 1:2, dividend/share) | Sprint 3 (numeric extraction) |
| 3. Compute `adj_factor`, populate `km_corporate_actions` | **here** |
| 4. Back-adjust closes | **here** |
| 5. Recompute `sma_150`, `w52_high`, `d365_pct_chng`, breadth | **here** |

D44 records what is broken today: `km_corporate_actions` has **0 rows**, closes
are raw bhavcopy, 64 traded stocks showed >40% one-day cliffs in a trailing year,
stocks read below their 150-EMA for months post-split, and `adjust_close_cliffs()`
in `lib/breadth_common.py` exists only as a heuristic patch over the gap.

Two constraints:

- **Step 5 runs through `DIMENSION_DEPENDENTS`**, not by hand — the cascade
  already knows what derives from what, and a back-adjustment invalidates a long
  chain.
- **Never overwrite raw closes.** Adjustment is a derived column or a view.
  Losing the as-traded price destroys the ability to reconcile against bhavcopy
  and makes the correction unauditable.

**Requires ≥24 months of corporate-action history** to matter — a 4-month
backfill fixes four months of splits and leaves the documented bug in place.

**Exit:** `km_corporate_actions` populated, adjusted closes available, the
dependent indicators recomputed, and `adjust_close_cliffs()` retired or
demoted to a backstop.

---

## Sprint 4 — Fundamentals panel + the measurement (Tier C)

- **BSE XBRL quarterly panel**: Revenue, PAT, OPM, NPM × ~8 quarters. Four
  metrics — the *complete* fundamental field list across every scan in the
  reference deck.
- **The scanners' data side**: J-Curve, Turnaround/Breakout Earnings, Consistent
  NPM — the predicates, as derived columns or SQL, not the pages.
- **VSTOP 10W** — the J-Curve scan's last filter is `close >= VSTOP 10W 2`, and
  **VSTOP exists nowhere in the codebase**. Not a data gap: `atr_10` and
  `atr_14` are already on `km_equity_weekly`, so it is an indicator to
  implement, roughly half a day.
- **The A/B**: do journeys waking within N days of a material spark confirm at
  better than **58.5%**? Reported with its denominator, per the house rule.

### ⚠ The A/B needs a MATCHED control, not the global baseline

Comparing spark-adjacent wakes against the all-journeys 58.5% is **confounded**:
bigger, more liquid companies file more filings *and* behave differently, so the
comparison would measure company size as much as it measures the spark.

The control must be matched — same mcap band, same sector, same period, no spark
— and the matching rule fixed **before** the numbers are looked at. This is a
method decision, not a data gap, and it is the difference between a real answer
and a flattering one. It is the same discipline the plan applies to the
geopolitical layer: a sample selected on the outcome proves nothing.

Two traps that silently fabricate a J-curve: **standalone vs consolidated** mixed
across quarters (fake inflection at the switch point), and **restatements
overwritten** (the trough moves). Store `as_reported` tied to the filing that
produced it; never overwrite.

**Exit:** the panel queryable, and the first measured answer on whether sparks
predict anything at all.

---

## Tier E (shareholding pattern) — deferred, and why that is safe

Listed in the data inventory, planned into no sprint. That is deliberate:

- The **negative-spark use case is already covered** — "promoter sold", "pledge
  increased" arrive as SAST and pledge intimations through the Sprint 2/3
  filing stream, as events.
- What Tier E adds is the **level** rather than the change: promoter holds 62%,
  15% pledged, the FII trend. That is context on a stock page, not a spark.

So it is a later addition whenever the context is wanted. Recorded here so it is
not mistaken for an oversight.

---

## Non-negotiables

1. **Never store the PDF.** URL + extracted text. 279 GB vs 2.2 GB.
2. **No `km_pead_tracker`.** It is a join, not a table.
3. **Key on ISIN**, carry the source identifier for provenance, resolve
   `equity_id` at read. Never key on `symbol` — symbols rename and 82% of the
   BSE universe is numeric scrip codes.
4. **Store `announced_at`, derive `day_0_trade_date`.** Lookahead bias.
5. **`MIN(announced_at)`** across a cross-exchange group, whichever source wins
   for display.
6. **Raw is immutable.** Classification re-derives; revisions supersede.
7. **`GENERAL` ≠ `NULL`.**
8. **Grant SELECT to `authenticated`** on anything PostgREST reads, verified with
   `pg_class.relacl` — `information_schema.role_table_grants` is blind over a
   restricted connection.
9. **Qwen is driven serially, with backoff, yielding to the live product.**
    Never fan out; never let a backfill degrade a user's reading.
10. **Measure before adopting any threshold.** Every number in the reference deck
   (mcap ≥ 1000, Revenue ≥ 20, PAT ≥ 30, × 1.10, the 2–5 week window) is a round
   number with no stated basis. Check the distribution, and accept "no threshold"
   as an answer — the Price Action cooldown died that way.
11. **Base rates carry their denominator**, always. The reference deck has zero
    base rates in 88 pages; that is our differentiator, not our template.

---

## UI — DESCRIBED, NOT IN SCOPE

**Owner-owned. Do not build any of this.** Recorded only so the data shape is
designed against something real.

What the data must be able to serve:

- **The stock's own page.** A filing event slots into `storyEvents.ts` at
  **priority 10, above `discovery: 9`** — it is the *cause* of the wake and rare
  enough that density is never an issue (the exact inverse of the Price Action
  problem). The reading is four layers: fact → position in the chain → base rate
  with denominator → the honest gap where there is no comparable history. Reuses
  `JourneyStrip` (the filing becomes the arc's origin), `buildThesisFacts`, and
  `journeyFacts.ts` as the single place a journey sentence is written.
- **A rolling recent-filings panel — NOT the Morning Brief.** The brief's
  `_vani_cache` is **in-memory, 24h TTL**; ingestion is every 3 hours, so
  **eight ingestion cycles per cached brief**. Putting filings in the brief means
  either 24h staleness or busting its cache eight times a day. Instead: a
  ~4-day rolling window that is **read, not generated** — a DB query, no LLM, no
  cache to invalidate, never stale because the window simply moves. An LLM enters
  only when the user opens one filing. The brief may carry a *computed* pointer
  line ("3 companies you follow disclosed something since yesterday"), never
  baked into its generated text.
  - Window length: 4 days is a starting default (covers a weekend plus a day
    either side) and should be **measured** against the lag between a filing and
    the first chain response, once filings exist.
  - **Ranking, not chronology.** ~300 filings/day, 20–30 material, so a 4-day
    window holds 80–120 items. Material families only, ranked by **personal
    relevance first** (bookmarked, in a scanner they use, on their workspace) —
    the "Connected to your stocks" pattern, including its privacy rule that
    personal results stay in an account-keyed browser query and **never enter a
    shared prompt or response cache** — then by materiality.
- **A scanner category** alongside the existing five, via `SCAN_PRESETS` +
  `kd_scan_presets`.
- **A filings feed page — deliberately last.** It is the obvious build and the
  least differentiated: StockScans, MoneyControl and the exchanges all have one.
  Without the join to the chain it is a commodity firehose.

**Ordering principle for whenever this is designed:** put it where the user
already is, not somewhere they must remember to go.

---

## Deliberately out of scope

- **Geopolitical as a signal layer.** n = 4 in the source document, selected on
  outcome, no objective surprise metric, and the sector→stock mapping needs
  Sonnet per event at exactly the scale where n is too small to validate.
  Narrative annotation only — a curated table VaNi can *cite*, making no
  base-rate claim we cannot defend.
- **Screener.in as a source.** Technically easy; ToS prohibits automated scraping
  and redistribution, we have paying users, it is a single point of failure with
  no fallback, and it does not carry the filing stream at all — so it would cost
  us the product to save 0 MB. NSE/BSE are where Screener gets it anyway.
- **Management interview indexing.** Interesting, unranked.
- **All product UI.** See above.

---

## Decisions taken (2026-09-15)

1. **Vocabulary** — Eagles in the UI, Spark for events, sparks carry polarity.
2. **Universe** — full universe for metadata, text and classification. No mcap
   floor. **NSE first, BSE sequenced later** (not dropped).
3. **Backfill depth** — tiered by purpose: metadata as deep as the source
   serves (depth is a one-time opportunity — a source that ages out cannot be
   re-fetched later); text 12 months; corporate actions ≥24 months, because
   that is what fixes the D44 bug; LLM classification recent + on-demand.
4. **I/O** — Sprint 1 does the index cleanup only. `shared_buffers` at 2 GB is
   the textbook 25% of ~8 GB RAM and is NOT misconfigured; the machine is
   undersized for a 27 GB table. Raising it would starve the OS page cache. More
   RAM is a hosting decision; partitioning is its own project needing
   query-pattern analysis first — do not bundle either into a filings sprint.
5. **Classification gating** — confidence threshold, per family (above).

## No decisions are open — Sprint 1 can start

Every design question raised in the 2026-09-15 review is answered above. What
remains are **measurements the Sprint 1 spike produces**, not choices anyone has
to make. They move the schedule, not the design.

| Spike must measure | Why it matters |
|---|---|
| **Qwen seconds per call** | The 6 s figure is an estimate. Sets the real backfill duration. |
| **Keyword V1 catch rate** | Assumed 80% from the filings spec. At 50% the backfill doubles. |
| **`attchmntText` coverage** | If NSE's JSON summary classifies well alone, PDF fetch and extraction drop out for a large share and Sprint 3 gets materially cheaper. |
| **NSE announcement depth + rate limits** | Bounds the metadata backfill — and depth is a one-time opportunity. |

**BSE:** sequenced after NSE, timing at the owner's call. The schema is
two-source from day one so it arrives additively, never as a refactor.
