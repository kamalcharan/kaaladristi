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

---

## 7. Why there are so many gaps when the code is "reusable"

The owner's challenge is right about the components and wrong about the
configuration, and the difference is the whole story.

The **buttons and engines are shared**: `ScannerExportButtons` (XLS + TV),
`ScanFilterBar`'s `applyFilters`, `ScanTable`, the VaNi publisher, the Studio
shell. Every Studio renders the same XLS button, the same TV button, the same
filter engine. None of the gaps in §2–§3 is a missing component.

What is **not shared is preset identity**. Each of these files carries its own
hand-maintained "what does preset X get" map, and a new preset must be added
to every one of them by hand or it silently falls to a default:

| # | File | Map / branch | Falls through to |
|---|---|---|---|
| 1 | `ScanTable.tsx` | `DEFAULT_SORT` | `magic_rs desc` (§2a — **wrong order**) |
| 2 | `ScanTable.tsx` | `PRESET_COL_OVERRIDES` | the category's generic columns |
| 3 | `ScanFilterBar.tsx` | `getFilterGroup` (+ `STAGE_PRESETS`, `JOURNEY_WAKE_PRESETS`) | `standard` group — no metric bounds, **RVOL input hidden** (§3b/§3c) |
| 4 | `ScanFilterBar.tsx` / `ScanView.tsx` | `defaultFiltersFor` | `DEFAULT_FILTERS` |
| 5 | `downloadXls.ts` | `ScanVariant` switch | `baseRow` — **metric column absent** (§3d) |
| 6 | `scanEngine.ts` | `SCAN_PRESETS` (offline fallback copy of the DB table) | — |
| 7 | `scanEngine.ts` | `executeScan` dispatch chain | error |
| 8 | `scanEngine.ts` | `MATVIEW_PRICE_ACTION_PRESETS` / `MATVIEW_BUNDLE_PRESETS` | direct fetch (§3a) |
| 9 | `scanEngine.ts` | `fetchAllScanCountsFromMatview` `.in([...])` | **no count badge** (§2b) |
| 10 | `config/scannerStudio.ts` | `STUDIO_DESCRIPTORS` | generic layout |
| 11 | `thesis/adapters/index.ts` | `SETUP_ADAPTERS` | no setup handoff (§3e) |
| 12 | `compute_scan_membership_snapshot.py` | `SNAPSHOT_PRESET_IDS` + `DISPLAY_CAP` + `PRESET_MEMBERSHIP_FNS` | no day-over-day cards |
| 13 | `kd_scan_presets` (DB) | row + `vani_rule` + `vani_side` | not on Discovery |
| 14 | `km_scan_results` (migration) | matview arm | direct fetch |

Fourteen places. Breakout Surge has an entry in all fourteen because it was
built first and each map was written *for* it. Every scanner added since
picked up whichever maps its author knew about. The five-scanner sprint added
entries to #10, #12 and #13 — the three the handover named — and the audit
finds the gaps in exactly the eleven it did not name. That is not carelessness
in any one session; it is the predictable result of identity being spread
across fourteen files with no single list to check against.

**The structural fix** is to make `STUDIO_DESCRIPTORS` (or the DB row) the one
place that carries sort key, column set, filter group, export variant and
matview membership, and have #1, #2, #3, #5 and #9 read from it instead of
keeping their own maps. Then a preset that has a descriptor cannot be missing
a sort or an export column. That is a refactor of five files, not a rewrite,
and it is the only change that stops this audit from being repeated for the
next scanner.

---

## 8. Loader — the owner is right, the Studios do not carry one

| Layout | While loading it renders |
|---|---|
| Generic (`ScannerResults`) | `<DristiQLoader />` |
| Stage 2 | `<DristiQLoader message="Preparing Data For You…" />` |
| Conviction Flow, Flower Pot, Waking Giants | `<DristiQLoader />` |
| **All 8 Studios** | `<p>Loading real scan results…</p>` — plain muted text |

`ScannerStudio.tsx:243`. The branded loader exists and is one import away;
the Studio predates its adoption and was never brought in line. Inherited by
every Studio from `breakout_surge` down. One line.

---

## 9. Cards view vs table view — where the two disagree

Three different card components serve the scanner pages, and they are not
equivalent to the table or to each other.

### 9a. Actions on a row — the real inconsistency

| Affordance | Table row | Generic cards (`StockCard`) | **Studio cards** (`BreakoutSurgeCards`) | Conviction Flow cards |
|---|---|---|---|---|
| Click → chart with `&setup=` handoff | ✓ | ✓ | **✗ no click at all** | **✗** |
| Bookmark star | ✓ | ✓ | **✗** | **✗** |
| ✦ Ask VaNi | ✓ | ✓ | ✓ | ✓ |

In every Studio's cards view a stock **cannot be opened or bookmarked**; the
same stock one toggle away in table view can be both. `BreakoutSurgeCards`
passes `vaniEntity` to `ScanCardWrapper` but no `onClick`, and imports no
`BookmarkToggle`. The wrapper already supports both (it renders `role=button`
when given a handler), so this is two props and one import per card
component — the Studio's existing `onRowClick` is the handler to pass.

### 9b. Order — the two views of one scan disagree

The Studio hands the same `filtered` array to both views. Cards render it in
the **fetched order** — the scan's own ranking. The table applies
`DEFAULT_SORT` on mount, which for seven scanners is the `magic_rs` fallback
(§2a). So on Weekly Movers the cards are ranked by WTD gain and the table by
Magic RS. Fixing §2a fixes this.

### 9c. Which numbers you see

| | Fields |
|---|---|
| Table (per-preset `PRESET_COL_OVERRIDES`) | the scan's metric first, then Score 5D/22D, D%, RVOL, delivery, EMA20, RSI, Magic RS… — 12–16 columns, user-editable |
| Studio cards | Close, D%, EMA20, RSI, the descriptor's two levels, 5D%, 22D%, RVOL hero |
| Generic cards | Close, D%, EMA20, reward/ATR, then *signal pills*: MRS/N500, RSI, Institution, RVOL, Delivery%, Rising/Falling Flow, SVD/SBD/SYD dots |
| Conviction Flow cards | Close, D%, EMA20, RSI, RSS, avg amt 5D/22D, Today Deliv, 52w, Dist, 5D/22D/66D% |

Concretely: the Golden Line table leads with `gl_event` and `gl_days_above`;
the Golden Line cards show neither (only GL level and % vs GL). The Breakdown
Surge table shows `pct_from_breakdown`; the cards show it as "% Below" — fine.
The generic cards show Magic RS, delivery and the SVD/SBD dots; the Studio
cards show none of those. None of this is *wrong*, but a user switching views
loses columns without being told, and the Columns picker (table only) has no
cards equivalent.

### 9d. Grouping and sorting controls

| | Table | Generic cards | Studio cards |
|---|---|---|---|
| VaNi Highlight / All Results split | no (inline ✦) | **yes**, two sections | no |
| Sort control | column headers | **Sort chips** (Score 5D / 22D / VaNi …) | none — fetched order only |
| Empty state | "No results" | shared copy | descriptor `displayName` copy |

The generic layout hides its sort chips in table view on purpose ("the table's
sortable headers are the single sort control"). The Studio cards have no sort
control at all — the only way to re-order Studio cards is to switch to the
table, where the order is (today) wrong.

### 9e. Export follows the filter, not the view

Both views export `filtered`, in fetched order. Sorting the table does not
change the XLS order. Defensible, but undocumented, and the button sits under
a table the user just sorted.

### 9f. Verdict on cards

The cards view is not a second rendering of the table; it is a third
component family with its own field set, no sort, and — in the Studios — no
row actions. §9a is a defect and should be fixed with §8. §9b is fixed by
§2a. §9c/§9d are the UX-parity question the owner has said is *not* the aim;
they are recorded so the choice is made knowingly rather than discovered by a
user mid-toggle.

---

## 10. Revised order

1. **§2a sort map** — seven entries; also fixes §9b.
2. **§8 loader + §9a card actions** — one line and two props; every Studio.
3. **§2b counts** — the fallthrough.
4. **§3b/§3c filter group** and **§3d export row**.
5. **§7 descriptor consolidation** — so the next scanner cannot regress.
6. **§3a GL matview arms**, **§3e GL adapters**, **§4** — as scheduled.

---

## 11. Task list — the working checklist

Every open item from the 2026-09-06 session, one place. IDs are stable;
tick them off here. Size: **S** under an hour, **M** half a day, **L** a day
or more. "Where" names the file(s) to open.

### A. Bugs — wrong numbers or wrong order, fix regardless of UX decisions

| ID | Task | Where | Size |
|---|---|---|---|
| A1 ✅ | Add `DEFAULT_SORT` entries for the seven scanners that fall through to `magic_rs` (wk/mo movers `pct_wtd`/`pct_mtd` desc, wk/mo decliners asc, breakdown `pct_from_breakdown` asc, gl_breakout `pct_from_gl` desc, gl_retest `gl_days_above` desc). Fixes table order AND the cards-vs-table disagreement (§2a, §9b). | `ScanTable.tsx` | S |
| A2 ✅ | Studio cards: pass `onClick` (the Studio's existing `onRowClick`) and render `BookmarkToggle` in `BreakoutSurgeCards`; same two props in `ConvictionFlowCards`. Cards can then open and bookmark a stock like the table row (§9a). | `BreakoutSurgeTable.tsx`, `ConvictionFlowTable.tsx`, `ScannerStudio.tsx` | S |
| A3 ✅ | Replace the Studio's plain "Loading real scan results…" text with `<DristiQLoader />` (§8). | `ScannerStudio.tsx:243` | S |
| A4 ✅ | Tab-strip count badge for presets outside the matview lists (GL pair, Flower Pot): fall through to `executeScan(id).length` in `getAllScanCounts` (§2b). Superseded by C1 if that lands first. | `scanEngine.ts` | S |

### B. Capability gaps — Breakout Surge can, the others cannot

| ID | Task | Where | Size |
|---|---|---|---|
| B1 | Filter bar `metric` group for Studio presets: min/max on the descriptor's ranking column (labelled from `fieldConfig`) + RVOL Min. Also closes the invisible-RVOL-filter problem (§3b, §3c). | `ScanFilterBar.tsx`, `scannerStudio.ts` (expose ranking key) | S–M |
| B2 | XLS export variant that appends the descriptor's two levels + Score 5D/22D + 5D/22D returns, used by the seven `xlsVariant: 'default'` Studios (§3d). Flower Pot gets its compression fields the same way if wanted. | `downloadXls.ts`, `scannerStudio.ts` | S |
| B3 | Chart-setup adapters for `gl_breakout` / `gl_retest` (or one parameterised on the event), following `breakoutSurge.ts`. Content work: the Golden Line story has to be written (§3e). | `services/thesis/adapters/` | M |
| B4 ✅ | Studio renders `ScanStalenessBanner` and `AtmosphericBadge` like the generic layout (§4). | `ScannerStudio.tsx` | S |

### C. Structural — stop the audit from repeating

| ID | Task | Where | Size |
|---|---|---|---|
| C1 | Migration: add `gl_breakout` / `gl_retest` arms to `km_scan_results` (mirror `fetchGlEvents`: NSE, ISIN-dedup, `gl_event = X`, no price/EMA gate, cap 200) and project `pct_from_gl`, `gl_event`, `gl_days_above`, `bm_event`, `bm_ratio`. Then move the pair into `MATVIEW_PRICE_ACTION_PRESETS`, keep the fetcher as fallback, update `_GL_POOL`'s note. Closes §3a and A4 (§2b). | new `km_migration_202_*.sql`, `scanEngine.ts`, `compute_scan_membership_snapshot.py` | M |
| C2 | Descriptor consolidation: `STUDIO_DESCRIPTORS` carries sort key, column set, filter group, export variant; `ScanTable`, `ScanFilterBar`, `downloadXls` and the counts list read it instead of their own maps (§7). After this a preset with a descriptor cannot be missing a sort, a filter or an export column. Do AFTER A1/B1/B2 so each behaviour is right before it is moved. | five files | M |
| C3 | Refresh `km_scan_results` is part of every migration that recreates it `WITH NO DATA` — either the migration ends with the two `REFRESH` statements, or the runbook says so. Today's outage on the six bundle scanners came from migration 200 leaving both views empty until the nightly step. | `DBscripts/` convention, `CLAUDE.md` | S |

### D. Owner decisions — not code until decided

| ID | Decision | Context |
|---|---|---|
| D1 | `flower_pot_burst` has no `vani_rule`. With none, ✦ never lights and "Burst" on the Discovery board has no definition the app can explain. Define one, or accept the label as-is. | §5 |
| D2 | Dots vs Golden Line events: 19% of event bars (91 of 479 over 20 sessions) carry neither `dot_svd` nor `dot_sbd` by the time the scan reads them, though `gl_events` required one when it stamped the event — a later `compute_dots` run is rewriting already-stamped bars. Investigate the re-run window, or accept that the event flag is the record and the dots are advisory. | handover §12 (GL entry) |
| D3 | `gl_breakout` hides "new since yesterday" (structurally 100%). Keep the exception or restore full parity. | descriptor `newSinceYesterday` |
| D4 | Phone default view: table with a sticky symbol column (today) vs cards. Product call. | handover §13 |
| D5 | Cards-vs-table field sets differ by design across three card families (§9c/§9d). Leave as a knowing choice, or pick one family. | §9 |

### E. Verification and hygiene

| ID | Task | Size |
|---|---|---|
| E1 | Real-device phone pass (iOS Safari + Android Chrome): category strip swipe, tab strip swipe, table/cards toggle, Filters, a Studio intent card, landscape once, Ask VaNi. | S |
| E2 ✅ | Remove or wire the unused exports `useVaNiIntents` (hooks/useVaNiChat.ts) and `buildWhyTags` (breakoutSurgeInsights.ts). | S |
| E3 | JobMonitor "Backend offline" pill overlaps the scanner Action Island on a phone when the backend is down. Not a scanner component; move the pill or the island's `bottom`. | S |
| E4 ✅ | Update `CLAUDE.md`'s "Next migration number" line (says 167; disk is at 201) and note the harness JWT fix in the theme-QA section. | S |

### Suggested batches

- **Batch 1 (one sitting):** A1, A2, A3, A4, B4, E2, E4. **Done 2026-09-07** —
  seven `DEFAULT_SORT` entries; Studio and Conviction Flow cards open the
  chart and carry the bookmark star; `DristiQLoader` + `ScanStalenessBanner` +
  `AtmosphericBadge` on the Studio; count badges for Flower Pot (matview list)
  and the GL pair (`fetchDirectPresetCounts` → `executeScan().length`, retired
  by C1); dead exports removed; CLAUDE.md migration line at 202.
- **Batch 2:** B1, B2, then C2 on top of them.
- **Batch 3:** C1, then B3.
- **Owner, any time:** D1–D5, E1, C3 as a convention.

