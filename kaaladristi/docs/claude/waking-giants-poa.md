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
| 1 | `listing_date` backfill — `scripts/backfill_listing_dates.py` (NSE EQUITY_L.csv, ISIN-first match, NULL-only, prints age bands) | ✅ run 2026-08-23 (3,598 rows) |
| 1b | mcap freshness — migration 172 + shares_outstanding lane in `enrich_equity_metadata.py` + daily `recompute_mcap_from_shares()` | ✅ run 2026-08-24 (see below) |
| 2 | Dormancy metrics — migration 173 (`high_3y_adj`/`low_3y_adj`/`pct_from_3y_high`/`days_since_3y_high` on `km_equity_symbols`) + `scripts/compute_dormancy.py` (cliff-adjusted via `lib/breadth_common.adjust_close_cliffs` since `km_corporate_actions` is empty; MIN_BARS=150; ends with a per-band calibration report — the step-4 threshold constants get set from that report, not guesses; candidate gate: ≤ −50% from an ≥1-yr-old 3-yr high OR 3-yr range ratio ≤ 1.8. Raw preview 2026-08-24: Giants ≤−50% = 259, ≤−60% = 155, flat = 77 of the 1,013 mcap-passed pool pre-ADV). Weekly cadence; pipeline shim `compute_dormancy_for_pipeline` wires in at step 4. | ✅ script ready — owner runs migration 173 + script |
| 3 | GL_acc_days rolling compute — computed INSIDE the migration-174 matview (`wg_metrics` CTE: count of last-60-session GL days, delivery ≥ 55 · \|pct_chng\| ≤ 2 · rvol ≤ 2.5, v1 estimates pending calibration), refreshed nightly by `handle_scan_refresh`; no separate pipeline column needed | ✅ (in 174) |
| 4 | Matview CTE + two preset SELECTs + `kd_scan_presets` rows — `km_migration_174_waking_giants_scan.sql` (migration-170 body + ONE `wg_const`→`wg_scored` chain, `waking_giants`/`first_ascent` UNION blocks, 5 wg columns appended NULL elsewhere; dormancy constants locked: deep ≤ −60% from a ≥1-yr-old high OR flat ratio ≤ 1.8 → 142 Giants / 27 FA. Phases: WAKING = GL ≥ 12 + Magic RS > 22-sessions-ago while price within ±10%; STIRRING = GL ≥ 6; DORMANT else. EXPLAIN-validated against live DB; 9 UNION arms × 67 cols verified) | ✅ script ready — owner runs 174 as superuser + REFRESH both matviews |
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
