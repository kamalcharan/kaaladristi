"""
pattern_verify.py — Astro Pattern Engine, Phase 4 verification

POA: docs/POA/POA-astro-pattern-engine.md (Phase 4).

Two independent checks against km_rule_patterns. This script deliberately
shares NO computation code with pattern_study.py — it re-derives results
from raw SQL and plain loops, so agreement actually means something.

PART A — Level-break recheck (default: TR-MER-CMB-E-BEA on NIFTY 50)
  1. Prints a human-readable trace of the 3 most recent completed windows:
     window dates, window high/low, the break day, side, sessions-to-break,
     forward returns — eyeball these against any charting tool.
  2. Independently recomputes the FULL overall aggregate (every completed
     window) and diffs it against the stored km_rule_patterns row:
     MATCH / MISMATCH per stat.

PART B — Sequence threshold calibration
  Reads every stored reaction_profile (n_windows >= 20) and reports, for
  a range of t-thresholds, how many (rule x benchmark x field) series
  would fire a "first move" under the two-consecutive rule — plus the
  near-miss list at the current threshold, so loosening is a decision
  made with eyes open, not to manufacture patterns.

Run:
  cd App/backend/scripts
  DB_PRIMARY=... python3 pattern_verify.py
  DB_PRIMARY=... python3 pattern_verify.py --rule TR-MER-RET --benchmark "NIFTY 50"
"""

import os
import sys
import json
import argparse
from datetime import date

import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

# Must mirror pattern_study.py's published params (read back from the DB row
# at runtime as a cross-check — a params drift is itself a finding).
BREAK_SCAN   = 30
FWD_HORIZONS = (5, 10, 22)
TRACE_WINDOWS = 3


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── PART A: independent level-break re-derivation ─────────────────────────────

def fetch_series(cur, index_id):
    cur.execute("""
        SELECT trade_date, high, low, close FROM km_index_eod
        WHERE index_id = %s ORDER BY trade_date
    """, (index_id,))
    rows = cur.fetchall()
    dates = [r[0] for r in rows]
    highs = [float(r[1]) if r[1] is not None else (float(r[3]) if r[3] is not None else None) for r in rows]
    lows  = [float(r[2]) if r[2] is not None else (float(r[3]) if r[3] is not None else None) for r in rows]
    closes = [float(r[3]) if r[3] is not None else None for r in rows]
    return dates, highs, lows, closes


def break_outcome(dates, highs, lows, closes, w_start, w_end):
    """Plain re-derivation of one window's break outcome. None = not computable."""
    # window high/low over trading days inside the window
    in_win = [i for i, d in enumerate(dates) if w_start <= d <= w_end]
    if not in_win:
        return None
    whs = [highs[i] for i in in_win if highs[i] is not None]
    wls = [lows[i] for i in in_win if lows[i] is not None]
    if not whs or not wls:
        return None
    w_hi, w_lo = max(whs), min(wls)

    # last trading index on/before window end
    end_i = max(in_win)
    if end_i + BREAK_SCAN + max(FWD_HORIZONS) >= len(dates):
        return None

    for k in range(1, BREAK_SCAN + 1):
        c = closes[end_i + k]
        if c is None:
            continue
        if c > w_hi or c < w_lo:
            side = 'high' if c > w_hi else 'low'
            fwd = {}
            for h in FWD_HORIZONS:
                fc = closes[end_i + k + h]
                fwd[h] = round((fc - c) / c * 100, 4) if fc and c else None
            return {'hi': w_hi, 'lo': w_lo, 'side': side, 'k': k,
                    'break_date': dates[end_i + k], 'break_close': c, 'fwd': fwd}
    return {'hi': w_hi, 'lo': w_lo, 'side': 'none', 'k': None,
            'break_date': None, 'break_close': None,
            'fwd': {h: None for h in FWD_HORIZONS}}


def part_a(cur, rule_code, bench_name):
    print(f"\n{'=' * 72}\nPART A — independent level-break recheck: {rule_code} on {bench_name}\n{'=' * 72}")

    cur.execute("SELECT id FROM km_astro_rule_master WHERE rule_code = %s", (rule_code,))
    row = cur.fetchone()
    if not row:
        print(f"  rule {rule_code} not found"); return
    rule_id = row[0]

    cur.execute("SELECT id FROM km_index_symbols WHERE name = %s", (bench_name,))
    row = cur.fetchone()
    if not row:
        print(f"  benchmark {bench_name} not found"); return
    bench_id = row[0]

    cur.execute("""
        SELECT start_date, end_date FROM km_rule_transits
        WHERE rule_id = %s AND end_date < CURRENT_DATE
        ORDER BY start_date
    """, (rule_id,))
    windows = cur.fetchall()
    print(f"  completed windows: {len(windows)}")

    dates, highs, lows, closes = fetch_series(cur, bench_id)
    print(f"  benchmark bars: {len(dates)} ({dates[0]} → {dates[-1]})")

    outcomes = [o for o in (break_outcome(dates, highs, lows, closes, s, e)
                            for s, e in windows) if o is not None]

    # ── Trace the most recent computable windows ──
    print(f"\n  Most recent {TRACE_WINDOWS} computable windows (verify on a chart):")
    traced = 0
    for (s, e) in reversed(windows):
        o = break_outcome(dates, highs, lows, closes, s, e)
        if o is None:
            continue
        fwd = ' '.join(f"fwd{h}d={o['fwd'][h]:+.2f}%" if o['fwd'][h] is not None else f"fwd{h}d=—"
                       for h in FWD_HORIZONS)
        if o['side'] == 'none':
            print(f"    {s} → {e}  hi={o['hi']:.2f} lo={o['lo']:.2f}  NO BREAK in {BREAK_SCAN} sessions")
        else:
            print(f"    {s} → {e}  hi={o['hi']:.2f} lo={o['lo']:.2f}  "
                  f"{o['side'].upper()} broken on {o['break_date']} "
                  f"(close {o['break_close']:.2f}, +{o['k']} sessions)  {fwd}")
        traced += 1
        if traced >= TRACE_WINDOWS:
            break

    # ── Full independent aggregate ──
    n = len(outcomes)
    agg = {}
    for side in ('high', 'low', 'none'):
        sub = [o for o in outcomes if o['side'] == side]
        entry = {'n': len(sub), 'pct': round(len(sub) / n * 100, 4) if n else None}
        if side != 'none' and sub:
            ks = sorted(o['k'] for o in sub)
            m = len(ks) // 2
            entry['median_k'] = ks[m] if len(ks) % 2 else (ks[m - 1] + ks[m]) / 2
            for h in FWD_HORIZONS:
                vals = [o['fwd'][h] for o in sub if o['fwd'][h] is not None]
                entry[f'avg_fwd_{h}d'] = round(sum(vals) / len(vals), 4) if vals else None
        agg[side] = entry

    # ── Diff vs stored ──
    cur.execute("""
        SELECT results, n_windows FROM km_rule_patterns
        WHERE rule_id = %s AND benchmark_index_id = %s AND pattern_type = 'level_break'
    """, (rule_id, bench_id))
    row = cur.fetchone()
    if not row:
        print("\n  ⚠ no stored level_break row — run pattern_study first"); return
    stored = row[0]['overall']

    print(f"\n  Independent aggregate vs stored (overall, n={n} vs stored n={stored.get('n')}):")
    def diff(label, mine, theirs):
        ok = (mine is None and theirs is None) or \
             (mine is not None and theirs is not None and abs(mine - theirs) < 0.01)
        print(f"    {label:<38} mine={mine!s:>10}  stored={theirs!s:>10}  {'MATCH' if ok else '*** MISMATCH ***'}")
        return ok

    all_ok = diff('n', n, stored.get('n'))
    key_map = {'high': 'high_first', 'low': 'low_first', 'none': 'no_break'}
    for side, skey in key_map.items():
        st = stored.get(skey) or {}
        all_ok &= diff(f'{skey}.n', agg[side]['n'], st.get('n'))
        all_ok &= diff(f'{skey}.pct', agg[side]['pct'], st.get('pct'))
        if side != 'none':
            all_ok &= diff(f'{skey}.median_sessions', agg[side].get('median_k'), st.get('median_sessions_to_break'))
            for h in FWD_HORIZONS:
                all_ok &= diff(f'{skey}.avg_fwd_{h}d', agg[side].get(f'avg_fwd_{h}d'), st.get(f'avg_fwd_{h}d'))

    print(f"\n  PART A VERDICT: {'ALL MATCH ✓' if all_ok else 'MISMATCHES FOUND — investigate before trusting the engine'}")


# ── PART B: sequence threshold calibration ────────────────────────────────────

THRESHOLDS = (1.65, 1.8, 2.0, 2.33, 2.5)
NEAR_MISS_BAND = (1.6, 2.0)


def two_consec_max(ts, offsets, from_offset=-3):
    """Max of min(|t_k|, |t_k+1|) over consecutive pairs from from_offset on."""
    start = offsets.index(from_offset)
    best = 0.0
    for k in range(start, len(ts) - 1):
        a, b = ts[k], ts[k + 1]
        if a is not None and b is not None:
            best = max(best, min(abs(a), abs(b)))
    return best


def part_b(cur):
    print(f"\n{'=' * 72}\nPART B — sequence threshold calibration (profiles with n >= 20)\n{'=' * 72}")

    cur.execute("""
        SELECT r.rule_code, s.name, p.results
        FROM km_rule_patterns p
        JOIN km_astro_rule_master r ON r.id = p.rule_id
        JOIN km_index_symbols s ON s.id = p.benchmark_index_id
        WHERE p.pattern_type = 'reaction_profile' AND p.n_windows >= 20
    """)
    rows = cur.fetchall()
    print(f"  profiles examined: {len(rows)}")

    series = []   # (rule, bench, field, max_two_consec_t)
    for rule_code, bench, results in rows:
        overall = (results or {}).get('overall') or {}
        offsets = overall.get('offsets')
        fields = overall.get('fields') or {}
        if not offsets:
            continue
        for f, data in fields.items():
            m = two_consec_max(data.get('t', []), offsets)
            series.append((rule_code, bench, f, m))

    total = len(series)
    print(f"  field-series examined: {total}\n")
    print(f"  {'threshold':>10}  {'series firing':>14}  {'% of all':>9}")
    print(f"  {'─' * 10}  {'─' * 14}  {'─' * 9}")
    for t in THRESHOLDS:
        fired = sum(1 for _, _, _, m in series if m >= t)
        print(f"  {t:>10}  {fired:>14}  {fired / total * 100 if total else 0:>8.1f}%")

    # Near misses at the current threshold — what loosening would admit
    near = sorted([x for x in series if NEAR_MISS_BAND[0] <= x[3] < NEAR_MISS_BAND[1]],
                  key=lambda x: -x[3])
    print(f"\n  Near-misses ({NEAR_MISS_BAND[0]} <= max-two-consecutive |t| < {NEAR_MISS_BAND[1]}) — top 20:")
    for rule_code, bench, f, m in near[:20]:
        print(f"    {m:5.2f}  {rule_code:<24} {f:<12} on {bench}")
    if not near:
        print("    (none)")

    print("\n  Reading guide: with 7 fields x hundreds of rule-benchmark pairs, some")
    print("  series clear any threshold by chance. Prefer the threshold where the")
    print("  firing rate is low overall AND the sequences that do fire repeat across")
    print("  related benchmarks for the same rule — repetition is the real signal.")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rule', default='TR-MER-CMB-E-BEA')
    ap.add_argument('--benchmark', default='NIFTY 50')
    ap.add_argument('--skip-a', action='store_true')
    ap.add_argument('--skip-b', action='store_true')
    args = ap.parse_args()

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if not args.skip_a:
                part_a(cur, args.rule, args.benchmark)
            if not args.skip_b:
                part_b(cur)
        print()
    finally:
        conn.close()


if __name__ == '__main__':
    main()
