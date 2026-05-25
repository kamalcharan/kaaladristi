"""
VaNi Interaction Logger
=======================
Fire-and-forget insertion into vn_interaction_log on vani_db.

Configuration:
    VANI_DB_URL=postgresql://user:pass@host:5432/vani_db

Usage:
    from app.middleware.interaction_logger import log_llm_interaction

    log_llm_interaction(
        product="dristiq",
        endpoint="/api/ai/panchang-insight",
        user_input=user_msg,
        llm_response=insight,
        system_prompt=skill.system,
        context_payload={"tithi": ...},
        model_version=AI_MODEL,
        latency_ms=142,
    )

Never raises — all errors go to stderr only.
"""

from __future__ import annotations

import json
import os
import sys
import threading

_VANI_DB_URL: str = os.getenv("VANI_DB_URL", "")


def _do_insert(
    product: str,
    endpoint: str,
    user_input: str,
    llm_response: str,
    system_prompt: str | None,
    context_payload: dict | None,
    model_version: str | None,
    latency_ms: int | None,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    session_id: str | None,
    user_id: str | None,
) -> None:
    if not _VANI_DB_URL:
        return
    try:
        import psycopg2
        import psycopg2.extras
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
        conn.close()
    except Exception as e:
        print(f"[interaction_logger] insert failed: {e}", file=sys.stderr)


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
) -> None:
    """Insert one interaction log row. Returns immediately — insert runs in a daemon thread."""
    threading.Thread(
        target=_do_insert,
        args=(
            product, endpoint, user_input, llm_response,
            system_prompt, context_payload, model_version,
            latency_ms, prompt_tokens, completion_tokens,
            session_id, user_id,
        ),
        daemon=True,
    ).start()
