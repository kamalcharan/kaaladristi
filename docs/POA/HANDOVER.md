# DristiQ — Sprint 12 → Sprint 13 Handover
> Date: 2026-07-01
> Outgoing sprint: Sprint 12 — VaNi + Custom Index
> Incoming sprint: Sprint 13 — Astro Integration + Custom Index Carry

---

## 1. Session Handover Block

```
SESSION START
POA:          /docs/POA/POA.md
Architecture: /docs/POA/ARCHITECTURE.md
Active Sprint: Sprint 13 — Astro Integration + Custom Index Carry
Last completed: Sprint 12 (B71, B70, B56, B57, B58, B75)
Next step: B76 Path 2 redesign (Custom Index Discover proper architecture)
Open questions:
  - B76 Path 2: confirm stock universe filter for Sonnet prompt (liquid NSE, mcap >= 10,000 Cr?)
  - BUG-08: A/D pipeline 1.2% coverage — investigate compute_all_flow_intelligence() gate
  - Migration 118 run status on VPS — confirm km_sector_zodiac row count
```

---

## 2. Repo + Infrastructure

| Item | Detail |
|---|---|
| Repo | `kamalcharan/kaaladristi` (GitHub) |
| VPS | Hostinger VPS — `187.127.136.65` |
| DB | `kaala_dristi_db` on VPS. Env var: `DB_PRIMARY=postgresql://...` |
| VaNi DB | `vani_db` on VPS. Env var: `VANI_DB_URL=postgresql://...` |
| API server | `uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101` |
| PostgREST | Port 3000, JWT-secured |
| LLM (Qwen3) | `llm.dristiq.io` — Qwen3 4B, self-hosted. `/no_think` directive required on all calls. |
| LLM (Claude) | Anthropic API via `lib/ai_client.py` — `claude_complete()`. Reads `AI_API_KEY` or `ANTHROPIC_API_KEY`. Used for Path 2 (D42). |
| Dev branch | `claude/nifty-turing-jabolq` → merge to `main` → auto-deployed to VPS |
| POA | `/docs/POA/POA.md` |
| Architecture | `/docs/POA/ARCHITECTURE.md` |
| Env file | `App/.env` (single file, both frontend + backend) |

---

## 3. Sprint 12 — Completed Items

| Task | What was done |
|---|---|
| B71 — VaNiSector Skill | 2-sentence sector insight via LLM. Done, reviewed, deployed. |
| B70 — ScoreCard Skill | Unified index score card component. Done, reviewed, deployed. |
| B56 — Custom Index DB | No new tables needed. Reused `km_index_symbols` (`category='custom'`), `km_index_constituents`, `km_index_eod`. Existing schema fully sufficient. |
| B57 — Custom Index Admin UI | Three routes: `/custom-index` (listing with constituent counts + click → sector-rotation detail), `/custom-index/create` (manual basket creation), `/custom-index/discover` (AI discovery shell + backend endpoint deployed). |
| B58 — Custom Index scoring | `App/backend/scripts/compute_custom_index_eod.py` — equal-weight AVG of constituent EOD (`close`, `ret_5d`, `ret_22d`, `ret_66d`). Upserts into `km_index_eod`. Verified on index 95. Run manually; not yet wired into daily pipeline (D41). |
| B75 — Custom Index Tab 4 | Admin-gated `Custom` tab on `/sector-rotation` page. Uses `SECTOR_TAB_CATEGORIES['custom']` filter. Visible only when `isAdmin === true`. Verified rendering. |
| Migration 118 | `km_sector_zodiac` table created (51 sector→zodiac mappings). 33 new sectors added to `km_sectors`. Outer-planet zodiac co-rulers added to `km_zodiac_lords` (Scorpio→Pluto, Aquarius→Hershel, Pisces→Neptune). |
| PR #70 | `custom_index_discover` endpoint: replaced broken `_get_db().cursor()` with proven `_conn()` + `RealDictCursor` pattern. Dead `return {'ok': True}` removed. |
| PR #71 | `json.dumps(stocks, default=str)` in discover endpoint — prevents `TypeError` on `Decimal`/`date` from RealDictCursor. |
| PR #72 | Migration 118 committed and pushed. Requires manual run on VPS. |

---

## 4. Sprint 12 — Carry Items (not done)

| Task | Status | Reason | Sprint 13 priority |
|---|---|---|---|
| B76 — AI Mode A | 🟡 Partial | UI built + endpoint deployed. Architecture rework needed — Qwen3 insufficient for Indian equities; must use Claude Sonnet (D42). Path 2 redesign: theme name → Sonnet → stock identification + astro tagging. | High |
| B62 — weight_pct | ❌ Not started | No data source identified yet for constituent weights | Medium |
| B77 — AI Mode B | ❌ Not started | Depends on B76 Path 2 being stable first | Low |
| B78 — Custom RSI/flow | ❌ Parked | Documented as D41. Step 0d/0e are NSE-bhav-gated; extension needed. | Low |

---

## 5. Sprint 13 — Priorities (in order)

| Priority | Task | Notes |
|---|---|---|
| 1 | **B76 Path 2 redesign** | Theme name → Sonnet → liquid NSE stock identification + sector lord/zodiac tagging → admin review/save. Uses `km_sector_lords` + `km_sector_zodiac` (migration 118). See D42. |
| 2 | **BUG-08** | `compute_all_flow_intelligence()` covers only ~1.2% of equity universe. A/D column blank for 98.8% of stocks. Pipeline gate investigation needed. |
| 3 | **B13** | Lookback filter 5D/22D/66D on sector rotation — currently hardcoded at 5D. User-toggleable. |
| 4 | **B72** | Astro → sector historical correlation. Which sectors react to which astro events. Requires `km_astro_calendar` populated for 2026–2027. |
| 5 | **B73** | Astro forward signal overlay on sector cards. Upcoming favorable/unfavorable windows. Depends on B72. |
| 6 | **B74** | Real-time 3-axis confluence badge (Money + Participation + Momentum). |
| 7 | **B38** | Astro confluence on sector/industry view — favorable/unfavorable badge per sector. |
| 8 | **B62** | Populate `weight_pct` in `km_index_constituents` for all 93 indices. |
| 9 | **B77** | AI Mode B — proactive emergent theme discovery. After B76 stable. |
| 10 | **B78** | Custom Index RSI + flow_type. Extend Step 0d/0e or build equal-weight RSI calc. |

---

## 6. Open Infrastructure Items

| Item | Status | Notes |
|---|---|---|
| Migration 118 VPS run | ⚠️ Pending | Run: `psql $DB_PRIMARY -f App/DBscripts/km_migration_118_quant_mappings.sql`. Also needed: `SELECT setval('km_sectors_id_seq', (SELECT MAX(id) FROM km_sectors))` is included in migration. |
| `compute_custom_index_eod.py` nightly | ⚠️ Manual only | Not in daily pipeline. Run manually after creating a new custom index. |
| `km_sector_zodiac` row count | ⚠️ Unverified | Expected 51 rows after migration 118 runs. Some sector names may not resolve (e.g. 'Silk & Cotton' vs seed name) — verify counts. |
| `custom_index_discover` endpoint | ⚠️ Architecture pending | Deployed but B76 Path 2 redesign needed before production. `_conn()` + `RealDictCursor` fix merged (PR #70, #71). |
| BUG-09 (sniper_hot = 50) | ✅ Closed | Design behavior — formula cap at 50 is correct per Pine Script source. |
| BUG-08 (A/D 1.2%) | ⬜ Open | Was partially fixed in Sprint 8 (removed RVOL gate) — coverage rose to 93.3% for that date. But Sprint 13 handover notes suggest still open — re-verify current coverage on latest trade date. |

---

## 7. Key Decisions This Session (D39–D43)

| # | Decision |
|---|---|
| D39 | ROC badge language: `expanding / slowing / turning / contracting / warming_up`. Never bull/bear/uptrend/downtrend. `ROC_BADGE_MAP` in `BreadthRocChart.tsx` is source of truth. |
| D40 | Breadth formula uses `ema_20 + sma_50 + sma_150` (EMA50/EMA150 don't exist in `km_equity_eod`). Conscious deviation from spec — signal quality difference minimal at these window lengths. |
| D41 | `compute_custom_index_eod.py` is standalone, not in daily pipeline. Must be run manually. Computes `close/ret_5d/22d/66d` only. Signal badge blank for custom indices until B78 resolved. |
| D42 | Custom Index Discover Path 2: theme name → Sonnet → stock identification + astro tagging. Qwen3 not suitable (insufficient Indian mid/small cap knowledge). Claude Sonnet only viable LLM. Endpoint deployed at `POST /api/custom-index/discover`; architecture rework (B76) needed. |
| D43 | `km_sector_zodiac` added in migration 118 — sector→zodiac sign many-to-many. 51 mappings. Used for astro tagging in Path 2 discovery. |

---

## 8. Skills Registry (current state)

| Skill | File | Status |
|---|---|---|
| FlowIntensityMap | `App/mnt/skills/user/flow_intensity_map/SKILL.md` | ✅ Live |
| SEBI Sweep | `App/mnt/skills/user/sebi-sweep/SKILL.md` | ✅ Live |
| VaNiSector | Registered in `lib/ai_prompts.py` SKILLS dict | ✅ Live (B71) |
| ScoreCard | Frontend component | ✅ Live (B70) |
| BreadthGauge | `MarketBreadthChart` parameterized | ✅ Live (B68) |
| ROCChart | `BreadthRocChart` parameterized | ✅ Live (B69) |
| CapitalHeat | Spec at `docs/sector-index/capital_heat.html` | ⬜ Not built (SR-F11 deferred) |

**Skill architecture rule (D35):** Every new capability is a Skill. One input contract, one output contract, one SKILL.md. No page builds its own variant of an existing Skill.

---

## 9. DB Schema — Custom Index Tables (as-built)

No new tables were created. Custom indices reuse existing tables:

| Table | Custom Index Usage |
|---|---|
| `km_index_symbols` | `category = 'custom'`, `is_active = true` |
| `km_index_constituents` | `index_id → km_index_symbols.id` where category='custom' |
| `km_index_eod` | Populated by `compute_custom_index_eod.py` (equal-weight AVG) |

New table added this sprint:

| Table | Purpose |
|---|---|
| `km_sector_zodiac` | Sector → zodiac sign many-to-many (51 mappings). `sector_id FK → km_sectors`, `zodiac_id FK → km_zodiac_signs`. Used by Path 2 astro tagging. |

---

## 10. File Map — Custom Index Feature

| File | Purpose |
|---|---|
| `App/frontend/src/views/CustomIndexPage.tsx` | `/custom-index` listing — fetches `km_index_symbols` where `category='custom'`, shows constituent counts, click → `/sector-rotation/:id` |
| `App/frontend/src/views/CustomIndexCreatePage.tsx` | `/custom-index/create` — manual basket creation form |
| `App/frontend/src/views/CustomIndexDiscoverPage.tsx` | `/custom-index/discover` — AI discovery UI shell |
| `App/frontend/src/views/SectorRotationPage.tsx` | Admin-gated `Custom` tab added via `SECTOR_TAB_CATEGORIES['custom']` |
| `App/frontend/src/services/sectorRotation.ts` | `SectorTab` type extended with `'custom'`. `SECTOR_TAB_CATEGORIES`, `SECTOR_TAB_LABELS` updated. |
| `App/backend/scripts/compute_custom_index_eod.py` | Equal-weight EOD compute + `compute_all_index_scores()`. Run manually. |
| `App/backend/pipeline2_api.py` | `POST /api/custom-index/discover` endpoint. Uses `_conn()` + `RealDictCursor`. |
| `App/DBscripts/km_migration_118_quant_mappings.sql` | `km_sector_zodiac` CREATE + populate. New sectors. Outer-planet zodiac lords. |
