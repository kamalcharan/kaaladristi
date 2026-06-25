"""
generate_panchak_windows.py

Compute Panchak windows from km_planetary_positions (Moon nakshatra)
and insert them into km_rule_transits.

Panchak = Moon in nakshatra 22 (pada 3 or 4) or nakshatras 23–26
  (Dhanishta pada 3/4, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada,
   Revati — but Revati is nakshatra 27, so effective range is 22p3–26).

Rule assignment logic:
  1. Yoga override (check km_daily_panchang for window start_date):
       Indra / Eindra  → rule_id 78
       Vyatipata       → rule_id 80
       Vaidhrati       → rule_id 79
  2. Day-of-week fallback:
       Mon→71, Tue→75, Wed→72, Thu→76, Fri→73, Sat→77, Sun→74

  Two rows inserted per window:
    Row 1 — specific rule (yoga or day-of-week)
    Row 2 — ALL5 rule based on base_bias of Row 1:
               bullish → rule_id 66 (PNK-ALL5-BUL)
               bearish → rule_id 67 (PNK-ALL5-BEA)
               other   → rule_id 66 (default)

Run:
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 generate_panchak_windows.py

DO NOT RUN AUTOMATICALLY — one-shot backfill + forward fill.
"""

import os
import sys
import json
import psycopg2
import psycopg2.extras
from datetime import date, timedelta
from collections import defaultdict

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

# Yoga → rule_id overrides (checked first)
YOGA_RULE_MAP = {
    'indra':      78,
    'eindra':     78,
    'vyatipata':  80,
    'vyatipath':  80,
    'vaidhrati':  79,
    'vaidhriti':  79,
}

# Day-of-week fallback rule IDs (Monday=0 … Sunday=6)
DOW_RULE_MAP = {
    0: 71,   # Monday    — bearish
    1: 75,   # Tuesday   — bullish
    2: 72,   # Wednesday — bearish
    3: 76,   # Thursday  — bullish
    4: 73,   # Friday    — bearish
    5: 77,   # Saturday  — bullish
    6: 74,   # Sunday    — bullish
}

DOW_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

ALL5_BULLISH = 66   # PNK-ALL5-BUL
ALL5_BEARISH = 67   # PNK-ALL5-BEA

# ── Step 1: Compute Panchak windows ───────────────────────────────────────────

WINDOW_SQL = """
WITH panchak_days AS (
  SELECT
    date,
    nakshatra_name,
    nakshatra_pada,
    CASE
      WHEN nakshatra = 22 AND nakshatra_pada >= 3 THEN true
      WHEN nakshatra BETWEEN 23 AND 26           THEN true
      ELSE false
    END AS in_panchak
  FROM km_planetary_positions
  WHERE planet = 'Moon'
    AND date BETWEEN %s AND %s
  ORDER BY date
),
flagged AS (
  SELECT
    date,
    nakshatra_name,
    nakshatra_pada,
    in_panchak,
    date - ROW_NUMBER() OVER (
      PARTITION BY in_panchak ORDER BY date
    )::integer AS grp
  FROM panchak_days
  WHERE in_panchak = true
)
SELECT
  MIN(date)         AS start_date,
  MAX(date)         AS end_date,
  MAX(date) - MIN(date) + 1 AS duration_days,
  MIN(nakshatra_name) AS start_nakshatra
FROM flagged
GROUP BY grp
ORDER BY start_date;
"""

def fetch_windows(conn) -> list[dict]:
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(WINDOW_SQL, (BACKFILL_FROM, BACKFILL_TO))
    rows = cur.fetchall()
    cur.close()
    print(f"  Panchak windows found: {len(rows)}")
    return [dict(r) for r in rows]

# ── Step 2: Yoga lookup ────────────────────────────────────────────────────────

def fetch_panchang_map(conn, start_dates: list[date]) -> dict[date, str]:
    """Return {date: yoga_name} for all window start dates."""
    if not start_dates:
        return {}
    cur = conn.cursor()
    cur.execute("""
        SELECT date, yoga_name
        FROM km_daily_panchang
        WHERE date = ANY(%s)
    """, (list(start_dates),))
    rows = cur.fetchall()
    cur.close()
    return {row[0]: row[1] for row in rows if row[1]}

# ── Step 3: base_bias lookup for ALL5 rule resolution ─────────────────────────

def fetch_base_bias_map(conn, rule_ids: set[int]) -> dict[int, str]:
    """Return {rule_id: base_bias} for the given set of specific rule IDs."""
    if not rule_ids:
        return {}
    cur = conn.cursor()
    cur.execute("""
        SELECT id, base_bias
        FROM km_astro_rule_master
        WHERE id = ANY(%s)
    """, (list(rule_ids),))
    rows = cur.fetchall()
    cur.close()
    return {row[0]: (row[1] or '') for row in rows}

# ── Step 4: Insert ─────────────────────────────────────────────────────────────

INSERT_SQL = """
INSERT INTO km_rule_transits
  (rule_id, start_date, end_date, conditions_snapshot)
VALUES
  (%(rule_id)s, %(start_date)s, %(end_date)s, %(conditions_snapshot)s)
ON CONFLICT (rule_id, start_date) DO NOTHING;
"""

def build_snapshot(window: dict, vara: str, yoga: str | None, rule_type: str) -> str:
    return json.dumps({
        "panchak_start_nakshatra": window["start_nakshatra"],
        "panchak_start_vara":      vara,
        "panchak_yoga":            yoga,
        "panchak_rule_type":       rule_type,
    })

def insert_windows(conn, windows: list[dict], panchang_map: dict, bias_map: dict) -> dict:
    stats = {
        "specific_inserted": 0,
        "all5_inserted":     0,
        "skipped":           0,
        "yoga_overrides":    0,
        "by_dow":            defaultdict(int),
    }

    cur = conn.cursor()

    for w in windows:
        start: date  = w["start_date"]
        end: date    = w["end_date"]
        dur: int     = w["duration_days"]

        dow = start.weekday()                           # 0=Mon
        vara = DOW_NAMES[dow]
        yoga_name = panchang_map.get(start)             # may be None

        # Resolve specific rule
        specific_rule_id = None
        rule_type_label  = "vara"

        if yoga_name:
            key = yoga_name.lower().strip()
            for kw, rid in YOGA_RULE_MAP.items():
                if kw in key:
                    specific_rule_id = rid
                    rule_type_label  = "yoga"
                    stats["yoga_overrides"] += 1
                    break

        if specific_rule_id is None:
            specific_rule_id = DOW_RULE_MAP[dow]
            stats["by_dow"][vara] += 1

        snapshot = build_snapshot(w, vara, yoga_name, rule_type_label)

        # Row 1 — specific rule
        cur.execute(INSERT_SQL, {
            "rule_id":              specific_rule_id,
            "start_date":           start,
            "end_date":             end,
            "conditions_snapshot":  snapshot,
        })
        if cur.rowcount:
            stats["specific_inserted"] += 1
        else:
            stats["skipped"] += 1

        # Row 2 — ALL5 rule
        bias = bias_map.get(specific_rule_id, '').lower()
        all5_id = ALL5_BULLISH if 'bullish' in bias else ALL5_BEARISH if 'bearish' in bias else ALL5_BULLISH

        cur.execute(INSERT_SQL, {
            "rule_id":              all5_id,
            "start_date":           start,
            "end_date":             end,
            "conditions_snapshot":  snapshot,
        })
        if cur.rowcount:
            stats["all5_inserted"] += 1
        else:
            stats["skipped"] += 1

    conn.commit()
    cur.close()
    return stats

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print(f"Panchak window generator — {BACKFILL_FROM} to {BACKFILL_TO}")
    conn = get_conn()

    print("Step 1: Computing Panchak windows from km_planetary_positions...")
    windows = fetch_windows(conn)
    if not windows:
        print("  No windows found — check km_planetary_positions data range.")
        conn.close()
        return

    start_dates = [w["start_date"] for w in windows]

    print("Step 2: Looking up yoga names from km_daily_panchang...")
    panchang_map = fetch_panchang_map(conn, start_dates)
    print(f"  Panchang rows matched: {len(panchang_map)} / {len(start_dates)}")

    print("Step 3: Fetching base_bias for specific rule IDs...")
    all_specific_ids: set[int] = set()
    for w in windows:
        dow = w["start_date"].weekday()
        yoga = panchang_map.get(w["start_date"])
        rid = DOW_RULE_MAP[dow]
        if yoga:
            for kw, yoga_rid in YOGA_RULE_MAP.items():
                if kw in yoga.lower():
                    rid = yoga_rid
                    break
        all_specific_ids.add(rid)
    bias_map = fetch_base_bias_map(conn, all_specific_ids)
    print(f"  Bias map entries: {len(bias_map)}")

    print("Step 4: Inserting into km_rule_transits...")
    stats = insert_windows(conn, windows, panchang_map, bias_map)

    conn.close()

    # Summary
    all_dates = [w["start_date"] for w in windows]
    print()
    print("=" * 55)
    print("SUMMARY")
    print("=" * 55)
    print(f"  Total windows found        : {len(windows)}")
    print(f"  Rows inserted (specific)   : {stats['specific_inserted']}")
    print(f"  Rows inserted (ALL5)       : {stats['all5_inserted']}")
    print(f"  Rows skipped (ON CONFLICT) : {stats['skipped']}")
    print(f"  Date range                 : {min(all_dates)} to {max(all_dates)}")
    print(f"  Windows with yoga override : {stats['yoga_overrides']}")
    print("  Windows by day of week:")
    for day in DOW_NAMES:
        count = stats["by_dow"].get(day, 0)
        if count:
            print(f"    {day:<12}: {count}")
    print("=" * 55)


if __name__ == "__main__":
    main()
