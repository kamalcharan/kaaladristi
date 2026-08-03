"""
Symbol Matcher — maps CSV symbols to km_equity_symbols IDs.
Caches lookup map for efficient matching across thousands of rows.
"""


class SymbolMatcher:
    """Builds and caches symbol→id lookup from km_equity_symbols."""

    def __init__(self, db, exchange: str = 'NSE'):
        self.db = db
        self.exchange = exchange
        self._map: dict[str, int] = {}
        self._loaded = False

    def _load(self):
        """Load symbol map from DB."""
        rows = self.db.select(
            'km_equity_symbols',
            'id,symbol',
            filters={'exchange': self.exchange},
        )
        self._map = {r['symbol'].upper(): r['id'] for r in rows}
        self._loaded = True
        print(f'  [matcher] Loaded {len(self._map)} {self.exchange} symbols')

    def reload(self):
        """Re-read the master. Call after SymbolRegistrar admits new symbols."""
        self._load()

    @property
    def known_symbols(self) -> set[str]:
        """Symbols currently in the master — lets the registrar skip a round-trip."""
        if not self._loaded:
            self._load()
        return set(self._map.keys())

    def get_id(self, symbol: str) -> int | None:
        """Return equity_id for a symbol, or None if not in master table."""
        if not self._loaded:
            self._load()
        return self._map.get(symbol.upper())

    def match_records(self, records: list[dict]) -> tuple[list[dict], list[str]]:
        """
        Match parsed records to equity IDs.

        Returns:
          (matched_records, unmatched_symbols)

        matched_records have 'equity_id' added and 'symbol' removed.
        """
        if not self._loaded:
            self._load()

        matched = []
        unmatched = set()
        unmatched_by_series: dict[str, int] = {}

        for rec in records:
            symbol = rec.get('symbol', '').upper()
            eq_id = self._map.get(symbol)

            if eq_id is None:
                if symbol not in unmatched:
                    series = (rec.get('series') or '').strip().upper() or 'UNKNOWN'
                    unmatched_by_series[series] = unmatched_by_series.get(series, 0) + 1
                unmatched.add(symbol)
                continue

            row = {**rec, 'equity_id': eq_id}
            row.pop('symbol', None)
            # Keep 'isin' — used by sync_isin_from_bhav() to update km_equity_symbols.
            # upsert_equity_eod() filters it out via EOD_COLUMNS allowlist.
            matched.append(row)

        unmatched_list = sorted(unmatched)
        if unmatched_list:
            # Report by series, NOT an alphabetical sample. Numeric-prefixed debt
            # ('1003IIFL29', '1018GS2026') sorts first, so a truncated sorted list
            # made a 2,104-symbol drop look like harmless bond noise for months.
            breakdown = ', '.join(
                f'{s}={n}' for s, n in
                sorted(unmatched_by_series.items(), key=lambda kv: -kv[1])
            )
            print(f'  [matcher] {len(unmatched_list)} unmatched symbols (not in master) '
                  f'by series: {breakdown}')

        return matched, unmatched_list

    def unmatched_series_breakdown(self, records: list[dict]) -> dict[str, int]:
        """Series histogram of symbols absent from the master — reconciliation input."""
        if not self._loaded:
            self._load()
        seen: set[str] = set()
        out: dict[str, int] = {}
        for rec in records:
            symbol = (rec.get('symbol') or '').upper()
            if not symbol or symbol in seen or symbol in self._map:
                continue
            seen.add(symbol)
            series = (rec.get('series') or '').strip().upper() or 'UNKNOWN'
            out[series] = out.get(series, 0) + 1
        return out

    @property
    def total_symbols(self) -> int:
        if not self._loaded:
            self._load()
        return len(self._map)
