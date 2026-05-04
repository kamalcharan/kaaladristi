# DristiQ Intraday Page — Build Spec v2

**Route:** `/intraday/:indexId`
**Reference design:** `docs/finastro/finastro_screen1_v3.jsx` (UX/layout only)
**Foundation:** `App/frontend/src/components/domain/VisualPulse/VisualPulsePage.tsx`
**Data posture:** EOD now, intraday-ready later. Every intraday-specific element has an EOD fallback and a `// INTRADAY:` comment marker.
**Status:** Ready to build. 5-cycle Plan of Action at the bottom.

---

## 1. Framing

This is a NEW page in DristiQ, alongside `/pulse/:indexId`. It is not a fork or modification of VisualPulsePage. It carries forward all DristiQ UX (VaNi narrative, style toggle, timeline scrubber, OrderFlow/SmartMoney/Divergence cards) and adds Finastro-style intraday cockpit affordances: time-gated Rahu/Abhijit pills, 9-cell panchang strip, conflict engine, confluence dial.

LP webhook integration, `km_finastro_alerts`, `km_finastro_muhurta`, and `km_astro_correlation` tables are **out of scope** for this spec. The page renders an LP placeholder card and accepts `lpScore = null` cleanly.

---

## 2. Critical decisions baked in (vs v1)

| Topic | v1 | v2 |
|---|---|---|
| Rahu Kala source | hardcoded JS lookup | `km_daily_panchang.rahu_kala_start/end` columns |
| Abhijit source | hardcoded JS constant | `km_daily_panchang.abhijit_start/end` columns |
| Yoga end time | referenced non-existent column | new `km_daily_panchang.yoga_end_ist` column |
| Plan score | hardcoded Jupiter/Mercury checks | rule-engine query — fully data-driven |
| Score name | "Honest Score" (collision risk) | "Confluence Score" (matches DristiQ dashboard composite) |
| `session_quality` | derived from `net_signal` direction | same — open product question (Appendix Q2 of audit) |
| Sat / Sun / Holiday | unspecified | "Market non-working" banner + last trading day fallback |
| VaNi | unspecified | reuse VisualPulse pattern (header + sentence) |
| Indicator panels | 4 panels, content unclear | Option A — Confluence / OrderFlow+RSSI / SmartMoney / MagicRS |
| Herschel / Pluto | mentioned in v1 sidebar | dropped — not in DristiQ data |

---

## 3. Page layout

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER BAR — symbol · price · date · IST clock · Rahu/Abhijit pills│
├────────────────────────────────────────────────────────────────────┤
│ ⊘ Market non-working banner (Sat/Sun/holiday only)                 │
├────────────────────────────────────────────────────────────────────┤
│ TOP STRIP — 9 cells (Session·Yoga·Tithi·Moon·YogaCh·Rahu·Abh·T·LP) │
├────────────────────────────────────────────────────────────────────┤
│ ALERT STRIP — next event · conflict verdict                        │
├────────────────────────────────────────────────────────────────────┤
│ PANCHANG BAND — SVG timeline 09:15–15:30 with Rahu/Abhijit zones   │
├──────────────────────────────────────────┬─────────────────────────┤
│  MAIN CHART (VisualPulseChart, EOD)      │ RIGHT SIDEBAR (300px)   │
│  + Volume                                 │ · VaNiHeader            │
│  + AstroStrip                             │ · VaNiSentence          │
│  + TimelineSlider                         │ · Confluence Dial       │
│                                           │ · Confluence Breakdown  │
│                                           │ · ConflictEngine card   │
│                                           │ · Panchang table        │
│                                           │ · Planets table         │
│                                           │ · LP+FIN placeholder    │
├──────────────────────────────────────────┴─────────────────────────┤
│ ▼ PANEL 1 — Confluence (CorrelationCard, style toggle, LP slot)    │
│ ▼ PANEL 2 — Order Flow / RSSI (OrderFlowCard + DivergenceCard)     │
│ ▼ PANEL 3 — Smart Money (SmartMoneyCard)                           │
│ ▼ PANEL 4 — Magic RS (lifted MagicRsSubchart, index-mode)          │
├────────────────────────────────────────────────────────────────────┤
│ GUIDANCE FOOTER — verdict summary · "EOD Data" · table refs        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data sources (locked)

| Element | Source | Endpoint / Query |
|---|---|---|
| Index metadata + EOD bars | `km_index_eod` + `km_index_symbols` | reuse `useVisualPulse(numId)` |
| Panchang day | `km_daily_panchang` (extended in M072) | `GET /api/panchang/daily?date=` |
| Net signal (direction) | `km_astro_daily_signal` | `GET /api/astro/daily-signal?date=` |
| Rule signals on date | `km_rule_signals × km_astro_rule_master` | `GET /api/panchang/daily` includes summary |
| Plan Score raw | `km_rule_signals × km_astro_rule_master` filtered to planetary types | new endpoint OR inline in /api/panchang/daily — see §6 |
| Planetary positions | `km_planetary_positions` | PostgREST `?date=eq.{today}` |
| DC inferences for AstroStrip | `dc_inference` | reuse `useAstroTransits` from VisualPulse |
| Index Magic RS for Panel 4 | `km_index_eod.magic_rs`, `magic_rs_zone` | already in `useVisualPulse` payload |
| LP signal | none yet | placeholder card, `lpScore = null` |
| Trading calendar (holiday lookup) | `km_trading_calendar` | new helper `useLastTradingDate(today)` |

---

## 5. Schema additions — Migration 072

New columns on `km_daily_panchang` (all nullable so existing rows don't break):

```sql
ALTER TABLE km_daily_panchang
  ADD COLUMN IF NOT EXISTS rahu_kala_start    TIME,
  ADD COLUMN IF NOT EXISTS rahu_kala_end      TIME,
  ADD COLUMN IF NOT EXISTS abhijit_start      TIME,
  ADD COLUMN IF NOT EXISTS abhijit_end        TIME,
  ADD COLUMN IF NOT EXISTS yoga_end_ist       TIME,
  ADD COLUMN IF NOT EXISTS yoga_end_next_day  BOOLEAN NOT NULL DEFAULT FALSE;
```

### Rahu Kala computation (deterministic per date)

Daylight = sunset − sunrise, divided into 8 equal muhurtas of `daylight/8` minutes each.
**Canonical Vedic muhurta-index per weekday** (1-indexed):

| weekday (JS getDay) | name | rahu muhurta # |
|---|---|---|
| 0 | Sun  | 8 |
| 1 | Mon  | 2 |
| 2 | Tue  | 7 |
| 3 | Wed  | 5 |
| 4 | Thu  | 6 |
| 5 | Fri  | 4 |
| 6 | Sat  | 3 |

```python
muhurta_minutes = (sunset - sunrise) / 8
rahu_start = sunrise + (rahu_index - 1) * muhurta_minutes
rahu_end   = sunrise +  rahu_index      * muhurta_minutes
```

For canonical Indian latitudes near 6:00 AM sunrise / 6:00 PM sunset, Monday's slot evaluates to ~07:30–09:00, etc. — the canonical Vedic table emerges from the data, not from a hardcoded lookup.

### Abhijit computation

Abhijit Muhurta = the 8th of 16 half-muhurtas in daylight = true noon ± ~24 min.

```python
half_muhurta = (sunset - sunrise) / 16
abhijit_start = sunrise + 7 * half_muhurta
abhijit_end   = sunrise + 8 * half_muhurta
```

### Yoga end time

The existing panchang computation engine already calculates yoga number for each date. Extend it to also emit the yoga changeover timestamp + `yoga_end_next_day` flag (parallel to `tithi_end_ist`/`tithi_end_next_day` from Migration 018).

### Backfill

Run the computation against all 14,975 historical rows after migration. Idempotent — re-running computes the same values.

---

## 6. Plan Score — data-driven

No hardcoded planet weights. Sum strength × signed-direction across active planetary rules on the date, normalized.

```sql
-- Plan Score raw, per date
SELECT
  COALESCE(SUM(
    CASE
      WHEN s.signal IN ('strong_bullish','bullish')   THEN  s.strength
      WHEN s.signal =  'mild_bullish'                 THEN  s.strength * 0.5
      WHEN s.signal =  'mild_bearish'                 THEN -s.strength * 0.5
      WHEN s.signal IN ('strong_bearish','bearish')   THEN -s.strength
      ELSE 0
    END
  ), 0)::NUMERIC AS plan_raw,
  COUNT(*) AS contributing_rules
FROM km_rule_signals     s
JOIN km_astro_rule_master r ON r.id = s.rule_id
WHERE s.date = :date
  AND r.is_active   = TRUE
  AND r.is_deleted  = FALSE
  AND r.rule_type IN ('planet_state', 'planet_transit',
                      'planet_conjunction', 'vedh', 'eclipse');
```

### Normalization

Compute `NORMALIZER` once from the 95th percentile of historical `|plan_raw|`:

```sql
SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ABS(plan_raw)) AS normalizer
FROM (
  -- run the plan_raw query for every date in km_daily_panchang
  ...
) t;
```

Store the result as a single config row (e.g. in `km_vani_opportunity_config` or a new `km_score_calibration` row). Then:

```typescript
planScore = clamp(plan_raw / NORMALIZER * 2, -2, 2)
```

Recalibrate quarterly. Lives in DB, not code — adjustable without deploy.

---

## 7. Confluence Score formula

```typescript
// Confluence Score (0–10) — index-level
// Tech weight  : 60%
// Panchang     : 20%
// Planetary    : 20%

const techScore = lpScore !== null
  ? Math.max(0, lpScore / 10) * 6
  : 3.0;   // neutral fallback when LP webhook is not yet live

const panScore = inRahu       ? 0
                : sq === 3    ? 2.0
                : sq === 2    ? 1.2
                : sq === 1    ? 0.5
                :               0.0;

const abhBonus  = inAbhijit ? 0.8 : 0;
const planScore = await fetchPlanScore(date); // see §6, range [-2, 2]

const confluence = Math.min(10,
  techScore * 0.6
  + (panScore + abhBonus) * 0.2
  + Math.max(0, planScore) * 0.2
);
```

**Important:** `Math.max(0, planScore)` mirrors Finastro Screen 1 — bearish planetary state subtracts via the conflict engine, not via the dial. The dial is a positive-confluence indicator.

### Labels

- ≥ 7.5 → EXCELLENT (gold)
- ≥ 6.0 → GOOD (green)
- ≥ 4.0 → FAIR (amber)
- < 4.0 → LOW (red/dim)

### Tech bar treatment when LP is null

Render the Tech bar at 50% width in **grey with a label "Awaiting LP"** — not at 0% (would look broken) and not at full color (would mislead). The 3.0 default is just for total-score math.

---

## 8. session_quality derivation

```typescript
function deriveSessionQuality(netSignal: string | null): 0 | 1 | 2 | 3 {
  if (!netSignal) return 1;
  if (netSignal === 'strong_bullish' || netSignal === 'bullish') return 3;
  if (netSignal === 'mild_bullish' || netSignal === 'neutral'
      || netSignal === 'turning')                                return 2;
  if (netSignal === 'mild_bearish' || netSignal === 'bearish')   return 1;
  if (netSignal === 'strong_bearish')                            return 0;
  return 1;
}
```

**Open product question** (carried from audit Appendix Q2): this maps a directional indicator to a quality indicator. Faithful Finastro semantics would derive from panchang flags (yoga, tithi, dlnl_match, special days). For v1 we ship the directional mapping with this comment in the code:

```typescript
// NOTE: session_quality currently derived from net_signal direction.
// Faithful Finastro semantics derive from panchang flags. Reconciliation
// pending product owner decision (audit Appendix Q2).
```

`'turning'` flag gets a special amber `TURNING` badge in Cell 1 alongside the NEUTRAL color, so the signal isn't lost.

---

## 9. Conflict Engine

Pure function, priority-ordered, 7 cases. Lives in `conflictEngine.ts`. LP-null cases route to the panchang-only verdicts; LP-dependent cases show "Awaiting LP signal".

```typescript
type Verdict = 'HARD_OVERRIDE' | 'HARD_CONFLICT' | 'YOGA_BLOCK'
             | 'DOT_CONFLICT'  | 'ALIGNED'       | 'DOT_ALIGNED'
             | 'WATCH_MODE'    | 'NEUTRAL'       | 'AWAITING_LP';

interface ConflictResult {
  verdict: Verdict;
  action: string;
  rule: string;
  stats?: string;     // e.g. 'n=312, p=0.018'
  bonus?: string;     // e.g. 'Abhijit active +0.8'
  color: 'red' | 'green' | 'amber' | 'teal' | 'dim';
}

export function resolveConflict(input: {
  sq: 0 | 1 | 2 | 3;
  inRahu: boolean;
  inAbhijit: boolean;
  yoga: string;
  lpScore: number | null;
  lpDot: 'SVD' | 'SBD' | 'SYD' | 'PRE-SYD' | null;
}): ConflictResult {
  const { sq, inRahu, inAbhijit, yoga, lpScore, lpDot } = input;

  const isBullishEntry = lpScore !== null && lpScore >= 7;
  const yogaBlock = yoga === 'Vyatipata' || yoga === 'Vaidhriti';

  // Panchang-only verdicts fire even when LP is null
  if (yogaBlock && lpScore === null)
    return { verdict: 'YOGA_BLOCK', action: 'AWAIT — yoga inauspicious',
             rule: `${yoga} active`, color: 'red' };

  if (inRahu && lpScore === null)
    return { verdict: 'HARD_OVERRIDE', action: 'NO ENTRIES — Rahu Kala',
             rule: 'Rahu Kala active', stats: 'n=312, p=0.018', color: 'red' };

  // Case 3 — Rahu (highest priority)
  if (isBullishEntry && inRahu)
    return { verdict: 'HARD_OVERRIDE', action: 'SKIP TRADE',
             rule: 'Rahu Kala active', stats: 'n=312, p=0.018', color: 'red' };

  // Case 2 — AVOID session
  if (isBullishEntry && sq === 0)
    return { verdict: 'HARD_CONFLICT', action: 'SKIP TRADE',
             rule: 'AVOID session overrides LP', stats: 'n=486, p=0.028',
             color: 'red' };

  // Case 7 — Yoga block
  if (isBullishEntry && yogaBlock)
    return { verdict: 'YOGA_BLOCK', action: 'SKIP TRADE',
             rule: `${yoga} — most inauspicious`, stats: 'n=2184, p=0.031',
             color: 'red' };

  // Case 6 — SYD dot conflict
  if (lpDot === 'SYD' && sq === 3)
    return { verdict: 'DOT_CONFLICT', action: 'NO NEW LONGS',
             rule: 'Distribution on favorable session', color: 'amber' };

  // Case 1 — Aligned
  if (isBullishEntry && sq === 3)
    return { verdict: 'ALIGNED', action: 'FULL SIZE ENTRY',
             rule: 'LP BUY + Favorable session',
             bonus: inAbhijit ? 'Abhijit active +0.8' : undefined,
             color: 'green' };

  // Case 5 — Dot aligned
  if ((lpDot === 'SVD' || lpDot === 'SBD') && sq >= 2)
    return { verdict: 'DOT_ALIGNED', action: 'HIGH CONVICTION',
             rule: lpDot === 'SVD' ? 'SVD +2.5 boost' : 'SBD +1.5 boost',
             color: 'green' };

  // Case 4 — Watch mode
  if ((lpScore === null || lpScore === 0) && sq === 3)
    return { verdict: 'WATCH_MODE', action: 'AWAIT LP CONFIRMATION',
             rule: 'Favorable session, no LP signal yet', color: 'teal' };

  if (lpScore === null) return { verdict: 'AWAITING_LP', action: 'No LP signal',
                                 rule: '—', color: 'dim' };

  return { verdict: 'NEUTRAL', action: 'MONITOR', rule: '—', color: 'dim' };
}
```

---

## 10. Top Strip — 9 cells

Reads from `GET /api/panchang/daily?date={today}` (extended) + `GET /api/astro/daily-signal?date={today}`.

| # | Cell | DB / Computed source |
|---|---|---|
| 1 | SESSION (label + icon) | derived from `net_signal` via `deriveSessionQuality` |
| 2 | YOGA (name + favorability) | `km_daily_panchang.yoga_name` |
| 3 | TITHI (name + paksha) | `km_daily_panchang.tithi_name` + `paksha` |
| 4 | MOON (sign + element) | `km_daily_panchang.moon_sign_name` + element-of-sign map |
| 5 | YOGA changeover | `km_daily_panchang.yoga_end_ist` (M072) |
| 6 | RAHU window | `km_daily_panchang.rahu_kala_start/end` (M072) |
| 7 | ABHIJIT window | `km_daily_panchang.abhijit_start/end` (M072) |
| 8 | TIME · DATE | live IST clock |
| 9 | LUCKYPOP | `lpState.signal` (null until webhook) |

Cell 1 color: sq=3 green · sq=2 amber · sq=1 amber · sq=0 red · `'turning'` adds amber TURNING badge.
Cells 6 / 7 highlight (red / green tint) when current time is within the window.

---

## 11. Right Sidebar (300px)

| Module | Component | Source |
|---|---|---|
| VaNi header | `VaNiHeader` (reused) | bar.trade_date + position |
| VaNi sentence | `VaNiSentence` (reused) | corrState + AI fetch |
| Confluence Dial | new `ConfluenceDial.tsx` | computed from §7 |
| Confluence Breakdown | inline (Tech / Panchang / Planet bars) | same |
| Conflict Engine card | new `ConflictEngineCard.tsx` | `resolveConflict` output |
| Panchang table | new `PanchangSidebar.tsx` | `km_daily_panchang` (extended) |
| Planets table | new `PlanetsSidebar.tsx` | `km_planetary_positions` |
| LP+FIN placeholder | new `LPBadge.tsx` | static until webhook |

### Planets sidebar — only DristiQ planets

```sql
-- one-time check before building, lock the row list
SELECT DISTINCT planet FROM km_planetary_positions ORDER BY planet;
-- Expected: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Rahu, Ketu (9)
-- DristiQ does NOT have Herschel or Pluto. Do not show placeholder rows.
```

---

## 12. Indicator Panels (Option A, 4 panels)

| # | Title | Collapsed view | Expanded content | Component(s) |
|---|---|---|---|---|
| 1 | Confluence | score 0-10 + 3 mini-bars | full `CorrelationCard` w/ style toggle | reuse `CorrelationCard` |
| 2 | Order Flow / RSSI | flow_type + RSS value | `OrderFlowCard` + `DivergenceCard` stacked | reuse both |
| 3 | Smart Money | sniper_inst value + dot | `SmartMoneyCard` | reuse |
| 4 | Magic RS | zone label + magic_rs % | `MagicRsSubchart` (lifted to index mode) | **lift `MagicRsSubchart` from `equity/` to support `km_index_eod.magic_rs`** |

### Decision point — Panel 4 component

`MagicRsSubchart` currently lives at `App/frontend/src/components/domain/VisualPulse/equity/MagicRsSubchart.tsx` and reads equity-shaped data. Two options:

- **(a) Lift to shared** (recommended): move to `VisualPulse/MagicRsSubchart.tsx`, add a `mode: 'index' | 'equity'` prop or polymorphic input. Both intraday page and EquityVisualPulsePage benefit.
- **(b) New component**: `IntradayMagicRsCard.tsx` purpose-built for index. Duplicates rendering logic.

Lift unless build-time inspection shows the equity version is too coupled.

---

## 13. Market non-working banner

```typescript
const { isHoliday, lastTradingDate } = useLastTradingDate(todayIST);

if (isHoliday) {
  // Render banner above top strip:
  // "⊘ Market non-working — showing data for {lastTradingDate} ({weekday})"
  // All other UI continues with lastTradingDate as the panchang date.
  // IST clock + Rahu/Abhijit pills tick live (calendar-based, not market-based).
}
```

`useLastTradingDate` queries `km_trading_calendar` for the most recent open trading day ≤ today.

---

## 14. Files to create

```
App/frontend/src/components/domain/Intraday/
  IntradayPage.tsx              -- main shell
  IntradayHeader.tsx            -- header + clock + Rahu/Abhijit pills
  TopStrip.tsx                  -- 9-cell panchang strip
  AlertStrip.tsx                -- next event + verdict banner
  PanchangBand.tsx              -- SVG timeline 09:15-15:30
  ConflictEngineCard.tsx        -- verdict display
  ConfluenceDial.tsx            -- SVG ring + breakdown bars
  PanchangSidebar.tsx           -- right-sidebar panchang table
  PlanetsSidebar.tsx            -- right-sidebar planets table
  LPBadge.tsx                   -- placeholder card
  IndicatorPanels.tsx           -- 4 collapsible wrappers
  MarketClosedBanner.tsx        -- Sat/Sun/holiday banner
  index.ts                      -- barrel exports

App/frontend/src/hooks/
  useIntraday.ts                -- composite hook (panchang + planets + EOD)
  useLastTradingDate.ts         -- holiday-aware date resolver

App/frontend/src/services/
  conflictEngine.ts             -- pure resolveConflict()
  confluenceScore.ts            -- pure computeConfluence()

App/DBscripts/
  km_migration_072_panchang_window_columns.sql  -- 6 new TIME columns + backfill

App/backend/
  pipeline/panchang_windows.py   -- compute rahu/abhijit/yoga_end and write back
  scripts/calibrate_plan_score.py -- compute NORMALIZER, write to config
  pipeline2_api.py               -- extend GET /api/panchang/daily payload
                                  + add GET /api/intraday/plan-score?date= (or fold)
```

Modified:
- `App/frontend/src/App.tsx` — add `<Route path="/intraday/:indexId" element={<IntradayPage />} />`
- `App/frontend/src/components/domain/VisualPulse/equity/MagicRsSubchart.tsx` → lifted to `VisualPulse/MagicRsSubchart.tsx` with `mode` prop

---

## 15. Reuse contract

**Reused as-is, no copies:**
- `useVisualPulse(numId)` — bars + dcInferences
- `VisualPulseChart` — chart rendering
- `AstroStrip` — DC inference strip
- `TimelineSlider` — historical scrubber
- `CorrelationCard` — Confluence panel
- `OrderFlowCard` — Panel 2 part 1
- `DivergenceCard` — Panel 2 part 2
- `SmartMoneyCard` — Panel 3
- `VaNiHeader` + `VaNiSentence` — VaNi modules
- `MagicRsSubchart` — Panel 4 (after lift)

Forbidden: copy-pasting any existing component.

---

## 16. INTRADAY-ready markers

Every block that swaps when `km_index_15m` populates must carry an explicit comment:

```typescript
// INTRADAY: replace EOD close with live tick from km_index_15m
// INTRADAY: replace daily bar chart with 5-min bars
// INTRADAY: replace placeholder LP badge with live webhook data
// INTRADAY: TimelineSlider switches semantics from "scrub days" to "scrub today's bars"
// INTRADAY: PanchangBand current-time marker becomes a moving cursor
```

These make the future upgrade a search-and-replace, not archaeology.

---

## 17. What NOT to do

- ❌ No hardcoded mock data — all data from existing DristiQ APIs
- ❌ Do not modify `VisualPulsePage.tsx` — new page alongside it
- ❌ Do not change conflict-rule priority order (3→2→7→6→1→5→4)
- ❌ Do not reference Herschel or Pluto — not in DristiQ data
- ❌ Do not invent API endpoints; extend existing or add explicitly here
- ❌ Do not regress `/pulse/:indexId` — full regression at end of Cycle 5
- ❌ No duplicate implementations of conflict logic — single source `services/conflictEngine.ts`

---

## 18. Definition of Done

- [ ] `/intraday/:indexId` resolves for every active `km_index_symbols.id`
- [ ] Header shows live IST clock; Rahu/Abhijit pills toggle correctly throughout the day
- [ ] Sat / Sun / Holiday: banner shows, fallback to last trading day, no errors
- [ ] Migration 072 applies cleanly to prod (idempotent) + dev (creates from scratch)
- [ ] Backfill populates rahu/abhijit/yoga_end for all 14,975 historical rows
- [ ] Plan score calibration produces a NORMALIZER value, stored in DB
- [ ] Top strip renders 9 cells from API, no JS lookups for Rahu times
- [ ] Conflict engine resolves all 7 cases when LP is mocked; LP-null states render correctly
- [ ] Confluence dial renders with 3-bar breakdown; Tech bar grey-fallback when LP null
- [ ] Planets sidebar shows only planets in `km_planetary_positions` (no placeholder rows)
- [ ] All 4 indicator panels collapse/expand; expanded reuses existing cards verbatim
- [ ] LP badge shows placeholder, not broken
- [ ] All `// INTRADAY:` markers in place
- [ ] No regression on `/pulse/:indexId` (manual smoke + visual diff)

---

# 19. Plan of Action — 5 Cycles

Each cycle is independently shippable, testable, and does not break existing functionality. Cycles are PR-sized.

## Cycle 1 — Schema + Data Foundation
**Goal:** Make the data layer ready. No UI yet.

- [ ] Verify which planets exist in `km_planetary_positions` (one-line SQL)
- [ ] Migration 072: add 6 new TIME columns to `km_daily_panchang`
- [ ] `pipeline/panchang_windows.py` — compute Rahu / Abhijit / yoga_end from sunrise/sunset
- [ ] Backfill all 14,975 rows
- [ ] Wire computation into ongoing daily pipeline so new rows include the columns
- [ ] Extend `GET /api/panchang/daily` payload to include the 6 new fields
- [ ] `scripts/calibrate_plan_score.py` — compute NORMALIZER from historical plan_raw, store in config table
- [ ] Add `GET /api/intraday/plan-score?date=` endpoint (returns `plan_raw`, `normalized`, `contributing_rules`)
- [ ] **Definition of done**: a curl to `/api/panchang/daily?date=2026-05-04` returns Rahu/Abhijit/yoga_end times correctly; a curl to `/api/intraday/plan-score?date=2026-05-04` returns a number in [-2, 2].

**Risk:** panchang computation engine internals — may need plumbing into whatever today computes panchang for new rows. Address as discovered.

## Cycle 2 — Page Shell + Reused Foundation
**Goal:** Page loads. Chart renders. Sidebar has VaNi + placeholders. No new logic yet.

- [ ] Add route `/intraday/:indexId` in `App.tsx`
- [ ] `IntradayPage.tsx` shell — grid layout, calls `useVisualPulse(numId)` and `useIntraday(date)` (data hook stub)
- [ ] `useLastTradingDate.ts` + `MarketClosedBanner.tsx` — Sat/Sun/holiday handling
- [ ] `IntradayHeader.tsx` — symbol name, last close, IST wall clock (no Rahu/Abhijit pills yet)
- [ ] Reuse `VisualPulseChart`, `AstroStrip`, `TimelineSlider` in main pane
- [ ] Reuse `VaNiHeader` + `VaNiSentence` in sidebar
- [ ] Sidebar placeholder cards for Confluence, Conflict, Panchang, Planets, LP
- [ ] Guidance footer with hardcoded text
- [ ] Add nav link to "Intraday" wherever `/pulse/` link exists
- [ ] **Definition of done**: page loads on weekday + weekend, chart visible, no errors.

## Cycle 3 — Top Strip, Alert Strip, Panchang Band
**Goal:** Time-aware panchang surfaces. The page now feels Finastro-shaped.

- [ ] `TopStrip.tsx` — 9 cells, all data-driven from `useIntraday`
- [ ] `deriveSessionQuality` helper + Cell 1 color/icon
- [ ] `'turning'` badge on Cell 1 when applicable
- [ ] `AlertStrip.tsx` — next event resolver + Rahu/Abhijit live banners
- [ ] `PanchangBand.tsx` — SVG timeline with Rahu/Abhijit zones, current-time marker, yoga/tithi changeover ticks
- [ ] Add Rahu/Abhijit pills to `IntradayHeader`
- [ ] Wire Rahu/Abhijit live status — `useEffect setInterval(1000ms)` recomputing inRahu/inAbhijit
- [ ] **Definition of done**: load page during a known Rahu window — pill turns red, alert strip says "Rahu Kala active". Panchang band cursor advances every second.

## Cycle 4 — Conflict Engine + Confluence Dial
**Goal:** Decision-support core. The page now answers "what's the read on now?"

- [ ] `services/conflictEngine.ts` — pure `resolveConflict()` with all 7 cases + LP-null branches
- [ ] `services/confluenceScore.ts` — pure `computeConfluence()`
- [ ] `ConflictEngineCard.tsx` — verdict display, action label, rule text, stats citation
- [ ] `ConfluenceDial.tsx` — SVG ring 0-10 + 3-bar breakdown
- [ ] Tech bar grey-fallback styling when `lpScore === null`
- [ ] `LPBadge.tsx` placeholder card
- [ ] Wire `useIntraday` to fetch plan_score from new endpoint
- [ ] Unit tests for `resolveConflict` covering all 7 cases + null states
- [ ] Unit tests for `computeConfluence` over edge cases
- [ ] Guidance footer pulls verdict summary
- [ ] **Definition of done**: dial renders, all 7 conflict cases reachable via mock LP states (use a local debug toggle that sets fake `lpScore`/`lpDot` for QA, gated behind dev-only flag).

## Cycle 5 — Indicator Panels + Sidebar Tables + Polish
**Goal:** Feature-complete. Visual parity with Finastro Screen 1 to the extent DristiQ data allows.

- [ ] `PanchangSidebar.tsx` — table from extended `km_daily_panchang`
- [ ] `PlanetsSidebar.tsx` — query `km_planetary_positions`, render only planets present
- [ ] Lift `MagicRsSubchart` from `equity/` to `VisualPulse/` with `mode` prop
- [ ] `IndicatorPanels.tsx` — 4 collapsible wrappers (Option A layout)
- [ ] Panel 1 → CorrelationCard (style toggle, LP slot empty)
- [ ] Panel 2 → OrderFlowCard + DivergenceCard stacked
- [ ] Panel 3 → SmartMoneyCard
- [ ] Panel 4 → MagicRsSubchart in index mode reading `km_index_eod.magic_rs`
- [ ] All `// INTRADAY:` markers added
- [ ] Visual regression smoke test on `/pulse/:indexId` — no diffs
- [ ] Update `CLAUDE.md` Routes/Views section with `/intraday/:indexId`
- [ ] **Definition of done**: full Definition-of-Done checklist (§18) ticked.

---

## 20. Out of scope for this spec

These are tracked but not built here:

- LP webhook landing endpoint (`POST /luckypop/signal`) — separate workstream
- `km_finastro_alerts` table + alert subsystem — separate workstream
- `km_finastro_muhurta` table + Muhurta page — separate workstream
- `km_astro_correlation` persisted table — separate workstream
- Intraday data ingestion (`km_index_15m`, `km_equity_15m` population)
- Pluto / Herschel addition to planetary computation pipeline
- `session_quality` reconciliation (audit Appendix Q2)
- Magic RS sector-level aggregation for indices
- Dasha-layer overlay (Sprint 11 in Finastro plan)

When any of these land, the corresponding `// INTRADAY:` or placeholder-card sections become the integration points. This spec is designed so adding them is additive, not invasive.

---

*Vikuna Technologies · DristiQ · Intraday Page Spec v2 · May 2026*
