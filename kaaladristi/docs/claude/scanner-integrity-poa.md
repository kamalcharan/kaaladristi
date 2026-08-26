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

### D4 — Three dead VaNi rules: a SEPARATE defect (hypothesis disproved)
`smart_money`, `quiet_accumulation`, `distribution_warning` declare a
`vani_rule` that yields **zero** flags.

The first hypothesis — that the liquidity flood caused this, since the flags
fire on stocks ~3x more liquid than the presets' picks — was **tested on
2026-08-24 and DISPROVED**:

| flag | stocks | NSE | clear the preset's own gate | clear everything |
|---|---|---|---|---|
| `is_vani_smart` | 37 | 14 | 4 (delivery > 60) | **0** |
| `is_vani_s2` | 19 | 9 | 0 (`accum_distrib='ACCUMULATION'`) | **0** |

The flags do not intersect these presets' gates **at any liquidity level**.
`is_vani_s2` is a Stage-2 quality overlay and has no reason to coincide with
quiet_accumulation's ACCUMULATION + rising-sniper selection — the rule
assignments are simply mismatched to what the presets select on.

**Left open deliberately.** Re-pointing a preset's `vani_rule` is a product
decision about intent, not a bug fix, and silently retuning a threshold so a
chip lights up would be worse than the dash. The nightly contract check
reports it as a warning until the owner decides.

## Build plan

| # | Change | Scope |
|---|---|---|
| 1 | Add 5 columns to the matview SELECT | migration, 6 presets |
| 2 | Enforce `universe` per preset in the matview | migration, fixes quiet_accumulation |
| 3 | Liquidity floor ADV ≥ ₹1 Cr | **all 14 presets** — matview SQL + direct fetchers |
| 4 | `contract` check class in the nightly integrity sweep | covers D1–D4 permanently |
| 5 | ~~Re-verify the 3 VaNi rules revive~~ — **tested, they do not** (D4 above). Left open for an owner call on intent. | open |
| 6 | `scripts/audit_scanner_contract.py` — repeatable completeness audit, all presets x 5 dimensions, exit 1 on any defect | verification |

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

## What the completeness audit caught that the build missed

Run against the pre-migration state before claiming completion, and it
found two things the hand-written migration had not:

1. **`flower_pot_burst`: 71 rows below the floor** — a matview preset that
   the first draft of migration 180 did not gate. Fixed: the floor is applied
   at final selection so the 140-day compression window feeding the FPB math
   stays complete.
2. **`waking_giants`: 6 rows apparently below the floor** — a false positive,
   not a defect. WG enforces ADV >= Rs 1 Cr on a **combined-exchange** basis
   (`wg_adv` sums each ISIN twin's 22-session average), which is stricter than
   and not comparable to the row-level NSE-only `avg_amt_22d`.

Both are the point of the exercise: the audit is what makes "complete" a
measured claim rather than an assertion.

### Post-refresh run (2026-08-25) — the audit's own blind spots

The first live run after the REFRESH still showed two liquidity defects, and
both turned out to be the audit measuring the wrong column:

- **`first_ascent`: 2 rows** (SHALBY 0.63 Cr NSE-only / **1.10 Cr combined**;
  JITFINFRA 0.58 / **1.11**). Same combined-exchange ADV story as
  `waking_giants` — the exemption prefix (`waking_giants`, `wg_`) simply did
  not match the preset id `first_ascent`.
- **`flower_pot_burst`: 40 rows** — i.e. *every* row. The FPB arm emits
  `NULL::numeric AS avg_amt_22d` on purpose (its column set never renders it),
  so `COALESCE(...,0)` scored the whole preset as illiquid. Joining the live
  EOD row proved the floor applied at final selection was working: 0 of 40
  genuinely below.

The fix is **not** a wider exemption list. `measure_liquidity()` in
`lib/integrity_checks.py` now scores each row on the yardstick that preset's
own gate uses — combined-exchange ADV for the WG family, a live-EOD fallback
where the arm emits no column — and both the nightly sweep and
`audit_scanner_contract.py` call it, so they can never disagree. Rows with no
measurable turnover are reported separately rather than folded into "below
floor", which is what created the false positive in the first place.

That turns two waivers into two verifications, and the verification earns its
keep immediately: the post-fix minimums are 1.003 (FPB), 1.018 (power_sell),
1.035 (waking_giants), 1.099 (first_ascent). The floor is binding by hundredths
of a crore. An exemption would have hidden exactly that.
