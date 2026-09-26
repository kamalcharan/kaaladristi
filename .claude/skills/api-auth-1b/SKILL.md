---
name: api-auth-1b
description: Phase 1b design contract for the admin guard and the master-data write boundary on kd-pipeline-api2 and PostgREST — the 42 routes moving user → admin with their calling pages, the is_admin() verdict, migration 228 (RLS on six master tables, the blanket-grant revoke, anon locked down to the four auth RPCs, user_subscriptions own-row SELECT), the kd_update_profile whitelist verdict, the deletion list (27 dead routes, 6 dead frontend files plus PipelineDashboard and the orphan callers, the v1 pipeline_api service and root worker.py), acceptance tests, rollout and rollback, and the closed decisions. Use when implementing or reviewing Phase 1b, when adding an admin-only route (it must use the admin guard from this contract), when giving a PostgREST table a write policy, when granting anything to anon, or when touching _require_admin, is_admin(), kd_update_profile, JobMonitor, docker-compose's pipeline-api service, or anything under pages/DataPipeline.
---

# Phase 1b — admin guard, master-data RLS, anon lockdown, dead-code removal

Design only. No code and no migration file exist for this yet. §9 is closed:
every question raised by the first draft was decided by the owner on
2026-09-26 and folded into the sections below.

Inputs: `.claude/skills/api-auth-contract/SKILL.md` (1a; its 1b column is the
starting point), the 2026-09-26 auth audit, `docs/security/hotfix-2026-09-26.md`
(follow-ups 4, 7, 8, 9, 10). Every "live" fact below was read from
`kaala_dristi_db` through the read-only MCP on 2026-09-26, after migrations 226
and 227 and the JWT rotation — not inferred from migration text. Route line
numbers are from `pipeline2_api.py` at `main` `03a10c2` (post-1a).

## Locked decisions (owner)

1. **Build gate:** the 1b build starts only after 1a is switched to
   `AUTH_MODE=enforce` on the VPS **and** `scripts/auth_acceptance.py
   --expect-mode enforce` passes there.
2. Routes whose 1b target is `admin` get the admin guard, which reuses
   `_require_admin` (`km_profiles.role = 'admin'`). Classification is by
   calling page (1a §9.5).
3. Master-data writes are protected with RLS, not by moving them to the API.
4. The 27 dead FastAPI routes are deleted.
5. The 16 dead v1-path frontend call sites (6 files) are deleted.
6. The legacy `pipeline_api.py` v1 service is removed entirely (compose
   service `pipeline-api`, container `kd-pipeline-api`, port 8100).
   **`kd-pipeline-api` is not running on the VPS; only `kd-pipeline-api2`
   exists (checked 26 Sep).** Removal is a compose-block and code deletion.
7. `user_subscriptions` gets an own-row SELECT for `authenticated`.
8. The twelve §9 decisions, recorded there and applied throughout.

---

## 1. Admin route table

### 1.1 How the admin guard composes with 1a

1a put ONE app-wide dependency, `route_guard`, on every route: it decides
`exempt | guest | user` by path and, for `user`, verifies the bearer token
(HS256, `role=authenticated`, `aud` absent or `app`, UUID `sub`). Admin is a
**second, per-route** dependency layered on top, never a fourth path class:

```
route_guard (app-wide)          require_admin (per route, 1b)
  user token rules pass    →    SELECT role, is_suspended FROM km_profiles WHERE id = <sub>
                                role = 'admin' AND NOT is_suspended → handler runs
                                otherwise                          → 403 detail='not_admin'
```

- `require_admin` lives in `lib/auth.py` next to the other guards and is the
  existing `_require_admin(conn, caller_id)` body moved there, with one
  addition: it also refuses a suspended admin (`AND NOT
  COALESCE(is_suspended, false)`), mirroring §2's change to `is_admin()` so
  the API and the DB agree on who is an admin. One primary-key lookup on
  `km_profiles` per admin request, run as `kd_app` (whose `profiles_app_all`
  policy from 226 lets it read every row). It takes
  `caller_id = Depends(get_current_user_id)`, so a missing/invalid token is
  still a 401 from the 1a rules before the role is looked up; only a valid
  non-admin session reaches the 403. The five `/api/admin/users*` routes
  switch to the same dependency (they still receive `caller_id` for the audit
  row).
- Status is **403**, not 401. The 1a frontend client treats 401 as a dead
  session and signs the user out; a non-admin who reaches an admin route must
  not be logged out for it. `detail='not_admin'` joins the 1a reason
  vocabulary (`missing | invalid | expired | wrong_role | wrong_aud |
  bad_sub`).
- The lookup is per request, uncached, so a plan change or suspension takes
  effect on the next request. At today's admin-route volume the extra PK read
  is not measurable.
- The JWT `role` claim is never consulted for admin-ness. `kd_auth_login`
  stamps `role=authenticated` for everyone (migration 144, confirmed live),
  so there is no admin claim to trust and none is introduced.

**`AUTH_MODE` and the admin guard (decision §9.1).** The admin guard obeys
`off` (bypassed, like every guard) and is **enforced in both `audit` and
`enforce`**; in `audit` it additionally logs. A rollback of 1a to `audit`
therefore never opens an admin route. The 1a audit window existed to discover
frontend call sites still sending no token, a migration problem where letting
the request through was the point; a non-admin session on an admin route is
not a migration artefact and there is nothing to discover by admitting it.
The audit line uses the 1a format:

```
auth.audit route=POST /api/pipeline2/fix guard=admin reason=not_admin ip=… caller=page:/data-pipeline
```

`test_auth_guards.py` gains a test that pins this: with `AUTH_MODE=audit`, a
user token on an admin route is 403 **and** produces the audit line.

### 1.2 Routes moving `user → admin` (42)

"Page" is where the caller is mounted; every page below is `adminOnly` in
`Sidebar.tsx` (lines 36–48) or admin-gated inside the view, which is what
decision 1a §9.5 keys on. Line = decorator line at `main` `03a10c2`.

**Pipeline ops — page `/data-pipeline` (`pages/DataPipeline/*`, adminOnly)** — 10

| line | route | caller |
|---|---|---|
| 361 | GET /api/pipeline2/health | `HealthGrid.tsx` → `fetchHealthGrid` |
| 381 | GET /api/pipeline2/jobs | `JobQueue.tsx` → `fetchJobs` |
| 462 | POST /api/pipeline2/fix | `RunPanel.tsx` → `enqueueFix` |
| 512 | POST /api/pipeline2/daily-run | `RunPanel.tsx` → `enqueueDailyRun` |
| 549 | POST /api/pipeline2/backfill | `RunPanel.tsx` → `enqueueBackfill` |
| 621 | POST /api/pipeline2/calendar/mark | `HealthGrid.tsx` → `markCalendar` |
| 677 | POST /api/pipeline2/cancel | `JobQueue.tsx` → `cancelJob`, `cancelBatch` |
| 721 | GET /api/pipeline2/dimensions | `RunPanel.tsx` → `fetchDimensions` |
| 773 | GET /api/pipeline2/scheduler | `RunPanel.tsx` → `fetchSchedulerInfo` |
| 3582 | GET /api/pipeline2/ping | `hooks/useBackendStatus.ts` — the "Backend offline" pill. Decision 1a §9.4: ping becomes admin; the pill moves to `GET /api/alive` (§1.4) |

**Astro calendar and panchang — pages `/astro-calendar` (`CalendarView`, write
controls gated by `isAdmin` in the view) and `/admin/panchang`
(`AdminPanchangView`, adminOnly)** — 7

| line | route | caller |
|---|---|---|
| 1847 | POST /api/astro/calendar | `CalendarView.tsx` → `createCalendarEvent` |
| 1876 | PATCH /api/astro/calendar/{event_id} | `CalendarView.tsx` → `updateCalendarEvent` |
| 1910 | DELETE /api/astro/calendar/{event_id} | `CalendarView.tsx` → `deleteCalendarEvent` |
| 1928 | POST /api/panchang/generate | `AdminPanchangView.tsx` → `generatePanchangMonth` |
| 2076 | POST /api/panchang/notes | `AdminPanchangView.tsx` → `createPanchangNote` |
| 2098 | PATCH /api/panchang/notes/{note_id} | `AdminPanchangView.tsx` → `updatePanchangNote` |
| 2123 | DELETE /api/panchang/notes/{note_id} | `AdminPanchangView.tsx` → `deletePanchangNote` |

`/astro-calendar` is a user-visible page; only its write controls are
admin-gated, and those three write routes are the only ones on the page
reachable by admins alone. The page's reads (`/api/panchang/week` via
`astroCalendar.ts:84`) stay `user`.

**Rule engine and the job monitor — page `/rules` (`pages/RuleEngine/*`,
adminOnly) and `JobMonitor` (admin-only after 1b, decision §9.2)** — 16

| line | route | caller |
|---|---|---|
| 3839 | POST /api/discovery/run-all | `discoveryService.ts` |
| 3851 | POST /api/discovery/run-missing | `discoveryService.ts` |
| 3883 | POST /api/discovery/run-rule/{rule_id} | `discoveryService.ts` |
| 3930 | GET /api/discovery/signal-counts | `discoveryService.ts` (RuleList) |
| 3986 | **POST /api/discovery/cancel** | `discoveryService.ts` → `JobMonitor` — **admin** (decision §9.2; was `user` in 1a §9.5) |
| 3995 | POST /api/discovery/run-clean | `discoveryService.ts` |
| 4021 | POST /api/discovery/rule/{rule_id}/drop-signals | `discoveryService.ts` |
| 4046 | GET /api/discovery/diagnose | `discoveryService.ts` |
| 4280 | POST /api/patterns/run | `PatternStudyButton.tsx` |
| 4298 | GET /api/patterns/status | `PatternStudyButton.tsx` |
| 4323 | POST /api/confidence/compute | `discoveryService.ts` |
| 4375 | GET /api/confidence/yearly/{rule_id} | `RuleDetail.tsx` |
| 6903 | GET /api/rules/{rule_id}/inference | `RuleInferenceModal.tsx`, `RuleInferencePanel.tsx` |
| 7011 | POST /api/rules/{rule_id}/inference | `RuleInferenceModal.tsx` |
| 7119 | POST /api/rules/{rule_id}/inference/generate | `RuleInferenceModal.tsx` |
| 7194 | DELETE /api/rules/inference/{inference_id} | `RuleInferenceModal.tsx` |

**VaNi cache controls** — 2

| line | route | caller |
|---|---|---|
| 5318 | DELETE /api/vani/correlation-insight/{item_a}/{item_b}/{shape} | `CorrelationPage.tsx:797` — control rendered for `isAdmin` only |
| 5805 | DELETE /api/vani/cache | `VaNi/VaNiMessage.tsx:99` — already rendered only when the `isAdmin` prop is true (line 95); 1b adds the server-side guard the control was missing |

**Custom index — page `/custom-index` (adminOnly)** — 7

| line | route | caller |
|---|---|---|
| 8037 | POST /api/custom-index/discover | `CustomIndexDiscoverPage.tsx` |
| 8178 | GET /api/custom-index/themes | `CustomIndexDiscoverPage.tsx` |
| 8213 | PATCH /api/custom-index/themes/{theme_id} | `CustomIndexDiscoverPage.tsx` |
| 8241 | POST /api/custom-index/{index_id}/compute | `CustomIndexPage`, `CustomIndexManagePage`, `CustomIndexCreatePage` |
| 8392 | DELETE /api/custom-index/{index_id} | `CustomIndexPage.tsx` |
| 8439 | POST /api/custom-index/{index_id}/suggest | `CustomIndexManagePage.tsx` |
| 8529 | POST /api/custom-index/target | `CustomIndexDiscoverPage.tsx` |

**Already admin, unchanged** — 5: `GET /api/admin/users`, `POST
/api/admin/users/{id}/suspend|plan|extend|delete` (7273–7435).

**Total admin after 1b: 47** (42 moving + 5). Reconciliation with the 1a
count of 54 admin targets: 42 moving + 5 unchanged + 8 admin-target routes
that are dead and get deleted instead (`pipeline2/jobs/{job_id}`,
`pipeline/refresh-breadth`, `pipeline/refresh-breadth-roc`,
`vani/clear-cache`, `vani/observation-cache/…`,
`vani/correlation-insight/clear-cache`, `vani/warm-scanner-explainers`,
`vani/warm-help-intents`) = 55; the one over 54 is `discovery/cancel`, moved
from `user` by decision §9.2.

### 1.3 Routes staying `user`, with the borderline reasons

| route | why it stays `user` |
|---|---|
| GET /api/pipeline2/last-run | `PipelineHealthBar` on `/workspace` and `LastRunBanner`; every profile sees the data-freshness line. Read-only, no job control (1a §9.4) |
| GET /api/discovery/status, GET /api/confidence/status | read-only job state. After §9.2 `JobMonitor` renders only for admins, so in practice only admins poll them, but a read of "is a job running" is not an admin capability and no page needs them guarded. Kept `user` so a future non-admin surface can show job state without a contract change |
| GET /api/ai/rule-insight, GET /api/ai/active-rule-today | `RuleInsightCard`, `WorkspaceCanvas`, `OverlayExplainPopover`, `useConfluenceDetection` — user surfaces |
| GET /api/confluence/heatmap, /timeline | `MarketStructureView`, `ConfluenceDotGrid` — user pages |
| GET /api/panchang/daily, /week, /calendar | reads; `/panchang` is adminOnly but `useIntraday`, `SixDayOutlookCompact` and `astroCalendar.ts` read them from user pages. A read-only calendar is not an admin capability |
| GET /api/astro/daily-signal, /transits, GET /api/intraday/plan-score | user pages (`/intraday/:id` is adminOnly in the nav but reachable by URL and read-only) |
| GET /api/scan/presets, POST /api/vani/ask, POST /api/vani/feedback, POST /api/ai/vani-narrate, the `/api/ai/*` insight and `fpb-*` routes | the product surface for every profile. Rate limits on LLM routes remain out of scope (1a §8) |
| GET/PUT /api/framework/{id}, the four `/api/bookmarks/*`, POST /api/correlation/compute, POST /api/vani/correlation-insight, GET /api/landing/spotlight/reveal | per-user data, already bearer + own-id checks |
| POST /api/payments/create-order, /reconcile | the paying user's own flow |
| **GET /api/alive** (new, §1.4) | the one thing every logged-in session may ask the API |

### 1.4 The backend-status pill after ping goes admin (decision §9.5)

`useBackendStatus` polls `GET /api/pipeline2/ping` every 15 s from `JobMonitor`
and `RuleDetail`. After 1b a user session gets 403 there and the pill would
read "Backend offline" for every non-admin.

Decided: add **`GET /api/alive`** — `user` guard, body `{"ok": true}` and
nothing else: no `SELECT 1`, no worker state, no `auth_mode`. It answers one
question (is the API process up and accepting this session) and leaks nothing
`ping` carries (`worker_running`, `auth_mode`). `useBackendStatus` points at
it; `ping` keeps its full body for the Data Pipeline page, and
`/internal/health` keeps it for ops.

### 1.5 `JobMonitor` becomes admin-only (decision §9.2)

`JobMonitor` is mounted in `Layout.tsx:192` for every profile and carries the
cancel control. After 1b it renders only when `isAdmin` (from `useAuthStore`),
so regular users never see job controls — which is also what makes
`discovery/cancel` an admin route without breaking anyone: the only caller is
a component non-admins no longer mount. The backend-status pill it hosts
still has to reach every profile; it moves to `/api/alive` regardless of
where it renders (§1.4). Frontend work list:

- `components/domain/JobMonitor.tsx`: early-return `null` unless `isAdmin`.
- `hooks/useBackendStatus.ts`: probe `/api/alive`.
- `scripts/qa/check-*.mjs` that assert on `JobMonitor` (none found on
  2026-09-26; re-grep at build time).

The 1a acceptance script's `USER_ROUTES` list loses `ping`, `discovery/cancel`
and the other 40 moved routes into `ADMIN_ROUTES`, and gains `GET /api/alive`
(§7).

---

## 2. `is_admin()` analysis

Live definition (`pg_get_functiondef`, 2026-09-26):

```sql
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM km_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$function$
-- proconfig: NULL   proacl: {=X, vikuna_admin=X, admin=X}   owner: vikuna_admin
```

`auth.uid()` (migration 149 shim, live) is
`NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid`.

**What it checks:** the `sub` claim of the request's JWT, looked up in
`km_profiles`, and the stored `role`. It does **not** trust a role claim. It
runs as its owner `vikuna_admin` (superuser, BYPASSRLS), so the lookup ignores
the `km_profiles` RLS policies — not even required, since
`profiles_self_select` lets `authenticated` see its own row, and own row is
the only row `is_admin()` reads.

**Can a normal user's token satisfy it?** Only by having
`km_profiles.role = 'admin'`. The `sub` is inside the HS256 signature; after
226 + 227 the two signers are executable by `vikuna_admin` only.
`kd_auth_login` (live body) stamps `role='authenticated'` unconditionally and
returns the profile role in the JSON body **for UI gating only**; nothing in
the claims says "admin". **Verdict: correct design; no redesign.** It already
is the profile-lookup-by-`sub`, SECURITY DEFINER shape.

**228 replaces it with (decision §9.7):**

```sql
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM km_profiles
    WHERE id = auth.uid() AND role = 'admin' AND NOT COALESCE(is_suspended, false)
  );
$function$;
```

- `SET search_path = public, pg_temp`: a SECURITY DEFINER function without it
  resolves `km_profiles` through the caller's search path; `pg_temp` last so a
  temp table cannot shadow either. `kd_update_profile` and both 207/208
  trigger functions already do this.
- `AND NOT COALESCE(is_suspended, false)`: a suspended admin stops being one
  on the next request instead of at token expiry (7 days). `kd_auth_login`
  already refuses a suspended account at login; this closes the live-token
  gap. `_require_admin` (§1.1) applies the same predicate so the API and the
  policies agree.
- `CREATE OR REPLACE` keeps the OID, so the policies that reference it and
  the `=X` / `admin=X` grants survive. The 226 default-privileges rule
  (`REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` for `vikuna_admin`) applies only
  to NEW functions, so the existing PUBLIC EXECUTE is untouched by the
  replace — and §3.6 then removes it deliberately, re-granting
  `authenticated, kd_app` (the roles whose policies evaluate it).

Related, for the record: the `admin` DB role has `BYPASSRLS`; after 227 no
login role is a member of it, so it is inert. The two live `km_profiles`
policies "Admins can read all profiles" / "Admins can update any profile"
(`FOR public USING is_admin()`) let an admin session PATCH any profile
through PostgREST, `role` and `tier` included — admin power used by nothing in
the frontend (admin edits go through `/api/admin/users*`). They stay.

---

## 3. Migration 228 — RLS on master data, the grant cleanups, and the anon lockdown

### 3.1 Who writes what (live)

| role | bypass RLS | how it reaches the DB | policies must name it? |
|---|---|---|---|
| `kd_app` | no | FastAPI (`kd-pipeline-api2`), the pipeline2 worker and scheduler (`DATABASE_URL=postgresql://kd_app:…` in compose, psycopg2 via `lib/db_client.py`), every `scripts/*.py` | **yes** — every table it writes needs a `kd_app` policy or its writes silently affect 0 rows |
| `authenticated` | no | every logged-in PostgREST request (`vikuna_api` → `SET ROLE authenticated`) | yes |
| `anon` | no | logged-out PostgREST requests | **no longer** (§3.6): after 228 anon reads nothing |
| `service_role` | no | no login role is a member; only `vikuna_admin`. **Nothing mints a `service_role` token** (decision §9.9): the only signers are `kd_generate_token`/`kd_sign_jwt` (`vikuna_admin=X` only), and `kd_auth_login`/`kd_auth_register` pass `'authenticated'`. `lib/db_client.py`'s PostgREST fallback would need `POSTGREST_SERVICE_KEY`, which is unset on the VPS (`DATABASE_URL` is set, so psycopg2 wins) | named in the 226 policies and carried in 228's for symmetry; its table grants are left unchanged and documented in §3.5 |
| `vikuna_admin` | superuser | pgAdmin / migrations | never |
| `admin` | BYPASSRLS | nobody (after 227) | no |
| `kd_readonly` | no | the MCP | SELECT only |

Frontend PostgREST writes (the complete list — every `.insert/.update/.delete`
on a `from()` builder in `App/frontend/src`, 2026-09-26):

| table | write | file | page (all adminOnly or admin-gated) |
|---|---|---|---|
| `km_index_symbols` | UPDATE `is_active` | `services/indexCatalog.ts:18` | Settings → Index Catalog |
| `km_index_symbols` | INSERT custom index; DELETE on rollback | `views/CustomIndexCreatePage.tsx:139,176` | `/custom-index` |
| `km_equity_symbols` | UPDATE `is_active` | `services/equityCatalog.ts:50` | Settings → Equity Catalog |
| `km_index_constituents` | INSERT rows | `CustomIndexCreatePage.tsx:153` | `/custom-index` |
| `km_index_constituents` | INSERT / DELETE one | `CustomIndexManagePage.tsx:171,189` | `/custom-index/:id/manage` |
| `km_astro_rule_master` | INSERT, UPDATE (fields, `is_active`, `catalog_visible`, soft delete) | `pages/RuleEngine/ruleService.ts:251,273,285,294,303` | `/rules` |
| `dc_inference` | INSERT / UPDATE / DELETE | `services/dcInference.ts:106,118,130` | `/inference` |
| `km_ux_events` | INSERT | `services/uxEvents.ts:29` | every profile — already RLS on, out of scope |

RPCs the frontend calls: the four `kd_auth_*` pre-login (as `anon`),
`kd_auth_change_password`, `kd_update_profile`, `kd_result_returns` (STABLE),
`evaluate_dc_inferences` (STABLE, returns a table), and
`refresh_index_catalog` / `refresh_equity_catalog` / `refresh_commodity_catalog`
(SECURITY DEFINER, `authenticated=X`; each is one `REFRESH MATERIALIZED VIEW
CONCURRENTLY mv_*_catalog` — no base-table write).

Backend writers of the five tables (all as `kd_app`):

| table | writer | when |
|---|---|---|
| `km_equity_symbols` | `pipeline/processors/inserter.py:92` (`sync_isin_from_bhav`, `UPDATE … SET isin`) | nightly, inside the `nse_eod_download` dimension |
| `km_equity_symbols` | `scripts/sync_nse_isin_master.py`, `enrich_equity_metadata.py`, `populate_mcap.py`, `compute_dormancy.py`, `backfill_listing_dates.py`, `backfill_isin_from_bhav_files.py` | one-shot scripts |
| `km_index_symbols` | `pipeline2_api.py:8417` (`DELETE … WHERE category='custom'`, the `DELETE /api/custom-index/{id}` handler) | admin action |
| `km_index_constituents` | `pipeline2_api.py:8414` (`DELETE … WHERE index_id`) — same handler | admin action |
| `km_index_symbols` | `daily_pipeline.py:520` `refresh_index_catalog` RPC (matview refresh only) | legacy CLI path |
| `km_astro_rule_master`, `dc_inference` | none — `rule_discovery.py` and the confidence scorers only read them | — |

Triggers on these tables:

| table | trigger | function | definer + search_path |
|---|---|---|---|
| `km_index_constituents` | `custom_membership_change` (row) | `record_custom_membership_change` → writes `km_custom_index_revisions`, `km_custom_index_membership_log` | DEFINER, `public, pg_temp` |
| `km_index_constituents`, `km_index_symbols` | `km_leadership_*_changed` (statement) | `km_invalidate_leadership_generation` → writes `km_leadership_generation` | DEFINER, `public` |
| `dc_inference` | `trg_dc_inference_updated_at` | `set_updated_at` (sets `NEW.updated_at`) | invoker — touches only the row being written |

An admin edit through PostgREST keeps producing its revision log and
generation bump under RLS: the side-effect writes run as the function owner.

### 3.2 Live state of the six tables

| table | RLS | policies today | `authenticated` | `anon` | `kd_app` |
|---|---|---|---|---|---|
| `km_index_symbols` | **off** | `index_symbols_read` (authenticated SELECT true), `index_symbols_admin_write` (authenticated ALL `is_admin()`) — **inert** because RLS is off | `arwdDxtm` | `rm` | `arwdDxtm` |
| `km_equity_symbols` | **off** | `equity_symbols_read`, `equity_symbols_admin_write` — inert | `arwd` | `r` | `arwd` |
| `km_index_constituents` | **on** | `idx_const_read` (**public** SELECT true), `idx_const_write` (**public** ALL `is_admin()`, no WITH CHECK) | `arwd` | `r` | `arwd` |
| `km_astro_rule_master` | off | none | `arwd` | `r` | `arwdDxtm` |
| `dc_inference` | off | none | `arwdDxtm` | `rm` | `arwdDxtm` |
| `dc_lookup` (same class, read by `dcLookup.ts`) | off | none | `arwdDxtm` | `rm` | `arwdDxtm` |

`m` is MAINTAIN (PostgreSQL 17): `anon` may `VACUUM`/`ANALYZE`/`REINDEX`/
`CLUSTER`/`REFRESH` these tables. 226 revoked anon's writes but not MAINTAIN.

⚠ **Live defect in `km_index_constituents` — verify before 228 (§7.4).** Its
write policy is `FOR public`, and `public` includes `kd_app`. `kd_app` has no
`request.jwt.claims`, so `auth.uid()` is NULL and `is_admin()` is false for
it. The `DELETE /api/custom-index/{id}` handler runs
`DELETE FROM km_index_constituents WHERE index_id = %s` as `kd_app`: under this
policy that affects **0 rows**, and the following
`DELETE FROM km_index_symbols` must then fail on the FK
(`km_index_constituents.index_id REFERENCES km_index_symbols(id)`, no
cascade). Live today: 58 custom indices, 0 orphan constituents — consistent
with either "the endpoint has not been used since 208" or "it fails". 228's
role-scoped policies fix it regardless; acceptance §7.4 proves it.

### 3.3 The 228 design for the six tables

One shape, applied to each of `km_index_symbols`, `km_equity_symbols`,
`km_index_constituents`, `km_astro_rule_master`, `dc_inference`, `dc_lookup`:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;           -- no FORCE: owner vikuna_admin stays exempt
DROP POLICY IF EXISTS <every existing policy on t>;   -- the inert / public-scoped ones, by name

CREATE POLICY <t>_read       ON <t> FOR SELECT TO authenticated, kd_readonly USING (true);
CREATE POLICY <t>_admin_ins  ON <t> FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY <t>_admin_upd  ON <t> FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY <t>_admin_del  ON <t> FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY <t>_app_all    ON <t> FOR ALL    TO kd_app, service_role USING (true) WITH CHECK (true);

REVOKE TRUNCATE, REFERENCES, TRIGGER ON <t> FROM authenticated;   -- keep SELECT, INSERT, UPDATE, DELETE
-- anon: SELECT and MAINTAIN go in the schema-wide revoke, §3.6
```

Why each line:

- **Separate INSERT/UPDATE/DELETE policies, not one `FOR ALL`.** A `FOR ALL`
  policy with only `USING` reuses it as the `WITH CHECK` (how
  `idx_const_write` works today) — fine for a boolean like `is_admin()` — but
  it also applies the admin predicate to SELECT, so a non-admin would see
  zero rows unless a second permissive SELECT policy exists. Splitting by
  command makes the read policy the only thing that governs reads.
- **`anon` is NOT in the read policy** (decision §9.8). Since 1a the landing
  page reads through `/api/guest/*` and nothing reads PostgREST before login
  (verified in §3.6), so an anon read policy would be a door to a room nobody
  enters. Even if the grant were left, the policy would return 0 rows; 228
  removes the grant too, so an anon read is a `42501`, not a silent empty
  result.
- **`kd_app, service_role` `FOR ALL USING (true)`.** The pipeline and FastAPI
  keep full access; the same shape 226 used on `km_profiles` and
  `user_subscriptions`. Without it the nightly `sync_isin_from_bhav` UPDATE
  (as `kd_app`) would affect 0 rows and stamp the dimension as computed.
- **`REVOKE TRUNCATE, REFERENCES, TRIGGER` from `authenticated`.** RLS does
  not govern TRUNCATE, and `D`/`x`/`t` were granted on three of the six by the
  blanket grant. No frontend path uses them.
- **Grants for `authenticated` are otherwise kept.** RLS is the gate (locked
  decision 3); the table-level `arwd` is what lets an admin session's write
  reach the policy at all.
- **No `FORCE ROW LEVEL SECURITY`.** `vikuna_admin` owns the tables and runs
  migrations and pgAdmin repairs.

### 3.4 Functions the admin pages call through PostgREST (decision §9.6)

`refresh_index_catalog`, `refresh_equity_catalog`, `refresh_commodity_catalog`
**keep `authenticated=X`** and each body gains an admin check, so the Index /
Equity / Commodity Catalog pages keep working through the admin's own
`authenticated` session and a non-admin call raises before the refresh:

```sql
CREATE OR REPLACE FUNCTION public.refresh_equity_catalog() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_equity_catalog;
END $$;
```

(the same for the other two; `refresh_index_catalog` is already plpgsql,
`refresh_equity_catalog` and `refresh_commodity_catalog` change from `sql` to
`plpgsql` to hold the `IF`). `daily_pipeline.py:520` calls
`refresh_index_catalog` as `kd_app` — `is_admin()` is false for `kd_app`, so
the check must be `IF NOT (is_admin() OR current_user = 'kd_app')`, or
`kd_app` keeps a separate path. Designed: the `OR current_user = 'kd_app'`
form, so one function serves both callers and the legacy CLI path keeps
working; `kd_app` already holds EXECUTE on `refresh_index_catalog` (live
`proacl`) and is granted on the other two for symmetry.

`compute_custom_index_eod` (non-DEFINER, `authenticated=X`, writes
`km_index_eod` as the caller, no frontend caller — the backend `/compute`
endpoint runs it as `kd_app`): `REVOKE EXECUTE … FROM authenticated`.
`evaluate_dc_inferences` is STABLE and read-only; its `authenticated=X` stays
(the `/inference` and `/rule-eval` admin pages call it; a non-admin calling it
reads the same rows they can already SELECT).

### 3.5 Every other RLS-off table where `authenticated` can write — from live `relacl`

The off-repo blanket grant gave `authenticated` `arwd` (sometimes `arwdDxtm`)
on **44 RLS-off tables**. The six above are the only ones the frontend writes
(§3.1). The other 38 (plus four read-only sector/index tables) are written by
the pipeline, FastAPI or nobody; `authenticated` write on them is pure
exposure. For those the fix is a grant revoke, not RLS — there is no
legitimate `authenticated` writer to keep:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
  dc_market_status, kd_vani_opportunity_config, km_api_sessions, km_astro_events,
  km_candidate_rules, km_commodity_eod, km_commodity_symbols, km_corporate_actions,
  km_daily_panchang, km_daily_snapshots, km_data_sync_log, km_day_lords, km_days_of_week,
  km_equity_15m, km_equity_eod, km_equity_monthly, km_equity_weekly,
  km_factor_correlation_stats, km_fii_dii, km_index_15m, km_index_composition, km_index_eod,
  km_index_master, km_moon_intraday, km_nakshatra_lords, km_nakshatras, km_panchang_calendar,
  km_panchang_day_notes, km_pipeline_runs, km_planetary_aspects, km_planetary_positions,
  km_planets, km_risk_scores, km_rule_inference, km_rule_signals, km_rules, km_sector_lords,
  km_sector_sensitivity, km_sectors, km_trading_calendar, km_zodiac_lords, km_zodiac_signs
FROM authenticated;
```

(42 names. Fifteen of them carry 1–3 policies that have been inert since
creation because RLS is off; they are left as they are — a revoke does not
depend on them.)

**Evidence that this is safe (decision §9.12 — sufficient):** (1) `kd_app` is
untouched, and `kd_app` is the only role the pipeline, the worker, the
scheduler and every `scripts/*.py` connect as; (2) the frontend writes none
of them — every PostgREST write builder in `App/frontend/src` was grepped
(§3.1), and the RPC list is closed; (3) the available `vikuna-nginx` access
logs (~5 days) are grepped for any non-GET on `/db/<name>` for the 42 names
as a second measurement (§8 step 1). **Condition attached to the decision:**
228 ships with a rollback script, and both are validated on a throwaway
cluster in the order apply → verify → rollback → re-apply before either
touches the VPS (§8 step 1).

**`service_role` (decision §9.9): unchanged, documented.** Live it holds
`arwd` on 38 of the tables above plus the six master tables, `arwdDxtm` on 14
lookup tables, and is named in the 226/228 `*_app_all` policies. No login
role is a member of it except the superuser, and no code path mints a
`service_role` JWT (§3.1). It is inert privilege; it is left alone so that a
future service-token design does not have to re-derive the grant set.

### 3.6 anon lockdown (decision §9.8)

**Decision:** revoke `anon` SELECT on every table, view and materialized view
in `public`; `anon` keeps EXECUTE on exactly `kd_auth_login`,
`kd_auth_register`, `kd_auth_forgot_password`, `kd_auth_reset_password`;
every other function is revoked from `anon`. Rationale: since 1a the landing
page reads through `/api/guest/*` (FastAPI, as `kd_app`), and nothing reads
PostgREST before login.

**Verified against the frontend (2026-09-26):** of every module reachable
before login — `App.tsx`, `views/LandingPage.tsx`, `views/LoginPage.tsx`, all
fourteen `views/landing/*.tsx`, `BuildWatch`, `ProtectedRoute`, `authStore`,
`spotlight.ts`, `themeStore`, `analytics`, `main.tsx` — only
`services/auth.ts` imports `services/postgrest`, and its pre-login calls are
the four `rpc('kd_auth_*')` at lines 116, 136, 161, 173. `kd_auth_change_password`
(186), the `km_profiles` / `user_subscriptions` reads (212, 227) and
`kd_update_profile` (269) all run after login as `authenticated`. The landing
page's data comes from `fetchGuestPanchang` and `guestApi.fetch('/api/guest/
spotlight')`. The backend never uses `anon` (psycopg2 as `kd_app`; its
PostgREST fallback needs a service key that does not exist).

**Live size of the revoke:** `anon` holds SELECT on **87 of 97 tables, 3 of 3
views, 5 of 5 materialized views**, MAINTAIN on 10 tables, and EXECUTE by
name on 12 functions (`_wilder_ema`, `aggregate_equity_monthly`,
`aggregate_equity_weekly`, `get_conviction_flow`, `get_market_breadth`,
`kd_day_zero_trade_date`, `kd_result_returns`, `kd_update_profile`, and the
four `kd_auth_*`). ⚠ **72 of the 101 functions in `public` carry PUBLIC
EXECUTE (`=X`)**, which `anon` inherits — revoking `anon` by name on 12 would
leave 72 callable. So the revoke is:

```sql
REVOKE SELECT, MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon;          -- tables, views, matviews
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kd_auth_login(text,text), kd_auth_register(text,text,text),
  kd_auth_forgot_password(text), kd_auth_reset_password(text,text) TO anon;
-- then re-grant, BY EXPLICIT LIST GENERATED FROM LIVE pg_proc, the 72 formerly-PUBLIC
-- functions to the roles that actually call them: authenticated (is_admin, kd_result_returns,
-- kd_update_profile, evaluate_dc_inferences, …) and kd_app (every compute_*/aggregate_*/
-- helper the pipeline invokes; 226 already named 27 of these explicitly).
```

The re-grant list is generated by script from `pg_proc.proacl` at migration
time (the matview-migration convention: generate, assert the count, never
hand-type 72 names) and the migration asserts, after applying, that
`has_function_privilege('anon', f, 'EXECUTE')` is true for exactly the four
and false for every other function in `public`. `USAGE ON SCHEMA public`
stays with `anon` — the four RPCs need it. The `auth.*` shim functions live
in schema `auth`, which PostgREST does not expose; unchanged.

**What this changes for a logged-out browser:** `services/postgrest.ts`
sends `Authorization: Bearer <VITE_ANON_KEY>` (or an empty bearer) when no
session exists; after 228 any such request other than the four RPCs answers
`42501`. Nothing in the app makes one. The QA harness (`scripts/qa/*.mjs`)
seeds a session token and mocks `/db/`, so it is unaffected. Two things must
NOT be confused with anon reads: the `kd_readonly` MCP role (untouched) and
`/api/guest/*` (FastAPI, `kd_app`).

### 3.7 What is explicitly not in 228

- `km_profiles` (done in 226), `km_user_bookmarks`, `km_ux_events`,
  `user_frameworks` (RLS already on; the anon SELECT on them is swept up by
  §3.6, which closes hotfix follow-up 10 as a side effect).
- `FORCE ROW LEVEL SECURITY` anywhere.
- Any `service_role` change (§3.5).

228 is validated on a throwaway PostgreSQL 16 cluster with the role set above
and fixtures for all six tables, in the order **apply → verify → rollback →
re-apply** (decision §9.12), with `SET ROLE` + `request.jwt.claims` set to a
user `sub`, an admin `sub`, a suspended-admin `sub`, and none (for `kd_app`),
plus `SET ROLE anon` for the §3.6 assertions.

---

## 4. `kd_update_profile` whitelist

Live body (`pg_get_functiondef`, 2026-09-26): SECURITY DEFINER,
`SET search_path = public`, resolves `v_id` from the JWT `sub`, then one
`UPDATE km_profiles SET … WHERE id = v_id`, every column guarded by
`CASE WHEN p_updates ? '<key>'`. The exact keys a caller can change:

| key | since |
|---|---|
| `display_name`, `full_name`, `phone`, `avatar_url`, `onboarded`, `theme`, `mode`, `icp_mode` | 143 |
| `persona`, `acts_on`, `hold_horizon`, `concede_level`, `guide_progress` | 204 |
| `onboarding_version` | 206 |
| `persona_set_at` (stamped `now()` whenever `persona` is present — not settable) | 204 |
| `updated_at` (always `now()`) | — |

**Not writable, verified against the body:** `tier`, `role`, `is_suspended`,
`expires_at` (not even a `km_profiles` column — derived from
`user_subscriptions` in `auth.ts`), `email`, `id`, `created_at`, and every
Razorpay/billing field (none live on `km_profiles`; `user_subscriptions` holds
`tier, started_at, expires_at, razorpay_subscription_id, razorpay_payment_id,
status, base_paise, gst_paise, total_paise` and is written only by `kd_app`
through `/api/payments/*` and `/api/admin/users/*`). An unknown key in
`p_updates` is ignored, not applied. **Verdict: no fix required.**

Two hygiene items ride in 228: `search_path = public` → `public, pg_temp`,
and its EXECUTE grants to `anon` and the unused `user` role go (the §3.6
schema-wide revoke removes the `anon` one; `user` is revoked by name).

---

## 5. `user_subscriptions` own-row SELECT

Live: RLS **on**; policies `subscriptions_service_all` (`kd_app, service_role`
ALL) and `users_read_own_subscriptions` (**`public`**, SELECT,
`user_id = jwt sub`). Grants: `vikuna_admin`, `kd_app=arwd`, `admin`,
`kd_readonly=r`. **`authenticated` has no grant at all**, so the own-row
policy is unreachable: every logged-in read fails with `42501`.

228:

```sql
GRANT SELECT ON user_subscriptions TO authenticated;
DROP POLICY IF EXISTS users_read_own_subscriptions ON user_subscriptions;
CREATE POLICY subscriptions_self_select ON user_subscriptions FOR SELECT TO authenticated
  USING (user_id = (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid);
```

No INSERT / UPDATE / DELETE grant: writes stay with `kd_app`.

**What starts working and what depends on the silent failure today.**
`services/auth.ts:227` reads the latest `status='active'` row and copies
`expires_at` onto the profile. Today the read errors, the error is discarded
(after the auth hotfix only an auth rejection there is thrown; `42501` is
not one), and `profile.expires_at` stays `undefined`. Consumers:

| consumer | today (`undefined`) | after 228 |
|---|---|---|
| `views/AccountPage.tsx:345` — Plan & Billing shows the expiry date | shows nothing / "no expiry" | shows the subscription's date |
| `components/workspace/InlineGate.tsx:114` — `daysLeft(profile?.expires_at)` | no countdown | countdown when a row exists |
| `stores/frameworkStore.ts:178` — syncs `expires_at` from the framework payload | unchanged | unchanged |

Nothing gates access on `expires_at`; tier gating reads `km_profiles.tier`.
**The table holds 0 rows live** (2026-09-26), so on the day 228 lands the
query returns an empty result instead of an error and every consumer sees
what it sees today. There is no dependency on the current failure.

---

## 6. Deletion list

### 6.1 Dead FastAPI routes — 27 (decorator lines at `03a10c2`)

| line | route | 1a note |
|---|---|---|
| 438 | GET /api/pipeline2/jobs/{job_id} | `fetchJob` unused |
| 845 | POST /api/pipeline/refresh-breadth | no caller |
| 852 | POST /api/pipeline/refresh-breadth-roc | no caller |
| 859 | GET /api/vani-opportunity/config | QA mock only |
| 892 | GET /api/scan/run/stage_2_leaders | `useStage2Scan` unused |
| 1416 | GET /api/dashboard/composite | `MarketWeatherCard` not rendered — **deleted (decision §9.3)**; the card stays parked and gets a fresh route if unparked |
| 1596 | GET /api/dashboard/context | `MarketWeatherCard`, `HistoricalContextCard` — same |
| 1728 | GET /api/astro/signals | no caller |
| 2057 | GET /api/panchang/notes | no caller (POST/PATCH/DELETE stay, → admin) |
| 2329 | GET /api/ai/panchang-insight | `usePanchangInsight` unused |
| 2688 | GET /api/ai/breadth-insight | `useBreadthInsight` unused |
| 2745 | GET /api/ai/breadth-roc-insight | `useBreadthRocInsight` unused |
| 2800 | GET /api/ai/sector-insight | `useSectorInsight` unused |
| 3961 | GET /api/discovery/transit-counts | no caller |
| 4340 | GET /api/confidence/summary | no caller |
| 4466 | GET /api/confluence/historical | `useConfluenceHistorical` unused |
| 4831 | POST /api/vani/daily | `VaNiMorningBrief` orphan |
| 5117 | POST /api/vani/observation | no caller |
| 5185 | POST /api/vani/clear-cache | no caller |
| 5193 | DELETE /api/vani/observation-cache/{item_key:path}/{cache_date} | `VaNiMorningBrief` orphan |
| 5310 | POST /api/vani/correlation-insight/clear-cache | no caller |
| 5428 | GET /api/vani/intents | no caller |
| 5832 | POST /api/vani/warm-scanner-explainers | no caller |
| 5901 | POST /api/vani/warm-help-intents | no caller |
| 6103 | POST /api/framework/{user_id} | store uses GET + PUT |
| 7606 | POST /api/payments/create-subscription | no caller |
| 7642 | POST /api/payments/create-trial-order | legacy alias |

With each route goes its request model if nothing else uses it. The
`test_auth_guards.py` floor (`>= 111 decorated routes`) becomes an exact
count: 111 − 27 + 1 (`alive`) = **85**. The acceptance script's
`USER_ROUTES` loses the 27 into a `DELETED_ROUTES` list asserting 404 (§7.7).

**Orphan frontend callers of the deleted routes — deleted with them
(decision §9.4):**

| symbol | file(s) | what it called |
|---|---|---|
| `fetchJob` | `services/pipeline2.ts` | jobs/{id} |
| `useStage2Scan`, `fetchStage2` | `hooks/useScan.ts` | scan/run/stage_2_leaders |
| `MarketWeatherCard` (+ `MarketWeatherProps`) — **the component file stays parked** (decision §9.3); only its dead import in `views/MarketStructureView.tsx:8` is removed, and its data fetches at lines 568/595 are left pointing at the deleted routes with a header comment saying so | `DashboardV3/MarketWeatherCard.tsx`, barrel `DashboardV3/index.ts:7,12` | dashboard/composite, /context |
| `HistoricalContextCard` — **stays parked**, same treatment | `DashboardV3/HistoricalContextCard.tsx`, barrel `:10` | dashboard/context |
| `VaNiMorningBrief` | `components/workspace/VaNiMorningBrief.tsx` (no importer) — delete | vani/daily, vani/observation-cache |
| `usePanchangInsight`, `useBreadthInsight`, `useBreadthRocInsight`, `useSectorInsight`, `useConfluenceHistorical` | `hooks/useDashboardExtras.ts` + barrel `hooks/index.ts:26` — delete the five hooks and their barrel entries | the four `/api/ai/*-insight` routes and confluence/historical |
| `fetchConfluenceHistorical` | `services/panchang.ts:46` — delete | confluence/historical |

For the two parked cards the rule is: the files remain so the parked design
can be resumed, but nothing imports them and their routes are gone; unparking
them means a fresh route under this contract's guard table, not restoring
`/api/dashboard/*`.

### 6.2 Dead v1-path frontend call sites — the locked 16 in 6 files, and what they drag

| file | lines | what |
|---|---|---|
| `services/pipelineData.ts` | 81–96 (`fetchPipelineHealth`, `fetchPipelineStatus`, `fetchBreezeStatus`, `fetchSchedulerStatus`, `fetchDownloadTypes`, `triggerPipelineRun`, `triggerBackfill`, `connectBreeze`, `triggerStepRerun`), 117 (`fetchCoverageSummary`) | ten `/api/pipeline/*` v1 calls |
| `components/domain/DataHealthGrid.tsx` | 420, 434, 484, 505, 532 | `/api/pipeline/health-checks`, `/api/ai/data-health-insight`, `/api/pipeline/fix` ×2, `/api/pipeline/mark-date` |
| `components/domain/InstrumentIntelligence.tsx` | 150 | `/api/context/instrument` |
| `components/domain/MarketPulseCard.tsx` | 123 | `/api/context/market-pulse` |
| `components/domain/PipelineExecution.tsx` | 235, 267 | `/api/pipeline/live`, `/api/pipeline/cancel` |
| `components/domain/PipelineStatusDot.tsx` | 26 | `/api/pipeline/coverage-summary` |

All five components are deleted whole (each exists only to call a v1 path),
with their barrel lines `components/domain/index.ts:18–21`.
`PipelineStatusDot` has no importer at all.

**What they drag (decision §9.10 — confirmed):**

- **`views/settings/PipelineDashboard.tsx`** is the only importer of
  `DataHealthGrid`, `PipelineExecution` and of every v1 function in
  `pipelineData.ts`; it is mounted at `SettingsView.tsx:69` behind the
  "Data Pipeline" settings card (`activeCard === 'pipeline'`). It is the v1
  pipeline dashboard, every request it makes 404s today, and the live page is
  `/data-pipeline` (`pages/DataPipeline`). 1b deletes `PipelineDashboard.tsx`
  and the card in `SettingsView.tsx` (lines 39–47 card definition, 7 import,
  68–69 branch).
- **`services/pipelineData.ts` goes whole.** After the ten v1 functions, what
  remains is `fetchLatestPipelineSteps` (used only by `PipelineDashboard`),
  `fetchPipelineRuns` and `fetchTradingCalendar` (no importer), and the
  types `PipelineRun`, `TradingCalendarDay`, `PipelineHealth`,
  `PipelineStatus`, `BreezeStatus`, `SchedulerStatus`, `DownloadType`,
  `JobResponse`, `CoverageSummary` — every one used only by
  `PipelineDashboard` or `PipelineStatusDot`. ⚠ **`hooks/usePipelineStatus.ts`
  defines its own `PipelineStatus` interface** (line 17) and is imported by
  20 files; it does not touch `pipelineData.ts`. Do not confuse the two.
- `components/domain/index.ts` also exports `MarketPulseCard` and
  `InstrumentIntelligence` (lines 18–19); no page imports them.

### 6.3 The v1 service — not running, so a code-and-compose deletion

**`kd-pipeline-api` is not running on the VPS; only `kd-pipeline-api2` exists
(owner, checked 26 Sep).** That settles the concern the first draft raised:
the `pipeline-api` service has no `command:`, so had it been up it would have
been a second `pipeline2_api` instance (the image `CMD`) with a second worker
and scheduler on the same `km_jobs` queue. It is not up, so removal is:

| item | where | action |
|---|---|---|
| compose service `pipeline-api` | `docker-compose.yml:8–22` (build, `container_name: kd-pipeline-api`, `DATABASE_URL`, `LLM_BASE_URL`, Razorpay keys, `pipeline_data` volume, `vikuna-net`) and the section comment above it | delete the block |
| `App/backend/pipeline_api.py` | 2,272 lines, 38 routes, no auth | delete |
| `App/backend/worker.py` (root) | the v1-era standalone `km_jobs` poller. Referenced by: `pipeline_api.py:270,1179` (deleted with it); a code comment in `lib/health_checks.py:332` ("`worker.py:646`" — points at a line in the OLD file; reword to `pipeline2/worker.py`); `docs/security/rls-audit-2026-04-15.md:30` (historical). No compose file, Dockerfile, script or import references it (`grep -rn "worker\.py\|import worker\b\|from worker\b"` over `*.py`, `*.yml`, `*.sh`, `*.md`, Dockerfiles, 2026-09-26). **Deleted** (decision §9.11) with the comment reworded |
| `App/backend/Dockerfile` | shared with `pipeline-api2`; its `CMD` is already `pipeline2_api:app` | keep, unchanged |
| modules only v1 imports | none. `lib.data_assemblers` is imported by `pipeline2_api.py:51`; `lib.breeze_client` by `breeze_downloader.py`; `daily_pipeline` by `pipeline2/handlers.py` and seven scripts; `apscheduler`/`pytz` by `pipeline2/scheduler.py` | keep all |
| nginx | `nginx/dristiq-vps.conf`, `nginx/nginx.conf`, `App/frontend/nginx.conf` contain no `8100`, `pipeline-api` or `kd-pipeline-api` reference | nothing |
| `deploy.sh` | builds/starts only `pipeline-api2 kd-frontend` | nothing |
| docs | `CLAUDE.md` names `pipeline_api.py` three times ("DO NOT RUN", the compose note, the file tree) | update the three lines in the same commit |

### 6.4 Nothing live references any of it — how that was checked

- Routes: every path in §6.1 has zero callers in `App/frontend/src` after the
  1a client migration, or only the orphan symbols now deleted with it.
- Frontend files: importer grep per file (§6.2); `PipelineDashboard.tsx` is
  the one live importer and goes with them.
- v1 service: `grep -rn "8100\|pipeline-api\b\|kd-pipeline-api\b\|pipeline_api"`
  over `docker-compose.yml`, `nginx/*.conf`, `App/frontend/nginx.conf`,
  `deploy.sh`, `App/backend/Dockerfile` → only the compose block itself.
  `grep -rln "import pipeline_api\|from pipeline_api" App/backend` → nothing.
- Root `worker.py`: §6.3.

---

## 7. Acceptance tests

Run on the deployed stack with `AUTH_MODE=enforce`, after 228 and the 1b code.
`scripts/auth_acceptance.py` grows `ADMIN_ROUTES` (the 42 + 5 = 47),
`DELETED_ROUTES` (the 27) and `ANON_TABLES` (a sample of table, view and
matview names), and takes a second credential pair `KD_ADMIN_EMAIL` /
`KD_ADMIN_PASSWORD`. PostgREST cases use the same sessions against `/db/`.

| # | case | expected |
|---|---|---|
| 1 | Free user token on every route in `ADMIN_ROUTES` (47) | `403 not_admin` on all; body carries nothing but `detail`. Write routes are hit with an empty body and must 403 **before** validation |
| 2 | Admin token on every `ADMIN_ROUTES` read route, and on the write routes with a safe body (`/pipeline2/dimensions`, `/scheduler`, `/discovery/signal-counts`, `/patterns/status`, `/confidence/yearly/1`, `/custom-index/themes`; POST `/pipeline2/cancel` and `/discovery/cancel` with a non-existent job → the handler's own 404/no-op, which is "reached the handler") | `200` (or the handler's own 404/422), never 401/403 |
| 2b | A **suspended** admin's token (suspend a throwaway admin via `/api/admin/users/{id}/suspend`, using a token minted before the suspension) on `GET /api/pipeline2/dimensions`, and the same session's `PATCH /db/km_index_symbols` | `403 not_admin`; the PostgREST write affects 0 rows — the API and `is_admin()` agree |
| 3 | Free user PostgREST write on each of the six tables: `PATCH /db/km_index_symbols?id=eq.<custom id>` `{"is_active":false}`, `PATCH /db/km_equity_symbols?id=eq.…`, `POST /db/km_index_constituents`, `POST /db/km_astro_rule_master`, `POST /db/dc_inference`, `PATCH /db/dc_lookup?…` | INSERT → `42501` (WITH CHECK fails); UPDATE/DELETE → `0 rows` (`Prefer: return=representation` → `[]`), never a changed row. Then the same writes as admin → succeed, and the admin then reverts them |
| 3b | Free user `POST /db/rpc/refresh_equity_catalog` → `42501 admin only`; admin → `204`; `compute_custom_index_eod` via `/db/rpc/` as any user → `42501` (EXECUTE revoked) | §3.4 |
| 4 | Pipeline dimensions that write these tables still succeed, run **as `kd_app`**: on the throwaway cluster seeded with 228 and fixtures, run the exact statements — `inserter.sync_isin_from_bhav`'s UPDATE on `km_equity_symbols`, the custom-index DELETE pair from `pipeline2_api.py:8414–8417`, `compute_custom_index_eod`, `refresh_index_catalog` as `kd_app` — and assert row counts > 0 and no `42501`. On the VPS: `POST /api/pipeline2/fix {dimension:'nse_eod_download', trade_date:<last bar>}` as admin and watch it complete; create a throwaway custom index in the UI, Calculate, then Delete — the Delete must remove constituents and the symbol (this is also the §3.2 defect check: run it once BEFORE 228 and record the outcome) |
| 5 | `POST /db/rpc/kd_update_profile {"p_updates":{"tier":"pro","role":"admin","is_suspended":false,"display_name":"x"}}` as a free user | `200`; the returned row has `display_name = 'x'` and `tier`, `role`, `is_suspended` unchanged (re-read `/db/km_profiles?select=tier,role,is_suspended`) |
| 6 | `GET /db/user_subscriptions?select=*` as user A (with a seeded row for A and one for B, inserted as `kd_app` on the throwaway cluster; on the VPS once real rows exist) | `200`, exactly A's rows; `GET …?user_id=eq.<B>` → `[]`; anon → `42501` |
| 7 | Every route in `DELETED_ROUTES` (27), with and without a valid token | `404` (FastAPI's, `{"detail":"Not Found"}`), never a guard 401/403 — the decorator is gone, not merely guarded |
| 8 | `GET /api/alive` with a user token → `200 {"ok":true}` and no other key; without → `401`; `GET /api/pipeline2/ping` with a user token → `403`; the backend-status pill on `/workspace` as a free user still reads online; `JobMonitor` is absent from the DOM for a free user and present for an admin | §1.4, §1.5 |
| 9 | `scripts/smoke_after_deploy.sh` with a **free user's** credentials, then with an admin's | both pass — the script's `GET /api/pipeline2/health` step switches to `/api/alive` for the user run (or takes `--admin`); a free-user smoke that hits `health` would now correctly fail |
| 10 | Blanket-grant revoke (§3.5): as a free user, `PATCH /db/km_equity_eod?…`, `POST /db/km_rule_signals`, `DELETE /db/km_trading_calendar?…` | `42501` permission denied (a grant error, not a 0-row RLS result) |
| 11 | Nightly run after 228: the next `daily_run` completes with every dimension `completed` (not `partial`), `km_dimension_watermarks` stamped for the date, `check_derivation_staleness` quiet | pipeline unaffected |
| 12 | v1 removal: `docker ps -a --filter name='^kd-pipeline-api$'` — **kept as a no-op assertion** (expected: no such container, before and after), then `docker compose config --services` no longer lists `pipeline-api`, `km_jobs` keeps completing, `GET /api/alive` through the edge is `200` | the only container was `kd-pipeline-api2` |
| 13 | **anon lockdown (§3.6):** logged out, `GET /db/km_equity_eod?limit=1`, `GET /db/v_equity_eod_deduped?limit=1`, `GET /db/mv_equity_catalog?limit=1`, `GET /db/km_profiles`, `POST /db/rpc/kd_result_returns`, `POST /db/rpc/get_market_breadth` | all `42501` / non-2xx with no data key; the script asserts on every `ANON_TABLES` name |
| 14 | **Pre-login flows still work:** `POST /db/rpc/kd_auth_register` (throwaway email) → `200` with a token; `kd_auth_login` → `200` with a token; `kd_auth_forgot_password` → `200`; `kd_auth_reset_password` with a bad token → the function's own error, not `42501`. In the browser: the landing page renders with the panchang card and Spotlight (guest path), login succeeds, `/workspace` loads | the four RPCs are the whole anon surface |
| 15 | Throwaway-cluster order (decision §9.12): apply 228 → run cases 3, 3b, 4, 5, 6, 10, 13 → apply the rollback → assert the pre-228 `relacl`, policies and function ACLs are restored byte-for-byte (captured before apply) → re-apply → re-run | both files idempotent in both directions |

Cases 1–3b, 5–8, 10, 13, 14 are HTTP and go into the acceptance script; 4, 9,
11, 12, 15 are runbook steps. PostgREST write cases use throwaway rows and
clean up as admin.

---

## 8. Rollout and rollback

**Gate:** 1a is in `AUTH_MODE=enforce` on the VPS and
`auth_acceptance.py --expect-mode enforce` passed there. The 1b build does not
start before that (locked decision 1).

| step | what | depends on | rollback |
|---|---|---|---|
| 1 | **Migration 228** in pgAdmin: RLS on the six tables, `is_admin()` hardening (search_path + `is_suspended`), the three catalog refreshes with the admin check, `compute_custom_index_eod` EXECUTE revoke, the 42-table `authenticated` write revoke, the anon lockdown (§3.6), `kd_update_profile` hygiene, `user_subscriptions` grant + policy. Before it: the nginx-log grep for non-GET `/db/<name>` on the 42 tables, and the throwaway-cluster apply → verify → rollback → re-apply run (§7.15) | the gate | `km_migration_228_rollback.sql`, validated in the same run: disable RLS on the six, drop the new policies, recreate by name the two inert `*_read`/`*_admin_write` pairs and the two `public` `idx_const_*` policies, re-grant the revoked table privileges from the recorded `relacl`, restore the function ACLs (the 72 PUBLIC grants, the 12 anon grants) from the recorded `proacl`, restore the three refresh functions and `is_admin()` to their captured bodies, revoke the `user_subscriptions` SELECT and restore the `public` policy. `DROP POLICY IF EXISTS` before every `CREATE POLICY` in both files (the 226 lesson). 228 can sit alone: admin pages keep working (the admin session passes `is_admin()`), the pipeline keeps working (`kd_app` has its ALL policy), the landing page never touched anon PostgREST |
| 2 | **Backend**: `require_admin` in `lib/auth.py` (with `is_suspended`) on the 42 routes and the 5 admin routes; `GET /api/alive`; the 27 routes deleted; `test_auth_guards.py` count 85 + the audit-mode admin test; `auth_acceptance.py` gains `ADMIN_ROUTES`, `DELETED_ROUTES`, `ANON_TABLES` | 228 (the custom-index DELETE handler, §3.2) | redeploy the previous backend commit. `AUTH_MODE=off` is NOT the rollback for admin — it also disables the 1a guards; use the commit rollback |
| 3 | **Frontend**: `useBackendStatus` → `/api/alive`; `JobMonitor` admin-only; the 6 files + `PipelineDashboard.tsx` + the Settings card + barrels deleted; the §6.1 orphan callers deleted; the two parked cards' dead import removed; `smoke_after_deploy.sh` updated | backend step 2 (`/api/alive` must exist before the pill points at it). Deploy 2 and 3 **together**, as in 1a | redeploy the previous frontend commit (`kd-frontend` only) |
| 4 | **Compose and code cleanup**: delete the `pipeline-api` block, `pipeline_api.py`, root `worker.py`; reword the `health_checks.py:332` comment; update `CLAUDE.md`; `docker compose config` to confirm; `docker image prune` if an image for it exists | nothing (the container does not exist) | `git revert` the commit. Do not `docker compose up -d pipeline-api` on the reverted tree — it would come up as a second pipeline2 instance |

Nothing in 1b rotates a secret, changes a token shape or touches nginx.

---

## 9. Decisions (closed by the owner, 2026-09-26 — none open)

1. **Admin guard in `audit` mode:** enforced in `audit` too, and logged. A
   rollback to `audit` must never open admin routes. → §1.1, test in
   `test_auth_guards.py`.
2. **`discovery/cancel`: admin.** `JobMonitor` renders only for admins
   (`isAdmin`); regular users never see job controls. → §1.2 (42 routes),
   §1.5 frontend work list, §7.8.
3. **`dashboard/*` routes: delete.** `MarketWeatherCard` and
   `HistoricalContextCard` stay parked; if unparked they get a fresh route.
   → §6.1.
4. **Orphan frontend callers of deleted routes: delete them.** → §6.1 table,
   §8 step 3.
5. **Backend-status indicator:** `GET /api/alive` returning `{"ok":true}`
   only, `user` guard. → §1.4, §7.8.
6. **`refresh_*_catalog` RPCs:** keep EXECUTE for `authenticated`; add an
   `is_admin()` check inside each body. → §3.4 (with the `kd_app` carve-out
   for `daily_pipeline.py:520`), §7.3b.
7. **`is_admin()`:** add `AND NOT is_suspended` and `SET search_path =
   public, pg_temp`. → §2, mirrored in `_require_admin` §1.1, §7.2b.
8. **anon SELECT: revoke on all tables, views and materialized views in
   `public`.** anon keeps EXECUTE only on `kd_auth_login`, `kd_auth_register`,
   `kd_auth_forgot_password`, `kd_auth_reset_password`; every other function
   is revoked. Rationale: since 1a the landing page uses `/api/guest/*` and
   nothing reads PostgREST before login — verified against the frontend
   (§3.6). → §3.3 (read policy without anon), §3.6, §7.13, §7.14.
9. **`service_role` grants: unchanged, documented.** Nothing mints
   `service_role` tokens. → §3.1, §3.5.
10. **`PipelineDashboard.tsx` and the Settings "Data Pipeline" card:
    confirmed for deletion.** → §6.2.
11. **Root `worker.py`: delete** — no compose file, Dockerfile, script or
    import references it; the only mentions are inside `pipeline_api.py`
    (deleted with it), a code comment in `lib/health_checks.py:332`
    (reworded) and the April 2026 RLS audit (historical). → §6.3.
12. **Blanket-grant revoke evidence: the source grep plus the nginx logs is
    sufficient.** Condition: 228 ships with a rollback script validated on a
    throwaway cluster, apply → verify → rollback → re-apply. → §3.5, §7.15,
    §8 step 1.

Also recorded: **`kd-pipeline-api` (v1) is not running on the VPS; only
`kd-pipeline-api2` exists (checked 26 Sep)** — §6.3, and §7.12 keeps the
`docker ps` check as a no-op assertion. **Build gate:** the 1b build starts
only after 1a is switched to `AUTH_MODE=enforce` and its acceptance script
passes — locked decision 1, §8.

### Questions these decisions create (new, not yet decided)

- **§3.4 `kd_app` carve-out in the refresh functions.** Decision §9.6 said
  "add an `is_admin()` check"; `daily_pipeline.py:520` calls
  `refresh_index_catalog` as `kd_app`, for whom `is_admin()` is false. The
  design uses `is_admin() OR current_user = 'kd_app'`. Alternative: drop the
  legacy CLI call (it is on the `daily_pipeline` path pipeline2 skips in
  production — D41) and keep the check pure. Confirm the carve-out or the
  drop.
- **§3.6 re-granting the 72 formerly-PUBLIC functions.** Decision §9.8
  revokes anon; because 72 functions are PUBLIC-executable, the only way to
  honour "anon keeps four" is to revoke PUBLIC and re-grant `authenticated` /
  `kd_app` by generated list. The generated list is the design; confirm that
  a script-generated grant list (asserted by count, like the matview
  migrations) is acceptable, or name the roles/functions to re-grant by hand.
- **§7.2b needs a throwaway admin account** on the VPS to exercise the
  suspended-admin path (suspend, test, unsuspend). Confirm that creating one
  through `/users` is acceptable, or restrict 2b to the throwaway cluster.
- **§1.3 `discovery/status` / `confidence/status` stay `user`** although
  after §9.2 only admins mount their caller. Kept `user` deliberately (a read
  of job state is not an admin capability); confirm, or move them with
  `cancel` for a cleaner "JobMonitor is admin" story.
