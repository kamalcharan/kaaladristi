"""
generate_venus_windows.py

Requires migration 235. Generate Venus rule transit windows from km_planetary_positions
and reconcile the canonical identities in km_rule_transits.

Rules generated:
  Canonical motion, combustion and Mercury/Venus conjunction windows via
  migration 235 refresh_venus_event_windows(); stations are NOT visibility rise.
  3. DN-MON-VEN-BEA     — Monday + Venus nakshatra
  4. DN-TUE-VEN-BUL     — Tuesday + Venus nakshatra
  5. DN-WED-VEN-VOL     — Wednesday + Venus nakshatra
  6. DN-THU-VEN-BEA     — Thursday + Venus nakshatra
  7. DN-FRI-VEN-BUL     — Friday + Venus nakshatra

Date range: 1990-01-01 to 2030-12-31
UNIQUE constraint: uq_rule_transits_rule_start (rule_id, start_date)
Canonical events use the migration's transactional refresh. The separate
weekday/nakshatra rules use ON CONFLICT (rule_id, start_date) DO NOTHING.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_venus_windows.py

DO NOT RUN AUTOMATICALLY — one-shot backfill + forward fill.
"""

import os
import sys
import json
import psycopg2
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from lib.venus_identity import refresh_venus_data


# ── DB connection ──────────────────────────────────────────────────────────────

def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Constants ──────────────────────────────────────────────────────────────────

BACKFILL_FROM = date(1990, 1, 1)
BACKFILL_TO   = date(2030, 12, 31)

# Nakshatras whose lord is Venus
VENUS_NAKSHATRAS = ('Bharani', 'Purva Phalguni', 'Purva Ashadha')

# Nakshatra-Vara rule codes → day-of-week (DOW: Sunday=0 … Saturday=6)
NAKSHATRA_VARA_RULES = {
    'DN-MON-VEN-BEA': 1,
    'DN-TUE-VEN-BUL': 2,
    'DN-WED-VEN-VOL': 3,
    'DN-THU-VEN-BEA': 4,
    'DN-FRI-VEN-BUL': 5,
}

DOW_NAMES = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday"}


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


# ── Rules 3–7: Venus Nakshatra-Vara ───────────────────────────────────────────

def generate_nakshatra_vara(cur, rule_id: int, dow: int) -> tuple[int, int]:
    cur.execute("""
        SELECT date, nakshatra_name
        FROM km_planetary_positions
        WHERE planet = 'Moon'
          AND nakshatra_name = ANY(%s)
          AND EXTRACT(DOW FROM date)::integer = %s
          AND date BETWEEN %s AND %s
        ORDER BY date
    """, (list(VENUS_NAKSHATRAS), dow, BACKFILL_FROM, BACKFILL_TO))

    rows = []
    for (d, nakshatra_name) in cur.fetchall():
        snap = json.dumps({
            "vara": DOW_NAMES[dow],
            "nakshatra_lord": "Venus",
            "moon_nakshatra": nakshatra_name,
            "rule_type": "nakshatra_vara",
        })
        rows.append((rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    all_rule_codes = [
        *NAKSHATRA_VARA_RULES.keys(),
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
                    print("\n⚠  Rules not found in km_astro_rule_master — skipping:")
                    for m in missing:
                        print(f"   {m}")

                summary: dict[str, tuple[int, int]] = {}

                # One owner for all seven Venus/conjunction identities.
                changed = refresh_venus_data(cur)
                print(f"  Canonical Venus/conjunction rows changed: {changed}")

                for code, dow in NAKSHATRA_VARA_RULES.items():
                    if code in rule_ids:
                        summary[code] = generate_nakshatra_vara(
                            cur, rule_ids[code], dow
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
