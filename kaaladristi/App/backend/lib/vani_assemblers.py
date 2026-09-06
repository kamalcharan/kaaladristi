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
    assemble_instrument_context,
    _safe_float,
    _day_score,
)
from .vani_compliance import translate_zone, translate_flow


# ── Bucketing helpers ─────────────────────────────────────────────────────────

def _short_company_name(name: str) -> str:
    """Derive short display name from company_name (mirrors frontend symbolUtils)."""
    import re
    if not name:
        return ''
    suffixes = r'\s+(Limited|Ltd|Pvt\.?|Private|Corp\.?|Corporation|Company|Industries|Enterprises|Systems|Co\.?|Inc\.?|Incorporated|LLP|PLC)\s*$'
    cleaned = re.sub(suffixes, '', name, flags=re.IGNORECASE)
    cleaned = re.sub(suffixes, '', cleaned, flags=re.IGNORECASE).strip()
    if not cleaned:
        return name.strip()
    return ' '.join(cleaned.split()[:3])


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

    import logging
    _rlog = logging.getLogger('pipeline-api')

    try:
        rows = db.select(
            'km_industry_eod', '*',
            filters={'trade_date': target_date},
            order='industry_rank.asc',
            limit=200,
        )
        _rlog.info(f"[VaNi rotation] km_industry_eod rows for {target_date}: {len(rows or [])}")
    except Exception as ex:
        _rlog.error(f"[VaNi rotation] query failed: {ex}")
        return result

    if not rows:
        # Try to find the latest available date
        try:
            latest = db.select('km_industry_eod', 'trade_date', order='trade_date.desc', limit=1)
            _rlog.warning(f"[VaNi rotation] no data for {target_date}, latest available: {latest[0]['trade_date'] if latest else 'none'}")
        except Exception:
            pass
        return result

    total = len(rows)
    top_quartile = max(1, total // 4)

    current_ranks = {r['industry']: r.get('industry_rank', 999) for r in rows}
    current_data = {r['industry']: r for r in rows}

    # Find the lookback date (~5 trading days ago)
    # Fetch recent dates from km_industry_eod to find actual trading days
    try:
        date_rows = db.select(
            'km_industry_eod', 'trade_date',
            order='trade_date.desc',
            limit=200,
        )
        unique_dates = sorted(set(str(r.get('trade_date', '')) for r in date_rows if str(r.get('trade_date', '')) < target_date), reverse=True)
        lookback_trade_date = unique_dates[INDUSTRY_ROTATION_LOOKBACK_DAYS - 1] if len(unique_dates) >= INDUSTRY_ROTATION_LOOKBACK_DAYS else (unique_dates[-1] if unique_dates else None)
    except Exception:
        lookback_trade_date = None

    old_ranks = {}
    if lookback_trade_date:
        try:
            old_rows = db.select(
                'km_industry_eod', 'industry,industry_rank',
                filters={'trade_date': lookback_trade_date},
                order='industry_rank.asc',
                limit=200,
            )
            for r in (old_rows or []):
                ind = r.get('industry')
                if ind:
                    old_ranks[ind] = r.get('industry_rank', 999)
        except Exception:
            pass

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
            f"Flow={translate_flow(idx['flow_type'])}, "
            f"Participation={idx['participation']}, "
            f"MagicRS={translate_zone(idx['magic_rs_zone'])}"
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
                f"Flow: {translate_flow(e['dominant_flow'])})"
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


# ══════════════════════════════════════════════════════════════════════════════
# Astro Calendar Assemblers
# ══════════════════════════════════════════════════════════════════════════════

def assemble_astro_calendar_context(db, target_date: str = None) -> dict | None:
    """Assemble context for astro calendar intents.

    Uses the month containing target_date.
    """
    if not target_date:
        target_date = str(date.today())

    d = date.fromisoformat(target_date)
    year, month = d.year, d.month
    from calendar import monthrange
    num_days = monthrange(year, month)[1]
    month_start = f"{year}-{month:02d}-01"
    month_end = f"{year}-{month:02d}-{num_days:02d}"

    # Fetch all DC inferences
    try:
        all_inf = db.select('dc_inference', '*', order='start_date.asc', limit=500)
    except Exception:
        return None

    # Filter events active within this month
    month_events = []
    for inf in (all_inf or []):
        start = str(inf.get('start_date', ''))
        end = str(inf.get('end_date', '')) if inf.get('end_date') else start
        if end >= month_start and start <= month_end:
            month_events.append({
                'event': inf.get('astro_event', ''),
                'impact': inf.get('market_impact', ''),
                'confidence': inf.get('confidence'),
                'inference': inf.get('inference', ''),
                'start_date': start,
                'end_date': end,
            })

    # Day-by-day scores for the month
    day_scores = {}
    for day_num in range(1, num_days + 1):
        iso = f"{year}-{month:02d}-{day_num:02d}"
        day_events = [e for e in month_events if e['start_date'] <= iso <= e['end_date']]
        score = _day_score([{'market_impact': e['impact']} for e in day_events])
        day_scores[iso] = {'score': score, 'events': day_events}

    # Summary stats
    pos_days = sum(1 for v in day_scores.values() if v['score'] > 1)
    neg_days = sum(1 for v in day_scores.values() if v['score'] < -1)
    peak_days = sum(1 for v in day_scores.values() if v['score'] >= 4)

    # Week events (current week: today ± 3 days)
    week_start = str(d - timedelta(days=d.weekday()))
    week_end = str(d + timedelta(days=6 - d.weekday()))
    week_events = [e for e in month_events if e['end_date'] >= week_start and e['start_date'] <= week_end]

    # Turning dates
    turning_events = [e for e in month_events if 'turning' in (e.get('inference') or '').lower()]

    # Risk days (score < -1)
    risk_days = [
        {'date': iso, 'score': v['score'], 'events': v['events']}
        for iso, v in sorted(day_scores.items())
        if v['score'] < -1
    ]

    MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ]

    return {
        'date': target_date,
        'year': year,
        'month': month,
        'month_name': MONTH_NAMES[month - 1],
        'month_events': month_events,
        'month_summary': {
            'total_events': len(month_events),
            'positive_days': pos_days,
            'negative_days': neg_days,
            'peak_days': peak_days,
        },
        'week_events': week_events,
        'turning_events': turning_events,
        'risk_days': risk_days,
    }


def build_astro_cache_context(intent_id: str, ctx: dict) -> dict:
    """Cache key for astro calendar intents."""
    base = {
        'year': ctx.get('year'),
        'month': ctx.get('month'),
        'event_count': ctx.get('month_summary', {}).get('total_events', 0),
    }
    if 'week' in intent_id:
        base['date'] = ctx.get('date', '')
    return base


def format_astro_user_message(intent_id: str, ctx: dict) -> str:
    """Format astro calendar context into user message."""
    formatters = {
        'astro_calendar.month_outlook': _fmt_astro_month_outlook,
        'astro_calendar.week_events': _fmt_astro_week_events,
        'astro_calendar.turning_dates': _fmt_astro_turning_dates,
        'astro_calendar.risk_days': _fmt_astro_risk_days,
    }
    formatter = formatters.get(intent_id)
    if not formatter:
        return f"Context for {intent_id}:\n{ctx}"
    return formatter(ctx)


def _fmt_astro_month_outlook(ctx: dict) -> str:
    s = ctx.get('month_summary', {})
    events = ctx.get('month_events', [])

    event_lines = []
    for e in events[:15]:
        dates = e['start_date']
        if e['end_date'] != e['start_date']:
            dates += f" → {e['end_date']}"
        event_lines.append(
            f"  {dates}: {e['event']} ({e['impact']}, conf:{e['confidence']})"
            f"\n    {e['inference']}"
        )
    events_str = '\n'.join(event_lines) if event_lines else '  No events'

    return (
        f"Planetary outlook for {ctx['month_name']} {ctx['year']}:\n"
        f"\n--- Summary ---\n"
        f"Total events: {s.get('total_events', 0)}\n"
        f"Positive days (score > 1): {s.get('positive_days', 0)}\n"
        f"Negative days (score < -1): {s.get('negative_days', 0)}\n"
        f"Peak days (score >= 4): {s.get('peak_days', 0)}\n"
        f"\n--- Events ---\n{events_str}\n"
        f"\nWhat's the planetary outlook this month?"
    )


def _fmt_astro_week_events(ctx: dict) -> str:
    events = ctx.get('week_events', [])

    event_lines = []
    for e in events:
        dates = e['start_date']
        if e['end_date'] != e['start_date']:
            dates += f" → {e['end_date']}"
        event_lines.append(
            f"  {dates}: {e['event']} ({e['impact']}, conf:{e['confidence']})\n"
            f"    {e['inference']}"
        )
    events_str = '\n'.join(event_lines) if event_lines else '  No active events this week'

    return (
        f"This week's planetary events (week of {ctx['date']}):\n"
        f"\n{events_str}\n"
        f"\nExplain this week's planetary events."
    )


def _fmt_astro_turning_dates(ctx: dict) -> str:
    events = ctx.get('turning_events', [])

    event_lines = []
    for e in events:
        dates = e['start_date']
        if e['end_date'] != e['start_date']:
            dates += f" → {e['end_date']}"
        event_lines.append(
            f"  {dates}: {e['event']} ({e['impact']})\n"
            f"    {e['inference']}"
        )
    events_str = '\n'.join(event_lines) if event_lines else '  No turning dates identified this month'

    return (
        f"Turning dates in {ctx['month_name']} {ctx['year']}:\n"
        f"\n{events_str}\n"
        f"\nExplain the turning dates this month."
    )


def _fmt_astro_risk_days(ctx: dict) -> str:
    risk_days = ctx.get('risk_days', [])

    day_lines = []
    for rd in risk_days:
        events_str = ', '.join(
            f"{e['event']} ({e['impact']})" for e in rd['events'][:3]
        )
        day_lines.append(
            f"  {rd['date']}: Score {rd['score']:+.1f} — {events_str}"
        )
    days_str = '\n'.join(day_lines) if day_lines else '  No elevated-risk days this month'

    return (
        f"Elevated risk days in {ctx['month_name']} {ctx['year']}:\n"
        f"\n{days_str}\n"
        f"\nWhich days have elevated risk and why?"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Industry Transition Assemblers
# ══════════════════════════════════════════════════════════════════════════════

def assemble_industry_transition_context(db, target_date: str = None) -> dict | None:
    """Assemble context for industry transition intents."""
    # Always resolve to latest available date in km_industry_eod.
    #
    # No explicit indicator-completeness gate here — none is needed as long
    # as an invariant holds: `industry_composites` (which WRITES
    # km_industry_eod) is the LAST step in pipeline2/orchestrator.py's
    # DAILY_STEPS, running after nse/bse equity indicators and magic_rs. So a
    # km_industry_eod row existing for a date already implies the
    # km_equity_eod rows _fetch_top_stocks_in_leading() reads below (magic_rs
    # etc.) are committed for that date too. If that step order ever
    # changes, this — and the equity-level query downstream — silently
    # regresses to feeding VaNi's industry_transition intents partial data.
    # Mirrors the same note in the frontend's industryRotation.ts.
    try:
        rows = db.select('km_industry_eod', 'trade_date',
                         order='trade_date.desc', limit=1)
        latest_date = str(rows[0]['trade_date']) if rows else None
    except Exception:
        latest_date = None

    if not latest_date:
        return None

    # Use the earlier of target_date and latest available
    if target_date and target_date <= latest_date:
        pass
    else:
        target_date = latest_date

    rotation = _fetch_industry_rotation(db, target_date)

    # Fetch top stocks from leading industries
    top_stocks = _fetch_top_stocks_in_leading(db, target_date, rotation.get('leading', []))

    return {
        'date': target_date,
        'rotation_in': rotation['rotation_in'],
        'rotation_out': rotation['rotation_out'],
        'leading': rotation['leading'],
        'top_stocks': top_stocks,
        'summary': {
            'rotating_in_count': len(rotation['rotation_in']),
            'rotating_out_count': len(rotation['rotation_out']),
            'leading_count': len(rotation['leading']),
        },
    }


def _fetch_top_stocks_in_leading(db, target_date: str, leading: list[dict]) -> list[dict]:
    """Fetch top 15 stocks from leading industries by magic_rs."""
    import logging
    _log = logging.getLogger('pipeline-api')

    _log.info(f"[VaNi stocks] leading count={len(leading)}, names={[e.get('industry') for e in leading[:5]]}")
    if not leading:
        return []

    leading_names = [e['industry'] for e in leading]

    try:
        all_equities = db.select(
            'km_equity_symbols', 'id,symbol,company_name,industry',
            limit=3000,
        )
        _log.info(f"[VaNi stocks] total equities={len(all_equities or [])}")
    except Exception as ex:
        _log.error(f"[VaNi stocks] equity symbols fetch failed: {ex}")
        return []

    industry_equity_ids = {}
    for eq in (all_equities or []):
        ind = eq.get('industry', '')
        if ind in leading_names:
            industry_equity_ids.setdefault(ind, []).append(eq)

    eq_counts = {k: len(v) for k, v in industry_equity_ids.items()}
    _log.info(f"[VaNi stocks] matched industries={list(industry_equity_ids.keys())}, equity counts={eq_counts}")

    all_eq_map = {}
    for ind in leading_names:
        for eq in industry_equity_ids.get(ind, []):
            sym = eq.get('symbol', '')
            company = eq.get('company_name', '')
            display = sym if not sym.isdigit() else _short_company_name(company) or sym
            all_eq_map[eq['id']] = {'symbol': display, 'industry': ind}

    _log.info(f"[VaNi stocks] eq_map size={len(all_eq_map)}")
    if not all_eq_map:
        return []

    try:
        eod_rows = db.select(
            'km_equity_eod',
            'equity_id,close,pct_chng,magic_rs,magic_rs_zone,rsi_14,rss_value,rvol,flow_type,dot_svd,dot_sbd,dot_syd',
            filters={'trade_date': target_date},
            order='magic_rs.desc',
            limit=3000,
        )
        _log.info(f"[VaNi stocks] eod rows={len(eod_rows or [])} for date={target_date}")
    except Exception as ex:
        _log.error(f"[VaNi stocks] eod fetch failed: {ex}")
        return []

    top_stocks = []
    for row in (eod_rows or []):
        eid = row.get('equity_id')
        eq_info = all_eq_map.get(eid)
        if not eq_info:
            continue
        top_stocks.append({
            'symbol': eq_info['symbol'],
            'industry': eq_info['industry'],
            'close': _safe_float(row.get('close'), 0),
            'pct_chng': round(_safe_float(row.get('pct_chng'), 0), 2),
            'magic_rs': _safe_float(row.get('magic_rs')),
            'magic_rs_zone': row.get('magic_rs_zone'),
            'rsi_14': _safe_float(row.get('rsi_14')),
            'rss_value': _safe_float(row.get('rss_value')),
            'rvol': _safe_float(row.get('rvol')),
            'flow_type': row.get('flow_type'),
            'has_svd': bool(row.get('dot_svd')),
            'has_sbd': bool(row.get('dot_sbd')),
            'has_syd': bool(row.get('dot_syd')),
        })

    top_stocks.sort(key=lambda s: s.get('magic_rs') or 0, reverse=True)
    return top_stocks[:15]


def build_industry_cache_context(intent_id: str, ctx: dict) -> dict:
    """Cache key for industry transition intents."""
    return {
        'date': ctx.get('date', ''),
        'rot_in': ctx.get('summary', {}).get('rotating_in_count', 0),
        'rot_out': ctx.get('summary', {}).get('rotating_out_count', 0),
        'leading': ctx.get('summary', {}).get('leading_count', 0),
    }


def format_industry_user_message(intent_id: str, ctx: dict) -> str:
    """Format industry transition context into user message."""
    formatters = {
        'industry_transition.rotation_picture': _fmt_ind_rotation_picture,
        'industry_transition.gaining_momentum': _fmt_ind_gaining,
        'industry_transition.losing_strength': _fmt_ind_losing,
        'industry_transition.strongest_stocks': _fmt_ind_strongest,
    }
    formatter = formatters.get(intent_id)
    if not formatter:
        return f"Context for {intent_id}:\n{ctx}"
    return formatter(ctx)


def _fmt_industry_list(items: list[dict]) -> str:
    if not items:
        return '  None'
    lines = []
    for e in items[:10]:
        lines.append(
            f"  {e['industry']} — Rank #{e['rank']}, "
            f"Avg Magic RS: {e['avg_magic_rs']}, "
            f"Stocks: {e['stock_count']}, "
            f"Dominant Flow: {translate_flow(e['dominant_flow'])}"
        )
    return '\n'.join(lines)


def _fmt_ind_rotation_picture(ctx: dict) -> str:
    s = ctx.get('summary', {})
    return (
        f"Industry rotation as of {ctx['date']}:\n"
        f"\nCounts: {s.get('rotating_in_count', 0)} rotating in, "
        f"{s.get('leading_count', 0)} leading, "
        f"{s.get('rotating_out_count', 0)} rotating out\n"
        f"\n--- Rotating In ---\n{_fmt_industry_list(ctx.get('rotation_in', []))}\n"
        f"\n--- Leading ---\n{_fmt_industry_list(ctx.get('leading', []))}\n"
        f"\n--- Rotating Out ---\n{_fmt_industry_list(ctx.get('rotation_out', []))}\n"
        f"\nWhat's the rotation picture today?"
    )


def _fmt_ind_gaining(ctx: dict) -> str:
    return (
        f"Industries gaining momentum as of {ctx['date']}:\n"
        f"\n{_fmt_industry_list(ctx.get('rotation_in', []))}\n"
        f"\nWhich industries are gaining momentum and why?"
    )


def _fmt_ind_losing(ctx: dict) -> str:
    return (
        f"Industries losing strength as of {ctx['date']}:\n"
        f"\n{_fmt_industry_list(ctx.get('rotation_out', []))}\n"
        f"\nWhich industries are losing strength and why?"
    )


def _fmt_ind_strongest(ctx: dict) -> str:
    stocks = ctx.get('top_stocks', [])

    stock_lines = []
    for s in stocks[:15]:
        dots = []
        if s.get('has_svd'): dots.append('SVD')
        if s.get('has_sbd'): dots.append('SBD')
        if s.get('has_syd'): dots.append('SYD')
        dots_str = ', '.join(dots) if dots else 'None'

        stock_lines.append(
            f"  {s['symbol']} ({s['industry']}) — "
            f"Close: {s['close']:.2f} ({s['pct_chng']:+.2f}%), "
            f"RS Zone: {translate_zone(s.get('magic_rs_zone'))}, "
            f"RSI: {s.get('rsi_14', 'N/A')}, "
            f"RSS: {s.get('rss_value', 'N/A')}, "
            f"RVOL: {s.get('rvol', 'N/A')}, "
            f"Flow: {translate_flow(s.get('flow_type'))}, "
            f"Dots: {dots_str}"
        )
    stocks_str = '\n'.join(stock_lines) if stock_lines else '  No stocks found'

    return (
        f"Strongest stocks in leading industries as of {ctx['date']}:\n"
        f"\n{stocks_str}\n"
        f"\nWhat are the strongest stocks and why?"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Equity Assemblers (parameterized — entity-bound)
# ══════════════════════════════════════════════════════════════════════════════

def assemble_equity_context(db, entity_id: int, page_context: str = None, target_date: str = None, entity_type: str = 'equity') -> dict | None:
    """Assemble context for a specific instrument using the existing assembler."""
    ctx = assemble_instrument_context(db, entity_id, entity_type, target_date)
    if not ctx:
        return None

    ctx['page_context'] = page_context or 'direct'
    return ctx


def build_equity_cache_context(intent_id: str, ctx: dict) -> dict:
    """Cache key for equity intents — includes entity + key signal buckets."""
    return {
        # v2 (2026-09-03): the three equity.* prompts were rewritten from
        # 2-paragraph narration down to a 2-3 sentence read that assumes the
        # frontend's own Volume/Flow/RS/Delivery checklist — bumped so a
        # same-day cache hit can never serve the old long-form answer under
        # the new UI, which no longer has room for it.
        'v': 2,
        'date': ctx.get('date', ''),
        'entity_id': ctx.get('instrument', {}).get('id', ''),
        'rs_zone': ctx.get('relative_strength', {}).get('zone', ''),
        'flow': ctx.get('flow', {}).get('type', ''),
        'page_ctx': ctx.get('page_context', ''),
    }


# accum_distrib DB values → SEBI-safe display (sebi-sweep skill table)
_FLOW_SIG_DISPLAY = {
    'ACCUMULATION': 'Rising Flow',
    'DISTRIBUTION': 'Falling Flow',
}


def format_equity_user_message(intent_id: str, ctx: dict) -> str:
    """Format equity context into user message."""
    inst = ctx.get('instrument', {})
    symbol = inst.get('name', 'Unknown')
    p = ctx.get('price', {})
    f = ctx.get('flow', {})
    part = ctx.get('participation', {})
    mom = ctx.get('momentum', {})
    rs = ctx.get('relative_strength', {})
    vol = ctx.get('volume', {})
    dots = ctx.get('dots', {})
    gl = ctx.get('golden_line', {})
    astro = ctx.get('astro', {})
    page_ctx = ctx.get('page_context', '')

    dot_events = []
    if dots.get('svd_recent'): dot_events.append('SVD (institutional volume drive)')
    if dots.get('sbd_recent'): dot_events.append('SBD (rising-flow signature)')
    if dots.get('syd_recent'): dot_events.append('SYD (falling-flow signal)')
    dot_str = ', '.join(dot_events) if dot_events else 'None'

    astro_str = 'None active'
    if astro.get('events'):
        astro_str = '; '.join(f"{e['event']} ({e['impact']})" for e in astro['events'][:3])

    base_msg = (
        f"Stock: {symbol}\n"
        f"Date: {ctx.get('date', '')}\n"
        f"Price: {p.get('close', 0)} ({p.get('change_pct', 0):+.2f}%)\n"
        f"\n--- Signals ---\n"
        f"Flow: {translate_flow(f.get('type'))}\n"
        f"Vacuum: {f.get('vacuum', 'None')}\n"
        f"Flow Signature: {_FLOW_SIG_DISPLAY.get(f.get('accum_distrib'), 'None')}\n"
        f"Participation: {part.get('profile', 'unknown')} "
        f"(Inst: {part.get('institution')}, Hot$: {part.get('hot_money')})\n"
        f"RSI: {mom.get('rsi_14')}, MFI: {mom.get('mfi_14')}, "
        f"Momentum: {mom.get('alignment')}\n"
        f"Magic RS Zone: {translate_zone(rs.get('zone'))} "
        f"(RS={rs.get('magic_rs')}, MA={rs.get('magic_ma')})\n"
        f"Volume: RVOL={vol.get('rvol')}, TVOL={vol.get('tvol')}, "
        f"Character={vol.get('character')}\n"
        f"Dot Signals (5 bars): {dot_str}\n"
        f"SMA 150: {gl.get('sma_150')}, Bias={gl.get('bias')}\n"
        f"Astro: {astro_str} (Score: {astro.get('day_score', 0):+.1f})\n"
    )

    if intent_id == 'equity.why_in_context' and page_ctx:
        base_msg += f"\n--- Page Context ---\nViewed on: {page_ctx}\n"
        base_msg += f"\nWhy does {symbol} appear in this context?"
    elif intent_id == 'equity.risk_assessment':
        base_msg += f"\nAssess the risk on {symbol}."
    else:
        base_msg += f"\nExplain {symbol}'s signals."

    return base_msg


# ── Scanner Intents (parameterized by preset_id) ──────────────────────────────
# Context rows arrive from the FRONTEND payload — the exact filtered view the
# user sees (exchange filter, timeframe, VaNi-only toggle applied). They are
# display context only, never re-stored as truth. Preset copy (name/
# description/tooltip) is fetched server-side from kd_scan_presets so the
# explainer can't be spoofed and its cache hash derives from the DB copy.

# Per-preset narrative lens — how scanner.read_results frames the cohort.
SCANNER_LENS: dict[str, str] = {
    'power_buy':            'strength',
    'smart_money':          'strength',
    'quiet_accumulation':   'strength',
    'conviction_flow':      'strength',
    'stage_2_leaders':      'strength',
    'power_sell':           'warning',
    'distribution_warning': 'warning',
    'stage_3_watch':        'warning',
    'stage_4_leaders':      'warning',
    'vani_exit_watch':      'warning',
    'breakout_surge':       'setup',
    'flower_pot_burst':     'setup',
    'stage_2_watch':        'setup',
}

_SCANNER_MAX_ROWS = 25

# Fixed, closed list of real on-page tools every scanner page in this shell
# offers — same shape across presets, so this is prose, not per-preset data.
# explain_preset's system prompt requires the model pick ONLY from this list
# for "what to check next," rather than freelancing generic screening-theory
# vocabulary (relative volume, sector rotation, support levels) that isn't
# clickable on this page. Keep this in sync with the actual stat tiles/pills
# rendered in BreakoutSurgeStudio.tsx (and any later scanner page reusing
# this shell) — if a tile's label changes there, update it here too.
_SCANNER_ONPAGE_TOOLS = (
    "the 'Accelerating' filter (5-day momentum pace vs. 22-day pace), "
    "'Real Volume Behind' (delivery volume vs. its own recent norm), "
    "'Leading Industry' (which industry the day's results concentrate in), "
    "and the VaNi Highlight dot (a reward-to-risk screen shown next to "
    "some symbols)"
)


def _clean_scanner_rows(rows: list, hide_vani: bool) -> list[dict]:
    """Cap + sanitize payload rows; re-translate vocabulary defensively."""
    out = []
    for r in (rows or [])[:_SCANNER_MAX_ROWS]:
        if not isinstance(r, dict) or not r.get('symbol'):
            continue
        out.append({
            'symbol': str(r.get('symbol', ''))[:40],
            'industry': str(r.get('industry') or '—')[:60],
            'zone': translate_zone(r.get('zone')),
            'flow': translate_flow(r.get('flow')),
            'rsi': _safe_float(r.get('rsi')),
            'rvol': _safe_float(r.get('rvol')),
            'pct_chng': _safe_float(r.get('pct_chng')),
            'surge': _safe_float(r.get('surge')),
            'vani': False if hide_vani else bool(r.get('vani')),
        })
    return out


def assemble_scanner_context(
    db,
    preset_id: str,
    rows: list | None = None,
    data_date: str | None = None,
    timeframe: str = 'daily',
    exchange: str = 'combined',
    total_count: int | None = None,
    cohort_stats: dict | None = None,
    bookmarked_symbols: list | None = None,
    top_accelerators: list | None = None,
    highlight_facts: dict | None = None,
    weakness_facts: dict | None = None,
    gl_facts: dict | None = None,
    momentum_gap_facts: dict | None = None,
    leading_industry_facts: dict | None = None,
    sector_leading_facts: dict | None = None,
    new_since_yesterday_facts: dict | None = None,
    rs_flip_facts: dict | None = None,
    is_unusual_facts: dict | None = None,
) -> dict | None:
    """Build scanner intent context. Returns None if the preset is unknown.

    cohort_stats (Tier A, scannerenhancement.md): optional precomputed facts
    over the FULL result set (not the capped row sample below) — real VaNi
    highlight count, % accelerating, % on real volume, leading industry.
    None for any page that hasn't wired this yet; format_scanner_user_message
    falls back to the old sample-derived vani_count in that case.

    bookmarked_symbols / top_accelerators (scanner.your_view only): computed
    client-side from data the page already has (the user's own watchlist,
    score_5d - score_22d over the visible rows) and passed straight through —
    no new DB query on this path. Both None for every intent except
    scanner.your_view, which requires them.

    highlight_facts (scanner.why_highlighted only): real facts over the full
    day's VaNi-highlighted cohort — count, average RVOL/closeness-to-52-week-
    high/RS, and up to 2 named examples — computed client-side by
    computeHighlightExplainFacts() (breakoutSurgeInsights.ts). Not the
    generic "reward-to-risk" story legend_vani_dot used to (wrongly) claim;
    this is the real per-preset gate's numbers for today specifically.

    weakness_facts (scanner.why_highlighted_weakness only): the caution-side
    twin of highlight_facts, for the presets whose vani_rule is
    is_vani_weakness. Deliberately a DIFFERENT shape, because the rule is a
    different measurement: no closeness-to-52-week-high term (is_vani_weakness
    does not gate on it), and instead the zone/flow composition it does gate
    on, carried as display labels. Computed client-side by
    computeWeaknessExplainFacts() (breakoutSurgeInsights.ts).

    gl_facts (scanner.why_highlighted_gl only): the Golden Line pair, where
    every row IS the highlight (the scan filters on the event). Count, event
    type, average distance above the line, average sessions held above it,
    average RVOL, up to 2 examples — computed client-side by
    computeGlExplainFacts(). No volume-signature mix, on purpose: the dots
    are rewritten after the event is stamped and disagree on ~30% of rows.

    momentum_gap_facts (scanner.momentum_gap only): count of stocks whose
    5-day score outpaces their 22-day score (the same `isAccelerating()`
    definition the "Accelerating" stat tile and ScanFilterBar's toggle
    already use), the average gap among them, and up to 2 named examples —
    computed client-side by computeMomentumGapFacts() (breakoutSurgeInsights.ts).

    leading_industry_facts (scanner.leading_industry only): the industry with
    the most representation in today's own result set (not a cross-screener
    Sector Rotation signal), its count, the total result count, and the
    runner-up industry if present — computed client-side by
    computeLeadingIndustryFacts(), reusing the same breakdown
    computeCohortStats() already does for the "Leading Industry" stat tile.

    sector_leading_facts (scanner.sector_leading only): how many of today's
    results sit in an industry Sector Rotation's own industry_rank
    (km_industry_eod) currently ranks as leading (top quartile), and up to 2
    named leading industries with their count — computed client-side by
    computeSectorLeadingFacts() (breakoutSurgeInsights.ts), which joins each
    result's industry to a fetched rank map. Distinct from
    leading_industry_facts: this is a cross-screener market signal, not
    today's own in-result concentration.

    new_since_yesterday_facts / rs_flip_facts / is_unusual_facts (Phase 3,
    each intent-specific): real day-over-day facts from
    km_scan_membership_daily (migration 198), computed client-side by
    computeNewSinceYesterdayFacts() / computeRsFlipFacts() /
    computeIsUnusualFacts() (breakoutSurgeInsights.ts). All three are None
    until the frontend has at least one prior day's snapshot to diff
    against — see buildDayOverDayContext()'s own comment.
    """
    # The two universal glossary intents (scanner.how_bookmarks_work,
    # scanner.legend_vani_dot) still require a preset_id at the API layer
    # (every scanner.* intent does) but their content is preset-independent —
    # they're seeded once per active preset by warm-help-intents and served
    # from cache, never re-derived from preset copy.
    try:
        preset_rows = db.select(
            'kd_scan_presets', 'id,name,description,tooltip,vani_rule,is_active',
            filters={'id': preset_id}, limit=1,
        )
    except Exception:
        preset_rows = None
    if not preset_rows:
        return None
    preset = preset_rows[0]

    hide_vani = (preset.get('vani_rule') == 'always_true')
    return {
        'preset_id': preset_id,
        'preset': {
            'name': preset.get('name', preset_id),
            'description': preset.get('description') or '',
            'tooltip': preset.get('tooltip') or '',
        },
        'lens': SCANNER_LENS.get(preset_id, 'strength'),
        'data_date': data_date or '',
        'timeframe': timeframe,
        'exchange': exchange,
        'rows': _clean_scanner_rows(rows or [], hide_vani),
        'total_count': total_count if total_count is not None else len(rows or []),
        'cohort_stats': cohort_stats,
        'bookmarked_symbols': [str(s)[:40] for s in (bookmarked_symbols or [])][:20],
        'top_accelerators': [
            {'symbol': str(a.get('symbol', ''))[:40], 'delta': _safe_float(a.get('delta'))}
            for a in (top_accelerators or []) if isinstance(a, dict) and a.get('symbol')
        ][:5],
        'highlight_facts': _clean_highlight_facts(highlight_facts),
        'weakness_facts': _clean_weakness_facts(weakness_facts),
        'gl_facts': _clean_gl_facts(gl_facts),
        'momentum_gap_facts': _clean_momentum_gap_facts(momentum_gap_facts),
        'leading_industry_facts': _clean_leading_industry_facts(leading_industry_facts),
        'sector_leading_facts': _clean_sector_leading_facts(sector_leading_facts),
        'new_since_yesterday_facts': _clean_new_since_yesterday_facts(new_since_yesterday_facts),
        'rs_flip_facts': _clean_rs_flip_facts(rs_flip_facts),
        'is_unusual_facts': _clean_is_unusual_facts(is_unusual_facts),
    }


def _clean_momentum_gap_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed momentum-gap payload — same shape
    discipline as _clean_highlight_facts."""
    if not isinstance(facts, dict):
        return None
    examples = []
    for e in (facts.get('examples') or [])[:2]:
        if not isinstance(e, dict) or not e.get('symbol'):
            continue
        examples.append({
            'symbol': str(e['symbol'])[:40],
            'gap': _safe_float(e.get('gap')),
            'score_5d': _safe_float(e.get('score_5d')),
            'score_22d': _safe_float(e.get('score_22d')),
        })
    return {
        'count': int(facts.get('count') or 0),
        'avg_gap': _safe_float(facts.get('avg_gap')),
        'examples': examples,
    }


def _clean_leading_industry_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed leading-industry payload."""
    if not isinstance(facts, dict) or not facts.get('name'):
        return None
    runner_up = facts.get('runner_up')
    return {
        'name': str(facts['name'])[:60],
        'count': int(facts.get('count') or 0),
        'total_count': int(facts.get('total_count') or 0),
        'runner_up': (
            {'name': str(runner_up['name'])[:60], 'count': int(runner_up.get('count') or 0)}
            if isinstance(runner_up, dict) and runner_up.get('name') else None
        ),
    }


def _clean_sector_leading_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed sector-leading payload."""
    if not isinstance(facts, dict):
        return None
    industries = []
    for i in (facts.get('industries') or [])[:2]:
        if not isinstance(i, dict) or not i.get('name'):
            continue
        industries.append({'name': str(i['name'])[:60], 'count': int(i.get('count') or 0)})
    return {
        'count': int(facts.get('count') or 0),
        'industries': industries,
    }


def _clean_new_since_yesterday_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed new-since-yesterday payload. None when
    the frontend has no prior-day snapshot to diff against yet."""
    if not isinstance(facts, dict) or not facts.get('prior_date'):
        return None
    examples = []
    for e in (facts.get('examples') or [])[:3]:
        if not isinstance(e, dict) or not e.get('symbol'):
            continue
        examples.append({'symbol': str(e['symbol'])[:40]})
    return {
        'count': int(facts.get('count') or 0),
        'prior_date': str(facts['prior_date']),
        'examples': examples,
    }


def _clean_rs_flip_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed RS-flip payload. None when the
    frontend has no prior-day snapshot to diff against yet."""
    if not isinstance(facts, dict) or not facts.get('prior_date'):
        return None
    examples = []
    for e in (facts.get('examples') or [])[:3]:
        if not isinstance(e, dict) or not e.get('symbol'):
            continue
        examples.append({
            'symbol': str(e['symbol'])[:40],
            'from_zone': str(e['from_zone'])[:30] if e.get('from_zone') else None,
            'to_zone': str(e['to_zone'])[:30] if e.get('to_zone') else None,
        })
    return {
        'count': int(facts.get('count') or 0),
        'prior_date': str(facts['prior_date']),
        'examples': examples,
    }


def _clean_is_unusual_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed is-unusual payload. None when there's
    fewer than 3 prior sessions of count history (minimum-sample floor)."""
    if not isinstance(facts, dict) or facts.get('today_count') is None:
        return None
    return {
        'today_count': int(facts.get('today_count') or 0),
        'avg_count': _safe_float(facts.get('avg_count')),
        'lookback_days': int(facts.get('lookback_days') or 0),
    }


def _clean_highlight_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed highlight-explain payload before it
    reaches the cache key or the LLM prompt."""
    if not isinstance(facts, dict):
        return None
    examples = []
    for e in (facts.get('examples') or [])[:2]:
        if not isinstance(e, dict) or not e.get('symbol'):
            continue
        examples.append({
            'symbol': str(e['symbol'])[:40],
            'rvol': _safe_float(e.get('rvol')),
            'pct_of_52w_high': _safe_float(e.get('pct_of_52w_high')),
            'magic_rs': _safe_float(e.get('magic_rs')),
        })
    return {
        'count': int(facts.get('count') or 0),
        'avg_rvol': _safe_float(facts.get('avg_rvol')),
        'avg_pct_of_52w_high': _safe_float(facts.get('avg_pct_of_52w_high')),
        'avg_magic_rs': _safe_float(facts.get('avg_magic_rs')),
        'examples': examples,
    }


def _clean_weakness_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed weakness-explain payload — same discipline
    as _clean_highlight_facts, against the keys THIS rule measures.

    The zone/flow labels arrive already mapped through signalScale's
    ZONE_LABELS / FLOW_LABELS on the client, so a raw DB value like
    'Strong Bear' can never reach a prompt; they are length-capped here and
    otherwise passed through as the display strings they are."""
    if not isinstance(facts, dict):
        return None

    def _mix(key: str) -> list:
        out = []
        for m in (facts.get(key) or [])[:4]:
            if not isinstance(m, dict) or not m.get('label'):
                continue
            out.append({'label': str(m['label'])[:40], 'count': int(m.get('count') or 0)})
        return out

    examples = []
    for e in (facts.get('examples') or [])[:2]:
        if not isinstance(e, dict) or not e.get('symbol'):
            continue
        examples.append({
            'symbol': str(e['symbol'])[:40],
            'rvol': _safe_float(e.get('rvol')),
            'magic_rs': _safe_float(e.get('magic_rs')),
            'zone': str(e.get('zone') or '')[:40],
            'flow': str(e.get('flow') or '')[:40],
        })
    return {
        'count': int(facts.get('count') or 0),
        'avg_rvol': _safe_float(facts.get('avg_rvol')),
        'avg_magic_rs': _safe_float(facts.get('avg_magic_rs')),
        'zone_mix': _mix('zone_mix'),
        'flow_mix': _mix('flow_mix'),
        'examples': examples,
    }


def _clean_gl_facts(facts: dict | None) -> dict | None:
    """Sanitize the client-computed Golden Line explain payload."""
    if not isinstance(facts, dict):
        return None
    event = facts.get('event')
    if event not in ('BREAKOUT', 'RETEST'):
        return None
    examples = []
    for e in (facts.get('examples') or [])[:2]:
        if not isinstance(e, dict) or not e.get('symbol'):
            continue
        examples.append({
            'symbol': str(e['symbol'])[:40],
            'pct_from_gl': _safe_float(e.get('pct_from_gl')),
            'days_above': _safe_float(e.get('days_above')),
            'rvol': _safe_float(e.get('rvol')),
        })
    return {
        'count': int(facts.get('count') or 0),
        'event': event,
        'avg_pct_from_gl': _safe_float(facts.get('avg_pct_from_gl')),
        'avg_days_above': _safe_float(facts.get('avg_days_above')),
        'avg_rvol': _safe_float(facts.get('avg_rvol')),
        'examples': examples,
    }


def build_scanner_cache_context(intent_id: str, ctx: dict) -> dict:
    """Bucketed values for km_vani_cache context hashing.

    explain_preset hashes ONLY the preset copy — the entry lives until the
    screener's name/description/tooltip changes (the 'no change of state,
    no LLM invoke' rule). read_results hashes the visible result identity.
    your_view hashes the PERSONALIZATION inputs only (not the shared row
    list) — two users with the same bookmarks/accelerators correctly share
    a cache entry, two with different ones correctly don't. The two glossary
    intents hash to a constant (ignoring preset/date/rows entirely) since
    their answer is universal — seeded once per active preset by
    warm-help-intents, but content-identical across every preset.
    """
    # 'v' is a prompt-version marker: bump it whenever the scanner prompt or
    # message format changes so stale cached responses can never be served.
    # v4: bullet-format rewrite of explain_preset/read_results + 3 new
    # intents (your_view, how_bookmarks_work, legend_vani_dot).
    # explain_preset v4: onboarding rewrite — grounds the "what to check
    # next" bullet in this page's real on-page tools instead of letting the
    # model invent generic screening-theory vocabulary.
    if intent_id == 'scanner.explain_preset':
        return {'v': 4, 'preset_id': ctx['preset_id'], **ctx['preset']}
    if intent_id == 'scanner.how_bookmarks_work':
        return {'v': 1, 'intent': intent_id}
    if intent_id == 'scanner.legend_vani_dot':
        # v2: corrected the old wrong "reward-to-risk vs ATR" claim — that
        # mechanism doesn't gate the highlight dot for any preset; bumped so
        # the old (factually incorrect) cached answer can never be served.
        return {'v': 2, 'intent': intent_id}
    if intent_id == 'scanner.why_highlighted':
        f = ctx.get('highlight_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'count': f.get('count', 0),
            'avg_rvol_bucket': round(f['avg_rvol']) if f.get('avg_rvol') is not None else None,
            'avg_pct_52wh_bucket': round(f['avg_pct_of_52w_high']) if f.get('avg_pct_of_52w_high') is not None else None,
            'examples': [e['symbol'] for e in (f.get('examples') or [])],
        }
    if intent_id == 'scanner.why_highlighted_weakness':
        f = ctx.get('weakness_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'count': f.get('count', 0),
            'avg_rvol_bucket': round(f['avg_rvol']) if f.get('avg_rvol') is not None else None,
            'avg_magic_rs_bucket': round(f['avg_magic_rs']) if f.get('avg_magic_rs') is not None else None,
            'examples': [e['symbol'] for e in (f.get('examples') or [])],
        }
    if intent_id == 'scanner.why_highlighted_gl':
        f = ctx.get('gl_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'event': f.get('event'),
            'count': f.get('count', 0),
            'avg_pct_bucket': round(f['avg_pct_from_gl']) if f.get('avg_pct_from_gl') is not None else None,
            'avg_days_bucket': round(f['avg_days_above']) if f.get('avg_days_above') is not None else None,
            'examples': [e['symbol'] for e in (f.get('examples') or [])],
        }
    if intent_id == 'scanner.your_view':
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'bookmarked': sorted(ctx.get('bookmarked_symbols') or []),
            'accelerators': [a['symbol'] for a in (ctx.get('top_accelerators') or [])],
            'vani_count': sum(1 for r in ctx['rows'] if r['vani']),
        }
    if intent_id == 'scanner.momentum_gap':
        f = ctx.get('momentum_gap_facts') or {}
        # v2: prompt reworded to serve both directions ("moved furthest from
        # its own recent pace" rather than "pulled ahead"), so v1 answers —
        # written for a strength cohort — must never be served again.
        return {
            'v': 2,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'count': f.get('count', 0),
            'avg_gap_bucket': round(f['avg_gap']) if f.get('avg_gap') is not None else None,
            'examples': [e['symbol'] for e in (f.get('examples') or [])],
        }
    if intent_id == 'scanner.leading_industry':
        f = ctx.get('leading_industry_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'name': f.get('name'),
            'count': f.get('count'),
            'runner_up': (f.get('runner_up') or {}).get('name'),
        }
    if intent_id == 'scanner.sector_leading':
        f = ctx.get('sector_leading_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'count': f.get('count', 0),
            'industries': [i['name'] for i in (f.get('industries') or [])],
        }
    if intent_id == 'scanner.new_since_yesterday':
        f = ctx.get('new_since_yesterday_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'prior_date': f.get('prior_date'),
            'count': f.get('count', 0),
            'examples': [e['symbol'] for e in (f.get('examples') or [])],
        }
    if intent_id == 'scanner.rs_flip':
        f = ctx.get('rs_flip_facts') or {}
        # v2: the prompt is now direction-neutral (it serves the caution
        # presets too) and the examples carry ZONE_LABELS display labels
        # instead of raw 'Strong Bull'/'Strong Bear' DB values. v1 answers
        # were written against both of the old behaviours — never serve them.
        return {
            'v': 2,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'prior_date': f.get('prior_date'),
            'count': f.get('count', 0),
            'examples': [(e['symbol'], e.get('from_zone'), e.get('to_zone')) for e in (f.get('examples') or [])],
        }
    if intent_id == 'scanner.is_unusual':
        f = ctx.get('is_unusual_facts') or {}
        return {
            'v': 1,
            'preset_id': ctx['preset_id'],
            'date': ctx['data_date'],
            'today_count': f.get('today_count'),
            'avg_count_bucket': round(f['avg_count']) if f.get('avg_count') is not None else None,
        }
    return {
        'v': 4,
        'preset_id': ctx['preset_id'],
        'date': ctx['data_date'],
        'timeframe': ctx['timeframe'],
        'exchange': ctx['exchange'],
        'symbols': [r['symbol'] for r in ctx['rows']],
        'vani_count': sum(1 for r in ctx['rows'] if r['vani']),
        'cohort_stats': ctx.get('cohort_stats'),
    }


def _mask_numbers(text: str) -> str:
    """Strip numeric values from preset copy before it reaches the LLM —
    the explainer must never reveal thresholds, and a model can't echo a
    number it never saw. '20 sessions' → 'a set number of sessions',
    '₹50' / '1.5×' / '60%' → dropped."""
    import re
    out = re.sub(r'[₹]\s*\d+(?:\.\d+)?\s*(Cr)?', 'a set level', text)
    out = re.sub(r'\d+(?:\.\d+)?\s*[x×]', 'a set multiple of', out)
    out = re.sub(r'\d+(?:\.\d+)?\s*%', 'a set share', out)
    out = re.sub(r'\d+(?:\.\d+)?[-\s]*(day|session|week|month|bar)s?\b',
                 r'a set number of \1s', out)
    out = re.sub(r'\d+(?:\.\d+)?', 'a set value', out)
    return re.sub(r'\s{2,}', ' ', out)


def format_scanner_user_message(intent_id: str, ctx: dict) -> str:
    """Format scanner context into the LLM user message."""
    p = ctx['preset']

    if intent_id == 'scanner.explain_preset':
        return (
            f"Screener: {p['name']}\n"
            f"Description: {_mask_numbers(p['description'])}\n"
            f"Matching criteria (do NOT repeat thresholds or exact values): "
            f"{_mask_numbers(p['tooltip']) if p['tooltip'] else 'not documented'}\n"
            f"\nReal on-page tools (use ONLY these when naming what to check "
            f"next — do not invent or substitute generic concepts not in "
            f"this list): {_SCANNER_ONPAGE_TOOLS}. Separately, 'Your View' "
            f"gives a personalized read: the user's own bookmarked stocks in "
            f"this list, plus which names are accelerating fastest.\n"
            f"\nInstructions: Write ONE opening line naming the concept in "
            f"plain language, then 3 bullet points (each starting with "
            f"'• ', each one short line): (1) what the list IS (an "
            f"observation of current conditions) vs. what it is NOT (a "
            f"prediction or trade instruction); (2) name 2-3 of the real "
            f"on-page tools above by their exact label as what to check "
            f"next; (3) that 'Your View' gives a personalized read of their "
            f"bookmarks and acceleration. Never mention any number, price "
            f"level, percentage, or lookback length. Do not name specific "
            f"stocks."
        )

    if intent_id == 'scanner.how_bookmarks_work':
        return (
            "Instructions: Write ONE opening line stating what bookmarking "
            "does, then 2 bullet points (each starting with '• ', each one "
            "short line): how to bookmark or unbookmark a stock, and where "
            "bookmarked stocks show up across the product. Do not reference "
            "any specific stock, screener, or date."
        )

    if intent_id == 'scanner.legend_vani_dot':
        return (
            "Instructions: Write 1 to 2 short sentences (no bullets) "
            "explaining the small colored dot shown next to some stock "
            "symbols in scan results — it marks a 'VaNi Highlight', a stock "
            "that additionally cleared this particular screener's own extra "
            "quality bar (commonly unusual volume conviction near a "
            "meaningful price level; the exact combination varies by "
            "screener — do not assert one specific formula as universal). "
            "State plainly this is a measurement, not a recommendation to "
            "act. Do not reference any specific stock, screener, or date."
        )

    if intent_id == 'scanner.why_highlighted':
        f = ctx.get('highlight_facts') or {}
        count = f.get('count', 0)
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"Highlighted today: 0\n"
                f"\nInstructions: In ONE line, say plainly that nothing is "
                f"highlighted on this screener today — no bullets needed."
            )
        avg_rvol = f.get('avg_rvol')
        avg_pct = f.get('avg_pct_of_52w_high')
        avg_rs = f.get('avg_magic_rs')
        examples = f.get('examples') or []
        ex_lines = '\n'.join(
            f"  {e['symbol']}: RVOL {e['rvol']:.1f}x normal, "
            f"{e['pct_of_52w_high']:.0f}% of its 52-week high"
            + (f", Magic RS {e['magic_rs']:.0f}" if e.get('magic_rs') is not None else '')
            for e in examples if e.get('rvol') is not None and e.get('pct_of_52w_high') is not None
        ) or '  (no example detail available)'
        return (
            f"Screener: {p['name']}\n"
            f"Highlighted today: {count} stocks\n"
            f"Average RVOL among them: "
            f"{f'{avg_rvol:.1f}x normal' if avg_rvol is not None else 'not available'}\n"
            f"Average closeness to their own 52-week high: "
            f"{f'{avg_pct:.0f}%' if avg_pct is not None else 'not available'}\n"
            f"Average Magic RS: {f'{avg_rs:.0f}' if avg_rs is not None else 'not available'}\n"
            f"\n--- Named examples (use ONLY these, at most these 2) ---\n"
            f"{ex_lines}\n"
            f"\nInstructions: Write ONE opening line stating the count and "
            f"the shared shape (elevated volume near a fresh high), then 2 "
            f"bullet points (each starting with '• ', each one short line): "
            f"(1) name the example(s) above with their own RVOL and "
            f"closeness-to-high numbers; (2) state plainly this is a "
            f"measurement of unusual participation, not a signal to buy. "
            f"Never name a stock not listed above."
        )

    if intent_id == 'scanner.your_view':
        bm = ctx.get('bookmarked_symbols') or []
        bm_str = ', '.join(bm) if bm else 'None of the visible results are on the user\'s watchlist'
        acc = ctx.get('top_accelerators') or []
        acc_lines = '\n'.join(
            f"  {a['symbol']}: 5-day score {a['delta']:+.1f} ahead of 22-day score" for a in acc
        ) if acc else '  No meaningful acceleration in this result set'
        cohort = ctx.get('cohort_stats')
        vani_count = cohort['vani_highlight_count'] if cohort else sum(1 for r in ctx['rows'] if r['vani'])
        return (
            f"Screener: {p['name']}\n"
            f"Data date: {ctx['data_date']}\n"
            f"\n--- User's bookmarked stocks in today's results ---\n{bm_str}\n"
            f"\n--- Biggest 5-day vs 22-day momentum acceleration ---\n{acc_lines}\n"
            f"\n--- Full cohort ---\nVaNi highlights: {vani_count} of {ctx['total_count']} total results\n"
            f"\nInstructions: Write 3 to 4 bullet points (each starting with "
            f"'• ', each one short line): lead with the bookmarked stocks if "
            f"any are present (name them with their signal), otherwise say "
            f"plainly that none of today's results are on the watchlist; "
            f"then the top 1-2 acceleration stocks by name; then the VaNi-"
            f"highlight count as a measurement, never as picks. If both the "
            f"bookmark and acceleration sections are empty, say there is "
            f"nothing personalized to report today rather than padding with "
            f"generic commentary. Use only the stocks and numbers listed "
            f"above — never manufacture names."
        )

    if intent_id == 'scanner.why_highlighted_weakness':
        f = ctx.get('weakness_facts') or {}
        count = f.get('count', 0)
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"Highlighted today: 0\n"
                f"\nInstructions: In ONE line, say plainly that nothing is "
                f"highlighted on this screener today — no bullets needed."
            )
        avg_rvol = f.get('avg_rvol')
        avg_rs = f.get('avg_magic_rs')
        zone_mix = f.get('zone_mix') or []
        flow_mix = f.get('flow_mix') or []
        zone_line = ', '.join(f"{m['label']} {m['count']}" for m in zone_mix) or 'not available'
        flow_line = ', '.join(f"{m['label']} {m['count']}" for m in flow_mix) or 'not available'
        examples = f.get('examples') or []
        ex_lines = '\n'.join(
            f"  {e['symbol']}: RVOL {e['rvol']:.1f}x normal, band {e['zone']}, flow {e['flow']}"
            + (f", Magic RS {e['magic_rs']:.0f}" if e.get('magic_rs') is not None else '')
            for e in examples if e.get('rvol') is not None
        ) or '  (no example detail available)'
        return (
            f"Screener: {p['name']}\n"
            f"Highlighted today: {count} stocks\n"
            f"Average RVOL among them: "
            + (f"{avg_rvol:.1f}x normal\n" if avg_rvol is not None else "not available\n")
            + f"Average relative-strength reading: "
            + (f"{avg_rs:.0f}\n" if avg_rs is not None else "not available\n")
            + f"Relative-strength bands represented: {zone_line}\n"
            f"Order-flow readings represented: {flow_line}\n"
            f"\n--- Named examples (use ONLY these, at most these 2) ---\n"
            f"{ex_lines}\n"
            f"\nInstructions: Write ONE opening line stating the count and "
            f"the shared shape these stocks have in common — elevated volume "
            f"alongside a weak relative-strength reading and the order-flow "
            f"readings listed. Then 2 bullet points, each starting with "
            f"'• ', each ONE short line: (1) name the example(s) above, "
            f"citing their own RVOL and band as illustration of that same "
            f"shared pattern — never call them picks or recommendations; "
            f"(2) state plainly this is a measurement of unusual "
            f"participation, not a signal to act. Use the band and flow "
            f"labels exactly as given above; never substitute "
            f"bull/bullish/bear/bearish for them. Never name a stock not "
            f"listed above, and never invent a number not provided."
        )

    if intent_id == 'scanner.why_highlighted_gl':
        f = ctx.get('gl_facts') or {}
        count = f.get('count', 0)
        event = f.get('event') or 'BREAKOUT'
        rule = (
            "closed back above the 150-day Golden Line from at or below it, on a "
            "volume-drive or accumulation bar"
            if event == 'BREAKOUT' else
            "touched the 150-day Golden Line intraday and closed above it, on a "
            "volume-drive or accumulation bar, after at least ten prior sessions "
            "already above the line"
        )
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"Golden Line {event.lower()}s today: 0\n"
                f"\nInstructions: In ONE line, say plainly that no stock printed "
                f"this event today — no bullets needed."
            )
        avg_pct = f.get('avg_pct_from_gl')
        avg_days = f.get('avg_days_above')
        avg_rvol = f.get('avg_rvol')
        examples = f.get('examples') or []
        ex_lines = '\n'.join(
            f"  {e['symbol']}: "
            + (f"{e['pct_from_gl']:.1f}% above the line" if e.get('pct_from_gl') is not None else "distance not available")
            + (f", held {e['days_above']:.0f} sessions above it" if event == 'RETEST' and e.get('days_above') is not None else '')
            + (f", RVOL {e['rvol']:.1f}x normal" if e.get('rvol') is not None else '')
            for e in examples
        ) or '  (no example detail available)'
        return (
            f"Screener: {p['name']}\n"
            f"What every stock here did today: {rule}.\n"
            f"Golden Line {event.lower()}s today: {count} stocks (every row on this "
            f"screener is one — the event IS the highlight)\n"
            f"Average distance above the line: "
            + (f"{avg_pct:.1f}%\n" if avg_pct is not None else "not available\n")
            + (f"Average sessions held above the line before the touch: {avg_days:.0f}\n"
               if event == 'RETEST' and avg_days is not None else '')
            + f"Average RVOL: "
            + (f"{avg_rvol:.1f}x normal\n" if avg_rvol is not None else "not available\n")
            + f"\n--- Named examples (use ONLY these, at most these 2) ---\n"
            f"{ex_lines}\n"
            f"\nInstructions: Write ONE opening line stating the count and what the "
            f"event is, in the words given above. Then 2 bullet points, each "
            f"starting with '• ', each ONE short line: (1) name the example(s) "
            f"above with their own numbers as illustration — never call them picks "
            f"or recommendations; (2) state plainly this is a record of a price "
            f"level being crossed or held with participation behind it, not a "
            f"signal to act. Do not describe a volume signature for any named stock "
            f"beyond the words given above. Never name a stock not listed, and "
            f"never invent a number not provided."
        )

    if intent_id == 'scanner.momentum_gap':
        f = ctx.get('momentum_gap_facts') or {}
        count = f.get('count', 0)
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"Stocks whose 5-day momentum diverges from their own "
                f"22-day pace today: 0\n"
                f"\nInstructions: In ONE line, say plainly that nothing "
                f"shows a meaningful momentum gap on this screener today — "
                f"no bullets needed."
            )
        avg_gap = f.get('avg_gap')
        examples = f.get('examples') or []
        ex_lines = '\n'.join(
            f"  {e['symbol']}: 5-day score {e['score_5d']:.0f}, "
            f"22-day score {e['score_22d']:.0f}, distance from own pace "
            f"{e['gap']:.0f}"
            for e in examples if e.get('score_5d') is not None and e.get('score_22d') is not None
        ) or '  (no example detail available)'
        return (
            f"Screener: {p['name']}\n"
            f"Stocks whose 5-day momentum diverges from their own "
            f"22-day pace today: {count}\n"
            f"Average distance from own pace among them: "
            f"{f'{avg_gap:.0f} points' if avg_gap is not None else 'not available'}\n"
            f"\n--- Named examples (use ONLY these, at most these 2) ---\n"
            f"{ex_lines}\n"
            f"\nInstructions: Write ONE opening line stating the count, "
            f"then 2 bullet points (each starting with '• ', each one "
            f"short line): (1) name the example(s) above with their own "
            f"5-day/22-day/distance numbers; (2) state plainly this "
            f"measures how far a stock has moved from its own recent pace, "
            f"not a signal to act. The distance is reported as a magnitude — "
            f"do not describe its direction as favourable or unfavourable. "
            f"Never name a stock not listed above."
        )

    if intent_id == 'scanner.leading_industry':
        f = ctx.get('leading_industry_facts') or {}
        if not f.get('name'):
            return (
                f"Screener: {p['name']}\n"
                f"No industry breakdown available today.\n"
                f"\nInstructions: In ONE short sentence, say plainly there "
                f"is no industry concentration to report today."
            )
        runner_up = f.get('runner_up')
        runner_up_str = (
            f"Runner-up industry: {runner_up['name']} ({runner_up['count']} names)\n"
            if runner_up else "No runner-up industry to report.\n"
        )
        return (
            f"Screener: {p['name']}\n"
            f"Leading industry: {f['name']} ({f['count']} of {f['total_count']} results)\n"
            f"{runner_up_str}"
            f"\nInstructions: Write 1 to 2 short sentences (no bullets) "
            f"naming the leading industry and its share of today's results, "
            f"and the runner-up if present, for contrast. State plainly "
            f"this is a measurement of today's concentration, not a sector "
            f"call. Never invent an industry name not listed above."
        )

    if intent_id == 'scanner.sector_leading':
        f = ctx.get('sector_leading_facts') or {}
        count = f.get('count', 0)
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"Results in a currently-leading industry: 0\n"
                f"\nInstructions: In ONE to two short sentences, say plainly "
                f"that none of today's results sit in an industry Sector "
                f"Rotation currently ranks as leading."
            )
        industries = f.get('industries') or []
        ind_str = ', '.join(f"{i['name']} ({i['count']})" for i in industries) or 'not available'
        return (
            f"Screener: {p['name']}\n"
            f"Results in a currently-leading industry: {count}\n"
            f"Leading industries represented (use ONLY these, at most "
            f"these 2): {ind_str}\n"
            f"\nInstructions: Write 1 to 2 short sentences (no bullets) "
            f"stating the count and naming the leading industry/industries "
            f"above. State plainly this reflects the wider market's "
            f"current industry ranking, not a call on this list "
            f"specifically. Never invent an industry name not listed above."
        )

    if intent_id == 'scanner.new_since_yesterday':
        f = ctx.get('new_since_yesterday_facts') or {}
        count = f.get('count', 0)
        prior_date = f.get('prior_date', 'the prior session')
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"New since {prior_date}: 0\n"
                f"\nInstructions: In ONE line, say plainly that nothing is "
                f"new on this screener since {prior_date} — no bullets needed."
            )
        examples = f.get('examples') or []
        ex_str = ', '.join(e['symbol'] for e in examples) or 'not available'
        return (
            f"Screener: {p['name']}\n"
            f"New since {prior_date}: {count} stocks\n"
            f"Named examples (use ONLY these, at most these 3): {ex_str}\n"
            f"\nInstructions: Write ONE opening line stating the count and "
            f"{prior_date} as the comparison date, then AT MOST ONE bullet "
            f"point (starting with '• ') naming the example(s) above. State "
            f"plainly this is a membership change, not a signal to act. "
            f"Never name a stock not listed above."
        )

    if intent_id == 'scanner.rs_flip':
        f = ctx.get('rs_flip_facts') or {}
        count = f.get('count', 0)
        prior_date = f.get('prior_date', 'the prior session')
        if not count:
            return (
                f"Screener: {p['name']}\n"
                f"Crossed into a new relative-strength band since {prior_date}: 0\n"
                f"\nInstructions: In ONE line, say plainly that no stocks "
                f"crossed into a new relative-strength band since "
                f"{prior_date} — no bullets needed."
            )
        examples = f.get('examples') or []
        ex_lines = '\n'.join(
            f"  {e['symbol']}: {e.get('from_zone') or 'unknown'} → {e.get('to_zone') or 'unknown'}"
            for e in examples
        ) or '  (no example detail available)'
        return (
            f"Screener: {p['name']}\n"
            f"Crossed into a new relative-strength band since {prior_date}: {count} stocks\n"
            f"\n--- Named examples (use ONLY these, at most these 3) ---\n"
            f"{ex_lines}\n"
            f"\nInstructions: Write ONE opening line stating the count and "
            f"{prior_date} as the comparison date, then AT MOST ONE bullet "
            f"point (starting with '• ') naming the example(s) above with "
            f"their from → to band labels exactly as given. The direction of "
            f"the crossing is whatever those labels say — do not assume it "
            f"is an improvement. State plainly this is a band-crossing "
            f"measurement, not a signal to act. Never name a stock not "
            f"listed above, and never substitute bull/bullish/bear/bearish "
            f"for the band labels given."
        )

    if intent_id == 'scanner.is_unusual':
        f = ctx.get('is_unusual_facts') or {}
        today = f.get('today_count')
        avg = f.get('avg_count')
        lookback = f.get('lookback_days', 0)
        if today is None or avg is None:
            return (
                f"Screener: {p['name']}\n"
                f"Insufficient session history.\n"
                f"\nInstructions: In ONE short sentence, say plainly there "
                f"isn't enough recent-session history yet to compare today "
                f"against."
            )
        return (
            f"Screener: {p['name']}\n"
            f"Today's result count: {today}\n"
            f"Average result count over the trailing {lookback} sessions: {avg:.0f}\n"
            f"\nInstructions: Write 1 to 2 short sentences (no bullets) "
            f"comparing today's count ({today}) to the trailing average "
            f"({avg:.0f}) in plain terms (e.g. 'well above', 'in line "
            f"with', 'below'), stating both numbers. Never say this "
            f"predicts what happens next — describe today's participation "
            f"level only, as a measurement."
        )

    # scanner.read_results — plain-English field labels so the model never
    # echoes raw shorthand ("DelSurge") back at the user.
    lines = []
    for r in ctx['rows']:
        parts = [f"  {r['symbol']} ({r['industry']})"]
        if r['pct_chng'] is not None: parts.append(f"day change {r['pct_chng']:+.2f}%")
        parts.append(f"relative-strength zone: {r['zone']}")
        parts.append(f"flow: {r['flow']}")
        if r['rsi'] is not None: parts.append(f"RSI {r['rsi']:.0f}")
        if r['rvol'] is not None: parts.append(f"volume {r['rvol']:.1f}x normal")
        if r['surge'] is not None: parts.append(f"delivery surge {r['surge']:.2f}x its monthly norm")
        if r['vani']: parts.append("carries the VaNi highlight")
        lines.append(', '.join(parts))
    rows_str = '\n'.join(lines) if lines else '  (no stocks meet the conditions today)'

    # Tier A (scannerenhancement.md): when the page has computed cohort-level
    # facts over the FULL result set (not just the rows shown below), use
    # those instead of guessing from a capped sample — this is exactly the
    # documented "25-of-270 sample mismatch" failure mode. Pages that haven't
    # wired cohort_stats yet fall back to the old sample-derived count, byte-
    # identical to the previous message format.
    cohort = ctx.get('cohort_stats')
    vani_count = cohort['vani_highlight_count'] if cohort else sum(1 for r in ctx['rows'] if r['vani'])
    cohort_facts = ''
    if cohort:
        facts = [f"VaNi highlights {cohort['vani_highlight_count']} of {ctx['total_count']} total"]
        if cohort.get('accelerating_pct') is not None:
            facts.append(f"{cohort['accelerating_pct']}% of the full list has 5-day momentum outpacing 22-day")
        if cohort.get('real_volume_pct') is not None:
            facts.append(f"{cohort['real_volume_pct']}% trading over 3x normal volume")
        if cohort.get('leading_industry'):
            facts.append(f"leading industry is {cohort['leading_industry']} ({cohort.get('leading_industry_count') or 0} names)")
        cohort_facts = (
            f"\nFull-cohort facts (measured across all {ctx['total_count']} "
            f"results, not just the rows shown below): " + '; '.join(facts) + '.\n'
        )

    return (
        f"Screener: {p['name']} (lens: {ctx['lens']})\n"
        f"Data date: {ctx['data_date']}\n"
        f"Timeframe: {ctx['timeframe']}, Exchange filter: {ctx['exchange']}\n"
        f"Total results: {ctx['total_count']} "
        f"(showing top {len(ctx['rows'])}, VaNi highlights: {vani_count})\n"
        f"{cohort_facts}"
        f"\n--- Results ---\n{rows_str}\n"
        f"\nInstructions: Open with ONE line starting with the exact words "
        f"'As of the {ctx['data_date']} close' carrying the single most "
        f"important takeaway. Then write 3 to 4 bullet points (each "
        f"starting with '• ', each one short line): how many names and "
        f"where they concentrate; the character read through the "
        f"'{ctx['lens']}' lens"
        + (", grounded in the full-cohort facts above rather than guessed from the shown rows" if cohort else "")
        + f"; the VaNi-highlight count as a measurement, only if greater "
        f"than zero; AT MOST ONE bullet naming 1-2 specific stocks — never "
        f"3 or more names in the message. Use only the stocks and numbers "
        f"listed above."
    )
