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
from lib.integrity_checks import (MIN_AVG_AMT_22D_CR, measure_liquidity,
                                  VANI_RULE_SQL, VANI_MIN_EXPECTED,
                                  matview_preset_columns, matview_served_presets,
                                  _db_preset_meta)


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

    # Both DERIVED from the frontend source at run time (lib/scan_contract.py).
    # If the extraction breaks, it raises here rather than yielding an empty
    # contract that would make every scanner look defect-free.
    served_presets = matview_served_presets()

    # Mapper gaps: matview-populated columns the frontend row mapper drops
    # before the table sees them (the Score 5D/22D dash bug lived here, one
    # layer past the DB — a DB-only audit called it fixed while the UI
    # stayed blank).
    from lib import scan_contract
    for _p, _cols in sorted(scan_contract.mapper_gaps(_db_preset_meta(conn)).items()):
        defects.append(f'{_p}: mapper drops {_cols} — dashes despite populated matview')
    required_cols = matview_preset_columns(matview_cols, _db_preset_meta(conn))

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
        served = pid in served_presets
        in_mv = served and rows > 0
        src = 'matview' if served else ('ORPHAN' if rows else 'direct')
        if rows and not served:
            defects.append(f'{pid}: {rows} rows computed but no frontend path reads them')
        if served and not rows:
            defects.append(f'{pid}: served from the matview but it produces no rows')

        # 1. columns
        cols_v = 'n/a'
        if pid in required_cols:
            need = required_cols[pid]
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

        # 4. vani — enrichment, not presence. "0 flags" on a 25-row preset whose
        # rule has a 0.5% base rate is the EXPECTED outcome, not a defect; the
        # old presence test reported three healthy presets as broken and would
        # have flipped power_buy to DEAD on 94% of days. See VANI_MIN_EXPECTED.
        vani_v = 'n/a'
        if in_mv and p['vani_rule'] and p['vani_rule'] != 'always_true':
            pred = VANI_RULE_SQL.get(p['vani_rule'])
            base = None
            if pred:
                cur.execute(f"""SELECT COUNT(*) FILTER (WHERE {pred})::float
                                     / NULLIF(COUNT(*),0) AS b
                               FROM km_equity_eod
                               WHERE trade_date=(SELECT max(trade_date) FROM km_equity_eod)""")
                base = cur.fetchone()['b']
            exp = (base or 0) * rows
            if p['vani'] > 0:
                lift = (p['vani'] / rows) / base if base else 0
                vani_v = f'{lift:.0f}x' if lift else 'OK'
            elif exp < VANI_MIN_EXPECTED:
                vani_v = 'LOWPWR'      # cannot tell — not counted as a defect
            else:
                vani_v = 'DEAD'
                defects.append(f"{pid}: vani_rule {p['vani_rule']} produced 0 of an "
                               f"expected {exp:.1f} flags")

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
    print('they are NOT covered by any dimension above — n/a means unverified, not passed.')
    conn.close()
    sys.exit(1 if defects else 0)


if __name__ == '__main__':
    main()
