# RS-Rotation Scanner — Spec (FOR OWNER REVIEW)

Status: **proposed / not built.** This documents the design so Charan can review
before any scanner code lands. The RS-Rotation *chart* (daily, single stock) is
already built on the chart dashboard (`/chart/equity/:id`, `RotationGraph`); this
spec covers turning that concept into a **scanner**.

All language here — and any UI it produces — must stay **SEBI-safe**: observational
relative-strength only, no buy/sell/hold, no price forecast (see LESSONS_LEARNED
D39 and the VaNi tone rules in CLAUDE.md).

---

## 1. Concept

Relative-Strength Rotation (an RRG-style read) places each instrument on two axes:

- **Level** = relative strength — **Magic RS** (`magic_rs`, the 144-bar RS of the
  stock vs CNX500, normalised as % above/below its SMA(60)).
- **Momentum** = the **rate-of-change of Magic RS** (e.g. `magic_rs[t] − magic_rs[t−k]`).

Sign of (level, momentum) → one of four quadrants:

| Quadrant | Magic RS | RS momentum | Observational meaning |
|---|---|---|---|
| **Leading**   | ≥ 0 | ≥ 0 | relative strength positive and rising |
| **Weakening** | ≥ 0 | < 0 | relative strength positive but slowing |
| **Lagging**   | < 0 | < 0 | relative strength negative and falling |
| **Improving** | < 0 | ≥ 0 | relative strength negative but rising |

The scanner screens/ranks the equity universe by **which quadrant a stock is in**
(and, optionally, how fast it is rotating).

---

## 2. Relationship to existing scanners

The scanner catalogue (9 presets, `services/scanEngine.ts`) already has two that
overlap the **Leading** quadrant — but neither captures the *rotation*:

| Existing scan | Captures | Does NOT capture |
|---|---|---|
| **Stage 2 Leaders** (Weinstein) | confirmed uptrend, above rising MAs, positive RS | RS **momentum**; the **Improving** quadrant (early turns) |
| **Strength Confluence** (`power_buy`) | multi-signal strength snapshot | RS **direction**; only a static read |

**What RS-Rotation adds that nothing in the current catalogue does:**

1. **RS momentum** — the second axis (rising vs slowing).
2. **Improving quadrant** — underperforming but *turning up*. Catches relative-strength
   bottoms **before** they graduate into Stage-2 "leaders." No current scan surfaces this.
3. **Weakening quadrant** — strong but *fading* — an early "losing relative momentum"
   watch. Also uncovered today.

Position it as the **leading-indicator complement to Stage 2's lagging one**, not a
duplicate. Lead with **Improving** and **Weakening** since those are structurally
new.

---

## 3. Proposed presets (SEBI-safe names)

| Preset id | Display name | Quadrant | New vs existing? |
|---|---|---|---|
| `rs_rotating_in`   | **Rotating Into Strength** | Improving | ✅ new — early relative turns |
| `rs_leadership_fade` | **Leadership Fading** | Weakening | ✅ new — relative momentum slowing |
| `rs_relative_leaders` | **Relative Leaders** | Leading | overlaps Stage 2 / Strength Confluence — optional |

`Lagging` is offered as a filter state but not a headline preset (little screening value).

**Ranking within a preset:** by **rotation velocity** — the distance the marker
moved over the last N sessions (`hypot(Δlevel, Δmomentum)`), or simply |momentum|.
Freshest/strongest rotations sort to the top.

---

## 4. Multi-timeframe extension (recommended, phase 2)

Magic RS is computed **natively on all three timeframes** (confirmed):

| Timeframe | Table | Magic RS |
|---|---|---|
| Daily | `km_equity_eod` | ✅ |
| Weekly | `km_equity_weekly` (migration 075) | ✅ |
| Monthly | `km_equity_monthly` (migration 076) | ✅ |

So the strongest screen is **aligned rotation** — a confluence filter across horizons:

- **Aligned Emerging** — `Improving` on daily **and** weekly (**and** monthly) →
  an early relative turn confirmed across timeframes.
- **Aligned Leaders** — `Leading` on all three → relative strength aligned across horizons.

Multi-timeframe confluence is a far higher-quality filter than any single timeframe,
and (like the rest of RS-Rotation) nothing in the current 9 scanners does it. This
formalises the existing **1D / 1W / 1M RS-change pills** on the equity page.

---

## 5. Data model

Magic RS already exists on all three tables. The **only new input** is Magic RS
**momentum** (its rate of change). Two options:

- **(A) Precompute a column** `magic_rs_roc` on each EOD table (daily/weekly/monthly),
  written by the same pipeline step that computes `magic_rs` (or a small backfill,
  cf. `backfill_d365.py`). Cleanest; keeps scans fast (pure snapshot read).
- **(B) Client-side** — fetch a short `magic_rs` history into the `ScanDataBundle`
  and diff. No migration, slightly heavier fetch.

**Recommendation: (A)** for the scanner (snapshot reads are the scan engine's model),
**(B)** is acceptable for the single-stock chart (already used there).

**Momentum lookback:** daily `k = 5` bars (≈ 1 week); weekly `k = 4`; monthly `k = 3`.
Confirm against the actual `magic_rs` distribution before locking (threshold-calibration
lesson).

---

## 6. Integration (existing 4-step scanner recipe)

Per CLAUDE.md "Scanner System":

1. Add `ScanDefinition` entries to `SCAN_PRESETS` in `services/scanEngine.ts`
   (`rs_rotating_in`, `rs_leadership_fade`, optionally `rs_relative_leaders`).
2. Implement `scanRsRotatingIn(bundle)` / `scanLeadershipFade(bundle)`:
   - read `magic_rs` + `magic_rs_roc` (or client-diff) per stock,
   - assign quadrant by sign, filter to the target quadrant,
   - `universe: 'NSE_ONLY'` + `buildNsePreferredIds` (BSE numeric-scrip hygiene),
   - rank by rotation velocity.
3. Register in the `SCAN_HANDLERS` dispatch map.
4. Insert `kd_scan_presets` rows (name / description / tooltip / limit) via a
   migration.

For multi-timeframe (phase 2): the bundle must also carry weekly/monthly `magic_rs`
(+ momentum); the handler intersects quadrant membership across timeframes.

---

## 7. Edge cases & guards

- **BSE / thin stocks**: `magic_rs` is null for many BSE/thin names (no benchmark
  series) — exclude from the RS universe (no-fallback; don't fake a value).
- **Warm-up**: momentum needs `k` prior bars; weekly/monthly need enough aggregated
  history — skip stocks lacking it rather than treating null as 0.
- **Numeric BSE symbols**: use `displaySymbol()`; filter numeric codes from any
  TradingView export.
- **Zero-crossing noise**: a stock hovering at `magic_rs ≈ 0` will flip quadrants on
  tiny moves — consider a small dead-band (e.g. |magic_rs| < ε and |momentum| < ε →
  "Neutral", excluded) so presets don't churn.

---

## 8. SEBI-safe UI rules (for the results view, when built)

- Quadrant names (Leading / Weakening / Lagging / Improving) describe **measured
  relative strength and momentum**, never a directional call.
- Momentum vocabulary: **rising / slowing** (not bullish/bearish). Cf. D39.
- Every surface states the **benchmark** ("vs NIFTY 500 / CNX500") and carries the
  observational disclaimer: educational, not investment advice, not a forecast.
- Colours: green/amber/red/teal for the four quadrants (measured relative
  performance) — consistent with `FlowIntensityMap` / `RotationGraph`.

---

## 9. Phasing

1. **Phase 1** — `magic_rs_roc` (daily) + the two new daily presets
   (`Rotating Into Strength`, `Leadership Fading`) + results view.
2. **Phase 2** — weekly/monthly `magic_rs_roc` + **aligned rotation** confluence presets.
3. **Phase 3** — rotation-velocity ranking + optional `Relative Leaders`.

---

## Open questions for Charan
- Precompute `magic_rs_roc` (A) or client-side (B) for the scanner? (Rec: A.)
- Momentum lookbacks — accept `5 / 4 / 3` or calibrate first?
- Ship `Relative Leaders` (Leading) despite Stage-2 overlap, or keep the scanner to
  the two genuinely-new quadrants?
- Dead-band size for the `magic_rs ≈ 0` churn guard.
