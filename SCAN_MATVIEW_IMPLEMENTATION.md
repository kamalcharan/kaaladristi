# Scanner Materialized View MVP — Implementation

**Status:** Phase 1 (rule inventory + schema design + audit/observability addendum) — **FOR REVIEW, not yet run.** Part 2 guard-firing check **run — 2 of 4 guards are DOMINANT (zone 47.5%, flow 77.4%)**, see §Part 2 RESULTS. Phase 1c (real matview SQL) **stays gated** on the Part 2b zone/flow distribution follow-ups before the invalid-zone coercion can be ported.
**Branch:** `claude/ready-for-task-xh6bih`
**Target migration:** `km_migration_147_scan_results_matview.sql` (next free number).
**Scope:** the **7 Path A / bundle scanners** only. The 7 Path B (direct-query) scanners are out of scope and MUST NOT regress.

| In scope (Path A → matview) | Out of scope (Path B, untouched) |
|---|---|
| `power_buy` (Strength Confluence) | `stage_2_leaders` |
| `power_sell` (Weakness Confluence) | `conviction_flow`* |
| `smart_money` (Smart Money Loading) | `breakout_surge` |
| `fresh_breakout` (Fresh Breakouts) | …the other direct-query presets |
| `quiet_accumulation` (Quiet Accumulation) | |
| `distribution_warning` (Distribution Warnings) | |
| `conviction_flow` (Conviction Flow)* | |

\* `conviction_flow` appears once — it is a bundle scan (`scanConvictionFlow`, line 1021) and is **in scope**. Listed on both sides above only to flag the naming collision for the reviewer; treat it as Path A.

---

## ⚠️ Execution gating (read first)

This document is the **auditable spec**. The SQL port itself, the parity diff, the
migration run, and the perf timing **cannot be produced or verified in this
environment** — the MCP `kaala-postgres` connector is not live and there is no
running app/DB here. Concretely, these steps are **owner-executed / MCP-gated**:

1. **Run migration 147** on `kaala_dristi_db` (pgAdmin/psql).
2. **Parity diff** — for each of the 7 presets, compare the matview's `(preset_id, equity_id, rank)`
   set against the live JS scanner output on the same trade date. Row-for-row parity of 7 scanners
   is **impractical to do by hand** — strongly recommend standing up the read-only MCP connector
   first so the diff can be scripted.
3. **Perf before/after** — time `executeScan()` for each preset pre- and post-repoint.
4. **Path B regression check** — confirm the 7 direct-query scanners are byte-for-byte unchanged.

**Nothing in Phases 2–4 should be run against production until the parity diff on a
staging/backup copy is clean.** Confirm the current backup dump name with the owner
before any Phase 4 execution.

---

## Phase 1a — Named rule inventory

Every rule below is cross-referenced to `App/frontend/src/services/scanEngine.ts`
line numbers (as read on this branch). These become **SQL comments** in migration
147 so the port is auditable line-by-line. **No rule is silently "fixed"** —
suspected bugs are flagged in §Quirks, not changed.

### Shared helper: `buildScanStock` computed fields (589–726)

Every bundle scan starts from a `ScanStock` produced here. The matview must
reproduce these per-equity, per-trade-date columns exactly:

| Field | Rule | Line |
|---|---|---|
| **Exclusion guard** | `eod.ema_20 == null` → row dropped entirely (insufficient history, <20 bars). `ema_20 = 0` never occurs in DB. | 600 |
| **Zone guard** | if `magic_rs_zone` set but ∉ `VALID_ZONES` → coerced to `null`. | 603–605 |
| `reward` | `(ema_20 + atr_14) − close`; null if either input null. | 612 |
| `rewardPct` | `((ema_20 + atr_14) − close) / atr_14`; null if atr_14 ≤ 0. | 613 |
| `pctBelow52wHigh` | `Number(pct_below_52w_high)` or null. | 614 |
| `magicRsTrend[0..4]` | per bar i (0..4): `history[i].magic_rs > history[i+1].magic_rs` (desc-sorted), else null. **Boolean array, 5 elements.** | 616–620 |
| `xAmt` | `avg(value_cr over ≤5 bars) / avg(value_cr over ≤22 bars)`; null if denom ≤0 or empty. **Rounded to 3 dp.** | 622–627, 701 |
| `rel_5d/22d/66d_n50` | `stock.ret_Nd − NIFTY50.ret_Nd`; null if either null. **Rounded 2 dp.** | 640–642, 702–704 |
| `rel_5d/22d/66d_n500` | `stock.ret_Nd − NIFTY500.ret_Nd`; null if either null. **Rounded 2 dp.** | 643–645, 705–707 |
| `has_recent_svd` | `hasDotInHistory(history,'svd',5)` — see below. | 668 |
| `has_recent_sbd` | `hasDotInHistory(history,'sbd',5)`. | 669 |
| `has_recent_syd` | `hasDotInHistory(history,'syd',5)`. | 670 |

Returns (`ret_5d/22d/66d`) come from **DB columns** (migration 111), not a client
walk. NIFTY 50 / NIFTY 500 returns come from `km_index_eod` (see loadDailyBundle).

### Shared helper: `hasDotInHistory` (519–558)

5-bar lookback (`bars = history.slice(0, 6)`), iterate `i` in `[0, min(5, len-1))`,
`bar = bars[i]`, `prev = bars[i+1]`. `range = high − low`; **skip bar if range ≤ 0**.
`bodyRatio = |close − open| / range`.

| dotType | Condition (ALL must hold) | Line |
|---|---|---|
| **svd** | `rvol > 10` ∧ `close > (high+low)/2` ∧ `prev.close > 0` ∧ `close > prev.close × 1.02` ∧ `bodyRatio ≥ 0.5` ∧ `close > open` | 534–541 |
| **sbd** | `rvol ≥ 3` ∧ `rvol < 10` ∧ `close > open` ∧ `close > high − range/3` ∧ `bodyRatio ≥ 0.45` | 542–548 |
| **syd** | `close < prev.close` ∧ `rvol ≥ 2` ∧ `close < low + range/3` | 549–554 |

Returns true on first matching bar in the window. **Canonical source:** `visualPulseEngine.ts
computeDots()` + `km_migration_033` dot_signals CTE — three copies must stay in sync (517).

### Shared helper: `getIndustryClassifications` (562–585)

Operates on `bundle.industries` (all industries for latest date, with rank).
`total = industries.length`; `topQuartileCutoff = ceil(total/4)`;
`bottomQuartileCutoff = total − topQuartileCutoff`.

Per industry: `oldRow = history.length > 4 ? history[min(4, len−1)] : null` (~5 sessions ago);
`rankChange = oldRow ? oldRow.industry_rank − ind.industry_rank : 0`.

| Set | Rule | Line |
|---|---|---|
| `rotatingIn` | `rankChange ≥ 5` | 578 |
| `rotatingOut` | `rankChange ≤ −5` | 579 |
| `leading` | `industry_rank ≤ topQuartileCutoff` | 580 |
| `lagging` | `industry_rank > bottomQuartileCutoff` | 581 |

### Shared helper: `evaluateOpportunity` (486–511) — VaNi fallback gate

Used **only** as the vaniOpportunity fallback when a preset has no `vani_rule` (724).
Guard: `!ema_20 || !atr_14 || atr_14 ≤ 0` → false (487).

- `isBearish` = config.flow_types contains FRESH_SHORTS or LONG_LIQUIDATION (488).
- `withinBand` = `ema_20 − band×atr_14 ≤ close ≤ ema_20 + band×atr_14` (489–491).
- `runway` = bearish: `close − (ema_20 − band×atr_14)`; bullish: `(ema_20 + band×atr_14) − close` (494–496).
- `hasReward` = `runway > reward_min_atr_multiple × atr_14` (497).
- `zoneOk` = config.magic_rs_zones includes zone (498).
- **LOW_VOLUME guard (⚠ preserve):** `flowOk = (flow_type == 'LOW_VOLUME' && !isBearish) ? true : config.flow_types.includes(flow_type)` (501–503).
- `rvolOk` = `rvol ≥ config.rvol_min` (504).
- result = all five AND'd (505).

### Shared helper: `computeVaniOpportunity` (768–793) — VaNi rule dispatch

Preferred vaniOpportunity path (720–724): if preset has `vani_rule`, use this; else fallback to `evaluateOpportunity`.

| vani_rule | Rule | Line |
|---|---|---|
| `always_true` | true | 771–772 |
| `is_vani_s2` | `!!is_vani_s2` | 773–774 |
| `rvol_surge_and_52wh` | `rvol > 2 ∧ close ≥ w52_high × 0.98` | 775–777 |
| `is_vani_surge_or_breakout` | `is_vani_surge ‖ is_vani_breakout` | 778–779 |
| `is_vani_distrib_and_weakness` | `is_vani_distrib ‖ is_vani_weakness` (OR despite name) | (780+) |
| `is_vani_weakness` | `!!is_vani_weakness` | (780+) |
| `is_vani_smart` | `!!is_vani_smart` | (780+) |
| `is_vani_oversold` | `!!is_vani_oversold` | (780+) |

**Note:** the 7 bundle scanners historically use the `evaluateOpportunity` fallback because
the `is_vani_*` columns are not in the bundle EOD SELECT (747–751). The matview port is the
natural point to switch them to `computeVaniOpportunity` **if** the flags are backfilled — but
that is a **behavior change** and must be an explicit owner decision, not a silent port
substitution. Default: **replicate current behavior** (evaluateOpportunity fallback).

---

### The 7 in-scope scanners

Notation: `E` = eligible universe filter; `F` = per-stock filter (ALL must hold);
`S` = sort; `L` = limit. Line ranges are the function bodies.

#### 1. `scanPowerBuy` → Strength Confluence (809–839)
- **E:** industry ∈ (`rotatingIn` ∪ `leading`).
- **F:** `accum_distrib = 'ACCUMULATION'` **OR** (`close > sma_150` ∧ zone ∈ {Strong Bull, Mild Bull} ∧ flow ∈ {FRESH_LONGS, SHORT_COVERING} ∧ `rvol > 1.5`).
- **S:** `magic_rs` DESC. **L:** 25.

#### 2. `scanPowerSell` → Weakness Confluence (847–876)
- **E:** industry ∈ (`rotatingOut` ∪ `lagging`).
- **F:** `accum_distrib = 'DISTRIBUTION'` **OR** (zone ∈ {Strong Bear, Mild Bear} ∧ flow ∈ {FRESH_SHORTS, LONG_LIQUIDATION}).
- **S:** `magic_rs` ASC. **L:** 25.

#### 3. `scanSmartMoney` → Smart Money Loading (879–905)
- **E:** industries with `pct_accumulation > 60`.
- **F:** `symbol` matches `/^[A-Z]/` (drops BSE numeric codes) ∧ `delivery_pct > 60` ∧ `rss_value > 0`.
- **S:** `delivery_pct` DESC. **L:** 25.

#### 4. `scanFreshBreakout` → Fresh Breakouts (908–936)
- **E:** industry ∈ `leading`.
- **F:** `rvol > 2` ∧ `close > max(high over history[1..21])` (prior 20-day high, **excludes today**) ∧ `close > sma_150`.
- **S:** `rvol` DESC. **L:** 25.

#### 5. `scanQuietAccumulation` → Quiet Accumulation (939–976)
- **E:** industry **NOT** in top quartile (`rank > topQuartileCutoff`) ∧ industry accumulation rising (`pct_accumulation now − 5d ago > 0`).
- **F:** `accum_distrib = 'ACCUMULATION'` ∧ `sniper_inst(now) > sniper_inst(5d ago)`.
- **S:** `accChange` (industry pct_accum delta) DESC. **L:** 25.

#### 6. `scanDistributionWarning` → Distribution Warnings (979–1018)
- **E:** (none beyond per-stock).
- **F:** zone ∈ {Mild Bull, Neutral, Mild Bear} (explicitly **NOT** Strong Bull/Bear) ∧ was **Strong Bull** 10 sessions ago (`history[9].magic_rs_zone`) ∧ (`has_recent_syd` **OR** `volume_divergence_flag = 'VOLUME_DIV_DOWN'`).
- **Score:** `|rankDrop| × |magicRsChange|`. **S:** score DESC. **L:** 25.

#### 7. `scanConvictionFlow` → Conviction Flow (1021–1060)
- **E:** `ema_20 > 0` ∧ `history.length ≥ 5`.
- **F:** `d_pct = (close − ema_20)/ema_20 × 100 ∈ [−8, 8]` ∧ `avg_amt_22d > 1.5` ∧ `delivery_surge_x > 1.5`.
- **S:** `delivery_surge_x` DESC. **L:** 50.

---

## Phase 1b — `km_scan_results` matview schema (migration 147)

One wide matview, one row per (preset, qualifying equity), pre-ranked and pre-limited
so the frontend does a single indexed lookup.

```sql
-- km_migration_147_scan_results_matview.sql  (DRAFT — do not run until parity-diffed)
-- Materializes the 7 Path A bundle scanners. Rule inventory: SCAN_MATVIEW_IMPLEMENTATION.md §1a
CREATE MATERIALIZED VIEW km_scan_results AS
  -- 7 UNION ALL blocks, one per preset, each already sorted + LIMIT-ed,
  -- rank assigned via ROW_NUMBER() OVER (ORDER BY <preset sort>).
  ...
WITH NO DATA;

-- CONCURRENTLY refresh requires a UNIQUE index:
CREATE UNIQUE INDEX ux_km_scan_results_pk    ON km_scan_results (preset_id, equity_id);
CREATE        INDEX ix_km_scan_results_rank  ON km_scan_results (preset_id, rank);
CREATE        INDEX ix_km_scan_results_vani  ON km_scan_results (vani_flag) WHERE vani_flag;

-- Grants — MUST include authenticated (LESSONS_LEARNED: logged-in users run as
-- DB role `authenticated`; migration 142 lesson). Also anon/kd_app/admin/"user"/kd_readonly.
GRANT SELECT ON km_scan_results TO authenticated, anon, kd_app, admin, "user", kd_readonly;
NOTIFY pgrst, 'reload schema';
```

**Column set (~40):** `preset_id TEXT`, `rank INT`, `vani_flag BOOL`, `equity_id INT`,
`trade_date DATE`, plus the display/sort columns the 7 scanners return —
`symbol, company_name, industry, exchange, close, pct_chng, magic_rs, magic_rs_zone,
flow_type, rvol, sniper_inst, accum_distrib, rss_value, delivery_pct, delivery_surge_x,
avg_amt_22d, sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50, rel_5d_n500, rel_22d_n500,
rel_66d_n500, has_recent_svd, has_recent_sbd, has_recent_syd, score` (score used by
distribution_warning). `magic_rs_trend` → store as `SMALLINT[]` or 5 bool cols (TBD in port).

**PK `(preset_id, equity_id)`** — a stock can appear in multiple presets, never twice in one.

### Phase 1b.1 — Audit / provenance columns (addendum, 2026-07-11)

**Owner concern:** *"fallbacks are riskier than wrong answers — a defaulted/guard-excluded
row looks identical to a genuinely-computed one. I will never know if it is correctly
calculated or defaulted."* Every guard in §1a (ema_20 exclusion, LOW_VOLUME workaround,
zone coercion, atr_14≤0, history-insufficiency) is **correct as ported** but currently
leaves **no trace**. These columns add that trace. **They change no scoring, filtering, or
ranking** — the parity diff on every already-specified column must stay byte-for-byte
identical. Additive only. Populated by the *same* pass that already makes the decision — not
a second computation.

| Column | Type | Set when |
|---|---|---|
| `vani_path` | TEXT | `'evaluateOpportunity'` \| `'computeVaniOpportunity'` — which path actually produced this row's `vani_flag`. Records the fallback-vs-flag decision per row and pre-positions data for the post-launch flag-based switch. |
| `flow_guard_applied` | BOOLEAN | true when the LOW_VOLUME workaround (evaluateOpportunity 501–503) *specifically* is what let the row pass `flowOk` — i.e. `flow_type='LOW_VOLUME' && !isBearish`, rather than the actual flow matching the configured types. |
| `zone_coerced` | BOOLEAN | true when `buildScanStock`'s zone guard (603–605) nulled an invalid `magic_rs_zone`, rather than the stock genuinely having no zone. |
| `history_insufficient` | BOOLEAN | true when a history-length guard governed presence (only meaningfully recordable for the *included* case, e.g. `scanConvictionFlow`'s `history.length < 5` boundary). The `ema_20 == null` full-row exclusion (600) drops the row entirely → no row to flag → captured in the exclusion-counts table below, not here. |
| `guard_notes` | TEXT[] (nullable) | free-form array of any other guard/magic-number boundary that fired for this row — e.g. `'rank_change_boundary'` (rotation landed exactly on ±5), `'d_pct_boundary'`, `'breakout_tie'`. Optional; include only if it doesn't materially complicate the UNION blocks. |

### Phase 1b.2 — Exclusion companion table `km_scan_exclusion_counts` (addendum)

Audit columns can only describe rows that made it in. The **riskiest** fallback behavior is
the rows silently *dropped* (`ema_20 == null` never produces a row to flag). A per-(preset,
date) aggregate answers *"how much of the universe did we silently drop today, and why"* —
a question that should be visible **before** launch, not discovered when a user notices a
scanner returns suspiciously few rows.

```sql
CREATE MATERIALIZED VIEW km_scan_exclusion_counts AS
SELECT
  preset_id, trade_date,
  COUNT(*)                                             AS total_candidates,
  COUNT(*) FILTER (WHERE ema_20 IS NULL)               AS excluded_null_ema20,
  COUNT(*) FILTER (WHERE atr_14 IS NULL OR atr_14<=0)  AS excluded_null_atr,
  COUNT(*) FILTER (WHERE history_insufficient)         AS excluded_insufficient_history,
  COUNT(*) FILTER (WHERE included)                     AS included_count
FROM <per-preset candidate CTE>   -- the pre-guard universe for each preset
GROUP BY preset_id, trade_date
WITH NO DATA;
CREATE UNIQUE INDEX ux_km_scan_excl_pk ON km_scan_exclusion_counts (preset_id, trade_date);
GRANT SELECT ON km_scan_exclusion_counts TO authenticated, anon, kd_app, admin, "user", kd_readonly;
```

Cheap `COUNT(*) FILTER (...)` computed alongside the main matview build; refreshed in the
same step. Surfaced in Data Health (see Part 3).

---

## Phase 2 — Refresh paths (design)

1. **Nightly:** append a `scan_results` dimension to pipeline2 `DAILY_STEPS`
   (`orchestrator.py`), after `vani_flags` / `stage_classification` / `index_returns` /
   `industry_composites` — matview depends on all of them. Handler in `handlers.py`
   runs `REFRESH MATERIALIZED VIEW CONCURRENTLY km_scan_results;` and registers in
   `KNOWN_DIMENSIONS`.
2. **Manual:** a `POST /api/pipeline2/refresh-scans` (or reuse the `fix` job type with
   dimension `scan_results`) so the owner can refresh on demand after a backfill.

## Phase 3 — Frontend repoint (design)

Repoint the 7 scan functions + `getAllScanCounts` + `fetchVaniHighlights` to read
`km_scan_results` via PostgREST (`?preset_id=eq.<id>&order=rank`) instead of
`loadDailyBundle` + client compute. Path B functions untouched. Keep the JS scan
functions in the tree (dead but referenced by the parity diff) until Phase 4 passes.

## Phase 4 — Ship gate

Run migration → parity diff clean on all 7 presets (staging/backup copy first) →
perf before/after captured → Path B regression check → then repoint in prod.
**Confirm backup dump name with owner before executing.**

Ship-gate scope is unchanged by the addendum: the audit columns/exclusion table are
**additive** and must not perturb the parity diff. Wiring the exclusion aggregate into
`DataHealthGrid` (Part 3) is a **fast-follow after** the gate, not a gate item.

---

## Addendum plan deltas (2026-07-11)

- Phase 1b schema gains 5 audit columns (§1b.1) + companion table `km_scan_exclusion_counts` (§1b.2).
- **Before Phase 1c SQL is finalized:** run the Part 2 guard-firing check (⛔ blocking; MCP not live) and I state the finding plainly here.
- Part 3 investigated — recommendation: extend `DataHealthGrid` with a `scan_results` dimension for the exclusion aggregate; do **not** reuse the correlation pill/bar; per-row audit columns get no UI here.
- **No change to parity requirements** — audit columns are additive; every displayed column still matches JS exactly.
- Per-row audit-column **UI is out of scope** (columns only) — folds into the VaNi per-row "why is this here" explainer later.
- Part 3 wiring reports back **before Phase 4** so the owner can decide the fast-follow; it does not block schema/SQL.

---

## Part 2 — Guard-firing frequency check (⛔ BLOCKING on live DB)

The schema was designed entirely from reading code — **zero visibility** into how often
these guards actually fire on real data. That blind spot must be closed **before Phase 1c
SQL is finalized**, because the answer changes priorities: if a guard fires on ~2% of rows
it's a genuine edge case and the audit columns are a safety net; if it fires on 30–40% for
any preset, a meaningful share of what looks like "signal" is actually fallback behavior —
a finding the owner needs stated plainly, and one that would make the currently-deferred
flag-based backfill **urgent, not post-launch**.

**MCP connector `kaala-postgres` is NOT live in this environment → this is a BLOCKING
UNKNOWN. I have not guessed the answer.** Run this manually (or via MCP once live) and
paste results back; I will state the finding plainly in this doc regardless of direction:

```sql
-- Guard-firing frequency across the universe, latest trade date.
SELECT
  COUNT(*)                                              AS total_rows,
  COUNT(*) FILTER (WHERE ema_20 IS NULL)                AS null_ema20,
  COUNT(*) FILTER (WHERE atr_14 IS NULL OR atr_14 <= 0) AS null_or_zero_atr,
  COUNT(*) FILTER (WHERE magic_rs_zone IS NOT NULL
                    AND magic_rs_zone NOT IN
                    ('Strong Bull','Mild Bull','Neutral','Mild Bear','Strong Bear'))
                                                        AS invalid_zone,
  COUNT(*) FILTER (WHERE flow_type = 'LOW_VOLUME')      AS low_volume_flow
FROM km_equity_eod
WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod);
```

Note: `low_volume_flow` here is universe-wide; the guard only *fires* when a LOW_VOLUME row
would otherwise pass a bullish preset's other gates — so this count is an **upper bound** on
`flow_guard_applied`. The real per-preset firing rate comes from the audit columns once the
matview is built. Interpret this pre-build query as a magnitude check, not the final number.

### Part 2 — RESULTS (latest trade date, 2026-07-11)

```
total_rows | null_ema20 | null_or_zero_atr | invalid_zone | low_volume_flow
     5,340 |          2 |               45 |        2,538 |           4,133
```

| Guard | Rows | % of universe | Verdict |
|---|---|---|---|
| `ema_20 IS NULL` (full-row exclusion, line 600) | 2 | **0.04%** | ✅ Genuine edge case. Audit/exclusion-count is a safety net exactly as intended. |
| `atr_14 IS NULL OR ≤ 0` (evaluateOpportunity guard, 487) | 45 | **0.84%** | ✅ Genuine edge case. Safety net as intended. |
| `magic_rs_zone` invalid → coerced null (603–605) | 2,538 | **47.5%** | 🔴 **DOMINANT — not an edge case.** Nearly half the universe has a *non-null* zone that isn't one of the 5 canonical Title-Case values, so the scanner silently nulls it. Any zone-gated preset (power_buy, power_sell, distribution_warning) is filtering against a field that's blank for ~half the market. |
| `flow_type = 'LOW_VOLUME'` (workaround, 501–503) | 4,133 | **77.4%** | 🔴 **DOMINANT — not an edge case.** The LOW_VOLUME bypass is not a rare safety net; it is the majority regime. On bullish VaNi evaluation the flow gate is effectively disabled for 3 of every 4 stocks. |

**Plain statement (per the owner's ask):** two of the four guards are **dominant, not rare**.
The audit-column framing ("safety net for edge cases") holds for `ema_20`/`atr_14` but is the
**wrong mental model** for zone and flow — those are not edge cases being caught, they are
structural data-quality conditions affecting most of the universe. This is exactly the
"is the fallback rare or dominant" question the owner raised, and the answer for two guards
is *dominant*.

**Consequence for priorities:**
- The deferred **flag-based backfill** (is_vani_* + CA-adjustment) moves from "post-launch
  nice-to-have" toward **launch-relevant**, because 77% LOW_VOLUME means the current
  flow-based signal is largely inert on the live universe — the flags would be measuring
  something real where flow_type currently isn't.
- The **47.5% invalid-zone** number is not yet explainable from code alone and **must not be
  ported blind.** Faithfully replicating the coerce-to-null would reproduce a scanner that
  blanks half the market's zone — correct as parity, but potentially papering over a real
  data bug. **Phase 1c stays gated** until we see what those 2,538 values actually are.

### Part 2b — Follow-up queries required before Phase 1c (⛔ still blocking)

Need the actual value distributions to know whether invalid-zone / LOW_VOLUME are **data
bugs** (wrong case/format, mis-scaled RVOL) or **genuine** conditions:

```sql
-- (1) What ARE the 2,538 "invalid" zone values? Case/format artifact, or garbage?
SELECT magic_rs_zone, COUNT(*) AS n
FROM km_equity_eod
WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
GROUP BY magic_rs_zone
ORDER BY n DESC;

-- (2) Full flow_type distribution — is LOW_VOLUME concentrated in BSE / low-history / a
--     specific exchange, or truly universe-wide?
SELECT exchange, flow_type, COUNT(*) AS n
FROM km_equity_eod
WHERE trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
GROUP BY exchange, flow_type
ORDER BY exchange, n DESC;
```

Hypotheses to confirm/reject with the above (not asserting either):
- Zone: values may be stored UPPER_SNAKE (`STRONG_BULL`) or lowercase for a subset, or a 6th
  computed label exists that isn't in `VALID_ZONES` — in which case the guard is masking a
  format mismatch, not filtering garbage, and the SQL port should normalize case rather than
  coerce-to-null (a **behavior fix**, owner decision, not a silent change).
- Flow: if LOW_VOLUME is concentrated on BSE (no delivery/volume-scale issue documented), the
  77% may be a known-exchange artifact rather than a market-wide condition.

---

## Part 3 — Reuse of the existing data-quality surface (investigated 2026-07-11)

**Finding — there are three distinct things, not one "data-quality component":**

1. **`DataHealthGrid`** (`components/domain/DataHealthGrid.tsx`, ~660 lines) — the real one.
   A per-**dimension** × per-**day** pipeline health matrix: ok / missing / partial / holiday
   / no_data squares over 60/90/120-day windows, **column-fill `coverage_pct`** in the
   tooltip, a "last fix updated 0 rows = silent no-op" amber warning, per-day fix actions
   (wrench → `POST /api/pipeline/fix`), and a VaNi health insight. Backed by
   `GET /api/pipeline/health-checks` → `lib/health_checks.py` `DIMENSION_META`. Surfaced in
   **PipelineDashboard** (admin/settings). Monitors *download* and *computation* layers.
2. **`DataFreshnessChip`** (`components/domain/DataFreshnessChip.tsx`) — lightweight
   user-facing "data as of <date>" staleness pill. Freshness only.
3. **`DataQualityPill` / `DataQualityBar`** (`components/correlation/`) — a **coverage bar
   for one correlation query**: `coverage_pct` over a date range, 95/80 threshold colors.
   Built for date-range completeness of a single correlation, not logic-path provenance.

Plus a **`dristiQ-data-quality` skill** (`mnt/skills/user/`) — documentation of the 3
structural DB issues (volume discontinuity, SHANTHALA phantom, dual-listing dedup) + a safe-
query checklist. A *doc*, not a component.

**Fit assessment for the three reuse candidates:**

- **(a) Surface this task's audit columns / exclusion counts.** ✅ for the *aggregate*
  (`km_scan_exclusion_counts`) → **extend `DataHealthGrid`**: add a `scan_results` row to
  `health_checks.DIMENSION_META` and surface excluded-count / included-count in the same
  tooltip slot that already shows `coverage_pct` column-fill. It is already admin-facing,
  already speaks "N of M rows populated / dropped", already has the fix-action affordance.
  ❌ for the **correlation `DataQualityPill`/`Bar`** — wrong shape (single-query date-range
  coverage, not per-preset logic provenance); reusing it would overload a component built
  for something else. ❌ for the **per-row audit columns** (`vani_path`,
  `flow_guard_applied`, `zone_coerced`) — those are per-row *provenance*, which belongs in
  the eventual VaNi per-row "why is this here" explainer, **explicitly out of scope here**
  (columns only). No existing component fits, and none should be stretched to.
- **(b) Pipeline step health.** ✅ **strong, native fit** — `DataHealthGrid` *already does
  exactly this* for every other dimension (did `vani_flags` / `stage_classification` run,
  plausible row counts, coverage). Adding the `scan_results` dimension + its exclusion counts
  is the low-cost, in-model extension. This is where the exclusion aggregate should land.
- **(c) Astro CA-adjustment gaps / survivorship-coverage from the backfill scoping.** ❌
  stretch for the UI components. That concern is documentation-shaped and already lives in
  the `dristiQ-data-quality` **skill** (and the scanner-backfill scoping doc). The
  correlation `DataQualityBar`'s "note N instances excluded, interpret with caution" pattern
  is the closest analogue, but wiring CA-gap flags into it is a separate initiative, not
  reuse. Keep CA-gap tracking in the skill/backfill track.

**Recommendation (decisive):** For this task's aggregate audit data, **extend
`DataHealthGrid` with a `scan_results` dimension** — it is purpose-built for pipeline-step
provenance and already admin-scoped. **Do not reuse the correlation pill/bar** (built for a
different quality signal). **Do not build a new sibling component** — that would duplicate
what `DataHealthGrid` already does well. The per-row audit columns get **no UI in this
task** (out of scope) and wait for the VaNi per-row explainer. This wiring is a **fast-
follow after the ship gate**, not part of it (see below).

---

## Quirks flagged (NOT fixed here — separate conversation)

1. **LOW_VOLUME flow guard** (501–503) — treats `LOW_VOLUME` as passing for bullish
   configs. Deliberate workaround for the volume-scale discontinuity bug (CLAUDE.md
   Known Issues). The SQL port must replicate it verbatim; do not "clean it up".
2. **`is_vani_distrib_and_weakness` is an OR, not an AND** despite the name (§dispatch).
   Intentional per comment; port as OR.
3. **VaNi path divergence** — bundle scanners use `evaluateOpportunity`; direct-query use
   `computeVaniOpportunity`. Port replicates current (fallback) behavior unless owner opts
   into switching bundle scanners to the flag-based rule (requires flag backfill).
4. **Magic-number thresholds** with no config row: rank-change ±5 (578–579), 20-day
   breakout window (fresh_breakout), 10-session-ago Strong Bull memory (distribution_warning),
   d_pct ±8 band (conviction_flow), 1.5 delivery/amt gates. Ported as literals with a
   `-- MAGIC:` comment each, so a future config-table migration can find them.
5. **`ema_20 == null` full-row exclusion** (600) vs `ema_20 > 0` gate in scanConvictionFlow
   (1021) — two different history-sufficiency guards. Both preserved as-is.
6. **Zone coercion mutates the bundle row** (`(eod as any).magic_rs_zone = null`, 604) —
   a side effect on shared bundle state. In SQL this is just a `CASE WHEN zone NOT IN
   (valid) THEN NULL`; harmless, but noted so the reviewer knows the JS has a mutation.
```
