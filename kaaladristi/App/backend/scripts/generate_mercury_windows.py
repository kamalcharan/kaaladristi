"""
generate_mercury_windows.py

Generate Mercury rule transit windows from km_planetary_positions
and insert into km_rule_transits (ON CONFLICT DO NOTHING).

Rules generated:
  0. TR-MER-RET          — Plain Mercury retrograde windows (motion almanac, migration 127)
  1. TR-JUP-MER-RET-BUL  — Mercury retrograde windows (+ Jupiter also retrograde)
  2. TR-MER-VEN-RET-BUL  — Mercury retrograde windows where Venus also retrograde
  3. TR-MER-CMB-E-BEA    — Mercury combust windows
  4. TRN-MER-MAN-TRN     — Mercury sign transit windows
  5. TRN-MER-RIS-W-BUL   — Mercury station-direct (rise in west) — single-day
  6. DN-MON-MER-BUL      — Monday + Mercury nakshatra
  7. DN-TUE-MER-BEA      — Tuesday + Mercury nakshatra
  8. DN-WED-MER-BUL      — Wednesday + Mercury nakshatra
  9. DN-THU-MER-VOL      — Thursday + Mercury nakshatra
  10. DN-FRI-MER-VOL     — Friday + Mercury nakshatra

Date range: 1990-01-01 to 2030-12-31
UNIQUE constraint: uq_rule_transits_rule_start (rule_id, start_date)
All inserts use ON CONFLICT (rule_id, start_date) DO NOTHING.

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_mercury_windows.py

DO NOT RUN AUTOMATICALLY — one-shot backfill + forward fill.
"""

import os
import sys
import json
import psycopg2
import psycopg2.extras
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

# Nakshatras whose lord is Mercury
MERCURY_NAKSHATRAS = ('Ashlesha', 'Jyeshtha', 'Revati')

# Nakshatra-Vara rule codes → day-of-week (DOW: Monday=0 … Sunday=6)
NAKSHATRA_VARA_RULES = {
    'DN-MON-MER-BUL': 0,
    'DN-TUE-MER-BEA': 1,
    'DN-WED-MER-BUL': 2,
    'DN-THU-MER-VOL': 3,
    'DN-FRI-MER-VOL': 4,
}


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
    before = cur.rowcount if cur.rowcount >= 0 else 0
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


def fetch_retrograde_windows(cur, planet: str) -> list[dict]:
    """Return retrograde island windows for the given planet."""
    return detect_islands(cur, planet, "retrograde")


def windows_overlap(a_start, a_end, b_start, b_end) -> bool:
    return max(a_start, b_start) <= min(a_end, b_end)


# ── Rule 1 & 2: Mercury Retrograde (plain + co-retrograde) ────────────────────

def generate_retrograde(cur, rule_ids: dict) -> dict[str, tuple[int, int]]:
    merc_windows   = fetch_retrograde_windows(cur, "Mercury")
    venus_windows  = fetch_retrograde_windows(cur, "Venus")
    jupiter_windows = fetch_retrograde_windows(cur, "Jupiter")

    results = {code: (0, 0) for code in rule_ids}

    # TR-JUP-MER-RET-BUL — Mercury retrograde AND Jupiter retrograde overlap
    rule_code_jup = "TR-JUP-MER-RET-BUL"
    rid_jup = rule_ids.get(rule_code_jup)
    if rid_jup:
        rows = []
        for w in merc_windows:
            overlapping_jup = [
                j for j in jupiter_windows
                if windows_overlap(w["start_date"], w["end_date"], j["start_date"], j["end_date"])
            ]
            if not overlapping_jup:
                continue
            # Clip to actual overlap period
            for j in overlapping_jup:
                ov_start = max(w["start_date"], j["start_date"])
                ov_end   = min(w["end_date"],   j["end_date"])
                snap = json.dumps({
                    "mercury_retrograde_start": str(w["start_date"]),
                    "mercury_retrograde_end":   str(w["end_date"]),
                    "co_planet": "Jupiter",
                    "rule_type": "retrograde",
                })
                rows.append((rid_jup, ov_start, ov_end, snap))
        results[rule_code_jup] = bulk_insert(cur, rows)

    # TR-MER-VEN-RET-BUL — Mercury retrograde AND Venus retrograde overlap
    rule_code_ven = "TR-MER-VEN-RET-BUL"
    rid_ven = rule_ids.get(rule_code_ven)
    if rid_ven:
        rows = []
        for w in merc_windows:
            overlapping_ven = [
                v for v in venus_windows
                if windows_overlap(w["start_date"], w["end_date"], v["start_date"], v["end_date"])
            ]
            if not overlapping_ven:
                continue
            for v in overlapping_ven:
                ov_start = max(w["start_date"], v["start_date"])
                ov_end   = min(w["end_date"],   v["end_date"])
                snap = json.dumps({
                    "mercury_retrograde_start": str(w["start_date"]),
                    "mercury_retrograde_end":   str(w["end_date"]),
                    "co_planet": "Venus",
                    "rule_type": "retrograde",
                })
                rows.append((rid_ven, ov_start, ov_end, snap))
        results[rule_code_ven] = bulk_insert(cur, rows)

    return results


# ── Rule 0: Plain Mercury Retrograde (motion almanac) ─────────────────────────

def generate_plain_retrograde(cur, rule_id: int) -> tuple[int, int]:
    windows = fetch_retrograde_windows(cur, "Mercury")
    rows = []
    for w in windows:
        snap = json.dumps({
            "event": "mercury_retrograde",
            "rule_type": "retrograde",
        })
        rows.append((rule_id, w["start_date"], w["end_date"], snap))
    return bulk_insert(cur, rows)


# ── Rule 3: Mercury Combust ────────────────────────────────────────────────────

def generate_combust(cur, rule_id: int) -> tuple[int, int]:
    windows = detect_islands(cur, "Mercury", "combust")
    rows = []
    for w in windows:
        snap = json.dumps({
            "combust_start": str(w["start_date"]),
            "combust_end":   str(w["end_date"]),
            "rule_type": "combust",
        })
        rows.append((rule_id, w["start_date"], w["end_date"], snap))
    return bulk_insert(cur, rows)


# ── Rule 4: Mercury Sign Transits ─────────────────────────────────────────────

def generate_sign_transits(cur, rule_id: int) -> tuple[int, int]:
    cur.execute("""
        WITH sign_changes AS (
            SELECT date, sign_name,
                   LAG(sign_name) OVER (ORDER BY date) AS prev_sign
            FROM km_planetary_positions
            WHERE planet = 'Mercury'
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


# ── Rule 5: Mercury Station Direct (Rise in West) ─────────────────────────────

def generate_station_direct(cur, rule_id: int) -> tuple[int, int]:
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
        snap = json.dumps({
            "event": "mercury_station_direct",
            "rule_type": "manifestation",
        })
        rows.append((rule_id, start_date, start_date, snap))
    return bulk_insert(cur, rows)


# ── Rule 6–10: Mercury Nakshatra-Vara ─────────────────────────────────────────

def generate_nakshatra_vara(cur, rule_code: str, rule_id: int, dow: int) -> tuple[int, int]:
    cur.execute("""
        SELECT date, nakshatra_name
        FROM km_planetary_positions
        WHERE planet = 'Moon'
          AND nakshatra_name = ANY(%s)
          AND EXTRACT(DOW FROM date)::integer = %s
          AND date BETWEEN %s AND %s
        ORDER BY date
    """, (list(MERCURY_NAKSHATRAS), dow, BACKFILL_FROM, BACKFILL_TO))

    dow_names = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}
    rows = []
    for (d, nakshatra_name) in cur.fetchall():
        snap = json.dumps({
            "vara": dow_names[dow],
            "nakshatra_lord": "Mercury",
            "moon_nakshatra": nakshatra_name,
            "rule_type": "nakshatra_vara",
        })
        rows.append((rule_id, d, d, snap))
    return bulk_insert(cur, rows)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:

                # ── Resolve all rule IDs from DB ──────────────────────────────
                all_rule_codes = [
                    "TR-MER-RET",
                    "TR-JUP-MER-RET-BUL",
                    "TR-MER-VEN-RET-BUL",
                    "TR-MER-CMB-E-BEA",
                    "TRN-MER-MAN-TRN",
                    "TRN-MER-RIS-W-BUL",
                    *NAKSHATRA_VARA_RULES.keys(),
                ]
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

                # ── Generate windows ──────────────────────────────────────────
                summary: dict[str, tuple[int, int]] = {}

                # Rule 0: Plain retrograde (motion almanac)
                if "TR-MER-RET" in rule_ids:
                    summary["TR-MER-RET"] = generate_plain_retrograde(
                        cur, rule_ids["TR-MER-RET"]
                    )

                # Rules 1 & 2: Co-retrograde combinations
                retro_ids = {
                    c: rule_ids[c]
                    for c in ("TR-JUP-MER-RET-BUL", "TR-MER-VEN-RET-BUL")
                    if c in rule_ids
                }
                if retro_ids:
                    summary.update(generate_retrograde(cur, retro_ids))

                # Rule 3: Combust
                if "TR-MER-CMB-E-BEA" in rule_ids:
                    summary["TR-MER-CMB-E-BEA"] = generate_combust(
                        cur, rule_ids["TR-MER-CMB-E-BEA"]
                    )

                # Rule 4: Sign transits
                if "TRN-MER-MAN-TRN" in rule_ids:
                    summary["TRN-MER-MAN-TRN"] = generate_sign_transits(
                        cur, rule_ids["TRN-MER-MAN-TRN"]
                    )

                # Rule 5: Station direct
                if "TRN-MER-RIS-W-BUL" in rule_ids:
                    summary["TRN-MER-RIS-W-BUL"] = generate_station_direct(
                        cur, rule_ids["TRN-MER-RIS-W-BUL"]
                    )

                # Rules 6–10: Nakshatra-Vara
                for code, dow in NAKSHATRA_VARA_RULES.items():
                    if code in rule_ids:
                        summary[code] = generate_nakshatra_vara(
                            cur, code, rule_ids[code], dow
                        )

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
        print()

    finally:
        conn.close()


if __name__ == "__main__":
    main()
