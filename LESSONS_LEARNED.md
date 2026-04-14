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
