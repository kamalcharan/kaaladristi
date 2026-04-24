import os, psycopg2, json
from datetime import date

def get_conn():
    return psycopg2.connect(
        host="187.127.136.65", port=5432,
        dbname="kaala_dristi_db", user="postgres",
        password=os.environ["KD_DB_PASSWORD"]
    )

# Canonical Nifty 50 symbol in km_index_eod (most rows, NSE primary benchmark).
# Verify with:
#   SELECT symbol, exchange, COUNT(*) FROM km_index_eod
#   WHERE symbol ILIKE '%nifty%' GROUP BY symbol, exchange ORDER BY 3 DESC LIMIT 10;
NIFTY_SYMBOL = "NIFTY 50"

# Signals that map to a directional outcome for match scoring
_BULLISH_SIGNALS = {'bullish', 'strong_bullish', 'mild_bullish'}
_BEARISH_SIGNALS = {'bearish', 'strong_bearish', 'mild_bearish'}
# Signals where market direction is irrelevant — skip matched scoring
_SKIP_SIGNALS    = {'volatile', 'turning', 'neutral'}

BATCH_SIZE = 1000


# ── STEP 1: Build Nifty daily return lookup ────────────────────────────────────

def build_nifty_returns(conn: psycopg2.extensions.connection) -> dict:
    """Return {date: {'return_pct': float, 'direction': 'up'|'down'}} for all Nifty dates."""
    cur = conn.cursor()
    cur.execute("""
        SELECT date, close,
               LAG(close) OVER (ORDER BY date) AS prev_close
        FROM km_index_eod
        WHERE symbol = %s
        ORDER BY date
    """, (NIFTY_SYMBOL,))
    rows = cur.fetchall()
    print(f"  Nifty rows loaded: {len(rows)}")

    returns: dict = {}
    for trade_date, close, prev_close in rows:
        if prev_close is None or prev_close == 0:
            continue
        ret_pct = float((close - prev_close) / prev_close * 100)
        returns[trade_date] = {
            'return_pct': round(ret_pct, 4),
            'direction': 'up' if ret_pct > 0 else 'down',
        }
    print(f"  Nifty return dates built: {len(returns)}")
    return returns


# ── STEP 2: Update km_rule_signals with actual returns ────────────────────────

def update_signals_returns(conn: psycopg2.extensions.connection,
                           nifty_returns: dict) -> int:
    """
    Set actual_market_return and matched for every km_rule_signals row
    whose date exists in nifty_returns. Processes in batches of BATCH_SIZE.
    Returns total rows updated.
    """
    cur = conn.cursor()

    # Fetch all signal rows that need updating (date has a Nifty return)
    cur.execute("""
        SELECT id, date, signal
        FROM km_rule_signals
        WHERE actual_market_return IS NULL OR matched IS NULL
    """)
    rows = cur.fetchall()
    print(f"  Signal rows to score: {len(rows)}")

    total_updated = 0
    batch = []

    for row_id, sig_date, signal in rows:
        nr = nifty_returns.get(sig_date)
        if nr is None:
            continue  # no Nifty data for this date

        ret_pct = nr['return_pct']
        direction = nr['direction']
        sig_lower = (signal or '').lower()

        if sig_lower in _SKIP_SIGNALS:
            matched = None          # NULL — not scored
        elif sig_lower in _BULLISH_SIGNALS:
            matched = (direction == 'up')
        elif sig_lower in _BEARISH_SIGNALS:
            matched = (direction == 'down')
        else:
            matched = None          # unknown signal type — skip

        batch.append((ret_pct, matched, row_id))

        if len(batch) >= BATCH_SIZE:
            _flush_signal_batch(conn, batch)
            total_updated += len(batch)
            batch = []

    if batch:
        _flush_signal_batch(conn, batch)
        total_updated += len(batch)

    conn.commit()
    print(f"  Signal rows updated: {total_updated}")
    return total_updated


def _flush_signal_batch(conn, batch: list):
    cur = conn.cursor()
    cur.executemany(
        "UPDATE km_rule_signals "
        "SET actual_market_return = %s, matched = %s "
        "WHERE id = %s",
        batch,
    )


# ── STEP 3: Compute and upsert km_rule_confidence ─────────────────────────────

def compute_confidence(conn: psycopg2.extensions.connection) -> int:
    """
    Aggregate km_rule_signals per rule_id and upsert km_rule_confidence.
    Returns number of rules upserted.
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO km_rule_confidence
          (rule_id, total_occurrences, matched_count, confidence_score, last_computed_at)
        SELECT
            rule_id,
            COUNT(*) FILTER (WHERE matched IS NOT NULL)          AS total_occurrences,
            COUNT(*) FILTER (WHERE matched = TRUE)               AS matched_count,
            ROUND(
                COUNT(*) FILTER (WHERE matched = TRUE)::numeric /
                NULLIF(COUNT(*) FILTER (WHERE matched IS NOT NULL), 0) * 100
            , 2)                                                 AS confidence_score,
            NOW()
        FROM km_rule_signals
        GROUP BY rule_id
        ON CONFLICT (rule_id) DO UPDATE SET
            total_occurrences = EXCLUDED.total_occurrences,
            matched_count     = EXCLUDED.matched_count,
            confidence_score  = EXCLUDED.confidence_score,
            last_computed_at  = EXCLUDED.last_computed_at
    """)
    upserted = cur.rowcount
    conn.commit()
    print(f"  km_rule_confidence rows upserted: {upserted}")
    return upserted


# ── STEP 4: Print summary ─────────────────────────────────────────────────────

def print_summary(conn: psycopg2.extensions.connection):
    cur = conn.cursor()
    cur.execute("""
        SELECT r.rule_code, c.total_occurrences, c.matched_count, c.confidence_score
        FROM km_rule_confidence c
        JOIN km_astro_rule_master r ON c.rule_id = r.id
        WHERE c.total_occurrences > 0
        ORDER BY c.confidence_score DESC
    """)
    rows = cur.fetchall()

    print(f"\n{'Rule Code':<30} {'Occurrences':>11} {'Matched':>7} {'Confidence':>10}")
    print("-" * 64)
    for rule_code, total, matched, score in rows:
        score_str = f"{score:.1f}%" if score is not None else "N/A"
        print(f"{rule_code:<30} {total:>11} {matched:>7} {score_str:>10}")

    scores = [float(r[3]) for r in rows if r[3] is not None]
    if scores:
        print(f"\n── Overall stats ({'all' if rows else 'none'}) ─────────────────")
        print(f"  Rules scored:           {len(scores)}")
        print(f"  Rules confidence > 70%: {sum(1 for s in scores if s >= 70)}")
        print(f"  Rules confidence > 60%: {sum(1 for s in scores if s >= 60)}")
        print(f"  Rules confidence < 40%: {sum(1 for s in scores if s < 40)}  ← potential inverse signals")
        print(f"  Average confidence:     {sum(scores)/len(scores):.1f}%")


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    import time
    start = time.time()
    conn = get_conn()
    print(f"Connected. NIFTY_SYMBOL = '{NIFTY_SYMBOL}'")

    print("\n[1] Building Nifty returns…")
    nifty_returns = build_nifty_returns(conn)

    print("\n[2] Scoring km_rule_signals…")
    update_signals_returns(conn, nifty_returns)

    print("\n[3] Computing km_rule_confidence…")
    compute_confidence(conn)

    print("\n[4] Summary:")
    print_summary(conn)

    conn.close()
    print(f"\nDone in {time.time() - start:.1f}s")


if __name__ == '__main__':
    main()
