#!/usr/bin/env bash
# Phase 1a — post-deploy smoke test. Run on the VPS right after deploy.sh.
#
#   KD_USER_EMAIL=... KD_USER_PASSWORD=... scripts/smoke_after_deploy.sh [https://dristiq.com]
#
# Walks the request paths a real session takes, in order: the logged-out
# landing page (guest issuer + guest panchang), the login RPC, the workspace
# framework read with the real session token, scanner presets, a sector
# leadership VaNi ask, the pipeline health page, and the in-container
# /internal/health probe. Every step expects 200. ANY other status fails —
# a 5xx (backend up but broken), a 000 (nothing answered: nginx cannot reach
# the container, TLS, DNS) and a 401 (a guard rejecting a real token) are
# all failures, not just the last one. Exits non-zero on the first summary
# with a failure. Read-only against the database apart from the login RPC.
#
# Needs: curl, docker (for the in-container probe), an account whose
# password you know. No jq: JSON fields are pulled with sed.

set -u
BASE="${1:-https://dristiq.com}"
BASE="${BASE%/}"
USER_EMAIL="${KD_USER_EMAIL:-}"
USER_PASSWORD="${KD_USER_PASSWORD:-}"
TIMEOUT=20
fail=0
pass=0
body=/tmp/kd_smoke_body.$$
trap 'rm -f "$body"' EXIT

say()  { printf '  %-58s %s\n' "$1" "$2"; }
ok()   { pass=$((pass+1)); say "$1" "PASS  $2"; }
bad()  { fail=$((fail+1)); say "$1" "FAIL  $2"; }

# http METHOD URL [DATA] [BEARER] → sets $status, body in $body
http() {
  local method="$1" url="$2" data="${3:-}" token="${4:-}"
  local -a args=(-s -o "$body" -w '%{http_code}' -m "$TIMEOUT" -X "$method" "$url" -H 'Accept: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ]  && args+=(-H 'Content-Type: application/json' --data "$data")
  status="$(curl "${args[@]}" 2>/dev/null || echo 000)"
}

# check LABEL → PASS when $status is 200, else FAIL with a reason class
check() {
  local label="$1"
  case "$status" in
    200) ok "$label" "200" ;;
    000) bad "$label" "000 no response (nginx → container? TLS? DNS?)" ;;
    5*)  bad "$label" "$status server error: $(head -c 160 "$body" | tr '\n' ' ')" ;;
    401) bad "$label" "401 rejected a real token: $(head -c 160 "$body" | tr '\n' ' ')" ;;
    *)   bad "$label" "$status: $(head -c 160 "$body" | tr '\n' ' ')" ;;
  esac
  [ "$status" = 200 ]
}

field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$body" | head -1; }

echo "Phase 1a smoke — $BASE"

# ── 1. Landing page, logged out: guest issuer + guest panchang ────────────
http POST "$BASE/api/guest/token"
guest=""
if check "1a POST /api/guest/token"; then
  guest="$(field token)"
  [ -n "$guest" ] || bad "1a guest token present in body" "empty"
fi
http GET "$BASE/api/guest/panchang/daily" "" "$guest"
check "1b GET /api/guest/panchang/daily (guest token)"
http GET "$BASE/api/guest/spotlight" "" "$guest"
check "1c GET /api/guest/spotlight (guest token)"

# ── 2. Login RPC on PostgREST ─────────────────────────────────────────────
token=""; uid=""
if [ -z "$USER_EMAIL" ] || [ -z "$USER_PASSWORD" ]; then
  bad "2  POST /db/rpc/kd_auth_login" "KD_USER_EMAIL / KD_USER_PASSWORD not set"
else
  http POST "$BASE/db/rpc/kd_auth_login" "{\"p_email\":\"$USER_EMAIL\",\"p_password\":\"$USER_PASSWORD\"}"
  if check "2  POST /db/rpc/kd_auth_login"; then
    token="$(field access_token)"
    uid="$(field id)"
    if [ -z "$token" ] || [ -z "$uid" ]; then
      bad "2  login returned a session" "no access_token/user id: $(head -c 160 "$body")"
    fi
  fi
fi

# ── 3–6. Logged-in paths with the real session token ──────────────────────
if [ -n "$token" ]; then
  http GET "$BASE/api/framework/$uid" "" "$token"
  check "3  GET /api/framework/{user_id} (workspace)"

  http GET "$BASE/api/scan/presets" "" "$token"
  check "4  GET /api/scan/presets (scanner)"

  today="$(date +%Y-%m-%d)"
  http POST "$BASE/api/vani/ask" \
    "{\"intent_id\":\"sector.leadership.context\",\"sector_category\":\"sectoral\",\"date\":\"$today\",\"leadership_months\":6}" "$token"
  check "5  POST /api/vani/ask sector.leadership.context"

  http GET "$BASE/api/pipeline2/health" "" "$token"
  check "6  GET /api/pipeline2/health (pipeline dashboard)"

  http GET "$BASE/api/pipeline2/ping" "" "$token"
  check "6b GET /api/pipeline2/ping (backend-status pill)"
else
  bad "3–6 logged-in paths" "skipped: no session token"
fi

# ── 7. Edge must NOT serve the ops probe; the container must ─────────────
http GET "$BASE/internal/health"
if [ "$status" = 200 ] && grep -q '"auth_mode"' "$body"; then
  bad "7a /internal/health via edge is hidden" "served the health JSON"
elif [ "$status" = 000 ]; then
  bad "7a /internal/health via edge is hidden" "000 no response"
else
  ok "7a /internal/health via edge is hidden" "$status"
fi

if command -v docker >/dev/null 2>&1; then
  hj="$(docker exec kd-pipeline-api2 python -c 'import json,sys,urllib.request as u
r=u.urlopen("http://127.0.0.1:8101/internal/health",timeout=5); b=r.read().decode(); print(b)
sys.exit(0 if r.status==200 and json.loads(b).get("ok") is True else 1)' 2>/dev/null)"
  if [ $? -eq 0 ]; then
    mode="$(printf '%s' "$hj" | sed -n 's/.*"auth_mode":"\([^"]*\)".*/\1/p')"
    ok "7b /internal/health in-container" "ok auth_mode=$mode"
  else
    bad "7b /internal/health in-container" "docker exec probe failed"
  fi
else
  bad "7b /internal/health in-container" "docker not on PATH — run this on the VPS"
fi

echo
echo "smoke: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
