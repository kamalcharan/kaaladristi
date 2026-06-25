## Sprint 9 Session 2 Handover (2026-06-24)

### Git State
Last stable commit: 046ddeb
Force reset to this commit at end of session.
All Phase 3 work needs to be redone cleanly.

### What Was Completed (Stable)
- Phase 1: Scanner group restructure ✅
  - 4 groups: Price Action, Stage Analysis, Flow, Market
  - Migration 110 created (needs VPS run)
  - fieldAvailability.ts created
  - ScanView.tsx group navigation working
- Phase 2: Field management ✅
  - fieldAvailability.ts with defaultCols/optionalCols
  - score_5d, score_22d, score_66d added to fieldConfig.ts
  - OPTIONAL_COLS replaced with getFieldsForGroup()
- Migration 111 ✅
  - Adds avg_amt_66d, score_5d, score_22d, 
    pct_5d, pct_22d, pct_66d, surge_22d
  - to km_equity_eod
  - Already run on VPS — DO NOT run again
  - CUPID verified: score_5d=51.91, pct_5d=9.51%

### What Is Broken (Needs Redo)
- Phase 3: scanBreakoutSurgeDaily() — messy,
  multiple debug commits, needs clean rewrite
- Existing scanners (Stage Analysis, Flow, Market)
  not returning data — likely executeScan() 
  routing broken
- CORS issue was fixed via vite.config.ts proxy
  — this fix must be preserved

### Phase 3 Plan (Next Session)
Do in this exact order:

STEP 1 — Preserve vite.config.ts CORS fix
Before any reset, copy vite.config.ts and 
postgrest.ts changes to a safe branch.

STEP 2 — Fix executeScan() routing
This is why existing scanners are broken.
executeScan() must correctly route each 
scanId to its scanner function.
Check routing table — all scanIds must map
to a function.

STEP 3 — Clean scanBreakoutSurgeDaily()
Rewrite from scratch using this spec:
Universe: NSE + BSE, mcap_cr >= 3000 OR NULL
Entry: close > MAX(prior 20 bars) AND pct_chng > 0
Scores: read from DB columns (score_5d, score_22d)
        NOT computed client-side
Amounts: read from DB columns 
         (avg_amt_5d, avg_amt_22d, avg_amt_66d)
Returns: read from DB columns (pct_5d, pct_22d, pct_66d)
Sort: score_5d DESC
MCap filter: >= 3000 Cr (not 10000)

STEP 4 — Wire all scanners to groups
Ensure all existing scanners return data
before adding new ones.

### Key Decisions Made This Session
- Scanner groups: Price Action, Stage Analysis, 
  Flow, Market (no Bear Signals — SEBI)
- Stage Analysis: Stage 2 Watch (default), 
  Stage 2 Leaders, VaNi Opportunity,
  Stage 3 Watch, Stage 4 Leaders, VaNi Exit Watch
- Flow: Conviction Flow (default), 
  Strength Confluence
- Market: Smart Money (default), 
  Quiet Accumulation, Distribution Warning
- Price Action default tab: Breakout Surge Daily
- MCap threshold: >= 3000 Cr (changed from 10000)
- All scores/amounts/returns: DB-side, not client
- SEBI: No "Strong Bull" label — replace with 
  neutral term (pending)
- Delivery Surge label confirmed
- PE columns: parked for later

### Pending VPS Actions
- Migration 110: still needs to run on VPS
  File: App/DBscripts/km_migration_110_scanner_categories.sql
- Migration 111: already run ✅

### DB Connection
postgresql://vikuna_admin:Vikuna2026Secure@
187.127.136.65:5432/kaala_dristi_db

### VPS
187.127.136.65
Repo: /opt/vikuna/apps/kaaladristi/kaaladristi/
Backend: App/backend/
Frontend: App/frontend/src/
