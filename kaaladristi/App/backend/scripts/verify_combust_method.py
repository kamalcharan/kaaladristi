"""
verify_combust_method.py — diagnostic for the Mercury combust window method.

Findings (2026-07-21, see docs/claude/astro-story.md §6): the owner's almanac
combust table ("Mercury Combust & Rise", docs/finastro/mercury.jpg, source:
Drik Panchang-style Budha Asta/Udaya) is a VISIBILITY computation, not a fixed
combustion arc. This script proves it by computing, at each of the sheet's own
2026 boundary timestamps:

  1. the Sun–Mercury ecliptic separation ("implied orb") — varies 9.8°–16.8°,
     refuting both the generator's flat 15° arc and the classical
     Surya-Siddhanta 14°-direct/12°-retro approximation; and
  2. a modern arcus-visionis heliacal event search (swe.heliacal_ut) for
     comparison — right phenomenon, but default params miss by days.

Next step (calibration subtask): fit a visibility criterion (planet altitude
when Sun at -X°, or kalamsa time-degrees) to the 13 sheet boundaries below,
then regenerate TR-MER-CMB-E-BEA windows in generate_mercury_windows.py with
the matched method. Needs the owner's Drik Panchang city setting.

Run: python3 verify_combust_method.py   (no DB access needed)
"""

import os
from datetime import datetime, timedelta, timezone

import swisseph as swe

EPHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ephe')
swe.set_ephe_path(EPHE_PATH)
swe.set_sid_mode(swe.SIDM_LAHIRI)
FLAGS = swe.FLG_SIDEREAL | swe.FLG_SPEED

# Drik Panchang default city (New Delhi). The sheet's actual city is unknown —
# the calibration subtask should sweep candidate cities.
GEOPOS = [77.209, 28.614, 216.0]
DATM = [1013.25, 15.0, 50.0, 0.25]
DOBS = [36.0, 0.0, 0.0, 0.0, 0.0, 0.0]

# Owner's almanac 2026 combust boundaries (IST), transcribed from mercury.jpg.
# kind: 'asta' = disappearance (combust start), 'udaya' = reappearance (end).
# sky:  'W' = morning sky (west of Sun), 'E' = evening sky (east of Sun).
SHEET_2026 = [
    ('asta',  'W', (2026, 1, 4, 6, 32)),
    ('udaya', 'E', (2026, 2, 5, 19, 20)),
    ('asta',  'E', (2026, 2, 28, 19, 33)),
    ('udaya', 'W', (2026, 3, 16, 5, 51)),
    ('asta',  'W', (2026, 5, 2, 5, 30)),
    ('udaya', 'E', (2026, 5, 23, 19, 58)),
    ('asta',  'E', (2026, 7, 2, 20, 14)),
    ('udaya', 'W', (2026, 7, 24, 5, 11)),
    ('asta',  'W', (2026, 8, 18, 5, 37)),
    ('udaya', 'E', (2026, 9, 13, 19, 27)),
    ('asta',  'E', (2026, 10, 27, 18, 56)),
    ('udaya', 'W', (2026, 11, 11, 5, 48)),
    ('asta',  'W', (2026, 12, 15, 6, 21)),
]


def jd_ist(y, mo, d, h, mi):
    ut = datetime(y, mo, d, h, mi) - timedelta(hours=5, minutes=30)
    return swe.julday(ut.year, ut.month, ut.day, ut.hour + ut.minute / 60.0)


def jd_to_ist(jd):
    ut = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(days=jd - 2440587.5)
    return (ut + timedelta(hours=5, minutes=30)).strftime('%d-%b-%y %H:%M')


def sep_and_speed(jd):
    m = swe.calc_ut(jd, swe.MERCURY, FLAGS)
    s = swe.calc_ut(jd, swe.SUN, FLAGS)
    d = abs(m[0][0] - s[0][0]) % 360.0
    return min(d, 360.0 - d), m[0][3]


def implied_orbs():
    print('— Implied ecliptic orb at each sheet boundary —')
    print(f"{'boundary (IST)':<22} {'kind':<6} {'orb':>7} {'motion':>8}")
    for kind, sky, t in SHEET_2026:
        sep, spd = sep_and_speed(jd_ist(*t))
        stamp = datetime(*t).strftime('%d-%b-%y %H:%M')
        print(f"{stamp:<22} {kind:<6} {sep:>6.2f}° {'retro' if spd < 0 else 'direct':>8}")
    print('  → a fixed arc (any value) cannot reproduce this table.\n')


# heliacal event types: asta in W sky = MORNING_LAST(4); udaya in E sky =
# EVENING_FIRST(3); asta in E sky = EVENING_LAST(2); udaya in W sky =
# MORNING_FIRST(1).
HELIACAL_EVENT = {('asta', 'W'): 4, ('udaya', 'E'): 3,
                  ('asta', 'E'): 2, ('udaya', 'W'): 1}


def heliacal_comparison():
    print('— Modern arcus-visionis model (default params, New Delhi) vs sheet —')
    for kind, sky, t in SHEET_2026:
        target = jd_ist(*t)
        try:
            jd = swe.heliacal_ut(target - 10.0, GEOPOS, DATM, DOBS, 'Mercury',
                                 HELIACAL_EVENT[(kind, sky)],
                                 swe.HELFLAG_HIGH_PRECISION)[0]
            delta = jd - target
            stamp = datetime(*t).strftime('%d-%b-%y %H:%M')
            print(f"model {jd_to_ist(jd):<18} sheet {stamp:<18} Δ {delta:+6.1f} d")
        except Exception as e:  # noqa: BLE001 — diagnostic script
            print(f"model search failed for {kind}/{sky} {t}: {e}")
    print('  → close on some boundaries, off by days on others: default')
    print('    visibility params are not Drik Panchang\'s; calibration needed.')


if __name__ == '__main__':
    implied_orbs()
    heliacal_comparison()
