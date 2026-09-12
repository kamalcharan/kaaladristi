"""Market Structure's versioned, cache-first VaNi intents.

No client-supplied market values are trusted. The browser's snapshot is compared
with the authoritative rows before synthesis, including same-date corrections.
"""
import hashlib
import json
import math
import struct
import threading
import time
from contextlib import contextmanager
from datetime import date

from .vani_cache import get_cached, make_cache_key, set_cached

VERSION = 2
INTENTS = {
    'structure.read': ('Read this market snapshot', 'participation', 'live'),
    'structure.participation': ('Compare the three participation horizons', 'participation', 'live'),
    'structure.momentum': ('Why can positive ROC still be fading?', 'momentum', 'live'),
    'structure.synthesis': ('Bring participation and momentum together', 'framework', 'live'),
    'structure.ema': ('What does above 20 EMA mean?', 'participation', 'static'),
    'structure.score_date': ('Why do the score and heatmap differ?', 'participation', 'static'),
    'structure.fear_greed': ('Understand Fear and Greed', 'framework', 'static'),
    'structure.next': ('What does sector rotation add?', 'framework', 'static'),
}
STATIC = {
    'structure.score_date': 'The large breadth score and an individual heatmap cell measure different things. Each EMA row shows the percentage of eligible stocks above that moving average. The score blends the 20 EMA, 50 EMA and 150 EMA percentages with weights of 50%, 30% and 20%. It uses the stored values before display rounding, so it need not match any single cell. The date labels identify the source trading session: 11 September represents that session’s closing data, even if you read it the following morning. Before a new session is processed, the latest available reading may still be from the preceding trading session, which can be more than one calendar day earlier. The pipeline does not automatically relabel 10 September as 11 September. A suspected source-date error needs verification rather than assuming a fixed one-day delay.',
    'structure.ema': 'EMA means exponential moving average. Breadth counts stocks closing above their own average and expresses that count as a percentage of the eligible universe. Above 20, 50 and 150 EMA are three different horizons. The breadth score combines these percentages with weights of 50%, 30% and 20%; it is not itself a count of stocks.',
    'structure.fear_greed': 'DristiQ labels a breadth score below 35 as Fear and above 55 as Greed. These describe the framework’s participation zones, not measured emotions. The contrarian lens asks whether low participation is beginning to rebuild, and whether high participation is beginning to fade. Neither threshold establishes a reversal or an instruction to trade.',
    'structure.next': 'Sector rotation lets you compare individual sectors with the broader market. Compare each sector’s 5D flow score with its 22D baseline, then inspect the constituents behind a difference. Flow scores and breadth ROC have different formulas; their numerical values are not interchangeable. Keep the original research question when moving to a stock chart.',
}
FIELDS = (
    ('trade_date', 'pct_above_20', 'pct_above_50', 'pct_above_150', 'breadth_score', 'stock_count'),
    ('trade_date', 'roc_13', 'roc_55', 'sma_breadth', 'stock_count'),
)
_locks = [threading.Lock() for _ in range(64)]


class ReadingInProgress(Exception):
    """Another API worker owns generation for this cache key."""


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def snapshot(breadth, roc):
    def encode(rows, fields):
        return ';'.join(','.join(str(row.get(k, ''))[:10] if k == 'trade_date'
                                else ('_' if number(row.get(k)) is None else struct.pack('>d', float(row[k])).hex())
                                for k in fields) for row in rows)
    return encode(breadth, FIELDS[0]) + '|' + encode(roc, FIELDS[1])


def load_rows(db, target, period):
    result = []
    for table, fields in zip(('km_market_breadth', 'km_breadth_roc'), FIELDS):
        rows = db.select(table, ','.join(fields), order='trade_date.desc', limit=66)
        rows = [{**r, 'trade_date': str(r['trade_date'])[:10]} for r in rows]
        result.append(sorted((r for r in rows if not target or r['trade_date'] <= target),
                             key=lambda r: r['trade_date'])[-period:])
    return result


def derive_facts(breadth, roc):
    facts = []
    if breadth:
        latest = breadth[-1]
        facts.append(f"Participation data date: {latest['trade_date']}.")
        facts.append('The participation data date identifies the source trading session and its closing data, not the date the page is viewed. Do not shift it back one day or infer a fixed reporting lag.')
        for key, name in [('pct_above_20', '20 EMA'), ('pct_above_50', '50 EMA'), ('pct_above_150', '150 EMA')]:
            value = number(latest.get(key))
            if value is None:
                facts.append(f'Above {name}: unavailable.')
                continue
            text = f'{value:.1f}% of eligible stocks are above their {name}.'
            prev = number(breadth[-2].get(key)) if len(breadth) > 1 else None
            if prev is not None:
                delta = value - prev
                direction = 'higher' if delta > 0 else 'lower' if delta < 0 else 'unchanged'
                text += f' {abs(delta):.1f} percentage points {direction} than the previous available session ({breadth[-2]["trade_date"]}).'
            facts.append(text)
        score = number(latest.get('breadth_score'))
        for left, right in [('20', '50'), ('20', '150'), ('50', '150')]:
            a, b = number(latest.get('pct_above_' + left)), number(latest.get('pct_above_' + right))
            if a is not None and b is not None:
                relation = 'HIGHER THAN' if a > b else 'LOWER THAN' if a < b else 'EQUAL TO'
                facts.append(f'Participation above {left} EMA is {relation} participation above {right} EMA.')
        if score is not None:
            zone = 'Fear' if score < 35 else 'Greed' if score > 55 else 'Neutral'
            facts.append(f'Weighted breadth score: {score:.1f} out of 100, in the {zone} framework zone.')
            facts.append('This score combines the same-session percentages above 20 EMA, 50 EMA and 150 EMA with weights of 50%, 30% and 20%. It is not the 20 EMA percentage. Stored precision is used before display rounding.')
    else:
        facts.append('Participation data is unavailable.')
    if roc:
        r = roc[-1]
        facts.append(f"Momentum data date: {r['trade_date']}.")
        fast, slow, signal = [number(r.get(k)) for k in ('roc_13', 'roc_55', 'sma_breadth')]
        if fast is not None:
            sign = 'positive' if fast > 0 else 'negative' if fast < 0 else 'zero'
            facts.append(f'ROC 13 is {fast:+.4f}, a {sign} reading. Its sign alone does not establish acceleration.')
            for label, value in [('ROC 55', slow), ('five-session signal', signal)]:
                if value is None:
                    facts.append(f'{label} is unavailable; that comparison cannot be made.')
                else:
                    relation = 'ABOVE' if fast > value else 'BELOW' if fast < value else 'EQUAL TO'
                    facts.append(f'ROC 13 ({fast:+.4f}) is {relation} the {label} ({value:+.4f}).')
            if signal is not None:
                state = ('quiet relative to signal' if fast == 0 or fast == signal
                         else 'building relative to signal' if fast > 0 and fast > signal
                         else 'recovering relative to signal, while still negative' if fast < 0 and fast > signal
                         else 'fading relative to signal, while still positive' if fast > 0
                         else 'contracting relative to signal')
                facts.append(f'Framework momentum condition: {state}. This comparison does not establish a future move.')
        else:
            facts.append('ROC 13 is unavailable; momentum cannot be classified.')
    else:
        facts.append('Momentum data is unavailable.')
    if breadth and roc and breadth[-1]['trade_date'] != roc[-1]['trade_date']:
        facts.append('The two series have different latest dates. This is not a same-session combined reading.')
    return facts


@contextmanager
def single_flight(db, key):
    """Bounded local stripes; PostgreSQL advisory lock across API workers.

    PostgREST-only deployments retain local deduplication. Locks are released
    on every outcome. No database migration or table is needed.
    """
    digest = int(hashlib.sha256(key.encode()).hexdigest()[:15], 16)
    with _locks[digest % len(_locks)]:
        conn = None
        acquired = False
        try:
            if hasattr(db, '_conn') and hasattr(db, '_put'):
                conn = db._conn()
                with conn.cursor() as cur:
                    cur.execute('SELECT pg_try_advisory_lock(%s)', (digest,))
                    acquired = cur.fetchone()[0]
                conn.commit()
                # Avoid holding an HTTP request indefinitely on another worker.
                if not acquired:
                    raise ReadingInProgress()
            yield
        finally:
            if conn is not None:
                try:
                    conn.rollback()
                    if acquired:
                        with conn.cursor() as cur:
                            cur.execute('SELECT pg_advisory_unlock(%s)', (digest,))
                        conn.commit()
                finally:
                    db._put(conn)


def answer(req, db, complete, post_filter, log_interaction, model):
    intent_id = req.intent_id
    base = {'intent_id': intent_id, 'intent_version': VERSION, 'ai': False,
            'cached': False, 'provider': None, 'response': None}
    if intent_id not in INTENTS:
        return {**base, 'error': 'This question is not available on Market Structure.'}
    period = getattr(req, 'structure_period', 66)
    depth = getattr(req, 'explanation_depth', 'brief')
    target = req.date
    try:
        if period not in (22, 44, 66) or depth not in ('brief', 'simple', 'detailed'):
            raise ValueError('Unsupported reading period or explanation depth.')
        if target:
            date.fromisoformat(target)
        static = INTENTS[intent_id][2] == 'static'
        breadth, roc = ([], []) if static else load_rows(db, target, period)
        facts = [] if static else derive_facts(breadth, roc)
        evidence_snapshot = snapshot(breadth, roc)
        if not static:
            if not breadth and not roc:
                return {**base, 'error': 'No market data is available for this selection.'}
            expected = getattr(req, 'structure_snapshot', None)
            if not expected or expected != evidence_snapshot:
                return {**base, 'error': 'The market data changed. Refresh the page before requesting this reading.', 'context_changed': True}
        context = {'version': VERSION, 'intent': intent_id, 'depth': 'static' if static else depth}
        if not static:
            context.update(period=period, snapshot=evidence_snapshot)
        key = make_cache_key(intent_id, context)
        meta = {**base, 'date': breadth[-1]['trade_date'] if breadth else None,
                'roc_date': roc[-1]['trade_date'] if roc else None, 'facts': facts,
                'context_hash': key.rsplit(':', 1)[-1]}
        with single_flight(db, key):
            text = get_cached(db, key)
            cached = bool(text)
            provider = 'cache' if cached else 'rule'
            elapsed = 0
            if not text:
                if static:
                    text = STATIC[intent_id]
                else:
                    system = (
                        'You are VaNi, a factual research educator. Explain only the supplied statements. '
                        'All comparisons are already calculated: preserve ABOVE/BELOW exactly. '
                        'Do not calculate, invent causes, infer money flow, predict reversals, or provide '
                        'buy/sell recommendations, targets or trade instructions. Fear/Greed are framework '
                        'labels, not emotions. A positive ROC is not necessarily acceleration. '
                        'Mention different data dates if present. Plain English, no markdown headings. '
                        + ('At most 180 words, explain definitions where useful.' if depth == 'detailed'
                           else 'At most 70 words. ' + ('Use everyday language and explain terms.' if depth == 'simple' else 'Lead with one clear observation.'))
                    )
                    user = INTENTS[intent_id][0] + '\nAuthoritative facts:\n' + '\n'.join(facts)
                    started = time.monotonic()
                    raw, provider = complete(system=system, user=user, max_tokens=400 if depth == 'detailed' else 200,
                                             temperature=0.2, no_think=True, prefer_local=True, allow_cloud_fallback=True)
                    elapsed = int((time.monotonic() - started) * 1000)
                    text, rejected = post_filter(raw) if raw else (None, False)
                    if rejected or not text:
                        return {**meta, 'facts': facts, 'error': 'The explanation is unavailable. The verified figures and comparisons remain available below.'}
                set_cached(db, key, intent_id, meta['context_hash'], text, 24 if not static else 720,
                           llm_provider=provider, llm_model=('qwen-local' if provider == 'qwen-local' else model) if not static else None)
            log_id = log_interaction(product='dristiq', endpoint='/api/vani/ask',
                                     user_input=json.dumps({'intent': intent_id, 'version': VERSION, 'context_hash': meta['context_hash'], 'depth': depth, 'cache_hit': cached, 'provider': provider}),
                                     llm_response=text, context_payload={'facts': facts, **context},
                                     model_version=None if static or cached else ('qwen-local' if provider == 'qwen-local' else model), latency_ms=elapsed)
            return {**meta, 'response': text, 'cached': cached, 'provider': provider,
                    'ai': not static, 'log_id': log_id}
    except ReadingInProgress:
        return {**base, 'facts': locals().get('facts', []), 'pending': True}
    except Exception:
        # Do not expose database/provider exception details to the product UI.
        return {**base, 'facts': locals().get('facts', []), 'error': 'This reading could not be prepared. Your charts remain available; please try again.'}
