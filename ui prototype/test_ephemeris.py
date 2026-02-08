import swisseph as swe
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
ephe_path = os.path.join(script_dir, 'ephe')

print(f"Looking for ephemeris files in: {ephe_path}")

# Check if files exist
files_to_check = ['sepl_18.se1', 'semo_18.se1']
for f in files_to_check:
    full_path = os.path.join(ephe_path, f)
    if os.path.exists(full_path):
        size_mb = os.path.getsize(full_path) / (1024 * 1024)
        print(f"✓ {f} found ({size_mb:.1f} MB)")
    else:
        print(f"✗ {f} NOT FOUND")

# Set ephemeris path
swe.set_ephe_path(ephe_path)

# Test calculation - January 1, 2025, 12:00 UTC
print("\n--- Testing Planetary Calculations ---\n")

jd = swe.julday(2025, 1, 1, 12.0)
print(f"Julian Day for Jan 1, 2025: {jd}")

# Test all planets we need
planets = {
    'Sun': swe.SUN,
    'Moon': swe.MOON,
    'Mars': swe.MARS,
    'Mercury': swe.MERCURY,
    'Jupiter': swe.JUPITER,
    'Venus': swe.VENUS,
    'Saturn': swe.SATURN,
    'Rahu': swe.MEAN_NODE,
}

print(f"\n{'Planet':<10} {'Longitude':<15} {'Speed (°/day)':<15} {'Retrograde'}")
print("-" * 55)

for name, planet_id in planets.items():
    result = swe.calc_ut(jd, planet_id)
    longitude = result[0][0]
    speed = result[0][3]
    retrograde = "Yes" if speed < 0 else "No"
    print(f"{name:<10} {longitude:<15.4f} {speed:<15.4f} {retrograde}")

# Calculate Ketu (opposite to Rahu)
rahu_result = swe.calc_ut(jd, swe.MEAN_NODE)
ketu_longitude = (rahu_result[0][0] + 180) % 360
print(f"{'Ketu':<10} {ketu_longitude:<15.4f} {-rahu_result[0][3]:<15.4f} Yes")

print("\n--- Test Complete ---")
print("If you see planetary positions above, your setup is working!")