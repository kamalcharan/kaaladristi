---
name: dristiQ-correlation
description: >
  Encodes DristiQ's correlation and confluence architecture. Use this skill whenever
  working on /api/confluence/* endpoints, the km_astro_correlation table (Phase 4),
  the adaptive correlation engine (4 shapes), correlation views in the frontend, or
  any question about how astro rules combine with technical indicators to produce
  historical outcome data. Triggers on: building correlation views, adding a new
  correlation type, debugging confluence queries, implementing the shape classifier,
  or anything touching the two-path rendering system (known vs adaptive combinations).
---

# DristiQ Correlation Engine

Two-path system. Every correlation query is either a known combination (pre-built view)
or an unknown combination (adaptive engine assigns one of 4 shapes).

---

## Current State vs Phase 4 Target

**What exists now (real-time SQL confluence):**
Three endpoints doing live SQL cross-joins of nak-vara signals against breadth/ROC regimes.
No `km_astro_correlation` table. No shape classifier. No adaptive engine.

**What Phase 4 builds:**
- `km_astro_correlation` table (pre-computed correlation results)
- Shape classifier logic
- 4 adaptive shape templates
- Known combination pre-built views (MagicRS bucket, RSI zones, Breadth states, Scanner outcomes)

Do not confuse the two. Current confluence endpoints are an early approximation —
useful but architecturally different from the full correlation engine.

---

## Current Live Endpoints

All in `pipeline2_api.py`. Module-level cache: `_confluence_cache`.

### GET /api/confluence/historical
Nak-vara outcome cross-joined against breadth_regime and roc_regime.
Returns: `{breadth_rows, roc_rows, total_signals}` — 2D outcome matrices.

### GET /api/confluence/heatmap?date=
Today's conditions: `breadth_score`, `roc_13`, `sma_breadth`, breadth/ROC regimes,
dominant nak-vara signal + 3-way historical pattern.

### GET /api/confluence/timeline?days=30
Last N trading days: `{trade_date, nifty_return, breadth_score, roc_13, nakvar_outcome}`

---

## Phase 4 — Two-Path Rendering System

```
User has 2+ overlays active on workspace
  ↓
VaNi confluence detection fires
  ↓
Is this a known combination?
  ├── YES → render pre-built view directly
  └── NO  → Shape Classifier
              ↓
            Assign Shape 1, 2, 3, or 4
              ↓
            Populate adaptive template
              ↓
            Generate VaNi inference
              ↓
            Render
```

### Known Combinations (pre-built views)
- MagicRS alone → bucket chart (5 buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
- Breadth ROC alone → state quadrants (Rising/Falling × Above/Below zero)
- RSI alone → zone cards (OB / Neutral / OS)
- Conviction Flow alone → outcome histogram

---

## Phase 4 — Shape Classifier

```typescript
function classifyShape(blockA: BuildingBlock, blockB: BuildingBlock): Shape {
  const isEventBased = (b) => b.type === 'astro_rule' || b.type === 'technical_rule_event'
  const isThreshold = (b) => b.type === 'indicator' && b.config.threshold !== undefined
  const isZone = (b) => b.type === 'indicator' && b.config.zone !== undefined || b.type === 'widget'
  const isStateBased = (b) => b.type === 'widget' && b.config.states !== undefined

  if (isEventBased(blockA) && isEventBased(blockB))           return 'EVENT_OVERLAP'
  if (isEventBased(blockA) && isThreshold(blockB) ||
      isEventBased(blockB) && isThreshold(blockA))            return 'THRESHOLD_CROSS'
  if ((isZone(blockA) || isThreshold(blockA)) &&
      (isZone(blockB) || isThreshold(blockB)))                return 'ZONE_CONFLUENCE'
  if (isEventBased(blockA) && isStateBased(blockB) ||
      isEventBased(blockB) && isStateBased(blockA))           return 'EVENT_IN_STATE'
  return 'ZONE_CONFLUENCE'  // fallback
}
```

**Information value ranking (for 3+ block combinations):**
`EVENT_IN_STATE > THRESHOLD_CROSS > EVENT_OVERLAP > ZONE_CONFLUENCE`

---

## Phase 4 — Four Adaptive Shapes

### Shape 1 — EVENT_OVERLAP
Both blocks event/period-based. Examples: Mercury Retrograde + Panchak.
Query returns: overlap instances (start_date, end_date, duration_days) + 5D/22D/3M Nifty return per instance.
Stats: n, bearish_count, bullish_count, avg_return, avg_duration.

### Shape 2 — THRESHOLD_CROSS
One event-based + one threshold indicator. Examples: Panchak + RSI > 70.
Query returns: instances where threshold crossed DURING event period + 5D/22D return.
Stats: n, bearish_count, avg_return, avg_days_to_reversal.

### Shape 3 — ZONE_CONFLUENCE
Both continuous indicators with zone definitions. Examples: RSI > 70 + MagicRS > 60.
Query returns: periods where both zones simultaneously true + 5D/22D return per period.
Stats: n, positive_rate, avg_return, avg_duration, fat_tail_indicator.
Note: if positive_rate near 50%, treat as volatility signal, not directional.

### Shape 4 — EVENT_IN_STATE
One event-based + one state-based indicator. Examples: Sankranti + Breadth ROC state.
Query returns: for each event instance, which state the indicator was in at firing.
Stats: per-state breakdown of n, avg_5D, avg_22D, positive_rate.
Most informative shape — shows how market context modulates astro event outcomes.

---

## Phase 4 — Shared View Anatomy (all 4 shapes)

In this exact order:
1. VaNi Detection Banner — dismissable after 5s; never shown for known combinations
2. Combination Header — shape tag + combination pills + operator (∩ / + / →) + instance count
3. Controls Bar — benchmark selector + timeframe toggle + "Save this combination" CTA
4. Data Quality Bar — per building block quality + combined quality
5. Adaptive Visualization — unique per shape
6. VaNi Inference Card — orb + label + body + confidence footer (right column, always)
7. Action Island — key finding in one line

---

## Phase 4 — km_astro_correlation Table (to be created — M073+)

This table pre-computes correlation results so the adaptive engine doesn't run raw SQL
on every page load. Schema to be designed in Phase 4 sprint.

Key fields will include: `block_a_id`, `block_b_id`, `shape`, `benchmark`,
`timeframe`, `result_payload` (JSONB), `computed_at`, `instance_count`.

---

## Minimum Instance Threshold

If a combination has fewer than 3 historical instances, do not render a correlation view.
VaNi says: "Only [n] historical instances — not enough to draw reliable conclusions."
Still save the combination if user requests it, but mark `insufficient_data: true`.

---

## Benchmark Switching

Available benchmarks: Nifty 50 / Nifty 500 / Bank Nifty.
Switching benchmark = full requery against selected index, not a filter on existing data.
All stats, VaNi inference, Action Island, and data quality bar all update on switch.

---

## VaNi Inference Generation

Inference notes are template strings populated with computed values — NOT AI-generated at runtime.

Shape 1 template: "[BlockA] and [BlockB] have overlapped [n] times since [start_year] — with [bearish_n] of [n] producing [direction] outcomes on [benchmark] over [timeframe]. [context_note] [current_status]"

Shape 4 template: "[event]'s outcome is [strongly|moderately] conditioned by the [indicator] state at the time of firing. [best_state_note] [current_state_note] [interpretation]"

`context_note` and similar are selected from predefined sets based on hit rate, sample size,
and current market context — not generated by LLM.
