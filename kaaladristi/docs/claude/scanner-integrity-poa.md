# Scanner Integrity — Plan of Action (2026-08-24)

Complete audit of all 17 active scan presets across 5 contract dimensions,
and the fix. Triggered by the owner spotting blank Score 5D/22D columns on
Strength Confluence and asking, correctly, "scanners will become unreliable".

## How this was found — and why it was missed

The blank columns were **not** introduced by this session's migrations
(174/175/176). No matview migration ever carried them — verified against
147 (original), 170, 174, 175, 176: zero references in all five.

But the matview was recreated three times this session and the gap was not
caught, because every verification was **self-referential**:

| Check run | What it proves | What it misses |
|---|---|---|
| pglast syntax parse | SQL is valid | nothing about consumers |
| UNION arm arity (9 × 67) | arms agree with each other | all arms can be uniformly wrong |
| EXPLAIN on live DB | columns resolve | nothing about what the UI needs |

None asked *"does this satisfy its consumer?"* — the same
presence-not-correctness failure the integrity sweep was built to catch,
committed in the migration work itself.

The one existing guard would not have helped either: `scripts/qa/scan-parity`
compares `rank, equity_id, symbol, vani_flag` only — **membership and order,
never column payloads**. It would have reported ✓ on all six presets while
every display column rendered a dash. (Migration 174 also explicitly waived
re-parity as "not needed" — defensible for row membership, but the question
"what else should be verified?" was never asked.)

**Root cause of the class:** the matview↔frontend column contract is written
down nowhere. The UI derives columns from `fieldAvailability.ts` +
`PRESET_COL_OVERRIDES`; the matview from a hand-maintained 2,000-line SELECT.
Nothing asserts they agree. Symptom of a mismatch is a dash in a cell — no
error, no log, no failed check.

## Audit results — all 17 presets, 5 dimensions

| Dimension | Matview 6 | Direct-query 8 | WG journey 3 |
|---|---|---|---|
| Column contract | **5 missing, all six affected** | ✅ clean | ✅ clean |
| Universe (`kd_scan_presets.universe`) | **1 violation** | ✅ enforced | ✅ |
| VaNi rule produces flags | **3 dead** | n/a | n/a |
| Liquidity floor | none | **none — same gap** | ✅ ADV ≥ ₹1 Cr |
| Result limits | ✅ | ✅ | ✅ |

### D1 — Column contract (matview family only)
Missing from `km_scan_results`, rendered by the UI, therefore always `—`:
`score_5d`, `score_22d`, `rsi_14`, `avg_amt_5d`, `supertrend_dir`.
Affects all six: power_buy, power_sell, smart_money, quiet_accumulation,
distribution_warning, conviction_flow.

The eight direct-query presets are clean because they `SELECT` from
`km_equity_eod` directly, which carries every column. **That is the whole
reason Breakout Surge looks healthy and Strength Confluence looks broken** —
two families, two data surfaces, one undeclared contract.

### D2 — Universe violation
`quiet_accumulation` is declared `NSE_ONLY` in `kd_scan_presets` but returns
**14 BSE rows**. The JS engine enforced this via `buildNsePreferredIds()`;
the matview never ported the `universe` field. `smart_money` only looks
correct by accident — its `symbol ~ '^[A-Z]'` gate drops numeric BSE scrip
codes as a side effect of an unrelated rule.

### D3 — Liquidity floor missing platform-wide
No preset anywhere has one. Protected only by accident:
`conviction_flow` (₹1.5 Cr baked into its gate) and the three WG presets
(₹1 Cr, deliberate).

Live composition, 2026-08-24 (rows below ₹1 Cr/day turnover):
power_sell **24/25** · quiet_accumulation **23/25** · power_buy **19/25** ·
smart_money **18/25** · distribution_warning **10/12** · conviction_flow **0/50**.

Strength Confluence rank 3 was a ₹2.46 stock trading **₹0.01 Cr/day**.

**Why it appeared now:** the JS bundle fetched symbols with `.limit(8000)`
and no ordering, against **10,400 active symbols** — silently truncating
~2,400, skewed to the most recently inserted rows, i.e. exactly the
newly-admitted micro-caps. 15–20 of every 25 flooded rows are symbols first
traded 2024+. The audit called that cap a client-side bug; the matview reads
uncapped, which correctly removed an accidental shield. There is no prior
liquidity rule to restore — full-universe coverage is a Settled Decision and
re-truncating is not an option.

### D4 — Three dead VaNi rules are a SYMPTOM, not a separate defect
`smart_money`, `quiet_accumulation`, `distribution_warning` declare a
`vani_rule` that yields **zero** flags. The flags are alive at source today
(37 `is_vani_smart`, 19 `is_vani_s2`, 109 distrib-or-weakness) — but they
fire on stocks averaging **₹3.98 Cr / ₹3.78 Cr** turnover, ~3× the presets'
own average. The two populations barely intersect. **Fixing D3 should revive
these on its own** — re-verify rather than patch separately.

## Build plan

| # | Change | Scope |
|---|---|---|
| 1 | Add 5 columns to the matview SELECT | migration, 6 presets |
| 2 | Enforce `universe` per preset in the matview | migration, fixes quiet_accumulation |
| 3 | Liquidity floor ADV ≥ ₹1 Cr | **all 14 presets** — matview SQL + direct fetchers |
| 4 | `contract` check class in the nightly integrity sweep | covers D1–D4 permanently |
| 5 | Re-verify the 3 VaNi rules revive; patch only if they do not | verification step |

Sizing for #3 (power_buy gate, candidates for 25 slots):
no floor **294** → 0.25 Cr **104** → 0.5 Cr **88** → **1 Cr 69** → 1.5 Cr 63.
₹1 Cr leaves comfortable headroom and matches the WG precedent.

### The guard (#4) — what makes this durable
A new check class asserting, per preset, that:
1. every column the UI will render exists in its source, and
2. is non-null for ≥1 row on the latest date, and
3. the returned rows respect the declared `universe`, and
4. a declared `vani_rule` produces ≥1 flag, and
5. rows respect the declared liquidity floor.

Structurally-absent column or universe violation = **critical** (fails the
step, dashboard red). 100%-null column or dead VaNi rule = **warning**.

This converts "Charan notices dashes in a screenshot" into a finding that
fires the night it happens — and it generalises to the next drift, not just
these five columns.

## Open decision (owner)

**Floor for the broad-discovery presets.** Breakout Surge (limit 500), Stage
4 Leaders (200), Stage 2/3 Watch (100) are deliberately wide surfaces; a
₹1 Cr floor cuts them meaningfully.
- **Option A (recommended):** uniform ₹1 Cr everywhere — consistent, and a
  stock you cannot trade does not belong in any list.
- **Option B:** ₹1 Cr for the curated 25-row presets, ₹0.25 Cr for the broad
  discovery ones — preserves smallcap reach at the cost of two rules.

## Verification before merge

1. Re-run the full audit matrix (all 17 presets × 5 dimensions) — every cell green.
2. `scripts/qa/scan-parity` for row-membership drift on the six matview presets.
3. Spot-check each preset's top 10 for tradeable turnover.
4. `python scripts/run_integrity_checks.py --dry-run` — zero findings.

Not "trust me" — the matrix is the evidence.
