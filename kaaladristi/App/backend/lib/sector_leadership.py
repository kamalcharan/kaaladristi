"""Explainable basket leadership. No composite score or predictive labels."""
from collections import defaultdict
from datetime import date, timedelta
import calendar
import hashlib
import json
from .market_structure_vani import number

VERSION = 1


def month_start(d, months):
    n = d.year * 12 + d.month - 1 - months
    return date(n // 12, n % 12 + 1, min(d.day, calendar.monthrange(n // 12, n % 12 + 1)[1]))


def alignment(points, monthly=False):
    """MagicRS 144/60 with 21-period fallback; monthly uses short RS sign.
    Input contains matched, completed index/benchmark period closes only.
    Missing matched periods stay None instead of shortening the clock.
    """
    ratios = [number(p.get('ratio')) for p in points]
    long_rs = []
    result = []
    for i, ratio in enumerate(ratios):
        def rs(window, minimum):
            values = [v for v in ratios[max(0, i-window+1):i+1] if v is not None]
            if ratio is None or i+1 < window or len(values) < minimum or sum(values) <= 0:
                return None
            return round((ratio / (sum(values)/len(values)) - 1) * 100, 4)
        short = rs(21, 18)
        long_rs.append(rs(144, 100))
        values = [v for v in long_rs[max(0, i-59):i+1] if v is not None]
        mean = round(sum(values)/len(values), 4) if len(values) >= 40 else None
        long = long_rs[-1]
        green = (short > 0 if short is not None else None) if monthly or mean is None or long is None else long > mean
        result.append({**points[i], 'aligned': green, 'method': 'short' if monthly or mean is None or long is None else 'long'})
    return result


def build_snapshot(symbols, periods, support, target, months, membership):
    start = month_start(date.fromisoformat(target), months).isoformat()
    by_index = defaultdict(list)
    for row in periods:
        row = dict(row)
        row['date'] = str(row['date'])[:10]
        row['available'] = str(row['available'])[:10]
        by_index[(row['index_id'], row['tf'])].append(row)
    stages = defaultdict(dict)
    for row in support:
        stages[row['index_id']][str(row['date'])[:10]] = dict(row)
    output = []
    for symbol in symbols:
        idx = symbol['id']
        weekly = alignment(sorted(by_index[idx, 'week'], key=lambda r:r['date']))
        monthly = alignment(sorted(by_index[idx, 'month'], key=lambda r:r['date']), True)
        def sample(d):
            w = next((r for r in reversed(weekly) if r['available'] <= d), None)
            m = next((r for r in reversed(monthly) if r['available'] <= d), None)
            s = stages[idx].get(d, {})
            eligible = int(s.get('eligible') or 0)
            total = len(membership.get(idx, []))
            covered = eligible >= 5
            return {'date': d, 'weekly': w['aligned'] if w else None, 'monthly': m['aligned'] if m else None,
                    'weekly_date': w['date'] if w else None, 'monthly_date': m['date'] if m else None,
                    'eligible': eligible, 'total': total,
                    'leaders': int(s.get('leaders') or 0) if covered else None,
                    'watch': int(s.get('watch') or 0) if covered else None,
                    'leaders_pct': round(100 * int(s.get('leaders') or 0)/eligible, 1) if covered else None,
                    'watch_pct': round(100 * int(s.get('watch') or 0)/eligible, 1) if covered else None}
        # Weekly support samples, plus selected session. This is reconstruction
        # using recorded membership, not published historical observations.
        ends = {date.fromisoformat(r['date']).isocalendar()[:2]:r['date'] for r in weekly if start <= r['date'] <= target}
        for d in sorted(stages[idx]):
            if start <= d <= target:
                ends[date.fromisoformat(d).isocalendar()[:2]] = d
        samples = [sample(d) for d in sorted(set([*ends.values(), target]))]
        current = sample(target)
        known = [r for r in samples if r['weekly'] is not None and r['monthly'] is not None]
        aligned = sum(r['weekly'] and r['monthly'] for r in known)
        streak = 0
        for r in reversed(samples):
            if r['weekly'] is True and r['monthly'] is True:
                streak += 1
            else:
                break
        output.append({'index_id':idx, 'name':symbol['name'], 'category':symbol['category'],
                       'current':current, 'history':samples, 'aligned_samples':aligned,
                       'known_samples':len(known), 'aligned_streak':streak})
    payload = {'date':target, 'months':months, 'start':start, 'rows':output,
               'membership':membership, 'version':VERSION}
    payload['snapshot'] = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    payload['facts'] = [f"Selected session {target}; {months}-month reconstructed history using current recorded membership.",
        'Weekly/monthly alignment uses completed calendar periods against NIFTY 500. Missing readings are unavailable.',
        'Stage support uses raw S2 and S2_CANDIDATE classifications; percentages require at least five classified constituents. No composite score.']
    for row in output:
        c = row['current']
        payload['facts'].append(f"{row['name']}: weekly aligned={c['weekly']}, monthly aligned={c['monthly']}; Stage 2 Leaders={c['leaders']} of {c['eligible']} classified, Watch={c['watch']}; classified coverage={c['eligible']}/{c['total']}; both aligned on {row['aligned_samples']}/{row['known_samples']} known samples.")
    return payload


def load_context(req, db):
    from .sector_vani import CATEGORIES
    months = getattr(req, 'leadership_months', 6)
    category = getattr(req, 'sector_category', 'sectoral')
    if months not in (3,6,12) or category not in CATEGORIES:
        raise ValueError('Invalid leadership selection')
    target = req.date
    if not target:
        rows = db.execute('SELECT max(trade_date) AS d FROM km_index_eod WHERE ema_20 IS NOT NULL')
        target = str(rows[0]['d'])[:10] if rows and rows[0]['d'] else None
    d = date.fromisoformat(target)
    symbols = db.execute('SELECT id,name,category FROM km_index_symbols WHERE is_active = true AND category = ANY(%s) ORDER BY name', (CATEGORIES[category],))
    ids = [r['id'] for r in symbols]
    if not ids:
        return build_snapshot([], [], [], target, months, {})
    revision_sql = 'SELECT index_id,revision,computed_revision FROM km_custom_index_revisions WHERE index_id=ANY(%s) ORDER BY index_id'
    before = db.execute(revision_sql, (ids,))
    members = db.execute('SELECT DISTINCT index_id,equity_id FROM km_index_constituents WHERE index_id = ANY(%s)', (ids,))
    membership = {idx: sorted(r['equity_id'] for r in members if r['index_id']==idx) for idx in ids}
    # Period ends are shared with the benchmark calendar. A partially formed
    # week/month never leaks into an earlier snapshot.
    periods = db.execute('''WITH benchmark AS (
      SELECT id FROM km_index_symbols WHERE name='NIFTY 500' AND is_active=true ORDER BY id LIMIT 1
    ), prices AS (
      SELECT index_id,trade_date,close FROM km_index_eod
      WHERE (index_id=ANY(%s) OR index_id IN (SELECT id FROM benchmark))
        AND trade_date <= %s AND trade_date >= %s AND close > 0
    ), grouped AS (
      SELECT index_id, tf, date_trunc(tf,trade_date)::date AS bucket,
        max(trade_date) AS date, (array_agg(close ORDER BY trade_date DESC))[1] AS close
      FROM prices CROSS JOIN (VALUES ('week'),('month')) t(tf)
      GROUP BY index_id,tf,date_trunc(tf,trade_date)
    ), calendar AS (
      SELECT *, (bucket + CASE WHEN tf='week' THEN interval '1 week' ELSE interval '1 month' END)::date AS available
      FROM grouped WHERE index_id IN (SELECT id FROM benchmark)
    ) SELECT i.id AS index_id, b.tf, b.date, b.available,
      CASE WHEN g.date=b.date THEN g.close/NULLIF(b.close,0) END AS ratio
      FROM unnest(%s::int[]) i(id) CROSS JOIN calendar b
      LEFT JOIN grouped g ON g.index_id=i.id AND g.tf=b.tf AND g.bucket=b.bucket
      WHERE b.available <= %s ORDER BY i.id,b.tf,b.date''', (ids,target,month_start(d,months+60),ids,target))
    support = db.execute('''SELECT c.index_id,e.trade_date AS date,
      count(*) FILTER (WHERE e.stage IN ('S1','S2','S2_CANDIDATE','S3','S4')) AS eligible,
      count(*) FILTER (WHERE e.stage='S2') AS leaders,
      count(*) FILTER (WHERE e.stage='S2_CANDIDATE') AS watch
      FROM (SELECT DISTINCT index_id,equity_id FROM km_index_constituents WHERE index_id=ANY(%s)) c
      JOIN km_equity_eod e ON e.equity_id=c.equity_id
      WHERE e.trade_date BETWEEN %s AND %s
      GROUP BY c.index_id,e.trade_date ORDER BY c.index_id,e.trade_date''', (ids,month_start(d,months),target))
    revisions = db.execute(revision_sql, (ids,))
    if before != revisions:
        raise ValueError('Basket membership changed while preparing this reading. Please retry.')
    dirty = {r['index_id'] for r in revisions if r['revision'] != r['computed_revision']}
    result = build_snapshot(symbols, periods, support, target, months, membership)
    if dirty:
        # Do not publish an old index against newly changed constituent support.
        raise ValueError('One or more curated baskets need recalculation')
    result['revisions'] = revisions
    result['snapshot'] = hashlib.sha256(json.dumps(result,sort_keys=True,default=str).encode()).hexdigest()
    db.execute_write('INSERT INTO km_leadership_observations(snapshot,payload) VALUES(%s,%s::jsonb) ON CONFLICT DO NOTHING',
               (result['snapshot'],json.dumps(result,default=str)))
    return result
