"""
Kāla-Drishti — VaNi Cache Layer
=================================
DB-backed persistent cache for VaNi conversational responses.
Uses km_vani_cache table (migration 038).

Cache key = intent_id + context_hash (bucketed signal values).
When the underlying data state changes, the context_hash changes,
so stale responses are never served.

The cache also supports TTL — responses expire after intent-specific
hours even if the context hasn't changed.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)


def _make_context_hash(context: dict) -> str:
    """Deterministic hash of context values for cache keying.

    Context values should already be bucketed (e.g., zone names
    instead of raw floats) so that minor numeric changes don't
    bust the cache.
    """
    canonical = json.dumps(context, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def make_cache_key(intent_id: str, context: dict) -> str:
    """Build a cache key from intent + context hash."""
    h = _make_context_hash(context)
    return f"vani:{intent_id}:{h}"


def get_cached(db, cache_key: str) -> str | None:
    """Look up a cached response. Returns text or None.

    Also increments hit_count on cache hit.
    """
    try:
        rows = db.select(
            'km_vani_cache', '*',
            filters={'cache_key': cache_key},
            limit=1,
        )
    except Exception as e:
        log.warning(f"VaNi cache read failed: {e}")
        return None

    if not rows:
        return None

    row = rows[0]
    expires = row.get('expires_at')
    if expires:
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires.replace('Z', '+00:00'))
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            return None

    try:
        db.patch(
            'km_vani_cache',
            filters={'cache_key': cache_key},
            data={'hit_count': (row.get('hit_count', 0) or 0) + 1},
        )
    except Exception:
        pass

    return row.get('response_text')


def set_cached(
    db,
    cache_key: str,
    intent_id: str,
    context_hash: str,
    response_text: str,
    ttl_hours: int,
    llm_provider: str = None,
    llm_model: str = None,
) -> bool:
    """Store a response in the cache. Returns True on success."""
    now = datetime.now(timezone.utc)
    record = {
        'cache_key': cache_key,
        'intent_id': intent_id,
        'context_hash': context_hash,
        'response_text': response_text,
        'llm_provider': llm_provider,
        'llm_model': llm_model,
        'computed_at': now.isoformat(),
        'expires_at': (now + timedelta(hours=ttl_hours)).isoformat(),
        'hit_count': 0,
    }
    try:
        db.upsert('km_vani_cache', [record], on_conflict='cache_key')
        return True
    except Exception as e:
        log.warning(f"VaNi cache write failed: {e}")
        return False
