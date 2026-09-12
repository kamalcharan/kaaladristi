"""
VaNi intent plumbing test — does an intent reach Qwen, carrying its own prompt?

Standalone, no DB, no pytest (matches the other test_*.py here):

    cd App/backend && python test_vani_routing.py

Why this exists. Two silent failures have shipped in this area, and neither
raised anything a build or a typecheck would catch:

  * 2026-09-03 — every `scanner.*` intent was marked complexity='low' ("local
    LLM fine") and every one of them was answered by the cloud provider,
    because complete() never read the field. The cache rows said
    llm_provider='anthropic' for months.
  * 2026-09-11 — every dashboard / astro_calendar / industry_transition
    intent had its registry system_prompt discarded in favour of the generic
    _VANI_ASK_SYSTEM. 18 intents, ~31,000 characters of instruction, never
    sent. Nothing errored: they all answered, in the same shape, because
    they were all running the same prompt.

Both are invisible from the outside — the user gets prose either way. So the
test asserts on the WIRE: which backend was called, and what it was sent.

The one trap worth knowing: a stub reached via the cloud-first path (cloud
errors, then falls back to local) is indistinguishable from prefer_local by
the recorded request alone — both end at the same server and both report
'qwen-local'. Hence the cloud-attempt tripwire plus a control case that
proves the tripwire can fire.
"""
import importlib
import json
import os
import sys
import threading
import http.server
import socketserver

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PORT = int(os.environ.get('VANI_TEST_PORT', '8799'))
STUB_ANSWER = 'STUB-QWEN-ANSWER'
_requests_seen: list[dict] = []


class _StubHandler(http.server.BaseHTTPRequestHandler):
    """Minimal OpenAI-compatible stand-in for the self-hosted Qwen server."""

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        _requests_seen.append(json.loads(self.rfile.read(n) or b'{}'))
        raw = json.dumps({'choices': [{'message': {'content': STUB_ANSWER}}]}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *_a):
        pass


def _start_stub():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), _StubHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def _load_prompt_parts():
    """Pull the real prompt-building code out of pipeline2_api and run it.

    By source text, not by import: importing the module pulls in the whole
    FastAPI app and its DATABASE_URL, and this test must run without one.

    It must be the PRODUCTION code, not a copy. An earlier version of this
    test rebuilt the system prompt itself (`intent.system_prompt +
    grounding`) and asserted a substring was present somewhere in the file —
    it passed happily against the broken code it was written to catch,
    because the broken version contained that substring too, inside the
    branch that skipped dashboard intents. Hence `vani_ask_system` is a named
    function in pipeline2_api and this executes it.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    src = open(os.path.join(here, 'pipeline2_api.py'), encoding='utf-8').read()
    ns: dict = {}
    for marker in ('_VANI_ASK_SYSTEM = (', '_VANI_GROUNDING = (',
                   'def vani_ask_system', 'def _wrap_vani_user_msg'):
        assert marker in src, f'pipeline2_api.py no longer defines {marker!r}'
        i = src.index(marker)
        exec(src[i:src.index('\n\n\n', i)], ns)
    assert 'vani_ask_system(intent)' in src, (
        'vani_ask no longer calls vani_ask_system() — the handler may have '
        'gone back to selecting the prompt inline, where this cannot see it'
    )
    return ns['vani_ask_system'], ns['_wrap_vani_user_msg'], src


# Representative dashboard context. Real shapes, real 2026-09-11 numbers —
# the formatters index into these keys, so a shape change fails here too.
CTX = {
    'date': '2026-09-11',
    'breadth': {'score': 39.33, 'pct_above_20': 35.69,
                'pct_above_50': 41.35, 'pct_above_150': 45.42},
    'breadth_roc': {'roc_13': 0.0564, 'roc_55': 0.0301, 'sma_breadth': 0.0955},
    'breadth_history': [
        {'date': '2026-09-09', 'score': 43.25, 'regime': 'Neutral',
         'pct_above_20': 40.5, 'pct_above_50': 45.0, 'pct_above_150': 47.5},
        {'date': '2026-09-10', 'score': 41.71, 'regime': 'Neutral',
         'pct_above_20': 38.8, 'pct_above_50': 43.2, 'pct_above_150': 46.9},
        {'date': '2026-09-11', 'score': 39.33, 'regime': 'Neutral',
         'pct_above_20': 35.7, 'pct_above_50': 41.4, 'pct_above_150': 45.4},
    ],
    'breadth_roc_history': [
        {'date': '2026-09-09', 'roc_13': 0.0801, 'roc_55': 0.0290,
         'spread': 0.0511, 'bias': 'positive'},
        {'date': '2026-09-10', 'roc_13': 0.0644, 'roc_55': 0.0296,
         'spread': 0.0348, 'bias': 'positive'},
        {'date': '2026-09-11', 'roc_13': 0.0564, 'roc_55': 0.0301,
         'spread': 0.0263, 'bias': 'positive'},
    ],
    'index_breadth': [
        {'name': 'NIFTY 50', 'score': 21.4, 'regime': 'Fear',
         'pct_above_20': 18.0, 'pct_above_50': 16.0, 'pct_above_150': 38.0},
        {'name': 'NIFTY BANK', 'score': 37.9, 'regime': 'Neutral',
         'pct_above_20': 28.6, 'pct_above_50': 35.7, 'pct_above_150': 64.3},
    ],
}

UNDER_TEST = [
    'dashboard.autorun',
    'dashboard.breadth_divergence',
    'dashboard.breadth_trend',
    'dashboard.breadth_momentum',
]


def check_derived_statements() -> int:
    """The formatters state comparisons in words — assert the words are right.

    Why this is separate from the routing checks: the first live autorun came
    back saying "the fast reading slightly above the slow reading" on a day
    roc_13 was 0.0235 against roc_55 of 0.0596. The plumbing was perfect. The
    data block said only "Fast/slow spread: -0.0361" and a small local model
    inverted the sign on the one comparison the paragraph was about.

    The fix was to pre-compute every relationship into a sentence. That moves
    the risk from the model into OUR arithmetic — so the arithmetic gets a
    test. Each case below pins the wording to the numbers; a flipped
    comparison fails here instead of appearing in a user's morning brief as a
    confident, specific, wrong claim.
    """
    from lib.vani_assemblers import _fmt_autorun, _fmt_breadth_momentum

    def ctx_for(roc13, roc55, sma, scores):
        hist = [
            {'date': f'2026-09-{8 + i:02d}', 'score': sc, 'regime': 'Neutral',
             'pct_above_20': sc - 4, 'pct_above_50': sc + 2, 'pct_above_150': sc + 6}
            for i, sc in enumerate(scores)
        ]
        rhist = [
            {'date': f'2026-09-{8 + i:02d}', 'roc_13': roc13, 'roc_55': roc55,
             'spread': roc13 - roc55, 'bias': 'positive'}
            for i in range(len(scores))
        ]
        return {
            'date': '2026-09-11',
            'breadth': {'score': scores[-1], 'pct_above_20': scores[-1] - 4,
                        'pct_above_50': scores[-1] + 2, 'pct_above_150': scores[-1] + 6},
            'breadth_roc': {'roc_13': roc13, 'roc_55': roc55, 'sma_breadth': sma},
            'breadth_history': hist, 'breadth_roc_history': rhist,
        }

    cases = [
        # (label, roc13, roc55, sma, scores, must_appear, must_NOT_appear)
        ('live 2026-09-11 — fast under slow, under signal',
         0.0235, 0.0596, 0.0700, [44.6, 43.2, 41.7, 39.3],
         ['FAST reading (+0.0235) is BELOW the slow reading (+0.0596)',
          'BELOW its signal line (+0.0700)',
          'FALLING in every one of the last 4 sessions'],
         ['is ABOVE the slow reading']),
        ('fast over slow and over signal',
         0.0900, 0.0300, 0.0500, [39.3, 41.7, 43.2],
         ['FAST reading (+0.0900) is ABOVE the slow reading (+0.0300)',
          'ABOVE its signal line',
          'RISING in every one of the last 3 sessions'],
         ['is BELOW the slow reading', 'FALLING in every']),
        ('negative fast, still above a more-negative slow',
         -0.0100, -0.0400, -0.0200, [43.2, 41.0, 42.0],
         ['FAST reading (-0.0100) is ABOVE the slow reading (-0.0400)'],
         ['is BELOW the slow reading']),
    ]

    failures = 0
    for label, roc13, roc55, sma, scores, wanted, unwanted in cases:
        ctx = ctx_for(roc13, roc55, sma, scores)
        text = _fmt_autorun(ctx) + '\n' + _fmt_breadth_momentum(ctx)
        missing = [w for w in wanted if w not in text]
        present = [u for u in unwanted if u in text]
        ok = not missing and not present
        failures += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  derived: {label}")
        for m in missing:
            print(f"          ✗ missing: {m}")
        for pz in present:
            print(f"          ✗ present but must not be: {pz}")

    # ── ICP → breadth leg ───────────────────────────────────────────────
    # The whole reason the brief can be decision-shaped: concede_level names
    # a price line at a timeframe breadth already measures, so it selects
    # which row is THEIRS. Pick the wrong leg and the brief confidently tells
    # someone the market is against them when it is not, or the reverse.
    # Live 2026-09-11: 35.7 / 41.4 / 45.4 — weakest short, strongest long.
    icp_base = ctx_for(0.0235, 0.0596, 0.0700, [44.6, 43.2, 41.7, 39.3])
    icp_base['breadth'] = {'score': 39.33, 'pct_above_20': 35.69,
                           'pct_above_50': 41.35, 'pct_above_150': 45.42}
    icp_cases = [
        ('tight', 'the 10-day low', '20 EMA', '35.7%', 'the WEAKEST of the three'),
        ('swing_low', 'the 22-day low', '50 EMA', '41.4%', 'the middle of the three'),
        ('structure', 'the Golden Line', '150 EMA', '45.4%', 'the STRONGEST of the three'),
    ]
    for concede, line_name, ma, pct, rank in icp_cases:
        text = _fmt_autorun({**icp_base, 'icp': {'concede_level': concede}})
        wanted = [line_name, f'THEIR timeframe is the {ma}', pct, rank]
        missing = [w for w in wanted if w not in text]
        ok = not missing
        failures += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  icp: concede '{concede}' -> {ma} row, {rank}")
        for m in missing:
            print(f"          ✗ missing: {m}")

    # No ICP (onboarding skipped) must stay market-level, not invent a reader.
    no_icp = _fmt_autorun({**icp_base, 'icp': {}})
    clean = 'WHO IS READING THIS' not in no_icp
    failures += 0 if clean else 1
    print(f"{'PASS' if clean else 'FAIL'}  icp: absent ICP leaves the brief market-level")

    # The safe-vocabulary list must not read as an instruction to use it.
    # "Capital is flowing towards the market" appeared, unsupported, on a day
    # every measure fell — a small model read "Use: <phrases>" as fill-in.
    from lib.vani_intents import _VANI_RULES
    rules_ok = 'permitted vocabulary' in _VANI_RULES and 'NOT a checklist' in _VANI_RULES
    failures += 0 if rules_ok else 1
    print(f"{'PASS' if rules_ok else 'FAIL'}  voice rules frame safe phrases as "
          f"permitted, not required")
    return failures


def main() -> int:
    # The cloud provider is left CONFIGURED and plausible on purpose: if
    # prefer_local regressed, the call would go there first and the tripwire
    # below would catch it.
    os.environ['AI_ENABLED'] = 'true'
    os.environ['AI_PROVIDER'] = 'anthropic'
    os.environ['AI_API_KEY'] = 'sk-ant-FAKE-for-test-only'
    os.environ['LLM_BASE_URL'] = f'http://127.0.0.1:{PORT}/v1'
    os.environ['LLM_MODEL'] = 'qwen3-stub'

    srv = _start_stub()
    try:
        import lib.ai_client as ac
        importlib.reload(ac)

        cloud_attempts: list[int] = []
        _real_primary = ac._primary_complete

        def _spy(*a, **kw):
            cloud_attempts.append(1)
            return _real_primary(*a, **kw)

        ac._primary_complete = _spy

        from lib.vani_intents import INTENTS
        from lib.vani_assemblers import format_user_message

        build_system, wrap, _api_src = _load_prompt_parts()

        failures = 0
        for intent_id in UNDER_TEST:
            intent = INTENTS[intent_id]
            ask_system = build_system(intent)   # production code, not a copy
            user_msg = wrap(format_user_message(intent_id, CTX))

            cloud_attempts.clear()
            _requests_seen.clear()
            text, provider = ac.complete_with_source(
                system=ask_system, user=user_msg,
                max_tokens=intent.max_tokens, temperature=0.4, no_think=True,
                prefer_local=(intent.complexity == 'low'),
            )

            sent = _requests_seen[-1] if _requests_seen else {}
            sys_sent = next((m['content'] for m in sent.get('messages', [])
                             if m['role'] == 'system'), '')

            checks = {
                'answered':          text == STUB_ANSWER,
                'provider=qwen':     provider == 'qwen-local',
                'reached local':     len(_requests_seen) == 1,
                'cloud untouched':   len(cloud_attempts) == 0,
                'no_think prefix':   sys_sent.startswith('/no_think'),
                'own prompt sent':   intent.system_prompt[:80] in sys_sent,
                'grounding sent':    'ABSOLUTE GROUNDING RULES' in sys_sent,
                'not generic':       'atmospheric intelligence narrator' not in sys_sent,
                'max_tokens honoured': sent.get('max_tokens') == intent.max_tokens,
                'formatter produced data': '[DATA START]' in user_msg and len(user_msg) > 200,
            }
            ok = all(checks.values())
            failures += 0 if ok else 1
            print(f"{'PASS' if ok else 'FAIL'}  {intent_id}")
            for name, passed in checks.items():
                if not passed:
                    print(f"          ✗ {name}")

        # Control — proves the tripwire can fire, so 'cloud untouched' above
        # means something. An expected Anthropic 401 is logged here.
        cloud_attempts.clear()
        ac.complete_with_source(system='x', user='y', max_tokens=10,
                                prefer_local=False)
        control_ok = len(cloud_attempts) == 1
        failures += 0 if control_ok else 1
        print(f"{'PASS' if control_ok else 'FAIL'}  control: prefer_local=False does "
              f"attempt cloud (the 401 above is expected)")

        failures += check_derived_statements()

        print('\nALL PASSED' if failures == 0 else f'\n{failures} CHECK(S) FAILED')
        return 0 if failures == 0 else 1
    finally:
        srv.shutdown()


if __name__ == '__main__':
    sys.exit(main())
