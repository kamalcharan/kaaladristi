"""Explainable basket leadership. No composite score or predictive labels."""
from collections import defaultdict
from datetime import date, timedelta
import calendar
import hashlib
import json
from .market_structure_vani import number

VERSION = 2


def rs_zone(rs, mean):
    if rs is None or mean is None: return None
    diff=rs-mean
    return ('Strong Bull' if diff>9 else 'Mild Bull' if diff>6 else 'Neutral Bull' if diff>0 else
            'Strong Bear' if diff < -9 else 'Mild Bear' if diff < -6 else 'Neutral Bear')


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
    short_rs = []
    result = []
    for i, ratio in enumerate(ratios):
        def rs(window, minimum):
            values = [v for v in ratios[max(0, i-window+1):i+1] if v is not None]
            if ratio is None or i+1 < window or len(values) < minimum or sum(values) <= 0:
                return None
            return round((ratio / (sum(values)/len(values)) - 1) * 100, 4)
        short = rs(21, 18)
        short_rs.append(short)
        recent = [v for v in short_rs[max(0, i-20):i+1] if v is not None]
        short_mean = round(sum(recent)/len(recent),4) if i >= 40 and len(recent) >= 15 else None
        long_rs.append(rs(144, 100))
        values = [v for v in long_rs[max(0, i-59):i+1] if v is not None]
        mean = round(sum(values)/len(values), 4) if len(values) >= 40 else None
        long = long_rs[-1]
        green = (short > 0 if short is not None else None) if monthly or mean is None or long is None else long > mean
        result.append({**points[i], 'aligned': green, 'method': 'short' if monthly or mean is None or long is None else 'long',
                       'short_rs':short, 'short_ma':short_mean, 'long_rs':long, 'long_ma':mean})
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
                    'leaders': int(s.get('leaders') or 0),
                    'watch': int(s.get('watch') or 0),
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
        # Count completed weekly observations, independent of display window.
        completed = []
        for w in weekly:
            if w['available'] > target:
                continue
            m = next((r for r in reversed(monthly) if r['available'] <= w['available']), None)
            completed.append({'date':w['date'], 'weekly':w['aligned'], 'monthly':m['aligned'] if m else None})
        streak = 0
        for r in reversed(completed):
            if r['weekly'] is True and r['monthly'] is True:
                streak += 1
            else:
                break
        coverage = current['eligible'] / current['total'] if current['total'] else 0
        limited = current['eligible'] < 5 or coverage < .8
        both = current['weekly'] is True and current['monthly'] is True
        previous = any(r['weekly'] is True and r['monthly'] is True for r in completed[-26:])
        if not both: streak = 0
        status = ('Limited coverage' if limited else
                  'Unavailable' if current['weekly'] is None or current['monthly'] is None else
                  'Running broadly' if both and streak >= 8 and current['leaders_pct'] >= 60 else
                  'Building' if both else 'Cooling' if previous else 'Not aligned')
        # Chart zones follow migration 169; monthly alignment still uses RS sign.
        method = next((r['method'] for r in reversed(weekly) if r['available'] <= target), 'short')
        def chart(points, variant):
            return [{'trade_date':r['date'], 'magic_rs':r[variant+'_rs'],
                     'magic_ma':r[variant+'_ma'], 'magic_rs_zone':rs_zone(r[variant+'_rs'],r[variant+'_ma'])}
                    for r in points if start <= r['date'] and r['available'] <= target]
        output.append({'index_id':idx, 'name':symbol['name'], 'category':symbol['category'],
                       'current':current, 'history':samples, 'aligned_samples':aligned,
                       'known_samples':len(known), 'aligned_streak':streak, 'status':status,
                       'alignment_history':[r for r in completed if r['date'] >= start],
                       'charts':{'weekly':chart(weekly,method), 'monthly':chart(monthly,'short'), 'weekly_method':method}})
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


def compute_context(req, db):
    from .sector_vani import CATEGORIES
    months = 12
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
    from .sector_vani import flow_state
    flows = db.execute('SELECT index_id,score_5d,score_22d,avg_amt_5d,avg_amt_22d,ret_5d FROM km_index_eod WHERE index_id=ANY(%s) AND trade_date=%s', (ids,target))
    flow_by_id = {r['index_id']:r for r in flows}
    for row in result['rows']:
        flow = flow_by_id.get(row['index_id'], {})
        row['flow'] = {'state':flow_state(flow), 'score_5d':number(flow.get('score_5d')), 'score_22d':number(flow.get('score_22d'))}
    result['revisions'] = revisions
    result['snapshot'] = hashlib.sha256(json.dumps(result,sort_keys=True,default=str).encode()).hexdigest()
    return result


NOT_READY = 'Longer-term snapshot is being prepared. Please retry after the data refresh.'


def window_snapshot(source, months):
    from copy import deepcopy
    result = deepcopy(source)
    result['months'] = months
    result['start'] = month_start(date.fromisoformat(result['date']), months).isoformat()
    counts = {}
    for row in result['rows']:
        row['history'] = [s for s in row['history'] if s['date'] >= result['start']]
        known=[s for s in row['history'] if s['weekly'] is not None and s['monthly'] is not None]
        row['known_samples']=len(known)
        row['aligned_samples']=sum(s['weekly'] and s['monthly'] for s in known)
        row['alignment_history'] = [s for s in row['alignment_history'] if s['date'] >= result['start']]
        for tf in ('weekly','monthly'):
            row['charts'][tf] = [s for s in row['charts'][tf] if s['trade_date'] >= result['start']]
        counts[row['status']] = counts.get(row['status'],0)+1
    result['counts'] = counts
    result['facts'] = [f"Closing-data session {result['date']}. Longer-term groups: {counts}.",
        'Running broadly requires W/M alignment for at least 8 completed weeks, at least 60% Stage 2 Leaders, at least 5 classified constituents and 80% coverage. These are descriptive research rules, not predictions.',
        'Building means W/M agree but the running-broadly requirements are not met. Cooling means agreement was lost after agreement within the preceding 26 weekly observations. Limited coverage overrides a broad-support conclusion.',
        'History uses current recorded membership. Display window does not change current status. Flow scores are not measured investor inflows.']
    for row in sorted(result['rows'],key=lambda r:-r['aligned_streak'])[:8]:
        c=row['current']
        result['facts'].append(f"{row['name']}: {row['status']}; W={c['weekly']}, M={c['monthly']}; {row['aligned_streak']} completed aligned weeks; Leaders {c['leaders']}/{c['eligible']}, Watch {c['watch']}, coverage {c['eligible']}/{c['total']}; current flow {row.get('flow',{}).get('state','Unavailable')}.")
    result.pop('snapshot',None)
    result['snapshot'] = hashlib.sha256(json.dumps(result,sort_keys=True,default=str).encode()).hexdigest()
    return result


def load_context(req, db):
    from .sector_vani import CATEGORIES
    months = getattr(req,'leadership_months',6)
    category = getattr(req,'sector_category','sectoral')
    if months not in (3,6,12) or category not in CATEGORIES:
        raise ValueError('Invalid leadership selection')
    target = getattr(req,'date',None)
    if target: date.fromisoformat(target)
    rows = db.execute("""SELECT s.payload FROM km_sector_leadership_snapshots s
      JOIN km_leadership_generation g ON g.id=1 AND g.generation=s.generation
      WHERE s.category=%s AND s.months=%s AND s.version=%s
        AND (%s::date IS NULL OR s.trade_date=%s::date)
      ORDER BY s.trade_date DESC LIMIT 1""", (category,months,VERSION,target,target))
    if not rows: raise ValueError(NOT_READY)
    payload = rows[0]['payload']
    if isinstance(payload,str): payload=json.loads(payload)
    ids = [r['index_id'] for r in payload['rows']]
    revisions = db.execute('SELECT index_id,revision,computed_revision FROM km_custom_index_revisions WHERE index_id=ANY(%s) ORDER BY index_id',(ids,))
    if revisions != payload.get('revisions',[]) or any(r['revision'] != r['computed_revision'] for r in revisions):
        raise ValueError(NOT_READY)
    return payload


def refresh_snapshots(conn, target=None):
    """Pipeline/admin job only. Publish all categories/windows in one transaction.
    Locks generation while reading so membership edits cannot publish mixed data.
    Uses the caller's connection, with commits only before work and at publication.
    """
    from types import SimpleNamespace
    from psycopg2.extras import RealDictCursor
    from .sector_vani import CATEGORIES
    class DB:
        def execute(self,sql,args=None):
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql,args)
                return [dict(r) for r in cur.fetchall()]
    conn.commit()
    db=DB()
    try:
        locked=db.execute('SELECT pg_try_advisory_xact_lock(208,1) AS locked')[0]['locked']
        if not locked: raise ValueError('A longer-term snapshot refresh is already running')
        generation=db.execute('SELECT generation FROM km_leadership_generation WHERE id=1 FOR SHARE')[0]['generation']
        if target is None:
            target=str(db.execute('SELECT max(trade_date) AS d FROM km_index_eod WHERE ema_20 IS NOT NULL')[0]['d'])[:10]
        date.fromisoformat(str(target))
        total=0
        for category in CATEGORIES:
            source=compute_context(SimpleNamespace(date=str(target),sector_category=category,leadership_months=12),db)
            for months in (3,6,12):
                payload=window_snapshot(source,months)
                with conn.cursor() as cur:
                    cur.execute('INSERT INTO km_leadership_observations(snapshot,payload) VALUES(%s,%s::jsonb) ON CONFLICT DO NOTHING', (payload['snapshot'],json.dumps(payload,default=str)))
                    cur.execute("""INSERT INTO km_sector_leadership_snapshots(trade_date,category,months,version,generation,payload)
                      VALUES(%s,%s,%s,%s,%s,%s::jsonb)
                      ON CONFLICT(trade_date,category,months) DO UPDATE SET version=excluded.version,
                      generation=excluded.generation,payload=excluded.payload,published_at=now()""",
                      (target,category,months,VERSION,generation,json.dumps(payload,default=str)))
                total+=1
        conn.commit()
        return total
    except Exception:
        conn.rollback()
        raise
