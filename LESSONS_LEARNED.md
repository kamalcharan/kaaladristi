# Lessons Learned

## Volume Scale Discontinuity (2026-04-13)

Always verify RVOL and TVOL consistency before trusting flow signals. When they diverge significantly (RVOL near-zero, TVOL normal) suspect a volume scale discontinuity in source data.

- **RVOL** uses a 50-day average — long enough to span a data source change boundary
- **TVOL** uses a 20-day average — short enough to stay within one scale period
- When RVOL < 0.1 and TVOL > 0.5 on the same row, the RVOL is unreliable
- Symptoms: false `LOW_VOLUME` flow classifications, false `VACUUM_DOWN` flags
- Guard added in migration 031: NULL out RVOL-dependent signals when scale mismatch detected

## Industry Aggregation Design (2026-04-14)

When building cross-stock aggregations (km_industry_eod), key lessons:

- **DOT signals (SVD/SBD/SYD) require prev_close**: Use LAG() window function over equity_id partition, not a self-join. This naturally handles per-stock ordering.
- **Dominant flow_type as RVOL-weighted mode**: Use `SUM(COALESCE(rvol, 1)) GROUP BY flow_type` then `DISTINCT ON` ordered by weight DESC. COALESCE to 1 (not 0) ensures stocks with NULL RVOL still count.
- **"Shell Companies" must be filtered**: The NSE industry classification includes "Shell Companies" with very few stocks and meaningless signals. Always exclude from aggregation.
- **PostgREST boolean filters**: Use `is.true`/`is.false` (not `eq.true`) for PostgreSQL boolean columns via PostgREST. The QueryBuilder needed an `is()` method for this.
- **Scan engine data volume**: ~1,380 equities × 20 dates ≈ 27K rows is fine to fetch and filter client-side in TypeScript. No need for server-side RPC for MVP scan logic.
- **Duplicate type declarations**: TypeScript allows `interface` merging across declarations, but conflicting property types (e.g., `category: string` vs `category: string | null`) cause TS2717. Always check for prior declarations before adding new interface definitions.

## Silent NULL Columns (2026-04-15)

A column can pass health checks (row exists, no errors) but be NULL — breaking every downstream feature that depends on it. `magic_rs_zone` was NULL for all equities because `compute_all_magic_rs` had an `IF p_table = 'km_index_eod'` guard that silently skipped equities. The health grid showed green (rows exist), scans returned zero results (no zone data), and the industry rotation panel showed empty columns.

- **Root cause**: The benchmark auto-detect assumed `p_table` = index table. For equities, the NIFTY 500 benchmark lives in `km_index_eod`, not `km_equity_eod`. The function returned 0 with no error.
- **Fix**: Migration 034 added `p_bench_table`/`p_bench_id_col` params to `compute_magic_rs_batch` so equity MagicRS loads benchmark from `km_index_eod` while writing to `km_equity_eod`.
- **Lesson**: Any RPC that works for one table type but silently no-ops for another is a landmine. Always test with both index AND equity tables after adding a new RPC.

## Dual-Listing Deduplication (2026-04-15)

`km_equity_symbols` has ~7,884 rows but only ~6,256 distinct ISINs. 1,628 stocks are dual-listed (one NSE row, one BSE row with different `id`). Without deduplication, industry composites double-count these stocks — inflating `stock_count` by ~21%.

Worse: when BSE data is missing (different holiday calendar, delayed data), the stock universe shrinks unpredictably. A date with 4,900 stocks yesterday might have 880 today. Ranks computed on different-sized universes are not comparable, making rotation detection (rank change across dates) meaningless.

- **Fix**: `v_equity_eod_deduped` view uses `DISTINCT ON (isin, trade_date)` with `ORDER BY exchange CASE NSE=1, BSE=2` to keep one row per company per date, preferring NSE.
- **Lesson**: Any cross-date aggregation (ranks, trends, rotation) requires a stable stock universe. If the universe size varies by >5% between dates, the comparison is invalid.

## Exchange Universe Consistency (2026-04-15)

Industry composites must use a stable stock universe across dates. Per-exchange as-of tracking (`nse_as_of_date`, `bse_as_of_date`, `nse_stock_count`, `bse_stock_count`) was added to `km_industry_eod` so the UI can detect and warn when BSE data is stale. The dashboard header shows `NSE 13 Apr · BSE 12 Apr (delayed)` when exchanges are out of sync.

- **Pattern**: For any table that aggregates across exchanges, always track which exchange contributed data and when. Don't assume both exchanges have the same trading calendar.

## Coverage Thresholds Prevent Silent Failures (2026-04-15)

Pipeline steps that complete without errors but produce incomplete output are the most dangerous bugs — they pass health checks but break downstream features. The magic_rs NULL incident: the RPC returned 0 rows without raising an error, the step was marked "completed", the health grid showed green, but every downstream feature (industry rotation, scans) was broken.

- **Fix**: Migration 035 adds `rows_expected`, `coverage_pct` to `km_pipeline_runs`. Each step now records expected vs actual rows. Coverage rules in `config/pipeline_steps.py` define thresholds (healthy/warning/failure) per step. Sparse signals (e.g. `accum_distrib` at 1-5%) are marked `is_sparse` to avoid false alarms.
- **Pattern**: Every computed column must have a coverage rule. Anything not on the sparse exception list that drops below threshold = immediate red alert. "Completed with 0 rows" should be classified as `partial`, not `success`.
