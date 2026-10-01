#!/usr/bin/env python3
"""
Reconnaissance: which policy and geopolitics sources can we read, and how much
do they send a day?

    cd App/backend && python scripts/probe_policy_sources.py [--samples 5] [--no-db]

READ ONLY. Fetches from public sites and reads (never writes) the industry list.

⚠ MUST RUN ON THE VPS (or inside kd-pipeline-api2). The cloud dev container is
blocked from every one of these hosts (measured 2026-10-01: pib.gov.in,
rbi.org.in, sebi.gov.in, dgtr.gov.in, dgft.gov.in, cbic.gov.in,
api.gdeltproject.org all refused by the egress proxy).

WHAT IT ANSWERS, per source
  1. Does it answer, and in what shape (RSS / JSON / HTML only)?
  2. How many items in the last 24 hours and the last 7 days?
  3. How many survive the free keyword gate (the step before any model call)?
  4. A few sample titles, so a human can judge whether the gate is sane.

Plus, from the DB: how many distinct industries the model would choose from.
That closed list is the answer to "the model must not invent a sector".

⚠ The URLs are the best-known public endpoints, NOT verified from here. A
source that fails is a finding to report, never a reason to guess another URL.
"""
from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import quote

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) DristiQ-probe/1.0',
      'Accept': 'application/rss+xml, application/xml, application/json, text/html;q=0.8'}

GN = 'https://news.google.com/rss/search?hl=en-IN&gl=IN&ceid=IN:en&q='
GD = ('https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json'
      '&maxrecords=250&sort=datedesc&timespan={span}&query=')

# (key, kind, label, url). kind: rss | gdelt | html
SOURCES = [
    ('pib_all', 'rss', 'PIB — all press releases',
     'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3'),
    ('rbi_press', 'rss', 'RBI — press releases',
     'https://www.rbi.org.in/pressreleases_rss.xml'),
    ('rbi_notif', 'rss', 'RBI — notifications',
     'https://www.rbi.org.in/notifications_rss.xml'),
    ('sebi', 'rss', 'SEBI — circulars and orders',
     'https://www.sebi.gov.in/sebirss.xml'),
    ('dgtr', 'html', 'DGTR — anti-dumping (home page)', 'https://www.dgtr.gov.in/'),
    ('dgft', 'html', 'DGFT — notifications page', 'https://www.dgft.gov.in/CP/?opt=notification'),
    ('cbic', 'html', 'CBIC — customs tariff notifications',
     'https://taxinformation.cbic.gov.in/content-page/explore-notification'),
    ('egazette', 'html', 'Gazette of India', 'https://egazette.gov.in/'),
    ('gn_policy', 'rss', 'Google News — India trade policy',
     GN + quote('(anti-dumping OR "customs duty" OR "export ban" OR PLI OR safeguard duty) India when:7d')),
    ('gn_geo', 'rss', 'Google News — Middle East reconstruction',
     GN + quote('("Middle East" OR Gulf OR Gaza OR Iran) reconstruction OR ceasefire OR sanctions when:7d')),
    ('gdelt_geo', 'gdelt', 'GDELT — conflict / sanctions / reconstruction (1 day)',
     GD.format(span='1d') + quote('(sanctions OR ceasefire OR reconstruction OR blockade OR "trade deal") sourcelang:english')),
    ('gdelt_india', 'gdelt', 'GDELT — India policy (1 day)',
     GD.format(span='1d') + quote('India (tariff OR "anti-dumping" OR "export ban" OR "import duty" OR PLI) sourcelang:english')),
]

# The free gate. Deliberately broad: it only has to throw away ceremonies,
# visits, awards and greetings — the bulk of PIB — before a model is paid for.
GATE = re.compile(
    r'\b(duty|duties|tariff|anti-?dumping|safeguard|countervailing|export|import|ban|'
    r'curb|quota|subsid|incentive|PLI|scheme|cabinet approves|approves|allocation|'
    r'outlay|capex|procure|tender|order|policy|regulat|circular|notification|'
    r'repo|liquidity|lending|NBFC|bank|insurance|mutual fund|'
    r'sanction|war|conflict|ceasefire|reconstruction|blockade|strait|crude|oil|'
    r'gas|LNG|shipping|freight|steel|cement|power|solar|defen[cs]e|railway|'
    r'fertili[sz]er|pharma|semiconductor|electronics|textile|auto|EV|mining|coal)\b',
    re.I)


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
    except (TypeError, ValueError):
        d = None
    if d is None:
        for fmt in ('%Y%m%dT%H%M%SZ', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%d %H:%M:%S', '%d-%m-%Y'):
            try:
                d = dt.datetime.strptime(s, fmt)
                break
            except ValueError:
                pass
    if d is not None and d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d


def rss_items(body: bytes):
    root = ET.fromstring(body)
    out = []
    for it in root.iter():
        if it.tag.split('}')[-1] not in ('item', 'entry'):
            continue
        f = {c.tag.split('}')[-1]: (c.text or '').strip() for c in it}
        out.append({'title': f.get('title', ''),
                    'when': parse_date(f.get('pubDate') or f.get('published') or f.get('updated') or f.get('date')),
                    'text': f.get('title', '') + ' ' + re.sub('<[^>]+>', ' ', f.get('description', ''))})
    return out


def gdelt_items(body: bytes):
    arts = json.loads(body or b'{}').get('articles') or []
    return [{'title': a.get('title', ''), 'when': parse_date(a.get('seendate')),
             'text': a.get('title', ''), 'domain': a.get('domain')} for a in arts]


def probe(key, kind, label, url, samples, now):
    r = {'key': key, 'label': label, 'kind': kind}
    try:
        resp = requests.get(url, headers=UA, timeout=30)
    except requests.RequestException as e:
        r.update(ok=False, why=f'{type(e).__name__}: {str(e)[:120]}')
        return r
    r.update(status=resp.status_code, bytes=len(resp.content),
             ctype=resp.headers.get('content-type', '')[:40])
    if resp.status_code >= 400:
        r.update(ok=False, why=f'HTTP {resp.status_code}')
        return r
    if kind == 'html':
        # Structure only: a page with no feed means a scraper, which is a cost
        # worth knowing before choosing the source.
        t = resp.text
        r.update(ok=True, feed_links=len(re.findall(r'rss|\.xml', t, re.I)),
                 pdf_links=len(re.findall(r'\.pdf', t, re.I)),
                 js_app='<app-root' in t or 'ng-version' in t or '__NEXT_DATA__' in t)
        return r
    try:
        items = rss_items(resp.content) if kind == 'rss' else gdelt_items(resp.content)
    except (ET.ParseError, ValueError) as e:
        r.update(ok=False, why=f'unparseable: {str(e)[:100]}', head=resp.text[:160])
        return r
    d1 = [i for i in items if i['when'] and now - i['when'] <= dt.timedelta(days=1)]
    d7 = [i for i in items if i['when'] and now - i['when'] <= dt.timedelta(days=7)]
    gated = [i for i in d7 if GATE.search(i['text'])]
    r.update(ok=True, items=len(items), undated=sum(1 for i in items if not i['when']),
             last_24h=len(d1), last_7d=len(d7), gate_pass_7d=len(gated),
             oldest=min((i['when'] for i in items if i['when']), default=None),
             sample_pass=[i['title'][:110] for i in gated[:samples]],
             sample_drop=[i['title'][:110] for i in d7 if not GATE.search(i['text'])][:samples])
    if kind == 'gdelt':
        doms = {}
        for i in items:
            doms[i.get('domain')] = doms.get(i.get('domain'), 0) + 1
        r['top_domains'] = sorted(doms.items(), key=lambda x: -x[1])[:6]
    return r


def industries():
    import psycopg2
    from lib.config import DATABASE_URL
    with psycopg2.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute("SET TRANSACTION READ ONLY")
        cur.execute("""SELECT industry, count(*) FROM km_equity_symbols
                       WHERE is_active AND industry IS NOT NULL AND industry <> ''
                       GROUP BY 1 ORDER BY 2 DESC""")
        return cur.fetchall()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--samples', type=int, default=5)
    ap.add_argument('--no-db', action='store_true')
    ap.add_argument('--json', action='store_true', help='machine-readable output')
    a = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    results = [probe(*s, a.samples, now) for s in SOURCES]

    if a.json:
        print(json.dumps(results, default=str, indent=1))
    else:
        for r in results:
            print(f"\n== {r['label']}  [{r['key']}]")
            if not r.get('ok'):
                print(f"   FAILED  {r.get('why')}  {r.get('head', '')}")
                continue
            print(f"   HTTP {r['status']}  {r['bytes']}B  {r['ctype']}")
            if r['kind'] == 'html':
                print(f"   no feed parsed — feed-ish links {r['feed_links']}, pdf links {r['pdf_links']}, "
                      f"JS app {r['js_app']}")
                continue
            print(f"   items {r['items']} (undated {r['undated']}, oldest {r['oldest']})")
            print(f"   last 24h {r['last_24h']}   last 7d {r['last_7d']}   pass the gate (7d) {r['gate_pass_7d']}")
            for t in r['sample_pass']:
                print(f"     + {t}")
            for t in r['sample_drop']:
                print(f"     - {t}")
            if r.get('top_domains'):
                print(f"   top domains {r['top_domains']}")

    if not a.no_db:
        try:
            rows = industries()
            print(f"\n== Industry list (closed vocabulary): {len(rows)} industries, "
                  f"{sum(n for _, n in rows)} active symbols")
            print('   largest: ' + ', '.join(f'{i} ({n})' for i, n in rows[:12]))
            print('   smallest: ' + ', '.join(f'{i} ({n})' for i, n in rows[-6:]))
        except Exception as e:  # the probe is about the web; the DB part is a bonus
            print(f"\n== Industry list: skipped ({type(e).__name__}: {str(e)[:100]})")


if __name__ == '__main__':
    main()
