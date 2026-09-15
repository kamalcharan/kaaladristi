"""
NSE Filings Probe v2 — the three questions v1 raised
=====================================================
READ-ONLY. No DB. Run on the VPS:  python3 scripts/probe_nse_filings2.py

v1 (2026-09-15) answered depth, rate, field names and attchmntText coverage.
It raised three new questions, and the first is worth more than everything
v1 measured:

  A. IS `desc` NSE'S OWN CATEGORY, AND IS IT GOOD ENOUGH?
     v1's sample row carried desc="Analysts/Institutional Investor Meet/Con.
     Call Updates" -- NSE appears to pre-categorise every announcement. If the
     distinct set is small and clean, most of our classifier is FREE: map desc
     -> family in a dict, and the LLM only sees what the map cannot place.
     That collapses the Sprint 3 backfill from 14 days of serial inference to
     well under one. Nothing else on the table moves the cost that far.

  B. IS 180d/99,162 ROWS A SERVER-SIDE CAP?
     v1 saw the per-day rate fall as the window grew (762 -> 551/day). That is
     either seasonality or silent truncation, and the two have opposite
     consequences for backfill batching. Compares one 180d window against the
     two 90d halves that cover the same span: if the halves sum to materially
     more than the single call, the single call is being truncated.

  C. WHERE DO BULK DEALS ACTUALLY LIVE?
     v1's guess (/api/historical/bulk-deals) returned 503 on every retry.
     Tries the documented alternatives.
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

ANN_URL = 'https://www.nseindia.com/api/corporate-announcements'
ANN_REF = 'https://www.nseindia.com/companies-listing/corporate-filings-announcements'
DELAY = 3.0


def fetch(s, url, params, referer):
    q = '&'.join(f'{k}={v}' for k, v in params.items())
    try:
        r = s.get(f'{url}?{q}', referer=referer)
        try:
            d = r.json()
        except ValueError:
            return None, f'non-JSON ct={r.headers.get("content-type")}'
        return (d if isinstance(d, list) else d.get('data', [])), None
    except Exception as e:
        return None, f'{type(e).__name__}: {str(e)[:120]}'
    finally:
        time.sleep(DELAY)


def ann(s, start, end):
    return fetch(s, ANN_URL, {'index': 'equities',
                              'from_date': start.strftime('%d-%m-%Y'),
                              'to_date': end.strftime('%d-%m-%Y')}, ANN_REF)


def probe_desc(s, report):
    """A. The one that decides Sprint 3's cost."""
    print('\n=== A. IS `desc` A USABLE CATEGORY? ===')
    end = date.today() - timedelta(days=1)
    rows, err = ann(s, end - timedelta(days=30), end)
    if err:
        print(f'  FAILED: {err}')
        return
    descs = Counter((r.get('desc') or '<NULL>').strip() for r in rows)
    xbrl = sum(1 for r in rows if r.get('hasXbrl'))
    report['desc'] = {'n': len(rows), 'distinct': len(descs),
                      'has_xbrl': xbrl, 'top': descs.most_common(60)}
    print(f'  {len(rows):,} announcements over 30d')
    print(f'  {len(descs)} DISTINCT desc values')
    print(f'  hasXbrl true on {xbrl:,} ({100*xbrl/max(len(rows),1):.1f}%)')
    cum = 0
    print(f'\n  {"count":>7} {"cum%":>6}  desc')
    for d, c in descs.most_common(40):
        cum += c
        print(f'  {c:>7,} {100*cum/len(rows):>5.1f}%  {d[:88]}')
    if len(descs) > 40:
        print(f'  ... and {len(descs)-40} more, {len(rows)-cum:,} rows')
    print("""
  READ THIS AS: a SMALL distinct count with a steep cumulative curve means NSE
  has already done the categorisation. Map desc -> family in a dict and the LLM
  only sees the residue. A large, messy or free-text set means desc is a label
  rather than a taxonomy, and the keyword classifier earns its place.""")


def probe_cap(s, report):
    """B. Truncation or seasonality?"""
    print('\n=== B. IS THE LONG WINDOW TRUNCATED? ===')
    end = date.today() - timedelta(days=7)
    mid = end - timedelta(days=90)
    start = end - timedelta(days=180)

    whole, e1 = ann(s, start, end)
    h1, e2 = ann(s, start, mid)
    h2, e3 = ann(s, mid + timedelta(days=1), end)
    if e1 or e2 or e3:
        print(f'  FAILED: {e1 or e2 or e3}')
        return
    n_w, n_h = len(whole), len(h1) + len(h2)
    report['cap'] = {'single_180d': n_w, 'two_90d_halves': n_h,
                     'half1': len(h1), 'half2': len(h2)}
    print(f'  single 180d call : {n_w:,}')
    print(f'  two 90d halves   : {n_h:,}  ({len(h1):,} + {len(h2):,})')
    if n_h > n_w * 1.05:
        print(f'  ⚠ TRUNCATED — the halves carry {n_h-n_w:,} rows the single call dropped.')
        print('    Backfill MUST batch below that ceiling, and silently-short')
        print('    pages are exactly how a backfill looks complete and is not.')
    else:
        print('  ✓ no truncation — the declining per-day rate is seasonality.')
        print('    (v1 sampled results season at -1mo, which is why it read high.)')


def probe_bulk(s, report):
    """C. v1's endpoint 503'd on every retry."""
    print('\n=== C. BULK DEALS ===')
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=7)
    f, t = start.strftime('%d-%m-%Y'), end.strftime('%d-%m-%Y')
    cands = [
        ('historical/bulk-deals (v1 guess)',
         'https://www.nseindia.com/api/historical/bulk-deals', {'from': f, 'to': t}),
        ('historical/bulk-deals + optionType',
         'https://www.nseindia.com/api/historical/bulk-deals',
         {'optionType': 'bulk_deals', 'from': f, 'to': t}),
        ('snapshot-capital-market-largedeal',
         'https://www.nseindia.com/api/snapshot-capital-market-largedeal', {}),
        ('block deals',
         'https://www.nseindia.com/api/historical/block-deals', {'from': f, 'to': t}),
    ]
    ref = 'https://www.nseindia.com/report-detail/display-bulk-and-block-deals'
    out = []
    for name, url, params in cands:
        rows, err = fetch(s, url, params, ref)
        n = len(rows) if rows is not None else 0
        out.append({'name': name, 'rows': n, 'error': err})
        print(f'  {"OK " if not err else "FAIL"} {name:<38} rows={n:<6} {err or ""}')
        if rows:
            print(f'       keys: {", ".join(sorted(rows[0].keys()))}')
            print(f'       first: {json.dumps(rows[0])[:300]}')
            break
    report['bulk'] = out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    print('NSE FILINGS PROBE v2 — read-only, no DB writes')
    s, report = NseSession(), {}
    for fn in (probe_desc, probe_cap, probe_bulk):
        try:
            fn(s, report)
        except Exception as e:
            print(f'  {fn.__name__} raised {type(e).__name__}: {e}')
    if args.out:
        with open(args.out, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        print(f'\nreport -> {args.out}')


if __name__ == '__main__':
    main()
