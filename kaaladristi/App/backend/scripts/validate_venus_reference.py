"""Compare unchanged visibility parameters with owner-supplied Drik screenshots.

Read-only. No fitting, overrides, database access or trading calendar filtering.
2027 screenshot is assumed to retain the preceding Ujjain location setting.
"""
import json
from datetime import datetime
import swisseph as swe
from compare_venus_visibility import GEOPOS, IST, stamp


def validate():
    atmosphere = [1013.25, 25.0, 40.0, 0.24]
    observer = [36.0, 3.25, 0, 0, 0, 0]
    periods = [
        ('2025-12 / 2026-01', (2025, 11, 1), (2026, 3, 1),
         [('disappearance', swe.MORNING_LAST, '2025-12-12T06:32:00+05:30'),
          ('reappearance', swe.EVENING_FIRST, '2026-01-31T18:39:00+05:30')]),
        ('2026-10', (2026, 9, 1), (2026, 12, 1),
         [('disappearance', swe.HELIACAL_SETTING, '2026-10-14T18:24:00+05:30'),
          ('reappearance', swe.HELIACAL_RISING, '2026-10-28T06:05:00+05:30')]),
        ('2027-07 / 2027-09', (2027, 6, 1), (2027, 11, 1),
         [('disappearance', swe.MORNING_LAST, '2027-07-22T05:27:00+05:30'),
          ('reappearance', swe.EVENING_FIRST, '2027-09-06T19:04:00+05:30')]),
    ]
    rows = []
    for period, start, end, events in periods:
        prior = None
        for event, event_type, reference in events:
            jd = swe.heliacal_ut(swe.julday(*start, 0), GEOPOS, atmosphere,
                                 observer, 'Venus', event_type,
                                 swe.FLG_MOSEPH | swe.HELFLAG_HIGH_PRECISION)[0]
            if not swe.julday(*start, 0) <= jd < swe.julday(*end, 0):
                raise ValueError('Result outside comparison season')
            if prior is not None and jd <= prior:
                raise ValueError('Reappearance must follow disappearance')
            prior = jd
            ref = datetime.fromisoformat(reference)
            model = datetime.fromisoformat(stamp(jd))
            rows.append({'period': period, 'event': event, 'event_type': event_type,
                         'reference_ist': reference, 'model_ist': stamp(jd),
                         'model_jd_ut': jd,
                         'difference_minutes_at_display_precision': round((model-ref).total_seconds()/60),
                         'calendar_day_difference': (model.date()-ref.date()).days})
    return {'reference_source': 'owner-supplied Drik Panchang screenshots',
            'location': 'Ujjain; assumed for 2027 screenshot', 'geopos': GEOPOS,
            'engine': swe.version, 'ephemeris': 'Moshier', 'atmosphere': atmosphere,
            'observer': observer, 'parameter_changes': False, 'rows': rows}


if __name__ == '__main__':
    print(json.dumps(validate(), indent=2))
