# Scanner Materialized View MVP — Implementation

**Status:** Phase 1c + **Phase 4 parity DONE** — migration 147 written, and the row-for-row parity diff against the **real JS scan engine** passed **EXACT on all 7 presets** (see §"Phase 4 — PARITY VERIFIED"). Phase 1 (rule inventory + schema design + audit/observability addendum) — Part 2 guard-firing check **run — 2 of 4 guards DOMINANT (zone 47.5%, flow 77.4%)**; zone root-caused to **stale frontend vocabulary** (DB writes 7 bands, frontend knows 5), coercion confirmed a parity no-op → **Phase 1c is now UNGATED and ready to write.** Only open item (flow-by-exchange) is non-blocking. See §Part 2 RESULTS + §Part 2b. **vani_flag path resolved by code inspection** (6/7 presets already use flag-based `computeVaniOpportunity` today; the vani_path question was moot) — see §vani_flag DEFINITIVE. **Phase 1c SQL is fully specified from code + migrations; live DB needed only to verify, not to write.**
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

### Part 2b — RESULTS (query 1, 2026-07-11) — 🔴 ROOT CAUSE: stale frontend zone vocabulary

```
magic_rs_zone | n         magic_rs_zone | n
------------- | ----      ------------- | ----
Neutral Bear  | 1,419     Strong Bear   |   759
Neutral Bull  | 1,119     Mild Bear     |   452
Strong Bull   |   862     (null)        |   420
Strong Bear   |   759     Mild Bull     |   309
```

The 2,538 "invalid" rows are **exactly two values**: `Neutral Bear` (1,419) + `Neutral Bull`
(1,119) = 2,538. **These are not garbage — they are legitimate computed zone labels the
pipeline writes that the frontend's `VALID_ZONES` set (5 values, scanEngine.ts:86) does not
know about.** The DB computes a **7-band scheme** — Strong Bull · Neutral Bull · Mild Bull ·
(plain Neutral, apparently unused on this date) · Mild Bear · Neutral Bear · Strong Bear —
while `VALID_ZONES` = {Strong Bull, Mild Bull, Neutral, Mild Bear, Strong Bear}. The zone
guard is masking a **vocabulary drift between pipeline and frontend**, not filtering bad data.

**Effect on the 3 zone-gated scanners — precisely nil for inclusion, non-nil for display:**
- `power_buy` accepts zone ∈ {Strong Bull, Mild Bull}. `Neutral Bull` is neither → it fails
  the zone check *whether or not* it's coerced to null. **Coercion is a no-op for inclusion.**
- `power_sell` accepts {Strong Bear, Mild Bear}. `Neutral Bear` fails either way. **No-op.**
- `distribution_warning` accepts current-zone ∈ {Mild Bull, Neutral, Mild Bear}. `Neutral
  Bull`/`Neutral Bear` fail either way. **No-op for inclusion** — but see the product gap below.
- **Display:** the coercion DOES change the *stored* `magic_rs_zone` for any Neutral-band
  stock that gets into a result set via a non-zone branch (e.g. a `Neutral Bull` stock
  entering `power_buy` through `accum_distrib='ACCUMULATION'`). Current JS shows its zone as
  **blank**. → **The matview must coerce to null in the stored display column too, to match.**

**→ Parity resolution (no owner decision needed for the port):** replicate the coercion
verbatim — `CASE WHEN magic_rs_zone NOT IN ('Strong Bull','Mild Bull','Neutral','Mild Bear',
'Strong Bear') THEN NULL ELSE magic_rs_zone END`. Confirmed safe: zero effect on which rows
each scanner returns; matches current display exactly. **Phase 1c is UNGATED on the zone
question** — I can port it faithfully now.

**→ Separate product finding (NOT this task — flagged for owner):** the stale vocabulary
means `distribution_warning` silently ignores a real candidate class. A stock that slid
**Strong Bull → Neutral Bear** is a textbook distribution setup, but `Neutral Bear` isn't in
its accepted current-zone set, so it's excluded. Fixing this = add `Neutral Bull`/`Neutral
Bear` to `signalScale.ts` `ZONE_LABELS` + `VALID_ZONES` **and** decide their scanner semantics
— a behavior change, D39-adjacent (the labels contain "Bull"/"Bear" and would need
SEBI-neutral display strings like the existing zones). Do **not** fold into the matview task.

### Part 2b — query (2) correction

Query (2) errored: **`km_equity_eod` has no `exchange` column** (exchange lives on
`km_equity_symbols`). Corrected — join to the symbol master:

```sql
SELECT s.exchange, e.flow_type, COUNT(*) AS n
FROM km_equity_eod e
JOIN km_equity_symbols s ON s.id = e.equity_id     -- adjust FK col if not equity_id
WHERE e.trade_date = (SELECT MAX(trade_date) FROM km_equity_eod)
GROUP BY s.exchange, e.flow_type
ORDER BY s.exchange, n DESC;
```

This is the **only remaining open Part 2 question**: is the 77% LOW_VOLUME a BSE-concentrated
artifact or genuinely market-wide? It does **not gate Phase 1c** (the LOW_VOLUME guard ports
verbatim regardless — evaluateOpportunity 501–503), but the answer sets how urgent the
flag/CA backfill is. Run when convenient; not blocking.

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

## vani_flag — DEFINITIVE parity resolution (2026-07-11, supersedes the open "vani_path" question)

The earlier "keep `evaluateOpportunity` vs switch to `computeVaniOpportunity`" question was
based on the **stale code comment at scanEngine.ts:747–751**. Reading the actual call sites
settles it — **no owner decision needed, and it is NOT a choice:**

- The 7 bundle scan functions **do** pass `presetId` into `buildScanStock`
  (`buildScanStock(id, bundle, 'power_buy')`, lines 816/853/889/913/…). `conviction_flow`
  computes it inline (line 1048).
- Line 720–724: `vaniRule = getPresetMeta(presetId)?.vani_rule` is checked **first**; only if
  it's null does it fall back to `evaluateOpportunity`.
- Per migration **106** (unchanged by 125/126 for in-scope presets), **6 of the 7 presets
  have a `vani_rule`** → they already run `computeVaniOpportunity` (flag-based) in production
  **today**. Only `smart_money` is `vani_rule = NULL`.
- `smart_money` is listed in the **bullish** `kd_vani_opportunity_config.applies_to_presets`
  (migration 045), and `oppConfigMap` is keyed by expanding that array (scanEngine.ts:125–127)
  → `smart_money` falls to `evaluateOpportunity` with the **bullish** config (migration 044).

**→ Exact-parity vani_flag per preset (this is what the matview MUST reproduce):**

> **⚠ CORRECTED 2026-07-11 (Phase 1c, via live-DB MCP query).** The row for
> `smart_money` below was WRONG in the original handover — it claimed
> `vani_rule = NULL` → `evaluateOpportunity`. The **live** `kd_scan_presets` row
> has `vani_rule = 'is_vani_smart'` (and the static `SCAN_PRESETS` fallback agrees,
> scanEngine.ts:35; `getPresetMeta` reads DB-first, scanEngine.ts:59). So **all 7
> in-scope presets run `computeVaniOpportunity` (flag-based); NONE use
> `evaluateOpportunity`.** Consequences: `vani_path` is `computeVaniOpportunity`
> for all 7, and the LOW_VOLUME flow guard (evaluateOpportunity 501-503) is
> **unreachable** for every in-scope scanner → `flow_guard_applied` is always
> FALSE. The 77% LOW_VOLUME finding concerns evaluateOpportunity and does **not**
> touch these 7 scanners' `vani_flag`.

| Preset | vani_rule (LIVE) | `vani_flag` = | `vani_path` |
|---|---|---|---|
| `power_buy` | is_vani_s2 | `is_vani_s2` | computeVaniOpportunity |
| `fresh_breakout` | is_vani_s2 | `is_vani_s2` | computeVaniOpportunity |
| `quiet_accumulation` | is_vani_s2 | `is_vani_s2` | computeVaniOpportunity |
| `power_sell` | is_vani_distrib_and_weakness | `is_vani_distrib OR is_vani_weakness` | computeVaniOpportunity |
| `distribution_warning` | is_vani_distrib_and_weakness | `is_vani_distrib OR is_vani_weakness` | computeVaniOpportunity |
| `conviction_flow` | is_vani_surge_or_breakout | `is_vani_surge OR is_vani_breakout` | computeVaniOpportunity |
| `smart_money` | **is_vani_smart** | `is_vani_smart` | computeVaniOpportunity |

Bullish cfg (migration 044): `ema_atr_band=1.0, reward_min_atr_multiple=0.0,
magic_rs_zones=[Strong Bull, Mild Bull], flow_types=[FRESH_LONGS, SHORT_COVERING],
rvol_min=1.2`. → `smart_money.vani_flag` =
`ema_20 IS NOT NULL AND atr_14>0 AND close BETWEEN ema_20-atr_14 AND ema_20+atr_14
AND (ema_20+atr_14-close)>0 AND magic_rs_zone IN ('Strong Bull','Mild Bull')
AND (flow_type='LOW_VOLUME' OR flow_type IN ('FRESH_LONGS','SHORT_COVERING'))
AND rvol>=1.2`.

**Two consequences:**
1. **No flag backfill is needed for parity.** The frontend already reads `is_vani_*` straight
   from `km_equity_eod` (they're in `EOD_COLS`). The matview reading the same columns yields
   identical `vani_flag` — parity is exact *by construction*, whatever the flags' current
   values. (Flag *correctness* — whether the flags themselves are right, tied to the 77%
   LOW_VOLUME finding — is a **separate** concern from parity.)
2. **`flow_guard_applied` (§1b.1) is meaningful ONLY for `smart_money`** — it's the sole
   preset on the `evaluateOpportunity` path. All other presets' `vani_path='computeVaniOpportunity'`
   and their `flow_guard_applied` is always false. Documented so the audit column isn't
   misread as "never fires" for the other six.

**→ Phase 1c is fully specified from code + migrations. No further live-DB input gates the
SQL.** (Live DB is still needed to *verify* parity, not to *write* it.)

---

## Phase 1c — DONE (2026-07-11): migration 147 written + validated via MCP

**File:** `App/DBscripts/km_migration_147_scan_results_matview.sql` (on branch
`claude/scanner-matview-phase-1c-rq59dx`). Creates `km_scan_results` (7 UNION-ALL
preset blocks, each pre-sorted + `ROW_NUMBER()` ranked + `LIMIT`) and the
`km_scan_exclusion_counts` companion, with the 5 audit columns, the full rule
inventory as SQL comments, the unique/rank/vani indexes, and grants to
`authenticated, anon, kd_app, admin, "user", kd_readonly`.

**Validation (read-only MCP against `kaala_dristi_db`, latest_date = 2026-07-10):**
The matview's defining `SELECT` was run in full via the connector. It parses,
executes inside the 30s timeout, and returns:

| preset | rows | rank range | vani=true |
|---|---|---|---|
| power_buy | 25 | 1–25 | 8 |
| power_sell | 25 | 1–25 | 15 |
| fresh_breakout | 25 | 1–25 | 2 |
| quiet_accumulation | 25 | 1–25 | 0 |
| distribution_warning | 19 | 1–19 | 0 |
| conviction_flow | 5 | 1–5 | 0 |
| **smart_money** | **0** | — | — |

`smart_money` = 0 is **correct parity, not a bug**: its industry gate is
`pct_accumulation > 60`, and on 2026-07-10 the max `pct_accumulation` across all
157 industries is exactly `60.0` (nothing exceeds it), so the JS scanner returns
0 too. Over 120 days only 11 industry-days exceed 60 → `smart_money` is a very
sparse scanner, legitimately empty most days. (Product note, not a port defect.)
Column expressions not exercised by the count query — `magic_rs_trend` (smallint[]),
`reward`, `xamt`, `rel_*` — were spot-run separately and type-check/compute.

**Three rule-inventory corrections found by reading the live source + live DB
(all now baked into the SQL, see the migration header C1/C2/C3):**
1. **[C1]** `fresh_breakout`'s 20-day breakout compares against prior-20 **closes**
   (`h.close`, scanEngine.ts:920), not highs as §1a stated.
2. **[C2]** `power_sell` Path-2 also requires `close < sma_150` **and** `rvol > 1.5`
   (scanEngine.ts:864-867) — §1a omitted both.
3. **[C3]** `smart_money.vani_rule` is live `'is_vani_smart'`, not NULL → all 7
   presets use `computeVaniOpportunity`; `flow_guard_applied` is always FALSE.

## Phase 4 — PARITY VERIFIED (2026-07-11): EXACT on all 7 presets ✓

The definitive row-for-row diff was run **without a browser** by executing the
**real production JS scan logic** against the **same live data the browser loads**,
then comparing to the **actual migration-147 SQL** (the defining SELECT, extracted
verbatim from the `.sql` file). Method:

1. A Node harness opened the read-only `kaala-postgres` MCP endpoint directly (so
   the ~160k-row dataset flowed DB→Node, never through chat) and replicated
   `loadDailyBundle`'s exact queries: active symbols, 45-day equity EOD (chunked),
   20-day industry EOD, live `kd_scan_presets.vani_rule`.
2. `scanEngine.ts`'s pure functions (`buildScanStock`, `hasDotInHistory`,
   `getIndustryClassifications`, `computeVaniOpportunity`, all 7 scan fns) were
   transcribed **verbatim** (types stripped) and run on that bundle → the
   "app truth" lists (raw, pre-exchange-filter — the layer the matview stores).
3. The migration's defining SELECT was run over the same DB → the SQL lists.
4. Diffed per preset on **membership + rank + vani_flag**.

**Result (latest_date 2026-07-10; 159,668 EOD rows, 5,337 stocks w/ today's data,
157 industries):**

```
✓ power_buy           js=25  sql=25
✓ power_sell          js=25  sql=25
✓ smart_money         js=0   sql=0
✓ fresh_breakout      js=25  sql=25
✓ quiet_accumulation  js=25  sql=25
✓ distribution_warning js=19 sql=19
✓ conviction_flow     js=5   sql=5
================ ALL 7 PRESETS: EXACT PARITY ✓ ================
```

Zero membership differences, zero rank differences, zero vani_flag differences on
every preset — including `smart_money`'s legitimately-empty result. The three C1/C2/C3
corrections were necessary to reach this: an earlier pass with the doc's original
(uncorrected) rules would **not** have matched.

Tie-order caveat resolved in practice: both sides break exact-sort-key ties by
`equity_id`, so ranks matched exactly (the harness builds `latestEod` in id-asc order
to mirror the matview's `equity_id` tiebreaker).

**Remaining Phase 4 items are operational, not correctness:** run the migration on a
staging/backup copy → `REFRESH` → perf before/after → Path B regression check (the 7
direct-query scanners are untouched — migration 147 only `CREATE`s two new matviews) →
repoint the frontend → prod. Confirm the backup dump name with the owner before prod.
Parity itself is proven.

Verification harness (for re-runs): `scratchpad/{mcpclient,scans,parity}.mjs`
(not committed — depends on the read-only MCP endpoint + `KD_MCP_BASIC`).

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
