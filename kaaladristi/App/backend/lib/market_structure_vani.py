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

VERSION = 3
ROC_SIGNAL_GAP = 0.02
PARTICIPATION_BANDS = {
    20: (55, 45, 38, 32),
    50: (60, 50, 35, 25),
    150: (65, 55, 30, 20),
}
INTENTS = {
    'structure.read': ('Read the complete market structure', 'participation', 'live'),
    'structure.participation': ('Explain the three participation horizons', 'participation', 'live'),
    'structure.pressure': ('Explain daily pressure and five-day extremes', 'participation', 'live'),
    'structure.momentum': ('Explain momentum state and alignment', 'momentum', 'live'),
    'structure.synthesis': ('Bring breadth, pressure and momentum together', 'framework', 'live'),
    'structure.ema': ('What does above 20 EMA mean?', 'participation', 'static'),
    'structure.score_date': ('Why do the score and heatmap differ?', 'participation', 'static'),
    'structure.fear_greed': ('Understand Fear and Greed', 'framework', 'static'),
    'structure.next': ('What does sector rotation add?', 'framework', 'static'),
}
STATIC = {
    'structure.score_date': 'The large breadth score and an individual heatmap cell measure different things. Each EMA row shows the percentage of eligible stocks above that moving average. The score blends the 20 EMA, 50 EMA and 150 EMA percentages with weights of 50%, 30% and 20%. It uses the stored values before display rounding, so it need not match any single cell. The date labels identify the source trading session: 11 September represents that session’s closing data, even if you read it the following morning. Before a new session is processed, the latest available reading may still be from the preceding trading session, which can be more than one calendar day earlier. The pipeline does not automatically relabel 10 September as 11 September. A suspected source-date error needs verification rather than assuming a fixed one-day delay.',
    'structure.ema': 'EMA means exponential moving average. Breadth counts stocks closing above their own average and expresses that count as a percentage of the eligible universe. The 20, 50 and 150 EMA rows use progressively stricter fixed bands because they describe different horizons. Red means participation is extended, amber is transition, dark green is an opportunity-watch area and light green is extreme fear. Green is a contrarian research area, not an entry signal. The breadth score combines the three percentages with weights of 50%, 30% and 20%.',
    'structure.fear_greed': 'DristiQ labels a breadth score below 35 as Fear and above 55 as Greed. A filled green ball marks a confirmed crossing into Fear; a filled red ball marks a confirmed crossing into Greed. A ringed marker is provisional because the stock sample fell sharply. These are participation events, not measured emotions, reversal calls or instructions to trade.',
    'structure.next': 'Sector rotation lets you compare individual sectors with the broader market. Compare each sector’s 5D flow score with its 22D baseline, then inspect the constituents behind a difference. Flow scores and breadth ROC have different formulas; their numerical values are not interchangeable. Keep the original research question when moving to a stock chart.',
}
FIELDS = (
    ('trade_date', 'pct_above_20', 'pct_above_50', 'pct_above_150', 'breadth_score', 'stock_count',
     'universe_count', 'above_20', 'above_50', 'above_150', 'up_5pct', 'down_5pct',
     'up_20pct_5d', 'down_20pct_5d'),
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
        rows = db.select(table, ','.join(fields), order='trade_date.desc', limit=period + 5)
        rows = [{**r, 'trade_date': str(r['trade_date'])[:10]} for r in rows]
        result.append(sorted((r for r in rows if not target or r['trade_date'] <= target),
                             key=lambda r: r['trade_date'])[-(period + 5):])
    return result


def participation_band(value, horizon):
    if value is None:
        return 'Unavailable'
    extreme_high, high, neutral, opportunity = PARTICIPATION_BANDS[horizon]
    if value > extreme_high:
        return 'Extended'
    if value > high:
        return 'Elevated'
    if value > neutral:
        return 'Neutral / transition'
    if value >= opportunity:
        return 'Opportunity watch'
    return 'Extreme fear'


def population(row):
    universe = number(row.get('universe_count'))
    return universe if universe is not None else number(row.get('stock_count'))


def coverage_warning(rows, index):
    current = population(rows[index])
    prior = sorted(v for v in (population(r) for r in rows[max(0, index - 5):index]) if v and v > 0)
    if current is None or current <= 0:
        return 'Coverage unavailable; participation cannot be validated.'
    if not prior:
        return None
    mid = len(prior) // 2
    baseline = prior[mid] if len(prior) % 2 else (prior[mid - 1] + prior[mid]) / 2
    if current < baseline * .8:
        return f'Coverage warning: {current:,.0f} stocks versus a recent median of {baseline:,.0f}. The sample fell more than 20%; this may reflect missing data.'
    return None


def pressure_reading(rows, index, up_key, down_key, kind):
    row = rows[index]
    up, down, universe = number(row.get(up_key)), number(row.get(down_key)), number(row.get('universe_count'))
    if up is None or down is None or universe is None or universe <= 0:
        return None
    net = (up - down) / universe * 100
    prior = []
    for old in rows[max(0, index - 22):index]:
        old_up, old_down, old_u = number(old.get(up_key)), number(old.get(down_key)), number(old.get('universe_count'))
        if old_up is not None and old_down is not None and old_u and old_u > 0:
            prior.append(abs((old_up - old_down) / old_u * 100))
    prior.sort()
    unusual = prior[int((len(prior) - 1) * .8)] if len(prior) >= 5 else math.inf
    floor, strong_floor = ((.5, 1.5) if kind == 'daily' else (.1, .3))
    strong = abs(net) >= strong_floor and abs(net) >= unusual
    balanced, positive = abs(net) < floor, net > 0
    if balanced:
        label = 'Balanced' if kind == 'daily' else 'Normal'
    elif strong:
        label = ('Buying thrust' if positive else 'Panic selling') if kind == 'daily' else ('Explosive expansion' if positive else 'Capitulation cluster')
    else:
        label = ('Buyers dominant' if positive else 'Sellers dominant') if kind == 'daily' else ('Winners dominant' if positive else 'Breakdown pressure')
    suffix = ' The imbalance is also unusually large versus the preceding 22 sessions.' if strong else ''
    return f'{label}: {up:,.0f} up versus {down:,.0f} down; net {net:+.1f}% of the {universe:,.0f}-stock universe.{suffix}'


def roc_state(fast, signal):
    if fast is None or signal is None:
        return 'Unavailable'
    gap = fast - signal
    if abs(gap) < ROC_SIGNAL_GAP:
        return 'FLAT: indecisive because ROC 13 is within 0.02 of its signal'
    if fast > 0 and gap > 0:
        return 'EXPAND: positive expansion'
    if fast > 0:
        return 'FADING: positive but fading'
    if gap > 0:
        return 'RECOVER: negative but recovering'
    return 'WEAK: negative and weakening'


def roc_alignment(fast, slow):
    if fast is None or slow is None:
        return 'Unavailable'
    gap = fast - slow
    if abs(gap) < ROC_SIGNAL_GAP:
        return 'ALIGNED: ROC 13 is within 0.02 of ROC 55'
    return 'LEADING: fast momentum is meaningfully above ROC 55' if gap > 0 else 'LAGGING: fast momentum is meaningfully below ROC 55'


def roc_event(rows, index):
    if index < 2:
        return None
    sample = rows[index - 2:index + 1]
    gaps = [number(r.get('roc_13')) - number(r.get('sma_breadth'))
            if number(r.get('roc_13')) is not None and number(r.get('sma_breadth')) is not None else None for r in sample]
    sign = lambda value: 1 if value > 0 else -1 if value < 0 else 0
    if any(g is None for g in gaps) or abs(gaps[2]) < ROC_SIGNAL_GAP or sign(gaps[1]) != sign(gaps[2]):
        return None
    fast = number(rows[index].get('roc_13'))
    if gaps[2] > 0 and gaps[0] <= 0 and fast < 0:
        return 'Confirmed recovery event: negative ROC 13 held above its signal for two sessions.'
    if gaps[2] < 0 and gaps[0] >= 0 and fast > 0:
        return 'Confirmed fading event: positive ROC 13 held below its signal for two sessions.'
    return None


def derive_facts(breadth, roc):
    facts = []
    if breadth:
        i, latest = len(breadth) - 1, breadth[-1]
        warning = coverage_warning(breadth, i)
        facts += [f"Participation data date: {latest['trade_date']}.",
                  'The date identifies the source closing session. Do not shift it or infer a fixed reporting lag.']
        if warning:
            facts.append(warning + ' Treat zone entries and participation changes on this session as provisional.')
        for horizon in (20, 50, 150):
            key, value = f'pct_above_{horizon}', number(latest.get(f'pct_above_{horizon}'))
            if value is None:
                facts.append(f'Above {horizon} EMA: unavailable.')
                continue
            text = f'{value:.1f}% are above their {horizon} EMA; fixed {horizon} EMA band: {participation_band(value, horizon)}.'
            previous = number(breadth[i - 1].get(key)) if i else None
            if previous is not None:
                delta = value - previous
                comparison = f'{abs(delta):.1f} percentage points higher than' if delta > 0 else f'{abs(delta):.1f} percentage points lower than' if delta < 0 else 'unchanged from'
                text += f' {comparison} {breadth[i - 1]["trade_date"]}.'
            facts.append(text)
        for left, right in ((20, 50), (20, 150), (50, 150)):
            a, b = number(latest.get(f'pct_above_{left}')), number(latest.get(f'pct_above_{right}'))
            if a is not None and b is not None:
                relation = 'higher than' if a > b else 'lower than' if a < b else 'equal to'
                facts.append(f'{left} EMA participation is {relation} {right} EMA participation.')
        score, previous_score = number(latest.get('breadth_score')), number(breadth[i - 1].get('breadth_score')) if i else None
        if score is not None:
            zone = 'Fear' if score < 35 else 'Greed' if score > 55 else 'Neutral'
            facts.append(f'Weighted breadth score: {score:.1f}, in the {zone} framework zone.')
            if previous_score is not None:
                event = 'Entered Greed by crossing above 55.' if previous_score <= 55 < score else 'Entered Fear by crossing below 35.' if previous_score >= 35 > score else None
                if event:
                    facts.append(('Provisional zone entry: ' if warning else 'Confirmed zone entry: ') + event)
        daily = pressure_reading(breadth, i, 'up_5pct', 'down_5pct', 'daily')
        extremes = pressure_reading(breadth, i, 'up_20pct_5d', 'down_20pct_5d', 'five_day')
        facts.append('Daily pressure: ' + daily if daily else 'Daily pressure is unavailable.')
        facts.append('Five-day extremes: ' + extremes if extremes else 'Five-day extremes are unavailable.')
        facts.append('Green participation bands and Fear entries are contrarian watch areas, not reversal confirmations or entry signals.')
    else:
        facts.append('Participation data is unavailable.')
    if roc:
        i, row = len(roc) - 1, roc[-1]
        fast, slow, signal = [number(row.get(k)) for k in ('roc_13', 'roc_55', 'sma_breadth')]
        facts.append(f"Momentum data date: {row['trade_date']}.")
        if fast is None:
            facts.append('ROC 13 is unavailable; momentum cannot be classified.')
        else:
            facts.append(f'ROC 13 {fast:+.4f}; ROC 55 {slow:+.4f}.' if slow is not None else f'ROC 13 {fast:+.4f}; ROC 55 unavailable.')
            facts.append(f'Five-session signal: {signal:+.4f}.' if signal is not None else 'Five-session signal unavailable.')
            facts.append('Momentum state: ' + roc_state(fast, signal) + '.')
            facts.append('Horizon alignment: ' + roc_alignment(fast, slow) + '.')
            event = roc_event(roc, i)
            facts.append(event if event else 'No new confirmed two-session ROC recovery or fading event on this session.')
            facts.append('Momentum state and alignment are observations; neither predicts the next market move.')
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
                        'All bands, pressure labels, event confirmations, momentum states and alignments '
                        'are already calculated: preserve them exactly and do not reclassify them. '
                        'Do not calculate, invent causes, infer money flow, predict reversals, or provide '
                        'buy/sell recommendations, targets or trade instructions. Fear/Greed are framework '
                        'labels, not emotions. Green is a contrarian watch area, not an entry signal. '
                        'A positive ROC is not necessarily acceleration. '
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
