"""FastAPI surface for pipeline v2.

All routes under /api/pipeline2. Runs on its own uvicorn process so the
legacy pipeline_api.py stays untouched. Nginx should proxy
/api/pipeline2/ to this service (see docker-compose addition).

Run:
    uvicorn pipeline2_api:app --host 0.0.0.0 --port 8101 --workers 1
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Make sibling modules importable whether launched via uvicorn or python.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from lib.auth import get_current_user_id as _get_current_user_id  # noqa: E402
from lib.config import DATABASE_URL  # noqa: E402
from lib.db_client import get_db as _get_db  # noqa: E402

# Optional AI / assembler modules — gracefully absent if not installed
try:
    from lib.ai_prompts import SKILLS as _AI_SKILLS          # noqa: E402
    from lib.ai_client import complete as _ai_complete, AI_ENABLED as _AI_ENABLED, AI_MODEL as _AI_MODEL  # noqa: E402
    from lib.data_assemblers import (                         # noqa: E402
        assemble_instrument_context,
        assemble_market_pulse_context,
    )
    from lib.vani_intents import INTENTS as _VANI_INTENTS, get_intents_for_page as _get_intents_for_page  # noqa: E402
    from lib.vani_assemblers import (                         # noqa: E402
        assemble_dashboard_context,
        format_user_message,
        assemble_astro_calendar_context,
        format_astro_user_message,
        assemble_industry_transition_context,
        format_industry_user_message,
        assemble_equity_context,
        format_equity_user_message,
    )
    _AI_OPTIONAL_OK = True
except ImportError:
    _AI_SKILLS = {}
    _VANI_INTENTS = {}
    _get_intents_for_page = lambda page: {}  # noqa: E731
    _ai_complete = lambda **_: None  # noqa: E731
    _AI_ENABLED = False
    _AI_MODEL = ""
    _AI_OPTIONAL_OK = False

try:
    from app.middleware.interaction_logger import log_llm_interaction as _log_interaction  # noqa: E402
except ImportError:
    _log_interaction = lambda **_: None  # noqa: E731

from pipeline2 import health as v2_health  # noqa: E402
from pipeline2 import scheduler as v2_scheduler  # noqa: E402
from pipeline2.handlers import KNOWN_DIMENSIONS, FIXABLE_DIMENSIONS  # noqa: E402
from pipeline2.health import label_for as _label_for, DOWNLOAD_DIMENSIONS  # noqa: E402


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [pipeline2-api] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('pipeline2-api')


# ── App-scoped state ──────────────────────────────────────────────────────

_scheduler = None
_worker_process: subprocess.Popen | None = None


def _conn(statement_timeout_ms: int = 0):
    """Return a fresh psycopg2 connection. Callers must close."""
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL not set')
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
    if statement_timeout_ms:
        with conn.cursor() as cur:
            cur.execute(f'SET statement_timeout = {statement_timeout_ms}')
    return conn


# ── Lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    log.info('pipeline2-api starting up')
    try:
        _scheduler = v2_scheduler.start()
        log.info('scheduler started')
    except Exception as exc:
        log.warning(f'scheduler start failed (non-fatal): {exc}')
    yield
    log.info('pipeline2-api shutting down')
    if _scheduler:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass


app = FastAPI(title='KaalaDristi Pipeline v2 API', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ── Pydantic models ───────────────────────────────────────────────────────

class TriggerRequest(BaseModel):
    dimension: str
    date: Optional[str] = None
    force: bool = False

class BulkTriggerRequest(BaseModel):
    dimensions: list[str]
    date: Optional[str] = None
    force: bool = False

class SyncLogEntry(BaseModel):
    dimension: str
    trade_date: str
    status: str
    rows_affected: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class InsightRequest(BaseModel):
    date: Optional[str] = None
    force_refresh: bool = False

class InstrumentInsightRequest(BaseModel):
    instrument_id: int
    instrument_type: str  # 'index' | 'equity'
    force_refresh: bool = False

class CorrelationInsightRequest(BaseModel):
    item_a: str
    item_b: str
    display_name_a: str
    display_name_b: str
    description_a: str
    description_b: str
    shape: str
    n_instances: int
    hit_rate: float
    avg_return_5d_bull: Optional[float] = None
    avg_return_5d_bear: Optional[float] = None
    avg_return_22d_bull: Optional[float] = None
    avg_return_22d_bear: Optional[float] = None
    currently_active: bool = False
    force_refresh: bool = False

class FrameworkRequest(BaseModel):
    name: Optional[str] = None
    instruments: Optional[list[str]] = None
    blocks: Optional[list[dict]] = None
    chart_overlays: Optional[list[dict]] = None
    template_id: Optional[str] = None
    tier_at_creation: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    icp: Optional[str] = None
    onboarded: Optional[bool] = None

class PaymentOrderRequest(BaseModel):
    tier: str  # 'beta' | 'paid'
    amount_paise: int

class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tier: str
    amount_paise: int

class RazorpayWebhookRequest(BaseModel):
    event: Optional[str] = None

# ── In-memory caches ──────────────────────────────────────────────────────

_insight_cache: dict[str, tuple[str, float]] = {}   # key → (text, timestamp)
_INSIGHT_TTL = 86400  # 24 h

_vani_cache: dict[str, tuple[str, float]] = {}  # key → (text, timestamp)
_VANI_TTL = 86400  # 24 h

_corr_insight_cache: dict[str, str] = {}   # key → insight text (permanent, no TTL)


def _cache_get(cache: dict, key: str, ttl: float) -> str | None:
    entry = cache.get(key)
    if entry and (time.time() - entry[1]) < ttl:
        return entry[0]
    return None


def _cache_set(cache: dict, key: str, value: str) -> None:
    cache[key] = (value, time.time())


# ── Helpers ───────────────────────────────────────────────────────────────

def _last_trading_date() -> str:
    """Return the most recent trade_date present in km_index_eod."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT MAX(trade_date) FROM km_index_eod")
            row = cur.fetchone()
            if row and row[0]:
                return str(row[0])
        raise HTTPException(status_code=503, detail='No trading data found')
    finally:
        conn.close()


def _resolve_date(date_str: Optional[str]) -> str:
    if date_str:
        return date_str
    return _last_trading_date()


def _log_interaction(**kwargs):
    """Wrapper so missing interaction logger is a no-op."""
    try:
        from app.middleware.interaction_logger import log_llm_interaction
        log_llm_interaction(**kwargs)
    except Exception:
        pass


# ── Routes: health ────────────────────────────────────────────────────────

@app.get('/api/pipeline2/health')
def get_health():
    status = v2_health.get_status()
    return status


@app.get('/api/pipeline2/health/detailed')
def get_health_detailed():
    status = v2_health.get_status()
    conn = _conn()
    try:
        details = {}
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for dim in KNOWN_DIMENSIONS:
                cur.execute(
                    """
                    SELECT status, trade_date, rows_affected, error_message, completed_at
                    FROM km_data_sync_log
                    WHERE dimension = %s
                    ORDER BY started_at DESC
                    LIMIT 1
                    """,
                    (dim,),
                )
                row = cur.fetchone()
                details[dim] = dict(row) if row else None
        status['details'] = details
        return status
    finally:
        conn.close()


# ── Routes: pipeline trigger ──────────────────────────────────────────────

@app.post('/api/pipeline2/trigger')
def trigger_dimension(req: TriggerRequest):
    if req.dimension not in KNOWN_DIMENSIONS:
        raise HTTPException(status_code=400, detail=f'Unknown dimension: {req.dimension}')
    try:
        v2_scheduler.trigger_now(req.dimension, trade_date=req.date, force=req.force)
        return {'ok': True, 'dimension': req.dimension}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post('/api/pipeline2/trigger-bulk')
def trigger_bulk(req: BulkTriggerRequest):
    unknown = [d for d in req.dimensions if d not in KNOWN_DIMENSIONS]
    if unknown:
        raise HTTPException(status_code=400, detail=f'Unknown dimensions: {unknown}')
    results = {}
    for dim in req.dimensions:
        try:
            v2_scheduler.trigger_now(dim, trade_date=req.date, force=req.force)
            results[dim] = 'triggered'
        except Exception as exc:
            results[dim] = f'error: {exc}'
    return {'ok': True, 'results': results}


@app.post('/api/pipeline2/fix')
def fix_dimension(req: TriggerRequest):
    if req.dimension not in FIXABLE_DIMENSIONS:
        raise HTTPException(status_code=400, detail=f'Not fixable: {req.dimension}')
    try:
        v2_scheduler.trigger_now(req.dimension, trade_date=req.date, force=True)
        return {'ok': True, 'dimension': req.dimension}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Routes: sync log ──────────────────────────────────────────────────────

@app.get('/api/pipeline2/sync-log')
def get_sync_log(limit: int = Query(default=50, le=200)):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT dimension, trade_date, status, rows_affected,
                       error_message, started_at, completed_at
                FROM km_data_sync_log
                ORDER BY started_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.get('/api/pipeline2/sync-log/{dimension}')
def get_sync_log_dimension(dimension: str, limit: int = Query(default=20, le=100)):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT dimension, trade_date, status, rows_affected,
                       error_message, started_at, completed_at
                FROM km_data_sync_log
                WHERE dimension = %s
                ORDER BY started_at DESC
                LIMIT %s
                """,
                (dimension, limit),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Routes: AI insights (legacy per-skill endpoints) ─────────────────────

@app.get('/api/ai/panchang-insight')
def get_panchang_insight(date: Optional[str] = None, force_refresh: bool = False):
    target_date = _resolve_date(date)
    cache_key = f'panchang:{target_date}'

    if not force_refresh:
        cached = _cache_get(_insight_cache, cache_key, _INSIGHT_TTL)
        if cached:
            return {'insight': cached, 'date': target_date, 'cached': True}

    if not _AI_ENABLED:
        return {'insight': None, 'date': target_date, 'cached': False}

    skill = _AI_SKILLS.get('panchang_insight')
    if not skill:
        return {'insight': None, 'date': target_date, 'cached': False}

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT vara, nakshatra_name, tithi, yoga, paksha,
                       dlnl_match, is_ekadashi, is_purnima, hemisphere_event
                FROM km_daily_panchang
                WHERE trade_date = %s
                """,
                (target_date,),
            )
            panchang = cur.fetchone()
    finally:
        conn.close()

    if not panchang:
        return {'insight': None, 'date': target_date, 'cached': False}

    user_msg = (
        f"Date: {target_date}\n"
        f"Vara (weekday lord): {panchang['vara']}\n"
        f"Nakshatra: {panchang['nakshatra_name']}\n"
        f"Tithi: {panchang['tithi']} ({panchang['paksha']} paksha)\n"
        f"Yoga: {panchang['yoga']}\n"
        f"DL/NL match: {panchang['dlnl_match']}\n"
        f"Ekadashi: {panchang['is_ekadashi']}, Purnima: {panchang['is_purnima']}\n"
        f"Hemisphere event: {panchang.get('hemisphere_event') or 'none'}\n"
        "Provide a brief educational insight about the market significance of today's panchang."
    )

    insight = _ai_complete(
        system=skill.system,
        user=user_msg,
        max_tokens=skill.max_tokens,
    )

    if insight:
        _cache_set(_insight_cache, cache_key, insight)

    return {'insight': insight, 'date': target_date, 'cached': False}


@app.get('/api/ai/breadth-insight')
def get_breadth_insight(force_refresh: bool = False):
    cache_key = 'breadth:latest'

    if not force_refresh:
        cached = _cache_get(_insight_cache, cache_key, _INSIGHT_TTL)
        if cached:
            return {'insight': cached, 'cached': True}

    if not _AI_ENABLED:
        return {'insight': None, 'cached': False}

    skill = _AI_SKILLS.get('breadth_insight')
    if not skill:
        return {'insight': None, 'cached': False}

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, breadth_score, signal_label, ema_20_above,
                       ema_50_above, ema_200_above
                FROM km_market_breadth
                ORDER BY trade_date DESC
                LIMIT 5
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        return {'insight': None, 'cached': False}

    data_text = '\n'.join(
        f"{r['trade_date']}: score={r['breadth_score']}, label={r['signal_label']}, "
        f"ema20={r['ema_20_above']}%, ema50={r['ema_50_above']}%, ema200={r['ema_200_above']}%"
        for r in rows
    )
    user_msg = f"Recent market breadth data:\n{data_text}\nExplain what this breadth pattern suggests about market health."

    insight = _ai_complete(
        system=skill.system,
        user=user_msg,
        max_tokens=skill.max_tokens,
    )

    if insight:
        _cache_set(_insight_cache, cache_key, insight)

    return {'insight': insight, 'cached': False}


@app.get('/api/ai/breadth-roc-insight')
def get_breadth_roc_insight(force_refresh: bool = False):
    cache_key = 'breadth_roc:latest'

    if not force_refresh:
        cached = _cache_get(_insight_cache, cache_key, _INSIGHT_TTL)
        if cached:
            return {'insight': cached, 'cached': True}

    if not _AI_ENABLED:
        return {'insight': None, 'cached': False}

    skill = _AI_SKILLS.get('breadth_roc_insight')
    if not skill:
        return {'insight': None, 'cached': False}

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, roc_value, signal_label
                FROM km_breadth_roc
                ORDER BY trade_date DESC
                LIMIT 5
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        return {'insight': None, 'cached': False}

    data_text = '\n'.join(
        f"{r['trade_date']}: roc={r['roc_value']}, label={r['signal_label']}"
        for r in rows
    )
    user_msg = f"Recent breadth ROC data:\n{data_text}\nExplain what this momentum pattern suggests about market direction."

    insight = _ai_complete(
        system=skill.system,
        user=user_msg,
        max_tokens=skill.max_tokens,
    )

    if insight:
        _cache_set(_insight_cache, cache_key, insight)

    return {'insight': insight, 'cached': False}


# ── Routes: VaNi unified insight engine ───────────────────────────────────

@app.post('/api/vani/daily')
async def get_vani_daily(req: InsightRequest, user_id: str = Depends(_get_current_user_id)):
    """
    VaNi Morning Brief — returns up to 3 observation cards for the given date.
    Each card has: title, body, sentiment, action, action_target.
    """
    target_date = _resolve_date(req.date)

    if not _AI_ENABLED:
        return {'date': target_date, 'observations': [], 'ai_enabled': False}

    skill = _AI_SKILLS.get('vani_morning_brief')
    if not skill:
        return {'date': target_date, 'observations': [], 'ai_enabled': True, 'error': 'skill_missing'}

    conn = _conn()
    try:
        # 1. Fetch panchang
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT vara, nakshatra_name, tithi, yoga, paksha,
                       dlnl_match, is_ekadashi, is_purnima, hemisphere_event
                FROM km_daily_panchang WHERE trade_date = %s
                """,
                (target_date,),
            )
            panchang = cur.fetchone()

        # 2. Fetch active astro rule signals for this date (limit 5)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT rs.rule_id, rs.signal, rs.strength, rs.details,
                       arm.rule_code, arm.rule_name, arm.outcome, arm.probability_label,
                       arm.rule_type
                FROM km_rule_signals rs
                JOIN km_astro_rule_master arm ON arm.id = rs.rule_id
                WHERE rs.date = %s AND arm.is_active = TRUE AND arm.is_deleted = FALSE
                ORDER BY rs.strength DESC NULLS LAST
                LIMIT 5
                """,
                (target_date,),
            )
            rule_signals = cur.fetchall()

        # 3. Fetch top confluences for this date
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT item_a, item_b, shape, n_instances, hit_rate,
                       avg_return_5d_bull, avg_return_5d_bear,
                       avg_return_22d_bull, avg_return_22d_bear
                FROM km_factor_correlation_stats
                WHERE is_active = TRUE
                ORDER BY hit_rate DESC NULLS LAST
                LIMIT 3
                """,
            )
            confluences = cur.fetchall()

    finally:
        conn.close()

    observations = []

    # ── Card 1: Panchang (always first) ──────────────────────────────────
    if panchang:
        panchang_key = f'panchang:{target_date}'
        cached_panchang = _cache_get(_vani_cache, panchang_key, _VANI_TTL)
        if cached_panchang and not req.force_refresh:
            observations.append(json.loads(cached_panchang))
        else:
            # Count active rule signals for the sentence 2 template
            bull_count = sum(1 for r in rule_signals if (r.get('signal') or '').lower() in ('bullish', 'strong_bullish', 'mild_bullish'))
            bear_count = sum(1 for r in rule_signals if (r.get('signal') or '').lower() in ('bearish', 'strong_bearish', 'mild_bearish'))

            user_msg = (
                f"Date: {target_date}\n"
                f"Vara: {panchang['vara']}, Nakshatra: {panchang['nakshatra_name']}, "
                f"Tithi: {panchang['tithi']} ({panchang['paksha']} paksha), Yoga: {panchang['yoga']}\n"
                f"DL/NL match: {panchang['dlnl_match']}, "
                f"Ekadashi: {panchang['is_ekadashi']}, Purnima: {panchang['is_purnima']}\n"
                f"Hemisphere event: {panchang.get('hemisphere_event') or 'none'}\n"
                f"Active rule signals today: {bull_count} bullish, {bear_count} bearish\n\n"
                "Return JSON: {\"title\": \"...\", \"body\": \"...\", \"sentiment\": \"bullish|bearish|neutral\", "
                "\"action\": \"navigate\", \"action_target\": \"/panchang\"}"
            )

            raw = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
            card = _parse_vani_card(raw, fallback_title='Panchang', fallback_action='/panchang')
            if card:
                _cache_set(_vani_cache, panchang_key, json.dumps(card))
                observations.append(card)

    # ── Cards 2-3: Confluences (priority) then astro rules ───────────────
    slots_left = 3 - len(observations)

    # Try confluences first
    for conf in confluences[:slots_left]:
        if not conf:
            continue
        conf_key = f'confluence:{conf["item_a"]}:{conf["item_b"]}:{target_date}'
        cached_conf = _cache_get(_vani_cache, conf_key, _VANI_TTL)
        if cached_conf and not req.force_refresh:
            observations.append(json.loads(cached_conf))
            slots_left -= 1
            continue

        user_msg = (
            f"Date: {target_date}\n"
            f"Correlation: {conf['item_a']} × {conf['item_b']}\n"
            f"Pattern shape: {conf['shape']}\n"
            f"Instances: {conf['n_instances']}, Hit rate: {conf['hit_rate']:.0%}\n"
            f"5D avg returns: bull={conf.get('avg_return_5d_bull') or 'N/A'}, bear={conf.get('avg_return_5d_bear') or 'N/A'}\n\n"
            "Return JSON: {\"title\": \"...\", \"body\": \"...\", \"sentiment\": \"bullish|bearish|neutral\", "
            f"\"action\": \"navigate\", \"action_target\": \"/correlation/{conf['item_a']}/{conf['item_b']}\"}}"
        )

        raw = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
        card = _parse_vani_card(raw, fallback_title='Correlation', fallback_action=f"/correlation/{conf['item_a']}/{conf['item_b']}")
        if card:
            _cache_set(_vani_cache, conf_key, json.dumps(card))
            observations.append(card)
            slots_left -= 1

    # Fill remaining with astro rule signals
    slots_left = 3 - len(observations)
    for rs in rule_signals[:slots_left]:
        rule_key = f'rule:astro_rule:{rs["rule_code"]}:{target_date}'
        cached_rule = _cache_get(_vani_cache, rule_key, _VANI_TTL)
        if cached_rule and not req.force_refresh:
            observations.append(json.loads(cached_rule))
            continue

        user_msg = (
            f"Date: {target_date}\n"
            f"Rule: {rs['rule_name']} ({rs['rule_code']})\n"
            f"Signal: {rs['signal']}, Strength: {rs.get('strength') or 'N/A'}\n"
            f"Outcome: {rs.get('outcome') or 'N/A'}, "
            f"Probability label: {rs.get('probability_label') or 'N/A'}\n"
            f"Details: {rs.get('details') or 'none'}\n\n"
            "Return JSON: {\"title\": \"...\", \"body\": \"...\", \"sentiment\": \"bullish|bearish|neutral\", "
            f"\"action\": \"navigate\", \"action_target\": \"/rules/{rs['rule_id']}\"}}"
        )

        raw = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)
        card = _parse_vani_card(raw, fallback_title=rs['rule_name'], fallback_action=f"/rules/{rs['rule_id']}")
        if card:
            _cache_set(_vani_cache, rule_key, json.dumps(card))
            observations.append(card)

    return {
        'date': target_date,
        'observations': observations[:3],
        'ai_enabled': True,
        'model': _AI_MODEL,
    }


def _parse_vani_card(raw: str | None, fallback_title: str, fallback_action: str) -> dict | None:
    """Parse LLM JSON response into a VaNi card dict. Returns None on failure."""
    if not raw:
        return None
    try:
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text
        card = json.loads(text)
        # Validate required fields
        if not card.get('title') or not card.get('body'):
            return None
        return {
            'title': str(card.get('title', fallback_title)),
            'body': str(card.get('body', '')),
            'sentiment': str(card.get('sentiment', 'neutral')),
            'action': str(card.get('action', 'navigate')),
            'action_target': str(card.get('action_target', fallback_action)),
        }
    except Exception:
        return None


@app.post('/api/vani/correlation-insight')
async def get_correlation_insight(
    req: CorrelationInsightRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """
    VaNi Correlation Insight — 2-3 sentence educational insight about a
    factor-pair correlation pattern. Cached permanently per pair+shape.
    """
    pair = tuple(sorted([req.item_a, req.item_b]))
    cache_key = f'corr_insight:{pair[0]}:{pair[1]}:{req.shape}'

    if not req.force_refresh:
        cached = _corr_insight_cache.get(cache_key)
        if cached:
            log.info(f'corr_insight cache HIT: {cache_key}')
            return {'insight': cached, 'cached': True}

    if not _AI_ENABLED:
        return {'insight': None, 'cached': False}

    skill = _AI_SKILLS.get('vani_correlation_insight')
    if not skill:
        return {'insight': None, 'cached': False, 'error': 'skill_missing'}

    returns_text = []
    if req.avg_return_5d_bull is not None:
        returns_text.append(f'5D bull avg: {req.avg_return_5d_bull:+.2f}%')
    if req.avg_return_5d_bear is not None:
        returns_text.append(f'5D bear avg: {req.avg_return_5d_bear:+.2f}%')
    if req.avg_return_22d_bull is not None:
        returns_text.append(f'22D bull avg: {req.avg_return_22d_bull:+.2f}%')
    if req.avg_return_22d_bear is not None:
        returns_text.append(f'22D bear avg: {req.avg_return_22d_bear:+.2f}%')

    user_msg = (
        f"Factor A: {req.display_name_a} — {req.description_a}\n"
        f"Factor B: {req.display_name_b} — {req.description_b}\n"
        f"Correlation shape: {req.shape}\n"
        f"Instances observed: {req.n_instances}\n"
        f"Hit rate: {req.hit_rate:.0%}\n"
        + ('\n'.join(returns_text) + '\n' if returns_text else '')
        + f"Currently active: {req.currently_active}\n\n"
        "Write 2-3 sentences explaining what this correlation pattern means in astronomical market terms. "
        "Return only the insight text, no JSON."
    )

    log.info(f'corr_insight LLM call: {cache_key}')
    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)

    if not insight:
        return {'insight': None, 'cached': False}

    # Forbidden-word guard
    forbidden = ['potential', 'may', 'could', 'might', 'volatility', 'shift',
                 'strategy', 'communication']
    lowered = insight.lower()
    if any(w in lowered for w in forbidden):
        log.warning(f'corr_insight forbidden word detected, returning null: {cache_key}')
        return {'insight': None, 'cached': False}

    _corr_insight_cache[cache_key] = insight
    log.info(f'corr_insight cached: {cache_key}')

    try:
        _log_interaction(
            skill='vani_correlation_insight',
            user_id=user_id,
            input_summary=f'{req.item_a} × {req.item_b} ({req.shape})',
            output_summary=insight[:120],
        )
    except Exception:
        pass

    return {'insight': insight, 'cached': False}


@app.delete('/api/vani/correlation-insight/{item_a}/{item_b}/{shape}')
async def delete_correlation_insight(
    item_a: str,
    item_b: str,
    shape: str,
    user_id: str = Depends(_get_current_user_id),
):
    """Clear cached correlation insight so next call re-generates."""
    pair = tuple(sorted([item_a, item_b]))
    cache_key = f'corr_insight:{pair[0]}:{pair[1]}:{shape}'
    deleted = cache_key in _corr_insight_cache
    _corr_insight_cache.pop(cache_key, None)
    log.info(f'corr_insight cache DELETE: {cache_key}, found={deleted}')
    return {'deleted': 1 if deleted else 0, 'key': cache_key}


# ── Routes: VaNi page insights (unified, intent-driven) ───────────────────

@app.get('/api/vani/intents/{page}')
async def get_vani_intents(page: str, user_id: str = Depends(_get_current_user_id)):
    """Return available VaNi intents for a given page slug."""
    intents = _get_intents_for_page(page)
    return {'page': page, 'intents': intents}


@app.post('/api/vani/insight/{page}/{intent_key}')
async def get_vani_page_insight(
    page: str,
    intent_key: str,
    req: InsightRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """
    Unified VaNi insight endpoint. Assembles context for (page, intent_key),
    calls LLM, caches 24h per (page, intent_key, date).
    """
    target_date = _resolve_date(req.date)
    cache_key = f'vani:{page}:{intent_key}:{target_date}'

    if not req.force_refresh:
        cached = _cache_get(_vani_cache, cache_key, _VANI_TTL)
        if cached:
            return {'insight': cached, 'date': target_date, 'cached': True}

    if not _AI_ENABLED:
        return {'insight': None, 'date': target_date, 'cached': False}

    # Resolve intent → skill
    page_intents = _get_intents_for_page(page)
    intent = page_intents.get(intent_key)
    if not intent:
        raise HTTPException(status_code=404, detail=f'Intent not found: {page}/{intent_key}')

    skill_key = intent.get('skill')
    skill = _AI_SKILLS.get(skill_key) if skill_key else None
    if not skill:
        raise HTTPException(status_code=500, detail=f'Skill not configured: {skill_key}')

    # Assemble context based on page
    try:
        if page == 'dashboard':
            ctx = assemble_dashboard_context(target_date)
            user_msg = format_user_message(ctx, intent_key)
        elif page == 'astro_calendar':
            ctx = assemble_astro_calendar_context(target_date)
            user_msg = format_astro_user_message(ctx, intent_key)
        elif page == 'industry_transition':
            ctx = assemble_industry_transition_context(target_date)
            user_msg = format_industry_user_message(ctx, intent_key)
        else:
            raise HTTPException(status_code=400, detail=f'Unsupported page: {page}')
    except HTTPException:
        raise
    except Exception as exc:
        log.error(f'context assembly error: {page}/{intent_key}: {exc}')
        raise HTTPException(status_code=500, detail=f'Context assembly failed: {exc}')

    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)

    if insight:
        _cache_set(_vani_cache, cache_key, insight)
        try:
            _log_interaction(
                skill=skill_key,
                user_id=user_id,
                input_summary=f'{page}/{intent_key}/{target_date}',
                output_summary=insight[:120],
            )
        except Exception:
            pass

    return {'insight': insight, 'date': target_date, 'cached': False}


# ── Routes: equity VaNi insight ───────────────────────────────────────────

@app.post('/api/vani/equity-insight')
async def get_equity_insight(
    req: InstrumentInsightRequest,
    user_id: str = Depends(_get_current_user_id),
):
    """VaNi insight for a specific equity instrument."""
    cache_key = f'equity_insight:{req.instrument_id}:{req.instrument_type}'

    if not req.force_refresh:
        cached = _cache_get(_vani_cache, cache_key, _VANI_TTL)
        if cached:
            return {'insight': cached, 'cached': True}

    if not _AI_ENABLED:
        return {'insight': None, 'cached': False}

    skill = _AI_SKILLS.get('instrument_insight')
    if not skill:
        return {'insight': None, 'cached': False, 'error': 'skill_missing'}

    try:
        ctx = assemble_equity_context(req.instrument_id)
        user_msg = format_equity_user_message(ctx)
    except Exception as exc:
        log.error(f'equity context assembly error: {exc}')
        return {'insight': None, 'cached': False, 'error': str(exc)}

    insight = _ai_complete(system=skill.system, user=user_msg, max_tokens=skill.max_tokens)

    if insight:
        _cache_set(_vani_cache, cache_key, insight)

    return {'insight': insight, 'cached': False}


# ── Routes: astro signals ─────────────────────────────────────────────────

@app.get('/api/astro/daily-signal')
def get_astro_daily_signal(date: Optional[str] = None):
    target_date = _resolve_date(date)
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT s.trade_date, s.net_score, s.net_signal, s.is_turning,
                       s.event_count, s.dominant_type
                FROM km_astro_daily_signal s
                WHERE s.trade_date = %s
                """,
                (target_date,),
            )
            signal = cur.fetchone()

            # Also fetch active events
            cur.execute(
                """
                SELECT e.rule_id, e.market_impact, e.description,
                       arm.rule_name, arm.rule_code
                FROM km_astro_calendar_2026 e
                JOIN km_astro_rule_master arm ON arm.id = e.rule_id
                WHERE e.event_date = %s
                ORDER BY e.market_impact
                """,
                (target_date,),
            )
            events = cur.fetchall()

        result = dict(signal) if signal else {'trade_date': target_date, 'net_score': 0, 'net_signal': 'neutral'}
        result['active_events'] = [dict(e) for e in events]
        return result
    finally:
        conn.close()


@app.get('/api/astro/signals')
def get_astro_signals(
    from_date: str = Query(..., alias='from'),
    to_date: str = Query(..., alias='to'),
):
    # Max 90-day range guard
    try:
        d1 = date.fromisoformat(from_date)
        d2 = date.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(status_code=400, detail='Invalid date format')
    if (d2 - d1).days > 90:
        raise HTTPException(status_code=400, detail='Range exceeds 90 days')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, net_score, net_signal, is_turning,
                       event_count, dominant_type
                FROM km_astro_daily_signal
                WHERE trade_date BETWEEN %s AND %s
                ORDER BY trade_date
                """,
                (from_date, to_date),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Routes: panchang ──────────────────────────────────────────────────────

@app.get('/api/panchang')
def get_panchang(date: Optional[str] = None):
    target_date = _resolve_date(date)
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, vara, nakshatra_name, tithi, yoga, paksha,
                       dlnl_match, is_ekadashi, is_purnima, hemisphere_event
                FROM km_daily_panchang
                WHERE trade_date = %s
                """,
                (target_date,),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f'No panchang for {target_date}')
        return dict(row)
    finally:
        conn.close()


@app.get('/api/panchang/range')
def get_panchang_range(
    from_date: str = Query(..., alias='from'),
    to_date: str = Query(..., alias='to'),
):
    try:
        d1 = date.fromisoformat(from_date)
        d2 = date.fromisoformat(to_date)
    except ValueError:
        raise HTTPException(status_code=400, detail='Invalid date format')
    if (d2 - d1).days > 366:
        raise HTTPException(status_code=400, detail='Range exceeds 366 days')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, vara, nakshatra_name, tithi, yoga, paksha,
                       dlnl_match, is_ekadashi, is_purnima, hemisphere_event
                FROM km_daily_panchang
                WHERE trade_date BETWEEN %s AND %s
                ORDER BY trade_date
                """,
                (from_date, to_date),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Routes: planetary data ────────────────────────────────────────────────

@app.get('/api/planets/positions')
def get_planetary_positions(date: Optional[str] = None):
    target_date = _resolve_date(date)
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT planet, longitude, sign_name, nakshatra_name,
                       speed, retrograde, combust, vargottam
                FROM km_planetary_positions
                WHERE trade_date = %s
                ORDER BY planet
                """,
                (target_date,),
            )
            rows = cur.fetchall()
        return {'date': target_date, 'positions': [dict(r) for r in rows]}
    finally:
        conn.close()


@app.get('/api/planets/aspects')
def get_planetary_aspects(date: Optional[str] = None):
    target_date = _resolve_date(date)
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT planet_1, planet_2, aspect_type, orb, exact
                FROM km_planetary_aspects
                WHERE trade_date = %s
                ORDER BY planet_1, planet_2
                """,
                (target_date,),
            )
            rows = cur.fetchall()
        return {'date': target_date, 'aspects': [dict(r) for r in rows]}
    finally:
        conn.close()


# ── Routes: market data ───────────────────────────────────────────────────

@app.get('/api/market/breadth')
def get_market_breadth(limit: int = Query(default=30, le=252)):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, breadth_score, signal_label,
                       ema_20_above, ema_50_above, ema_200_above
                FROM km_market_breadth
                ORDER BY trade_date DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@app.get('/api/market/breadth-roc')
def get_breadth_roc(limit: int = Query(default=30, le=252)):
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT trade_date, roc_value, signal_label
                FROM km_breadth_roc
                ORDER BY trade_date DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Routes: framework ─────────────────────────────────────────────────────

@app.get('/api/framework/{user_id}')
async def get_framework(user_id: str, caller_id: str = Depends(_get_current_user_id)):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, user_id, name, version, instruments,
                       blocks, chart_overlays, template_id, tier_at_creation,
                       created_at, updated_at
                FROM user_frameworks
                WHERE user_id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            row = cur.fetchone()

        if row:
            result = dict(row)
            result['blocks'] = result.get('blocks') or []
            result['chart_overlays'] = result.get('chart_overlays') or []
            result['instruments'] = result.get('instruments') or []
            return result

        # Auto-create default framework
        new_id = str(uuid.uuid4())
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO user_frameworks
                    (id, user_id, name, version, instruments, blocks, chart_overlays)
                VALUES (%s, %s, 'My Framework', 1, '{}', '[]', '[]')
                RETURNING id, user_id, name, version, instruments,
                          blocks, chart_overlays, template_id, tier_at_creation,
                          created_at, updated_at
                """,
                (new_id, user_id),
            )
            new_row = cur.fetchone()
            conn.commit()

        result = dict(new_row)
        result['blocks'] = result.get('blocks') or []
        result['chart_overlays'] = result.get('chart_overlays') or []
        result['instruments'] = result.get('instruments') or []
        return result

    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@app.post('/api/framework/{user_id}')
async def create_framework(
    user_id: str,
    req: FrameworkRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _conn()
    try:
        new_id = str(uuid.uuid4())
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO user_frameworks
                    (id, user_id, name, version, instruments, blocks, chart_overlays,
                     template_id, tier_at_creation)
                VALUES (%s, %s, %s, 1, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    name            = EXCLUDED.name,
                    version         = user_frameworks.version + 1,
                    instruments     = EXCLUDED.instruments,
                    blocks          = EXCLUDED.blocks,
                    chart_overlays  = EXCLUDED.chart_overlays,
                    template_id     = EXCLUDED.template_id,
                    tier_at_creation= EXCLUDED.tier_at_creation,
                    updated_at      = NOW()
                RETURNING id, user_id, name, version, instruments,
                          blocks, chart_overlays, template_id, tier_at_creation,
                          created_at, updated_at
                """,
                (
                    new_id,
                    user_id,
                    req.name or 'My Framework',
                    json.dumps(req.instruments or []),
                    json.dumps(req.blocks or []),
                    json.dumps(req.chart_overlays or []),
                    req.template_id,
                    req.tier_at_creation,
                ),
            )
            row = cur.fetchone()
            conn.commit()

        result = dict(row)
        result['blocks'] = result.get('blocks') or []
        result['chart_overlays'] = result.get('chart_overlays') or []
        result['instruments'] = result.get('instruments') or []
        return result

    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@app.put('/api/framework/{user_id}')
async def update_framework(
    user_id: str,
    req: FrameworkRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE user_frameworks
                SET name            = COALESCE(%s, name),
                    instruments     = COALESCE(%s, instruments),
                    blocks          = COALESCE(%s, blocks),
                    chart_overlays  = COALESCE(%s, chart_overlays),
                    template_id     = COALESCE(%s, template_id),
                    tier_at_creation= COALESCE(%s, tier_at_creation),
                    version         = version + 1,
                    updated_at      = NOW()
                WHERE user_id = %s
                RETURNING id, user_id, name, version, instruments,
                          blocks, chart_overlays, template_id, tier_at_creation,
                          created_at, updated_at
                """,
                (
                    req.name,
                    json.dumps(req.instruments) if req.instruments is not None else None,
                    json.dumps(req.blocks) if req.blocks is not None else None,
                    json.dumps(req.chart_overlays) if req.chart_overlays is not None else None,
                    req.template_id,
                    req.tier_at_creation,
                    user_id,
                ),
            )
            row = cur.fetchone()
            conn.commit()

        if not row:
            raise HTTPException(status_code=404, detail='Framework not found')

        result = dict(row)
        result['blocks'] = result.get('blocks') or []
        result['chart_overlays'] = result.get('chart_overlays') or []
        result['instruments'] = result.get('instruments') or []
        return result

    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


# ── Routes: profile ───────────────────────────────────────────────────────

@app.get('/api/profile/{user_id}')
async def get_profile(user_id: str, caller_id: str = Depends(_get_current_user_id)):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, full_name, phone, icp, onboarded, tier,
                       created_at, updated_at
                FROM km_profiles
                WHERE id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail='Profile not found')

        return dict(row)
    finally:
        conn.close()


@app.put('/api/profile/{user_id}')
async def update_profile(
    user_id: str,
    req: ProfileUpdateRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail='Forbidden')

    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE km_profiles
                SET full_name  = COALESCE(%s, full_name),
                    phone      = COALESCE(%s, phone),
                    icp        = COALESCE(%s, icp),
                    onboarded  = COALESCE(%s, onboarded),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, full_name, phone, icp, onboarded, tier,
                          created_at, updated_at
                """,
                (
                    req.full_name,
                    req.phone,
                    req.icp,
                    req.onboarded,
                    user_id,
                ),
            )
            row = cur.fetchone()
            conn.commit()

        if not row:
            raise HTTPException(status_code=404, detail='Profile not found')

        return dict(row)

    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


# ── Routes: payments ──────────────────────────────────────────────────────

@app.post('/api/payments/create-order')
async def create_payment_order(
    req: PaymentOrderRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    """Create a Razorpay order for tier upgrade."""
    import razorpay  # type: ignore

    key_id = os.environ.get('RAZORPAY_KEY_ID', '')
    key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail='Razorpay keys not configured')

    client = razorpay.Client(auth=(key_id, key_secret))
    try:
        order = client.order.create({
            'amount': req.amount_paise,
            'currency': 'INR',
            'payment_capture': 1,
            'notes': {
                'user_id': caller_id,
                'tier': req.tier,
            },
        })
        return {
            'order_id': order['id'],
            'amount': order['amount'],
            'currency': order['currency'],
            'key_id': key_id,
        }
    except Exception as exc:
        log.error(f'Razorpay order creation failed: {exc}')
        raise HTTPException(status_code=500, detail=f'Order creation failed: {exc}')


@app.post('/api/payments/verify')
async def verify_payment(
    req: PaymentVerifyRequest,
    caller_id: str = Depends(_get_current_user_id),
):
    """Verify Razorpay payment signature and upgrade user tier."""
    import hmac
    import hashlib as _hashlib
    import razorpay  # type: ignore

    key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
    if not key_secret:
        raise HTTPException(status_code=500, detail='Razorpay keys not configured')

    # Verify signature
    body = f'{req.razorpay_order_id}|{req.razorpay_payment_id}'
    expected = hmac.new(
        key_secret.encode('utf-8'),
        body.encode('utf-8'),
        _hashlib.sha256,
    ).hexdigest()

    if expected != req.razorpay_signature:
        raise HTTPException(status_code=400, detail='Payment signature verification failed')

    # Upgrade tier
    conn = _conn()
    try:
        now = datetime.utcnow()
        expires_at = now + timedelta(days=365)  # 1-year subscription

        with conn.cursor() as cur:
            # Update profile tier
            cur.execute(
                """
                UPDATE km_profiles SET tier = %s, updated_at = NOW()
                WHERE id = %s
                """,
                (req.tier, caller_id),
            )

            # Insert subscription record
            cur.execute(
                """
                INSERT INTO user_subscriptions
                    (id, user_id, tier, razorpay_order_id, razorpay_payment_id,
                     amount_paise, started_at, expires_at, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active')
                ON CONFLICT (razorpay_payment_id) DO NOTHING
                """,
                (
                    str(uuid.uuid4()),
                    caller_id,
                    req.tier,
                    req.razorpay_order_id,
                    req.razorpay_payment_id,
                    req.amount_paise,
                    now,
                    expires_at,
                ),
            )
            conn.commit()

        log.info(f'Tier upgraded: user={caller_id} tier={req.tier}')
        return {'ok': True, 'tier': req.tier, 'expires_at': expires_at.isoformat()}

    except Exception as exc:
        conn.rollback()
        log.error(f'Tier upgrade failed: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


def _deactivate_tier(user_id: str, subscription_id: str | None = None):
    """Downgrade user tier to free on payment failure/refund."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE km_profiles SET tier = 'free', updated_at = NOW() WHERE id = %s",
                (user_id,),
            )
            if subscription_id:
                cur.execute(
                    "UPDATE user_subscriptions SET status = 'cancelled' WHERE razorpay_order_id = %s",
                    (subscription_id,),
                )
            conn.commit()
        log.info(f'Tier deactivated: user={user_id}')
    except Exception as exc:
        conn.rollback()
        log.error(f'Tier deactivation failed: {exc}')
    finally:
        conn.close()


@app.post('/api/payments/webhook')
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook events (payment.failed, refund.processed, etc.)."""
    key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')

    body = await request.body()
    signature = request.headers.get('X-Razorpay-Signature', '')

    if key_secret and signature:
        import hmac
        import hashlib as _hashlib
        expected = hmac.new(
            key_secret.encode('utf-8'),
            body,
            _hashlib.sha256,
        ).hexdigest()
        if expected != signature:
            raise HTTPException(status_code=400, detail='Invalid webhook signature')

    try:
        payload = json.loads(body)
        event = payload.get('event', '')
        log.info(f'Razorpay webhook: {event}')

        if event in ('payment.failed', 'refund.processed', 'subscription.cancelled'):
            entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            if not entity:
                entity = payload.get('payload', {}).get('refund', {}).get('entity', {})
            notes   = entity.get('notes', {})
            user_id = notes.get('user_id')
            if user_id:
                _deactivate_tier(user_id, entity.get('order_id'))

        elif event == 'subscription.halted':
            sub     = payload.get('payload', {}).get('subscription', {}).get('entity', {})
            notes   = sub.get('notes', {})
            user_id = notes.get('user_id')
            if user_id:
                _deactivate_tier(user_id, sub.get('id'))

    except Exception as exc:
        log.error(f'webhook handler error: {event} {exc}')
        # Always return 200 to Razorpay — never let webhook retry loop

    return {'ok': True}
