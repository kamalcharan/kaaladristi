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
    if not target_date:
        try:
            rows = db.select('km_industry_eod', 'trade_date',
                             order='trade_date.desc', limit=1)
            target_date = str(rows[0]['trade_date']) if rows else str(date.today())
        except Exception:
            target_date = str(date.today())

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
            'km_equity_symbols', 'id,symbol,name_full,industry',
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
            all_eq_map[eq['id']] = {'symbol': eq.get('symbol', ''), 'industry': ind}

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
            f"Dominant Flow: {e['dominant_flow']}"
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
            f"RS Zone: {s.get('magic_rs_zone', 'N/A')}, "
            f"RSI: {s.get('rsi_14', 'N/A')}, "
            f"RSS: {s.get('rss_value', 'N/A')}, "
            f"RVOL: {s.get('rvol', 'N/A')}, "
            f"Flow: {s.get('flow_type', 'N/A')}, "
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

def assemble_equity_context(db, entity_id: int, page_context: str = None, target_date: str = None) -> dict | None:
    """Assemble context for a specific equity using the existing instrument assembler."""
    ctx = assemble_instrument_context(db, entity_id, 'equity', target_date)
    if not ctx:
        return None

    ctx['page_context'] = page_context or 'direct'
    return ctx


def build_equity_cache_context(intent_id: str, ctx: dict) -> dict:
    """Cache key for equity intents — includes entity + key signal buckets."""
    return {
        'date': ctx.get('date', ''),
        'entity_id': ctx.get('instrument', {}).get('id', ''),
        'rs_zone': ctx.get('relative_strength', {}).get('zone', ''),
        'flow': ctx.get('flow', {}).get('type', ''),
        'page_ctx': ctx.get('page_context', ''),
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
    if dots.get('svd_recent'): dot_events.append('SVD (institutional accumulation)')
    if dots.get('sbd_recent'): dot_events.append('SBD (strong accumulation)')
    if dots.get('syd_recent'): dot_events.append('SYD (distribution)')
    dot_str = ', '.join(dot_events) if dot_events else 'None'

    astro_str = 'None active'
    if astro.get('events'):
        astro_str = '; '.join(f"{e['event']} ({e['impact']})" for e in astro['events'][:3])

    base_msg = (
        f"Stock: {symbol}\n"
        f"Date: {ctx.get('date', '')}\n"
        f"Price: {p.get('close', 0)} ({p.get('change_pct', 0):+.2f}%)\n"
        f"\n--- Signals ---\n"
        f"Flow: {f.get('type', 'N/A')}\n"
        f"Vacuum: {f.get('vacuum', 'None')}\n"
        f"Accum/Distrib: {f.get('accum_distrib', 'None')}\n"
        f"Participation: {part.get('profile', 'unknown')} "
        f"(Inst: {part.get('institution')}, Hot$: {part.get('hot_money')})\n"
        f"RSI: {mom.get('rsi_14')}, MFI: {mom.get('mfi_14')}, "
        f"Momentum: {mom.get('alignment')}\n"
        f"Magic RS Zone: {rs.get('zone', 'N/A')} "
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
