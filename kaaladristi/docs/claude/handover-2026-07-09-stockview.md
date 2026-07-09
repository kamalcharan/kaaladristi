# Session Handover — Stock View / Sector Rotation UX — 2026-07-09

Branch: `claude/light-mode-theme-handover-fis5f2` → **merged to `main`** at the end
of this session. Start the next session fresh from `main`.

Read this before continuing the Stock View work — it saves re-deriving what's
already done, decided, or deferred.

---

## What this session shipped (all on main)

### Sector Rotation
1. **Constituents / Flow Map "Unable to load flow data" for regular users** —
   root cause was `km_index_constituents` missing a `SELECT` grant for the DB
   role logged-in users run as (`authenticated`). Migration **142**
   (`km_migration_142_index_constituents_grants.sql`) grants it. *Requires
   running the migration on `kaala_dristi_db`* (SQL migrations aren't auto-applied).
   Two throwaway migrations (143/144, a wrong "missing user role" theory) were
   drafted then **deleted** — see LESSONS_LEARNED / CLAUDE.md for the diagnostic
   hygiene note. **The live `kd_auth_login` issues JWT role=`authenticated` for
   everyone** (not the profile role), despite migrations 096/140 in the repo.
2. **Overview tab redesign** — full-width single-stacked flow (synthesis strip →
   hero tiles → full-width VaNi → compact stats+trend → full-width constituents
   table → breadth). Constituents table reordered (RSI/MagicRS after scores,
   `#` dropped), **BSE chips** on table/hero-tiles/flow-map, breadth charts
   **side by side**. Astro-window segment of the synthesis strip is **hidden,
   pending an owner-chosen data source** (noted in CLAUDE.md).

### Stock View (Study = `views/ChartView.tsx`)
3. **Study made the full workbench** — pulled Pulse's cards (Order Flow, Smart
   Money, Divergence, + the Player/timeline scrubber) into Study.
4. **Decision-first layout** (approved via HTML mock):
   `Header → Decision Band (VaNi read + verdict) → Snapshot strip
   (Conviction·Momentum·Liquidity·Returns) → Evidence (Flow Heatmap+Industry;
   Order Flow·Smart Money·Big Money·Delivery; Scan Presence·Member Of) →
   Chart tier → Player`. Chart moved to the bottom (decision cards lead).
5. **Single-stock Flow Heatmap** (`StockFlowHeatmap`) reusing the Sector-Rotation
   cell style; 5D/22D/66D toggle; horizontal-scroll fix (flex `minWidth:0`).
6. **Flip cards** (`SignalFlipCard`, default Widget ⇄ Chart) for Smart Money +
   Magic RS; removed the duplicate Cockpit panels (Momentum·RSI/MFI kept).
7. **Big Money** — self-relative threshold (own top-2% delivered days + 5× norm,
   replacing the flat ₹25 Cr floor); honest empty state; **thresholds are
   PROVISIONAL — verify per-stock event counts on live data.**
8. **Decision Band fix** — was rendering the heavy `InstrumentIntelligence`
   panel; now the slim `VaNiInsight` narrative + verdict.
9. **Magic RS no-data states** — `magic_rs` is null for many BSE/thin stocks;
   the 1D/1W/1M pills now only show with RS data, and the Magic RS card shows an
   explicit "not computed" state.
10. **Pulse/Study toggle hidden** on Study (Study is the single view). See
    "Pulse retirement" below.

### Docs / hygiene
- `docs/PulseUX.md` — full Pulse/Study system + Study widgets + before/after,
  **flagged FOR REVIEW** in CLAUDE.md.
- Fixed 4 pre-existing typecheck errors so `npm run build` is clean.

**Every change: `npm run typecheck` + `npm run build` + `npm run check:theme`
clean.** No live browser/DB in the sandbox — the owner verified visually by
pulling the branch; treat "looks good" as owner-confirmed, everything else as
code-verified only.

---

## The Stock View spec — status (the 7-item skill)

Owner gave a "Stock View structural layout fixes" spec (WEBELSOLAR-style).
Only **#2 (hide toggle)** was executed this session. My discussion analysis of
all 7 is in the conversation; here's the state so the next session can pick up:

| # | Item | Status |
|---|---|---|
| 1 | Z-index: search/Ask-VaNi bar hides "Member Of" | **PENDING.** Bar is `Layout.tsx` `sticky top-0 z-40`; content `z-10`, dropdown `z-50`. Fix stacking/padding. Get a screenshot to pin top-bar vs dropdown overlap. |
| 2 | Pulse/Study toggle | **DONE** — hidden on Study (option a1: hide only). |
| 3 | Verdict banner → auto-composed synthesis line | **PENDING.** Compose from on-page values (RSS+dir, Smart Money state, last-5 heatmap cells, RSI). Frontend-only, style like Sector-Rotation synthesis strip. **Decide:** keep VaNi narrative + synthesis line (drop the static verdict box?), and placement (above vs below stat strip). |
| 4 | Tier-2 grid standardization | **PENDING.** Rec: equal 2-col — [Order Flow·Smart Money] / [Delivery·Big Money], Flow Heatmap full-width above. Supersedes the current Big-Money-spans-2-rows layout. |
| 5 | Big Money chart-overlay toggle (off by default) | **PENDING.** Add chip near SuperTrend/EMA controls; pass `bigMoneyEvents` only when on. Full label de-collision when ON is a harder follow-up (TradingChart marker layout). |
| 6 | Magic RS + RSI/MFI → full width below chart | **PENDING.** Revises the current chart-tier 70/30 sidebar. Confirm whether RSI Divergence also moves below. |
| 7 | VACUUM/DISTRIBUTION palette audit | **RESOLVED (no code):** already use existing semantics — VACUUM=`--risk-amber` (caution), DISTRIBUTION=`--risk-red` (negative), ACCUMULATION=`--risk-green`. No new colors needed; just formalize amber="caution/low-conviction" in the palette doc if desired. |

---

## Deferred / open (owner to steer)
- **Conviction latest-bar blank** — pipeline should compute `score_5d/22d` for
  the latest trade date (they lag ingestion). Owner ruled: **no UI fallback** —
  fix in the pipeline. Not started.
- **Selectable Magic RS benchmark** — on-the-fly RS recompute vs any index; today
  fixed vs CNX500. Deferred.
- **Conviction scrubber-awareness** — `pulseBars` carries no scores, so the
  Conviction snapshot isn't Player-linked. Would need `score_5d/22d` added to
  `useEquityVisualPulse`.
- **Pulse retirement (full)** — toggle is hidden, but the `/pulse/equity/:id`
  page (`EquityVisualPulsePage`) still exists and is still linked from Scanner
  rows, Dashboard "VaNi Highlights", the Scanner widget, and Study's header
  verdict chip. To make Study truly universal: repoint those links to
  `/chart/equity/:id`, then delete the Pulse page/route.
- **Big Money threshold calibration** (#7 above), **astro-window synthesis source**
  (Sector Rotation Overview), **Correlation for indexes** (index Study has no
  pulse cards wired).

---

## Working rules the owner set (honor these)
- **No fallback — pass or fail.** Never substitute/mask missing data; show it
  honestly (blank / empty state). Empty states are fine (they surface gaps);
  value-fallbacks are not (they hide bugs).
- **No repetition.** A signal appears in exactly one place.
- **Same themes.** All UI uses theme tokens (3 themes + light/dark); `npm run
  check:theme` must stay clean.
- **Don't edit during discussion.** When the owner says "discuss / what do you
  think", analyze and confirm before building. Mock in static HTML first for
  layout changes (owner reviews cheaply before code).

## Key files
- `views/ChartView.tsx` — Study page (the stock view).
- `components/domain/StockCockpit/` — `StatStrip`, `SignalFlipCard`,
  `SignalLineChart`, `CockpitIndicatorPanels`, `BigMoneyCard`,
  `DeliveryVsTraded`, `SectorMembershipCard`, `ScanPresenceCard`.
- `components/domain/StockFlowHeatmap.tsx`, `FlowIntensityMap.tsx`.
- `components/domain/VisualPulse/` — Order Flow / Smart Money / Divergence /
  Magic RS cards, `TimelineSlider`, `EquityVisualPulsePage` (Pulse, orphaning).
- `services/visualPulseEngine.ts`, `services/bigMoney.ts`.
- `docs/PulseUX.md` — the reference doc.

## Verify before calling anything done
`cd App/frontend && npm run typecheck && npm run build && npm run check:theme`.
Run from the **nested** path: `kaaladristi/App/frontend` (repo has a doubly-nested
`kaaladristi/kaaladristi/` layout). Migration 142 must be run on the DB.
