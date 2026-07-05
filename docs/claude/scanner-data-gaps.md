# Scanner Data Gaps — Future Work

> Moved verbatim from CLAUDE.md.

## Scanner Data Gaps — Future Work
### mcap_cr Coverage
- NSE equities: ~95% coverage (essentially complete)
- BSE equities: ~11.6% coverage (structural gap — 5,750 of 6,504 missing)
- Overall across full universe: ~26.8%
- Root cause: mcap_cr populated primarily for NSE-listed stocks in km_equity_symbols
- Bug fixed: buildStockFromEod() now reads sym.mcap_cr ?? null (was hardcoded null)
- Display: ManipulationWatch (SuspectCard component) never rendered mcap_cr — no display change needed
- Stage/standard scanners that DO show mcap_cr use NSE-preferred universe (~95% coverage) — acceptable
- Future: BSE mcap_cr backfill via data provider

### ret_5d, ret_22d, ret_66d
- Populated: scanConvictionFlow ✓, scanBreakoutSurge
  (ret_5d, ret_22d only — ret_66d missing) ✓
- NOT populated: all direct-query stage scanners
  (stage_2_leaders, stage_2_watch, vani_opportunity,
  stage_4_leaders, stage_3_watch, vani_exit_watch)
- Reason: requires eodHistory[] multi-bar lookback
  which direct-query scanners don't fetch
- Fix: add history fetch to direct-query scanners
  OR use materialized views (Option C post-beta)

### rel_5d/22d/66d_n50, rel_5d/22d/66d_n500
- Populated: NONE — hardcoded null at every call site
  in scanEngine.ts (both bundle and direct-query scanners)
- Sprint 6 fix: removed rel_5d_n50/rel_5d_n500 from
  OPTIONAL_COLS in ScanTable.tsx so column picker no
  longer offers them. They will be re-enabled when
  the rel_* pipeline is built.
- Fix: compute from eodHistory[] against index benchmarks
  OR use a materialized view (Option C post-beta)

### avg_amt_5d, avg_amt_22d
- Populated: scanConvictionFlow ✓,
  fetchStage2Leaders ✓, fetchStage4Leaders ✓
- NOT populated: fetchStage3Watch, fetchVaNiExitWatch,
  fetchStage2Watch, fetchVaNiOpportunity,
  all other bundle scans
- Fix: add avg_amt columns to DB fetch for missing
  direct-query scanners (migration 095 already added
  the DB columns)

### ret_66d missing from breakout_surge
- scanBreakoutSurge computes ret_5d and ret_22d
  from eodHistory but stops at 22 bars
- ret_66d not computed — extend history walk to 66 bars

### Column picker
- Built in Sprint 5 (C29) as gear popover in ScanTable.tsx toolbar
- Uses useState<Set<string>> for hidden optional columns
- Per-preset localStorage persistence via `scan_cols:{presetId}` key

### Materialized Views / Scanner Cache
- Current approach: PostgREST direct queries,
  client-side computation (Option A)
- Post-beta: move to kd_scan_results table with
  nightly pipeline writes (Option C)
- Trigger: when user count grows beyond beta

### Breakout Event Detection
- breakout_level and pct_from_breakout are computed
  client-side only (20-bar rolling high)
- breakout_price, breakout_date, ageing do not exist
- Backlog B55: build breakout event detection pipeline
  to store true breakout price, date, and ageing in DB

---
