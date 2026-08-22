"""
Enrich Equity Metadata — permanent fix for the untagged-symbol gap.
====================================================================

Problem this closes
-------------------
`pipeline/processors/symbol_registrar.py` admits new bhavcopy symbols into
`km_equity_symbols` with only `{symbol, exchange, isin, is_active}` — because
the NSE bhavcopy carries no industry column. Nothing was running afterward to
enrich the industry/company_name/is_fno/is_etf/listing_date, so every new
listing landed untagged. The gap accumulated silently:

  * 2,342 untagged NSE (2,044 traded in last 30d), audited 2026-08-22
  * 347 live untagged BSE (of 1,722 total; the rest dormant)

Downstream consequence: `v_equity_eod_deduped` filters `industry IS NOT NULL`,
so every industry-aware feature (Industry Rotation, scanner industry filters,
smart-money industry gate) was blind to ~2,400 real live stocks.

Design — one enrichment path for both backfill and ongoing
----------------------------------------------------------
`enrich_untagged_equities(db, ...)` finds every active equity that has traded
recently but has no industry, and enriches it. It is idempotent (safe to
re-run), rate-limited (~0.3s per API call), and resumable per-stock (each
write commits before the next fetch, so a mid-run kill loses at most one
in-flight fetch).

Two callers use the same function:
  1. `run()` — CLI backfill (one-shot, no cap, prints progress).
  2. `enrich_for_pipeline(conn, trade_date, force)` — pipeline2 handler
     shim. Caps per-run work so a big backfill can't stall a nightly job.

Data source strategy
--------------------
Both exchanges enrich from the NSE quote-equity endpoint first because it's
richer (returns industry, isFNOSec, isETFSec, listingDate, companyName). A
BSE-only stock that lacks an NSE vendor code falls back to Yahoo Finance.
Neither endpoint is billed; both are ratelimited.

  NSE  https://www.nseindia.com/api/quote-equity?symbol={sym}
       Works for any NSE-listed symbol, and for BSE stocks whose
       vendor_codes.nse is populated (about 3/4 of BSE via ISIN dedup).
  Yahoo yfinance.Ticker(<yahoo_ticker>).info
       Fallback for BSE-only stocks. Slower and noisier but covers the
       long tail.

Both writes go through db.patch — id-scoped, atomic, single-row.
"""

import argparse
import os
import sys
import time
from datetime import date
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.db_client import get_db
from pipeline.utils.nse_session import NseSession


NSE_QUOTE_API = 'https://www.nseindia.com/api/quote-equity?symbol={}'

# Per-run cap when invoked from the daily pipeline. A backfill catches up
# in chunks over multiple runs rather than stalling one nightly job for
# 30+ minutes. `run()` (CLI) ignores this and processes everything.
PIPELINE_PER_RUN_CAP = 200

# Only enrich stocks that traded in this recency window. Anything older is a
# dormant / suspended listing that isn't worth an API hit right now — if it
# resumes trading, the next pipeline run picks it up.
RECENT_EOD_WINDOW_DAYS = 30

# Polite pacing. NSE has soft-blocked us on faster loops historically.
API_SLEEP_SECONDS = 0.3


def _fetch_from_nse(session: NseSession, symbol: str) -> Optional[dict]:
    """NSE quote-equity endpoint. Returns None if the symbol is unknown to
    NSE (BSE-only stock without an NSE vendor code) or the field is missing.

    Two-hop pattern: hit the equity's quote HTML page first as a warmup so
    NSE's edge cache/anti-bot sees the browser flow (page → API), then pass
    the same page URL as Referer on the API call. Without this pair every
    quote-equity request returns 403 even with fresh cookies."""
    from urllib.parse import quote
    q = quote(symbol)
    quote_page = f'https://www.nseindia.com/get-quotes/equity?symbol={q}'
    api_url = NSE_QUOTE_API.format(q)
    try:
        # Warmup: discard response, we only care about the cookies + edge state.
        try:
            session.get(quote_page, referer='https://www.nseindia.com/')
        except Exception:
            pass  # non-fatal — the API call still gets tried below
        resp = session.get(api_url, referer=quote_page)
        data = resp.json()
        info = data.get('info', {}) or {}
        if not info.get('industry'):
            return None
        return {
            'company_name': info.get('companyName'),
            'industry': info.get('industry'),
            'is_fno': bool(info.get('isFNOSec', False)),
            'is_etf': bool(info.get('isETFSec', False)),
            'listing_date': info.get('listingDate') or None,
        }
    except Exception:
        return None


def _fetch_from_yahoo(yahoo_ticker: str) -> Optional[dict]:
    """yfinance fallback for BSE-only stocks. yfinance returns 'sector' AND
    'industry' — we take 'industry' to match the NSE vocabulary the rest of
    the platform uses."""
    if not yahoo_ticker:
        return None
    try:
        import yfinance as yf
        info = yf.Ticker(yahoo_ticker).info or {}
        if not info.get('industry'):
            return None
        return {
            'company_name': info.get('longName') or info.get('shortName'),
            'industry': info.get('industry'),
            'is_fno': False,     # Yahoo doesn't expose F&O status
            'is_etf': info.get('quoteType', '') == 'ETF',
            'listing_date': None,
        }
    except Exception:
        return None


def _find_targets(db, cap: Optional[int] = None) -> list[dict]:
    """Return active equities that are traded but untagged.

    One raw SQL query — the client's `filters={'industry': None}` shortcut
    would compile to `industry = NULL` (never true in SQL); we need
    `industry IS NULL`. `EXISTS` on km_equity_eod restricts to symbols
    that actually traded in the recency window so we don't spend API
    calls on dormant/delisted listings.

    Ordered id DESC so recently-registered symbols get enriched before
    older tails when the run is capped.
    """
    sql = """
      SELECT s.id, s.symbol, s.exchange, s.vendor_codes, s.isin
      FROM km_equity_symbols s
      WHERE s.is_active = TRUE
        AND s.industry IS NULL
        AND EXISTS (
          SELECT 1 FROM km_equity_eod e
          WHERE e.equity_id = s.id
            AND e.trade_date >= CURRENT_DATE - INTERVAL '%s days'
        )
      ORDER BY s.id DESC
    """ % RECENT_EOD_WINDOW_DAYS  # int constant, safe to inline; keeps params.py-agnostic
    if cap is not None:
        sql += f' LIMIT {int(cap)}'
    return db.execute(sql)


def enrich_untagged_equities(
    db,
    cap: Optional[int] = None,
    dry_run: bool = False,
    verbose: bool = True,
) -> dict:
    """Enrich every untagged, recently-traded active equity.

    Returns a summary dict:
      {'targets': int, 'nse_hits': int, 'yahoo_hits': int, 'failed': int}

    Idempotent — a stock already carrying an industry is not re-fetched.
    """
    targets = _find_targets(db, cap=cap)
    summary = {
        'targets': len(targets),
        'nse_hits': 0,
        'yahoo_hits': 0,
        'failed': 0,
    }

    if verbose:
        print(f'  [enrich] {len(targets)} untagged active equities with recent EOD')

    if not targets or dry_run:
        if dry_run:
            for eq in targets[:10]:
                vc = eq.get('vendor_codes') or {}
                print(f'    [dry] {eq["exchange"]} {eq["symbol"]}  isin={eq.get("isin")}  '
                      f'nse={vc.get("nse")}  yahoo={vc.get("yahoo")}')
            if len(targets) > 10:
                print(f'    ... and {len(targets) - 10} more')
        return summary

    session = NseSession()
    for i, eq in enumerate(targets, start=1):
        vc = eq.get('vendor_codes') or {}
        exchange = eq.get('exchange', '')

        # NSE quote-equity accepts an NSE symbol directly; for BSE stocks it
        # accepts the mapped nse vendor code when we have one.
        nse_sym = eq['symbol'] if exchange == 'NSE' else vc.get('nse')

        meta = None
        if nse_sym:
            meta = _fetch_from_nse(session, nse_sym)
            time.sleep(API_SLEEP_SECONDS)
            if meta:
                summary['nse_hits'] += 1

        if not meta and exchange == 'BSE':
            yahoo_ticker = vc.get('yahoo')
            if yahoo_ticker:
                meta = _fetch_from_yahoo(yahoo_ticker)
                time.sleep(API_SLEEP_SECONDS)
                if meta:
                    summary['yahoo_hits'] += 1

        if not meta:
            summary['failed'] += 1
            if verbose and summary['failed'] <= 20:
                print(f'    [miss] {exchange} {eq["symbol"]}  (isin={eq.get("isin")})')
            continue

        patch = {
            'company_name': meta['company_name'],
            'industry':     meta['industry'],
            'is_fno':       meta['is_fno'],
            'is_etf':       meta['is_etf'],
        }
        if meta.get('listing_date'):
            patch['listing_date'] = meta['listing_date']
        db.patch('km_equity_symbols', {'id': eq['id']}, patch)

        if verbose and i % 100 == 0:
            print(f'    [{i}/{len(targets)}] nse={summary["nse_hits"]}  '
                  f'yahoo={summary["yahoo_hits"]}  failed={summary["failed"]}')

    if verbose:
        print(f'  [enrich] done. nse={summary["nse_hits"]}  '
              f'yahoo={summary["yahoo_hits"]}  failed={summary["failed"]}')
    return summary


# ── pipeline2 entry point ────────────────────────────────────────────────
# Called by handle_symbol_enrichment in pipeline2/handlers.py. Signature
# matches the other _handle_script compute functions: (conn, trade_date,
# force) -> (rows_affected, status).

def enrich_for_pipeline(conn, trade_date: date, force: bool = False) -> tuple[int, str]:
    """Pipeline-callable enrichment. Capped so a large backlog can't stall
    a nightly job — the rest gets picked up on the next run."""
    db = get_db()
    cap = None if force else PIPELINE_PER_RUN_CAP
    summary = enrich_untagged_equities(db, cap=cap, dry_run=False, verbose=False)
    rows = summary['nse_hits'] + summary['yahoo_hits']
    # 'completed' if we made progress or there was nothing to do; 'partial'
    # only if we saw work and hit zero (all API attempts failed).
    if summary['targets'] == 0:
        status = 'completed'
    elif rows > 0:
        status = 'completed'
    else:
        status = 'partial'
    return rows, status


# ── CLI ──────────────────────────────────────────────────────────────────

def run(dry_run: bool = False, cap: Optional[int] = None):
    print('Enrich Equity Metadata')
    print('=' * 50)
    db = get_db()
    summary = enrich_untagged_equities(db, cap=cap, dry_run=dry_run, verbose=True)
    print()
    print(f'  Summary: targets={summary["targets"]}  '
          f'nse={summary["nse_hits"]}  yahoo={summary["yahoo_hits"]}  '
          f'failed={summary["failed"]}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Enrich untagged active equities (NSE + BSE).')
    ap.add_argument('--dry-run', action='store_true', help='Preview targets without DB writes.')
    ap.add_argument('--cap',     type=int, default=None,
                    help='Stop after N enrichments (default: no cap).')
    args = ap.parse_args()
    run(dry_run=args.dry_run, cap=args.cap)
