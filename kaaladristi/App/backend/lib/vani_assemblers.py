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

    manipulation_count = 0
    broken_signals_count = 0

    return {
        'date': actual_date,
        'indexes': pulse.get('indexes', []),
        'breadth': pulse.get('breadth'),
        'breadth_roc': pulse.get('breadth_roc'),
        'astro': pulse.get('astro', {}),
        'panchang': pulse.get('panchang'),
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

    return base


def format_user_message(intent_id: str, ctx: dict) -> str:
    """Format context into a user message string for the LLM."""
    formatters = {
        'dashboard.market_summary': _fmt_market_summary,
        'dashboard.regime_explain': _fmt_regime_explain,
        'dashboard.rotation_overview': _fmt_rotation_overview,
        'dashboard.warnings': _fmt_warnings,
        'dashboard.breadth_explain': _fmt_breadth_explain,
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
