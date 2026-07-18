# POA — The Story Engine (Custom Index · Thesis/Move-Quality · VaNi)

**Date:** 2026-07-18 · **Owner:** Charan · **Status:** Phase 1 shipped; Phases 2–3 for discussion.

## The thesis (why this exists)

Our badges read the **level** — trailing 5-day thresholds (`ret_5d > 0`, `score_5d >
score_22d`, delivery surge, flow_type). Levels **lag**. They confirm a move that has
already happened, and they stay green through the top. **That makes badges a trap** — a
user (Charan included) sees "flow entering" and buys into exhaustion.

The **story** reads the **turn** — the *rate of change* (is the thrust accelerating or
fading?), *divergences* (price up, momentum down), and — uniquely for a basket —
*breadth* (is the whole population participating, or one stale name carrying it?).

> **Principle:** a badge reads the level (lagging); the story reads the turn (leading).
> Everything below is about surfacing the turn before the badge flips.

Proven on live data (2026-07-10 → 17), see Appendix. Same event on two scales:
- **ARSSBL (stock):** FRESH_LONGS on the 14th, LONG_LIQUIDATION on the 15th — but the
  14th already showed flat price on strong flow, dropping delivery, absent institution.
- **Wealth Management (index 115):** "flow entering" on the 14th while **only 1 of 5
  constituents was up, 2 of 5 had lost their 20-EMA, one was in FRESH_SHORTS**, and the
  badge was propped by a single stale name (SHAREINDIA's trailing 5-day surge).

---

## Phase 1 — Foolproof Custom Index ✅ SHIPPED

**Problem:** `compute_custom_index_eod()` built the level as a **raw-price average**
(`AVG(close)`) over a time-varying constituent set. Constituents list at staggered dates
and different price scales, so each new listing **jumped the basket level** → disconnected
candle clusters, 89→3,145 drift, negative axis (index 115).

**Fix (migration 152):** **return-chained level** —
`basketRet` = equal-weight avg of constituent daily returns (present both days, clamped
±50%); `level[t] = 1000 · cumprod(1 + basketRet)`. Composition changes never move the
level; `pct_chng` and `ret_5d/22d/66d` derive from the chained level. Guards: exclude
`close ≤ 0`, coverage gate `≥ max(2, ceil(0.5·N))`, sanity clamp. Plus
`v_custom_index_health` + a Data-Health strip on the Manage page.

**Validated:** index 115 now 913 → 15,451 continuous (was 89 → 3,145 clustered).

**Manual step remaining (owner, pgAdmin):** run migration 152, then
`SELECT compute_custom_index_eod(); SELECT compute_all_index_scores();` — **done.**

**Still open (out of P1 scope, tracked as B78):** the index's *own* `rsi_14` / `flow_type`
/ `magic_rs` for custom indices. Note: breadth/consensus (Phase 2b) does **not** need these
— it reads the constituents, which already have them.

---

## Phase 2 — Reading the Turn (two faces, one engine)

You don't *hold* a custom index, so "position tracking" only fits a stock. But the
anti-trap need applies to both — so Phase 2 splits, sharing one reversal engine.

### Shared: the Reversal Engine (build once)

Deterministic, per-bar, observational. Consumes the corrected EOD series and emits
"turn" signals that the story, the risk graph, and VaNi all read:

- **Rate-of-change:** slope of `ret_5d` / `score_5d` (thrust accelerating vs fading). The
  14th: index `ret_5d` 6.1 → 1.1 in a day; `score_5d` 66 → 45.
- **Divergence:** price higher-high while RSI/score lower-high. The 14th: RSI top 75 (Jul
  7) → lower high 70 (Jul 10) on a price high.
- **Exhaustion:** strong flow badge + no price follow-through + fading delivery.

This is an extension of the existing `services/storyEvents.ts` + `engine/risk_engine.py`
(4-dim: structural/momentum/volatility/deception). We add the **derivative** layer.

### Phase 2a — Stock Position Thesis (has an owner, entry, P&L)

Two tracking modes off `km_user_bookmarks`:
- **(a) Entered & tracking** — has entry price/date, wants "is my thesis holding?" + P&L.
- **(b) Bookmarked & tracking** — watching, wants "is it becoming worth acting on?"

Pieces:
1. **Bookmark → light position** — `km_user_bookmarks` today is
   `(user_id, equity_id, created_at)` only. Add optional `entry_price, entry_date, qty`.
   *(Open decision: extend bookmarks vs a separate `km_user_positions` table.)*
2. **Risk/Reward graph** — `risk_engine.py` score plotted **over time since entry** as a
   bipolar reward↔risk trajectory. The **slope** is the signal. ARSSBL: balanced at entry
   (14th) → risk spikes 15th → all-risk by 17th (−8%).
3. **Deterioration alerts** — fire on bearish reversal-engine events for tracked stocks.
   ARSSBL alerts on the 15th (flow→liquidation, RS turns red).
4. **Entry Scorecard** *(optional/secondary)* — pillars snapshot at entry, so users see
   whether they bought strong or weak confluence. ARSSBL: ~2/4 (thin volume, RS neutral,
   institution absent) — a weak buy that looked strong.

### Phase 2b — Custom-Index Move-Quality (breadth-integrity) — "raise the bar"

No position — this is about whether the index's move is **real or a trap**. The index's
superpower is that it's a **population**: it can see narrowness a single stock can't.

1. **Breadth participation** — % of constituents up / above trend (EMA20) / with positive
   RS, and whether that's **expanding or contracting** as the index rises. The 14th: 1/5
   up, 2/5 below EMA → up-day on collapsing breadth = distribution.
2. **Consensus vs the badge** — how many constituents' own flow/score **confirm** the
   index signal. The 14th: 0/5 confirmed FRESH_LONGS with follow-through; one was
   FRESH_SHORTS. Badge disagreed with its members → flag.
3. **Concentration** — is the score carried by 1–2 names? SHAREINDIA alone held it up;
   strip it and the basket had rolled over.
4. **Dispersion** — constituents splitting (one ripping, rest fading) = late-move
   distribution.
5. **+ the shared reversal engine** on the index series (RoC, divergence).

**The anti-trap rule:** the index badge (lagging level) must be corroborated by breadth +
constituent consensus. When they diverge — *green badge, narrowing breadth, members already
fading* — the story raises the **flag**, not the badge.

Feasibility: computable **today** from the constituents (real stocks with flow/RS/EMA) —
not blocked by B78.

---

## Phase 3 — VaNi is the Storyteller (unify the narration)

**Principle:** VaNi narrates from the **deterministic reversal/story-event stream**, not
from a raw snapshot. Same events that drive the visual replay and the risk graph drive the
words — grounded, consistent, cheaper, un-hallucinatable (kills the custom-index
"FRESH_LONGS/RVOL" fabrication).

One substrate, four surfaces:

| VaNi role | Fed by | Output |
|---|---|---|
| **Tells the story** | reversal/story events | the narrated arc (visual + words share one source) |
| **Tracks the risk** | risk_engine + breadth trajectory | "risk up 3 sessions — thrust fading, breadth 1/5" |
| **Highlights in scanners** | scanner row + latest event | one-line hook per stock |
| **AskVaNi explains** | same substrate | Q&A grounded in facts |

**Guardrails:**
- VaNi *narrates* facts, never *decides*. Reads "risk is rising / breadth is narrowing";
  never "sell." SEBI-safe, trust-preserving.
- The story must be openable from **every scanner row** (and anywhere a stock/index
  surfaces) into the cockpit — the story is the connective tissue that turns scattered
  charts into an informed decision.

---

## Sequence

1. **Phase 1** — foolproof custom index ✅ (verify index 115 post-backfill).
2. **Shared reversal engine** — the derivative/divergence layer (both 2a & 2b need it).
3. **Phase 2b** — custom-index move-quality (breadth-integrity). *Least new data — reads
   existing constituents.*
4. **Phase 2a** — stock position thesis (needs the bookmark→position data decision).
5. **Phase 3** — VaNi narrates from the event stream across story / risk / scanners / ask.

(2b before 2a deliberately: it needs no schema change and directly attacks the "index badge
trap" you just hit.)

---

## Open questions to discuss

- **P2a data model:** extend `km_user_bookmarks` with `entry_price/date/qty`, or a separate
  `km_user_positions` table (multiple lots, notes)?
- **P2b thresholds:** what breadth level = "narrow"? (e.g. < 40% participating.) What
  concentration = "carried by one name"? Owner calibration, like all thresholds here.
- **Where 2b lives:** on the index cockpit (ChartView) as a "Move Quality" chapter, on the
  Sector-Rotation index page, or both?
- **Alert delivery (P2a/P3):** in-app only first, or push/email later?
- **VaNi cost/latency:** narrate on-demand (open the story) vs precompute nightly for
  tracked/scanned names?
- **Badge honesty:** do we *soften* the lagging badges (e.g. show "flow entering · breadth
  narrowing") the moment 2b exists, so the trap is defused even before the full story?

---

## Appendix — Evidence (live, 2026-07-10 → 17)

### Index 115 series — the turn was on the 14th, badge flipped on the 15th

| Date | Level | Daily % | ret_5d | score_5d | RSI |
|---|---|---|---|---|---|
| Jul 9 | 12,090 | +2.4 | 7.4 | 74 | 67 |
| Jul 10 | **12,236** | +1.2 | 7.0 | 67 | 70 |
| Jul 13 | 12,140 | −0.8 | 6.1 | 66 | 65 |
| **Jul 14** | 12,053 | −0.7 | **1.1** | **45** | 64 |
| Jul 15 | 11,957 | −0.8 | 1.3 | 17 | 61 |
| Jul 16 | 11,676 | −2.4 | −3.4 | 0 | 53 |

### Inside the basket on the 14th — breadth had already collapsed

| Constituent | Day % | vs EMA20 | Flow |
|---|---|---|---|
| 360ONE | −1.7 | **below** | **FRESH_SHORTS** |
| ANGELONE | −2.0 | **below** | LOW_VOLUME (RS −70) |
| ARSSBL | +0.1 | above | FRESH_LONGS |
| NUVAMA | +0.7 | above | LOW_VOLUME |
| SHAREINDIA | −0.7 | above | LOW_VOLUME (stale ret_5d 7.8 propping the score) |

1/5 up · 2/5 below trend · badge carried by one name → the trap, visible only at the index
level.
