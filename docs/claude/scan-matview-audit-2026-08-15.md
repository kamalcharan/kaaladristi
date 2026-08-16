# Scanner matview re-verification audit — 2026-08-15

Pre-repoint audit of `km_scan_results` (migration 147) against the live
`scanEngine.ts`, run with the committed harness `scripts/qa/scan-parity/`
(replaces the never-committed 2026-07-10 scratchpad harness). Data date:
2026-08-14. Both runs (verbatim + cap-lifted) on live production data over
the read-only MCP connector.

## Verdict

**The matview's scan logic is sound — 4 of 6 presets are logic-exact — but
it is 5 weeks stale against two July frontend fixes, and the audit found two
live PRODUCT bugs in the client bundle path that the matview does not have.**
Do NOT repoint until migration 170 (below) refreshes the two stale CTEs and
the harness passes clean.

Per-preset, cap-lifted (logic parity) run:

| preset | result | detail |
|---|---|---|
| power_buy | ✓ EXACT | 25/25, membership+rank+vani all match |
| power_sell | ✓ EXACT | 25/25 |
| conviction_flow | ✓ logic-exact | 50/50 members; top-3 "rank drift" is a 3-way tie — all share `delivery_surge_x = 4.4000`; JS tie order is nondeterministic insertion order, matview tiebreaks by equity_id (deterministic = better) |
| quiet_accumulation | ✓ logic-exact | sort score is INDUSTRY-level, so same-industry stocks always tie; all rank swaps are adjacent ties, and the single membership swap at rank 24/25 is a tie at the limit boundary (both stocks: Credit Services, identical score) |
| smart_money | ✗ STALE | JS=25, MV=0 — see F3 |
| distribution_warning | ✗ STALE | 17/25 membership swaps — see F4 |

## Findings

### F1 — PRODUCT BUG: 8,000-symbol cap truncates the scan universe
`loadDailyBundle` (and the weekly/monthly variant) fetches active symbols
with `.limit(8000)` and **no ORDER BY**. Since the Aug-3 universe expansion
there are **10,228 active symbols** — PostgREST returns an arbitrary,
planner-dependent 8,000, so ~2,228 active stocks are invisible to every
client-side bundle scan, nondeterministically. The matview reads the active
universe uncapped. Verbatim-vs-cap-lifted delta on 2026-08-14: e.g.
conviction_flow's #1 result (QPOWER) is missing from the user-visible scan.

### F2 — PRODUCT BUG: 1,000-row industry-history cap
The `km_industry_eod` history query is `.limit(1000)` but 20 days × 171
industries needs ~3,400 rows. Users get ~6 days of industry history, which
(a) degrades rotation classification (rank-change vs `history[4]` is
borderline), and (b) zeroes distribution_warning's `ind10 = history[9]`
score input, making its production ranking effectively arbitrary.
The matview reads 20 days uncapped.

### F3 — MATVIEW STALE: smart_money still has the pre-2026-07-19 gate
The matview ports `pct_accumulation > 60` (absolute), which fires for 0–1
industries — smart_money has been 0 rows in the matview on every refresh.
The JS was reworked on 2026-07-19 (merge cc5797f) to `> 55 OR top-decile`
specifically because the absolute gate left the scan chronically empty.
The 07-10 parity "0 = 0 match" was two empties agreeing.

### F4 — MATVIEW STALE: distribution_warning has the pre-2026-07-13 zone list
Matview gate: `zone IN ('Mild Bull','Neutral','Mild Bear')` — the old 5-band
scheme with the phantom 'Neutral'. JS (7-band fix, 2026-07-13) also admits
`Neutral Bull` / `Neutral Bear`, where a stock decaying out of Strong Bull
lands first (~47% of the universe sits in those two bands). Hence 17/25
membership differences.

### F5 — MATVIEW ROBUSTNESS: date CTE uses the abandoned row-count resolver
The `latest` CTE picks `HAVING count(*) >= 4000` — the resolver design the
frontend replaced with the ema_20-not-null gate after the mid-pipeline
blackout bug. On 2026-08-14 (NSE bhav late) the threshold PASSED on a
BSE-only day (4,112 rows). Refresh timing (post-indicators pipeline step)
currently masks this; align the CTE with the ema_20 gate for defense in depth.

### F6 — MATVIEW HYGIENE: fresh_breakout still computed
Retired in migration 152 (`is_active=false`), still materialized every
refresh (25 dead rows + its share of compute).

### Confirmations (no action)
- `kd_scan_presets.vani_rule` live values still match the matview's
  hardcoded vani mapping for all 6 presets (incl. the
  `is_vani_distrib_and_weakness`-is-an-OR quirk).
- The matview carries `has_recent_svd/sbd/syd` — the dot data the Aug-4 scan
  grid reads — so the dot column survives a repoint.
- `/api/vani-opportunity/config` returns a stub whose shape makes the
  frontend parser throw → DEFAULT_OPP_CONFIG everywhere; irrelevant to
  membership/rank/vani_flag (all 6 presets use flag-based
  computeVaniOpportunity, per the C3 correction — still true).
- Aug data changes (value_cr 1e5× rescale, dot recompute, universe growth)
  affect both sides identically — no parity impact by construction.

## Fix plan (proposed order)

1. **Migration 170** — `CREATE OR REPLACE` the matview: port the smart_money
   top-decile gate (F3) and the 7-band distribution zone list (F4); drop
   fresh_breakout (F6); switch the `latest` CTE to the ema_20 gate (F5).
2. **Frontend interim fix** — raise the two caps (F1: 8000 → 20000 with an
   ORDER BY for determinism; F2: 1000 → 8000) so users stop losing ~2,228
   stocks *today*, independent of the repoint timeline.
3. **Re-run the harness** (both modes) — after 170 + cap fixes, verbatim and
   cap-lifted converge and all 6 presets must be ✓ before any repoint.
4. **Repoint** (separate change, per the agreed phase plan): matview-first
   fetch with client fallback for the 6 bundle presets, daily timeframe only.

## Harness

`scripts/qa/scan-parity/` — see its README. Compiles the real
`scanEngine.ts` (esbuild, postgrest aliased to an SQL shim over the MCP
endpoint) so parity runs execute production logic verbatim. Re-run after any
scanEngine change; keep it green as the repoint gate.
