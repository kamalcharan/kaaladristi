"""
populate_panchang_end_times.py
==============================
Computes tithi_end_ist and nakshatra_end_ist for rows in km_daily_panchang
using pyswisseph and writes them back to the database.

How it works:
  - Tithi  = floor((moon_long - sun_long) / 12°).  Changes when moon-sun angle
              crosses the next multiple of 12°.
  - Nakshatra = floor(moon_long / 13°20'). Changes when Moon crosses the
                next nakshatra boundary.
  - Binary search finds the exact second of change within a 24-hour window
    starting at sunrise IST for that date.
  - If the change happens past midnight (next calendar day) the time is stored
    as-is in HH:MM:SS — the frontend resolves it as "+1 day" because the
    stored time is before sunrise.

Usage:
    cd App/backend

    # Apply migration 018 first (adds the columns):
    python3 apply_migration_018.py

    # Backfill all NULL rows:
    python3 populate_panchang_end_times.py

    # Single date:
    python3 populate_panchang_end_times.py --date 2026-04-09

    # Recompute all rows (overwrite existing):
    python3 populate_panchang_end_times.py --all

    # Preview without writing:
    python3 populate_panchang_end_times.py --dry-run
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(script_dir, '..', '.env'))

import swisseph as swe
from lib.config import DATABASE_URL

# ── Ephemeris setup ────────────────────────────────────────────────────────────

EPHE_PATH = os.path.join(script_dir, 'ephe')
swe.set_ephe_path(EPHE_PATH)
swe.set_sid_mode(swe.SIDM_LAHIRI)

NAKSHATRA_SIZE = 360.0 / 27   # 13°20' per nakshatra
SECOND_IN_JD   = 1.0 / 86400  # 1 second expressed as fraction of a Julian Day

# ── Astronomical helpers ───────────────────────────────────────────────────────

def _moon_long(jd: float) -> float:
    return swe.calc_ut(jd, swe.MOON, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def _sun_long(jd: float) -> float:
    return swe.calc_ut(jd, swe.SUN, swe.FLG_SIDEREAL | swe.FLG_SPEED)[0][0]

def _tithi_num(jd: float) -> int:
    diff = (_moon_long(jd) - _sun_long(jd)) % 360
    return int(diff / 12)

def _nakshatra_num(jd: float) -> int:
    return int(_moon_long(jd) / NAKSHATRA_SIZE)

def _find_change(jd_start: float, jd_end: float, val_start: int, num_func) -> float | None:
    """
    Binary search for the JD when num_func first returns a value != val_start.
    Returns None if no change occurs in [jd_start, jd_end].
    """
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


def _jd_to_ist(jd: float) -> str:
    """Convert Julian Day to IST time string HH:MM:SS (may be > 24h = next day)."""
    _, _, _, utc_h = swe.revjul(jd)
    ist_h = utc_h + 5.5
    if ist_h >= 24:
        ist_h -= 24
    h = int(ist_h)
    m_frac = (ist_h - h) * 60
    m = int(m_frac)
    s = int((m_frac - m) * 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _sunrise_to_jd(date_str: str, sunrise_ist: str) -> float:
    """Convert a date + IST sunrise time to Julian Day (UTC)."""
    from datetime import datetime, timedelta
    parts = sunrise_ist.split(':')
    h, m, s = int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
    ist_hours = h + m / 60 + s / 3600
    utc_hours = ist_hours - 5.5    # IST → UTC

    d = datetime.strptime(date_str, '%Y-%m-%d')
    if utc_hours < 0:
        d -= timedelta(days=1)
        utc_hours += 24

    return swe.julday(d.year, d.month, d.day, utc_hours)


# ── Core computation ───────────────────────────────────────────────────────────

def compute_end_times(date_str: str, sunrise_ist: str) -> tuple[str | None, str | None]:
    """
    Compute tithi and nakshatra end times for the given date.
    Searches a 24-hour window from sunrise.
    Returns (tithi_end_ist, nakshatra_end_ist) as 'HH:MM:SS' or None.
    """
    jd_start = _sunrise_to_jd(date_str, sunrise_ist)
    jd_end   = jd_start + 1.0      # 24h search window

    t0 = _tithi_num(jd_start)
    n0 = _nakshatra_num(jd_start)

    jd_t = _find_change(jd_start, jd_end, t0, _tithi_num)
    jd_n = _find_change(jd_start, jd_end, n0, _nakshatra_num)

    return (
        _jd_to_ist(jd_t) if jd_t else None,
        _jd_to_ist(jd_n) if jd_n else None,
    )


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(DATABASE_URL)


def _fetch_rows(conn, date_str: str | None, force_all: bool) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if date_str:
            cur.execute(
                "SELECT date, sunrise_ist FROM km_daily_panchang WHERE date = %s",
                (date_str,)
            )
        elif force_all:
            cur.execute(
                "SELECT date, sunrise_ist FROM km_daily_panchang ORDER BY date"
            )
        else:
            cur.execute(
                "SELECT date, sunrise_ist FROM km_daily_panchang "
                "WHERE tithi_end_ist IS NULL ORDER BY date"
            )
        return [dict(r) for r in cur.fetchall()]


def _update_row(conn, date_str: str, tithi_end: str | None, nak_end: str | None):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE km_daily_panchang "
            "SET tithi_end_ist = %s, nakshatra_end_ist = %s "
            "WHERE date = %s",
            (tithi_end, nak_end, date_str)
        )


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Populate panchang change times')
    parser.add_argument('--date',    help='Single date YYYY-MM-DD')
    parser.add_argument('--all',     action='store_true', help='Reprocess all rows (not just NULLs)')
    parser.add_argument('--dry-run', action='store_true', help='Print results without writing')
    args = parser.parse_args()

    if not DATABASE_URL:
        print('ERROR: DATABASE_URL not set — check App/.env')
        sys.exit(1)

    conn = _get_conn()

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
                t_end, n_end = compute_end_times(date_str, str(sunrise))

                t_label = t_end or 'spans full day'
                n_label = n_end or 'spans full day'
                print(f'  {date_str}  tithi→{t_label:<12}  nakshatra→{n_label}')

                if not args.dry_run:
                    _update_row(conn, date_str, t_end, n_end)

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
