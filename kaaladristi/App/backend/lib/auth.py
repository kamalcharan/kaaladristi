"""
Authentication guards for the FastAPI sidecar (kd-pipeline-api2).

Contract: `.claude/skills/api-auth-contract/SKILL.md` (Phase 1a).

Guards
------
    user      Bearer JWT, HS256 with JWT_SECRET, `sub` is a UUID, and
              `role == 'authenticated'`; `aud` absent or 'app'.
              (Before 1a only signature/exp/sub were checked, so a guest token
              — same secret, a UUID sub — would have passed every bearer route.)
    guest     `role == 'guest'` and `aud == GUEST_AUD`. Only meaningful on
              `/api/guest/*`; `route_guard` never asks for it elsewhere.
    admin     `user` + km_profiles.role = 'admin' — lives in pipeline2_api
              (`_require_admin`), unchanged in 1a.
    signature Razorpay HMAC, in the webhook handler — unchanged in 1a.

Route-level enforcement is ONE app-wide dependency, `route_guard`, registered
on the FastAPI app (`FastAPI(dependencies=[Depends(route_guard)])`). It looks at
the request path and dispatches:

    /api/payments/webhook      exempt (HMAC)
    /api/guest/token           exempt (the issuer; nginx limit_req)
    /internal/health           exempt (not routed by the edge nginx)
    /api/guest/*               guest
    everything else            user

AUTH_MODE (env, default 'audit')
--------------------------------
    off      guards never run.                      Emergency only.
    audit    guards run; a failure is LOGGED on the `auth.audit` logger and
             the request proceeds.                   First deploy.
    enforce  guards run; a failure is a 401.         Steady state.

The value-consuming dependency `get_current_user_id` (the 22 routes that need
`sub`) keeps rejecting a MISSING or INVALID token with 401 in every mode — it
always did, so that is no rollout change; only the NEW claim rules (role/aud)
are audited rather than enforced in `audit` mode.

Nothing here talks to the database. The only secret read is JWT_SECRET.
"""

from __future__ import annotations

import logging
import os
import time
import uuid as _uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from lib.config import JWT_SECRET

_bearer = HTTPBearer(auto_error=False)
_ALGORITHM = 'HS256'

log = logging.getLogger('auth')
audit_log = logging.getLogger('auth.audit')

# ── Configuration ────────────────────────────────────────────────────────────

AUTH_MODES = ('off', 'audit', 'enforce')


def _read_mode() -> str:
    raw = (os.getenv('AUTH_MODE') or 'audit').strip().lower()
    if raw not in AUTH_MODES:
        log.warning("AUTH_MODE=%r is not one of %s — falling back to 'audit'", raw, AUTH_MODES)
        return 'audit'
    return raw


AUTH_MODE: str = _read_mode()

GUEST_AUD = 'dristiq-guest'
GUEST_TTL_SECONDS = 15 * 60
USER_AUD = 'app'
ISSUER = 'kaaladristi'          # same `iss` kd_generate_token stamps (migration 003)
APP_ROLE = 'authenticated'      # the role kd_auth_login issues (migration 144)
GUEST_ROLE = 'guest'

GUEST_PREFIX = '/api/guest/'
GUEST_TOKEN_PATH = '/api/guest/token'
EXEMPT_PATHS = frozenset({
    '/api/payments/webhook',    # signature guard inside the handler
    GUEST_TOKEN_PATH,           # the issuer itself (nginx limit_req)
    '/internal/health',         # ops probe; no nginx location → unreachable from outside
})


# ── Principal + failure ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class Principal:
    sub: str
    role: str
    aud: Optional[str]
    claims: dict


class AuthFailure(Exception):
    """Raised by the verifiers. `reason` is one of the fixed vocabulary the
    audit log and the 401 `detail` use: missing | invalid | expired |
    wrong_role | wrong_aud | bad_sub."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _decode(token: str) -> dict:
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail='JWT_SECRET not configured')
    try:
        # `aud` is validated by hand below so one decode serves both guards.
        return jwt.decode(token, JWT_SECRET, algorithms=[_ALGORITHM],
                          options={'verify_aud': False})
    except jwt.ExpiredSignatureError:
        raise AuthFailure('expired')
    except JWTError:
        raise AuthFailure('invalid')


def _credentials(request: Request) -> Optional[str]:
    header = request.headers.get('authorization') or ''
    scheme, _, token = header.partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        return None
    return token.strip()


def verify_user_token(token: Optional[str]) -> Principal:
    """`user` guard rules. Raises AuthFailure."""
    if not token:
        raise AuthFailure('missing')
    claims = _decode(token)
    sub = claims.get('sub')
    if not sub:
        raise AuthFailure('bad_sub')
    try:
        _uuid.UUID(str(sub))
    except ValueError:
        raise AuthFailure('bad_sub')
    if claims.get('role') != APP_ROLE:
        raise AuthFailure('wrong_role')
    aud = claims.get('aud')
    if aud not in (None, USER_AUD):
        raise AuthFailure('wrong_aud')
    return Principal(sub=str(sub), role=APP_ROLE, aud=aud, claims=claims)


def verify_guest_token(token: Optional[str]) -> Principal:
    """`guest` guard rules. Raises AuthFailure."""
    if not token:
        raise AuthFailure('missing')
    claims = _decode(token)
    if claims.get('role') != GUEST_ROLE:
        raise AuthFailure('wrong_role')
    if claims.get('aud') != GUEST_AUD:
        raise AuthFailure('wrong_aud')
    sub = str(claims.get('sub') or '')
    return Principal(sub=sub, role=GUEST_ROLE, aud=GUEST_AUD, claims=claims)


# ── Audit / enforce plumbing ─────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    xff = request.headers.get('x-forwarded-for') or ''
    if xff:
        return xff.split(',')[0].strip()
    return request.headers.get('x-real-ip') or (request.client.host if request.client else '-')


def _caller_hint(request: Request) -> str:
    """Which page / tool fired the request — never the token, never a body."""
    referer = request.headers.get('referer') or ''
    if referer:
        # keep only the path of the referer
        try:
            from urllib.parse import urlsplit
            return 'page:' + (urlsplit(referer).path or '/')
        except Exception:
            return 'page:?'
    ua = (request.headers.get('user-agent') or '').lower()
    if 'mozilla' in ua:
        return 'browser'
    if 'curl' in ua:
        return 'curl'
    if 'python' in ua:
        return 'python-requests'
    return ua[:24] or '-'


def _audit(request: Request, guard: str, reason: str) -> None:
    audit_log.info(
        'auth.audit route=%s %s guard=%s reason=%s ip=%s caller=%s',
        request.method, request.url.path, guard, reason,
        _client_ip(request), _caller_hint(request),
    )


def _fail(request: Request, guard: str, exc: AuthFailure) -> None:
    """Apply AUTH_MODE to a guard failure: log in audit, raise in enforce."""
    _audit(request, guard, exc.reason)
    if AUTH_MODE == 'enforce':
        raise HTTPException(status_code=401, detail=exc.reason)


def guard_for_path(path: str) -> str:
    """Which guard a path gets: 'exempt' | 'guest' | 'user'."""
    if path in EXEMPT_PATHS:
        return 'exempt'
    if path.startswith(GUEST_PREFIX):
        return 'guest'
    return 'user'


# ── Dependencies ─────────────────────────────────────────────────────────────

async def route_guard(request: Request) -> Optional[Principal]:
    """App-wide dependency: puts a guard on EVERY route per the contract."""
    guard = guard_for_path(request.url.path)
    if guard == 'exempt' or AUTH_MODE == 'off':
        return None
    token = _credentials(request)
    try:
        principal = verify_guest_token(token) if guard == 'guest' else verify_user_token(token)
    except AuthFailure as exc:
        _fail(request, guard, exc)
        return None
    request.state.principal = principal
    return principal


async def require_guest(request: Request) -> Optional[Principal]:
    """Explicit guest dependency for the guest router (belt and braces on top
    of route_guard, and the one to use if a guest route is ever registered
    outside the prefix)."""
    if AUTH_MODE == 'off':
        return None
    cached = getattr(request.state, 'principal', None)
    if cached is not None and cached.role == GUEST_ROLE:
        return cached
    try:
        principal = verify_guest_token(_credentials(request))
    except AuthFailure as exc:
        _fail(request, 'guest', exc)
        return None
    request.state.principal = principal
    return principal


def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """
    Value-consuming `user` guard: returns the `sub` claim as a string.

    401 on a missing / malformed / expired token in EVERY mode (that is
    today's behaviour and the handler cannot run without a `sub`). The new
    claim rules (role, aud) follow AUTH_MODE: audited in `audit`, 401 in
    `enforce`.
    """
    token = credentials.credentials if credentials else None
    if not token:
        raise HTTPException(status_code=401, detail='Authorization header missing')
    try:
        principal = verify_user_token(token)
    except AuthFailure as exc:
        if exc.reason in ('invalid', 'expired'):
            raise HTTPException(status_code=401, detail='Invalid or expired token')
        if exc.reason == 'bad_sub':
            raise HTTPException(status_code=401, detail='Token missing sub claim')
        # wrong_role / wrong_aud — the 1a rules
        if AUTH_MODE == 'off':
            claims = _decode(token)
            return str(claims.get('sub'))
        _fail(request, 'user', exc)
        claims = _decode(token)              # audit mode: proceed with the sub
        return str(claims.get('sub'))
    request.state.principal = principal
    return principal.sub


# ── Guest issuer ─────────────────────────────────────────────────────────────

def mint_guest_token(now: Optional[int] = None) -> dict:
    """Mint a 15-minute guest token. Returns the issuer response body."""
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail='JWT_SECRET not configured')
    iat = int(now if now is not None else time.time())
    claims = {
        'role': GUEST_ROLE,
        'aud': GUEST_AUD,
        'sub': str(_uuid.uuid4()),
        'iss': ISSUER,
        'iat': iat,
        'exp': iat + GUEST_TTL_SECONDS,
    }
    token = jwt.encode(claims, JWT_SECRET, algorithm=_ALGORITHM)
    return {'token': token, 'expires_in': GUEST_TTL_SECONDS, 'token_type': 'Bearer'}
