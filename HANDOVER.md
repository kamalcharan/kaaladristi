# Session Handover — 2026-07-11

For the next Claude Code session on `kamalcharan/kaaladristi`. Everything below is
**merged to `main`** (fast-forward, 21 commits, tip `575f413`). Read this first, then
verify the MCP connector, then resume the scanner matview at **Phase 1c**.

---

## 0. FIRST ACTION — verify the MCP connector is live

We stood up a **read-only Postgres MCP connector** to `kaala_dristi_db` this session.
It is fully built on the VPS and the claude.ai env vars are set. In a **new session**
(project MCP servers load only at session start), confirm it works:

```sql
SELECT count(*) FROM km_index_symbols;   -- expect 93
```

If the `kaala-postgres` tools aren't present, check: (a) `.mcp.json` is on the branch,
(b) env var `KD_MCP_BASIC` is set, (c) `mcp-db.dristiq.com` is in the environment network
allowlist, (d) it's genuinely a fresh session. Sanity from any shell:
`curl -u claude:<pw> https://mcp-db.dristiq.com/sse --max-time 5` → `event: endpoint`.

**This connector is the reason the scanner-matview parity diff is now feasible** — use it.

### Connector facts
- **Endpoint:** `https://mcp-db.dristiq.com/sse` (SSE), Basic auth `claude:<pw>` via `${KD_MCP_BASIC}`.
- **Architecture:** `kd-mcp-db` container (`crystaldba/postgres-mcp`, `--access-mode=restricted`,
  SSE :8000) on docker net `vikuna-net`, fronted by `vikuna-nginx` (TLS via Let's Encrypt,
  basic-auth), talking to `vikuna-postgres:5432` as role **`kd_readonly`**.
- **Read-only, three layers:** `kd_readonly` = SELECT-only + `default_transaction_read_only=on`
  + `statement_timeout=30s`; MCP `restricted` mode; no writable credential in the path.
  **Any SELECT is safe; writes are impossible.**
- **Runbook (as executed):** `docs/mcp-postgres-setup.md`.

### ⚠️ SECURITY — rotate before go-live (does not touch the repo)
- `kd_readonly` DB password is currently `Vikuna2026Secure` (reused a known string to unblock).
  Rotate: `ALTER ROLE kd_readonly PASSWORD '<new>';` → update `DATABASE_URI` env on
  `kd-mcp-db` → `docker restart kd-mcp-db`.
- Basic-auth password is `ChooseAPassword123` (a placeholder). Rotate:
  `printf "claude:$(openssl passwd -apr1 '<new>')\n" > /opt/vikuna/docker/docker/config/nginx/conf.d/mcp.htpasswd`
  → update `KD_MCP_BASIC` = `base64("claude:<new>")` in the claude.ai env.
- **Also flagged all session:** `vikuna_admin` prod cred was pasted in chat; and
  `docs/llm/Vikuna-Infrastructure-Documentation-v3.pdf` exposes prod DB passwords + JWT
  secret — rotate those and scrub the PDF from repo/history.

---

## 1. ACTIVE TASK — Scanner Materialized View MVP (resume at Phase 1c)

**Spec:** `SCANNER_BACKFILL_AND_VIEWS_SCOPING.md` (§5). **Working doc:** `SCAN_MATVIEW_IMPLEMENTATION.md`
(all Phase-1 analysis lives here — read it in full before writing SQL).

**Goal:** a `km_scan_results` materialized view (migration **147**) that reproduces the
**7 Path A / bundle scanners** with **exact parity**, plus audit/observability columns and a
`km_scan_exclusion_counts` companion. Then repoint the frontend to read it instead of
client-computing over a big EOD bundle.

In scope (7): `power_buy, power_sell, smart_money, fresh_breakout, quiet_accumulation,
distribution_warning, conviction_flow`. **Out of scope (must not regress):** the 7 Path B
direct-query scanners (`stage_2_leaders`, `breakout_surge`, etc.).

### Phase 1 — DONE (in `SCAN_MATVIEW_IMPLEMENTATION.md`)
- **Rule inventory** — every conditional/threshold/guard for all 7 scanners + shared helpers
  (`buildScanStock`, `hasDotInHistory` svd/sbd/syd, `getIndustryClassifications`,
  `evaluateOpportunity`, `computeVaniOpportunity`), cross-referenced to `scanEngine.ts` line #s.
- **Schema** — `km_scan_results` columns/PK `(preset_id,equity_id)`/indexes + 5 audit columns
  (`vani_path, flow_guard_applied, zone_coerced, history_insufficient, guard_notes`) +
  `km_scan_exclusion_counts` companion (per preset/date silently-dropped rows).
- **Part 2 guard-firing check — RUN on live data (5,340 rows, latest date):**
  - `ema_20 null` 0.04%, `atr_14 null/≤0` 0.84% → genuine edge cases (safety net works).
  - **`invalid magic_rs_zone` 47.5%** and **`flow_type=LOW_VOLUME` 77.4%** → **DOMINANT**, not edge cases.
- **Zone 47.5% root-caused:** the 2,538 rows are exactly `Neutral Bear` (1,419) + `Neutral Bull`
  (1,119). The **pipeline computes a 7-band zone scheme; the frontend `VALID_ZONES` knows only 5**
  (`scanEngine.ts:86`). Coercion-to-null is a **parity no-op for scan inclusion** (Neutral Bull/Bear
  fail every zone gate anyway) and matches current display → **port verbatim, Phase 1c ungated.**
- **vani_flag parity — RESOLVED by code inspection (the earlier "vani_path" question was moot):**
  all 7 bundle scans pass `presetId` into `buildScanStock`; 6/7 presets have a `vani_rule`
  (migration 106) so they already run flag-based `computeVaniOpportunity` **today**. Locked mapping:

  | Preset | `vani_flag` = |
  |---|---|
  | power_buy / fresh_breakout / quiet_accumulation | `is_vani_s2` |
  | power_sell / distribution_warning | `is_vani_distrib OR is_vani_weakness` |
  | conviction_flow | `is_vani_surge OR is_vani_breakout` |
  | smart_money | `evaluateOpportunity(bullish cfg)` — the only `evaluateOpportunity` preset |

  Bullish cfg (mig 044): band 1.0 / rvol 1.2 / zones {Strong Bull, Mild Bull} /
  flow {FRESH_LONGS, SHORT_COVERING} + LOW_VOLUME guard. **No flag backfill needed for parity**
  (frontend already reads `is_vani_*` from `km_equity_eod`).

### Phase 1c — NEXT: write migration 147 SQL
**Fully specified from code + migrations — no more live-DB input gates writing it.** Build the
7 `UNION ALL` blocks (each pre-sorted + `LIMIT`, rank via `ROW_NUMBER()`), the window-function
history derivations (magicRsTrend, xAmt, svd/sbd/syd dots, 20-day breakout high, 10-day-ago zone,
industry rank-change & pct_accumulation delta), the audit columns, and the exclusion-counts
matview. Include the rule inventory as SQL comments. **Grant SELECT to `authenticated`** (mig-142
lesson) + anon/kd_app/admin/"user"/kd_readonly. Live DB (MCP) is needed to **verify** parity, not write.

### Phases 2–4 (design in the doc)
- **2 — Refresh:** add a `scan_results` dimension to pipeline2 `DAILY_STEPS` (after
  vani_flags/stage_classification/index_returns/industry_composites) + a manual refresh endpoint.
- **3 — Frontend repoint:** the 7 scan fns + `getAllScanCounts` + `fetchVaniHighlights` read
  `km_scan_results` via PostgREST (`?preset_id=eq.<id>&order=rank`). Path B untouched.
- **4 — Ship gate:** run migration → **parity diff all 7 presets (now scriptable via MCP)** →
  perf before/after → Path B regression check → repoint in prod. Confirm backup dump name w/ owner first.

### Open, NON-blocking
- Flow-by-exchange split (is 77% LOW_VOLUME BSE-concentrated or market-wide?) — corrected query
  in doc §Part 2b. Sets urgency of the flag/CA backfill; does **not** gate the SQL.
- **Separate product finding (NOT this task):** `distribution_warning` silently misses
  `Strong Bull → Neutral Bear` slides because the stale 5-zone vocabulary drops Neutral Bear.
  Fix = add Neutral Bull/Bear to `signalScale.ts` `ZONE_LABELS`/`VALID_ZONES` + D39-neutral
  display labels + decide scanner semantics. Owner decision, flagged in the doc's Quirks.
- **Audit-column UI** is out of scope here (columns only); recommend surfacing
  `km_scan_exclusion_counts` by extending `DataHealthGrid` with a `scan_results` dimension
  (see doc Part 3) as a fast-follow *after* the ship gate — do **not** reuse the correlation pill/bar.

---

## 2. Other work merged to main this session

- **`AUDIT_REPORT.md`** — pre-launch product audit.
- **`ASTRO_PLUMBING_REPORT.md`** — three staleness axes; curated-scope traced to VaNiMorningBrief.
- **`ASTRO_VALIDATION_FINDINGS.md`** — 9 disciplined tests, **no repeating market edge**. **Astro is
  ON HOLD.** The real blockers surfaced: CA-adjustment contamination + non-backfilled `is_vani_*`
  flags. (One robust finding is *technical*, not astro: ~92% break-continuation.)
- **`MERCURY_SLICE_PLAN.md`** + migration **146** (`km_migration_146_transit_event_fields.sql`) +
  Mercury generator dedup fix; combust arc set to **15°** to match owner almanac.
- **D39 SEBI** (`37c0721`) — all displayed directional labels neutralized; `signalScale.ts` is the
  single source (`impactLabel/zoneLabel/rsiLabel/trendLabel` helpers). **No bull/bear/uptrend in any
  displayed label.**
- **`/dashboard` removed** (`2fdf677`) — orphan page + dead components deleted; `/settings` activated
  in nav. (`MarketWeatherCard` still renders on other pages.)
- **`/rules` pagination** (50/page) so the ~238-rule Mercury corpus is navigable.
- **`.mcp.json`** + **`docs/mcp-postgres-setup.md`** — the connector config + runbook.

---

## 3. Conventions & gotchas (still true)
- **PostgREST role reality:** logged-in browser users run as DB role **`authenticated`** (not
  `user`/`admin` despite migrations 096/140). **Every new PostgREST-read table/matview MUST grant
  SELECT to `authenticated`.** (mig-142 lesson.)
- **Next migration number: 147** (146 is the last on main).
- **Two DBs:** `kaala_dristi_db` (`DB_PRIMARY`) for everything; `vani_db` (`VANI_DB_URL`) only for
  VaNi cache/log. MCP connector points at `kaala_dristi_db`.
- **Deduped cross-stock reads:** use `v_equity_eod_deduped`, not raw `km_equity_eod`.
- **BSE numeric symbols:** render via `displaySymbol()`; filter out of TradingView exports.
- **Parity discipline:** the matview port must **replicate current behavior, including known
  quirks** (LOW_VOLUME guard, OR-named `is_vani_distrib_and_weakness`, zone coercion). Flag bugs;
  do **not** silently fix them.

---

## 4. Suggested first moves (new session)
1. Verify MCP: `SELECT count(*) FROM km_index_symbols;` → 93.
2. Read `SCAN_MATVIEW_IMPLEMENTATION.md` end-to-end.
3. Write migration 147 (Phase 1c) as a reviewed draft.
4. Use MCP to run the 7-preset parity diff against live scanner output on the latest trade date.
5. (Parallel, optional) run the flow-by-exchange query to size the flag/CA-backfill urgency.
