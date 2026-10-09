"""Read-only October 2026 visibility comparison. Requires pyswisseph.

No DB writes or almanac overrides. Uses explicit Moshier ephemeris so no
external ephemeris-file fallback is hidden. Parameter cases are exploratory,
not a validated Venus visibility model.
"""
import json
from datetime import datetime, timedelta, timezone
import swisseph as swe

IST = timezone(timedelta(hours=5, minutes=30))
GEOPOS = [75.7885, 23.1793, 494.0]


def stamp(jd):
    y, m, d, hour = swe.revjul(jd)
    dt = datetime(y, m, d, tzinfo=timezone.utc) + timedelta(hours=hour)
    return dt.astimezone(IST).isoformat(timespec='minutes')


def compare():
    flags = swe.FLG_MOSEPH | swe.HELFLAG_HIGH_PRECISION
    cases = [
        ('standard_observer_explicit_atmosphere', [1013.25, 15.0, 50.0, 0.25], [36.0, 1.0, 0, 0, 0, 0]),
        ('mercury_parameters_sensitivity_only', [1013.25, 25.0, 40.0, 0.24], [36.0, 3.25, 0, 0, 0, 0]),
    ]
    output = {'engine': swe.version, 'ephemeris': 'Moshier', 'flags': flags,
              'location': {'name': 'Ujjain', 'longitude_latitude_altitude': GEOPOS},
              'timezone': 'Asia/Kolkata (UTC+05:30)',
              'status': 'exploratory calculations, not observationally validated', 'cases': []}
    for name, atmosphere, observer in cases:
        events = []
        for label, event_type in [('last_evening_visibility', swe.HELIACAL_SETTING),
                                  ('first_morning_visibility', swe.HELIACAL_RISING)]:
            result = swe.heliacal_ut(swe.julday(2026, 9, 1, 0), GEOPOS,
                                     atmosphere, observer, 'Venus', event_type, flags)
            if not swe.julday(2026, 9, 1, 0) <= result[0] < swe.julday(2026, 12, 1, 0):
                raise ValueError(f'{name}: {label} is outside the intended season')
            events.append({'event': label, 'event_type': event_type,
                           'model_time_ist': stamp(result[0]), 'julian_day_ut': result[0]})
        assert events[0]['julian_day_ut'] < events[1]['julian_day_ut']
        output['cases'].append({'name': name, 'atmosphere': atmosphere,
                                'observer': observer, 'events': events})
    return output


if __name__ == '__main__':
    print(json.dumps(compare(), indent=2))
