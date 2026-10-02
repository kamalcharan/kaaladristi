"""
LLM lanes — which model serves a piece of work, by PRIORITY, set in .env
========================================================================
Owner, 2026-10-01: "low - medium priorities - QWEN will continue -- rest
should go somewhere -- free hosted APIs like groq or open router -- but all
of these should go via .env -- not hardcoded".

The local Qwen server has ONE slot and ~200 s a document. A queue served
first-come-first-served lets an 800-row history batch sit in front of
today's filings. So work carries a priority, and each priority has a ROUTE:
an ordered list of providers. The first one that answers wins; a provider
that answers 429 (rate limit) is skipped for a cooldown, so a free tier's
daily cap falls through to the next provider instead of failing the row.

Nothing here names a host, a key or a model. Every provider is declared in
the environment:

    LLM_PROVIDERS=groq,openrouter            # hosted providers this deploy knows
    LLM_GROQ_URL=https://api.groq.com/openai/v1
    LLM_GROQ_KEY=gsk_...
    LLM_GROQ_MODEL=llama-3.3-70b-versatile
    LLM_GROQ_CTX=32000                       # optional, tokens (default 32000)
    LLM_GROQ_TIMEOUT=120                     # optional, seconds
    LLM_GROQ_COOLDOWN=120                    # optional, seconds skipped after a 429
    LLM_GROQ_JSON=json_object                # optional: json_object (default) | json_schema | none
    LLM_GROQ_MAX_TOKENS=2000                 # optional: reply budget (reasoning models need more)
    LLM_GROQ_REASONING=low                   # optional: reasoning_effort for reasoning models

    LLM_ROUTE_HIGH=groq,openrouter,qwen      # today's work
    LLM_ROUTE_MEDIUM=qwen                    # backlog
    LLM_ROUTE_LOW=qwen                       # history checks, backfills

`qwen` is the local server the filing reader already knows (its URL, key and
context come from the FILING_READ_LOCAL_* / LLM_* / AI_* settings). A route
left unset is `qwen` — so with no LLM_* lines at all, behaviour is exactly
what it was before this module existed.

Hosted text is PUBLIC filing text only. Free tiers may log or train on what
they receive; never route user data through a lane.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from typing import Callable, Optional

log = logging.getLogger('llm_lanes')

PRIORITIES = ('high', 'medium', 'low')
LOCAL = 'qwen'
_THINK_RE = re.compile(r'<think>.*?</think>\s*', re.DOTALL)
_JSON_RE = re.compile(r'\{.*\}', re.DOTALL)


# ── configuration, read from the environment each time it is asked ──────

def _env(name: str, default: str = '') -> str:
    return (os.getenv(name) or default).strip()


def provider_names() -> list:
    return [p.strip().lower() for p in _env('LLM_PROVIDERS').split(',') if p.strip()]


def provider_config(name: str) -> Optional[dict]:
    """The hosted provider's settings, or None when it is not fully declared."""
    if name == LOCAL:
        return None
    up = name.upper()
    url, key, model = _env(f'LLM_{up}_URL').rstrip('/'), _env(f'LLM_{up}_KEY'), _env(f'LLM_{up}_MODEL')
    if not (url and key and model):
        return None
    return {
        'name': name, 'url': url, 'key': key, 'model': model,
        'ctx': int(_env(f'LLM_{up}_CTX', '32000')),
        'timeout': int(_env(f'LLM_{up}_TIMEOUT', '120')),
        'cooldown': int(_env(f'LLM_{up}_COOLDOWN', '120')),
        'json': _env(f'LLM_{up}_JSON', 'json_object').lower(),
        # A reasoning model spends tokens thinking before it answers; the
        # caller's budget (sized for Qwen with thinking off) can cut it off.
        'max_tokens': int(_env(f'LLM_{up}_MAX_TOKENS', '0')),
        # low | medium | high, sent as `reasoning_effort` when set. gpt-oss on
        # Groq spent a 20-token reply entirely on reasoning and answered "".
        'reasoning': _env(f'LLM_{up}_REASONING').lower(),
    }


def route(priority: str) -> list:
    """Providers for a priority, in order, keeping only the usable ones.
    Unset → ['qwen']. A name that is not declared is dropped with a warning,
    never guessed at."""
    p = (priority or 'medium').lower()
    raw = _env(f'LLM_ROUTE_{p.upper()}', LOCAL)
    out = []
    for name in [x.strip().lower() for x in raw.split(',') if x.strip()]:
        if name == LOCAL or provider_config(name):
            out.append(name)
        else:
            log.warning('LLM_ROUTE_%s names %r, which has no LLM_%s_URL/KEY/MODEL — skipped',
                        p.upper(), name, name.upper())
    return out or [LOCAL]


# ── a 429 parks the provider for a while ─────────────────────────────────

_cooldown_until: dict = {}
_cool_lock = threading.Lock()
_now: Callable[[], float] = time.monotonic          # swapped by tests


def cooling(name: str) -> bool:
    with _cool_lock:
        return _cooldown_until.get(name, 0) > _now()


def park(name: str, seconds: int) -> None:
    with _cool_lock:
        _cooldown_until[name] = _now() + max(1, seconds)


# ── what is in flight, per thread, in THIS process ───────────────────────
# The admin panel's "Running now" reads it: which provider a thread is
# waiting on, and since when. Another process (the pipeline worker) keeps its
# own; the panel says so rather than guessing.

_inflight: dict = {}


def inflight() -> dict:
    with _cool_lock:
        return {k: dict(v) for k, v in _inflight.items()}


# ── the hosted client: OpenAI-compatible, same surface as filing_reader's ─

class RateLimited(Exception):
    def __init__(self, msg: str, retry_after: Optional[int] = None):
        super().__init__(msg)
        self.retry_after = retry_after


def _retry_after(resp) -> Optional[int]:
    """Seconds the provider asks us to wait, from its own headers."""
    h = getattr(resp, 'headers', None) or {}
    for key in ('retry-after', 'Retry-After', 'x-ratelimit-reset-tokens', 'x-ratelimit-reset-requests'):
        v = h.get(key)
        if not v:
            continue
        v = str(v).strip()
        # '7.66s', '2m59.56s', '12', '846ms' — 'ms' before 'm', or 846ms
        # reads as 846 MINUTES and parks the provider for 14 hours.
        parts = re.findall(r'(\d+(?:\.\d+)?)(ms|h|m|s)?', v)
        total = sum(float(n) * {'ms': 0.001, 'h': 3600, 'm': 60, 's': 1, '': 1}[u]
                    for n, u in parts)
        if total > 0:
            return int(total) + 1
    return None


class _Usage:
    __slots__ = ('input_tokens', 'output_tokens')

    def __init__(self, inp, out):
        self.input_tokens, self.output_tokens = inp, out


class LaneResp:
    """What `.messages.parse` returns: parsed_output, usage, and `label` —
    '<provider>:<model the server reported>', which is what the row stores."""
    __slots__ = ('parsed_output', 'usage', 'model', 'label', 'provider')

    def __init__(self, parsed, inp, out, model, provider, label):
        self.parsed_output, self.usage = parsed, _Usage(inp, out)
        self.model, self.provider, self.label = model, provider, label


def _schema_lines(schema: dict) -> str:
    props = schema.get('properties', {})
    lines = ['Return ONLY a JSON object with these fields, no prose before or after it:']
    for name, spec in props.items():
        desc = spec.get('description') or ''
        lines.append(f'  {name}: {desc}' if desc else f'  {name}')
    return '\n'.join(lines)


def _user_text(messages: list) -> str:
    blocks = messages[0]['content']
    if isinstance(blocks, str):
        return blocks
    if any(b.get('type') == 'document' for b in blocks):
        raise ValueError('a hosted lane reads text only')
    return '\n'.join(b['text'] for b in blocks if b.get('type') == 'text')


_NUM_RE = re.compile(r'-?\d[\d,]*\.?\d*')


def _types(spec: dict) -> set:
    if 'type' in spec:
        return {spec['type']}
    return {a.get('type') for a in spec.get('anyOf', []) if a.get('type')}


def repair(data, schema: dict):
    """Bend a hosted model's near-miss into the schema, never invent content.
    A number written as text ("Rs 120 crore", "0.8") becomes the number; a
    number field with no number in it, or a missing optional field, becomes
    null; a missing text field becomes ''. Anything else is left for the
    validator to refuse. Owner's OpenRouter reads failed on exactly this."""
    if not isinstance(data, dict):
        return data
    required = set(schema.get('required', []))
    props = schema.get('properties', {})
    # More than one required field missing is a non-answer, not a near miss:
    # leave it for the validator to refuse.
    missing_required = [n for n in required if data.get(n) is None]
    fill_required = len(missing_required) <= 1
    for name, spec in props.items():
        t = _types(spec)
        v = data.get(name)
        if v is None:
            if name not in required:
                data[name] = None
            elif fill_required and 'string' in t:
                data[name] = ''
            continue
        scalar = isinstance(v, (str, int, float, bool))
        if t & {'number', 'integer'} and isinstance(v, str):
            m = _NUM_RE.search(v)
            if m:
                data[name] = float(m.group(0).replace(',', ''))
            elif 'null' in t:
                data[name] = None
        elif 'string' in t and scalar and not isinstance(v, str):
            data[name] = str(v)
    return data


def _extract_json(content: str) -> str:
    content = _THINK_RE.sub('', content or '').strip()
    if content.startswith('```'):
        content = content.strip('`').split('\n', 1)[-1].rsplit('```', 1)[0]
    m = _JSON_RE.search(content)
    return m.group(0) if m else content


class HostedMessages:
    def __init__(self, cfg: dict, max_tokens: int, post=None):
        self.cfg, self.max_tokens = cfg, max_tokens
        if post is None:
            import requests
            post = requests.post
        self._post = post

    def parse(self, *, model=None, max_tokens=None, system, messages, output_format):
        cfg = self.cfg
        schema = output_format.model_json_schema()
        body = {
            'model': cfg['model'],
            'messages': [
                {'role': 'system', 'content': system + '\n\n' + _schema_lines(schema)},
                {'role': 'user', 'content': _user_text(messages)},
            ],
            'max_tokens': cfg.get('max_tokens') or self.max_tokens,
            'temperature': 0,
        }
        if cfg.get('reasoning'):
            body['reasoning_effort'] = cfg['reasoning']
        if cfg['json'] == 'json_schema':
            body['response_format'] = {'type': 'json_schema', 'json_schema': {
                'name': output_format.__name__, 'schema': schema, 'strict': True}}
        elif cfg['json'] != 'none':
            body['response_format'] = {'type': 'json_object'}
        resp = self._post(f"{cfg['url']}/chat/completions", json=body, timeout=cfg['timeout'],
                          headers={'Content-Type': 'application/json',
                                   'Authorization': f"Bearer {cfg['key']}"})
        status = getattr(resp, 'status_code', 200)
        if status == 429:
            try:
                detail = resp.text[:200]
            except Exception:
                detail = ''
            raise RateLimited(f"{cfg['name']}: 429 rate limited — {detail}", _retry_after(resp))
        if status >= 400:
            # The provider's own message ("model not found", "context too long")
            # is the diagnosis; a bare status code is not.
            try:
                detail = resp.text[:300]
            except Exception:
                detail = ''
            raise RuntimeError(f"HTTP {status} from {cfg['name']} (model {cfg['model']}): {detail}")
        resp.raise_for_status()
        data = resp.json()
        content = (data.get('choices') or [{}])[0].get('message', {}).get('content') or ''
        raw = _extract_json(content)
        try:
            parsed = output_format.model_validate_json(raw)
        except Exception:
            parsed = output_format.model_validate(repair(json.loads(raw), schema))
        usage = data.get('usage') or {}
        served = str(data.get('model') or cfg['model'])
        return LaneResp(parsed, int(usage.get('prompt_tokens') or 0), int(usage.get('completion_tokens') or 0),
                        served, cfg['name'], f"{cfg['name']}:{os.path.basename(served)[:80]}")


# ── the routed client ────────────────────────────────────────────────────

class _RoutedMessages:
    def __init__(self, names: list, local_factory, max_tokens: int, post=None):
        self.names, self.local_factory, self.max_tokens, self._post = names, local_factory, max_tokens, post
        self._clients: dict = {}

    def _client(self, name):
        if name not in self._clients:
            if name == LOCAL:
                self._clients[name] = self.local_factory()
            else:
                self._clients[name] = type('C', (), {})()
                self._clients[name].messages = HostedMessages(provider_config(name), self.max_tokens, self._post)
        return self._clients[name]

    def parse(self, **kw):
        errors = []
        for name in self.names:
            if name != LOCAL and cooling(name):
                errors.append(f'{name}: cooling down')
                continue
            tname = threading.current_thread().name
            with _cool_lock:
                _inflight[tname] = {'provider': name, 'since': time.time()}
            try:
                resp = self._client(name).messages.parse(**kw)
            except RateLimited as e:
                # The provider's own wait wins when it says one; the configured
                # cooldown is the floor for a 429 that names none.
                park(name, max(provider_config(name)['cooldown'], e.retry_after or 0))
                log.info('%s — parked, trying the next provider', e)
                errors.append(str(e))
                continue
            except Exception as e:
                errors.append(f'{name}: {e}'[:300])
                log.warning('lane provider %s failed: %s', name, str(e)[:200])
                continue
            finally:
                with _cool_lock:
                    _inflight.pop(tname, None)
            if name == LOCAL:
                served = str(getattr(resp, 'model', None) or 'qwen')
                u = getattr(resp, 'usage', None)
                return LaneResp(resp.parsed_output, getattr(u, 'input_tokens', 0), getattr(u, 'output_tokens', 0),
                                served, LOCAL, 'local:' + os.path.basename(served)[:80])
            return resp
        raise RuntimeError('; '.join(errors) or 'no provider in route')


class RoutedClient:
    """`.messages.parse` like the SDK client; tries the route in order.
    `char_budget` is the smallest context in the route, so a document fitted
    for it fits every provider the call can fall through to."""

    def __init__(self, names: list, local_factory, max_tokens: int, local_ctx: int, post=None):
        self.names = names
        self.messages = _RoutedMessages(names, local_factory, max_tokens, post)
        ctxs = [local_ctx if n == LOCAL else provider_config(n)['ctx'] for n in names]
        self.ctx_tokens = min(ctxs)


def describe() -> dict:
    """For /internal/health: the routes as configured, keys never included."""
    return {p: route(p) for p in PRIORITIES} | {
        'providers': {n: (lambda c: {'model': c['model'], 'url': c['url']} if c else 'incomplete')(provider_config(n))
                      for n in provider_names()},
        'cooling': [n for n in provider_names() if cooling(n)],
    }


__all__ = ['route', 'provider_config', 'RoutedClient', 'HostedMessages', 'RateLimited', 'describe',
           'PRIORITIES', 'LOCAL']
