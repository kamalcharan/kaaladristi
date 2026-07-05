# Database Tables — Extended Inventory

> Moved verbatim from CLAUDE.md. Core tables + deprecated warnings remain there.

Latest migration: **095** (`km_migration_095_delivery_columns.sql`)
| Table | Description |
|---|---|
| `km_market_breadth` | EMA-based breadth score (migration 020) |
| `km_breadth_roc` | ROC momentum breadth oscillator (migration 021) |
| `km_index_constituents` | Index→Equity mapping with sector/weight (migration 022, FK → `km_index_symbols`) |
| `km_industry_eod` | Daily industry-level aggregation from equity EOD (migration 033, PK: trade_date + industry) |
| `km_astro_rule_master` | Timeless Vedic astro-market rule registry (migration 047); extended by migration 062 with `conditions` JSONB, `scope`, `outcome`, `probability_label`, `data_source`, `is_deleted` |
| `km_astro_calendar_2026` | 2026 event instances with market_impact (migration 048) |
| `km_astro_daily_signal` | Computed net astro signal per date (migration 049) |
| `km_daily_panchang` | Daily Vedic panchang (vara, nakshatra, tithi, yoga, paksha, dlnl_match, is_ekadashi, is_purnima, hemisphere_event) — source for rule discovery |
| `km_planetary_positions` | Daily planet positions (planet, longitude, sign_name, nakshatra_name, speed, retrograde, combust, vargottam) |
| `km_planetary_aspects` | Daily planetary aspects (planet_1, planet_2, aspect_type, orb, exact) |
| `km_rule_signals` | Discovered rule signal instances (date, rule_id, signal, strength, details, conditions_snapshot, actual_market_return, matched) |
| `km_rule_confidence` | Per-rule backtested confidence (rule_id PK, total_occurrences, matched_count, confidence_score) |
| `km_rule_transits` | Contiguous transit periods per rule; start_date, end_date, duration_days, nifty_return_pct, matched (migration 064) |
| `km_rule_confidence_yearly` | Per-year win-rate breakdown per rule; transits, matched, win_pct, avg_return, avg_duration (migration 064) |
| `km_astro_events` | Per-day astro event log; event_type, planet, from_value, to_value, severity (migration 071) |
| `km_candidate_rules` | Proposed-rule staging area before promotion to km_astro_rule_master; 12 rows (migration 071) |
| `km_daily_snapshots` | Per-day per-symbol JSONB snapshot store; one row per (date, symbol) (migration 071) |
| `km_factor_correlation_stats` | Factor × index volatility/return correlation stats; 29 rows (migration 071) |
| `km_indicator_compute_log` | Pipeline run log for indicator compute jobs; tracks symbols_count, rows_computed, status (migration 071) |
| `km_moon_intraday` | Intraday moon position 09:15–15:30 IST; longitude, nakshatra, gandanta flag; 59,900 rows (migration 071) |
| `km_risk_scores` | Risk Engine 4-dim composite output per (date, symbol); structural, momentum, volatility, deception, regime (migration 071) |
| `km_rules` | Legacy/technical rules registry (18 rows) — distinct from km_astro_rule_master; pre-migration discipline (migration 071) |
| `km_sector_sensitivity` | Per factor_type × sector sensitivity pct (migration 071) |
| `km_technical_signals` | Technical signal instances per (asset_type, symbol_id, trade_date, signal_type) — schema only, never populated (migration 071) |
| `km_score_calibration` | Score normalizer registry; one row per score_name, stores divisor/percentile for Plan Score etc. (migration 072) |
| `kd_scan_presets` | Scanner preset definitions — id, name, description, tooltip, sort_order, result_limit. One row per scan. Source of truth for `fetchScanPresets()`. Mutations via direct SQL migration only. |
| `km_equity_eod` (extended) | New columns added migration 094/095: `w52_high`, `w52_low`, `lifetime_high`, `avg_amt_5d`, `avg_amt_22d`, `delivery_surge_x`, `d30_pct_chng`, `d365_pct_chng`. All populated by `compute_rolling_metrics_for_date()` in pipeline step 6g. |
| `km_equity_weekly` / `km_equity_monthly` | Also carry `lifetime_high` column (migration 094). |

### Inactive Indices

| Index | Why Inactive |
|---|---|
| `SHANTHALA` | Not a real NSE index. Mark `is_active = false`. 502 equities tagged with it in `index_names[]` — to be cleaned. |

### Missing Indices — To Be Added Later

| Index | Category | Notes |
|---|---|---|
| `NIFTY SME EMERGE` | thematic market index | 503 stocks in SeedData CSV. Not yet in `km_index_symbols` or `km_equity_symbols.index_names[]`. Activate when SME data pipeline is ready. |

---
