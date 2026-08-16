# Weekly / Monthly Scanners — activation spec

**Status: FOR REVIEW (owner).** Not built. Written 2026-08-16 from live data
(weekly `week_start = 2026-08-10`, 3,297 rows; monthly `month_start =
2026-08-01`, 3,264 rows). The decision this doc exists to support is **§6 —
which presets do we want on which timeframe** — everything else follows from it.

---

## 1. What already exists

The plumbing is built and unused:

- `executeScan(scanId, exchangeFilter, timeframe, date)` already accepts
  `'daily' | 'weekly' | 'monthly'`.
- `loadWeeklyOrMonthlyBundle(tf)` already reads `km_equity_weekly` /
  `km_equity_monthly`, resolves an indicator-complete period, and maps rows into
  the same `EquityEodSnapshot` shape the daily bundle produces.
- `kd_scan_presets.timeframe` already exists as a column.
- Both aggregate tables are populated nightly (pipeline2 `equity_weekly` /
  `equity_monthly` steps — fixed and verified 2026-08-16).

**No preset is configured for weekly or monthly**: all 14 active rows in
`kd_scan_presets` are `timeframe = 'daily'`. Nothing reads the weekly path today.

## 2. It is NOT a backfill problem

The obvious first theory — "the weekly table is under-backfilled" — is wrong and
was checked: of the 777 stocks holding more than 800 daily bars, **777 have ≥145
weekly bars**, all starting from the table's first week (2019-12-30). Weekly
aggregation is complete for every stock whose daily history supports it. Running
`aggregate_weekly_bars` with an earlier `from_date` would add nothing.

What limits the long-window weekly indicators is the **daily** history behind
them. Distribution of daily bars for the 3,297 stocks in the latest week:

| daily bars | stocks | ≈ years |
|---|---|---|
| 1–249 | 539 | < 1 |
| 250–499 | 405 | 1–2 |
| 500–749 | 1,551 | 2–3 |
| 750–2,000 | 241 | 3–8 |
| 2,000+ | 561 | 8+ |

The 1,551-stock cluster at 2–3 years is the crux: it yields 100–150 weekly bars,
which sits just under the 145 bars long MagicRS needs and the 150 that `sma_150`
needs. This is a *data-age* fact about the Indian small/mid-cap universe, not a
defect to fix. Design around it (§4).

## 3. Column availability — measured, not assumed

Fill rate on the latest period. **Bold = the gate that kills a scanner.**

| column | weekly (3,297) | monthly (3,264) | note |
|---|---|---|---|
| `close/open/high/low/volume` | 100% | 100% | |
| `w52_high` / `w52_low` | 100% | 100% | |
| `sniper_inst` | 98% | 91% | |
| `atr_14` | 97% | — | |
| `rsi_14` | 97% | 84% | |
| `ema_20` | 94% | 80% | |
| `flow_type` | 94% | 90% | |
| `magic_rs_short` | 93% | 78% | **the workable RS on these timeframes** |
| `avg_deliv_pct` | 92% | 90% | |
| `deliv_value_cr` | 92% | 90% | |
| `magic_rs_short_zone` | 88% | **24%** | monthly zone is not usable |
| `rss_value` | 87% | **22%** | |
| `sma_50` | 86% | **22%** | |
| `rvol` | 86% | **22%** | |
| `accum_distrib` | **26%** | **0%** | |
| `sma_150` | **26%** | **0%** | |
| `magic_rs` (long) | 27% | **0%** | structurally impossible monthly (migration 169) |
| `magic_rs_zone` (long) | **23%** | **0%** | scanners' zone gates read THIS today |
| `volume_divergence_flag` | **10%** | 7% | |
| `ret_5d/22d/66d` | **0%** | 0% | column exists, never computed |
| `lifetime_high` | **0%** | 0% | column exists, never computed |
| `stage`, `is_vani_*`, `avg_amt_*`, `delivery_surge_x`, `breakout_level`, `score_5d`, `supertrend_dir`, `dot_*` | absent | absent | no such column on these tables |

Two traps worth stating plainly:

1. **`magic_rs_zone` (long) is only 23% on weekly and 0% on monthly**, and it is
   the column every zone-gated scanner reads today. Any weekly preset must be
   pointed at `magic_rs_short_zone` (88%) instead. This is a *preset definition*
   change, not a data fix.
2. **Monthly is a different animal from weekly.** Its zone, `rvol`, `sma_50` and
   `rss_value` all sit near 22–24%. Monthly cannot carry any of the current
   scanner shapes without new pipeline work — see §6, recommendation is to defer
   monthly entirely.

## 4. Four blockers, four different fixes

**B1 — the frontend discards columns that exist (cheap, ~20 lines).**
`loadWeeklyOrMonthlyBundle`'s mapper hardcodes `rss_value`, `rss_spread`,
`sma_150`, `sma_50`, `sma_200`, `w52_low`, `lifetime_high`, `supertrend_dir`,
`pct_chng` to `null` — leftovers from when `km_equity_weekly` was thinner. The
table now HAS `rss_value`, `sma_50`, `sma_150`, `w52_low`, `accum_distrib`,
`magic_rs_short`, `magic_rs_short_zone`, `deliv_value_cr`, `ret_*`. Fetch and map
them; leave genuinely-absent ones null.

**B2 — long-window indicators are depth-limited (design around, don't fix).**
`sma_150`, `accum_distrib`, long `magic_rs`/`magic_rs_zone` sit at ~26% weekly.
Use `sma_50` (86%) and `magic_rs_short_zone` (88%) in weekly preset definitions.

**B3 — columns never computed for weekly (pipeline work).**
`ret_5d/22d/66d` and `lifetime_high` are 0% despite existing; `volume_divergence_flag`
is 10%; `stage`, `is_vani_*`, `avg_amt_22d`, `delivery_surge_x`, `breakout_level`,
`score_5d` have no column at all. This is what blocks conviction_flow, the Stage
family, Breakout Surge, and every VaNi-flag chip on these timeframes.

**B4 — there are no weekly industry composites (the one nobody noticed).**
`km_industry_eod` is daily-only. Four of the six bundle scanners gate on industry
rank / `pct_accumulation`. A weekly scanner reading daily industry ranks isn't
strictly wrong, but it judges weekly stock signals against a daily-clock sector
rotation — incoherent, and it will produce results nobody can explain. Honest fix
is a `km_industry_weekly` aggregate mirroring `compute_all_industry_composites`.

## 5. Per-scanner viability

"Weekly today" assumes B1 is fixed and the preset is repointed to the short-zone
column. It assumes NO pipeline work.

| scanner | needs | weekly today | blocked by |
|---|---|---|---|
| `distribution_warning` | zone now + zone 10-back, SYD-in-history, vol-div | ✅ **viable** | — (SYD is computed from OHLC+rvol in the bundle; industry only affects the *sort score*, not membership) |
| `smart_money` | industry pct_acc, delivery_pct, `rss_value` | ⚠️ all stock-level inputs present (87–92%) | **B4** industry gate |
| `power_buy` | industry, `accum_distrib` OR (`sma_150`+zone+flow+rvol) | ❌ | **B2** both paths (26%), **B4** |
| `power_sell` | industry, `sma_150`, zone, flow, rvol | ❌ | **B2**, **B4** |
| `quiet_accumulation` | industry, `accum_distrib`, `sniper_inst` trend | ❌ | **B2** accum_distrib, **B4** |
| `conviction_flow` | `avg_amt_22d`, `delivery_surge_x`, `ema_20` | ❌ | **B3** columns absent |
| Stage family (2 leaders / 2 watch / 3 watch / 4 leaders) | `stage`, `sma200_rising`, w52 position | ❌ | **B3** no `stage` column |
| `breakout_surge` | `breakout_level`, `pct_from_breakout`, `score_5d` | ❌ | **B3** |
| `volume_drive` | `dot_svd`/`dot_sbd`, delivery | ❌ | **B3** no dot columns |
| `flower_pot_burst` | 60 deep daily bars, compression | ❌ | daily-native by design; a weekly variant is a new scanner, not a re-timeframe |

**Monthly today: none are viable** (zone 24%, rvol 22%, sma_50 22%).

Reading of this table: exactly **one** scanner is a genuine drop-in on weekly,
and **one more** needs only `km_industry_weekly`. Everything else needs B3
pipeline work. That is the honest scope — a "turn on weekly for all scanners"
framing would be wrong.

## 6. DECISION NEEDED (owner)

The traders' usual weekly asks are **weekly Stage 2** and **weekly breakout** —
and both land in the B3 column above, i.e. they need pipeline work, not a
checkbox. So the question is not "which existing scanner do we flip" but:

1. **Which weekly presets actually matter to you?** If it's the Stage family and
   Breakout Surge, then Stage 1 below is nearly pointless and we should go
   straight to B3 (add `stage`, `breakout_level`, `score_5d`, `ret_*` to the
   weekly indicator chain).
2. **Is monthly wanted at all**, or is weekly the real ask? Monthly needs the
   most work and has the thinnest data; recommendation is to defer it.
3. **Do weekly scanners need industry gates** to be meaningful to you, or are
   stock-level weekly signals enough for a first cut? This decides whether B4
   (`km_industry_weekly`) is in or out of the first release.

## 7. Staged plan (once §6 is answered)

- **Stage 1 — mapping + one preset (small).** Fix B1. Add a weekly
  `distribution_warning` preset row (`timeframe='weekly'`, short-zone gate).
  Proves the whole path end-to-end with no pipeline work. Shippable alone.
- **Stage 2 — weekly indicator chain (B3).** Extend the weekly/monthly compute to
  write `ret_*`, `stage`, `breakout_level`, `score_5d`, delivery aggregates, and
  the vani flags. Sizing all lookbacks **by bar count, not calendar days** —
  migration 169's lesson, which is exactly the trap this timeframe work walks
  into. Unlocks the Stage family, Breakout Surge, conviction_flow.
- **Stage 3 — `km_industry_weekly` (B4).** Mirror `compute_all_industry_composites`
  on weekly bars. Unlocks the four industry-gated scanners honestly.
- **Stage 4 — matview.** Extend `km_scan_results` with a `timeframe` key once
  weekly presets have settled. Its PK becomes `(preset_id, timeframe, equity_id)`.
  Do NOT do this before the preset set is stable.

## 8. Relationship to the matview repoint

**Independent — do not block one on the other.** The matview
(`km_scan_results`, migration 170) is daily-only and stays that way through the
repoint. Weekly/monthly keeps using the client-side bundle path regardless, so
the repoint's fallback branch (`timeframe !== 'daily'` → client bundle) is
required anyway and is not throwaway work. Stage 4 above is the eventual merge
point, after both tracks have settled.
