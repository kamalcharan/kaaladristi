# Industry Rotation MVP — Full Reference

> Moved verbatim from CLAUDE.md.

## Industry Rotation MVP (Sprint: 2026-04-14)
### km_industry_eod (Migration 033)

Per-industry per-trade_date aggregation from `km_equity_eod JOIN km_equity_symbols ON industry`.
PK: `(trade_date, industry)`. Filter: stock_count >= 5, excludes "Shell Companies".

Columns: `stock_count`, `avg_magic_rs`, `pct_strong_bull`, `pct_strong_bear`,
`pct_accumulation`, `pct_distribution`, `dominant_flow_type`, `avg_sniper_inst`,
`pct_with_recent_svd`, `pct_with_recent_sbd`, `pct_with_recent_syd`,
`pct_volume_div_up`, `pct_volume_div_down`,
`industry_rank`.

**Pipeline integration**: Already wired in `daily_pipeline.py`. Execution order:
1. `compute_all_pending_indicators()` (indicators)
2. `compute_all_magic_rs('km_index_eod', 'index_id')` (index MagicRS — existing)
3. `compute_all_magic_rs('km_equity_eod', 'equity_id')` (equity MagicRS — migration 034)
4. `compute_all_flow_intelligence()` (flow intelligence)
5. `compute_all_industry_composites(trade_date)` (industry composites)

**Deduplication**: `v_equity_eod_deduped` view (migration 034) deduplicates dual-listed
stocks by ISIN, preferring NSE over BSE. ~1,628 dual-listed stocks reduced to one row
per company per date. The compute function uses this view.

**Per-exchange tracking**: `nse_as_of_date`, `bse_as_of_date`, `nse_stock_count`,
`bse_stock_count` columns track which exchange data contributed to each row.

### Industry Rotation Panel

Dashboard component showing 3-column rotation view:
- **Rotating In**: rank improved 5+ in last 5 trading days
- **Leading**: top quartile by avg_magic_rs
- **Rotating Out**: rank dropped 5+ in last 5 trading days

Tap industry → expands inline showing top 10 stocks by magic_rs.

Lookback constant: `INDUSTRY_ROTATION_LOOKBACK_DAYS = 5` (V2: user-toggleable).

### Scanner (`/scan`)

Six preset scans combining industry rotation + stock-level signals:
1. **Power Buy** — strong stocks in rotating-in/leading industries
2. **Power Sell** — weak stocks in rotating-out/lagging industries
3. **Smart Money Loading** — high accumulation + rising sniper_inst + RSS recovery
4. **Fresh Breakouts** — 20-day highs + RVOL > 2 in top-quartile industries
5. **Quiet Accumulation** — contrarian: non-top industries with rising accumulation
6. **Distribution Warnings** — ex-Strong Bull degrading + SYD/volume divergence

All scan logic in `services/scanEngine.ts` — pure TypeScript, no backend RPC.
Tap stock row → modal detail card (price, RS, flow, dots).

### KaalaDristi Vocabulary

| Internal Term | Display Label |
|---|---|
| `sniper_inst` | Smart Money |
| SBD signal | Accumulation Signature |
| SVD signal | Strong Volume Drive / Volume Drive |
| SYD signal | Distribution Signal |

---
