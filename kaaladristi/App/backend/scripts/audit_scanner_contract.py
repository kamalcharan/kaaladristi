"""
Scanner contract completeness audit — every preset x every dimension.
=====================================================================
The audit that should have run before migration 174, made repeatable.

Migration 174/175/176 recreated km_scan_results three times and a
five-column gap survived every check, because every check was
self-referential (syntax parses, UNION arms agree, EXPLAIN resolves).
None asked whether the OUTPUT satisfied its CONSUMER. This does.

Dimensions, per preset:
  1. columns   — every column the UI renders exists in the source AND is
                 populated for at least one row
  2. universe  — rows respect kd_scan_presets.universe
  3. liquidity — rows clear the platform floor (Rs 1 Cr/day)
  4. vani      — a declared vani_rule actually produces flags
  5. limits    — row count <= result_limit

Usage:
    cd App/backend && python scripts/audit_scanner_contract.py
Exit code 0 = every cell green; 1 = at least one defect.
See docs/claude/scanner-integrity-poa.md.
"""

import os
import sys
from datetime import date

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from lib.integrity_checks import (MATVIEW_PRESET_COLUMNS, MIN_AVG_AMT_22D_CR,
                                  MATVIEW_SERVED_PRESETS, measure_liquidity)


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def main():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT a.attname AS c FROM pg_attribute a
        JOIN pg_class k ON k.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = k.relnamespace
        WHERE k.relname='km_scan_results' AND n.nspname='public'
          AND a.attnum>0 AND NOT a.attisdropped
    """)
    matview_cols = {r['c'] for r in cur.fetchall()}

    # A matview that exists but was never refreshed makes every preset query
    # below raise ("has not been populated"). That is not an audit crash — it
    # is the loudest possible defect: every matview-backed scanner is empty.
    # Migration 180 creates it WITH NO DATA, so this is the exact state the
    # owner is in between running the migration and the REFRESH.
    cur.execute("""
        SELECT c.relispopulated FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname='km_scan_results' AND n.nspname='public'
    """)
    pop = cur.fetchone()
    if pop is None:
        print('DEFECT: km_scan_results does not exist — run migration 180.')
        sys.exit(1)
    if not pop['relispopulated']:
        print('DEFECT: km_scan_results exists but has never been populated —')
        print('        every matview-backed scanner returns zero rows.')
        print('        Run:  REFRESH MATERIALIZED VIEW km_scan_results;')
        print('              REFRESH MATERIALIZED VIEW km_scan_exclusion_counts;')
        print('        then re-run this audit.')
        sys.exit(1)

    cur.execute("""
        SELECT p.id, p.universe, p.vani_rule, p.result_limit,
               (SELECT COUNT(*) FROM km_scan_results r WHERE r.preset_id=p.id) AS rows,
               (SELECT COUNT(*) FROM km_scan_results r WHERE r.preset_id=p.id AND r.exchange='BSE') AS bse,
               (SELECT COUNT(*) FROM km_scan_results r WHERE r.preset_id=p.id AND r.vani_flag) AS vani
        FROM kd_scan_presets p WHERE p.is_active ORDER BY p.sort_order, p.id
    """)
    presets = cur.fetchall()

    # Liquidity is measured per preset on ITS OWN yardstick — combined-exchange
    # ADV for the WG family, live-EOD fallback for arms that emit NULL for
    # avg_amt_22d. Shared with the nightly sweep so both report one number.
    liq = measure_liquidity(conn)

    print('Scanner contract completeness audit')
    print('=' * 96)
    print(f"{'preset':22} {'src':8} {'cols':>6} {'universe':>9} {'liquidity':>10} {'vani':>6} {'limit':>6}")
    print('-' * 96)

    defects = []
    for p in presets:
        pid, rows = p['id'], p['rows']
        # 'matview' means the FRONTEND reads it from km_scan_results — not
        # merely that rows exist there. waking_giants/first_ascent have rows
        # and are served from km_wg_journeys; calling them matview-backed is
        # how their dead arms stayed invisible.
        served = pid in MATVIEW_SERVED_PRESETS
        in_mv = served and rows > 0
        src = 'matview' if served else ('ORPHAN' if rows else 'direct')
        if rows and not served:
            defects.append(f'{pid}: {rows} rows computed but no frontend path reads them')
        if served and not rows:
            defects.append(f'{pid}: served from the matview but it produces no rows')

        # 1. columns
        cols_v = 'n/a'
        if pid in MATVIEW_PRESET_COLUMNS:
            need = MATVIEW_PRESET_COLUMNS[pid]
            absent = [c for c in need if c not in matview_cols]
            if absent:
                cols_v = f'MISS{len(absent)}'; defects.append(f'{pid}: columns absent {absent}')
            elif rows:
                sel = ', '.join(f'COUNT({c}) AS n_{c}' for c in need)
                cur.execute(f'SELECT {sel} FROM km_scan_results WHERE preset_id=%s', (pid,))
                r0 = cur.fetchone()
                dead = [c for c in need if r0[f'n_{c}'] == 0]
                if dead:
                    cols_v = f'NULL{len(dead)}'; defects.append(f'{pid}: 100% null {dead}')
                else:
                    cols_v = 'OK'
            else:
                cols_v = 'OK'

        # 2. universe
        uni_v = 'n/a'
        if in_mv:
            bad = p['universe'] == 'NSE_ONLY' and p['bse'] > 0
            uni_v = f"BSE{p['bse']}" if bad else 'OK'
            if bad: defects.append(f"{pid}: declared NSE_ONLY but {p['bse']} BSE rows")

        # 3. liquidity — see measure_liquidity() for the per-preset yardstick
        liq_v = 'n/a'
        if in_mv:
            _, below, unmeas = liq.get(pid, (rows, 0, 0))
            if below:
                liq_v = f'LOW{below}'
                defects.append(f'{pid}: {below} rows below Rs {MIN_AVG_AMT_22D_CR} Cr')
            elif unmeas:
                liq_v = f'UNMEAS{unmeas}'
                defects.append(f'{pid}: {unmeas} rows have no turnover on the latest session')
            else:
                liq_v = 'OK'

        # 4. vani
        vani_v = 'n/a'
        if in_mv and p['vani_rule'] and p['vani_rule'] != 'always_true':
            vani_v = 'DEAD' if p['vani'] == 0 else 'OK'
            if p['vani'] == 0: defects.append(f"{pid}: vani_rule {p['vani_rule']} produces 0 flags")

        # 5. limit
        lim_v = 'n/a'
        if in_mv:
            over = rows > p['result_limit']
            lim_v = f'OVER{rows}' if over else 'OK'
            if over: defects.append(f"{pid}: {rows} rows exceeds limit {p['result_limit']}")

        print(f"{pid:22} {src:8} {cols_v:>6} {uni_v:>9} {liq_v:>10} {vani_v:>6} {lim_v:>6}")

    print('-' * 96)
    if defects:
        print(f'{len(defects)} DEFECT(S):')
        for d in defects:
            print(f'  x {d}')
    else:
        print('All presets green on every dimension.')
    print()
    print('NOTE: "direct" presets query km_equity_eod live and cannot be audited from the DB;')
    print('their liquidity floor is enforced in scanEngine.ts (MIN_AVG_AMT_22D_CR).')
    conn.close()
    sys.exit(1 if defects else 0)


if __name__ == '__main__':
    main()
