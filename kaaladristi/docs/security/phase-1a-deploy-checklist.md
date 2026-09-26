# Phase 1a — deploy checklist

Contract: `.claude/skills/api-auth-contract/SKILL.md`. Branch:
`claude/wizardly-shannon-94im9e`, rebased onto `main` after the auth hotfix
(`4ad4461`). Everything below runs on the VPS from
`/opt/vikuna/apps/kaaladristi/kaaladristi` unless it says otherwise.

What ships: every FastAPI route guarded (`AUTH_MODE=audit` — failures are
logged, nothing is rejected yet), the `/api/guest/*` namespace and its issuer,
`/internal/health`, CORS from `CORS_ORIGINS`, the frontend on one shared API
client, and the edge nginx moved to dynamic upstream resolution with the
issuer rate limit and the `/internal/` 404.

The JWT-secret rotation is **done** (26 Sep, 12:05 IST). Nothing here waits on
it. The old `rotate_jwt_secret.sh` reference to `/api/pipeline2/ping` is a
future edit of that script, not a precondition of this deploy.

---

## 1. Pre-deploy

Tick all five before starting. Each is a minute.

- [ ] **`km_jobs` is idle.** No `running`/`queued` job, and not inside the
  scheduler window (12:30–19:30 IST). A restart mid-job leaves that job
  stuck in `running` with no worker.

  ```sql
  SELECT status, count(*) FROM km_jobs
   WHERE status IN ('queued','running') GROUP BY 1;
  -- expect zero rows
  ```

- [ ] **`CORS_ORIGINS` lists every production origin.** The edge serves
  `server_name dristiq.com www.dristiq.com` (both blocks in
  `nginx/dristiq-vps.conf`), and port 80 redirects both to
  `https://dristiq.com`. A user who typed `www.` lands on the apex, so today
  only `https://dristiq.com` originates browser requests — but `www` is
  served on 443 too, so it stays in the list. Set in `App/.env`:

  ```
  CORS_ORIGINS=https://dristiq.com,https://www.dristiq.com
  ```

  (This is also the compose default when the variable is unset. Any other
  origin that will call the API — a staging host, a phone-testing tunnel —
  goes in here now, comma-separated, or its calls fail CORS preflight.)

- [ ] **`AUTH_MODE=audit`** in `App/.env` (also the compose default). Confirm
  the value is not `enforce` — that is step 5, after the audit window.

  ```bash
  grep -E '^(AUTH_MODE|CORS_ORIGINS)=' App/.env
  ```

- [ ] **The new edge conf passes `nginx -t` against the live nginx** BEFORE
  it replaces the old one. The edge nginx is shared with other Vikuna apps; a
  bad reload takes all of them down. Keep the previous conf for rollback.

  ```bash
  NG=/opt/vikuna/docker/docker/config/nginx/conf.d
  cp $NG/dristiq.conf $NG/dristiq.conf.pre-1a          # rollback copy
  cp nginx/dristiq-vps.conf $NG/dristiq.conf.staged
  docker exec vikuna-nginx nginx -t                     # tests the LIVE set (still the old conf)
  ```

  `nginx -t` only reads what is in `conf.d/`; the staged copy is inert until
  step 2c renames it. Also confirm the resolver and the container names the
  new conf resolves through Docker DNS:

  ```bash
  docker exec vikuna-nginx getent hosts kd-pipeline-api2 vikuna-postgrest kd-frontend
  ```

- [ ] **Backend image has no curl/wget** (`python:3.11-slim`) — that is why
  the health probe in `deploy.sh` and the acceptance script runs
  `docker exec kd-pipeline-api2 python -c …`. Nothing to do; just do not
  "fix" it back to `curl localhost:8101`, which cannot work: port 8101 is
  not published to the host.

## 2. Deploy order

Backend and frontend go together (the frontend starts sending bearer tokens
the backend must accept, and the landing page needs the guest issuer). The
nginx conf goes last, because its `/internal/` 404 and issuer rate limit
refer to routes that must already exist.

```bash
cd /opt/vikuna/apps/kaaladristi/kaaladristi

# a. code — deploy.sh pulls main; if 1a is not on main yet, check the branch out first
git fetch origin && git checkout claude/wizardly-shannon-94im9e && git pull
export VITE_BUILD_SHA="$(git rev-parse --short HEAD)"

# b. backend + frontend together (this is what deploy.sh does in steps 4–5)
docker compose --env-file App/.env build pipeline-api2 kd-frontend
docker compose --env-file App/.env up -d pipeline-api2 kd-frontend

# c. the in-container probe (deploy.sh step 7 does the same)
docker exec kd-pipeline-api2 python -c 'import json,urllib.request as u; print(u.urlopen("http://127.0.0.1:8101/internal/health",timeout=5).read().decode())'
#    expect {"ok": true, ..., "auth_mode": "audit"}

# d. edge nginx: swap in the new conf, test, reload — never reload on a failed -t
NG=/opt/vikuna/docker/docker/config/nginx/conf.d
mv $NG/dristiq.conf.staged $NG/dristiq.conf
docker exec vikuna-nginx nginx -t && docker exec vikuna-nginx nginx -s reload
```

If `nginx -t` fails at (d): `cp $NG/dristiq.conf.pre-1a $NG/dristiq.conf`,
re-run `nginx -t`, do NOT reload until it passes. The app keeps working on
the old conf meanwhile (the old conf resolves container names at load, so
it is the recreated containers at (b) that make the reload matter — get to
a passing `-t` promptly).

## 3. Post-deploy smoke — `scripts/smoke_after_deploy.sh`

```bash
KD_USER_EMAIL=<an account you own> KD_USER_PASSWORD=<its password> \
  scripts/smoke_after_deploy.sh https://dristiq.com
```

Walks: guest issuer → guest panchang and spotlight → `kd_auth_login` →
`/api/framework/{id}` → `/api/scan/presets` → `POST /api/vani/ask`
(`sector.leadership.context`) → `/api/pipeline2/health` and `ping` → the
edge must NOT serve `/internal/health` → the in-container probe must. Every
step expects 200; **any 5xx, 000 or 401 is a failure**, and the script exits
non-zero. A 000 means nginx could not reach the container (the case the
dynamic resolver exists for); a 5xx means the container is up and broken;
a 401 in audit mode means a guard is rejecting instead of logging — check
`auth_mode` in the probe output.

Then the acceptance script in **audit** expectation (it proves the audit
rollback path, case 12, and everything that does not depend on enforcement):

```bash
cd App/backend
BASE_URL=https://dristiq.com KD_USER_EMAIL=… KD_USER_PASSWORD=… \
  RAZORPAY_WEBHOOK_SECRET=… python scripts/auth_acceptance.py --expect-mode audit
```

## 4. Manual click-through (replaces the Playwright checks that could not run here)

The QA harness scripts that mock FastAPI need Chrome and were not run in the
build container. Do these in a real browser, logged out first, then logged in.
Keep DevTools → Network open with the filter `/api/`.

Logged out (private window, no `kd_session`):

- [ ] `/` renders; the panchang card and the Spotlight teaser show data.
  Network: exactly one `POST /api/guest/token` (200), then
  `GET /api/guest/panchang/daily` and `GET /api/guest/spotlight` (200), and
  **no** request to any other `/api/*` path.
- [ ] Reload after 15+ minutes on the page (or set the clock forward): the
  cards still render and a second `POST /api/guest/token` appears.
- [ ] Paste a pre-rotation `kd_session` into localStorage and reload: land on
  `/login` with the key gone (the auth hotfix, already on main).

Logged in:

- [ ] Login → `/workspace`: `GET /api/framework/{id}` 200,
  `GET /api/pipeline2/last-run` 200; every `/api/` request carries
  `Authorization: Bearer`.
- [ ] `/scanner` → category strip loads (`GET /api/scan/presets` 200); open a
  Studio preset (Stage 2 Leaders) and its companion panel answers
  (`POST /api/vani/ask` 200).
- [ ] `/market-structure` → companion default reading appears.
- [ ] `/sector-rotation` → Current Flow table, then Longer-Term Leadership
  tab (`sector.leadership.context` 200).
- [ ] `/chart/equity/599` (IPCALAB) → chart, Thesis tab narrate button.
- [ ] `/account` → Plan & Billing → "Upgrade" reaches the Razorpay modal
  (`POST /api/payments/create-order` 200). Close it; do not pay.
- [ ] Admin account: `/data-pipeline` dashboard loads (`/api/pipeline2/health`
  200, jobs list); `/users` loads (`GET /api/admin/users` 200).
- [ ] Sign out → `/scanner` redirects to `/login`.
- [ ] Phone width (390px, DevTools device toolbar): `/workspace` and
  `/scanner` render with no horizontal scroll.

Zero 401s in the network log while logged in. If one appears, note the
path — it is a call site the client migration missed, and the audit log
below will show it too.

## 5. 24–48 h audit review

The API logs to stdout at INFO, so the `auth.audit` lines are in
`docker logs`. This is the SKILL.md §6 query, grouped by route, reason and
caller with ops tools filtered out, so every remaining row is a request the
frontend sent without a valid token:

```bash
docker logs --since 48h kd-pipeline-api2 2>&1 \
  | grep -F 'auth.audit' \
  | grep -vE 'caller=(curl|python-requests)' \
  | sed -E 's/.*route=([A-Z]+ [^ ]+) guard=([a-z]+) reason=([a-z_]+) ip=[^ ]+ caller=(.*)/\1  \2  \3  \4/' \
  | sort | uniq -c | sort -rn
```

Read it as: `missing` + `caller=page:/...` = a missed call site on that page
(fix the frontend, redeploy kd-frontend only); `wrong_role` on a `user`
route = a guest token reaching the app (should be impossible — investigate);
`expired` from `page:/` = the landing re-mint did not fire; `bad_sub` /
`invalid` = something sending a non-app token — find the caller.

The ops-tool lines the filter drops:

```bash
docker logs --since 48h kd-pipeline-api2 2>&1 | grep -F 'auth.audit' | grep -E 'caller=(curl|python-requests)' | sort | uniq -c
```

Any row there is a script to point at `/internal/health` (via `docker exec`)
or to give a session before enforcement. The rotation script is the known
one.

**Exit criterion for enforcement:** 24 h with zero `reason=missing` rows from
a `page:` caller on a mounted page. Then, in `App/.env`,
`AUTH_MODE=enforce`, `docker compose --env-file App/.env up -d pipeline-api2`
(restart only, no rebuild), re-run the smoke script, then
`auth_acceptance.py --expect-mode enforce`.

## 6. Rollback

Three independent levers, in the order that costs least. Each is complete
on its own; take only as many as the symptom needs.

1. **Guards** (a 401 hitting real users after enforcement): `AUTH_MODE=off`
   in `App/.env`, `docker compose --env-file App/.env up -d pipeline-api2`.
   No rebuild; guards never run. The frontend keeps sending tokens, which
   `off` ignores. `audit` is the softer setting if you only want the
   logging back.
2. **Code** (something broken in the backend or the bundle): redeploy the
   previous commit — `git checkout main` at the pre-1a commit (`4ad4461`,
   the auth hotfix) and re-run steps 2a–2c. The pre-1a frontend calls
   `/api/landing/spotlight` and unauthenticated `/api/pipeline2/ping`, which
   the pre-1a backend still serves, so the pair must move together.
3. **Edge** (502s, or `/db/` paths wrong after the conf swap):
   `cp $NG/dristiq.conf.pre-1a $NG/dristiq.conf`, then
   `docker exec vikuna-nginx nginx -t && docker exec vikuna-nginx nginx -s reload`.
   The old conf has no `limit_req` and no `/internal/` 404; with the 1a
   backend still up that only means the issuer is unthrottled and
   `/internal/health` would be proxied if asked — acceptable for the time
   it takes to fix the conf. Note the old conf resolves upstreams at load,
   so it must be reloaded again after any container recreate.

None of the three needs a schema change; no migration is part of 1a.
