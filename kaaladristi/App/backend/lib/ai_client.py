"""
Kāla-Drishti — AI Client (vendor-agnostic, direct HTTP)
=========================================================
No SDK dependency. Uses requests directly against the provider's REST API.

Configuration (App/.env):
  AI_ENABLED=true
  AI_PROVIDER=anthropic          # anthropic | openai  (default: anthropic)
  AI_API_KEY=sk-ant-…            # generic key var (ANTHROPIC_API_KEY also accepted)
  AI_MODEL=claude-haiku-4-5      # any model ID the provider supports
  AI_BASE_URL=                   # optional override — e.g. a proxy or local server

Usage:
  from lib.ai_client import complete, AI_ENABLED

  text = complete(system="...", user="...", max_tokens=200)
  # Returns str on success, None if disabled / misconfigured / error
"""

import os
import logging

import requests as _requests

log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() == "true"
AI_PROVIDER: str = os.getenv("AI_PROVIDER", "anthropic").lower()
AI_MODEL: str    = os.getenv("AI_MODEL", "claude-haiku-4-5")

# Accept generic AI_API_KEY or the legacy ANTHROPIC_API_KEY
_API_KEY: str    = os.getenv("AI_API_KEY") or os.getenv("ANTHROPIC_API_KEY", "")
_BASE_URL: str   = os.getenv("AI_BASE_URL", "").rstrip("/")

_PROVIDER_BASE: dict[str, str] = {
    "anthropic": "https://api.anthropic.com",
    "openai":    "https://api.openai.com",
}


# ── Request builders ──────────────────────────────────────────────────────────

def _anthropic_req(system: str, user: str, max_tokens: int) -> dict:
    base = _BASE_URL or _PROVIDER_BASE["anthropic"]
    return {
        "url": f"{base}/v1/messages",
        "headers": {
            "x-api-key": _API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        "json": {
            "model": AI_MODEL,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        },
    }


def _openai_req(system: str, user: str, max_tokens: int) -> dict:
    base = _BASE_URL or _PROVIDER_BASE["openai"]
    return {
        "url": f"{base}/v1/chat/completions",
        "headers": {
            "Authorization": f"Bearer {_API_KEY}",
            "content-type": "application/json",
        },
        "json": {
            "model": AI_MODEL,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
        },
    }


_BUILDERS = {
    "anthropic": _anthropic_req,
    "openai":    _openai_req,
}


# ── Response parsers ──────────────────────────────────────────────────────────

def _anthropic_parse(data: dict) -> str | None:
    content = data.get("content", [])
    return content[0].get("text", "").strip() if content else None


def _openai_parse(data: dict) -> str | None:
    choices = data.get("choices", [])
    return choices[0].get("message", {}).get("content", "").strip() if choices else None


_PARSERS = {
    "anthropic": _anthropic_parse,
    "openai":    _openai_parse,
}


# ── Public API ────────────────────────────────────────────────────────────────

def complete(system: str, user: str, max_tokens: int = 200) -> str | None:
    """
    Send a single chat completion. Returns the text response or None.
    All errors are caught — callers never need to handle exceptions.
    """
    if not AI_ENABLED:
        return None

    if not _API_KEY:
        log.warning("AI_ENABLED=true but AI_API_KEY / ANTHROPIC_API_KEY is not set")
        return None

    build = _BUILDERS.get(AI_PROVIDER)
    parse = _PARSERS.get(AI_PROVIDER)
    if not build or not parse:
        log.error(f"Unknown AI_PROVIDER '{AI_PROVIDER}' — supported: anthropic, openai")
        return None

    req = build(system, user, max_tokens)
    try:
        resp = _requests.post(req["url"], headers=req["headers"], json=req["json"], timeout=30)
        resp.raise_for_status()
        return parse(resp.json())
    except _requests.HTTPError as e:
        log.error(f"AI HTTP {e.response.status_code} ({AI_PROVIDER}): {e.response.text[:200]}")
        return None
    except Exception as e:
        log.error(f"AI request failed ({AI_PROVIDER}): {e}")
        return None
