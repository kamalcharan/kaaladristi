"""
generate_bayer_windows.py

Generate transit windows for Bayer rules from km_planetary_positions
and insert into km_rule_transits (ON CONFLICT DO NOTHING).

Rules generated:
  BAY-R02-MAR-MER-SPD  Mars-Mercury geocentric speed differential ≈ 59min
  BAY-R03-VEN-RET      Venus retrograde periods (island pattern)
  BAY-R06-MAR-1635     Mars crosses 16°35' in any zodiac sign
  BAY-R27-MER-SPD      Mercury speed crosses 59min or 1°58' threshold
  BAY-R14-VEN-LON      Venus longitude unit cycle (unit = 1°9'13'' = 1.1536°)

Date range: 1990-01-01 to 2030-12-31
UNIQUE constraint: uq_rule_transits_rule_start (rule_id, start_date)
All inserts use ON CONFLICT (rule_id, start_date) DO NOTHING.

Prerequisite: Run km_migration_101_bayer_rules_seed.sql first to create the rules.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_bayer_windows.py

DO NOT RUN AUTOMATICALLY — one-shot backfill + forward fill.
"""

import os
import json
import psycopg2
from datetime import date


# ── DB connection ──────────────────────────────────────────────────────────────

def get_conn():
    if "DB_PRIMARY" in os.environ:
        return psycopg2.connect(os.environ["DB_PRIMARY"])
    return psycopg2.connect(
        host="187.127.136.65", port=5432,
        dbname="kaala_dristi_db",
        password=os.environ["KD_DB_PASSWORD"],
    )


# ── Constants ──────────────────────────────────────────────────────────────────

BACKFILL_FROM = date(1990, 1, 1)
BACKFILL_TO   = date(2030, 12, 31)

# 59 minutes in decimal degrees
SPEED_59MIN   = 59 / 60        # 0.9833°/day
SPEED_1D58MIN = 1 + 58 / 60   # 1.9667°/day
SPEED_TOL     = 0.05           # ±0.05° tolerance for speed triggers

# Mars degree trigger: 16°35' = 16 + 35/60
MAR_DEGREE    = 16 + 35 / 60  # 16.5833°

# Venus longitude unit: 1°9'13'' = 1 + 9/60 + 13/3600
VEN_UNIT      = 1 + 9 / 60 + 13 / 3600  # 1.1536°


# ── Helpers ────────────────────────────────────────────────────────────────────

def lookup_rule_id(cur, rule_code: str) -> int | None:
    cur.execute(
        "SELECT id FROM km_astro_rule_master WHERE rule_code = %s LIMIT 1",
        (rule_code,),
    )
    row = cur.fetchone()
    return row[0] if row else None


INSERT_SQL = """
INSERT INTO km_rule_transits
  (rule_id, start_date, end_date, conditions_snapshot)
VALUES (%s, %s, %s, %s)
ON CONFLICT (rule_id, start_date) DO NOTHING
"""


def bulk_insert(cur, rows: list[tuple]) -> tuple[int, int]:
    inserted = skipped = 0
    for row in rows:
        cur.execute(INSERT_SQL, row)
        if cur.rowcount == 1:
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped


# ── BAY-R02: Mars-Mercury Speed Differential ──────────────────────────────────

def generate_r02_speed_diff(cur, rule_id: int) -> tuple[int, int]:
    """
    Find dates where ABS(mercury.speed - mars.speed) ≈ 59min (0.9833°/day).
    Tolerance: ±0.05 → range [0.9333, 1.0333].
    Single-day point events.
    """
    cur.execute("""
        WITH speeds AS (
            SELECT
                m.date,
                m.speed  AS mercury_speed,
                ma.speed AS mars_speed,
                ABS(m.speed - ma.speed) AS speed_diff
            FROM km_planetary_positions m
            JOIN km_planetary_positions ma
              ON ma.date = m.date AND ma.planet = 'Mars'
            WHERE m.planet = 'Mercury'
              AND m.date BETWEEN %s AND %s
              AND ABS(m.speed - ma.speed) BETWEEN %s AND %s
        )
        SELECT date, mercury_speed, mars_speed, speed_diff
        FROM speeds
        ORDER BY date
    """, (BACKFILL_FROM, BACKFILL_TO,
          SPEED_59MIN - SPEED_TOL, SPEED_59MIN + SPEED_TOL))

    rows = []
    for d, merc_spd, mars_spd, diff in cur.fetchall():
        snap = json.dumps({
            "mercury_speed": round(float(merc_spd), 6),
            "mars_speed":    round(float(mars_spd), 6),
            "speed_diff":    round(float(diff), 6),
            "rule":          "Bayer Rule 2",
            "rule_type":     "speed_differential",
        })
        rows.append((rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── BAY-R03: Venus Retrograde Periods ─────────────────────────────────────────

def generate_r03_venus_retro(cur, rule_id: int) -> tuple[int, int]:
    """
    Contiguous island pattern — same approach as Panchak and Mercury retrograde.
    """
    cur.execute("""
        WITH retro_days AS (
            SELECT date,
                   date - (ROW_NUMBER() OVER (ORDER BY date))::integer AS grp
            FROM km_planetary_positions
            WHERE planet = 'Venus' AND retrograde = true
              AND date BETWEEN %s AND %s
        )
        SELECT MIN(date) AS start_date, MAX(date) AS end_date
        FROM retro_days
        GROUP BY grp
        ORDER BY start_date
    """, (BACKFILL_FROM, BACKFILL_TO))

    rows = []
    for start_date, end_date in cur.fetchall():
        snap = json.dumps({
            "planet":    "Venus",
            "state":     "retrograde",
            "rule":      "Bayer Rule 3",
            "rule_type": "retrograde_period",
        })
        rows.append((rule_id, start_date, end_date, snap))
    return bulk_insert(cur, rows)


# ── BAY-R06: Mars at 16°35' Any Sign ──────────────────────────────────────────

def generate_r06_mars_degree(cur, rule_id: int) -> tuple[int, int]:
    """
    Detect when Mars longitude crosses 16°35' within any zodiac sign.
    Uses forward/retrograde crossing detection with LAG.
    Guards against sign-boundary jumps (ABS(deg_diff) < 5).
    """
    cur.execute("""
        WITH mars_pos AS (
            SELECT date, longitude,
                   MOD(longitude::numeric, 30) AS deg_in_sign,
                   LAG(MOD(longitude::numeric, 30))
                     OVER (ORDER BY date) AS prev_deg
            FROM km_planetary_positions
            WHERE planet = 'Mars'
              AND date BETWEEN %s AND %s
        )
        SELECT date, longitude, deg_in_sign,
               FLOOR(longitude / 30) AS sign_num
        FROM mars_pos
        WHERE (
            -- Forward motion crossing
            (prev_deg < %s AND deg_in_sign >= %s)
            OR
            -- Retrograde crossing
            (prev_deg > %s AND deg_in_sign <= %s)
        )
        -- Exclude sign-boundary wraps (30→0 or 0→30 jumps)
        AND ABS(deg_in_sign - prev_deg) < 5
        ORDER BY date
    """, (BACKFILL_FROM, BACKFILL_TO,
          MAR_DEGREE, MAR_DEGREE,
          MAR_DEGREE, MAR_DEGREE))

    rows = []
    for d, longitude, deg_in_sign, sign_num in cur.fetchall():
        snap = json.dumps({
            "mars_longitude":  round(float(longitude), 4),
            "degree_in_sign":  round(float(deg_in_sign), 4),
            "sign_number":     int(sign_num),
            "rule":            "Bayer Rule 6",
            "rule_type":       "degree_trigger",
        })
        rows.append((rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── BAY-R27: Mercury Speed Trigger ────────────────────────────────────────────

def generate_r27_mercury_speed(cur, rule_id: int) -> tuple[int, int]:
    """
    Detect when Mercury speed crosses either threshold:
      59min  = 0.9833°/day  (±0.05)
      1°58'  = 1.9667°/day  (±0.05)
    Guards against large speed jumps (retrograde entry/exit).
    """
    cur.execute("""
        WITH merc_speed AS (
            SELECT date, speed,
                   LAG(speed) OVER (ORDER BY date) AS prev_speed
            FROM km_planetary_positions
            WHERE planet = 'Mercury'
              AND date BETWEEN %s AND %s
        ),
        triggers AS (
            SELECT date, speed, prev_speed,
                CASE
                    WHEN (prev_speed < %s AND speed >= %s)
                      OR (prev_speed > %s AND speed <= %s)
                    THEN '59min'
                    WHEN (prev_speed < %s AND speed >= %s)
                      OR (prev_speed > %s AND speed <= %s)
                    THEN '1deg58min'
                END AS trigger_type
            FROM merc_speed
            WHERE prev_speed IS NOT NULL
              AND (
                  ABS(speed - %s) < %s
                  OR ABS(speed - %s) < %s
              )
            -- Guard: ignore large jumps (retrograde station artefacts)
            AND ABS(speed - prev_speed) < 0.3
        )
        SELECT date, speed, trigger_type
        FROM triggers
        WHERE trigger_type IS NOT NULL
        ORDER BY date
    """, (
        BACKFILL_FROM, BACKFILL_TO,
        # 59min crossing
        SPEED_59MIN, SPEED_59MIN, SPEED_59MIN, SPEED_59MIN,
        # 1°58' crossing
        SPEED_1D58MIN, SPEED_1D58MIN, SPEED_1D58MIN, SPEED_1D58MIN,
        # proximity filter
        SPEED_59MIN, SPEED_TOL,
        SPEED_1D58MIN, SPEED_TOL,
    ))

    rows = []
    for d, speed, trigger_type in cur.fetchall():
        snap = json.dumps({
            "mercury_speed": round(float(speed), 6),
            "trigger_type":  trigger_type,
            "rule":          "Bayer Rule 27",
            "rule_type":     "speed_trigger",
        })
        rows.append((rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── BAY-R14: Venus Longitude Unit Cycle ───────────────────────────────────────

def generate_r14_venus_longitude(cur, rule_id: int) -> tuple[int, int]:
    """
    Venus longitude unit = 1°9'13'' = 1.1536°.
    Detect each time Venus crosses a new integer multiple of this unit.
    Single-day point events — one per unit boundary crossed.
    """
    cur.execute("""
        WITH ven_pos AS (
            SELECT date, longitude,
                   FLOOR(longitude / %s) AS unit_count,
                   LAG(FLOOR(longitude / %s))
                     OVER (ORDER BY date) AS prev_unit
            FROM km_planetary_positions
            WHERE planet = 'Venus'
              AND date BETWEEN %s AND %s
        )
        SELECT date, longitude, unit_count
        FROM ven_pos
        WHERE unit_count IS DISTINCT FROM prev_unit
        ORDER BY date
    """, (VEN_UNIT, VEN_UNIT, BACKFILL_FROM, BACKFILL_TO))

    rows = []
    for d, longitude, unit_count in cur.fetchall():
        snap = json.dumps({
            "venus_longitude":   round(float(longitude), 4),
            "unit_count":        int(unit_count),
            "unit_size_degrees": round(VEN_UNIT, 6),
            "rule":              "Bayer Rule 14",
            "rule_type":         "longitude_unit",
        })
        rows.append((rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    all_rule_codes = [
        "BAY-R02-MAR-MER-SPD",
        "BAY-R03-VEN-RET",
        "BAY-R06-MAR-1635",
        "BAY-R27-MER-SPD",
        "BAY-R14-VEN-LON",
    ]

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:

                # Resolve rule IDs from DB
                rule_ids: dict[str, int] = {}
                missing: list[str] = []
                for code in all_rule_codes:
                    rid = lookup_rule_id(cur, code)
                    if rid:
                        rule_ids[code] = rid
                    else:
                        missing.append(code)

                if missing:
                    print("\n⚠  Rules not found in km_astro_rule_master:")
                    print("   Run km_migration_101_bayer_rules_seed.sql first.")
                    for m in missing:
                        print(f"   {m}")

                summary: dict[str, tuple[int, int]] = {}

                if "BAY-R02-MAR-MER-SPD" in rule_ids:
                    summary["BAY-R02-MAR-MER-SPD"] = generate_r02_speed_diff(
                        cur, rule_ids["BAY-R02-MAR-MER-SPD"]
                    )

                if "BAY-R03-VEN-RET" in rule_ids:
                    summary["BAY-R03-VEN-RET"] = generate_r03_venus_retro(
                        cur, rule_ids["BAY-R03-VEN-RET"]
                    )

                if "BAY-R06-MAR-1635" in rule_ids:
                    summary["BAY-R06-MAR-1635"] = generate_r06_mars_degree(
                        cur, rule_ids["BAY-R06-MAR-1635"]
                    )

                if "BAY-R27-MER-SPD" in rule_ids:
                    summary["BAY-R27-MER-SPD"] = generate_r27_mercury_speed(
                        cur, rule_ids["BAY-R27-MER-SPD"]
                    )

                if "BAY-R14-VEN-LON" in rule_ids:
                    summary["BAY-R14-VEN-LON"] = generate_r14_venus_longitude(
                        cur, rule_ids["BAY-R14-VEN-LON"]
                    )

        # Print summary
        print()
        print(f"  {'Rule':<24}  {'Inserted':>8}  {'Skipped':>8}")
        print(f"  {'─' * 24}  {'─' * 8}  {'─' * 8}")

        total_ins = total_skp = 0
        for code in all_rule_codes:
            ins, skp = summary.get(code, (0, 0))
            total_ins += ins
            total_skp += skp
            status = "⚠  not found" if code not in rule_ids else ""
            print(f"  {code:<24}  {ins:>8}  {skp:>8}  {status}")

        print(f"  {'─' * 24}  {'─' * 8}  {'─' * 8}")
        print(f"  {'TOTAL':<24}  {total_ins:>8}  {total_skp:>8}")
        print(f"  Date range: {BACKFILL_FROM} to {BACKFILL_TO}")
        print()

    finally:
        conn.close()


if __name__ == "__main__":
    main()
