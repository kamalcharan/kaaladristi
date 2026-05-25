---
name: dristiQ-widgets
description: >
  Encodes DristiQ's three proprietary widgets: MagicRS, Breadth ROC, and Smart Money
  (Sniper). Use this skill whenever working on widget compute functions, widget DB columns,
  widget-related frontend components, or any question about how these signals are calculated,
  what they return, or where they live. Triggers on: modifying compute_engine.py, debugging
  MagicRS values, working on BreadthRocChart, SmartMoneyCard, or any indicator that
  derives from these three widgets.
---

# DristiQ Proprietary Widgets

Three proprietary signals that are central to DristiQ's edge over generic platforms.
Each has a specific compute location, output columns, and display meaning.

---

## 1. MagicRS (Relative Strength)

**What it measures:** How a symbol performs relative to NIFTY 500 benchmark.
Rising = outperforming. Falling = underperforming.

**Compute location:** `App/backend/indicators/compute_engine.py` line ~275
Called as: `compute_magic_rs(df_indexed, benchmark_close)`
From module: `indicators.calculators.magic_rs`

**Output columns written to `km_equity_eod` and `km_index_eod`:**
| Column | Description |
|---|---|
| `magic_rs` | Raw RS value |
| `magic_rs_sma144` | 144-period SMA of magic_rs |
| `magic_ma` | Moving average signal |
| `magic_rs_zone` | Title Case zone string (DB-computed) |
| `magic_rs_short_*` | Short-timeframe RS columns (added M069) |

**MagicRS Zone values (Title Case — DB-computed, not Python-computed):**
`Strong Bull` / `Mild Bull` / `Neutral` / `Mild Bear` / `Strong Bear`

**Canonical import in frontend:**
```typescript
import { ZONE_LABELS } from '@/constants/signalScale';
```
Never define zone labels inline in components.

**Correlation view buckets (Phase 4):**
0-20 / 20-40 / 40-60 / 60-80 / 80-100
Each bucket shows avg 5D/22D Nifty return when MagicRS was in that range.

**Pipeline integration order (daily_pipeline.py):**
1. compute_all_indicators()
2. compute_all_magic_rs('km_index_eod', 'index_id')  ← index first
3. compute_all_magic_rs('km_equity_eod', 'equity_id')  ← then equity
4. compute_all_flow_intelligence()
5. compute_all_industry_composites()

---

## 2. Breadth ROC

**What it measures:** Rate of change of market breadth — how fast the tide is turning.
Positive + rising = broad participation building. Negative + falling = breadth collapsing.

**Compute location:** `App/backend/compute_breadth_roc.py`
Function: `compute_roc(closes: pd.DataFrame)`

**Calculation:**
```python
roc_13 = mean cross-stock 13-day ROC / 13    # fast signal
roc_55 = mean cross-stock 55-day ROC / 55    # slow signal
sma_breadth = 5-period SMA of roc_13         # smoothed
stock_count = stocks with 55-day history     # data quality indicator
```

**Output table:** `km_breadth_roc`
Columns: `trade_date` (PK), `roc_13`, `roc_55`, `sma_breadth`, `stock_count`

**State interpretation for correlation (Phase 4):**
Four states from crossing zero and direction:
- Rising + Above zero = EXPANDING
- Rising + Below zero = RECOVERING
- Falling + Above zero = WEAKENING
- Falling + Below zero = CONTRACTING

**Frontend component:** `BreadthRocChart` in `MarketStructureView`
Data hook: `useBreadthRoc` → PostgREST on `km_breadth_roc`

---

## 3. Smart Money / Sniper (Institutional Flow)

**What it measures:** Proxy for institutional vs retail participation, derived from RSI_9.
Higher = more likely institutional activity.

**Compute location:** PL/pgSQL function in `App/DBscripts/km_migration_014_indicator_rpc.sql` line ~253
Runs in the database as part of indicator compute RPC.

**Formulas:**
```sql
sniper_inst = ROUND(LEAST(50, GREATEST(0, 1.5 * (rsi_9 - 61))), 4)
sniper_hot  = ROUND(LEAST(50, GREATEST(0, 1.0 * (rsi_9 - 15))), 4)
sniper_rsi  = ROUND(rsi_9 / 2, 4)
```

**Activation thresholds:**
- `sniper_inst` activates when RSI_9 > 61 (institutional signal)
- `sniper_hot` activates when RSI_9 > 15 (hot money signal)
- Both are capped at 50

**Output columns written to `km_equity_eod` and `km_index_eod`:**
`sniper_inst`, `sniper_hot`, `sniper_rsi`

**Display vocabulary (canonical — use these labels in UI):**
| Internal term | Display label |
|---|---|
| `sniper_inst` | Smart Money |
| SBD signal | Accumulation Signature |
| SVD signal | Strong Volume Drive / Volume Drive |
| SYD signal | Distribution Signal |

**Frontend component:** `SmartMoneyCard` in `VisualPulsePage`

---

## Widget → Correlation View Mapping (Phase 4)

| Widget | Known combination view | Shape when combined with other blocks |
|---|---|---|
| MagicRS | Bucket chart (5 buckets) | ZONE_CONFLUENCE (has zone config) or EVENT_IN_STATE |
| Breadth ROC | State quadrant cards | EVENT_IN_STATE (has states config) |
| Smart Money / Sniper | Not a standalone correlation view | ZONE_CONFLUENCE when combined |

---

## Data Availability Note

All widget data exists in `km_index_eod` / `km_equity_eod`.
Frontend fetches most columns but historically only displayed a few.
If a column appears missing from a frontend fetch, check the PostgREST select= query
in the relevant service file — the column likely exists in DB but wasn't selected.
