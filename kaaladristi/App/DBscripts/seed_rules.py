"""
Seed initial GIVEN rules into the rules table.
These are domain-knowledge rules from traditional market astrology.

Rule categories:
  DLNL       - Day Lord = Nakshatra Lord
  MSV        - Mercury between Sun & Venus
  Hemisphere - Equinox / Solstice windows
  Sign       - Planet presence / co-presence in zodiac signs
  Panchang   - Tithi + Vara + Sankranti combinations
"""

import json
from schema import get_connection, create_schema

# =============================================================================
# GIVEN RULES
# =============================================================================

GIVEN_RULES = [
    # -----------------------------------------------------------------
    # Rule 1: DLNL - Day Lord = Nakshatra Lord → Bullish
    # -----------------------------------------------------------------
    {
        'code': 'DLNL_MATCH',
        'category': 'DLNL',
        'name': 'Day Lord equals Nakshatra Lord',
        'description': 'When the day lord and the Moon nakshatra lord are the same planet, '
                       'the day is bullish. Example: Monday (Moon) + Shravana/Hasta/Rohini (Moon) → bullish.',
        'conditions': json.dumps({'type': 'dlnl_match'}),
        'signal': 'Bullish',
        'strength': 1,
        'historical_note': 'Traditional Panchang rule',
    },

    # -----------------------------------------------------------------
    # Rule 2: MSV - Mercury in middle of Sun & Venus → Super Bearish
    # -----------------------------------------------------------------
    {
        'code': 'MSV_MERCURY_BETWEEN',
        'category': 'MSV',
        'name': 'Mercury between Sun and Venus',
        'description': 'When Mercury is longitudinally between Sun and Venus, '
                       'market turns super bearish. Historical reference: 1992 crash.',
        'conditions': json.dumps({
            'type': 'planet_between',
            'planet': 'Mercury',
            'between': ['Sun', 'Venus'],
        }),
        'signal': 'Super Bearish',
        'strength': 2,
        'historical_note': '1992 Harshad Mehta crash period',
    },

    # -----------------------------------------------------------------
    # Rule 3: Spring Equinox window (Basant Golaramb)
    # -----------------------------------------------------------------
    {
        'code': 'HEMISPHERE_SPRING_EQUINOX',
        'category': 'Hemisphere',
        'name': 'Spring Equinox - Basant Golaramb',
        'description': 'Watch for 1 week around March 20 Spring Equinox. '
                       'Any side break is a medium term trade.',
        'conditions': json.dumps({
            'type': 'hemisphere_window',
            'event': 'spring_equinox',
            'window_days': 7,
        }),
        'signal': 'Neutral',
        'strength': 1,
        'historical_note': 'Basant Golaramb - medium term breakout watch',
    },

    # -----------------------------------------------------------------
    # Rule 4: Autumn Equinox window (Dakshin Golaramb)
    # -----------------------------------------------------------------
    {
        'code': 'HEMISPHERE_AUTUMN_EQUINOX',
        'category': 'Hemisphere',
        'name': 'Autumn Equinox - Dakshin Golaramb',
        'description': 'Watch for 1 week around September 22 Autumn Equinox. '
                       'Any side break is a medium term trade.',
        'conditions': json.dumps({
            'type': 'hemisphere_window',
            'event': 'autumn_equinox',
            'window_days': 7,
        }),
        'signal': 'Neutral',
        'strength': 1,
        'historical_note': 'Dakshin Golaramb - medium term breakout watch',
    },

    # -----------------------------------------------------------------
    # Rule 5: Summer Solstice
    # -----------------------------------------------------------------
    {
        'code': 'HEMISPHERE_SUMMER_SOLSTICE',
        'category': 'Hemisphere',
        'name': 'Summer Solstice',
        'description': 'June 20 Summer Solstice - watch for trend reversal or continuation.',
        'conditions': json.dumps({
            'type': 'hemisphere_window',
            'event': 'summer_solstice',
            'window_days': 7,
        }),
        'signal': 'Neutral',
        'strength': 1,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 6: Winter Solstice
    # -----------------------------------------------------------------
    {
        'code': 'HEMISPHERE_WINTER_SOLSTICE',
        'category': 'Hemisphere',
        'name': 'Winter Solstice',
        'description': 'December 21 Winter Solstice - watch for trend reversal or continuation.',
        'conditions': json.dumps({
            'type': 'hemisphere_window',
            'event': 'winter_solstice',
            'window_days': 7,
        }),
        'signal': 'Neutral',
        'strength': 1,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 7: Aries - Sun + Saturn co-present → Super Bullish
    # -----------------------------------------------------------------
    {
        'code': 'ARIES_SUN_SATURN',
        'category': 'Sign',
        'name': 'Sun + Saturn in Aries',
        'description': 'When Sun and Saturn are both in Aries, market is super bullish.',
        'conditions': json.dumps({
            'type': 'planets_co_present',
            'sign': 'Aries',
            'planets': ['Sun', 'Saturn'],
        }),
        'signal': 'Super Bullish',
        'strength': 2,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 8: Aries - Mars + Saturn co-present → Super Bullish
    # -----------------------------------------------------------------
    {
        'code': 'ARIES_MARS_SATURN',
        'category': 'Sign',
        'name': 'Mars + Saturn in Aries',
        'description': 'When Mars and Saturn are both in Aries, market is super bullish.',
        'conditions': json.dumps({
            'type': 'planets_co_present',
            'sign': 'Aries',
            'planets': ['Mars', 'Saturn'],
        }),
        'signal': 'Super Bullish',
        'strength': 2,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 9: Aries - Jupiter + Venus co-present → Bearish
    # -----------------------------------------------------------------
    {
        'code': 'ARIES_JUPITER_VENUS',
        'category': 'Sign',
        'name': 'Jupiter + Venus in Aries',
        'description': 'When Jupiter and Venus are both in Aries, market is bearish.',
        'conditions': json.dumps({
            'type': 'planets_co_present',
            'sign': 'Aries',
            'planets': ['Jupiter', 'Venus'],
        }),
        'signal': 'Bearish',
        'strength': 1,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 10: Aries - Jupiter + Mercury co-present → Bearish
    # -----------------------------------------------------------------
    {
        'code': 'ARIES_JUPITER_MERCURY',
        'category': 'Sign',
        'name': 'Jupiter + Mercury in Aries',
        'description': 'When Jupiter and Mercury are both in Aries, market is bearish.',
        'conditions': json.dumps({
            'type': 'planets_co_present',
            'sign': 'Aries',
            'planets': ['Jupiter', 'Mercury'],
        }),
        'signal': 'Bearish',
        'strength': 1,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 11: Aries - Sun + Rahu co-present → Super Bullish
    # -----------------------------------------------------------------
    {
        'code': 'ARIES_SUN_RAHU',
        'category': 'Sign',
        'name': 'Sun + Rahu in Aries',
        'description': 'When Sun and Rahu are both in Aries, market is super bullish.',
        'conditions': json.dumps({
            'type': 'planets_co_present',
            'sign': 'Aries',
            'planets': ['Sun', 'Rahu'],
        }),
        'signal': 'Super Bullish',
        'strength': 2,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 12: Aries - Mars + Rahu co-present → Super Bullish
    # -----------------------------------------------------------------
    {
        'code': 'ARIES_MARS_RAHU',
        'category': 'Sign',
        'name': 'Mars + Rahu in Aries',
        'description': 'When Mars and Rahu are both in Aries, market is super bullish.',
        'conditions': json.dumps({
            'type': 'planets_co_present',
            'sign': 'Aries',
            'planets': ['Mars', 'Rahu'],
        }),
        'signal': 'Super Bullish',
        'strength': 2,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 13: Taurus - Mars present → Super Bullish
    # -----------------------------------------------------------------
    {
        'code': 'TAURUS_MARS',
        'category': 'Sign',
        'name': 'Mars in Taurus',
        'description': 'When Mars is in Taurus, market is super bullish.',
        'conditions': json.dumps({
            'type': 'planet_in_sign',
            'planet': 'Mars',
            'sign': 'Taurus',
        }),
        'signal': 'Super Bullish',
        'strength': 2,
        'historical_note': None,
    },

    # -----------------------------------------------------------------
    # Rule 14: Taurus - Venus present → Super Bullish
    # -----------------------------------------------------------------
    {
        'code': 'TAURUS_VENUS',
        'category': 'Sign',
        'name': 'Venus in Taurus',
        'description': 'When Venus is in Taurus (own sign), market is super bullish.',
        'conditions': json.dumps({
            'type': 'planet_in_sign',
            'planet': 'Venus',
            'sign': 'Taurus',
        }),
        'signal': 'Super Bullish',
        'strength': 2,
        'historical_note': 'Venus in own sign (Taurus lord = Venus)',
    },

    # -----------------------------------------------------------------
    # Rule 15: Panchang combo - Friday + Ekadashi + Sankranti
    # -----------------------------------------------------------------
    {
        'code': 'PANCHANG_FRI_EKADASHI_SANKRANTI',
        'category': 'Panchang',
        'name': 'Friday Ekadashi with Sankranti',
        'description': 'When Friday, Ekadashi tithi, and Sankranti all coincide.',
        'conditions': json.dumps({
            'type': 'and',
            'conditions': [
                {'type': 'vara', 'value': 'Friday'},
                {'type': 'is_ekadashi'},
                {'type': 'is_sankranti'},
            ],
        }),
        'signal': 'Super Bullish',
        'strength': 3,
        'historical_note': 'Rare Panchang combination',
    },

    # -----------------------------------------------------------------
    # Rule 16: Panchang - Friday + Ekadashi (without Sankranti)
    # -----------------------------------------------------------------
    {
        'code': 'PANCHANG_FRI_EKADASHI',
        'category': 'Panchang',
        'name': 'Friday Ekadashi',
        'description': 'When Friday and Ekadashi tithi coincide. '
                       'Venus (Friday lord) + Jupiter (Ekadashi tattva lord) combination.',
        'conditions': json.dumps({
            'type': 'and',
            'conditions': [
                {'type': 'vara', 'value': 'Friday'},
                {'type': 'is_ekadashi'},
            ],
        }),
        'signal': 'Bullish',
        'strength': 1,
        'historical_note': 'Venus-Jupiter energy combination',
    },

    # -----------------------------------------------------------------
    # Rule 17: Purnima (Full Moon) day
    # -----------------------------------------------------------------
    {
        'code': 'PANCHANG_PURNIMA',
        'category': 'Panchang',
        'name': 'Purnima - Full Moon',
        'description': 'Full Moon day. Heightened emotional / speculative energy.',
        'conditions': json.dumps({'type': 'is_purnima'}),
        'signal': 'Neutral',
        'strength': 1,
        'historical_note': 'Watch for increased volatility',
    },

    # -----------------------------------------------------------------
    # Rule 18: Amavasya (New Moon) day
    # -----------------------------------------------------------------
    {
        'code': 'PANCHANG_AMAVASYA',
        'category': 'Panchang',
        'name': 'Amavasya - New Moon',
        'description': 'New Moon day. Cautious / low energy.',
        'conditions': json.dumps({'type': 'is_amavasya'}),
        'signal': 'Bearish',
        'strength': 1,
        'historical_note': 'Low light, low energy, caution',
    },
]


def seed_rules(conn):
    """Seed all given rules."""
    loaded = 0
    for rule in GIVEN_RULES:
        conn.execute(
            "INSERT OR REPLACE INTO rules "
            "(code, category, name, description, conditions, signal, strength, "
            " source, active, historical_note) "
            "VALUES (:code, :category, :name, :description, :conditions, :signal, "
            " :strength, 'given', 1, :historical_note)",
            rule
        )
        loaded += 1

    conn.commit()
    return loaded


def main():
    print("=" * 60)
    print("KĀLA-DRISHTI RULES SEED")
    print("=" * 60)

    conn = get_connection()
    create_schema(conn)

    print(f"\nSeeding {len(GIVEN_RULES)} given rules...")
    loaded = seed_rules(conn)
    print(f"  {loaded} rules loaded.")

    # Verification
    print("\n--- Active Rules ---")
    rows = conn.execute(
        "SELECT code, category, signal, strength, name FROM rules WHERE active=1 ORDER BY id"
    ).fetchall()

    for row in rows:
        print(f"  [{row['code']:35s}] {row['category']:12s} → {row['signal']:15s} "
              f"(x{row['strength']}) {row['name']}")

    # Category breakdown
    print("\n--- Rules by Category ---")
    cats = conn.execute(
        "SELECT category, COUNT(*) as cnt FROM rules WHERE active=1 GROUP BY category ORDER BY cnt DESC"
    ).fetchall()
    for cat in cats:
        print(f"  {cat['category']:15s}: {cat['cnt']} rules")

    conn.close()
    print("\nRules seed complete.")


if __name__ == '__main__':
    main()
