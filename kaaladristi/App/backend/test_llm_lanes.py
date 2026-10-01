"""LLM lanes: priority picks the provider, everything comes from the env.

Owner, 2026-10-01: low/medium stay on Qwen, the rest goes to free hosted
APIs (Groq, OpenRouter), all via .env. No DB, no network: a fake `post`
stands in for every server.

    python -m unittest test_llm_lanes
"""
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from lib import llm_lanes as ll
from lib import filing_reader as fr

ENV = {
    'LLM_PROVIDERS': 'groq,openrouter',
    'LLM_GROQ_URL': 'https://groq.example/v1', 'LLM_GROQ_KEY': 'gk', 'LLM_GROQ_MODEL': 'big-70b',
    'LLM_GROQ_CTX': '30000', 'LLM_GROQ_COOLDOWN': '60',
    'LLM_OPENROUTER_URL': 'https://or.example/v1', 'LLM_OPENROUTER_KEY': 'ok',
    'LLM_OPENROUTER_MODEL': 'meta/other-70b:free',
    'LLM_ROUTE_HIGH': 'groq,openrouter,qwen',
}
VERDICT = '{"impact":"positive","headline":"h","reasoning":"r","evidence_quote":"q","confidence":0.7}'


class Resp:
    def __init__(self, status=200, model='big-70b', content=VERDICT):
        self.status_code, self._model, self._content = status, model, content

    @property
    def text(self):
        return '{"error":{"message":"The model does not exist"}}' if self.status_code >= 400 else ''

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f'{self.status_code} error')

    def json(self):
        return {'model': self._model, 'choices': [{'message': {'content': self._content}}],
                'usage': {'prompt_tokens': 100, 'completion_tokens': 20}}


class FakePost:
    """Answers per host; records every call."""
    def __init__(self, by_host):
        self.by_host, self.calls = by_host, []

    def __call__(self, url, json=None, headers=None, timeout=None):
        self.calls.append((url, json, headers))
        for host, resp in self.by_host.items():
            if host in url:
                return resp() if callable(resp) else resp
        raise RuntimeError('unknown host')


class LocalStub:
    def __init__(self):
        self.called = 0
        outer = self

        class _M:
            def parse(self, **kw):
                outer.called += 1
                return fr._LocalResp(fr.FilingVerdict.model_validate_json(VERDICT), 1, 1, 'Qwen3-4B-Q4_K_M.gguf')
        self.messages = _M()


def parse(client):
    return client.messages.parse(model='x', max_tokens=10, system='S',
                                 messages=[{'role': 'user', 'content': [{'type': 'text', 'text': 'DOC'}]}],
                                 output_format=fr.FilingVerdict)


@mock.patch.dict(os.environ, ENV, clear=False)
class LaneTests(unittest.TestCase):
    def setUp(self):
        ll._cooldown_until.clear()

    def test_unset_routes_are_qwen(self):
        with mock.patch.dict(os.environ, {'LLM_ROUTE_MEDIUM': '', 'LLM_ROUTE_LOW': ''}):
            self.assertEqual(ll.route('medium'), ['qwen'])
            self.assertEqual(ll.route('low'), ['qwen'])
        self.assertEqual(ll.route('high'), ['groq', 'openrouter', 'qwen'])

    def test_an_undeclared_provider_is_dropped_not_guessed(self):
        with mock.patch.dict(os.environ, {'LLM_ROUTE_HIGH': 'cerebras,qwen'}):
            self.assertEqual(ll.route('high'), ['qwen'])

    def test_hosted_call_is_openai_shaped_with_bearer_and_no_qwen_flags(self):
        post = FakePost({'groq.example': Resp()})
        local = LocalStub()
        c = ll.RoutedClient(ll.route('high'), lambda: local, 500, 16384, post=post)
        r = parse(c)
        url, body, headers = post.calls[0]
        self.assertEqual(url, 'https://groq.example/v1/chat/completions')
        self.assertEqual(headers['Authorization'], 'Bearer gk')
        self.assertEqual(body['model'], 'big-70b')
        self.assertNotIn('chat_template_kwargs', body)        # a Qwen-only flag; hosted APIs may reject it
        self.assertEqual(body['response_format'], {'type': 'json_object'})
        self.assertEqual(body['max_tokens'], 500)                # the caller's budget when none is set
        self.assertEqual((r.label, local.called), ('groq:big-70b', 0))
        self.assertEqual(c.ctx_tokens, 16384)                  # smallest context in the route

    def test_429_parks_the_provider_and_falls_through(self):
        post = FakePost({'groq.example': Resp(429), 'or.example': Resp(model='meta/other-70b:free')})
        c = ll.RoutedClient(ll.route('high'), LocalStub, 500, 16384, post=post)
        self.assertEqual(parse(c).label, 'openrouter:other-70b:free')
        self.assertTrue(ll.cooling('groq'))
        parse(c)                                               # groq is skipped while parked
        self.assertEqual([u for u, *_ in post.calls].count('https://groq.example/v1/chat/completions'), 1)

    def test_every_hosted_failure_ends_on_qwen(self):
        post = FakePost({'groq.example': Resp(500), 'or.example': Resp(content='not json')})
        local = LocalStub()
        r = parse(ll.RoutedClient(ll.route('high'), lambda: local, 500, 16384, post=post))
        self.assertEqual((r.label, local.called), ('local:Qwen3-4B-Q4_K_M.gguf', 1))

    def test_all_fail_raises_with_every_reason(self):
        post = FakePost({'groq.example': Resp(500), 'or.example': Resp(500)})
        with mock.patch.dict(os.environ, {'LLM_ROUTE_HIGH': 'groq,openrouter'}):
            with self.assertRaises(RuntimeError) as e:
                parse(ll.RoutedClient(ll.route('high'), LocalStub, 500, 16384, post=post))
        self.assertIn('groq', str(e.exception))
        self.assertIn('openrouter', str(e.exception))
        self.assertIn('does not exist', str(e.exception))     # the provider's message, not just a code

    def test_free_lanes_cost_nothing(self):
        self.assertEqual(fr._cost('groq:big-70b', 1000, 100), 0.0)
        self.assertEqual(fr._cost('local:Qwen3', 1000, 100), 0.0)
        self.assertIsNotNone(fr._cost('claude-haiku-4-5', 1000, 100))

    def test_a_provider_can_raise_the_reply_budget(self):
        post = FakePost({'groq.example': Resp()})
        with mock.patch.dict(os.environ, {'LLM_GROQ_MAX_TOKENS': '4000'}):
            parse(ll.RoutedClient(ll.route('high'), LocalStub, 500, 16384, post=post))
        self.assertEqual(post.calls[0][1]['max_tokens'], 4000)
        self.assertNotIn('reasoning_effort', post.calls[0][1])        # unset → not sent

    def test_reasoning_effort_is_sent_when_set(self):
        post = FakePost({'groq.example': Resp()})
        with mock.patch.dict(os.environ, {'LLM_GROQ_REASONING': 'low'}):
            parse(ll.RoutedClient(ll.route('high'), LocalStub, 500, 16384, post=post))
        self.assertEqual(post.calls[0][1]['reasoning_effort'], 'low')

    def test_a_429_waits_as_long_as_the_provider_asks(self):
        r = Resp(429)
        r.headers = {'retry-after': '600'}
        post = FakePost({'groq.example': r, 'or.example': Resp(model='m:free')})
        t0 = 1000.0
        with mock.patch.object(ll, '_now', lambda: t0):
            parse(ll.RoutedClient(ll.route('high'), LocalStub, 500, 16384, post=post))
            self.assertEqual(ll._cooldown_until['groq'], t0 + 601)   # not the 60 s configured
        self.assertEqual(ll._retry_after(type('R', (), {'headers': {'x-ratelimit-reset-tokens': '2m3.5s'}})()), 124)

    def test_a_near_miss_verdict_is_repaired_not_refused(self):
        sloppy = '{"impact":"positive","headline":"h","reasoning":"r","confidence":"0.8"}'
        post = FakePost({'groq.example': Resp(content=sloppy)})
        r = parse(ll.RoutedClient(['groq'], LocalStub, 500, 16384, post=post))
        v = r.parsed_output
        self.assertEqual((v.confidence, v.evidence_quote, v.role), (0.8, '', None))

    def test_a_non_answer_still_fails(self):
        post = FakePost({'groq.example': Resp(content='{"impact": ["positive"]}')})
        with self.assertRaises(RuntimeError):
            parse(ll.RoutedClient(['groq'], LocalStub, 500, 16384, post=post))

    def test_describe_never_shows_a_key(self):
        self.assertNotIn('gk', repr(ll.describe()))


class PriorityTests(unittest.TestCase):
    def test_today_is_high_and_last_week_is_medium(self):
        now = datetime.now(timezone.utc)
        self.assertEqual(fr.priority_of({'disseminated_at': now - timedelta(hours=5)}), 'high')
        self.assertEqual(fr.priority_of({'disseminated_at': now - timedelta(days=7)}), 'medium')
        self.assertEqual(fr.priority_of({'disseminated_at': None}), 'medium')

    def test_nothing_in_the_lanes_names_a_host_or_model(self):
        import inspect
        src = inspect.getsource(ll).split('"""', 2)[2]         # code, not the docstring's example
        for word in ('groq.com', 'openrouter.ai', 'llama-3', 'gsk_'):
            self.assertNotIn(word, src)


if __name__ == '__main__':
    unittest.main()
