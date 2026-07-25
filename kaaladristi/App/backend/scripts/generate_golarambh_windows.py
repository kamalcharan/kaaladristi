"""
generate_golarambh_windows.py

Generate Golārambha (hemisphere-entry) rule windows and store them in
km_rule_transits with the almanac event fields (migration 146). Same
reconciling pattern as generate_mercury_windows.py v2 — SAFE TO RE-RUN.

Rules generated (migration 166):
  1. TR-SUN-UGOLA-BUL     — Uttara Gola range: March equinox → September equinox
  2. TR-SUN-DGOLA-BEA     — Dakshina Gola range: September equinox → March equinox
  3. TRN-SUN-UGOLARM-TRN  — Basanta Golārambha turn window (March equinox ±1 day)
  4. TRN-SUN-DGOLARM-TRN  — Dakshina Golārambha turn window (September equinox ±1 day)

IMPORTANT — TROPICAL, not sidereal. A golārambha is the Sun crossing the
CELESTIAL EQUATOR (declination zero = tropical longitude 0°/180°). This is an
astronomical event independent of ayanamsha — the sidereal Mesha/Tula
sankranti in km_daily_panchang lands ~24-25 days later and is a DIFFERENT
event (see CLAUDE.md gola/ayana note). So unlike every other generator in this
folder, Swiss Ephemeris here runs WITHOUT FLG_SIDEREAL.

Event-field usage on the rows:
  - Gola ranges:  start_ts/end_ts = exact entry/exit equinox instants,
                  direction = 'north' (Uttara) / 'south' (Dakshina).
  - Turn windows: start_date/end_date = equinox IST date ±1 calendar day,
                  start_ts = end_ts = the exact equinox instant,
                  direction as above.
  - sign is left NULL: the platform's sign vocabulary is sidereal and the
    tropical Aries/Libra ingress would mislabel as Mesha/Tula.

The equinox instants were cross-checked against the published astronomical
table (2016-2036) at build time — run with --dry-run to print them (IST)
without touching the DB.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_golarambh_windows.py
  python3 generate_golarambh_windows.py --dry-run [year_from] [year_to]

After generating, refresh evidence + confidence:
  DB_PRIMARY=... python3 compute_rule_evidence.py
  (confidence: POST /api/confidence/compute or the nightly 19:00 job)
"""

import os
import sys
import json
import psycopg2
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

import swisseph as swe

# ── Swiss Ephemeris setup — TROPICAL (see module docstring) ───────────────────

EPHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ephe')
swe.set_ephe_path(EPHE_PATH)
SWE_FLAGS = swe.FLG_SPEED          # NO FLG_SIDEREAL — equinoxes are tropical

BACKFILL_FROM = date(1990, 1, 1)
BACKFILL_TO   = date(2030, 12, 31)

IST = timezone(timedelta(hours=5, minutes=30))
BISECT_TOL_DAYS = 1.0 / 2880.0     # 30 seconds

RULE_UGOLA  = 'TR-SUN-UGOLA-BUL'
RULE_DGOLA  = 'TR-SUN-DGOLA-BEA'
RULE_UWIN   = 'TRN-SUN-UGOLARM-TRN'
RULE_DWIN   = 'TRN-SUN-DGOLARM-TRN'
ALL_RULE_CODES = [RULE_UGOLA, RULE_DGOLA, RULE_UWIN, RULE_DWIN]


# ── Time helpers (same conventions as generate_mercury_windows.py) ────────────

def jd_of(d: date, hour_ut: float = 0.0) -> float:
    return swe.julday(d.year, d.month, d.day, hour_ut)


def jd_to_utc(jd: float) -> datetime:
    return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(days=jd - 2440587.5)


def ist_date_of(ts: datetime) -> date:
    return ts.astimezone(IST).date()


# ── Equinox detection ──────────────────────────────────────────────────────────

def sun_tropical_lon(jd: float) -> float:
    return swe.calc_ut(jd, swe.SUN, SWE_FLAGS)[0][0]


def _lon_diff(jd: float, target: float) -> float:
    """Signed distance of the Sun's tropical longitude from target, (−180,180]."""
    return ((sun_tropical_lon(jd) - target + 180.0) % 360.0) - 180.0


def find_equinox(year: int, month: int, target_lon: float) -> datetime:
    """
    Exact UTC instant the Sun's tropical longitude crosses target_lon
    (0° = March equinox, 180° = September equinox). The crossing always falls
    on the 19th-25th of the month; a ±6-day bracket around the 21st is safe
    for 1990-2031 and the Sun's ~1°/day motion makes _lon_diff monotonic
    across it.
    """
    jd_lo = jd_of(date(year, month, 15))
    jd_hi = jd_of(date(year, month, 28))
    f_lo = _lon_diff(jd_lo, target_lon)
    f_hi = _lon_diff(jd_hi, target_lon)
    if (f_lo > 0) == (f_hi > 0):
        raise RuntimeError(f'No equinox crossing bracketed in {year}-{month:02d}')
    for _ in range(64):
        mid = (jd_lo + jd_hi) / 2.0
        f_mid = _lon_diff(mid, target_lon)
        if (f_mid > 0) == (f_lo > 0):
            jd_lo, f_lo = mid, f_mid
        else:
            jd_hi = mid
        if jd_hi - jd_lo < BISECT_TOL_DAYS:
            break
    return jd_to_utc((jd_lo + jd_hi) / 2.0)


def compute_equinoxes(year_from: int, year_to: int) -> list:
    """[(year, march_ts_utc, september_ts_utc)] for year_from..year_to."""
    out = []
    for y in range(year_from, year_to + 1):
        out.append((y, find_equinox(y, 3, 0.0), find_equinox(y, 9, 180.0)))
    return out


# ── Row building ───────────────────────────────────────────────────────────────

INSERT_SQL = """
INSERT INTO km_rule_transits
  (rule_id, start_date, end_date, conditions_snapshot,
   start_ts, end_ts, sign, motion, direction, combustion_type, sun_sep_min)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (rule_id, start_date) DO NOTHING
"""


def make_row(rule_id, start_d, end_d, snap: dict, *,
             start_ts=None, end_ts=None, direction=None) -> tuple:
    return (rule_id, start_d, end_d, json.dumps(snap),
            start_ts, end_ts, None, None, direction, None, None)


def build_rows(rule_ids: dict) -> dict:
    """rule_code → [rows]. Needs one extra year of crossings so the last
    Dakshina Gola inside the backfill can close at the NEXT March equinox."""
    eqx = compute_equinoxes(BACKFILL_FROM.year, BACKFILL_TO.year + 1)
    rows = {code: [] for code in ALL_RULE_CODES}

    for i, (year, mar_ts, sep_ts) in enumerate(eqx):
        mar_d, sep_d = ist_date_of(mar_ts), ist_date_of(sep_ts)

        # ── Turn windows (equinox ±1 day) — only inside the backfill range ──
        if BACKFILL_FROM <= mar_d <= BACKFILL_TO:
            snap = {'event': 'basanta_golarambha', 'gola': 'uttara',
                    'equinox_ist': mar_ts.astimezone(IST).isoformat()}
            rows[RULE_UWIN].append(make_row(
                rule_ids[RULE_UWIN],
                mar_d - timedelta(days=1), mar_d + timedelta(days=1), snap,
                start_ts=mar_ts, end_ts=mar_ts, direction='north'))
        if BACKFILL_FROM <= sep_d <= BACKFILL_TO:
            snap = {'event': 'dakshina_golarambha', 'gola': 'dakshina',
                    'equinox_ist': sep_ts.astimezone(IST).isoformat()}
            rows[RULE_DWIN].append(make_row(
                rule_ids[RULE_DWIN],
                sep_d - timedelta(days=1), sep_d + timedelta(days=1), snap,
                start_ts=sep_ts, end_ts=sep_ts, direction='south'))

        # ── Uttara Gola: this March equinox → this September equinox ────────
        if mar_d >= BACKFILL_FROM and sep_d <= BACKFILL_TO + timedelta(days=1):
            snap = {'event': 'uttara_gola', 'gola': 'uttara',
                    'entry_ist': mar_ts.astimezone(IST).isoformat(),
                    'exit_ist': sep_ts.astimezone(IST).isoformat()}
            rows[RULE_UGOLA].append(make_row(
                rule_ids[RULE_UGOLA],
                mar_d, sep_d - timedelta(days=1), snap,
                start_ts=mar_ts, end_ts=sep_ts, direction='north'))

        # ── Dakshina Gola: this September equinox → NEXT March equinox ──────
        if i + 1 < len(eqx):
            next_mar_ts = eqx[i + 1][1]
            next_mar_d = ist_date_of(next_mar_ts)
            if sep_d >= BACKFILL_FROM and next_mar_d <= BACKFILL_TO + timedelta(days=1):
                snap = {'event': 'dakshina_gola', 'gola': 'dakshina',
                        'entry_ist': sep_ts.astimezone(IST).isoformat(),
                        'exit_ist': next_mar_ts.astimezone(IST).isoformat()}
                rows[RULE_DGOLA].append(make_row(
                    rule_ids[RULE_DGOLA],
                    sep_d, next_mar_d - timedelta(days=1), snap,
                    start_ts=sep_ts, end_ts=next_mar_ts, direction='south'))

    return rows


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
    try:
        with conn:
            with conn.cursor() as cur:
                rule_ids, missing = {}, []
                for code in ALL_RULE_CODES:
                    cur.execute(
                        'SELECT id FROM km_astro_rule_master WHERE rule_code = %s LIMIT 1',
                        (code,))
                    row = cur.fetchone()
                    if row:
                        rule_ids[code] = row[0]
                    else:
                        missing.append(code)
                if missing:
                    print('\n⚠  Rules not found in km_astro_rule_master — run '
                          'migration 166 first. Missing:')
                    for m in missing:
                        print(f'   {m}')
                if not rule_ids:
                    return

                # RECONCILE: wipe this range for these rules, rebuild fresh.
                cur.execute(
                    """DELETE FROM km_rule_transits
                       WHERE rule_id = ANY(%s)
                         AND start_date BETWEEN %s AND %s""",
                    (list(rule_ids.values()),
                     BACKFILL_FROM - timedelta(days=1), BACKFILL_TO))
                print(f'\n  Reconcile: deleted {cur.rowcount} existing window(s) '
                      f'for {len(rule_ids)} rule(s) — rebuilding fresh.')

                all_rows = build_rows(rule_ids)
                print(f"\n  {'Rule':<22}  {'Inserted':>8}")
                print(f"  {'─' * 22}  {'─' * 8}")
                total = 0
                for code in ALL_RULE_CODES:
                    if code not in rule_ids:
                        print(f'  {code:<22}  {"—":>8}  ⚠ not found')
                        continue
                    n = 0
                    for row in all_rows[code]:
                        cur.execute(INSERT_SQL, row)
                        n += cur.rowcount
                    total += n
                    print(f'  {code:<22}  {n:>8}')
                print(f"  {'─' * 22}  {'─' * 8}")
                print(f'  {"TOTAL":<22}  {total:>8}')
                print(f'  Date range: {BACKFILL_FROM} to {BACKFILL_TO}')
                print('\n  Next: python3 compute_rule_evidence.py, then')
                print('  POST /api/confidence/compute (or the nightly 19:00 job).\n')
    finally:
        conn.close()


def dry_run(year_from: int, year_to: int):
    """Print equinox instants (UTC + IST) — validate against the published
    astronomical table without touching the DB."""
    print(f'  Golārambha instants {year_from}–{year_to} (tropical crossings):\n')
    print(f'  {"year":<6} {"Basanta (Mar) UTC":<20} {"IST":<18} '
          f'{"Dakshina (Sep) UTC":<20} {"IST":<18}')
    for y, mar_ts, sep_ts in compute_equinoxes(year_from, year_to):
        print(f'  {y:<6} '
              f'{mar_ts.strftime("%d %b %H:%M"):<20} '
              f'{mar_ts.astimezone(IST).strftime("%d %b %H:%M"):<18} '
              f'{sep_ts.strftime("%d %b %H:%M"):<20} '
              f'{sep_ts.astimezone(IST).strftime("%d %b %H:%M"):<18}')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--dry-run':
        y0 = int(sys.argv[2]) if len(sys.argv) > 2 else 2016
        y1 = int(sys.argv[3]) if len(sys.argv) > 3 else 2036
        dry_run(y0, y1)
    else:
        main()
