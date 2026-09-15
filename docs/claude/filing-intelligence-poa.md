# Filing Intelligence — plan of action

**Status: PROPOSED 2026-09-15. Nothing built. Four sprints.**

Supersedes the framing in `docs/scanners/PEAD_FRAMEWORK.md` and
`docs/scanners/NSE_FILINGS_INTELLIGENCE.md` (both v1.0, June 2026, spec-only —
verified against the live DB: zero tables, zero code). Those documents stay as
reference for the signal taxonomy; this one records what we build and why.

Owner framing, 2026-09-15: *"companies make regular filings — so we will have
filing intelligence — PEAD may trigger later"*, and the reframe that orders the
whole plan: **the scanner sequence IS the catalyst's footprint.**

---

## The finding that orders everything

A catalyst is not a new scanner family sitting beside the existing ones. It is
the **missing first element of a chain we already observe end to end**:

```
CATALYST (Day 0, a filing)   ← the only thing we do not have
   ↓
Stirring · Waking Giants · Volume Drive · Breakout Surge · Ascent · MagicRS zone
   ↑
   already computed nightly, already dated
```

`km_wg_journeys` already carries **six dated milestones** of exactly that chain
— `turn_date`, `stir_first_date`, `gl_event_date`, `wake_date`, `confirm_date`,
`sleep_date`. Nobody built them for PEAD; it is the same idea, half-built.

**So there is no `km_pead_tracker`.** Every column in that table's spec
(`pead_day`, `pead_phase`, `return_5d/22d/66d`, `all_timeframes_green`,
`gl_acc_days`) is a join between a catalyst date and milestones we already
store. Same conclusion Phase 3a of the thesis-events sprint reached when it
refused twelve columns: derive it. A second phase model imported from a 1968 US
paper would be two implementations of one concept, in a repo that has a scar for
exactly that.

### Why this makes the whole thing measurable

`km_journey_base_rates` already records, nightly: **595 closed journeys, 58.5%
reach Ascent, 29 days wake→confirm.** So the PEAD hypothesis stops being
"does post-announcement drift exist" — unanswerable without analyst consensus we
cannot buy — and becomes:

> **Do journeys whose wake falls within N days of a CATALYST filing confirm at
> better than 58.5%?**

A clean A/B against a denominator already on screen. No SUE, no consensus
estimates, no new metric. This is the measurement the plan exists to reach, and
it is only reachable because the catalyst was framed as the head of a chain.

---

## The taxonomy: adopt CATALYST

From `Spotting_the_j_Curves` (SOIC × StockScans, 13 Sep 2026). Eight triggers,
mnemonic, and it covers the same ground as our own eleven signal tags in fewer,
more memorable buckets. **Use theirs.**

| | Trigger | Source | Have it? |
|---|---|---|---|
| **C** | Capex & Capacity | Filing | ❌ |
| **A** | Acquisitions & Alliances | Filing | ❌ |
| **T** | Turnaround in Earnings | Fundamental panel | ❌ |
| **A** | Approvals & Actions (policy) | Filing | ❌ |
| **L** | Large Orders | Filing (+ revenue, for the ratio) | ❌ |
| **Y** | Year Zero (first commercial production) | Filing | ❌ |
| **S** | Switch (strategy / management) | Filing | ❌ |
| **T** | Theme & Tailwinds | Sector rotation | ✅ |

**Six of eight are filing-only. One is the fundamental panel. One we have.**
That ratio is why filings lead and fundamentals follow — an earlier draft of this
plan had it backwards.

Their causal chain, which is PEAD stated without the jargon:
`Catalyst → Expectations Change → Earnings Accelerate → Market Reacts → Stock Moves`

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
| | |
| Tier A — announcement metadata | 0.06 GB/yr |
| Tier B — announcement text (TOAST-compressed) | 0.44 GB/yr |
| Tier C — quarterly fundamentals | ~0.005 GB/yr (22 MB initial) |
| Tier D — bulk/block deals | ~0.005 GB/yr |
| Tier E — shareholding pattern | ~0.01 GB/yr |
| **Everything this plan adds** | **~0.52 GB/yr** |

**The filing layer adds ~15% to annual growth.** `km_equity_eod` alone grows six
times faster.

**One decision accounts for 99% of the filing layer's cost: whether we store the
PDF.** Store the blob and five years is **279 GB** — ten times the entire current
database. Store URL + extracted text and the same five years is **2.2 GB**.

> ### ⛔ NEVER STORE THE DOCUMENT. Store the link and the extracted text.
> The PDF stays at NSE/BSE. If we ever need the original we re-fetch it.

**And there is more to reclaim than the plan consumes.** `km_equity_eod` carries
19 GB heap + **8.4 GB of indexes** across 147 columns. Index usage since stats
began:

| Index | Size | Scans |
|---|---|---|
| `idx_equity_eod_pct_wtd` | 1,444 MB | **14** |
| `idx_equity_eod_pct_mtd` | 1,266 MB | **12** |
| `idx_equity_eod_pct_from_breakdown` | 768 MB | **7** |

**3.4 GB of indexes used 33 times in total.** Plus `idx_equity_eod_equity`
(967 MB, equity_id alone) is a prefix-subset of `idx_equity_eod_equity_date`
(752 MB) and takes 0.9% of its traffic, and
`km_equity_eod_equity_id_trade_date_key` covers the same ground again for
1,021 MB. Realistically **4–5 GB reclaimable — more than eight years of the
entire filing layer.**

`stats_reset` is NULL so the counters are cumulative, but watch them for two
weeks before dropping, and check what depends on the UNIQUE constraint.

**Structural option, not yet recommended:** `km_equity_eod` at 147 columns
unpartitioned is the real long-term shape problem. Partitioning by year is the
answer *if* query patterns support it — measure before prescribing.

---

## Sprint 1 — Prove the chain, probe the sources, reclaim the space

**No new tables. No new data. Nothing user-visible.**

1. **Measure the chain lags** on existing journeys:
   stir → wake → volume drive → breakout → confirm. Two outputs: whether the
   sequence is stable or stocks skip steps, and **how wide the Day-0 join window
   should be**. If stir→confirm runs ~90 days in our data, that is a
   DristiQ-derived phase calendar; if it runs 40, the PEAD doc's "60–90 day
   drift" is someone else's market and we would have been fitting a foreign
   constant.
2. **Extend `km_scan_membership_daily`** to the Discovery and Stage families.
   It currently covers **8 presets from 2026-08-20 (23 days)** and does NOT
   cover `wg_stirring`, `waking_giants`, `wg_ascent`, `stage_2_watch` or
   `volume_drive` — five of the six steps in the chain.
3. **Populate the front of the chain.** Of 423 confirmed arcs: 61 carry
   `turn_date`, **0 carry `stir_first_date`**, 5 carry `gl_event_date`. Measured
   `wake→confirm = 27.7 days` ✓ (consistent with the recorded 29) but
   `turn→wake = −83.7 days`, the documented `turn_at()` state. The half of the
   chain nearest the catalyst is the half not yet measurable.
4. **VPS spike on the sources** — NSE + BSE announcements, bulk/block deals,
   XBRL results. Real historical depth, rate limits, formats, and whether
   archive files beat the JSON APIs for backfill. **Must run on the VPS**: the
   cloud container's network policy returns `403 to CONNECT` for both exchanges.
   `pipeline/utils/nse_session.py` already handles the cookie/403 dance in
   production — the hardest operational part is done.
5. **Index cleanup.** Reclaim 4–5 GB, which pre-pays the storage for everything
   below.

**Exit:** a measured phase calendar, a go/no-go per source, the chain
instrumented, and more disk free than the plan will consume.

---

## Sprint 2 — Tier A + D: the structured spine

**No LLM. No text extraction. No classifier. Zero extraction risk.**

- `km_filings_raw` — append-only, immutable, never updated. Source URL, fetch
  timestamp, payload verbatim, **content hash** (NSE re-serves and revises; you
  must be able to re-run a day without duplicating and to *detect* a revision).
- `km_corporate_events` — normalised, deduped, FK back to the raw row.
- **Announcement metadata ingestion** (NSE + BSE), as a pipeline2 dimension so
  it inherits the cascade, watermarks and gap sweep.
- **Bulk / block deals + insider (SAST) ingestion.** Daily structured reports,
  ~5 MB/yr, no parsing, no LLM. Composes immediately with what we already have:
  a documented institutional buy on a Waking Giants name, or on a stock that
  just entered Stage 2, is the strongest confirmation in the whole framework and
  we already hold both sides of that join.
- **`returns_since_result`** derived (not stored) from the event date.
- **Filing timeline on the chart + Thesis tab** — the first user-visible output.
- **Cache invalidation hook**: a new filing marks that stock's overview stale.

**Exit:** filing intelligence a user can see, with no extraction in the path.

---

## Sprint 3 — Tier B: CATALYST classification (the product)

- **Text extraction** into `km_filings_raw.raw_text`. Never the blob.
- **CATALYST classifier** — keyword V1 (catches ~80% per the filings spec) then
  LLM assist for the remainder. Classification is re-derivable from stored text,
  which is the whole reason raw is immutable: the V1 keyword list *will* be
  wrong, and reclassifying must not mean re-scraping three years of NSE.
- **Human review queue** — `human_reviewed` / `human_override`.
- **On-demand per-stock overview cache.** Explicit button, never a page load
  (*"read paths must not be able to trigger heavy work"*). Reuses
  `single_flight()` (64 stripes + PG advisory lock), `BackgroundTasks`, and the
  `km_vani_cache` snapshot-hash + version key pattern. Cache **raw facts and
  narrative separately**, keyed `(facts_hash, prompt_version)`.
- **Per-tier rate limit** off `km_profiles.tier` — Sonnet is required for Indian
  mid/small-cap knowledge (D42), so every trigger costs real money.

**Exit:** six of eight catalysts live. The cache warms on the stocks users
actually look at, which also self-selects the universe for Sprint 4.

---

## Sprint 4 — Tier C + the measurement

- **BSE XBRL quarterly panel**: Revenue, PAT, OPM, NPM × ~8 quarters. Four
  metrics — that is the *complete* fundamental field list across every scan in
  the reference deck.
- **J-Curve, Turnaround/Breakout Earnings, Consistent NPM** scanners.
- **The A/B**: do journeys waking within N days of a CATALYST filing confirm at
  better than **58.5%**? Reported with its denominator, per the house rule.

Two traps that silently fabricate a J-curve: **standalone vs consolidated**
mixed across quarters (fake inflection at the switch point), and **restatements
overwritten** (the trough moves). Store `as_reported` tied to the filing that
produced it; never overwrite.

**Exit:** J-curve live, and the first measured answer on whether catalysts
matter at all.

---

## Non-negotiables

1. **Never store the PDF.** URL + extracted text. 279 GB vs 2.2 GB.
2. **No `km_pead_tracker`.** It is a join, not a table.
3. **Key on `equity_id`, never `symbol`.** Symbols rename; 82% of the BSE
   universe is numeric scrip codes. Both reference specs key on symbol text —
   that breaks on the first rename and cannot join cleanly to `km_equity_eod`.
4. **Store `filing_time`; derive `day_0_trade_date` separately.** A result
   announced 16:30 has Day 0 = *next* session. Getting this wrong by one day
   injects lookahead bias into every drift number downstream. This single field
   decides whether the study is trustworthy.
5. **Raw is immutable.** Classification is re-derived, never re-scraped.
6. **Grant SELECT to `authenticated`** on anything PostgREST reads, and verify
   with `pg_class.relacl` — `information_schema.role_table_grants` is blind over
   a restricted connection.
7. **Measure before adopting any threshold.** Every number in the reference deck
   (mcap ≥ 1000, Revenue ≥ 20, PAT ≥ 30, × 1.10, the 2–5 week Early Stage 2
   window) is a round number with no stated basis. Check the distribution, and
   accept "no threshold" as an answer — the Price Action cooldown died that way.
8. **Base rates carry their denominator**, always. The reference deck has zero
   base rates in 88 pages; that is our differentiator, not our template.

---

## Deliberately out of scope

- **Geopolitical as a signal layer.** n = 4 in the source document, selected on
  outcome, no objective surprise metric, and the sector→stock mapping needs
  Sonnet per event at exactly the scale where n is too small to validate.
  **Narrative annotation only** — a curated `km_market_events` table VaNi can
  *cite* ("this move began around the Red Sea disruption"), making no base-rate
  claim we cannot defend.
- **Screener.in as a source.** Technically easy; ToS prohibits automated
  scraping and redistribution, we have paying users, it is a single point of
  failure with no fallback, and it does not carry the filing stream at all — so
  it would cost us the product to save 0 MB. NSE/BSE are where Screener gets it
  anyway.
- **Management interview indexing** (their "Tracking Management"). Interesting,
  unranked.

---

## Open decisions for the owner

1. **Universe for Tier B.** Full universe (440 MB/yr) or on-demand cache only
   (330 MB for 300 stocks over 5 years)? On-demand self-selects the stocks users
   care about; full universe makes the Sprint 4 A/B stronger.
2. **How far back to backfill.** Bounded by the spike, and by our own enriched
   layer: price history is 26 years but `ema_20` starts ~2025 and `delivery_pct`
   is on only 3,082 of 7,496 rows on the latest bar.
3. **Index cleanup timing** — Sprint 1 as written, or deferred.
4. **Sprint 3 gating.** Does the classifier ship behind the human review queue
   for a period, or straight to users with a confidence threshold?
