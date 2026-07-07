"""
pattern_study.py — Astro Pattern Engine, Phase 2

POA: docs/POA/POA-astro-pattern-engine.md (approved 2026-07-06)
Prerequisite: migration 132 (km_rule_patterns).

Computes three pattern types for every rule that has transit windows —
plus daily-signal rules (nakshatra_vara / tithi_alone / eclipse / seasonal,
which live in km_rule_signals) studied as synthetic 1-day tactical windows —
against every index benchmark with enough history — standard AND curated
(custom) baskets — and upserts results into km_rule_patterns:

  level_break      — window high/low as reference levels: which side broke
                     first after the window, time-to-break, forward returns
                     5/10/22 sessions post-break. Close-basis breaks.
  reaction_profile — event-study curves: mean per-occurrence-de-meaned value
                     of 7 indicator fields over D-10..D+15 sessions around
                     the anchor.
  sequence         — who-moves-first: per field, the first offset where the
                     mean delta is significant (|t| >= T_THRESHOLD for two
                     consecutive offsets); fields ordered by that offset.

Scope decisions baked in (do not change without updating the POA):
  * Anchor: window END for combust/retrograde windows (the station/release
    moment), window START otherwise (sign transits, day rules, ...).
    Detected from conditions_snapshot->>'rule_type' of the rule's windows.
  * Bands from each rule's own median window duration:
    tactical <= 10d, trend 11-90d, structural > 90d.
  * Same-band overlap = PEERS -> clean/overlapped split + per-peer combos.
    Peer test: another same-band rule has a window containing the anchor day.
  * Higher-band state = CONTEXT -> splits by Jupiter/Saturn/Mars/Mercury
    motion and Jupiter/Saturn sign (from the migration 127-130 window sets).
  * Lower-band events inside long windows = density metadata only.
  * Everything computed is stored; display gates (n>=20 publish, 10-19
    greyed, <10 hidden) are applied by the UI, never here.

Run (full study — minutes, not hours):
  cd App/backend/scripts
  DB_PRIMARY=postgresql://user:pass@host:5432/kaala_dristi_db python3 pattern_study.py

Targeted:
  python3 pattern_study.py --rule TR-MER-CMB-E-BEA
  python3 pattern_study.py --benchmark "NIFTY 50"
  python3 pattern_study.py --tag MajorTransit

DO NOT RUN AUTOMATICALLY — one-shot; re-run after new windows are generated.
"""

import os
import sys
import json
import math
import argparse
import statistics
from bisect import bisect_left, bisect_right
from datetime import date, timedelta

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


# ── Tunables (recorded into params for reproducibility) ────────────────────────

PROFILE_PRE       = 10      # sessions before anchor in reaction profile
PROFILE_POST      = 15      # sessions after anchor
BASELINE_OFFSETS  = range(-10, -3)   # D-10..D-4 = per-occurrence baseline
BREAK_SCAN        = 30      # sessions after window end to scan for a break
FWD_HORIZONS      = (5, 10, 22)
T_THRESHOLD       = 2.0     # |t| needed (two consecutive offsets) for sequence
MIN_N             = 3       # below this, skip computation entirely (degenerate)
MIN_COMBO_N       = 20      # peer-combination stat lines need this many
MIN_BENCH_BARS    = 250     # skip benchmarks with less than ~1y of data

INDICATOR_FIELDS  = ('ret_1d', 'rsi_14', 'rvol', 'sniper_inst', 'sniper_hot',
                     'rss_value', 'magic_rs')

# Anchor selection by the window's snapshot rule_type
END_ANCHORED_TYPES = {'combust', 'retrograde'}

# Daily-only rule types (rule_discovery.DAILY_ONLY_TYPES) live in
# km_rule_signals, not km_rule_transits — each signal is treated as a
# 1-day tactical window (start = end = signal date) so the Pattern Engine
# covers them too (owner decision 2026-07-07, 'option b'). Anchor is the
# signal day itself; band is tactical by construction (median duration 1).
DAILY_SIGNAL_TYPES = ('nakshatra_vara', 'tithi_alone', 'eclipse', 'seasonal')

# Context rule codes (motion/journey sets from migrations 127-130)
CONTEXT_MOTION = {
    'mercury_motion': 'TR-MER-RET',
    'mars_motion':    'TR-MAR-RET',
    'jupiter_motion': 'TR-JUP-RET',
    'saturn_motion':  'TR-SAT-RET',
}
CONTEXT_SIGN = {
    'jupiter_sign': 'TRN-JUP-MAN-TRN',
    'saturn_sign':  'TRN-SAT-MAN-TRN',
}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


def r4(x):
    return None if x is None else round(float(x), 4)


def mean_or_none(vals):
    vals = [v for v in vals if v is not None]
    return r4(statistics.fmean(vals)) if vals else None


# ── Data loading ───────────────────────────────────────────────────────────────

def load_rules(cur, only_rule=None, only_tag=None):
    """Rules with study-able windows: km_rule_transits rows as-is, plus
    daily-signal rules (km_rule_signals) as synthetic 1-day windows."""
    filt = ""
    filt_args = []
    if only_rule:
        filt += " AND r.rule_code = %s"
        filt_args.append(only_rule)
    if only_tag:
        filt += " AND %s = ANY(r.tags)"
        filt_args.append(only_tag)

    q = f"""
        SELECT r.id, r.rule_code, r.display_name, r.tags,
               t.id AS transit_id, t.start_date, t.end_date,
               t.conditions_snapshot
        FROM km_astro_rule_master r
        JOIN km_rule_transits t ON t.rule_id = r.id
        WHERE r.is_deleted = false{filt}

        UNION ALL

        SELECT r.id, r.rule_code, r.display_name, r.tags,
               s.id, s.date, s.date,
               COALESCE(s.conditions_snapshot, '{{}}'::jsonb)
                 || jsonb_build_object('rule_type', r.rule_type,
                                       'daily_signal', true)
        FROM km_astro_rule_master r
        JOIN km_rule_signals s ON s.rule_id = r.id
        WHERE r.is_deleted = false
          AND r.rule_type IN %s{filt}

        ORDER BY 1, 6
    """
    args = filt_args + [DAILY_SIGNAL_TYPES] + filt_args
    cur.execute(q, args)

    rules = {}
    for row in cur.fetchall():
        rid, code, name, tags, tid, sd, ed, snap = row
        r = rules.setdefault(rid, {
            'id': rid, 'rule_code': code, 'display_name': name,
            'tags': tags or [], 'windows': [],
        })
        r['windows'].append({
            'transit_id': tid, 'start': sd, 'end': ed,
            'snapshot': snap or {},
        })
    return list(rules.values())


def load_benchmarks(cur, only_benchmark=None):
    """All indices with enough history — standard AND curated (custom)
    baskets; curated indices are first-class benchmarks (owner decision
    2026-07-06). Future pseudo indices (created purely to backcast sector
    history) will carry an explicit 'pseudo' marker and be excluded here
    once that marker exists."""
    q = """
        SELECT s.id, s.name
        FROM km_index_symbols s
        WHERE (SELECT COUNT(*) FROM km_index_eod e WHERE e.index_id = s.id) >= %s
    """
    args = [MIN_BENCH_BARS]
    if only_benchmark:
        q += " AND (s.name = %s OR s.id::text = %s)"
        args += [only_benchmark, only_benchmark]
    q += " ORDER BY s.id"
    cur.execute(q, args)
    return cur.fetchall()


class BenchSeries:
    """One benchmark's EOD series with a trading-calendar index."""

    def __init__(self, rows):
        # rows sorted by trade_date asc: (trade_date, open, high, low, close,
        #                                 rsi_14, rvol, sniper_inst, sniper_hot,
        #                                 rss_value, magic_rs)
        self.dates  = [r[0] for r in rows]
        self.high   = [float(r[2]) if r[2] is not None else (float(r[4]) if r[4] is not None else None) for r in rows]
        self.low    = [float(r[3]) if r[3] is not None else (float(r[4]) if r[4] is not None else None) for r in rows]
        self.close  = [float(r[4]) if r[4] is not None else None for r in rows]
        self.fields = {
            'rsi_14':      [float(r[5]) if r[5] is not None else None for r in rows],
            'rvol':        [float(r[6]) if r[6] is not None else None for r in rows],
            'sniper_inst': [float(r[7]) if r[7] is not None else None for r in rows],
            'sniper_hot':  [float(r[8]) if r[8] is not None else None for r in rows],
            'rss_value':   [float(r[9]) if r[9] is not None else None for r in rows],
            'magic_rs':    [float(r[10]) if r[10] is not None else None for r in rows],
        }
        # 1-day % return series (None where prev/curr close missing)
        ret = [None]
        for i in range(1, len(self.close)):
            a, b = self.close[i - 1], self.close[i]
            ret.append(r4((b - a) / a * 100) if a and b else None)
        self.fields['ret_1d'] = ret

    def idx_on_or_after(self, d):
        """Trading-calendar index of d, or the next trading day; None if past end."""
        i = bisect_left(self.dates, d)
        return i if i < len(self.dates) else None

    def idx_on_or_before(self, d):
        i = bisect_right(self.dates, d) - 1
        return i if i >= 0 else None

    def baseline_drift(self, horizons):
        """Unconditional avg forward return per horizon across the whole
        series — the drift every level-break forward return must beat."""
        out = {}
        for h in horizons:
            rets = []
            for i in range(len(self.close) - h):
                a, b = self.close[i], self.close[i + h]
                if a and b:
                    rets.append((b - a) / a * 100)
            out[f'avg_{h}d'] = r4(statistics.fmean(rets)) if rets else None
        return out

    def range_high_low(self, start, end):
        """(high, low) over trading days in [start, end]; None if no bars."""
        i = bisect_left(self.dates, start)
        j = bisect_right(self.dates, end)
        if i >= j:
            return None, None
        hs = [h for h in self.high[i:j] if h is not None]
        ls = [l for l in self.low[i:j]  if l is not None]
        return (max(hs) if hs else None, min(ls) if ls else None)


def load_bench_series(cur, index_id):
    cur.execute("""
        SELECT trade_date, open, high, low, close,
               rsi_14, rvol, sniper_inst, sniper_hot, rss_value, magic_rs
        FROM km_index_eod
        WHERE index_id = %s
        ORDER BY trade_date
    """, (index_id,))
    rows = cur.fetchall()
    return BenchSeries(rows) if rows else None


# ── Prep pass: anchors, bands, peers, context ─────────────────────────────────

def classify_anchor(rule):
    """window_end for combust/retrograde window sets, window_start otherwise."""
    types = {w['snapshot'].get('rule_type') for w in rule['windows']}
    return 'window_end' if types & END_ANCHORED_TYPES else 'window_start'


def coverage_ratio(rule):
    """Fraction of the rule's own span covered by its windows. Journey/
    calendar rules (sign transits) tile the calendar (~1.0) — they are
    states, not events, and must not count as peers."""
    ws = rule['windows']
    if not ws:
        return 0.0
    covered = sum((w['end'] - w['start']).days + 1 for w in ws)
    span = (max(w['end'] for w in ws) - min(w['start'] for w in ws)).days + 1
    return covered / span if span > 0 else 0.0


CONTINUOUS_COVERAGE = 0.90   # above this, a rule is a calendar, not an event
CONTINUOUS_MIN_WINDOWS = 5   # coverage is meaningless for 1-2 windows (a
                             # single window always covers 100% of its span)


def classify_band(rule):
    durations = [(w['end'] - w['start']).days + 1 for w in rule['windows']]
    med = statistics.median(durations)
    if med <= 10:
        return 'tactical'
    if med <= 90:
        return 'trend'
    return 'structural'


class IntervalSet:
    """Sorted date intervals with point lookup, returning the matched window."""

    def __init__(self, windows):
        self.windows = sorted(windows, key=lambda w: w['start'])
        self.starts  = [w['start'] for w in self.windows]

    def find(self, d):
        i = bisect_right(self.starts, d) - 1
        if i >= 0 and self.windows[i]['start'] <= d <= self.windows[i]['end']:
            return self.windows[i]
        return None


def build_context_lookups(rules):
    """IntervalSets for the motion/sign context rules (127-130 window sets)."""
    by_code = {r['rule_code']: r for r in rules}
    lookups = {}
    for key, code in {**CONTEXT_MOTION, **CONTEXT_SIGN}.items():
        r = by_code.get(code)
        lookups[key] = IntervalSet(r['windows']) if r else None
    return lookups


def stamp_windows(rules, context_lookups):
    """Annotate every window with anchor date, peers (same band), context."""
    band_of = {r['id']: r['band'] for r in rules}
    # Interval sets per rule for the peer test
    sets = {r['id']: IntervalSet(r['windows']) for r in rules}
    # Calendar-tiling rules (sign transits/journeys) are states, not events —
    # they contain EVERY anchor by construction and would make the clean
    # subset permanently empty (found on first real run: Mercury combust had
    # n_clean=0 because TRN-MER-MAN-TRN tiles the calendar). Context only.
    continuous = {r['id'] for r in rules
                  if len(r['windows']) >= CONTINUOUS_MIN_WINDOWS
                  and coverage_ratio(r) >= CONTINUOUS_COVERAGE}

    for rule in rules:
        for w in rule['windows']:
            anchor = w['end'] if rule['anchor'] == 'window_end' else w['start']
            w['anchor'] = anchor

            # Peers: other SAME-band rules with a window containing the anchor
            peers = []
            for other in rules:
                if other['id'] == rule['id']:
                    continue
                if other['id'] in continuous:
                    continue
                if band_of[other['id']] != rule['band']:
                    continue
                if sets[other['id']].find(anchor):
                    peers.append(other['rule_code'])
            w['peers'] = sorted(peers)

            # Context: higher-band motion/sign states on the anchor day
            ctx = {}
            for key, lookup in context_lookups.items():
                if lookup is None:
                    continue
                hit = lookup.find(anchor)
                if key.endswith('_motion'):
                    ctx[key] = 'retrograde' if hit else 'direct'
                else:  # sign context
                    ctx[key] = hit['snapshot'].get('sign') if hit else None
            # A rule is not its own context: measuring e.g. TR-JUP-RET
            # against 'jupiter_motion' would be a tautological split.
            own = [k for k, code in {**CONTEXT_MOTION, **CONTEXT_SIGN}.items()
                   if code == rule['rule_code']]
            for k in own:
                ctx.pop(k, None)
            w['context'] = ctx

    # Tactical density inside trend/structural windows (metadata only)
    tactical_sets = [(r['rule_code'], sets[r['id']]) for r in rules if r['band'] == 'tactical']
    for rule in rules:
        if rule['band'] == 'tactical':
            continue
        for w in rule['windows']:
            count = 0
            for _, iset in tactical_sets:
                for tw in iset.windows:
                    if tw['start'] > w['end']:
                        break
                    if tw['end'] >= w['start']:
                        count += 1
            w['tactical_inside'] = count


# ── Pattern 1: level break ─────────────────────────────────────────────────────

def level_break_for_window(series, w):
    """Per-window break outcome dict, or None if not computable."""
    hi, lo = series.range_high_low(w['start'], w['end'])
    if hi is None or lo is None:
        return None
    end_i = series.idx_on_or_before(w['end'])
    if end_i is None:
        return None
    # Need full scan + forward-return room after the window
    if end_i + BREAK_SCAN + max(FWD_HORIZONS) >= len(series.dates):
        return None

    for k in range(1, BREAK_SCAN + 1):
        i = end_i + k
        c = series.close[i]
        if c is None:
            continue
        side = 'high' if c > hi else ('low' if c < lo else None)
        if side:
            fwd = {}
            for h in FWD_HORIZONS:
                fc = series.close[i + h]
                fwd[f'fwd_{h}d'] = r4((fc - c) / c * 100) if fc and c else None
            return {'side': side, 'sessions_to_break': k, **fwd}
    return {'side': 'none', 'sessions_to_break': None,
            **{f'fwd_{h}d': None for h in FWD_HORIZONS}}


def aggregate_level_break(outcomes):
    n = len(outcomes)
    if n == 0:
        return None
    agg = {'n': n}
    for side in ('high', 'low', 'none'):
        subset = [o for o in outcomes if o['side'] == side]
        entry = {'pct': r4(len(subset) / n * 100), 'n': len(subset)}
        if side != 'none' and subset:
            entry['median_sessions_to_break'] = statistics.median(
                o['sessions_to_break'] for o in subset)
            for h in FWD_HORIZONS:
                entry[f'avg_fwd_{h}d'] = mean_or_none(
                    [o[f'fwd_{h}d'] for o in subset])
        agg[f'{side}_first' if side != 'none' else 'no_break'] = entry
    return agg


# ── Pattern 2: reaction profile ────────────────────────────────────────────────

def profile_for_window(series, w):
    """Per-window {field: {offset: delta_vs_baseline}} or None."""
    ai = series.idx_on_or_after(w['anchor'])
    if ai is None:
        return None
    if ai - PROFILE_PRE < 0 or ai + PROFILE_POST >= len(series.dates):
        return None

    out = {}
    for f in INDICATOR_FIELDS:
        vals = series.fields[f]
        base = [vals[ai + o] for o in BASELINE_OFFSETS]
        base = [v for v in base if v is not None]
        if len(base) < 4:
            continue
        b = statistics.fmean(base)
        deltas = {}
        for o in range(-PROFILE_PRE, PROFILE_POST + 1):
            v = vals[ai + o]
            deltas[o] = (v - b) if v is not None else None
        out[f] = deltas
    return out if out else None


def aggregate_profiles(profiles):
    """{field: {offsets, mean_delta[], n[], t[]}} averaged across occurrences."""
    if not profiles:
        return None
    offsets = list(range(-PROFILE_PRE, PROFILE_POST + 1))
    agg = {'offsets': offsets, 'fields': {}, 'n': len(profiles)}
    for f in INDICATOR_FIELDS:
        per_offset = {o: [] for o in offsets}
        for p in profiles:
            if f not in p:
                continue
            for o in offsets:
                v = p[f].get(o)
                if v is not None:
                    per_offset[o].append(v)
        means, ns, ts = [], [], []
        for o in offsets:
            vals = per_offset[o]
            n = len(vals)
            ns.append(n)
            if n == 0:
                means.append(None); ts.append(None)
                continue
            m = statistics.fmean(vals)
            means.append(r4(m))
            if n >= 3:
                sd = statistics.stdev(vals)
                ts.append(r4(m / (sd / math.sqrt(n))) if sd > 0 else None)
            else:
                ts.append(None)
        if any(v is not None for v in means):
            agg['fields'][f] = {'mean_delta': means, 'n': ns, 't': ts}
    return agg if agg['fields'] else None


# ── Pattern 3: sequence (who moves first) ─────────────────────────────────────

def sequence_from_profile(profile_agg):
    """First offset per field where |t| >= T_THRESHOLD on 2 consecutive offsets."""
    if not profile_agg:
        return None
    offsets = profile_agg['offsets']
    moves = []
    for f, data in profile_agg['fields'].items():
        ts = data['t']
        first = None
        # Scan from D-3 onward: the baseline itself is D-10..D-4, so earlier
        # offsets are baseline territory and cannot 'move' by construction.
        for k in range(offsets.index(-3), len(offsets) - 1):
            a, b = ts[k], ts[k + 1]
            if a is not None and b is not None and abs(a) >= T_THRESHOLD and abs(b) >= T_THRESHOLD:
                first = offsets[k]
                direction = 'up' if profile_agg['fields'][f]['mean_delta'][k] > 0 else 'down'
                moves.append({'field': f, 'first_move': first, 'direction': direction})
                break
    if not moves:
        return {'sequence': [], 'note': 'no stable sequence at current threshold'}
    moves.sort(key=lambda m: m['first_move'])
    return {'sequence': moves}


# ── Split helpers (clean / peers / context) ───────────────────────────────────

def split_windows(windows):
    """(clean, by_peer_code) — clean = no same-band peer on anchor day."""
    clean = [w for w in windows if not w['peers']]
    by_peer = {}
    for w in windows:
        for code in w['peers']:
            by_peer.setdefault(code, []).append(w)
    return clean, by_peer


def context_groups(windows):
    """{context_key: {value: [windows]}} for every stamped context key."""
    groups = {}
    for w in windows:
        for k, v in w['context'].items():
            if v is None:
                continue
            groups.setdefault(k, {}).setdefault(str(v), []).append(w)
    return groups


def compute_all_splits(windows, series, per_window_fn, aggregate_fn):
    """Run a pattern over overall/clean/peers/context splits, one pass."""
    cache = {}

    def run(ws):
        outs = []
        for w in ws:
            key = w['transit_id']
            if key not in cache:
                cache[key] = per_window_fn(series, w)
            if cache[key] is not None:
                outs.append(cache[key])
        return outs

    overall_out = run(windows)
    if len(overall_out) < MIN_N:
        return None, 0, 0

    clean_w, by_peer = split_windows(windows)
    clean_out = run(clean_w)

    results = {
        'overall': aggregate_fn(overall_out),
        'clean':   aggregate_fn(clean_out) if len(clean_out) >= MIN_N else {'n': len(clean_out)},
        'peers':   [],
        'context_splits': {},
    }
    for code, ws in sorted(by_peer.items()):
        out = run(ws)
        if len(out) >= MIN_COMBO_N:
            results['peers'].append({'with': code, 'n': len(out), 'stats': aggregate_fn(out)})
        else:
            results['peers'].append({'with': code, 'n': len(out), 'stats': None})

    for key, groups in context_groups(windows).items():
        split = {}
        for val, ws in groups.items():
            out = run(ws)
            split[val] = aggregate_fn(out) if len(out) >= MIN_N else {'n': len(out)}
        if len(split) > 1:   # a split with one value carries no information
            results['context_splits'][key] = split

    return results, len(overall_out), len(clean_out)


# ── Persistence ────────────────────────────────────────────────────────────────

UPSERT_SQL = """
INSERT INTO km_rule_patterns
  (rule_id, benchmark_index_id, pattern_type, anchor, band,
   params, results, n_windows, n_clean, computed_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
ON CONFLICT (rule_id, benchmark_index_id, pattern_type)
DO UPDATE SET anchor = EXCLUDED.anchor, band = EXCLUDED.band,
              params = EXCLUDED.params, results = EXCLUDED.results,
              n_windows = EXCLUDED.n_windows, n_clean = EXCLUDED.n_clean,
              computed_at = NOW()
"""


def base_params(rule):
    return {
        'break_scan_sessions': BREAK_SCAN,
        'fwd_horizons': list(FWD_HORIZONS),
        'profile_span': [-PROFILE_PRE, PROFILE_POST],
        'baseline_offsets': [min(BASELINE_OFFSETS), max(BASELINE_OFFSETS)],
        't_threshold': T_THRESHOLD,
        'min_n': MIN_N, 'min_combo_n': MIN_COMBO_N,
        'indicator_fields': list(INDICATOR_FIELDS),
        'peer_test': 'same-band rule window containing anchor day; '
                     'calendar-tiling rules (coverage >= 0.90) excluded',
        'continuous_coverage_threshold': CONTINUOUS_COVERAGE,
        'break_basis': 'close',
        'n_rule_windows_total': len(rule['windows']),
        # Daily-signal rules are studied as synthetic 1-day windows
        'window_source': 'daily_signals_1d'
            if any(w['snapshot'].get('daily_signal') for w in rule['windows'])
            else 'transits',
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def run_study(rule=None, benchmark=None, tag=None, progress_cb=None):
    """Run the pattern study. Callable from the API (background job) or CLI.
    progress_cb(bench_name, benches_done, benches_total, rows_written) is
    invoked after each benchmark. Returns a summary dict."""
    conn = get_conn()
    today = date.today()
    written = 0
    benches_done = 0
    try:
        with conn:
            with conn.cursor() as cur:
                # Context lookups must come from ALL rules regardless of filters
                all_rules = load_rules(cur)
                context_lookups = build_context_lookups(all_rules)

                rules = load_rules(cur, only_rule=rule, only_tag=tag)
                for r in rules:
                    # Historical windows only — future windows can't be studied
                    r['windows'] = [w for w in r['windows'] if w['end'] < today]
                for r in rules:
                    r['anchor'] = classify_anchor(r)
                    r['band']   = classify_band(r) if r['windows'] else 'tactical'
                rules = [r for r in rules if len(r['windows']) >= MIN_N]

                # Stamp peers/context using band info from the FULL rule set
                for r in all_rules:
                    r['windows'] = [w for w in r['windows'] if w['end'] < today]
                    r['anchor'] = classify_anchor(r)
                    r['band']   = classify_band(r) if r['windows'] else 'tactical'
                all_rules = [r for r in all_rules if r['windows']]
                stamp_windows(all_rules, context_lookups)
                stamped = {r['rule_code']: r for r in all_rules}
                rules = [stamped[r['rule_code']] for r in rules if r['rule_code'] in stamped]

                benches = load_benchmarks(cur, only_benchmark=benchmark)
                print(f"\n  Rules: {len(rules)}   Benchmarks: {len(benches)}\n")

                for bench_id, bench_name in benches:
                    series = load_bench_series(cur, bench_id)
                    if series is None or len(series.dates) < MIN_BENCH_BARS:
                        continue
                    bench_baseline = series.baseline_drift(FWD_HORIZONS)

                    for rule in rules:
                        params = json.dumps(base_params(rule))

                        # P1 level break
                        res, n_w, n_c = compute_all_splits(
                            rule['windows'], series,
                            level_break_for_window, aggregate_level_break)
                        if res:
                            res['benchmark_baseline'] = bench_baseline
                            if rule['band'] != 'tactical':
                                dens = [w.get('tactical_inside', 0) for w in rule['windows']]
                                res['tactical_density'] = {'avg_events_inside': r4(statistics.fmean(dens))}
                            cur.execute(UPSERT_SQL, (
                                rule['id'], bench_id, 'level_break',
                                rule['anchor'], rule['band'],
                                params, json.dumps(res), n_w, n_c))
                            written += 1

                        # P2 reaction profile
                        res, n_w, n_c = compute_all_splits(
                            rule['windows'], series,
                            profile_for_window, aggregate_profiles)
                        if res:
                            cur.execute(UPSERT_SQL, (
                                rule['id'], bench_id, 'reaction_profile',
                                rule['anchor'], rule['band'],
                                params, json.dumps(res), n_w, n_c))
                            written += 1

                            # P3 sequence — derived from the overall profile
                            seq = {
                                'overall': sequence_from_profile(res.get('overall')),
                                'clean':   sequence_from_profile(res['clean'])
                                           if res['clean'] and 'fields' in (res['clean'] or {}) else None,
                                'peers': [], 'context_splits': {},
                            }
                            cur.execute(UPSERT_SQL, (
                                rule['id'], bench_id, 'sequence',
                                rule['anchor'], rule['band'],
                                params, json.dumps(seq), n_w, n_c))
                            written += 1

                    benches_done += 1
                    print(f"  [{bench_id:>4}] {bench_name:<40} done", flush=True)
                    if progress_cb:
                        progress_cb(bench_name, benches_done, len(benches), written)

        print(f"\n  Pattern rows written/updated: {written}\n", flush=True)
        return {'rows_written': written, 'benchmarks': benches_done,
                'rules': len(rules)}
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rule', help='single rule_code')
    ap.add_argument('--benchmark', help='single benchmark name or index id')
    ap.add_argument('--tag', help='only rules carrying this tag (e.g. MajorTransit)')
    args = ap.parse_args()
    run_study(rule=args.rule, benchmark=args.benchmark, tag=args.tag)


if __name__ == '__main__':
    main()
