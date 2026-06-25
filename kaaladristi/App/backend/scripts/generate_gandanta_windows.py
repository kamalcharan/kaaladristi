"""
generate_gandanta_windows.py

Generate Mars Gandanta transit windows from km_planetary_positions
and insert into km_rule_transits (ON CONFLICT DO NOTHING).

Gandanta zones — water/fire sign junctions:
  Cancer exit  (28°-30° Cancer)   → MAR-GAN-CAN-BEA
  Leo entry    (0°-1° Leo)        → MAR-GAN-LEO-REV
  Scorpio exit (28°-30° Scorpio)  → MAR-GAN-SCO-BEA
  Sag entry    (0°-1° Sag)        → MAR-GAN-SAG-REV
  Pisces exit  (28°-30° Pisces)   → MAR-GAN-PIS-BEA
  Aries entry  (0°-1° Aries)      → MAR-GAN-ARI-REV

Date range: 1990-01-01 to 2030-12-31
UNIQUE constraint: uq_rule_transits_rule_start (rule_id, start_date)
All inserts use ON CONFLICT (rule_id, start_date) DO NOTHING.

Prerequisite: Run km_migration_102_gandanta_rules_seed.sql first.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_gandanta_windows.py

DO NOT RUN AUTOMATICALLY — one-shot backfill + forward fill.
"""

import os
import sys
import json
import psycopg2
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


# ── DB connection ──────────────────────────────────────────────────────────────

def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Constants ──────────────────────────────────────────────────────────────────

BACKFILL_FROM = date(1990, 1, 1)
BACKFILL_TO   = date(2030, 12, 31)

# Each rule: (rule_code, sign_name, min_deg, max_deg, gandanta_type, long_range_label)
# degree_in_sign = MOD(longitude, 30)
# Exit rules: degree >= min_deg  (28° to 30°)
# Entry rules: degree <= max_deg (0° to 1°)
GANDANTA_RULES = [
    ("MAR-GAN-CAN-BEA", "Cancer",      28.0, 30.0, "exit",  "118-120"),
    ("MAR-GAN-LEO-REV", "Leo",          0.0,  1.0, "entry", "120-121"),
    ("MAR-GAN-SCO-BEA", "Scorpio",     28.0, 30.0, "exit",  "238-240"),
    ("MAR-GAN-SAG-REV", "Sagittarius",  0.0,  1.0, "entry", "240-241"),
    ("MAR-GAN-PIS-BEA", "Pisces",      28.0, 30.0, "exit",  "358-360"),
    ("MAR-GAN-ARI-REV", "Aries",        0.0,  1.0, "entry", "0-1"),
]


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


# ── Window generator ───────────────────────────────────────────────────────────

def generate_gandanta_windows(
    cur,
    rule_id: int,
    rule_code: str,
    sign_name: str,
    min_deg: float,
    max_deg: float,
    gandanta_type: str,
    long_range_label: str,
) -> tuple[int, int]:
    """
    Island pattern: group consecutive days where Mars is in the Gandanta zone
    for the given sign and degree band.

    Exit rules (type='exit'): degree_in_sign >= min_deg  (28°-30°)
    Entry rules (type='entry'): degree_in_sign <= max_deg (0°-1°)

    degree_in_sign = MOD(longitude::numeric, 30)
    """
    if gandanta_type == "exit":
        degree_filter = "AND MOD(longitude::numeric, 30) >= %(min_deg)s"
    else:
        degree_filter = "AND MOD(longitude::numeric, 30) <= %(max_deg)s"

    sql = f"""
        WITH gandanta_days AS (
            SELECT
                date,
                date - (ROW_NUMBER() OVER (ORDER BY date))::integer AS grp
            FROM km_planetary_positions
            WHERE planet = 'Mars'
              AND sign_name = %(sign_name)s
              {degree_filter}
              AND date BETWEEN %(from_date)s AND %(to_date)s
        )
        SELECT
            MIN(date) AS start_date,
            MAX(date) AS end_date,
            (MAX(date) - MIN(date) + 1) AS duration_days
        FROM gandanta_days
        GROUP BY grp
        ORDER BY start_date
    """

    cur.execute(sql, {
        "sign_name": sign_name,
        "min_deg":   min_deg,
        "max_deg":   max_deg,
        "from_date": BACKFILL_FROM,
        "to_date":   BACKFILL_TO,
    })

    rows = []
    for start_date, end_date, duration_days in cur.fetchall():
        snap = json.dumps({
            "planet":           "Mars",
            "gandanta_type":    gandanta_type,
            "sign":             sign_name,
            "longitude_range":  long_range_label,
            "rule_type":        "gandanta",
            "duration_days":    int(duration_days),
        })
        rows.append((rule_id, start_date, end_date, snap))

    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:

                # Resolve rule IDs from DB
                rule_ids: dict[str, int] = {}
                missing: list[str] = []
                for rule_code, *_ in GANDANTA_RULES:
                    rid = lookup_rule_id(cur, rule_code)
                    if rid:
                        rule_ids[rule_code] = rid
                    else:
                        missing.append(rule_code)

                if missing:
                    print("\n⚠  Rules not found in km_astro_rule_master:")
                    print("   Run km_migration_102_gandanta_rules_seed.sql first.")
                    for m in missing:
                        print(f"   {m}")
                    if len(missing) == len(GANDANTA_RULES):
                        return

                summary: dict[str, tuple[int, int]] = {}

                for rule_code, sign_name, min_deg, max_deg, gandanta_type, long_range_label in GANDANTA_RULES:
                    if rule_code not in rule_ids:
                        continue
                    ins, skp = generate_gandanta_windows(
                        cur,
                        rule_ids[rule_code],
                        rule_code,
                        sign_name,
                        min_deg,
                        max_deg,
                        gandanta_type,
                        long_range_label,
                    )
                    summary[rule_code] = (ins, skp)

        # Print summary
        print()
        print(f"  {'Rule':<24}  {'Inserted':>8}  {'Skipped':>8}")
        print(f"  {'─' * 24}  {'─' * 8}  {'─' * 8}")

        total_ins = total_skp = 0
        for rule_code, *_ in GANDANTA_RULES:
            ins, skp = summary.get(rule_code, (0, 0))
            total_ins += ins
            total_skp += skp
            status = "⚠  not found" if rule_code not in rule_ids else ""
            print(f"  {rule_code:<24}  {ins:>8}  {skp:>8}  {status}")

        print(f"  {'─' * 24}  {'─' * 8}  {'─' * 8}")
        print(f"  {'TOTAL':<24}  {total_ins:>8}  {total_skp:>8}")
        print(f"  Date range: {BACKFILL_FROM} to {BACKFILL_TO}")
        print()

    finally:
        conn.close()


if __name__ == "__main__":
    main()
