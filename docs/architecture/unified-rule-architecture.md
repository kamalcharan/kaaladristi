# Unified Rule Architecture — Design Direction

**Status:** Deferred — post-cashflow  
**Last updated:** June 2026  
**Prerequisite session:** Separate design session required before implementation

---

## Problem Statement

Today the platform has two parallel systems:

| System | Rules handled | Data source | Output |
|--------|--------------|-------------|--------|
| Discovery (`rule_discovery.py`) | Astro rules only | `km_daily_panchang`, `km_planetary_positions`, `km_planetary_aspects` | `km_rule_signals`, `km_rule_transits` |
| Correlation engine (`/api/correlation/compute`) | Astro + technical (hardcoded) | `km_rule_transits` for astro, `km_index_eod` directly for technical | On-demand response only |

Technical indicators (EMA 20, SMA 50, RSI 14 etc.) are hardcoded inside the correlation 
engine. They are not first-class rules. They cannot be discovered, backtested, or cached 
the same way astro rules are.

This creates two maintenance paths, two cache strategies, and a ceiling on what 
correlation can express.

---

## Target Architecture

**One rule registry. One discovery pipeline. One correlation engine.**

All overlays — astro, technical, compound — are rules. A rule is anything that:
1. Has a defined condition
2. Can be evaluated against historical data to produce dated signal instances
3. Has a start/end date range (transit) or a point-in-time signal

### Rule Types (target)

| rule_type | Example | Data source for discovery |
|-----------|---------|--------------------------|
| `nakshatra_vara` | Sun in Ashwini on Monday | `km_daily_panchang` |
| `planet_transit` | Mars in Aries | `km_planetary_positions` |
| `planet_state` | Mercury retrograde | `km_planetary_positions` |
| `planet_conjunction` | Saturn conjunct Mars | `km_planetary_aspects` |
| `tithi_alone` | Ekadashi | `km_daily_panchang` |
| `compound` | Panchak, Yoga, Seasonal | `km_daily_panchang` |
| `eclipse` | Solar/Lunar eclipse | `km_planetary_positions` |
| `tech_rule` ← NEW | EMA 20 crossover SMA 50 | `km_index_eod` |
| `tech_state` ← NEW | RSI 14 above 60 | `km_index_eod` |

### What changes

1. `km_astro_rule_master` renamed or extended to `km_rule_master` — accepts all rule types
2. `rule_discovery.py` gains handlers for `tech_rule` and `tech_state` — reads `km_index_eod`
3. Technical rules produce rows in `km_rule_signals` and `km_rule_transits` like astro rules
4. `/api/correlation/compute` drops all hardcoded indicator logic — both items resolved via `km_rule_transits`
5. VaNi cache key and prompt construction become uniform — no special cases for indicator vs astro rule

---

## What This Unlocks

- Correlation between any two rules regardless of type (astro+astro, tech+tech, astro+tech)
- Backtesting of technical rules with the same confidence scoring as astro rules
- Compound rules: "Mercury Combust AND EMA 20 above SMA 50" promoted from correlation 
  finding to first-class rule with full discovery history
- Indicator behaviour analysis: how is EMA 20 acting 5 days before/after Mercury Combust
- Morning brief can surface tech+astro confluences with the same pipeline as pure astro

---

## Complexity Assessment

### Phase A — Technical rules in registry + discovery
- Add `tech_rule`, `tech_state` to rule_type enum
- Write discovery handlers that read `km_index_eod` for crossover/threshold events
- Produce `km_rule_signals` + `km_rule_transits` rows for technical rules
- **Risk:** Discovery script complexity increases significantly — mixing panchang 
  and EOD queries. Needs careful isolation to avoid breaking existing astro pipeline.
- **Estimate:** 2-3 sessions

### Phase B — Unified correlation engine
- Remove hardcoded indicator logic from `/api/correlation/compute`
- Both items resolved purely via `km_rule_transits`
- Correlation cache key becomes uniform
- **Prerequisite:** Phase A complete with reliable transit data for tech rules
- **Risk:** Medium — correlation engine needs rewrite but scope is bounded
- **Estimate:** 1-2 sessions after Phase A

---

## Preconditions Before Starting

- [ ] Post-cashflow — do not start during revenue sprint
- [ ] `km_rule_master` schema design session (rename vs extend `km_astro_rule_master`)
- [ ] Decide whether existing astro rule codes need migration
- [ ] KVM4 upgrade complete (discovery over full EOD history is compute-intensive)
- [ ] Scanner session complete (scanners may feed into tech_rule definitions)

---

## Current State to Preserve

Until this is built, the following hardcoded mappings in the correlation engine 
must be maintained:

| Indicator ID | Data source | Column |
|-------------|-------------|--------|
| `ema_20` | `km_index_eod` | `ema_20` |
| `sma_50` | `km_index_eod` | `sma_50` |
| `rsi_14` | `km_index_eod` | `rsi_14` |
| `magic_rs` | `km_index_eod` | `magic_rs` |
| `order_flow` | `km_index_eod` | `flow_type` |
| `smart_money` | `km_index_eod` | `sniper_inst` |
| `breadth_roc` | `km_breadth_roc` | `roc_value` |
| `supertrend` | `km_index_eod` | `supertrend_dir` |

*Do not remove these until Phase B is complete and verified.*
