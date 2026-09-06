# Handover — VaNi Level 2 for the remaining Price Action scanners

**Written** 2026-09-05 · **Scope owner** Charan · **Excluded by owner instruction:** `flower_pot_burst`

Everything below was verified against the live DB and the code on `main`
(`ae315422`). Numbers are measurements, not estimates. Where something is a
genuine open decision it is in **Open questions** at the end and is NOT
assumed away in the plan.

---

## 1. What "VaNi on a scanner" currently means

There are **two levels**, from the owner's "VaNi Two Levels" design
(2026-09-03, recorded in `BreakoutSurgeStudio.tsx`'s header comment).

### Level 1 — every preset already has this

`ScanVaNiPublisher` publishes the on-screen filtered rows into `vaniStore`,
and the chat panel offers two intents:

| Intent | Label |
|---|---|
| `scanner.explain_preset` | "What does this screener show?" |
| `scanner.read_results` | "Read today's results" |

Rendered by the generic `ScanView` layout for every non-Studio preset. This
is the layer `docs/claude/scannerenhancement.md` criticised as generic and
repetitive — it narrates a 25-row sample (`MAX_ROWS = 25` in
`ScanVaNiPublisher.tsx`) as if it were the whole result set, and has no
comparison point day to day.

**Nothing in this handover changes Level 1.**

### Level 2 — only `breakout_surge` has this

`views/BreakoutSurgeStudio.tsx` (641 lines) replaces the generic layout with
stat tiles, quick filters, and **seven scanner-level intents** rendered as
inline cards, each carrying a `mode` that filters or highlights the table
below it. Facts come from `services/breakoutSurgeInsights.ts` (359 lines) —
pure functions over the FULL fetched result set, never a sample. That is the
"compute in code, narrate in prose" split.

The seven, and what each needs:

| # | Intent | Fact builder | Data dependency |
|---|---|---|---|
| 1 | `momentum_gap` | `computeMomentumGapFacts` | `score_5d` / `score_22d` |
| 2 | `leading_industry` | `computeLeadingIndustryFacts` | `industry` on the rows |
| 3 | `why_flagged` | `computeHighlightExplainFacts` | the preset's own `vani_rule` |
| 4 | `sector_leading` | `computeSectorLeadingFacts` | `km_industry_eod.industry_rank` |
| 5 | `new_since_yesterday` | `computeNewSinceYesterdayFacts` | `km_scan_membership_daily` |
| 6 | `rs_flip` | `computeRsFlipFacts` | `km_scan_membership_daily` |
| 7 | `is_unusual` | `computeIsUnusualFacts` | `km_scan_membership_daily`, 3+ prior days |

**"Give VaNi to the other price-action scanners" = give them Level 2.**

---

## 2. The targets

Every active `category = 'price_action'` preset, from `kd_scan_presets`:

| Preset | Level 2? | `vani_rule` | Side | On Discovery board? |
|---|---|---|---|---|
| `breakout_surge` | **yes** | `is_vani_surge_or_breakout` | strength | yes (`Surge`) |
| `flower_pot_burst` | no | *(none)* | strength | yes (`Burst`) | ← **excluded by owner** |
| `weekly_movers` | no | `is_vani_surge_or_breakout` | — | **no** |
| `monthly_movers` | no | `is_vani_surge_or_breakout` | — | **no** |
| `breakdown_watch` (Breakdown Surge) | no | `is_vani_weakness` | — | **no** |
| `weekly_decliners` | no | `is_vani_weakness` | — | **no** |
| `monthly_decliners` | no | `is_vani_weakness` | — | **no** |
| `gl_breakout` | no | `gl_event_any` | strength | yes (`GL`, cap 12) |
| `gl_retest` | no | `gl_event_any` | strength | yes (`GL`, cap 12) |

So **five certain targets**, plus the two Golden Line scanners depending on
the answer to Open question 1.

Note the second, separate gap this table exposes: those same five presets have
a `vani_rule` but **no `vani_side` / `vani_short_label`**, which is what opts a
preset into the VaNi Discovery board (`fetchVaniHighlights` in
`scanEngine.ts:2873` filters on `vani_side != null`). That is a pure DB update
— see §6.

### The direction split matters more than the count

| Side | Presets |
|---|---|
| Strength | `weekly_movers`, `monthly_movers` (+ `gl_breakout`, `gl_retest`) |
| **Caution** | `breakdown_watch`, `weekly_decliners`, `monthly_decliners` |

Three of the five are weakness scanners, and the existing Level 2 is written
end-to-end in strength language. That is the single biggest piece of real work
here — see §4.

---

## 3. What already generalises (the good news)

**`compute_scan_membership_snapshot.py` reads `km_equity_eod`, not the
matview.** Its own docstring says so: *"Works identically for today or any past
date — km_equity_eod carries full history, unlike km_scan_results."* It already
takes `--from` / `--to`.

This is the finding that most changes the shape of the work. It means a newly
registered preset can have its membership **backfilled to full history in one
run**, so the three day-over-day intents (`new_since_yesterday`, `rs_flip`,
`is_unusual`) work on **day one** for a new preset. There is no "wait three
sessions for a baseline" phase, which is what the design originally assumed.

Extending it is the shape the file invites:

```python
SNAPSHOT_PRESET_IDS = ['breakout_surge']          # → add ids here
PRESET_MEMBERSHIP_FNS = {'breakout_surge': _membership_breakout_surge}
```

Each new entry is one function mirroring that preset's arm in migration 197 —
same `WHERE`, same `ORDER BY`, same display cap.

**Four of the seven fact builders are already preset-agnostic** and need no
change at all:

- `computeMomentumGapFacts` — pure `score_5d` vs `score_22d`
- `computeLeadingIndustryFacts` — industry counts within the cohort
- `computeSectorLeadingFacts` — join to `industry_rank`
- `computeIsUnusualFacts` — today's count vs the trailing average

`computeNewSinceYesterdayFacts` is agnostic too, given a snapshot for the
preset.

**The Studio shell is more generic than its name suggests.** `'breakout_surge'`
is hardcoded in only ~8 places, and the title already reads `meta?.name` from
the DB preset. `ScanTable`, `ScanFilterBar`, `DownloadXlsButton`,
`useScanMembershipHistory` all take a `presetId` already.

---

## 4. What does NOT generalise (the real work)

### 4a. `computeHighlightExplainFacts` — explicitly must not be reused

Its docstring states the constraint plainly: it is grounded in what
`is_vani_surge_or_breakout` measures (RVOL + closeness to the 52-week HIGH + RS
strength) and *"NOT a reward-to-risk/ATR story — that mechanism belongs to a
different vani_rule entirely and does not apply here."*

The three caution presets run `is_vani_weakness`. Feeding them
`avgPctOf52wHigh` would produce a confidently wrong answer, not a degraded one.
A weakness-side builder needs the mirror measures (proximity to the 52-week
LOW, RS weakness, the bar `backfill_vani_flags.py`'s `is_vani_weakness` SQL
actually applies).

`gl_breakout` / `gl_retest` run `gl_event_any` — a **third** rule again, so
they need their own (distance from the Golden Line, `gl_days_above`, whether
the SVD/SBD landed within the ±5-day window).

### 4b. `computeRsFlipFacts` is polarity-locked

Hardcoded to "crossed INTO `BULLISH_ZONES`". On a decliners scan the
meaningful event is the opposite crossing. One boolean parameter, but it
changes the intent's label and its whole prompt.

### 4c. `isAccelerating` and `buildWhyTags` are strength-only

```ts
isAccelerating = score_5d > 0 && score_5d >= score_22d
buildWhyTags   → 'At 52W high', 'Not yet overbought', 'Above 50 & 150-day trend'
```

Every tag reads as strength. On a decliners scan they are either meaningless or
actively misleading.

### 4d. Backend prompts are strength-worded

`lib/vani_intents.py` — `scanner.momentum_gap` says *"pulled furthest ahead of
their own recent pace"*; `scanner.leading_industry` says *"which industry is
leading"*. The intents do receive `preset` in `required_context`, so the model
sees which scanner it is, but the system prompt's framing is baked in.

Two options, and this is Open question 2: neutral rewording that serves both
sides ("moved furthest from its own recent pace"), or `.caution` variants of
each intent. Neutral rewording is fewer moving parts and is more obviously
D39-safe; per-side variants read better.

### 4e. Stat tiles

`computeCohortStats` returns `brokeOutCount`, rendered as **"Broke Out
Today"**. Needs a per-preset label, and for the caution presets the whole tile
row wants different measures.

---

## 5. Data readiness — one real blocker

Measured 2026-09-05 on `km_equity_eod`:

| Column | Feeds | Coverage |
|---|---|---|
| `pct_wtd` | weekly_movers / decliners | ~99.6% back to 1996 |
| `pct_mtd` | monthly_movers / decliners | ~99.6% back to 1996 |
| `pct_from_breakout` | breakout_surge | ~99.6% back to 1996 |
| `pct_from_breakdown` | **breakdown_watch** | **~6% before 2026-08-27**, full only from Sept |

Per-month, `pct_from_breakdown`: 9,492 of 142,867 bars (Apr) … 30,907 of
156,967 (Aug) … 29,999 of 30,023 (Sep). About 450 stocks a day historically.

Migration 195 predicted exactly this — *"the history backfill has not been
run"* — and it still has not. **`scripts/backfill_rolling_metrics_fast.py`
must run before `breakdown_watch` membership is backfilled**, or its history
will be a 6% sample and `is_unusual` will compare today's real count against a
fake baseline.

Convenient overlap: that same script is already queued for the Big Money work
(PR #279 lists it under "deeper history"). One run serves both.

Current snapshot table state:

```
preset_id        days  first_day    last_day     rows
breakout_surge   12    2026-08-20   2026-09-04   3,151
```

Adding five presets at their 500-row caps takes the daily write from ~260 rows
to roughly 2,500 — trivial for the table, worth knowing for the backfill run
time.

---

## 6. Proposed plan

Ordered so each step is independently shippable and nothing waits on a
decision it does not need.

**Step 0 — the free win (DB only, no code).**
Set `vani_side` / `vani_short_label` on the five presets so they appear on the
VaNi Discovery board. `weekly_movers` / `monthly_movers` → `strength`;
`breakdown_watch` / `weekly_decliners` / `monthly_decliners` → `caution`. A
`vani_cap` is worth considering — these are 500-row scans against
`gl_breakout`'s cap of 12, and uncapped they will swamp the board. One
migration, no deploy. *(This is a genuinely separate feature from Level 2 — it
is listed here because the same five presets are the gap, and it is one SQL
statement.)*

**Step 1 — run `backfill_rolling_metrics_fast.py`.** Unblocks
`breakdown_watch` and serves the Big Money work at the same time.

**Step 2 — extend the membership snapshot.** Add the five (or seven) preset
ids and their membership functions, each mirroring migration 197's arm.
Backfill with `--from`. After this, all three day-over-day intents work
immediately for every registered preset.

**Step 3 — split `breakoutSurgeInsights.ts` into shared + per-side.**
Keep the five agnostic builders as-is. Introduce a small per-preset descriptor
carrying: the highlight-explain builder for that `vani_rule`, the RS-flip
polarity, the accelerating/decelerating predicate, the why-tag set, and the
stat-tile labels. A record keyed by preset id, in the spirit of
`SCAN_HANDLERS` — not a `switch` scattered through the Studio.

**Step 4 — parameterise the Studio.** `BreakoutSurgeStudio` →
`ScannerStudio({ presetId })`, reading its descriptor. Keep the
`breakout_surge` route working identically; this should be a no-visible-change
refactor for that preset, which makes it easy to verify.

**Step 5 — caution-side prompts.** Either neutral rewording of the seven, or
`.caution` variants. Depends on Open question 2.

**Step 6 — route the remaining presets to the Studio** in `ScanView.tsx`,
replacing the current single `if (presetId === 'breakout_surge')` branch with
a set membership test.

---

## 7. Verification, when it is built

- `breakout_surge` must render byte-identically after step 4 — it is the
  control.
- For each new preset: all seven cards render, none says a number that
  contradicts the table under it.
- The three day-over-day intents must return **null** (card hidden), never a
  fabricated count, when a preset's snapshot history is missing — the existing
  null-guards do this; confirm the new presets inherit them.
- Every caution-side string re-read against **D39**: no bull/bear, uptrend/
  downtrend, or directive verbs in any badge, label or narration. "Turned
  RS-red" is a phrase to think hard about before shipping.
- `npm run typecheck && npm run build` (the theme ratchet runs inside build).

---

## 8. Key files

| File | Role |
|---|---|
| `App/frontend/src/views/BreakoutSurgeStudio.tsx` | the Level 2 page to generalise |
| `App/frontend/src/services/breakoutSurgeInsights.ts` | the 7 fact builders |
| `App/frontend/src/views/ScanView.tsx` (~1298) | the Studio routing branch |
| `App/frontend/src/services/scanEngine.ts` (~2873) | `fetchVaniHighlights`, the Discovery board |
| `App/backend/lib/vani_intents.py` (~848+) | the 7 intent prompts |
| `App/backend/scripts/compute_scan_membership_snapshot.py` | `SNAPSHOT_PRESET_IDS`, membership fns |
| `App/backend/scripts/backfill_vani_flags.py` | what each `is_vani_*` rule actually measures |
| `App/DBscripts/km_migration_197_fpb_latest_alignment.sql` | the arms to mirror in membership fns |
| `docs/claude/scannerenhancement.md` | the design's own critique of Level 1 |

---

## 9. Open questions for the owner

1. **Do `gl_breakout` and `gl_retest` count as "price action"?** They carry
   `category = 'price_action'` in the DB, but they are Golden Line scanners
   with their own `gl_event_any` rule and are already on the Discovery board.
   Including them means a third highlight-explain builder. Five targets or
   seven?

2. **How should the caution side be worded?** Neutral phrasing that serves
   both directions ("moved furthest from its own recent pace", "most
   represented industry"), or explicit caution-side variants of the seven
   intents? Neutral is fewer moving parts and more obviously D39-safe;
   per-side reads better. This also decides whether `rs_flip` on a decliners
   scan is even offered — "turned RS-red" may be too directional for D39.

3. **Does every preset need a full Studio page?** Six more pages with stat
   tiles, quick filters and export buttons is a lot of surface for scans that
   are essentially one sorted column. The alternative is a **middle tier**:
   the seven intent cards bolted onto the existing generic `ScanView` layout,
   with the full Studio reserved for `breakout_surge` and perhaps the Golden
   Line pair.

4. **Cap the five on the Discovery board?** Step 0 puts up to 500 rows per
   preset in front of `fetchVaniHighlights`. `gl_breakout` uses
   `vani_cap = 12`. What should these five use?

5. **Membership backfill horizon** — all history, or a bounded window? Full
   history is cheap to write but `is_unusual` only ever reads the trailing few
   sessions, so a year would do.

6. **Should Level 1 be fixed at the same time?** `scanner.read_results`
   narrates a 25-row sample as though it were the full set — a known
   correctness problem, called out in both `scannerenhancement.md` and
   `BreakoutSurgeStudio.tsx`'s own comments. It affects every scanner, not
   just these five. Separate task, or fold it in?
