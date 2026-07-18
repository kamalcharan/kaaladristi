# POA — Foolproof Custom Index → Thesis Tracking → VaNi the Storyteller

**Date:** 2026-07-18
**Owner:** Charan
**Frame:** The product is a *story engine*; VaNi is its voice. Deliver in 2–3 phases.
Phase 1 makes the data trustworthy, Phase 2 tracks a user's thesis, Phase 3 unifies
the narration under VaNi.

---

## Phase 1 — Make the Custom Index Foolproof

### The problem (grounded, not theoretical)

The "Wealth Management & Capital Markets Intermediaries" custom index (index_id 115)
renders as **disconnected candle clusters** with the price axis running **negative** —
i.e. a broken chart. Evidence pulled from the DB:

| Fact | Value |
|---|---|
| Synthetic bars | 1,689 (2019-09-19 → 2026-07-17) |
| `close` range | **89.6 → 3,145.7** (≈35× drift) |
| Constituents | 5, listing at **staggered** dates |

Constituent listing dates + price scales:

| Symbol | First data | Last close |
|---|---|---|
| 360ONE | 2019-09 | 1,113 |
| SHAREINDIA | 2020-09 | 177 |
| ANGELONE | 2020-10 | 329 |
| NUVAMA | 2023-09 | **1,863** |
| ARSSBL | 2025-09 | 534 |

### Root cause

`compute_custom_index_eod()` synthesises the level as a **raw-price average**:

```sql
AVG(e.close) AS close      -- over whatever constituents have data on trade_date
```

Because constituents list at different times **and at very different price scales**,
every time a new stock joins the basket the average **jumps** (NUVAMA at ₹1,863 joining
a basket of ~₹300 stocks lifts the level overnight). That is the cluster/discontinuity,
and the 89→3,145 drift. It is a **methodology flaw**, not missing data.

Raw-price averaging is never a valid index construction — real indices chain returns
through a divisor so composition changes don't move the level.

### The fix — return-chained synthesis (rebased continuity)

Replace raw-price averaging with **daily-return chaining**:

```
For each trade_date t (ascending), per custom index:
  present   = constituents with a close on BOTH t and t-1
  basketRet = AVG( close[i,t] / close[i,t-1] - 1 )   over `present`   (equal weight)
  level[t]  = level[t-1] * (1 + basketRet)
  level[first] = 1000                                (base)
  pct_chng[t] = basketRet * 100                      (consistent with the level)
  ret_5d/22d/66d[t] = level[t]/level[t-k] - 1        (from the chained level, not AVG)
```

Why this is foolproof:
- A new constituent contributes **only once it has two consecutive closes** → joining
  never jumps the level.
- Delistings / data gaps drop a name from `present` for that day → no crater.
- The level is continuous and scale-stable; `pct_chng` and `ret_*` are internally
  consistent with it.
- `volume`, `value_cr` stay as `SUM(...)` (aggregate traded activity — level-independent).

### Integrity guards (the "foolproof" gates)

1. **Bad-value guard** — exclude any constituent row with `close <= 0` or NULL from the
   day's calc.
2. **Coverage gate** — do **not** emit a bar for a date unless
   `present_count >= max(2, ceil(0.5 * active_constituents))`. An honest gap beats a
   fake print. (Single-constituent early history → the index simply starts later, or is
   flagged provisional.)
3. **Sanity clamp** — if `|basketRet| > 0.5` (50% in a day) flag the bar as suspect
   (likely a bad constituent print) and skip/cap it; log to a health table.
4. **Base-date discipline** — rebasing to 1000 at first *valid* (coverage-passing) date,
   not the first date any single stock existed.

### Deliverables

- **Migration `km_migration_152_custom_index_return_chain.sql`** — rewrite
  `compute_custom_index_eod(p_from, p_to, p_index_id)` to the return-chained method with
  guards. Keep the same signature so pipeline2 `handle_index_returns` and
  `scripts/compute_custom_index_eod.py` call it unchanged. (Return chaining needs the
  full prior history to seed `level[t-1]`, so the range params select the *output* window
  but the function must read from the base date — implement as a windowed recompute that
  re-derives the level from the last known good level before `p_from`.)
- **Backfill** — `KD_DB_PASSWORD=… python scripts/compute_custom_index_eod.py` (full
  history) for all 25 custom indices, then `compute_all_index_scores()`.
- **Health readout** — on `CustomIndexManagePage` add a small **data-health strip**:
  coverage %, first/last good bar, constituent-count timeline, and any flagged
  (suspect/skipped) bars. Turns "did it work?" from guesswork into a glance.
- **Verify** — index 115 chart renders continuous, no negative axis, right edge aligns
  with NOW (Phase-0 padding fix already shipped).

### Acceptance criteria

- [ ] No level jump when a constituent lists mid-history (visual + `max(|pct_chng|)` sane).
- [ ] `close > 0` for every emitted bar; axis never negative.
- [ ] `ret_5d/22d/66d` reconcile with the chained level (spot-check).
- [ ] Sector Rotation 5D/22D/66D for custom indices still populate (scores refresh).
- [ ] Manage-page health strip shows coverage + flags.

### Explicitly OUT of Phase 1 scope

- `rsi_14`, `flow_type`, `magic_rs`, `score_*` for custom indices (the B78 signal gap) —
  separate work; Phase 1 only guarantees the **price series** is correct and continuous.
  (This is also why VaNi narrating "FRESH_LONGS / RVOL" for a custom index was wrong — a
  Phase 3 grounding concern, noted below.)

---

## Phase 2 — Thesis Tracking + Risk Graph (position-aware)

Two tracking modes off `km_user_bookmarks`:
- **(a) Entered & tracking** — has a position (entry price/date), wants "is my thesis
  still valid?" + P&L.
- **(b) Bookmarked & tracking** — watching only, wants "is it becoming worth acting on?"

### Pieces

1. **Bookmark → light position** — `km_user_bookmarks` today = `(user_id, equity_id,
   created_at)` only. Add optional `entry_price`, `entry_date`, `qty` so a bookmark can
   become a position. (Decision pending: extend bookmarks vs a separate
   `km_user_positions` table.)
2. **Risk/Reward graph** — reuse `engine/risk_engine.py` (4-dim: structural / momentum /
   volatility / deception). Plot the score **over time since entry** as a bipolar
   reward↔risk trajectory. The *slope* is the signal (is risk accelerating?). ARSSBL:
   balanced at entry (Jul 14) → risk spikes Jul 15 (flow→liquidation, RS flips negative)
   → all-risk by Jul 17 (−8%).
3. **Deterioration alerts** — fire on the **bearish story events** (flow→liquidation, RS
   turns red, stage→S4) for tracked stocks. ARSSBL would have alerted on Jul 15. Reuses
   `services/storyEvents.ts`.

### ARSSBL as the reference case (from DB)

| Date | Close | Flow | Magic RS | Read |
|---|---|---|---|---|
| Jul 13–14 | ~580 | FRESH_LONGS | +2.4→+3.2 | entry ~580 |
| Jul 15 | 556 (−4.3%) | **LONG_LIQUIDATION** | **−1.5 (flip)** | ⚠ deterioration |
| Jul 16 | 545 | LOW_VOLUME | −3.3 | momentum gone |
| Jul 17 | 534 | LOW_VOLUME | −5.6 (Neutral Bear) | thesis broken (−8%) |

Entry was **lower-conviction than it looked** (score 5D high, but `sniper_inst` ~3.8 vs
35 threshold, RS only "Neutral Bull", chronic LOW_VOLUME). The signals to know this and
to see the Jul-15 turn **already existed** — nothing tied them to the holder.

---

## Phase 3 — VaNi is the Storyteller (unify the LLM surface)

**Principle:** VaNi narrates from the **deterministic story-event stream** (`buildStoryEvents`),
not from a raw snapshot. Same events that drive the visual replay drive the words —
grounded, consistent, cheaper, and un-hallucinatable (kills the custom-index
"FRESH_LONGS/RVOL" fabrication).

One event substrate, four surfaces:

| VaNi role | Fed by | Output |
|---|---|---|
| **Tells the story** | story events | the narrated arc (visual + words share one source) |
| **Tracks the risk** | risk_engine trajectory (Phase 2) | "risk up 3 sessions — flow flipped, RS red" |
| **Highlights in scanners** | scanner row + latest event | one-line hook per stock |
| **AskVaNi explains** | same event + risk substrate | Q&A grounded in facts |

**Guardrail:** VaNi *narrates* facts, never *decides*. Reads "risk is rising"; never says
"sell." SEBI-safe and trust-preserving.

**Reachability:** the story must be openable from **every scanner row** (and every place a
stock surfaces) into the ChartView cockpit — the story is the connective tissue that turns
scattered charts into an informed decision.

---

## Sequence

1. **Phase 1** — custom index foolproof (this doc's detail). Ship + verify index 115.
2. **Phase 2** — bookmark→position + risk graph + deterioration alerts (ARSSBL reference).
3. **Phase 3** — VaNi narrates from the event stream across story / risk / scanners / ask.

Phases 2 and 3 share the story-event substrate, so Phase 2's alert logic and Phase 3's
narration read the same source — build the substrate once.
