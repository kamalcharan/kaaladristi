"""
populate_panchang_end_times.py
==============================
Computes tithi_end_ist, nakshatra_end_ist and the corresponding next-day
boolean flags for rows in km_daily_panchang.

Prerequisites:
  - Run migration 018 (adds tithi_end_ist, nakshatra_end_ist TIME columns)
  - Run migration 019 (adds tithi_end_next_day, nakshatra_end_next_day BOOLEAN)

How it works:
  - Tithi     = floor((moon_long - sun_long) / 12°)
  - Nakshatra = floor(moon_long / 13°20')
  - Binary search finds the exact second of change in a 24h window from sunrise.
  - If the change crosses midnight IST (JD >= JD of 00:00 IST next day),
    the *_end_next_day flag is set TRUE so the frontend shows "+1".

Usage (from App/backend):
    python populate_panchang_end_times.py            # backfill NULLs
    python populate_panchang_end_times.py --date 2026-04-09
    python populate_panchang_end_times.py --all      # recompute everything
    python populate_panchang_end_times.py --dry-run  # preview only
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(script_dir, '..', '.env'))

import swisseph as swe
from lib.config import DATABASE_URL

# ── Ephemeris ──────────────────────────────────────────────────────────────────

swe.set_ephe_path(os.path.join(script_dir, 'ephe'))
swe.set_sid_mode(swe.SIDM_LAHIRI)

NAKSHATRA_SIZE = 360.0 / 27
SECOND_IN_JD   = 1.0 / 86400

# ── Astronomical helpers ───────────────────────────────────────────────────────

def _moon_long(jd):
    return swe.calc_ut(jd, swe.MOON, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def _sun_long(jd):
    return swe.calc_ut(jd, swe.SUN, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def _tithi_num(jd):
    return int((_moon_long(jd) - _sun_long(jd)) % 360 / 12)

def _nakshatra_num(jd):
    return int(_moon_long(jd) / NAKSHATRA_SIZE)

def _find_change(jd_start, jd_end, val_start, num_func):
    """Binary search: return JD when num_func first differs from val_start, or None."""
    if num_func(jd_end) == val_start:
        return None
    lo, hi = jd_start, jd_end
    while (hi - lo) > SECOND_IN_JD:
        mid = (lo + hi) / 2
        if num_func(mid) == val_start:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

def _jd_to_ist(jd):
    """JD → IST time string HH:MM:SS (always returns the clock face time)."""
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
    """True if the IST calendar date of jd_change is the day after date_str."""
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

# ── Core computation ───────────────────────────────────────────────────────────

def compute_end_times(date_str, sunrise_ist):
    """
    Returns (tithi_end_ist, tithi_next_day, nakshatra_end_ist, nakshatra_next_day).
    Times are HH:MM:SS strings or None. next_day booleans indicate the change
    falls past midnight IST (i.e. on the following calendar date).
    """
    jd_start = _sunrise_to_jd(date_str, sunrise_ist)
    jd_end   = jd_start + 1.25     # 30h — nakshatras can extend ~26h past sunrise

    t0 = _tithi_num(jd_start)
    n0 = _nakshatra_num(jd_start)

    jd_t = _find_change(jd_start, jd_end, t0, _tithi_num)
    jd_n = _find_change(jd_start, jd_end, n0, _nakshatra_num)

    t_end      = _jd_to_ist(jd_t) if jd_t else None
    t_next_day = _is_next_day(jd_t, date_str) if jd_t else False

    n_end      = _jd_to_ist(jd_n) if jd_n else None
    n_next_day = _is_next_day(jd_n, date_str) if jd_n else False

    return t_end, t_next_day, n_end, n_next_day

# ── DB helpers ─────────────────────────────────────────────────────────────────

def _fetch_rows(conn, date_str, force_all):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if date_str:
            cur.execute(
                "SELECT date, sunrise_ist FROM km_daily_panchang WHERE date = %s",
                (date_str,)
            )
        elif force_all:
            cur.execute("SELECT date, sunrise_ist FROM km_daily_panchang ORDER BY date")
        else:
            cur.execute(
                "SELECT date, sunrise_ist FROM km_daily_panchang "
                "WHERE tithi_end_ist IS NULL ORDER BY date"
            )
        return [dict(r) for r in cur.fetchall()]

def _update_row(conn, date_str, t_end, t_next, n_end, n_next):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE km_daily_panchang "
            "SET tithi_end_ist = %s, tithi_end_next_day = %s, "
            "    nakshatra_end_ist = %s, nakshatra_end_next_day = %s "
            "WHERE date = %s",
            (t_end, t_next, n_end, n_next, date_str)
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
            if not sunrise:
                print(f'  SKIP  {date_str} — no sunrise_ist')
                skipped += 1
                continue
            try:
                t_end, t_next, n_end, n_next = compute_end_times(date_str, str(sunrise))
                t_lbl = f"{t_end}{' +1' if t_next else ''}" if t_end else 'full day'
                n_lbl = f"{n_end}{' +1' if n_next else ''}" if n_end else 'full day'
                print(f'  {date_str}  tithi→{t_lbl:<16}  nakshatra→{n_lbl}')
                if not args.dry_run:
                    _update_row(conn, date_str, t_end, t_next, n_end, n_next)
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
