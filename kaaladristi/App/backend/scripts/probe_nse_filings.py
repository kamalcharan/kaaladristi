"""
NSE Filings Source Probe — Sprint 1, item 6
============================================
READ-ONLY reconnaissance. Touches no database, writes no table, changes nothing.
Answers the four questions the filing-intelligence POA is blocked on
(docs/claude/filing-intelligence-poa.md → "No decisions are open"):

  1. How far back does /api/corporate-announcements actually serve?
  2. What are the real rate limits, and what window size is accepted per call?
  3. What are the EXACT field names? (the POA's schema is written against
     guessed names -- symbol / an_dt / attchmntText / attchmntFile)
  4. What share of announcements carry a usable `attchmntText` summary?
     If it is high, the PDF fetch and extraction drop out for most filings and
     Sprint 3 gets materially cheaper.

⚠ MUST RUN ON THE VPS. The cloud dev container's network policy answers
`403 to CONNECT` for nseindia.com, so none of this can be validated there.

Usage (from App/backend):
    python scripts/probe_nse_filings.py
    python scripts/probe_nse_filings.py --out /tmp/nse_probe.json

Deliberately gentle: serial requests, a fixed delay between them, and a hard
cap on how many it makes. It runs beside a live pipeline and must never look
like a scraper.
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from datetime import date, timedelta

# Makes `pipeline` importable however this is invoked -- `python3
# scripts/probe_nse_filings.py` from App/backend, or by absolute path. The
# earlier rsplit('/scripts/') form only resolved for an ABSOLUTE path: run
# relatively it inserted the script's own FILE path into sys.path and the
# import below died with ModuleNotFoundError. Same idiom every other CLI
# script in this directory uses, and the same failure
# compute_scan_membership_snapshot.py records in its own header.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from pipeline.utils.nse_session import NseSession   # noqa: E402  (proven cookie/403 handling)

ANN_URL = 'https://www.nseindia.com/api/corporate-announcements'
ANN_REFERER = 'https://www.nseindia.com/companies-listing/corporate-filings-announcements'
BULK_URL = 'https://www.nseindia.com/api/historical/bulk-deals'
BULK_REFERER = 'https://www.nseindia.com/report-detail/display-bulk-and-block-deals'

REQUEST_DELAY_SEC = 3.0      # be a good citizen; NSE is not paying for this
MAX_REQUESTS = 30            # hard cap -- a probe, not a crawl


class Probe:
    def __init__(self):
        self.s = NseSession()
        self.n = 0
        self.report = {'depth': [], 'window': [], 'fields': {}, 'attchmnt': {}, 'bulk': {}}

    def get(self, url, params, referer):
        if self.n >= MAX_REQUESTS:
            raise RuntimeError(f'request cap {MAX_REQUESTS} reached -- stopping')
        self.n += 1
        q = '&'.join(f'{k}={v}' for k, v in params.items())
        t0 = time.time()
        try:
            resp = self.s.get(f'{url}?{q}', referer=referer)
            dt = time.time() - t0
            try:
                return resp.json(), dt, None
            except ValueError:
                return None, dt, f'non-JSON ({len(resp.content)}b, ct={resp.headers.get("content-type")})'
        except Exception as e:
            return None, time.time() - t0, f'{type(e).__name__}: {e}'
        finally:
            time.sleep(REQUEST_DELAY_SEC)

    # -- Q1: how deep does it go? ------------------------------------------
    def probe_depth(self):
        print('\n=== Q1  HISTORICAL DEPTH ===')
        today = date.today()
        for months_back in (1, 6, 12, 24, 36, 60):
            end = today - timedelta(days=30 * months_back)
            start = end - timedelta(days=7)
            data, dt, err = self.get(ANN_URL, {
                'index': 'equities',
                'from_date': start.strftime('%d-%m-%Y'),
                'to_date': end.strftime('%d-%m-%Y'),
            }, ANN_REFERER)
            rows = len(data) if isinstance(data, list) else (
                len(data.get('data', [])) if isinstance(data, dict) else 0)
            row = {'months_back': months_back, 'window': f'{start}..{end}',
                   'rows': rows, 'secs': round(dt, 1), 'error': err}
            self.report['depth'].append(row)
            print(f'  -{months_back:>2}mo  {start}..{end}  rows={rows:<6} {dt:.1f}s  {err or ""}')
            if err is None and rows == 0:
                print('  ^ zero rows with no error -- likely the depth limit')

    # -- Q2: how big a window will it accept? ------------------------------
    def probe_window(self):
        print('\n=== Q2  WINDOW SIZE / RATE ===')
        end = date.today() - timedelta(days=7)
        for days in (1, 7, 30, 90, 180):
            start = end - timedelta(days=days)
            data, dt, err = self.get(ANN_URL, {
                'index': 'equities',
                'from_date': start.strftime('%d-%m-%Y'),
                'to_date': end.strftime('%d-%m-%Y'),
            }, ANN_REFERER)
            rows = len(data) if isinstance(data, list) else (
                len(data.get('data', [])) if isinstance(data, dict) else 0)
            self.report['window'].append({'days': days, 'rows': rows,
                                          'secs': round(dt, 1), 'error': err})
            print(f'  {days:>4}d window  rows={rows:<6} {dt:.1f}s  {err or ""}')
            if rows and days > 1:
                print(f'       ~{rows/days:.0f} announcements/day')

    # -- Q3 + Q4: field names, and attchmntText coverage -------------------
    def probe_fields(self):
        print('\n=== Q3/Q4  FIELD NAMES + SUMMARY COVERAGE ===')
        end = date.today() - timedelta(days=1)
        start = end - timedelta(days=5)
        data, dt, err = self.get(ANN_URL, {
            'index': 'equities',
            'from_date': start.strftime('%d-%m-%Y'),
            'to_date': end.strftime('%d-%m-%Y'),
        }, ANN_REFERER)
        if err:
            print(f'  FAILED: {err}')
            return
        rows = data if isinstance(data, list) else data.get('data', [])
        if not rows:
            print('  no rows returned')
            return

        keys = Counter()
        for r in rows:
            keys.update(r.keys())
        self.report['fields'] = {'sample_rows': len(rows), 'keys': dict(keys)}
        print(f'  {len(rows)} announcements; keys present (count/{len(rows)}):')
        for k, c in keys.most_common():
            print(f'    {k:<24} {c}')

        print('\n  FIRST ROW VERBATIM (this is what the schema must match):')
        print('  ' + json.dumps(rows[0], indent=2)[:1200].replace('\n', '\n  '))

        # Q4 -- does the JSON summary carry enough to classify without the PDF?
        text_key = next((k for k in ('attchmntText', 'attchmntTxt', 'desc',
                                     'smIndustry', 'attchmnt_text') if k in keys), None)
        if text_key:
            lens = [len((r.get(text_key) or '').strip()) for r in rows]
            usable = sum(1 for n in lens if n >= 80)
            self.report['attchmnt'] = {
                'key': text_key, 'n': len(lens), 'usable_ge80': usable,
                'pct_usable': round(100 * usable / len(lens), 1),
                'mean_len': round(sum(lens) / len(lens), 1),
                'empty': sum(1 for n in lens if n == 0),
            }
            print(f'\n  SUMMARY FIELD `{text_key}`:')
            print(f'    usable (>=80 chars): {usable}/{len(lens)} = '
                  f'{100*usable/len(lens):.1f}%   mean {sum(lens)/len(lens):.0f} chars, '
                  f'{sum(1 for n in lens if n==0)} empty')
            print('    ^ HIGH means most filings classify with no PDF fetch at all.')
        else:
            print('\n  NO summary-text field found -- every filing needs its PDF. '
                  'Sprint 3 costs its full budget.')

    # -- bulk deals --------------------------------------------------------
    def probe_bulk(self):
        print('\n=== BULK DEALS ===')
        end = date.today() - timedelta(days=1)
        start = end - timedelta(days=14)
        data, dt, err = self.get(BULK_URL, {
            'optionType': 'bulk_deals',
            'from': start.strftime('%d-%m-%Y'),
            'to': end.strftime('%d-%m-%Y'),
        }, BULK_REFERER)
        if err:
            self.report['bulk'] = {'error': err}
            print(f'  FAILED: {err}  (try the report-detail CSV route instead)')
            return
        rows = data.get('data', []) if isinstance(data, dict) else (data or [])
        self.report['bulk'] = {'rows': len(rows),
                               'keys': sorted(rows[0].keys()) if rows else []}
        print(f'  {len(rows)} deals over 14d ({dt:.1f}s)')
        if rows:
            print('  keys: ' + ', '.join(sorted(rows[0].keys())))
            print('  first: ' + json.dumps(rows[0])[:400])


def main():
    ap = argparse.ArgumentParser(description='Read-only NSE filings source probe')
    ap.add_argument('--out', default=None, help='write the JSON report here')
    args = ap.parse_args()

    print('NSE FILINGS PROBE — read-only, no DB writes')
    print(f'delay {REQUEST_DELAY_SEC}s between requests, hard cap {MAX_REQUESTS}')

    p = Probe()
    try:
        p.probe_depth()
        p.probe_window()
        p.probe_fields()
        p.probe_bulk()
    except RuntimeError as e:
        print(f'\nstopped: {e}')

    print(f'\nrequests made: {p.n}')
    if args.out:
        with open(args.out, 'w') as f:
            json.dump(p.report, f, indent=2, default=str)
        print(f'report -> {args.out}')

    print("""
WHAT TO DO WITH THIS
  Q1 depth      -> bounds the metadata backfill. Depth is a ONE-TIME
                   opportunity: a window the source ages out of cannot be
                   re-fetched later, so take the deepest it serves.
  Q2 window     -> sets the backfill batch size and the announcements/day rate
                   the POA's volume estimates assumed (~300/day).
  Q3 fields     -> the POA's km_filings_raw schema is written against GUESSED
                   names. Correct them against the verbatim row above before
                   writing the migration.
  Q4 attchmnt   -> if usable% is high, most filings classify from the JSON
                   summary with no PDF fetch, no extraction and no OCR risk.
                   That is the single biggest cost lever in Sprint 3.
""")


if __name__ == '__main__':
    main()
