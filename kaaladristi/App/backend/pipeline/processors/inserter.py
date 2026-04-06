"""
Batch Inserter — upserts parsed EOD records into km_equity_eod.
Handles batching for large datasets (1000+ rows per day).
"""


BATCH_SIZE = 500

# Columns to upsert (must match km_equity_eod schema)
EOD_COLUMNS = [
    'equity_id', 'trade_date',
    'open', 'high', 'low', 'close', 'prev_close',
    'chng', 'pct_chng',
    'volume', 'value_cr',
]

DELIVERY_COLUMNS = ['delivery_qty', 'delivery_pct']


def upsert_equity_eod(db, records: list[dict]) -> int:
    """
    Batch upsert EOD records into km_equity_eod.
    Conflict key: (equity_id, trade_date).
    Returns total rows upserted.
    """
    if not records:
        return 0

    # Filter to only known columns
    clean = []
    for rec in records:
        row = {k: rec.get(k) for k in EOD_COLUMNS if k in rec}
        if row.get('equity_id') and row.get('trade_date'):
            clean.append(row)

    total = 0
    for i in range(0, len(clean), BATCH_SIZE):
        batch = clean[i:i + BATCH_SIZE]
        count = db.upsert('km_equity_eod', batch, 'equity_id,trade_date')
        total += count

    return total


def update_delivery(db, trade_date: str, delivery_map: dict[str, dict],
                    symbol_matcher) -> int:
    """
    Update delivery_qty and delivery_pct on existing km_equity_eod rows.

    Args:
        delivery_map: {symbol: {delivery_qty, delivery_pct}}
        symbol_matcher: SymbolMatcher instance for symbol→id lookup
    """
    if not delivery_map:
        return 0

    records = []
    for symbol, deliv in delivery_map.items():
        eq_id = symbol_matcher.get_id(symbol)
        if eq_id is None:
            continue

        records.append({
            'equity_id': eq_id,
            'trade_date': trade_date,
            'delivery_qty': deliv.get('delivery_qty'),
            'delivery_pct': deliv.get('delivery_pct'),
        })

    if not records:
        return 0

    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        count = db.upsert('km_equity_eod', batch, 'equity_id,trade_date')
        total += count

    return total
