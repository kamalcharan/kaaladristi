"""
snapshot_generator.py — Pre-compute daily dashboard snapshots for Kāla-Drishti.

Reads from all computed tables, builds a single JSON blob per (date, symbol),
and upserts to km_daily_snapshots. The frontend never queries 7+ tables —
it fetches one cached snapshot via the Edge Function.

Usage:
    # Generate today + 6-day outlook for all 4 symbols
    python snapshot_generator.py

    # Generate for a specific date range
    python snapshot_generator.py --start 2026-02-01 --end 2026-02-28

    # Generate for a single symbol
    python snapshot_generator.py --symbol NIFTY

    # Backfill historical snapshots (e.g., all of 2025)
    python snapshot_generator.py --start 2025-01-01 --end 2025-12-31

    # Dry run (print JSON, don't write to DB)
    python snapshot_generator.py --dry-run
"""

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta

# Add engine/ to path so we can import db helpers
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'engine'))
from db import get_supabase, resolve_index_id

# ── Constants ──

SYMBOLS = ['NIFTY', 'BANKNIFTY', 'NIFTYIT', 'NIFTYFMCG']
OUTLOOK_DAYS = 7  # How many days ahead to include in the outlook array
SNAPSHOT_VERSION = 1
BATCH_SIZE = 50  # Upsert in batches

# Regime classification (must match frontend getRegimeFromScore)
def _regime(score):
    if score is None:
        return 'unknown'
    if score >= 71:
        return 'capital_protection'
    if score >= 51:
        return 'distribution'
    if score >= 31:
        return 'expansion'
    return 'accumulation'


# ── Data fetchers (one query per table per date) ──

def _fetch_risk(sb, date_str, symbol):
    """Fetch risk score for a single (date, symbol)."""
    resp = (sb.table('km_risk_scores')
            .select('composite_score, structural, momentum, volatility, deception, '
                    'regime, explanation')
            .eq('date', date_str)
            .eq('symbol', symbol)
            .limit(1)
            .execute())
    return resp.data[0] if resp.data else None


def _fetch_panchang(sb, date_str):
    """Fetch panchang for a single date."""
    resp = (sb.table('km_daily_panchang')
            .select('date, tithi_num, tithi_name, paksha, nakshatra_name, nakshatra_pada, '
                    'yoga_name, karana_name, vara, dlnl_match, is_sankranti, '
                    'is_purnima, is_amavasya, is_ekadashi, sunrise')
            .eq('date', date_str)
            .limit(1)
            .execute())
    return resp.data[0] if resp.data else None


def _fetch_planets(sb, date_str):
    """Fetch planetary positions for a single date."""
    resp = (sb.table('km_planetary_positions')
            .select('planet, longitude, speed, retrograde, sign_name, '
                    'nakshatra_name, nakshatra_pada, combust')
            .eq('date', date_str)
            .execute())
    return resp.data or []


def _fetch_aspects(sb, date_str):
    """Fetch planetary aspects for a single date."""
    resp = (sb.table('km_planetary_aspects')
            .select('planet_1, planet_2, aspect_type, angle, orb, exact')
            .eq('date', date_str)
            .execute())
    return resp.data or []


def _fetch_events(sb, date_str):
    """Fetch astro events for a single date."""
    resp = (sb.table('km_astro_events')
            .select('event_type, planet, from_value, to_value, severity')
            .eq('event_date', date_str)
            .execute())
    return resp.data or []


def _fetch_signals(sb, date_str):
    """Fetch fired rule signals for a date, joined with rule metadata."""
    resp = (sb.table('km_rule_signals')
            .select('signal, strength, details, rule_id')
            .eq('date', date_str)
            .execute())
    if not resp.data:
        return [], []

    # Fetch rule metadata for fired rules
    rule_ids = list(set(s['rule_id'] for s in resp.data))
    rules_resp = (sb.table('km_rules')
                  .select('id, code, name, category, signal, strength')
                  .in_('id', rule_ids)
                  .execute())
    rules_map = {r['id']: r for r in (rules_resp.data or [])}

    return resp.data, rules_map


def _fetch_sectors(sb, date_str, symbol):
    """Fetch sector sensitivity for a (date, symbol)."""
    # sector_sensitivity may use factor_type + index_symbol, not date
    # Try the static table first (factor correlations are not per-date)
    resp = (sb.table('km_sector_sensitivity')
            .select('factor_type, sector, differential_impact')
            .execute())
    return resp.data or []


def _fetch_market(sb, date_str, symbol):
    """Fetch latest EOD data for the symbol on or before the date."""
    try:
        idx = resolve_index_id(symbol)
    except ValueError:
        return None

    resp = (sb.table('km_index_eod')
            .select('trade_date, open, high, low, close, prev_close, chng, pct_chng, volume, '
                    'w52_high, w52_low')
            .eq('index_id', idx)
            .lte('trade_date', date_str)
            .order('trade_date', desc=True)
            .limit(1)
            .execute())
    return resp.data[0] if resp.data else None


def _fetch_outlook(sb, date_str, symbol, days=OUTLOOK_DAYS):
    """Fetch risk scores for the next N days (outlook array)."""
    end_date = (datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=days - 1)).strftime('%Y-%m-%d')
    resp = (sb.table('km_risk_scores')
            .select('date, composite_score, regime')
            .eq('symbol', symbol)
            .gte('date', date_str)
            .lte('date', end_date)
            .order('date')
            .execute())
    return resp.data or []


# ── Explanation generator (template-based) ──

def _generate_explanation(risk, panchang, events, aspects):
    """Generate a human-readable explanation from the data."""
    if not risk:
        return 'Risk data not yet computed for this date.'

    score = risk.get('composite_score', 0)
    regime = _regime(score)

    # If engine already generated an explanation, use it
    if risk.get('explanation'):
        return risk['explanation']

    # Template-based fallback
    parts = []

    # Regime description
    regime_text = {
        'capital_protection': f'High risk environment (score: {score}). Capital preservation recommended.',
        'distribution': f'Elevated risk (score: {score}). Transition phase — selective positioning advised.',
        'expansion': f'Moderate conditions (score: {score}). Favorable for measured exposure.',
        'accumulation': f'Low risk environment (score: {score}). Conditions support systematic accumulation.',
    }
    parts.append(regime_text.get(regime, f'Risk score: {score}.'))

    # Top contributing factor
    factors = {
        'Structural': risk.get('structural', 0),
        'Momentum': risk.get('momentum', 0),
        'Volatility': risk.get('volatility', 0),
        'Deception': risk.get('deception', 0),
    }
    top_factor = max(factors, key=factors.get)
    top_val = factors[top_factor]
    if top_val > 10:
        parts.append(f'{top_factor} dimension contributes most ({top_val}/25).')

    # Notable events
    if events:
        high_sev = [e for e in events if e.get('severity') == 'high']
        if high_sev:
            evt = high_sev[0]
            parts.append(f'Notable: {evt["planet"]} {evt["event_type"].replace("_", " ")}.')

    # Retrograde planets
    retros = [p.get('planet') for p in (_fetch_planets.__defaults__ or []) if p.get('retrograde')]
    # Actually get from the snapshot data we already have
    # (we'll pass planets list in later)

    return ' '.join(parts)


# ── Snapshot builder ──

def build_snapshot(sb, date_str, symbol):
    """Build the complete snapshot JSON for one (date, symbol)."""
    risk = _fetch_risk(sb, date_str, symbol)
    panchang = _fetch_panchang(sb, date_str)
    planets = _fetch_planets(sb, date_str)
    aspects = _fetch_aspects(sb, date_str)
    events = _fetch_events(sb, date_str)
    signals_raw, rules_map = _fetch_signals(sb, date_str)
    sectors_raw = _fetch_sectors(sb, date_str, symbol)
    market = _fetch_market(sb, date_str, symbol)
    outlook_raw = _fetch_outlook(sb, date_str, symbol)

    # Build risk section
    risk_section = None
    if risk:
        risk_section = {
            'composite_score': risk.get('composite_score'),
            'regime': risk.get('regime') or _regime(risk.get('composite_score')),
            'structural': risk.get('structural', 0),
            'momentum': risk.get('momentum', 0),
            'volatility': risk.get('volatility', 0),
            'deception': risk.get('deception', 0),
            'explanation': _generate_explanation(risk, panchang, events, aspects),
        }

    # Build panchang section
    panchang_section = None
    if panchang:
        panchang_section = {
            'tithi_num': panchang.get('tithi_num'),
            'tithi_name': panchang.get('tithi_name'),
            'paksha': panchang.get('paksha'),
            'nakshatra_name': panchang.get('nakshatra_name'),
            'nakshatra_pada': panchang.get('nakshatra_pada'),
            'yoga_name': panchang.get('yoga_name'),
            'karana_name': panchang.get('karana_name'),
            'vara': panchang.get('vara'),
            'dlnl_match': panchang.get('dlnl_match', False),
            'is_sankranti': panchang.get('is_sankranti', False),
            'is_purnima': panchang.get('is_purnima', False),
            'is_amavasya': panchang.get('is_amavasya', False),
            'is_ekadashi': panchang.get('is_ekadashi', False),
            'sunrise': panchang.get('sunrise'),
        }

    # Build planets section
    planets_section = [
        {
            'planet': p.get('planet'),
            'longitude': p.get('longitude'),
            'speed': p.get('speed'),
            'retrograde': p.get('retrograde', False),
            'sign': p.get('sign_name'),
            'nakshatra': p.get('nakshatra_name'),
            'nakshatra_pada': p.get('nakshatra_pada'),
            'combust': p.get('combust', False),
        }
        for p in planets
    ]

    # Build aspects section
    aspects_section = [
        {
            'planet_1': a.get('planet_1'),
            'planet_2': a.get('planet_2'),
            'aspect_type': a.get('aspect_type'),
            'angle': a.get('angle'),
            'orb': a.get('orb'),
            'exact': a.get('exact', False),
        }
        for a in aspects
    ]

    # Build events section
    events_section = [
        {
            'event_type': e.get('event_type'),
            'planet': e.get('planet'),
            'from_value': e.get('from_value'),
            'to_value': e.get('to_value'),
            'severity': e.get('severity'),
        }
        for e in events
    ]

    # Build signals section
    fired_rules = []
    net_score = 0.0
    for sig in signals_raw:
        rule = rules_map.get(sig.get('rule_id'), {})
        signal_val = 1 if sig.get('signal') == 'bullish' else -1 if sig.get('signal') == 'bearish' else 0
        strength = sig.get('strength') or rule.get('strength', 1)
        net_score += signal_val * strength
        fired_rules.append({
            'code': rule.get('code', ''),
            'name': rule.get('name', ''),
            'category': rule.get('category', ''),
            'signal': sig.get('signal', 'neutral'),
            'strength': strength,
        })

    # Classify net signal
    if net_score > 3:
        classification = 'super_bullish'
    elif net_score > 0:
        classification = 'mildly_bullish'
    elif net_score > -3:
        classification = 'mildly_bearish' if net_score < 0 else 'neutral'
    else:
        classification = 'super_bearish'

    signals_section = {
        'net_score': round(net_score, 1),
        'classification': classification,
        'fired_count': len(fired_rules),
        'total_rules': 18,  # Will be dynamic once rules table is fully populated
        'rules': fired_rules,
    }

    # Build sectors section
    sectors_section = []
    for s in sectors_raw:
        impact = s.get('differential_impact', 0)
        sectors_section.append({
            'sector': s.get('sector'),
            'factor_type': s.get('factor_type'),
            'volatility_multiplier': round(1.0 + abs(impact) / 100, 2) if impact else 1.0,
            'direction': 'bearish' if impact and impact > 0 else 'bullish',
        })

    # Build outlook section (7-day array)
    outlook_section = [
        {
            'date': o.get('date'),
            'score': o.get('composite_score'),
            'regime': o.get('regime') or _regime(o.get('composite_score')),
        }
        for o in outlook_raw
    ]

    # Build market section
    market_section = None
    if market:
        close = market.get('close')
        prev = market.get('prev_close')
        change = round(close - prev, 2) if close and prev else None
        pct = round(change / prev * 100, 2) if change and prev else None
        market_section = {
            'trade_date': market.get('trade_date'),
            'close': close,
            'prev_close': prev,
            'change': change,
            'pct_change': pct,
            'open': market.get('open'),
            'high': market.get('high'),
            'low': market.get('low'),
            'volume': market.get('volume'),
            'w52_high': market.get('w52_high'),
            'w52_low': market.get('w52_low'),
        }

    # Assemble the complete snapshot
    snapshot = {
        'date': date_str,
        'symbol': symbol,
        'version': SNAPSHOT_VERSION,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'risk': risk_section,
        'panchang': panchang_section,
        'planets': planets_section,
        'aspects': aspects_section,
        'events': events_section,
        'signals': signals_section,
        'sectors': sectors_section,
        'outlook': outlook_section,
        'market': market_section,
    }

    return snapshot


# ── Upsert to Supabase ──

def upsert_snapshots(sb, snapshots):
    """Batch upsert snapshots to km_daily_snapshots."""
    rows = [
        {
            'date': s['date'],
            'symbol': s['symbol'],
            'version': s['version'],
            'snapshot': json.dumps(s),  # JSONB from string
        }
        for s in snapshots
    ]

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        sb.table('km_daily_snapshots').upsert(
            batch, on_conflict='date,symbol'
        ).execute()
        print(f'  [snapshot] Upserted {len(batch)} snapshots (batch {i // BATCH_SIZE + 1})')


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description='Generate daily dashboard snapshots')
    parser.add_argument('--start', type=str, help='Start date (YYYY-MM-DD). Default: today')
    parser.add_argument('--end', type=str, help='End date (YYYY-MM-DD). Default: today + 6 days')
    parser.add_argument('--symbol', type=str, help='Single symbol to generate. Default: all 4')
    parser.add_argument('--dry-run', action='store_true', help='Print JSON without writing to DB')
    args = parser.parse_args()

    # Determine date range
    today = date.today()
    start = datetime.strptime(args.start, '%Y-%m-%d').date() if args.start else today
    end = datetime.strptime(args.end, '%Y-%m-%d').date() if args.end else today + timedelta(days=OUTLOOK_DAYS - 1)

    # Determine symbols
    symbols = [args.symbol] if args.symbol else SYMBOLS

    print(f'=== Kāla-Drishti Snapshot Generator ===')
    print(f'Date range: {start} to {end}')
    print(f'Symbols:    {", ".join(symbols)}')
    print(f'Dry run:    {args.dry_run}')
    print()

    sb = get_supabase()
    all_snapshots = []

    for symbol in symbols:
        print(f'[{symbol}] Generating snapshots...')
        current = start
        while current <= end:
            date_str = current.strftime('%Y-%m-%d')
            try:
                snapshot = build_snapshot(sb, date_str, symbol)
                all_snapshots.append(snapshot)

                # Compact status
                risk_score = snapshot['risk']['composite_score'] if snapshot.get('risk') else '?'
                panchang_ok = 'P' if snapshot.get('panchang') else '-'
                planets_count = len(snapshot.get('planets', []))
                signals_count = snapshot.get('signals', {}).get('fired_count', 0)
                print(f'  {date_str}: score={risk_score} {panchang_ok} '
                      f'planets={planets_count} signals={signals_count}')
            except Exception as e:
                print(f'  {date_str}: ERROR - {e}')

            current += timedelta(days=1)

    print(f'\nTotal snapshots: {len(all_snapshots)}')

    if args.dry_run:
        # Print first snapshot as sample
        if all_snapshots:
            print('\n--- Sample snapshot (first) ---')
            print(json.dumps(all_snapshots[0], indent=2, default=str))
    else:
        if all_snapshots:
            print('\nUpserting to km_daily_snapshots...')
            upsert_snapshots(sb, all_snapshots)
            print('Done.')
        else:
            print('No snapshots to write.')


if __name__ == '__main__':
    main()
