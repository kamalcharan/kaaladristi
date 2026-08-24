# Waking Giants + Ascent — Plan of Action (2026-08-23, v4 spec 2026-08-24)

## v4 — Hibernation → Wake → Ascent (journey model) — SPEC AGREED 2026-08-24

Owner-driven redesign after live review of the v1–v3 daily-evidence
scanner (migrations 174–176 stay live as the INTERIM scanner until v4
ships). Trigger case: WALCHANNAG — the v1–v3 3-yr window read its 2024
wake-leg peak as "the old high it fell from" when the real story is a
7-year hibernation (2016–23, ₹40–90) it broke out of in 2023; and the
absolute delivery-day gate measured stock character, not change.
Core reframe: **a waking giant is a multi-year JOURNEY (a state), not a
60-session evidence window (a daily signal).**

### Vocabulary (owner's)
- **Golden Line** = SMA150 (house name, already a chart overlay).
- **Hibernation** = multi-year consolidation: tight price band
  oscillating around a FLAT Golden Line, duration ≥ min-base-years.
- **Wake** = "consolidation breakout at the Golden Line" — breaking a
  multi-year hibernation. WALCHANNAG = "waking from a 7-year
  consolidation".

### Base (hibernation) detector — deep history
Computed over FULL cliff-adjusted history (raw prices exist ~26y; the
3-yr window was the v1–v3 mistake). Outputs per stock: base_start,
base_end, base_high, base_low, **base_years**. Min base_years:
**default 3, USER-ADJUSTABLE** (entry field on the scanner — user can
type 2 and search), which means base_years is STORED per stock and the
filter is runtime, not baked into the matview.

### MagicRS Alignment Score (0–6) — the strength dial (owner)
daily green = 1 · weekly green = 2 · monthly green = 3, summed; 6/6 =
strongest (rediscovery visible on every clock). Data rules:
- Monthly is judged on `magic_rs_short` ONLY (migration-169 lesson —
  monthly long MagicRS is structurally impossible, needs ~12y of bars).
- Weekly uses long where warm, `magic_rs_short` as fallback (the
  2024-admitted cohort lacks 145 weekly bars).
- "Data missing" must never silently score as red.
- "Green" = bull side of center incl. Neutral Bull (7-band lesson) —
  ACCEPTED (owner 2026-08-24) with a SEBI caveat: "green"/"bull" is
  INTERNAL shorthand only; every surfaced string uses the neutral
  ZONE_LABELS vocabulary (Leading / Improving / Neutral — D39), e.g.
  "alignment 6/6 — Leading on all three clocks".
Echoes the multi-timeframe "aligned rotation" idea in Rsspec.md.

### Journey state machine (the scanner IS this roster)
**Owner framing: "this should work like stage journey"** — the states
are a CYCLE exactly like the Weinstein stage system: a stock can move
to Stage 2, fall back to Stage 4, and later reappear on the potential
Stage-2-leaders watchlist. Same here: every transition is legal in
both directions, and each state feeds its own list (a died journey
re-enters HIBERNATING and is automatically future wake-watch
material — SHIVALIK is living this loop today).

HIBERNATING → STIRRING (accumulation overlay inside the base) →
WAKING (daily breakout of base ceiling + weekly confirm, at/above the
Golden Line, alignment building) → **ASCENDING** (CONFIRMED wake —
owner rule: **alignment score 6/6 AND monthly close holds above the
base ceiling**) → journey death → back to HIBERNATING (re-base; a
stock can wake again — SHIVALIK: woke 2021, journey died, re-basing).
- State persists in a table (the `km_fpb_active` pattern on a
  multi-year clock); nightly evaluation updates it; daily noise cannot
  erase a journey.
- **Journey end — RESOLVED (owner 2026-08-24): there is no "death",
  a stock just GOES BACK TO SLEEP.** Weekly close below the Golden
  Line ⇒ **RESTING** (journey alive, flagged — WALCHANNAG's 2025 dips
  are Resting, not an exit). The journey ends and the stock returns to
  HIBERNATING when the **MagicRS Alignment Score collapses to ≤ 1**
  (the clocks going dark) — the same dial that confirms the wake (6/6)
  also ends the journey. No price-persistence rule needed.

### Wake detection ingredients (owner list, by role)
- Structure: daily breakout of the consolidation ceiling + weekly
  confirm; price crossing/holding the Golden Line; Golden Line slope
  turning up.
- Follow-through: EXPANDING distance from the Golden Line.
- Participation: volume vs the base's own baseline; big-money-day
  clusters at the break.
- Strength: RS rising; weekly MagicRS turning green (feeds alignment).
- mcap: NOT a gate (mcap ≡ price × constant shares) — mcap TIER
  CROSSINGS are story beats.

### Quality overlays (never gates)
- Delivery consistency vs the stock's OWN baseline (relative, not
  absolute ≥55 — the sniper_inst lesson) through the base and into the
  break.
- Base duration is the headline story stat ("broke a 7-year
  hibernation" > "broke a 3-year one").

### Scanner presentation — the STAGE-FAMILY pattern (owner screenshot)
Present like the Stage Analysis family: **one tab per journey state**,
each with an editorial one-liner, in the Discovery category:
1. **Stirring** — "accumulating inside a multi-year hibernation,
   knocking on the wake door" (~ Stage 2 Watch analog).
2. **Waking Giants** — "hibernation ceiling broken at the Golden Line,
   alignment building" — fresh/confirming wakes, freshest first.
3. **Ascent** — "confirmed journeys in progress" (~ Stage 2 Leaders
   analog): journey age, base_years, alignment score, % traveled,
   Resting flag.

### Naming (owner)
**first_ascent → `ascent` ("Ascent")** — "it's not about 1st ascent,
it's about ascent." Under the stage-family pattern the natural reading
is: Ascent = the JOURNEY-STATE tab (Stage-2-Leaders analog), and the
age dimension (Veteran 20y+/Established 10–20y/Ascending 6–10y,
effective per-ISIN age) becomes the tier badge + a filter inside every
tab — the family is split by STATE, not by age band.
CONFIRMED (owner 2026-08-24): state-tabs REPLACE the two age-banded
presets — three focused tabs (Stirring / Waking Giants / Ascent), age
tiers as badges + filter. Tab one-liners must pass the D39 sweep
(observational; no directional verbs or bull/bear words).

### Story-chart integration (owner point 1)
Hibernation paints as a background band exactly like the stage bands
("7-YEAR HIBERNATION", rotated label — AnnotationOverlay band reuse),
wake = event pin, ascent = band; alignment 1→3→6 is a narrative beat.

### Infra implications
Deep-history base compute (full history, cliff-adjusted — populating
km_corporate_actions, audit item #7, gains leverage); journey state
table (`km_wg_journeys`); weekly+monthly clock evaluation; runtime
base_years filter (state table read, not matview-baked); backtest =
run the wake detector over history → real events + forward returns →
km_rule_confidence-style stats (audit's 30-signal minimum before ★).

### Spec CLOSED 2026-08-24 — v4 build order
All design questions resolved. Build sequence:
1. Base/hibernation detector — extend the cliff-adjusted machinery in
   `compute_dormancy.py` to FULL history; store base_start/end/high/
   low/base_years per stock.
2. `km_wg_journeys` state table + nightly evaluator (weekly+monthly
   clock; states, Resting flag, alignment score, transition history —
   transitions are the backtest record).
3. Alignment score compute (daily/weekly/monthly zone reads with the
   short-variant fallbacks).
4. Historical backfill: run the wake detector over full history so
   journeys, past wakes, and forward-return stats exist on day one
   (audit's 30-signal minimum before any ★).
5. Three presets (stirring / waking_giants / ascent) reading the state
   table; retire interim 174–176 WG blocks; runtime base_years filter.
6. Story chart: hibernation bands + wake pins + journey band
   (AnnotationOverlay reuse); D39 sweep on all surfaced copy.


Spec home: `docs/claude/scanner-audit-2026-07-12.md` §6b/§7/§8 (the full
`WAKING_GIANTS_RULE.md` it references was never committed — the audit's
compressed version is authoritative). Owner decisions below are FINAL.

## Owner decisions — do not re-open

1. **Waking Giants gate = 10 years, HARDCODED.** No user-facing age
   dropdown. Implemented as one named constant (`WG_MIN_LISTING_YEARS`)
   in the matview SQL + mirrored in preset metadata, so calibration can
   retune it with a one-line change + refresh. (Owner 2026-08-23,
   reaffirming the 2026-07-12 reduction from 20y.)
2. **The 6–10y cohort is a SIBLING PRESET, not a parameter:**
   **First Ascent** (`first_ascent`). Floor at 6 years keeps the
   2019–21 IPO-decay cohort out. Distinct thesis: not RE-awakening —
   awakening for the first time; no overhead supply from a prior glory
   peak.
3. **Age is surfaced as information, not a filter**: years-listed
   column + tier badge in results (Veteran 20y+ / Established 10–20y /
   Ascending 6–10y), optional rank boost for older names. Feeds the
   Story View masthead ("28 years listed · dormant 6 years · waking").
4. **v1 ships without the astro gate** (dc_score not materialized) and
   with a **curated Layer-0 watchlist** (quarterly, owner-reviewed,
   LLM-assisted — Custom Index Discover pattern) instead of automated
   fundamentals. (Audit §6b/§8, reaffirmed.)
5. **SEBI**: spec's directive alert copy ships as logic only; all
   surfaced strings observational (D39).
6. **v2 corrections from the owner's first live review (2026-08-24)** —
   migration 175 supersedes 174's WG parts. The three canonical
   examples (SOLARA, SHIVALIK, WALCHANNAG) were all missing from v1;
   each exposed a distinct flaw, now FINAL design:
   - **Age = earliest listing evidence per ISIN** (min of listing_date
     and first_trade_date across both exchange rows). NSE listing age
     is not company age — SHIVALIK's NSE row says 2021 but its BSE
     history reaches 2015 (actually listed 1980s).
   - **Dormancy is a HISTORY read, not today's price**: deep arm =
     `drawdown_3y_pct ≤ −50` (post-peak trough) AND high ≥ 365 days
     old AND today still ≤ −20% below the high. SOLARA (−26% today,
     trough −56%) is mid-awakening — exactly what the scanner must
     catch; v1's today-distance gate excluded it.
   - **The scanner emits ONLY Stirring/Waking rows** (caps 60/30).
     v1's 145-row dump killed the niche; the dormant bulk is
     watchlist material for the step-6 curated flow, not scan rows.
   - **Own category `discovery`** (Discovery, #14b8a6, sort 5) — these
     are structural discovery scanners, not Stage Analysis.
7. **v3 corrections from 175's first refresh (2026-08-24, migration
   176 — run INSTEAD of re-running 175; no script re-run needed):**
   - **Flat arm capped at mcap ≤ ₹5,000 Cr.** 175's top Giants were
     RELIANCE/KOTAK/TITAN and First Ascent filled with 2017-listed
     insurers: a mega cap drifting ±30% for 3y has range ratio ≤ 1.8,
     but that is maturity, not dormancy — and normal large-cap
     sessions (delivery 60%+, small moves) count as GL days, so they
     even phased WAKING. Owner: "reliance, icici, axis, HUL should
     not be part — a waking giant is going for a multi-year journey."
     Deep-fall arm keeps no ceiling (a fallen giant can be any size).
   - **ADV is per-ISIN combined-exchange** (wg_adv CTE): SHIVALIK
     trades 0.96 Cr NSE + 0.09 BSE = 1.05 Cr — the NSE-only floor cut
     it by 4 lakh.
   - **Stirring display-capped to top 10 by GL days per band**
     (`stirring_display_cap`); WAKING uncapped. Stirring stays (it is
     the early-warning tier that differentiates this scanner) but only
     its strongest evidence surfaces.
   - Live v3 preview (2026-08-24): Giants 16 WAKING + top-10 of 253
     STIRRING; First Ascent 1 WAKING (PRINCEPIPE) + top-10 of 36
     STIRRING incl. **SOLARA(12d)** ✓. SHIVALIK/WALCHANNAG are in the
     pool as DORMANT (0 GL days today — correct; they surface when
     evidence fires).
   - ⚠ OPEN (owner): fallen LARGE caps qualify via genuine deep falls
     (INFY −50.7%/619d, TRENT −67%, COLPAL −53%, ACC −55% — verified
     real). Add a scanner-wide mcap ceiling (e.g. ≤ 25,000 Cr) to keep
     it a forgotten-names instrument, or keep fallen large caps?
     One-line constant either way.
   - ⚠ CALIBRATION (later): GL-day delivery gate is ABSOLUTE (≥ 55%),
     which measures stock character as much as change — perpetual
     high-delivery illiquid names rack up 40-50 GL days
     (GANDHITUBE 54/60). v2 of the GL definition should measure
     delivery/turnover vs the stock's own baseline. WAKING's RS-turn
     requirement already captures change, so this mostly affects the
     Stirring ranking.

## Thesis summary

- **Waking Giants (10y+)**: dormant legacy companies + silent
  accumulation (Phase 1: GL_acc_days — delivery-backed quiet building)
  + daily/weekly RS-slope divergence push (Phase 2). Weekly cadence.
  Gates: age ≥ 10y · mcap ≥ ₹200 Cr · ADV ≥ ₹1 Cr · dormancy (distance
  from 3-yr high / long flat range).
- **First Ascent (6–10y)**: same engine, age band 6–10y. Story voice:
  first awakening, not return.

## Code-reuse contract

- ONE matview CTE computes all shared gates with `listing_age_years`
  as a column; two SELECTs band it (≥10 vs 6–10). Constants:
  `WG_MIN_LISTING_YEARS = 10`, `FA_MIN = 6`, `FA_MAX = 10`.
- ONE shared Story adapter builder (pattern: `stageWeakness.ts`) with
  per-preset copy.
- ONE curated-watchlist admin flow reviews both bands in the same
  quarterly pass.

## Build order

| # | Step | State |
|---|---|---|
| 1 | `listing_date` backfill — `scripts/backfill_listing_dates.py` (NSE EQUITY_L.csv, ISIN-first match, NULL-only, prints age bands) | ✅ run 2026-08-23 (3,598 rows) |
| 1b | mcap freshness — migration 172 + shares_outstanding lane in `enrich_equity_metadata.py` + daily `recompute_mcap_from_shares()` | ✅ run 2026-08-24 (see below) |
| 2 | Dormancy metrics — migration 173 (`high_3y_adj`/`low_3y_adj`/`pct_from_3y_high`/`days_since_3y_high` on `km_equity_symbols`) + `scripts/compute_dormancy.py` (cliff-adjusted via `lib/breadth_common.adjust_close_cliffs` since `km_corporate_actions` is empty; MIN_BARS=150; ends with a per-band calibration report — the step-4 threshold constants get set from that report, not guesses; candidate gate: ≤ −50% from an ≥1-yr-old 3-yr high OR 3-yr range ratio ≤ 1.8. Raw preview 2026-08-24: Giants ≤−50% = 259, ≤−60% = 155, flat = 77 of the 1,013 mcap-passed pool pre-ADV). Weekly cadence; pipeline shim `compute_dormancy_for_pipeline` wires in at step 4. | ✅ script ready — owner runs migration 173 + script |
| 3 | GL_acc_days rolling compute — computed INSIDE the migration-174 matview (`wg_metrics` CTE: count of last-60-session GL days, delivery ≥ 55 · \|pct_chng\| ≤ 2 · rvol ≤ 2.5, v1 estimates pending calibration), refreshed nightly by `handle_scan_refresh`; no separate pipeline column needed | ✅ (in 174) |
| 4 | Matview CTE + two preset SELECTs + `kd_scan_presets` rows — **`km_migration_175_wg_dormancy_v2.sql`** (supersedes 174's WG parts after owner review — see decision 6 above; adds `drawdown_3y_pct`/`first_trade_date` columns, `wg_first` per-ISIN age CTE, trough-based dormancy, evidence-only emission, Discovery category. Phases: WAKING = GL ≥ 12 + Magic RS > 22-sessions-ago while price within ±10%; STIRRING = GL ≥ 6. All 3 canonical examples verified passing the v2 deep arm against live data: SOLARA −50.1/630d/−26.2, SHIVALIK −75.4/565d/−68.1, WALCHANNAG −68.6/754d/−46.9. pglast + 9×68 arity validated) | ✅ owner: run 175 → re-run compute_dormancy.py → REFRESH both matviews |
| 5 | ScanView tabs + engine wiring — `scanEngine.ts` (WG_MATVIEW_PRESETS read path, wg fields in row mapper + counts), `ScanTable.tsx` (per-preset columns + gl_acc_days sort), `fieldConfig.ts` (wg_phase/gl_acc_days/listing_age_years tier badge/pct_from_3y_high/days_since_3y_high), `types/index.ts` | ✅ typecheck + build green |
| 6 | Curated Layer-0 watchlist admin flow (Discover pattern) | ⬜ |
| 7 | Story View adapters (shared builder, two voices) | ⬜ |

## Universe ground truth (post-backfill 2026-08-23 — 3,598 rows filled)

Age bands (active NSE): 20y+ → 663 · 10–20y → 608 · 6–10y → 279 ·
3–6y → 513 · <3y → 1,053. ~670 active NSE still dateless (SME/quirks).

Gate funnel (age → +mcap ≥ ₹200 Cr → +ADV ≥ ₹1 Cr, ADV = 22-session
avg of close×volume) — **re-measured 2026-08-24 after the full shares
sweep** (7,039 share counts captured, 6,760 mcap_cr recomputed;
mcap NULL is down from 725/146 to 2/2):
· Giants 10y+:      1,225 trading → 1,013 → **824** pre-dormancy
· First Ascent 6–10: 268 trading →   199 → **154** pre-dormancy
(pre-fix, judging on frozen/absent mcap: 479 / 85 — the gate was
silently excluding ~345 Giants and ~69 First Ascent names.)

✅ **mcap_cr freshness — FIXED (migration 172, run 2026-08-24)** — mcap is
decomposed as shares × price: `shares_outstanding` (slow-moving) is
fetched from Yahoo by `enrich_equity_metadata.py` on a rolling ~45-day
cadence (`shares_updated_at` stamps every attempt so misses don't
retry nightly; existing `industry` is never overwritten), and
`mcap_cr` is rebuilt daily by `recompute_mcap_from_shares()` — one
SQL UPDATE from shares × latest close, zero API calls — at the end of
every pipeline `symbol_enrichment` run. This replaces the frozen
one-time `populate_mcap.py` snapshot (NSE quote API, now 403-blocked).
Owner ran migration 172 + the full sweep 2026-08-24 (8,237 targets,
7,242 Yahoo hits, 995 misses — mostly ETF/MF `INF…` ISINs and fresh
SMEs, stamped so they retry only after 45 days). From here the nightly
`symbol_enrichment` run maintains it (cap 200/run covers the ~45-day
rolling cadence). Note: mcap *growth* as a signal ≈ `d30/d365_pct_chng`
(shares are near-constant); the new columns add tier-crossing and
dilution/buyback visibility, not a separate mcap history need.
Dormancy (step 2) now works from 824 / 154 and is expected to cut the
Giants pool toward the audit's 100–150.
