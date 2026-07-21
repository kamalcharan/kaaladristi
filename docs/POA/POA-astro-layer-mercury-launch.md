# POA — Astro Layer (THE plan we follow)

**Date:** 2026-07-21 · **Status:** ACTIVE — this is the baseline POA for all astro-layer work
**Owner decision (2026-07-21):** *"I made multiple attempts and left in middle. What we do
[this session] will be what we need to baseline."* Earlier astro attempts (Pattern Engine,
astro calendar scoring, etc.) are **LEGACY** — kept running where harmless, never built upon.
**Narrative + decision log:** `docs/claude/astro-story.md` (the "why"; this POA is the "what next").

---

## 1. The baseline (canon — build on THIS, nothing else)

```
km_astro_rule_master  (all rules; catalog_visible = user-facing shelf)
        ↓ generators (generate_mercury_windows.py — combust = calibrated
          Ujjain visibility model + ALMANAC_OVERRIDES for display years)
km_rule_transits      (windows 1990–2030, event fields: sign/motion/stage/direction)
        ↓ compute_rule_evidence.py  (nightly 19:00 job + standalone)
km_rule_evidence      (per-rule: window texture + boundary transitions,
                       EVERY measure paired with its base rate)
        ↓
TradingChart band tooltip  (THE PATTERN + transition lines, threshold-driven copy)
        ↓ next
Almanac view · free badge · VaNi narration
```

### Non-negotiable principles (settled; do not relitigate without owner)

1. **Two-layer contract:** surface = orientation (almanac language, no verdicts);
   basement = evidence (base-rate-anchored, one click deep). Data science is the
   editor, not the interface.
2. **No claim without a base rate.** Every measure ships with its matched base
   rate; copy thresholds live in code (`patternLines()`: range ≥1.15×/≤0.85×,
   direction ±8 pts, turn ±10 pts) — below threshold the card says "in line
   with usual". Publishing nulls is part of the brand.
3. **Transitions are orbs, not stamps.** Event ±2 sessions is the zone; trend
   compared entering vs leaving; prev-day H/L break inside the zone is the
   confirmation ("fusion": astro = when to watch, quant = whether it fired).
4. **One planet at a time, provably correct end-to-end** before the next
   (Mercury now; Venus is slice #2). The 6 slow-planet almanac rules stay
   visible (Variant B) but get no evidence claims until their slice is done.
5. **Product almanac == owner's almanac** for display years (override tables
   anchored to the owner's Drik-Panchang/Ujjain sheets); calibrated model for
   history.
6. **SEBI voice everywhere:** observational counts, never direction commands.

### Confirmed signal map (live data, NIFTY 2008+, base flip 48.9%)

| Phenomenon | Role in product | Evidence |
|---|---|---|
| Sign ingress (Journey) | **WATCH DAYS** — transition marker | flip 56.1% (n=246, ~2.3σ); rule's own 'end' boundary = 47.5% control ✓ |
| Monday + Mercury nakshatra | watch-day candidate | flip 60.7% (n=107) — strongest tilt; needs a second look before promotion |
| Combust | **ORIENTATION** — you're in the glare zone | all measures in line with base; windows match owner almanac to the minute |
| Retrograde, conjunctions, stations | orientation | in line with base on coarse measures |

### Legacy (do NOT build on; cleanup candidates)

- **Pattern Engine** (`km_rule_patterns`, `pattern_study.py`, admin PatternsTab,
  `POA-astro-pattern-engine.md`) — abandoned mid-attempt; clean/peer split
  starves Mercury-scale samples and no base rates stored. Stays admin-only.
  Do not re-run for Mercury. Ideas worth salvaging later (level-break forward
  returns, reaction curves) get rebuilt INTO `km_rule_evidence` if/when wanted.
- `km_astro_calendar` / `km_astro_daily_signal` scoring, `dc_inference` manual
  calendar — untouched, not part of this pipeline.
- Duplicate conjunction rules (`CON-MER-VEN-BEA`/`CON-MER-VEN-CD-BEA`/
  `CON-VEN-MER-BEA` — identical 45 windows): dedup in a cleanup pass.

---

## 2. Forward phases (in order)

### Phase 1 — Free-tier active-window badge (small; start immediately)
A compact chip on Study/chart pages + dashboard: "☿ Mercury combust · ends
Jul 24" (from `km_rule_transits`, catalog-visible rules with a window covering
today). Free users see THAT a window exists — no evidence, no history.
**DoD:** badge renders on `/chart/*` and dashboard for any active window;
clicking it for a free user opens the upgrade gate; paid user → tooltip/almanac.

### Phase 2 — Almanac view (flagship premium surface)
The owner's Excel productized. Route `/almanac` (premium-gated via existing
`InlineGate` pattern).
- **Today strip:** active windows now, each with its role line (orientation vs
  watch-day) from `km_rule_evidence`.
- **Ahead (90 days):** chronological event list from `km_rule_transits`
  (ingresses, stations, combust entries/exits, retro windows) with exact
  IST timestamps; watch-day events visually distinct; each row's texture line
  = the same threshold-driven copy the tooltip uses (shared helper — extract
  `patternLines()` out of TradingChart into a service).
- **Window detail (click):** full evidence read — window count since '08,
  range/direction/turn vs base, transition stats, and past-window list.
- Slow-planet events appear in the calendar (they're visible rules) but carry
  NO texture lines until their slice ships (principle 4).
**DoD:** owner can retire the Excel for 2026 Mercury planning; every number
on the page traces to `km_rule_evidence`/`km_rule_transits`.

### Phase 3 — VaNi narration (small)
- Morning Brief line on watch-days and window entries/exits: "Mercury enters
  Leo tomorrow — trend changes have clustered around ingress days (56% vs
  49% usual); the previous day's high/low is the level to watch."
- Same copy contract: counts + base rate, no direction, thresholds decide
  whether a number is cited at all.
**DoD:** brief mentions astro only on event days; wording passes the D39 vocab check.

### Phase 4 — Slow-planet ingress replication (cheap, before Venus)
Run the SAME orb-transition math over `TRN-{MAR,JUP,SAT}-MAN-TRN` (windows
already exist). Question: does the ingress watch-day effect replicate beyond
Mercury? Outcome feeds the Venus-slice plan and (if it replicates) a much
stronger unified "ingress days are watch days" story.
**DoD:** one table in astro-story.md: per planet, n / flip% / base / verdict.

### Phase 5 — Venus slice (repeat the proven pipeline)
Venus is the data-backed slice #2 (20 rules live, 1,527 windows). Steps, in
the Mercury order that worked: verify/regenerate windows (incl. Venus combust
via the SAME calibrated visibility model — the owner-noted `TR-VEN-CMB-W-BUL`
exists) → almanac overrides from the owner's Venus sheet (request it then) →
evidence rows land automatically (script already covers all rules) → add
'Venus' to `LAUNCH_ACTIVE_GROUP_TAGS` → catalog visibility for the vetted set.
**DoD:** same checklist Mercury passed (MERCURY_SLICE_PLAN.md §1 as template).

### Parked (unchanged)
VIX ~2008 backfill · pseudo-sector history · stock-level astro stats ·
Workspace Clean Breakaway overlay wiring · dormant-table/code cleanup sweep
(owner flagged 2026-07-21 — schedule as its own session).

---

## 3. Run model (unchanged, proven this session)

Build on branch → typecheck/py_compile → merge to `main` on owner's word →
owner runs migrations in pgAdmin + scripts on VPS → verify live via read-only
MCP → findings recorded in `astro-story.md`. Migration numbering: ALWAYS
`ls App/DBscripts/ | sort` first (numbering has drifted).
