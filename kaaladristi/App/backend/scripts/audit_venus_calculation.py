"""Read-only comparison of exported daily positions with the repository formula.

No DB connection, ephemeris generation, timestamp interpolation or writes.
Usage: python scripts/audit_venus_calculation.py path/to/positions.json
"""
import ast
import hashlib
import json
import sys
from datetime import date, timedelta
from pathlib import Path


def windows(rows, key):
    result = []
    for row in rows:
        if not row[key]:
            continue
        day = date.fromisoformat(row['date'])
        if result and day == date.fromisoformat(result[-1]['end']) + timedelta(days=1):
            result[-1]['end'] = row['date']
        else:
            result.append({'start': row['date'], 'end': row['date']})
    return result


def audit(source):
    generator = Path(__file__).resolve().parents[1] / 'generate_ephemeris.py'
    code = generator.read_text(encoding='utf-8')
    # Execute only the existing pure predicate, avoiding generator imports/side effects.
    predicate = next(n for n in ast.parse(code).body if isinstance(n, ast.FunctionDef) and n.name == 'is_combust')
    namespace = {}
    exec(compile(ast.Module(body=[predicate], type_ignores=[]), str(generator), 'exec'), namespace)
    positions = {}
    for item in json.loads(source.read_text(encoding='utf-8-sig')):
        key = (item['date'], item['planet'])
        if key in positions:
            raise ValueError(f'Duplicate sample: {key}')
        positions[key] = item
    rows = []
    for day in sorted(d for d, planet in positions if planet == 'Venus'):
        venus, sun = positions[(day, 'Venus')], positions[(day, 'Sun')]
        offset = (float(venus['longitude']) - float(sun['longitude']) + 180) % 360 - 180
        stored = venus['combust']
        if not isinstance(stored, bool):
            raise ValueError(f'Missing/non-boolean combustion flag on {day}')
        computed = namespace['is_combust'](float(sun['longitude']), float(venus['longitude']), 'Venus')
        rows.append({'date': day, 'sun_venus_signed_deg': round(offset, 6),
                     'sun_venus_separation_deg': round(abs(offset), 6),
                     'stored_combust': stored, 'repository_combust': computed,
                     'venus_retrograde': venus['retrograde'], 'venus_speed': venus['speed']})
    return {'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'formula_source': str(generator), 'formula': ast.get_source_segment(code, predicate),
            'precision': 'exported daily samples; sample timestamps not provided',
            'stored_windows': windows(rows, 'stored_combust'),
            'repository_formula_windows': windows(rows, 'repository_combust'),
            'flag_mismatches': [r for r in rows if r['stored_combust'] != r['repository_combust']],
            'daily_comparison': rows}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: audit_venus_calculation.py positions.json')
    print(json.dumps(audit(Path(sys.argv[1])), indent=2))
