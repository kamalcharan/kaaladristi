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

        for rec in records:
            symbol = rec.get('symbol', '').upper()
            eq_id = self._map.get(symbol)

            if eq_id is None:
                unmatched.add(symbol)
                continue

            row = {**rec, 'equity_id': eq_id}
            row.pop('symbol', None)
            # Keep 'isin' — used by sync_isin_from_bhav() to update km_equity_symbols.
            # upsert_equity_eod() filters it out via EOD_COLUMNS allowlist.
            matched.append(row)

        unmatched_list = sorted(unmatched)
        if unmatched_list:
            print(f'  [matcher] {len(unmatched_list)} unmatched symbols (not in master): '
                  f'{", ".join(unmatched_list[:10])}{"..." if len(unmatched_list) > 10 else ""}')

        return matched, unmatched_list

    @property
    def total_symbols(self) -> int:
        if not self._loaded:
            self._load()
        return len(self._map)
