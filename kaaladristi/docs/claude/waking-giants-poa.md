# Waking Giants + First Ascent — Plan of Action (2026-08-23)

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
| 1 | `listing_date` backfill — `scripts/backfill_listing_dates.py` (NSE EQUITY_L.csv, ISIN-first match, NULL-only, prints age bands) | ✅ script ready — owner runs it |
| 2 | 3-yr-high history for the dormancy gate (ties into populating `km_corporate_actions` — audit §5.7 split adjustment) | ⬜ |
| 3 | GL_acc_days rolling compute (pipeline column) | ⬜ |
| 4 | Matview CTE + two preset SELECTs + `kd_scan_presets` rows (migration) | ⬜ |
| 5 | ScanView tabs (auto — presets appear once rows exist; registry wiring already generalized) | ⬜ |
| 6 | Curated Layer-0 watchlist admin flow (Discover pattern) | ⬜ |
| 7 | Story View adapters (shared builder, two voices) | ⬜ |

## Universe ground truth (post-backfill 2026-08-23 — 3,598 rows filled)

Age bands (active NSE): 20y+ → 663 · 10–20y → 608 · 6–10y → 279 ·
3–6y → 513 · <3y → 1,053. ~670 active NSE still dateless (SME/quirks).

Gate funnel (age → +mcap ≥ ₹200 Cr → +ADV ≥ ₹1 Cr, ADV = 22-session
avg of close×volume):
· Giants 10y+:      1,225 trading → 488 → **479** pre-dormancy
· First Ascent 6–10: 268 trading →  96 →  **85** pre-dormancy

⚠ **mcap_cr NULL excludes unfairly**: 725 of the Giants pool and 146
of First Ascent have NULL mcap (the recently-admitted full-universe
symbols). Before shipping, run a targeted symbol-enrichment pass
(pipeline2 `symbol_enrichment` dimension / enrich_equity_metadata.py,
already built) over the age-passed pool so the mcap gate judges on
data, not absence. Dormancy (step 2) will then cut 479+ down toward
the audit's expected 100–150.
