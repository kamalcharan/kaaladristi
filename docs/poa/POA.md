# Kāla-Drishti — Plan of Action (POA)

---

## Sprints

### Sprint 4 — Workspace Shell Redesign ✅ COMPLETE

| Step | Description | Status |
|------|-------------|--------|
| 4.1  | Tab shell scaffold (Today / Discovery / My Space) | ✅ |
| 4.2  | Today tab — VaNi Morning Brief pinned strip | ✅ |
| 4.3  | Today tab — MarketWeatherCard | ✅ |
| 4.4  | Today tab — Chart + breadth sections | ✅ |
| 4.5  | Today tab — Astro ICP section (CurrentSkyRail / Panchang / SixDay / NakVara) | ✅ |
| 4.6  | Discovery tab — SectorRotationFlow + ScannerWidgets | ✅ |
| 4.7  | My Space tab — WorkspaceCanvas drop-in | ✅ |
| 4.8  | ProfileSetup — ICP mode question (astro / technical) | ✅ |
| 4.9  | AtmosphericBadge extracted + wired to tab bar | ✅ |
| 4.10 | Sprint 4 QA checklist | ✅ |

---

## Backlog

| ID   | Description | Priority |
|------|-------------|----------|
| B01  | ISIN dedup — NSE-preferred filter in scan results | P0 |
| B02  | Scanner table view (full page, sortable columns) | P0 |
| B03  | ScanDataBundle missing columns (is_vani_surge, is_vani_breakout) | P0 |

---

## Completed

| ID   | Description |
|------|-------------|
| C01  | PostgREST client — replaced supabase-js with direct HTTP calls |
| C02  | Auth flow — kd_auth_login / kd_auth_register RPC |
| C03  | Framework system — user_frameworks table + API endpoints |
| C04  | WorkspaceCanvas — 12×10 CSS grid + dnd-kit drag |
| C05  | WorkspaceBlock — VaNi glow + right-click context menu |
| C06  | CatalogPage — 5-tab subnav + DeepDivePanel |
| C07  | CatalogDrawer — slides from right, 3 tabs, compact mode |
| C08  | CatalogActionIsland — floating pill with live block count |
| C09  | ProfileSetup wizard — 4-screen state machine |
| C10  | CorrelationDrawer — 4 shapes (ZONE_CONFLUENCE, EVENT_OVERLAP, EVENT_IN_STATE, THRESHOLD_CROSS) |
| C11  | VaNi Morning Brief — POST /api/vani/daily, 3-card strip |
| C12  | VaNi Correlation Insight — POST /api/vani/correlation-insight |
| C13  | ScannerWidget component created |
| C14  | Scanner system — 9 presets, pure TypeScript, client-side |
| C15  | Intraday Cockpit — /intraday/:indexId, time-aware |
| C16  | Equity Visual Pulse — /pulse/equity/:equityId |
| C17  | Bayer Rules — migration 101, transit generation scripts |
| C18  | Rolling metrics pipeline step 6g (d30/d365/w52/lifetime_high) |
| C19  | Atmospheric badge extracted + added to all scanners and workspace tab bar — Sprint 4 |
| C20  | BUG-01 fixed — SectorRotationFlow zone color mismatch (Title Case vs snake_case) — Sprint 4 |
| C21  | Workspace 3-tab shell (Today / Discovery / My Space) — Sprint 4 |
| C22  | icp_mode column added to km_profiles — Sprint 4 |
| C23  | IndexDropdown extracted to standalone component — Sprint 4 |
| C24  | VaNiMorningBrief pinned mode added — Sprint 4 |
| C25  | ProfileSetup ICP question added — Sprint 4 |
| C26  | ScannerWidget component created — Sprint 4 |

---

## SESSION HANDOVER
================
Date: 2026-06-19
Active Sprint: Sprint 4 — COMPLETE
Last completed: Step 4.10 — Sprint 4 QA
Next sprint: Sprint 5 — Scanner Table View + P0 fixes
Next step: B01 (ISIN dedup), B02 (Table view), B03 (ScanDataBundle missing columns)
Open questions:
  - Third scanner widget uses 'Strength Confluence' preset instead of 'vani_opportunity' — fix in Sprint 5
  - Alignment/placement polish on Today tab components needed — Sprint 5 UX pass
New bugs found: None
POA: /docs/poa/POA.md
Architecture: /docs/poa/ARCHITECTURE.md
