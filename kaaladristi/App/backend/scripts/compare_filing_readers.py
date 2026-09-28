"""
Does the local (Qwen) reader agree with the verdicts Haiku already gave?
=========================================================================
    python3 scripts/compare_filing_readers.py                      # every done row with stored text
    python3 scripts/compare_filing_readers.py --limit 40 --event-type MGMT_EXIT
    python3 scripts/compare_filing_readers.py --out /tmp/compare.json

READ-ONLY. Writes nothing to the database. Re-reads the rows km_filing_reads
already holds a paid verdict for — from the text stored on km_filings_raw,
so no document is downloaded — through the local backend, and prints how
often the two agree on impact and on magnitude, per event type, with every
disagreement listed so it can be judged by eye.

This is the measurement the owner asked for before the reader moves off
Haiku (2026-09-28: "cant qwen manage it?"). The 145 verdicts cost $0.75 and
are the only ground truth we have; agreement with Haiku is not the same as
being right, but a backend that disagrees on the sign of an order win is not
one to trust unmeasured.

⚠ Runs on the VPS (the local server is on vikuna-net). Needs
FILING_READ_LOCAL_URL or LLM_BASE_URL. Honours FILING_READ_LOCAL_CTX — a
document longer than the server's context is trimmed to whole pages, and the
report says how many were.
"""

import argparse
import json
import os
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib.config import DATABASE_URL                      # noqa: E402
from lib import filing_reader as fr                      # noqa: E402


def main():
    ap = argparse.ArgumentParser(description='Local reader vs the stored Haiku verdicts (read-only)')
    ap.add_argument('--limit', type=int, default=10000)
    ap.add_argument('--event-type', default=None)
    ap.add_argument('--out', default=None, help='write every pair as JSON here')
    ap.add_argument('--url', default=fr.LOCAL_URL, help='OpenAI-compatible base url (…/v1)')
    ap.add_argument('--model', default=fr.LOCAL_MODEL)
    ap.add_argument('--ctx', type=int, default=fr.LOCAL_CTX_TOKENS)
    args = ap.parse_args()
    if not args.url:
        print('FILING_READ_LOCAL_URL / LLM_BASE_URL not set'); return 2

    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.event_id, r.impact, r.magnitude, r.headline, r.pages_read, r.page_count, r.input_tokens
              FROM km_filing_reads r
              JOIN km_corporate_events e ON e.id = r.event_id
              JOIN km_filings_raw f ON f.id = e.primary_raw_id
             WHERE r.status = 'done' AND r.read_source IN ('text', 'ocr')
               AND f.raw_text IS NOT NULL AND length(f.raw_text) > 0
               AND (%s::text IS NULL OR e.event_type = %s)
             ORDER BY e.disseminated_at DESC
             LIMIT %s
        """, (args.event_type, args.event_type, args.limit))
        targets = cur.fetchall()
    conn.rollback()
    print(f'{len(targets)} paid verdicts to compare · {args.url} · {args.model} · ctx {args.ctx}')

    client = fr.LocalClient(args.url, args.model, ctx_tokens=args.ctx)
    budget = fr.local_doc_char_budget(args.ctx)
    pairs, agree_i, agree_m, trimmed, failed, done = [], 0, 0, 0, 0, 0
    by_type = defaultdict(lambda: Counter())
    t0 = time.time()
    for n, (event_id, h_impact, h_mag, h_head, pages_read, page_count, h_in) in enumerate(targets, 1):
        row = fr.load_event_row(conn, event_id)
        sym = row.get('symbol') or (row.get('company_name') or '?')[:12]   # no NSE row for a delisted name
        et = row.get('event_type') or '?'
        text = row['raw_text'] or ''
        # The stored text is one string; page breaks were joined with a blank
        # line, which is how extract_text/_from_pages wrote it.
        pages = [p for p in text.split('\n\n')] if len(text) > budget else [text]
        doc = fr._from_pages(pages, row.get('raw_page_count') or pages_read or 1, 'text')
        doc = fr.fit_to_chars(doc, budget)
        if len(doc.text) < len(text):
            trimmed += 1
        t1 = time.time()
        try:
            resp = client.messages.parse(system=fr.SYSTEM_PROMPT, messages=fr.build_messages(row, doc, None),
                                         output_format=fr.FilingVerdict)
            v = resp.parsed_output
        except Exception as e:
            failed += 1
            print(f'  {n:>4} {sym:<12} {et:<18} FAILED {str(e)[:160]}')
            if failed >= 5 and done == 0:
                print('\nfive failures before a single success — the server is not reachable; stopping')
                break
            continue
        q_impact = v.impact if v.impact in fr.IMPACTS else 'unclear'
        q_mag = v.magnitude if v.magnitude in fr.MAGNITUDES else 'unknown'
        same_i, same_m = q_impact == h_impact, q_mag == h_mag
        agree_i += same_i; agree_m += same_m
        c = by_type[et]
        c['n'] += 1; c['impact'] += same_i; c['magnitude'] += same_m
        pairs.append({'event_id': event_id, 'symbol': sym, 'event_type': et,
                      'haiku': {'impact': h_impact, 'magnitude': h_mag, 'headline': h_head},
                      'local': {'impact': q_impact, 'magnitude': q_mag, 'headline': v.headline,
                                'evidence_quote': v.evidence_quote, 'confidence': v.confidence},
                      'seconds': round(time.time() - t1, 1),
                      'tokens_in': resp.usage.input_tokens, 'tokens_out': resp.usage.output_tokens,
                      'trimmed': len(doc.text) < len(text)})
        done += 1
        mark = '' if same_i else '  <-- IMPACT DIFFERS'
        print(f'  {n:>4} {sym:<12} {et:<18} haiku {h_impact:<8}/{h_mag:<8} '
              f'local {q_impact:<8}/{q_mag:<8} {time.time() - t1:5.1f}s{mark}', flush=True)

    print(f'\n{done} compared · {failed} failed · {trimmed} trimmed to the context · '
          f'{(time.time() - t0) / max(done, 1):.1f}s per document')
    if done:
        print(f'impact agreement    {agree_i}/{done} = {100 * agree_i / done:.0f}%')
        print(f'magnitude agreement {agree_m}/{done} = {100 * agree_m / done:.0f}%')
        print('\nby event type      n  impact  magnitude')
        for et, c in sorted(by_type.items(), key=lambda kv: -kv[1]['n']):
            print(f'  {et:<18} {c["n"]:>3}  {100 * c["impact"] / c["n"]:>5.0f}%  {100 * c["magnitude"] / c["n"]:>6.0f}%')
        diffs = [p for p in pairs if p['haiku']['impact'] != p['local']['impact']]
        if diffs:
            print(f'\n{len(diffs)} impact disagreements:')
            for p in diffs:
                print(f'  {p["symbol"]:<12} {p["event_type"]:<18} haiku: {p["haiku"]["headline"]}')
                print(f'  {"":<12} {"":<18} local: {p["local"]["headline"]}')
    if args.out:
        with open(args.out, 'w') as fh:
            json.dump({'url': args.url, 'model': args.model, 'ctx': args.ctx, 'pairs': pairs,
                       'agreement': {'impact': agree_i, 'magnitude': agree_m, 'n': done}}, fh, indent=1)
        print(f'written {args.out}')
    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
