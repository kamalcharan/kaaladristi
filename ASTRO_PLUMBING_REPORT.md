# DristiQ Astro Plumbing Deep-Dive — Rule Engine → Catalog → Chart Overlay → VaNiMorningBrief

**Date:** 2026-07-10 · **Mode:** READ-ONLY diagnostic · **Scope:** curated rule subset only — **Sankranti / Venus / Jupiter / Mercury / Mars / Saturn / Bayer**
**DB access:** the `kaala-postgres` MCP connector is **NOT available** in this session (`.mcp.json` v2 registration + runbook were just added on this branch, but the VPS side and environment allowlist aren't up yet). Everything below is static code + migration inspection; every claim requiring live data is flagged and has a ready-to-run query in §3. All paths relative to `kaaladristi/App/` unless noted.

---

## 0. The headline (read this first)

The original audit found *a* root cause but framed it as *the* root cause. The chain actually has **three independent staleness axes**, and the audit's famous one is the *least* connected to the surfaces in this trace:

| Axis | What | Who it actually poisons |
|---|---|---|
| **A. `km_astro_daily_signal` frozen** (audit W3 P0 — confirmed, §1) | Derived daily net-signal table, last computed by migration 053's one-shot call | CalendarView day biases, `six_day_outlook` widget, `/api/astro/daily-signal|signals` — **and nothing else in this chain**. Catalog, chart overlays, and VaNiMorningBrief never read it. |
| **B. `km_rule_transits` + `km_rule_signals` have no production cadence** (worse than the audit suggested) | Windows come from 9 one-shot manual generators (hardcoded 1990→2030, "DO NOT RUN AUTOMATICALLY") + admin-triggered Discovery; the nightly job only *scores* existing rows, never creates them | Chart overlay bands, Catalog Last/Next columns, VaNiMorningBrief's active/upcoming cards and its signal-count line — i.e. **every user-facing astro surface in this trace** |
| **C. Curated-scope data gaps** | **Sankranti does not exist anywhere in the rule layer** (0 rules, 0 tags, 0 generators); **Venus is fragmentary** — no almanac, pure-Venus rules hidden from Catalog by migration 133's whitelist (which lacks `Venus`) | Catalog Venus pill expands to ≤2 Bayer rules; Sankranti can never surface anywhere |

The one genuinely healthy subsystem: the **confidence/track-record layer is LIVE** (nightly 19:00 IST + manual + on-inference-save — verified in code, §1.4). The asymmetry is real and ironic: the *scoring* of astro windows is production-grade while the *creation* of those windows is manual one-shots.

---

## 1. Root-cause confirmation — is `compute_astro_daily_signals()` ever called in production?

**NO — confirmed, and now exhaustively.** Repo-wide sweep (`/home/user/kaaladristi` including docs, both CLAUDE.md trees, `NSE Data Analysis/`), every hit categorized:

| Hit | Category |
|---|---|
| `DBscripts/km_migration_049_astro_daily_signal.sql:30` (+ COMMENT `:150`) | function **definition** (reads `km_astro_calendar_2026` :57-60, writes `km_astro_daily_signal`) |
| `DBscripts/km_migration_053_fix_null_end_dates_and_signal_guard.sql:60` | function **redefinition** (NULL-guard) |
| `DBscripts/km_migration_053…sql:187` | **the one and only invocation** — `SELECT compute_astro_daily_signals('2026-01-01','2026-12-31');` |
| `DBscripts/km_migration_051_astro_grants.sql:18` | GRANT EXECUTE (not a call) |
| `AUDIT_REPORT.md:207,209,367,487` + `docs/claude/rules-engine.md:106` | doc mentions (the latter instructs **manual SQL** recompute after calendar edits — the "process" is a human remembering to run SQL) |

**Zero hits** in `backend/` (both API files), `frontend/`, scheduler, worker, orchestrator. Cross-checks that closed every other possible path:
- Astro calendar CRUD (`pipeline2_api.py:1708,1737,1771`) only calls `_invalidate_astro_cache()` (in-memory dict clear, `:1705-1706`).
- The scheduler registers exactly **3 jobs** (`pipeline2/scheduler.py:227-257`): `pipeline2_daily_run` 18:00, `pipeline2_transit_scoring` 19:00, `pipeline2_gap_sweep` 19:30 — none touch the daily signal.
- The pipeline's 20 dimensions (`pipeline2/orchestrator.py:34-55`, `handlers.py:639-660`) contain no astro dimension; worker handles only `fix|daily_run|backfill` (`worker.py:428-436`).
- All backend references to `km_astro_daily_signal` are **reads** (`:1571,1408,1421,1876`).

`km_astro_daily_signal` is a frozen 2026-01-01→2026-12-31 snapshot, stale against every `km_astro_calendar` admin edit made since migration 053 ran.

### 1.2 The second frozen layer the audit underweighted: windows and signals

- **9 one-shot generators** (`backend/scripts/generate_{mercury,mars,jupiter,saturn,venus,bayer,gandanta,panchak,neptune}_windows.py`): all hardcoded 1990-01-01→2030-12-31, all `ON CONFLICT DO NOTHING`, all docstringed "**DO NOT RUN AUTOMATICALLY**", **none referenced by scheduler/worker/API** (grep: 0 hits in `pipeline2/`, `pipeline2_api.py`, `daily_pipeline.py`). Migrations 127-130 do NOT seed windows — each explicitly instructs running the generator afterwards (127:13-15, 128:22-24, 129:20-22, 130:22-24). Whether they were ever run, and through what date, is **live-DB-only knowledge** (§3 query E).
- **Discovery** (`scripts/rule_discovery.py`) is the second writer of `km_rule_transits` + the only writer of `km_rule_signals` (`:154-168`, `:21-27`), gated to `is_active AND NOT is_deleted AND data_source='available'` (`:1337-1341`), triggered only by admin endpoints `POST /api/discovery/run-*` (`pipeline2_api.py:3098-3254`) — **not scheduled**.
- The nightly 19:00 job explicitly does "**no rule re-discovery, just scoring**" (`pipeline2/scheduler.py:69-70`).
- `TRN-MER-MAN-TRN` (the Mercury sign-transit calendar) is in Discovery's `NOT_IMPLEMENTED_RULE_CODES` skip list (`rule_discovery.py:175-190`) — its windows exist **only** if `generate_mercury_windows.py` was manually run. Heliacal-rise rules (`TRN-VEN-RIS-*`, `TRN-MER-RIS-*`) likewise (`:192-195`).

### 1.3 Curated-scope inventory (static lower bounds — repo seeds only)

The bulk rule corpus is **not in the repo**: only **22 INSERTs** exist (migrations 101/102/103/127-130); everything else (`TRN-MER-MAN-TRN`, `DN-*`, `VDH-*`, `YOG-*`, `PNK*`, `CON-*`…) was loaded out-of-band. Full-table count therefore needs live SQL (§3 query B) — stated once, set aside per scope rules.

| Group | Tagged rules (per tag-migration lists) | Windows mechanism | Verdict |
|---|---|---|---|
| Mercury (incl. combustion `TR-MER-CMB-E-BEA`) | 15 | generator (11 codes) + discovery | **covered** (pending live check E) |
| Mars | 11 (incl. 6 Gandanta) | 2 generators + discovery | **covered** |
| Jupiter | 3 | generator + discovery | **covered** |
| Saturn | 5 | generator; VDH/YOG via discovery | **covered** |
| Bayer | 10 | generator (5) + mercury generator/discovery (5) | **covered** |
| **Venus** | **2 tagged `Venus`** (both Bayer: `BAY-R03-VEN-RET`, `BAY-R14-VEN-LON`) | venus generator covers `TRN-VEN-RIS-*` + `DN-*-VEN-*` only; **no Venus almanac exists** (no `TR-VEN-RET`, no `TRN-VEN-MAN-TRN` — the 127-130 pattern stopped at Saturn) | **fragmentary** |
| **Sankranti** | **0 — does not exist** (no rule_code/tag/generator/discovery function; only panchang flags `is_sankranti`, `sankranti_from/to`, migration 071:53-55, and a design mock `docs/platormperspective/dristiQ-catalog.html:745`) | none | **absent** |

**Venus × migration 133:** the 133 whitelist (`Mercury,Mars,Saturn,Jupiter,Bayer,MajorTransit` — `km_migration_133:18-21`) **does not include `Venus`**, and migration 096's pattern-tagger has no `%VEN%` rule — so pure Venus rules carry only `Manifestation`/`Nakshatra` tags and are **hidden from Catalog**. Yet the Venus group pill renders unconditionally (`CatalogAstroSection.tsx:507-548`), expanding to at most the 2 Bayer-Venus rules.

### 1.4 Confidence layer: LIVE (the asymmetry)

All three CLAUDE.md-claimed triggers verified in code: nightly 19:00 IST (`scheduler.py:239-246` → `_score_recent_transits` `:96-117`: transit returns → matched rescore vs current hypothesis → confidence → yearly → per-benchmark `score_benchmark_confidence`), manual `POST /api/confidence/compute` (`pipeline2_api.py:3582-3590`), and on inference save/delete (`:5705-5707, :5822-5823`). Discovery auto-chains confidence as phase 2 (`:3080-3093`).
Two curated-scope wrinkles: scoring has **no `is_active`/tag filter** (`confidence_scoring.py:613-615, :78-84`) — deactivated rules keep getting scored forever, and Sankranti (no windows) can never be scored.

---

## 2. Dependency map

```
                     ┌─ AXIS C: rule/tag gaps (Venus untagged, Sankranti absent)
                     ▼
┌─────────────────────────────┐
│ km_astro_rule_master        │  LIVE (admin CRUD via PostgREST) — but CRUD triggers ZERO
│ (rule engine root)          │  downstream recompute (ruleService.ts:206-264; only React
└──────────┬──────────────────┘  Query invalidation, RuleList.tsx:383-435)
           │ rules (is_active, tags, catalog_visible, conditions)
           ├────────────────────────────────────────────┐
           ▼                                            ▼
┌─────────────────────────────┐          ┌─────────────────────────────┐
│ km_rule_transits            │          │ km_astro_calendar (manual)  │
│ km_rule_signals             │          │   └─▶ km_astro_daily_signal │
│ AXIS B: STALE-BY-DESIGN     │          │       AXIS A: FROZEN        │
│ (9 one-shot generators +    │          │       (migration-053 only)  │
│  admin-only Discovery;      │          └──────────┬──────────────────┘
│  nightly job scores only)   │                     │ (2026-only snapshot)
└───┬───────────┬─────────────┘                     ▼
    │           │                          CalendarView · six_day_outlook
    │           │ matched/returns           widget · /api/astro/signals
    │           ▼                           (NOT read by anything below)
    │  ┌─────────────────────────┐
    │  │ km_rule_confidence(+bench,yearly) — LIVE (nightly 19:00 + manual + on-inference) │
    │  └───┬─────────────────────┘
    ▼      ▼
┌───────────────────────────────────────────────────────────────────┐
│ CATALOG (CatalogAstroSection)                                     │
│ reads: rule_master (catalog_visible=true gate = migration 133),   │
│ confidence (all rows, no timestamp), transits (±3y last/next)     │
│ → data PARTIAL; freshness INVISIBLE to user                       │
└───────────────┬───────────────────────────────────────────────────┘
                │ user adds astro_rule:CODE / astro_group:Tag overlay
                ▼
┌───────────────────────────────────────────────────────────────────┐
│ CHART OVERLAY (useAstroOverlayBands → TradingChart canvas)        │
│ reads: transits (today−2y → unbounded future) + confidence(+bench)│
│ → PARTIAL: renders whatever windows exist; empty = silent normal  │
│   chart; active-today windows indistinguishable from past ones    │
└───────────────┬───────────────────────────────────────────────────┘
                │ same framework overlays pushed client→server
                ▼
┌───────────────────────────────────────────────────────────────────┐
│ VaNiMorningBrief (UNMOUNTED) → POST /api/vani/daily (0 callers)   │
│ reads: km_daily_panchang (LIVE-ish, pre-gen to 2030 — gates all), │
│ km_rule_signals (AXIS B: PARTIAL), km_rule_transits (AXIS B),     │
│ km_rule_confidence (LIVE), rule_master (LIVE), LLM per cache miss │
│ → does NOT read km_astro_daily_signal or km_astro_calendar AT ALL │
└───────────────────────────────────────────────────────────────────┘
```

**Arrow annotations:** Rule Engine→Catalog: rule rows LIVE but visibility gate (133) mis-scoped for Venus, absent for Sankranti; confidence LIVE; transits PARTIAL. Catalog→Chart: overlay IDs only — chart re-fetches transits itself (PARTIAL) with no freshness/empty signal. Chart/Framework→Brief: overlay IDs pushed from client; brief's data = panchang (fine) + signals/transits (PARTIAL/Axis B) + confidence (LIVE). Axis A feeds only the calendar-side branch.

---

## 3. Coverage verification — needs live DB (connector not yet up)

Could not be run this session. Consolidated, curated-scope-only, all read-only. **Run these first once `kaala-postgres` connects** (or in pgAdmin):

```sql
-- A. Live curated inventory + statuses (repo seeds are lower bounds; admin CRUD diverges)
SELECT rule_code, rule_type, tags, planet_1, planet_2,
       is_active, catalog_visible, data_source, is_deleted, updated_at
FROM km_astro_rule_master
WHERE tags && ARRAY['Mercury','Mars','Saturn','Jupiter','Bayer','Venus']
   OR planet_1 IN ('Mercury','Mars','Saturn','Jupiter','Venus','Sun')
   OR planet_2 IN ('Mercury','Mars','Saturn','Jupiter','Venus')
ORDER BY rule_code;

-- B. Full-table count (context, once) vs the 133 whitelist
SELECT COUNT(*) AS total_not_deleted,
       COUNT(*) FILTER (WHERE is_active) AS active,
       COUNT(*) FILTER (WHERE catalog_visible) AS catalog_visible,
       COUNT(*) FILTER (WHERE tags && ARRAY['Mercury','Mars','Saturn','Jupiter','Bayer','MajorTransit']) AS in_133_whitelist
FROM km_astro_rule_master WHERE NOT is_deleted;

-- C. Sankranti — expect 0 rows (proves the absence)
SELECT rule_code, display_name, tags FROM km_astro_rule_master
WHERE rule_code ILIKE '%SAN%' OR display_name ILIKE '%sankranti%'
   OR display_name ILIKE '%ingress%' OR 'Sankranti' = ANY(tags);

-- D. Venus rules hidden by 133 (expect TRN-VEN-RIS-*, DN-*-VEN-* with catalog_visible=false)
SELECT rule_code, tags, is_active, catalog_visible
FROM km_astro_rule_master
WHERE (planet_1='Venus' OR planet_2='Venus' OR rule_code ILIKE '%-VEN-%') AND NOT is_deleted
ORDER BY catalog_visible DESC, rule_code;

-- E. THE BIG ONE — were the one-shot generators actually run, and how far do windows reach?
SELECT r.rule_code, COUNT(t.id) AS windows,
       MIN(t.start_date) AS first_window, MAX(t.end_date) AS last_window,
       COUNT(*) FILTER (WHERE t.start_date > CURRENT_DATE) AS future_windows,
       COUNT(*) FILTER (WHERE t.matched IS NOT NULL)       AS scored_windows
FROM km_astro_rule_master r
LEFT JOIN km_rule_transits t ON t.rule_id = r.id
WHERE r.tags && ARRAY['Mercury','Mars','Saturn','Jupiter','Bayer','Venus','Gandanta'] AND NOT r.is_deleted
GROUP BY r.rule_code ORDER BY future_windows ASC, r.rule_code;

-- F. Daily-signal freeze proof (Axis A): expect 2026-only, computed_at = migration-053 run date
SELECT MIN(trade_date), MAX(trade_date), MIN(computed_at), MAX(computed_at), COUNT(*)
FROM km_astro_daily_signal;

-- G. Astro calendar coverage by month for 2026 (curated event types ride on this)
SELECT month, COUNT(*) AS events FROM km_astro_calendar
WHERE year = 2026 GROUP BY month ORDER BY month;

-- H. Confidence liveness + curated coverage (expect last weekday ~19:00 IST)
SELECT MAX(last_computed_at) FROM km_rule_confidence;
SELECT COUNT(*), MAX(last_computed_at) FROM km_rule_confidence_bench;
SELECT r.rule_code, c.confidence_score, c.total_occurrences, c.last_computed_at
FROM km_astro_rule_master r LEFT JOIN km_rule_confidence c ON c.rule_id = r.id
WHERE r.tags && ARRAY['Mercury','Mars','Saturn','Jupiter','Bayer','Venus']
ORDER BY c.last_computed_at NULLS FIRST;

-- I. Brief inputs: signals for today + discovery horizon + panchang gate
SELECT COUNT(*) FROM km_rule_signals WHERE date = CURRENT_DATE;
SELECT MAX(date) FROM km_rule_signals;
SELECT MAX(end_date), COUNT(*) FILTER (WHERE CURRENT_DATE BETWEEN start_date AND end_date) AS active_today
FROM km_rule_transits;
SELECT COUNT(*) FROM km_daily_panchang WHERE date = CURRENT_DATE;

-- J. data_source trap: UI-created rules Discovery will never process
SELECT rule_code, data_source, is_active, created_at
FROM km_astro_rule_master
WHERE data_source IS DISTINCT FROM 'available' AND NOT is_deleted;

-- K. (vani_db) orphaned cache + whether the brief endpoint ever fired
SELECT COUNT(*) FROM vani_observation_cache;
SELECT COUNT(*), MAX(created_at) FROM vn_interaction_log WHERE endpoint = '/api/vani/daily';
```

---

## 4. Findings by surface

Format: finding → evidence → **does fixing the root recompute (Axis A job) fix this?**

### 4.1 Rule Engine (root)

1. **Rule CRUD triggers zero downstream recomputation.** All mutations are direct PostgREST (`ruleService.ts:206-264`) with only React-Query cache invalidation (`RuleList.tsx:383-435`). A `conditions` edit leaves stale `km_rule_transits` until an admin manually re-runs Discovery; generator-produced windows are never re-derived at all. → **Axis A fix does NOT fix this**; needs its own hook (Discovery-on-edit or an explicit "recompute" affordance).
2. **`data_source` trap: UI-created rules can never earn signals/confidence.** `createRule` stamps `data_source:'user_defined'` (`ruleService.ts:212`) but Discovery only processes `'available'` (`rule_discovery.py:1341`; same filter `pipeline2_api.py:3120-3123`). → **Independent bug**; one-line default change or filter widening.
3. **`updated_at` under-reports edits** — no DB trigger; set only by full `updateRule` (`ruleService.ts:232`); active/visibility toggles and soft-delete skip it (`:239-264`). → Independent; trigger migration.
4. **Sankranti absent, Venus almanac never built** (§1.3). → Independent content work; no recompute job can create rules that don't exist.
5. **Confidence layer live but unfiltered** — scores deactivated rules forever, no tag/active gate (`confidence_scoring.py:613-615`). → Cosmetic for launch; note only.

### 4.2 Catalog

1. **Migration 133's whitelist mis-matches the curated scope**: lacks `Venus` (and Sankranti is moot). Pure Venus rules are catalog-invisible while the Venus group pill still renders (`CatalogAstroSection.tsx:507-548`) and expands through a `catalog_visible=true` filter (`astroOverlayService.ts:249-253`) to a near-empty layer — a user adds "Venus" and gets almost nothing, silently. → **Axis A irrelevant**; fix = tag/whitelist migration (§5 step 2).
2. **No freshness surface anywhere user-facing.** `last_computed_at` exists on both confidence tables (062:60, 139:39) but is never selected by Catalog (`ruleService.ts:103`), DeepDivePanel (`DeepDivePanel.tsx:62-70`), or the chart tooltip; only admin `/rules/:id` renders "as of {date}" (`RuleDetail.tsx:1653-54`). The only freshness proxy is the Last/Next transit column showing a quiet `—` (`CatalogAstroSection.tsx:752-782`). A rule whose generator never ran looks identical to a live one. → **Axis A irrelevant**; small UI fix.
3. **`m_cat_blocks`/`m_cat_templates` do not exist** — zero grep hits, no catalog/template DB tables at all. Catalog items/templates are static TS constants (`catalogItems.ts:3-21`, `frameworkTemplates.ts:228`); astro rules bypass them entirely via runtime synthetic IDs `astro_rule:${code}` / `astro_group:<Tag>` (`CatalogAstroSection.tsx:158-173`, `astroGroupOverlays.ts:8-14`). The investigation brief's premise here was wrong — drop it.
4. DeepDivePanel reads `km_rule_confidence` + `_yearly` only (not `_bench`; that's `/rules/:id` + chart tooltip). Data is LIVE (§1.4) — **the audit's implication that DeepDive might be on frozen data is refuted**; what's missing is only the timestamp display.
5. The catalog widget `six_day_outlook` (`catalogItems.ts:332-347`) is the one Catalog-adjacent surface on the FROZEN Axis-A table. → **Axis A fix DOES fix this one** (after next recompute).

### 4.3 Chart Overlay

1. **Empty transit data = silently normal chart.** Zero rows → services return `[]` with DEV-only console.warns (`astroOverlayService.ts:211-217`; errors swallowed `:198-200,256-258,284-286`) → canvas early-returns (`TradingChart.tsx:765`). No empty state, no badge — while Catalog still shows the overlay "✓ active" (`CatalogAstroSection.tsx:812-820`). User has zero signal their astro layer is dark. → **Axis A irrelevant; Axis B fix prevents the common cause, but the UI gap needs its own small fix.**
2. **A currently-active window has no distinct rendering** — `isFuture` gets dashed borders + a ≤15-day countdown pin (`TradingChart.tsx:888-908, 967-1012`), but start≤today≤end renders identically to a long-past window; `matched=true/false` bands ignore future-ness entirely (`:894-903`). → Independent UI fix.
3. **Fetch window is calendar-based, unbounded forward**: `end_date ≥ today−2y`, no upper bound, never tied to the visible chart range (`useAstroOverlayBands.ts:53-58`, `astroOverlayService.ts:191-196`). Works, but means "windows to 2030 exist" ≠ "windows are current" — coverage is only as good as the last generator run (§3 E).
4. **Individual-rule fetch path skips `catalog_visible`** (`fetchRuleMetaByCode`, `astroOverlayService.ts:110-127` — despite its own DEV-warn text claiming otherwise `:180`); the group path enforces it (`:253`). Minor inconsistency; matters if 133's whitelist changes.
5. Tooltip "THIS WINDOW" verdict reads `km_rule_transits.matched` (LIVE via nightly scoring); "RULE OVERALL" reads confidence(+bench) (LIVE) — but **no `last_computed_at` on either** (`TradingChart.tsx:1231-1293`, `ruleService.ts:98-133`). Bench path is a designed no-op until `km_rule_confidence_bench` is populated (`ruleService.ts:123-125`; verify §3 H).
6. Venus could mechanically render (glyph `♀` `TradingChart.tsx:66`, labels `:135-136`, group pill exists) **if** data existed and visibility were restored; Sankranti cannot under any condition; `BAY-R02` (compound, non-PNK) can never be an overlay (`frameworkConstants.ts:26-31`, `isRangeRule` `CatalogAstroSection.tsx:132-138`).

### 4.4 VaNiMorningBrief

1. **Confirmed fully dark end-to-end**: dead import (`WorkspacePage.tsx:16`, element never rendered — same for `SixDayOutlookCompact` `:24`), `useMorningBriefAutoShow` has zero consumers (`VaNiMorningBrief.tsx:760-782`), Action-Island click only flips tabs (`WorkspacePage.tsx:336` → `WorkspaceActionIsland.tsx:79-86`), therefore **`POST /api/vani/daily` and sibling `POST /api/vani/observation` have zero live callers**.
2. **It does NOT read `km_astro_daily_signal` — the audit's root cause doesn't touch it.** Its "N positive vs M negative" line is `km_rule_signals JOIN km_astro_rule_master.outcome` (`pipeline2_api.py:4125-4136`); its active/upcoming cards are `km_rule_transits` + `km_rule_confidence` (`:2350-2483`). Full source table with LIVE/FROZEN marks in §2. → **Axis A fix changes nothing here; Axis B (discovery/window cadence) is the binding constraint.**
3. **No stocks are ever named** (re-confirmed against current code): every rendered string is overlay/rule/confluence/panchang-level; the only instrument reference is "Historical instances on Nifty" inside the LLM prompt (`:4209`). SEBI post-filter at `:2066-2078`.
4. **Caching**: in-memory `_vani_cache` 24h TTL, keys embed the date (`:4277-4285`; keys `:4172,4202,4256`) + React-Query staleTime 24h (`VaNiMorningBrief.tsx:135`). Same-day data corrections require manual eviction (admin per-card DELETE or `/api/vani/clear-cache`); next-day rolls over automatically. **Migration 092's `vani_observation_cache` (vani_db) is orphaned** — zero code references; the migration header's "replaces the in-memory cache" never happened. Also: `DELETE /api/vani/observation-cache/...` **has no auth dependency** (`:4452-4459`, unlike clear-cache `:4445`) and ignores its `cache_date` param.
5. **Curated-scope leak**: group-card queries filter `catalog_visible=TRUE` (`:2363,2396`) → auto-confined to the 133 whitelist; but the panchang card's signal count (`:4125-4136`) and individual-rule lookups (`:4233-4243`) have **no such filter** — they span the full rule population. Owner call whether that's intended breadth.
6. **Today-tab overlap**: mostly additive (brief = framework-personal; Today tab = market-wide). One duplication: the brief's panchang card vs `PanchangamCard`+`usePanchangInsight` — two independent LLM caches narrating the same `km_daily_panchang` row, which can disagree.

---

## 5. Fix sequencing — minimal ordered chain, CURATED SCOPE ONLY

> **Explicit exclusion:** the remaining ~180+ rules outside Sankranti/Venus/Jupiter/Mercury/Mars/Saturn/Bayer are **out of scope for launch — do not attempt to fix, verify, tag, or generate windows for them in this pass.** They stay `catalog_visible=false` (or get set so), keep whatever data they have, and are revisited post-launch. Neptune/Panchak/Gandanta stay as-is except where Gandanta rides along via its Mars tags.

**Step 0 — Verify live state (S, blocks everything).** Bring up the MCP connector (runbook in `docs/mcp-postgres-setup.md`) or run §3 A–K in pgAdmin. Step E decides how much of Step 3 is needed; F/G decide Step 4's urgency.

**Step 1 — Kill the `data_source` trap + CRUD-recompute gap (S).** Default `createRule` to `'available'` (or widen Discovery's filter) and add a "re-run discovery for this rule" hook/button on rule save. Root-level correctness for everything downstream.

**Step 2 — Curated-scope tag & visibility migration (S).** One migration: (a) tag `TRN-VEN-RIS-*`, `DN-*-VEN-*` (and any live `%VEN%` rules found by query D) with `Venus`; (b) extend the 133-style whitelist to include `Venus`; (c) set `catalog_visible=true, is_active=true` on the curated set and **`catalog_visible=false` on everything else** (formalizing the launch scope); (d) decide Sankranti: either create a `TRN-SUN-MAN-TRN` "Sun Journey" rule + extend the existing per-planet generator pattern (it's the same sign-ingress math the four TRN-*-MAN-TRN generators already do) — **M** — or explicitly punt Sankranti to panchang-badge-only for launch — **0h**. Recommend punt unless query C surprises.

**Step 3 — Give windows/signals a production cadence (M — the real Axis-B fix).** Two sub-parts:
   (a) Re-run the 6 in-scope generators once now (mercury/mars/jupiter/saturn/venus/bayer — idempotent, `ON CONFLICT DO NOTHING`) after Step 2, and
   (b) add a scheduled job (weekly is plenty for planetary windows; reuse the existing APScheduler in `pipeline2/scheduler.py`) that runs Discovery `run-missing` for curated rules + refreshes the rolling window horizon. This unfreezes Catalog Last/Next, chart bands, and every VaNiMorningBrief card in one move.

**Step 4 — Wire `compute_astro_daily_signals` (S — the audit's original P0, now correctly scoped).** Call it at the end of each calendar CRUD handler (affected date range) + append to the nightly job. Fixes CalendarView + `six_day_outlook` + `/api/astro/signals` — i.e. the Axis-A branch only. Do it because it's cheap and those surfaces exist; know that it does nothing for the brief.

**Step 5 — Freshness + empty-state surfacing (S–M).** Select and render `last_computed_at` in Catalog confidence cells, DeepDivePanel, and the chart tooltip (the column already exists everywhere); add a small "no astro windows in range — data may need refresh" notice when an active overlay yields zero bands; give currently-active windows a distinct border/tint (the `isFuture` machinery at `TradingChart.tsx:888-908` is the template).

**Step 6 — Mount VaNiMorningBrief (S mount + S wiring).** After Step 3 lands: render it (modal via Action Island, or pinned on Today tab), point the island's `onMorningBrief` at it instead of the tab flip, and make the two small backend fixes (auth-guard the per-card cache DELETE; either wire migration 092's persistent cache or delete that migration's claim). Decide the §4.4-5 filter question (panchang count → curated-only or all-rules).

Order matters: 0→1→2→3 are the data chain; 4 is parallel-safe any time; 5 can ship independently; 6 is last because mounting before Step 3 ships confident-looking cards on stale windows — half-built is worse than absent.

---

## 6. Open decision for Charan

**VaNiMorningBrief is "mount + wiring" — NOT rework — but the prerequisite is different from what the audit implied.** The component and its backend are complete and well-built (progressive cards, SEBI filter, feedback loop, caching). It does **not** depend on the frozen `km_astro_daily_signal` at all, so the audit's recompute fix is neither necessary nor sufficient for it. What it actually needs before mounting:

1. **Axis B first** (Step 3): a discovery/window cadence so its cards describe *current* windows — this is the go/no-go dependency;
2. two small wiring fixes (auth on the cache-DELETE endpoint; the orphaned migration-092 cache — wire it or drop it);
3. your call on the panchang card's signal-count breadth (all rules vs curated-only).

If you want the brief in the launch build, the realistic path is: Step 0 verification today, Steps 1–3 this week (~1.5–2 days), mount on the last day. If Step 0's query E shows the generators were never run (worst case), add half a day to run them and spot-check the windows. If you'd rather not spend that, the honest alternative is to keep the brief dark for launch and ship Steps 4–5 only — but given the brief is the single most differentiated astro surface you have, and it's already built, Steps 1–3+6 are the better spend of the same week.
