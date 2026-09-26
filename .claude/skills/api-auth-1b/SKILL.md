---
name: api-auth-1b
description: Phase 1b design contract for the admin guard and the master-data write boundary on kd-pipeline-api2 and PostgREST — the 41 routes moving user → admin with their calling pages, the is_admin() verdict, migration 228 (RLS on the five master tables plus the blanket-grant cleanup), the kd_update_profile whitelist verdict, user_subscriptions own-row SELECT, the deletion list (27 dead routes, 6 dead frontend files, the v1 pipeline_api service), acceptance tests, rollout and rollback, and the open questions. Use when implementing or reviewing Phase 1b, when adding an admin-only route (it must use the admin guard from this contract), when giving a PostgREST table a write policy, or when touching _require_admin, is_admin(), kd_update_profile, docker-compose's pipeline-api service, or anything under pages/DataPipeline.
---

# Phase 1b — admin guard, master-data RLS, dead-code removal

Design only. No code and no migration file exist for this yet.

Inputs: `.claude/skills/api-auth-contract/SKILL.md` (1a; its 1b column is the
starting point), the 2026-09-26 auth audit, `docs/security/hotfix-2026-09-26.md`
(follow-ups 4, 7, 8, 9, 10). Every "live" fact below was read from
`kaala_dristi_db` through the read-only MCP on 2026-09-26, after migrations 226
and 227 and the JWT rotation — not inferred from migration text. Route line
numbers are from `pipeline2_api.py` at `main` `03a10c2` (post-1a).

## Locked decisions (owner)

1. 1b deploys after 1a is in `AUTH_MODE=enforce`.
2. Routes whose 1b target is `admin` get the admin guard, which reuses
   `_require_admin` (`km_profiles.role = 'admin'`). Classification is by
   calling page (1a §9.5).
3. Master-data writes are protected with RLS, not by moving them to the API.
4. The 27 dead FastAPI routes are deleted.
5. The 16 dead v1-path frontend call sites (6 files) are deleted.
6. The legacy `pipeline_api.py` v1 service is removed entirely (compose
   service `pipeline-api`, container `kd-pipeline-api`, port 8100).
7. `user_subscriptions` gets an own-row SELECT for `authenticated`.

---

## 1. Admin route table

### 1.1 How the admin guard composes with 1a

1a put ONE app-wide dependency, `route_guard`, on every route: it decides
`exempt | guest | user` by path and, for `user`, verifies the bearer token
(HS256, `role=authenticated`, `aud` absent or `app`, UUID `sub`). Admin is a
**second, per-route** dependency layered on top, never a fourth path class:

```
route_guard (app-wide)          require_admin (per route, 1b)
  user token rules pass    →    SELECT role FROM km_profiles WHERE id = <sub>
                                role = 'admin' → handler runs
                                otherwise      → 403 detail='not_admin'
```

- `require_admin` lives in `lib/auth.py` next to the other guards and is the
  existing `_require_admin(conn, caller_id)` body moved there unchanged: one
  primary-key lookup on `km_profiles` per admin request, run as `kd_app`
  (whose `profiles_app_all` policy from 226 lets it read every row). It takes
  `caller_id = Depends(get_current_user_id)`, so a missing/invalid token is
  still a 401 from the 1a rules before the role is ever looked up; only a
  valid non-admin session reaches the 403. The five `/api/admin/users*`
  routes keep calling the same function inline (they also need `caller_id`
  for the audit row); nothing about them changes.
- Status is **403**, not 401. The 1a frontend client treats 401 as a dead
  session and signs the user out; a non-admin who somehow reaches an admin
  route must not be logged out for it. `detail='not_admin'` joins the 1a
  reason vocabulary (`missing | invalid | expired | wrong_role | wrong_aud |
  bad_sub`).
- The lookup is per request, uncached. The role can change under a live
  session (Users admin → plan reassign, suspend), and a suspended admin
  should stop being one on the next request, not after a TTL. At today's
  admin-route volume (one operator) the extra PK read is not measurable.
- The JWT `role` claim is never consulted for admin-ness. `kd_auth_login`
  stamps `role=authenticated` for everyone (migration 144, confirmed live in
  §2), so there is no admin claim to trust and none is introduced.

**`AUTH_MODE` and the admin guard.** The admin guard obeys `off` (bypassed,
like every guard) and is **enforced in both `audit` and `enforce`**; in `audit`
it additionally logs. Reasoning: the 1a audit window existed to discover
frontend call sites still sending no token — a migration problem where
letting the request through was the point. A non-admin session on an admin
route is not a migration artefact, there is nothing to discover by letting it
through, and 1b is deployed only after `enforce` anyway (locked decision 1).
Making `audit` open the admin routes would also mean a 1a rollback to `audit`
silently opened them. The audit line uses the 1a format:

```
auth.audit route=POST /api/pipeline2/fix guard=admin reason=not_admin ip=… caller=page:/data-pipeline
```

If the owner wants a log-only pass for the first 1b deploy, that is open
question §9.1 — it is a one-line change in `require_admin`, not a design
fork.

### 1.2 Routes moving `user → admin` (41)

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
| 3582 | GET /api/pipeline2/ping | `hooks/useBackendStatus.ts` — the "Backend offline" pill in `JobMonitor` (Layout, every profile) and `RuleDetail`. Decision 1a §9.4: ping becomes admin, so 1b must give the pill a user-safe probe — see §1.4 |

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
admin-gated. The three write routes are the only ones on that page and are
reachable in the UI by admins alone, so they go `admin`. The page's reads
(`/api/panchang/week` via `astroCalendar.ts:84`) stay `user`.

**Rule engine — page `/rules` (`pages/RuleEngine/*`, adminOnly)** — 15

| line | route | caller |
|---|---|---|
| 3839 | POST /api/discovery/run-all | `discoveryService.ts` |
| 3851 | POST /api/discovery/run-missing | `discoveryService.ts` |
| 3883 | POST /api/discovery/run-rule/{rule_id} | `discoveryService.ts` |
| 3930 | GET /api/discovery/signal-counts | `discoveryService.ts` (RuleList) |
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
| 5805 | DELETE /api/vani/cache | `VaNi/VaNiMessage.tsx:99` — already rendered only when the `isAdmin` prop is true (line 95), so the 1a note "hide the control for non-admins" is done; 1b adds the server-side guard the control was missing |

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

Reconciliation with the 1a count of 54 admin targets: 41 moving + 5 unchanged
+ 8 admin-target routes that are dead and get deleted instead
(`pipeline2/jobs/{job_id}`, `pipeline/refresh-breadth`,
`pipeline/refresh-breadth-roc`, `vani/clear-cache`,
`vani/observation-cache/…`, `vani/correlation-insight/clear-cache`,
`vani/warm-scanner-explainers`, `vani/warm-help-intents`) = 54.

### 1.3 Routes staying `user`, with the borderline reasons

| route | why it stays `user` |
|---|---|
| GET /api/pipeline2/last-run | `PipelineHealthBar` on `/workspace` and `LastRunBanner`; every profile sees the data-freshness line. Read-only, no job control (1a §9.4) |
| GET /api/discovery/status, GET /api/confidence/status | `JobMonitor` is mounted in `Layout.tsx:192` for every profile; the pill polls these to show "a job is running" |
| POST /api/discovery/cancel | same `JobMonitor` — decided `user` in 1a §9.5. Note it lets any logged-in user cancel an admin's discovery run; carried to §9.2 rather than re-decided here |
| GET /api/ai/rule-insight, GET /api/ai/active-rule-today | `RuleInsightCard`, `WorkspaceCanvas`, `OverlayExplainPopover`, `useConfluenceDetection` — user surfaces; the rule page is admin but these readers are not |
| GET /api/confluence/heatmap, /timeline | `MarketStructureView`, `ConfluenceDotGrid` — user pages |
| GET /api/panchang/daily, /week, /calendar | reads; `/panchang` is adminOnly but `useIntraday`, `SixDayOutlookCompact` and `astroCalendar.ts` read them from user pages. A read-only calendar is not an admin capability |
| GET /api/astro/daily-signal, /transits, GET /api/intraday/plan-score | user pages (`/intraday/:id` is adminOnly in the nav but reachable by URL and read-only) |
| GET /api/scan/presets, POST /api/vani/ask, POST /api/vani/feedback, POST /api/ai/vani-narrate, the `/api/ai/*` insight and `fpb-*` routes | the product surface for every profile. Rate limits on LLM routes remain out of scope (1a §8) |
| GET/PUT /api/framework/{id}, the four `/api/bookmarks/*`, POST /api/correlation/compute, POST /api/vani/correlation-insight, GET /api/landing/spotlight/reveal | per-user data, already bearer + own-id checks |
| POST /api/payments/create-order, /reconcile | the paying user's own flow |

`GET /api/pipeline2/ping` is the one route that leaves `user` while a
non-admin component depends on it; §1.4 handles that.

### 1.4 The backend-status pill after ping goes admin

`useBackendStatus` polls `GET /api/pipeline2/ping` every 15 s from `JobMonitor`
(every profile) and `RuleDetail`. After 1b a user session gets 403 there, and
the pill would read "Backend offline" for every non-admin — the exact
masking 1a §5 warned about.

Design: add `GET /api/alive` — `user` guard, body `{"ok": true}` only, no
`SELECT 1`, no worker state, no `auth_mode`. It answers one question (is the
API process up and accepting this session) and leaks nothing that `ping`
carries (`worker_running`, `auth_mode`). `useBackendStatus` points at it;
`ping` keeps its full body for the Data Pipeline page and `/internal/health`
keeps it for ops. `RuleDetail` is admin-only and could keep `ping`, but one
probe path is simpler than two. Alternative (reuse `last-run`) is §9.5.

The 1a acceptance script's `USER_ROUTES` list must move `ping` and the 41
routes above into a new `ADMIN_ROUTES` list (§7), and `GET /api/alive` joins
`USER_ROUTES`.

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
the `km_profiles` RLS policies — which is not even required, since
`profiles_self_select` already lets `authenticated` see its own row, and own
row is the only row `is_admin()` reads.

**Can a normal user's token satisfy it?** Only by having
`km_profiles.role = 'admin'`. The `sub` is inside the HS256 signature; a user
cannot present another user's `sub` without the signing secret, and after 226
+ 227 the two signers are executable by `vikuna_admin` only. `kd_auth_login`
(live body, §2 of the audit) stamps `role='authenticated'` unconditionally
and returns the profile role in the JSON body **for UI gating only**; nothing
in the claims says "admin". So a normal user cannot satisfy it. **Verdict:
correct design; no redesign.** It already is what the task's fallback asks for
(profile lookup by `sub`, SECURITY DEFINER).

**Two hardenings, both in 228, no behaviour change:**

1. **Fixed `search_path`.** `proconfig` is NULL. A SECURITY DEFINER function
   without `SET search_path` resolves `km_profiles` through the caller's
   search path (`"$user", public`). No login role today owns a schema that
   could shadow it, but this is the standard rule for every DEFINER function
   in this database (`kd_update_profile` and both 207/208 trigger functions
   already set it). `SET search_path = public, pg_temp` — `pg_temp` last, so a
   temp table cannot shadow either.
2. **Keep it `STABLE`** and re-grant explicitly: `REVOKE EXECUTE FROM PUBLIC`
   is not needed here — the function is a predicate about the caller and
   reveals nothing — but the re-`CREATE OR REPLACE` must not lose the
   `admin=X` grant or the policies that call it (they run as the querying
   role, which needs EXECUTE; `=X` covers it).

Not changed: suspended admins. `is_admin()` ignores `is_suspended`; a
suspended admin cannot log in again (`kd_auth_login` refuses) but an existing
7-day token keeps passing `is_admin()` until it expires. Adding
`AND NOT COALESCE(is_suspended, false)` is a behaviour change and is §9.7.

Related, noted for the record: the `admin` DB role has `BYPASSRLS`. After 227
no login role is a member of it (`vikuna_api` is `anon` + `authenticated`
only; `kd_app` is a member of nothing), so it is inert. The two live
`km_profiles` policies "Admins can read all profiles" / "Admins can update any
profile" (`FOR public USING is_admin()`) let an admin session PATCH any
profile through PostgREST, `role` and `tier` included. That is admin power
used by nothing in the frontend (admin edits go through `/api/admin/users*`),
and it stays: it is not a privilege escalation.

---

## 3. Migration 228 — RLS on master data, and the blanket-grant cleanup

### 3.1 Who writes what (live)

Roles that matter:

| role | bypass RLS | how it reaches the DB | policies must name it? |
|---|---|---|---|
| `kd_app` | no | FastAPI (`kd-pipeline-api2`), the pipeline2 worker and scheduler (`DATABASE_URL=postgresql://kd_app:…` in compose), every `scripts/*.py` | **yes** — every table it writes needs a `kd_app` policy or its writes silently affect 0 rows |
| `authenticated` | no | every logged-in PostgREST request (`vikuna_api` → `SET ROLE authenticated`) | yes |
| `anon` | no | logged-out PostgREST requests | yes for SELECT where anon reads today |
| `service_role` | no | no login role is a member; only `vikuna_admin` — effectively unused | named in the 226 policies; carried for symmetry |
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

RPCs the frontend calls that touch these tables: `refresh_index_catalog`,
`refresh_equity_catalog`, `refresh_commodity_catalog` (SECURITY DEFINER,
`authenticated=X`; each is a single `REFRESH MATERIALIZED VIEW CONCURRENTLY`
of `mv_*_catalog` — read-only in effect) and `evaluate_dc_inferences` (STABLE,
returns a table; read-only). Neither writes a base table.

Backend writers of the five tables (all as `kd_app`):

| table | writer | when |
|---|---|---|
| `km_equity_symbols` | `pipeline/processors/inserter.py:92` (`sync_isin_from_bhav`, `UPDATE … SET isin`) | nightly, inside the `nse_eod_download` dimension |
| `km_equity_symbols` | `scripts/sync_nse_isin_master.py`, `enrich_equity_metadata.py`, `populate_mcap.py`, `compute_dormancy.py`, `backfill_listing_dates.py`, `backfill_isin_from_bhav_files.py` | one-shot scripts |
| `km_index_symbols` | `pipeline2_api.py:8417` (`DELETE … WHERE category='custom'`, the `DELETE /api/custom-index/{id}` handler) | admin action |
| `km_index_constituents` | `pipeline2_api.py:8414` (`DELETE … WHERE index_id`) — same handler | admin action |
| `km_index_symbols` | `daily_pipeline.py:520` `refresh_index_catalog` RPC (matview refresh only) | legacy CLI path |
| `km_astro_rule_master`, `dc_inference` | none — `rule_discovery.py` and the confidence scorers only read them | — |

Triggers on these tables, which matter because a trigger fires as the
writing role unless it is SECURITY DEFINER:

| table | trigger | function | definer + search_path |
|---|---|---|---|
| `km_index_constituents` | `custom_membership_change` (row) | `record_custom_membership_change` → writes `km_custom_index_revisions`, `km_custom_index_membership_log` | DEFINER, `public, pg_temp` |
| `km_index_constituents`, `km_index_symbols` | `km_leadership_*_changed` (statement) | `km_invalidate_leadership_generation` → writes `km_leadership_generation` | DEFINER, `public` |
| `dc_inference` | `trg_dc_inference_updated_at` | `set_updated_at` (sets `NEW.updated_at`) | invoker — touches only the row being written |

So an admin edit through PostgREST keeps producing its revision log and
generation bump under RLS: the side-effect writes run as the function owner.
Nothing to add.

### 3.2 Live state of the five tables (plus `dc_lookup`)

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

CREATE POLICY <t>_read       ON <t> FOR SELECT TO anon, authenticated, kd_readonly USING (true);
CREATE POLICY <t>_admin_ins  ON <t> FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY <t>_admin_upd  ON <t> FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY <t>_admin_del  ON <t> FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY <t>_app_all    ON <t> FOR ALL    TO kd_app, service_role USING (true) WITH CHECK (true);

REVOKE TRUNCATE, REFERENCES, TRIGGER ON <t> FROM authenticated;   -- keep INSERT, UPDATE, DELETE, SELECT
REVOKE MAINTAIN ON <t> FROM anon;                                  -- and from authenticated where present
```

Why each line:

- **Separate INSERT/UPDATE/DELETE policies, not one `FOR ALL`.** A `FOR ALL`
  policy with only `USING` reuses it as the `WITH CHECK` (that is how
  `idx_const_write` works today), which is fine for a boolean like
  `is_admin()` — but it also applies the admin predicate to SELECT, so a
  non-admin would see zero rows unless a second permissive SELECT policy
  exists. Splitting by command makes the read policy the only thing that
  governs reads and keeps each predicate explicit.
- **`anon` in the read policy.** `anon` holds `r` on all six today and 226
  left market-data anon SELECT alone by design. Enabling RLS with a policy
  that names only `authenticated` would turn every anon read into zero rows
  without an error — the silent-NULL failure class. (Whether anon should read
  `km_astro_rule_master`, `dc_inference` and `dc_lookup` at all is §9.8; the
  landing page reads none of them, but 228 preserves the current surface.)
- **`kd_app, service_role` `FOR ALL USING (true)`.** The pipeline and FastAPI
  keep full access; the same shape 226 used on `km_profiles` and
  `user_subscriptions`. Without it the nightly `sync_isin_from_bhav` UPDATE
  (as `kd_app`) would affect 0 rows and stamp the dimension as computed —
  presence, not correctness, again.
- **`REVOKE TRUNCATE, REFERENCES, TRIGGER` from `authenticated`.** RLS does
  not govern TRUNCATE, and `D`/`x`/`t` were granted on three of the six by the
  blanket grant. No frontend path uses them.
- **Grants for `authenticated` are otherwise kept.** RLS is the gate (locked
  decision 3); the table-level `arwd` is what lets an admin session's write
  reach the policy at all.
- **No `FORCE ROW LEVEL SECURITY`.** `vikuna_admin` owns the tables and runs
  migrations and pgAdmin repairs; forcing RLS on the owner buys nothing here
  and would make every hand repair need a policy.

Each table then also gets `REVOKE EXECUTE ON FUNCTION compute_custom_index_eod
FROM authenticated` (non-DEFINER, writes `km_index_eod` as the caller; no
frontend caller — the backend `/compute` endpoint runs it as `kd_app`) and the
three `refresh_*_catalog` functions get `SET search_path = public, pg_temp`
(they are DEFINER, owned by the superuser, and today resolve `mv_*_catalog`
through the caller's path). Whether their EXECUTE stays with `authenticated`
(the admin catalog pages call them through PostgREST as the admin's
`authenticated` session) or moves behind an `is_admin()` check inside the
function body is §9.6; 228 as designed keeps EXECUTE and adds the check
inside, so the two catalog pages keep working and a non-admin gets `42501`.

### 3.4 Every other RLS-off table where `authenticated` can write — from live `relacl`

The off-repo blanket grant gave `authenticated` `arwd` (sometimes `arwdDxtm`)
on **44 RLS-off tables**. The six above are the only ones the frontend writes
(§3.1 list). The other **38** are written by the pipeline, FastAPI or nobody;
`authenticated` write on them is pure exposure. For those the fix is not RLS
(locked decision 3 is about master-data writes that must stay possible for
admins through PostgREST) but a grant revoke — there is no legitimate
`authenticated` writer to keep, so a policy would be an admin door to a room
nobody enters:

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
REVOKE MAINTAIN ON dc_market_status, kd_vani_opportunity_config, km_api_sessions, km_fii_dii,
  km_pipeline_runs, km_rule_inference, km_trading_calendar FROM anon;   -- plus the six in §3.3
```

(42 names: the 38 plus `km_sectors`, `km_sector_lords`, `km_index_composition`,
`km_index_master` which the Settings "Sector Lords" card reads but never
writes, and minus the six handled in §3.3. `km_astro_events`,
`km_candidate_rules`, `km_rules`, `km_rule_signals` and eleven others carry
1–3 policies each that have been inert since creation because RLS is off —
they are left as they are; a revoke does not depend on them.)

Two properties of this list are load-bearing:

1. **`kd_app` is untouched**, and `kd_app` is the only role the pipeline,
   the worker, the scheduler and every `scripts/*.py` connect as (compose
   `DATABASE_URL`, `lib/config.py:20–23`). The nightly run cannot notice a
   revoke on `authenticated`.
2. **The frontend writes none of them** — measured by grepping every
   PostgREST write builder in `App/frontend/src`, and by the RPC list (the
   only RPCs the frontend calls are the five `kd_auth_*`, `kd_update_profile`,
   `kd_result_returns` (STABLE), `evaluate_dc_inferences` (STABLE) and the
   three catalog refreshes). Before applying, the last available
   `vikuna-nginx` access logs should be grepped for any non-GET on
   `/db/<table>` for these 42 names as a second measurement (§8 step 1, §9.12); the
   available window is only about five days, which is why the grep of the
   source is the primary evidence.

`service_role`'s `arwd` on the same tables is left alone — no login role is a
member of it; revoking is hygiene for a later pass (§9.9).

### 3.5 What is explicitly not in 228

- `km_profiles` (done in 226), `user_subscriptions` (§5, in 228 but separate
  from the master-data block), `km_user_bookmarks`, `km_ux_events`,
  `user_frameworks` (RLS already on; the anon SELECT hygiene is hotfix
  follow-up 10 and can ride along as one `REVOKE`).
- Any change to which tables `anon` can SELECT (§9.8).
- `FORCE ROW LEVEL SECURITY` anywhere.

228 must be validated on a throwaway PostgreSQL 16 cluster with the role set
above and fixtures for all six tables before it is applied — the same
procedure 226 used, in several orderings (apply, rollback, re-apply), with
`SET ROLE` + `request.jwt.claims` set to a user `sub`, an admin `sub`, and
none (for `kd_app`).

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
`expires_at` (not even a `km_profiles` column — it is derived from
`user_subscriptions` in `auth.ts`), `email`, `id`, `created_at`, and every
Razorpay/billing field (none live on `km_profiles`; `user_subscriptions` holds
`tier, started_at, expires_at, razorpay_subscription_id, razorpay_payment_id,
status, base_paise, gst_paise, total_paise` and is written only by `kd_app`
through `/api/payments/*` and `/api/admin/users/*`). An unknown key in
`p_updates` is ignored, not applied. **Verdict: no fix required.**

Two hygiene items, optional, no behaviour change:

- `proacl` grants EXECUTE to `anon` and to the unused `user` role. `anon` has no
  `sub`, so the call raises `42501 Not authenticated` before the UPDATE — but
  there is no reason for the grant to exist. `REVOKE EXECUTE … FROM anon,
  "user"` can ride in 228.
- `search_path = public` should be `public, pg_temp` for the same reason as
  `is_admin()`.

The frontend's own check (`auth.ts:228` refuses a returned row whose persona
fields differ from what was sent) stays; it guards against a stale server,
not against privilege.

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

The policy is recreated scoped to `authenticated` rather than `public` (so it
cannot be reasoned about for `anon`, which has no grant anyway). No INSERT /
UPDATE / DELETE grant: writes stay with `kd_app`.

**What starts working and what depends on the silent failure today.**
`services/auth.ts:186` reads the latest `status='active'` row and copies
`expires_at` onto the profile. Today the read errors, the error is discarded
(`const { data: subData } = …` — and after the auth hotfix, only an auth
rejection there is thrown; a `42501` permission error is not one), and
`profile.expires_at` stays whatever `km_profiles` did not supply: `undefined`.
Consumers of `expires_at`:

| consumer | today (`undefined`) | after 228 |
|---|---|---|
| `views/AccountPage.tsx:345` — Plan & Billing shows the expiry date | shows nothing / "no expiry" | shows the subscription's date |
| `components/workspace/InlineGate.tsx:114` — `daysLeft(profile?.expires_at)` for the countdown copy | no countdown | countdown when a row exists |
| `stores/frameworkStore.ts:178` — syncs `expires_at` from the framework payload into the profile | unchanged | unchanged |
| `types/index.ts:151` — `expires_at?: string | null; // null = no expiry (beta/lifetime)` | — | — |

Nothing gates access on `expires_at`; tier gating reads `km_profiles.tier`.
And **the table holds 0 rows live** (2026-09-26), so on the day 228 lands the
query starts returning an empty result instead of an error and every consumer
sees exactly what it sees today. The first user with a paid row gets a real
expiry date on their Account page. There is no dependency on the current
failure.

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
| 1416 | GET /api/dashboard/composite | `MarketWeatherCard` not rendered — **see §9.3** |
| 1596 | GET /api/dashboard/context | `MarketWeatherCard`, `HistoricalContextCard` — **see §9.3** |
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

With each route goes its request model if nothing else uses it, and the
`test_auth_guards.py` floor (`>= 111 decorated routes`) drops to the new count
(111 − 27 + `alive` = 85). The 1a acceptance script's `USER_ROUTES` loses the
27 and gains a `DELETED_ROUTES` list asserting 404 (§7.7).

**Frontend code that becomes unreachable once these are gone** — not in the
locked 16, listed so the build stays honest (§9.4 decides whether 1b deletes
them or a follow-up does):

| symbol | file | what it called |
|---|---|---|
| `fetchJob` | `services/pipeline2.ts` | jobs/{id} |
| `useStage2Scan` / `fetchStage2` | `hooks/useScan.ts` | scan/run/stage_2_leaders |
| `MarketWeatherCard` (+ `MarketWeatherProps`) | `components/domain/DashboardV3/MarketWeatherCard.tsx`, barrel `DashboardV3/index.ts:7,12`, import in `views/MarketStructureView.tsx:8` (unused there) | dashboard/composite, /context |
| `HistoricalContextCard` | `DashboardV3/HistoricalContextCard.tsx`, barrel `:10` | dashboard/context |
| `VaNiMorningBrief` | `components/workspace/VaNiMorningBrief.tsx` (no importer) | vani/daily, vani/observation-cache |
| `usePanchangInsight`, `useBreadthInsight`, `useBreadthRocInsight`, `useSectorInsight`, `useConfluenceHistorical` | `hooks/useDashboardExtras.ts`, barrel `hooks/index.ts:26` | the four `/api/ai/*-insight` routes and confluence/historical |
| `fetchConfluenceHistorical` | `services/panchang.ts:46` | confluence/historical |

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

**What they drag, found by following importers:**

- **`views/settings/PipelineDashboard.tsx`** is the only importer of
  `DataHealthGrid`, `PipelineExecution` and of every v1 function in
  `pipelineData.ts`, and it is mounted: `SettingsView.tsx:69` renders it
  behind the "Data Pipeline" settings card (`activeCard === 'pipeline'`). It
  is the **v1 pipeline dashboard**, every request it makes 404s today, and
  the live Data Pipeline page is `/data-pipeline` (`pages/DataPipeline`,
  pipeline2). Deleting the 16 sites without deleting this view breaks the
  build, so 1b deletes `PipelineDashboard.tsx` and the `'pipeline'` card in
  `SettingsView.tsx` (lines 39–47 card definition, 7 import, 68–69 branch).
  This is a consequence of a locked decision, not a new one; it is listed in
  §9.10 for the owner to acknowledge.
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

### 6.3 The v1 service

| item | where | action |
|---|---|---|
| compose service `pipeline-api` | `docker-compose.yml:8–22` (build, `container_name: kd-pipeline-api`, `DATABASE_URL`, `LLM_BASE_URL`, Razorpay keys, `pipeline_data` volume, `vikuna-net`) and the section comment above it | delete the block |
| `App/backend/pipeline_api.py` | 2,272 lines, 38 routes, no auth | delete |
| `App/backend/Dockerfile` | shared with `pipeline-api2`; its `CMD` is already `pipeline2_api:app` | keep, unchanged |
| modules only v1 imports | none. `lib.data_assemblers` is imported by `pipeline2_api.py:51`; `lib.breeze_client` by `breeze_downloader.py`; `daily_pipeline` by `pipeline2/handlers.py` and seven scripts; `apscheduler`/`pytz` by `pipeline2/scheduler.py` | keep all |
| `App/backend/worker.py` (root) | the v1-era standalone `km_jobs` poller ("Kāla-Drishti Job Worker"); not referenced by compose, the Dockerfile or `deploy.sh`; `pipeline2/worker.py` is the live one | **candidate**, §9.11 — not in the locked set |
| nginx | `nginx/dristiq-vps.conf`, `nginx/nginx.conf`, `App/frontend/nginx.conf` contain no `8100`, `pipeline-api` or `kd-pipeline-api` reference (grep, 2026-09-26) | nothing |
| `deploy.sh` | builds/starts only `pipeline-api2 kd-frontend` | nothing |
| docs | `CLAUDE.md` names `pipeline_api.py` three times ("DO NOT RUN", the compose note, the file tree) | update the three lines in the same commit |

⚠ **The v1 container is not what its name says.** The `pipeline-api` service
sets no `command:`, so it runs the image's `CMD` — `uvicorn pipeline2_api:app
… --port 8101`. Its `DATABASE_URL` is set. `pipeline2_api`'s lifespan starts
**a worker subprocess and the scheduler whenever `DATABASE_URL` is set**
(`pipeline2_api.py:169–180`). So if `kd-pipeline-api` is running, it is a
second pipeline2 instance: a second worker claiming from the same `km_jobs`
queue and a second scheduler. The scheduler de-duplicates `daily_run` and
per-dimension fixes on an existing queued/running job
(`pipeline2/scheduler.py:38–46, 94`), which is consistent with the live
`km_jobs` (one `daily_run` per date for the last 14 days) — so the DB cannot
tell whether the container is up. `deploy.sh` never starts it, so it is most
likely stopped or never created; **§7.12 checks before removal**, because
removing a container that is quietly running half the pipeline's jobs is a
different operation from removing a dead one (§7.12).

### 6.4 Nothing live references any of it — how that was checked

- Routes: every path in §6.1 has zero callers in `App/frontend/src` after the
  1a client migration, or only the orphan symbols listed with it.
- Frontend files: importer grep per file (§6.2); `PipelineDashboard.tsx` is
  the one live importer and goes with them.
- v1 service: `grep -rn "8100\|pipeline-api\b\|kd-pipeline-api\b\|pipeline_api"`
  over `docker-compose.yml`, `nginx/*.conf`, `App/frontend/nginx.conf`,
  `deploy.sh`, `App/backend/Dockerfile` → only the compose block itself.
  `grep -rln "import pipeline_api\|from pipeline_api" App/backend` → nothing.
- The audit (§"Legacy pipeline_api.py") already recorded: 38 routes, no nginx
  route, no published port.

---

## 7. Acceptance tests

Run on the deployed stack with `AUTH_MODE=enforce`, after 228 and the 1b code.
`scripts/auth_acceptance.py` grows an `ADMIN_ROUTES` list (the 41 + 5) and a
`DELETED_ROUTES` list (the 27); it takes a second credential pair
`KD_ADMIN_EMAIL` / `KD_ADMIN_PASSWORD`. PostgREST cases use the same two
sessions against `/db/`.

| # | case | expected |
|---|---|---|
| 1 | Free user token on every route in `ADMIN_ROUTES` (46) | `403 not_admin` on all; body carries nothing but `detail`. Write routes are hit with an empty body and must 403 **before** validation |
| 2 | Admin token on every `ADMIN_ROUTES` read route, and on the write routes with a safe body (`/pipeline2/dimensions`, `/scheduler`, `/discovery/signal-counts`, `/patterns/status`, `/confidence/yearly/1`, `/custom-index/themes`; POST `/pipeline2/cancel` with a non-existent job id → 404, which is "reached the handler") | `200` (or the handler's own 404/422), never 401/403 |
| 3 | Free user PostgREST write on each of the six tables: `PATCH /db/km_index_symbols?id=eq.<custom id>` `{"is_active":false}`, `PATCH /db/km_equity_symbols?id=eq.…`, `POST /db/km_index_constituents`, `POST /db/km_astro_rule_master`, `POST /db/dc_inference`, `PATCH /db/dc_lookup?…` | INSERT → `42501` (WITH CHECK fails); UPDATE/DELETE → `0 rows` (`Prefer: return=representation` → `[]`), never a changed row. Then the same writes as admin → succeed, and the admin then reverts them |
| 4 | Pipeline dimensions that write these tables still succeed, run **as `kd_app`**: on a throwaway cluster seeded with 228 and fixtures, run the exact statements — `inserter.sync_isin_from_bhav`'s UPDATE on `km_equity_symbols`, the custom-index DELETE pair from `pipeline2_api.py:8414–8417`, `compute_custom_index_eod` — and assert row counts > 0 and no `42501`. On the VPS: `POST /api/pipeline2/fix {dimension:'nse_eod_download', trade_date:<last bar>}` as admin and watch it complete; create a throwaway custom index in the UI, Calculate, then Delete — the Delete must remove constituents and the symbol (this is also the §3.2 defect check: run it once BEFORE 228 and record the outcome) |
| 5 | `POST /db/rpc/kd_update_profile {"p_updates":{"tier":"pro","role":"admin","is_suspended":false,"display_name":"x"}}` as a free user | `200`; the returned row has `display_name = 'x'` and `tier`, `role`, `is_suspended` unchanged (re-read `/db/km_profiles?select=tier,role,is_suspended` to confirm) |
| 6 | `GET /db/user_subscriptions?select=*` as user A (with a seeded row for A and one for B, inserted as `kd_app` on the throwaway cluster; on the VPS, once real rows exist) | `200`, exactly A's rows; `GET …?user_id=eq.<B>` → `[]`; anon → `42501` |
| 7 | Every route in `DELETED_ROUTES` (27), with and without a valid token | `404` (FastAPI's, `{"detail":"Not Found"}`), never a guard 401/403 — proving the decorator is gone, not merely guarded |
| 8 | `GET /api/alive` with a user token → `200 {"ok":true}`; without → `401`; `GET /api/pipeline2/ping` with a user token → `403` and the backend-status pill on `/workspace` as a free user still reads online | pill probe moved |
| 9 | `scripts/smoke_after_deploy.sh` with a **free user's** credentials, then with an admin's | both pass — the script's `GET /api/pipeline2/health` step must switch to `/api/alive` for the user run, or take a `--admin` flag; a free-user smoke that hits `health` would now correctly fail |
| 10 | Blanket-grant revoke (§3.4): as a free user, `PATCH /db/km_equity_eod?…`, `POST /db/km_rule_signals`, `DELETE /db/km_trading_calendar?…` | `42501` permission denied (a grant error, not a 0-row RLS result) |
| 11 | Nightly run after 228: the next `daily_run` completes with every dimension `completed` (not `partial`), `km_dimension_watermarks` stamped for the date, and `check_derivation_staleness` quiet | pipeline unaffected |
| 12 | v1 removal: `docker ps -a --filter name='^kd-pipeline-api$'` recorded before; after `docker compose rm -sf pipeline-api`, `docker ps -a` shows no such container, `km_jobs` keeps completing (a worker is still alive), and `GET /api/alive` through the edge is `200` | the live container was `kd-pipeline-api2` all along |

Cases 1–3, 5–8 and 10 are HTTP and go into the acceptance script; 4, 9, 11,
12 are runbook steps. All PostgREST write cases must use throwaway rows
(a custom index created for the test, a `dc_inference` row named for the
test) and clean up as admin.

---

## 8. Rollout and rollback

Order, with what each step depends on:

| step | what | depends on | rollback |
|---|---|---|---|
| 1 | **Migration 228** (RLS on the six tables, `is_admin()` hardening, blanket-grant revoke, `user_subscriptions` grant + policy) in pgAdmin, after the throwaway-cluster validation | 1a in `enforce` (locked), a grep of the last nginx logs for non-GET `/db/` writes on the 42 tables (§3.4, §9.12) | `km_migration_228_rollback.sql`: disable RLS on the six, drop the new policies, recreate the two inert `*_read`/`*_admin_write` pairs and the two `public` `idx_const_*` policies by name, re-grant the revoked privileges from the recorded `relacl`, revoke the `user_subscriptions` SELECT and restore the `public` policy, restore `is_admin()` without `search_path`. Idempotent both ways (the 226 lesson: `DROP POLICY IF EXISTS` before every `CREATE POLICY`). Admin pages keep working under 228 because the admin session passes `is_admin()`; the pipeline keeps working because `kd_app` has its ALL policy — so 228 can sit alone for a day before step 2 |
| 2 | **Backend**: `require_admin` in `lib/auth.py` and on the 41 routes; `GET /api/alive`; the 27 routes deleted; `test_auth_guards.py` floor updated; `auth_acceptance.py` gains `ADMIN_ROUTES`/`DELETED_ROUTES` | 228 (the admin guard itself does not need it, but the custom-index DELETE handler does, §3.2) | redeploy the previous backend commit. `AUTH_MODE=off` is NOT the rollback for admin — it also disables the 1a guards; prefer the commit rollback |
| 3 | **Frontend**: `useBackendStatus` → `/api/alive`; the 6 files + `PipelineDashboard.tsx` + the Settings card + barrels deleted; (§9.4) the orphan callers; `smoke_after_deploy.sh` updated | backend step 2 (`/api/alive` must exist before the pill points at it). Deploy 2 and 3 **together**, as in 1a, since the pill breaks for users between them | redeploy the previous frontend commit (`kd-frontend` only) |
| 4 | **Compose cleanup**: delete the `pipeline-api` block, `docker compose rm -sf pipeline-api`, `docker image prune` for its image; delete `pipeline_api.py`; update `CLAUDE.md` | the §7.12 pre-check (is the container running, and is it the one processing jobs?) | `git revert` the compose commit and `docker compose up -d pipeline-api` — it would come back as a second pipeline2 instance, which is exactly why this step is last and separate |

Nothing in 1b rotates a secret, changes a token shape or touches nginx, so
the 1a edge conf and `AUTH_MODE` stay as they are.

---

## 9. Open questions (not decided here)

1. **Admin guard in `audit` mode.** Designed as enforced (403) in both `audit`
   and `enforce`, logging in `audit` (§1.1). Alternative: log-only in `audit`
   for the first 1b deploy, at the cost that a 1a rollback to `audit` also
   opens the admin routes.
2. **`POST /api/discovery/cancel` stays `user`** (1a §9.5, `JobMonitor` for
   every profile). It lets any logged-in user cancel a running discovery job.
   Keep, or make `admin` and show non-admins a read-only monitor?
3. **`GET /api/dashboard/composite` and `/context` are in the locked dead
   list**, but `CLAUDE.md` parks `MarketWeatherCard` (Astro-Technical
   Alignment) "pending a rework … re-enable by restoring
   `<MarketWeatherCard>`". Deleting the routes retires the card for good.
   Delete (and remove the card + `HistoricalContextCard` too), or keep those
   two routes as `user` and drop them from the 27?
4. **Orphan frontend callers of the deleted routes** (§6.1 second table:
   `fetchJob`, `useStage2Scan`, `VaNiMorningBrief`, the four insight hooks,
   `fetchConfluenceHistorical`, and the two cards pending §9.3). Delete in 1b
   alongside the routes, or leave as a follow-up?
5. **The pill probe.** New `GET /api/alive` (§1.4) vs pointing
   `useBackendStatus` at the existing `user` route `/api/pipeline2/last-run`
   (no new route, but a `km_jobs` query every 15 s per open tab instead of
   a constant).
6. **`refresh_index_catalog` / `refresh_equity_catalog` /
   `refresh_commodity_catalog` EXECUTE for `authenticated`.** Designed as:
   keep EXECUTE, add an `is_admin()` check inside each DEFINER body (the admin
   catalog pages call them through PostgREST). Alternative: revoke from
   `authenticated` and move the refresh behind the FastAPI catalog-toggle
   path — but there is no such path today, so that is new API surface.
7. **`is_admin()` and suspended admins.** Add `AND NOT
   COALESCE(is_suspended, false)` so a suspension takes effect on the next
   request rather than at token expiry? Behaviour change; interacts with
   `_require_admin` (which also ignores `is_suspended`) — both or neither.
8. **`anon` SELECT on `km_astro_rule_master`, `dc_inference`, `dc_lookup`.**
   228 preserves it (the read policy names `anon`). The landing page reads
   none of them. Revoke, matching the 226 treatment of user/ops tables, or
   keep as market data?
9. **`service_role`** holds `arwd` on ~40 tables and is a member of nothing
   but `vikuna_admin`. Revoke alongside §3.4, or leave until something uses
   it?
10. **`views/settings/PipelineDashboard.tsx` and the Settings "Data Pipeline"
    card** go with the locked 16 (§6.2) — every request the view makes 404s
    today and `/data-pipeline` is the live page. Confirm.
11. **`App/backend/worker.py`** (root, v1-era standalone `km_jobs` poller) is
    referenced by nothing. Delete with the v1 service, or keep?
12. **Nginx-log measurement window for §3.4.** Only ~5 days of `vikuna-nginx`
    access logs exist. Is a 5-day absence of non-GET `/db/<table>` requests
    on the 42 tables, plus the source grep, sufficient evidence to revoke, or
    should the revoke wait for a longer log window?
