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
| Tier E — shareholding pattern | ~0.01 GB/yr |
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

Two things stay in the daily run as `DIMENSION_DEPENDENTS` entries:
`returns_since_result` (needs the day's close) and cache invalidation.

### Also in this sprint

- **Bulk / block deals + insider (SAST) ingestion.** Daily structured reports,
  ~5 MB/yr, no parsing, no LLM, no classifier. Composes immediately: a
  documented institutional buy on a Waking Giants name, or on a stock that just
  entered Stage 2, is the strongest confirmation in the framework and we already
  hold both sides of that join.
- **`returns_since_result`** derived, not stored.

**Exit:** a queryable event history joined to the chain. No UI.

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

## Sprint 4 — Fundamentals panel + the measurement (Tier C)

- **BSE XBRL quarterly panel**: Revenue, PAT, OPM, NPM × ~8 quarters. Four
  metrics — the *complete* fundamental field list across every scan in the
  reference deck.
- **The scanners' data side**: J-Curve, Turnaround/Breakout Earnings, Consistent
  NPM — the predicates, as derived columns or SQL, not the pages.
- **The A/B**: do journeys waking within N days of a material filing confirm at
  better than **58.5%**? Reported with its denominator, per the house rule.

Two traps that silently fabricate a J-curve: **standalone vs consolidated** mixed
across quarters (fake inflection at the switch point), and **restatements
overwritten** (the trough moves). Store `as_reported` tied to the filing that
produced it; never overwrite.

**Exit:** the panel queryable, and the first measured answer on whether filings
predict anything at all.

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

## Still open

1. **Qwen throughput per call** — the 6 s/call figure above is an estimate. The
   spike must measure it; the backfill schedule depends on it.
2. **Keyword V1 catch rate** — assumed 80% from the filings spec. If it is 50%,
   the backfill doubles.
3. **`attchmntText` coverage** — if NSE's JSON summary classifies well on its
   own, the PDF fetch and extraction drop out for a large share of filings and
   Sprint 3 gets materially cheaper. Quantify in the spike.
4. **BSE sprint timing** — when the second source arrives.
   queue for a period, or go live with a confidence threshold?
