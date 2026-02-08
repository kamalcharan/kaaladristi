import swisseph as swe
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
ephe_path = os.path.join(script_dir, 'ephe')
swe.set_ephe_path(ephe_path)

AYANAMSA = swe.SIDM_LAHIRI

print("=== DIRECT SWISS EPHEMERIS TEST ===\n")

# Test date: Jan 1, 2025 (we know Mars was retrograde from your earlier test)
test_date = (2025, 1, 1, 5.5)  # 5.5 UTC = 11 AM IST
jd = swe.julday(*test_date)

print(f"Testing: Jan 1, 2025 at 5:30 UTC")
print(f"Julian Day: {jd}\n")

# Method 1: Without sidereal flag (like your test script)
print("METHOD 1: Tropical (no sidereal flag)")
result1 = swe.calc_ut(jd, swe.MARS)
print(f"  Result structure: {result1}")
print(f"  Longitude: {result1[0][0]:.4f}")
print(f"  Speed: {result1[0][3]:.4f}")
print(f"  Retrograde: {result1[0][3] < 0}")

# Method 2: With sidereal flag (like generate script)
print("\nMETHOD 2: Sidereal (with FLG_SIDEREAL)")
swe.set_sid_mode(AYANAMSA)
result2 = swe.calc_ut(jd, swe.MARS, swe.FLG_SIDEREAL)
print(f"  Result structure: {result2}")
print(f"  Longitude: {result2[0][0]:.4f}")
print(f"  Speed: {result2[0][3]:.4f}")
print(f"  Retrograde: {result2[0][3] < 0}")

# Method 3: With SPEED flag
print("\nMETHOD 3: With FLG_SPEED flag")
result3 = swe.calc_ut(jd, swe.MARS, swe.FLG_SIDEREAL | swe.FLG_SPEED)
print(f"  Result structure: {result3}")
print(f"  Longitude: {result3[0][0]:.4f}")
print(f"  Speed: {result3[0][3]:.4f}")
print(f"  Retrograde: {result3[0][3] < 0}")

# Test multiple planets
print("\n=== ALL PLANETS (Method 3) ===\n")
planets = {
    'Sun': swe.SUN,
    'Moon': swe.MOON,
    'Mars': swe.MARS,
    'Mercury': swe.MERCURY,
    'Jupiter': swe.JUPITER,
    'Venus': swe.VENUS,
    'Saturn': swe.SATURN,
}

for name, pid in planets.items():
    result = swe.calc_ut(jd, pid, swe.FLG_SIDEREAL | swe.FLG_SPEED)
    speed = result[0][3]
    retro = "R" if speed < 0 else ""
    print(f"  {name:<10} speed: {speed:>10.4f}  {retro}")

# Check a known non-retrograde date for Mars
print("\n=== MARS ON DIFFERENT DATES ===\n")
test_dates = [
    (2024, 6, 1),   # Should be direct
    (2025, 1, 1),   # Should be retrograde
    (2025, 3, 1),   # Check
    (2016, 4, 17),  # Known Mars retrograde start
    (2016, 6, 30),  # Known Mars retrograde end
]

for y, m, d in test_dates:
    jd = swe.julday(y, m, d, 5.5)
    result = swe.calc_ut(jd, swe.MARS, swe.FLG_SIDEREAL | swe.FLG_SPEED)
    speed = result[0][3]
    status = "RETROGRADE" if speed < 0 else "DIRECT"
    print(f"  {y}-{m:02d}-{d:02d}: speed = {speed:>8.4f}  → {status}")