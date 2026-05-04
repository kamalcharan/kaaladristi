"""
populate_panchang_windows.py
============================
Computes rahu_kala_start/end, abhijit_start/end, yoga_end_ist and
yoga_end_next_day for rows in km_daily_panchang (Migration 072).

Computation
-----------
Daylight = sunset - sunrise. Split into 8 equal muhurtas of
~ 90 min each.

Rahu Kala = the Nth muhurta of the day, where N depends on weekday
(canonical Vedic table — JS getDay() index):
  Sun=8, Mon=2, Tue=7, Wed=5, Thu=6, Fri=4, Sat=3

Abhijit Muhurta = the 8th of 16 half-muhurtas in daylight = true noon
± ~24 min. Implemented as sunrise + 7 * (daylight/16) → start,
sunrise + 8 * (daylight/16) → end.

Yoga end = exact JD when sum-of-longitudes (Sun + Moon) crosses the
next 13°20' boundary, found via binary search. Mirrors the pattern in
populate_panchang_end_times.py.

Prerequisites:
  - Run Migration 072 (adds the 6 new columns)

Usage (from App/backend):
    python populate_panchang_windows.py            # backfill NULLs
    python populate_panchang_windows.py --date 2026-05-04
    python populate_panchang_windows.py --all      # recompute every row
    python populate_panchang_windows.py --dry-run  # preview only
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta, time as dt_time

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(script_dir, '..', '.env'))

import swisseph as swe
from lib.config import DATABASE_URL

# ── Constants ──────────────────────────────────────────────────────────────────

swe.set_ephe_path(os.path.join(script_dir, 'ephe'))
swe.set_sid_mode(swe.SIDM_LAHIRI)

YOGA_SIZE   = 360.0 / 27          # one yoga = 13°20'
SECOND_IN_JD = 1.0 / 86400

# Canonical Vedic Rahu Kala muhurta-index per JS getDay() weekday.
# (Sunday=0 included even though markets are closed — page may still render.)
RAHU_MUHURTA_BY_WEEKDAY = {
    0: 8,  # Sunday
    1: 2,  # Monday
    2: 7,  # Tuesday
    3: 5,  # Wednesday
    4: 6,  # Thursday
    5: 4,  # Friday
    6: 3,  # Saturday
}

# ── Astronomical helpers ───────────────────────────────────────────────────────

def _moon_long(jd):
    return swe.calc_ut(jd, swe.MOON, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def _sun_long(jd):
    return swe.calc_ut(jd, swe.SUN, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def _yoga_num(jd):
    return int(((_sun_long(jd) + _moon_long(jd)) % 360) / YOGA_SIZE)

def _find_yoga_change(jd_start, jd_end, yoga_start):
    """Binary search: JD of next yoga boundary, or None if no change in window."""
    if _yoga_num(jd_end) == yoga_start:
        return None
    lo, hi = jd_start, jd_end
    while (hi - lo) > SECOND_IN_JD:
        mid = (lo + hi) / 2
        if _yoga_num(mid) == yoga_start:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

def _jd_to_ist(jd):
    """JD → IST clock-face time HH:MM:SS."""
    _, _, _, utc_h = swe.revjul(jd)
    ist_h = utc_h + 5.5
    if ist_h >= 24:
        ist_h -= 24
    h = int(ist_h)
    m_frac = (ist_h - h) * 60
    m = int(m_frac)
    s = int((m_frac - m) * 60)
    return f"{h:02d}:{m:02d}:{s:02d}"

def _is_next_day(jd_change, date_str):
    year, month, day, utc_h = swe.revjul(jd_change)
    h = int(utc_h)
    m = int((utc_h - h) * 60)
    s = int(((utc_h - h) * 60 - m) * 60)
    ist_dt = datetime(year, month, day, h, m, s) + timedelta(hours=5, minutes=30)
    return ist_dt.date() > datetime.strptime(date_str, '%Y-%m-%d').date()

def _sunrise_to_jd(date_str, sunrise_ist):
    parts = sunrise_ist.split(':')
    h, m, s = int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
    utc_h = h + m / 60 + s / 3600 - 5.5
    d = datetime.strptime(date_str, '%Y-%m-%d')
    if utc_h < 0:
        d -= timedelta(days=1)
        utc_h += 24
    return swe.julday(d.year, d.month, d.day, utc_h)

# ── Window math (no astronomy — just clock arithmetic) ─────────────────────────

def _parse_hms(s):
    parts = s.split(':')
    return int(parts[0]), int(parts[1]), (int(parts[2]) if len(parts) > 2 else 0)

def _hms_to_minutes(s):
    h, m, sec = _parse_hms(s)
    return h * 60 + m + sec / 60.0

def _minutes_to_time(minutes_float):
    """Float minutes from midnight → datetime.time (rounds to second)."""
    total_seconds = int(round(minutes_float * 60))
    total_seconds = total_seconds % (24 * 3600)
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return dt_time(h, m, s)

def compute_rahu_window(date_str, sunrise_ist, sunset_ist):
    """Return (rahu_start, rahu_end) as datetime.time objects, or (None, None)."""
    if not sunrise_ist or not sunset_ist:
        return None, None
    sr = _hms_to_minutes(sunrise_ist)
    ss = _hms_to_minutes(sunset_ist)
    daylight = ss - sr
    if daylight <= 0:
        return None, None
    muhurta = daylight / 8.0

    weekday = datetime.strptime(date_str, '%Y-%m-%d').weekday()
    # Python weekday(): Mon=0..Sun=6. Convert to JS getDay(): Sun=0..Sat=6.
    js_weekday = (weekday + 1) % 7
    n = RAHU_MUHURTA_BY_WEEKDAY[js_weekday]

    return _minutes_to_time(sr + (n - 1) * muhurta), _minutes_to_time(sr + n * muhurta)

def compute_abhijit_window(sunrise_ist, sunset_ist):
    """Return (abhijit_start, abhijit_end) as datetime.time objects.

    Abhijit Muhurta = the 8th of 15 daytime muhurtas (each = daylight/15).
    Centered on local solar noon ± ~24 min for a 12h daylight day.
    """
    if not sunrise_ist or not sunset_ist:
        return None, None
    sr = _hms_to_minutes(sunrise_ist)
    ss = _hms_to_minutes(sunset_ist)
    daylight = ss - sr
    if daylight <= 0:
        return None, None
    muhurta = daylight / 15.0
    return _minutes_to_time(sr + 7 * muhurta), _minutes_to_time(sr + 8 * muhurta)

def compute_yoga_end(date_str, sunrise_ist):
    """Return (yoga_end_ist, yoga_end_next_day) tuple. None if no change in 30h."""
    if not sunrise_ist:
        return None, False
    jd_start = _sunrise_to_jd(date_str, sunrise_ist)
    jd_end   = jd_start + 1.25  # 30h window
    y0 = _yoga_num(jd_start)
    jd_y = _find_yoga_change(jd_start, jd_end, y0)
    if not jd_y:
        return None, False
    return _jd_to_ist(jd_y), _is_next_day(jd_y, date_str)

# ── DB helpers ─────────────────────────────────────────────────────────────────

def _fetch_rows(conn, date_str, force_all):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if date_str:
            cur.execute(
                "SELECT date, sunrise_ist, sunset_ist "
                "FROM km_daily_panchang WHERE date = %s",
                (date_str,)
            )
        elif force_all:
            cur.execute(
                "SELECT date, sunrise_ist, sunset_ist "
                "FROM km_daily_panchang ORDER BY date"
            )
        else:
            cur.execute(
                "SELECT date, sunrise_ist, sunset_ist "
                "FROM km_daily_panchang "
                "WHERE rahu_kala_start IS NULL "
                "   OR abhijit_start IS NULL "
                "   OR yoga_end_ist  IS NULL "
                "ORDER BY date"
            )
        return [dict(r) for r in cur.fetchall()]

def _update_row(conn, date_str, rs, re_, abs_, abe, y_end, y_next):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE km_daily_panchang "
            "SET rahu_kala_start = %s, rahu_kala_end = %s, "
            "    abhijit_start   = %s, abhijit_end   = %s, "
            "    yoga_end_ist    = %s, yoga_end_next_day = %s "
            "WHERE date = %s",
            (rs, re_, abs_, abe, y_end, y_next, date_str)
        )

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date',    help='Single date YYYY-MM-DD')
    parser.add_argument('--all',     action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not DATABASE_URL:
        print('ERROR: DATABASE_URL not set — check App/.env')
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        rows = _fetch_rows(conn, args.date, args.all)
        if not rows:
            print('No rows to process.')
            return

        tag = '[DRY RUN] ' if args.dry_run else ''
        print(f'{tag}Processing {len(rows)} rows...\n')
        updated = skipped = errors = 0

        for row in rows:
            date_str = str(row['date'])
            sunrise  = row.get('sunrise_ist')
            sunset   = row.get('sunset_ist')
            try:
                rs, re_ = compute_rahu_window(date_str, str(sunrise) if sunrise else None,
                                              str(sunset) if sunset else None)
                abs_, abe = compute_abhijit_window(str(sunrise) if sunrise else None,
                                                   str(sunset) if sunset else None)
                y_end, y_next = compute_yoga_end(date_str, str(sunrise) if sunrise else None)

                if rs is None and y_end is None:
                    print(f'  SKIP  {date_str} — missing sunrise/sunset')
                    skipped += 1
                    continue

                rs_lbl = f'{rs.strftime("%H:%M")}-{re_.strftime("%H:%M")}' if rs else '-'
                ab_lbl = f'{abs_.strftime("%H:%M")}-{abe.strftime("%H:%M")}' if abs_ else '-'
                y_lbl  = f'{y_end}{" +1" if y_next else ""}' if y_end else 'full day'
                print(f'  {date_str}  rahu→{rs_lbl:<13}  abh→{ab_lbl:<13}  yoga→{y_lbl}')

                if not args.dry_run:
                    _update_row(conn, date_str, rs, re_, abs_, abe, y_end, y_next)
                updated += 1
            except Exception as e:
                print(f'  ERROR {date_str}: {e}')
                errors += 1

        if not args.dry_run:
            conn.commit()
        print(f'\n{tag}Done — {updated} updated, {skipped} skipped, {errors} errors')

    except Exception as e:
        conn.rollback()
        print(f'FATAL: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
