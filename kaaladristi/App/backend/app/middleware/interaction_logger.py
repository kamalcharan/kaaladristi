"""
VaNi Interaction Logger
=======================
Synchronous insertion into vn_interaction_log on vani_db.
Returns the inserted UUID so callers can include it in API responses
for client-side feedback (thumbs up/down).

Configuration:
    VANI_DB_URL=postgresql://user:pass@host:5432/vani_db

Usage:
    from app.middleware.interaction_logger import log_llm_interaction

    log_id = log_llm_interaction(
        product="dristiq",
        endpoint="/api/ai/panchang-insight",
        user_input=user_msg,
        llm_response=insight,
        system_prompt=skill.system,
        context_payload={"tithi": ...},
        model_version=AI_MODEL,
        latency_ms=142,
    )
    # log_id is a UUID string or None if VANI_DB_URL unset / insert failed

Never raises — all errors go to stderr only.
"""

from __future__ import annotations

import json
import os
import sys

_VANI_DB_URL: str = os.getenv("VANI_DB_URL", "")


def log_llm_interaction(
    product: str,
    endpoint: str,
    user_input: str,
    llm_response: str,
    system_prompt: str | None = None,
    context_payload: dict | None = None,
    model_version: str | None = None,
    latency_ms: int | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
) -> str | None:
    """Insert one interaction log row. Returns the UUID string or None on failure."""
    if not _VANI_DB_URL:
        return None
    try:
        import psycopg2
        conn = psycopg2.connect(_VANI_DB_URL)
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO vn_interaction_log (
                        product, endpoint, user_input, llm_response,
                        system_prompt, context_payload, model_version,
                        latency_ms, prompt_tokens, completion_tokens,
                        session_id, user_id
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s::uuid, %s::uuid
                    )
                    RETURNING id
                    """,
                    (
                        product, endpoint, user_input, llm_response,
                        system_prompt,
                        json.dumps(context_payload) if context_payload else None,
                        model_version,
                        latency_ms, prompt_tokens, completion_tokens,
                        session_id, user_id,
                    ),
                )
                row = cur.fetchone()
        conn.close()
        return str(row[0]) if row else None
    except Exception as e:
        print(f"[interaction_logger] insert failed: {e}", file=sys.stderr)
        return None
