#!/usr/bin/env python3
"""
Panchang CSV Generator — March & April 2026
Columns: DATE, DAY, TITHI, MOON RASHI, NAKSHATRA, NAK LORD, RESULTS

Uses pyswisseph with Lahiri sidereal ayanamsa (mandatory for Vedic panchang).
Calculations at 09:15 IST (market open). Mid-day changes detected via binary
search and noted inline (e.g. "Hasta / Chitra 09:29").

Also writes structured rows to km_panchang_calendar in the DB.

Run on VPS:
    KD_DB_PASSWORD=yourpassword python3 generate_panchang_2026.py

Cross-check: Mar 17 → Shatabhisha, Mar 25 → Mrigsira
"""

import swisseph as swe
import psycopg2
import psycopg2.extras
import csv
import os
from datetime import datetime, timedelta, date

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EPHE_PATH  = os.path.join(SCRIPT_DIR, 'ephe')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

DB_CONFIG = {
    'host':     '187.127.136.65',
    'dbname':   'kaala_dristi_db',
    'user':     'postgres',
    'password': os.environ.get('KD_DB_PASSWORD', ''),
    'port':     5432,
    'connect_timeout': 10,
}

swe.set_ephe_path(EPHE_PATH)
swe.set_sid_mode(swe.SIDM_LAHIRI)

# ── Reference tables ──────────────────────────────────────────────────────────

NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigsira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
]

NAK_LORDS = [
    'Ketu',    'Venus',   'Sun',     'Moon',    'Mars',    'Rahu',
    'Jupiter', 'Saturn',  'Mercury', 'Ketu',    'Venus',   'Sun',
    'Moon',    'Mars',    'Rahu',    'Jupiter', 'Saturn',  'Mercury',
    'Ketu',    'Venus',   'Sun',     'Moon',    'Mars',    'Rahu',
    'Jupiter', 'Saturn',  'Mercury',
]

RASHIS = [
    'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
    'Tula', 'Vrishchik', 'Dhanu', 'Makar', 'Kumbha', 'Meena',
]

TITHI_NAMES = [
    'Prathama', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
    'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
    'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
]

WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

# ── Ephemeris helpers ─────────────────────────────────────────────────────────

IST_OFFSET = 5.5  # hours

def to_jd(d, hour_ist):
    """Julian Day for date d at given IST hour (e.g. 9.25 = 09:15)."""
    return swe.julday(d.year, d.month, d.day, hour_ist - IST_OFFSET)

def sidereal_lon(jd, planet):
    return swe.calc_ut(jd, planet, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def moon_sun_lon(jd):
    return sidereal_lon(jd, swe.MOON), sidereal_lon(jd, swe.SUN)

def nak_of(moon_lon):
    return int(moon_lon * 27 / 360) % 27

def rashi_of(moon_lon):
    return int(moon_lon / 30) % 12

def tithi_of(moon_lon, sun_lon):
    return int((moon_lon - sun_lon) % 360 / 12) % 30

def tithi_label(n):
    if n == 14: return 'Purnima'
    if n == 29: return 'Amavasya'
    if n < 14:  return f'Shukla {TITHI_NAMES[n]}'
    return          f'Krishna {TITHI_NAMES[n - 15]}'

def jd_to_ist_hhmm(jd):
    """Convert Julian Day to IST time string HH:MM."""
    unix_sec = (jd - 2440587.5) * 86400
    dt_ist   = datetime(1970, 1, 1) + timedelta(seconds=unix_sec) + timedelta(hours=IST_OFFSET)
    return dt_ist.strftime('%H:%M')

def find_transition(d, value_fn, v_morning, h_start=9.25, h_end=15.5):
    """
    Binary-search for when value_fn(jd) changes from v_morning during
    the trading window [h_start, h_end] IST.
    Returns IST time string, or None if no change.
    """
    jd_s = to_jd(d, h_start)
    jd_e = to_jd(d, h_end)
    if value_fn(jd_e) == v_morning:
        return None
    lo, hi = jd_s, jd_e
    for _ in range(40):                    # converges to < 1 second
        mid = (lo + hi) / 2
        if value_fn(mid) == v_morning:
            lo = mid
        else:
            hi = mid
        if (hi - lo) * 1440 < (1 / 60):   # < 1 second precision
            break
    return jd_to_ist_hhmm(hi)

# ── DB helpers ────────────────────────────────────────────────────────────────

def fetch_results(conn, d):
    """
    Fetch all active astro events for date d from km_astro_calendar.
    Returns concatenated inference + notes as a single string.
    """
    with conn.cursor() as cur:
        # Try renamed table first, fall back to original name
        for tbl in ('km_astro_calendar', 'km_astro_calendar_2026'):
            try:
                cur.execute(f"""
                    SELECT display_name, market_impact, inference, notes
                    FROM {tbl}
                    WHERE start_date <= %s
                      AND (end_date IS NULL OR end_date >= %s)
                    ORDER BY
                        CASE market_impact
                            WHEN 'strong_bearish' THEN 1
                            WHEN 'strong_bullish' THEN 2
                            WHEN 'bearish'        THEN 3
                            WHEN 'bullish'        THEN 4
                            ELSE 5
                        END,
                        id
                """, (d, d))
                rows = cur.fetchall()
                break
            except Exception:
                conn.rollback()
                rows = []
                continue

    parts = []
    for display_name, impact, inference, notes in rows:
        segment = inference.strip() if inference else display_name
        if notes and notes.strip():
            segment = f'{segment} ({notes.strip()})'
        parts.append(segment)

    return ' | '.join(parts) if parts else ''


def upsert_panchang_calendar(conn, rows_db):
    """UPSERT a list of structured panchang dicts into km_panchang_calendar."""
    sql = """
        INSERT INTO km_panchang_calendar
          (trade_date, weekday,
           tithi, tithi_end_time,
           moon_rashi, moon_rashi_next, moon_rashi_change_time,
           nakshatra, nakshatra_next, nakshatra_change_time,
           nak_lord)
        VALUES %s
        ON CONFLICT (trade_date) DO UPDATE SET
          weekday                = EXCLUDED.weekday,
          tithi                  = EXCLUDED.tithi,
          tithi_end_time         = EXCLUDED.tithi_end_time,
          moon_rashi             = EXCLUDED.moon_rashi,
          moon_rashi_next        = EXCLUDED.moon_rashi_next,
          moon_rashi_change_time = EXCLUDED.moon_rashi_change_time,
          nakshatra              = EXCLUDED.nakshatra,
          nakshatra_next         = EXCLUDED.nakshatra_next,
          nakshatra_change_time  = EXCLUDED.nakshatra_change_time,
          nak_lord               = EXCLUDED.nak_lord,
          updated_at             = now()
    """
    values = [
        (
            r['trade_date'], r['weekday'],
            r['tithi'], r['tithi_end_time'],
            r['moon_rashi'], r['moon_rashi_next'], r['moon_rashi_change_time'],
            r['nakshatra'], r['nakshatra_next'], r['nakshatra_change_time'],
            r['nak_lord'],
        )
        for r in rows_db
    ]
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, values)
    conn.commit()

# ── Row builder ───────────────────────────────────────────────────────────────

def build_row(d, conn):
    jd_open  = to_jd(d, 9.25)   # 09:15 IST — market open
    jd_close = to_jd(d, 15.5)   # 15:30 IST — market close

    moon_m, sun_m = moon_sun_lon(jd_open)
    moon_e, _     = moon_sun_lon(jd_close)

    # ── Nakshatra ─────────────────────────────────────────────────────────────
    nak_m = nak_of(moon_m)
    nak_e = nak_of(moon_e)
    nak_change_t = None
    if nak_m == nak_e:
        nak_str = NAKSHATRAS[nak_m]
        nak_next = None
    else:
        nak_change_t = find_transition(d, lambda jd: nak_of(sidereal_lon(jd, swe.MOON)), nak_m)
        nak_next = NAKSHATRAS[nak_e]
        nak_str = (f'{NAKSHATRAS[nak_m]} / {nak_next} {nak_change_t}'
                   if nak_change_t else f'{NAKSHATRAS[nak_m]} / {nak_next}')

    # ── Moon Rashi ────────────────────────────────────────────────────────────
    rash_m = rashi_of(moon_m)
    rash_e = rashi_of(moon_e)
    rash_change_t = None
    if rash_m == rash_e:
        rash_str = RASHIS[rash_m]
        rash_next = None
    else:
        rash_change_t = find_transition(d, lambda jd: rashi_of(sidereal_lon(jd, swe.MOON)), rash_m)
        rash_next = RASHIS[rash_e]
        rash_str = (f'{RASHIS[rash_m]} / {rash_next} from {rash_change_t}'
                    if rash_change_t else f'{RASHIS[rash_m]} / {rash_next}')

    # ── Tithi ─────────────────────────────────────────────────────────────────
    sun_e_lon = sidereal_lon(jd_close, swe.SUN)
    tith_m = tithi_of(moon_m, sun_m)
    tith_e = tithi_of(moon_e, sun_e_lon)
    tith_end_t = None
    if tith_m == tith_e:
        tith_str = tithi_label(tith_m)
    else:
        tith_end_t = find_transition(
            d,
            lambda jd: tithi_of(sidereal_lon(jd, swe.MOON), sidereal_lon(jd, swe.SUN)),
            tith_m,
        )
        tith_str = (f'{tithi_label(tith_m)} / {tithi_label(tith_e)} {tith_end_t}'
                    if tith_end_t else f'{tithi_label(tith_m)} / {tithi_label(tith_e)}')

    # ── RESULTS from DB ───────────────────────────────────────────────────────
    results = fetch_results(conn, d) if conn else ''

    csv_row = {
        'DATE':       d.strftime('%d-%m-%Y'),
        'DAY':        WEEKDAYS[d.weekday()],
        'TITHI':      tith_str,
        'MOON RASHI': rash_str,
        'NAKSHATRA':  nak_str,
        'NAK LORD':   NAK_LORDS[nak_m],
        'RESULTS':    results,
    }

    db_row = {
        'trade_date':             d,
        'weekday':                WEEKDAYS[d.weekday()],
        'tithi':                  tithi_label(tith_m),
        'tithi_end_time':         tith_end_t,
        'moon_rashi':             RASHIS[rash_m],
        'moon_rashi_next':        rash_next,
        'moon_rashi_change_time': rash_change_t,
        'nakshatra':              NAKSHATRAS[nak_m],
        'nakshatra_next':         nak_next,
        'nakshatra_change_time':  nak_change_t,
        'nak_lord':               NAK_LORDS[nak_m],
    }

    return csv_row, db_row

# ── Main ──────────────────────────────────────────────────────────────────────

MONTHS = [
    ('march_2026', date(2026, 3, 1),  date(2026, 3, 31)),
    ('april_2026', date(2026, 4, 1),  date(2026, 4, 30)),
]

FIELDNAMES = ['DATE', 'DAY', 'TITHI', 'MOON RASHI', 'NAKSHATRA', 'NAK LORD', 'RESULTS']


def main():
    print('=' * 65)
    print('  KaalaDristi Panchang Generator — March & April 2026')
    print('  Ayanamsa: Lahiri Sidereal | Time: 09:15 IST')
    print('=' * 65)

    # DB connection (optional — RESULTS will be blank if unavailable)
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print('✓ DB connected\n')
    except Exception as e:
        print(f'⚠  DB not available ({e})\n  RESULTS column will be empty.\n')

    for name, start, end in MONTHS:
        print(f'── {name.upper()} ──────────────────────────────────────────')
        csv_rows = []
        db_rows  = []
        d = start
        while d <= end:
            try:
                csv_row, db_row = build_row(d, conn)
                csv_rows.append(csv_row)
                db_rows.append(db_row)
                print(f"  {csv_row['DATE']}  {csv_row['DAY']:<10}  "
                      f"{csv_row['NAKSHATRA']:<35}  {csv_row['TITHI']}")
            except Exception as e:
                print(f'  ERROR {d}: {e}')
            d += timedelta(days=1)

        # Write CSV
        out = os.path.join(OUTPUT_DIR, f'{name}_panchang.csv')
        with open(out, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=FIELDNAMES)
            w.writeheader()
            w.writerows(csv_rows)
        print(f'\n  ✓ Saved: {out}')

        # Write to DB
        if conn and db_rows:
            try:
                upsert_panchang_calendar(conn, db_rows)
                print(f'  ✓ Upserted {len(db_rows)} rows → km_panchang_calendar\n')
            except Exception as e:
                print(f'  ⚠  DB upsert failed: {e}\n')
        else:
            print()

    if conn:
        conn.close()

    # ── Validation cross-check ────────────────────────────────────────────────
    print('── Cross-check ──────────────────────────────────────────────')
    checks = [
        (date(2026, 3, 17), 'Shatabhisha'),
        (date(2026, 3, 25), 'Mrigsira'),
    ]
    all_ok = True
    for d, expected in checks:
        ml  = sidereal_lon(to_jd(d, 9.25), swe.MOON)
        got = NAKSHATRAS[nak_of(ml)]
        ok  = '✓' if got == expected else '✗ MISMATCH'
        if got != expected:
            all_ok = False
        print(f'  {d}  Moon={ml:.2f}°  Got={got:<20}  Expected={expected}  {ok}')

    if all_ok:
        print('\n  All cross-checks passed.')
    else:
        print('\n  ⚠  Cross-check failed — verify ayanamsa and ephemeris path.')


if __name__ == '__main__':
    main()
