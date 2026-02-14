"""
Kāla-Drishti Signal Engine

Two-way rule system:
  1. GIVEN RULES: Domain knowledge encoded as conditions → signals
  2. DISCOVERED RULES: Patterns found by the discovery agent, promoted after human review

Rule categories:
  - DLNL: Day Lord = Nakshatra Lord match
  - MSV: Mercury-Sun-Venus geometry
  - Hemisphere: Equinox / Solstice trigger windows
  - Sign: Planet co-presence in zodiac signs
  - Panchang: Tithi + Vara + Sankranti combinations
  - Aspect: Planetary aspect patterns (bridges to existing risk_engine)

Each rule has:
  - Conditions: JSON condition tree (composable with AND/OR)
  - Signal: Super Bullish / Bullish / Neutral / Bearish / Super Bearish
  - Strength: Weight multiplier (1-5)
  - Source: 'given' or 'discovered'

The engine evaluates all active rules for a given date and returns fired signals.
"""

import json
from datetime import datetime, timedelta

from db import (
    get_panchang_for_date,
    get_positions_for_date,
    get_aspects_for_date,
    get_active_rules,
    get_panchang_range,
    upsert_rule_signals,
)


# =============================================================================
# SIGNAL VALUES (numeric for aggregation)
# =============================================================================

SIGNAL_VALUES = {
    'Super Bullish': 2,
    'Bullish': 1,
    'Neutral': 0,
    'Bearish': -1,
    'Super Bearish': -2,
}


# =============================================================================
# CONTEXT BUILDER
# =============================================================================

def build_day_context(date_str):
    """
    Build a complete evaluation context for a given date.
    Merges data from daily_panchang + planetary_positions + planetary_aspects.

    Returns a dict with everything an evaluator might need.
    """
    context = {'date': date_str}

    # 1. Panchang data
    panchang = get_panchang_for_date(date_str)

    if panchang:
        for key in panchang:
            context[key] = panchang[key]
    else:
        # No panchang data — partial context
        context['_panchang_missing'] = True

    # 2. Planetary positions (sign, nakshatra, retrograde for all 9+1 planets)
    positions = get_positions_for_date(date_str)

    planet_signs = {}
    planet_longitudes = {}
    planet_nakshatras = {}
    planet_retrogrades = {}
    planet_combust = {}

    for row in positions:
        planet = row['planet']
        planet_signs[planet] = row['sign_name']
        planet_longitudes[planet] = row['longitude']
        planet_nakshatras[planet] = row['nakshatra_name']
        planet_retrogrades[planet] = bool(row['retrograde'])
        planet_combust[planet] = bool(row['combust'])

    context['planet_signs'] = planet_signs
    context['planet_longitudes'] = planet_longitudes
    context['planet_nakshatras'] = planet_nakshatras
    context['planet_retrogrades'] = planet_retrogrades
    context['planet_combust'] = planet_combust

    # 3. Active aspects
    aspects = get_aspects_for_date(date_str)

    context['aspects'] = [
        {
            'p1': a['planet_1'], 'p2': a['planet_2'],
            'type': a['aspect_type'], 'orb': a['orb'],
            'exact': bool(a['exact'])
        }
        for a in aspects
    ]

    # 4. Planets grouped by sign (for co-presence rules)
    sign_planets = {}
    for planet, sign in planet_signs.items():
        sign_planets.setdefault(sign, []).append(planet)
    context['sign_planets'] = sign_planets

    return context


# =============================================================================
# CONDITION EVALUATORS (Pluggable)
# =============================================================================

def evaluate_dlnl_match(condition, context):
    """Day Lord = Nakshatra Lord check."""
    return bool(context.get('dlnl_match'))


def evaluate_planet_in_sign(condition, context):
    """Check if a specific planet is in a specific sign."""
    planet = condition.get('planet')
    sign = condition.get('sign')
    return context.get('planet_signs', {}).get(planet) == sign


def evaluate_planets_co_present(condition, context):
    """Check if two or more planets are in the same specified sign."""
    sign = condition.get('sign')
    planets = condition.get('planets', [])
    sign_members = context.get('sign_planets', {}).get(sign, [])
    return all(p in sign_members for p in planets)


def evaluate_planet_between(condition, context):
    """
    Check if a planet's longitude is between two other planets.
    MSV rule: Mercury between Sun and Venus (longitudinally).
    """
    planet = condition.get('planet')
    between = condition.get('between', [])
    if len(between) != 2:
        return False

    longs = context.get('planet_longitudes', {})
    long_p = longs.get(planet)
    long_a = longs.get(between[0])
    long_b = longs.get(between[1])

    if None in (long_p, long_a, long_b):
        return False

    # Determine if planet is between the other two on the circular 0-360 scale
    lo, hi = min(long_a, long_b), max(long_a, long_b)

    if hi - lo <= 180:
        # Normal case: planet is between lo and hi
        return lo < long_p < hi
    else:
        # Wrap-around case: planet is outside the [hi, lo] arc
        return long_p > hi or long_p < lo


def evaluate_tithi(condition, context):
    """Check tithi name or base name."""
    if 'base_name' in condition:
        return context.get('tithi_base_name') == condition['base_name']
    if 'name' in condition:
        return context.get('tithi_name') == condition['name']
    if 'num' in condition:
        return context.get('tithi_num') == condition['num']
    return False


def evaluate_vara(condition, context):
    """Check weekday (vara)."""
    return context.get('vara') == condition.get('value')


def evaluate_paksha(condition, context):
    """Check paksha (Shukla/Krishna)."""
    return context.get('paksha') == condition.get('value')


def evaluate_is_sankranti(condition, context):
    """Check if day is a sankranti (Sun sign change)."""
    return bool(context.get('is_sankranti'))


def evaluate_sankranti_sign(condition, context):
    """Check if sankranti is to a specific sign."""
    if not context.get('is_sankranti'):
        return False
    return context.get('sankranti_to') == condition.get('sign')


def evaluate_hemisphere_event(condition, context):
    """Check for equinox/solstice event (exact day)."""
    event = condition.get('event')
    return context.get('hemisphere_event') == event


def evaluate_hemisphere_window(condition, context):
    """
    Check if date is within N days of an equinox/solstice.
    Used for: "watch for 1 week, any side break is medium term trade"
    """
    event = condition.get('event')
    window = condition.get('window_days', 7)
    target_date = datetime.strptime(context['date'], '%Y-%m-%d')

    # We need to check hemisphere_event for nearby dates
    # For efficiency, this evaluator checks the context's own hemisphere_event
    # and also accepts a pre-computed 'hemisphere_windows' dict
    if context.get('hemisphere_event') == event:
        return True

    # Check pre-computed windows if available
    windows = context.get('_hemisphere_windows', {})
    for event_date_str in windows.get(event, []):
        event_date = datetime.strptime(event_date_str, '%Y-%m-%d')
        if abs((target_date - event_date).days) <= window:
            return True

    return False


def evaluate_is_purnima(condition, context):
    """Check if day is Purnima (Full Moon)."""
    return bool(context.get('is_purnima'))


def evaluate_is_amavasya(condition, context):
    """Check if day is Amavasya (New Moon)."""
    return bool(context.get('is_amavasya'))


def evaluate_is_ekadashi(condition, context):
    """Check if day is Ekadashi."""
    return bool(context.get('is_ekadashi'))


def evaluate_retrograde(condition, context):
    """Check if a planet is retrograde."""
    planet = condition.get('planet')
    return context.get('planet_retrogrades', {}).get(planet, False)


def evaluate_combust(condition, context):
    """Check if a planet is combust."""
    planet = condition.get('planet')
    return context.get('planet_combust', {}).get(planet, False)


def evaluate_aspect(condition, context):
    """Check for a specific aspect between two planets."""
    p1 = condition.get('planet_1')
    p2 = condition.get('planet_2')
    aspect_types = condition.get('aspect_types')  # list or None

    for a in context.get('aspects', []):
        pair = {a['p1'], a['p2']}
        if pair == {p1, p2}:
            if aspect_types is None or a['type'] in aspect_types:
                return True
    return False


def evaluate_yoga(condition, context):
    """Check yoga name."""
    return context.get('yoga_name') == condition.get('name')


def evaluate_karana(condition, context):
    """Check karana name."""
    return context.get('karana_name') == condition.get('name')


def evaluate_nakshatra(condition, context):
    """Check Moon nakshatra at sunrise."""
    return context.get('nakshatra_name') == condition.get('name')


# =============================================================================
# EVALUATOR REGISTRY
# =============================================================================

EVALUATORS = {
    'dlnl_match': evaluate_dlnl_match,
    'planet_in_sign': evaluate_planet_in_sign,
    'planets_co_present': evaluate_planets_co_present,
    'planet_between': evaluate_planet_between,
    'tithi': evaluate_tithi,
    'vara': evaluate_vara,
    'paksha': evaluate_paksha,
    'is_sankranti': evaluate_is_sankranti,
    'sankranti_sign': evaluate_sankranti_sign,
    'hemisphere_event': evaluate_hemisphere_event,
    'hemisphere_window': evaluate_hemisphere_window,
    'is_purnima': evaluate_is_purnima,
    'is_amavasya': evaluate_is_amavasya,
    'is_ekadashi': evaluate_is_ekadashi,
    'retrograde': evaluate_retrograde,
    'combust': evaluate_combust,
    'aspect': evaluate_aspect,
    'yoga': evaluate_yoga,
    'karana': evaluate_karana,
    'nakshatra': evaluate_nakshatra,
}


# =============================================================================
# CONDITION TREE EVALUATOR (handles AND/OR/NOT composition)
# =============================================================================

def evaluate_condition(condition, context):
    """
    Recursively evaluate a condition tree.

    Condition format:
        {"type": "evaluator_name", ...params}
        {"type": "and", "conditions": [...]}
        {"type": "or", "conditions": [...]}
        {"type": "not", "condition": {...}}
    """
    ctype = condition.get('type')

    if ctype == 'and':
        return all(evaluate_condition(c, context) for c in condition.get('conditions', []))

    if ctype == 'or':
        return any(evaluate_condition(c, context) for c in condition.get('conditions', []))

    if ctype == 'not':
        return not evaluate_condition(condition.get('condition', {}), context)

    evaluator = EVALUATORS.get(ctype)
    if evaluator is None:
        print(f"  WARNING: Unknown condition type '{ctype}', treating as False")
        return False

    return evaluator(condition, context)


# =============================================================================
# SIGNAL ENGINE
# =============================================================================

class SignalEngine:
    """
    Evaluates all active rules against a day's context.
    Returns fired signals with rule details.
    """

    def __init__(self):
        self.rules = self._load_active_rules()

    def _load_active_rules(self):
        """Load all active rules from the database."""
        rows = get_active_rules()

        rules = []
        for row in rows:
            try:
                conditions = json.loads(row['conditions']) if isinstance(row['conditions'], str) else row['conditions']
            except (json.JSONDecodeError, TypeError):
                print(f"  WARNING: Invalid conditions JSON for rule {row['code']}, skipping")
                continue

            rules.append({
                'id': row['id'],
                'code': row['code'],
                'category': row['category'],
                'name': row['name'],
                'description': row['description'],
                'conditions': conditions,
                'signal': row['signal'],
                'strength': row['strength'],
                'source': row['source'],
                'historical_note': row['historical_note'],
            })

        return rules

    def evaluate_date(self, date_str, context=None):
        """
        Evaluate all rules for a given date.

        Args:
            date_str: Date string 'YYYY-MM-DD'
            context: Pre-built context dict (optional, built if not provided)

        Returns:
            List of fired signal dicts:
            [{'rule_id', 'rule_code', 'category', 'signal', 'strength', 'name', 'description'}, ...]
        """
        if context is None:
            context = build_day_context(date_str)

        fired = []
        for rule in self.rules:
            try:
                if evaluate_condition(rule['conditions'], context):
                    fired.append({
                        'rule_id': rule['id'],
                        'rule_code': rule['code'],
                        'category': rule['category'],
                        'signal': rule['signal'],
                        'strength': rule['strength'],
                        'name': rule['name'],
                        'description': rule['description'],
                    })
            except Exception as e:
                print(f"  ERROR evaluating rule {rule['code']} on {date_str}: {e}")

        return fired

    def aggregate_signals(self, fired_signals):
        """
        Aggregate multiple fired signals into a net signal score.

        Returns:
            {
                'net_score': float (-10 to +10 range),
                'net_signal': str (Super Bullish / Bullish / Neutral / Bearish / Super Bearish),
                'bullish_count': int,
                'bearish_count': int,
                'total_fired': int,
                'dominant_category': str,
            }
        """
        if not fired_signals:
            return {
                'net_score': 0,
                'net_signal': 'Neutral',
                'bullish_count': 0,
                'bearish_count': 0,
                'total_fired': 0,
                'dominant_category': None,
            }

        total_score = 0
        bullish = 0
        bearish = 0
        categories = {}

        for sig in fired_signals:
            value = SIGNAL_VALUES.get(sig['signal'], 0) * sig['strength']
            total_score += value
            if value > 0:
                bullish += 1
            elif value < 0:
                bearish += 1
            cat = sig['category']
            categories[cat] = categories.get(cat, 0) + abs(value)

        # Determine net signal
        if total_score >= 4:
            net_signal = 'Super Bullish'
        elif total_score >= 1:
            net_signal = 'Bullish'
        elif total_score <= -4:
            net_signal = 'Super Bearish'
        elif total_score <= -1:
            net_signal = 'Bearish'
        else:
            net_signal = 'Neutral'

        dominant = max(categories, key=categories.get) if categories else None

        return {
            'net_score': total_score,
            'net_signal': net_signal,
            'bullish_count': bullish,
            'bearish_count': bearish,
            'total_fired': len(fired_signals),
            'dominant_category': dominant,
        }

    def save_signals(self, date_str, fired_signals):
        """Save fired signals to km_rule_signals via Supabase upsert."""
        signals_list = []
        for sig in fired_signals:
            signals_list.append({
                'date': date_str,
                'rule_id': sig['rule_id'],
                'signal': sig['signal'],
                'strength': sig['strength'],
                'details': json.dumps({'name': sig['name'], 'category': sig['category']}),
            })
        if signals_list:
            upsert_rule_signals(signals_list)


# =============================================================================
# BATCH EVALUATION
# =============================================================================

def evaluate_date_range(start_date, end_date):
    """Evaluate all rules for a date range."""
    engine = SignalEngine()

    print(f"Evaluating {len(engine.rules)} rules from {start_date} to {end_date}...")

    panchang_rows = get_panchang_range(start_date, end_date, columns='date')

    results = []
    for i, row in enumerate(panchang_rows):
        date_str = row['date']
        context = build_day_context(date_str)
        fired = engine.evaluate_date(date_str, context)

        if fired:
            engine.save_signals(date_str, fired)
            agg = engine.aggregate_signals(fired)
            results.append({
                'date': date_str,
                'fired_count': len(fired),
                'net_signal': agg['net_signal'],
                'net_score': agg['net_score'],
                'signals': fired,
            })

        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(panchang_rows)} dates evaluated, "
                  f"{len(results)} dates with fired rules...")

    print(f"\nEvaluation complete: {len(results)} dates with fired rules out of {len(panchang_rows)} total")
    return results


# =============================================================================
# MAIN (for testing)
# =============================================================================

def main():
    print("=" * 60)
    print("KĀLA-DRISHTI SIGNAL ENGINE")
    print("=" * 60)

    engine = SignalEngine()

    print(f"\nLoaded {len(engine.rules)} active rules:")
    for rule in engine.rules:
        print(f"  [{rule['code']:20s}] {rule['category']:12s} → {rule['signal']:15s} "
              f"(strength={rule['strength']}) {rule['name']}")

    # Evaluate a sample date range
    if engine.rules:
        print("\n--- Evaluating sample dates ---")
        sample_dates = ['2024-01-15', '2024-03-20', '2024-06-20', '2024-09-22', '2025-02-23']
        for date_str in sample_dates:
            context = build_day_context(date_str)
            fired = engine.evaluate_date(date_str, context)
            agg = engine.aggregate_signals(fired)
            print(f"\n  {date_str}: {len(fired)} rules fired → {agg['net_signal']} (score={agg['net_score']})")
            for sig in fired:
                print(f"    [{sig['rule_code']}] {sig['signal']} (x{sig['strength']}): {sig['name']}")
    else:
        print("\n  No rules loaded. Seed rules first (see seed_rules.py).")

    print("\nSignal engine complete.")


if __name__ == '__main__':
    main()
