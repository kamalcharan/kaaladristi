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

Data source
-----------
Yahoo Finance only. NSE's /api/quote-equity blocks the server-side client
at the TLS-fingerprint layer (Referer/cookie tricks don't defeat it, only
Playwright would), and every 403 costs 15-20s of retry backoff. Yahoo has
no equivalent block, covers the full NSE + BSE listed universe including
small/mid caps outside index membership, and needs no auth or warmup.

  Yahoo yfinance.Ticker(<ticker>).info
        Ticker = vendor_codes.yahoo if populated, else SYMBOL.NS / SYMBOL.BO
        by exchange convention.

Missing fields (`is_fno`, real `listing_date`) are set to safe defaults;
enrich them separately if needed. Yahoo misses are typically ETFs, brand-
new listings, and some SMEs — they stay as `industry IS NULL` and the
next run picks them up automatically once Yahoo has them.

Writes go through db.patch — id-scoped, atomic, single-row.
"""

import argparse
import os
import sys
import time
from datetime import date
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.db_client import get_db


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


# One-time diagnostic flag so the yfinance import error is loud (printed
# once) instead of the silent per-call exception swallow that made the
# missing-module case look like a bunch of Yahoo misses.
_yf_probed = False
_yf_module = None


def _get_yfinance():
    """Import yfinance lazily and cache the module. Print the import error
    exactly once so a missing dependency shows up in the log immediately."""
    global _yf_probed, _yf_module
    if _yf_probed:
        return _yf_module
    _yf_probed = True
    try:
        import yfinance as yf
        _yf_module = yf
    except ImportError as e:
        print(f'  [yahoo] yfinance not installed — pip install yfinance ({e})')
    except Exception as e:
        print(f'  [yahoo] yfinance import failed: {e}')
    return _yf_module


def _fetch_from_yahoo(yahoo_ticker: str) -> Optional[dict]:
    """yfinance lookup — works for both NSE (SYMBOL.NS) and BSE (SYMBOL.BO
    or scripcode.BO) tickers. Returns 'sector' AND 'industry' — we take
    'industry' to match the NSE vocabulary the rest of the platform uses."""
    if not yahoo_ticker:
        return None
    yf = _get_yfinance()
    if yf is None:
        return None
    try:
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


def _yahoo_ticker_for(equity: dict) -> Optional[str]:
    """Derive a Yahoo ticker for an equity row. Uses vendor_codes.yahoo if
    populated (BSE stocks usually have it); otherwise falls back to the
    obvious SYMBOL.NS / SYMBOL.BO convention. Yahoo accepts both forms."""
    vc = equity.get('vendor_codes') or {}
    y = vc.get('yahoo')
    if y:
        return y
    sym = (equity.get('symbol') or '').strip()
    if not sym:
        return None
    ex = equity.get('exchange', '')
    if ex == 'NSE':
        return f'{sym}.NS'
    if ex == 'BSE':
        return f'{sym}.BO'
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

    # Yahoo-only enrichment. NSE quote-equity is 403'd at the fingerprint
    # layer from a headless client, so falling back to it just adds 15-20s
    # of pointless retry backoff per miss. Any real Yahoo miss (Yahoo has
    # no industry for many ETFs, brand-new listings, and some SMEs) is
    # marked failed and can be resolved later with a manual step —
    # dropping NSE from the daily loop keeps runtime linear.
    for i, eq in enumerate(targets, start=1):
        exchange = eq.get('exchange', '')

        yahoo_ticker = _yahoo_ticker_for(eq)
        meta = _fetch_from_yahoo(yahoo_ticker) if yahoo_ticker else None
        time.sleep(API_SLEEP_SECONDS)

        if not meta:
            summary['failed'] += 1
            if verbose and summary['failed'] <= 20:
                print(f'    [miss]  {exchange} {eq["symbol"]:20} (isin={eq.get("isin")}, yahoo={yahoo_ticker})')
            continue

        summary['yahoo_hits'] += 1
        if verbose and summary['yahoo_hits'] <= 10:
            # Log the first few hits so the user sees Yahoo working before
            # the every-100 progress line kicks in on longer runs.
            print(f'    [ok]    {exchange} {eq["symbol"]:20} -> {meta["industry"][:40]}')

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
