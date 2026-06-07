"""
Batch Inserter — upserts parsed EOD records into km_equity_eod.
Handles batching for large datasets (1000+ rows per day).
Sanitizes pandas NA/NaT/NAType values to None before DB insert.
"""

import math

BATCH_SIZE = 500


def _sanitize(val):
    """Convert pandas NA, NaN, NaT, NAType to None for psycopg2."""
    if val is None:
        return None
    try:
        import pandas as pd
        if pd.isna(val):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    if isinstance(val, float) and math.isnan(val):
        return None
    return val

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

    # Filter to known columns + sanitize values
    clean = []
    for rec in records:
        row = {k: _sanitize(rec.get(k)) for k in EOD_COLUMNS if k in rec}
        if row.get('equity_id') and row.get('trade_date'):
            clean.append(row)

    total = 0
    for i in range(0, len(clean), BATCH_SIZE):
        batch = clean[i:i + BATCH_SIZE]
        count = db.upsert('km_equity_eod', batch, 'equity_id,trade_date')
        total += count

    return total


def sync_isin_from_bhav(db, matched_records: list[dict]) -> int:
    """
    Update km_equity_symbols.isin for rows that are NULL using ISINs from the
    day's bhavcopy. Uses equity_id (already resolved by SymbolMatcher) so there
    is no symbol-format ambiguity — the match is by PK, not by symbol string.

    Called after upsert_equity_eod() in the daily pipeline.
    Returns count of rows updated.
    """
    import psycopg2
    import psycopg2.extras
    from lib.config import DATABASE_URL

    updates = [
        (rec['isin'], rec['equity_id'])
        for rec in matched_records
        if rec.get('isin') and rec.get('equity_id')
    ]
    if not updates:
        return 0

    if not DATABASE_URL:
        return 0  # No direct PG available (PostgREST-only mode)

    conn = psycopg2.connect(DATABASE_URL, connect_timeout=30)
    try:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                UPDATE km_equity_symbols s
                SET    isin = data.isin
                FROM   (VALUES %s) AS data(isin, eq_id)
                WHERE  s.id   = data.eq_id::int
                  AND  s.isin IS NULL
                """,
                updates,
                page_size=500,
            )
            updated = cur.rowcount
        conn.commit()
    finally:
        conn.close()

    return updated


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
