# Price Action — Breakout / Breakdown × Daily / Weekly / Monthly (POA)

Scoping doc for expanding the **Price Action** category from one live preset
(`breakout_surge`, daily) to a 2 × 3 matrix of six independent screeners.

Owner direction (2026-08-25): breakout and breakdown, each on the daily,
weekly and monthly clock. **Six separate screeners, not timeframe tabs** on one
preset.

Status: **not built** — this doc is the plan and the evidence behind it.

---

## 1. Target matrix

| | Daily | Weekly | Monthly |
|---|---|---|---|
| **Breakout** | `breakout_surge` — **live today** | new | new |
| **Breakdown** | new | new | new |

Five new presets. One existing preset stays as-is.

Current `price_action` category in `kd_scan_presets`: `breakout_surge`
(active, limit 500), `flower_pot_burst` (active, limit 60), plus two inactive
rows (`breakout_surge_daily`, `fresh_breakout`) retired by migration 152.

---

## 2. What exists, what is missing

The daily breakout runs on two pipeline-computed columns:

```python
# indicators/compute_engine.py:308-310
breakout_level    = close.shift(1).rolling(20, min_periods=1).max().round(2)
pct_from_breakout = ((close - breakout_level) / breakout_level * 100).round(2)
```

i.e. **close vs the prior 20-bar high of close**. Written nightly by
`compute_rolling_metrics_for_date()` (pipeline step 6g), added in migration 112.

Live schema check (2026-08-25):

| Column | `km_equity_eod` | `km_equity_weekly` | `km_equity_monthly` |
|---|---|---|---|
| `breakout_level` | ✅ | ❌ | ❌ |
| `pct_from_breakout` | ✅ | ❌ | ❌ |
| `breakdown_level` | ❌ | ❌ | ❌ |
| `pct_from_breakdown` | ❌ | ❌ | ❌ |

**The weekly/monthly infrastructure itself is built and populated** — this is
not a "build the tables" job:

- `km_equity_weekly`: 505,600 rows · 3,787 symbols · current to w/e 2026-08-21
- `km_equity_monthly`: 114,825 rows · 3,609 symbols · current to 2026-07-31

Both carry OHLCV, `total_value` (₹ Cr), weekly/monthly delivery
(`deliv_value_cr`, `avg_deliv_pct`), `rvol`, RSI, sniper, RSS, MagicRS,
`flow_type`, `accum_distrib`, 52w levels. Fill rates on the latest weekly bar:
RSI 92%, sniper 93%, delivery 93%, flow 90%. (`magic_rs` 25% is expected, not a
defect — weekly long MagicRS needs 145 weekly bars ≈ 2.8 years per symbol; see
the migration-169 lesson.)

So the whole job is: **6 columns × 3 tables, one compute step, five presets.**

---

## 3. ⚠ Blocking defect — `period_end` is per-symbol, not canonical

Same class as migration 179 (partial-month bars). **A screener written as
`WHERE week_end = (SELECT max(week_end) ...)` silently drops part of the
universe.**

`week_end` / `month_end` carry **each stock's own last traded day in the
period**, not the canonical period end. A stock that did not trade on Friday
gets `week_end` = Thursday and forms its own group.

Measured on the live DB:

| Period | Canonical rows | Rows a naive max(period_end) filter MISSES | Distinct period_end values |
|---|---|---|---|
| Week of 2026-08-17 | 3,355 (Fri 08-21) | **99 (2.9%)** | 5 |
| Month of 2026-07 | 3,165 (07-31) | **142 (4.3%)** | 17 |

The dropped rows skew illiquid/small-cap — precisely the symbols the
full-universe Settled Decision exists to protect.

**`week_start` IS canonical** — all 3,454 rows of that week share
`week_start = 2026-08-17`. So:

- Weekly: group and filter on **`week_start`**, never `week_end`.
- Monthly: no canonical `month_start` column — use
  **`date_trunc('month', month_end)`**.

This must be fixed in the fetchers *and* asserted in the contract audit, or
the six new screeners ship with a built-in universe gap.

---

## 4. Sizing — measured, not guessed

Eligible = ≥21 bars of history, close ≥ ₹50, period turnover ≥ ₹1 Cr
(weekly/monthly also `bar_count >= 4`).

| Screener | Matches per period | Eligible universe |
|---|---|---|
| Daily breakout (live) | ~500 (limit-capped) | ~4,900 |
| Daily breakdown | **480–815** | ~4,900 |
| Weekly breakout | **290–430** | ~1,880 |
| Weekly breakdown | **63–128** | ~1,880 |
| Monthly breakout | **218** (Jul) | ~1,780 |
| Monthly breakdown | **63** (Jul) | ~1,780 |

Daily and weekly breakout are large and need ranking + a limit (mirror
`breakout_surge`: limit 500, ranked by `score_5d`). The breakdowns and the
monthly pair are naturally sized.

**Warm-up hazard:** the daily formula uses `min_periods=1`, so a stock with 3
bars gets a "20-bar high" from 2 bars and trivially breaks out. Harmless-ish on
daily (deep history); **material on monthly**, where only 53,825 of 114,825
rows have ≥21 bars. Size the new columns by **bar count, not calendar window**,
and gate the screeners on `nbars >= 21` — the migration-169 lesson applies
directly.

---

## 5. Cadence and staleness — a real UX decision

Weekly and monthly bars are written **only when the period closes**.

- Weekly refreshes Friday. Mon–Thu the weekly screener shows *last* week.
- Monthly refreshes at month end. Today (2026-08-25) the newest monthly bar is
  **2026-07-31** — a monthly screener would show July for 25 days.

That is correct behaviour for period-close trading, but it must be **labelled**
("Week ending 21 Aug", "Month ending 31 Jul") or it reads as stale data. Two
options for the in-progress period:

- **A (recommended):** show the closed period, labelled. Simple, honest,
  matches how weekly/monthly traders act.
- **B:** synthesise a partial current-period bar. Richer, but partial bars are
  exactly what migration 179 had to clean up — do not reintroduce them into the
  stored tables; it would have to be computed at read time.

---

## 6. Build plan

| # | Change | Scope |
|---|---|---|
| 1 | Add `breakdown_level` + `pct_from_breakdown` to `km_equity_eod` | migration + `compute_rolling_range()` |
| 2 | Add all four breakout/breakdown columns to `km_equity_weekly` / `km_equity_monthly` | migration |
| 3 | Extend the weekly/monthly indicator chain to compute them, **sized in bars** | `_indicator_chain.py` |
| 4 | Backfill all three tables; clear `indicators_computed_at` first where the chain gates on it | one-shot script |
| 5 | Five fetchers in `scanEngine.ts`, direct-query family, **keyed on `week_start` / `date_trunc(month)`** | frontend |
| 6 | Five `kd_scan_presets` rows + `fieldAvailability` column sets | migration + frontend |
| 7 | Period-key assertion in the contract audit (canonical-period coverage) | `lib/scan_contract.py` |

The direct-query family is the right home: these read `km_equity_*` directly,
so they inherit every display column and avoid the matview column-contract
class of bug entirely (the reason Breakout Surge looked healthy while the
matview presets showed dashes — see `scanner-integrity-poa.md`).

---

## 7. Naming (SEBI — D39)

No directional/advisory language. Breakout/breakdown describe price structure,
which is observational and fine; the *framing* must stay descriptive.

Proposed: **Breakout Surge** (daily, existing) · **Weekly Breakout** ·
**Monthly Breakout** · **Breakdown Watch** (daily) · **Weekly Breakdown** ·
**Monthly Breakdown**. Descriptions state the condition ("closing below the
20-week low of close on a down week"), never an implication.

---

## 8. Open decisions (owner)

1. **Lookback per clock.** Keep 20 bars everywhere (20d / 20w ≈ 5 months /
   20m ≈ 1.7 years)? Or use conventional levels per clock — e.g. 52-week high
   for the weekly, 12-month for the monthly? 20-bar is consistent and cheap;
   52-week is what most weekly traders actually watch.
2. **Breakout on close vs on high.** Current formula uses the prior 20-bar high
   **of close**. An intraday-high definition fires earlier and more often.
   Changing it would alter the live daily preset — decide deliberately.
3. **Breakdown ranking.** Daily produces ~600/day. Rank by weakest `score_5d`,
   by depth below the level, or by delivery-backed conviction?
4. **In-progress period** — Option A or B in §5.
5. **Liquidity floor** — still removed platform-wide (migration 181). These six
   inherit that; revisit as one decision, not per-preset.

---

## 9. Verification before merge

1. Canonical-period coverage: row count per screener equals the count computed
   from `week_start` / `date_trunc(month)`, **not** from `max(period_end)` —
   the §3 defect must be provably absent.
2. `nbars >= 21` gate honoured: zero rows whose breakout level derives from
   fewer than 21 bars.
3. `python scripts/audit_scanner_contract.py` — all presets × 5 dimensions green.
4. `python scripts/run_integrity_checks.py --dry-run` — zero new findings.
5. Spot-check each screener's top 10 against the chart.
