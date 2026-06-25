import os
import sys
import psycopg2
import json
from datetime import date, timedelta
from typing import Optional
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)

def strength_from_probability(prob: Optional[str]) -> int:
    return {'Very High':5,'High':4,'Reasonable':3,'Low':2}.get(prob, 3)

def insert_signal(cur, date, rule_id, signal, strength, details, snapshot):
    cur.execute("""
        INSERT INTO km_rule_signals
          (date, rule_id, signal, strength, details, conditions_snapshot)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (date, rule_id) DO NOTHING
    """, (date, rule_id, signal, strength, details, json.dumps(snapshot)))


def load_vocabulary(conn):
    """Load all vocabulary from master tables at startup"""
    cur = conn.cursor()

    # Load nakshatras — use positions_name as canonical
    cur.execute("""
        SELECT name, positions_name
        FROM km_nakshatras
        ORDER BY id
    """)
    rows = cur.fetchall()
    # positions_name is what km_planetary_positions uses
    NAKSHATRA_POSITIONS_NAMES = [r[1] for r in rows]
    # master_name → positions_name mapping
    NAKSHATRA_NAME_MAP = {r[0]: r[1] for r in rows}
    # positions_name → master_name mapping
    NAKSHATRA_REVERSE_MAP = {r[1]: r[0] for r in rows}

    # Load planets
    cur.execute("SELECT name FROM km_planets ORDER BY id")
    PLANET_NAMES = [r[0] for r in cur.fetchall()]

    # Load yoga names from km_daily_panchang
    cur.execute("""
        SELECT DISTINCT yoga_name FROM km_daily_panchang
        WHERE yoga_name IS NOT NULL ORDER BY 1
    """)
    YOGA_NAMES = [r[0] for r in cur.fetchall()]

    # Load nakshatra lords — positions_name → lord planet name
    cur.execute("""
        SELECT n.id, n.positions_name, p.name as lord
        FROM km_nakshatras n
        JOIN km_nakshatra_lords nl ON nl.nakshatra_id = n.id
        JOIN km_planets p ON p.id = nl.planet_id
        ORDER BY n.id
    """)
    nak_lord_rows = cur.fetchall()
    NAKSHATRA_LORD_MAP = {r[1]: r[2] for r in nak_lord_rows}  # positions_name → lord
    NAKSHATRA_BY_ID    = {r[0]: r[1] for r in nak_lord_rows}  # id → positions_name

    return {
        'nakshatra_positions_names': NAKSHATRA_POSITIONS_NAMES,
        'nakshatra_name_map': NAKSHATRA_NAME_MAP,
        'nakshatra_reverse_map': NAKSHATRA_REVERSE_MAP,
        'planet_names': PLANET_NAMES,
        'yoga_names': YOGA_NAMES,
        'nakshatra_lord_map': NAKSHATRA_LORD_MAP,
        'nakshatra_by_id': NAKSHATRA_BY_ID,
    }


def build_vedh_map(nakshatra_positions_names):
    """
    Vedh = nakshatra that is exactly opposite (14 positions away in 27-nakshatra cycle).
    Nakshatra pairs (1-indexed): nak N does vedh of nak N+13 (mod 27).
    Built using positions_name values from km_nakshatras master table.
    """
    naks = nakshatra_positions_names  # list of 27 names in order
    vedh_map = {}
    for i, nak in enumerate(naks):
        opposite_idx = (i + 13) % 27
        vedh_map[nak] = naks[opposite_idx]
        vedh_map[naks[opposite_idx]] = nak
    return vedh_map


def get_panchak_nakshatras(nakshatra_positions_names):
    """Panchak = last 5 nakshatras (23-27): indices 22-26 in positions_name order."""
    return set(nakshatra_positions_names[22:27])


# ── Transit grouping ──────────────────────────────────────────────────────────

# Rule types whose signals should be grouped into contiguous transit periods
TRANSIT_GROUPED_TYPES: frozenset = frozenset({
    'planet_transit', 'planet_state', 'vedh', 'planet_conjunction', 'planet_manifestation',
})
# Rule types that remain as individual daily signals (no transit grouping)
DAILY_ONLY_TYPES: frozenset = frozenset({
    'nakshatra_vara', 'tithi_alone', 'eclipse', 'seasonal',
})


def should_group_transits(rule) -> bool:
    """Return True if consecutive signals for this rule should be grouped into transits."""
    rt = rule['rule_type']
    if rt in TRANSIT_GROUPED_TYPES:
        return True
    # compound rules that represent a planet in a sign are also transit-like
    if rt == 'compound' and 'sign' in (rule.get('conditions') or {}):
        return True
    return False


def detect_transits(conn, rule, dates_with_snapshots: list) -> list:
    """
    Group consecutive signal dates (gap ≤ 4 calendar days) into transit periods.
    Gap ≤ 4 covers Friday→Monday and single-day public holidays without false splits.
    Returns list of dicts: {start_date, end_date, conditions_snapshot}.
    """
    if not dates_with_snapshots:
        return []

    sorted_rows = sorted(dates_with_snapshots, key=lambda x: x[0])
    transits = []

    start_date, snapshot = sorted_rows[0][0], sorted_rows[0][1]
    end_date = start_date

    for d, snap in sorted_rows[1:]:
        gap = (d - end_date).days
        if gap <= 4:
            end_date = d
        else:
            transits.append({'start_date': start_date, 'end_date': end_date,
                              'conditions_snapshot': snapshot})
            start_date, end_date, snapshot = d, d, snap

    transits.append({'start_date': start_date, 'end_date': end_date,
                     'conditions_snapshot': snapshot})
    return transits


def insert_transits(conn, rule, transits: list) -> int:
    """Insert detected transits into km_rule_transits. Returns count inserted."""
    if not transits:
        return 0
    from psycopg2.extras import execute_values
    data = [
        (rule['id'], t['start_date'], t['end_date'], json.dumps(t['conditions_snapshot']))
        for t in transits
    ]
    cur = conn.cursor()
    execute_values(cur,
        "INSERT INTO km_rule_transits (rule_id, start_date, end_date, conditions_snapshot) "
        "VALUES %s ON CONFLICT (rule_id, start_date) DO NOTHING",
        data)
    return cur.rowcount


# ── Phase 2 rules — not yet implemented ────────────────────────────────────────
# These rule codes exist in km_astro_rule_master (data_source='available') but
# require computation logic not yet built.  They return [] without error.
# When implementing a group, remove its codes from this set.
NOT_IMPLEMENTED_RULE_CODES: frozenset = frozenset({
    # Tithi kshay / vriddhi — needs consecutive-day tithi comparison
    'TTH-KSH-SP-BEA', 'TTH-SEK-BUL', 'TTH-VKK-BUL', 'VOL-KSH-SP-BEA',
    # Paap Kartari — malefic flanking position logic not built
    'YOG-JPK-BEA', 'YOG-MPK-MS-BEA', 'YOG-MPK-RS-BEA',
    # Lunar apogee / perigee / phase events — source from km_astro_calendar
    'VOL-APO-VOL', 'VOL-BHA-VOL', 'VOL-PER-BEA', 'VOL-PRD-VOL', 'VOL-TOT-TRN',
    # Seasonal calendar patterns — custom logic not built
    'SEA-3SAT-SP-BUL', 'SEA-ASE-FRI-BUL',
    # Eindra Yog inside Panchak — combined panchak + specific yoga
    'YOG-EIN-PNK-BUL',
    # Vedh with vedh_by condition (planet IS vedhed by another) — not handled
    'VDH-JUP-PUS-BUL', 'VDH-RAH-ABH-BUL',
    # Mercury Manifestation (emergence from combust zone) — not built
    'TRN-MER-MAN-TRN',
})
# Notes on other Phase 2 groups (already return [] from existing type handlers):
#   D9 navamsa rules (TR-UFN-*, VOL-MRS-PD9-BEA, VOL-MOO-MER-D9-VOL)
#     → detected by d9_sign / d9_sign_in conditions keys in planet_transit handler
#   Heliacal rise rules (TRN-VEN-RIS-*, TRN-MER-RIS-*)
#     → planet_manifestation type without mercury_position → return []

# Vara names used by km_daily_panchang that correspond to weekend days
_WEEKEND_VARAS: frozenset = frozenset({'Ravi', 'Shani'})  # Sunday, Saturday

# km_daily_panchang stores Sanskrit vara names. Rule conditions may use English.
_VARA_EN_TO_SK: dict = {
    'Sunday':    'Ravi',
    'Monday':    'Soma',
    'Tuesday':   'Mangal',
    'Wednesday': 'Budha',
    'Thursday':  'Guru',
    'Friday':    'Shukra',
    'Saturday':  'Shani',
}


def _normalize_vara(vara: str | None) -> str | None:
    """Translate English day name to Sanskrit vara name if needed."""
    if vara is None:
        return None
    return _VARA_EN_TO_SK.get(vara, vara)

_PANCHANG_SCHEMA_PRINTED = False  # print distinct-value snapshot only once per run


def _panchang_diagnostics(conn, rule_code, schema, vara_val, nak_lord=None, nakshatra=None):
    """
    Print diagnostic info when discover_nakshatra_vara returns 0 rows.
    Distinct-value snapshot is printed only once per process run.
    """
    global _PANCHANG_SCHEMA_PRINTED
    diag = conn.cursor()
    print(f"  DIAG [{rule_code}] schema={schema} vara_val={vara_val!r} "
          f"nak_lord={nak_lord!r} nakshatra={nakshatra!r}", flush=True)

    # Check: does the exact match exist WITHOUT the DOW filter?
    # (skip for Schema C where nak_lord is a list repr, not a scalar)
    simple_lord = nak_lord if (nak_lord and not nak_lord.startswith('[')) else None
    if vara_val and simple_lord:
        diag.execute(
            "SELECT COUNT(*) FROM km_daily_panchang WHERE vara=%s AND nakshatra_lord=%s",
            (vara_val, simple_lord))
        no_filter_count = diag.fetchone()[0]
        print(f"  DIAG [{rule_code}] rows WITHOUT DOW filter: {no_filter_count}", flush=True)
        if no_filter_count > 0:
            print(f"  DIAG [{rule_code}] → DOW filter is removing all rows — "
                  f"panchang date column may not align with calendar DOW", flush=True)

    if not _PANCHANG_SCHEMA_PRINTED:
        _PANCHANG_SCHEMA_PRINTED = True
        # Distinct vara values
        diag.execute("SELECT DISTINCT vara FROM km_daily_panchang ORDER BY vara")
        varas = [r[0] for r in diag.fetchall()]
        print(f"  DIAG [panchang] distinct vara values: {varas}", flush=True)
        # Distinct nakshatra_lord values
        diag.execute(
            "SELECT DISTINCT nakshatra_lord FROM km_daily_panchang ORDER BY nakshatra_lord")
        lords = [r[0] for r in diag.fetchall()]
        print(f"  DIAG [panchang] distinct nakshatra_lord values: {lords}", flush=True)
        # Total row count
        diag.execute("SELECT COUNT(*) FROM km_daily_panchang")
        total = diag.fetchone()[0]
        print(f"  DIAG [panchang] total rows: {total}", flush=True)

    # Per-vara breakdown for failing rule (always shown)
    if vara_val:
        diag.execute(
            "SELECT DISTINCT nakshatra_lord, COUNT(*) FROM km_daily_panchang "
            "WHERE vara=%s GROUP BY nakshatra_lord ORDER BY nakshatra_lord",
            (vara_val,))
        lords_for_vara = [(r[0], r[1]) for r in diag.fetchall()]
        print(f"  DIAG [{rule_code}] nakshatra_lord counts for vara={vara_val!r}: "
              f"{lords_for_vara}", flush=True)


def _merge_split_days(rows: list) -> list:
    """
    Deduplicate rows with the same date.
    Happens when a mid-day nakshatra changeover causes both morning and
    afternoon lords to match the same rule on the same date (e.g. Schema C
    with nakshatra_lord_in: [Rahu, Ketu]).  The DB UNIQUE(date, rule_id)
    constraint allows only one row per date — merge into the morning snapshot.
    """
    seen: dict = {}
    for date_, snap in rows:
        if date_ not in seen:
            seen[date_] = dict(snap)
        else:
            # Second entry = afternoon session; enrich the morning snapshot
            existing = seen[date_]
            existing['is_split_day'] = True
            existing['both_sessions'] = True
            existing.setdefault('afternoon_nakshatra_lord', snap.get('nakshatra_lord'))
    return list(seen.items())


def discover_nakshatra_vara(conn, rule, vocab):
    """
    Discover signals for nakshatra_vara rules.
    Handles mid-day nakshatra changeovers — generates signals for both
    morning and afternoon nakshatra lords when changeover falls during
    market hours (09:15–15:30 IST).

    Five condition schemas (checked in priority order):
    D  day_lord_equals_nakshatra_lord=True
    A  vara/day + nakshatra name (specific nakshatra)
    C  vara/day + nakshatra_lord_in (list of lords)
    E  vara/day + paksha + tithi_base
    B  vara/day + nakshatra_lord (singular), vara-only, or lord-only
    """
    from datetime import time as dtime

    MARKET_OPEN  = dtime(9, 15)
    MARKET_CLOSE = dtime(15, 30)

    cond = rule['conditions']
    rows = []
    cur = conn.cursor()

    nakshatra_lord_map  = vocab['nakshatra_lord_map']       # positions_name → lord
    nakshatra_positions = vocab['nakshatra_positions_names'] # ordered list of 27

    # 'day' is a legacy alias for 'vara' in older rule conditions
    # Normalize English day names (e.g. "Thursday") → Sanskrit vara names (e.g. "Guru")
    vara_val = _normalize_vara(cond.get('vara') or cond.get('day'))

    def get_afternoon_lord(nak_name):
        """Lord of the nakshatra immediately following nak_name."""
        try:
            idx = nakshatra_positions.index(nak_name)
        except ValueError:
            return None
        next_name = nakshatra_positions[(idx + 1) % 27]
        return nakshatra_lord_map.get(next_name)

    def resolve_lords(vara, nakshatra_lord, nak_name, end_ist, end_next):
        """
        Returns list of (effective_lord, snapshot_extra) tuples.
        Normally 1 item. Two items when changeover falls inside market hours.
        """
        end_time = end_ist  # datetime.time or None

        # Full day — nakshatra runs past market close or into next calendar day
        if end_next or end_time is None or end_time >= MARKET_CLOSE:
            return [(nakshatra_lord, {})]

        # Changeover before market open — afternoon nakshatra governs all day
        if end_time < MARKET_OPEN:
            afternoon_lord = get_afternoon_lord(nak_name)
            if not afternoon_lord:
                return [(nakshatra_lord, {})]
            return [(afternoon_lord, {
                'pre_market_changeover': True,
                'morning_nakshatra_lord': nakshatra_lord,
                'nakshatra_lord': afternoon_lord,
                'changeover_time': str(end_time),
            })]

        # Split day — changeover between 09:15 and 15:30
        afternoon_lord = get_afternoon_lord(nak_name)
        if not afternoon_lord:
            return [(nakshatra_lord, {
                'session': 'morning',
                'changeover_time': str(end_time),
                'is_split_day': True,
            })]
        return [
            (nakshatra_lord, {
                'session': 'morning',
                'changeover_time': str(end_time),
                'is_split_day': True,
                'afternoon_nakshatra_lord': afternoon_lord,
            }),
            (afternoon_lord, {
                'session': 'afternoon',
                'changeover_time': str(end_time),
                'is_split_day': True,
                'morning_nakshatra_lord': nakshatra_lord,
            }),
        ]

    def make_snap(vara, nakshatra_lord, nakshatra_name, tithi_name, paksha, extra):
        snap = {
            'vara': vara,
            'nakshatra_lord': nakshatra_lord,
            'nakshatra': nakshatra_name,
            'tithi': tithi_name,
            'paksha': paksha,
        }
        snap.update(extra)
        return snap

    # ── Schema D: day lord = nakshatra lord (pre-computed flag) ──────────────
    if cond.get('day_lord_equals_nakshatra_lord'):
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, paksha,
                   nakshatra_end_ist, nakshatra_end_next_day
            FROM km_daily_panchang
            WHERE dlnl_match = TRUE
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """)
        for row in cur.fetchall():
            date_, vara, nak_lord, nak_name, tithi, paksha, end_ist, end_next = row
            for eff_lord, extra in resolve_lords(vara, nak_lord, nak_name, end_ist, end_next):
                rows.append((date_, make_snap(vara, eff_lord, nak_name, tithi, paksha, extra)))
        if not rows:
            _panchang_diagnostics(conn, rule['rule_code'], 'D', vara_val)
        return _merge_split_days(rows)

    # ── Schema A: specific nakshatra name ─────────────────────────────────────
    if vara_val and cond.get('nakshatra'):
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, paksha,
                   nakshatra_end_ist, nakshatra_end_next_day
            FROM km_daily_panchang
            WHERE vara = %s AND nakshatra_name = %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (vara_val, cond['nakshatra']))
        for row in cur.fetchall():
            date_, vara, nak_lord, nak_name, tithi, paksha, end_ist, end_next = row
            for eff_lord, extra in resolve_lords(vara, nak_lord, nak_name, end_ist, end_next):
                rows.append((date_, make_snap(vara, eff_lord, nak_name, tithi, paksha, extra)))
        if not rows:
            _panchang_diagnostics(conn, rule['rule_code'], 'A', vara_val, nakshatra=cond['nakshatra'])
        return _merge_split_days(rows)

    # ── Schema C: list of nakshatra lords ─────────────────────────────────────
    lord_in = cond.get('nakshatra_lord_in')
    if vara_val and lord_in:
        lords = lord_in if isinstance(lord_in, list) else [lord_in]
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, paksha,
                   nakshatra_end_ist, nakshatra_end_next_day
            FROM km_daily_panchang
            WHERE vara = %s AND nakshatra_lord = ANY(%s)
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (vara_val, lords))
        for row in cur.fetchall():
            date_, vara, nak_lord, nak_name, tithi, paksha, end_ist, end_next = row
            for eff_lord, extra in resolve_lords(vara, nak_lord, nak_name, end_ist, end_next):
                if eff_lord in lords:
                    rows.append((date_, make_snap(vara, eff_lord, nak_name, tithi, paksha, extra)))
        if not rows:
            _panchang_diagnostics(conn, rule['rule_code'], 'C', vara_val, nak_lord=str(lords))
        return _merge_split_days(rows)

    # ── Schema E: tithi_base + paksha (+ optional vara) ───────────────────────
    if cond.get('tithi_base') and cond.get('paksha'):
        params: list = [f"%{cond['tithi_base']}%", cond['paksha']]
        vara_clause = ''
        if vara_val:
            vara_clause = 'AND vara = %s'
            params.append(vara_val)
        cur.execute(f"""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, tithi_base_name, paksha,
                   nakshatra_end_ist, nakshatra_end_next_day
            FROM km_daily_panchang
            WHERE tithi_base_name ILIKE %s AND paksha = %s
            {vara_clause}
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, params)
        for row in cur.fetchall():
            date_, vara, nak_lord, nak_name, tithi, tithi_base, paksha, end_ist, end_next = row
            for eff_lord, extra in resolve_lords(vara, nak_lord, nak_name, end_ist, end_next):
                snap = make_snap(vara, eff_lord, nak_name, tithi, paksha, extra)
                snap['tithi_base'] = tithi_base
                rows.append((date_, snap))
        if not rows:
            _panchang_diagnostics(conn, rule['rule_code'], 'E', vara_val)
        return _merge_split_days(rows)

    # ── Schema B: vara + nakshatra_lord (singular), vara-only, or lord-only ──
    nak_lord_cond = cond.get('nakshatra_lord')
    if not vara_val and not nak_lord_cond:
        print(f"  DIAG [{rule['rule_code']}] no conditions matched any schema — "
              f"conditions keys: {list(cond.keys())}")
        return rows

    if vara_val:
        # Fetch all rows for this vara so Python can filter by effective lord
        # (which may be the afternoon nakshatra's lord after a mid-day changeover)
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, paksha,
                   nakshatra_end_ist, nakshatra_end_next_day
            FROM km_daily_panchang
            WHERE vara = %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (vara_val,))
    else:
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, paksha,
                   nakshatra_end_ist, nakshatra_end_next_day
            FROM km_daily_panchang
            WHERE nakshatra_lord = %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (nak_lord_cond,))

    for row in cur.fetchall():
        date_, vara, nak_lord, nak_name, tithi, paksha, end_ist, end_next = row
        for eff_lord, extra in resolve_lords(vara, nak_lord, nak_name, end_ist, end_next):
            # Filter by effective lord after changeover resolution
            if nak_lord_cond and eff_lord != nak_lord_cond:
                continue
            rows.append((date_, make_snap(vara, eff_lord, nak_name, tithi, paksha, extra)))

    if not rows:
        _panchang_diagnostics(conn, rule['rule_code'], 'B', vara_val, nak_lord=nak_lord_cond)
    return _merge_split_days(rows)


def discover_planet_in_nakshatra(conn, rule):
    """planet_transit rules — planet in specific nakshatra"""
    cond = rule['conditions']
    strength = strength_from_probability(rule['probability_label'])
    rows = []

    if 'planet' not in cond or 'nakshatra' not in cond:
        return rows

    cur = conn.cursor()
    cur.execute("""
        SELECT p.date, p.planet, p.nakshatra_name, p.sign_name,
               d.vara, d.nakshatra_lord
        FROM km_planetary_positions p
        JOIN km_daily_panchang d ON p.date = d.date
        WHERE p.planet = %s AND p.nakshatra_name = %s
        AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
    """, (cond['planet'], cond['nakshatra']))
    for row in cur.fetchall():
        snapshot = {
            'planet': row[1], 'nakshatra': row[2], 'sign': row[3],
            'vara': row[4], 'nakshatra_lord': row[5]
        }
        rows.append((row[0], snapshot))
    return rows


def discover_planet_state(conn, rule):
    """planet_state rules — combust, retrograde, vargottam, reducing_speed"""
    cond = rule['conditions']
    rows = []

    # Multi-planet retrograde
    if 'planets_retrograde' in cond:
        planets = cond['planets_retrograde']
        cur = conn.cursor()
        cur.execute("""
            SELECT p.date, d.vara, d.nakshatra_lord
            FROM km_planetary_positions p
            LEFT JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = ANY(%s) AND p.retrograde = TRUE
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
            GROUP BY p.date, d.vara, d.nakshatra_lord
            HAVING COUNT(DISTINCT p.planet) = %s
        """, (planets, len(planets)))
        for row in cur.fetchall():
            snapshot = {'planets_retrograde': planets}
            if row[1]:
                snapshot.update({'vara': row[1], 'nakshatra_lord': row[2]})
            rows.append((row[0], snapshot))
        return rows

    # Multi-planet alone in sign
    if 'planets_alone' in cond:
        planets = cond['planets_alone']
        cur = conn.cursor()
        cur.execute("""
            WITH planet_signs AS (
                SELECT date, sign_name,
                       COUNT(DISTINCT planet) FILTER (WHERE planet = ANY(%s)) as target_count,
                       COUNT(DISTINCT planet) as total_in_sign
                FROM km_planetary_positions
                GROUP BY date, sign_name
            )
            SELECT date FROM planet_signs
            WHERE target_count = %s AND total_in_sign = %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (planets, len(planets), len(planets)))
        dates = [r[0] for r in cur.fetchall()]
        for d in dates:
            rows.append((d, {'planets_alone': planets}))
        return rows

    planet = cond.get('planet')
    condition = cond.get('condition')
    if not planet or not condition:
        return rows

    cur = conn.cursor()

    if condition == 'combust':
        cur.execute("""
            SELECT p.date, p.sign_name, d.vara, d.nakshatra_lord
            FROM km_planetary_positions p
            JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = %s AND p.combust = TRUE
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
        """, (planet,))
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet': planet, 'condition': 'combust',
                'sign': row[1], 'vara': row[2], 'nakshatra_lord': row[3]
            }))

    elif condition == 'retrograde':
        cur.execute("""
            SELECT p.date, p.sign_name, d.vara, d.nakshatra_lord
            FROM km_planetary_positions p
            JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = %s AND p.retrograde = TRUE
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
        """, (planet,))
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet': planet, 'condition': 'retrograde',
                'sign': row[1], 'vara': row[2]
            }))

    elif condition == 'vargottam':
        sign_filter = cond.get('sign')
        query = """
            SELECT p.date, p.sign_name, p.longitude, d.vara, d.nakshatra_lord
            FROM km_planetary_positions p
            JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = %s
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
            AND FLOOR(MOD(p.longitude::numeric, 30.0) * 9.0 / 10.0) = (p.sign - 1)
        """
        params = [planet]
        if sign_filter:
            query += " AND p.sign_name = %s"
            params.append(sign_filter)
        cur.execute(query, params)
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet': planet, 'condition': 'vargottam',
                'sign': row[1], 'vara': row[3]
            }))

    elif condition == 'reducing_speed':
        # Get average speed for planet (positive speeds only)
        cur.execute("""
            SELECT AVG(speed) FROM km_planetary_positions
            WHERE planet = %s AND speed > 0
        """, (planet,))
        avg_speed = cur.fetchone()[0] or 1.0
        cur.execute("""
            SELECT p.date, p.speed, p.sign_name, d.vara
            FROM km_planetary_positions p
            JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = %s AND p.speed > 0 AND p.speed < %s
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
        """, (planet, float(avg_speed) * 0.7))
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet': planet, 'condition': 'reducing_speed',
                'speed': float(row[1]), 'sign': row[2], 'vara': row[3]
            }))

    elif condition == 'atichari':
        # Atichari = planet moving at > 1.5x its average speed
        cur.execute("""
            SELECT AVG(speed) FROM km_planetary_positions
            WHERE planet = %s AND speed > 0
        """, (planet,))
        avg_speed = cur.fetchone()[0] or 1.0
        nak_filter = cond.get('nakshatra')
        query = """
            SELECT p.date, p.speed, p.nakshatra_name, p.sign_name, d.vara
            FROM km_planetary_positions p
            JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = %s AND p.speed > %s
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
        """
        params = [planet, float(avg_speed) * 1.5]
        if nak_filter:
            query += " AND p.nakshatra_name = %s"
            params.append(nak_filter)
        cur.execute(query, params)
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet': planet, 'condition': 'atichari',
                'speed': float(row[1]), 'nakshatra': row[2],
                'sign': row[3], 'vara': row[4]
            }))

    return rows


def discover_conjunction(conn, rule):
    """planet_conjunction rules"""
    cond = rule['conditions']
    rows = []
    p1 = cond.get('planet_1')
    p2 = cond.get('planet_2')
    aspect = cond.get('aspect_type', 'conjunction')

    if not p1 or not p2:
        return rows

    cur = conn.cursor()
    # Try both orderings
    cur.execute("""
        SELECT a.date, a.planet_1, a.planet_2, a.orb, d.vara, d.nakshatra_lord
        FROM km_planetary_aspects a
        JOIN km_daily_panchang d ON a.date = d.date
        WHERE a.aspect_type = %s
        AND ((a.planet_1 = %s AND a.planet_2 = %s)
          OR (a.planet_1 = %s AND a.planet_2 = %s))
        AND EXTRACT(DOW FROM a.date) NOT IN (0,6)
    """, (aspect, p1, p2, p2, p1))
    for row in cur.fetchall():
        rows.append((row[0], {
            'planet_1': row[1], 'planet_2': row[2],
            'aspect_type': aspect, 'orb': float(row[3]) if row[3] else None,
            'vara': row[4], 'nakshatra_lord': row[5]
        }))
    return rows


def discover_inner_planet_conjunction(conn, rule):
    """
    Compute Mercury-Venus conjunction directly from km_planetary_positions
    by finding dates where longitude difference < 5 degrees.
    Used because km_planetary_aspects does NOT contain Mercury-Venus aspects.
    """
    cond = rule['conditions']
    p1 = cond.get('planet_1')
    p2 = cond.get('planet_2')
    rows = []

    cur = conn.cursor()
    cur.execute("""
        SELECT a.date,
               a.longitude as lon1,
               b.longitude as lon2,
               ABS(a.longitude - b.longitude) as raw_diff,
               d.vara, d.nakshatra_lord
        FROM km_planetary_positions a
        JOIN km_planetary_positions b ON a.date = b.date
        JOIN km_daily_panchang d ON a.date = d.date
        WHERE a.planet = %s AND b.planet = %s
        AND LEAST(
            ABS(a.longitude - b.longitude),
            360 - ABS(a.longitude - b.longitude)
        ) < 5
        AND EXTRACT(DOW FROM a.date) NOT IN (0,6)
    """, (p1, p2))

    for row in cur.fetchall():
        rows.append((row[0], {
            'planet_1': p1, 'planet_2': p2,
            'lon_1': float(row[1]), 'lon_2': float(row[2]),
            'separation_deg': float(row[3]),
            'vara': row[4], 'nakshatra_lord': row[5]
        }))
    return rows


def discover_relative_position(conn, rule):
    """planet_transit relative position rules"""
    cond = rule['conditions']
    rows = []
    rule_code = rule['rule_code']

    # Mars 12th to Saturn — custom 30 degree computation
    if rule_code == 'REL-MAR-12-SAT-SBE':
        cur = conn.cursor()
        cur.execute("""
            SELECT p1.date,
                   p1.longitude as mars_lon,
                   p2.longitude as sat_lon,
                   d.vara, d.nakshatra_lord
            FROM km_planetary_positions p1
            JOIN km_planetary_positions p2 ON p1.date = p2.date
            JOIN km_daily_panchang d ON p1.date = d.date
            WHERE p1.planet = 'Mars' AND p2.planet = 'Saturn'
            AND MOD(p1.longitude::numeric - p2.longitude::numeric + 360, 360) BETWEEN 28 AND 32
            AND EXTRACT(DOW FROM p1.date) NOT IN (0,6)
        """)
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet_1': 'Mars', 'planet_2': 'Saturn',
                'angular_position': '12th',
                'mars_lon': float(row[1]), 'sat_lon': float(row[2]),
                'vara': row[3], 'nakshatra_lord': row[4]
            }))
        return rows

    # Saturn 12th from Moon (Shani Chandra Dwidwadash Yog)
    if rule_code == 'VOL-SCW-BEA':
        cur = conn.cursor()
        cur.execute("""
            SELECT moon.date, moon.longitude as moon_lon,
                   sat.longitude as sat_lon,
                   d.vara, d.nakshatra_lord
            FROM km_planetary_positions moon
            JOIN km_planetary_positions sat ON moon.date = sat.date
            JOIN km_daily_panchang d ON moon.date = d.date
            WHERE moon.planet = 'Moon' AND sat.planet = 'Saturn'
            AND MOD(sat.longitude::numeric - moon.longitude::numeric + 360, 360) BETWEEN 318 AND 342
            AND EXTRACT(DOW FROM moon.date) NOT IN (0,6)
        """)
        for row in cur.fetchall():
            rows.append((row[0], {
                'moon_lon': float(row[1]),
                'saturn_lon': float(row[2]),
                'vara': row[3], 'nakshatra_lord': row[4]
            }))
        return rows

    # Mars/Venus ahead/behind Jupiter in same sign
    # Note: sign_name in conditions must match km_planetary_positions.sign_name exactly
    # (e.g. verify Cancer spelling with: SELECT DISTINCT sign_name FROM km_planetary_positions WHERE sign_name ILIKE '%cancer%')
    if cond.get('same_sign') and cond.get('position') in ('ahead', 'behind'):
        p1 = cond['planet_1']
        p2 = cond['planet_2']
        position = cond['position']
        sign_filter = cond.get('sign')

        op = '>' if position == 'ahead' else '<'
        query = f"""
            SELECT a.date, a.sign_name, a.longitude as lon1,
                   b.longitude as lon2, d.vara, d.nakshatra_lord
            FROM km_planetary_positions a
            JOIN km_planetary_positions b ON a.date = b.date
            JOIN km_daily_panchang d ON a.date = d.date
            WHERE a.planet = %s AND b.planet = %s
            AND a.sign_name = b.sign_name
            AND a.longitude {op} b.longitude
            AND EXTRACT(DOW FROM a.date) NOT IN (0,6)
        """
        params = [p1, p2]
        if sign_filter:
            query += " AND a.sign_name = %s"
            params.append(sign_filter)
        cur = conn.cursor()
        cur.execute(query, params)
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet_1': p1, 'planet_2': p2,
                'position': position, 'sign': row[1],
                'vara': row[4], 'nakshatra_lord': row[5]
            }))
        return rows

    # Same nakshatra
    if cond.get('same_nakshatra'):
        p1 = cond['planet_1']
        p2 = cond['planet_2']
        nak_filter = cond.get('nakshatra')
        cur = conn.cursor()
        query = """
            SELECT a.date, a.nakshatra_name, d.vara, d.nakshatra_lord
            FROM km_planetary_positions a
            JOIN km_planetary_positions b ON a.date = b.date
            JOIN km_daily_panchang d ON a.date = d.date
            WHERE a.planet = %s AND b.planet = %s
            AND a.nakshatra_name = b.nakshatra_name
            AND EXTRACT(DOW FROM a.date) NOT IN (0,6)
        """
        params = [p1, p2]
        if nak_filter:
            query += " AND a.nakshatra_name = %s"
            params.append(nak_filter)
        cur.execute(query, params)
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet_1': p1, 'planet_2': p2,
                'nakshatra': row[1], 'vara': row[2]
            }))
        return rows

    # MSV — Mercury between Sun and Venus
    if cond.get('mercury_position') == 'between_sun_venus':
        cur = conn.cursor()
        cur.execute("""
            SELECT sun.date, sun.longitude, mer.longitude, ven.longitude,
                   d.vara, d.nakshatra_lord
            FROM km_planetary_positions sun
            JOIN km_planetary_positions mer ON sun.date = mer.date
            JOIN km_planetary_positions ven ON sun.date = ven.date
            JOIN km_daily_panchang d ON sun.date = d.date
            WHERE sun.planet = 'Sun'
            AND mer.planet = 'Mercury'
            AND ven.planet = 'Venus'
            AND EXTRACT(DOW FROM sun.date) NOT IN (0,6)
            AND (
                (sun.longitude < mer.longitude AND mer.longitude < ven.longitude)
                OR (ven.longitude < mer.longitude AND mer.longitude < sun.longitude)
            )
        """)
        for row in cur.fetchall():
            rows.append((row[0], {
                'sun_lon': float(row[1]), 'mercury_lon': float(row[2]),
                'venus_lon': float(row[3]), 'vara': row[4]
            }))
        return rows

    # Trine/square/opposition aspects
    aspect = cond.get('aspect_type')
    if aspect in ('trine', 'square', 'opposition'):
        p1 = cond.get('planet_1')
        p2 = cond.get('planet_2')
        if p1 and p2:
            cur = conn.cursor()
            cur.execute("""
                SELECT a.date, a.orb, d.vara, d.nakshatra_lord
                FROM km_planetary_aspects a
                JOIN km_daily_panchang d ON a.date = d.date
                WHERE a.aspect_type = %s
                AND ((a.planet_1 = %s AND a.planet_2 = %s)
                  OR (a.planet_1 = %s AND a.planet_2 = %s))
                AND EXTRACT(DOW FROM a.date) NOT IN (0,6)
            """, (aspect, p1, p2, p2, p1))
            for row in cur.fetchall():
                rows.append((row[0], {
                    'planet_1': p1, 'planet_2': p2,
                    'aspect_type': aspect, 'orb': float(row[1]) if row[1] else None,
                    'vara': row[2]
                }))
    return rows


def discover_vedh(conn, rule, vedh_map):
    """vedh rules"""
    cond = rule['conditions']
    rows = []

    if cond.get('mutual_vedh'):
        # Mutual vedh — both planets in each other's vedh nakshatra
        p1 = cond['planet_1']
        n1 = cond['nakshatra_1']
        p2 = cond['planet_2']
        n2 = cond['nakshatra_2']
        cur = conn.cursor()
        cur.execute("""
            SELECT a.date, a.nakshatra_name, b.nakshatra_name, d.vara
            FROM km_planetary_positions a
            JOIN km_planetary_positions b ON a.date = b.date
            JOIN km_daily_panchang d ON a.date = d.date
            WHERE a.planet = %s AND a.nakshatra_name = %s
            AND b.planet = %s AND b.nakshatra_name = %s
            AND EXTRACT(DOW FROM a.date) NOT IN (0,6)
        """, (p1, n1, p2, n2))
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet_1': p1, 'nakshatra_1': row[1],
                'planet_2': p2, 'nakshatra_2': row[2],
                'vara': row[3]
            }))
        return rows

    planet = cond.get('planet')
    target_nak = cond.get('vedh_of')
    if not planet or not target_nak:
        return rows

    # Handle list of target nakshatras
    targets = target_nak if isinstance(target_nak, list) else [target_nak]

    for target in targets:
        vedh_nak = vedh_map.get(target)
        if not vedh_nak:
            continue
        cur = conn.cursor()
        cur.execute("""
            SELECT p.date, p.nakshatra_name, p.sign_name, d.vara, d.nakshatra_lord
            FROM km_planetary_positions p
            JOIN km_daily_panchang d ON p.date = d.date
            WHERE p.planet = %s AND p.nakshatra_name = %s
            AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
        """, (planet, vedh_nak))
        for row in cur.fetchall():
            rows.append((row[0], {
                'planet': planet, 'vedh_of': target,
                'planet_in_nakshatra': row[1], 'sign': row[2], 'vara': row[3]
            }))
    return rows


def discover_tithi(conn, rule):
    """tithi_alone rules"""
    cond = rule['conditions']
    rows = []
    cur = conn.cursor()

    # Ekadashi + vara
    if cond.get('is_ekadashi') and cond.get('vara'):
        extra = ""
        params = [_normalize_vara(cond['vara'])]
        if cond.get('paksha'):
            extra += " AND paksha = %s"
            params.append(cond['paksha'])
        cur.execute(f"""
            SELECT date, vara, nakshatra_lord, nakshatra_name,
                   tithi_name, paksha, tithi_end_ist
            FROM km_daily_panchang
            WHERE is_ekadashi = TRUE AND vara = %s
            {extra}
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, params)
        for row in cur.fetchall():
            rows.append((row[0], {
                'tithi': row[4], 'vara': row[1],
                'nakshatra_lord': row[2], 'paksha': row[5]
            }))
        return rows

    # Purnima
    if cond.get('is_purnima'):
        cur.execute("""
            SELECT date, vara, nakshatra_lord, tithi_name, paksha
            FROM km_daily_panchang
            WHERE is_purnima = TRUE
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """)
        for row in cur.fetchall():
            rows.append((row[0], {
                'tithi': row[3], 'vara': row[1],
                'nakshatra_lord': row[2], 'paksha': row[4]
            }))
        return rows

    # Tithi base + paksha + kshay/vriddhi
    tithi_base = cond.get('tithi_base')
    paksha = cond.get('paksha')
    is_kshay = cond.get('kshay', False)
    is_vriddhi = cond.get('vriddhi', False)

    if tithi_base and paksha:
        query = """
            SELECT date, vara, nakshatra_lord, tithi_name,
                   tithi_base_name, paksha, tithi_end_ist
            FROM km_daily_panchang
            WHERE tithi_base_name ILIKE %s AND paksha = %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """
        cur.execute(query, (f'%{tithi_base}%', paksha))
        for row in cur.fetchall():
            # kshay = tithi ends before 06:00 IST (short tithi)
            # vriddhi = tithi spans two days (check next day same tithi)
            rows.append((row[0], {
                'tithi': row[3], 'tithi_base': row[4],
                'paksha': row[5], 'vara': row[1],
                'nakshatra_lord': row[2]
            }))
    return rows


def discover_compound_panchak(conn, rule, panchak_naks):
    """Panchak rules"""
    cond = rule['conditions']
    rows = []
    cur = conn.cursor()

    # Panchak day + yoga
    if cond.get('panchak_day') and cond.get('yog'):
        yoga_name = cond['yog']
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name, yoga_name
            FROM km_daily_panchang
            WHERE nakshatra_name = ANY(%s)
            AND yoga_name ILIKE %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (list(panchak_naks), f'%{yoga_name}%'))
        for row in cur.fetchall():
            rows.append((row[0], {
                'panchak_nakshatra': row[3], 'yoga': row[4], 'vara': row[1]
            }))
        return rows

    # Panchak starts on specific day
    if cond.get('panchak_start_day'):
        start_day = cond['panchak_start_day']
        # LAG must run over ALL days (no weekday filter) so transitions that
        # fall on weekends are correctly detected rather than attributed to the
        # next weekday inside the panchak window.
        cur.execute("""
            WITH all_panchak AS (
                SELECT date, vara, nakshatra_name,
                       LAG(nakshatra_name) OVER (ORDER BY date) as prev_nak
                FROM km_daily_panchang
                WHERE nakshatra_name = ANY(%s)
            )
            SELECT date, vara, nakshatra_name
            FROM all_panchak
            WHERE prev_nak IS NULL OR prev_nak != ALL(%s)
        """, (list(panchak_naks), list(panchak_naks)))
        for row in cur.fetchall():
            actual_start = row[0]
            actual_vara = row[1]
            if actual_vara != start_day:
                continue
            # Carry weekend panchak starts to the following Monday
            signal_date = actual_start
            dow = actual_start.weekday()  # Mon=0, Sat=5, Sun=6
            if dow >= 5:
                signal_date = actual_start + timedelta(days=(7 - dow))
            rows.append((signal_date, {
                'panchak_start_day': actual_vara,
                'panchak_start_date': str(actual_start),
                'first_nakshatra': row[2],
            }))
        return rows

    return rows


def discover_compound_yog(conn, rule):
    """Yog rules using yoga_name from km_daily_panchang"""
    cond = rule['conditions']
    rows = []
    yoga = cond.get('yoga') or cond.get('yog')
    if not yoga:
        return rows

    cur = conn.cursor()
    vara = _normalize_vara(cond.get('vara'))
    is_weekend_vara = vara in _WEEKEND_VARAS

    if vara:
        if is_weekend_vara:
            # Weekend vara (Ravi=Sunday, Shani=Saturday): drop weekday filter
            # and carry signal date to the following Monday
            cur.execute("""
                SELECT date, vara, nakshatra_lord, nakshatra_name, yoga_name
                FROM km_daily_panchang
                WHERE yoga_name ILIKE %s AND vara = %s
            """, (f'%{yoga}%', vara))
        else:
            cur.execute("""
                SELECT date, vara, nakshatra_lord, nakshatra_name, yoga_name
                FROM km_daily_panchang
                WHERE yoga_name ILIKE %s AND vara = %s
                AND EXTRACT(DOW FROM date) NOT IN (0,6)
            """, (f'%{yoga}%', vara))
    else:
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name, yoga_name
            FROM km_daily_panchang
            WHERE yoga_name ILIKE %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (f'%{yoga}%',))

    for row in cur.fetchall():
        signal_date = row[0]
        if is_weekend_vara:
            dow = signal_date.weekday()  # Mon=0, Sat=5, Sun=6
            if dow >= 5:
                signal_date = signal_date + timedelta(days=(7 - dow))
        rows.append((signal_date, {
            'yoga': row[4], 'vara': row[1], 'nakshatra_lord': row[2],
            **(({'yoga_date': str(row[0])}) if is_weekend_vara else {}),
        }))
    return rows


def discover_seasonal(conn, rule):
    """Seasonal / hemisphere rules"""
    cond = rule['conditions']
    rows = []
    event = cond.get('event')
    if not event:
        return rows

    cur = conn.cursor()
    cur.execute("""
        SELECT date, vara, nakshatra_lord, hemisphere_event
        FROM km_daily_panchang
        WHERE hemisphere_event = %s
        AND EXTRACT(DOW FROM date) NOT IN (0,6)
    """, (event,))
    for row in cur.fetchall():
        rows.append((row[0], {
            'event': row[3], 'vara': row[1], 'nakshatra_lord': row[2]
        }))
    return rows


def discover_eclipse(conn, rule):
    """Eclipse rules — source from km_astro_calendar"""
    cond = rule['conditions']
    rows = []
    eclipse_type = cond.get('eclipse_type', '')
    nak_filter = cond.get('nakshatra')

    cur = conn.cursor()
    if eclipse_type == 'lunar':
        query = """
            SELECT start_date, display_name
            FROM km_astro_calendar
            WHERE display_name ILIKE '%Lunar%Eclipse%'
            OR display_name ILIKE '%Moon%Eclipse%'
        """
    else:
        query = """
            SELECT start_date, display_name
            FROM km_astro_calendar
            WHERE display_name ILIKE '%Solar%Eclipse%'
        """
    cur.execute(query)
    for row in cur.fetchall():
        if row[0]:
            rows.append((row[0], {
                'eclipse_type': eclipse_type,
                'display_name': row[1]
            }))
    return rows


def discover_sign_planet(conn, rule):
    """compound sign+planet rules"""
    cond = rule['conditions']
    rows = []
    sign = cond.get('sign')
    planets = cond.get('planets_present', [])
    # Normalize: may be stored as a bare string "Venus" instead of ["Venus"]
    if isinstance(planets, str):
        planets = [planets]
    if not sign or not planets:
        return rows

    cur = conn.cursor()
    cur.execute("""
        SELECT p.date, d.vara, d.nakshatra_lord
        FROM km_planetary_positions p
        LEFT JOIN km_daily_panchang d ON p.date = d.date
        WHERE p.sign_name = %s AND p.planet = ANY(%s)
        AND EXTRACT(DOW FROM p.date) NOT IN (0,6)
        GROUP BY p.date, d.vara, d.nakshatra_lord
        HAVING COUNT(DISTINCT p.planet) = %s
    """, (sign, planets, len(planets)))
    for row in cur.fetchall():
        snapshot = {'sign': sign, 'planets': planets}
        if row[1]:
            snapshot.update({'vara': row[1], 'nakshatra_lord': row[2]})
        rows.append((row[0], snapshot))
    return rows


# ── MAIN DISCOVERY ROUTER ───────────────────────────────────

def discover_rule(conn, rule, vedh_map, panchak_naks, vocab):
    """Route rule to correct discovery function based on rule_type and conditions"""
    rt = rule['rule_type']
    cond = rule['conditions'] or {}
    rc = rule['rule_code']

    # Phase 2 rules — not yet implemented, skip cleanly
    if rc in NOT_IMPLEMENTED_RULE_CODES:
        return []

    # VOL-SCW-BEA conditions may not carry the standard relative-position keys
    # that would otherwise route it to discover_relative_position — force it directly
    if rc == 'VOL-SCW-BEA':
        return discover_relative_position(conn, rule)

    if rt == 'nakshatra_vara':
        return discover_nakshatra_vara(conn, rule, vocab)

    elif rt == 'planet_transit':
        if cond.get('same_nakshatra') or cond.get('same_sign') or \
           cond.get('position') or cond.get('mercury_position') or \
           cond.get('angular_position') or cond.get('aspect_type') in ('trine','square','opposition'):
            return discover_relative_position(conn, rule)
        elif cond.get('d9_sign') or cond.get('d9_sign_in'):
            return []  # D9 rules need separate vargottam logic — skip for now
        else:
            return discover_planet_in_nakshatra(conn, rule)

    elif rt == 'planet_state':
        return discover_planet_state(conn, rule)

    elif rt == 'planet_conjunction':
        # Inner planets (Mercury/Venus) are not in km_planetary_aspects — compute directly
        inner_planets = {'Mercury', 'Venus'}
        p1 = cond.get('planet_1', '')
        p2 = cond.get('planet_2', '')
        if p1 in inner_planets or p2 in inner_planets:
            return discover_inner_planet_conjunction(conn, rule)
        return discover_conjunction(conn, rule)

    elif rt == 'vedh':
        return discover_vedh(conn, rule, vedh_map)

    elif rt == 'tithi_alone':
        return discover_tithi(conn, rule)

    elif rt == 'compound':
        if cond.get('panchak_day') or cond.get('panchak_start_day') or cond.get('panchak_all'):
            return discover_compound_panchak(conn, rule, panchak_naks)
        elif cond.get('planet') and cond.get('nakshatra'):
            # YOG-MAN-ASH-BUL and similar: planet+nakshatra in compound → transit discovery
            return discover_planet_in_nakshatra(conn, rule)
        elif cond.get('yoga') or cond.get('yog'):
            return discover_compound_yog(conn, rule)
        elif cond.get('event'):
            return discover_seasonal(conn, rule)
        elif cond.get('sign'):
            return discover_sign_planet(conn, rule)
        else:
            return []

    elif rt == 'eclipse':
        return discover_eclipse(conn, rule)

    elif rt == 'planet_manifestation':
        if cond.get('mercury_position') == 'between_sun_venus':
            return discover_relative_position(conn, rule)
        else:
            return []  # Rise events need heliacal rise logic — skip for now

    else:
        return []


# ── MAIN ────────────────────────────────────────────────────

def main(year_filter=None, rule_code_filter=None):
    global _PANCHANG_SCHEMA_PRINTED
    _PANCHANG_SCHEMA_PRINTED = False  # reset so diagnostics fire fresh each run
    start_time = time.time()
    conn = get_conn()

    # Load vocabulary from master tables — canonical spelling for nakshatras/planets
    vocab = load_vocabulary(conn)
    vedh_map = build_vedh_map(vocab['nakshatra_positions_names'])
    panchak_naks = get_panchak_nakshatras(vocab['nakshatra_positions_names'])
    print(f"Vocabulary loaded: {len(vocab['nakshatra_positions_names'])} nakshatras, "
          f"{len(vocab['planet_names'])} planets, {len(vocab['yoga_names'])} yogas")

    # Load all active available rules
    cur = conn.cursor()
    cur.execute("""
        SELECT id, rule_code, rule_type, display_name,
               outcome, probability_label, conditions, data_source
        FROM km_astro_rule_master
        WHERE is_active = TRUE AND is_deleted = FALSE
        AND data_source = 'available'
        ORDER BY rule_type, rule_code
    """)
    rules = []
    for row in cur.fetchall():
        rules.append({
            'id': row[0], 'rule_code': row[1], 'rule_type': row[2],
            'display_name': row[3], 'outcome': row[4],
            'probability_label': row[5],
            'conditions': row[6] if isinstance(row[6], dict) else json.loads(row[6] or '{}'),
            'data_source': row[7]
        })

    print(f"Loaded {len(rules)} active available rules")

    if rule_code_filter:
        rules = [r for r in rules if r['rule_code'] == rule_code_filter]
        if not rules:
            print(f"Rule not found: {rule_code_filter}")
            return
        print(f"Running discovery for single rule: {rule_code_filter}")

    total_inserted = 0
    total_transits = 0
    total_errors = 0

    for i, rule in enumerate(rules):
        try:
            rows = discover_rule(conn, rule, vedh_map, panchak_naks, vocab)

            # Filter by year if specified
            if year_filter:
                rows = [(d, s) for d, s in rows if d.year == year_filter]

            if not rows:
                continue

            strength = strength_from_probability(rule['probability_label'])
            from psycopg2.extras import execute_values
            ins_data = [
                (d, rule['id'], rule['outcome'], strength,
                 rule['display_name'], json.dumps(snapshot))
                for d, snapshot in rows
            ]
            ins_cur = conn.cursor()
            execute_values(ins_cur,
                "INSERT INTO km_rule_signals "
                "(date, rule_id, signal, strength, details, conditions_snapshot) "
                "VALUES %s ON CONFLICT (date, rule_id) DO NOTHING",
                ins_data)
            inserted = len(ins_data)
            conn.commit()
            total_inserted += inserted

            if should_group_transits(rule):
                transits = detect_transits(conn, rule, rows)
                if transits:
                    n_transits = insert_transits(conn, rule, transits)
                    conn.commit()
                else:
                    n_transits = 0
            else:
                n_transits = 0
                transits = []

            total_transits += n_transits

            print(f"  {rule['rule_code']}: {len(rows)} signals | "
                  f"group_transits={should_group_transits(rule)} | "
                  f"transits={n_transits}")

        except Exception as e:
            print(f"  ERROR rule {rule['rule_code']}: {e}")
            conn.rollback()
            total_errors += 1

    elapsed = time.time() - start_time
    print(f"\nDone.")
    print(f"  Rules processed:  {len(rules)}")
    print(f"  Signals inserted: {total_inserted}")
    print(f"  Transits created: {total_transits}")
    print(f"  Errors:           {total_errors}")
    print(f"  Time:             {elapsed:.1f}s")
    conn.close()


if __name__ == '__main__':
    import sys
    year = None
    rule_code_filter = None
    for arg in sys.argv[1:]:
        if arg.isdigit():
            year = int(arg)
        else:
            rule_code_filter = arg
    main(year_filter=year, rule_code_filter=rule_code_filter)
