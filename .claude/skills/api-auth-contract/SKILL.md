---
name: api-auth-contract
description: Phase 1a design contract for authenticating every FastAPI route on kd-pipeline-api2 (port 8101) — guard model (guest / user / admin / paid / signature), the 111-route table with 1a and 1b guards, the /api/guest namespace and guest-token issuer, the single frontend API client and its call-site migration checklist, the /internal/health move, the AUTH_MODE off|audit|enforce rollout, and the acceptance tests. Use when implementing or reviewing Phase 1a/1b of the security hotfix follow-up, when adding a new FastAPI route (it must pick a guard from this table), when adding a landing-page data need (it must go through /api/guest/*), or when touching lib/auth.py, the frontend API client, nginx /api/ routing, or CORS.
---

# API auth contract — Phase 1a (design only)

Input: the 2026-09-26 auth audit (111 routes in `App/backend/pipeline2_api.py`,
callers, classes) and `docs/security/hotfix-2026-09-26.md`. Paths are relative
to `App/` unless stated. Nothing in this file is implemented yet.

**Locked decisions — not re-debated here:** every route requires auth; the
Razorpay webhook keeps HMAC; the deploy/health check moves to `/internal/health`
(edge nginx routes only `/api/`, so it is unreachable from outside); `POST
/api/guest/token` is the guest issuer, rate-limited per IP, guest scope only;
five guard types (`guest` + `user` built in 1a, `admin` tightened in 1b, `paid`
Phase 2, `signature` webhook only); 1a puts at least `user` on every route
including writes and ops; dead routes are guarded in 1a and deleted in 1b;
guest token is 15 minutes, `role: guest`, distinct `aud`, signed with the
existing `JWT_SECRET`, valid only on `/api/guest/*`; the landing page moves
entirely onto guest endpoints reusing existing handler logic with no new data
queries; CORS locked to production origin(s) with localhost via env var in dev
and `allow_credentials=False`; LLM routes get `user` and no new rate limits.

---

## 1. Guard model

Guards are FastAPI dependencies in `lib/auth.py`. One decode function, five
checks. Every guard reads `Authorization: Bearer <jwt>` (HTTPBearer,
`auto_error=False`), decodes HS256 with `JWT_SECRET`, and then applies its
claim rules. A missing header, a bad signature, an expired `exp` and a failed
claim rule all produce **401** with a one-word `detail` (`missing`, `invalid`,
`expired`, `wrong_role`, `wrong_aud`) — enough for the client to branch, never
enough to enumerate.

| guard | decode | claim rules | who passes | phase |
|---|---|---|---|---|
| `user` | HS256 + `JWT_SECRET` | `sub` present and a UUID (today's check) **and `role == 'authenticated'`** (new); `aud` must be **absent or `'app'`** — a guest `aud` fails | session tokens minted by `kd_auth_login` / `kd_auth_register` (`role='authenticated'`, 7-day `exp`) | 1a |
| `guest` | same | `role == 'guest'` **and** `aud == 'dristiq-guest'`; `sub` is a random UUID the issuer generated (not a profile id); `exp <= iat + 15 min` | tokens from `POST /api/guest/token` only | 1a |
| `admin` | same as `user` | `user` rules **plus** `km_profiles.role = 'admin'` for `sub` (the existing `_require_admin(conn, caller_id)` at `pipeline2_api.py:7204`) | admin profiles | 1b (already live on the five `/api/admin/users*` routes) |
| `paid` | same as `user` | `user` rules plus tier / `expires_at` check | subscribers | Phase 2 |
| `signature` | none | HMAC-SHA256 of the raw body vs `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET` (existing code at `pipeline2_api.py:7640-7710`; 503 if the secret is unset, 400 on mismatch) | Razorpay | exists |

Why `role` must be checked now: today `lib/auth.py:27-55` verifies signature,
`exp` and a UUID `sub` and nothing else, so **a guest token — same secret, a
UUID `sub` — would pass every existing bearer route** the moment the issuer
exists. The `role` rule is what makes guest scope real. The `aud` rule is the
second lock: a future token family with `role='authenticated'` but a different
`aud` still cannot reach app routes.

Guest tokens are rejected by the `user` guard and user tokens are rejected by
the `guest` guard. There is no "user on guest route → allowed" convenience; §7
defines that case.

Route-scope rule for `guest`: the dependency is attached only to handlers
registered under `/api/guest/*`. Nothing else in the app accepts `role='guest'`,
so the token is worthless outside that prefix even if replayed.

### How PostgREST treats a `role: guest` token

The frontend sends the same bearer to `/db/` (PostgREST) that it sends to
FastAPI. A guest token must therefore be useless on `/db/*`.

Verified on a throwaway PostgreSQL 16 cluster shaped like production
(`vikuna_api` LOGIN, member of `anon` and `authenticated` only — the live
state after migration 227):

| case | `SET ROLE guest` as `vikuna_api` | SQLSTATE |
|---|---|---|
| A — no `guest` DB role exists (the intended state; 1a creates none) | `ERROR: role "guest" does not exist` | `42704` |
| B — a `guest` role exists but `vikuna_api` is not a member | `ERROR: permission denied to set role "guest"` | `42501` |
| control | `SET ROLE authenticated` succeeds | — |

PostgREST performs exactly that `SET ROLE` from the JWT `role` claim after
signature verification, so **every** `/db/` request carrying a guest token
fails before any query runs — no rows are ever returned. The HTTP status
PostgREST wraps it in depends on its SQLSTATE→status map for `42704` (PostgREST
maps `42501` to 401/403; the mapping for `42704` could not be read from this
container because docs.postgrest.org and github.com are blocked by the egress
proxy). Expected body: `{"code":"42704","message":"role \"guest\" does not
exist", ...}`. The exact status is pinned by acceptance test §7.4 on the
deployed PostgREST; the contract requires only **non-2xx and zero data**. Do
not create a `guest` DB role "to be tidy" — case A is the stronger rejection.

---

## 2. Route table — all 111 routes

Columns: current auth (audit, 2026-09-26) → **1a guard** → 1b target → dead
(no live caller: no caller found, or callers only in unmounted components /
unused hooks) → the frontend caller(s) that must send a token after 1a
(`FE/` = `frontend/src/`). Every non-exempt route gets `user` in 1a; 1b raises
the marked ones to `admin` and deletes the dead ones.

Counts: **user 109 · guest 1 · signature 1** = 111 (the 109 includes the five
`/api/admin/users*` routes, which keep their existing admin check on top of
the `user` decode rules). Dead: **27**. 1b targets: admin 54, user 55,
guest 1, signature 1 (Rule Engine routes classified by calling page — §9.5).

### Pipeline ops

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 339 | GET /api/pipeline2/health | none | user | admin | no | FE/services/pipeline2.ts:112 |
| 359 | GET /api/pipeline2/jobs | none | user | admin | no | pipeline2.ts:118 |
| 416 | GET /api/pipeline2/jobs/{job_id} | none | user | admin | **yes** (`fetchJob` unused) | pipeline2.ts:122 |
| 440 | POST /api/pipeline2/fix | none | user | admin | no | pipeline2.ts:129 |
| 490 | POST /api/pipeline2/daily-run | none | user | admin | no | pipeline2.ts:135 |
| 527 | POST /api/pipeline2/backfill | none | user | admin | no | pipeline2.ts:143 |
| 599 | POST /api/pipeline2/calendar/mark | none | user | admin | no | pipeline2.ts:167 |
| 655 | POST /api/pipeline2/cancel | none | user | admin | no | pipeline2.ts:152,155 |
| 699 | GET /api/pipeline2/dimensions | none | user | admin | no | pipeline2.ts:173 |
| 716 | GET /api/pipeline2/last-run | none | user | user | no | pipeline2.ts:202 (workspace `PipelineHealthBar`, `LastRunBanner`) |
| 751 | GET /api/pipeline2/scheduler | none | user | admin | no | pipeline2.ts:187 |
| 3529 | GET /api/pipeline2/ping | none | user | admin (decision §9.4) | no | FE/hooks/useBackendStatus.ts:11 (see §5); `deploy.sh:48` moves to `/internal/health` |
| 823 | POST /api/pipeline/refresh-breadth | none | user | admin | **yes** | — |
| 830 | POST /api/pipeline/refresh-breadth-roc | none | user | admin | **yes** | — |

### Scanner, panchang, dashboard, astro, intraday

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 837 | GET /api/vani-opportunity/config | none | user | user | **yes** (QA mock only) | — |
| 850 | GET /api/scan/presets | none | user | user | no | FE/services/scanEngine.ts:2508 |
| 870 | GET /api/scan/run/stage_2_leaders | none | user | user | **yes** (`useStage2Scan` unused) | FE/hooks/useScan.ts:68 |
| 1145 | GET /api/panchang/daily | none | user (+ guest mirror `/api/guest/panchang/daily`, §3) | user | no | FE/services/panchang.ts:7 (app pages), FE/hooks/useIntraday.ts:87; **landing `views/landing/AtmosphericCard.tsx:40` moves to the guest mirror** |
| 1291 | GET /api/panchang/week | none | user | user | no | FE/services/astroCalendar.ts:84, DashboardV3/SixDayOutlookCompact.tsx:89 |
| 1394 | GET /api/dashboard/composite | none | user | user | **yes** (`MarketWeatherCard` not rendered) | MarketWeatherCard.tsx:569 |
| 1574 | GET /api/dashboard/context | none | user | user | **yes** | MarketWeatherCard.tsx:596, HistoricalContextCard.tsx:27 |
| 1688 | GET /api/astro/daily-signal | none | user | user | no | useIntraday.ts:101 |
| 1706 | GET /api/astro/signals | none | user | user | **yes** | — |
| 1728 | GET /api/astro/transits | none | user | user | no | FE/services/astro.ts:8 |
| 1758 | GET /api/intraday/plan-score | none | user | user | no | useIntraday.ts:94 |
| 1825 | POST /api/astro/calendar | none | user | admin | no | FE/services/astroCalendar.ts:155 |
| 1854 | PATCH /api/astro/calendar/{event_id} | none | user | admin | no | astroCalendar.ts:165 |
| 1888 | DELETE /api/astro/calendar/{event_id} | none | user | admin | no | astroCalendar.ts:174 |
| 1906 | POST /api/panchang/generate | none | user | admin | no | FE/services/panchangService.ts:117 |
| 1950 | GET /api/panchang/calendar | none | user | user | no | panchangService.ts:71 |
| 2035 | GET /api/panchang/notes | none | user | user | **yes** | — |
| 2054 | POST /api/panchang/notes | none | user | admin | no | panchangService.ts:86 |
| 2076 | PATCH /api/panchang/notes/{note_id} | none | user | admin | no | panchangService.ts:96 |
| 2101 | DELETE /api/panchang/notes/{note_id} | none | user | admin | no | panchangService.ts:105 |

### LLM insight routes (`user`, no new rate limit)

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 2307 | GET /api/ai/panchang-insight | none | user | user | **yes** (hook unused) | FE/hooks/useDashboardExtras.ts:85 |
| 2363 | GET /api/ai/rule-insight | none | user | user | no | FE/hooks/useRuleInsight.ts:17 |
| 2652 | GET /api/ai/active-rule-today | none | user | user | no | useRuleInsight.ts:59 |
| 2666 | GET /api/ai/breadth-insight | none | user | user | **yes** | useDashboardExtras.ts:71 |
| 2723 | GET /api/ai/breadth-roc-insight | none | user | user | **yes** | useDashboardExtras.ts:57 |
| 2778 | GET /api/ai/sector-insight | none | user | user | **yes** | useDashboardExtras.ts:139 |
| 2876 | POST /api/ai/vani-narrate | none | user | user | no | FE/services/vaniNarrate.ts:12 |
| 2925 | GET /api/ai/instrument-insight | none | user | user | no | useDashboardExtras.ts:105 |
| 2961 | GET /api/ai/market-pulse-insight | none | user | user | no | useDashboardExtras.ts:123 |
| 2998 | GET /api/ai/fpb-recent-outcomes | none | user | user | no | useDashboardExtras.ts:247 |
| 3096 | GET /api/ai/fpb-why-watch-coil | none | user | user | no | useDashboardExtras.ts:265 |
| 3144 | GET /api/ai/fpb-coiling-industries | none | user | user | no | useDashboardExtras.ts:282 |
| 3247 | GET /api/ai/fpb-new-coils | none | user | user | no | useDashboardExtras.ts:318 |
| 3379 | GET /api/ai/fpb-confluence-outlook | none | user | user | no | useDashboardExtras.ts:300 |

### Rule engine: discovery, patterns, confidence, confluence, inference

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 3800 | POST /api/discovery/run-all | none | user | admin | no | FE/pages/RuleEngine/discoveryService.ts:48 |
| 3812 | POST /api/discovery/run-missing | none | user | admin | no | discoveryService.ts:53 |
| 3844 | POST /api/discovery/run-rule/{rule_id} | none | user | admin | no | discoveryService.ts:58 |
| 3856 | GET /api/discovery/status | none | user | user | no | discoveryService.ts:63 |
| 3891 | GET /api/discovery/signal-counts | none | user | admin | no | discoveryService.ts:69 |
| 3922 | GET /api/discovery/transit-counts | none | user | user | **yes** | — |
| 3947 | POST /api/discovery/cancel | none | user | user (JobMonitor, all profiles) | no | discoveryService.ts:75 |
| 3956 | POST /api/discovery/run-clean | none | user | admin | no | discoveryService.ts:80 |
| 3982 | POST /api/discovery/rule/{rule_id}/drop-signals | none | user | admin | no | discoveryService.ts:90 |
| 4007 | GET /api/discovery/diagnose | none | user | admin | no | discoveryService.ts:95 |
| 4241 | POST /api/patterns/run | none | user | admin | no | pages/RuleEngine/PatternStudyButton.tsx:57 |
| 4259 | GET /api/patterns/status | none | user | admin | no | PatternStudyButton.tsx:36 |
| 4284 | POST /api/confidence/compute | none | user | admin | no | discoveryService.ts:85 |
| 4295 | GET /api/confidence/status | none | user | user | no | components/domain/JobMonitor.tsx:20 |
| 4301 | GET /api/confidence/summary | none | user | user | **yes** | — |
| 4336 | GET /api/confidence/yearly/{rule_id} | none | user | admin | no | pages/RuleEngine/RuleDetail.tsx:212 |
| 4427 | GET /api/confluence/historical | none | user | user | **yes** (hook unused) | services/panchang.ts:40 |
| 4504 | GET /api/confluence/heatmap | none | user | user | no | services/panchang.ts:34 |
| 4642 | GET /api/confluence/timeline | none | user | user | no | services/panchang.ts:46 |
| 6864 | GET /api/rules/{rule_id}/inference | none | user | admin | no | RuleInferenceModal.tsx:86, RuleInferencePanel.tsx:52 |
| 6972 | POST /api/rules/{rule_id}/inference | none | user | admin | no | RuleInferenceModal.tsx:437 |
| 7080 | POST /api/rules/{rule_id}/inference/generate | none | user | admin | no | RuleInferenceModal.tsx:413 |
| 7155 | DELETE /api/rules/inference/{inference_id} | none | user | admin | no | RuleInferenceModal.tsx:463 |

### VaNi

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 4792 | POST /api/vani/daily | none | user | user | **yes** (`VaNiMorningBrief` orphan) | workspace/VaNiMorningBrief.tsx:128 |
| 5078 | POST /api/vani/observation | bearer | user | user | **yes** | — |
| 5146 | POST /api/vani/clear-cache | bearer | user | admin | **yes** | — |
| 5154 | DELETE /api/vani/observation-cache/{item_key}/{cache_date} | none | user | admin | **yes** (orphan) | VaNiMorningBrief.tsx:215,319,626 |
| 5186 | POST /api/vani/correlation-insight | bearer | user | user | no | views/CorrelationPage.tsx:509 (already Y) |
| 5271 | POST /api/vani/correlation-insight/clear-cache | none | user | admin | **yes** | — |
| 5279 | DELETE /api/vani/correlation-insight/{item_a}/{item_b}/{shape} | none | user | admin | no | CorrelationPage.tsx:800 |
| 5389 | GET /api/vani/intents | none | user | user | **yes** | — |
| 5399 | POST /api/vani/ask | none | user | user | no | hooks/useVaNiChat.ts:143,204; services/sectorRotation.ts:589; services/sectorLeadership.ts:19; VaNi/SectorCompanion.tsx:46; VaNi/MarketStructureCompanion.tsx:62 |
| 5766 | DELETE /api/vani/cache | none | user | admin | no | VaNi/VaNiMessage.tsx:99 (1b: hide the control for non-admins) |
| 5793 | POST /api/vani/warm-scanner-explainers | bearer | user | admin | **yes** | — |
| 5862 | POST /api/vani/warm-help-intents | bearer | user | admin | **yes** | — |
| 5941 | POST /api/vani/feedback | none | user | user | no | VaNi/VaNiFeedback.tsx:36 |

### Per-user data (already bearer; the `role` rule is the change)

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 5996 | GET /api/framework/{user_id} | bearer | user | user | no | stores/frameworkStore.ts:176 (Y) |
| 6064 | POST /api/framework/{user_id} | bearer | user | user | **yes** (store uses GET+PUT) | — |
| 6111 | PUT /api/framework/{user_id} | bearer | user | user | no | frameworkStore.ts:295 (Y) |
| 6190 | GET /api/bookmarks/{user_id} | bearer | user | user | no | services/bookmarks.ts:70 (Y) |
| 6222 | POST /api/bookmarks/{user_id} | bearer | user | user | no | bookmarks.ts:78 (Y) |
| 6286 | DELETE /api/bookmarks/{user_id}/{equity_id} | bearer | user | user | no | bookmarks.ts:88 (Y) |
| 6321 | PUT /api/bookmarks/{user_id}/{equity_id}/position | bearer | user | user | no | bookmarks.ts:60 (Y) |
| 6689 | POST /api/correlation/compute | bearer | user | user | no | hooks/useCorrelationResult.ts:68 (Y) |

### Admin, payments, custom index, landing

| line | route | now | 1a | 1b | dead | callers to migrate |
|---|---|---|---|---|---|---|
| 7239 | GET /api/admin/users | admin | user+admin (unchanged) | admin | no | services/adminUsers.ts:50 (Y) |
| 7273 | POST /api/admin/users/{user_id}/suspend | admin | admin | admin | no | adminUsers.ts:55 (Y) |
| 7305 | POST /api/admin/users/{user_id}/plan | admin | admin | admin | no | adminUsers.ts:61 (Y) |
| 7344 | POST /api/admin/users/{user_id}/extend | admin | admin | admin | no | adminUsers.ts:67 (Y) |
| 7384 | POST /api/admin/users/{user_id}/delete | admin | admin | admin | no | adminUsers.ts:73 (Y) |
| 7567 | POST /api/payments/create-subscription | bearer | user | user | **yes** | — |
| 7602 | POST /api/payments/create-order | bearer (+ `caller_id == req.user_id`) | user | user | no | services/razorpayService.ts:74 (Y) |
| 7603 | POST /api/payments/create-trial-order | bearer | user | user | **yes** (alias) | — |
| 7640 | POST /api/payments/webhook | HMAC | **signature** | signature | no | Razorpay (external) |
| 7723 | POST /api/payments/reconcile | bearer | user | user | no | razorpayService.ts:45 (Y) |
| 7998 | POST /api/custom-index/discover | none | user | admin | no | views/CustomIndexDiscoverPage.tsx:124 |
| 8139 | GET /api/custom-index/themes | none | user | admin | no | CustomIndexDiscoverPage.tsx:105 |
| 8174 | PATCH /api/custom-index/themes/{theme_id} | none | user | admin | no | CustomIndexDiscoverPage.tsx:175 |
| 8202 | POST /api/custom-index/{index_id}/compute | none | user | admin | no | CustomIndexPage.tsx:71, CustomIndexManagePage.tsx:208, CustomIndexCreatePage.tsx:158 |
| 8353 | DELETE /api/custom-index/{index_id} | none | user | admin | no | CustomIndexPage.tsx:116 |
| 8400 | POST /api/custom-index/{index_id}/suggest | none | user | admin | no | CustomIndexManagePage.tsx:230 |
| 8490 | POST /api/custom-index/target | none | user | admin | no | CustomIndexDiscoverPage.tsx:151 |
| 8867 | GET /api/landing/spotlight | none | **guest** (re-registered as `/api/guest/spotlight`; old path removed) | guest | no | views/landing/Spotlight.tsx:46 → guest client |
| 8873 | GET /api/landing/spotlight/reveal | bearer | user | user | no | services/spotlight.ts:39 (Y) |

Routes with the `admin` guard today keep it; "user+admin" means the `user`
decode rules apply first, then `_require_admin`.

New routes introduced by 1a (not in the 111): `POST /api/guest/token`
(issuer, rate-limited, no guard), `GET /api/guest/panchang/daily` (guest),
`GET /api/guest/spotlight` (guest, the moved 8867), `GET /internal/health`
(network-scoped, no guard).

---

## 3. Guest namespace

### 3.1 Endpoints the current landing page needs

The logged-out landing page (`/`, `App.tsx:109`) makes exactly two data calls
(audit §B.3). Both move under `/api/guest/` and **reuse the existing handler
function** — the guest route is a second registration of the same Python
callable with the `guest` dependency, not a copy.

| guest route | reuses | landing caller | notes |
|---|---|---|---|
| `GET /api/guest/panchang/daily?date=` | `panchang_daily` (`pipeline2_api.py:1145`) | `views/landing/AtmosphericCard.tsx:40` → `services/panchang.ts:7` | same query, same response shape; no user data in it |
| `GET /api/guest/spotlight` | `landing_spotlight` (`pipeline2_api.py:8867`) — the route moves here, the old `/api/landing/spotlight` path is removed | `views/landing/Spotlight.tsx:46` | the teaser only; `/api/landing/spotlight/reveal` stays a `user` route (it needs `sub`) |

Registration pattern (design, not code):

```
guest_router = APIRouter(prefix='/api/guest', dependencies=[Depends(require_guest)])
guest_router.add_api_route('/panchang/daily', panchang_daily, methods=['GET'])
guest_router.add_api_route('/spotlight',      landing_spotlight, methods=['GET'])
```

The handler signature is unchanged; the guest dependency is on the router, so
the callable never knows which door it was entered through. If a handler ever
needs the caller identity it is not a guest candidate.

### 3.2 Issuer: `POST /api/guest/token`

| item | spec |
|---|---|
| request | empty body; `Content-Type: application/json`; no auth |
| response `200` | `{ "token": "<jwt>", "expires_in": 900, "token_type": "Bearer" }` |
| claims | `role: "guest"`, `aud: "dristiq-guest"`, `sub: <random uuid4>`, `iat`, `exp = iat + 900`, `iss: "kaaladristi"` (matches `kd_generate_token`'s issuer so one verifier config serves both) |
| signature | HS256 with the existing `JWT_SECRET` (`lib/config.py:25`), the same value PostgREST holds as `PGRST_JWT_SECRET` |
| expiry | 15 minutes, fixed; no refresh endpoint — the client simply asks again |
| on failure | `429` with `Retry-After` when rate-limited; `503` if `JWT_SECRET` is unset (same behaviour as `lib/auth.py:37-38`) |

**Rate limit: nginx `limit_req`, not in-app.** Justification: the API runs as a
single uvicorn worker (`docker-compose.yml:60 --workers 1`) with a worker
subprocess and an APScheduler thread in-process; an in-app limiter would be
per-process state that resets on every restart, is invisible to the ops
dashboards, and would need Redis to survive the day 1b adds a second worker.
nginx already terminates every external request, already sees the real client
IP at the edge, and `limit_req` is one directive per config. Rule in
`nginx/dristiq-vps.conf` (edge) — the same block also goes into
`nginx/nginx.conf` so the in-image config matches:

```
limit_req_zone $binary_remote_addr zone=guest_token:1m rate=6r/m;
location = /api/guest/token {
    limit_req zone=guest_token burst=6 nodelay;
    limit_req_status 429;
    proxy_pass http://kd-pipeline-api2:8101;
    …same proxy_set_header lines as /api/…
}
```

6 per minute with burst 6: a landing visit needs one token per 15 minutes, a
reload storm gets six, and the 429 is served by nginx without touching the app.
`$binary_remote_addr` is the edge's view of the client; the container-level
nginx only ever sees the edge, so the zone is meaningful only at the edge —
that is where it must live.

### 3.3 Refreshing an expired guest token on the landing page

The guest client (§4) stores the token in **memory only** (a module variable,
not `localStorage` — a guest token is not a session and must not survive a
navigation to `/login`). Flow:

1. On first data call, if no token or `exp - now < 30s`, call
   `POST /api/guest/token`, store it, then send the data call.
2. On any `401` from a `/api/guest/*` route, discard the token, fetch a new one
   **once**, and retry the original request once. A second `401` surfaces as
   the component's normal error state (the landing cards already render
   without data).
3. On `429` from the issuer, back off for `Retry-After` seconds and show the
   no-data state; do not loop.

The 30-second pre-expiry margin means a card that mounts at minute 14:50 does
not fire a request that dies in flight.

### 3.4 Pattern for future guest endpoints (e.g. landing charts)

1. The data must already be served to logged-in users by an existing handler.
   If not, build the `user` route first; guest is a second door, never the
   first.
2. The handler must read no `sub`, no profile, no bookmarks, no ICP — nothing
   keyed on the caller. If it does, it is not guest material.
3. Register it on `guest_router` with `add_api_route(path, existing_handler)`.
   Do not copy the function.
4. Add the path to the guest client's allow-list (§4) so the app client never
   sends a session token there and the guest client never sends a guest token
   elsewhere.
5. Add one row to the table in §2 and one acceptance case to §7 (guest token
   passes, user token behaviour per §7.3, no token → 401).
6. Cost stays bounded by what the logged-in page already costs; if a landing
   chart would need a heavier query than the app page, that is a product
   question, not a guest-router question.

---

## 4. Frontend shared API client

One module, `services/apiClient.ts`, used for **every** call to FastAPI. Two
exported instances share one implementation:

| instance | token source | on 401 | base URL |
|---|---|---|---|
| `api` (app) | `useAuthStore.session.access_token` (the `kd_session` token `auth.ts:27-33` already stores) | drop the session (`authStore.signOut()` / clear `kd_session`), redirect to `/login?next=<current path>`; never retry | `VITE_PIPELINE_API_URL` (prod `""` → same origin; dev `/pipeline-api` via `vite.config.ts:24-28`) |
| `guestApi` (landing) | in-memory guest token from `POST /api/guest/token` (§3.3) | refetch the guest token once, retry once | same |

Rules the module enforces:

- Exactly one place builds `Authorization: Bearer …`. The seven `authHeaders()`
  copies and the two header-less helpers are deleted, not wrapped.
- `api` refuses to call `/api/guest/*`; `guestApi` refuses to call anything
  else. A wrong pairing throws at call time in dev and logs in prod, so a
  landing component cannot silently start using the session token.
- No `credentials: 'include'`; tokens travel in the header, CORS runs with
  `allow_credentials=False` and `allow_origins` = the production origin(s)
  plus `VITE_DEV_ORIGINS` (localhost) in dev.
- The client returns parsed JSON or throws a typed `ApiError { status, detail }`
  — the same contract `apiGet/apiPost` have today, so call sites change import
  and header handling only.
- `services/postgrest.ts` is **not** this module. It keeps its own
  `getAuthToken()` for `/db/`; the guest client never touches it.

### 4.1 Migration checklist — every FastAPI call site

Legend: **(N)** sends no token today, **(Y)** sends one via a local helper.
Every row moves to `api` unless marked `guestApi`.

**Helpers to retire (their call sites move with them):**

| helper | file:line | sites routed through it |
|---|---|---|
| `apiGet` / `apiPost` (N) | `services/pipeline2.ts:6,15` | pipeline2.ts:112, 118, 122, 129, 135, 143, 152, 155, 167, 173, 187, 202 |
| `apiGet` / `apiPost` copies (N) | `services/pipelineData.ts:83,92` | pipelineData.ts:106-143 — **all v1 paths, see §4.2**; the helper goes when they do |
| `postJson` (N) | `pages/RuleEngine/discoveryService.ts:34` | discoveryService.ts:48, 53, 58, 63, 69, 75, 80, 85, 90, 95 |
| `authHeaders()` (Y) | `services/bookmarks.ts:14` | bookmarks.ts:60, 70, 78, 88 |
| `authHeaders()` (Y) | `services/adminUsers.ts:13` (`req` at :37-39) | adminUsers.ts:50, 55, 61, 67, 73 |
| `authHeaders()` (Y) | `services/razorpayService.ts:6` | razorpayService.ts:45, 74 (and the unused :102 `startTrialCheckout`) |
| `authHeaders()` (Y) | `stores/frameworkStore.ts:14` | frameworkStore.ts:176, 295 |
| `authHeaders()` (Y) | `hooks/useCorrelationResult.ts:6` | useCorrelationResult.ts:68 |
| inline bearer (Y) | `views/CorrelationPage.tsx:513` | CorrelationPage.tsx:509 |
| inline bearer (Y) | `services/spotlight.ts:40` | spotlight.ts:39 (keeps its "no token → return early" short-circuit; the client's 401 handling replaces the manual check) |

**Inline `fetch(` call sites (N) — one edit each:**

| file | lines | route(s) |
|---|---|---|
| services/panchang.ts | 7, 34, 40, 46 | panchang/daily, confluence/heatmap, /historical, /timeline |
| services/panchangService.ts | 71, 86, 96, 105, 117 | panchang/calendar, notes ×3, generate |
| services/astro.ts | 8 | astro/transits |
| services/astroCalendar.ts | 84, 155, 165, 174 | panchang/week, astro/calendar ×3 |
| services/scanEngine.ts | 2508 | scan/presets |
| services/sectorLeadership.ts | 19 | vani/ask |
| services/sectorRotation.ts | 589 | vani/ask |
| services/vaniNarrate.ts | 12 | ai/vani-narrate |
| hooks/useBackendStatus.ts | 11 | pipeline2/ping (see §5) |
| hooks/useDashboardExtras.ts | 57, 71, 85, 105, 123, 139, 247, 265, 282, 300, 318 | ai/* |
| hooks/useIntraday.ts | 87, 94, 101 | panchang/daily, intraday/plan-score, astro/daily-signal |
| hooks/useScan.ts | 68 | scan/run/stage_2_leaders |
| hooks/useRuleInsight.ts | 17, 59 | ai/rule-insight, ai/active-rule-today |
| hooks/useVaNiChat.ts | 143, 204 | vani/ask |
| components/domain/DashboardV3/NakVaraSignals.tsx | 96 | panchang/daily |
| components/domain/DashboardV3/SixDayOutlookCompact.tsx | 89 | panchang/week |
| components/domain/DashboardV3/MarketWeatherCard.tsx | 569, 596 | dashboard/composite, /context |
| components/domain/DashboardV3/HistoricalContextCard.tsx | 27 | dashboard/context |
| components/domain/VaNi/SectorCompanion.tsx | 46 | vani/ask |
| components/domain/VaNi/MarketStructureCompanion.tsx | 62 | vani/ask |
| components/domain/VaNi/VaNiMessage.tsx | 99 | vani/cache DELETE |
| components/domain/VaNi/VaNiFeedback.tsx | 36 | vani/feedback |
| components/workspace/VaNiMorningBrief.tsx | 128, 215, 319, 626 | vani/daily, observation-cache DELETE ×3 |
| components/domain/JobMonitor.tsx | 20 | confidence/status |
| pages/RuleEngine/PatternStudyButton.tsx | 36, 57 | patterns/status, /run |
| pages/RuleEngine/RuleDetail.tsx | 212 | confidence/yearly |
| pages/RuleEngine/RuleInferenceModal.tsx | 86, 413, 437, 463 | rules inference ×4 |
| pages/RuleEngine/RuleInferencePanel.tsx | 52 | rules inference GET |
| views/CustomIndexDiscoverPage.tsx | 105, 124, 151, 175 | custom-index themes, discover, target, themes PATCH |
| views/CustomIndexPage.tsx | 71, 116 | custom-index compute, delete |
| views/CustomIndexManagePage.tsx | 208, 230 | custom-index compute, suggest |
| views/CustomIndexCreatePage.tsx | 158 | custom-index compute |
| views/CorrelationPage.tsx | 800 | correlation-insight DELETE |
| **views/landing/AtmosphericCard.tsx** | 40 (via panchang.ts:7) | → `guestApi` `/api/guest/panchang/daily` — give `fetchPanchang` a client parameter or a `fetchGuestPanchang` twin; the landing card must not import the app client |
| **views/landing/Spotlight.tsx** | 46 | → `guestApi` `/api/guest/spotlight` |

Totals: **72 inline sites + 24 sites behind the two token-less helpers + 16
sites behind the seven token helpers = 112 call sites, 10 helper definitions
retired.** Two of the 112 go to `guestApi`; the rest to `api`. Unmounted
components and unused hooks are migrated too — they are guarded in 1a and
deleted in 1b, and a stray un-migrated fetch would be the first thing to
break when someone mounts them.

QA harness (`frontend/scripts/qa/*.mjs`) seeds `kd_session` with a
JWT-shaped token that has no valid signature; in `enforce` mode those runs
will 401 on every FastAPI call they do not mock. Each harness must either
mock the FastAPI routes it touches (most already `page.route` them) or be run
against a stack in `audit` mode — see §7.9.

### 4.2 Dead v1-path call sites — remove in 1b

These call `/api/pipeline/*` or `/api/context/*` paths that only `pipeline_api.py`
(v1, port 8100, no nginx route) serves; through nginx they reach 8101 and 404
today. They are **not** migrated to the client; they are deleted in 1b.

| file | lines | path |
|---|---|---|
| services/pipelineData.ts | 106-143 (via :83/:92) | `/api/pipeline/*` |
| components/domain/DataHealthGrid.tsx | 420, 434, 484, 505, 532 | `/api/pipeline/fix` and siblings |
| components/domain/InstrumentIntelligence.tsx | 150 | `/api/context/instrument` |
| components/domain/MarketPulseCard.tsx | 123 | `/api/context/market-pulse` |
| components/domain/PipelineExecution.tsx | 235, 267 | `/api/pipeline/*` |
| components/domain/PipelineStatusDot.tsx | 26 | `/api/pipeline/*` |

---

## 5. Health check move

| consumer today | today | after 1a |
|---|---|---|
| `deploy.sh:48` — `curl localhost:8101/api/pipeline2/ping` after deploy | unauthenticated | `curl -fsS http://localhost:8101/internal/health` from the VPS shell (docker network / host loopback). `/internal/` has no `location` in `nginx/dristiq-vps.conf`, `nginx/nginx.conf` or `App/frontend/nginx.conf`, so it is unreachable through the edge; the handler is the existing `ping` body (`SELECT 1` + worker state) re-registered at the new path with no guard |
| `/opt/vikuna/rotate_jwt_secret.sh` — also calls `/api/pipeline2/ping` (per ops) | unauthenticated | **must finish its run before 1a deploys** in `enforce`; in `audit` it keeps working. After 1a it should call `/internal/health` too — its next edit, not 1a's |
| `hooks/useBackendStatus.ts:11` — the frontend "Backend offline" pill (`JobMonitor.tsx:47`, `RuleDetail.tsx:1230`) | unauthenticated `GET /api/pipeline2/ping` | **stays, as a `user` route** through the `api` client. It is rendered only behind `ProtectedRoute` (Layout), so a session always exists; a 401 there means the session is dead, which the client already handles by redirecting to login — which is exactly what "backend offline" should not mask. Keep the 15-second poll; the route is `SELECT 1` |

`GET /api/pipeline2/ping` therefore does not go away in 1a; it is the frontend's
liveness probe. `/internal/health` is the ops probe. They share one handler.

---

## 6. Safe rollout — `AUTH_MODE`

Env var on `kd-pipeline-api2` (`docker-compose.yml` environment block, sourced
from `App/.env`): `AUTH_MODE = off | audit | enforce`, default **`audit`** when
unset (a missing variable must not silently open the API).

| mode | guard outcome on failure | use |
|---|---|---|
| `off` | guards never run; request proceeds | emergency only; identical to today |
| `audit` | guard runs, failure is **logged** and the request proceeds | first deploy; the log is the migration checklist's truth |
| `enforce` | guard runs, failure → 401 | steady state |

Audit log line (one per failing request, structured, INFO level, its own logger
`auth.audit` so it can be grepped and shipped):

```
auth.audit route=GET /api/scan/presets guard=user reason=missing ip=<X-Forwarded-For first hop> caller=<hint>
```

`caller` hint = `Referer` path (which page fired it) or `User-Agent` class
(`browser` / `curl` / `python-requests`) — never the token, never a body. Reason
is one of `missing | invalid | expired | wrong_role | wrong_aud | bad_sub`
(`bad_sub`: a user token whose `sub` is absent or not a UUID).

Plan:

1. Ship backend (guards + issuer + `/internal/health` + `AUTH_MODE=audit`) and
   frontend (client + all §4.1 migrations + landing on guest) **together** —
   the frontend must send tokens before enforcement, and the backend must
   accept them in audit mode so nothing changes for users on day one.
2. Run 24–48 h in `audit`. Every `auth.audit` line with `reason=missing` from a
   `browser` caller on a mounted page is a missed call site; fix and redeploy
   the frontend. Lines from `curl`/`python-requests` are ops scripts to point
   at `/internal/health` or to give a session.
3. Confirm the rotation script has run and now targets `/internal/health`.
4. Switch `AUTH_MODE=enforce`, restart `kd-pipeline-api2`, run §7.
5. Rollback = `AUTH_MODE=audit` + restart. No schema, no frontend change needed
   to roll back, because the frontend sends tokens in both modes.

`AUTH_MODE` is read once at startup and shown on `/internal/health` so a deploy
can be checked without reading logs.

Review query for the 24–48 h audit window (run on the VPS; the API logs to
stdout at INFO, so the lines are in `docker logs`). It groups failures by
route, reason and caller, ignoring ops tools, so every remaining row is a call
site the frontend still sends without a token:

```bash
docker logs --since 48h kd-pipeline-api2 2>&1 \
  | grep -F 'auth.audit' \
  | grep -vE 'caller=(curl|python-requests)' \
  | sed -E 's/.*route=([A-Z]+ [^ ]+) guard=([a-z]+) reason=([a-z_]+) ip=[^ ]+ caller=(.*)/\1  \2  \3  \4/' \
  | sort | uniq -c | sort -rn
```

Read it as: `reason=missing` + `caller=page:/...` = a missed call site on that
page (fix the frontend, redeploy); `reason=wrong_role` on a `user` route = a
guest token reaching the app (the client's path assertion should make this
impossible — investigate); `reason=expired` from `page:/` = the landing page's
re-mint did not fire. The ops-tool lines the filter drops are the second query:

```bash
docker logs --since 48h kd-pipeline-api2 2>&1 | grep -F 'auth.audit' | grep -E 'caller=(curl|python-requests)' | sort | uniq -c
```

Any row there is a script to point at `/internal/health` or give a session
before `enforce`.

---

## 7. Acceptance tests (against the deployed stack, `AUTH_MODE=enforce`)

Script: `App/backend/scripts/auth_acceptance.py` (to be written in 1a; reads
`BASE_URL`, a user email/password, an admin email/password, `RAZORPAY_WEBHOOK_SECRET`
from env; prints one PASS/FAIL row per case; exits non-zero on any FAIL).

| # | case | expected |
|---|---|---|
| 1 | No token → every route in §2 except `POST /api/payments/webhook`, `POST /api/guest/token` | `401` on all 110 (the script walks the table with safe placeholder ids for path params; write routes are hit with an empty body and must 401 **before** validation — the guard dependency runs first) |
| 2 | Guest token on every `user` route (109) | `401 wrong_role`; a spot check that `GET /api/scan/presets` returns no body content beyond `detail` |
| 3 | User token on a guest route (`/api/guest/panchang/daily`, `/api/guest/spotlight`) | **`401 wrong_role`**. Defined behaviour: guest routes accept guest tokens only. The app never calls `/api/guest/*` (the client refuses, §4), so nothing legitimate is lost, and the symmetry keeps "which door am I at" unambiguous in the audit log |
| 4 | Guest token on PostgREST: `GET /db/km_equity_eod?limit=1`, `GET /db/km_profiles`, `POST /db/rpc/kd_result_returns` | **non-2xx, zero rows** on all three. Record the actual status and body; expected body carries `code 42704` / `role "guest" does not exist` (§1). The test asserts `status >= 400` and no data key |
| 5 | Webhook: valid HMAC over a `payment.captured` body with a test order → `200`; same body with one byte changed → `400`; no signature header → `400` | unchanged from today (`pipeline2_api.py:7640-7710`) |
| 6 | `/internal/health`: from the VPS shell `curl localhost:8101/internal/health` → `200` with `{"ok":true,"auth_mode":"enforce",...}`; from outside `curl https://dristiq.com/internal/health` → `404` (no nginx location; SPA fallback serves `index.html` for `/` only if the frontend nginx catches it — assert the body is not the health JSON) | reachable in-network only |
| 7 | Landing page logged out (Playwright, no `kd_session`): `/` renders, `AtmosphericCard` shows today's panchang, `Spotlight` teaser renders, the network log shows exactly one `POST /api/guest/token` (200) and the two guest GETs (200), and **zero** requests to non-guest `/api/*` | passes |
| 8 | Full logged-in flow (Playwright, real login via `kd_auth_login`): login → workspace loads (`GET /api/framework/{id}` 200, `GET /api/pipeline2/last-run` 200) → `/scan` (`GET /api/scan/presets` 200) → open a scanner companion (`POST /api/vani/ask` 200) → `/sector-rotation` leadership (`POST /api/vani/ask` `sector.leadership.context` 200) → `/rules/:id` (`GET /api/confidence/yearly/:id` 200) → account → pricing (`POST /api/payments/create-order` reaches Razorpay order creation) → logout → `/scan` redirects to `/login` | zero 401s in the network log while logged in; every `/api/` request carries a bearer |
| 9 | Existing QA harness: `npm run build` (theme + persona gates), `check-price-action-events.mjs`, `check-journey-events.mjs`, `check-sector-horizons.mjs`, `check-persona.mjs` (pure node, unaffected), and the Playwright checks that mock FastAPI (`check-scanner-vani.mjs`, `check-sector-ui.mjs`, `check-fpb-actions.mjs`, `qa-screenshots.mjs`, …) run **against a dev server pointed at an `audit`-mode backend or with their FastAPI routes mocked** | all green; any harness that hits a real `enforce` backend with its fake `kd_session` token is a harness bug to fix by mocking, not a reason to loosen a guard |
| 10 | Expired guest token (mint, wait 15 min or forge `exp` in the past with the real secret in the test) on `/api/guest/spotlight` | `401 expired`; the landing client re-mints and succeeds |
| 11 | Issuer rate limit: 13 rapid `POST /api/guest/token` from one IP | the first 12 (6 rate + 6 burst) `200`, then `429` with `Retry-After`, served by nginx |
| 12 | `AUTH_MODE=audit` regression: with the mode flipped back, case 1 returns `200` and the `auth.audit` log shows one line per request with `reason=missing` | rollback path proven |

---

## 8. Out of scope for 1a

- `admin` tightening (the 1b column in §2), including hiding the VaNi cache
  clear control from non-admins.
- Deleting the 27 dead routes and the §4.2 dead call sites.
- Master-data DB grants / RLS (`km_index_symbols`, `km_equity_symbols`,
  `km_index_constituents`, `km_astro_rule_master`, `dc_inference` admin-only
  writes) — `docs/security/hotfix-2026-09-26.md` follow-up 7.
- Tier / `paid` gating (Phase 2).
- Short-lived user tokens, refresh, `token_version` (1c). The 7-day session
  token is unchanged in 1a.
- Rate limits on LLM routes.
- `pipeline_api.py` (v1, 8100): not routed, not touched; goes with 1b's deletions.

---

## 9. Decisions (closed by the owner, 2026-09-27 — none open)

1. **PostgREST status for a guest token** is pinned by acceptance test §7.4;
   the contract requires non-2xx and zero data, whatever the numeric status.
2. **Guest `sub`** is a random UUID per token.
3. **`aud` on user tokens** is deferred to 1c. The `user` guard accepts `aud`
   absent or `'app'` and rejects any other value.
4. **1b targets:** `GET /api/pipeline2/last-run` stays `user`;
   `GET /api/pipeline2/ping` becomes `admin` (1b must then move the
   `useBackendStatus` pill to a `user`-safe probe or admin-gate it — not 1a).
5. **Rule Engine routes are classified by calling page.** `/rules` is
   `adminOnly` in the sidebar (`Sidebar.tsx:65`), so every route called only
   from `pages/RuleEngine/*` has 1b target `admin`. Routes reached from
   `Layout`-mounted or user components stay `user`: `discovery/status`,
   `discovery/cancel` and `confidence/status` (`JobMonitor`, mounted in
   `Layout.tsx:192` for every profile), `ai/rule-insight` and
   `ai/active-rule-today` (`RuleInsightCard`, `WorkspaceCanvas`,
   `OverlayExplainPopover`, `useConfluenceDetection`), and the three
   `confluence/*` routes (`MarketStructureView`, `ConfluenceDotGrid`). The
   §2 table reflects this.
6. **Guest issuer `limit_req`:** `6r/m` per IP, `burst=10`, `nodelay`.
7. **QA harness** keeps mocking FastAPI; the §7 acceptance tests use a real
   token minted through `kd_auth_login`.

Implementation record (Phase 1a build, same branch): backend guards in
`lib/auth.py` (`AUTH_MODE`, `route_guard`, `require_guest`, `mint_guest_token`),
the guest router and `/internal/health` in `pipeline2_api.py`, CORS from
`CORS_ORIGINS`, nginx `limit_req` in `nginx/dristiq-vps.conf`,
`nginx/nginx.conf` and `App/frontend/nginx.conf` (all three carry the issuer
`location` and the `/internal/` 404), `AUTH_MODE`/`CORS_ORIGINS` in
`docker-compose.yml` and `App/frontend/.env.example`, `deploy.sh` on
`/internal/health`, the frontend client in `services/apiClient.ts`, the
acceptance script `App/backend/scripts/auth_acceptance.py`, and the unit
suite `App/backend/test_auth_guards.py`.
