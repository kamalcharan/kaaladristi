"""
generate_mercury_windows.py  (v2 — reconciling + event-enriched)

Generate Mercury rule transit windows and store them in km_rule_transits with
the full almanac event fields (migration 146): exact start/end timestamps,
zodiac sign, motion, combust direction, combustion stage, and minimum Sun
separation. Times are refined to ~30-second precision with Swiss Ephemeris
bisection — nothing sub-daily is stored anywhere except on the event rows
themselves.

Rules generated:
  0. TR-MER-RET          — Mercury retrograde windows (motion almanac)
  1. TR-JUP-MER-RET-BUL  — Mercury retrograde ∩ Jupiter retrograde
  2. TR-MER-VEN-RET-BUL  — Mercury retrograde ∩ Venus retrograde
  3. TR-MER-CMB-E-BEA    — Mercury combust windows (v3: HELIACAL VISIBILITY
                           detection — asta→udaya invisibility periods at
                           Ujjain, calibrated against the owner's Drik
                           Panchang almanac; 2026 display windows anchored
                           exactly to the almanac via ALMANAC_OVERRIDES.
                           See scripts/verify_combust_method.py and
                           docs/claude/astro-story.md §6 for why a fixed
                           arc can never reproduce the almanac)
  4. TRN-MER-MAN-TRN     — Mercury sign transit windows (Journey)
  5. TRN-MER-RIS-W-BUL   — Mercury station-direct (rise) — single-day
  6-10. DN-{MON..FRI}-MER-* — Moon in Mercury nakshatra + weekday (day rows)

RECONCILING (v2): before inserting, this script DELETES all existing windows
for these rule_ids in the backfill range, inside the same transaction. Every
run therefore produces exactly the current-ephemeris truth — duplicates from
earlier append-only runs are wiped automatically. SAFE TO RE-RUN ANY TIME.
Scoring columns (matched / nifty_return_pct) are reset by the delete; the
nightly 19:00 confidence job (or POST /api/confidence/compute) re-scores all
NULL-return historical windows on its next pass.

FIXES in v2:
  * Weekday off-by-one in DN-* rules: v1 passed Monday=0 into PostgreSQL's
    EXTRACT(DOW), which is Sunday=0 — so every DN window was stamped one day
    early (DN-MON rows landed on Sundays: e.g. 1990-03-18). v2 maps correctly.
  * Combust windows re-detected from Swiss Ephemeris separation (<14°) instead
    of the km_planetary_positions.combust flag, whose historical orb drifted
    between ephemeris regenerations (root cause of the duplicate windows).

Combustion stages (owner spec 2026-07-10): the combustion arc divided into five
equal bands, a window classified by the DEEPEST separation reached. Arc set to
15° (matches the owner's almanac; see COMBUST_LIMIT_DEG note below), so bands are
3° each: ghora 0-3° · tikshna 3-6° · sankshipta 6-9° · vimishra 9-12° ·
prakruta 12-15°.
Direction: 'east' = Mercury ahead of the Sun in longitude (evening sky),
'west' = behind (morning sky), evaluated at the moment of minimum separation.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_mercury_windows.py

Requires migration 146 (event-field columns) to be applied first.
"""

import os
import sys
import json
import psycopg2
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

import swisseph as swe

# ── Swiss Ephemeris setup (same conventions as generate_ephemeris.py) ─────────

EPHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ephe')
swe.set_ephe_path(EPHE_PATH)
swe.set_sid_mode(swe.SIDM_LAHIRI)
SWE_FLAGS = swe.FLG_SIDEREAL | swe.FLG_SPEED

SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
         'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']

# Daily km_planetary_positions rows were computed at 5.5h UT (11:00 IST) —
# see generate_ephemeris.py — so day-boundary brackets use the same hour.
SAMPLE_HOUR_UT = 5.5

# Combustion arc — used ONLY for combustion-stage band classification now.
# (v2 used it as the window-detection threshold, calibrated to the almanac's
# Jul-2026 row — which coincidentally sits near 15°. The almanac is actually a
# visibility computation with variable implied orbs 9.8°–16.8°; v3 detects
# windows via the heliacal model below. See verify_combust_method.py.)
COMBUST_LIMIT_DEG = 15.0

# ── v3 combust detection: heliacal visibility at Ujjain ───────────────────────
# Calibrated against the owner's Drik Panchang almanac (city = Ujjain,
# confirmed 2026-07-21): sweep best fit is extinction ktot=0.24 + observer
# Snellen ratio 3.25 → 6/13 almanac boundaries exact-day, mean |Δ| ≈ 0.9 d,
# worst 3 d; exact-day matches agree on time-of-day within minutes.
UJJAIN_GEOPOS = [75.7885, 23.1793, 494.0]
CALIB_DATM = [1013.25, 25.0, 40.0, 0.24]        # pressure, temp, RH, extinction
CALIB_DOBS = [36.0, 3.25, 0.0, 0.0, 0.0, 0.0]   # age, Snellen ratio, ...

# swisseph heliacal event types
SE_MORNING_FIRST = 1   # udaya in morning sky (after inferior conjunction)
SE_EVENING_LAST  = 2   # asta in evening sky (before inferior conjunction)
SE_EVENING_FIRST = 3   # udaya in evening sky (after superior conjunction)
SE_MORNING_LAST  = 4   # asta in morning sky (before superior conjunction)

# Exact almanac windows (IST) from the owner's sheet (docs/finastro/mercury.jpg).
# Any model window whose asta lands within ±6 days of one of these is replaced
# by the almanac's exact timestamps, so the product almanac matches the sheet.
ALMANAC_OVERRIDES = [
    ((2026, 1,  4,  6, 32), (2026, 2,  5, 19, 20)),
    ((2026, 2, 28, 19, 33), (2026, 3, 16,  5, 51)),
    ((2026, 5,  2,  5, 30), (2026, 5, 23, 19, 58)),
    ((2026, 7,  2, 20, 14), (2026, 7, 24,  5, 11)),
    ((2026, 8, 18,  5, 37), (2026, 9, 13, 19, 27)),
    ((2026,10, 27, 18, 56), (2026,11, 11,  5, 48)),
    ((2026,12, 15,  6, 21), (2027, 1, 18, 19,  9)),
]
# Stages = the arc split into 5 equal bands, classified by the DEEPEST
# separation reached. At 15° each band is 3°: ghora 0-3 · tikshna 3-6 ·
# sankshipta 6-9 · vimishra 9-12 · prakruta 12-15. (Fractions of the limit, so
# they scale automatically if COMBUST_LIMIT_DEG changes.)
COMBUST_STAGES = [                # (upper-bound fraction of limit, label)
    (0.2, 'ghora'),
    (0.4, 'tikshna'),
    (0.6, 'sankshipta'),
    (0.8, 'vimishra'),
    (1.0, 'prakruta'),
]

BISECT_TOL_DAYS = 1.0 / 2880.0    # 30 seconds


# ── DB connection ──────────────────────────────────────────────────────────────

def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Constants ──────────────────────────────────────────────────────────────────

BACKFILL_FROM = date(1990, 1, 1)
BACKFILL_TO   = date(2030, 12, 31)

# Nakshatras whose lord is Mercury
MERCURY_NAKSHATRAS = ('Ashlesha', 'Jyeshtha', 'Revati')

# Nakshatra-Vara rule codes → weekday (Monday=0 … Friday=4, python convention)
NAKSHATRA_VARA_RULES = {
    'DN-MON-MER-BUL': 0,
    'DN-TUE-MER-BEA': 1,
    'DN-WED-MER-BUL': 2,
    'DN-THU-MER-VOL': 3,
    'DN-FRI-MER-VOL': 4,
}


# ── Swiss Ephemeris helpers ────────────────────────────────────────────────────

def jd_of(d: date, hour_ut: float = SAMPLE_HOUR_UT) -> float:
    return swe.julday(d.year, d.month, d.day, hour_ut)


def jd_to_utc(jd: float) -> datetime:
    return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(days=jd - 2440587.5)


def utc_to_jd(ts: datetime) -> float:
    return 2440587.5 + (ts - datetime(1970, 1, 1, tzinfo=timezone.utc)).total_seconds() / 86400.0


def lon_speed(jd: float, planet: int) -> tuple:
    r = swe.calc_ut(jd, planet, SWE_FLAGS)
    return r[0][0], r[0][3]


def merc_lon(jd: float) -> float:
    return lon_speed(jd, swe.MERCURY)[0]


def planet_speed(jd: float, planet: int) -> float:
    return lon_speed(jd, planet)[1]


def sun_sep(jd: float) -> float:
    """Absolute Sun–Mercury separation in degrees (0..180)."""
    m = merc_lon(jd)
    s = lon_speed(jd, swe.SUN)[0]
    d = abs(m - s) % 360.0
    return min(d, 360.0 - d)


def signed_sun_offset(jd: float) -> float:
    """Signed Mercury−Sun longitude offset in (−180, 180]. >0 = ahead (east)."""
    m = merc_lon(jd)
    s = lon_speed(jd, swe.SUN)[0]
    return ((m - s + 180.0) % 360.0) - 180.0


def bisect_crossing(f, jd_lo: float, jd_hi: float):
    """Find jd in [lo, hi] where f crosses zero. None if no sign change."""
    f_lo, f_hi = f(jd_lo), f(jd_hi)
    if f_lo == 0:
        return jd_lo
    if f_hi == 0:
        return jd_hi
    if (f_lo > 0) == (f_hi > 0):
        return None
    for _ in range(64):
        mid = (jd_lo + jd_hi) / 2.0
        f_mid = f(mid)
        if f_mid == 0:
            return mid
        if (f_mid > 0) == (f_lo > 0):
            jd_lo, f_lo = mid, f_mid
        else:
            jd_hi = mid
        if jd_hi - jd_lo < BISECT_TOL_DAYS:
            break
    return (jd_lo + jd_hi) / 2.0


def station_ts(planet: int, boundary_day: date):
    """Exact moment planet speed crosses zero near boundary_day (±1.5 days)."""
    jd = jd_of(boundary_day)
    x = bisect_crossing(lambda j: planet_speed(j, planet), jd - 1.5, jd + 1.5)
    return jd_to_utc(x) if x is not None else None


def ingress_ts(sign_index: int, boundary_day: date):
    """Exact moment Mercury's sidereal longitude crosses sign_index*30°."""
    boundary = (sign_index * 30.0) % 360.0

    def f(j: float) -> float:
        return ((merc_lon(j) - boundary + 180.0) % 360.0) - 180.0

    jd = jd_of(boundary_day)
    x = bisect_crossing(f, jd - 1.5, jd + 1.5)
    return jd_to_utc(x) if x is not None else None


def next_heliacal(jd: float, ev: int) -> float:
    """Next heliacal event of type ev after jd (calibrated Ujjain model)."""
    return swe.heliacal_ut(jd, UJJAIN_GEOPOS, CALIB_DATM, CALIB_DOBS,
                           'Mercury', ev, swe.HELFLAG_HIGH_PRECISION)[0]


def detect_visibility_windows(jd_lo: float, jd_hi: float) -> list:
    """
    Walk Mercury's visibility cycle from jd_lo, returning invisibility
    (combust) windows as (asta_jd, udaya_jd, kind) with kind
    'superior' (morning-last → evening-first) or
    'inferior' (evening-last → morning-first).

    Edge note: if jd_lo falls INSIDE an invisibility window, that partial
    window is skipped (detection starts at the first asta after jd_lo) —
    same boundary behavior class as the v2 island scan.
    """
    windows = []
    ml = next_heliacal(jd_lo, SE_MORNING_LAST)
    el = next_heliacal(jd_lo, SE_EVENING_LAST)
    while True:
        is_superior = ml <= el
        asta = ml if is_superior else el
        if asta > jd_hi:
            break
        udaya = next_heliacal(
            asta, SE_EVENING_FIRST if is_superior else SE_MORNING_FIRST)
        windows.append((asta, udaya, 'superior' if is_superior else 'inferior'))
        ml = next_heliacal(udaya + 2.0, SE_MORNING_LAST)
        el = next_heliacal(udaya + 2.0, SE_EVENING_LAST)
    return windows


IST = timezone(timedelta(hours=5, minutes=30))


def ist_date_of(ts: datetime) -> date:
    return ts.astimezone(IST).date()


def ist_dt(y, mo, d, h, mi) -> datetime:
    return datetime(y, mo, d, h, mi, tzinfo=IST)


def combust_min_sep(start_d: date, end_d: date) -> tuple:
    """(min separation deg, jd at min) — hourly scan across the window."""
    jd0, jd1 = jd_of(start_d) - 1.0, jd_of(end_d) + 1.0
    best_sep, best_jd = 999.0, jd0
    j = jd0
    while j <= jd1:
        s = sun_sep(j)
        if s < best_sep:
            best_sep, best_jd = s, j
        j += 1.0 / 24.0
    return round(best_sep, 2), best_jd


def combustion_stage(min_sep: float) -> str:
    frac = max(0.0, min(min_sep / COMBUST_LIMIT_DEG, 1.0))
    for upper, label in COMBUST_STAGES:
        if frac <= upper:
            return label
    return 'prakruta'


def sign_at(ts, fallback_day: date) -> str:
    jd = utc_to_jd(ts) if ts is not None else jd_of(fallback_day)
    return SIGNS[int(merc_lon(jd) // 30.0) % 12]


# ── Insert (with event fields) ─────────────────────────────────────────────────

INSERT_SQL = """
INSERT INTO km_rule_transits
  (rule_id, start_date, end_date, conditions_snapshot,
   start_ts, end_ts, sign, motion, direction, combustion_type, sun_sep_min)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (rule_id, start_date) DO NOTHING
"""


def bulk_insert(cur, rows: list) -> tuple:
    inserted = skipped = 0
    for row in rows:
        cur.execute(INSERT_SQL, row)
        if cur.rowcount == 1:
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped


def make_row(rule_id, start_d, end_d, snap: dict, *,
             start_ts=None, end_ts=None, sign=None, motion=None,
             direction=None, combustion_type=None, sun_sep_min=None) -> tuple:
    return (rule_id, start_d, end_d, json.dumps(snap),
            start_ts, end_ts, sign, motion, direction, combustion_type, sun_sep_min)


# ── Window detection from km_planetary_positions (daily flags) ─────────────────

def detect_islands(cur, planet: str, flag_col: str) -> list:
    cur.execute(f"""
        WITH flagged AS (
            SELECT date,
                   date - (ROW_NUMBER() OVER (ORDER BY date))::integer AS grp
            FROM km_planetary_positions
            WHERE planet = %s AND {flag_col} = true
              AND date BETWEEN %s AND %s
        )
        SELECT MIN(date) AS start_date, MAX(date) AS end_date
        FROM flagged
        GROUP BY grp
        ORDER BY start_date
    """, (planet, BACKFILL_FROM, BACKFILL_TO))
    return [{"start_date": r[0], "end_date": r[1]} for r in cur.fetchall()]


def fetch_retrograde_windows(cur, planet: str) -> list:
    return detect_islands(cur, planet, "retrograde")


def windows_overlap(a_start, a_end, b_start, b_end) -> bool:
    return max(a_start, b_start) <= min(a_end, b_end)


PLANET_IDS = {"Mercury": swe.MERCURY, "Venus": swe.VENUS, "Jupiter": swe.JUPITER}


def enrich_retro_windows(windows: list, planet: str) -> None:
    """Attach exact station timestamps to daily-flag retro windows (in place)."""
    pid = PLANET_IDS[planet]
    for w in windows:
        w["start_ts"] = None if w["start_date"] <= BACKFILL_FROM \
            else station_ts(pid, w["start_date"])
        w["end_ts"] = None if w["end_date"] >= BACKFILL_TO \
            else station_ts(pid, w["end_date"] + timedelta(days=1))


# ── Rule 0: Plain Mercury Retrograde (motion almanac) ─────────────────────────

def generate_plain_retrograde(cur, rule_id: int) -> tuple:
    windows = fetch_retrograde_windows(cur, "Mercury")
    enrich_retro_windows(windows, "Mercury")
    rows = []
    for w in windows:
        snap = {"event": "mercury_retrograde", "rule_type": "retrograde"}
        rows.append(make_row(
            rule_id, w["start_date"], w["end_date"], snap,
            start_ts=w["start_ts"], end_ts=w["end_ts"],
            sign=sign_at(w["start_ts"], w["start_date"]),
            motion='retrograde',
        ))
    return bulk_insert(cur, rows)


# ── Rules 1 & 2: Co-retrograde overlaps ────────────────────────────────────────

def generate_retrograde(cur, rule_ids: dict) -> dict:
    merc_windows = fetch_retrograde_windows(cur, "Mercury")
    enrich_retro_windows(merc_windows, "Mercury")
    co_specs = {
        "TR-JUP-MER-RET-BUL": ("Jupiter", fetch_retrograde_windows(cur, "Jupiter")),
        "TR-MER-VEN-RET-BUL": ("Venus",   fetch_retrograde_windows(cur, "Venus")),
    }
    for _, (planet, wins) in co_specs.items():
        enrich_retro_windows(wins, planet)

    results = {code: (0, 0) for code in rule_ids}
    for rule_code, (co_planet, co_windows) in co_specs.items():
        rid = rule_ids.get(rule_code)
        if not rid:
            continue
        rows = []
        for w in merc_windows:
            for c in co_windows:
                if not windows_overlap(w["start_date"], w["end_date"],
                                       c["start_date"], c["end_date"]):
                    continue
                ov_start = max(w["start_date"], c["start_date"])
                ov_end   = min(w["end_date"],   c["end_date"])
                # overlap boundaries = later start-station / earlier end-station
                w_s, c_s = w["start_ts"], c["start_ts"]
                w_e, c_e = w["end_ts"],   c["end_ts"]
                start_ts = max(w_s, c_s) if (w_s and c_s) else None
                end_ts   = min(w_e, c_e) if (w_e and c_e) else None
                snap = {
                    "mercury_retrograde_start": str(w["start_date"]),
                    "mercury_retrograde_end":   str(w["end_date"]),
                    "co_planet": co_planet,
                    "rule_type": "retrograde",
                }
                rows.append(make_row(
                    rid, ov_start, ov_end, snap,
                    start_ts=start_ts, end_ts=end_ts,
                    sign=sign_at(start_ts, ov_start),
                    motion='retrograde',
                ))
        results[rule_code] = bulk_insert(cur, rows)
    return results


# ── Rule 3: Mercury Combust — v3 heliacal visibility (asta → udaya) ───────────

def build_combust_windows() -> list:
    """
    Detect combust windows via the calibrated Ujjain visibility model and
    apply ALMANAC_OVERRIDES (exact sheet timestamps for the display years).
    Returns dicts with start/end dates+ts, kind, and source — no DB needed
    (used by both generation and --dry-run-combust).
    """
    jd_lo = jd_of(BACKFILL_FROM)
    jd_hi = jd_of(BACKFILL_TO)
    overrides = [(ist_dt(*s), ist_dt(*e)) for s, e in ALMANAC_OVERRIDES]

    out = []
    for asta_jd, udaya_jd, kind in detect_visibility_windows(jd_lo, jd_hi):
        asta_ts, udaya_ts = jd_to_utc(asta_jd), jd_to_utc(udaya_jd)
        source = 'heliacal_ujjain'
        for o_start, o_end in overrides:
            if abs((asta_ts - o_start).days) <= 6:
                asta_ts, udaya_ts = o_start, o_end
                source = 'almanac_ujjain'
                break
        out.append({
            "start_date": ist_date_of(asta_ts),
            "end_date":   ist_date_of(udaya_ts),
            "start_ts":   asta_ts,
            "end_ts":     udaya_ts,
            "kind":       kind,
            "source":     source,
        })
    return out


def generate_combust(cur, rule_id: int) -> tuple:
    rows = []
    for w in build_combust_windows():
        min_sep, jd_min = combust_min_sep(w["start_date"], w["end_date"])
        stage = combustion_stage(min_sep)
        direction = 'east' if signed_sun_offset(jd_min) > 0 else 'west'
        snap = {
            "combust_start": str(w["start_date"]),
            "combust_end":   str(w["end_date"]),
            "rule_type": "combust",
            "detect": "visibility_v3",
            "conjunction": w["kind"],
            "combust_source": w["source"],
        }
        rows.append(make_row(
            rule_id, w["start_date"], w["end_date"], snap,
            start_ts=w["start_ts"], end_ts=w["end_ts"],
            sign=sign_at(w["start_ts"], w["start_date"]),
            direction=direction, combustion_type=stage, sun_sep_min=min_sep,
        ))
    return bulk_insert(cur, rows)


# ── Rule 4: Mercury Sign Transits (Journey) ────────────────────────────────────

def generate_sign_transits(cur, rule_id: int) -> tuple:
    cur.execute("""
        WITH sign_changes AS (
            SELECT date, sign_name,
                   LAG(sign_name) OVER (ORDER BY date) AS prev_sign
            FROM km_planetary_positions
            WHERE planet = 'Mercury'
              AND date BETWEEN %s AND %s
        ),
        entries AS (
            SELECT date AS start_date, sign_name,
                   (prev_sign IS NOT NULL) AS has_prev
            FROM sign_changes
            WHERE sign_name IS DISTINCT FROM prev_sign
        )
        SELECT
            e.start_date,
            e.sign_name,
            e.has_prev,
            COALESCE(
                (SELECT MIN(sc2.date) - 1
                 FROM sign_changes sc2
                 WHERE sc2.date > e.start_date
                   AND (sc2.sign_name IS DISTINCT FROM e.sign_name)
                ),
                %s::date
            ) AS end_date
        FROM entries e
        ORDER BY e.start_date
    """, (BACKFILL_FROM, BACKFILL_TO, BACKFILL_TO))

    entries = cur.fetchall()
    ingress_cache = {}

    def ingress_for(start_d: date, sign_name: str):
        if start_d not in ingress_cache:
            try:
                idx = SIGNS.index(sign_name)
            except ValueError:
                ingress_cache[start_d] = None
                return None
            ingress_cache[start_d] = ingress_ts(idx, start_d)
        return ingress_cache[start_d]

    rows = []
    for i, (start_d, sign_name, has_prev, end_d) in enumerate(entries):
        start_ts = ingress_for(start_d, sign_name) if has_prev else None
        end_ts = None
        if i + 1 < len(entries):
            nxt_start, nxt_sign = entries[i + 1][0], entries[i + 1][1]
            end_ts = ingress_for(nxt_start, nxt_sign)
        snap = {"sign": sign_name, "rule_type": "sign_transit"}
        rows.append(make_row(
            rule_id, start_d, end_d, snap,
            start_ts=start_ts, end_ts=end_ts, sign=sign_name,
        ))
    return bulk_insert(cur, rows)


# ── Rule 5: Mercury Station Direct (Rise) — single-day ────────────────────────

def generate_station_direct(cur, rule_id: int) -> tuple:
    cur.execute("""
        WITH retro AS (
            SELECT date, retrograde,
                   LAG(retrograde) OVER (ORDER BY date) AS prev_retro
            FROM km_planetary_positions
            WHERE planet = 'Mercury'
              AND date BETWEEN %s AND %s
        )
        SELECT date AS start_date
        FROM retro
        WHERE retrograde = false AND prev_retro = true
        ORDER BY date
    """, (BACKFILL_FROM, BACKFILL_TO))

    rows = []
    for (start_date,) in cur.fetchall():
        ts = station_ts(swe.MERCURY, start_date)
        jd = utc_to_jd(ts) if ts else jd_of(start_date)
        direction = 'east' if signed_sun_offset(jd) > 0 else 'west'
        snap = {"event": "mercury_station_direct", "rule_type": "manifestation"}
        rows.append(make_row(
            rule_id, start_date, start_date, snap,
            start_ts=ts, end_ts=ts,
            sign=sign_at(ts, start_date),
            motion='direct', direction=direction,
        ))
    return bulk_insert(cur, rows)


# ── Rules 6–10: Mercury Nakshatra-Vara (day rows — no sub-daily times) ─────────

def generate_nakshatra_vara(cur, rule_code: str, rule_id: int, dow: int) -> tuple:
    # NAKSHATRA_VARA_RULES uses Monday=0 … Friday=4; PostgreSQL EXTRACT(DOW)
    # is Sunday=0 … Saturday=6, so Monday=1 … Friday=5 → pass dow + 1.
    # (v1 passed dow directly — the off-by-one that put DN-MON rows on Sundays.)
    cur.execute("""
        SELECT date, nakshatra_name
        FROM km_planetary_positions
        WHERE planet = 'Moon'
          AND nakshatra_name = ANY(%s)
          AND EXTRACT(DOW FROM date)::integer = %s
          AND date BETWEEN %s AND %s
        ORDER BY date
    """, (list(MERCURY_NAKSHATRAS), dow + 1, BACKFILL_FROM, BACKFILL_TO))

    dow_names = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}
    rows = []
    for (d, nakshatra_name) in cur.fetchall():
        snap = {
            "vara": dow_names[dow],
            "nakshatra_lord": "Mercury",
            "moon_nakshatra": nakshatra_name,
            "rule_type": "nakshatra_vara",
        }
        rows.append(make_row(rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:

                all_rule_codes = [
                    "TR-MER-RET",
                    "TR-JUP-MER-RET-BUL",
                    "TR-MER-VEN-RET-BUL",
                    "TR-MER-CMB-E-BEA",
                    "TRN-MER-MAN-TRN",
                    "TRN-MER-RIS-W-BUL",
                    *NAKSHATRA_VARA_RULES.keys(),
                ]

                rule_ids = {}
                missing = []
                for code in all_rule_codes:
                    cur.execute(
                        "SELECT id FROM km_astro_rule_master WHERE rule_code = %s LIMIT 1",
                        (code,),
                    )
                    row = cur.fetchone()
                    if row:
                        rule_ids[code] = row[0]
                    else:
                        missing.append(code)

                if missing:
                    print("\n⚠  Rules not found in km_astro_rule_master — skipping:")
                    for m in missing:
                        print(f"   {m}")

                # ── RECONCILE: wipe this range for these rules, then rebuild ──
                cur.execute(
                    """DELETE FROM km_rule_transits
                       WHERE rule_id = ANY(%s)
                         AND start_date BETWEEN %s AND %s""",
                    (list(rule_ids.values()), BACKFILL_FROM, BACKFILL_TO),
                )
                print(f"\n  Reconcile: deleted {cur.rowcount} existing window(s) "
                      f"for {len(rule_ids)} rule(s) — rebuilding fresh.")

                # ── Generate windows ──────────────────────────────────────────
                summary = {}

                if "TR-MER-RET" in rule_ids:
                    print("  TR-MER-RET …")
                    summary["TR-MER-RET"] = generate_plain_retrograde(
                        cur, rule_ids["TR-MER-RET"])

                retro_ids = {
                    c: rule_ids[c]
                    for c in ("TR-JUP-MER-RET-BUL", "TR-MER-VEN-RET-BUL")
                    if c in rule_ids
                }
                if retro_ids:
                    print("  Co-retrograde rules …")
                    summary.update(generate_retrograde(cur, retro_ids))

                if "TR-MER-CMB-E-BEA" in rule_ids:
                    print("  TR-MER-CMB-E-BEA (Swiss Ephemeris re-detection — ~1 min) …")
                    summary["TR-MER-CMB-E-BEA"] = generate_combust(
                        cur, rule_ids["TR-MER-CMB-E-BEA"])

                if "TRN-MER-MAN-TRN" in rule_ids:
                    print("  TRN-MER-MAN-TRN …")
                    summary["TRN-MER-MAN-TRN"] = generate_sign_transits(
                        cur, rule_ids["TRN-MER-MAN-TRN"])

                if "TRN-MER-RIS-W-BUL" in rule_ids:
                    print("  TRN-MER-RIS-W-BUL …")
                    summary["TRN-MER-RIS-W-BUL"] = generate_station_direct(
                        cur, rule_ids["TRN-MER-RIS-W-BUL"])

                for code, dow in NAKSHATRA_VARA_RULES.items():
                    if code in rule_ids:
                        summary[code] = generate_nakshatra_vara(
                            cur, code, rule_ids[code], dow)

        # ── Print summary ─────────────────────────────────────────────────────
        print()
        print(f"  {'Rule':<30}  {'Inserted':>8}  {'Skipped':>8}")
        print(f"  {'─' * 30}  {'─' * 8}  {'─' * 8}")
        total_ins = total_skp = 0
        for code in all_rule_codes:
            ins, skp = summary.get(code, (0, 0))
            total_ins += ins
            total_skp += skp
            status = "⚠  not found" if code not in rule_ids else ""
            print(f"  {code:<30}  {ins:>8}  {skp:>8}  {status}")
        print(f"  {'─' * 30}  {'─' * 8}  {'─' * 8}")
        print(f"  {'TOTAL':<30}  {total_ins:>8}  {total_skp:>8}")
        print(f"  Date range: {BACKFILL_FROM} to {BACKFILL_TO}")
        print("\n  NOTE: matched/nifty_return_pct were reset by the reconcile —")
        print("  run POST /api/confidence/compute (or wait for the 19:00 job)")
        print("  to re-score all historical windows.\n")

    finally:
        conn.close()


def dry_run_combust(year_from: int, year_to: int):
    """Print v3 combust windows for a year range — no DB connection needed."""
    global BACKFILL_FROM, BACKFILL_TO
    BACKFILL_FROM = date(year_from, 1, 1)
    BACKFILL_TO = date(year_to, 12, 31)
    print(f"  v3 combust windows (visibility model, Ujjain) "
          f"{year_from}–{year_to}:\n")
    print(f"  {'start':<18} {'end':<18} {'days':>5}  {'kind':<9} {'source'}")
    for w in build_combust_windows():
        days = (w['end_date'] - w['start_date']).days
        s = w['start_ts'].astimezone(IST).strftime('%d-%b-%y %H:%M')
        e = w['end_ts'].astimezone(IST).strftime('%d-%b-%y %H:%M')
        print(f"  {s:<18} {e:<18} {days:>5}  {w['kind']:<9} {w['source']}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--dry-run-combust':
        y0 = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
        y1 = int(sys.argv[3]) if len(sys.argv) > 3 else 2027
        dry_run_combust(y0, y1)
    else:
        main()
