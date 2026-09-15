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

## Naming — keys are permanent, labels are not

**"CATALYST" is StockScans' branding and must not appear in the product.**
DristiQ has its own vocabulary and the owner owns it.

The house already has the mechanism (`signalScale.ts`, and the rule that scanner
IDs are addresses that never follow a rename):

| Layer | Value | Changes? |
|---|---|---|
| `km_corporate_events.event_type` | `LARGE_ORDER`, `CAPACITY_EXPANSION`, … | **Never** — it is an address |
| Display label | whatever VaNi calls it | Freely, in one constants file |

**Consequence: the naming decision does not block ingestion.** Build on stable
UPPER_SNAKE keys; settle vocabulary later in one file, no migration. Constants
First Rule applies — never inline a label.

One constraint on whatever is chosen: it must not imply the filing *causes* the
move. That is a prediction, and the reason we cite base rates instead. D39's ban
on directional language applies to every label here.

---

## The event taxonomy — four families, not one list

The owner's examples (*large order, management restructuring, bonus,
preferential allotment, general*) span three different kinds of event. Flattening
them would put a 1:1 bonus beside a ₹2,000 Cr order as the same sort of thing.

| Family | Examples | Consumes into |
|---|---|---|
| **TRIGGER** (8 types) | large order, management change, capex/capacity, acquisition/JV, approval/policy, first commercial production, strategy switch, theme | The chain → journeys, the A/B |
| **CORPORATE ACTION** | **bonus**, split, dividend, rights, buyback | `km_corporate_actions` + `adj_factor` |
| **OWNERSHIP / STRUCTURAL** | **preferential allotment**, QIP, promoter pledge, SAST | Dilution + smart-money |
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

### The five rules that make it correct

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
4. **Cross-exchange: raw never dedups, events always do.** **2,521 ISINs are
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
5. **Store `announced_at`; DERIVE `day_0_trade_date`.** A result announced 16:30
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

### Classification

Keyword V1 (catches ~80% per the filings spec) then LLM assist for the
remainder, into the four families above. **Classification is re-derived from
stored text, never re-scraped** — that is the whole reason raw is immutable: the
V1 keyword list *will* be wrong, and fixing it must not mean re-fetching three
years of NSE.

Sonnet is required for Indian mid/small-cap knowledge (D42), so classification
cost is real and belongs behind a budget.

An **admin review queue** (internal tool, not product UI) with
`human_reviewed` / `human_override`, prioritised by confidence × materiality.

**Exit:** classified events across four families, with provenance to the
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
9. **Measure before adopting any threshold.** Every number in the reference deck
   (mcap ≥ 1000, Revenue ≥ 20, PAT ≥ 30, × 1.10, the 2–5 week window) is a round
   number with no stated basis. Check the distribution, and accept "no threshold"
   as an answer — the Price Action cooldown died that way.
10. **Base rates carry their denominator**, always. The reference deck has zero
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

## Open decisions for the owner

1. **Display vocabulary.** Not "catalyst". Does not block ingestion — stable keys
   now, labels later in one file.
2. **Universe for Tier B.** Full universe (440 MB/yr) or on-demand cache only
   (330 MB for 300 stocks over 5 years)? On-demand self-selects the stocks users
   care about; full universe makes the Sprint 4 A/B stronger.
3. **How far back to backfill.** Bounded by the spike, and by our own enriched
   layer: price history is 26 years but `ema_20` starts ~2025 and `delivery_pct`
   is on only 3,082 of 7,496 rows on the latest bar.
4. **`shared_buffers` / partitioning** — how far to go in Sprint 1 on the I/O
   finding.
5. **Classification gating** — does the classifier stay behind the admin review
   queue for a period, or go live with a confidence threshold?
