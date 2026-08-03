"""
Symbol Registrar — admits newly listed equities into km_equity_symbols.

Why this exists
---------------
The NSE master was originally seeded from *index membership*, not from the
listed universe: `seed_equity_metadata.py` sources the NSE **index** APIs
(NIFTY TOTAL MARKET 750 -> NIFTY 500 -> sectorals), and the only INSERT path was
the one-time `DBscripts/seed_index_equity.py`. A listed equity belonging to no
index was therefore never eligible to enter the master, and no ongoing path
added one.

`SymbolMatcher` then drops every bhavcopy row whose symbol is not already in the
master (see symbol_matcher.py), which makes the master the de-facto universe
filter. Net effect before this module existed: ~3,440 NSE rows parsed ->
~1,334 inserted -> ~2,104 dropped, every single day, silently.

Owner decision (CLAUDE.md -> "Settled Decisions"): the universe is *every listed
equity on both exchanges*. This module is the ongoing registration path that
keeps the master in step with the bhavcopy.

Scope guard
-----------
The NSE CM bhavcopy carries far more than equities — debt (`N1`..`N9`),
government securities (`GS`), warrants, rights. Only equity series are admitted;
everything else is reported as `skipped_non_equity` so the drop stays visible
instead of silent.
"""

#: NSE series that represent a tradable listed equity.
#:   EQ — rolling settlement          BE/BZ — trade-to-trade (incl. surveillance)
#:   SM — SME platform                ST    — SME trade-to-trade
#: Everything else in the CM bhavcopy (N1..N9 debt, GS, warrants, rights) is
#: deliberately excluded.
NSE_EQUITY_SERIES = frozenset({'EQ', 'BE', 'BZ', 'SM', 'ST'})


def _load_known_symbols(db, exchange: str) -> set[str]:
    rows = db.select('km_equity_symbols', 'symbol', filters={'exchange': exchange})
    return {r['symbol'].upper() for r in rows}


def register_new_symbols(
    db,
    records: list[dict],
    exchange: str = 'NSE',
    known: set[str] | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Insert any bhavcopy symbol that is not yet in km_equity_symbols.

    Args:
      db:       db_client instance
      records:  parsed bhavcopy records (must carry 'symbol'; NSE must carry 'series')
      exchange: 'NSE' or 'BSE'
      known:    pre-loaded symbol set, to avoid a second round-trip when the
                caller already built one (SymbolMatcher does)
      dry_run:  report what would be registered without writing

    Returns a summary dict:
      {'registered': int, 'skipped_non_equity': int, 'skipped_no_isin': int,
       'symbols': [...], 'series_breakdown': {series: count}}

    BSE note: parse_bse_bhav already gates on FinInstrmTp=STK, Sgmt=CM and the
    valid group list, so anything reaching here is an equity and no series check
    is applied.
    """
    if known is None:
        known = _load_known_symbols(db, exchange)

    is_nse = exchange.upper() == 'NSE'

    candidates: dict[str, dict] = {}
    skipped_non_equity = 0
    skipped_no_isin = 0
    series_breakdown: dict[str, int] = {}

    for rec in records:
        symbol = (rec.get('symbol') or '').strip().upper()
        if not symbol or symbol in known or symbol in candidates:
            continue

        series = (rec.get('series') or '').strip().upper() or None

        if is_nse:
            # Track what we're turning away so the drop is never silent.
            if series not in NSE_EQUITY_SERIES:
                skipped_non_equity += 1
                series_breakdown[series or 'UNKNOWN'] = (
                    series_breakdown.get(series or 'UNKNOWN', 0) + 1
                )
                continue

        isin = (rec.get('isin') or '').strip() or None
        if is_nse and not isin:
            # An equity series row with no ISIN is malformed; registering it would
            # create a master row that can never be deduped against its BSE twin.
            skipped_no_isin += 1
            continue

        candidates[symbol] = {
            'symbol': symbol,
            'exchange': exchange,
            'isin': isin,
            'is_active': True,
        }

    if not candidates:
        return {
            'registered': 0,
            'skipped_non_equity': skipped_non_equity,
            'skipped_no_isin': skipped_no_isin,
            'symbols': [],
            'series_breakdown': series_breakdown,
        }

    rows = list(candidates.values())

    if not dry_run:
        # UNIQUE (symbol, exchange) — concurrent runs converge instead of erroring.
        db.upsert('km_equity_symbols', rows, on_conflict='symbol,exchange')

    symbols = sorted(candidates.keys())
    print(
        f'  [registrar] {exchange}: registered {len(rows)} new symbol(s)'
        f'{" (dry-run)" if dry_run else ""}; '
        f'skipped {skipped_non_equity} non-equity, {skipped_no_isin} without ISIN'
    )
    if symbols:
        print(f'  [registrar] new: {", ".join(symbols[:15])}'
              f'{"..." if len(symbols) > 15 else ""}')

    return {
        'registered': len(rows),
        'skipped_non_equity': skipped_non_equity,
        'skipped_no_isin': skipped_no_isin,
        'symbols': symbols,
        'series_breakdown': series_breakdown,
    }
