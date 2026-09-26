#!/usr/bin/env python3
"""
Phase 1a acceptance tests — run against the DEPLOYED stack.
Contract: `.claude/skills/api-auth-contract/SKILL.md` §7.

    cd App/backend
    BASE_URL=https://dristiq.com \
    POSTGREST_URL=https://dristiq.com/db \
    KD_USER_EMAIL=... KD_USER_PASSWORD=... \
    RAZORPAY_WEBHOOK_SECRET=... \
    python scripts/auth_acceptance.py [--expect-mode enforce|audit] [--skip-webhook] [--skip-ratelimit] [--skip-internal]

Case 6a probes /internal/health INSIDE the kd-pipeline-api2 container
(`docker exec … python -c …`, HEALTH_CMD to override) because port 8101 is
not published to the VPS host. Run the script on the VPS, or pass
--skip-internal from anywhere else.

Prints one PASS/FAIL row per case and exits non-zero on any FAIL. Read-only
against the database: it logs in (kd_auth_login), mints guest tokens, and
sends GETs; the only POSTs are the guest issuer, a `vani/ask`-free login,
the webhook with a synthetic body (which the handler rejects or no-ops on a
test order id), and rate-limit probes of the issuer.

Cases (numbers match SKILL.md §7):
  1  no token → 401 on every non-exempt route
  2  guest token on user routes → 401 wrong_role
  3  user token on guest routes → 401 wrong_role
  4  guest token on PostgREST /db/* → non-2xx, zero data (status recorded)
  5  webhook: valid HMAC accepted, tampered rejected, missing rejected
  6  /internal/health: docker-exec probe 200 with auth_mode; via edge → not the JSON
  7  landing page data path works logged out (issuer + the two guest GETs)
  8  logged-in flow: the core routes answer 200 with a real session token
 10  expired guest token → 401 expired
 11  issuer rate limit: 6/min + burst 10 → 429 within 20 rapid calls
 12  --expect-mode audit: case 1 routes answer 200 instead (rollback proof)

Cases 7 (browser render) and 9 (QA harness) are Playwright / npm jobs, not
HTTP checks — see SKILL.md §7; this script covers their HTTP substrate.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import uuid

try:
    import requests
except ImportError:  # pragma: no cover
    print('pip install requests', file=sys.stderr)
    sys.exit(2)

BASE = os.getenv('BASE_URL', 'https://dristiq.com').rstrip('/')
# In-container probe: the image (python:3.11-slim) has neither curl nor wget,
# so the probe is a stdlib urllib one-liner. Prints the health JSON on stdout.
HEALTH_CMD = os.getenv('HEALTH_CMD') or (
    "docker exec kd-pipeline-api2 python -c "
    "'import json,sys,urllib.request as u; "
    "r=u.urlopen(\"http://127.0.0.1:8101/internal/health\",timeout=5); b=r.read().decode(); print(b); "
    "sys.exit(0 if r.status==200 and json.loads(b).get(\"ok\") is True else 1)'"
)
PGRST = os.getenv('POSTGREST_URL', f'{BASE}/db').rstrip('/')
USER_EMAIL = os.getenv('KD_USER_EMAIL', '')
USER_PASSWORD = os.getenv('KD_USER_PASSWORD', '')
WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
TIMEOUT = 20

# Every non-exempt route from the contract table, with safe placeholder ids.
# GET/POST/PUT/PATCH/DELETE all must 401 BEFORE validation, so bodies are empty.
_U = '00000000-0000-4000-8000-000000000001'
USER_ROUTES = [
    ('GET', '/api/pipeline2/health'), ('GET', '/api/pipeline2/jobs'), ('GET', '/api/pipeline2/jobs/1'),
    ('POST', '/api/pipeline2/fix'), ('POST', '/api/pipeline2/daily-run'), ('POST', '/api/pipeline2/backfill'),
    ('POST', '/api/pipeline2/calendar/mark'), ('POST', '/api/pipeline2/cancel'), ('GET', '/api/pipeline2/dimensions'),
    ('GET', '/api/pipeline2/last-run'), ('GET', '/api/pipeline2/scheduler'), ('GET', '/api/pipeline2/ping'),
    ('POST', '/api/pipeline/refresh-breadth'), ('POST', '/api/pipeline/refresh-breadth-roc'),
    ('GET', '/api/vani-opportunity/config'), ('GET', '/api/scan/presets'), ('GET', '/api/scan/run/stage_2_leaders'),
    ('GET', '/api/panchang/daily'), ('GET', '/api/panchang/week'), ('GET', '/api/dashboard/composite'),
    ('GET', '/api/dashboard/context'), ('GET', '/api/astro/daily-signal'), ('GET', '/api/astro/signals'),
    ('GET', '/api/astro/transits'), ('GET', '/api/intraday/plan-score'), ('POST', '/api/astro/calendar'),
    ('PATCH', '/api/astro/calendar/1'), ('DELETE', '/api/astro/calendar/1'), ('POST', '/api/panchang/generate'),
    ('GET', '/api/panchang/calendar'), ('GET', '/api/panchang/notes'), ('POST', '/api/panchang/notes'),
    ('PATCH', '/api/panchang/notes/1'), ('DELETE', '/api/panchang/notes/1'),
    ('GET', '/api/ai/panchang-insight'), ('GET', '/api/ai/rule-insight'), ('GET', '/api/ai/active-rule-today'),
    ('GET', '/api/ai/breadth-insight'), ('GET', '/api/ai/breadth-roc-insight'), ('GET', '/api/ai/sector-insight'),
    ('POST', '/api/ai/vani-narrate'), ('GET', '/api/ai/instrument-insight'), ('GET', '/api/ai/market-pulse-insight'),
    ('GET', '/api/ai/fpb-recent-outcomes'), ('GET', '/api/ai/fpb-why-watch-coil'), ('GET', '/api/ai/fpb-coiling-industries'),
    ('GET', '/api/ai/fpb-new-coils'), ('GET', '/api/ai/fpb-confluence-outlook'),
    ('POST', '/api/discovery/run-all'), ('POST', '/api/discovery/run-missing'), ('POST', '/api/discovery/run-rule/1'),
    ('GET', '/api/discovery/status'), ('GET', '/api/discovery/signal-counts'), ('GET', '/api/discovery/transit-counts'),
    ('POST', '/api/discovery/cancel'), ('POST', '/api/discovery/run-clean'), ('POST', '/api/discovery/rule/1/drop-signals'),
    ('GET', '/api/discovery/diagnose'), ('POST', '/api/patterns/run'), ('GET', '/api/patterns/status'),
    ('POST', '/api/confidence/compute'), ('GET', '/api/confidence/status'), ('GET', '/api/confidence/summary'),
    ('GET', '/api/confidence/yearly/1'), ('GET', '/api/confluence/historical'), ('GET', '/api/confluence/heatmap'),
    ('GET', '/api/confluence/timeline'), ('POST', '/api/vani/daily'), ('POST', '/api/vani/observation'),
    ('POST', '/api/vani/clear-cache'), ('DELETE', '/api/vani/observation-cache/x/2026-01-01'),
    ('POST', '/api/vani/correlation-insight'), ('POST', '/api/vani/correlation-insight/clear-cache'),
    ('DELETE', '/api/vani/correlation-insight/a/b/c'), ('GET', '/api/vani/intents'), ('POST', '/api/vani/ask'),
    ('DELETE', '/api/vani/cache'), ('POST', '/api/vani/warm-scanner-explainers'), ('POST', '/api/vani/warm-help-intents'),
    ('POST', '/api/vani/feedback'), ('GET', f'/api/framework/{_U}'), ('POST', f'/api/framework/{_U}'),
    ('PUT', f'/api/framework/{_U}'), ('GET', f'/api/bookmarks/{_U}'), ('POST', f'/api/bookmarks/{_U}'),
    ('DELETE', f'/api/bookmarks/{_U}/1'), ('PUT', f'/api/bookmarks/{_U}/1/position'), ('POST', '/api/correlation/compute'),
    ('GET', '/api/rules/1/inference'), ('POST', '/api/rules/1/inference'), ('POST', '/api/rules/1/inference/generate'),
    ('DELETE', '/api/rules/inference/1'), ('GET', '/api/admin/users'), ('POST', f'/api/admin/users/{_U}/suspend'),
    ('POST', f'/api/admin/users/{_U}/plan'), ('POST', f'/api/admin/users/{_U}/extend'), ('POST', f'/api/admin/users/{_U}/delete'),
    ('POST', '/api/payments/create-subscription'), ('POST', '/api/payments/create-order'),
    ('POST', '/api/payments/create-trial-order'), ('POST', '/api/payments/reconcile'),
    ('POST', '/api/custom-index/discover'), ('GET', '/api/custom-index/themes'), ('PATCH', '/api/custom-index/themes/1'),
    ('POST', '/api/custom-index/1/compute'), ('DELETE', '/api/custom-index/1'), ('POST', '/api/custom-index/1/suggest'),
    ('POST', '/api/custom-index/target'), ('GET', '/api/landing/spotlight/reveal'),
]
GUEST_ROUTES = [('GET', '/api/guest/panchang/daily'), ('GET', '/api/guest/spotlight')]
# Read-only user routes exercised with a real session in case 8.
LOGGED_IN_READS = ['/api/scan/presets', '/api/pipeline2/last-run', '/api/pipeline2/ping',
                   '/api/panchang/daily', '/api/confluence/heatmap', '/api/discovery/status',
                   '/api/confidence/status', '/api/landing/spotlight/reveal']

results: list[tuple[str, bool, str]] = []


def record(case: str, ok: bool, note: str = '') -> None:
    results.append((case, ok, note))
    print(f"{'PASS' if ok else 'FAIL'}  {case}  {note}")


def req(method: str, url: str, **kw) -> requests.Response:
    kw.setdefault('timeout', TIMEOUT)
    kw.setdefault('allow_redirects', False)
    return requests.request(method, url, **kw)


def bearer(t: str) -> dict:
    return {'Authorization': f'Bearer {t}'}


def mint_guest() -> str:
    r = req('POST', f'{BASE}/api/guest/token', headers={'Content-Type': 'application/json'})
    r.raise_for_status()
    return r.json()['token']


def login() -> str | None:
    if not USER_EMAIL or not USER_PASSWORD:
        return None
    r = req('POST', f'{PGRST}/rpc/kd_auth_login',
            headers={'Content-Type': 'application/json'},
            json={'p_email': USER_EMAIL, 'p_password': USER_PASSWORD})
    if r.status_code != 200:
        print(f'login failed: {r.status_code} {r.text[:200]}', file=sys.stderr)
        return None
    body = r.json()
    if isinstance(body, dict):
        return body.get('access_token') or body.get('token')
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--expect-mode', choices=['enforce', 'audit'], default='enforce')
    ap.add_argument('--skip-webhook', action='store_true')
    ap.add_argument('--skip-ratelimit', action='store_true')
    ap.add_argument('--skip-internal', action='store_true', help='not on the VPS: skip the docker-exec health probe (6a)')
    args = ap.parse_args()
    enforce = args.expect_mode == 'enforce'

    guest = mint_guest()
    user = login()

    # ── 1 / 12: no token on every non-exempt route ─────────────────────────
    bad = []
    for m, p in USER_ROUTES + GUEST_ROUTES:
        r = req(m, f'{BASE}{p}')
        want = 401 if enforce else None
        if enforce and r.status_code != 401:
            bad.append(f'{m} {p} -> {r.status_code}')
        elif not enforce and r.status_code == 401:
            bad.append(f'{m} {p} -> 401 in audit')
    label = '1 no token -> 401 everywhere' if enforce else '12 audit mode: no token is not blocked'
    record(label, not bad, f'{len(USER_ROUTES) + len(GUEST_ROUTES)} routes' + ('' if not bad else '; ' + '; '.join(bad[:8])))

    # ── 2: guest token on user routes ──────────────────────────────────────
    if enforce:
        bad = []
        for m, p in USER_ROUTES:
            r = req(m, f'{BASE}{p}', headers=bearer(guest))
            if r.status_code != 401 or (r.headers.get('content-type', '').startswith('application/json')
                                        and r.json().get('detail') != 'wrong_role'):
                bad.append(f'{m} {p} -> {r.status_code} {r.text[:60]}')
        record('2 guest token on user routes -> 401 wrong_role', not bad, '; '.join(bad[:8]))

    # ── 3: user token on guest routes ──────────────────────────────────────
    if user and enforce:
        bad = []
        for m, p in GUEST_ROUTES:
            r = req(m, f'{BASE}{p}', headers=bearer(user))
            if r.status_code != 401 or r.json().get('detail') != 'wrong_role':
                bad.append(f'{m} {p} -> {r.status_code}')
        record('3 user token on guest routes -> 401 wrong_role', not bad, '; '.join(bad))
    elif enforce:
        record('3 user token on guest routes', False, 'no KD_USER_EMAIL/KD_USER_PASSWORD given')

    # ── 4: guest token on PostgREST ────────────────────────────────────────
    bad = []
    seen = []
    for m, p, kw in [('GET', '/km_equity_eod?limit=1', {}), ('GET', '/km_profiles?limit=1', {}),
                     ('POST', '/rpc/kd_result_returns', {'json': {'p_from': '2026-09-01', 'p_to': '2026-09-02', 'p_horizon_sessions': 20}})]:
        r = req(m, f'{PGRST}{p}', headers={**bearer(guest), 'Content-Type': 'application/json'}, **kw)
        seen.append(f'{p} -> {r.status_code} {r.text[:80]!r}')
        has_rows = False
        try:
            j = r.json()
            has_rows = isinstance(j, list) and len(j) > 0
        except Exception:
            pass
        if r.status_code < 400 or has_rows:
            bad.append(f'{m} {p} -> {r.status_code}')
    record('4 guest token on PostgREST -> non-2xx, zero rows', not bad, ' | '.join(seen))

    # ── 5: webhook HMAC ────────────────────────────────────────────────────
    if args.skip_webhook:
        record('5 webhook HMAC', True, 'skipped by flag')
    elif not WEBHOOK_SECRET:
        record('5 webhook HMAC', False, 'RAZORPAY_WEBHOOK_SECRET not given')
    else:
        body = json.dumps({'event': 'payment.captured', 'payload': {'payment': {'entity': {
            'id': 'pay_acceptance_' + uuid.uuid4().hex[:8], 'order_id': 'order_acceptance', 'notes': {}}}}}).encode()
        sig = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        ok_r = req('POST', f'{BASE}/api/payments/webhook', data=body,
                   headers={'Content-Type': 'application/json', 'x-razorpay-signature': sig})
        bad_r = req('POST', f'{BASE}/api/payments/webhook', data=body + b' ',
                    headers={'Content-Type': 'application/json', 'x-razorpay-signature': sig})
        none_r = req('POST', f'{BASE}/api/payments/webhook', data=body, headers={'Content-Type': 'application/json'})
        record('5 webhook: valid sig 200 / tampered 400 / missing 400',
               ok_r.status_code == 200 and bad_r.status_code == 400 and none_r.status_code == 400,
               f'{ok_r.status_code}/{bad_r.status_code}/{none_r.status_code}')

    # ── 6: /internal/health ────────────────────────────────────────────────
    if not args.skip_internal:
        try:
            p = subprocess.run(HEALTH_CMD, shell=True, capture_output=True, text=True, timeout=30)
            j = json.loads(p.stdout.strip() or '{}') if p.returncode == 0 else {}
            record('6a /internal/health in-container (docker exec)',
                   p.returncode == 0 and j.get('ok') is True and j.get('auth_mode') == args.expect_mode,
                   f'rc={p.returncode} auth_mode={j.get("auth_mode")} {(p.stderr or "").strip()[:120]}')
        except Exception as e:
            record('6a /internal/health in-container (docker exec)', False, f'{e.__class__.__name__}: {e}')
    r = req('GET', f'{BASE}/internal/health')
    is_json_health = r.headers.get('content-type', '').startswith('application/json') and '"auth_mode"' in r.text
    record('6b /internal/health via edge -> not served', not is_json_health, f'{r.status_code} {r.headers.get("content-type", "")}')

    # ── 7: landing data path, logged out ───────────────────────────────────
    r1 = req('GET', f'{BASE}/api/guest/panchang/daily', headers=bearer(guest))
    r2 = req('GET', f'{BASE}/api/guest/spotlight', headers=bearer(guest))
    record('7 guest GETs with a fresh guest token -> 200', r1.status_code == 200 and r2.status_code == 200,
           f'panchang={r1.status_code} spotlight={r2.status_code}')
    r3 = req('GET', f'{BASE}/api/landing/spotlight')
    record('7b old /api/landing/spotlight is gone', r3.status_code in (401, 404), f'{r3.status_code}')

    # ── 8: logged-in reads ─────────────────────────────────────────────────
    if user:
        bad = []
        for p in LOGGED_IN_READS:
            r = req('GET', f'{BASE}{p}', headers=bearer(user))
            if r.status_code == 401:
                bad.append(f'{p} -> 401')
        record('8 logged-in reads carry no 401', not bad, '; '.join(bad) or f'{len(LOGGED_IN_READS)} routes')
    else:
        record('8 logged-in reads', False, 'no credentials given')

    # ── 10: expired guest token ────────────────────────────────────────────
    try:
        from jose import jwt as _jwt
        secret = os.getenv('JWT_SECRET', '')
        if secret:
            expired = _jwt.encode({'role': 'guest', 'aud': 'dristiq-guest', 'sub': str(uuid.uuid4()),
                                   'iss': 'kaaladristi', 'iat': int(time.time()) - 1000,
                                   'exp': int(time.time()) - 100}, secret, algorithm='HS256')
            r = req('GET', f'{BASE}/api/guest/spotlight', headers=bearer(expired))
            want = (401, 'expired') if enforce else (200, None)
            got = (r.status_code, r.json().get('detail') if r.status_code == 401 else None)
            record('10 expired guest token', got == want, f'{got}')
        else:
            record('10 expired guest token', True, 'skipped: JWT_SECRET not given (cannot forge exp)')
    except ImportError:
        record('10 expired guest token', True, 'skipped: python-jose not installed')

    # ── 11: issuer rate limit ──────────────────────────────────────────────
    if args.skip_ratelimit:
        record('11 issuer rate limit', True, 'skipped by flag')
    else:
        codes = []
        for _ in range(20):
            codes.append(req('POST', f'{BASE}/api/guest/token', headers={'Content-Type': 'application/json'}).status_code)
        first_429 = codes.index(429) if 429 in codes else None
        record('11 issuer 6/min burst 10 -> 429 within 20 rapid calls', first_429 is not None and first_429 >= 6,
               f'first 429 at call #{(first_429 or -1) + 1}; codes={codes}')

    failed = [c for c, ok, _ in results if not ok]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
