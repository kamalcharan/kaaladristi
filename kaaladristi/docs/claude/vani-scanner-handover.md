# Handover — VaNi Level 2 for the remaining Price Action scanners

**Written** 2026-09-05 · **Scope owner** Charan · **Excluded by owner instruction:** `flower_pot_burst`

Everything below was verified against the live DB and the code on `main`
(`ae315422`). Numbers are measurements, not estimates. Where something is a
genuine open decision it is in **Open questions** at the end and is NOT
assumed away in the plan.

---

## 0. Next session starts here

**Done and on `main`:** the refactor (§12) and scanners 1–4 —
`weekly_movers`, `monthly_movers`, `weekly_decliners`, `monthly_decliners`.
Four of the five targets are finished, and the whole caution side is written:
`computeWeaknessExplainFacts`, the `isDecelerating` pace predicate, the
`gapBehind` orientation, the `rs_flip` polarity switch, the "Not oversold"
toggle, and the `scanner.why_highlighted_weakness` prompt.

**Next:** scanner 5, `breakdown_watch` — the last one, deliberately last
because of the §5 history gap. It is another two-edit preset, reusing every
caution constant unchanged:

- a descriptor entry, differing from `weekly_decliners` only in `countLabel`,
  `exportName`, `displayName` and its `cardLevels` (`breakdown_level` /
  `pct_from_breakdown`);
- one `PRESET_MEMBERSHIP_FNS` entry copied from migration 197's arm —
  `qualify='pct_chng < 0 AND pct_from_breakdown < 0'`,
  `order='pct_from_breakdown ASC, equity_id'`, cap 500. Note the pool must
  also project `e.pct_from_breakdown`, the way `pct_mtd` had to be added for
  scanner 2.

**Its Studio works on day one; its day-over-day cards do not.**
`pct_from_breakdown` is ~6% populated before 2026-08-27 (§5), so a membership
backfill run today writes a 6% sample as "history" and `is_unusual` would
compare a real count against a fake baseline. Run
`backfill_rolling_metrics_fast.py` BEFORE backfilling this preset's
membership. Registering it and backfilling only from 2026-08-27 forward is the
safe alternative if that script still has not run.

**Mind the ASC** on every one of the three caution arms — they rank the
largest LOSS (or the deepest breakdown) first. Copying the `DESC` from a movers
twin would snapshot the 500 smallest moves while the UI shows the 500 largest:
two disjoint sets, and every day-over-day diff meaningless.

**Owner action still outstanding** — nothing downstream is blocked on it, but
three intent cards stay hidden until it runs:

```
cd App/backend
python scripts/compute_scan_membership_snapshot.py --from 2026-08-20
```

This backfills `weekly_movers`, `monthly_movers`, `weekly_decliners` and
`monthly_decliners`, AND re-writes
`breakout_surge`'s existing 12 days under the corrected membership rule.
**Read §12's bug note before assuming any snapshot history is comparable** —
history written before 2026-09-05 used a wider pool than the matview actually
showed.

Two other owner-run items are carried from earlier work and are unrelated to
this task, but a session touching the pipeline will meet them:
`km_migration_199_user_bookmarks_grants.sql`, and
`backfill_rolling_metrics_fast.py` (which §5 needs before `breakdown_watch`,
and which the Big Money work also wants).

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

## 9. Owner decisions (2026-09-05) — questions closed

1. **Five targets.** `gl_breakout` / `gl_retest` are OUT of scope despite
   carrying `category = 'price_action'`. The five are `weekly_movers`,
   `monthly_movers`, `breakdown_watch`, `weekly_decliners`,
   `monthly_decliners`.

2. **SEBI wording is already solved — do not re-litigate it.** Use the
   vocabulary the platform already ships and has cleared: `ZONE_LABELS` in
   `constants/signalScale.ts` (Leading / Improving / Neutral / Weakening /
   Lagging) and the D39 ROC badge set (expanding / slowing / turning /
   contracting / warming_up). The caution side is written in that vocabulary,
   NOT in invented phrasing. Concretely: `rs_flip` on a decliners scan reads
   as a move **into Weakening/Lagging**, never "turned RS-red"; the
   momentum-gap prompt says "moved furthest from its own recent pace"
   rather than "pulled ahead". No new compliance review is needed for
   wording that stays inside the approved sets.

3. **Full parity with Breakout Surge.** Every one of the five gets the same
   Level 2 treatment — stat tiles, quick filters, the seven intent cards,
   export buttons, table/cards toggle. No middle tier.

   Two execution constraints attached to this:

   **Mobile responsiveness is a requirement, not an afterthought.** Current
   state, verified: the Studio's stat row is already fluid
   (`repeat(auto-fit, minmax(160px, 1fr))`), its header and card rows use
   `flexWrap`, and `ScanTable` already scrolls horizontally
   (`overflowX: 'auto'`) with a sticky symbol column. So the shell is
   inherited-responsive and the job is to not regress it — and to check the
   intent-card row and the stat tiles at narrow widths, which is where a
   seven-card row is most likely to break.

   **One scanner at a time, finished before the next starts.** No partial
   rollout across several presets at once.

---

## 10. Build order

Derived from the `vani_rule` each preset carries, which decides how much
per-preset work it actually needs:

| Order | Preset | `vani_rule` | New fact-builder work |
|---|---|---|---|
| 0 | *(refactor)* | — | parameterise the Studio; `breakout_surge` is the control and must render identically |
| 1 | `weekly_movers` | `is_vani_surge_or_breakout` | **none** — same rule as `breakout_surge` |
| 2 | `monthly_movers` | `is_vani_surge_or_breakout` | **none** |
| 3 | `weekly_decliners` | `is_vani_weakness` | the weakness-side builder (serves all three) |
| 4 | `monthly_decliners` | `is_vani_weakness` | reuses #3 |
| 5 | `breakdown_watch` | `is_vani_weakness` | reuses #3; **last** because of the `pct_from_breakdown` history gap in §5 |

The two movers share `breakout_surge`'s exact rule, so
`computeHighlightExplainFacts` applies to them unchanged and no caution-side
prompt variant is needed — which makes them the right pair to validate the
refactor against. All three decliners share one rule, so the weakness-side
builder is written once, at step 3.

`breakdown_watch` goes last on purpose: its Studio works today, but its three
day-over-day intents stay null-guarded (cards hidden) until
`backfill_rolling_metrics_fast.py` has run. Placing it last gives that run the
most time to happen without blocking anything else.

---

## 11. Still open — not blocking, owner to decide when convenient

- **Discovery board opt-in (§6 Step 0).** The five presets have a `vani_rule`
  but no `vani_side`, so they never reach `fetchVaniHighlights`. One migration.
  Needs a `vani_cap` decision: these are 500-row scans and `gl_breakout` caps
  at 12.
- **Membership backfill horizon** — full history, or a bounded window? A year
  is ample; `is_unusual` only reads the trailing few sessions.
- **`scanner.read_results` narrates a 25-row sample as the full set.** A real
  correctness bug affecting every scanner, not just these five. Separate task.

---

## 12. Progress log

### 2026-09-05 — Step 0 (refactor) + Scanner 1 (`weekly_movers`)

**Refactor.** `BreakoutSurgeStudio` → `ScannerStudio({ presetId })`. The shell
was already more generic than its name: the title read `meta.name` from the DB,
and `ScanTable` / `ScanFilterBar` / `useScanMembershipHistory` / `ScannerVaNiCard`
all took a `presetId` already. What was hardcoded was the id itself (eight
places) and the handful of strings that encode what the scan MEANS. Those moved
to `config/scannerStudio.ts`.

`ScanView` now routes on `STUDIO_PRESET_IDS.has(presetId)` instead of one
`=== 'breakout_surge'` branch, so scanner 2 is a descriptor entry, not another
branch.

Three functions became injectable rather than assumed:
`computeCohortStats(rows, pace?)`, `computeMomentumGapFacts(rows, pace?)`, and
the RSI quick-toggle test. All default to the existing strength behaviour, so
`breakout_surge` is unchanged — it is the control, and it renders identically.

`BreakoutSurgeCards` takes the descriptor for its third data row (breakout level
and distance on Breakout Surge; prior-week close and WTD% on the movers) and its
empty state. Its `fmtBrkPct` hardcoded a `+` prefix — correct for a breakout
distance, which the scan's own gate makes positive, wrong for anything that can
go negative. Replaced with a signed formatter; output is identical wherever the
value was already positive.

**A real bug found while mirroring the arm, and fixed.**
`_membership_breakout_surge` omitted `ema_20 IS NOT NULL`, which `eq_base` — and
therefore every matview arm — carries. Measured on 2026-09-04: the faithful rule
yields **270** rows, exactly matching `km_scan_results`; the shipped function
wrote **284**. A 5% over-collection every day since 2026-08-20.

It matters because this table is *diffed*: a snapshot wider than what the UI
showed makes `new_since_yesterday` **under-report**, since a stock already in
yesterday's over-wide set never reads as new. The membership SQL is now one
shared pool mirroring `pa_pool`/`pa`, with each preset supplying only its own
`WHERE` and `ORDER BY`, copied from its CTE in migration 197.

ISIN de-duplication was restored at the same time. It changes nothing today
(weekly_movers reads 1,012 either way, the pool being NSE-only already), but two
NSE listings sharing an ISIN would otherwise both enter.

**Mobile.** No layout was altered. The shell is inherited-responsive and was
re-checked rather than assumed: stat tiles are `repeat(auto-fit,
minmax(160px, 1fr))` (two columns at 375px), the header, intent-pill row and
filter row all `flexWrap`, and `ScanTable` scrolls horizontally with a sticky
symbol column.

**Verified:** `npm run typecheck` + `npm run build` clean (theme ratchet passes);
the generated membership SQL run against the live DB returns 500 for
`weekly_movers` on 2026-09-04, matching the matview's 500, and 270 for
`breakout_surge`, matching its 270.

**Owner action required before `weekly_movers`'s day-over-day intents work:**

```
cd App/backend
python scripts/compute_scan_membership_snapshot.py --from 2026-08-20
```

That backfills `weekly_movers` and — necessarily — **re-writes `breakout_surge`'s
existing 12 days** under the corrected rule, so the two are comparable. Until it
runs, `weekly_movers` shows four of seven intent cards; the three day-over-day
ones stay hidden by their existing null-guards rather than showing a wrong
number. A wider `--from` is fine and cheap; `is_unusual` only reads the trailing
few sessions.

### 2026-09-06 — Scanner 2 (`monthly_movers`)

Exactly the two edits §0 predicted, and nothing else — the refactor held, so
this scanner cost no new fact builder, no prompt wording and no new branch.

**Descriptor** (`config/scannerStudio.ts`). `monthly_movers` is the third
preset on `is_vani_surge_or_breakout`, so `computeHighlightExplainFacts`,
`STRENGTH_PACE`, `STRENGTH_RSI_QUICK` and the cleared `rs_flip` question text
all apply unchanged. What differs is only what the scan MEANS: the count tile
reads "Above Last Month's Close" (the gate is a position against the prior
month's close, not a claim about the month's path — same construction as
`weekly_movers`), and the card levels carry `prev_month_close` / `pct_mtd`.
Registration in `STUDIO_PRESET_IDS` is automatic, being `Object.keys`, so
`ScanView` routed it with no edit.

**Membership** (`compute_scan_membership_snapshot.py`). One
`PRESET_MEMBERSHIP_FNS` entry — `qualify='pct_mtd > 0'`,
`order='pct_mtd DESC, equity_id'`, cap 500 — copied from migration 197's
`monthly_movers` CTE, plus its id in `SNAPSHOT_PRESET_IDS` and `DISPLAY_CAP`.
The shared `_PA_POOL` had to project one more column (`e.pct_mtd`): the pool
must carry every field an arm's `qualify`/`order` names, which is the one part
of adding a preset that is not purely additive.

**Verified against the live DB, not assumed.** The generated SQL was run on
2026-09-04 and diffed set-wise against `km_scan_results`:

| Preset | membership fn | matview | only in fn | only in matview |
|---|---|---|---|---|
| `breakout_surge` | 270 | 270 | 0 | 0 |
| `weekly_movers` | 500 | 500 | 0 | 0 |
| `monthly_movers` | 500 | 500 | 0 | 0 |

The first two rows are the regression check that matters: widening the shared
pool's projection changed neither of the arms already shipped. Confirmed too
that `kd_scan_presets.monthly_movers` is active with `result_limit` 500 and
`vani_rule = 'is_vani_surge_or_breakout'`, so the cap and the rule are read off
the DB rather than inferred from `weekly_movers`.

`npm run typecheck` and `npm run build` clean (theme ratchet passes).

**Until the §0 backfill runs**, `monthly_movers` shows four of seven intent
cards. The three day-over-day builders return `null` on empty history
(`computeNewSinceYesterdayFacts`/`computeRsFlipFacts` on `!ctx.priorDate`,
`computeIsUnusualFacts` on `countHistory.length < 3`) and `readyByIntent`
hides the card rather than showing a fabricated count — inherited, not
re-implemented.

### 2026-09-06 — Scanner 3 (`weekly_decliners`) + two live bugs

The first caution-side scan, and the one §4 said would cost real design. It
did, but not only in the places §4 predicted — two shipped bugs had to be
fixed before the caution side could be honest, and both were found by reading
what the code actually does rather than by trusting the plan.

**Bug 1 — the weakness presets showed zero VaNi highlights, and always had.**
`fetchPeriodMovers` and `fetchBreakdownWatch` compute `vaniOpportunity` from
each preset's own `kd_scan_presets.vani_rule`, and all three weakness presets
carry `is_vani_weakness` — but neither query ever SELECTed that column. So
`computeVaniOpportunity` read `undefined` and returned false for every row.
Measured on 2026-09-04 against `km_scan_results`, whose migration-197 arms
select `is_vani_weakness` and had it right all along:

| Preset | UI showed | Truth |
|---|---|---|
| `weekly_decliners` | 0 | 9 |
| `monthly_decliners` | 0 | 10 |
| `breakdown_watch` | 0 | 5 of 210 |

This is the same class as the bug `isHighlight`'s own docstring records (the
flags are fetched but never copied onto `ScanStock`), one layer earlier. It had
to be fixed first: `why_flagged` is computed entirely over the highlighted
cohort, so on an empty cohort the new builder would have reported a truthful
zero about a false premise. Fixing it also lights the VaNi chip and the VaNi
filter on all three presets, which is a user-visible change independent of
Level 2.

**Bug 2 — `rs_flip` was telling the model to print "Strong Bull".** The
examples carried RAW `magic_rs_zone` values and the prompt said to reproduce
them verbatim, so the narration said bull/bear outright — which D39 forbids in
any displayed label. Latent on the strength side, unshippable on the caution
side, where a row reads `Neutral Bull → Strong Bear`. The examples now map
through `signalScale`'s `ZONE_LABELS` at the source, so both sides narrate
Leading / Improving / Neutral / Weakening / Lagging. **This changes
`breakout_surge`'s rs_flip narration** — the one place scanners 1–3 do not
leave it byte-identical, and deliberately so; the cache version is bumped to
v2 so no v1 answer written against the raw labels can be served.

**The caution side proper.** `computeWeaknessExplainFacts` is grounded in what
`is_vani_weakness` actually gates on, read off `backfill_vani_flags.py`:

```
magic_rs_zone IN ('Strong Bear','Mild Bear')
AND flow_type IN ('FRESH_SHORTS','LONG_LIQUIDATION')
AND rvol > 1.5 AND magic_rs < -10
```

So the facts are those four terms and nothing else: RVOL, the relative-strength
reading, and the band/flow composition that distinguishes this rule from every
other one. **§4a's suggested "proximity to the 52-week LOW" is deliberately
NOT included** — it is the tidy mirror of the strength builder's 52-week high,
but `is_vani_weakness` does not measure it, and reporting it as part of the bar
would repeat exactly the mistake `computeHighlightExplainFacts`'s docstring
warns against. (`is_vani_52wl` is a separate flag no preset here uses.)

Three things became per-side rather than assumed, all defaulting to the shipped
strength behaviour:

- `computeMomentumGapFacts(rows, pace, gapOf)` — the previous session left a
  note that a weakness cohort produces negative gaps and would sort smallest-
  divergence-first. `gapBehind` is the fix; both sides now sort "furthest from
  its own pace first" and `avgGap` is a positive distance either way. The
  Studio's table sort had duplicated the strength expression inline and now
  reads the same `gapOf`, so sort and narration cannot disagree.
- `computeRsFlipFacts(rows, ctx, into)` — same crossed-in-from-outside test,
  run against `BEARISH_ZONES`.
- `descriptor.highlight` pairs the intent id with its payload builder in ONE
  field, so a preset cannot get the weakness facts with the strength prompt.

**Wording, all from the approved sets (§9.2).** `Contracting` for the caution
pace tile — deliberately not "Slowing", which would say the opposite: on a
decliners cohort a 5-day score below the 22-day pace means the move is
steepening. `Not oversold` reuses the platform's own `is_vani_oversold` bar
(`rsi_14 < 30`), not a fresh threshold. The `leading_industry` question is
overridable and reads "Which industry is most represented here?" on the caution
side, because the fact underneath is representation, not leadership.

**Backend.** `scanner.why_highlighted_weakness` is a new intent rather than a
reworded shared one, because the FACTS differ and not just the tone.
`scanner.momentum_gap` and `scanner.rs_flip` ARE shared, so both were reworded
neutrally per §9.2 and both had their cache version bumped to v2.

**Verified.** Membership for `weekly_decliners` diffed set-wise against
`km_scan_results` on 2026-09-04: 500 vs 500, zero rows on either side. The
weakness prompt path was exercised end to end (sanitizer → cache key →
rendered prompt) on both a populated and an empty cohort; the rendered message
contains only approved band and flow labels. `npm run typecheck` and
`npm run build` clean.

**Still open, and now cheap.** `buildWhyTags` is strength-only, as §4c says —
but it is exported and called from nowhere. No caution twin was written rather
than add a second dead function; delete it or wire it before mirroring it.

### 2026-09-06 — Scanner 4 (`monthly_decliners`)

Two edits and nothing else, which is the point: it carries `is_vani_weakness`,
so it reuses `CAUTION_PACE`, `CAUTION_RSI_QUICK`, `CAUTION_HIGHLIGHT` and
`CAUTION_RS_FLIP` exactly as scanner 3 wrote them. No new fact builder, no new
prompt, no new intent. The caution-side design cost was paid once.

The descriptor differs from `weekly_decliners` in four strings and its
`cardLevels` (`prev_month_close` / `pct_mtd`). The membership arm is
`pct_mtd < 0` ordered `pct_mtd ASC` — ASC for the same reason its weekly twin
is: the arm ranks the largest loss first. The industry-question override was
hoisted to a shared `CAUTION_INDUSTRY_Q` now that a second preset uses it.

**Verified.** All five registered arms diffed set-wise against
`km_scan_results` on 2026-09-04 in one query:

| Preset | membership fn | matview | only in fn | only in matview |
|---|---|---|---|---|
| `breakout_surge` | 270 | 270 | 0 | 0 |
| `weekly_movers` | 500 | 500 | 0 | 0 |
| `monthly_movers` | 500 | 500 | 0 | 0 |
| `weekly_decliners` | 500 | 500 | 0 | 0 |
| `monthly_decliners` | 500 | 500 | 0 | 0 |

`npm run typecheck` and `npm run build` clean.

