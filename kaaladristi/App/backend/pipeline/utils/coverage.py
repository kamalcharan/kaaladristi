"""
Coverage query helpers for pipeline steps.
Computes rows_expected (total rows that should have been processed)
and rows_actual (rows that have the target column populated).
"""

import psycopg2.extras


def count_eod_rows(db, table: str, id_col: str, trade_date, exchange: str = None) -> int:
    """Count total EOD rows for a given date (optionally filtered by exchange)."""
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            if exchange and table == 'km_equity_eod':
                cur.execute(f"""
                    SELECT COUNT(*) FROM {table} e
                    JOIN km_equity_symbols s ON s.id = e.{id_col}
                    WHERE e.trade_date = %s AND s.exchange = %s AND s.is_active = true
                """, [str(trade_date), exchange])
            else:
                cur.execute(f"""
                    SELECT COUNT(*) FROM {table}
                    WHERE trade_date = %s
                """, [str(trade_date)])
            return cur.fetchone()[0]
    finally:
        db._put(conn)


def count_populated(db, table: str, column: str, id_col: str, trade_date, exchange: str = None) -> int:
    """Count rows where a specific column IS NOT NULL for a given date."""
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            if exchange and table == 'km_equity_eod':
                cur.execute(f"""
                    SELECT COUNT(*) FROM {table} e
                    JOIN km_equity_symbols s ON s.id = e.{id_col}
                    WHERE e.trade_date = %s AND s.exchange = %s
                      AND s.is_active = true AND e.{column} IS NOT NULL
                """, [str(trade_date), exchange])
            else:
                cur.execute(f"""
                    SELECT COUNT(*) FROM {table}
                    WHERE trade_date = %s AND {column} IS NOT NULL
                """, [str(trade_date)])
            return cur.fetchone()[0]
    finally:
        db._put(conn)


def count_active_symbols(db, exchange: str = None) -> int:
    """Count active equity symbols, optionally filtered by exchange."""
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            if exchange:
                cur.execute(
                    "SELECT COUNT(*) FROM km_equity_symbols WHERE is_active = true AND exchange = %s",
                    [exchange])
            else:
                cur.execute("SELECT COUNT(*) FROM km_equity_symbols WHERE is_active = true")
            return cur.fetchone()[0]
    finally:
        db._put(conn)


def count_active_indices(db) -> int:
    """Count active index symbols."""
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM km_index_symbols WHERE COALESCE(is_active, true) = true")
            return cur.fetchone()[0]
    finally:
        db._put(conn)


def count_industries(db, trade_date) -> int:
    """Count industries in km_industry_eod for a date."""
    conn = db._conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM km_industry_eod WHERE trade_date = %s",
                [str(trade_date)])
            return cur.fetchone()[0]
    finally:
        db._put(conn)


def get_step_coverage(db, step: str, trade_date, exchange: str = 'NSE'):
    """Get (rows_actual, rows_expected) for a pipeline step."""
    td = str(trade_date)

    if step == 'index_download':
        expected = count_active_indices(db)
        actual = count_eod_rows(db, 'km_index_eod', 'index_id', td)
        return actual, expected

    if step == 'insert' or step == 'download':
        expected = count_active_symbols(db, exchange)
        actual = count_eod_rows(db, 'km_equity_eod', 'equity_id', td, exchange)
        return actual, expected

    if step == 'indicators':
        expected = count_eod_rows(db, 'km_equity_eod', 'equity_id', td, exchange)
        actual = count_populated(db, 'km_equity_eod', 'indicators_computed_at', 'equity_id', td, exchange)
        return actual, expected

    if step == 'index_indicators':
        expected = count_eod_rows(db, 'km_index_eod', 'index_id', td)
        actual = count_populated(db, 'km_index_eod', 'indicators_computed_at', 'index_id', td)
        return actual, expected

    if step == 'magic_rs':
        expected = count_eod_rows(db, 'km_equity_eod', 'equity_id', td, exchange)
        actual = count_populated(db, 'km_equity_eod', 'magic_rs_zone', 'equity_id', td, exchange)
        return actual, expected

    if step == 'flow_intelligence':
        expected = count_eod_rows(db, 'km_equity_eod', 'equity_id', td, exchange)
        actual = count_populated(db, 'km_equity_eod', 'flow_type', 'equity_id', td, exchange)
        return actual, expected

    if step == 'industry_composites':
        # Expected: rough estimate of industries with 5+ stocks
        actual = count_industries(db, td)
        expected = max(actual, 40)  # at least 40 expected
        return actual, expected

    return None, None
