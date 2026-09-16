"""
NSE Board Meetings Probe — finding the anchor for returns_since_result
=======================================================================
READ-ONLY. No DB writes. Run on the VPS:
    python3 scripts/probe_nse_boardmeetings.py

WHY THIS EXISTS. returns_since_result is the PEAD primitive the whole filing
plan points at, and it needs one thing: the date a company announced its
results. Measured on 28,076 real announcements (2026-07-10..08-20, results
season), the announcements feed CANNOT supply it:

  * There is no 'Financial Results' desc. A quarterly result is filed as
    'Outcome of Board Meeting' — 3,013 rows — because legally that is what it
    is: the board approves, the outcome is disclosed.
  * That category also carries dividends, fundraising and appointments, and its
    attchmntText is boilerplate: "X Limited has informed the Exchange regarding
    Outcome of Board Meeting held on <date>." It names the event type and
    nothing about what was decided.
  * The PDF filename says 'result' on 396 of 3,013 (13%) — not a discriminator.
  * hasXbrl is TRUE on all 3,013, confirming it is a defaulted flag rather than
    a signal, as probe v2 suspected.

So the anchor must come from somewhere else. NSE publishes board meetings with
their PURPOSE ahead of the meeting, which if it carries "Quarterly Results"
would give result dates cleanly, with no PDF fetch and no classifier.

⚠ MUST RUN ON THE VPS — the cloud container gets 403 to CONNECT for nseindia.

If none of these endpoints work, the fallback is fetching the PDF for the 3,013
'Outcome of Board Meeting' rows per season (~26k/yr) and reading the text — real
work, and Sprint 3 territory. Knowing which of the two we are in is the point of
this probe.
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from pipeline.utils.nse_session import NseSession   # noqa: E402

REF = 'https://www.nseindia.com/companies-listing/corporate-filings-board-meetings'
DELAY = 3.0


def try_endpoint(s, label, url, params, referer=REF):
    q = '&'.join(f'{k}={v}' for k, v in params.items())
    full = f'{url}?{q}' if q else url
    try:
        r = s.get(full, referer=referer)
        try:
            d = r.json()
        except ValueError:
            print(f'  FAIL {label:<40} non-JSON ({r.headers.get("content-type")})')
            return None
        rows = d if isinstance(d, list) else d.get('data', d.get('bm', []))
        print(f'  OK   {label:<40} rows={len(rows)}')
        return rows
    except Exception as e:
        print(f'  FAIL {label:<40} {type(e).__name__}: {str(e)[:70]}')
        return None
    finally:
        time.sleep(DELAY)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    print('NSE BOARD MEETINGS PROBE — read-only, no DB writes')

    s = NseSession()
    report = {}
    end = date.today()
    start = end - timedelta(days=30)
    f, t = start.strftime('%d-%m-%Y'), end.strftime('%d-%m-%Y')

    print('\n=== CANDIDATE ENDPOINTS ===')
    candidates = [
        ('corporate-board-meetings (window)',
         'https://www.nseindia.com/api/corporate-board-meetings',
         {'index': 'equities', 'from_date': f, 'to_date': t}),
        ('corporate-board-meetings (bare)',
         'https://www.nseindia.com/api/corporate-board-meetings',
         {'index': 'equities'}),
        ('corporates-board-meetings',
         'https://www.nseindia.com/api/corporates-board-meetings',
         {'index': 'equities', 'from_date': f, 'to_date': t}),
        ('corporates-financial-results',
         'https://www.nseindia.com/api/corporates-financial-results',
         {'index': 'equities', 'from_date': f, 'to_date': t, 'period': 'Quarterly'}),
    ]

    rows = None
    for label, url, params in candidates:
        got = try_endpoint(s, label, url, params)
        if got:
            rows, chosen = got, label
            break

    if not rows:
        print("""
  NO ENDPOINT RETURNED ROWS.
  Fallback: fetch the PDF for 'Outcome of Board Meeting' rows (~3,000 per
  results season, ~26k/yr) and read the text. That is real Sprint 3 work --
  extraction plus a classifier -- rather than a metadata join, so it changes
  the shape of returns_since_result rather than just its source.""")
        report['found'] = False
    else:
        print(f'\n=== FIELDS ({chosen}) ===')
        keys = Counter()
        for r in rows:
            keys.update(r.keys())
        for k, c in keys.most_common():
            print(f'  {k:<28} {c}/{len(rows)}')

        print('\n  FIRST ROW VERBATIM:')
        print('  ' + json.dumps(rows[0], indent=2)[:900].replace('\n', '\n  '))

        # The whole question: is there a PURPOSE field, and does it name results?
        purpose_key = next((k for k in ('bm_purpose', 'purpose', 'bm_desc',
                                        'bm_subject', 'desc') if k in keys), None)
        if purpose_key:
            purposes = Counter((r.get(purpose_key) or '').strip()[:70] for r in rows)
            res = sum(c for p, c in purposes.items()
                      if 'result' in p.lower() or 'financial' in p.lower())
            print(f'\n=== PURPOSE FIELD `{purpose_key}` ===')
            print(f'  {len(purposes)} distinct values over {len(rows)} meetings')
            print(f'  mentioning result/financial: {res} ({100*res/max(len(rows),1):.1f}%)')
            for p, c in purposes.most_common(15):
                print(f'    {c:>5}  {p}')
            print("""
  ^ IF a purpose field names results, returns_since_result is a metadata join:
    no PDF, no classifier, no LLM. IF the purposes are generic, we are back to
    reading the document.""")
            report['purpose_key'] = purpose_key
            report['purposes'] = purposes.most_common(40)
        else:
            print('\n  NO purpose-like field — this endpoint does not say WHY '
                  'the board met, so it cannot anchor results either.')
        report['found'] = True
        report['endpoint'] = chosen
        report['keys'] = dict(keys)
        report['sample'] = rows[0]

    if args.out:
        with open(args.out, 'w') as fh:
            json.dump(report, fh, indent=2, default=str)
        print(f'\nreport -> {args.out}')


if __name__ == '__main__':
    main()
