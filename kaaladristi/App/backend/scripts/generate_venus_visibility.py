"""Generate canonical Venus visibility windows; no database connection.

Defaults to 1990-2030 inclusive. Writes JSON and optional transactional SQL.
All events are calculated, with no reference overrides or market-day filters.
"""
import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import swisseph as swe

IST = timezone(timedelta(hours=5, minutes=30))
METHOD = 'venus_visibility_ujjain_v1'
PARAMETERS = {'location': 'Ujjain', 'geopos': [75.7885, 23.1793, 494.0],
              'atmosphere': [1013.25, 25.0, 40.0, 0.24],
              'observer': [36.0, 3.25, 0, 0, 0, 0],
              'ephemeris': 'Moshier', 'timezone': 'Asia/Kolkata',
              'engine': swe.version, 'method_version': METHOD,
              'flags': swe.FLG_MOSEPH | swe.HELFLAG_HIGH_PRECISION,
              'precision': 'calculated_visibility_model', 'manual_overrides': False}


def timestamp(jd):
    y, m, d, h = swe.revjul(jd)
    return (datetime(y, m, d, tzinfo=timezone.utc) + timedelta(hours=h)).astimezone(IST)


def next_event(jd, kind):
    result = swe.heliacal_ut(jd, PARAMETERS['geopos'], PARAMETERS['atmosphere'],
                             PARAMETERS['observer'], 'Venus', kind, PARAMETERS['flags'])[0]
    if result < jd:
        raise ValueError('Visibility search returned a past event')
    return result


def generate(first, last):
    if first > last:
        raise ValueError('Start year must not exceed end year')
    lower, upper = date(first, 1, 1), date(last + 1, 1, 1)
    # Include a window already in progress on January 1 without clipping it.
    cursor = swe.julday(first - 1, 1, 1, 0)
    result = []
    while True:
        morning = next_event(cursor, swe.MORNING_LAST)
        evening = next_event(cursor, swe.HELIACAL_SETTING)
        start = min(morning, evening)
        if timestamp(start).date() >= upper:
            break
        start_kind = 'morning_last' if morning <= evening else 'evening_last'
        end_kind = 'evening_first' if morning <= evening else 'morning_first'
        end = next_event(start, swe.EVENING_FIRST if morning <= evening else swe.HELIACAL_RISING)
        if not start < end < start + 200:
            raise ValueError('Unexpected visibility window length/order')
        if timestamp(end).date() >= lower:
            result.append({'start_ts': timestamp(start).isoformat(timespec='seconds'),
                           'end_ts': timestamp(end).isoformat(timespec='seconds'),
                           'start_event': start_kind, 'end_event': end_kind})
        cursor = end + 2
    if not result:
        raise ValueError('No visibility windows calculated')
    for previous, current in zip(result, result[1:]):
        if previous['end_ts'] >= current['start_ts']:
            raise ValueError('Overlapping visibility periods')
    return result


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def sql_export(windows):
    # Schema is kept in a reviewed template; generation adds computed rows only.
    template = Path(__file__).with_name('venus_visibility_schema.sql').read_text(encoding='utf-8')
    rows = ',\n'.join('(' + ','.join(sql_literal(row[key]) for key in
                        ('start_ts', 'end_ts', 'start_event', 'end_event')) + ')' for row in windows)
    return template.replace('-- GENERATED_VALUES', rows).replace('-- GENERATED_PARAMETERS', sql_literal(json.dumps(PARAMETERS)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-year', type=int, default=1990)
    parser.add_argument('--to-year', type=int, default=2030)
    parser.add_argument('--json-output', type=Path, required=True)
    parser.add_argument('--sql-output', type=Path)
    args = parser.parse_args()
    windows = generate(args.from_year, args.to_year)
    args.json_output.write_text(json.dumps({'parameters': PARAMETERS, 'windows': windows}, indent=2), encoding='utf-8')
    if args.sql_output:
        args.sql_output.write_text(sql_export(windows), encoding='utf-8')
    print(f'Generated {len(windows)} complete windows overlapping {args.from_year}-{args.to_year}. No database writes.')
