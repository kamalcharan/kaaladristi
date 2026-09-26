"""
Phase 1a route guards — unit tests (no DB, no network).

    cd App/backend && python -m unittest test_auth_guards

Covers `lib/auth.py` against a tiny FastAPI app shaped like the real one
(app-wide `route_guard`, a guest router with `require_guest`, a
value-consuming route using `get_current_user_id`, the three exempt paths),
and AST-checks `pipeline2_api.py` for the wiring the contract requires:
the app-wide dependency, CORS with credentials off, the guest router, the
removed `/api/landing/spotlight` path and `/internal/health`.

AUTH_MODE is a module constant read at import, so each mode gets its own
importlib.reload with the env var set.
"""

from __future__ import annotations

import ast
import importlib
import os
import sys
import time
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('JWT_SECRET', 'unit-test-secret-not-for-production-0123456789')

from jose import jwt  # noqa: E402
from fastapi import Depends, FastAPI, APIRouter  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

SECRET = os.environ['JWT_SECRET']
USER_SUB = str(uuid.uuid4())


def _load_auth(mode: str):
    os.environ['AUTH_MODE'] = mode
    import lib.auth as auth
    return importlib.reload(auth)


def _user_token(**over) -> str:
    claims = {'role': 'authenticated', 'sub': USER_SUB, 'email': 'u@x', 'iss': 'kaaladristi',
              'iat': int(time.time()), 'exp': int(time.time()) + 3600}
    claims.update(over)
    return jwt.encode(claims, SECRET, algorithm='HS256')


def _build_app(auth):
    app = FastAPI(dependencies=[Depends(auth.route_guard)])

    @app.get('/api/scan/presets')
    def presets():
        return {'ok': 'presets'}

    @app.post('/api/pipeline2/fix')
    def fix(body: dict):
        return {'ok': 'fix'}

    @app.get('/api/framework/{user_id}')
    def framework(user_id: str, caller_id: str = Depends(auth.get_current_user_id)):
        return {'caller': caller_id}

    @app.post('/api/payments/webhook')
    def webhook():
        return {'ok': 'webhook'}

    @app.get('/internal/health')
    def health():
        return {'ok': True, 'auth_mode': auth.AUTH_MODE}

    @app.post('/api/guest/token')
    def issuer():
        return auth.mint_guest_token()

    def panchang_daily(date: str | None = None):
        return {'ok': 'panchang', 'date': date}

    @app.get('/api/panchang/daily')
    def panchang_user(date: str | None = None):
        return panchang_daily(date)

    guest = APIRouter(prefix='/api/guest', dependencies=[Depends(auth.require_guest)])
    guest.add_api_route('/panchang/daily', panchang_daily, methods=['GET'])
    app.include_router(guest)
    return app


def _bearer(t: str) -> dict:
    return {'Authorization': f'Bearer {t}'}


class EnforceMode(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.auth = _load_auth('enforce')
        cls.c = TestClient(_build_app(cls.auth))
        cls.guest = cls.c.post('/api/guest/token').json()['token']

    def test_no_token_401_on_user_routes(self):
        self.assertEqual(self.c.get('/api/scan/presets').status_code, 401)
        r = self.c.post('/api/pipeline2/fix', json={'dimension': 'x'})
        self.assertEqual(r.status_code, 401, 'guard must run before body validation')
        self.assertEqual(self.c.get('/api/scan/presets').json()['detail'], 'missing')

    def test_user_token_passes(self):
        self.assertEqual(self.c.get('/api/scan/presets', headers=_bearer(_user_token())).status_code, 200)

    def test_guest_token_on_user_route_401_wrong_role(self):
        r = self.c.get('/api/scan/presets', headers=_bearer(self.guest))
        self.assertEqual((r.status_code, r.json()['detail']), (401, 'wrong_role'))

    def test_guest_token_on_guest_route_passes(self):
        r = self.c.get('/api/guest/panchang/daily?date=2026-09-26', headers=_bearer(self.guest))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['date'], '2026-09-26')

    def test_user_token_on_guest_route_401(self):
        r = self.c.get('/api/guest/panchang/daily', headers=_bearer(_user_token()))
        self.assertEqual((r.status_code, r.json()['detail']), (401, 'wrong_role'))

    def test_exempt_paths_need_no_token(self):
        self.assertEqual(self.c.post('/api/payments/webhook').status_code, 200)
        self.assertEqual(self.c.get('/internal/health').status_code, 200)
        self.assertEqual(self.c.post('/api/guest/token').status_code, 200)

    def test_guest_token_shape(self):
        claims = jwt.decode(self.guest, SECRET, algorithms=['HS256'], audience=self.auth.GUEST_AUD)
        self.assertEqual(claims['role'], 'guest')
        self.assertEqual(claims['aud'], 'dristiq-guest')
        self.assertEqual(claims['iss'], 'kaaladristi')
        uuid.UUID(claims['sub'])                                   # random uuid
        self.assertEqual(claims['exp'] - claims['iat'], 15 * 60)

    def test_expired_and_invalid(self):
        exp = _user_token(exp=int(time.time()) - 5)
        r = self.c.get('/api/scan/presets', headers=_bearer(exp))
        self.assertEqual((r.status_code, r.json()['detail']), (401, 'expired'))
        r = self.c.get('/api/scan/presets', headers=_bearer(exp[:-3] + 'abc'))
        self.assertEqual((r.status_code, r.json()['detail']), (401, 'invalid'))

    def test_wrong_aud_on_user_token(self):
        r = self.c.get('/api/scan/presets', headers=_bearer(_user_token(aud='dristiq-guest')))
        self.assertEqual((r.status_code, r.json()['detail']), (401, 'wrong_aud'))
        self.assertEqual(self.c.get('/api/scan/presets', headers=_bearer(_user_token(aud='app'))).status_code, 200)

    def test_value_consuming_route(self):
        r = self.c.get(f'/api/framework/{USER_SUB}', headers=_bearer(_user_token()))
        self.assertEqual(r.json()['caller'], USER_SUB)
        self.assertEqual(self.c.get(f'/api/framework/{USER_SUB}').status_code, 401)
        r = self.c.get(f'/api/framework/{USER_SUB}', headers=_bearer(self.guest))
        self.assertEqual(r.status_code, 401)


class AuditMode(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.auth = _load_auth('audit')
        cls.c = TestClient(_build_app(cls.auth))
        cls.guest = cls.c.post('/api/guest/token').json()['token']

    def test_failures_pass_but_are_logged(self):
        with self.assertLogs('auth.audit', level='INFO') as cm:
            self.assertEqual(self.c.get('/api/scan/presets').status_code, 200)
            self.assertEqual(self.c.get('/api/scan/presets', headers=_bearer(self.guest)).status_code, 200)
        joined = '\n'.join(cm.output)
        self.assertIn('route=GET /api/scan/presets guard=user reason=missing', joined)
        self.assertIn('reason=wrong_role', joined)
        self.assertIn('ip=', joined)
        self.assertIn('caller=', joined)

    def test_audit_never_logs_the_token(self):
        with self.assertLogs('auth.audit', level='INFO') as cm:
            self.c.get('/api/scan/presets', headers=_bearer(self.guest))
        self.assertNotIn(self.guest, '\n'.join(cm.output))

    def test_value_consuming_route_still_needs_a_token(self):
        # unchanged pre-1a behaviour: no sub → cannot run the handler
        self.assertEqual(self.c.get(f'/api/framework/{USER_SUB}').status_code, 401)
        # the NEW rule (role) is audited, not enforced
        with self.assertLogs('auth.audit', level='INFO'):
            r = self.c.get(f'/api/framework/{USER_SUB}', headers=_bearer(self.guest))
        self.assertEqual(r.status_code, 200)

    def test_default_mode_is_audit(self):
        os.environ.pop('AUTH_MODE', None)
        auth = importlib.reload(importlib.import_module('lib.auth'))
        self.assertEqual(auth.AUTH_MODE, 'audit')
        os.environ['AUTH_MODE'] = 'nonsense'
        self.assertEqual(importlib.reload(auth).AUTH_MODE, 'audit')


class OffMode(unittest.TestCase):
    def test_off_runs_nothing(self):
        auth = _load_auth('off')
        c = TestClient(_build_app(auth))
        with self.assertNoLogs('auth.audit', level='INFO'):
            self.assertEqual(c.get('/api/scan/presets').status_code, 200)


class GuardTable(unittest.TestCase):
    def test_guard_for_path(self):
        auth = _load_auth('enforce')
        g = auth.guard_for_path
        self.assertEqual(g('/api/payments/webhook'), 'exempt')
        self.assertEqual(g('/api/guest/token'), 'exempt')
        self.assertEqual(g('/internal/health'), 'exempt')
        self.assertEqual(g('/api/guest/spotlight'), 'guest')
        self.assertEqual(g('/api/guest/panchang/daily'), 'guest')
        self.assertEqual(g('/api/landing/spotlight/reveal'), 'user')
        self.assertEqual(g('/api/pipeline2/ping'), 'user')
        self.assertEqual(g('/api/vani/ask'), 'user')


class ApiWiring(unittest.TestCase):
    """The real app file, checked by AST so the test needs no DB or pandas."""

    @classmethod
    def setUpClass(cls):
        path = os.path.join(os.path.dirname(__file__), 'pipeline2_api.py')
        with open(path, encoding='utf-8') as fh:
            cls.src = fh.read()
        cls.tree = ast.parse(cls.src)

    def _call(self, fn_name):
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == fn_name:
                return node
        return None

    def test_app_has_route_guard_dependency(self):
        call = self._call('FastAPI')
        kw = {k.arg: k.value for k in call.keywords}
        self.assertIn('dependencies', kw)
        self.assertIn('_route_guard', ast.dump(kw['dependencies']))

    def test_cors_credentials_off_and_origins_from_env(self):
        self.assertIn('allow_credentials=False', self.src)
        self.assertNotIn("allow_origins=['*']", self.src)
        self.assertIn("os.getenv('CORS_ORIGINS')", self.src)

    def test_guest_router_and_issuer(self):
        self.assertIn("@app.post('/api/guest/token')", self.src)
        self.assertIn("_APIRouter(prefix='/api/guest', dependencies=[Depends(_require_guest)])", self.src)
        self.assertIn("add_api_route('/panchang/daily', panchang_daily", self.src)
        self.assertIn("add_api_route('/spotlight', landing_spotlight", self.src)
        self.assertNotIn("@app.get('/api/landing/spotlight')\n", self.src)

    def test_internal_health_and_ping_share_body(self):
        self.assertIn("@app.get('/internal/health')", self.src)
        self.assertIn("@app.get('/api/pipeline2/ping')", self.src)
        self.assertEqual(self.src.count('return _health_body()'), 2)

    def test_every_route_path_is_classified(self):
        """Every @app.<verb>('/path') in the file resolves to a guard."""
        auth = _load_auth('enforce')
        seen = 0
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) \
               and getattr(node.func.value, 'id', None) == 'app' \
               and node.func.attr in ('get', 'post', 'put', 'patch', 'delete') and node.args:
                path = node.args[0].value
                self.assertIn(auth.guard_for_path(path), ('exempt', 'guest', 'user'))
                seen += 1
        self.assertGreaterEqual(seen, 111, f'expected >= 111 decorated routes, saw {seen}')


if __name__ == '__main__':
    unittest.main()
