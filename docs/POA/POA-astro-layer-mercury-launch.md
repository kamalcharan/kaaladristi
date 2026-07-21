# POA — Astro Layer, Mercury Launch Slice

**Date:** 2026-07-21 · **Status:** live end-to-end for Mercury; two open decisions before Almanac build
**Origin:** owner-directed session, `docs/claude/astro-story.md` (full narrative/decision log — this POA is the execution plan; read that doc for the "why")
**Related:** `MERCURY_SLICE_PLAN.md` (repo root, launch catalog scope), `docs/POA/POA-astro-pattern-engine.md` (2026-07-06, **overlaps with this session's evidence work — see §3**)

---

## 1. What's live right now (this session, merged to `main`)

| Piece | Where | Status |
|---|---|---|
| Launch catalog scope | Migration 160 | ✅ Applied — 19 rules visible (13 Mercury + 6 slow-planet almanac) |
| Combust window method | `generate_mercury_windows.py` v3 | ✅ Applied — heliacal visibility model calibrated to Ujjain, 2026 windows match owner's almanac exactly |
| Observational evidence | Migration 161, `compute_rule_evidence.py` | ✅ Applied + seeded — range ratio, direction, turn frequency, VIX overlap, all vs base rate |
| Boundary transitions (orb) | Migration 162 | ✅ Applied + seeded — ±2-session zone, flip rate + prev-day-H/L confirmation vs base rate |
| Band tooltip rewrite | `TradingChart.tsx` | ✅ Merged — "not scored yet" / "moved as expected" retired; THE PATTERN + transition lines live |
| Nightly refresh | `pipeline2/scheduler.py` 19:00 IST job | ✅ Wired — evidence recomputes automatically after benchmark confidence |

**Confirmed findings from live data:**
- Sign ingress is the real transition carrier: 56.1% flip rate (n=246) vs 48.9% base.
- `DN-MON-MER-BUL` (Monday + Mercury nakshatra): 60.7% flip (n=107) — largest tilt in the table.
- Combust, retrograde, conjunctions: in line with base rate on coarse measures — correctly rendered as "in line with usual," not hidden or oversold.

---

## 2. Remaining build order (from `astro-story.md` §7)

| # | Item | Size | Depends on |
|---|---|---|---|
| 6a | Free tier: active-window badge (chart/dashboard) | small | nothing — can start now |
| 6b | Almanac view — forward 90-day calendar, the flagship premium surface | medium–large | §3 decision below (which evidence layer feeds its copy) |
| 7 | VaNi Morning Brief narration of active/upcoming windows | small | 6b's copy contract |
| — | Slow-planet ingress replication check (Mars/Jup/Saturn journeys already visible via Variant B) | small, high curiosity value | none — same script, new rule_codes |

---

## 3. ⚠ Decision needed: reconcile the two evidence systems

This session built `km_rule_evidence` (base-rate-anchored, full-sample, ±2-day orb) without knowing the Pattern Engine (`km_rule_patterns`, level-break/reaction-profile/sequence, clean-vs-peer overlap splitting) already existed and is populated (33,318 rows, last computed 2026-07-07). They answer overlapping questions differently:

| | `km_rule_evidence` (this session) | `km_rule_patterns` (Pattern Engine, 2026-07-06) |
|---|---|---|
| Sample | ALL windows | **clean subset only** (non-overlapping peers) — rigorous, but for Mercury this collapses sample size to near-zero (`TRN-MER-MAN-TRN` "tiles the calendar," n_clean often 0) |
| Anchor | ±2-session **orb** around the boundary | exact window start/end, no orb |
| Measure | 5-session trend flip + prev-day H/L break, vs base rate | which side (window high/low) breaks first + forward returns 5/10/22d — **no base rate stored** |
| Surface | User-facing (band tooltip, paid tier) | **Admin-only** (`/rules/:id` Patterns tab) |
| Verified | Prototyped live before building; not independently re-derived | Independently re-derived by `pattern_verify.py`, matched to 4 decimals |

**Why both exist without redundancy being obvious:** the Pattern Engine's peer-overlap rigor is exactly right for the eventual 600-rule multi-planet universe (where a Mercury window and a Saturn window overlapping is a real confound to strip out). It is *wrong-sized* for a one-planet launch, where there's little else to overlap with — hence near-zero clean-n for Mercury and the reason this session's simpler full-sample approach found signal the Pattern Engine's own gating hides.

**Proposed reconciliation (needs owner sign-off, not yet built):**
1. **Almanac view + tooltip stay powered by `km_rule_evidence`** for the Mercury launch — it's live, has base rates (which Patterns lacks), and isn't sample-starved by the clean/peer split.
2. **Add base-rate columns to `km_rule_patterns`** (small addition) so the Pattern Engine's forward-return numbers become independently interpretable too — currently "76.9% high broken first" has no stated comparison point.
3. **When the astro layer expands past Mercury** (Venus next, per `MERCURY_SLICE_PLAN.md`), revisit whether `km_rule_evidence`'s full-sample approach should also adopt clean/peer splitting — at that point overlaps become real and matter.
4. **Do not run `pattern_study.py` again for Mercury** until this is decided — a second, differently-scoped result set for the same rules increases confusion, not evidence.

---

## 4. Immediate next actions

1. **Owner decision on §3** — which system feeds the Almanac view; whether to backport base rates into `km_rule_patterns`.
2. **Build 6a (free badge)** — no dependency, can start in parallel.
3. **Build 6b (Almanac view)** once §3 is resolved.
4. **Slow-planet ingress check** — near-zero cost, run `compute_rule_evidence.py`-equivalent logic against `TRN-{MAR,JUP,SAT}-MAN-TRN` (already catalog-visible via Variant B) to see if the Mercury ingress-transition finding replicates. Good low-cost curiosity item for a slow afternoon.

---

## 5. Open questions carried over from `astro-story.md`

- Combust regeneration: 2026 display years use `ALMANAC_OVERRIDES`; years outside that range use the calibrated heliacal model with ±1–3 day fuzz — acceptable for historical stats, confirmed by owner implicitly (no objection raised).
- `CON-MER-VEN-BEA` / `CON-MER-VEN-CD-BEA` / `CON-VEN-MER-BEA` are byte-identical in evidence (same 45 windows) — dedup candidate, not urgent, flagged for the general cleanup pass the owner mentioned separately.
- VIX yardstick stays recent-era only (13.5 months of history) — realized range is the deep-history primary measure; no action needed, already implemented this way.
