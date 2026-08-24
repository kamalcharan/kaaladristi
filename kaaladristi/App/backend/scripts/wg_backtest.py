"""
Waking Giants v4 — wake-event backtest
======================================
Measures forward returns for every wake event the journey engine found
(km_wg_journeys — archived journeys AND current ones with a wake_date),
on the same cliff-adjusted, per-ISIN-merged tape the engine itself walks.

This is the evidence the calibration knobs need (Stirring floor, the
2y-vs-3y detect floor, the freshness window) and the raw material for
the audit's confidence rule: no ★-rating before 30+ real signals.

Output: a per-horizon table grouped by hibernation-length band and by
whether the journey confirmed into Ascent. Returns are ABSOLUTE (no
benchmark subtraction yet — noted in the footer; rel-vs-NIFTY is a
follow-up once this reads sane).

Usage:
    cd App/backend
    python scripts/wg_backtest.py
"""

import os
import sys

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import compute_wg_journeys as wg  # loaders + cliff adjustment — SAME tape as the engine

HORIZONS = {'1m': 21, '3m': 63, '6m': 126, '12m': 252}
BASE_BANDS = [(2.0, 3.0, '2-3y'), (3.0, 5.0, '3-5y'), (5.0, 99.0, '5y+')]


def load_wakes(conn) -> pd.DataFrame:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT equity_id, symbol, wake_date, sleep_date, confirm_date,
                   base_years, is_current, state
            FROM km_wg_journeys
            WHERE wake_date IS NOT NULL
        """)
        rows = cur.fetchall()
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df['wake_date'] = pd.to_datetime(df['wake_date'])
    df['base_years'] = df['base_years'].astype(float)
    return df


def forward_returns(closes: pd.DataFrame, wakes: pd.DataFrame) -> pd.DataFrame:
    """Per wake event: % return at each horizon from the wake-day close,
    on the adjusted tape. A horizon that runs past the tape is NaN."""
    out = []
    for _, w in wakes.iterrows():
        eq = int(w['equity_id'])
        if eq not in closes.columns:
            continue
        s = closes[eq].dropna()
        if not len(s):
            continue
        pos = s.index.searchsorted(w['wake_date'])
        if pos >= len(s):
            continue
        entry = float(s.iloc[pos])
        if entry <= 0:
            continue
        rec = {
            'symbol': w['symbol'], 'wake_date': w['wake_date'].date(),
            'base_years': w['base_years'],
            'confirmed': w['confirm_date'] is not None,
            'still_current': bool(w['is_current']),
        }
        for name, h in HORIZONS.items():
            j = pos + h
            rec[name] = (float(s.iloc[j]) / entry - 1) * 100 if j < len(s) else np.nan
        out.append(rec)
    return pd.DataFrame(out)


def print_block(title: str, sub: pd.DataFrame):
    print(f'\n  {title}  (n={len(sub)})')
    if not len(sub):
        return
    hdr = f'    {"horizon":>8} {"n":>5} {"median%":>9} {"p25%":>8} {"p75%":>8} {"win%":>7}'
    print(hdr)
    for name in HORIZONS:
        v = sub[name].dropna()
        if not len(v):
            print(f'    {name:>8} {0:>5}')
            continue
        print(f'    {name:>8} {len(v):>5} {v.median():>9.1f} {v.quantile(0.25):>8.1f} '
              f'{v.quantile(0.75):>8.1f} {(v > 0).mean() * 100:>6.0f}%')


def run():
    conn = wg.get_conn()
    print('Waking Giants v4 — wake-event backtest')
    print('=' * 50)
    wakes = load_wakes(conn)
    if wakes.empty:
        print('  No wake events in km_wg_journeys — run compute_wg_journeys.py first.')
        return
    print(f'  Wake events: {len(wakes):,} '
          f'({int(wakes.still_current.sum())} live, {int((~wakes.still_current).sum())} archived)')

    # SAME tape as the engine: pool → ISIN twins → merged → cliff-adjusted.
    pool = wg.load_pool(conn)
    twin_map = wg.load_twin_map(conn, pool)
    ids = pool['id'].tolist()
    all_ids = sorted(set(ids) | {t for ts in twin_map.values() for t in ts})
    daily = wg.load_daily(conn, all_ids)
    closes_raw = daily.pivot(index='trade_date', columns='equity_id', values='close').sort_index()
    closes = wg.merge_isin_histories(closes_raw, ids, twin_map)
    closes = wg.adjust_close_cliffs(closes)

    fr = forward_returns(closes, wakes)
    print(f'  Measurable events on the tape: {len(fr):,}')
    if fr.empty:
        return

    print_block('ALL WAKES', fr)
    for lo, hi, label in BASE_BANDS:
        print_block(f'Hibernation {label}', fr[(fr.base_years >= lo) & (fr.base_years < hi)])
    print_block('CONFIRMED into Ascent (6/6 + monthly hold)', fr[fr.confirmed])
    print_block('Never confirmed', fr[~fr.confirmed])

    n_conf = int(fr.confirmed.sum())
    print(f"\n  Confidence gate (audit par.8.3): {len(fr)} wake signals measured "
          f"({n_conf} confirmed) — {'MEETS' if len(fr) >= 30 else 'BELOW'} the 30-signal minimum.")
    print('  NOTE: returns are absolute; benchmark-relative (vs NIFTY 500) is the follow-up '
          'once these read sane. Pre-2025 alignment data is shallow, so "confirmed" '
          'undercounts for older journeys.')
    conn.close()


if __name__ == '__main__':
    run()
