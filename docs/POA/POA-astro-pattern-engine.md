# POA — Astro Pattern Engine (Rule Engine → Patterns)

**Date:** 2026-07-06 · **Status:** Phases 1–4 complete (same day); owner SEBI copy review pending
**Origin:** Owner + Claude discussion following the four-planet almanac sprints (migrations 127–131)
**Owner's framing:** *"Discovery gives confidence, but what I need is patterns — e.g. Mercury combustion is trend change; if the high/low of combustion is broken, momentum gets good. Also how are technicals reacting for these planets — it starts with institutional money flow first."*

---

## The Goal

Discovery/confidence answers *"was the window bullish or bearish on average?"* — a probability.
The Pattern Engine answers *"what is the behavioral signature around the event?"* — levels, reaction curves, and sequences a trader can actually reference. This is the substance of **astrotechnicals**: planetary events measured through the platform's own technical fields.

```
km_rule_transits (windows, 1990–2030)
        ×
km_index_eod (indices + indicators, 1996→)
        ↓
pattern_study.py  →  km_rule_patterns  →  Patterns tab on /rules/:id
```

---

## Scope Decisions (settled 2026-07-06 — do not relitigate without owner)

| Decision | Value |
|---|---|
| Event anchor | **Window END** for combust/retrograde rules (the station/release moment is the trend change); **window ENTRY** for sign transits |
| Benchmarks v1 | **All indices with sufficient history** — standard AND curated (custom) baskets; curated are first-class benchmarks (owner, 2026-07-06). Per-pair n-gating. Future *pseudo* indices (history-backcast only) will carry an explicit marker and be excluded. |
| n-gates | n ≥ 20 → publish · 10–19 → shown greyed "insufficient occurrences" · < 10 → computed, never displayed. **No silent caps** — gated cells say why. |
| Frequency bands | Tactical ≤ 10d · Trend 11–90d · Structural > 90d — classified from each rule's own **median window duration** (data-driven, no hardcoded list) |
| Overlap: same band | True **peers** → clean vs overlapped split; recurring combinations (n ≥ 20) promoted to named confluence stat lines |
| Overlap: higher band | **Context, never contamination** → every window stamped with Saturn sign+motion, Jupiter sign+motion, Mars phase, Mercury motion on anchor day → conditional splits ("works 71% under supportive Jupiter, 44% under Jupiter retrograde") |
| Overlap: lower band | Density metadata only (count of tactical events inside long windows) — long-window stats are never fragmented by short events |
| Level-break collisions | Two rules ending within a few sessions share the same break → both flagged `shared_break`, neither claims it exclusively |
| Headline stats | **Clean-subset numbers lead**; overall shown secondary |
| Copy | Observational base rates only ("window-high broken first in 61% of 259 occurrences") — never targets, never advice. SEBI voice throughout. |

### ⏸ Explicitly ON HOLD (owner, 2026-07-06)
1. **Pseudo-sector reconstruction** — creating NEW indices purely to backcast sector history (distinct from existing curated baskets, which run as normal benchmarks). Verified feasible (equity data to 1996; 1,433 stocks trading by 2005; ≥5-constituent gate + survivorship labeling designed) — parked, not rejected. When created, pseudo indices will be explicitly marked as such and pattern results labeled accordingly.
2. **Stock-level calculations** — per-stock patterns and transit-sensitivity scores. False-discovery risk and stock idiosyncrasy documented in session discussion; revisit only as aggregate scoring with hard gates.

---

## The Three Pattern Types

### P1 — Level Break (the combustion example)
Per window: high/low made during the window on the benchmark → which side broke first after the anchor → time-to-break → forward returns 5/10/22 sessions post-break.
Output: *"Mercury Combust (n=259): window-high broken first 61%, median 4 sessions, avg +2.9% next 10 sessions. Window-low first 27%, avg −3.4%. No break within 10 sessions: 12%."*

### P2 — Reaction Profile (event study curves)
Align every occurrence on a relative axis (D−10 … D+15 from anchor). Average each field across occurrences: benchmark return, `rsi_14`, `rvol`, `sniper_inst`, `sniper_hot`, `rss_value`, `magic_rs` (all on `km_index_eod`).
Output: one average curve per indicator per rule per benchmark.

### P3 — Sequence (who moves first)
From P2 curves: first day each indicator deviates significantly from its pre-event baseline (D−10…D−4 mean ± z-threshold; method documented in script). Ordering = the signature.
Output: *"Around Mercury station-direct: institutional flow turns D−3, volume confirms D+1, price momentum follows D+2."*

---

## Phases

### Phase 1 — Schema (migration 132)
`km_rule_patterns`:
```
id, rule_id FK → km_astro_rule_master,
benchmark_index_id FK → km_index_symbols,
pattern_type  ('level_break' | 'reaction_profile' | 'sequence'),
anchor        ('window_end' | 'window_start'),
params JSONB, results JSONB,          -- results = {overall, clean, peers[], context_splits{}}
n_windows INT, n_clean INT,
computed_at TIMESTAMP,
UNIQUE (rule_id, benchmark_index_id, pattern_type)
```

### Phase 2 — `pattern_study.py` (the heavy piece)
One-shot script, same family/conventions as `rule_discovery.py` and the window generators.
- **2a Prep pass** — load all rules with windows; classify bands (median duration); compute same-band peer overlaps; stamp higher-band context per window (from the Journey/Motion windows built in 127–130); count lower-band density.
- **2b Level-break** per rule × benchmark (only windows fully inside the benchmark's history).
- **2c Reaction profiles** (7 indicator fields, D−10…D+15).
- **2d Sequence detection** from profiles.
- **2e Gate + write** — apply n-gates, write `km_rule_patterns` (upsert on the unique key).
- CLI: full run default; `--rule CODE` / `--benchmark ID` for targeted recompute.

### Phase 3 — Patterns tab on `/rules/:id`
Next to the Almanac tab (same `BacktestTabs` integration pattern):
- **Benchmark selector** — defaults NIFTY 50; lists benchmarks with computed rows; gated entries visible but greyed with the caveat.
- **Level-break card** — clean stats headline, overall secondary, `shared_break` flags shown.
- **Reaction curves** — small-multiple sparkcharts per indicator over the relative axis.
- **Sequence line** — the who-moves-first statement.
- **Context splits table** — Jupiter/Saturn conditioning, min-n gated.
- **Sector leaderboard** — for rules qualifying on many benchmarks: which indices respond most (dispersion itself is the finding — market rule vs sector rule).

### Phase 4 — Verification & calibration ✅ (2026-07-06)
- **Independent verification: ALL MATCH.** `pattern_verify.py` (zero shared code with the engine — raw SQL + plain loops) re-derived the full TR-MER-CMB-E-BEA × NIFTY 50 level-break aggregate; every stat matched the stored row to 4 decimals (n=150, high-first 60%/3.5s, low-first 36%/5.5s, all forward returns).
- **Threshold calibration finding:** across 7,584 field-series (1,085 profiles, n≥20), the two-consecutive |t|≥2.0 rule fires on 16.6% — consistent with the multiple-comparison noise expectation (~15–25% given ~19 scanned offset-pairs on autocorrelated curves). Even |t|≥2.5 fires 7.9%. **Conclusion: no per-series threshold separates signal from noise.** Decision: keep T=2.0 as a candidate generator; the published discriminator is **cross-benchmark replication** — a sequence move renders normally only when the same field moves the same direction (±2 sessions) on ≥5 of the rule's benchmarks; unreplicated moves render faded with an explicit label. Implemented client-side in PatternsTab (it already loads all benchmarks per rule).
- **Owner SEBI copy review: PENDING** — Patterns tab card titles/labels/footer + the 8 Motion/Journey rule remarks.

---

## Effort

| Phase | Size |
|---|---|
| 1 — Migration 132 | trivial |
| 2 — pattern_study.py | ~1–1.5 sessions (band/overlap/context logic is the real work) |
| 3 — Patterns tab | ~1 session |
| 4 — Verification | ~0.5 session |

Run model: same as the almanac sprints — merge to main, owner runs migration + script on VPS, verifies in UI.

---

## Open Questions (decide during build, not blockers)

1. **P3 significance method** — z-score vs pre-event baseline is the default; exact threshold calibrated in Phase 4 against real distributions, documented in the script header.
2. **Rule scope for v1 run** — all rules with transit windows, or MajorTransit-tagged only first? (Script takes either; owner call at run time.)
3. **Recompute cadence** — one-shot now; whether it joins the daily/weekly pipeline is a post-launch decision.

---

## Relationship to the "Planet Story" proposal (same session)

The Regime strip / Sector Rotation ruling-planet chips / Coming-up card proposal (Altitudes 1–3) remains valid and is **packaging**; this Pattern Engine is **substance**. Owner prioritized patterns first. The strip proposal is parked in session history, not in a POA — revisit after the Pattern Engine ships.

---

*Companion docs: `docs/claude/rules-engine.md` (Rule Engine reference), migrations 127–131 (four-planet almanac foundation), `docs/scanners/PLANETPULSE_RULE.md` (parked forward-calendar spec this partially realizes).*
