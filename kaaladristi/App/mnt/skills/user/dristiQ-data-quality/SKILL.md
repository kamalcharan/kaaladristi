---
name: dristiQ-data-quality
description: >
  Encodes all known data quality issues in DristiQ's database and the views/guards that
  address them. Use this skill before any query that touches km_equity_eod, km_index_eod,
  km_industry_eod, or any volume/RVOL-dependent signal. Triggers on: writing SQL that
  joins equity or index data, computing RVOL-dependent signals, working on industry
  composites, debugging anomalous flow signals, or any question about data correctness,
  deduplication, or exclusion logic.
---

# DristiQ Data Quality

Three known structural issues in the database. Every query that touches market data
must account for these. Never work around them silently — surface them with context.

---

## Issue 1 — Volume Scale Discontinuity (km_index_eod)

**Detected:** 2026-04-13
**Affected:** `index_id = 1` (NIFTY 50), possibly other indices
**Symptom:** Pre-2026-03-25 volume ~500K/day; post-2026-03-25 ~400M/day (800x scale jump)
**Impact:** RVOL near-zero for all pre-discontinuity dates → false `LOW_VOLUME` and
`VACUUM_DOWN` signals for the entire pre-March 2026 history.

**Current guard (soft workaround in `compute_engine.py`):**
```python
# RVOL vacuum guard
condition: 5-bar average RVOL < 0.5 AND |5-bar price move| > 1%
result: VACUUM_UP or VACUUM_DOWN written to vacuum_flag
```

**Accumulation/Distribution guard:**
```python
condition: RVOL >= 3.0
ACCUM: price < SMA_150 AND (momentum bullish OR RS bullish)
DISTRIB: price > SMA_150 AND (momentum bearish OR RS bearish)
```

**Migration M046:** Does NOT exist — listed as planned but never created.
The volume discontinuity fix has not been executed at the DB level.
The guards above are the only protection currently active.

**Action required before RVOL-dependent features:**
Create M073+ migration that either normalises the pre-March 2026 volumes
or adds a `volume_quality_flag` column to mark affected rows.
Until then, any feature relying on RVOL for pre-March 2026 data is unreliable.

---

## Issue 2 — SHANTHALA Phantom Index

**Problem:** `SHANTHALA` appears in `km_index_symbols` but is not a real NSE index.
502 equities have `SHANTHALA` in their `index_names[]` array in `km_equity_symbols`.

**Status in CLAUDE.md:** Marked `is_active = false` — but the 502 equity tags have
NOT been cleaned yet.

**Impact:** Any query that groups equities by index membership will over-count or
misclassify 502 equities if it doesn't filter out inactive indices.

**Safe query pattern:**
```sql
-- Always join through km_index_symbols and filter is_active
SELECT e.* FROM km_equity_symbols e
JOIN km_index_symbols i ON i.name = ANY(e.index_names)
WHERE i.is_active = true
```

**Do not use:** Raw `index_names[]` array filtering without the `is_active` join.

---

## Issue 3 — Dual-Listed Equity Over-counting

**Problem:** ~1,628 equities are listed on both NSE and BSE.
Without deduplication, industry aggregates and scan results double-count these stocks.

**Fix:** `v_equity_eod_deduped` view (Migration M034b)

**View logic:**
```sql
-- Deduplicates by COALESCE(isin, symbol || '_' || exchange) + trade_date
-- Preference order: NSE > BSE > other
-- Filters: is_active = true, industry IS NOT NULL
-- Excludes: 'Shell Companies'
-- Includes: all flow/sniper/magic_rs/rvol columns
```

**Rule:** `v_equity_eod_deduped` is the canonical source for any computation that
aggregates across equities. Never use `km_equity_eod` directly for cross-stock queries.

Functions that correctly use the deduped view:
- `compute_all_industry_composites()` ✓
- `compute_roc()` in `compute_breadth_roc.py` ✓

Functions to audit if adding new cross-stock computations:
- Any new scan engine additions
- Any new breadth-style computations

---

## Deprecated Tables — Never Use

| Table | Why deprecated | Use instead |
|---|---|---|
| `km_index_master` | 13 rows, redundant subset of `km_index_symbols` (93) | `km_index_symbols` |
| `km_index_composition` | FK to km_index_master; all sector/weight_pct NULL | `km_equity_symbols.index_names[]` + `km_index_symbols` join |

`masterData.ts` in frontend still references these legacy tables — migration to
correct tables is pending. Do not add new code that reads these tables.

---

## Data Quality in Correlation Views (Phase 4)

Every correlation view must show a data quality bar:
- Overall coverage % and exact day counts
- Date range covered
- Per-stat quality when a bucket/zone/state has lower coverage than global

VaNi inference must append: "Note: [n] instances excluded due to [reason] —
interpret with appropriate caution" when any stat's quality < 95%.

Known issues to surface in correlation views:
- RVOL-dependent signals (RVOL, TVOL, flow_type) unreliable before March 2026
- SHANTHALA-tagged equities in cross-stock queries
- Dual-listed equities if deduped view not used

---

## Safe Query Checklist

Before writing any SQL that touches market data, verify:

- [ ] Using `v_equity_eod_deduped` for cross-stock queries (not raw `km_equity_eod`)
- [ ] Filtering `km_index_symbols.is_active = true` when joining by index membership
- [ ] RVOL-dependent signals scoped to post-March 2026 OR acknowledged as unreliable for earlier dates
- [ ] Not referencing `km_index_master` or `km_index_composition`
