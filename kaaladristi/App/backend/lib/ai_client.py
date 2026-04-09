"""
Kāla-Drishti — AI Client
=========================
Thin wrapper around the Anthropic SDK, fully driven by environment variables.

Configuration (App/.env):
  AI_ENABLED=true            # master switch (default: false)
  AI_MODEL=claude-haiku-4-5  # any Anthropic model ID
  ANTHROPIC_API_KEY=sk-ant-…

Usage:
  from lib.ai_client import get_client, AI_ENABLED, AI_MODEL

  client = get_client()
  if client:
      resp = client.messages.create(
          model=AI_MODEL,
          max_tokens=200,
          system="…",
          messages=[{"role": "user", "content": "…"}],
      )
      text = resp.content[0].text
"""

import os
import logging

log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() == "true"
AI_MODEL: str    = os.getenv("AI_MODEL", "claude-haiku-4-5")
_API_KEY: str    = os.getenv("ANTHROPIC_API_KEY", "")

_client = None


# ── Public API ────────────────────────────────────────────────────────────────

def get_client():
    """
    Return a configured Anthropic client, or None if AI is disabled / misconfigured.
    The client is a singleton — initialised once on first call.
    """
    global _client

    if not AI_ENABLED:
        return None

    if not _API_KEY:
        log.warning("AI_ENABLED=true but ANTHROPIC_API_KEY is not set — AI features disabled")
        return None

    if _client is None:
        try:
            import anthropic
            _client = anthropic.Anthropic(api_key=_API_KEY)
            log.info(f"AI client initialised (model: {AI_MODEL})")
        except ImportError:
            log.error("'anthropic' package not installed — run: pip install anthropic")
            return None

    return _client
