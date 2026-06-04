---
name: dristiQ-screeners
description: >
  Canonical reference for all DristiQ screeners. Use this skill whenever building,
  modifying, or debugging any screener endpoint, VaNi flag, pipeline step, or
  frontend hook. Covers all 19 screeners, the shared SQL base query, filter
  injection pattern, VaNi flag convention, endpoint shape, LLM explain pattern,
  and step-by-step checklist for adding a new screener.
  Triggers on: writing /api/scan/* endpoints, adding is_vani_* columns, writing
  scan hooks, building screener UI, adding pipeline classification steps.
---

# DristiQ Screener System

---

## Architecture Overview

Screeners in DristiQ are **backend SQL scans** (not client-side TypeScript filters).
The existing `scanEngine.ts` client-side implementation is the legacy approach —
all screeners are being migrated to `pipeline2_api.py` SQL endpoints.

```
kd_scan_presets (DB)          ← metadata: name, description, category, sort_order
        ↓
frontend fetchScanPresets()   ← React Query, drives left-nav categories
        ↓
useScreenerName(filters)      ← calls /api/scan/{screener_id}
        ↓
pipeline2_api.py endpoint     ← SQL with window-function CTEs
        ↓
km_equity_eod JOIN km_equity_symbols
  + DISTINCT ON (COALESCE(isin, symbol))  ← NSE-preferred dedup
        ↓
{ screener_id, trade_date, total_count, vani_count, stocks[] }
```

**Two separate caches:**
- `_scan_cache` — 5-minute TTL during market hours (09:15–15:30 IST), 60-minute TTL after close
- `is_vani_*` columns — pre-computed nightly by pipeline, available instantly at query time

---

## Section 1 — Screener Registry

19 screeners total. Column meanings:
- `vani_flag` — boolean column in `km_equity_eod`, computed nightly
- `timeframe` — D=daily, W=weekly, M=monthly
- `universe` — NSE_ONLY (numeric BSE scrip codes excluded), NSE_BSE (both)
- `sort_default` — default ORDER BY after dedup

| screener_id            | category       | name                  | timeframe | universe  | vani_flag           | sort_default         |
|------------------------|----------------|-----------------------|-----------|-----------|---------------------|----------------------|
| `stage_2_leaders`      | momentum       | Stage 2 Leaders       | D         | NSE_ONLY  | `is_vani_s2` ✅     | magic_rs DESC        |
| `strength_confluence`  | momentum       | Strength Confluence   | D         | NSE_BSE   | `is_vani_strength`  | magic_rs DESC        |
| `fresh_breakout`       | momentum       | Fresh Breakouts       | D         | NSE_ONLY  | `is_vani_breakout`  | rvol DESC            |
| `breakout_surge`       | momentum       | Breakout Surge        | D         | NSE_ONLY  | `is_vani_surge`     | rvol DESC            |
| `rs_leaders`           | momentum       | RS Leaders            | D         | NSE_ONLY  | `is_vani_rs`        | magic_rs DESC        |
| `52w_high`             | momentum       | 52-Week Highs         | D         | NSE_ONLY  | `is_vani_52wh`      | pct_of_52wh DESC     |
| `multi_year_high`      | momentum       | Multi-Year Highs      | D         | NSE_ONLY  | `is_vani_ath`       | pct_of_ath DESC      |
| `conviction_flow`      | flow           | Conviction Flow       | D         | NSE_ONLY  | `is_vani_flow`      | delivery_surge_x DESC|
| `high_delivery`        | flow           | High Delivery         | D         | NSE_ONLY  | `is_vani_delivery`  | avg_amt_5d DESC      |
| `smart_money`          | institutional  | Smart Money Loading   | D         | NSE_ONLY  | `is_vani_smart`     | sniper_inst DESC     |
| `high_trade`           | institutional  | High Trade Value      | D         | NSE_ONLY  | `is_vani_hightrade` | avg_amt_5d DESC      |
| `ema20_accum`          | structure      | EMA20 Accumulation    | D         | NSE_ONLY  | `is_vani_ema20`     | magic_rs DESC        |
| `industry_rotation`    | structure      | Industry Rotation     | D         | NSE_BSE   | *(widget only)*     | *(N/A)*              |
| `overbought_vol`       | risk           | Overbought + Volume   | D         | NSE_BSE   | `is_vani_overbought`| rvol DESC            |
| `oversold_vol`         | risk           | Oversold + Volume     | D         | NSE_BSE   | `is_vani_oversold`  | rvol DESC            |
| `distribution_warning` | risk           | Distribution Warning  | D         | NSE_BSE   | `is_vani_distrib`   | magic_rs ASC         |
| `weakness_confluence`  | risk           | Weakness Confluence   | D         | NSE_BSE   | `is_vani_weakness`  | magic_rs ASC         |
| `score_5d`             | performance    | Top 5D Movers         | D         | NSE_BSE   | `is_vani_score5d`   | d5_pct_chng DESC     |
| `score_22d`            | performance    | Top 22D Movers        | D         | NSE_BSE   | `is_vani_score22d`  | d22_pct_chng DESC    |
| `52w_low`              | contrarian     | 52-Week Lows          | D         | NSE_BSE   | `is_vani_52wl`      | pct_of_52wl ASC      |
| `quiet_accumulation`   | contrarian     | Quiet Accumulation    | D         | NSE_ONLY  | *(computed inline)* | sniper_inst DESC     |

`industry_rotation` is a widget, not a tabular screener — it renders a rotation panel, not a stock list.

---

## Section 2 — Base Query Pattern

Every tabular screener uses this SQL skeleton. **Do not deviate from it.**

```sql
WITH latest AS (
    SELECT MAX(trade_date) AS dt FROM km_equity_eod
)
SELECT DISTINCT ON (COALESCE(s.isin, s.symbol))
    -- ── Identity ──────────────────────────────────────
    e.equity_id,
    e.trade_date,
    s.symbol,
    s.company_name,
    s.exchange,
    s.industry,
    s.mcap_cr,
    s.isin,
    -- ── Price ─────────────────────────────────────────
    e.close,
    e.pct_chng,
    -- ── Relative Strength ─────────────────────────────
    e.magic_rs,
    e.magic_rs_zone,
    e.rss_spread,
    -- ── Oscillators ───────────────────────────────────
    e.rsi_14,
    e.rvol,
    -- ── Flow ──────────────────────────────────────────
    e.flow_type,
    e.sniper_inst,
    e.accum_distrib,
    -- ── Structure ─────────────────────────────────────
    e.supertrend_dir,
    e.sma_50,
    e.sma_150,
    e.sma_200,
    e.ema_20,
    e.atr_14,
    -- ── Rolling metrics ───────────────────────────────
    e.w52_high,
    e.w52_low,
    e.lifetime_high,
    e.d30_pct_chng,
    e.d365_pct_chng,
    e.avg_amt_5d,
    e.avg_amt_22d,
    e.delivery_surge_x,
    -- ── Dot signals ───────────────────────────────────
    e.dot_svd,
    e.dot_sbd,
    e.dot_syd,
    -- ── Stage ─────────────────────────────────────────
    e.stage,
    -- ── Computed ──────────────────────────────────────
    ROUND((e.close / NULLIF(e.lifetime_high, 0) * 100)::NUMERIC, 1)       AS pct_of_ath,
    ROUND((e.close / NULLIF(e.w52_high,      0) * 100)::NUMERIC, 1)       AS pct_of_52wh,
    ROUND((e.close / NULLIF(e.w52_low,       0) * 100)::NUMERIC, 1)       AS pct_of_52wl,
    ROUND((e.close / NULLIF(e.ema_20,        0) * 100 - 100)::NUMERIC, 1) AS d_pct,
    -- ── VaNi flag (screener-specific column) ──────────
    e.{vani_flag_column}                                                    AS is_vani

FROM km_equity_eod e
JOIN km_equity_symbols s ON e.equity_id = s.id

WHERE e.trade_date = (SELECT dt FROM latest)
  AND s.is_active   = true
  -- Drop BSE-numeric (NULL isin) stocks that have an NSE equivalent:
  AND NOT (
      s.exchange = 'BSE'
      AND s.isin IS NULL
      AND EXISTS (
          SELECT 1 FROM km_equity_symbols n
          WHERE n.exchange = 'NSE' AND n.is_active = true
            AND LOWER(n.company_name) = LOWER(s.company_name)
      )
  )
  -- ── Screener-specific conditions ──────────────────
  {WHERE_CONDITIONS}
  -- ── Universal optional filters ────────────────────
  {FILTER_CONDITIONS}

ORDER BY
    COALESCE(s.isin, s.symbol),
    CASE WHEN s.exchange = 'NSE' THEN 0 ELSE 1 END,
    e.magic_rs DESC NULLS LAST
```

After the CTE resolves deduplication, the outer query sorts:
```sql
SELECT * FROM <cte>
ORDER BY is_vani DESC NULLS LAST, {sort_col} {sort_dir} NULLS LAST
LIMIT {limit}
```

**Window function CTEs** — add before the base SELECT when needed:
```sql
-- Example: rolling w52 computed on-the-fly (for screeners that can't wait for pipeline step 6g)
rolling AS (
    SELECT equity_id, trade_date,
        MAX(high) OVER (PARTITION BY equity_id ORDER BY trade_date
                        ROWS BETWEEN 251 PRECEDING AND CURRENT ROW) AS w52_high_calc,
        MIN(low)  OVER (PARTITION BY equity_id ORDER BY trade_date
                        ROWS BETWEEN 251 PRECEDING AND CURRENT ROW) AS w52_low_calc,
        MAX(high) OVER (PARTITION BY equity_id ORDER BY trade_date
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS lth_calc
    FROM km_equity_eod
),
sma_slope AS (
    SELECT equity_id, trade_date,
        LAG(sma_200, 20) OVER (PARTITION BY equity_id ORDER BY trade_date) AS sma200_20d_ago
    FROM km_equity_eod
)
-- Then JOIN rolling r ON r.equity_id = e.equity_id AND r.trade_date = e.trade_date
-- Use r.w52_high_calc / r.lth_calc instead of e.w52_high / e.lifetime_high
```

Use the stored columns (`e.w52_high`, `e.lifetime_high`) when the screener relies on pipeline step 6g having run. Use the rolling CTE when the screener must be self-contained regardless of pipeline timing. `stage_2_leaders` uses rolling CTEs; all other screeners should default to stored columns.

---

## Section 3 — Filter Injection Pattern

### Universal filters (all screeners accept these)

```python
# Python side — build filter strings:
exchange_filter  = "AND s.exchange = %(exchange)s"         if exchange  else ""
industry_filter  = "AND s.industry = %(industry)s"         if industry  else ""
mcap_min_filter  = "AND s.mcap_cr >= %(mcap_min)s"         if mcap_min  else ""
mcap_max_filter  = "AND s.mcap_cr <= %(mcap_max)s"         if mcap_max  else ""
```

When `exchange = 'NSE_ONLY'`: replace filter with:
```sql
AND s.exchange = 'NSE'
AND s.symbol !~ '^[0-9]+$'   -- exclude numeric BSE scrip codes that slipped through
```

### Contextual filters (each screener declares which it exposes)

| param         | SQL fragment                                        | screeners that expose it           |
|---------------|-----------------------------------------------------|------------------------------------|
| `rs_zone`     | `AND e.magic_rs_zone = %(rs_zone)s`                 | strength_confluence, smart_money   |
| `rs_min`      | `AND e.magic_rs >= %(rs_min)s`                      | most momentum screeners            |
| `rvol_min`    | `AND e.rvol >= %(rvol_min)s`                        | fresh_breakout, breakout_surge     |
| `rsi_min`     | `AND e.rsi_14 >= %(rsi_min)s`                       | stage_2_leaders                    |
| `rsi_max`     | `AND e.rsi_14 <= %(rsi_max)s`                       | stage_2_leaders                    |
| `pct_ath_min` | `AND (e.close/NULLIF(e.lifetime_high,0)*100) >= %(pct_ath_min)s` | stage_2_leaders, multi_year_high |
| `supertrend`  | `AND e.supertrend_dir = %(supertrend)s`             | stage_2_leaders, strength_confluence |
| `flow_type`   | `AND e.flow_type = %(flow_type)s`                   | conviction_flow, smart_money       |
| `stage`       | `AND e.stage = %(stage)s`                           | stage_2_leaders                    |
| `days_s2_max` | `AND e.stage_entry_days <= %(days_s2_max)s`         | stage_2_leaders (future column)    |

### Parameter hash for cache key

```python
import hashlib, json

def _params_hash(params: dict) -> str:
    """Stable 8-char hash of filter params for cache key."""
    stable = json.dumps({k: v for k, v in sorted(params.items()) if v is not None}, sort_keys=True)
    return hashlib.md5(stable.encode()).hexdigest()[:8]

cache_key = f"scan:{screener_id}:{_params_hash(locals())}"
```

---

## Section 4 — VaNi Flag Convention

### Column naming

```
is_vani_{short_id}   BOOLEAN   in km_equity_eod
```

- Computed **nightly** by pipeline step 6h (or a dedicated step per batch)
- `TRUE` = stock passes all VaNi-quality criteria for that screener
- `NULL` = not yet computed (treat as FALSE in queries)
- Each screener has exactly **one** flag column — no per-stock scores stored

### Current status

| column              | status       | migration |
|---------------------|-------------|-----------|
| `is_vani_s2`        | ✅ exists   | 097       |
| `is_vani_strength`  | ⬜ to add   | 099       |
| `is_vani_breakout`  | ⬜ to add   | 099       |
| `is_vani_surge`     | ⬜ to add   | 099       |
| `is_vani_flow`      | ⬜ to add   | 099       |
| `is_vani_rs`        | ⬜ to add   | 099       |
| `is_vani_52wh`      | ⬜ to add   | 099       |
| `is_vani_ath`       | ⬜ to add   | 099       |
| `is_vani_delivery`  | ⬜ to add   | 099       |
| `is_vani_ema20`     | ⬜ to add   | 099       |
| `is_vani_overbought`| ⬜ to add   | 099       |
| `is_vani_oversold`  | ⬜ to add   | 099       |
| `is_vani_distrib`   | ⬜ to add   | 099       |
| `is_vani_weakness`  | ⬜ to add   | 099       |
| `is_vani_score5d`   | ⬜ to add   | 099       |
| `is_vani_score22d`  | ⬜ to add   | 099       |
| `is_vani_hightrade` | ⬜ to add   | 099       |
| `is_vani_52wl`      | ⬜ to add   | 099       |
| `is_vani_smart`     | ⬜ to add   | 099       |

All ⬜ columns are added in a single migration 099. Criteria defined in Section 9.

### How VaNi flags are computed (pipeline)

```python
# In backfill_stage_classification.py or a new backfill_vani_flags.py:
# One single-pass SQL UPDATE per nightly pipeline run (step 6h extended):

UPDATE km_equity_eod e
SET
    is_vani_strength = (
        e.accum_distrib = 'ACCUMULATION'
        AND e.magic_rs_zone IN ('Strong Bull', 'Mild Bull')
        AND e.rvol > 1.5
    ),
    is_vani_flow = (
        e.delivery_surge_x > 2
        AND (e.close / NULLIF(e.ema_20, 0) * 100 - 100) BETWEEN -3 AND 5
        AND e.close > 100
        AND e.avg_amt_22d > 2
    ),
    -- ... all other flags in the same UPDATE
WHERE e.trade_date = %(trade_date)s
```

---

## Section 5 — Endpoint Pattern

### Standard signature

Every screener endpoint in `pipeline2_api.py` follows this exact shape:

```python
@app.get('/api/scan/{screener_id}')
def scan_{screener_id}(
    # Universal filters
    exchange:  str   = 'combined',   # 'NSE' | 'BSE' | 'combined'
    industry:  str   = '',
    mcap_min:  float = 0,
    mcap_max:  float = 0,
    # Sort
    sort:  str = '{sort_default}',   # column name
    order: str = 'desc',             # 'asc' | 'desc'
    limit: int = 300,
    # Screener-specific params (declare only what this screener exposes)
    # e.g.: rs_min: float = 0, rvol_min: float = 0, ...
):
    cache_key = f"scan:{screener_id}:{_params_hash(locals())}"
    cached = _scan_cache.get(cache_key)
    if cached:
        return cached

    # Build filter fragments
    exchange_filter = ...
    industry_filter = ...
    # screener-specific WHERE conditions (hardcoded, not injected from params)
    screener_conditions = """
        AND e.{condition_1}
        AND e.{condition_2}
    """

    sql = _SCAN_BASE_SQL.format(
        vani_flag_column  = 'is_vani_{id}',
        WHERE_CONDITIONS  = screener_conditions,
        FILTER_CONDITIONS = ' '.join([exchange_filter, industry_filter, ...]),
        sort              = sort if sort in _SAFE_SORT_COLS else 'magic_rs',
        order_dir         = 'DESC' if order.lower() != 'asc' else 'ASC',
    )

    conn = _conn(statement_timeout_ms=30_000)  # 30s — no window functions expected
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    finally:
        conn.close()

    result = {
        "screener_id":  "{screener_id}",
        "trade_date":   str(rows[0]['trade_date']) if rows else None,
        "total_count":  len(rows),
        "vani_count":   sum(1 for r in rows if r.get('is_vani')),
        "stocks":       [dict(r) for r in rows],
    }
    _scan_cache[cache_key] = result
    return result
```

### Safe sort column allowlist

```python
_SAFE_SORT_COLS = {
    'magic_rs', 'rvol', 'rsi_14', 'pct_chng', 'close', 'mcap_cr',
    'sniper_inst', 'avg_amt_5d', 'delivery_surge_x', 'd30_pct_chng',
    'd365_pct_chng', 'pct_of_ath', 'pct_of_52wh', 'pct_of_52wl', 'd_pct',
}
```

Never interpolate the `sort` param directly — always validate against this set first.

### Cache TTL logic

```python
import datetime as _dt

def _scan_ttl() -> int:
    """Returns cache TTL in seconds. 5 min during market hours, 60 min after."""
    now_ist = _dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(hours=5, minutes=30)
    market_open  = now_ist.replace(hour=9,  minute=15, second=0)
    market_close = now_ist.replace(hour=15, minute=30, second=0)
    if market_open <= now_ist <= market_close:
        return 5 * 60
    return 60 * 60

_scan_cache: dict[str, tuple] = {}  # key → (result, expires_at)
```

---

## Section 6 — LLM Explain Pattern

Every screener optionally has a per-stock VaNi explanation endpoint.

### Skill definition (lib/ai_prompts.py)

```python
_{ID}_EXPLAIN_SYSTEM = (
    _IDENTITY
    + "/no_think "
    + "You are DristiQ VaNi intelligence. "
    + "Given one stock's screener metrics, write exactly 2 sentences: "
    + "(1) What the data shows structurally. "
    + "(2) What a trader should watch for. "
    + "Be specific — use the actual numbers provided. No preamble. "
    + _RULES
)

# Register in SKILLS dict:
SKILLS["{screener_id}_explain"] = Skill(system=_{ID}_EXPLAIN_SYSTEM, max_tokens=120)
```

### Endpoint (pipeline2_api.py)

```python
@app.get('/api/ai/{screener_id}-explain')
def {screener_id}_explain(symbol: str):
    if not _AI_ENABLED or not symbol:
        return {"symbol": symbol, "insight": None}

    cache_key = f"{screener_id}_explain:{symbol.upper()}"
    if cache_key in _insight_cache:
        return {"symbol": symbol, "insight": _insight_cache[cache_key], "ai": True}

    # Fetch latest stock data for context
    rows = _db().select('km_equity_eod', '...', filters={'symbol': symbol}, limit=1)
    if not rows:
        return {"symbol": symbol, "insight": None}

    row = rows[0]
    user_msg = (
        f"Stock: {symbol}\n"
        f"Industry: {row.get('industry')}\n"
        f"MagicRS: {row.get('magic_rs')} ({row.get('magic_rs_zone')})\n"
        f"RVOL: {row.get('rvol')}  RSI: {row.get('rsi_14')}\n"
        f"Flow: {row.get('flow_type')}\n"
        # add screener-specific fields
    )
    skill = _AI_SKILLS.get("{screener_id}_explain")
    insight = _ai_complete(skill.system, user_msg, skill.max_tokens, no_think=True)
    if insight:
        _insight_cache[cache_key] = insight
    return {"symbol": symbol, "insight": insight, "ai": insight is not None}
```

### Logging

Every explain endpoint calls `_log_interaction(product="dristiq", endpoint="/api/ai/{screener_id}-explain", ...)`.
Logs go to `vani_db.vn_interaction_log`.

---

## Section 7 — Frontend Hook Pattern

Two hooks per screener in `hooks/useScan.ts` (data) or `hooks/useDashboardExtras.ts` (explain):

```typescript
// ── Data hook ─────────────────────────────────────────────────────

export interface {ScreenerName}Stock {
  equity_id:        number;
  symbol:           string;
  company_name:     string;
  exchange:         string;
  industry:         string;
  mcap_cr:          number | null;
  close:            number;
  pct_chng:         number | null;
  magic_rs:         number | null;
  magic_rs_zone:    string | null;
  rsi_14:           number | null;
  rvol:             number | null;
  flow_type:        string | null;
  sniper_inst:      number | null;
  stage:            string | null;
  pct_of_ath:       number | null;
  pct_of_52wh:      number | null;
  d_pct:            number | null;
  is_vani:          boolean;
  // screener-specific extra columns here
}

export interface {ScreenerName}Filters {
  exchange?:  string;
  industry?:  string;
  mcap_min?:  number;
  mcap_max?:  number;
  sort?:      string;
  order?:     string;
  // screener-specific filters here
}

export interface {ScreenerName}Result {
  screener_id:  string;
  trade_date:   string | null;
  total_count:  number;
  vani_count:   number;
  stocks:       {ScreenerName}Stock[];
}

export function use{ScreenerName}(filters: {ScreenerName}Filters = {}) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';
  return useQuery<{ScreenerName}Result>({
    queryKey: ['{screener_id}', filters],
    queryFn: async () => {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      );
      const res = await fetch(`${pipelineUrl}/api/scan/{screener_id}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,   // 5 min — matches backend cache TTL
    retry: false,
  });
}

// ── Explain hook ──────────────────────────────────────────────────

export function use{ScreenerName}Explain(symbol: string | null) {
  const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';
  return useQuery<{ symbol: string; insight: string | null; ai: boolean }>({
    queryKey: ['{screener_id}_explain', symbol],
    queryFn: async () => {
      const res = await fetch(`${pipelineUrl}/api/ai/{screener_id}-explain?symbol=${symbol}`);
      if (!res.ok) return { symbol: symbol!, insight: null, ai: false };
      return res.json();
    },
    enabled:   !!symbol,
    staleTime: 60 * 60 * 1000,  // 1h — explain text stable during session
    retry: false,
  });
}
```

---

## Section 8 — Adding a New Screener (4-Step Checklist)

### Step 1 — Pipeline classification (if new VaNi flag needed)

1. Define the VaNi criteria in plain English first — get approval before writing SQL
2. Add the `is_vani_{id} BOOLEAN` column to migration 099 (all new flags in one migration)
3. Add the classification CASE expression to `backfill_vani_flags.py` single-pass UPDATE
4. Verify on latest date: `SELECT COUNT(*) FROM km_equity_eod WHERE trade_date = 'LATEST' AND is_vani_{id} = true` — expected 50–300 stocks

### Step 2 — API endpoint

1. In `pipeline2_api.py`, add `@app.get('/api/scan/{screener_id}')` following the pattern in Section 5
2. Write screener-specific WHERE conditions using only stored columns (no window functions unless the screener explicitly needs on-the-fly computation like stage_2_leaders)
3. Use `_SAFE_SORT_COLS` allowlist; default sort from registry
4. Set `statement_timeout_ms=30_000` (30s); use 120s only if window function CTEs are needed
5. Test: `curl "http://localhost:8101/api/scan/{screener_id}"` — expect `total_count` > 0, `vani_count` ≥ 0

### Step 3 — AI explain (optional, add later)

1. Add `_{ID}_EXPLAIN_SYSTEM` to `lib/ai_prompts.py`
2. Register in `SKILLS` dict
3. Add `@app.get('/api/ai/{screener_id}-explain')` endpoint

### Step 4 — Frontend

1. Add TypeScript interfaces to `hooks/useScan.ts`
2. Add `use{ScreenerName}()` and `use{ScreenerName}Explain()` hooks
3. Wire to screener component in `ScanView.tsx`
4. Export from `hooks/index.ts`

---

## Section 9 — Screener-Specific Definitions

### stage_2_leaders ✅ (already built)

```sql
-- WHERE conditions
AND e.close > e.sma_50
AND e.sma_50 > e.sma_200
AND e.close > e.sma_200
AND e.sma_200 IS NOT NULL
AND e.close > 30
AND r.w52_low_calc * 1.25 <= e.close        -- not extended from lows
AND r.w52_high_calc * 0.75 <= e.close       -- within 25% of 52w high
AND (e.sma_200 > ss.sma200_20d_ago OR e.sma_200 > ss.sma200_80d_ago)  -- MA rising
```

VaNi criteria (is_vani_s2):
```
magic_rs > 40
AND rvol > 1.5
AND rsi_14 BETWEEN 50 AND 80
AND close / lifetime_high >= 0.75
AND close / w52_high >= 0.85
```

Extra columns: `pct_of_ath`, `pct_of_52wh`, `stage`, `supertrend_dir`, `sma200_20d_ago`
Contextual filters: `rs_min`, `rsi_min`, `rsi_max`, `pct_ath_min`, `supertrend`
Uses rolling CTEs (w52 and sma_slope) — `statement_timeout_ms=120_000`

---

### strength_confluence

```sql
-- WHERE conditions
AND (
    e.accum_distrib = 'ACCUMULATION'
    OR (
        e.close > e.sma_150
        AND e.magic_rs_zone IN ('Strong Bull', 'Mild Bull')
        AND e.flow_type IN ('FRESH_LONGS', 'SHORT_COVERING')
        AND e.rvol > 1.5
    )
)
```

VaNi criteria (is_vani_strength):
```
accum_distrib = 'ACCUMULATION'
AND magic_rs_zone IN ('Strong Bull', 'Mild Bull')
AND rvol > 1.5
AND close > sma_150
```

Extra columns: `accum_distrib`
Contextual filters: `flow_type`, `rs_zone`, `rvol_min`

---

### fresh_breakout

```sql
-- WHERE conditions
AND e.rvol > 2
AND e.close > e.sma_150
AND e.close >= (
    SELECT MAX(close)
    FROM km_equity_eod h
    WHERE h.equity_id = e.equity_id
      AND h.trade_date < e.trade_date
      AND h.trade_date >= e.trade_date - INTERVAL '20 days'
)
```

VaNi criteria (is_vani_breakout):
```
rvol > 5
AND close >= 1.0 * (20-day prior high)   -- AT or above breakout level
AND (close / (20-day prior high) * 100 - 100) <= 5   -- within 5% of breakout
AND rsi_14 < 75
AND (close / ema_20 * 100 - 100) < 15   -- not overextended from EMA20
```

Extra columns: `breakout_level` (subquery), `pct_from_breakout`
Note: The 20-day high subquery adds latency. Consider storing `breakout_level` in pipeline step 6h for the daily date.
Contextual filters: `rvol_min`, `rs_min`

---

### breakout_surge

```sql
-- WHERE conditions
AND e.rvol > 2
AND e.close >= 50
AND e.close >= (
    SELECT MAX(close)
    FROM km_equity_eod h
    WHERE h.equity_id = e.equity_id
      AND h.trade_date < e.trade_date
      AND h.trade_date >= e.trade_date - INTERVAL '20 days'
)
```

VaNi criteria (is_vani_surge):
```
rvol > 5
AND (close / (20-day prior high) * 100 - 100) BETWEEN 0 AND 5
AND rsi_14 < 75
AND (close / ema_20 * 100 - 100) < 15
```

Extra columns: `breakout_level`, `pct_from_breakout`
Same 20-day high subquery concern as fresh_breakout.
Contextual filters: `rvol_min`, `rs_min`

---

### conviction_flow

```sql
-- WHERE conditions
AND e.avg_amt_22d > 1.5
AND e.delivery_surge_x > 1.5
AND (e.close / NULLIF(e.ema_20, 0) * 100 - 100) BETWEEN -8 AND 8
AND e.close IS NOT NULL
AND e.ema_20 IS NOT NULL
```

VaNi criteria (is_vani_flow):
```
delivery_surge_x > 2
AND (close / ema_20 * 100 - 100) BETWEEN -3 AND 5
AND close > 100
AND avg_amt_22d > 2
```

Extra columns: `avg_amt_5d`, `avg_amt_22d`, `delivery_surge_x`, `d_pct`
Contextual filters: `flow_type`, `rvol_min`
Sort default: `delivery_surge_x DESC`

---

### smart_money

```sql
-- WHERE conditions
AND e.sniper_inst > 20
AND e.rss_spread > 0
AND e.accum_distrib = 'ACCUMULATION'
-- Industry filter: only industries with pct_accumulation > 60
-- (join to km_industry_eod i ON i.industry = s.industry AND i.trade_date = e.trade_date)
AND i.pct_accumulation > 60
```

VaNi criteria (is_vani_smart):
```
sniper_inst > 30
AND rss_spread > 0.5
AND accum_distrib = 'ACCUMULATION'
AND magic_rs > 0
```

Extra columns: `rss_spread`, `accum_distrib`
Extra join: `LEFT JOIN km_industry_eod i ON i.industry = s.industry AND i.trade_date = e.trade_date`
Contextual filters: `rs_zone`, `flow_type`
Sort default: `sniper_inst DESC`

---

### high_delivery

```sql
-- WHERE conditions
AND e.avg_amt_5d > 5        -- Rs 5 Cr+ avg daily delivery
AND e.delivery_surge_x > 1.2
```

VaNi criteria (is_vani_delivery):
```
avg_amt_5d > 10
AND delivery_surge_x > 2
AND close > sma_50
```

Extra columns: `avg_amt_5d`, `avg_amt_22d`, `delivery_surge_x`
Sort default: `avg_amt_5d DESC`

---

### rs_leaders

```sql
-- WHERE conditions
AND e.magic_rs > 60
AND e.magic_rs_zone IN ('Strong Bull', 'Mild Bull')
AND e.close > e.sma_200
```

VaNi criteria (is_vani_rs):
```
magic_rs > 75
AND magic_rs_zone = 'Strong Bull'
AND rvol > 1.2
AND close > sma_50
```

Contextual filters: `rs_zone`, `rs_min`
Sort default: `magic_rs DESC`

---

### 52w_high

```sql
-- WHERE conditions
AND e.w52_high IS NOT NULL
AND (e.close / NULLIF(e.w52_high, 0) * 100) >= 95   -- within 5% of 52w high
```

VaNi criteria (is_vani_52wh):
```
close / w52_high >= 0.99    -- at 99%+ of 52w high (effectively AT the high)
AND rvol > 1.5
AND magic_rs > 50
```

Extra columns: `pct_of_52wh`, `w52_high`
Sort default: `pct_of_52wh DESC`

---

### multi_year_high

```sql
-- WHERE conditions
AND e.lifetime_high IS NOT NULL
AND (e.close / NULLIF(e.lifetime_high, 0) * 100) >= 90   -- within 10% of ATH
```

VaNi criteria (is_vani_ath):
```
close / lifetime_high >= 0.98   -- at 98%+ of all-time high
AND rvol > 1.5
AND magic_rs > 50
```

Extra columns: `pct_of_ath`, `lifetime_high`
Sort default: `pct_of_ath DESC`

---

### ema20_accum

```sql
-- WHERE conditions
AND e.ema_20 IS NOT NULL
AND (e.close / NULLIF(e.ema_20, 0) * 100 - 100) BETWEEN -5 AND 5   -- hugging EMA20
AND e.accum_distrib = 'ACCUMULATION'
AND e.close > e.sma_200
```

VaNi criteria (is_vani_ema20):
```
(close / ema_20 * 100 - 100) BETWEEN -2 AND 3
AND accum_distrib = 'ACCUMULATION'
AND magic_rs > 20
AND rvol > 1.2
```

Extra columns: `d_pct`, `accum_distrib`
Sort default: `magic_rs DESC`

---

### overbought_vol

```sql
-- WHERE conditions
AND e.rsi_14 > 70
AND e.rvol > 2
AND e.close > e.sma_50
```

VaNi criteria (is_vani_overbought):
```
rsi_14 > 80
AND rvol > 3
AND magic_rs_zone = 'Strong Bull'
```

Sort default: `rvol DESC`

---

### oversold_vol

```sql
-- WHERE conditions
AND e.rsi_14 < 30
AND e.rvol > 2
```

VaNi criteria (is_vani_oversold):
```
rsi_14 < 25
AND rvol > 3
AND close > 30    -- avoid penny stocks in distress
```

Sort default: `rvol DESC`

---

### distribution_warning

```sql
-- WHERE conditions
AND (
    (e.dot_syd = true AND e.magic_rs_zone IN ('Mild Bull', 'Neutral', 'Mild Bear'))
    OR e.accum_distrib = 'DISTRIBUTION'
)
AND e.close > 50
```

VaNi criteria (is_vani_distrib):
```
dot_syd = true
AND accum_distrib = 'DISTRIBUTION'
AND magic_rs_zone IN ('Mild Bear', 'Strong Bear')
```

Extra columns: `dot_syd`, `dot_sbd`, `accum_distrib`
Sort default: `magic_rs ASC`

---

### weakness_confluence

```sql
-- WHERE conditions
AND (
    e.accum_distrib = 'DISTRIBUTION'
    OR (
        e.close < e.sma_150
        AND e.magic_rs_zone IN ('Strong Bear', 'Mild Bear')
        AND e.flow_type IN ('FRESH_SHORTS', 'LONG_LIQUIDATION')
        AND e.rvol > 1.5
    )
)
```

VaNi criteria (is_vani_weakness):
```
accum_distrib = 'DISTRIBUTION'
AND magic_rs_zone IN ('Strong Bear', 'Mild Bear')
AND rvol > 1.5
AND close < sma_150
```

Extra columns: `accum_distrib`
Sort default: `magic_rs ASC`

---

### score_5d

```sql
-- WHERE conditions
AND e.d30_pct_chng IS NOT NULL
-- Use d5 approximation via pct_chng × 5 (d5 not stored separately)
-- Or add d5_pct_chng column in a future migration
AND e.close > 20
AND e.rvol > 0.5
ORDER BY d30_pct_chng DESC   -- proxy until d5 column available
```

VaNi criteria (is_vani_score5d):
```
d30_pct_chng > 10
AND rvol > 2
AND magic_rs > 50
```

Note: A dedicated `d5_pct_chng` column would be more accurate — add in migration 100 if needed.

---

### score_22d

```sql
-- WHERE conditions
AND e.d30_pct_chng IS NOT NULL
AND e.close > 20
AND e.rvol > 0.5
```

VaNi criteria (is_vani_score22d):
```
d30_pct_chng > 20
AND rvol > 1.5
AND magic_rs > 50
```

Sort default: `d30_pct_chng DESC`

---

### high_trade

```sql
-- WHERE conditions
AND e.avg_amt_5d > 20    -- Rs 20 Cr+ daily trade value
```

VaNi criteria (is_vani_hightrade):
```
avg_amt_5d > 50
AND delivery_surge_x > 1.5
AND magic_rs > 30
```

Sort default: `avg_amt_5d DESC`

---

### 52w_low

```sql
-- WHERE conditions
AND e.w52_low IS NOT NULL
AND (e.close / NULLIF(e.w52_low, 0) * 100) <= 110   -- within 10% of 52w low
AND e.close > 20
```

VaNi criteria (is_vani_52wl):
```
close / w52_low <= 1.05   -- within 5% of 52w low
AND rvol > 2              -- volume spike at the low (possible reversal)
AND rsi_14 < 35
```

Extra columns: `pct_of_52wl`, `w52_low`
Sort default: `pct_of_52wl ASC`

---

### quiet_accumulation

```sql
-- WHERE conditions
-- Contrarian: NOT in top-quartile industries by magic_rs
AND s.industry NOT IN (
    SELECT industry FROM km_industry_eod
    WHERE trade_date = (SELECT MAX(trade_date) FROM km_industry_eod)
      AND industry_rank <= (
          SELECT COUNT(*) / 4 FROM km_industry_eod
          WHERE trade_date = (SELECT MAX(trade_date) FROM km_industry_eod)
      )
)
AND e.accum_distrib = 'ACCUMULATION'
AND e.sniper_inst > 15
AND e.close > e.sma_200
```

VaNi criteria: computed inline (no stored flag) — screener is inherently bespoke:
```
accum_distrib = 'ACCUMULATION'
AND sniper_inst > 25
AND magic_rs BETWEEN -20 AND 40   -- not yet showing up in RS screens
AND close > sma_200
```

Extra join: `LEFT JOIN km_industry_eod i ON i.industry = s.industry AND i.trade_date = e.trade_date`
Note: `industry_rotation` is a widget panel (Section 1) — not built as a tabular screener.

---

## Section 10 — VaNi Flag Columns to Add

Migration 099 (`km_migration_099_vani_flags.sql`) — adds all is_vani_* columns in one DDL:

```sql
ALTER TABLE km_equity_eod
    ADD COLUMN IF NOT EXISTS is_vani_strength   BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_breakout   BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_surge      BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_flow       BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_rs         BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_52wh       BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_ath        BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_delivery   BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_ema20      BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_overbought BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_oversold   BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_distrib    BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_weakness   BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_score5d    BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_score22d   BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_hightrade  BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_52wl       BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_vani_smart      BOOLEAN;
```

After running migration 099, add the classification logic for all flags to `backfill_vani_flags.py` (new script, same single-pass SQL pattern as `backfill_stage_classification.py`).

Pipeline integration: extend step 6h in `daily_pipeline.py` to call `compute_vani_flags_for_date(db, trade_date)`.

---

## Data Quality Guards (from dristiQ-data-quality skill)

Every screener query must respect these:

1. **Dedup**: Use `DISTINCT ON (COALESCE(s.isin, s.symbol))` with NSE-first ORDER — always in base query
2. **SHANTHALA**: Never filter by `index_names[]` array directly — always JOIN through `km_index_symbols WHERE is_active = true`
3. **RVOL pre-March 2026**: RVOL-dependent conditions (rvol > threshold) may produce false results for dates before 2026-03-25 on index data. Equity RVOL is generally safe.
4. **NULL column guards**: Use `NULLIF(col, 0)` in divisions. Add `IS NOT NULL` where a NULL would silently exclude or include wrong rows.
5. **Numeric BSE symbols**: Always apply the `NOT (exchange='BSE' AND isin IS NULL AND NSE peer exists)` exclusion or use `universe='NSE_ONLY'` exchange filter.
