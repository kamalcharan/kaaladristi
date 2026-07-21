"""
compute_rule_evidence.py — per-rule observational evidence vs base rates.

Populates km_rule_evidence (migration 161): for every rule with transit
windows, measures how the NIFTY 50 benchmark behaved INSIDE its windows —
range texture, direction counts, turn frequency, VIX overlap — and, crucially,
the matched-length BASE RATE for each measure, so the frontend can only claim
an effect that actually clears the unconditional behavior of a drifting index
(astro-story.md §3: the evidence layer is the editor, not the interface).

Measures per window:
  range ratio   avg daily (high-low)/close inside the window vs the prior
                60 sessions' average
  pos close     benchmark close on the window's last session vs the last
                close strictly before the window start
  turn          the window contains a ±10-session swing high or low
  VIX up        last VIX close inside the window vs last close before it
                (series starts 2025-06 — recent-era only)

Base rates per rule use the rule's MEDIAN window length in sessions:
  pos_close_base_pct  P(close[i+L] > close[i]) over the whole series
  turn_base_pct       P(an L-session stretch contains a swing point)

Wired into the 19:00 IST transit-scoring job (pipeline2/scheduler.py) after
benchmark confidence; also runnable standalone:

  cd App/backend/scripts
  DB_PRIMARY=... python3 compute_rule_evidence.py
"""

import json
import os
import sys
from bisect import bisect_left, bisect_right
from statistics import median

import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL

BENCHMARK_INDEX_ID = 1     # NIFTY 50
VIX_INDEX_ID = 94          # India VIX
BASELINE_SESSIONS = 60     # range baseline lookback
MIN_BASELINE_SESSIONS = 30
SWING_WING = 10            # ±sessions for a swing high/low
MIN_WINDOWS = 5            # don't write evidence rows thinner than this
LAST_N = 20


def _load_series(cur, index_id):
    cur.execute("""
        SELECT trade_date, close, high, low
        FROM km_index_eod
        WHERE index_id = %s AND close IS NOT NULL
        ORDER BY trade_date
    """, (index_id,))
    dates, closes, trs = [], [], []
    for d, c, h, l in cur.fetchall():
        dates.append(d)
        closes.append(float(c))
        trs.append((float(h) - float(l)) / float(c) * 100.0
                   if h is not None and l is not None and float(c) != 0 else None)
    return dates, closes, trs


def _swing_flags(closes, dates, cur):
    """±SWING_WING-session fractal on high/low (falls back to close if OHLC gaps)."""
    cur.execute("""
        SELECT trade_date, high, low FROM km_index_eod
        WHERE index_id = %s AND high IS NOT NULL AND low IS NOT NULL
        ORDER BY trade_date
    """, (BENCHMARK_INDEX_ID,))
    hl = {d: (float(h), float(l)) for d, h, l in cur.fetchall()}
    highs = [hl.get(d, (c, c))[0] for d, c in zip(dates, closes)]
    lows = [hl.get(d, (c, c))[1] for d, c in zip(dates, closes)]
    n = len(dates)
    flags = [False] * n
    w = SWING_WING
    for i in range(w, n - w):
        seg_h = highs[i - w:i + w + 1]
        seg_l = lows[i - w:i + w + 1]
        if highs[i] == max(seg_h) or lows[i] == min(seg_l):
            flags[i] = True
    return flags


def _prefix(values, none_as=0.0):
    out = [0.0]
    for v in values:
        out.append(out[-1] + (none_as if v is None else float(v)))
    return out


def _win_indices(dates, start_d, end_d):
    """(i0, i1) inclusive session indices inside [start_d, end_d], or None."""
    i0 = bisect_left(dates, start_d)
    i1 = bisect_right(dates, end_d) - 1
    if i1 < i0 or i0 >= len(dates):
        return None
    return i0, i1


def _base_rates(closes, swing_prefix, length):
    n = len(closes)
    if length < 1 or n <= length + 1:
        return None, None
    pos = tot = turn = 0
    for i in range(n - length):
        tot += 1
        if closes[i + length] > closes[i]:
            pos += 1
        if swing_prefix[i + length + 1] - swing_prefix[i + 1] > 0:
            turn += 1
    return (pos / tot * 100.0, turn / tot * 100.0) if tot else (None, None)


def compute_rule_evidence(conn) -> int:
    """Recompute km_rule_evidence for every rule with windows. Returns rows written."""
    cur = conn.cursor()

    dates, closes, trs = _load_series(cur, BENCHMARK_INDEX_ID)
    if len(dates) < 300:
        raise RuntimeError('benchmark series too short — aborting evidence compute')
    tr_prefix = _prefix(trs)
    tr_count_prefix = _prefix([0 if t is None else 1 for t in trs])
    swings = _swing_flags(closes, dates, cur)
    swing_prefix = _prefix([1 if s else 0 for s in swings])

    vix_dates, vix_closes, _ = _load_series(cur, VIX_INDEX_ID)

    cur.execute("""
        SELECT t.rule_id, t.start_date, t.end_date, t.direction, t.combustion_type
        FROM km_rule_transits t
        JOIN km_astro_rule_master r ON r.id = t.rule_id AND NOT r.is_deleted
        WHERE t.end_date <= CURRENT_DATE
        ORDER BY t.rule_id, t.start_date
    """)
    by_rule = {}
    for rule_id, s, e, direction, stage in cur.fetchall():
        by_rule.setdefault(rule_id, []).append((s, e, direction, stage))

    cur.execute("""
        SELECT r.id, COUNT(t.id) FROM km_astro_rule_master r
        JOIN km_rule_transits t ON t.rule_id = r.id
        WHERE NOT r.is_deleted GROUP BY r.id
    """)
    totals = dict(cur.fetchall())

    def avg_tr(i0, i1):
        cnt = tr_count_prefix[i1 + 1] - tr_count_prefix[i0]
        if cnt == 0:
            return None
        return (tr_prefix[i1 + 1] - tr_prefix[i0]) / cnt

    written = 0
    for rule_id, wins in by_rule.items():
        measured = []
        for s, e, direction, stage in wins:
            idx = _win_indices(dates, s, e)
            if idx is None:
                continue
            i0, i1 = idx
            if i0 == 0:
                continue                      # no close strictly before window
            base_j0 = max(0, i0 - BASELINE_SESSIONS)
            if i0 - base_j0 < MIN_BASELINE_SESSIONS:
                continue
            win_range = avg_tr(i0, i1)
            base_range = avg_tr(base_j0, i0 - 1)
            ratio = (win_range / base_range) if (win_range and base_range) else None
            c0, c1 = closes[i0 - 1], closes[i1]
            ret = (c1 - c0) / c0 * 100.0 if c0 else None
            turn = swing_prefix[i1 + 1] - swing_prefix[i0] > 0

            vix_up = None
            if vix_dates:
                v0i = bisect_left(vix_dates, s) - 1
                v1i = bisect_right(vix_dates, e) - 1
                if v0i >= 0 and v1i > v0i:
                    vix_up = vix_closes[v1i] > vix_closes[v0i]

            measured.append({
                'start': s, 'end': e, 'sessions': i1 - i0 + 1,
                'ratio': ratio, 'ret': ret, 'pos': ret is not None and ret > 0,
                'turn': turn, 'vix_up': vix_up,
                'direction': direction, 'stage': stage,
            })

        if len(measured) < MIN_WINDOWS:
            continue

        med_len = int(median(m['sessions'] for m in measured))
        pos_base, turn_base = _base_rates(closes, swing_prefix, med_len)

        def agg(ms):
            ratios = [m['ratio'] for m in ms if m['ratio'] is not None]
            rets = [m['ret'] for m in ms if m['ret'] is not None]
            return {
                'n': len(ms),
                'range_ratio_mean': round(sum(ratios) / len(ratios), 3) if ratios else None,
                'range_expanded_n': sum(1 for r in ratios if r > 1.0),
                'pos_close_n': sum(1 for m in ms if m['pos']),
                'avg_window_ret': round(sum(rets) / len(rets), 2) if rets else None,
                'turn_n': sum(1 for m in ms if m['turn']),
            }

        all_agg = agg(measured)
        last20 = agg(measured[-LAST_N:])

        slices = {}
        if any(m['direction'] or m['stage'] for m in measured):
            keyed = {}
            for m in measured:
                key = '|'.join(filter(None, [m['direction'], m['stage']]))
                if key:
                    keyed.setdefault(key, []).append(m)
            slices = {k: agg(v) for k, v in keyed.items() if len(v) >= MIN_WINDOWS}

        vix_scored = [m for m in measured if m['vix_up'] is not None]

        cur.execute("""
            INSERT INTO km_rule_evidence
              (rule_id, benchmark_index_id, windows_total, windows_scored,
               first_scored, last_scored, avg_window_sessions,
               range_ratio_mean, range_expanded_n,
               pos_close_n, pos_close_base_pct, avg_window_ret,
               turn_n, turn_base_pct, vix_windows, vix_up_n,
               last20, slices, computed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
            ON CONFLICT (rule_id) DO UPDATE SET
              benchmark_index_id = EXCLUDED.benchmark_index_id,
              windows_total = EXCLUDED.windows_total,
              windows_scored = EXCLUDED.windows_scored,
              first_scored = EXCLUDED.first_scored,
              last_scored = EXCLUDED.last_scored,
              avg_window_sessions = EXCLUDED.avg_window_sessions,
              range_ratio_mean = EXCLUDED.range_ratio_mean,
              range_expanded_n = EXCLUDED.range_expanded_n,
              pos_close_n = EXCLUDED.pos_close_n,
              pos_close_base_pct = EXCLUDED.pos_close_base_pct,
              avg_window_ret = EXCLUDED.avg_window_ret,
              turn_n = EXCLUDED.turn_n,
              turn_base_pct = EXCLUDED.turn_base_pct,
              vix_windows = EXCLUDED.vix_windows,
              vix_up_n = EXCLUDED.vix_up_n,
              last20 = EXCLUDED.last20,
              slices = EXCLUDED.slices,
              computed_at = now()
        """, (
            rule_id, BENCHMARK_INDEX_ID, totals.get(rule_id, len(wins)), all_agg['n'],
            measured[0]['start'], measured[-1]['end'],
            round(sum(m['sessions'] for m in measured) / len(measured), 1),
            all_agg['range_ratio_mean'], all_agg['range_expanded_n'],
            all_agg['pos_close_n'],
            round(pos_base, 1) if pos_base is not None else None,
            all_agg['avg_window_ret'],
            all_agg['turn_n'],
            round(turn_base, 1) if turn_base is not None else None,
            len(vix_scored), sum(1 for m in vix_scored if m['vix_up']),
            json.dumps(last20), json.dumps(slices) if slices else None,
        ))
        written += 1

    cur.close()
    return written


def main():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set')
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
    try:
        n = compute_rule_evidence(conn)
        conn.commit()
        print(f'  km_rule_evidence: {n} rule rows written')
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.rule_code, e.windows_scored, e.range_ratio_mean,
                       e.pos_close_n, e.pos_close_base_pct, e.turn_n, e.turn_base_pct
                FROM km_rule_evidence e
                JOIN km_astro_rule_master r ON r.id = e.rule_id
                WHERE r.tags @> ARRAY['Mercury']::text[]
                ORDER BY r.rule_code
            """)
            print(f"\n  {'rule':<22} {'n':>4} {'range×':>7} {'pos':>9} {'base%':>6} {'turn':>9} {'base%':>6}")
            for code, n_, rr, pos, pb, turn, tb in cur.fetchall():
                print(f"  {code:<22} {n_:>4} {rr or 0:>7} {pos:>4}/{n_:<4} {pb or 0:>6} {turn:>4}/{n_:<4} {tb or 0:>6}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
