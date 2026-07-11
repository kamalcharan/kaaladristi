# Scanner Flag Backfill + Scanner-as-View Performance — Scoping

**Date:** 2026-07-11 · **Mode:** read-only scoping (no backfill, no views, no migrations run). MCP `kaala-postgres` **not live** — every live-data claim is flagged and has ready-to-run SQL in the appendices. Base: `kaaladristi/App`.

## TL;DR (read this first)

Two premises in the brief turned out to be wrong, and both matter:

1. **The flags are NOT the hard part of the backfill.** All 20 stored flag columns are **point-in-time** (no continuous state) — the existing `backfill_*.py` scripts already have `--full` modes. The long pole is **corporate-action adjustment + a 30-year indicator recompute** (L), because raw `km_equity_eod.close` is unadjusted and poisons every multi-day price derivative. A raw-price hit-rate would reproduce the exact W4 "poisoned number" trap.
2. **`stage_2_leaders` is NOT the slow scanner.** It's already a single server-side query. The real slowness is the **7 "bundle" scans downloading 120k–240k rows to the browser** and re-scoring in JS. That's network-bound and *is* fixable this sprint with a materialized view.

**The one decisive call (§7):** if only one of the two efforts ships this week, ship **the scanner materialized view** — it delivers a real, user-visible win inside the window and is independent of the CA mess. The backfill's actual payoff (a defensible hit-rate) is gated behind L-effort CA work that cannot honestly finish pre-launch; start that CA work in parallel as the post-launch unlock, but don't let it block the sprint.

---

## 1. Backfill verdict — per-flag

**Stored flag columns (the backfill targets, 20 total):** `stage`, `sma200_rising`, `is_vani_s2` (migration 097) + 18 `is_vani_*` screeners (migration 099). `is_vani_surge_or_breakout` / `is_vani_distrib_and_weakness` are `kd_scan_presets.vani_rule` **strings** (OR/AND of base flags), and `is_vani_opportunity` is an RPC output — **not stored columns, nothing to backfill.**

**Verdict: every stored flag is POINT-IN-TIME. Zero are stateful.** No flag reads a previous day's *computed flag*; every input is a column on the same row (`backfill_vani_flags.py:52-213`) or a strictly backward window (`backfill_stage_classification.py:57-140` — `LAG`, `ROWS…251 PRECEDING`). The only recursive quantity, `supertrend_dir` (`compute_engine.py:199-242`), is deterministically rebuilt from each symbol's series start — rebuilt-state, not incremental. **No state rebuild is needed.**

| Flag | Point-in-time? | CA-sensitive | Cross-sectional | Backfill effort (flag alone) |
|---|---|---|---|---|
| `stage`, `sma200_rising`, `is_vani_s2` | ✅ (bwd windows) | Yes | No | M (single-pass window UPDATE over the 17 GB table) |
| `is_vani_strength/breakout/surge/flow/rs/52wh/ath/delivery/ema20/score5d/score22d/hightrade/52wl/smart` | ✅ | **Yes** | No | S each (one SQL UPDATE/date) |
| `is_vani_overbought/oversold` | ✅ | Low (same-day RSI/RVOL self-heal ~14 bars) | No | S |
| `is_vani_distrib/weakness` | ✅ | Yes | No | S |
| *(support)* `rs_percentile` | ✅ | Yes | **Yes** | S but survivorship-biased (see §3) |

**Why only ~300 rows today?** Not a date guard or a refusal — the scripts fully support `--full`. They were **never run at scale**; the nightly pipeline only processes the latest date (`daily_pipeline.py:442-471`), so flags accumulate forward only from when the columns were added (migrations 097/099). Running `--full` would **mechanically** work but produce a **populated-but-CA-poisoned** 30-year history — correctness fails, not mechanics.

**Prerequisite ordering (the actual work):** flags sit on top of derived columns that must be backfilled first, in order: `indicators → rolling metrics → magic_rs → stage → rs_percentile → vani_flags` (mirrors nightly steps 6→6a→6g→6h→6k→6j). If run before the inputs are populated 30y, flag expressions evaluate against NULLs → silently FALSE (the script ships a `--diagnose` NULL probe precisely because this is the known landmine, `backfill_vani_flags.py:301-345`).

**Overall:** *straightforward point-in-time compute for the flags themselves (S/M, no state rebuild) — but gated behind a data-quality rebuild (CA-adjust + 30y indicator recompute) that is the long pole (L).*

---

## 2. CA-adjustment impact

**Raw `km_equity_eod.close/high/low` is NOT split/bonus-adjusted** (`adj_factor DEFAULT 1.0`, `adj_close` unpopulated — `km_migration_001:26-30`; confirmed by the impossible +22–34% 5-day returns in `ASTRO_VALIDATION_FINDINGS.md:39`). **Essentially every flag is wrong across a split/bonus window**, because each consumes a multi-day price/volume derivative:
- `w52_high/low`, `lifetime_high` → `is_vani_breakout/surge/52wh/52wl/ath` (a 1:1 bonus halves price → false 52w-low / false breakout)
- `ret_*`, `d365_pct_chng` → `is_vani_score22d`
- `rsi_14`, `sma_*`, `ema_20`, `supertrend_dir`, `magic_rs` → nearly every flag (windows straddle the split boundary)
- volume/value (`avg_amt_*`, `delivery_surge_x`, `value_cr`) → splits multiply share count

**Least-sensitive:** `is_vani_overbought/oversold` (same-day RSI/RVOL re-stabilize within ~14 bars). **Most-sensitive:** the breakout/RS/ATH/score family — i.e. **the product's headline scanners.**

**The existing scripts do NOT apply `adj_factor`** — they read raw-derived columns. **Applying it is not a WHERE-clause join:** you must compute a **cumulative** back-adjust (for each `(equity_id, trade_date)`, multiply `adj_factor` of every CA with `ex_date > trade_date`), then recompute all indicators on the adjusted series. `km_corporate_actions` schema is clean (`equity_id, ex_date, action_type, adj_factor`, indexed) but **30-year coverage is unverified** (source appears BSE-biased) — and adjustment is only as complete as that table. **This is the load-bearing, L-effort clause of the whole backfill.**

---

## 3. Universe-coverage / survivorship check

Only **one** column is cross-sectional: `rs_percentile` = `PERCENT_RANK() OVER (PARTITION BY trade_date ORDER BY magic_rs)` (migration 104). **Critically, no stored flag uses it** — the flags use `magic_rs` (stock-vs-fixed-benchmark, point-in-time). So the **stored-flag backfill has zero cross-sectional dependency.** Survivorship only bites a hit-rate study that *ranks the universe*.

**Survivorship risk, plainly:** if `km_equity_eod` holds only currently-listed symbols (delisted/renamed purged), any historical `rs_percentile` or universe-ranked hit-rate is biased — the 2005 "universe" scored using only 2026 survivors, inflating historical quality and hiding the losers. **Must verify before trusting any historical ranking.** Point-in-time flags are immune (each row judged on its own thresholds). SQL: Appendix A-(C).

---

## 4. Scanner slowness — root cause

**Two execution paths, opposite bottlenecks** (the brief's `stage_2_leaders` is the *wrong* example):

- **Path B (direct-query, 7 presets incl. `stage_2_leaders`, `breakout_surge`):** one latest-date PostgREST query + light JS map (`scanEngine.ts:1216-1332`). ≤500 rows, trivial CPU. Only cost = query latency + a double round trip (date lookup, then EOD). Bottleneck = **(c) query**, and only if `(trade_date, stage)` isn't indexed. **Not the problem.**
- **Path A (bundle, 7 presets: `power_buy, power_sell, smart_money, fresh_breakout, quiet_accumulation, distribution_warning, conviction_flow`):** `loadDailyBundle` (`scanEngine.ts:154-323`) downloads **~68 columns × ~30 sessions × ~4–8k stocks ≈ 120k–240k rows** in 10–20 parallel requests, then re-scores every stock in JS (`buildScanStock` + 3 `hasDotInHistory` loops per stock × 7 scans). Bottleneck = **(b) network payload PRIMARY, (a) client CPU secondary.** Amplified on the landing page: `getAllScanCounts` runs all 7 bundle scans over the universe (`:2128-2144`); `fetchVaniHighlights` fires all 14 (`:2018-2056`).

**One-line root cause:** the scanner ships a 30-day full-market EOD table to the browser and recomputes windowed indicators + industry ranks in JS on every visit. **Evidence** the payload is the lever: the code comment at `scanEngine.ts:158-161` records a prior cut from 115→45 days = "~60% of the scanner page's payload." Live confirmation SQL: Appendix B-(1),(4).

---

## 5. View / materialized-view recommendation per preset

Regular **VIEW** = server-side but recomputes per call (correctness/consolidation, no speed). **MV** = precomputed nightly, refreshed after the pipeline (fast reads, at-most-daily-fresh — correct for an EOD product). **12 of 14 → MV.**

| Preset | Path | Rec | Why |
|---|---|---|---|
| power_buy, power_sell | A | **MV** | per-row confluence + cross-sectional industry-rotation gate; only a matview makes the rank-join fast |
| smart_money, quiet_accumulation | A | **MV** | double cross-sectional (industry rank + accum delta) |
| fresh_breakout | A | **MV** | 20-day-high walk is exactly what precompute removes |
| distribution_warning | A | **MV** | needs a 10-day-ago zone comparison — bake into MV |
| conviction_flow | A | **MV** (VIEW ok) | pure per-row thresholds on latest snapshot |
| breakout_surge, stage_2_leaders, vani_opportunity | B | **MV** (VIEW acceptable) | single flag/threshold on latest snapshot; MV removes round trip + dedup |
| stage_2_watch, stage_4_leaders, stage_3_watch | B | **MV** | fold the client-side MA-stacking / death-cross / convergence filters into SQL WHERE |
| vani_exit_watch | B | **VIEW** (or MV) | already tiny (limit 25), heavily server-filtered |

Manipulation Watch is a **separate feature** (date-*range* scan) — leave client-side / its own MV later.

**Design — one big matview, not per-preset:** `km_scan_results(preset_id, rank, vani_flag, equity_id, trade_date, …~40 display cols)`, PK `(preset_id, equity_id)`. Every read becomes `SELECT … WHERE preset_id=$1 ORDER BY rank LIMIT $2`; `getAllScanCounts` becomes one `GROUP BY preset_id` (replacing 7 JS scans); `fetchVaniHighlights` becomes one `WHERE vani_flag` (replacing the 14-scan fan-out). One `REFRESH MATERIALIZED VIEW CONCURRENTLY` per night vs 12–14 separate statements. Indexes: UNIQUE `(preset_id, equity_id)` (required by CONCURRENTLY) + covering `(preset_id, rank)` + partial `(vani_flag)`. Divergent preset columns → union with NULL-fill (exactly how the TS `ScanStock` mappers already work).

**Refresh wiring:** append step 21 `('scan_matview', None)` to `DAILY_STEPS` (`orchestrator.py:34-55`), **after** `vani_flags`(16), `stage_classification`(15), `index_returns`(17), `industry_composites`(18); add `handle_scan_matview` running the `REFRESH … CONCURRENTLY` + register in dispatch/`KNOWN_DIMENSIONS` (`handlers.py:602-660`). A failed step is isolated, not fatal (`orchestrator.py:129-137`); `CONCURRENTLY` keeps the old snapshot readable during refresh.

**Frontend refactor size:** of scanEngine's 2,431 lines, **~900–1,200 are COMPUTE that moves to SQL** (bundle loaders ~370, scoring helpers ~310, Path A scan fns ~250, and ~80% of the Path B row→ScanStock mappers), leaving **~1,000–1,300 as plumbing/orchestration that stays or shrinks** (~285 of which is the separate Manipulation Watch). The engine could drop to **~600–900 lines**. **`ScanView.tsx` (1,396 lines) is ~100% UI and untouched** (sort, filters, exchange tabs, TradingView export, cards/tables).

**Guardrail note:** the volume-scale discontinuity guard (CLAUDE.md Known Issues) and the `LOW_VOLUME` RVOL suppression (`scanEngine.ts:499-503`) are baked into the JS scoring — any SQL translation **must reproduce them exactly** or results diverge from today's output. This is the main parity risk.

---

## 6. Do the two efforts interact? + combined sequencing

**They share the `is_vani_*` columns as a common dependency but are otherwise independent.**
- **Shared:** both read the same flag columns in `km_equity_eod`. If the daily pipeline fills flags for *today* (it does), the scanner matview is correct for today **for free** — one source of truth, two consumers.
- **Independent grain:** the scanner matview is **latest-snapshot only** (one date). A 30-year **hit-rate** query ("does `is_vani_s2` at T predict forward return at T+n?") scans the **full history** joined to forward returns — a different grain the scanner matview does *not* accelerate. The hit-rate wants its **own** artifact (a `km_flag_hitrate` aggregate).
- **Net:** **Q2 does NOT need the 30y backfill to ship** (it only needs the latest date). Doing Q1 first would mean the matview inherits validated flags, but that's a bonus, not a dependency.

**Minimum-viable versions (each, in an ~11-day window):**
- **Q2 MVV (fits, ships real value):** refresh wiring (S) + one `km_scan_results` matview covering the **7 Path A scans** + `getAllScanCounts`, repoint those reads (M–L); keep Path B `fetch*` as-is. Eliminates the 120k–240k-row bundle download + the landing-page 7-scan JS loop — the reported slowness.
- **Q1 MVV (does NOT fit as a *measured* deliverable):** the honest 30y hit-rate needs CA-adjust + indicator recompute (**L**), which won't credibly finish. The only defensible partial is a **CA-clean slice** (NSE-only, price floor, drop CA-window symbols) presented as **"screen membership," not a hit-rate**. Shipping a raw-price hit-rate = the W4 poisoned-number failure.

---

## 7. Single clearest recommendation (decisive)

**This week, prioritize the scanner materialized view (Q2). Start the CA-adjustment (Q1's prerequisite) in parallel as the long-pole that unlocks the hit-rate post-launch — but do not let it gate the sprint.**

Why, bluntly:
- **Q2 is the only one of the two that can honestly SHIP a real improvement inside the window.** The MVV (refresh wiring + one union matview for the 7 bundle scans + landing counts) fits ~11 days, is low-risk (ScanView untouched), and kills the actual user-visible slowness. It also *retroactively* makes scanner correctness a server concern instead of 1,200 lines of browser JS.
- **Q1's real deliverable — a defensible hit-rate (the audit's W4 trust asset) — is impossible this sprint.** It's blocked behind L-effort CA-adjustment + 30y indicator recompute. Prioritizing "backfill" this week yields either nothing shippable or a confident-but-poisoned number that is *worse* than shipping no number, because a wrong hit-rate is a permanent credibility liability.
- **The CA-adjustment is nonetheless the single highest-leverage DATA fix in the whole product** (it poisons scanners, backtests, astro validation, everything), so it must *start* now even though it lands post-launch. It is the unlock for the hit-rate, and it de-risks the scanner matview's own numbers.

Sequence: **CA-adjust (start now, L, lands post-launch) → then flag `--full` (S/M, trivial once inputs are clean) → then the `km_flag_hitrate` artifact (the GTM claim).** In parallel and independent: **scanner matview MVV (this sprint).**

---

## 8. VaNi scanner explanations + Q&A (added scope)

**The existing "✦ Ask VaNi" is a curated intent-BUTTON picker, not free-text.** Topbar button → `VaNiChatPanel.tsx` (global, `Layout.tsx:83`) → `vaniStore` + `usePageContext` → `POST /api/vani/ask` (`pipeline2_api.py:4650`) → intents in `lib/vani_intents.py`, one LLM completion per canned `intent_id`, cached, SEBI-post-filtered. `/scanner` **already maps to page `'scanner'`** and the `VaNiPage` union already lists `'scanner'` — but **zero scanner intents are defined and the preset id isn't captured.** That gap is the whole task. **Extend this surface; don't build a new one.**

**Two capabilities, two answers:**
1. **Per-scanner explanation ("what it does / how to use") → authored copy, NO LLM.** `kd_scan_presets` already has `description`/`tooltip` (rendered `ScanView.tsx:1011-1019`). Add `how_to_use` / `what_to_watch` columns (or one `explainer JSONB`) + seed SEBI-reviewed copy for the 14 fixed scanners. An LLM re-derives the same paragraph on every miss and adds drift risk for zero benefit; authored copy is auditable and owner-editable.
2. **Q&A → LLM, via Ask VaNi, in two tiers:**
   - **Tier 1 (MVP, no new UI):** scanner-scoped **canned intents** (`scanner.what_is_this`, `.how_to_use`, `.why_these`, `.strongest`) in `config/vaniIntents.ts` + `lib/vani_intents.py` under a `scanner.` prefix, with `assemble_scanner_context(db, preset_id, date)`. Reuses `/api/vani/ask`, cache, logging verbatim. Only wiring: capture `:presetId` in `usePageContext` and forward it as `page_context`.
   - **Tier 2 (Phase 2, real free-text):** a `scanner_qa` skill in `ai_prompts.py` + a `question` field on the request + a `<textarea>` in `VaNiChatPanel` (the one genuinely new UI element — and it upgrades Ask VaNi to free-text everywhere). Context (scanner definition + a company's current metrics from `km_equity_eod`) all already exists; reuse `assemble_equity_context`. **SEBI: fail-closed** through `_apply_vani_post_filter` + the stricter `_forbidden_phrases` gate (`pipeline2_api.py:2066, 4543-4558`) — return null on a hit, never a "cleaned" risky string.
   - **Company "why is it here":** drop the existing per-row **`VaNiTrigger`** into each scan result row — it already fires the `equity.why_in_context` intent; just make that assembler scanner-aware (pass the active preset). No new component.

**Effort / MVP:** authored explanations **S** · Tier-1 canned intents **S–M** · per-row `VaNiTrigger` **S** · Tier-2 free-text **M** (defer — it's the highest SEBI/cost surface; canned intents cover ~80% of intent). **MVP = authored explanations + Tier-1 intents + `VaNiTrigger`.** Full design + file touch-list: `scratchpad/q3_vani_scanners.md`.

**Where this sits vs Q1/Q2:** independent of both, and the cheapest high-perceived-value item. Reasonable to slot the **authored explanations (S)** alongside the Q2 matview this sprint; Tier-1 intents + free-text follow.

---

## Appendix A — Backfill verification SQL (run when MCP is live / in pgAdmin)

```sql
-- (A) Flag coverage by year — confirm "~300 rows" and find the cutover date
SELECT EXTRACT(YEAR FROM trade_date)::int AS yr, COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE stage IS NOT NULL) AS has_stage,
       COUNT(*) FILTER (WHERE is_vani_s2)        AS s2_true,
       COUNT(*) FILTER (WHERE rs_percentile IS NOT NULL) AS has_rspct
FROM km_equity_eod GROUP BY 1 ORDER BY 1;

-- (B) Underlying indicator coverage by year — the REAL prerequisite
SELECT EXTRACT(YEAR FROM trade_date)::int AS yr, COUNT(*) AS rows,
       COUNT(magic_rs) magic_rs, COUNT(w52_high) w52_high, COUNT(lifetime_high) lifetime_high,
       COUNT(ema_20) ema_20, COUNT(sma_200) sma_200, COUNT(supertrend_dir) supertrend_dir,
       COUNT(delivery_surge_x) delivery_surge_x, COUNT(rss_value) rss_value
FROM km_equity_eod GROUP BY 1 ORDER BY 1;

-- (C) Survivorship — symbols per year + delisted-like (no row in last 90d)
SELECT EXTRACT(YEAR FROM trade_date)::int yr, COUNT(DISTINCT equity_id) symbols
FROM km_equity_eod GROUP BY 1 ORDER BY 1;
SELECT COUNT(*) AS delisted_like FROM (
  SELECT equity_id, MAX(trade_date) last_seen FROM km_equity_eod GROUP BY equity_id) t
WHERE last_seen < (SELECT MAX(trade_date) FROM km_equity_eod) - INTERVAL '90 days';

-- (D) CA coverage + is adj actually applied?
SELECT EXTRACT(YEAR FROM ex_date)::int yr, action_type, COUNT(*) n
FROM km_corporate_actions GROUP BY 1,2 ORDER BY 1,2;
SELECT (SELECT COUNT(DISTINCT equity_id) FROM km_corporate_actions) eq_with_ca,
       (SELECT COUNT(*) FROM km_equity_symbols) eq_total;
SELECT COUNT(*) rows, COUNT(adj_close) has_adj_close,
       COUNT(*) FILTER (WHERE adj_factor <> 1.0) non_default_adj FROM km_equity_eod;

-- (E) Contamination probe — >40% overnight moves = unadjusted splits/bonuses
SELECT COUNT(*) suspicious_gaps FROM (
  SELECT close / NULLIF(LAG(close) OVER (PARTITION BY equity_id ORDER BY trade_date),0) - 1 d
  FROM km_equity_eod) t WHERE ABS(d) > 0.40;
```

## Appendix B — Scanner-perf verification SQL / EXPLAIN

```sql
-- (1) Path A payload size
SELECT COUNT(*) active FROM km_equity_symbols WHERE is_active = true;
SELECT COUNT(*) bundle_rows FROM km_equity_eod
WHERE trade_date >= (CURRENT_DATE - INTERVAL '45 days');   -- confirm 120k-240k

-- (2) Path B: is the stage/date filter index-backed?
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM km_equity_eod
WHERE stage='S2' AND trade_date=(SELECT max(trade_date) FROM km_equity_eod)
ORDER BY magic_rs DESC LIMIT 500;   -- want Index Scan on (trade_date,stage); Seq Scan => add index

-- (3) Existing indexes on the hot table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename='km_equity_eod';

-- (4) Matview refresh cost (after building km_scan_results): \timing on; REFRESH … CONCURRENTLY;
```

*Read-only scoping. No code, views, migrations, or backfills were executed. Detailed working: `scratchpad/q1_backfill.md`, `q2_views.md`, `q3_vani_scanners.md`.*
