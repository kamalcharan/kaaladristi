import os, psycopg2, json
from datetime import date, timedelta
from typing import Optional
import time

def get_conn():
    return psycopg2.connect(
        host="187.127.136.65", port=5432,
        dbname="kaala_dristi_db", user="postgres",
        password=os.environ["KD_DB_PASSWORD"]
    )

def strength_from_probability(prob: Optional[str]) -> int:
    return {'Very High':5,'High':4,'Reasonable':3,'Low':2}.get(prob, 3)

def insert_signal(cur, date, rule_id, signal, strength, details, snapshot):
    cur.execute("""
        INSERT INTO km_rule_signals
          (date, rule_id, signal, strength, details, conditions_snapshot)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (date, rule_id) DO NOTHING
    """, (date, rule_id, signal, strength, details, json.dumps(snapshot)))

# ── VEDH MAP (nakshatra → its vedh nakshatra) ──────────────
VEDH_MAP = {
    'Ashwini':'Vishakha','Bharani':'Anuradha','Krittika':'Jyeshtha',
    'Rohini':'Mula','Mrigasira':'Purva Ashadha','Ardra':'Uttara Ashadha',
    'Punarvasu':'Shravana','Pushya':'Dhanistha','Ashlesha':'Shatabhisha',
    'Magha':'Purva Bhadrapada','Purva Phalguni':'Uttara Bhadrapada',
    'Uttara Phalguni':'Revati','Hasta':'Ashwini','Chitra':'Bharani',
    'Swati':'Krittika','Vishakha':'Ashwini','Anuradha':'Bharani',
    'Jyeshtha':'Krittika','Mula':'Rohini','Purva Ashadha':'Mrigasira',
    'Uttara Ashadha':'Ardra','Shravana':'Punarvasu','Dhanistha':'Pushya',
    'Shatabhisha':'Ashlesha','Purva Bhadrapada':'Magha',
    'Uttara Bhadrapada':'Purva Phalguni','Revati':'Uttara Phalguni',
    # Abhijeet is a special nakshatra between Uttara Ashadha and Shravana
    'Abhijeet':'Ardra',
}

PANCHAK_NAKSHATRAS = {
    'Dhanistha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
}

# ── DISCOVERY FUNCTIONS ─────────────────────────────────────

def discover_nakshatra_vara(conn, rule):
    """day_nakshatra and day_lord_nak_lord rules"""
    cond = rule['conditions']
    strength = strength_from_probability(rule['probability_label'])
    rows = []

    if cond.get('day_lord_equals_nakshatra_lord'):
        # DLNL rule — use pre-computed dlnl_match
        cur = conn.cursor()
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name, tithi_name, paksha
            FROM km_daily_panchang
            WHERE dlnl_match = TRUE
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """)
        for row in cur.fetchall():
            snapshot = {
                'vara': row[1], 'nakshatra_lord': row[2],
                'nakshatra': row[3], 'tithi': row[4], 'paksha': row[5]
            }
            rows.append((row[0], snapshot))
    elif 'vara' in cond and 'nakshatra' in cond:
        # specific nakshatra+vara combo (not lord-based)
        cur = conn.cursor()
        cur.execute("""
            SELECT date, vara, nakshatra_lord, nakshatra_name, tithi_name, paksha
            FROM km_daily_panchang
            WHERE vara = %s AND nakshatra_name = %s
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
        """, (cond['vara'], cond['nakshatra']))
        for row in cur.fetchall():
            snapshot = {
                'vara': row[1], 'nakshatra_lord': row[2],
                'nakshatra': row[3], 'tithi': row[4], 'paksha': row[5]
            }
            rows.append((row[0], snapshot))
    else:
        # standard vara + nakshatra_lord ('day' is a legacy alias for 'vara')
        day = cond.get('day') or cond.get('vara')
        nak_lord = cond.get('nakshatra_lord')
        if not day and not nak_lord:
            return rows
        cur = conn.cursor()
        if day and nak_lord:
            cur.execute("""
                SELECT date, vara, nakshatra_lord, nakshatra_name, tithi_name, paksha
                FROM km_daily_panchang
                WHERE vara = %s AND nakshatra_lord = %s
                AND EXTRACT(DOW FROM date) NOT IN (0,6)
            """, (day, nak_lord))
        elif day:
            cur.execute("""
                SELECT date, vara, nakshatra_lord, nakshatra_name, tithi_name, paksha
                FROM km_daily_panchang
                WHERE vara = %s
                AND EXTRACT(DOW FROM date) NOT IN (0,6)
            """, (day,))
        else:
            cur.execute("""
                SELECT date, vara, nakshatra_lord, nakshatra_name, tithi_name, paksha
                FROM km_daily_panchang
                WHERE nakshatra_lord = %s
                AND EXTRACT(DOW FROM date) NOT IN (0,6)
            """, (nak_lord,))
        for row in cur.fetchall():
            snapshot = {
                'vara': row[1], 'nakshatra_lord': row[2],
                'nakshatra': row[3], 'tithi': row[4], 'paksha': row[5]
            }
            rows.append((row[0], snapshot))
    return rows


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
            SELECT date FROM km_planetary_positions
            WHERE planet = ANY(%s) AND retrograde = TRUE
            AND EXTRACT(DOW FROM date) NOT IN (0,6)
            GROUP BY date
            HAVING COUNT(DISTINCT planet) = %s
        """, (planets, len(planets)))
        dates = [r[0] for r in cur.fetchall()]
        for d in dates:
            cur2 = conn.cursor()
            cur2.execute("""
                SELECT vara, nakshatra_lord, nakshatra_name, tithi_name, paksha
                FROM km_daily_panchang WHERE date = %s
            """, (d,))
            prow = cur2.fetchone()
            snapshot = {'planets_retrograde': planets}
            if prow:
                snapshot.update({'vara': prow[0], 'nakshatra_lord': prow[1]})
            rows.append((d, snapshot))
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
            AND ((p1.longitude::numeric - p2.longitude::numeric + 360.0) % 360.0) BETWEEN 28 AND 32
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

    # Mars/Venus ahead/behind Jupiter in same sign
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


def discover_vedh(conn, rule):
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
        vedh_nak = VEDH_MAP.get(target)
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
        params = [cond['vara']]
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


def discover_compound_panchak(conn, rule):
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
        """, (list(PANCHAK_NAKSHATRAS), f'%{yoga_name}%'))
        for row in cur.fetchall():
            rows.append((row[0], {
                'panchak_nakshatra': row[3], 'yoga': row[4], 'vara': row[1]
            }))
        return rows

    # Panchak starts on specific day
    if cond.get('panchak_start_day'):
        start_day = cond['panchak_start_day']
        # Find first day of each panchak period
        cur.execute("""
            WITH panchak_days AS (
                SELECT date, vara, nakshatra_name,
                       LAG(nakshatra_name) OVER (ORDER BY date) as prev_nak
                FROM km_daily_panchang
                WHERE nakshatra_name = ANY(%s)
                AND EXTRACT(DOW FROM date) NOT IN (0,6)
            )
            SELECT date, vara, nakshatra_name
            FROM panchak_days
            WHERE prev_nak IS NULL
               OR prev_nak NOT IN ('Dhanistha','Shatabhisha',
                 'Purva Bhadrapada','Uttara Bhadrapada','Revati')
        """, (list(PANCHAK_NAKSHATRAS),))
        for row in cur.fetchall():
            if row[1] == start_day:
                rows.append((row[0], {
                    'panchak_start_day': row[1],
                    'first_nakshatra': row[2]
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
    vara = cond.get('vara')

    if vara:
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
        rows.append((row[0], {
            'yoga': row[4], 'vara': row[1], 'nakshatra_lord': row[2]
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
    if not sign or not planets:
        return rows

    cur = conn.cursor()
    cur.execute("""
        SELECT date FROM km_planetary_positions
        WHERE sign_name = %s AND planet = ANY(%s)
        AND EXTRACT(DOW FROM date) NOT IN (0,6)
        GROUP BY date
        HAVING COUNT(DISTINCT planet) = %s
    """, (sign, planets, len(planets)))
    dates = [r[0] for r in cur.fetchall()]
    for d in dates:
        cur2 = conn.cursor()
        cur2.execute("""
            SELECT vara, nakshatra_lord FROM km_daily_panchang WHERE date=%s
        """, (d,))
        prow = cur2.fetchone()
        snapshot = {'sign': sign, 'planets': planets}
        if prow:
            snapshot.update({'vara': prow[0], 'nakshatra_lord': prow[1]})
        rows.append((d, snapshot))
    return rows


# ── MAIN DISCOVERY ROUTER ───────────────────────────────────

def discover_rule(conn, rule):
    """Route rule to correct discovery function based on rule_type and conditions"""
    rt = rule['rule_type']
    cond = rule['conditions'] or {}
    rc = rule['rule_code']

    if rt == 'nakshatra_vara':
        return discover_nakshatra_vara(conn, rule)

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
        return discover_conjunction(conn, rule)

    elif rt == 'vedh':
        return discover_vedh(conn, rule)

    elif rt == 'tithi_alone':
        return discover_tithi(conn, rule)

    elif rt == 'compound':
        if cond.get('panchak_day') or cond.get('panchak_start_day') or cond.get('panchak_all'):
            return discover_compound_panchak(conn, rule)
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

def main(year_filter=None):
    start_time = time.time()
    conn = get_conn()

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
    total_inserted = 0
    total_errors = 0

    for i, rule in enumerate(rules):
        try:
            rows = discover_rule(conn, rule)

            # Filter by year if specified
            if year_filter:
                rows = [(d, s) for d, s in rows if d.year == year_filter]

            if not rows:
                continue

            strength = strength_from_probability(rule['probability_label'])
            ins_cur = conn.cursor()
            inserted = 0
            for (d, snapshot) in rows:
                ins_cur.execute("""
                    INSERT INTO km_rule_signals
                      (date, rule_id, signal, strength, details, conditions_snapshot)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date, rule_id) DO NOTHING
                """, (
                    d, rule['id'], rule['outcome'], strength,
                    rule['display_name'], json.dumps(snapshot)
                ))
                inserted += ins_cur.rowcount

            conn.commit()
            total_inserted += inserted

            if (i + 1) % 20 == 0:
                print(f"  Processed {i+1}/{len(rules)} rules | Signals so far: {total_inserted}")

        except Exception as e:
            print(f"  ERROR rule {rule['rule_code']}: {e}")
            conn.rollback()
            total_errors += 1

    elapsed = time.time() - start_time
    print(f"\nDone. Rules processed: {len(rules)} | Signals inserted: {total_inserted} | Errors: {total_errors} | Time: {elapsed:.1f}s")
    conn.close()


if __name__ == '__main__':
    import sys
    year = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(year_filter=year)
