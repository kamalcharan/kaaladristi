"""
Kāla-Drishti Panchang Generator

Computes daily Panchang (Hindu almanac) elements with UJJAIN as the base location.
Ephemeris is geocentric (same for the globe), but Panchang is observer-local:
  - Sunrise/Sunset computed for Ujjain (23.1765°N, 75.7885°E)
  - All Panchang elements (tithi, yoga, karana, nakshatra) evaluated AT Ujjain sunrise
  - Vara (weekday) begins at Ujjain sunrise, not midnight

Panchang elements computed:
  1. Sunrise / Sunset (Ujjain)
  2. Tithi (lunar day, 1-30) with Paksha (Shukla/Krishna)
  3. Nakshatra (Moon's lunar mansion at sunrise) with lord
  4. Yoga (Sun + Moon combination, 27 yogas)
  5. Karana (half-tithi, 60 per lunar month)
  6. Vara (weekday) with lord
  7. DLNL match (Day Lord = Nakshatra Lord)
  8. Sankranti detection (Sun sign change)
  9. Equinox / Solstice detection (tropical events)
"""

import swisseph as swe
import os
import json
from datetime import datetime, timedelta

# =============================================================================
# CONFIGURATION
# =============================================================================

script_dir = os.path.dirname(os.path.abspath(__file__))
ephe_path = os.path.join(script_dir, 'ephe')
output_path = os.path.join(script_dir, 'output')

os.makedirs(output_path, exist_ok=True)
swe.set_ephe_path(ephe_path)

# Date range (same as ephemeris)
START_DATE = datetime(2000, 1, 1)
END_DATE = datetime(2040, 12, 31)

# Ayanamsa (Lahiri - standard for Jyotish)
AYANAMSA = swe.SIDM_LAHIRI

# =============================================================================
# UJJAIN LOCATION (Traditional Hindu astronomical meridian)
# =============================================================================

UJJAIN_LON = 75.7885   # East longitude
UJJAIN_LAT = 23.1765   # North latitude
UJJAIN_ALT = 490.0     # Altitude in meters
UJJAIN_GEOPOS = (UJJAIN_LON, UJJAIN_LAT, UJJAIN_ALT)

# Standard atmospheric conditions for sunrise computation
ATPRESS = 1013.25   # mbar
ATTEMP = 15.0       # Celsius

# =============================================================================
# PANCHANG REFERENCE DATA
# =============================================================================

# --- 27 Nakshatras (must match generate_ephemeris.py names) ---
NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
]

# --- Nakshatra Lords (Vimshottari Dasha cycle) ---
# Cycle: Ketu → Venus → Sun → Moon → Mars → Rahu → Jupiter → Saturn → Mercury
VIMSHOTTARI_CYCLE = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']

NAKSHATRA_LORDS = {}
for i, nak in enumerate(NAKSHATRAS):
    NAKSHATRA_LORDS[nak] = VIMSHOTTARI_CYCLE[i % 9]

# --- 12 Signs (must match generate_ephemeris.py) ---
SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]

# --- Vara (Weekday) mapping ---
# Python weekday(): 0=Monday ... 6=Sunday
VARA_MAP = {
    0: ('Monday', 'Moon'),
    1: ('Tuesday', 'Mars'),
    2: ('Wednesday', 'Mercury'),
    3: ('Thursday', 'Jupiter'),
    4: ('Friday', 'Venus'),
    5: ('Saturday', 'Saturn'),
    6: ('Sunday', 'Sun'),
}

# --- 30 Tithi names ---
TITHI_NAMES = [
    # Shukla Paksha (1-15)
    'Shukla Pratipada', 'Shukla Dwitiya', 'Shukla Tritiya', 'Shukla Chaturthi',
    'Shukla Panchami', 'Shukla Shashthi', 'Shukla Saptami', 'Shukla Ashtami',
    'Shukla Navami', 'Shukla Dashami', 'Shukla Ekadashi', 'Shukla Dwadashi',
    'Shukla Trayodashi', 'Shukla Chaturdashi', 'Purnima',
    # Krishna Paksha (16-30)
    'Krishna Pratipada', 'Krishna Dwitiya', 'Krishna Tritiya', 'Krishna Chaturthi',
    'Krishna Panchami', 'Krishna Shashthi', 'Krishna Saptami', 'Krishna Ashtami',
    'Krishna Navami', 'Krishna Dashami', 'Krishna Ekadashi', 'Krishna Dwadashi',
    'Krishna Trayodashi', 'Krishna Chaturdashi', 'Amavasya',
]

# Base tithi names (without paksha prefix, for rule matching)
BASE_TITHI_NAMES = [
    'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
    'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
    'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima',
]

# Tithi Pancha Tattva groups (tithi number within paksha -> group, lord)
TITHI_GROUPS = {
    1: ('Nanda', 'Jupiter'),    6: ('Nanda', 'Jupiter'),    11: ('Nanda', 'Jupiter'),
    2: ('Bhadra', 'Mercury'),   7: ('Bhadra', 'Mercury'),   12: ('Bhadra', 'Mercury'),
    3: ('Jaya', 'Mars'),        8: ('Jaya', 'Mars'),        13: ('Jaya', 'Mars'),
    4: ('Rikta', 'Saturn'),     9: ('Rikta', 'Saturn'),     14: ('Rikta', 'Saturn'),
    5: ('Purna', 'Venus'),     10: ('Purna', 'Venus'),      15: ('Purna', 'Venus'),
}

# --- 27 Yoga names ---
YOGAS = [
    'Vishkumbha', 'Preeti', 'Ayushman', 'Saubhagya', 'Shobhana',
    'Atiganda', 'Sukarma', 'Dhriti', 'Shoola', 'Ganda',
    'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
    'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
    'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
    'Indra', 'Vaidhriti'
]

# --- Karana names ---
# 7 recurring karanas (cycle 8 times = 56) + 4 fixed karanas = 60 total
RECURRING_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti']
FIXED_KARANAS = {0: 'Kimstughna', 57: 'Shakuni', 58: 'Chatushpada', 59: 'Nagava'}

# =============================================================================
# SUNRISE / SUNSET COMPUTATION (UJJAIN)
# =============================================================================

def compute_ujjain_sunrise(date):
    """
    Compute sunrise at Ujjain for a given date.

    Args:
        date: datetime object (the calendar date in IST)

    Returns:
        (sunrise_jd, sunset_jd) - Julian day numbers in UT
        Returns (None, None) if computation fails.
    """
    # Start searching from midnight IST of this date
    # IST = UTC + 5:30, so midnight IST = previous day 18:30 UTC
    jd_midnight_ist = swe.julday(date.year, date.month, date.day, 0) - (5.5 / 24.0)

    try:
        # Compute sunrise (disc center, for Panchang accuracy)
        # pyswisseph API: rise_trans(tjdut, body, rsmi, geopos, atpress, attemp, flags)
        rise_flag = swe.CALC_RISE | swe.BIT_DISC_CENTER
        rise_result = swe.rise_trans(
            jd_midnight_ist, swe.SUN, rise_flag, UJJAIN_GEOPOS, ATPRESS, ATTEMP
        )
        sunrise_jd = rise_result[1][0]

        # Compute sunset
        set_flag = swe.CALC_SET | swe.BIT_DISC_CENTER
        set_result = swe.rise_trans(
            sunrise_jd, swe.SUN, set_flag, UJJAIN_GEOPOS, ATPRESS, ATTEMP
        )
        sunset_jd = set_result[1][0]

        return sunrise_jd, sunset_jd
    except Exception as e:
        print(f"  WARNING: Sunrise computation failed for {date.date()}: {e}")
        # Fallback: approximate sunrise at 6:00 IST = 0:30 UTC
        fallback_jd = swe.julday(date.year, date.month, date.day, 0.5)
        return fallback_jd, fallback_jd + 0.5


def jd_to_ist_time(jd):
    """Convert Julian day (UT) to IST time string HH:MM:SS."""
    # Add 5.5 hours for IST
    jd_ist = jd + (5.5 / 24.0)
    year, month, day, hour_frac = swe.revjul(jd_ist)
    hours = int(hour_frac)
    minutes = int((hour_frac - hours) * 60)
    seconds = int(((hour_frac - hours) * 60 - minutes) * 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


# =============================================================================
# PANCHANG ELEMENT COMPUTATIONS
# =============================================================================

def get_sidereal_position(jd, planet_id):
    """Get sidereal longitude for a planet at given JD."""
    swe.set_sid_mode(AYANAMSA)
    result = swe.calc_ut(jd, planet_id, swe.FLG_SIDEREAL | swe.FLG_SPEED)
    return result[0][0]  # longitude


def get_tropical_position(jd, planet_id):
    """Get tropical longitude for a planet (needed for equinox/solstice)."""
    result = swe.calc_ut(jd, planet_id, swe.FLG_SPEED)
    return result[0][0]


def longitude_to_sign(longitude):
    """Convert sidereal longitude (0-360) to sign index (0-11)."""
    return int(longitude // 30)


def longitude_to_nakshatra(longitude):
    """Convert sidereal longitude to nakshatra index (0-26) and pada (1-4)."""
    nakshatra_size = 360.0 / 27.0  # 13.3333°
    pada_size = nakshatra_size / 4.0
    nakshatra = int(longitude // nakshatra_size)
    pada = int((longitude % nakshatra_size) // pada_size) + 1
    return nakshatra, pada


def compute_tithi(sun_long, moon_long):
    """
    Compute tithi from sidereal Sun and Moon longitudes.

    Tithi = angular distance of Moon from Sun, measured in units of 12°.
    Returns: (tithi_num 1-30, tithi_name, paksha, base_name, group, group_lord)
    """
    tithi_angle = (moon_long - sun_long) % 360.0
    tithi_index = int(tithi_angle / 12.0)  # 0-29
    tithi_num = tithi_index + 1             # 1-30

    tithi_name = TITHI_NAMES[tithi_index]

    if tithi_num <= 15:
        paksha = 'Shukla'
        tithi_in_paksha = tithi_num
    else:
        paksha = 'Krishna'
        tithi_in_paksha = tithi_num - 15

    base_name = BASE_TITHI_NAMES[tithi_in_paksha - 1]
    group, group_lord = TITHI_GROUPS.get(tithi_in_paksha, ('Unknown', 'Unknown'))

    return tithi_num, tithi_name, paksha, base_name, group, group_lord


def compute_yoga(sun_long, moon_long):
    """
    Compute yoga from sidereal Sun and Moon longitudes.

    Yoga = (Sun longitude + Moon longitude) mod 360, divided into 27 parts.
    Returns: (yoga_index 0-26, yoga_name)
    """
    yoga_angle = (sun_long + moon_long) % 360.0
    yoga_index = int(yoga_angle / (360.0 / 27.0))
    yoga_index = min(yoga_index, 26)  # Safety clamp
    return yoga_index, YOGAS[yoga_index]


def compute_karana(sun_long, moon_long):
    """
    Compute karana from sidereal Sun and Moon longitudes.

    Each tithi has 2 karanas (half-tithis). 60 karanas per lunar month.
    Returns: (karana_index 0-59, karana_name)
    """
    tithi_angle = (moon_long - sun_long) % 360.0
    karana_index = int(tithi_angle / 6.0) % 60

    if karana_index in FIXED_KARANAS:
        return karana_index, FIXED_KARANAS[karana_index]
    else:
        name = RECURRING_KARANAS[(karana_index - 1) % 7]
        return karana_index, name


# =============================================================================
# MAIN GENERATION
# =============================================================================

def generate_daily_panchang(start_date, end_date):
    """
    Generate daily Panchang for the entire date range.
    All elements evaluated at Ujjain sunrise.
    """
    print(f"Generating Panchang from {start_date.date()} to {end_date.date()}...")
    print(f"  Base location: Ujjain ({UJJAIN_LAT}°N, {UJJAIN_LON}°E, {UJJAIN_ALT}m)")
    print()

    current = start_date
    total_days = (end_date - start_date).days + 1
    all_panchang = []

    # Track previous day for sankranti detection
    prev_sun_sign = None
    prev_tropical_sun = None

    while current <= end_date:
        # 1. Compute Ujjain sunrise and sunset
        sunrise_jd, sunset_jd = compute_ujjain_sunrise(current)

        # 2. Get sidereal Sun and Moon positions AT SUNRISE
        sun_long = get_sidereal_position(sunrise_jd, swe.SUN)
        moon_long = get_sidereal_position(sunrise_jd, swe.MOON)

        # 3. Get tropical Sun position (for equinox/solstice)
        tropical_sun = get_tropical_position(sunrise_jd, swe.SUN)

        # 4. Compute sign positions
        sun_sign = longitude_to_sign(sun_long)
        moon_sign = longitude_to_sign(moon_long)

        # 5. Compute Moon nakshatra at sunrise
        moon_nak_index, moon_nak_pada = longitude_to_nakshatra(moon_long)
        moon_nakshatra = NAKSHATRAS[moon_nak_index]
        nakshatra_lord = NAKSHATRA_LORDS[moon_nakshatra]

        # 6. Compute Vara
        vara_name, vara_lord = VARA_MAP[current.weekday()]

        # 7. DLNL match
        dlnl_match = (vara_lord == nakshatra_lord)

        # 8. Compute Tithi
        tithi_num, tithi_name, paksha, base_tithi, tithi_group, tithi_lord = \
            compute_tithi(sun_long, moon_long)

        # 9. Compute Yoga
        yoga_index, yoga_name = compute_yoga(sun_long, moon_long)

        # 10. Compute Karana
        karana_index, karana_name = compute_karana(sun_long, moon_long)

        # 11. Detect Sankranti (Sun sign change from previous day)
        is_sankranti = False
        sankranti_from = None
        sankranti_to = None
        if prev_sun_sign is not None and sun_sign != prev_sun_sign:
            is_sankranti = True
            sankranti_from = SIGNS[prev_sun_sign]
            sankranti_to = SIGNS[sun_sign]

        # 12. Detect Equinox / Solstice (tropical Sun crossing cardinal points)
        hemisphere_event = None
        if prev_tropical_sun is not None:
            # Spring Equinox: crosses 0°
            if prev_tropical_sun > 350 and tropical_sun < 10:
                hemisphere_event = 'spring_equinox'
            # Summer Solstice: crosses 90°
            elif prev_tropical_sun < 90 and tropical_sun >= 90:
                hemisphere_event = 'summer_solstice'
            # Autumn Equinox: crosses 180°
            elif prev_tropical_sun < 180 and tropical_sun >= 180:
                hemisphere_event = 'autumn_equinox'
            # Winter Solstice: crosses 270°
            elif prev_tropical_sun < 270 and tropical_sun >= 270:
                hemisphere_event = 'winter_solstice'

        # 13. Special flags
        is_purnima = (tithi_num == 15)
        is_amavasya = (tithi_num == 30)
        is_ekadashi = (base_tithi == 'Ekadashi')

        # Build record
        record = {
            'date': current.strftime('%Y-%m-%d'),
            # Sunrise / Sunset
            'sunrise_jd': round(sunrise_jd, 8),
            'sunrise_ist': jd_to_ist_time(sunrise_jd),
            'sunset_jd': round(sunset_jd, 8),
            'sunset_ist': jd_to_ist_time(sunset_jd),
            # Tithi
            'tithi_num': tithi_num,
            'tithi_name': tithi_name,
            'tithi_base_name': base_tithi,
            'paksha': paksha,
            'tithi_group': tithi_group,
            'tithi_lord': tithi_lord,
            # Nakshatra
            'nakshatra_num': moon_nak_index,
            'nakshatra_name': moon_nakshatra,
            'nakshatra_lord': nakshatra_lord,
            'nakshatra_pada': moon_nak_pada,
            # Yoga
            'yoga_num': yoga_index,
            'yoga_name': yoga_name,
            # Karana
            'karana_num': karana_index,
            'karana_name': karana_name,
            # Vara
            'vara': vara_name,
            'vara_lord': vara_lord,
            # DLNL
            'dlnl_match': dlnl_match,
            # Sun position
            'sun_sign': sun_sign,
            'sun_sign_name': SIGNS[sun_sign],
            'sun_longitude': round(sun_long, 6),
            'sun_tropical_longitude': round(tropical_sun, 6),
            # Moon position
            'moon_sign': moon_sign,
            'moon_sign_name': SIGNS[moon_sign],
            'moon_longitude': round(moon_long, 6),
            # Sankranti
            'is_sankranti': is_sankranti,
            'sankranti_from': sankranti_from,
            'sankranti_to': sankranti_to,
            # Hemisphere events
            'hemisphere_event': hemisphere_event,
            # Special flags
            'is_purnima': is_purnima,
            'is_amavasya': is_amavasya,
            'is_ekadashi': is_ekadashi,
        }

        all_panchang.append(record)

        # Update tracking
        prev_sun_sign = sun_sign
        prev_tropical_sun = tropical_sun

        # Progress indicator
        days_done = (current - start_date).days + 1
        if days_done % 365 == 0:
            print(f"  Processed {days_done}/{total_days} days ({days_done * 100 // total_days}%)")

        current += timedelta(days=1)

    print(f"\n  Generated {len(all_panchang)} Panchang records")
    return all_panchang


# =============================================================================
# VERIFICATION & STATISTICS
# =============================================================================

def print_statistics(panchang_data):
    """Print summary statistics for verification."""
    total = len(panchang_data)

    # DLNL matches
    dlnl_count = sum(1 for p in panchang_data if p['dlnl_match'])
    print(f"\n  DLNL matches: {dlnl_count} / {total} days ({dlnl_count * 100 / total:.1f}%)")

    # Sankranti count
    sankranti_count = sum(1 for p in panchang_data if p['is_sankranti'])
    print(f"  Sankranti days: {sankranti_count}")

    # Hemisphere events
    events = {}
    for p in panchang_data:
        if p['hemisphere_event']:
            events.setdefault(p['hemisphere_event'], []).append(p['date'])
    for event, dates in sorted(events.items()):
        print(f"  {event}: {len(dates)} occurrences")
        # Show first 3 and last 3
        for d in dates[:3]:
            print(f"    {d}")
        if len(dates) > 6:
            print(f"    ...")
        for d in dates[-3:]:
            print(f"    {d}")

    # Purnima / Amavasya counts
    purnima_count = sum(1 for p in panchang_data if p['is_purnima'])
    amavasya_count = sum(1 for p in panchang_data if p['is_amavasya'])
    ekadashi_count = sum(1 for p in panchang_data if p['is_ekadashi'])
    print(f"\n  Purnima days: {purnima_count}")
    print(f"  Amavasya days: {amavasya_count}")
    print(f"  Ekadashi days: {ekadashi_count}")

    # Tithi distribution
    from collections import Counter
    paksha_dist = Counter(p['paksha'] for p in panchang_data)
    print(f"\n  Paksha distribution:")
    for paksha, count in sorted(paksha_dist.items()):
        print(f"    {paksha}: {count} days ({count * 100 / total:.1f}%)")

    # Vara distribution (should be ~1/7 each)
    vara_dist = Counter(p['vara'] for p in panchang_data)
    print(f"\n  Vara distribution:")
    for vara in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        count = vara_dist.get(vara, 0)
        print(f"    {vara:12s}: {count} days ({count * 100 / total:.1f}%)")

    # Yoga distribution
    yoga_dist = Counter(p['yoga_name'] for p in panchang_data)
    print(f"\n  Yoga distribution (top 5 / bottom 5):")
    sorted_yogas = yoga_dist.most_common()
    for name, count in sorted_yogas[:5]:
        print(f"    {name:15s}: {count} days")
    print(f"    ...")
    for name, count in sorted_yogas[-5:]:
        print(f"    {name:15s}: {count} days")

    # Sample sunrise times (verify they're reasonable: ~5:30-6:30 IST for Ujjain)
    print(f"\n  Sample sunrise times (Ujjain IST):")
    for month_sample in ['2024-01-15', '2024-04-15', '2024-07-15', '2024-10-15']:
        rec = next((p for p in panchang_data if p['date'] == month_sample), None)
        if rec:
            print(f"    {month_sample}: sunrise {rec['sunrise_ist']}, sunset {rec['sunset_ist']}")

    # DLNL match breakdown by day
    print(f"\n  DLNL matches by weekday:")
    for vara in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        vara_days = [p for p in panchang_data if p['vara'] == vara]
        match_days = [p for p in vara_days if p['dlnl_match']]
        pct = len(match_days) * 100 / len(vara_days) if vara_days else 0
        print(f"    {vara:12s}: {len(match_days):>4} / {len(vara_days):>5} ({pct:.1f}%)")
        if match_days:
            # Show which nakshatras trigger DLNL for this day
            naks = set(p['nakshatra_name'] for p in match_days)
            print(f"      Nakshatras: {', '.join(sorted(naks))}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("KĀLA-DRISHTI PANCHANG GENERATOR")
    print("=" * 60)
    print(f"\nDate Range: {START_DATE.date()} to {END_DATE.date()}")
    print(f"Base Location: Ujjain ({UJJAIN_LAT}°N, {UJJAIN_LON}°E)")
    print(f"Ayanamsa: Lahiri (Sidereal)")
    print(f"Output: {output_path}")
    print()

    # Generate panchang
    panchang = generate_daily_panchang(START_DATE, END_DATE)

    # Save to JSON
    output_file = os.path.join(output_path, 'daily_panchang.json')
    with open(output_file, 'w') as f:
        json.dump(panchang, f, indent=2)
    print(f"\n  Saved: daily_panchang.json ({len(panchang)} records)")

    # Statistics
    print("\n" + "=" * 60)
    print("VERIFICATION & STATISTICS")
    print("=" * 60)
    print_statistics(panchang)

    print("\n" + "=" * 60)
    print("PANCHANG GENERATION COMPLETE")
    print("=" * 60)

    # Verification sample
    print("\nSample records:")
    sample_dates = ['2024-01-14', '2024-03-20', '2024-06-20', '2024-09-22', '2024-12-21', '2025-02-23']
    for date_str in sample_dates:
        rec = next((p for p in panchang if p['date'] == date_str), None)
        if rec:
            flags = []
            if rec['dlnl_match']:
                flags.append('DLNL')
            if rec['is_sankranti']:
                flags.append(f"Sankranti({rec['sankranti_to']})")
            if rec['hemisphere_event']:
                flags.append(rec['hemisphere_event'])
            if rec['is_ekadashi']:
                flags.append('Ekadashi')
            if rec['is_purnima']:
                flags.append('Purnima')
            if rec['is_amavasya']:
                flags.append('Amavasya')

            flag_str = ' | '.join(flags) if flags else '-'
            print(f"  {date_str}: {rec['vara']:9s} | {rec['tithi_name']:25s} | "
                  f"{rec['nakshatra_name']:20s} | {rec['yoga_name']:12s} | {flag_str}")


if __name__ == '__main__':
    main()
