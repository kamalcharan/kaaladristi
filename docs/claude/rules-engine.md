# Rules Engine, Bayer Rules & Astro Market-Book — Full Reference

> Moved verbatim from CLAUDE.md.

## Rules Engine
### Architecture

```
km_astro_rule_master  →  scripts/rule_discovery.py  →  km_rule_signals
                                                              ↓
                                                     km_rule_confidence  (backtesting)
```

**Rule discovery** (`App/backend/scripts/rule_discovery.py`):
- Reads all `is_active=TRUE AND data_source='available'` rules from `km_astro_rule_master`
- Each rule has a `rule_type` and a `conditions` JSONB that drives a typed discovery function
- Inserts matching dates into `km_rule_signals` with `ON CONFLICT DO NOTHING`
- Uses `KD_DB_PASSWORD` env var (not `DB_PRIMARY`); hardcoded host `187.127.136.65`

```bash
# Run discovery for all history
cd App/backend/scripts
KD_DB_PASSWORD=... python rule_discovery.py

# Run for a single year (test mode)
KD_DB_PASSWORD=... python rule_discovery.py 2026

# Quick test via wrapper
python rule_discovery_test.py   # runs 2026 only
```

### Rule Types

| `rule_type` | Discovery function | Conditions keys |
|---|---|---|
| `nakshatra_vara` | `discover_nakshatra_vara` | `vara`, `nakshatra_lord`, `day_lord_equals_nakshatra_lord` |
| `planet_transit` | `discover_planet_in_nakshatra` / `discover_relative_position` | `planet`, `nakshatra`, `same_sign`, `position`, `aspect_type` |
| `planet_state` | `discover_planet_state` | `planet`, `condition` (combust/retrograde/vargottam/reducing_speed), `planets_retrograde`, `planets_alone` |
| `planet_conjunction` | `discover_conjunction` | `planet_1`, `planet_2`, `aspect_type` |
| `vedh` | `discover_vedh` | `planet`, `vedh_of`, `mutual_vedh` |
| `tithi_alone` | `discover_tithi` | `tithi_base`, `paksha`, `is_ekadashi`, `is_purnima` |
| `compound` | panchak / yog / seasonal / sign routers | `panchak_day`, `yoga`, `event`, `sign` |
| `eclipse` | `discover_eclipse` | `eclipse_type` (lunar/solar) |

### Risk Engine (Prototype)

`App/backend/engine/risk_engine.py` — 4-dimension composite score (0-100):
- **Structural** (0-25): Saturn/Jupiter retrogrades + aspects
- **Momentum** (0-25): Mars retrograde + Mars-Saturn/Mars-Rahu
- **Volatility** (0-25): Moon in high-risk nakshatras + gandanta + malefic clustering
- **Deception** (0-25): Mercury/Venus retrograde + Mercury-Rahu

Regime: Accumulation (≤30) / Expansion (≤50) / Distribution (≤70) / Capital Protection (>70).
Currently reads from SQLite (`schema.py`), not the Postgres stack. Prototype only.

### Rule Engine UI

Routes: `/rules` (list) and `/rules/:id` (detail).
Component files: `src/pages/RuleEngine/RuleList.tsx`, `RuleDetail.tsx`, `index.ts`.
Data: PostgREST on `187.127.136.65:3000`.
- List: `GET /km_astro_rule_master?is_deleted=eq.false&is_active=eq.true&select=...`
- Detail: `GET /km_astro_rule_master?id=eq.{id}&select=*` + `GET /km_rule_confidence?rule_id=eq.{id}` + `GET /km_rule_signals?rule_id=eq.{id}&order=date.desc&limit=50`

---

## Bayer Rules — Implementation Status
Reference: "Stock & Commodity Traders Hand-Book of Trend Determination" — George Bayer, 1940.

### Mapped to existing rules (Bayer tag added via migration 101):
- Rule 1  → TRN-MER-MAN-TRN      Mercury direction change
- Rule 4A → TRN-MER-RIS-W-BUL   Mercury stations direct
- Rule 9  → TR-MER-CMB-E-BEA    Mercury combust east
- Rule 21 → CON-MER-VEN-CD-BEA  Retro Venus + Direct Mercury conjunction
- Rule 22 → CON-SUN-MER-TRN     Sun conjunct Retro Mercury

### New rules created with transit data (migration 101 + generate_bayer_windows.py):
- Rule 2  → BAY-R02-MAR-MER-SPD  Mars-Mercury geocentric speed diff ≈ 59min
- Rule 3  → BAY-R03-VEN-RET      Venus retrograde periods (island pattern)
- Rule 6  → BAY-R06-MAR-1635     Mars crosses 16°35' in any zodiac sign
- Rule 14 → BAY-R14-VEN-LON      Venus longitude unit cycle (unit = 1°9'13'')
- Rule 27 → BAY-R27-MER-SPD      Mercury speed crosses 59min or 1°58' threshold

### Transit generation scripts:
- `App/backend/scripts/generate_bayer_windows.py` — covers all 5 new rules above
- Run after migration 101: `DB_PRIMARY=... python3 generate_bayer_windows.py`

### Rules NOT yet implemented (source material needed):
- Rules 4B, 5, 7, 8, 10-13, 15-20, 23-26, 28-30, 31-48
- Require original Bayer 1940 handbook for accurate definition
- Do NOT guess or approximate — wait for verified source material

---

## Astro Market-Book 2026
Three new tables as of migrations 047-050:
- `km_astro_rule_master` — timeless rule registry (600+ rules planned)
- `km_astro_calendar_2026` — 2026 event instances with market_impact
- `km_astro_daily_signal` — computed net signal per date

Scoring: strong_bull=+3, bull=+2, minor_bull=+1, neutral=0,
         minor_bear=-1, bear=-2, strong_bear=-3
Turning date flagged regardless of score.

Recompute signals after any calendar insert/update:
```sql
SELECT compute_astro_daily_signals('2026-01-01', '2026-12-31');
```

API endpoints:
- `GET /api/astro/daily-signal?date=YYYY-MM-DD` — single date, includes active_events array
- `GET /api/astro/signals?from=YYYY-MM-DD&to=YYYY-MM-DD` — range, max 90 days, used by calendar view

---
