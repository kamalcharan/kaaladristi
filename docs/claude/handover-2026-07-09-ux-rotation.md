# Session Handover — UX day: Breadth Heatmaps, Rotation Graphs, Workspace Today — 2026-07-09

Branch: `claude/stockview-handover-migration-n927u0` → **merged to `main`**.
Start the next session fresh from `main`. This was a big UX day — read this before
continuing so you don't re-derive what's already built, decided, or deferred.

Two things shipped in **separate merges** today:
- **PR #176** (earlier): auth onboarding/login fix + first cut of breadth movers.
- **This batch**: the whole breadth-visualisation + rotation UX layer (below).

---

## 1. Auth — onboarding loop fixed (PR #176, already on main)
Root cause: logged-in users ran PostgREST as their **profile role** (`user`) because
`kd_auth_login` (migrations 096/140) embedded it in the JWT, but this deployment's
roles/grants are built for everyone to run as **`authenticated`**. `SET ROLE "user"`
failed / lacked UPDATE → `updateProfile({onboarded:true})` 403'd → onboarding never
persisted → every login looped to `/setup`.
- **Migration 143** — `kd_update_profile(jsonb)` SECURITY DEFINER RPC (scopes profile
  self-update to the caller's own row via JWT `sub`). `updateProfile()` calls it.
- **Migration 144** — restores `kd_auth_login` to issue `role:'authenticated'`; also
  converts `km_index_constituents` write policy to `is_admin()`.
- **Must re-login** after applying 144 to swap a stale `user`-role token.

## 2. Market Breadth data — movers/thrust (PR #176, already on main)
- **Migration 145** + `compute_market_breadth.py`: new count columns on
  `km_market_breadth` (`universe_count`, `above_20/50/150`, `up_5pct`, `down_5pct`,
  `up_20pct_5d`, `down_20pct_5d`) over one daily 150-valid universe.
- `fetchIndexBreadth` computes the same movers per-index (adds `pct_chng` + a 5-session
  return pass).
- `MarketBreadthDay` gained the mover fields as **optional**.

---

## 3. Breadth Heatmaps (this batch)
`components/domain/BreadthHeatmap.tsx` + `BreadthRocHeatmap.tsx` — shared, data-driven,
gate each row on data presence.
- **Colours = FlowIntensityMap palette**: solid `--risk-green/amber/red` blended over
  the **navy base `#1e293b`** (navy ONLY for empty/zero — never blended into a live
  value, which is what had made them dim). Participation rows are an **absolute
  diverging** scale (low % = red … high = green) so a weak market reads red; mover rows
  are single-hue intensity.
- **Newest-left** (today first), **22/44/66 filter** (default 22).
- ROC heatmap: signed diverging (green expanding / red contracting / navy flat).
- Wired on **Market Structure** (market-wide, "All NSE") and **Sector Rotation index
  detail** (per-index). Raw Breadth Data table exists (`BreadthRawTable.tsx`) but is
  **not rendered anywhere** right now (hidden on owner request; keep for the Market
  Breadth page rework).

## 4. RotationGraph — the RRG (this batch, the centrepiece)
`components/domain/RotationGraph.tsx` — one shared component, two variants:
- `variant='rs'` — single stock: **Magic RS × its 5-bar momentum** → Leading /
  Weakening / Lagging / Improving.
- `variant='breadth'` — index/market: **breadth score × ROC-13**, `levelCenter={50}` →
  Expanding / Slowing / Contracting / Turning.
- Auto-scales around `levelCenter`; **22-session tail**; **per-dot hover tooltip**
  (date · quadrant · level · momentum, edge-aware); the **latest-reading panel is a
  VaNi response** (orb + "VaNi · read", purple-tinted).
- **Animated playback** (`autoPlay`, `playSeconds` default 7): traces the tail
  oldest→newest, auto-highlighting each session's tooltip, then settles on LATEST.
  **"▶ replay"** button; respects `prefers-reduced-motion`.
- SEBI-safe throughout (observational; momentum = rising/slowing; disclaimer).

Feeders / usages:
- `BreadthRotation.tsx` (breadth variant, autoplay) — Workspace Today.
- `ChartView.tsx` — stock RS-rotation under the Magic RS pills (`/chart/equity/:id`,
  daily; `hasRsData` gate; **autoplay on**). Layout provisional.

## 5. Workspace → Today rework (this batch)
`views/WorkspacePage.tsx` (`activeTab==='today'`) — replaced the old brief/weather/chart
stack with the approved **Option A (read → evidence)** layout:
1. **Index cards** — `TickerRail` (NIFTY 50 / BANK / 500 / India VIX).
2. **Shared index selector** (NIFTY 50 default / 500 / BANK) + **"Open Market Breadth →"**
   → `/market-structure`. One selector drives the whole breadth section.
3. **How breadth is moving** — `BreadthRotation` (per-index; **VaNi read**; autoplay; no
   heatmap here).
4. **Panchangam (40%) + Sky Regime (60%)** in one row (`PanchangamCard` +
   `PlanetRegimeStrip`, astro ICP only).
5. **Market Breadth + ROC** line charts — fed the **same per-index breadth**.
- **`DristiQLoader`** shows on the slow per-index breadth fetch (rotation + charts).
- **Removed from Today** (re-add trivially if wanted): VaNi Morning Brief, Market
  Weather card, old index chart, Six-Day/Nak-Vara cards.
- **Known dup (accepted for now):** the rotation (§3-style) and the breadth/ROC line
  charts both show breadth — owner OK with it while we refine.

## 6. Market Structure (`/market-structure`) (this batch)
- **Astro-Technical Alignment (`MarketWeatherCard`) HIDDEN** from *Today's Structure*
  pending the astro-confluence rework (see CLAUDE.md FOR REVIEW; re-enable = restore the
  card in `TodayStructureTab`). Still renders on `/dashboard`.
- Layout: **full breadth chart → its heatmap → full ROC chart → its heatmap** (stacked).
- **Scope is whole-NSE ("All NSE", ~1,330 stocks via `km_market_breadth`)** — labelled
  explicitly because it differs from Today's NIFTY-50 constituent breadth (that's why
  the scores differ, e.g. 44.9 vs 42.2 — not a bug).
- **Historical Confluence tab — untouched.**

---

## Deferred / FOR REVIEW (owner)
- **RS-Rotation scanner** — `docs/claude/Rsspec.md` (FOR REVIEW in CLAUDE.md). Not built.
  Leading-indicator complement to Stage 2 Leaders; adds Improving/Weakening quadrants;
  SEBI-safe presets `Rotating Into Strength` / `Leadership Fading`; multi-timeframe
  "aligned rotation" (Magic RS native on daily/weekly/monthly); one new data need
  `magic_rs_roc`. Open questions at the end of the spec.
- **Astro-Technical / astro-confluence UX** — HIDDEN on Market Structure, FOR REVIEW.
  Proposed design (mock): breadth regime × astro window → historical positive-day
  frequency matrix + forward 6-day strip. Lands as Layer 4 of the Market Breadth page.
- **Market Breadth page full rework** — reviewed mock: control bar (Scope/TF/Window) →
  Read (VaNi + rotation) → Trend → Detail (heatmaps + raw table) → Astro. Scope selector
  would let Market Structure switch between All-NSE and NIFTY 50/500/BANK.
- **Multi-timeframe RS-rotation** (1D/1W/1M markers on one graph) — designed (mock),
  data ready (native Magic RS on all three tables). Not built.
- **ROC/breadth duplication** on Today + Market Breadth — refine later.
- Still open from before: Conviction latest-bar pipeline scores, selectable Magic RS
  benchmark, full Pulse retirement, Big Money calibration, astro-window synthesis source.

## Mock artifacts (design references, this session)
- Breadth story / rotation: `claude.ai/code/artifact/23f9194f-...`
- Stock RS-rotation (SEBI-safe): `.../88ffdbef-...`
- Multi-timeframe RS-rotation: `.../3d446dd5-...`
- Workspace Today: `.../b8ef5bd1-...`
- Market Breadth page (with astro preview): `.../25af880a-...`

## DB steps still pending on the VPS (unchanged)
1. Migrations **142, 143, 144, 145** on `kaala_dristi_db` (if not already applied).
2. `cd App/backend && python compute_market_breadth.py --all` (backfill the market-wide
   mover columns — run **inside** the `kd-pipeline-api2` container: `docker exec -it
   kd-pipeline-api2 python compute_market_breadth.py --all`; deps + `DATABASE_URL` live
   there). Until then the market-wide heatmap shows only the 3 participation rows.
3. Users must **sign out / back in** after 144 (stale `user`-role token).

## Verify before calling anything done
`cd App/frontend && npm run typecheck && npm run build && npm run check:theme` — all
clean this session. Run from the **nested** path `kaaladristi/App/frontend`.

## Working rules (owner, honour these)
- No fallback (pass/fail — blank, never faked). No repetition. Same theme tokens
  (`check:theme` clean). Discuss → **HTML mock first** for layout changes → build.
- **SEBI-safe**: observational only, no buy/sell/target/forecast; neutral momentum
  vocabulary (rising/slowing, expanding/contracting).
