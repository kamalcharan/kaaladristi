---
name: dristiQ-rule-engine
description: >
  Encodes the DristiQ Rule Engine architecture. Use this skill whenever working on
  km_astro_rule_master, km_rule_signals, km_rule_confidence, km_rule_confidence_yearly,
  km_rule_transits, rule_discovery.py, RuleList.tsx, RuleDetail.tsx, or any
  /api/discovery/* and /api/confidence/* endpoints. Triggers on: adding a new rule type,
  modifying discovery logic, debugging why a rule fires or doesn't fire, computing
  confidence scores, building rule-related UI, or any question about how astro rules
  are stored, discovered, or scored.
---

# DristiQ Rule Engine

The Rule Engine is a pipeline that takes timeless Vedic astro-market rules, discovers
historical instances from panchang/planetary data, and computes backtested confidence scores.

---

## Architecture

```
km_astro_rule_master
  (216 canonical rules)
         ↓
  rule_discovery.py
  (reads rules, queries panchang/planetary tables, inserts matches)
         ↓
  km_rule_signals
  (one row per rule × date match)
         ↓
  confidence compute
  (groups signals into transits, scores win rate)
         ↓
  km_rule_confidence + km_rule_confidence_yearly + km_rule_transits
```

---

## Table Schemas

### km_astro_rule_master
Core columns (M047): `id`, `rule_code`, `rule_type`, `display_name`, `planet_1`, `planet_2`,
`sign`, `nakshatra`, `tithi`, `vara`, `planet_state`, `base_bias`, `applicability` (JSONB),
`probability`, `is_active`

Extended columns (M062): `scope` (JSONB), `outcome`, `probability_label`, `data_source`,
`is_deleted`, `conditions` (JSONB), `updated_at`

**Critical:** `conditions` JSONB drives all discovery logic. Its keys vary by `rule_type`.
`data_source = 'available'` means the rule can be discovered. `is_deleted = false` is the
soft-delete flag — never hard-delete rules.

### km_rule_signals
`id`, `date`, `rule_id`, `signal`, `strength` (INT default 1), `details`,
`actual_market_return` (NUMERIC), `matched` (BOOLEAN), `conditions_snapshot` (JSONB),
`partial_day` (BOOLEAN)
UNIQUE constraint: `(date, rule_id)`

`conditions_snapshot` is a JSONB dict capturing the panchang/planetary state at the time
of the match. Keys vary by rule_type (see Rule Types section below).

### km_rule_confidence
`rule_id` (PK), `total_occurrences`, `matched_count`, `confidence_score`, `last_computed_at`,
`avg_return_all`, `avg_return_matched`, `avg_return_unmatched`, `best_return`, `worst_return`,
`avg_duration_days`, `historical_transits`

### km_rule_confidence_yearly
PK: `(rule_id, year)`. Columns: `transits`, `matched`, `win_pct`, `avg_return`, `avg_duration`

### km_rule_transits (M064)
Contiguous transit periods per rule. Columns: `rule_id`, `start_date`, `end_date`,
`duration_days`, `nifty_return_pct`, `matched`

---

## Rule Types and conditions JSONB Keys

| rule_type | Discovery function | Key conditions fields |
|---|---|---|
| `nakshatra_vara` | `discover_nakshatra_vara` | `vara`, `nakshatra_lord`, `day_lord_equals_nakshatra_lord` |
| `planet_transit` | `discover_planet_in_nakshatra` or `discover_relative_position` | `planet`, `nakshatra`, `same_sign`, `position`, `aspect_type` |
| `planet_state` | `discover_planet_state` | `planet`, `condition` (combust/retrograde/vargottam/reducing_speed), `planets_retrograde`, `planets_alone` |
| `planet_conjunction` | `discover_conjunction` | `planet_1`, `planet_2`, `aspect_type` |
| `vedh` | `discover_vedh` | `planet`, `vedh_of`, `mutual_vedh` |
| `tithi_alone` | `discover_tithi` | `tithi_base`, `paksha`, `is_ekadashi`, `is_purnima` |
| `compound` | panchak / yog / seasonal / sign routers | `panchak_day`, `yoga`, `event`, `sign` |
| `eclipse` | `discover_eclipse` | `eclipse_type` (lunar/solar) |

---

## conditions_snapshot Keys by Rule Type

Snapshot is written at discovery time and frozen — it's the historical evidence record.

`nakshatra_vara`: `{vara, nakshatra_lord, nakshatra, tithi, paksha, session?, changeover_time?, is_split_day?}`

Other rule types: keys follow the same fields as `conditions` JSONB in the rule definition,
plus any panchang/planetary state captured at match time.

---

## Discovery Script

**File:** `App/backend/scripts/rule_discovery.py`

- Reads all rules where `is_active=TRUE AND data_source='available'`
- For each rule, calls the typed discovery function based on `rule_type`
- Inserts into `km_rule_signals` with `ON CONFLICT DO NOTHING` (idempotent)
- Uses `KD_DB_PASSWORD` env var (not `DB_PRIMARY`); hardcoded host `187.127.136.65`

```bash
# Full history run
KD_DB_PASSWORD=... python rule_discovery.py

# Single year (test)
KD_DB_PASSWORD=... python rule_discovery.py 2026

# Quick test wrapper
python rule_discovery_test.py
```

**INSERT shape per signal:**
```python
(date, rule['id'], rule['outcome'], strength, rule['display_name'], json.dumps(snapshot))
# maps to: (date, rule_id, signal, strength, details, conditions_snapshot)
```

---

## API Endpoints

All in `pipeline2_api.py`:

| Endpoint | Purpose |
|---|---|
| `POST /api/discovery/run-all` | Full discovery run |
| `POST /api/discovery/run-missing` | Rules with no signals only |
| `POST /api/discovery/run-rule/{rule_id}` | Single rule |
| `GET /api/discovery/status` | Progress of current run |
| `GET /api/discovery/signal-counts` | Stats |
| `GET /api/discovery/transit-counts` | Stats |
| `POST /api/confidence/compute` | Compute km_rule_confidence from transits |
| `GET /api/confidence/yearly/{rule_id}` | Returns `[{year, transits, matched, win_pct, avg_return, avg_duration}]` ordered DESC |

---

## Frontend

**Files:** `src/pages/RuleEngine/RuleList.tsx`, `RuleDetail.tsx`, `RuleFormModal.tsx`
**Services:** `ruleService.ts` (CRUD via PostgREST), `discoveryService.ts` (calls discovery/confidence endpoints)

- List: fetches `km_astro_rule_master` where `is_deleted=false AND is_active=true`
- Detail: fetches rule + `km_rule_confidence` + last 50 `km_rule_signals` + yearly breakdown
- `DiscoveryPanel` in RuleList allows triggering discovery runs from the UI

---

## Key Rules

- Never hard-delete rules — use `is_deleted = true`
- `data_source = 'available'` is required for discovery to process a rule
- Discovery is idempotent — safe to re-run for any date range
- `conditions_snapshot` is historical evidence — never mutate after insert
- Always use `ON CONFLICT DO NOTHING` in discovery inserts
