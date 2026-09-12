"""Cheap intent projections of an already-published snapshot; no DB calculations."""


def intent_facts(ctx, intent):
    rows = ctx.get('rows', [])
    counts = {s: sum(r['status'] == s for r in rows) for s in
              ('Running broadly', 'Building', 'Cooling', 'Limited coverage', 'Not aligned', 'Unavailable')}
    facts = [f"Closing session {ctx['date']}; display window {ctx['months']} months; {len(rows)} baskets. Groups: {counts}.",
             'W=weekly, M=monthly. Completed periods against NIFTY 500. Missing readings are not negative readings.',
             'Stage counts use current recorded membership. Daily MagicRS is not included. Current flow scores do not measure net cash inflows.',
             'Running broadly requires both W/M aligned for 8 completed weeks, 60% Leaders among classified stocks, 5 classified and 80% coverage. Building has agreement but fails at least one of these requirements. Cooling lost agreement after recent agreement.']
    suffix = intent.removeprefix('sector.leadership').lstrip('.')
    if suffix in ('building', 'cooling'):
        rows = [r for r in rows if r['status'] == suffix.title()]
    elif suffix == 'flow':
        rows = [r for r in rows if
                (r['status'] == 'Running broadly' and r.get('flow', {}).get('state') in ('Fading', 'Outflow')) or
                (r['status'] == 'Cooling' and r.get('flow', {}).get('state') in ('Strong', 'Building'))]
        facts.append('These examples have differing current-flow and longer-term readings; absence of examples does not prove every basket agrees.')
    rows = sorted(rows, key=lambda r: (-r['aligned_streak'], r['name']))
    facts.append(f'{len(rows)} baskets match this question. {min(5,len(rows))} examples follow; name at most two in the explanation. If none match, say so plainly.')
    for r in rows[:5]:
        c = r['current']
        eligible, total = c['eligible'], c['total']
        missing = []
        if r['aligned_streak'] < 8: missing.append('fewer than 8 completed aligned weeks')
        if eligible < 5: missing.append('fewer than 5 classified stocks')
        if not total or eligible / total < .8: missing.append('below 80% classified coverage')
        if c.get('leaders_pct') is None or c['leaders_pct'] < 60: missing.append('60% Leaders requirement not established')
        h = r.get('alignment_history', [])
        both = sum(s['weekly'] is True and s['monthly'] is True for s in h)
        unknown = sum(s['weekly'] is None or s['monthly'] is None for s in h)
        interrupted = len(h) - both - unknown
        facts.append(f"{r['name']}: {r['status']}; W={c['weekly']}, M={c['monthly']}; current run={r['aligned_streak']} completed weeks. "
                     f"Displayed history: {both} both aligned, {interrupted} without agreement, {unknown} unavailable weekly observations. "
                     f"Leaders={c['leaders']}/{eligible}; Watch={c['watch']}; classified={eligible}/{total}. "
                     f"Current flow={r.get('flow',{}).get('state','Unavailable')}. "
                     f"Missing running-broadly requirements: {', '.join(missing) if missing else 'none among persistence and stage-support tests'}.")
    return facts
