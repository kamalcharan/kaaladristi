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
import datetime as dt
import json
import os
import sys
from urllib.parse import quote

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


# The results page each API route backs. NSE's /api/ routes answer 200 with an
# HTML shell when the referer does not match, which is indistinguishable from a
# genuine "no data" answer unless the body is printed. The first run passed no
# referer at all and reported 20/20 HTTP 200 carrying no XBRL tags — a result
# that cannot tell those two cases apart.
RESULTS_REFERER = 'https://www.nseindia.com/companies-listing/corporate-filings-financial-results'


def dump(sess, seq, sym: str) -> None:
    """Print what the two API routes ACTUALLY return, with and without a referer.

    Answers one question the tag scan cannot: is the 200 a JSON listing (which
    may carry the XBRL url the announcements payload lacks) or an HTML shell?
    Prints the body rather than classifying it — a classifier here would be the
    same mistake twice.
    """
    for tpl in CANDIDATES[:2]:
        url = tpl.format(seq=seq, sym=sym or '', file='')
        for label, ref in (('no referer', None), ('with referer', RESULTS_REFERER)):
            print(f'\n--- {label}: {url}')
            try:
                resp = sess.get(url, referer=ref) if ref else sess.get(url)
            except Exception as exc:                     # noqa: BLE001
                print(f'    ERR {type(exc).__name__}: {exc}')
                continue
            ctype = resp.headers.get('content-type', '?')
            body = resp.text or ''
            print(f'    status {resp.status_code}  content-type {ctype}  {len(body)} bytes')
            print('    ' + body[:700].replace('\n', ' ')[:700])
            # Name every key that could plausibly hold a document link, so the
            # next step is a fact rather than another guess.
            try:
                data = json.loads(body)
            except Exception:                            # noqa: BLE001
                continue
            rows = data if isinstance(data, list) else (data.get('data') or [])
            if rows and isinstance(rows[0], dict):
                keys = sorted(rows[0].keys())
                print(f'    JSON: {len(rows)} rows, keys = {keys}')
                linky = [k for k in keys
                         if any(t in k.lower() for t in ('xbrl', 'file', 'url', 'attach', 'link'))]
                print(f'    link-shaped keys = {linky}')
                for k in linky:
                    print(f'      {k} = {rows[0].get(k)!r}')



# ── Chain probe ────────────────────────────────────────────────────────────
#
# What the --dump run established, and why the earlier "no XBRL" verdict was
# wrong about the cause:
#
#   * corporates-financial-results answered application/json with `[]`, NOT an
#     HTML shell. The route works; `symbol=` is simply not how it is filtered.
#   * corporates-financial-results-data answered, in plain text,
#         "Required all params : params, seq_id, industry, ind, format"
#     So the document endpoint EXISTS and published its own contract. Our
#     announcement id is not its `params`, and `seq_id` has to come from the
#     listing.
#
# The chain is therefore: LISTING -> a row carrying seq_id -> the data route
# with format=xbrl. This probes that chain and nothing else. It still refuses
# a PDF/LLM fallback — Sprint 3 owns extraction.

LISTING = 'https://www.nseindia.com/api/corporates-financial-results'

# Query shapes to try, most-likely first. NSE's own results page drives this
# route by PERIOD plus a date window, not by symbol — which is exactly why the
# symbol filter came back empty. Date format is unknown, so both orders are
# tried rather than assumed.
def listing_variants(d_from, d_to):
    dmy_f, dmy_t = d_from.strftime('%d-%m-%Y'), d_to.strftime('%d-%m-%Y')
    ymd_f, ymd_t = d_from.isoformat(), d_to.isoformat()
    for period in ('Quarterly', 'Half-Yearly', 'Annual'):
        yield f'{LISTING}?index=equities&period={period}&from_date={dmy_f}&to_date={dmy_t}'
        yield f'{LISTING}?index=equities&period={period}&from_date={ymd_f}&to_date={ymd_t}'
    yield f'{LISTING}?index=equities&period=Quarterly'
    yield f'{LISTING}?index=equities'


def rows_of(resp):
    """Rows out of a listing response, or None when it is not a JSON listing."""
    try:
        data = json.loads(resp.text)
    except Exception:                                    # noqa: BLE001
        return None
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ('data', 'resultsData', 'rows'):
            if isinstance(data.get(k), list):
                return data[k]
    return None


def chain(sess, days: int) -> int:
    """Listing -> seq_id -> the data route. Prints, never classifies."""
    d_to = dt.date.today()
    d_from = d_to - dt.timedelta(days=days)
    print(f'LISTING window {d_from} .. {d_to}\n')

    hit = None
    for url in listing_variants(d_from, d_to):
        try:
            resp = sess.get(url, referer=RESULTS_REFERER)
        except Exception as exc:                         # noqa: BLE001
            print(f'  ERR  {type(exc).__name__:<16} {url[:110]}')
            continue
        rows = rows_of(resp)
        n = 'not json' if rows is None else len(rows)
        print(f'  {resp.status_code}  rows={str(n):<8} {url[:110]}')
        if rows and hit is None:
            hit = (url, rows)

    if not hit:
        print('\n  FINDING: no listing shape returned rows. The data route\n'
              '  cannot be reached without a seq_id, so the surprise leg stops\n'
              '  here. Report it — do not fall back to the PDF.')
        return 2

    url, rows = hit
    row = rows[0]
    print(f'\n  WORKING LISTING: {url}')
    print(f'  {len(rows)} rows. keys = {sorted(row.keys())}')
    print(f'  row[0] = {json.dumps(row)[:900]}')

    # The data route named its five required params. Fill each from the row by
    # exact key first, then a case-insensitive match — and print what could NOT
    # be filled, because a missing one is the finding, not a detail.
    need = ('params', 'seq_id', 'industry', 'ind', 'format')
    low = {k.lower(): v for k, v in row.items()}
    filled, missing = {}, []
    for p in need:
        if p == 'format':
            filled[p] = 'xbrl'
            continue
        v = row.get(p, low.get(p.replace('_', '')))
        if v in (None, ''):
            missing.append(p)
        else:
            filled[p] = v
    print(f'\n  data-route params filled from the row: {filled}')
    if missing:
        print(f'  ⚠ NOT in the listing row: {missing} — the row does not carry '
              'everything the data route demands')

    q = '&'.join(f'{k}={quote(str(v))}' for k, v in filled.items())
    durl = f'{LISTING}-data?index=equities&{q}'
    print(f'\n--- data route: {durl[:160]}')
    try:
        dresp = sess.get(durl, referer=RESULTS_REFERER)
    except Exception as exc:                             # noqa: BLE001
        print(f'    ERR {type(exc).__name__}: {exc}')
        return 2
    body = dresp.text or ''
    tags = [w for w in WANTED if w in body]
    print(f'    status {dresp.status_code}  {dresp.headers.get("content-type","?")}  '
          f'{len(body)} bytes  XBRL tags {len(tags)}/{len(WANTED)}')
    print('    ' + body[:900].replace('\n', ' ')[:900])
    if tags:
        print(f'\n  TAGS FOUND: {tags}\n'
              '  The surprise leg is reachable. The remaining question is ARCHIVE\n'
              '  DEPTH — a SUE needs ~8 quarters of the company OWN past EPS.\n'
              '  Run --depth next.')
        return 0
    print('\n  No XBRL tags in the data response. Print-only by design: read the\n'
          '  body above before deciding what the format param should be.')
    return 2


def depth(sess) -> int:
    """How many quarters back the listing still answers. That count IS the gate."""
    today = dt.date.today()
    print('Archive depth — a SUE needs ~8 quarters of the company own past EPS.\n')
    reachable = 0
    for q in range(0, 13):
        d_to = today - dt.timedelta(days=90 * q)
        d_from = d_to - dt.timedelta(days=90)
        url = (f'{LISTING}?index=equities&period=Quarterly'
               f'&from_date={d_from.strftime("%d-%m-%Y")}&to_date={d_to.strftime("%d-%m-%Y")}')
        try:
            rows = rows_of(sess.get(url, referer=RESULTS_REFERER))
        except Exception as exc:                         # noqa: BLE001
            print(f'  Q-{q:<2} {d_from} .. {d_to}  ERR {type(exc).__name__}')
            continue
        n = 0 if not rows else len(rows)
        if n:
            reachable += 1
        print(f'  Q-{q:<2} {d_from} .. {d_to}  rows={n}')
    print(f'\n  quarters answering with rows: {reachable}/13')
    print('  >= 8 -> a seasonal-random-walk SUE is buildable from NSE alone.\n'
          '  <  8 -> it is not, and that is the finding.')
    return 0 if reachable >= 8 else 2


def main() -> int:
    ap = argparse.ArgumentParser(description='Probe NSE XBRL availability (read only)')
    ap.add_argument('--limit', type=int, default=20)
    ap.add_argument('--dump', action='store_true',
                    help='print the raw body of the two API routes for the newest '
                         'sample, with and without a referer, instead of scanning tags')
    ap.add_argument('--chain', action='store_true',
                    help='listing -> seq_id -> data route with format=xbrl')
    ap.add_argument('--depth', action='store_true',
                    help='how many quarters back the listing still answers')
    ap.add_argument('--days', type=int, default=14,
                    help='listing window for --chain (default 14)')
    args = ap.parse_args()

    # --chain and --depth never touch the database: they probe NSE alone, so a
    # DB outage must not block the one question that gates the surprise leg.
    if args.chain or args.depth:
        sess = NseSession()
        return chain(sess, args.days) if args.chain else depth(sess)

    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(readonly=True, autocommit=True)
    rows = sample(conn, args.limit)
    conn.close()
    if not rows:
        print('No result announcements with has_xbrl found. Nothing to probe.')
        return 1

    sess = NseSession()
    if args.dump:
        seq, sym, name, _diss, _doc, day0 = rows[0]
        print(f'Dumping API responses for {sym} ({name}), Day 0 {day0}.')
        dump(sess, seq, sym)
        return 0

    print(f'Probing {len(rows)} result announcements.\n')
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
