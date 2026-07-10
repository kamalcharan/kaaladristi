# DristiQ Pre-Launch Product Audit

**Date:** 2026-07-10 · **Launch:** T-7 days · **Scope:** read-only audit of `kaaladristi/App` (frontend + backend + migrations through 145)
**Method:** static code audit + migration inspection. No live-DB connector was available (`.mcp.json` is empty), so data-population claims are inferred from migrations and flagged for DB verification where needed. All paths below are relative to `kaaladristi/App/` unless prefixed.

---

## 1. Executive Summary

**Verdict: NOT READY for public launch as a growth product.** The engines work and the data plumbing is real, but the product is three silos that never converge, the app is desktop-only, and there is no trust surface. Launching now spends the one-time acquisition wave on a product that can't prove its own promise.

The three findings that matter most:

1. **The promised aha never lands anywhere.** The landing page sells "what the ancient sky and modern market agree on," but no screen fuses astro × scanner × rotation on a single stock. `scanEngine.ts` contains zero astro references; SectorRotation's SynthesisStrip *intentionally hides* its astro segment; the conflict-resolution engine that exists (`conflictEngine.ts`) is only used on an admin-only page. Users must do the fusion mentally — the exact work the product exists to do.
2. **The app shell is unusable on mobile.** Fixed 220px sidebar, zero responsive breakpoints in any of the 6 user-facing views, hard-px grids. Indian retail is mobile-heavy; this halves the funnel before it starts. Full fix is >16h — mitigation required for launch week.
3. **No defensible trust claim + compliance exposure.** Scanners and rotation have zero effectiveness measurement (no hit rate, no forward-return grading, scan membership isn't even persisted for most presets), the astro daily signal is a frozen snapshot no job recomputes, and scanner cards render "Strong Bull / Mild Bear" labels that violate the project's own documented SEBI rule (D39).

The good news: most P0s are S/M-effort. A focused 7-day sequence (Section 6) gets to a defensible launch — provided mobile is mitigated honestly and half-built astro surfaces are flagged OFF.

---

## 2. Product Map

### 2.1 What a regular (non-admin) user sees — nav tree

```
DristiQ (Sidebar.tsx:13-47)
├── View
│   ├── Workspace        /workspace        ← new users land here after onboarding
│   ├── Catalog          /catalog          (framework/config builder)
│   ├── Sector Rotation  /sector-rotation  (+ /sector-rotation/:indexId detail)
│   ├── Scanner          /scanner          (auto-routes to default preset)
│   ├── Market Structure /market-structure
│   └── Account          /account
└── [NOT IN NAV but routable]
    /dashboard  ← returning logins land HERE (LoginPage.tsx:49,94) — orphan
    /pulse/*, /chart/*, /pricing, /astro-calendar, /rules, /panchang, /inference,
    /rule-eval, /planetary-intel, /intraday/*, /custom-index/*, /users, /settings,
    /data-pipeline, /admin/panchang — all reachable by URL (no route-level admin guard)
```

Admin nav adds 13 items (Markets, Industry Transition, Manipulation Watch, Panchang, Visual Pulse, Intraday, Inference DB, Rule Eval, Data Pipeline, Panchang Admin, Rule Engine, Custom Index, Users). **Every dedicated astro page is admin-only or absent from nav.**

### 2.2 The three signal engines

| Engine | Where it lives | Status |
|---|---|---|
| **Scanners** | `services/scanEngine.ts` (2,431 lines, pure client-side TS) — **14 shipped presets** across Price Action / Stage Analysis / Flow / Market; preset metadata in `kd_scan_presets`; page `views/ScanView.tsx` | Shipped, works, no track record |
| **Sector rotation** | `views/SectorRotationPage.tsx`, `IndexDetailPage.tsx`; data `km_industry_eod`, `km_index_eod` (ret_5d/22d/66d) | Shipped |
| **Astro** | `km_astro_rule_master` (rules), `km_astro_calendar`, `km_astro_daily_signal`, `km_rule_transits`, panchang tables; pages CalendarView / PlanetaryIntelView / PanchangView / RuleEngine | Built but **admin-siloed**; daily signal frozen (§W3) |

**In-flight scanner concepts (verified):** Waking Giants, Flower Pot Burst, Strategic Rebirth, PEAD, NSE Filings Intelligence exist **only as spec docs** in `docs/scanners/*.md` — nothing in `scanEngine.ts` or migrations. **PlanetPulse is explicitly "parked"** (comment references only: `backend/pipeline2_api.py:5352`, `DBscripts/km_migration_134_rule_inference.sql:11-13`, `backend/lib/ai_prompts.py:411`). None are shipped; none are stubbed in UI — clean.

### 2.3 Data flow

- **Frontend → PostgREST** (direct table reads): `km_equity_eod` (17 call sites), `km_index_eod` (15), `km_index_symbols` (13), `km_equity_symbols` (12), `km_industry_eod` (6), `km_index_constituents` (6), `km_astro_daily_signal` (3), `km_astro_rule_master` (2), `km_astro_calendar` (2), `km_rule_transits` (2), plus catalog MVs.
- **Frontend → FastAPI** (`backend/pipeline2_api.py`, **93 routes**): `/api/astro/*`, `/api/panchang/*`, `/api/ai/*` (VaNi insights), `/api/vani/*`, `/api/confidence/*`, `/api/confluence/*`, `/api/discovery/*` (admin), `/api/payments/*` (Razorpay), `/api/framework/*`, `/api/custom-index/*`, `/api/admin/users/*`.
- **Nightly pipeline** (pipeline2 scheduler, 18:00 IST): EOD ingest → indicators → MagicRS → flow intelligence → industry composites → index returns → rolling metrics (`d30/d365_pct_chng`, `avg_amt_5d/22d`, `delivery_surge_x`, `w52_high/low`).

### 2.4 First-run flow (verified from code)

`/` Landing → Login/Register (invite code `bharathavarsha`, **hardcoded client-side** `LoginPage.tsx:27`) → `/setup` 4-screen onboarding (ICP + analysis-style + blend + **plan selection**) → `/workspace` + BetaWelcomeModal. Returning logins → `/dashboard` (orphan).

---

## 3. Findings by Workstream

Grading: **P0** = launch blocker (broken / misleading / trust-destroying) · **P1** = fix before launch if possible · **P2** = post-launch. Effort: **S** <4h · **M** 4–16h · **L** >16h.

---

### W1 — UX Audit

#### [P0] The entire app shell is desktop-only — no responsive behavior anywhere in the user path
- Evidence: `components/domain/Layout.tsx:30` (`marginLeft: collapsed ? '52px' : '220px'` hard margin); `Sidebar.tsx:139-149` (`position: fixed`, 52/220px, manual collapse only, no drawer/hamburger). Repo-wide grep: **0** `sm:/md:/lg:` Tailwind prefixes and **0** `matchMedia/isMobile/useMediaQuery` hits in Layout, Sidebar, or any of the 6 user-facing views. Hard-px grids: `DashboardV3View.tsx:55-56` (`65fr 35fr`), `MarketStructureView.tsx:230,321` (`repeat(3,1fr)`), `StockCard.tsx:262` (`1fr 120px 100px`), ScanView's *second* fixed 220px inner sidebar (`ScanView.tsx:1318-1319`).
- Why it matters: Indian retail traffic is mobile-heavy; below 400px the app guarantees horizontal scroll and overlapping panels — mobile signups bounce at first paint.
- Fix + effort: Full responsive pass is **L** (not achievable in 7 days). Launch mitigation (**M**): breakpoint at ~768px → sidebar becomes overlay drawer with hamburger; convert the worst grids to `minmax()/auto-fit`; add an honest "best experienced on desktop" note on mobile viewports.

#### [P0] Raw directional labels ("Strong Bull", "Strong Uptrend/Downtrend") violate the project's own SEBI rule (D39)
- Evidence: `components/domain/StockCard.tsx:421-424` renders `stock.magic_rs_zone` raw (DB values "Strong Bull / Mild Bear"); `constants/signalScale.ts:25-32` (SIGNAL_LABELS) and `:66-72` (ZONE_LABELS) use "Strong Uptrend / Strong Downtrend". CLAUDE.md lesson **D39**: "Never use bull/bear/uptrend/downtrend in any badge, label, or tooltip."
- Why it matters: documented compliance rule for an Indian market-signals product, violated on the core discovery surface 7 days before public launch — regulatory and trust exposure, not cosmetics.
- Fix + effort: Neutralize the vocabulary in `signalScale.ts` (participation/strength terms per D39's `ROC_BADGE_MAP` precedent) and stop rendering raw `magic_rs_zone` — route through the mapping. **M**.

#### [P1] Post-login lands on `/dashboard`, an orphan page unreachable from nav — and it near-duplicates Workspace→Today
- Evidence: `views/LoginPage.tsx:49,94` navigate to `/dashboard`; `Sidebar.tsx:13-24` has no `/dashboard` entry; the brand div isn't a home link (`Sidebar.tsx:153-164`). Meanwhile new users land on `/workspace` (`ProfileSetup.tsx:651`). `DashboardV3View.tsx:47-107` and `WorkspacePage.tsx:236-311` ("Today" tab) render nearly the same component set (TickerRail, PlanetRegimeStrip, PanchangamCard, MarketBreadthChart, BreadthRocChart, sector flow).
- Why it matters: every returning user's home is a page they can never deliberately return to, and new vs returning users are trained on two different homes — kills the daily-return ritual and makes the IA feel accidental.
- Fix + effort: Redirect `/dashboard` → `/workspace` (one line) OR add Dashboard to nav; then pick one canonical morning surface. **S** for redirect; **M** to consolidate the duplicate.

#### [P1] First screen defaults to the densest "terminal" mode
- Evidence: `DashboardV3View.tsx:27` — `useState<Density>('terminal')`; terminal renders every row including `NakVaraSignals` (`:99-103`).
- Why it matters: a brand-new user's first paint is the maximum-panel wall of astro + breadth + rotation with no "start here" — highest single bounce risk.
- Fix + effort: default to `calm`/`standard`, persist choice. **S**.

#### [P1] Scanner cards render unexplained metric pills with no tooltips
- Evidence: `StockCard.tsx` — RVOL (`:358-360`), Delivery % (`:363-365`), RSI (`:315-331`), EMA20 (`:396-401`) render as bare `SigPill`s (`:106-120` — no title/Tooltip). Only MagicRS (`:177`) and the sniper towers (`:132-160`) are explained. The plumbing exists: `getTooltip(fieldKey)` from `fieldConfig.ts` is already imported; `ScanTable.tsx:4-5` header cells use `Tooltip`.
- Why it matters: "RVOL 2.3 · RSI 64 · Delivery 71%" with no way to learn what they mean = high cognitive load on the core discovery surface.
- Fix + effort: wrap SigPills with existing `getTooltip`. **S–M**.

#### [P1] Five parallel proprietary vocabularies on one 64px card row
- Evidence: `StockCard.tsx` simultaneously shows Flow type (`:277-287`), MagicRS zone, Rising/Falling Flow dots (`:369-374`), sniper towers, Reward/ATR (`:404-416`) — no legend.
- Why it matters: metric overload; even sophisticated users can't hold five scoring systems at once.
- Fix + effort: progressive disclosure — collapse secondary signals behind hover/expand + one-time legend. **M**.

#### [P1] Error states are technical dead-ends on several core screens
- Evidence: `MarketStructureView.tsx:405-408` ("backend may be offline"), `SectorRotationPage.tsx:210-217` (raw `error.message`), `WorkspacePage.tsx:117-124` ("Failed to load framework." — no retry). Scanner card view has Retry (`ScanView.tsx:630-639`) but table view doesn't (`:1152-1154`).
- Why it matters: transient blips during the EOD-processing window read as "the product is broken."
- Fix + effort: standardize one error card (friendly copy + Retry) across the 6 views. **M**.

#### [P1] Two/three parallel color-token systems for the same green/red/amber semantics
- Evidence: `signalScale.ts:44-49` (`text-risk-*` Tailwind) vs `var(--bull)/--bear/--caution` vs `var(--risk-green/red/amber)` (`SectorRotationPage.tsx:31-34,111-113`) used across StockCard, MarketStructureView, DataFreshnessChip.
- Why it matters: the "single source of truth" is bypassed by most rendering — same signal can show different shades per screen, weakening color-as-meaning.
- Fix + effort: map signalScale to the CSS vars, consolidate. **M**.

#### [P2] Nav labels are internal-feature names, not user goals
- Evidence: `Sidebar.tsx:17-22` — "Workspace / Catalog / Sector Rotation / Scanner / Market Structure". Nothing says "find opportunities" or "today's read".
- Fix: goal-oriented renames/regrouping. **S**.

#### [P2] Catalog (a config/builder surface) occupies the #2 nav slot
- Evidence: `views/CatalogPage.tsx:11-18` — it's a framework-building tool, not a discovery destination.
- Fix: demote below content pages. **S**.

#### [P2] Amber means four different things across screens
- Evidence: `signalScale.ts:40` (turning) vs `SectorRotationPage.tsx:189` (Fading) vs `MarketStructureView.tsx:22-27` (mildly negative regime) vs VIX "Elevated" (`SectorRotationPage.tsx:112,116`).
- Fix: define amber's single semantic. **S–M**.

#### [P2] Workspace can hard-redirect to `/setup` from a data condition
- Evidence: `WorkspacePage.tsx:109-115` — empty framework bounces user into onboarding.
- Fix: empty-workspace state instead. **M**.

#### [P2] Silent sign-out failure; pervasive one-off inline styles
- Evidence: `Sidebar.tsx:135` (`signOut().catch(() => {})`); ~50-line inline-styled NavLink with hand-rolled hover repeated in `CatalogPage.tsx:121-132`, `SectorRotationPage.tsx:404-409`, ScanView tabs. **S** / **L** respectively.

**Genuinely good (one line each):** EOD "data not yet ready" is handled well — `DataFreshnessChip.tsx:16-34` (pending/delayed/stale) plus Scanner's "check back after ~6:30 PM IST" empty state (`ScanView.tsx:1174,1227`). `ScanStartHereHint` (`ScanView.tsx:817-859`) + always-visible disclaimer (`:1382-1392`) are the right orientation pattern — replicate them. Sector Rotation's `ExplainerStrip` (`SectorRotationPage.tsx:312-349`) plainly defines 5D/22D/66D. ₹/Cr/date formatting is consistent (`toLocaleString('en-IN')`, `lib/dateUtils`).

---

### W2 — Product-Led UX for GTM

#### TTFI click path (measured from code)

1. `/` → "Explore Beta" (`Hero.tsx:62`) → `/login`
2. Register tab → invite-code modal (`LoginPage.tsx:55-57`)
3. Type `bharathavarsha` → Verify (`LoginPage.tsx:27,65`)
4. Name + Email + Password → Create Account (`:81-89`) → `/setup`
5. Screen 1: optional name/phone → "Let VaNi begin" (`ProfileSetup.tsx:230,612`)
6. Screen 2: 1.4s typing animation (`:600`) → pick ICP Investor/Trader/Both (`:622`)
7. Pick analysis style Astro-aware/Technical (`:359`) [+ blend slider if "Both", `:331`]
8. Screen 3: ~3s build animation (`:423-425`) → "Start here" (`:508,628`)
9. Screen 4: **pricing** → "Continue with Free plan" (`PricingCards.tsx:198`)
10. `/workspace` → BetaWelcomeModal (5 paragraphs) → "I understand" (`BetaWelcomeModal.tsx:109`)
11. Market-level read only (breadth/panchang/sector flow) — **no stock yet**
12. Click Scanner → default preset auto-loads (`ScanView.tsx:1300-1304`) → **first scored stock appears**

**~11 clicks + 2 forced waits + 2 modals + 4 config decisions.** Target <60s/zero-config: missed by a wide margin.

#### [P0] No screen delivers the aha — astro and stocks never fuse
- Evidence: `DashboardV3View.tsx:47-103` (astro + market read, zero stock picks) vs `ScanView.tsx:1300-1304` (stock scores, zero astro). The one cross-engine surface, `VaNiHighlightsBoard`, is buried in Workspace's secondary Discovery tab (`WorkspacePage.tsx:315-328`) and is scanner-only (see W4). Landing promise: "what the ancient sky and modern market agree on" (`Hero.tsx:52`).
- Why it matters: the core value prop is never proven on a concrete stock — the exact reason a user would pay.
- Fix + effort: "Today's Brief" block joining scanner ✦ highlights + day's astro regime (`km_astro_daily_signal.net_signal`) + sector rotation status into 3–5 named stocks + one astro sentence. All data exists. **M**.

#### [P0] TTFI is config-gated end-to-end (see path above)
- Evidence: required decisions at `ProfileSetup.tsx:622` (ICP), `:359` (style), `:701` (plan); unskippable animations `:600,:423-425`.
- Why it matters: every gate before value multiplies drop-off; launch-wave visitors have the least patience.
- Fix + effort: collapse onboarding to one required question (ICP), defer style + plan, make animations skippable. **M**.

#### [P1] Plan selection is forced mid-onboarding, before any value
- Evidence: Screen 4 of onboarding (`ProfileSetup.tsx:701-726`, `PricingCards.tsx`) precedes the first scan result. Gating elsewhere is correctly value-first (`InlineGate` fires only in Catalog/Correlation).
- Why it matters: asking ₹199–4,999 before the aha maximizes defensive "Free" picks and anchors the product as paywalled-first.
- Fix + effort: remove Screen 4; let the existing `InlineGate` trigger contextually. **S**.

#### [P1] Pricing table sells "VaNi insights" as paid, but VaNi renders free
- Evidence: `PricingCards.tsx:18` marks VaNi `free:false`; `DashboardV3View.tsx:58` (MarketWeatherCard) and `WorkspacePage.tsx:27` (VaNiHighlightsBoard) render for free users with no tier gate.
- Why it matters: either free leaks the differentiator or the pricing table lies — both damage trust at the conversion moment.
- Fix + effort: decide the boundary; make table + runtime agree. **S**.

#### [P1] No habit-loop mechanics for the 6–7 PM EOD cadence
- Evidence: no "changed since yesterday" / delta / streak / digest anywhere (grep confirms); `DashboardV3View.tsx` is a static daily snapshot. Phone number is collected (`ProfileSetup.tsx:223`) but never used for alerts.
- Why it matters: EOD products live on the evening ritual; nothing tells the user "come back tonight."
- Fix + effort: "new vs yesterday" badges on scanner results + one-line "what changed" strip on home. **M**.

#### [P1] Onboarding seeds no watchlist, demo stock, or pre-run scan
- Evidence: `ProfileSetup.tsx:575-580` — instrument-selection step was removed; Screen 3 places indicator blocks, not stocks.
- Why it matters: user lands on an abstract market canvas with no stock they care about — the emotional hook never fires.
- Fix + effort: auto-seed 3–5 names from today's default scan during onboarding. **M**.

#### [P1] BetaWelcomeModal promises Pulse/Study — admin-only for regular users
- Evidence: `BetaWelcomeModal.tsx:83-86` vs `Sidebar.tsx:33` (`/pulse` adminOnly).
- Why it matters: first-session promise the user literally cannot find — instant credibility leak.
- Fix + effort: fix the copy or un-gate the features. **S**.

#### [P2] Shareability is export-only — nothing screenshottable or linkable
- Evidence: only TradingView copy/`.txt` (`ScanView.tsx:266-299`) and XLS (`:220-256`); no share/toPng/permalink anywhere.
- Why it matters: 40 early adopters are the growth engine; nothing is built for Telegram/WhatsApp forwarding with DristiQ attribution.
- Fix + effort: "copy as image" on a stock card / today-brief with watermark + deep link. **M**.

#### [P2] Invite code hardcoded in the client bundle
- Evidence: `LoginPage.tsx:27` — `const INVITE_CODE = 'bharathavarsha'`, plaintext, shared, un-revocable.
- Fix + effort: server-side per-user codes, or drop the wall entirely to cut friction. **S**.

---

### W3 — Astro Integration Completeness

*(Completeness matrix in Section 4.)*

#### [P0] `km_astro_daily_signal` is a frozen snapshot — nothing ever recomputes it
- Evidence: `compute_astro_daily_signals()` is invoked **only** inside migrations 049/051/053 (grep: 3 hits, all in `DBscripts/`). Zero calls in `backend/pipeline2/` or `pipeline2_api.py`; the scheduler doesn't call it; the calendar CRUD endpoints (`pipeline2_api.py:1708-1784`) only clear an in-memory cache.
- Why it matters: any admin calendar edit changes `km_astro_calendar` while the derived daily signal stays stale forever — CalendarView day biases and the Six-Day Outlook block silently contradict the calendar. Silent-wrong-numbers, the worst failure class for a signals product.
- Fix + effort: call `compute_astro_daily_signals(start,end)` at the end of each calendar CRUD handler + add as a daily-pipeline step + admin "recompute" button as stopgap. **S**.

#### [P1] Astro calendar has no full-year 2026 source in the repo
- Evidence: only programmatic population is `km_migration_050:6` (imports `dc_inference WHERE year=2026`), and `dc_inference` itself has **zero INSERTs** in any migration/seed. Everything else is manual admin CRUD. The brief's "May–Dec partially digitized" suspicion cannot be disproven from the repo. UI degrades gracefully (empty states at `CalendarView.tsx:556,610,871`) — no crash, but potentially hollow.
- Why it matters: a sparse H2-2026 calendar makes the astro layer look abandoned to anyone who finds it.
- Fix + effort: run verification SQL (§8); backfill or flag the page off. **S** to verify / **M** if reseed needed.

#### [P1] Undocumented live rename `km_astro_calendar_2026` → `km_astro_calendar`
- Evidence: migrations 048/050/052/053 reference `_2026`; migrations 055/056 and all runtime code (`astroCalendar.ts:65`, `pipeline2_api.py:1623`) reference `km_astro_calendar`; no `ALTER TABLE ... RENAME` exists in any `.sql`.
- Why it matters: a fresh DB rebuild breaks at migration 055 and every astro read 404s — a disaster-recovery hole in launch week.
- Fix + effort: one guarded rename migration. **S**.

#### [P1] No route-level admin guard — every admin astro page loads by URL for any logged-in user
- Evidence: `App.tsx:111-147` — all routes sit under a single login-only `<ProtectedRoute />`; admin gating exists only as sidebar filtering (`Sidebar.tsx:223`). A regular user typing `/rules` or `/astro-calendar` renders the full admin page including CRUD toolbars.
- Why it matters: half-built admin surfaces leaking to paying users is worse than absence; PostgREST may block writes but the UI renders and confuses.
- Fix + effort: `RequireAdmin` route wrapper. **M**.

#### [P1] Dead astro code: `AstroIntelligencePanel`, `AstroSignalWeekPanel`, `components/astro/` — built, exported, never rendered
- Evidence: exported at `components/domain/index.ts:29`; `grep '<AstroIntelligencePanel' / '<AstroSignalWeekPanel'` → 0 JSX usages; `MajorTransitBanner`/`MinorTransitBar`/`DailyEventStrip` are imported only by the dead panel.
- Why it matters: a whole 7-day-outlook/transit-banner astro surface was built and consumed nowhere — sunk work invisible to users.
- Fix + effort: mount it deliberately post-launch or delete; leave off for launch. **S**.

#### [P2] AstroSignalBadge does not exist
- Evidence: `grep -ri AstroSignalBadge` → 0 matches repo-wide. Astro impact is never rendered as a badge on any scan row, sector row, or stock card.
- Fix + effort: build against `km_astro_daily_signal.net_signal` using `signalScale.ts` vocabulary. Post-launch. **M**.

#### [P2] Astro is a fully isolated silo — zero fusion with scanners or rotation
- Evidence: `scanEngine.ts` has zero astro references (its "confluence" is purely technical, e.g. `bullishConfluence` `scanEngine.ts:826`); `IndexDetailPage.tsx:595` — "The astro-window segment is intentionally hidden pending a data source"; `MarketWeatherCard` removed from Market Structure (CLAUDE.md, 2026-07-09).
- Why it matters: "astrology-informed market intelligence" is the differentiator and it is not wired into any surface users actually use.
- Fix + effort: product decision; see W4 P0 synthesis fix for the v1 path. **L** for full fusion.

---

### W4 — Opportunity Discovery Effectiveness

#### [P0] No screen fuses scanners + rotation + astro into a ranked "what should I look at today?"
- Evidence: closest is **VaNi Highlights** (`scanEngine.ts:2018-2072`, rendered `WorkspacePage.tsx:326` Discovery tab): unions the ✦ flag across **scanners only**, ranks by cross-scan count then score (`:2058-2063`) — astro-blind and rotation-blind. Rotation is a separate adjacent card (`SectorPulse`, `WorkspacePage.tsx:321`); astro cards live on a different tab (`:284-286` vs `:279`). `SynthesisStrip` composes flow+breadth+momentum and omits astro (`IndexDetailPage.tsx:595-596,644-664`). Market Structure fuses astro×breadth but **index-level only, zero stocks** (`MarketStructureView.tsx:163-165,385-425`).
- Why it matters: the user must open three silos and fuse mentally — the precise job the product should do to convert a browser into a subscriber.
- Fix + effort: extend `fetchVaniHighlights` with (a) each stock's industry rotation status from `getIndustryClassifications(bundle)` and (b) the day's `km_astro_daily_signal.net_signal` as a market-wide tag + confluence badge; promote to top of Discovery / the new Today brief. **M** (v1); **L** for per-stock astro tagging.

#### [P0] Conflict-resolution logic exists but is walled off behind admin-only nav
- Evidence: `services/conflictEngine.ts` `resolveConflict()` (7-case verdict) is imported **only** by the admin-only Intraday cockpit (`Intraday/IntradayPage.tsx:184`, card `:427`; `Sidebar.tsx:34` adminOnly). No conflict/veto logic anywhere in `scanEngine.ts` (2,431 lines). `VaNiHighlightsBoard.tsx:247-268` renders Strength and Caution as two independent lists — a stock can appear in both with no reconciliation. `SynthesisStrip` picks one winning signal and silently drops the rest (`IndexDetailPage.tsx:619`).
- Why it matters: the first time a user notices "Strength Confluence" on a stock in a rotating-out sector on a bearish astro day — with the app saying nothing — they stop trusting every green badge.
- Fix + effort: reuse `resolveConflict()` at EOD (scanner side + rotation status + astro daily signal) → one-line caveat strip on highlight rows. **M**.

#### [P0] Zero effectiveness measurement for scanners and rotation
- Evidence: astro rules DO have a surfaced track record (Catalog → `DeepDivePanel.tsx:63-74` reads `km_rule_confidence` + `km_rule_confidence_yearly`; chart shows per-window matched vs NIFTY, `TradingChart.tsx:1231-1233`). Scanners: nothing — pure client-side filtering, scan membership never persisted, no forward-return grading (backend grep for scan outcome infra → none). Rotation: no accuracy columns anywhere. `ret_5d/22d` on `km_equity_eod` are trailing returns used for display (`scanEngine.ts:633-645`), never to grade past picks.
- Why it matters: a scanner with no published hit rate is indistinguishable from a random filter — the single biggest credibility gap for a paid signals product.
- Fix + effort (**M** — the persisted flags make this cheap): daily flags `is_vani_s2 / is_vani_breakout / is_vani_surge / is_vani_smart / is_vani_weakness / stage` already exist per stock per day on `km_equity_eod`. Minimal hit-rate query (Stage-2, forward 5 sessions):

```sql
WITH picks AS (
  SELECT equity_id, trade_date, close FROM km_equity_eod
  WHERE is_vani_s2 IS TRUE AND trade_date >= CURRENT_DATE - INTERVAL '2 years'
),
fwd AS (
  SELECT p.*, (SELECT f.close FROM km_equity_eod f
               WHERE f.equity_id = p.equity_id AND f.trade_date > p.trade_date
               ORDER BY f.trade_date LIMIT 1 OFFSET 4) AS close_5d
  FROM picks p
)
SELECT COUNT(*) AS picks,
       ROUND(AVG((close_5d-close)/close*100)::numeric,2) AS avg_fwd_5d_pct,
       ROUND(AVG((close_5d>close)::int)::numeric*100,1)  AS win_rate_pct
FROM fwd WHERE close_5d IS NOT NULL;
```

  Parameterize flag + offset (5/22), persist nightly to `kd_scan_hit_rate(preset_id, window_d, picks, avg_fwd_pct, win_rate, computed_at)`, render a "Track Record" strip atop ScanView per preset ("Stage 2 Leaders — 62% positive over 5 sessions, avg +1.8%, n=…, trailing 2y") reusing the existing `ConfidenceDial` (`components/correlation/ConfidenceDial.tsx`). Presets without a persisted flag (power_buy, quiet_accumulation, distribution_warning) need membership persistence first — defer (**L**).

#### [P1] Two presets emit up to 500 names — a list, not a signal
- Evidence: per-preset limits from `SCAN_PRESETS` (`scanEngine.ts:33-46`) + terminal slice/limit per function:

| Preset | Max count | Ranked/limited | Verdict |
|---|---|---|---|
| power_buy / power_sell / smart_money / fresh_breakout / quiet_accumulation / distribution_warning | 25 | sorted + slice 25 | OK |
| vani_opportunity / vani_exit_watch | 25 | rs_percentile sorted | OK |
| conviction_flow | 50 | delivery_surge_x desc (`:1057-1059`) | borderline |
| stage_2_watch / stage_3_watch | 100 | sorted | long |
| stage_4_leaders | 200 | rs_percentile asc (`:1583`) | long |
| **breakout_surge** | **500** | score_5d desc (`:1132,1209`) | **list, not signal** |
| **stage_2_leaders** | **500** | magic_rs desc (`:1241`) | **list, not signal** |

- Why it matters: "here are 500 Stage-2 stocks" pushes the ranking work back onto the user and buries the ✦ high-conviction subset.
- Fix + effort: conviction floor (e.g. `rs_percentile >= 80`) or display cap ~50 with "show all" expander. **S**.

#### [P1] Result rows answer none of the trader's next three questions (why / what level / what invalidates)
- Evidence: `ScanTable.tsx` is a plain metrics grid — no per-row "why this is here" (only page-level preset description + a 5px ✦ dot, `ScanTable.tsx:282-286`); row click navigates away to Pulse (`ScanView.tsx:597,784,1079,1161`). `breakout_level`/`pct_from_breakout` are default columns **only** for `price_action` scans (`fieldAvailability.ts:18-19`) — stage/flow categories don't even list them as optional (`:39-56,60-72`). No invalidation/stop concept exists anywhere in `fieldConfig.ts`.
- Why it matters: a surfaced name with no reference level and no invalidation isn't actionable — the user still does all the work elsewhere.
- Fix + effort: per-row expander stating the matched condition in words + `breakout_level` as "level" + a derived invalidation (sma_50 / swing low). **M**.

---

### W5 — Time-to-Value & Conversion (CRO)

#### First-session friction inventory (in order — each item is a drop-off point)

1. Invite code wall (`LoginPage.tsx:27,63-71`) — hard stop
2. Full Name (required, `:261-268`)
3. Email + Password (`:271-289`)
4. "What should I call you?" — redundant second name prompt (`ProfileSetup.tsx:217`)
5. Phone "for alerts" — collected, never used (`:223`)
6. ICP decision Investor/Trader/Both — required, no "not sure" (`:257-261`)
7. Blend slider 10–90% if "Both" (`:331`) — precision the user can't have yet
8. "Astro-aware" vs "Technical only" fork (`:351-354`) — jargon as a decision
9. 1.4s + ~3s unskippable animations (`:600,:423-425`)
10. Plan decision before any value (`:701-726`)
11. BetaWelcomeModal — 5 paragraphs, promises admin-only features (`BetaWelcomeModal.tsx:83-86`)
12. Term barrage with no explain layer: Panchāṅgam, Kṛṣṇa Pakṣa, Tithi, Śaka (`Hero.tsx:24`), MagicRS, Panchak, Breadth ROC, Nak-Vara (`ProfileSetup.tsx:73-113`, `DashboardV3View.tsx:98-103`)

#### [P1] Home screen leads with methodology, not outcome (defaults elsewhere are good)
- Evidence: defaults are solid — Scanner auto-routes to a default preset (`ScanView.tsx:1300-1304`), Sector Rotation defaults to broad tab + latest date (`SectorRotationPage.tsx:13`), Workspace defaults NIFTY 50 breadth (`WorkspacePage.tsx:65`). But the home read opens with PlanetRegimeStrip + "Astro-Technical Alignment" + Panchangam (`DashboardV3View.tsx:50-60`) before any plain-language verdict.
- Why it matters: outcome buried below machinery = first-time users see process, not answers.
- Fix + effort: reorder home to lead with a verdict/brief line. **S**.

#### [P1] No explain-on-demand layer on user screens
- Evidence: Tooltip/`title=` usage concentrates in admin/Rules pages (`RuleList.tsx`, `DataPipeline/*`); proprietary + Sanskrit terms render raw in onboarding and dashboard; `VaNiInsight.tsx` exists but is opt-in per card.
- Why it matters: unexplained vocabulary at first contact reads as noise, not intelligence.
- Fix + effort: glossary popovers for MagicRS, Panchak, Breadth ROC, Conviction Flow, Six-Day Outlook, Nak-Vara. **M**.

#### [P1] Landing → app continuity break
- Evidence: landing sells convergence — "Where Bharath's ancient sky meets the modern market" / "We read the sky. You read the market." (`Hero.tsx:43-57`); first in-app screen delivers disaggregated widgets; welcome modal promises admin-only Pulse/Study.
- Why it matters: the promise-vs-first-screen gap is where the first 30 seconds of trust leaks.
- Fix + effort: **S** (copy) now; the Today brief (W2 P0 fix) closes it properly (**M**).

#### [P2] Pricing page is mostly clear; two gaps
- Evidence: `PricingCards.tsx:6-26` — 4 tiers, 12-row matrix, "BEST VALUE" flag: readable in 10s. Gaps: Trial (₹199/3 days) has no "what happens after"; Free's "1 week" expiry isn't reflected in the matrix (expiry logic only in `InlineGate.tsx:38` `free_expired`).
- Fix + effort: one-line post-expiry notes. **S**.

---

## 4. Astro Completeness Matrix (W3.1)

Stages: **DB** = table exists in a migration · **Computed** = job/script populates it · **API** = endpoint in `pipeline2_api.py` or PostgREST · **UI** = rendered in a live component · **Nav** = discoverable by a regular user.

| Feature | DB | Computed | API | UI | Nav (regular user) |
|---|---|---|---|---|---|
| Rule master (`km_astro_rule_master`) | YES (mig 047) | YES (seeds 101–103, almanac 127–130, admin CRUD) | YES | YES (`/rules`, Catalog, Sky Regime) | **NO** — `/rules` adminOnly (`Sidebar.tsx:42`) |
| Astro calendar (`km_astro_calendar`) | YES (048 — as `_2026`, renamed live with **no migration**) | **PARTIAL** — only mig 050 dc_inference import + manual CRUD | YES (`/api/astro/calendar*`, `/transits`) | YES (CalendarView, PlanetaryIntelView) | **NO** — in no nav section at all |
| Daily signal (`km_astro_daily_signal`) | YES (049) | **NO — FROZEN** (only migrations 049/051/053 ever computed it) | YES (`/api/astro/daily-signal`, `/signals`) | YES (CalendarView, six_day_outlook block) | **PARTIAL** — paid Workspace block, opt-in |
| Per-stock astro overlay (`km_rule_transits`) | YES (064) | YES* (`generate_*_windows.py` — DB-verify) | YES (PostgREST) | YES (chart bands) | **PARTIAL** — opt-in Catalog overlay |
| **AstroSignalBadge** | — | — | — | **NO — does not exist** (0 grep hits) | **NO** |
| PlanetPulse / PlanetaryIntel | YES (127–130) | YES* (almanac generators) | YES | YES (`PlanetRegimeStrip` "Sky Regime") | **PARTIAL** — free block; PlanetaryIntelView removed from nav; **PlanetPulse scanner itself is parked (docs only)** |
| Panchang (`km_panchang_calendar`) | YES | YES* (`generate_panchang_2026.py`) | YES (`/api/panchang/*`) | YES (PanchangView, PanchangamCard) | **NO** — adminOnly |
| DC/dasha (`dc_inference`/`dc_lookup`) | YES (004/008) | **PARTIAL** — zero INSERTs in repo (seeded externally) | YES (PostgREST) | YES (InferenceView) | **NO** — adminOnly |
| Rule transits (`km_rule_transits`) | YES (064) | YES* | YES (`/api/astro/transits`) | YES (overlays, Sky Regime) | **PARTIAL** |

**Net:** astro is a near-total admin silo. The only astro a regular user encounters by default: the Sky Regime block, the (frozen-data) Six-Day Outlook block, opt-in chart overlays, and the Panchangam card on the home read.

---

## 5. Quick Wins — P0/P1 × S-effort checklist

- [ ] Redirect `/dashboard` → `/workspace` (or add to nav) — kills the orphan (`LoginPage.tsx:49,94`)
- [ ] Default dashboard density `terminal` → `calm` (`DashboardV3View.tsx:27`)
- [ ] Remove plan-selection Screen 4 from onboarding; rely on existing `InlineGate` (`ProfileSetup.tsx:701-726`)
- [ ] Align pricing table with runtime on VaNi gating (`PricingCards.tsx:18`)
- [ ] Fix BetaWelcomeModal's Pulse/Study promise (`BetaWelcomeModal.tsx:83-86`)
- [ ] Cap breakout_surge / stage_2_leaders display at ~50 + "show all" (`scanEngine.ts:1132,1241`)
- [ ] Hook `compute_astro_daily_signals()` into calendar CRUD + daily pipeline (`pipeline2_api.py:1708-1784`)
- [ ] Ship the `km_astro_calendar_2026` → `km_astro_calendar` rename migration (guarded)
- [ ] Run the §8 SQL to verify astro calendar / panchang / transit coverage
- [ ] Home screen: lead with a one-line verdict before astro machinery (`DashboardV3View.tsx:50-60`)
- [ ] Landing/app copy continuity pass (`Hero.tsx:43-57`)
- [ ] Post-expiry notes on Free + Trial pricing cards (`PricingCards.tsx`)
- [ ] SigPill tooltips via existing `getTooltip()` (`StockCard.tsx:106-120`) *(S–M)*
- [ ] Scanner Action Island offset for collapsed sidebar (`ScanView.tsx:202-203`)
- [ ] Invite code: move server-side or drop the wall (`LoginPage.tsx:27`)

---

## 6. 7-Day Pre-Launch Plan (one developer + Claude Code)

**Feature-flag OFF for launch (do this Day 1, it's cheap insurance):**
- `/astro-calendar` (CalendarView) + `/planetary-intel` — frozen/possibly-sparse data; keep URL-unreachable until daily-signal recompute + coverage verified
- **Six-Day Outlook** Workspace block — reads the frozen `km_astro_daily_signal` (Sky Regime block is safe — reads live `km_rule_transits`)
- Dead astro components (`AstroIntelligencePanel`, `AstroSignalWeekPanel`, `components/astro/`)
- Pulse/Study references in BetaWelcomeModal (copy, not flag)

| Day | Work | Items |
|---|---|---|
| **1** | **Navigation + funnel triage (all S)** | `/dashboard` redirect; default density calm; remove onboarding plan screen; welcome-modal copy; pricing/VaNi gate agreement; feature-flags above; run §8 verification SQL against live DB |
| **2** | **Compliance + astro hygiene** | D39 label neutralization in `signalScale.ts` + raw `magic_rs_zone` (M); daily-signal recompute hook (S); rename migration (S) |
| **3** | **Route-level admin guard (M)** + scanner caps/conviction floor (S) + SigPill tooltips (S–M) |
| **4** | **Today's Brief v1 (M)** — VaNi highlights + rotation status + day's astro regime line as the top block of Workspace; this is the aha surface and closes the landing-promise gap |
| **5** | **Track-record strip (M)** — hit-rate SQL on persisted `is_vani_*` flags → nightly `kd_scan_hit_rate` → ScanView strip with ConfidenceDial |
| **6** | **Conflict caveat (M)** — wire existing `resolveConflict()` into highlight rows; standardize error cards with Retry across the 6 views (partial) |
| **7** | **Mobile mitigation (M, honest scope)** — sidebar → overlay drawer under 768px; `minmax()` the worst grids (Dashboard, MarketStructure, StockCard); "best on desktop" notice for <400px. Full responsive pass is post-launch L. Buffer + browser verification list (§8) |

Not attempted in 7 days (correctly): full mobile redesign, per-stock astro fusion, shareable image cards, scan-membership persistence for unflagged presets, design-system consolidation.

---

## 7. Post-Launch Backlog (P2s, priority order)

1. **Shareable insight cards** — copy-as-image with watermark + deep link (top GTM lever once trust surface exists)
2. **AstroSignalBadge** on scan/rotation rows via `km_astro_daily_signal.net_signal` — first real fusion artifact
3. **Full astro fusion** — per-stock astro tagging in scanEngine; un-hide SynthesisStrip's astro segment; re-enable MarketWeatherCard on Market Structure post-UX-rework
4. **Full responsive pass** (the L behind Day 7's mitigation)
5. Scan-membership persistence for power_buy / quiet_accumulation / distribution_warning → complete track-record coverage
6. Goal-oriented nav renames; demote Catalog; consolidate Dashboard vs Workspace-Today duplication
7. Habit loop v2: evening digest (phone number is already collected), streaks, changed-since-yesterday everywhere
8. Amber semantics unification + single color-token system + shared Button/Tab primitives
9. Glossary/explain-on-demand layer across all proprietary + Sanskrit terms
10. Workspace empty-state instead of `/setup` redirect; surface sign-out failures
11. Decide user-facing future of Panchang / DC-inference pages (currently admin silos)
12. Waking Giants / Flower Pot Burst / Strategic Rebirth / PEAD / PlanetPulse — spec'd in `docs/scanners/`, unbuilt; sequence after track-record infra exists so new scanners launch with hit rates

---

## 8. Needs Manual Verification

### Browser checks (do these yourself)

1. **Returning-login orphan**: log out/in as an onboarded regular user → confirm you land on `/dashboard` with no sidebar item highlighted.
2. **Mobile severity**: open `/dashboard`, `/scanner`, `/workspace` at 390px in devtools → grade horizontal scroll/overlap.
3. **Raw "Strong Bull" labels in production**: open a live scan card → confirm whether the MagicRS zone pill shows raw DB text (decides whether the D39 P0 reaches users).
4. **Free tier sees VaNi**: log in as `tier='free'` → `/dashboard` + Workspace Discovery → confirm MarketWeatherCard + VaNiHighlightsBoard render ungated.
5. **DataFreshnessChip → `/settings`** as a non-admin (`DataFreshnessChip.tsx:73`): does the only topbar data affordance dead-end regular users on an admin-oriented page?
6. **Admin pages by URL as a regular user**: visit `/rules`, `/astro-calendar` logged in as `role='user'` → confirm the admin UI renders (and whether PostgREST errors leak).
7. **Wall-clock TTFI**: stopwatch a fresh incognito signup → first scored stock card. Code predicts ~11 steps + 2 waits.
8. **EOD window copy**: between ~15:30–18:30 IST on a trading day, confirm Scanner's "check back after ~6:30 PM" state appears.
9. **Both-lists collision**: check whether any stock appears in both Strength and Caution on VaNi Highlights on a live day.
10. **breakout_surge real count**: on a strong tape, note the actual emit (worst case 500).

### DB queries (run in psql/pgAdmin against `kaala_dristi_db`)

```sql
-- 1. Astro calendar full-year 2026 coverage (the May–Dec digitization question)
SELECT month, COUNT(*) AS events, COUNT(*) FILTER (WHERE is_transit) AS transits
FROM km_astro_calendar WHERE year = 2026 GROUP BY month ORDER BY month;

-- 2. Is the daily signal stale relative to calendar edits? (P0 confirmation)
SELECT MAX(computed_at) AS signal_last_computed FROM km_astro_daily_signal;
SELECT MAX(updated_at)  AS calendar_last_edited FROM km_astro_calendar;
-- calendar_last_edited > signal_last_computed ⇒ signals are stale

-- 3. Daily-signal date coverage
SELECT MIN(trade_date), MAX(trade_date), COUNT(*) FROM km_astro_daily_signal;

-- 4. Did the transit-window generators run? (Sky Regime + overlays depend on it)
SELECT rule_id, COUNT(*), MIN(start_date), MAX(end_date)
FROM km_rule_transits GROUP BY rule_id ORDER BY rule_id;

-- 5. Panchang 2026 coverage
SELECT COUNT(*), MIN(cal_date), MAX(cal_date) FROM km_panchang_calendar
WHERE EXTRACT(YEAR FROM cal_date) = 2026;

-- 6. Confirm the live physical table name (rename reproducibility hole)
SELECT to_regclass('km_astro_calendar'), to_regclass('km_astro_calendar_2026');

-- 7. Can DB role `authenticated` read the astro tables? (live JWT role per CLAUDE.md)
SELECT t.table_name, has_table_privilege('authenticated', t.table_name, 'SELECT') AS can_read
FROM (VALUES ('km_astro_calendar'),('km_astro_daily_signal'),('km_astro_rule_master'),
             ('km_rule_transits'),('km_panchang_calendar'),('dc_inference'),('dc_lookup')) t(table_name);

-- 8. Astro-rule track-record freshness (DeepDivePanel reads these)
SELECT MAX(computed_at) FROM km_rule_confidence;
```

### Corrections to the audit brief (verified against repo)

- Migrations run through **145**, not ~M112.
- The calendar table is `km_astro_calendar` (renamed live from `km_astro_calendar_2026` with **no migration** — see W3 P1).
- Scanner column is `pct_from_breakout`/`breakout_level` — present but rendered only for `price_action` category scans.
- The `kaala-postgres` MCP connector was **not** available (`.mcp.json` empty); every data-population claim above is migration-inferred and covered by the SQL block.

---

*Read-only audit — no code was modified. All findings cite file:line as of branch state at commit `1913e5c`.*
