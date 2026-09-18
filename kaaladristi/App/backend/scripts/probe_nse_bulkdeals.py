"""
NSE bulk / block deals probe — the last unresolved Sprint 2 item
================================================================
READ-ONLY. No DB writes. Run on the VPS:
    python3 scripts/probe_nse_bulkdeals.py
    python3 scripts/probe_nse_bulkdeals.py --out /tmp/nse_bulk.json

WHY IT MATTERS. A documented institutional buy on a Waking Giants name, or on a
stock that just entered Stage 2, is the strongest confirmation in the framework
— and we already hold both sides of that join. Bulk deals are the only feed that
supplies the buyer's NAME, which nothing else in the plan does.

WHY IT IS STILL OPEN. Four JSON endpoints were tried in an earlier session and
every one returned 503 or an empty body. That is one hypothesis (NSE gates these
harder than announcements) but it was never separated from the others: a wrong
referer, a wrong parameter name, or a path that simply moved. This probe tests
each of those rather than re-running the same four calls and concluding the same
thing.

⚠ MUST RUN ON THE VPS — the cloud container gets 403 to CONNECT for nseindia.

⚠ DAY 0 IS NOT THE DEAL DATE. NSE publishes bulk deals AFTER the close, so a
deal done on the 19th is public that evening and actionable on the 20th. The
same rule announcements already go through — `kd_day_zero_trade_date` with a
post-15:30 timestamp — applies here, and reusing it keeps ONE implementation of
the after-the-close rule. Dating a deal to its own session would credit the
market with knowing something it could not yet see: the lookahead bias this
plan keeps guarding against, arriving through a third door.

⚠ `BD_DT_ORDER` IS A SORT KEY, NOT A TIME. It reads `2026-08-18T18:30:00.000Z`
for a deal dated 19-AUG-2026 — that is IST midnight of the deal date expressed
in UTC, not the moment of the trade. Treating it as a timestamp would move
every deal a day earlier.

THE DECISION IT MAKES:
  * A JSON endpoint answers with a date window  -> ingestion looks like
    ingest_nse_filings.py: a windowed fetch, a natural key, backfillable.
  * Only the CSV archives answer               -> ingestion is per-DAY files,
    so a backfill is one request per trading day (~250/yr) and the natural key
    has to come from the row, not from a seq_id NSE never gives us.
  * Nothing answers                            -> record it as blocked WITH the
    status codes, so the next person does not spend the session re-discovering
    that. Do not leave it as "the API is flaky".

Nothing here is built on yet. Probe first — the same order that turned the
board-meetings question from "fetch 26,000 PDFs" into a metadata join.
"""

import argparse
import csv
import io
import json
import os
import sys
import time
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from pipeline.utils.nse_session import NseSession   # noqa: E402

# The page a browser is on when it asks for these. Announcements needed its own
# referer to answer at all, so a wrong one here is a live hypothesis rather than
# a detail.
REF_REPORT = 'https://www.nseindia.com/report-detail/display-bulk-and-block-deals'
REF_LARGE = 'https://www.nseindia.com/market-data/large-deals-watch'
REF_HIST = 'https://www.nseindia.com/report-detail/display-bulk-and-block-deals'
DELAY = 3.0


def _try(s, label, url, referer, want='json'):
    """Reports the STATUS, not just success. '503 on every attempt' and
    'answers but empty' are different findings and the earlier session could
    not tell them apart."""
    try:
        r = s.get(url, referer=referer)
        code = getattr(r, 'status_code', '?')
        body = r.text or ''
        if want == 'json':
            try:
                d = r.json()
            except ValueError:
                print(f'  {code}  {label:<46} NON-JSON, {len(body)} bytes '
                      f'({(r.headers or {}).get("content-type")})')
                return None
            rows = d if isinstance(d, list) else d.get('data', d.get('BULK', []))
            print(f'  {code}  {label:<46} rows={len(rows)}')
            return rows
        # CSV
        if not body.strip():
            print(f'  {code}  {label:<46} EMPTY body')
            return None
        rows = list(csv.DictReader(io.StringIO(body)))
        print(f'  {code}  {label:<46} csv rows={len(rows)}')
        return rows
    except Exception as e:
        print(f'  ---  {label:<46} {type(e).__name__}: {str(e)[:60]}')
        return None
    finally:
        time.sleep(DELAY)


def _describe(rows, label):
    keys = Counter()
    for r in rows:
        keys.update(r.keys())
    print(f'\n=== FIELDS ({label}) ===')
    for k, c in keys.most_common():
        print(f'  {k:<34} {c}/{len(rows)}')
    print('\n  FIRST ROW VERBATIM:')
    print('  ' + json.dumps(rows[0], indent=2, default=str)[:900]
          .replace('\n', '\n  '))

    # The two questions an ingest design turns on.
    kl = {k.lower().strip(): k for k in keys}
    id_like = [kl[k] for k in kl if any(t in k for t in
               ('isin', 'symbol', 'scrip', 'security'))]
    print(f'\n  identity fields: {id_like or "NONE — joins by name only"}')
    if not any('isin' in k for k in kl):
        print('  ⚠ NO ISIN. Every other table in this plan keys on ISIN '
              '(a filing is about the COMPANY, not the listing), so these rows '
              'would need symbol -> km_equity_symbols resolution, with the '
              'same counted-unresolvable tail the filings ingest reports.')
    dedup = [kl[k] for k in kl if any(t in k for t in
             ('date', 'client', 'buy', 'sell', 'quantity', 'qty', 'price'))]
    print(f'  natural-key candidates: {dedup}')
    print('  ⚠ There is no seq_id here. Unlike announcements, the key has to be '
          'composed from the row itself — and two clients can trade the same '
          'stock at the same price on the same day, so a naive key silently '
          'collapses real deals.')


def _key_analysis(rows):
    """WHICH COMPOSED KEY IS ACTUALLY UNIQUE — measured, not assumed.

    There is no seq_id, so the natural key has to come from the row. Get it too
    narrow and real deals collapse into one another silently; get it too wide
    (qty and price inside the key) and NSE correcting a quantity inserts a
    SECOND row instead of revising the first, which is the same corruption
    wearing the opposite costume.

    BD_TP_WATP is a weighted AVERAGE trade price, which says NSE already
    aggregates per client per side per day — so the narrow key is probably
    right. `Probably` is why this counts instead of guessing.
    """
    print('\n=== NATURAL KEY: collisions in this window ===')
    base = ('BD_DT_DATE', 'BD_SYMBOL', 'BD_CLIENT_NAME', 'BD_BUY_SELL')
    cands = {
        'date+symbol+client+side': base,
        '  + qty': base + ('BD_QTY_TRD',),
        '  + qty + price': base + ('BD_QTY_TRD', 'BD_TP_WATP'),
    }
    for name, keys in cands.items():
        if not all(k in rows[0] for k in keys):
            print(f'  {name:<26} field missing, skipped')
            continue
        c = Counter(tuple(str(r.get(k)) for k in keys) for r in rows)
        dup = {k: v for k, v in c.items() if v > 1}
        print(f'  {name:<26} {len(c)} distinct of {len(rows)} rows  '
              f'-> {len(dup)} colliding')
        for k, v in list(dup.items())[:3]:
            print(f'      x{v}  {" | ".join(k)}')
    print("""
  ^ ZERO collisions on the narrow key means it IS the natural key, and qty /
    price belong in the row as UPDATABLE columns behind a content hash -- the
    same shape km_board_meetings uses, where a genuine correction is a revision
    rather than a duplicate. Collisions mean the opposite and the key must
    widen, accepting that corrections then arrive as new rows.""")


def _depth(s, rows_label):
    """How far back does it serve? This decides whether a backfill is one call
    or a loop, and whether history exists at all."""
    print('\n=== DEPTH (the same endpoint, wider windows) ===')
    end = date.today()
    for years in (1, 3, 5):
        start = end - timedelta(days=365 * years)
        f, t = start.strftime('%d-%m-%Y'), end.strftime('%d-%m-%Y')
        got = _try(s, f'{years}y window',
                   'https://www.nseindia.com/api/historicalOR/'
                   f'bulk-block-short-deals?optionType=bulk_deals&from={f}&to={t}',
                   REF_REPORT)
        if got:
            ds = [r.get('BD_DT_DATE') for r in got if r.get('BD_DT_DATE')]
            print(f'        earliest {min(ds, default="?")}  '
                  f'latest {max(ds, default="?")}')
    print("""
  ^ A row count that stops growing with the window, or an earliest date that
    does not move, means the endpoint is CAPPED -- and a cap that is silent is
    the shape that makes a backfill look complete when it is not. Compare the
    counts, not just the fact that each call answered.""")


def _cap_check(s):
    """IS 70 A CAP OR A COINCIDENCE? Everything downstream turns on it.

    Measured 2026-09-18: a 30-day window returned exactly 70, a 1-YEAR window
    returned exactly 70 (all dated on the first day of the range), and
    block_deals returned exactly 70 as well. Meanwhile bulk.csv alone holds 212
    rows. Three unrelated queries landing on one round number is a page limit.

    If it is a cap, a windowed fetch is WORSE THAN USELESS here: it answers 200
    with a plausible-looking payload that is silently short, which is the exact
    shape that makes a backfill look finished when it is not. The ingest then
    has to be one call per TRADING DAY (~250/yr), and each day's count has to be
    checked against the cap so a day that legitimately exceeds it is loud rather
    than quietly truncated.
    """
    print('\n=== IS 70 A CAP? (single-day fetches) ===')
    counts = []
    for back in (1, 2, 3, 6, 7, 8):
        d = date.today() - timedelta(days=back)
        ds = d.strftime('%d-%m-%Y')
        got = _try(s, f'{d} (single day)',
                   'https://www.nseindia.com/api/historicalOR/'
                   f'bulk-block-short-deals?optionType=bulk_deals'
                   f'&from={ds}&to={ds}', REF_REPORT)
        if got is not None:
            dates = {r.get('BD_DT_DATE') for r in got}
            counts.append(len(got))
            print(f'        {len(got)} rows over {len(dates)} distinct date(s)'
                  f'{"   <-- AT THE CAP" if len(got) == 70 else ""}')
    if counts:
        print(f'\n  single-day counts: {counts}')
        if all(c == 70 for c in counts):
            print('  ⚠ EVERY day returns exactly 70 — the cap bites even on one '
                  'day, so this endpoint cannot deliver a complete day at all '
                  'and the CSV archives are the only viable source.')
        elif 70 in counts:
            print('  ⚠ Some days hit exactly 70 — a cap that bites on busy days '
                  'only. Per-day fetching works, but any day returning 70 must '
                  'be treated as INCOMPLETE and reported, never stored as if it '
                  'were the whole day.')
        else:
            print('  ✓ No day reaches 70, so per-day fetching returns complete '
                  'days. The 70 seen over wider windows was the cap; the cap '
                  'is the reason to fetch per day.')


def _csv_coverage(rows, label):
    """What span does the archive actually hold? 'Recent' is not a date range,
    and the difference between one day and one financial year decides whether
    the CSV is the backfill or only the daily top-up."""
    key = next((k for k in rows[0] if 'date' in k.lower()), None)
    print(f'\n=== CSV COVERAGE ({label}) ===')
    print(f'  columns: {list(rows[0].keys())}')
    if not key:
        print('  no date-like column — cannot state a span')
        return
    ds = sorted({(r.get(key) or '').strip() for r in rows} - {''})
    print(f'  {len(rows)} rows over {len(ds)} distinct dates in `{key}`')
    print(f'  earliest {ds[0]}   latest {ds[-1]}')
    if len(ds) == 1:
        print('  -> ONE DAY. This is a daily top-up file, not a backfill: '
              'history has to come from somewhere else.')
    else:
        print('  -> a real span. If it reaches back far enough this IS the '
              'backfill, and the JSON endpoint is only for the current day.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=None)
    ap.add_argument('--days', type=int, default=30)
    args = ap.parse_args()
    print('NSE BULK / BLOCK DEALS PROBE — read-only, no DB writes')

    s = NseSession()
    end = date.today()
    start = end - timedelta(days=args.days)
    f, t = start.strftime('%d-%m-%Y'), end.strftime('%d-%m-%Y')
    report = {'window': [str(start), str(end)], 'attempts': {}}

    print(f'\n=== JSON ENDPOINTS ({start} .. {end}) ===')
    json_cands = [
        ('historical/bulk-deals',
         f'https://www.nseindia.com/api/historical/bulk-deals?from={f}&to={t}',
         REF_HIST),
        ('historicalOR bulk_deals',
         'https://www.nseindia.com/api/historicalOR/bulk-block-short-deals'
         f'?optionType=bulk_deals&from={f}&to={t}', REF_REPORT),
        ('historicalOR block_deals',
         'https://www.nseindia.com/api/historicalOR/bulk-block-short-deals'
         f'?optionType=block_deals&from={f}&to={t}', REF_REPORT),
        ('historical/block-deals',
         f'https://www.nseindia.com/api/historical/block-deals?from={f}&to={t}',
         REF_HIST),
        ('snapshot large deals (today only)',
         'https://www.nseindia.com/api/snapshot-capital-market-largedeal',
         REF_LARGE),
    ]
    rows, chosen = None, None
    for label, url, ref in json_cands:
        got = _try(s, label, url, ref)
        report['attempts'][label] = len(got) if got is not None else None
        if got and rows is None:
            rows, chosen = got, label

    # The static archives. A different server and a different auth path, so a
    # 503 on the API says nothing about these.
    print('\n=== CSV ARCHIVES ===')
    csv_cands = [
        ('content/equities/bulk.csv',
         'https://nsearchives.nseindia.com/content/equities/bulk.csv', REF_REPORT),
        ('content/equities/block.csv',
         'https://nsearchives.nseindia.com/content/equities/block.csv', REF_REPORT),
    ]
    csv_rows = {}
    for label, url, ref in csv_cands:
        got = _try(s, label, url, ref, want='csv')
        report['attempts'][label] = len(got) if got is not None else None
        csv_rows[label] = got
        if got and rows is None:
            rows, chosen = got, label

    if not rows:
        print("""
  NOTHING ANSWERED. Record the status codes above — they are the finding.
  A 403/401 everywhere means the session/referer is wrong and is worth one more
  session; a 503 everywhere means NSE is gating these and the answer is a
  different source (the exchange's own daily reports, or a vendor), not a
  retry loop. Either way this is BLOCKED with a reason, not "flaky".""")
        report['found'] = False
    else:
        _describe(rows, chosen)
        report.update({'found': True, 'endpoint': chosen, 'sample': rows[0]})
        print("""
  ^ If this carries a usable date window, bulk deals ingest like announcements:
    windowed fetch, UNIQUE natural key, ON CONFLICT DO NOTHING, backfillable.
    If it is a single-day CSV, a backfill is ~250 requests a year and the
    natural key must be composed from the row.""")

    if rows and chosen and 'historicalOR' in chosen:
        _key_analysis(rows)
        _depth(s, chosen)
        _cap_check(s)
    for label, got in csv_rows.items():
        if got:
            _csv_coverage(got, label)

    if args.out:
        with open(args.out, 'w') as fh:
            json.dump(report, fh, indent=2, default=str)
        print(f'\nreport -> {args.out}')


if __name__ == '__main__':
    main()
