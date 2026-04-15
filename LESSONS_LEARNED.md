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

## RLS Policy Roles Must Match Application Roles (2026-04-15)

RLS policies must list every role the application uses, not just `anon` and `authenticated`. A permissive policy with `qual: true` only permits the roles named in its `TO` clause. If the Pipeline API connects as `kd_app` (or any custom role) and the policy lists only `anon, authenticated`, queries return empty arrays without errors. PostgREST returns `200 OK` with `[]`, masking the issue.

- **Root cause**: `km_industry_eod` had RLS enabled with policies for `authenticated` and `anon`. The health check code in Pipeline API used `db._conn()` (PgClient) which connects via DATABASE_URL. If that role isn't `authenticated` or `anon`, RLS silently returns 0 rows.
- **The silent failure is the worst part**: No error, no log, no exception. Just empty arrays that look like "no data" instead of "access denied."
- **Fix**: Computed aggregate tables (km_industry_eod, km_market_breadth, km_breadth_roc) should not have RLS at all — they contain no user-specific data. RLS on pipeline-computed tables creates permission bugs with zero security benefit.
- **Rule**: Always cross-check `pg_policies.roles` against the actual role used by every application component (PostgREST, Pipeline API, Worker). After any DDL change, run `NOTIFY pgrst, 'reload schema'`.

## Scan Filter Calibration: Strict Signals vs Broader Confluence (2026-04-15)

Function correctness ≠ scan usefulness. When a function produces a rare signal (like Wyckoff accumulation), filtering scans on that signal alone produces empty results. Combine strict signals with broader confluence patterns using OR logic. Ask: "what does a trader recognize as this state?" not "what does the textbook define as this state?"

- `accum_distrib = 'ACCUMULATION'` is a strict Wyckoff signal — only 1-5% of stocks meet it on any given day. Filtering exclusively on it returned 4 results out of ~1,380 equities.
- The OR path adds broader bullish confluence (above SMA-150, Strong/Mild Bull RS zone, bullish flow type, RVOL > 1.5) which captures the same intent with a wider net.
- Same pattern applies to `accum_distrib = 'DISTRIBUTION'` on the bearish side.

## KaalaDristi Voice: Observational, Never Directive (2026-04-15)

KaalaDristi vocabulary is observational, never directive. Surface conditions, don't issue commands. "Strength Confluence" describes a state. "Power Buy" issues a trade signal. The first respects the trader's judgment; the second usurps it.

- "Power Buy Setups" → "Strength Confluence"
- "Power Sell Setups" → "Weakness Confluence"
- Internal function names (`scanPowerBuy`, `power_buy` ID) stay as-is — only user-facing labels changed.

## Data-Driven Threshold Calibration (2026-04-15)

Threshold calibration must be data-driven. A theoretical threshold (`sniper_inst > 50` assuming 0-100 scale) failed silently when actual data ranged 0-40. Always check actual value distribution in production data before setting numeric thresholds.

- `sniper_inst` ranges 0-40 in `km_equity_eod` (avg ~5.4 as of Apr 2026).
- Threshold 20 = top ~8% of the universe. The previous threshold of 50 was theoretical and never triggered.
- **Rule**: Before setting any numeric filter threshold, run `SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY col) FROM table` to understand the actual distribution.

## Safety Features vs Opportunity Features (2026-04-15)

Pump/dump detection is a safety feature, not an opportunity feature. It must scan the entire universe regardless of industry rotation, because manipulation respects no industry boundary. It must explain itself in plain English ("Why Flagged" column), because surfacing a suspect stock without context is dangerous — a trader might mistake the signal for an opportunity. And it must use observational, educational language ("Manipulation Watch", "suspects"), not directive language ("Avoid these"), to maintain user agency while still warning clearly.

- **No industry gate**: Unlike Scanner scans, manipulation filters scan all equities. Industry rotation is irrelevant to operator pumps.
- **Why-flagged tags**: Every suspect row shows which conditions triggered it in plain English: "RSS overbought (78) + Spread broken (-2.3K) + Short covering + Volume diverging up".
- **Separate navigation**: Manipulation Watch is a top-level page, not a Scanner tab. Mixing safety and opportunity features risks traders treating threats as opportunities.

## Visual Treatment Carries Part of the Message (2026-04-15)

A safety feature styled identically to opportunity features defeats its purpose. Distinct colors (amber/red), warning icons, and visual separation from neutral content are required, not decorative.

- Pump suspect rows: amber background tint + amber left border + warning icon + amber symbol text.
- Dump suspect rows: red background tint + red left border + warning icon + red symbol text.
- Page header: amber/red gradient accent bar to visually distinguish from Scanner's neutral palette.
- **Rule**: When a feature carries a different risk message than its neighbors, the visual treatment must make that difference obvious within 1 second of page load.
