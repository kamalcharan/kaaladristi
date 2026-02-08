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

# Create output directory
os.makedirs(output_path, exist_ok=True)

# Set ephemeris path
swe.set_ephe_path(ephe_path)

# Date range
START_DATE = datetime(2000, 1, 1)
END_DATE = datetime(2040, 12, 31)

# Ayanamsa (Lahiri - standard for Jyotish)
AYANAMSA = swe.SIDM_LAHIRI

# =============================================================================
# REFERENCE DATA
# =============================================================================

PLANETS = {
    'Sun': swe.SUN,
    'Moon': swe.MOON,
    'Mars': swe.MARS,
    'Mercury': swe.MERCURY,
    'Jupiter': swe.JUPITER,
    'Venus': swe.VENUS,
    'Saturn': swe.SATURN,
    'Rahu': swe.MEAN_NODE,
}

NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
]

SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]

# DC-relevant aspect pairs
DC_ASPECT_PAIRS = [
    ('Mars', 'Saturn'),
    ('Mars', 'Rahu'),
    ('Mercury', 'Rahu'),
    ('Saturn', 'Rahu'),
    ('Jupiter', 'Saturn'),
    ('Sun', 'Saturn'),
    ('Sun', 'Mercury'),
]

# Planets that can go retrograde (for event detection)
RETROGRADE_PLANETS = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_sidereal_position(jd, planet_id):
    """Get sidereal longitude and speed for a planet."""
    swe.set_sid_mode(AYANAMSA)
    # FIX: Added swe.FLG_SPEED to get correct speed values
    result = swe.calc_ut(jd, planet_id, swe.FLG_SIDEREAL | swe.FLG_SPEED)
    longitude = result[0][0]
    speed = result[0][3]
    return longitude, speed


def longitude_to_sign(longitude):
    """Convert longitude (0-360) to sign index (0-11)."""
    return int(longitude // 30)


def longitude_to_nakshatra(longitude):
    """Convert longitude to nakshatra (0-26) and pada (1-4)."""
    nakshatra_size = 360 / 27  # 13.3333...°
    pada_size = nakshatra_size / 4
    
    nakshatra = int(longitude // nakshatra_size)
    pada = int((longitude % nakshatra_size) // pada_size) + 1
    
    return nakshatra, pada


def calculate_aspect(long1, long2):
    """
    Calculate aspect between two longitudes.
    Returns: (aspect_type, exact_angle, orb) or (None, angle, None)
    """
    diff = abs(long1 - long2)
    if diff > 180:
        diff = 360 - diff
    
    # DC-relevant aspects with orbs
    aspects = {
        'conjunction': (0, 10),
        'opposition': (180, 10),
        'square': (90, 8),
        'trine': (120, 8),
    }
    
    for aspect_name, (exact_angle, max_orb) in aspects.items():
        orb = abs(diff - exact_angle)
        if orb <= max_orb:
            return aspect_name, round(diff, 2), round(orb, 2)
    
    return None, round(diff, 2), None


def is_gandanta(longitude):
    """Check if Moon is in Gandanta (junction of water/fire signs)."""
    sign = longitude_to_sign(longitude)
    position_in_sign = longitude % 30
    
    # Last 3°20' of water signs (Cancer, Scorpio, Pisces)
    if sign in [3, 7, 11] and position_in_sign > 26.67:
        return True
    # First 3°20' of fire signs (Aries, Leo, Sagittarius)
    if sign in [0, 4, 8] and position_in_sign < 3.33:
        return True
    return False


def is_combust(sun_long, planet_long, planet_name):
    """Check if planet is combust (too close to Sun)."""
    diff = abs(sun_long - planet_long)
    if diff > 180:
        diff = 360 - diff
    
    combustion_degrees = {
        'Moon': 12,
        'Mars': 17,
        'Mercury': 14,
        'Jupiter': 11,
        'Venus': 10,
        'Saturn': 15,
    }
    
    threshold = combustion_degrees.get(planet_name, 0)
    return diff <= threshold


# =============================================================================
# DATA GENERATION FUNCTIONS
# =============================================================================

def generate_daily_positions(start_date, end_date):
    """Generate daily planetary positions."""
    print(f"Generating daily positions from {start_date.date()} to {end_date.date()}...")
    
    current = start_date
    all_positions = []
    total_days = (end_date - start_date).days + 1
    
    # Track retrograde counts for verification
    retro_counts = {planet: 0 for planet in PLANETS.keys()}
    
    while current <= end_date:
        # Calculate at 5:30 UTC (11:00 IST - market context)
        jd = swe.julday(current.year, current.month, current.day, 5.5)
        
        day_positions = []
        sun_longitude = None
        
        # Calculate for all planets
        for planet_name, planet_id in PLANETS.items():
            longitude, speed = get_sidereal_position(jd, planet_id)
            sign = longitude_to_sign(longitude)
            nakshatra, pada = longitude_to_nakshatra(longitude)
            retrograde = speed < 0
            
            if planet_name == 'Sun':
                sun_longitude = longitude
            
            if retrograde:
                retro_counts[planet_name] += 1
            
            day_positions.append({
                'date': current.strftime('%Y-%m-%d'),
                'planet': planet_name,
                'longitude': round(longitude, 6),
                'speed': round(speed, 6),
                'retrograde': retrograde,
                'sign': sign,
                'sign_name': SIGNS[sign],
                'nakshatra': nakshatra,
                'nakshatra_name': NAKSHATRAS[nakshatra],
                'nakshatra_pada': pada,
            })
        
        # Add Ketu (Rahu + 180°)
        rahu_data = next(p for p in day_positions if p['planet'] == 'Rahu')
        ketu_longitude = (rahu_data['longitude'] + 180) % 360
        ketu_sign = longitude_to_sign(ketu_longitude)
        ketu_nakshatra, ketu_pada = longitude_to_nakshatra(ketu_longitude)
        
        day_positions.append({
            'date': current.strftime('%Y-%m-%d'),
            'planet': 'Ketu',
            'longitude': round(ketu_longitude, 6),
            'speed': round(-rahu_data['speed'], 6),
            'retrograde': True,  # Ketu always retrograde
            'sign': ketu_sign,
            'sign_name': SIGNS[ketu_sign],
            'nakshatra': ketu_nakshatra,
            'nakshatra_name': NAKSHATRAS[ketu_nakshatra],
            'nakshatra_pada': ketu_pada,
        })
        
        # Add combustion flag
        for pos in day_positions:
            if pos['planet'] not in ['Sun', 'Rahu', 'Ketu']:
                pos['combust'] = is_combust(sun_longitude, pos['longitude'], pos['planet'])
            else:
                pos['combust'] = False
        
        all_positions.extend(day_positions)
        
        # Progress indicator
        days_done = (current - start_date).days + 1
        if days_done % 365 == 0:
            print(f"  Processed {days_done}/{total_days} days ({days_done * 100 // total_days}%)")
        
        current += timedelta(days=1)
    
    print(f"  Generated {len(all_positions)} position records")
    
    # Print retrograde verification
    print(f"\n  Retrograde days verification:")
    for planet, count in retro_counts.items():
        pct = count * 100 / total_days
        print(f"    {planet:<10}: {count:>5} days ({pct:>5.1f}%)")
    
    return all_positions


def generate_aspects(positions_data):
    """Generate DC-relevant aspects from position data."""
    print("\nGenerating aspects...")
    
    # Group positions by date
    by_date = {}
    for pos in positions_data:
        date = pos['date']
        if date not in by_date:
            by_date[date] = {}
        by_date[date][pos['planet']] = pos
    
    all_aspects = []
    
    for date, planets in by_date.items():
        for planet1, planet2 in DC_ASPECT_PAIRS:
            if planet1 in planets and planet2 in planets:
                long1 = planets[planet1]['longitude']
                long2 = planets[planet2]['longitude']
                
                aspect_type, angle, orb = calculate_aspect(long1, long2)
                
                if aspect_type:
                    all_aspects.append({
                        'date': date,
                        'planet_1': planet1,
                        'planet_2': planet2,
                        'aspect_type': aspect_type,
                        'angle': angle,
                        'orb': orb,
                        'exact': orb <= 1.0,
                    })
    
    print(f"  Found {len(all_aspects)} significant aspects")
    return all_aspects


def generate_events(positions_data):
    """Detect nakshatra changes, retrograde stations, and other events."""
    print("\nDetecting events...")
    
    # Group positions by date and planet
    by_date_planet = {}
    for pos in positions_data:
        key = (pos['date'], pos['planet'])
        by_date_planet[key] = pos
    
    # Get sorted unique dates
    dates = sorted(set(pos['date'] for pos in positions_data))
    
    all_events = []
    retro_start_count = 0
    retro_end_count = 0
    
    for i in range(1, len(dates)):
        prev_date = dates[i - 1]
        curr_date = dates[i]
        
        for planet_name in list(PLANETS.keys()) + ['Ketu']:
            prev_pos = by_date_planet.get((prev_date, planet_name))
            curr_pos = by_date_planet.get((curr_date, planet_name))
            
            if not prev_pos or not curr_pos:
                continue
            
            # Nakshatra change
            if prev_pos['nakshatra'] != curr_pos['nakshatra']:
                all_events.append({
                    'event_date': curr_date,
                    'event_type': 'nakshatra_change',
                    'planet': planet_name,
                    'from_value': prev_pos['nakshatra_name'],
                    'to_value': curr_pos['nakshatra_name'],
                    'severity': 'high' if curr_pos['nakshatra_name'] in ['Ardra', 'Moola', 'Jyeshtha'] else 'normal'
                })
            
            # Sign change
            if prev_pos['sign'] != curr_pos['sign']:
                all_events.append({
                    'event_date': curr_date,
                    'event_type': 'sign_change',
                    'planet': planet_name,
                    'from_value': prev_pos['sign_name'],
                    'to_value': curr_pos['sign_name'],
                    'severity': 'normal'
                })
            
            # Retrograde station (only for planets that can go retrograde)
            if planet_name in RETROGRADE_PLANETS:
                if prev_pos['retrograde'] != curr_pos['retrograde']:
                    if curr_pos['retrograde']:
                        event_type = 'retrograde_start'
                        retro_start_count += 1
                    else:
                        event_type = 'retrograde_end'
                        retro_end_count += 1
                    
                    all_events.append({
                        'event_date': curr_date,
                        'event_type': event_type,
                        'planet': planet_name,
                        'from_value': 'direct' if curr_pos['retrograde'] else 'retrograde',
                        'to_value': 'retrograde' if curr_pos['retrograde'] else 'direct',
                        'severity': 'high'
                    })
    
    print(f"  Detected {len(all_events)} events")
    print(f"    - Retrograde starts: {retro_start_count}")
    print(f"    - Retrograde ends: {retro_end_count}")
    
    return all_events


def generate_moon_intraday(start_date, end_date):
    """Generate Moon positions at key market times."""
    print("\nGenerating Moon intraday data...")
    
    # Key times in IST (converted to UTC hours)
    market_times_utc = [3.75, 7.0, 9.25, 10.0]
    time_labels = ['09:15', '12:30', '14:45', '15:30']
    
    current = start_date
    all_moon_data = []
    
    while current <= end_date:
        for utc_hour, label in zip(market_times_utc, time_labels):
            jd = swe.julday(current.year, current.month, current.day, utc_hour)
            
            longitude, speed = get_sidereal_position(jd, swe.MOON)
            sign = longitude_to_sign(longitude)
            nakshatra, pada = longitude_to_nakshatra(longitude)
            
            all_moon_data.append({
                'date': current.strftime('%Y-%m-%d'),
                'time_ist': label,
                'longitude': round(longitude, 6),
                'speed': round(speed, 6),
                'sign': sign,
                'sign_name': SIGNS[sign],
                'nakshatra': nakshatra,
                'nakshatra_name': NAKSHATRAS[nakshatra],
                'nakshatra_pada': pada,
                'gandanta': is_gandanta(longitude),
            })
        
        current += timedelta(days=1)
    
    print(f"  Generated {len(all_moon_data)} Moon intraday records")
    return all_moon_data


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    print("=" * 60)
    print("KĀLA-DRISHTI EPHEMERIS GENERATOR")
    print("=" * 60)
    print(f"\nDate Range: {START_DATE.date()} to {END_DATE.date()}")
    print(f"Output Path: {output_path}")
    print(f"Ayanamsa: Lahiri (Sidereal)")
    print()
    
    # Generate all data
    positions = generate_daily_positions(START_DATE, END_DATE)
    aspects = generate_aspects(positions)
    events = generate_events(positions)
    moon_intraday = generate_moon_intraday(START_DATE, END_DATE)
    
    # Save to JSON files
    print("\n" + "=" * 60)
    print("SAVING DATA")
    print("=" * 60)
    
    with open(os.path.join(output_path, 'planetary_positions.json'), 'w') as f:
        json.dump(positions, f, indent=2)
    print(f"  ✓ planetary_positions.json ({len(positions)} records)")
    
    with open(os.path.join(output_path, 'aspects.json'), 'w') as f:
        json.dump(aspects, f, indent=2)
    print(f"  ✓ aspects.json ({len(aspects)} records)")
    
    with open(os.path.join(output_path, 'events.json'), 'w') as f:
        json.dump(events, f, indent=2)
    print(f"  ✓ events.json ({len(events)} records)")
    
    with open(os.path.join(output_path, 'moon_intraday.json'), 'w') as f:
        json.dump(moon_intraday, f, indent=2)
    print(f"  ✓ moon_intraday.json ({len(moon_intraday)} records)")
    
    # Summary statistics
    print("\n" + "=" * 60)
    print("GENERATION COMPLETE")
    print("=" * 60)
    
    total_days = (END_DATE - START_DATE).days + 1
    print(f"\nTotal trading days covered: {total_days}")
    print(f"Planetary position records: {len(positions)}")
    print(f"Aspect records: {len(aspects)}")
    print(f"Event records: {len(events)}")
    print(f"Moon intraday records: {len(moon_intraday)}")
    
    # Event breakdown
    retro_starts = len([e for e in events if e['event_type'] == 'retrograde_start'])
    retro_ends = len([e for e in events if e['event_type'] == 'retrograde_end'])
    nak_changes = len([e for e in events if e['event_type'] == 'nakshatra_change'])
    sign_changes = len([e for e in events if e['event_type'] == 'sign_change'])
    high_risk_naks = len([e for e in events if e.get('severity') == 'high' and e['event_type'] == 'nakshatra_change'])
    
    print(f"\nEvent Statistics:")
    print(f"  - Retrograde starts: {retro_starts}")
    print(f"  - Retrograde ends: {retro_ends}")
    print(f"  - Nakshatra changes: {nak_changes}")
    print(f"  - Sign changes: {sign_changes}")
    print(f"  - High-risk nakshatra entries (Ardra/Moola/Jyeshtha): {high_risk_naks}")
    
    # Aspect breakdown
    conjunction_count = len([a for a in aspects if a['aspect_type'] == 'conjunction'])
    square_count = len([a for a in aspects if a['aspect_type'] == 'square'])
    opposition_count = len([a for a in aspects if a['aspect_type'] == 'opposition'])
    trine_count = len([a for a in aspects if a['aspect_type'] == 'trine'])
    
    print(f"\nAspect Statistics:")
    print(f"  - Conjunctions: {conjunction_count}")
    print(f"  - Squares: {square_count}")
    print(f"  - Oppositions: {opposition_count}")
    print(f"  - Trines: {trine_count}")
    
    # Verification sample
    print(f"\n" + "=" * 60)
    print("VERIFICATION SAMPLE")
    print("=" * 60)
    
    # Check Mars on known dates
    print("\nMars on test dates:")
    test_dates = ['2024-06-01', '2025-01-01', '2025-03-01']
    for date_str in test_dates:
        mars = next((p for p in positions if p['date'] == date_str and p['planet'] == 'Mars'), None)
        if mars:
            status = "RETROGRADE" if mars['retrograde'] else "DIRECT"
            print(f"  {date_str}: speed={mars['speed']:>8.4f} → {status}")
        else:
            print(f"  {date_str}: Not in range")


if __name__ == '__main__':
    main()