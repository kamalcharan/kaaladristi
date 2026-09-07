# Gap audit — Breakout Surge vs the other Price Action scanners

**Written** 2026-09-06 · **Baseline** `breakout_surge` (the Studio control) ·
**Compared** the eight other active `category = 'price_action'` presets ·
**Exception** `flower_pot_burst` — the owner's instruction is that it keeps
its own UX; it is audited here for awareness, not for unification.

Everything below is read off the code on `main` (`06edf2c`) and the live DB.
"Gap" means *Breakout Surge has it and the preset does not*. Gaps that make a
number or an ordering WRONG are marked **bug**; gaps that withhold a capability
are marked **capability**; gaps that are only presentation are marked *UX* —
and per the owner, UX parity is not the aim, so those are listed last and
lightly.

---

## 1. The matrix

✓ = parity with Breakout Surge · **✗** = gap · — = not applicable

| Axis | wk_movers | mo_movers | wk_decl | mo_decl | breakdown | gl_breakout | gl_retest | flower_pot |
|---|---|---|---|---|---|---|---|---|
| Studio (Level 2) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (exception) |
| 7 intent cards | ✓ | ✓ | ✓ | ✓ | ✓ | 6 (by design) | ✓ | ✗ |
| Own `why_flagged` builder + prompt | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (no rule) |
| Membership snapshot / day-over-day | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Matview arm (`km_scan_results`) | ✓ | ✓ | ✓ | ✓ | ✓ | **✗** | **✗** | ✓ |
| Tab-strip count badge | ✓ | ✓ | ✓ | ✓ | ✓ | **✗** | **✗** | **✗** |
| **Table default sort = scan's own rank** | **✗ bug** | **✗ bug** | **✗ bug** | **✗ bug** | **✗ bug** | **✗ bug** | **✗ bug** | ✓ |
| Preset-native filter bounds | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | ✓ (own) |
| RVOL-min control visible in filter bar | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | — |
| XLS export carries the preset's metric | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** |
| Chart setup / thesis adapter | ✓ | ✓ | ✓ | ✓ | ✓ | **✗** | **✗** | ✓ |
| Columns picker: all 81 columns real | ✓ | ✓ | ✓ | ✓ | ✓ | **✗** | **✗** | ✓ |
| Discovery board | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (cap 12) | ✓ (cap 12) | ✓ |
| VaNi Level 1 (chat context) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mobile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data history for the ranking column | ✓ | ✓ | ✓ | ✓ | ✓ (since backfill) | ✓ (1996→) | ✓ | — |

---

## 2. The two bugs — fix these regardless of any UX decision

### 2a. Table view re-sorts seven scanners by Magic RS, discarding their own ranking

`ScanTable`'s `DEFAULT_SORT` map has an entry for `breakout_surge`
(`score_5d desc`) and `flower_pot_burst` — and **none** for the seven others.
Its own fallback is `magic_rs desc`, and the map's own comment (written for
Volume Drive) names the consequence: *"Without an entry here the table falls
through to magic_rs desc, which silently discards that ranking — and magic_rs
measured 0.85x (INVERTED) against a next-day move."*

So in table view, Weekly Movers is ordered by Magic RS, not week-to-date gain;
Breakdown Surge by Magic RS, not depth below the floor; Golden Line Retest by
Magic RS, not sessions held. The fetcher and the matview rank correctly; the
table throws the ranking away on mount. The cards view keeps the fetched
order, which is why the two views of the same scan disagree.

**Fix:** seven map entries — `pct_wtd desc`, `pct_mtd desc`, `pct_wtd asc`,
`pct_mtd asc`, `pct_from_breakdown asc`, `pct_from_gl desc`,
`gl_days_above desc` — mirroring each fetcher/arm. One file. The header
indicator (`▼`) then names the real ranking column, as it does on Breakout
Surge.

### 2b. Golden Line tabs (and Flower Pot) have no count badge

`fetchAllScanCountsFromMatview` counts `[...MATVIEW_BUNDLE_PRESETS,
...MATVIEW_PRICE_ACTION_PRESETS]` only. The GL pair have no matview arm and
`flower_pot_burst` is not in either list, so their tab chips render without
the count every other Price Action tab carries. Not wrong data — missing
data — but it reads as "this scan is empty" next to siblings showing `500`.

**Fix:** either add the two GL arms to the matview (the structural fix, see
§3a) or have `getAllScanCounts` fall through to `executeScan(...).length` for
presets outside the matview lists. The second is ~10 lines; the GL cohorts are
17 and 2 rows, so the cost is nothing.

---

## 3. Capability gaps — Breakout Surge can do it, these cannot

### 3a. The Golden Line pair live outside the matview

Everything the matview gives Breakout Surge, the GL pair lack:

- **Columns picker shows dashes** for every column `fetchGlEvents` does not
  select — `xamt`, the six `rel_*` columns, `magic_rs_trend`,
  `prev_week_close`/`pct_wtd`, `prev_month_close`/`pct_mtd`,
  `breakdown_level`/`pct_from_breakdown`, stage fields. The `ScanTable`
  comment that motivated the matview-first path names exactly this failure.
- No `history_insufficient` / `guard_notes` audit columns.
- No tab count (§2b).
- On the Discovery board they are direct queries rather than one matview read.

The reverse gap is small but real: `km_scan_results` carries **no**
`pct_from_gl`, `gl_event`, `gl_days_above`, `bm_event` or `bm_ratio`, so on
Breakout Surge (and every matview preset) the *"vs GL"* / *"GL Event"* columns
in the picker show dashes.

**Fix:** a migration adding `gl_breakout` / `gl_retest` arms to
`km_scan_results` (copying `fetchGlEvents`' filter and rank — NSE, ISIN-dedup,
`gl_event = X`, no price/EMA gate, cap 200) and adding the GL + Big Money
columns to the view's projection. Then move the pair into
`MATVIEW_PRICE_ACTION_PRESETS`, keep `fetchGlEvents` as the fallback, and
point the membership script's `_GL_POOL` note at the new arm. This is the
single change that closes the most cells in the matrix.

### 3b. Filter bar: only Breakout Surge gets bounds on its own metric

`getFilterGroup` routes `breakout_surge` to a `breakout` group — **RVOL Min**,
**% From Brk Min / Max**, 5D Move — and the seven others to `standard`:
Score 5D/22D Min and 5D/22D/66D Move only. So there is no way to ask Weekly
Movers for "between +3% and +8% WTD", Breakdown Surge for "more than 5% below
the floor", or Golden Line Retest for "held at least 20 sessions". The
scan's own ranking column is the one thing you cannot filter on.

**Fix:** a `metric` group keyed off the descriptor's ranking column — one
min/max pair labelled from `fieldConfig` — plus RVOL Min. The `applyFilters`
side already handles `rvolMin` and the min/max pattern; this is mostly the
seven-line JSX branch.

### 3c. The Studio's "Real Volume Behind" tile sets a filter the bar cannot show

The tile toggles `filters.rvolMin = 3`. `applyFilters` honours it on every
preset, and "Filters · N" counts it — but the **RVOL Min input only renders in
the `breakout` and `drive` groups**. On the seven others the user gets an
active, counted, invisible filter that only Reset can clear. Closed for free
by §3b.

### 3d. XLS export drops the preset's own metric

`downloadScanXls` has bespoke rows for `conviction_flow` and `breakout_surge`
(Breakout Level, % from Brk, D% from EMA20, 5D/22D Ret%). The other seven use
`baseRow`, which carries **no** `pct_wtd`/`pct_mtd`/prev close, no breakdown
level, no GL fields, and no `score_5d`/`score_22d` — the export of Weekly
Movers does not contain week-to-date gain. Flower Pot's export likewise lacks
its compression fields.

**Fix:** one generic `metricRow(descriptor)` variant that appends the
descriptor's `cardLevels` plus Score 5D/22D and 5D/22D returns, replacing
`xlsVariant: 'default'` on the seven. Breakout Surge's bespoke row stays.

### 3e. Golden Line pair have no chart-setup adapter

`SETUP_ADAPTERS` is registered for every other Price Action preset (including
both decliners and Breakdown Surge, whose 300-line adapters exist and are
wired). `gl_breakout` / `gl_retest` are absent, so a row click goes to the
chart **without** `&tab=chart&setup=…` — no thesis/setup tab for the Golden
Line story, where every sibling has one.

**Fix:** two adapters (or one parameterised on the event), following
`breakoutSurge.ts`. Real content work, not plumbing — the Golden Line story
(reclaim vs retest, sessions held, the 150-day mean) has to be written.

---

## 4. Where Breakout Surge itself is behind the *generic* layout

Not gaps vs the baseline — gaps *of* the baseline, inherited by all eight
Studios, listed so nobody mistakes the Studio for a superset:

- **`ScanStalenessBanner`** — the generic layout warns when the visible rows
  are older than the latest trade date; the Studio does not render it.
- **`AtmosphericBadge`** — rendered on the generic and Stage 2 layouts, not on
  the Studio.

Both are one `<Component />` each in `ScannerStudio.tsx`.

---

## 5. Flower Pot Burst — the exception, for awareness only

What it has that no other preset has: a phased layout (Bursts / Shatters /
Coiling Setups), the `FpbActiveSection` release list, its own filter group
(Tightness, Coiled Days, Delivery%), its own table columns and default sort,
its own adapter. It is on the matview and on the Discovery board (`Burst`).

What it lacks relative to the baseline: everything Level 2 — no Studio, no
intent cards, no membership snapshot, and above all **no `vani_rule`**, so
`vaniOpportunity` is false on every row, the ✦ chip never lights, and the
`why_flagged` question has nothing to compute. Its Discovery-board presence
therefore depends entirely on the matview's `vani_flag` expression for its
arm, not on any rule the app can explain.

Per the owner these are not to be unified. The one item worth a decision on
its own merits is the missing `vani_rule`: with none, "Burst" on the
Discovery board is a label without a definition.

---

## 6. Recommended order

1. **§2a sort map** — seven lines, fixes wrong ordering on seven scanners.
2. **§2b counts** — the ten-line fallthrough, or wait for §3a.
3. **§3b + §3c filter group** — one JSX branch, closes two rows of the matrix.
4. **§3d export row** — one variant.
5. **§3a GL matview arms** — a migration; closes the pair's remaining gaps.
6. **§3e GL adapters** — content work; schedule separately.
7. **§4** — two lines, whenever the Studio is next touched.
