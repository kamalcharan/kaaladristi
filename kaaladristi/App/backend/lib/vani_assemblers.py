"""
Kāla-Drishti — VaNi Context Assemblers
========================================
Functions that gather and bucket context data for VaNi intents.
Each assembler returns two things:
  1. A user_message string (what gets sent to the LLM)
  2. A cache_context dict (bucketed values for cache key generation)

The cache_context uses discrete buckets (not raw floats) so that
minor numeric changes don't bust the cache.
"""

from datetime import date, timedelta
from .data_assemblers import (
    assemble_market_pulse_context,
    _safe_float,
    _day_score,
)


# ── Bucketing helpers ─────────────────────────────────────────────────────────

def _bucket_breadth_regime(score: float) -> str:
    if score > 55:
        return 'Greed'
    if score < 35:
        return 'Fear'
    return 'Neutral'


def _bucket_roc_bias(roc: float) -> str:
    if roc > 0.001:
        return 'bullish'
    if roc < -0.001:
        return 'bearish'
    return 'neutral'


def _bucket_astro(score: float) -> str:
    if score > 0.5:
        return 'favorable'
    if score < -0.5:
        return 'adverse'
    return 'neutral'


# ── Industry rotation helpers ────────────────────────────────────────────────

INDUSTRY_ROTATION_LOOKBACK_DAYS = 5


def _fetch_industry_rotation(db, target_date: str) -> dict:
    """Fetch industry rotation data: rotating_in, leading, rotating_out.

    Returns bucketed lists suitable for both prompt rendering and cache keying.
    """
    result = {
        'rotation_in': [],
        'leading': [],
        'rotation_out': [],
    }

    try:
        rows = db.select(
            'km_industry_eod', '*',
            filters={'trade_date': target_date},
            order='industry_rank.asc',
            limit=200,
        )
    except Exception:
        return result

    if not rows:
        return result

    total = len(rows)
    top_quartile = max(1, total // 4)

    current_ranks = {r['industry']: r.get('industry_rank', 999) for r in rows}
    current_data = {r['industry']: r for r in rows}

    lookback_date = str(
        date.fromisoformat(target_date) - timedelta(days=INDUSTRY_ROTATION_LOOKBACK_DAYS + 5)
    )
    try:
        old_rows = db.select(
            'km_industry_eod', 'industry,industry_rank',
            order='industry_rank.asc',
            limit=200,
        )
        old_rows = [
            r for r in old_rows
            if lookback_date <= str(r.get('trade_date', '')) < target_date
        ]
    except Exception:
        old_rows = []

    old_ranks = {}
    for r in old_rows:
        ind = r.get('industry')
        if ind and ind not in old_ranks:
            old_ranks[ind] = r.get('industry_rank', 999)

    for industry, rank in current_ranks.items():
        data = current_data.get(industry, {})
        entry = {
            'industry': industry,
            'rank': rank,
            'avg_magic_rs': round(_safe_float(data.get('avg_magic_rs'), 0), 1),
            'stock_count': data.get('stock_count', 0),
            'dominant_flow': data.get('dominant_flow_type', 'N/A'),
        }

        old_rank = old_ranks.get(industry)
        if old_rank is not None:
            rank_change = old_rank - rank
            if rank_change >= 5:
                result['rotation_in'].append(entry)
            elif rank_change <= -5:
                result['rotation_out'].append(entry)

        if rank <= top_quartile:
            result['leading'].append(entry)

    result['rotation_in'].sort(key=lambda x: x['rank'])
    result['rotation_out'].sort(key=lambda x: x['rank'])

    return result


# ── Panchangam + Breadth history helpers ──────────────────────────────────────

def _fetch_panchang_outlook(db, target_date: str, days: int = 6) -> list[dict]:
    """Fetch panchangam + astro events for today + next N-1 days."""
    outlook = []
    base = date.fromisoformat(target_date)

    for i in range(days):
        d = str(base + timedelta(days=i))
        day_info = {'date': d, 'panchang': None, 'astro_events': [], 'day_score': 0.0, 'direction': 'no_event'}

        try:
            p_rows = db.select('km_daily_panchang', '*', filters={'date': d}, limit=1)
            if p_rows:
                p = p_rows[0]
                special = [s for s in [
                    'Purnima' if p.get('is_purnima') else '',
                    'Amavasya' if p.get('is_amavasya') else '',
                    'Ekadashi' if p.get('is_ekadashi') else '',
                    'Sankranti' if p.get('is_sankranti') else '',
                ] if s]
                day_info['panchang'] = {
                    'tithi': p.get('tithi_name', ''),
                    'tithi_lord': p.get('tithi_lord', ''),
                    'nakshatra': p.get('nakshatra_name', ''),
                    'nakshatra_lord': p.get('nakshatra_lord', ''),
                    'vara': p.get('vara', ''),
                    'vara_lord': p.get('vara_lord', ''),
                    'moon_sign': p.get('moon_sign_name', ''),
                    'special': special or [],
                }
        except Exception:
            pass

        try:
            all_inf = db.select('dc_inference', '*', order='start_date.asc', limit=500)
            for inf in (all_inf or []):
                start = str(inf.get('start_date', ''))
                end = str(inf.get('end_date', '')) if inf.get('end_date') else start
                if start <= d <= end:
                    day_info['astro_events'].append({
                        'event': inf.get('astro_event', ''),
                        'impact': inf.get('market_impact', ''),
                        'inference': inf.get('inference', ''),
                    })
            score = _day_score([{'market_impact': e['impact']} for e in day_info['astro_events']])
            day_info['day_score'] = score
            day_info['direction'] = _bucket_astro(score)
        except Exception:
            pass

        outlook.append(day_info)

    return outlook


def _fetch_breadth_history(db, days: int = 3) -> list[dict]:
    """Fetch last N trading days of market breadth."""
    try:
        rows = db.select('km_market_breadth', '*', order='trade_date.desc', limit=days)
    except Exception:
        return []

    result = []
    for r in reversed(rows):
        score = _safe_float(r.get('breadth_score'), 0)
        result.append({
            'date': str(r.get('trade_date', '')),
            'score': score,
            'regime': _bucket_breadth_regime(score),
            'pct_above_20': _safe_float(r.get('pct_above_20')),
            'pct_above_50': _safe_float(r.get('pct_above_50')),
            'pct_above_150': _safe_float(r.get('pct_above_150')),
        })
    return result


def _fetch_breadth_roc_history(db, days: int = 3) -> list[dict]:
    """Fetch last N trading days of breadth ROC."""
    try:
        rows = db.select('km_breadth_roc', '*', order='trade_date.desc', limit=days)
    except Exception:
        return []

    result = []
    for r in reversed(rows):
        roc13 = _safe_float(r.get('roc_13'), 0)
        roc55 = _safe_float(r.get('roc_55'), 0)
        result.append({
            'date': str(r.get('trade_date', '')),
            'roc_13': roc13,
            'roc_55': roc55,
            'sma_breadth': _safe_float(r.get('sma_breadth'), 0),
            'bias': _bucket_roc_bias(roc13),
            'spread': round(roc13 - roc55, 6),
        })
    return result


# ── Dashboard assemblers ──────────────────────────────────────────────────────

def assemble_dashboard_context(db, target_date: str = None) -> dict | None:
    """Assemble full dashboard context for VaNi intents.

    Returns a dict with all fields needed by any dashboard intent.
    Individual intents pick the fields they need.
    """
    pulse = assemble_market_pulse_context(db, target_date)
    if not pulse:
        return None

    actual_date = pulse['date']
    rotation = _fetch_industry_rotation(db, actual_date)

    # Panchangam: today + next 5 days
    panchang_outlook = _fetch_panchang_outlook(db, actual_date, days=6)

    # Breadth history: last 3 trading days
    breadth_history = _fetch_breadth_history(db, days=3)

    # Breadth ROC history: last 3 trading days
    breadth_roc_history = _fetch_breadth_roc_history(db, days=3)

    manipulation_count = 0
    broken_signals_count = 0

    return {
        'date': actual_date,
        'indexes': pulse.get('indexes', []),
        'breadth': pulse.get('breadth'),
        'breadth_roc': pulse.get('breadth_roc'),
        'breadth_history': breadth_history,
        'breadth_roc_history': breadth_roc_history,
        'astro': pulse.get('astro', {}),
        'panchang': pulse.get('panchang'),
        'panchang_outlook': panchang_outlook,
        'rotation_in': rotation['rotation_in'],
        'rotation_out': rotation['rotation_out'],
        'leading': rotation['leading'],
        'manipulation_count': manipulation_count,
        'broken_signals_count': broken_signals_count,
    }


def build_cache_context(intent_id: str, ctx: dict) -> dict:
    """Extract bucketed values from context for cache key generation.

    Uses discrete categories (not raw floats) so cache hit rate stays high.
    """
    breadth = ctx.get('breadth') or {}
    roc = ctx.get('breadth_roc') or {}
    astro = ctx.get('astro') or {}

    base = {
        'date': ctx.get('date', ''),
        'regime': _bucket_breadth_regime(_safe_float(breadth.get('score'), 45)),
        'roc_bias': _bucket_roc_bias(_safe_float(roc.get('roc_13'), 0)),
        'astro_dir': _bucket_astro(_safe_float(astro.get('day_score'), 0)),
    }

    if 'rotation' in intent_id:
        base['rot_in_count'] = len(ctx.get('rotation_in', []))
        base['rot_out_count'] = len(ctx.get('rotation_out', []))
        base['leading_top3'] = ','.join(
            e['industry'] for e in ctx.get('leading', [])[:3]
        )

    if 'warnings' in intent_id:
        base['manip_count'] = ctx.get('manipulation_count', 0)
        base['broken_count'] = ctx.get('broken_signals_count', 0)

    if 'panchangam' in intent_id:
        outlook = ctx.get('panchang_outlook', [])
        base['outlook_days'] = len(outlook)
        if outlook and outlook[0].get('panchang'):
            base['tithi'] = outlook[0]['panchang'].get('tithi', '')

    if 'breadth_trend' in intent_id or 'breadth_momentum' in intent_id:
        hist = ctx.get('breadth_history', [])
        if hist:
            base['hist_start_regime'] = hist[0].get('regime', '')
            base['hist_end_regime'] = hist[-1].get('regime', '')

    return base


def format_user_message(intent_id: str, ctx: dict) -> str:
    """Format context into a user message string for the LLM."""
    formatters = {
        'dashboard.market_summary': _fmt_market_summary,
        'dashboard.regime_explain': _fmt_regime_explain,
        'dashboard.rotation_overview': _fmt_rotation_overview,
        'dashboard.warnings': _fmt_warnings,
        'dashboard.breadth_explain': _fmt_breadth_explain,
        'dashboard.panchangam_outlook': _fmt_panchangam_outlook,
        'dashboard.breadth_trend': _fmt_breadth_trend,
        'dashboard.breadth_momentum': _fmt_breadth_momentum,
    }
    formatter = formatters.get(intent_id)
    if not formatter:
        return f"Context for {intent_id}:\n{ctx}"
    return formatter(ctx)


# ── Formatters ────────────────────────────────────────────────────────────────

def _fmt_market_summary(ctx: dict) -> str:
    idx_lines = []
    for idx in ctx.get('indexes', []):
        idx_lines.append(
            f"  {idx['name']}: {idx['close']} ({idx['change_pct']:+.2f}%), "
            f"Flow={idx['flow_type'] or 'N/A'}, "
            f"Participation={idx['participation']}, "
            f"MagicRS={idx['magic_rs_zone'] or 'N/A'}"
        )
    idx_str = '\n'.join(idx_lines) if idx_lines else '  No data'

    b = ctx.get('breadth') or {}
    score = _safe_float(b.get('score'), 0)
    regime = _bucket_breadth_regime(score)

    roc = ctx.get('breadth_roc') or {}
    roc13 = _safe_float(roc.get('roc_13'), 0)

    rot_in = ctx.get('rotation_in', [])
    rot_out = ctx.get('rotation_out', [])
    rot_in_str = ', '.join(e['industry'] for e in rot_in[:5]) or 'None'
    rot_out_str = ', '.join(e['industry'] for e in rot_out[:5]) or 'None'

    astro = ctx.get('astro', {})
    astro_str = 'None active'
    if astro.get('events'):
        astro_str = '; '.join(
            f"{e['event']} ({e['impact']})" for e in astro['events'][:3]
        )

    pang = ctx.get('panchang')
    pang_str = 'N/A'
    if pang:
        pang_str = f"{pang.get('tithi', '')}, {pang.get('nakshatra', '')}, {pang.get('vara', '')}"

    return (
        f"Market snapshot for {ctx['date']}:\n"
        f"\n--- Indexes ---\n{idx_str}\n"
        f"\n--- Breadth ---\n"
        f"Regime: {regime} (Score: {score:.1f})\n"
        f"Above 20 EMA: {b.get('pct_above_20', 'N/A')}%, "
        f"50 EMA: {b.get('pct_above_50', 'N/A')}%, "
        f"150 EMA: {b.get('pct_above_150', 'N/A')}%\n"
        f"Breadth ROC_13: {roc13:+.4f} ({_bucket_roc_bias(roc13)})\n"
        f"\n--- Industry Rotation ---\n"
        f"Rotating In: {rot_in_str}\n"
        f"Rotating Out: {rot_out_str}\n"
        f"\n--- Cycle Context ---\n"
        f"Astro: {astro_str} (Day score: {astro.get('day_score', 0):+.1f})\n"
        f"Panchang: {pang_str}\n"
        f"\nSummarize today's market."
    )


def _fmt_regime_explain(ctx: dict) -> str:
    b = ctx.get('breadth') or {}
    score = _safe_float(b.get('score'), 0)
    regime = _bucket_breadth_regime(score)

    roc = ctx.get('breadth_roc') or {}
    roc13 = _safe_float(roc.get('roc_13'), 0)
    roc55 = _safe_float(roc.get('roc_55'), 0)
    sma = _safe_float(roc.get('sma_breadth'), 0)

    return (
        f"Market regime as of {ctx['date']}:\n"
        f"Breadth Score: {score:.1f}\n"
        f"Regime: {regime}\n"
        f"% Above 20 EMA: {b.get('pct_above_20', 'N/A')}%\n"
        f"% Above 50 EMA: {b.get('pct_above_50', 'N/A')}%\n"
        f"% Above 150 EMA: {b.get('pct_above_150', 'N/A')}%\n"
        f"\nBreadth Momentum:\n"
        f"ROC_13: {roc13:+.4f}\n"
        f"ROC_55: {roc55:+.4f}\n"
        f"SMA_BREADTH: {sma:+.4f}\n"
        f"Fast vs slow: {'expanding' if roc13 > roc55 else 'narrowing'}\n"
        f"\nExplain the current market regime."
    )


def _fmt_rotation_overview(ctx: dict) -> str:
    def _fmt_list(items: list[dict]) -> str:
        if not items:
            return '  None'
        lines = []
        for e in items[:7]:
            lines.append(
                f"  {e['industry']} (Rank #{e['rank']}, "
                f"AvgRS: {e['avg_magic_rs']}, "
                f"Stocks: {e['stock_count']}, "
                f"Flow: {e['dominant_flow']})"
            )
        return '\n'.join(lines)

    return (
        f"Industry rotation as of {ctx['date']}:\n"
        f"\n--- Rotating In (rank improving 5+) ---\n"
        f"{_fmt_list(ctx.get('rotation_in', []))}\n"
        f"\n--- Leading (top quartile) ---\n"
        f"{_fmt_list(ctx.get('leading', []))}\n"
        f"\n--- Rotating Out (rank dropping 5+) ---\n"
        f"{_fmt_list(ctx.get('rotation_out', []))}\n"
        f"\nExplain where capital is flowing."
    )


def _fmt_warnings(ctx: dict) -> str:
    b = ctx.get('breadth') or {}
    score = _safe_float(b.get('score'), 0)
    regime = _bucket_breadth_regime(score)

    roc = ctx.get('breadth_roc') or {}
    roc13 = _safe_float(roc.get('roc_13'), 0)

    astro = ctx.get('astro', {})
    astro_events = astro.get('events', [])
    adverse = [e for e in astro_events if e.get('impact', '') in (
        'bearish', 'major_negative', 'minor_negative', 'volatile', 'highly_volatile'
    )]
    adverse_str = '; '.join(
        f"{e['event']} ({e['impact']})" for e in adverse[:3]
    ) if adverse else 'None'

    return (
        f"Warning check for {ctx['date']}:\n"
        f"\n--- Market Health ---\n"
        f"Breadth: {regime} (Score: {score:.1f})\n"
        f"ROC_13: {roc13:+.4f}\n"
        f"Manipulation Watch flags: {ctx.get('manipulation_count', 0)}\n"
        f"Broken signals (last 5 days): {ctx.get('broken_signals_count', 0)}\n"
        f"\n--- Adverse Astro Events ---\n"
        f"{adverse_str}\n"
        f"Astro day score: {astro.get('day_score', 0):+.1f}\n"
        f"\nAre there any warnings today?"
    )


def _fmt_breadth_explain(ctx: dict) -> str:
    b = ctx.get('breadth') or {}
    score = _safe_float(b.get('score'), 0)
    regime = _bucket_breadth_regime(score)

    roc = ctx.get('breadth_roc') or {}
    roc13 = _safe_float(roc.get('roc_13'), 0)
    roc55 = _safe_float(roc.get('roc_55'), 0)
    sma = _safe_float(roc.get('sma_breadth'), 0)
    spread = roc13 - roc55

    return (
        f"Breadth analysis for {ctx['date']}:\n"
        f"\n--- EMA Breakdown ---\n"
        f"Composite Score: {score:.1f} ({regime})\n"
        f"% Above 20-day EMA: {b.get('pct_above_20', 'N/A')}% (short-term participation)\n"
        f"% Above 50-day EMA: {b.get('pct_above_50', 'N/A')}% (intermediate trend)\n"
        f"% Above 150-day EMA: {b.get('pct_above_150', 'N/A')}% (structural trend)\n"
        f"\n--- Momentum Layer ---\n"
        f"ROC_13: {roc13:+.4f} ({'bullish' if roc13 > 0 else 'bearish'} momentum)\n"
        f"ROC_55: {roc55:+.4f} ({'bullish' if roc55 > 0 else 'bearish'} trend)\n"
        f"SMA_BREADTH: {sma:+.4f} ({'confirming' if sma > 0 else 'diverging'})\n"
        f"Fast/Slow spread: {spread:+.4f} "
        f"({'expanding' if spread > 0 else 'narrowing'})\n"
        f"\nExplain what the breadth data tells us."
    )


def _fmt_panchangam_outlook(ctx: dict) -> str:
    outlook = ctx.get('panchang_outlook', [])
    if not outlook:
        return f"No panchangam data available for {ctx['date']}."

    lines = []
    for i, day in enumerate(outlook):
        d = day['date']
        p = day.get('panchang')
        label = 'TODAY' if i == 0 else f'Day {i+1}'

        if p:
            special_str = ', '.join(p.get('special', [])) if p.get('special') else ''
            p_line = (
                f"  Tithi: {p['tithi']} (Lord: {p['tithi_lord']}), "
                f"Nakshatra: {p['nakshatra']} (Lord: {p['nakshatra_lord']}), "
                f"Vara: {p['vara']} (Lord: {p['vara_lord']}), "
                f"Moon: {p.get('moon_sign', 'N/A')}"
            )
            if special_str:
                p_line += f", Special: {special_str}"
        else:
            p_line = "  Panchangam data not available"

        astro_events = day.get('astro_events', [])
        if astro_events:
            events_str = '; '.join(
                f"{e['event']} ({e['impact']})" for e in astro_events[:3]
            )
        else:
            events_str = 'No active events'

        lines.append(
            f"\n[{label}] {d} — Astro direction: {day['direction']} (score: {day['day_score']:+.1f})\n"
            f"{p_line}\n"
            f"  Planetary events: {events_str}"
        )

    return (
        f"Panchangam & Planetary Outlook from {ctx['date']}:\n"
        + '\n'.join(lines)
        + "\n\nProvide today's panchangam reading and a day-by-day outlook."
    )


def _fmt_breadth_trend(ctx: dict) -> str:
    history = ctx.get('breadth_history', [])
    b = ctx.get('breadth') or {}
    score = _safe_float(b.get('score'), 0)
    regime = _bucket_breadth_regime(score)

    hist_lines = []
    for h in history:
        hist_lines.append(
            f"  {h['date']}: Score={h['score']:.1f} ({h['regime']}), "
            f"Above 20 EMA: {h['pct_above_20']}%, "
            f"50 EMA: {h['pct_above_50']}%, "
            f"150 EMA: {h['pct_above_150']}%"
        )
    hist_str = '\n'.join(hist_lines) if hist_lines else '  No history available'

    trend = 'stable'
    if len(history) >= 2:
        delta = history[-1]['score'] - history[0]['score']
        if delta > 2:
            trend = 'improving'
        elif delta < -2:
            trend = 'deteriorating'

    return (
        f"Market Breadth trend analysis as of {ctx['date']}:\n"
        f"\n--- Current ---\n"
        f"Score: {score:.1f} ({regime})\n"
        f"Above 20 EMA: {b.get('pct_above_20', 'N/A')}%, "
        f"50 EMA: {b.get('pct_above_50', 'N/A')}%, "
        f"150 EMA: {b.get('pct_above_150', 'N/A')}%\n"
        f"\n--- Last 3 Sessions ---\n{hist_str}\n"
        f"\n3-day trend: {trend}\n"
        f"\nExplain how market breadth has evolved over the last 2-3 days and what it means."
    )


def _fmt_breadth_momentum(ctx: dict) -> str:
    roc = ctx.get('breadth_roc') or {}
    roc13 = _safe_float(roc.get('roc_13'), 0)
    roc55 = _safe_float(roc.get('roc_55'), 0)
    sma = _safe_float(roc.get('sma_breadth'), 0)
    spread = roc13 - roc55

    history = ctx.get('breadth_roc_history', [])
    hist_lines = []
    for h in history:
        hist_lines.append(
            f"  {h['date']}: ROC_13={h['roc_13']:+.4f} ({h['bias']}), "
            f"ROC_55={h['roc_55']:+.4f}, Spread={h['spread']:+.6f}"
        )
    hist_str = '\n'.join(hist_lines) if hist_lines else '  No history available'

    roc_direction = 'strengthening'
    if len(history) >= 2:
        delta = history[-1]['roc_13'] - history[0]['roc_13']
        if delta < -0.0002:
            roc_direction = 'weakening'
        elif abs(delta) <= 0.0002:
            roc_direction = 'flat'

    return (
        f"Breadth Momentum analysis as of {ctx['date']}:\n"
        f"\n--- Current ROC Readings ---\n"
        f"ROC_13: {roc13:+.4f} ({'positive — bullish momentum breadth' if roc13 > 0 else 'negative — bearish momentum breadth'})\n"
        f"ROC_55: {roc55:+.4f} ({'positive — longer-term bullish' if roc55 > 0 else 'negative — longer-term bearish'})\n"
        f"SMA_BREADTH: {sma:+.4f} ({'confirming ROC_13' if (sma > 0) == (roc13 > 0) else 'diverging from ROC_13'})\n"
        f"Fast/Slow spread: {spread:+.4f} ({'fast outpacing slow — expanding' if spread > 0 else 'fast lagging slow — narrowing'})\n"
        f"\n--- Last 3 Sessions ---\n{hist_str}\n"
        f"Momentum direction: {roc_direction}\n"
        f"\nExplain why breadth momentum is {'positive' if roc13 > 0 else 'negative'} "
        f"and what this means for existing long and short positions."
    )
