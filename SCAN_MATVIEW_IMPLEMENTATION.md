# Scanner Materialized View MVP — Implementation

**Status:** Phase 1 (rule inventory + schema design) — **FOR REVIEW, not yet run.**
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
