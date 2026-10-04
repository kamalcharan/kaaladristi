"""Canonical Venus facts shared by API overlays and deterministic narration."""
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
CALENDAR_VERSION = 'venus-canonical-v1'


def _iso(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError('Canonical timestamps must include a timezone')
        return value.astimezone(IST).isoformat()
    return value.isoformat() if isinstance(value, date) else value


def load_venus_calendar(db, start, end):
    start, end = date.fromisoformat(str(start)), date.fromisoformat(str(end))
    if end < start or (end - start).days > 3660:
        raise ValueError('Calendar range must be ordered and no longer than 3660 days')
    rows = db.execute('''
        SELECT c.*,d.bracket_start_date,d.bracket_end_date,
               v.start_event,v.end_event,v.parameters
        FROM public.km_venus_calendar c
        LEFT JOIN public.km_venus_event_calendar d ON d.event_key=c.event_key
        LEFT JOIN public.km_venus_visibility_calendar v ON v.event_key=c.event_key
        WHERE c.start_date<=%s AND c.end_date>=%s
        ORDER BY c.start_date,c.event_type
    ''', (end, start))
    events = [{key: _iso(value) for key, value in row.items()} for row in rows]
    # A period and its endpoints are one episode. Bands and markers are explicit;
    # consumers must not synthesize additional markers at band boundaries.
    return {'version': CALENDAR_VERSION, 'timezone': 'Asia/Kolkata',
            'from_date': start.isoformat(), 'to_date': end.isoformat(),
            'events': events,
            'markers': [e for e in events if e['shape'] == 'point'],
            'bands': [e for e in events if e['shape'] == 'period'],
            'market_day_adjustment': False}


def _date_label(value):
    return date.fromisoformat(value).strftime('%d %b %Y')


def _boundary_label(event):
    if event.get('start_ts'):
        dt = datetime.fromisoformat(event['start_ts']).astimezone(IST)
        return dt.strftime('%d %b %Y at %H:%M IST')
    if event.get('bracket_start_date') and event.get('bracket_end_date'):
        return f"between {_date_label(event['bracket_start_date'])} and {_date_label(event['bracket_end_date'])} (daily-sample bracket)"
    return _date_label(event['start_date'])


def build_venus_readiness_text(db, date_str):
    selected = date.fromisoformat(date_str)
    calendar = load_venus_calendar(db, selected, selected + timedelta(days=90))
    sample = db.execute('''SELECT venus_sign,venus_retrograde FROM public.km_venus_daily_facts
                           WHERE date=%s''', (selected,))
    parts = []
    if sample:
        s = sample[0]
        motion = {True: 'retrograde', False: 'direct'}.get(s['venus_retrograde'], 'motion unavailable')
        sign = f" in {s['venus_sign']}" if s.get('venus_sign') else ''
        parts.append(f"Venus daily sample for {_date_label(date_str)}: {motion}{sign}.")
    events = calendar['events']
    # Same-day boundaries are stated at their model time, never as all-day state.
    points = [e for e in events if e['event_type'] in ('venus_tara_asta','venus_tara_udaya')]
    active = next((e for e in events if e['event_type']=='venus_tara_asta_period'
                   and e['start_date'] < date_str < e['end_date']), None)
    if active:
        end_event = dict(active, start_ts=active['end_ts'])
        parts.append(f"The selected date is within the calculated Venus Tara Asta period; Tara Udaya is {_boundary_label(end_event)}.")
    for event in points[:2]:
        if active and event['event_type']=='venus_tara_udaya' and event['start_ts']==active['end_ts']:
            continue
        parts.append(f"{event['display_name']}: {_boundary_label(event)}.")
    crossings = [e for e in events if e['event_type']=='mercury_direct_venus_retrograde_crossing']
    if crossings:
        parts.append(f"Mercury direct / Venus retrograde crossing: {_boundary_label(crossings[0])}.")
    if not parts:
        return None
    parts.append('Visibility dates use the Ujjain model and include weekends and holidays. '
                 'Tara Asta/Udaya are distinct from angular combustion and motion changes; '
                 'these events alone do not establish market direction.')
    return ' '.join(parts)
