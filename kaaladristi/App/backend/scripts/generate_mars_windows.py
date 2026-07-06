"""
generate_mars_windows.py

Generate Mars rule transit windows from km_planetary_positions
and insert into km_rule_transits (ON CONFLICT DO NOTHING).

Rules generated:
  1. TR-MAR-RET        — Plain Mars retrograde windows (motion almanac, migration 128)
  2. TRN-MAR-MAN-TRN   — Mars sign transit windows (Journey of Mars, migration 128)

Mars Gandanta windows (MAR-GAN-*) are generated separately by
generate_gandanta_windows.py — not duplicated here.

Date range: 1990-01-01 to 2030-12-31
UNIQUE constraint: uq_rule_transits_rule_start (rule_id, start_date)
All inserts use ON CONFLICT (rule_id, start_date) DO NOTHING.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_mars_windows.py

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
    """Insert rows, return (inserted, skipped)."""
    inserted = 0
    skipped  = 0
    for row in rows:
        cur.execute(INSERT_SQL, row)
        if cur.rowcount == 1:
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped


# ── Window detection: island pattern ──────────────────────────────────────────

def detect_islands(cur, planet: str, flag_col: str) -> list[dict]:
    """
    Detect contiguous date islands where planet.flag_col = true.
    Returns list of {start_date, end_date}.
    """
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


# ── Rule 1: Plain Mars Retrograde (motion almanac) ────────────────────────────

def generate_plain_retrograde(cur, rule_id: int) -> tuple[int, int]:
    windows = detect_islands(cur, "Mars", "retrograde")
    rows = []
    for w in windows:
        snap = json.dumps({
            "event": "mars_retrograde",
            "rule_type": "retrograde",
        })
        rows.append((rule_id, w["start_date"], w["end_date"], snap))
    return bulk_insert(cur, rows)


# ── Rule 2: Mars Sign Transits (Journey of Mars) ──────────────────────────────

def generate_sign_transits(cur, rule_id: int) -> tuple[int, int]:
    cur.execute("""
        WITH sign_changes AS (
            SELECT date, sign_name,
                   LAG(sign_name) OVER (ORDER BY date) AS prev_sign
            FROM km_planetary_positions
            WHERE planet = 'Mars'
              AND date BETWEEN %s AND %s
        ),
        entries AS (
            SELECT date AS start_date, sign_name
            FROM sign_changes
            WHERE sign_name IS DISTINCT FROM prev_sign
        )
        SELECT
            e.start_date,
            e.sign_name,
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

    rows = []
    for r in cur.fetchall():
        start_date, sign_name, end_date = r
        snap = json.dumps({
            "sign": sign_name,
            "rule_type": "sign_transit",
        })
        rows.append((rule_id, start_date, end_date, snap))
    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:

                all_rule_codes = ["TR-MAR-RET", "TRN-MAR-MAN-TRN"]
                rule_ids: dict[str, int] = {}
                missing: list[str] = []
                for code in all_rule_codes:
                    rid = lookup_rule_id(cur, code)
                    if rid:
                        rule_ids[code] = rid
                    else:
                        missing.append(code)

                if missing:
                    print(f"\n⚠  Rules not found in km_astro_rule_master — skipping:")
                    for m in missing:
                        print(f"   {m}")

                summary: dict[str, tuple[int, int]] = {}

                if "TR-MAR-RET" in rule_ids:
                    summary["TR-MAR-RET"] = generate_plain_retrograde(
                        cur, rule_ids["TR-MAR-RET"]
                    )

                if "TRN-MAR-MAN-TRN" in rule_ids:
                    summary["TRN-MAR-MAN-TRN"] = generate_sign_transits(
                        cur, rule_ids["TRN-MAR-MAN-TRN"]
                    )

        print()
        print(f"  {'Rule':<20}  {'Inserted':>8}  {'Skipped':>8}")
        print(f"  {'─' * 20}  {'─' * 8}  {'─' * 8}")

        total_ins = total_skp = 0
        for code in all_rule_codes:
            ins, skp = summary.get(code, (0, 0))
            total_ins += ins
            total_skp += skp
            status = "⚠  not found" if code not in rule_ids else ""
            print(f"  {code:<20}  {ins:>8}  {skp:>8}  {status}")

        print(f"  {'─' * 20}  {'─' * 8}  {'─' * 8}")
        print(f"  {'TOTAL':<20}  {total_ins:>8}  {total_skp:>8}")
        print(f"  Date range: {BACKFILL_FROM} to {BACKFILL_TO}")
        print()

    finally:
        conn.close()


if __name__ == "__main__":
    main()
