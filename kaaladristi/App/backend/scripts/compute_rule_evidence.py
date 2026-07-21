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

Boundary-day TRANSITION study (migration 162, `transitions` JSONB — owner
2026-07-21: "Mercury is about trend change... prev day high/low break...
fusion... the impact will be +/- 2 days — checking a single day is a
mistake"): each window boundary (point rules: the day; range rules: entry
and exit separately) is an ORB — event ±2 sessions is the transition ZONE.
With a real prior trend (|5-session move ending before the zone| >= 1%):
  flip_pct                the 5-session trend AFTER the zone flipped vs before
  confirm_given_flip_pct  a prev-day-H/L break-and-close INSIDE the zone in
                          the new trend's direction (the fusion confirmation)
each with the matched base rate. Orb prototype vs NIFTY 2008+ (base 48.9%):
sign-ingress 56.4% (n=241) is the real carrier; combust-entry/retro-station
single-day tilts washed out under the orb test.

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
    dates, closes, trs, highs, lows = [], [], [], [], []
    for d, c, h, l in cur.fetchall():
        c = float(c)
        dates.append(d)
        closes.append(c)
        highs.append(float(h) if h is not None else c)
        lows.append(float(l) if l is not None else c)
        trs.append((float(h) - float(l)) / c * 100.0
                   if h is not None and l is not None and c != 0 else None)
    return dates, closes, trs, highs, lows


def _swing_flags(highs, lows):
    """±SWING_WING-session fractal on high/low."""
    n = len(highs)
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


# ── Boundary-day transition study (migration 162 — "fusion", ±2d orb) ─────────
# Mercury-type rules mark trend-CHANGE dates, not directional windows, and the
# influence is an ORB, not a stamp (owner 2026-07-21: "usually the impact will
# be +/- 2 days for any planetary confluence — one of the mistakes is checking
# for a single day"). The event ±ORB_SESSIONS is the transition ZONE: compare
# the 5-session trend ENTERING the zone vs LEAVING it, and look for the
# confirming prev-day-H/L break INSIDE the zone in the new trend's direction.
# Orb prototyping vs NIFTY 2008+ (base flip 48.9%): sign-ingress days carry a
# real tilt (56.4%, n=241); combust-entry and retro-station single-day tilts
# washed out — the orb test is stricter AND fairer.

TREND_SESSIONS = 5
ORB_SESSIONS = 2
MIN_PRIOR_TREND = 0.01
EVENT_MAP_TOLERANCE_DAYS = 4
MIN_EVENTS = 10


def _transition_arrays(dates, closes, highs, lows):
    """Per-center-session i: before_t (5s trend ending the day before the orb),
    after_t (5s trend after the orb exits), brk_dir (per-day close beyond the
    previous day's high=+1 / low=-1 / neither=0). None where undefined."""
    n = len(dates)
    T, O = TREND_SESSIONS, ORB_SESSIONS
    before_t = [None] * n
    after_t = [None] * n
    brk_dir = [0] * n
    for i in range(n):
        if i >= O + T + 1 and closes[i - O - T - 1] != 0:
            before_t[i] = (closes[i - O - 1] - closes[i - O - T - 1]) / closes[i - O - T - 1]
        if i + O + T < n and closes[i + O] != 0:
            after_t[i] = (closes[i + O + T] - closes[i + O]) / closes[i + O]
        if i >= 1:
            brk_dir[i] = 1 if closes[i] > highs[i - 1] else (-1 if closes[i] < lows[i - 1] else 0)
    return before_t, after_t, brk_dir


def _confirming_break_in_orb(i, after_sign, brk_dir):
    for j in range(i - ORB_SESSIONS, i + ORB_SESSIONS + 1):
        if 0 <= j < len(brk_dir) and brk_dir[j] == after_sign:
            return True
    return False


def _transition_agg(indices, before_t, after_t, brk_dir):
    flips = confirmed = 0
    n = 0
    for i in indices:
        n += 1
        flip = (before_t[i] > 0) != (after_t[i] > 0)
        if flip:
            flips += 1
            if _confirming_break_in_orb(i, 1 if after_t[i] > 0 else -1, brk_dir):
                confirmed += 1
    if n == 0:
        return None
    return {
        'n': n,
        'flip_pct': round(flips / n * 100, 1),
        'confirm_given_flip_pct': round(confirmed / flips * 100, 1) if flips else None,
    }


def _valid_transition_day(i, before_t, after_t):
    return (before_t[i] is not None and after_t[i] is not None
            and abs(before_t[i]) >= MIN_PRIOR_TREND)


def _map_event_day(dates, d, before_t, after_t):
    """Event date → first valid trending orb-center within tolerance, else None."""
    i = bisect_left(dates, d)
    while i < len(dates) and (dates[i] - d).days <= EVENT_MAP_TOLERANCE_DAYS:
        if _valid_transition_day(i, before_t, after_t):
            return i
        i += 1
    return None


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

    dates, closes, trs, highs, lows = _load_series(cur, BENCHMARK_INDEX_ID)
    if len(dates) < 300:
        raise RuntimeError('benchmark series too short — aborting evidence compute')
    tr_prefix = _prefix(trs)
    tr_count_prefix = _prefix([0 if t is None else 1 for t in trs])
    swings = _swing_flags(highs, lows)
    swing_prefix = _prefix([1 if s else 0 for s in swings])

    before_t, after_t, brk_dir = _transition_arrays(dates, closes, highs, lows)
    base_idx = [i for i in range(len(dates)) if _valid_transition_day(i, before_t, after_t)]
    transition_base = _transition_agg(base_idx, before_t, after_t, brk_dir) or {}

    vix_dates, vix_closes, _, _, _ = _load_series(cur, VIX_INDEX_ID)

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

        # Boundary-day transition study: point rules test the day itself;
        # range rules test entry ('start') and exit ('end') separately —
        # combust entry vs exit are distinct phenomena.
        is_point = all(s == e for s, e, _, _ in wins)
        boundary_sets = {'day': [s for s, e, _, _ in wins]} if is_point else {
            'start': [s for s, e, _, _ in wins],
            'end':   [e for s, e, _, _ in wins],
        }
        transitions = {}
        for key, event_dates in boundary_sets.items():
            idxs = []
            for d in event_dates:
                i = _map_event_day(dates, d, before_t, after_t)
                if i is not None:
                    idxs.append(i)
            agg_t = _transition_agg(idxs, before_t, after_t, brk_dir)
            if agg_t and agg_t['n'] >= MIN_EVENTS:
                agg_t['base_flip_pct'] = transition_base.get('flip_pct')
                agg_t['base_confirm_given_flip_pct'] = transition_base.get('confirm_given_flip_pct')
                transitions[key] = agg_t

        cur.execute("""
            INSERT INTO km_rule_evidence
              (rule_id, benchmark_index_id, windows_total, windows_scored,
               first_scored, last_scored, avg_window_sessions,
               range_ratio_mean, range_expanded_n,
               pos_close_n, pos_close_base_pct, avg_window_ret,
               turn_n, turn_base_pct, vix_windows, vix_up_n,
               last20, slices, transitions, computed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
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
              transitions = EXCLUDED.transitions,
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
            json.dumps(transitions) if transitions else None,
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
