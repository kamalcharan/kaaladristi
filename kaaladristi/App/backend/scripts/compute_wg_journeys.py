"""
Waking Giants v4 — journey evaluator (Hibernation → Wake → Ascent)
==================================================================
Spec: docs/claude/waking-giants-poa.md ("v4 spec CLOSED 2026-08-24").

Populates km_wg_journeys (migration 177): one CURRENT row per pooled
stock plus archived past journeys — the backtest record.

Model (owner vocabulary):
  * Golden Line = SMA150 of cliff-adjusted daily closes.
  * WAKE EVENT  = a daily close printing its highest level in >=
    MIN_BASE_YEARS_DETECT years, at/above the Golden Line, confirmed by
    a weekly close above that ceiling. base_years = time since the
    price last traded at that level ("highest close in 7 years" —
    WALCHANNAG's 2023 break of its 2016-23 hibernation).
  * ASCENDING   = MagicRS Alignment 6/6 AND the monthly close holds
    above the base ceiling.
  * RESTING     = weekly close below the Golden Line while journeying.
  * BACK TO SLEEP (no "death") = alignment collapses to <= 1 → journey
    archived, state returns to HIBERNATING. A slept stock is
    automatically future wake-watch material (SHIVALIK's loop).
  * STIRRING    = hibernating + quiet delivery-backed building measured
    against the stock's OWN delivery baseline (never absolute — the
    sniper_inst lesson).

MagicRS Alignment Score (0-6): daily green=1, weekly green=2, monthly
green=3. "Green" (INTERNAL shorthand — surfaced strings use the neutral
ZONE_LABELS vocabulary, D39) = zone on the bull side of center incl.
Neutral Bull (7-band lesson). Monthly is judged on magic_rs_short only
(migration-169: monthly long MagicRS is structurally impossible);
weekly falls back to magic_rs_short sign when the long variant is
unwarmed. Missing data is NEVER scored as red: confirmation (6/6)
inherently needs all three clocks; the sleep rule (<= 1) is evaluated
only when all three clocks have data.

Pool (Layer 0.5, unchanged from v3): active NSE, effective per-ISIN
listing age >= 6y, mcap >= 200 Cr, combined-exchange ADV >= 1 Cr.

Usage:
    cd App/backend
    python scripts/compute_wg_journeys.py             # full evaluate + write
    python scripts/compute_wg_journeys.py --dry-run   # evaluate + report only

Cadence: nightly after the daily pipeline (wire compute_wg_for_pipeline
into pipeline2 when scheduling); CLI for the first backfill.
"""

import argparse
import os
import sys
from datetime import date

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL
from lib.breadth_common import adjust_close_cliffs

# ── Named constants (calibration = edit + re-run) ────────────────────────
LOAD_YEARS            = 15     # history window: covers 7-yr bases + multi-yr journeys
MIN_BASE_YEARS_DETECT = 2.0    # bases detected from this length; UI default filter is 3
MIN_AGE_YEARS         = 6      # pool: effective per-ISIN listing age
MIN_MCAP_CR           = 200
MIN_ADV_CR            = 1.0    # combined-exchange 22-session avg turnover
GL_WINDOW             = 150    # the Golden Line
STIR_MIN_DAYS         = 6      # quiet-building sessions (of last 60) for STIRRING
STIR_DELIV_FLOOR      = 45.0   # relative delivery gate floor …
STIR_DELIV_MULT       = 1.15   # … delivery >= max(floor, mult × own 60d median)
STIR_MAX_ABS_PCT      = 2.5
STIR_MAX_RVOL         = 2.5
SLEEP_MAX_ALIGN       = 1      # journey returns to sleep at alignment <= this
MIN_BARS              = 300    # need a real history to talk about hibernation

BULL_ZONES = {'Strong Bull', 'Mild Bull', 'Neutral Bull'}


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)


# ── Pool ─────────────────────────────────────────────────────────────────

POOL_SQL = """
WITH first_listed AS (
  SELECT isin, MIN(evt) AS first_listed
  FROM (
    SELECT isin, listing_date AS evt FROM km_equity_symbols
    WHERE isin IS NOT NULL AND listing_date IS NOT NULL
    UNION ALL
    SELECT isin, first_trade_date FROM km_equity_symbols
    WHERE isin IS NOT NULL AND first_trade_date IS NOT NULL
  ) t GROUP BY isin
),
cand AS (
  SELECT s.id, s.symbol, s.company_name, s.industry, s.exchange, s.isin, s.mcap_cr,
         EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                 LEAST(COALESCE(f.first_listed, s.listing_date),
                       COALESCE(s.listing_date, f.first_listed))))::int AS age_yr
  FROM km_equity_symbols s
  LEFT JOIN first_listed f ON f.isin = s.isin
  WHERE s.is_active AND s.exchange = 'NSE'
    AND COALESCE(f.first_listed, s.listing_date) IS NOT NULL
    AND s.mcap_cr >= %(mcap)s
    AND EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                LEAST(COALESCE(f.first_listed, s.listing_date),
                      COALESCE(s.listing_date, f.first_listed)))) >= %(age)s
),
adv AS (
  SELECT c.id, SUM(x.adv_cr) AS adv_cr
  FROM cand c
  JOIN km_equity_symbols tw
    ON (c.isin IS NOT NULL AND tw.isin = c.isin) OR tw.id = c.id
  JOIN LATERAL (
    SELECT AVG(v.value_cr) AS adv_cr
    FROM (SELECT e.value_cr FROM km_equity_eod e
          WHERE e.equity_id = tw.id ORDER BY e.trade_date DESC LIMIT 22) v
  ) x ON TRUE
  GROUP BY c.id
)
SELECT c.*, a.adv_cr FROM cand c JOIN adv a ON a.id = c.id
WHERE a.adv_cr >= %(adv)s
"""


def load_pool(conn) -> pd.DataFrame:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(POOL_SQL, {'mcap': MIN_MCAP_CR, 'age': MIN_AGE_YEARS, 'adv': MIN_ADV_CR})
        rows = cur.fetchall()
    df = pd.DataFrame(rows)
    print(f'  Pool: {len(df)} stocks (age >= {MIN_AGE_YEARS}y, mcap >= {MIN_MCAP_CR} Cr, ADV >= {MIN_ADV_CR} Cr combined)')
    return df


# ── Data loads ───────────────────────────────────────────────────────────

def load_daily(conn, ids: list[int]) -> pd.DataFrame:
    """Daily close + zone history for the pool, LOAD_YEARS deep, long format."""
    sql = """
        SELECT equity_id, trade_date, close, magic_rs, magic_rs_zone
        FROM km_equity_eod
        WHERE equity_id = ANY(%s) AND close IS NOT NULL AND close > 0
          AND trade_date >= CURRENT_DATE - INTERVAL '%s days'
        ORDER BY trade_date
    """ % ('%s', LOAD_YEARS * 365)
    with conn.cursor() as cur:
        cur.execute(sql, (ids,))
        rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=['equity_id', 'trade_date', 'close', 'magic_rs', 'magic_rs_zone'])
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    df['close'] = df['close'].astype(float)
    print(f'  Daily bars: {len(df):,} rows / {df.equity_id.nunique()} stocks')
    return df


def load_tf_zones(conn, table: str, ids: list[int]) -> pd.DataFrame:
    """Weekly/monthly MagicRS reads (zone + short) for alignment."""
    sql = f"""
        SELECT equity_id, trade_date, magic_rs_zone, magic_rs_short
        FROM {table}
        WHERE equity_id = ANY(%s)
        ORDER BY trade_date
    """
    with conn.cursor() as cur:
        cur.execute(sql, (ids,))
        rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=['equity_id', 'trade_date', 'zone', 'rs_short'])
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    return df


def load_stir_inputs(conn, ids: list[int]) -> pd.DataFrame:
    """Last ~130 days of delivery/rvol/pct_chng for the STIRRING gate."""
    sql = """
        SELECT equity_id, trade_date, delivery_pct, rvol, pct_chng
        FROM km_equity_eod
        WHERE equity_id = ANY(%s)
          AND trade_date >= CURRENT_DATE - INTERVAL '130 days'
        ORDER BY trade_date
    """
    with conn.cursor() as cur:
        cur.execute(sql, (ids,))
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=['equity_id', 'trade_date', 'delivery_pct', 'rvol', 'pct_chng'])


def load_display(conn, ids: list[int]) -> dict[int, dict]:
    """Latest EOD display fields per stock."""
    sql = """
        SELECT DISTINCT ON (equity_id) equity_id, trade_date, close, pct_chng,
               delivery_pct, magic_rs, magic_rs_zone
        FROM km_equity_eod WHERE equity_id = ANY(%s)
        ORDER BY equity_id, trade_date DESC
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (ids,))
        return {r['equity_id']: dict(r) for r in cur.fetchall()}


# ── Alignment ────────────────────────────────────────────────────────────

def green_from(zone, rs_short) -> bool | None:
    """Bull-side zone, else short-RS sign fallback; None = unknown (never red)."""
    if zone is not None:
        return zone in BULL_ZONES
    if rs_short is not None:
        try:
            return float(rs_short) > 0
        except (TypeError, ValueError):
            return None
    return None


def alignment_at(daily_zone, wk_row, mo_row):
    """(score, d, w, m). Weights: daily 1, weekly 2, monthly 3."""
    d = (daily_zone in BULL_ZONES) if daily_zone is not None else None
    w = green_from(wk_row[0], wk_row[1]) if wk_row is not None else None
    # Monthly: SHORT variant only (169 lesson) — the zone column reflects
    # long-RS logic and is unreliable at monthly cadence.
    m = (float(mo_row[1]) > 0) if (mo_row is not None and mo_row[1] is not None) else None
    score = (1 if d else 0) + (2 if w else 0) + (3 if m else 0)
    return score, d, w, m


# ── Per-stock journey walk ───────────────────────────────────────────────

def walk_stock(s: pd.Series, zones: pd.Series, wk: pd.DataFrame, mo: pd.DataFrame):
    """Walk one stock's cliff-adjusted close series through the state machine.

    Returns (current: dict, archived: list[dict]). Historical alignment uses
    whatever weekly/monthly rows existed at each date (as-of joins); where the
    enriched layer is shallow (pre-2025) alignment is unknown and journeys are
    tracked on price structure alone (no sleep call without full clock data).
    """
    closes = s.dropna()
    if len(closes) < MIN_BARS:
        return None, []
    idx = closes.index
    vals = closes.values.astype(float)
    gl = closes.rolling(GL_WINDOW).mean()

    # Weekly resample of the same adjusted series (for confirm + resting).
    wk_close = closes.resample('W-FRI').last().dropna()
    mo_close = closes.resample('ME').last().dropna()

    # rolling prior max over MIN_BASE_YEARS_DETECT (calendar) — shifted so
    # "today" is excluded.
    win = f'{int(MIN_BASE_YEARS_DETECT * 365)}D'
    prior_max = closes.rolling(win).max().shift(1)

    # as-of lookups for weekly/monthly alignment rows
    wk = wk.set_index('trade_date') if wk is not None and len(wk) else None
    mo = mo.set_index('trade_date') if mo is not None and len(mo) else None

    def asof_row(frame, t):
        if frame is None:
            return None
        sub = frame.loc[:t]
        if not len(sub):
            return None
        last = sub.iloc[-1]
        return (last['zone'], last['rs_short'])

    def base_years_at(i):
        """Years since close was last >= vals[i], before the quiet stretch."""
        level = vals[i]
        before = np.where(vals[:i] >= level)[0]
        if len(before) == 0:
            # never traded here — 'highest since listing'
            return (idx[i] - idx[0]).days / 365.25, idx[0]
        j = before[-1]
        return (idx[i] - idx[j]).days / 365.25, idx[j]

    state = 'HIBERNATING'
    journey = None
    archived = []

    for i in range(len(closes)):
        t = idx[i]
        c = vals[i]
        g = gl.iloc[i]

        if state == 'HIBERNATING':
            pm = prior_max.iloc[i]
            if pd.notna(pm) and c > pm and pd.notna(g) and c >= g:
                by, bstart = base_years_at(i)
                if by >= MIN_BASE_YEARS_DETECT:
                    journey = {
                        'wake_date': t, 'base_high': float(pm),
                        'base_years': round(by, 1), 'base_start': bstart,
                        'confirm_date': None, 'weekly_confirmed': False,
                    }
                    state = 'WAKING'
        else:
            # weekly confirmation of the breakout
            if not journey['weekly_confirmed']:
                wks = wk_close.loc[journey['wake_date']:t]
                if len(wks) and (wks > journey['base_high']).any():
                    journey['weekly_confirmed'] = True

            dz = zones.iloc[i] if zones is not None else None
            score, d_g, w_g, m_g = alignment_at(
                dz if isinstance(dz, str) else None, asof_row(wk, t), asof_row(mo, t))
            clocks_known = (d_g is not None and w_g is not None and m_g is not None)

            # confirmation → ASCENDING
            if state == 'WAKING' and clocks_known and score == 6:
                mos = mo_close.loc[:t]
                if len(mos) and mos.iloc[-1] >= journey['base_high']:
                    journey['confirm_date'] = t
                    state = 'ASCENDING'

            # back to sleep — only with all three clocks known
            if clocks_known and score <= SLEEP_MAX_ALIGN:
                journey['sleep_date'] = t
                journey['end_state'] = state
                archived.append(journey)
                journey = None
                state = 'HIBERNATING'

    # ── final snapshot ──
    t = idx[-1]
    c = vals[-1]
    g = gl.iloc[-1]
    dz = zones.iloc[-1] if zones is not None else None
    score, d_g, w_g, m_g = alignment_at(
        dz if isinstance(dz, str) else None, asof_row(wk, t), asof_row(mo, t))

    resting = False
    if state in ('WAKING', 'ASCENDING') and len(wk_close):
        wk_last = float(wk_close.iloc[-1])
        gl_at_wk = gl.iloc[-1]
        resting = pd.notna(gl_at_wk) and wk_last < float(gl_at_wk)

    current = {
        'state': state,
        'resting': bool(resting),
        'align_score': int(score),
        'align_daily': d_g, 'align_weekly': w_g, 'align_monthly': m_g,
        'gl_dist_pct': round((c / float(g) - 1) * 100, 2) if pd.notna(g) and g > 0 else None,
        'close_adj': c,
    }
    if journey is not None:
        current.update({
            'base_start': journey['base_start'].date(),
            'base_high': round(journey['base_high'], 2),
            'base_years': journey['base_years'],
            'wake_date': journey['wake_date'].date(),
            'confirm_date': journey['confirm_date'].date() if journey['confirm_date'] else None,
            'pct_from_base_high': round((c / journey['base_high'] - 1) * 100, 2),
            'journey_age_days': int((t - journey['wake_date']).days),
        })
    else:
        # hibernating — describe the CURRENT sleep for the watchlist
        by, bstart = base_years_at(len(closes) - 1)
        hi_win = closes.rolling(win).max().iloc[-1]
        current.update({
            'base_start': bstart.date(), 'base_high': round(float(hi_win), 2),
            'base_years': round(by, 1),
            'wake_date': None, 'confirm_date': None,
            'pct_from_base_high': round((c / float(hi_win) - 1) * 100, 2) if pd.notna(hi_win) else None,
            'journey_age_days': None,
        })
    return current, archived


# ── STIRRING evidence (relative-delivery gate) ───────────────────────────

def stir_days_map(stir: pd.DataFrame) -> dict[int, int]:
    out = {}
    for eq, grp in stir.groupby('equity_id'):
        grp = grp.sort_values('trade_date').tail(60)
        del_ = grp['delivery_pct'].astype(float)
        med = del_.median()
        if pd.isna(med):
            out[eq] = 0
            continue
        gate = max(STIR_DELIV_FLOOR, float(med) * STIR_DELIV_MULT)
        ok = (
            (del_ >= gate)
            & (grp['pct_chng'].astype(float).abs().fillna(0) <= STIR_MAX_ABS_PCT)
            & (grp['rvol'].astype(float).fillna(1) <= STIR_MAX_RVOL)
        )
        out[eq] = int(ok.sum())
    return out


# ── Write ────────────────────────────────────────────────────────────────

CURRENT_COLS = [
    'equity_id', 'is_current', 'state', 'resting', 'base_start', 'base_high', 'base_years',
    'wake_date', 'confirm_date', 'sleep_date', 'align_score', 'align_daily', 'align_weekly',
    'align_monthly', 'gl_dist_pct', 'pct_from_base_high', 'journey_age_days', 'stir_days',
    'symbol', 'company_name', 'industry', 'exchange', 'isin', 'mcap_cr', 'close', 'pct_chng',
    'delivery_pct', 'magic_rs', 'magic_rs_zone', 'listing_age_years', 'trade_date',
]


def write_rows(conn, current_rows: list[dict], archive_rows: list[dict]):
    cols = ', '.join(CURRENT_COLS)
    ph = ', '.join([f'%({c})s' for c in CURRENT_COLS])
    with conn.cursor() as cur:
        # full rewrite — the walk re-derives everything, so replace both
        # current rows and the archive (idempotent, drift-proof).
        cur.execute('DELETE FROM km_wg_journeys')
        psycopg2.extras.execute_batch(
            cur, f'INSERT INTO km_wg_journeys ({cols}) VALUES ({ph})',
            current_rows + archive_rows, page_size=500)
    conn.commit()


def run(dry_run: bool):
    conn = get_conn()
    print('Waking Giants v4 — journey evaluator')
    print('=' * 50)
    pool = load_pool(conn)
    if pool.empty:
        print('  Empty pool — nothing to do.')
        return
    ids = pool['id'].tolist()
    daily = load_daily(conn, ids)
    closes = daily.pivot(index='trade_date', columns='equity_id', values='close').sort_index()
    closes = adjust_close_cliffs(closes)
    zones_piv = daily.pivot(index='trade_date', columns='equity_id', values='magic_rs_zone').sort_index()

    wk_all = load_tf_zones(conn, 'km_equity_weekly', ids)
    mo_all = load_tf_zones(conn, 'km_equity_monthly', ids)
    stir = stir_days_map(load_stir_inputs(conn, ids))
    display = load_display(conn, ids)
    pool_by_id = pool.set_index('id')

    current_rows, archive_rows = [], []
    counts = {'HIBERNATING': 0, 'STIRRING': 0, 'WAKING': 0, 'ASCENDING': 0, 'archived': 0}
    for eq in closes.columns:
        wk = wk_all[wk_all.equity_id == eq][['trade_date', 'zone', 'rs_short']]
        mo = mo_all[mo_all.equity_id == eq][['trade_date', 'zone', 'rs_short']]
        res = walk_stock(closes[eq], zones_piv[eq] if eq in zones_piv else None, wk, mo)
        cur_state, archived = res
        if cur_state is None:
            continue

        sd = stir.get(int(eq), 0)
        if cur_state['state'] == 'HIBERNATING' and sd >= STIR_MIN_DAYS:
            cur_state['state'] = 'STIRRING'
        counts[cur_state['state']] += 1
        counts['archived'] += len(archived)

        p = pool_by_id.loc[int(eq)]
        disp = display.get(int(eq), {})
        base = {
            'equity_id': int(eq), 'is_current': True, 'sleep_date': None,
            'stir_days': sd,
            'symbol': p['symbol'], 'company_name': p['company_name'],
            'industry': p['industry'], 'exchange': p['exchange'], 'isin': p['isin'],
            'mcap_cr': p['mcap_cr'], 'listing_age_years': int(p['age_yr']),
            'close': disp.get('close'), 'pct_chng': disp.get('pct_chng'),
            'delivery_pct': disp.get('delivery_pct'), 'magic_rs': disp.get('magic_rs'),
            'magic_rs_zone': disp.get('magic_rs_zone'), 'trade_date': disp.get('trade_date'),
        }
        row = {**{c: None for c in CURRENT_COLS}, **base,
               **{k: v for k, v in cur_state.items() if k in CURRENT_COLS}}
        current_rows.append(row)

        for j in archived:
            archive_rows.append({
                **{c: None for c in CURRENT_COLS},
                'equity_id': int(eq), 'is_current': False,
                'state': j.get('end_state', 'WAKING'), 'resting': False,
                'base_start': j['base_start'].date(), 'base_high': round(j['base_high'], 2),
                'base_years': j['base_years'], 'wake_date': j['wake_date'].date(),
                'confirm_date': j['confirm_date'].date() if j.get('confirm_date') else None,
                'sleep_date': j['sleep_date'].date(),
                'symbol': p['symbol'], 'exchange': p['exchange'], 'isin': p['isin'],
                'stir_days': None,
            })

    print(f"  States: " + '  '.join(f'{k}={v}' for k, v in counts.items()))
    if dry_run:
        wk_rows = [r for r in current_rows if r['state'] in ('WAKING', 'ASCENDING')]
        wk_rows.sort(key=lambda r: (r['state'], -(r['align_score'] or 0)))
        for r in wk_rows[:25]:
            print(f"    {r['state']:<10} {r['symbol']:<14} base={r['base_years']}y "
                  f"align={r['align_score']} wake={r['wake_date']} rest={r['resting']}")
        print('  (dry run — nothing written)')
    else:
        write_rows(conn, current_rows, archive_rows)
        print(f'  ✓ wrote {len(current_rows)} current + {len(archive_rows)} archived journeys')
    conn.close()


# ── pipeline2 entry point (wire when scheduling) ─────────────────────────

def compute_wg_for_pipeline(conn_unused, trade_date, force: bool = False) -> tuple[int, str]:
    conn = get_conn()
    try:
        run(dry_run=False)
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM km_wg_journeys WHERE is_current')
            n = cur.fetchone()[0]
        return n, 'completed'
    finally:
        conn.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Waking Giants v4 journey evaluator.')
    ap.add_argument('--dry-run', action='store_true', help='Evaluate and report, no DB writes.')
    args = ap.parse_args()
    run(dry_run=args.dry_run)
