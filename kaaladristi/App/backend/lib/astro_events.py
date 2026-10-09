"""One published event contract for Rule Engine, Catalog, Almanac and VaNi."""
from datetime import date, datetime, timedelta, timezone
IST = timezone(timedelta(hours=5, minutes=30))


def serial(row):
    return {k: (v.astimezone(IST).isoformat() if isinstance(v,datetime) else
                v.isoformat() if isinstance(v,date) else v) for k,v in row.items()}


def families(db, selected, admin=False):
    day=date.fromisoformat(str(selected))
    rows=db.execute('''SELECT f.*,s.occurrences,s.first_date,s.last_date,s.previous_date,s.next_date,s.ongoing
      FROM public.km_astro_family_catalog f LEFT JOIN (
        SELECT family_id,count(*) AS occurrences,min(start_date) AS first_date,max(end_date) AS last_date,
        max(end_date) FILTER(WHERE end_date<%s) AS previous_date,
        min(start_date) FILTER(WHERE start_date>%s) AS next_date,
        bool_or(shape='period' AND start_date<=%s AND end_date>=%s) AS ongoing
        FROM public.km_astro_managed_occurrences e GROUP BY family_id
      ) s ON s.family_id=f.id WHERE (%s OR (f.catalog_visible AND f.is_active)) ORDER BY f.display_order''',
      (day,day,day,day,admin))
    return [serial(r) for r in rows]


def occurrences(db,start,end,admin=False):
    start,end=date.fromisoformat(str(start)),date.fromisoformat(str(end))
    if end<start or (end-start).days>18300:
        raise ValueError('Range must be ordered and no longer than 18300 days')
    rows=db.execute('''SELECT e.* FROM public.km_astro_managed_occurrences e
      JOIN public.km_astro_family_catalog f ON f.id=e.family_id
      WHERE e.start_date<=%s AND e.end_date>=%s AND (%s OR (f.catalog_visible AND f.is_active))
      ORDER BY e.start_date,e.event_key''',(end,start,admin))
    return [serial(r) for r in rows]


def narration(db,day):
    selected=date.fromisoformat(day)
    events=occurrences(db,selected,selected+timedelta(days=90))
    if not events: return None
    parts=[]
    # One nearest/current occurrence per published family; no duplicated point/band story.
    for family in families(db,selected):
        rows=[e for e in events if e['family_id']==family['id']]
        if not rows: continue
        current=[e for e in rows if e['start_date']<=day<=e['end_date']]
        e=(current or rows)[0]
        def label(key):
            ts=e.get(key+'_ts')
            if ts:return datetime.fromisoformat(ts).astimezone(IST).strftime('%d %b %Y, %H:%M IST')
            return date.fromisoformat(e[key+'_date']).strftime('%d %b %Y')
        when=label('start')
        if e.get('bracket_start_date'):
            when=f"between {e['bracket_start_date']} and {e['bracket_end_date']} (daily-sample bracket)"
        elif e['shape']=='period':when+=f" to {label('end')}"
        details=e.get('details') or {}
        sign=f" · {details['sign']}" if details.get('sign') else ''
        parts.append(f"{e['display_name']}{sign}: {when}.")
    return '\n'.join(parts)+ '\nDates include weekends and holidays. Visibility, motion and conjunctions are distinct events; market direction requires separate price and participation evidence.'
