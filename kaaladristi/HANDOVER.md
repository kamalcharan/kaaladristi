# Session Handover — 2026-06-25

Branch `claude/tender-brahmagupta-78b32r` merged to `main` as PR #51.

---

## What Was Done This Session

### 1. CORS Fix (dev server)
**Files:** `App/frontend/vite.config.ts`, `App/frontend/src/services/postgrest.ts`

Dev server at `localhost:3000` was blocked by CORS when making requests directly to
`http://187.127.136.65/api/rest`. All bundle-based scans (fresh_breakout etc.) returned empty.

Fix: Vite `server.proxy` routes `/db` → PostgREST and `/pipeline-api` → FastAPI.
`postgrest.ts` uses `/db` in dev (`import.meta.env.DEV`), full URL in prod.
`VITE_PIPELINE_API_URL` is overridden to `/pipeline-api` in dev via `define` — all 30+ call
sites pick it up automatically. No env file changes required.

### 2. ScanTable Column Visibility
**File:** `App/frontend/src/components/domain/ScanTable.tsx`

- `hiddenCols` was initialized to empty set → all optional cols visible on first load.
  Fixed: initialise to `new Set(groupOptionalCols)` so only defaultCols show.
- Storage key changed from `scan_cols:${presetId}` → `dristiq_cols_${presetId}` (clean slate).
- Added `key={presetId}` to `<ScanTable>` in `ScanView.tsx` so React remounts on preset
  switch and hidden-cols state resets correctly.

### 3. scanBreakoutSurgeDaily — Date Check Removed
**File:** `App/frontend/src/services/scanEngine.ts`

Strict `eod.trade_date !== tradeDate` check was silently discarding all stocks when the
latest DB bar date differed by even one day from the resolved trade date. Removed — history
is already ordered DESC so `history[0]` is always the latest bar.

### 4. scanBreakoutSurgeDaily — Scores Computed Client-Side
**File:** `App/frontend/src/services/scanEngine.ts`

`score_5d`, `score_22d`, `avg_amt_66d`, `pct_5d/22d/66d` were always NULL for the latest
trading date because migration 111 was a one-time backfill; `compute_rolling_metrics_for_date()`
(pipeline step 6g) never writes these columns for new dates.

Fix: compute all six values from the 100-day history window the scanner already fetches.
- History window extended: 40 → 100 calendar days (covers 66+ trading bars)
- `value_cr` added to EOD_COLS; DB columns `avg_amt_5d/22d/66d/score_*` dropped from fetch
- `avg_amt_5d/22d/66d`: `value_cr × delivery_pct/100` (same as `buildScanStock()`)
- `score_5d/22d`: surge² × 25 formula matching migration 111 exactly
- `ret_5d/22d/66d`: computed from close prices in history
- `delivery_surge_x`: recomputed from client avg_amt values

---

## Open Items — Next Session

### A. mcap_cr Inflated Values (DB issue, no code bug)
Code correctly reads from `sym.mcap_cr` in both `buildScanStock()` (line 660) and
`scanBreakoutSurgeDaily()` (line 1881). Neither EOD_COLS nor `EquityEodSnapshot` includes
`mcap_cr` — no eod leak. The inflated value is in the DB itself.

**Action needed:** Run this on the VPS and check the unit:
```sql
SELECT mcap_cr FROM km_equity_symbols WHERE symbol = 'KIRLOSENG';
```
If value is in ₹ Thousands or Lakhs instead of Crores, the DB column needs a unit fix.

### B. Migrations Still To Run on VPS
These files exist in `App/DBscripts/` but must be applied manually:
- `km_migration_110_scanner_categories.sql` — adds category columns to `kd_scan_presets`
- `km_migration_111_eod_score_columns.sql` — adds score/pct columns to `km_equity_eod`
  (historical backfill; new dates computed client-side now, so less urgent)

### C. kd_scan_presets DB Row Rename
After running migration 110, rename the breakout surge preset:
```sql
UPDATE kd_scan_presets
SET id = 'breakout_surge_daily',
    name = 'Breakout Surge Daily',
    category = 'price_action',
    is_default_tab = true
WHERE id = 'breakout_surge';
```

### D. ScanView.tsx Old Preset ID References
After the DB row is renamed (item C above):
- Line 957: `if (presetId === 'breakout_surge')` → change to `'breakout_surge_daily'`
- Line 983: `presetId="breakout_surge"` → change to `'breakout_surge_daily'`

### E. Scanner Testing
With the CORS fix in place, test in dev:
1. `fresh_breakout` scan — should return results (was CORS-blocked)
2. `breakout_surge_daily` scan — verify score_5d/score_22d now show non-null values
3. Column picker — verify optional cols are hidden on first load for each preset

---

## Key Files Reference

| File | What changed |
|------|-------------|
| `App/frontend/vite.config.ts` | Vite proxy for /db and /pipeline-api; VITE_PIPELINE_API_URL override in dev |
| `App/frontend/src/services/postgrest.ts` | Uses /db base URL in dev |
| `App/frontend/src/components/domain/ScanTable.tsx` | hiddenCols init fix, storage key |
| `App/frontend/src/views/ScanView.tsx` | key={presetId} on ScanTable |
| `App/frontend/src/services/scanEngine.ts` | scanBreakoutSurgeDaily: date check removed, client-side score computation, 100-day window |
