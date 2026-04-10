"""
Kāla-Drishti — Data Assemblers
================================
Clean, standalone functions that gather all context (technical + astro)
for a given instrument or market snapshot. Returns structured dicts.

Consumers:
  - pipeline_api.py endpoints (Phase 3 — VaNi skills)
  - Future LLM chat agent (tool invocation)

These functions never call the AI layer — they only assemble data.
"""

from datetime import date, timedelta


# ── DC Inference Sentiment Scoring ──────────────────────────────────────────

IMPACT_WEIGHT = {
    'major_positive':  3,
    'bullish':         2,
    'minor_positive':  1,
    'consolidation':   0,
    'neutral':         0,
    'mixed':           0,
    'cautious':       -0.5,
    'volatile':       -1,
    'highly_volatile':-1.5,
    'minor_negative': -1,
    'bearish':        -2,
    'major_negative': -3,
}


def _day_score(events: list[dict]) -> float:
    """Weighted sentiment score from DC inference events."""
    return sum(IMPACT_WEIGHT.get(e.get('market_impact', ''), 0) for e in events)


def _safe_float(val, default=None):
    """Safely convert to float, returning default for None/NaN."""
    if val is None:
        return default
    try:
        f = float(val)
        import math
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


# ── Instrument Context ──────────────────────────────────────────────────────

def assemble_instrument_context(
    db,
    instrument_id: int,
    instrument_type: str = 'index',
    target_date: str = None,
) -> dict | None:
    """
    Gather full technical + astro context for ONE instrument on a given date.

    Returns a structured dict with:
      - instrument: name, type, id
      - price: close, prev_close, change_pct
      - flow: flow_type, vacuum_flag, accum_distrib
      - participation: sniper_inst, sniper_hot, sniper_rsi
      - momentum: rsi_14, mfi_14, alignment
      - relative_strength: magic_rs, magic_ma, magic_rs_zone
      - volume: rvol, tvol, character
      - dots: svd, sbd, syd (recent)
      - golden_line: sma_150, bias
      - astro: active DC inference events, day_score, direction
      - panchang: tithi, nakshatra, vara, special events
    """
    eod_table = 'km_index_eod' if instrument_type == 'index' else 'km_equity_eod'
    id_col = 'index_id' if instrument_type == 'index' else 'equity_id'
    sym_table = 'km_index_symbols' if instrument_type == 'index' else 'km_equity_symbols'
    name_col = 'name' if instrument_type == 'index' else 'symbol'

    # ── Fetch instrument name ──
    try:
        sym_rows = db.select(sym_table, f'id,{name_col}',
                             filters={'id': instrument_id}, limit=1)
    except Exception:
        return None
    if not sym_rows:
        return None
    instrument_name = sym_rows[0].get(name_col, f'{instrument_type}#{instrument_id}')

    # ── Fetch latest 2 EOD rows (for prev_close) ──
    try:
        if target_date:
            eod_rows = db.select(
                eod_table, '*',
                filters={id_col: instrument_id},
                order='trade_date.desc', limit=6,
            )
            # Filter to rows on or before target_date
            eod_rows = [r for r in eod_rows if str(r.get('trade_date', '')) <= target_date]
            eod_rows = eod_rows[:6]  # keep up to 6 for dot lookback
        else:
            eod_rows = db.select(
                eod_table, '*',
                filters={id_col: instrument_id},
                order='trade_date.desc', limit=6,
            )
    except Exception:
        return None

    if not eod_rows:
        return None

    latest = eod_rows[0]
    prev = eod_rows[1] if len(eod_rows) > 1 else None
    actual_date = str(latest.get('trade_date', target_date or ''))

    # ── Price ──
    close = _safe_float(latest.get('close'), 0)
    prev_close = _safe_float(prev.get('close'), close) if prev else close
    change_pct = ((close - prev_close) / prev_close * 100) if prev_close else 0

    # ── Flow Intelligence ──
    flow_type = latest.get('flow_type')
    vacuum_flag = latest.get('vacuum_flag')
    accum_distrib = latest.get('accum_distrib')

    # ── Participation (Sniper Dragon) ──
    sniper_inst = _safe_float(latest.get('sniper_inst'))
    sniper_hot = _safe_float(latest.get('sniper_hot'))
    sniper_rsi = _safe_float(latest.get('sniper_rsi'))

    # Interpret participation
    participation = 'unknown'
    if sniper_inst is not None and sniper_hot is not None:
        if sniper_inst > 30:
            participation = 'institution-heavy'
        elif sniper_hot > 30:
            participation = 'hot-money-driven'
        elif sniper_inst > sniper_hot:
            participation = 'institution-leaning'
        elif sniper_hot > sniper_inst:
            participation = 'hot-money-leaning'
        else:
            participation = 'balanced'

    # ── Momentum ──
    rsi = _safe_float(latest.get('rsi_14'))
    mfi = _safe_float(latest.get('mfi_14'))
    mom_alignment = 'unknown'
    if rsi is not None and mfi is not None:
        if rsi > 50 and mfi > 50:
            mom_alignment = 'aligned_up'
        elif rsi < 50 and mfi < 50:
            mom_alignment = 'aligned_down'
        else:
            mom_alignment = 'mixed'

    # ── Relative Strength (MagicRS) ──
    mrs_zone = latest.get('magic_rs_zone')
    mrs = _safe_float(latest.get('magic_rs'))
    mrs_ma = _safe_float(latest.get('magic_ma'))

    # ── Volume Character ──
    rvol = _safe_float(latest.get('rvol'))
    tvol = _safe_float(latest.get('tvol'))
    vol_character = 'unknown'
    if rvol is not None and tvol is not None:
        if rvol < 0.7 and tvol < 0.5:
            vol_character = 'dead_day'
        elif rvol >= 1.3 and tvol >= 1.0:
            vol_character = 'high_conviction'
        elif rvol >= 1.1:
            vol_character = 'moderate'
        else:
            vol_character = 'low'

    # ── Dots (check last 5 rows for recent events) ──
    recent_svd = any(r.get('dot_svd') for r in eod_rows[:5])
    recent_sbd = any(r.get('dot_sbd') for r in eod_rows[:5])
    recent_syd = any(r.get('dot_syd') for r in eod_rows[:5])

    # ── Golden Line (SMA 150) ──
    sma150 = _safe_float(latest.get('sma_150'))
    gl_bias = 'unknown'
    if sma150 is not None and close:
        gl_pct = ((close - sma150) / sma150) * 100
        if abs(gl_pct) < 0.5:
            gl_bias = 'neutral'
        elif close > sma150:
            gl_bias = 'bullish'
        else:
            gl_bias = 'bearish'
    else:
        gl_pct = None

    # ── Astro: DC Inference events active on this date ──
    astro_events = []
    astro_score = 0.0
    astro_direction = 'no_event'
    try:
        # Fetch inferences that overlap this date
        all_inferences = db.select(
            'dc_inference', '*',
            order='start_date.asc', limit=500,
        )
        for inf in (all_inferences or []):
            start = str(inf.get('start_date', ''))
            end = str(inf.get('end_date', '')) if inf.get('end_date') else start
            if start <= actual_date <= end:
                astro_events.append({
                    'event': inf.get('astro_event', ''),
                    'impact': inf.get('market_impact', ''),
                    'confidence': inf.get('confidence'),
                    'inference': inf.get('inference', ''),
                })
        astro_score = _day_score(
            [{'market_impact': e['impact']} for e in astro_events]
        )
        if astro_score > 0.5:
            astro_direction = 'favorable'
        elif astro_score < -0.5:
            astro_direction = 'adverse'
        elif astro_events:
            astro_direction = 'neutral'
        else:
            astro_direction = 'no_event'
    except Exception:
        pass

    # ── Panchang ──
    panchang = None
    try:
        p_rows = db.select('km_daily_panchang', '*',
                           filters={'date': actual_date}, limit=1)
        if p_rows:
            p = p_rows[0]
            special = [s for s in [
                'Purnima' if p.get('is_purnima') else '',
                'Amavasya' if p.get('is_amavasya') else '',
                'Ekadashi' if p.get('is_ekadashi') else '',
                'Sankranti' if p.get('is_sankranti') else '',
            ] if s]
            panchang = {
                'tithi': p.get('tithi_name', ''),
                'tithi_lord': p.get('tithi_lord', ''),
                'nakshatra': p.get('nakshatra_name', ''),
                'nakshatra_lord': p.get('nakshatra_lord', ''),
                'vara': p.get('vara', ''),
                'vara_lord': p.get('vara_lord', ''),
                'moon_sign': p.get('moon_sign_name', ''),
                'special': special or ['None'],
            }
    except Exception:
        pass

    # ── Cycle–Technical Alignment ──
    tech_direction = 'unknown'
    if flow_type in ('FRESH_LONGS',):
        tech_direction = 'bullish'
    elif flow_type in ('FRESH_SHORTS',):
        tech_direction = 'bearish'
    elif flow_type in ('SHORT_COVERING', 'LONG_LIQUIDATION'):
        tech_direction = 'transitional'
    elif gl_bias in ('bullish',) and mom_alignment == 'aligned_up':
        tech_direction = 'bullish'
    elif gl_bias in ('bearish',) and mom_alignment == 'aligned_down':
        tech_direction = 'bearish'
    elif gl_bias != 'unknown' and mom_alignment != 'unknown':
        tech_direction = 'mixed'

    alignment = 'no_event'
    if astro_direction == 'no_event':
        alignment = 'no_astro_event'
    elif astro_direction == 'favorable' and tech_direction == 'bullish':
        alignment = 'confirmed'
    elif astro_direction == 'adverse' and tech_direction == 'bearish':
        alignment = 'confirmed'
    elif astro_direction == 'favorable' and tech_direction == 'bearish':
        alignment = 'diverging'
    elif astro_direction == 'adverse' and tech_direction == 'bullish':
        alignment = 'diverging'
    elif astro_direction == 'neutral':
        alignment = 'neutral_cycle'
    else:
        alignment = 'mixed'

    return {
        'instrument': {
            'id': instrument_id,
            'name': instrument_name,
            'type': instrument_type,
        },
        'date': actual_date,
        'price': {
            'close': close,
            'prev_close': prev_close,
            'change_pct': round(change_pct, 2),
        },
        'flow': {
            'type': flow_type,
            'vacuum': vacuum_flag,
            'accum_distrib': accum_distrib,
        },
        'participation': {
            'institution': sniper_inst,
            'hot_money': sniper_hot,
            'rsi': sniper_rsi,
            'profile': participation,
        },
        'momentum': {
            'rsi_14': rsi,
            'mfi_14': mfi,
            'alignment': mom_alignment,
        },
        'relative_strength': {
            'magic_rs': mrs,
            'magic_ma': mrs_ma,
            'zone': mrs_zone,
        },
        'volume': {
            'rvol': rvol,
            'tvol': tvol,
            'character': vol_character,
        },
        'dots': {
            'svd_recent': recent_svd,
            'sbd_recent': recent_sbd,
            'syd_recent': recent_syd,
        },
        'golden_line': {
            'sma_150': sma150,
            'bias': gl_bias,
            'distance_pct': round(gl_pct, 2) if gl_pct is not None else None,
        },
        'astro': {
            'events': astro_events,
            'day_score': astro_score,
            'direction': astro_direction,
        },
        'panchang': panchang,
        'alignment': {
            'astro_direction': astro_direction,
            'tech_direction': tech_direction,
            'status': alignment,
        },
    }


# ── Market Pulse Context ────────────────────────────────────────────────────

# Key indexes to track for market pulse
PULSE_INDEXES = [
    'NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FMCG',
    'NIFTY MIDCAP 50', 'NIFTY 500',
]


def assemble_market_pulse_context(
    db,
    target_date: str = None,
) -> dict | None:
    """
    Gather market-wide context for the dashboard Market Pulse card.

    Returns a structured dict with:
      - date: the actual date used
      - indexes: list of per-index summaries (flow, participation, RS, volume)
      - breadth: latest market breadth (regime, score)
      - breadth_roc: latest ROC oscillator readings
      - astro: DC inference events active today, day_score, direction
      - panchang: today's panchangam summary
    """

    # ── Resolve target date ──
    if not target_date:
        try:
            rows = db.select('km_index_eod', 'trade_date',
                             order='trade_date.desc', limit=1)
            target_date = str(rows[0]['trade_date']) if rows else str(date.today())
        except Exception:
            target_date = str(date.today())

    # ── Fetch index IDs for pulse indexes ──
    try:
        all_syms = db.select('km_index_symbols', 'id,name', limit=500)
    except Exception:
        return None

    sym_map = {s['name']: s['id'] for s in (all_syms or []) if s.get('name')}

    # ── Build per-index summaries ──
    index_summaries = []
    for idx_name in PULSE_INDEXES:
        idx_id = sym_map.get(idx_name)
        if not idx_id:
            continue

        try:
            eod_rows = db.select(
                'km_index_eod', '*',
                filters={'index_id': idx_id},
                order='trade_date.desc', limit=2,
            )
            eod_rows = [r for r in eod_rows if str(r.get('trade_date', '')) <= target_date]
        except Exception:
            continue

        if not eod_rows:
            continue

        latest = eod_rows[0]
        prev = eod_rows[1] if len(eod_rows) > 1 else None
        close = _safe_float(latest.get('close'), 0)
        prev_close = _safe_float(prev.get('close'), close) if prev else close
        change_pct = ((close - prev_close) / prev_close * 100) if prev_close else 0

        sniper_inst = _safe_float(latest.get('sniper_inst'))
        sniper_hot = _safe_float(latest.get('sniper_hot'))
        participation = 'unknown'
        if sniper_inst is not None and sniper_hot is not None:
            if sniper_inst > 30:
                participation = 'institution-heavy'
            elif sniper_hot > 30:
                participation = 'hot-money-driven'
            elif sniper_inst > sniper_hot:
                participation = 'institution-leaning'
            else:
                participation = 'hot-money-leaning'

        index_summaries.append({
            'name': idx_name,
            'close': close,
            'change_pct': round(change_pct, 2),
            'flow_type': latest.get('flow_type'),
            'participation': participation,
            'magic_rs_zone': latest.get('magic_rs_zone'),
            'rvol': _safe_float(latest.get('rvol')),
            'tvol': _safe_float(latest.get('tvol')),
        })

    # ── Market Breadth ──
    breadth = None
    try:
        b_rows = db.select('km_market_breadth', '*',
                           order='trade_date.desc', limit=1)
        if b_rows:
            b = b_rows[0]
            score = _safe_float(b.get('breadth_score'), 0)
            regime = 'Greed' if score > 55 else ('Fear' if score < 35 else 'Neutral')
            breadth = {
                'score': score,
                'regime': regime,
                'pct_above_20': _safe_float(b.get('pct_above_20')),
                'pct_above_50': _safe_float(b.get('pct_above_50')),
                'pct_above_150': _safe_float(b.get('pct_above_150')),
                'date': str(b.get('trade_date', '')),
            }
    except Exception:
        pass

    # ── Breadth ROC ──
    breadth_roc = None
    try:
        roc_rows = db.select('km_breadth_roc', '*',
                             order='trade_date.desc', limit=1)
        if roc_rows:
            r = roc_rows[0]
            roc13 = _safe_float(r.get('roc_13'), 0)
            breadth_roc = {
                'roc_13': roc13,
                'roc_55': _safe_float(r.get('roc_55'), 0),
                'sma_breadth': _safe_float(r.get('sma_breadth'), 0),
                'bias': 'bullish' if roc13 > 0 else 'bearish',
                'date': str(r.get('trade_date', '')),
            }
    except Exception:
        pass

    # ── Astro: DC Inference events ──
    astro_events = []
    astro_score = 0.0
    astro_direction = 'no_event'
    try:
        all_inferences = db.select('dc_inference', '*',
                                   order='start_date.asc', limit=500)
        for inf in (all_inferences or []):
            start = str(inf.get('start_date', ''))
            end = str(inf.get('end_date', '')) if inf.get('end_date') else start
            if start <= target_date <= end:
                astro_events.append({
                    'event': inf.get('astro_event', ''),
                    'impact': inf.get('market_impact', ''),
                    'confidence': inf.get('confidence'),
                    'inference': inf.get('inference', ''),
                })
        astro_score = _day_score(
            [{'market_impact': e['impact']} for e in astro_events]
        )
        if astro_score > 0.5:
            astro_direction = 'favorable'
        elif astro_score < -0.5:
            astro_direction = 'adverse'
        elif astro_events:
            astro_direction = 'neutral'
    except Exception:
        pass

    # ── Panchang ──
    panchang = None
    try:
        p_rows = db.select('km_daily_panchang', '*',
                           filters={'date': target_date}, limit=1)
        if p_rows:
            p = p_rows[0]
            special = [s for s in [
                'Purnima' if p.get('is_purnima') else '',
                'Amavasya' if p.get('is_amavasya') else '',
                'Ekadashi' if p.get('is_ekadashi') else '',
                'Sankranti' if p.get('is_sankranti') else '',
            ] if s]
            panchang = {
                'tithi': p.get('tithi_name', ''),
                'nakshatra': p.get('nakshatra_name', ''),
                'vara': p.get('vara', ''),
                'vara_lord': p.get('vara_lord', ''),
                'moon_sign': p.get('moon_sign_name', ''),
                'special': special or ['None'],
            }
    except Exception:
        pass

    return {
        'date': target_date,
        'indexes': index_summaries,
        'breadth': breadth,
        'breadth_roc': breadth_roc,
        'astro': {
            'events': astro_events,
            'day_score': astro_score,
            'direction': astro_direction,
        },
        'panchang': panchang,
    }
