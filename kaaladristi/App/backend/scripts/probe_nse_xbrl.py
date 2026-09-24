#!/usr/bin/env python3
"""
Reconnaissance: is an XBRL-based earnings SURPRISE buildable from NSE?

    cd App/backend && python scripts/probe_nse_xbrl.py [--limit 20]

READ ONLY — fetches from NSE, writes nothing to the database.

⚠ MUST RUN ON THE VPS. The cloud dev container has no route to nseindia.com
(measured: HTTP 000 in 0.37s). The VPS reaches it fine — the filings ingest
runs there five times a day.

WHY THIS EXISTS
---------------
The Post-Result Drift scanner is the price-reaction HALF of PEAD. The missing
half is an earnings SURPRISE, and the blocker for it was previously recorded as
"we hold ~1 quarter against the ~8 a SUE needs". That conflates two things:

  * OUR filing records start 2026-07-10 — one quarter. True.
  * NSE'S XBRL ARCHIVE depth — NEVER CHECKED. It may go back years.

This script checks the second, because a blocker asserted without a test is not
a blocker. It answers three questions and nothing else:

  1. Is an XBRL document reachable for a result announcement we already hold?
  2. How far back does the archive go — i.e. how many quarters could we get?
  3. Is a usable earnings figure parseable out of it without an LLM?

⚠ THE ENDPOINT IS A HYPOTHESIS, NOT A FACT. `km_filings_raw.payload` carries
`hasXbrl` (TRUE on all 32,577 rows) and `attchmntFile` (the PDF) — and NO XBRL
URL. Checked: the payload's twenty keys do not include one. So the candidate
paths below are guesses to be CONFIRMED by running this, and the script reports
which respond rather than assuming any of them works. If all fail, that is the
finding: report it and stop, do not invent a fallback.

⚠ SUE DOES NOT NEED ANALYST CONSENSUS. The original Bernard & Thomas / Foster
SUE is a seasonal random walk on the company's OWN past EPS — actual vs the
same quarter a year earlier plus trend, scaled by the stdev of past surprises.
That is why archive depth is the question and a broker feed is not.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from lib.config import DATABASE_URL                    # noqa: E402
from pipeline.utils.nse_session import NseSession      # noqa: E402

import psycopg2                                        # noqa: E402

# Candidate XBRL locations, most-likely first. NOT verified — the script's job
# is to find out which (if any) answers. `{seq}` is km_filings_raw.source_ann_id,
# `{sym}` the symbol, `{file}` the attachment filename.
CANDIDATES = [
    'https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol={sym}',
    'https://www.nseindia.com/api/corporates-financial-results-data?index=equities&params={seq}',
    'https://nsearchives.nseindia.com/corporate/xbrl/{file}',
]

# Tags any Indian results XBRL should carry if it is the right document.
WANTED = ('BasicEarningsLossPerShare', 'DilutedEarningsLossPerShare',
          'RevenueFromOperations', 'ProfitLossForPeriod',
          'DateOfStartOfReportingPeriod', 'DateOfEndOfReportingPeriod')


def sample(conn, limit: int):
    """Result announcements we already hold, newest first."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.source_ann_id, r.source_symbol, r.company_name,
                   r.disseminated_at, r.doc_url, e.day_0_trade_date
              FROM km_corporate_events e
              JOIN km_filings_raw r ON r.id = e.primary_raw_id
             WHERE e.is_result_announcement AND r.has_xbrl
             ORDER BY e.day_0_trade_date DESC
             LIMIT %s
        """, (limit,))
        return cur.fetchall()


def main() -> int:
    ap = argparse.ArgumentParser(description='Probe NSE XBRL availability (read only)')
    ap.add_argument('--limit', type=int, default=20)
    args = ap.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(readonly=True, autocommit=True)
    rows = sample(conn, args.limit)
    conn.close()
    if not rows:
        print('No result announcements with has_xbrl found. Nothing to probe.')
        return 1

    print(f'Probing {len(rows)} result announcements.\n')
    sess = NseSession()
    reachable = {c: 0 for c in CANDIDATES}
    depth_hits: list[str] = []

    for seq, sym, name, diss, doc, day0 in rows:
        fname = (doc or '').rsplit('/', 1)[-1]
        print(f'· {sym or seq:<14} {name[:34]:<36} Day 0 {day0}')
        for tpl in CANDIDATES:
            url = tpl.format(seq=seq, sym=sym or '', file=fname)
            try:
                # NseSession.get(url, retries=3, referer=None) — it owns the
                # timeout and the cookie/UA dance. Passing timeout= raises.
                resp = sess.get(url)
                code = getattr(resp, 'status_code', 0)
                body = resp.text[:4000] if code == 200 else ''
            except Exception as exc:                     # noqa: BLE001
                print(f'    {"ERR":<5} {type(exc).__name__:<18} {url[:70]}')
                continue
            hits = [w for w in WANTED if w in body]
            if code == 200:
                reachable[tpl] += 1
                # A 200 that carries none of the tags is NOT a success — NSE
                # answers 200 with an HTML error page. Say which it was.
                verdict = f'{len(hits)}/{len(WANTED)} tags' if hits else 'NO TAGS (html?)'
                print(f'    200   {verdict:<18} {url[:70]}')
                if hits:
                    depth_hits.append(f'{sym} {day0}')
            else:
                print(f'    {code:<5} {"":<18} {url[:70]}')

    print('\n── SUMMARY ──')
    for tpl, n in reachable.items():
        print(f'  {n:>3}/{len(rows)} HTTP 200   {tpl}')
    print(f'\n  documents carrying real XBRL tags: {len(depth_hits)}')
    if not depth_hits:
        print('\n  FINDING: no candidate path returned a parseable XBRL document.\n'
              '  That is the result — report it. Do NOT substitute a PDF/LLM\n'
              '  fallback here: Sprint 3 already owns document extraction, and a\n'
              '  second implementation of it is how two readings of one number\n'
              '  start to disagree.')
        return 2

    print('\n  NEXT, and only if the above is non-zero: walk the archive BACKWARDS\n'
          '  to find the earliest retrievable quarter. A SUE needs ~8 quarters of\n'
          '  the company\'s OWN past EPS; the number of quarters actually\n'
          '  retrievable IS the go/no-go for the surprise leg, and it is the one\n'
          '  number this probe exists to produce.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
