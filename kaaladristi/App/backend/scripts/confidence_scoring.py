import os, psycopg2, psycopg2.extras, json
from datetime import date

def get_conn():
    return psycopg2.connect(
        host="187.127.136.65", port=5432,
        dbname="kaala_dristi_db", user="postgres",
        password=os.environ["KD_DB_PASSWORD"]
    )

NIFTY_SYMBOL = "NIFTY 50"

_BULLISH_SIGNALS = {'bullish', 'strong_bullish', 'mild_bullish'}
_BEARISH_SIGNALS = {'bearish', 'strong_bearish', 'mild_bearish'}
_SKIP_SIGNALS    = {'volatile', 'turning', 'neutral'}

BATCH_SIZE = 500
TODAY = date.today()


# ── STEP 1: Build Nifty close-price lookup ─────────────────────────────────────

def build_nifty_close_map(conn) -> dict:
    """Return {trade_date: close_price} for all Nifty 50 trading dates."""
    cur = conn.cursor()
    cur.execute("""
        SELECT e.trade_date, e.close
        FROM km_index_eod e
        JOIN km_index_symbols s ON e.index_id = s.id
        WHERE s.name = %s
        ORDER BY e.trade_date
    """, (NIFTY_SYMBOL,))
    rows = cur.fetchall()
    close_map = {trade_date: float(close) for trade_date, close in rows if close is not None}
    print(f"  Nifty close prices loaded: {len(close_map)} dates")
    return close_map


# ── STEP 2: Populate nifty returns on km_rule_transits ────────────────────────

def update_transit_returns(conn, close_map: dict, rule_outcome_map: dict) -> int:
    """
    For each historical transit (end_date <= today) with null nifty_return_pct,
    look up start and end close prices and compute the return.
    Sets matched based on rule outcome vs Nifty direction.
    Returns number of transits updated.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT t.id, t.rule_id, t.start_date, t.end_date
        FROM km_rule_transits t
        WHERE t.end_date <= %s
          AND t.nifty_return_pct IS NULL
        ORDER BY t.start_date
    """, (TODAY,))
    rows = cur.fetchall()
    print(f"  Transits to score: {len(rows)}")

    total_updated = 0
    batch = []

    for transit_id, rule_id, start_date, end_date in rows:
        start_close = close_map.get(start_date)
        end_close   = close_map.get(end_date)

        # Walk forward up to 5 days to find a trading day if exact date is missing
        if start_close is None:
            for offset in range(1, 6):
                from datetime import timedelta
                candidate = start_date + timedelta(days=offset)
                if candidate in close_map:
                    start_close = close_map[candidate]
                    break
        if end_close is None:
            for offset in range(1, 6):
                from datetime import timedelta
                candidate = end_date + timedelta(days=offset)
                if candidate in close_map:
                    end_close = close_map[candidate]
                    break

        if start_close is None or end_close is None or start_close == 0:
            continue

        ret_pct = round((end_close - start_close) / start_close * 100, 4)
        direction = 'up' if ret_pct > 0 else 'down'

        outcome = (rule_outcome_map.get(rule_id) or '').lower()
        if outcome in _SKIP_SIGNALS:
            matched = None
        elif outcome in _BULLISH_SIGNALS:
            matched = (direction == 'up')
        elif outcome in _BEARISH_SIGNALS:
            matched = (direction == 'down')
        else:
            matched = None

        batch.append((round(start_close, 4), round(end_close, 4), ret_pct, matched, transit_id))

        if len(batch) >= BATCH_SIZE:
            _flush_transit_batch(conn, batch)
            total_updated += len(batch)
            batch = []

    if batch:
        _flush_transit_batch(conn, batch)
        total_updated += len(batch)

    conn.commit()
    print(f"  Transits updated: {total_updated}")
    return total_updated


def _flush_transit_batch(conn, batch: list):
    cur = conn.cursor()
    cur.executemany(
        "UPDATE km_rule_transits "
        "SET nifty_start_close = %s, nifty_end_close = %s, "
        "    nifty_return_pct = %s, matched = %s "
        "WHERE id = %s",
        batch,
    )


def load_rule_outcome_map(conn) -> dict:
    """Return {rule_id: outcome} for all rules."""
    cur = conn.cursor()
    cur.execute("SELECT id, outcome FROM km_astro_rule_master")
    return {row[0]: row[1] for row in cur.fetchall()}


# ── STEP 3: Compute km_rule_confidence from transits ─────────────────────────

def compute_confidence_from_transits(conn) -> int:
    """
    Aggregate km_rule_transits (historical only) per rule_id and upsert
    km_rule_confidence with all new return/duration columns.
    Returns number of rules upserted.
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO km_rule_confidence (
            rule_id,
            total_occurrences,
            matched_count,
            confidence_score,
            avg_return_all,
            avg_return_matched,
            avg_return_unmatched,
            best_return,
            worst_return,
            avg_duration_days,
            historical_transits,
            last_computed_at
        )
        SELECT
            rule_id,
            COUNT(*) FILTER (WHERE matched IS NOT NULL)               AS total_occurrences,
            COUNT(*) FILTER (WHERE matched = TRUE)                    AS matched_count,
            ROUND(
                COUNT(*) FILTER (WHERE matched = TRUE)::numeric /
                NULLIF(COUNT(*) FILTER (WHERE matched IS NOT NULL), 0) * 100
            , 2)                                                       AS confidence_score,
            ROUND(AVG(nifty_return_pct)::numeric, 4)                  AS avg_return_all,
            ROUND(AVG(nifty_return_pct) FILTER (WHERE matched = TRUE)::numeric, 4)
                                                                       AS avg_return_matched,
            ROUND(AVG(nifty_return_pct) FILTER (WHERE matched = FALSE)::numeric, 4)
                                                                       AS avg_return_unmatched,
            ROUND(MAX(nifty_return_pct)::numeric, 4)                  AS best_return,
            ROUND(MIN(nifty_return_pct)::numeric, 4)                  AS worst_return,
            ROUND(AVG(duration_days)::numeric, 1)                     AS avg_duration_days,
            COUNT(*) FILTER (WHERE nifty_return_pct IS NOT NULL)      AS historical_transits,
            NOW()
        FROM km_rule_transits
        WHERE end_date <= CURRENT_DATE
        GROUP BY rule_id
        ON CONFLICT (rule_id) DO UPDATE SET
            total_occurrences  = EXCLUDED.total_occurrences,
            matched_count      = EXCLUDED.matched_count,
            confidence_score   = EXCLUDED.confidence_score,
            avg_return_all     = EXCLUDED.avg_return_all,
            avg_return_matched = EXCLUDED.avg_return_matched,
            avg_return_unmatched = EXCLUDED.avg_return_unmatched,
            best_return        = EXCLUDED.best_return,
            worst_return       = EXCLUDED.worst_return,
            avg_duration_days  = EXCLUDED.avg_duration_days,
            historical_transits = EXCLUDED.historical_transits,
            last_computed_at   = EXCLUDED.last_computed_at
    """)
    upserted = cur.rowcount
    conn.commit()
    print(f"  km_rule_confidence rows upserted: {upserted}")
    return upserted


# ── STEP 4: Compute yearly breakdown ─────────────────────────────────────────

def compute_yearly_breakdown(conn) -> int:
    """
    Populate km_rule_confidence_yearly from km_rule_transits.
    Replaces all yearly rows for affected rules.
    Returns rows upserted.
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO km_rule_confidence_yearly (
            rule_id, year, transits, matched, win_pct, avg_return, avg_duration
        )
        SELECT
            rule_id,
            EXTRACT(YEAR FROM start_date)::smallint AS year,
            COUNT(*)                                          AS transits,
            COUNT(*) FILTER (WHERE matched = TRUE)           AS matched,
            ROUND(
                COUNT(*) FILTER (WHERE matched = TRUE)::numeric /
                NULLIF(COUNT(*) FILTER (WHERE matched IS NOT NULL), 0) * 100
            , 2)                                             AS win_pct,
            ROUND(AVG(nifty_return_pct)::numeric, 4)        AS avg_return,
            ROUND(AVG(duration_days)::numeric, 1)           AS avg_duration
        FROM km_rule_transits
        WHERE end_date <= CURRENT_DATE
        GROUP BY rule_id, EXTRACT(YEAR FROM start_date)
        ON CONFLICT (rule_id, year) DO UPDATE SET
            transits     = EXCLUDED.transits,
            matched      = EXCLUDED.matched,
            win_pct      = EXCLUDED.win_pct,
            avg_return   = EXCLUDED.avg_return,
            avg_duration = EXCLUDED.avg_duration
    """)
    upserted = cur.rowcount
    conn.commit()
    print(f"  km_rule_confidence_yearly rows upserted: {upserted}")
    return upserted


# ── STEP 5: Print summary ─────────────────────────────────────────────────────

def print_summary(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT r.rule_code, c.historical_transits, c.matched_count,
               c.confidence_score, c.avg_return_all, c.avg_duration_days
        FROM km_rule_confidence c
        JOIN km_astro_rule_master r ON c.rule_id = r.id
        WHERE c.historical_transits > 0
        ORDER BY c.confidence_score DESC
    """)
    rows = cur.fetchall()

    print(f"\n{'Rule Code':<30} {'Transits':>8} {'Matched':>7} {'Win%':>6} {'AvgRet':>8} {'AvgDays':>8}")
    print("-" * 74)
    for rule_code, transits, matched, score, avg_ret, avg_dur in rows:
        score_str  = f"{score:.1f}%" if score  is not None else "N/A"
        ret_str    = f"{avg_ret:+.2f}%" if avg_ret is not None else "N/A"
        dur_str    = f"{avg_dur:.1f}" if avg_dur is not None else "N/A"
        print(f"{rule_code:<30} {(transits or 0):>8} {(matched or 0):>7} {score_str:>6} {ret_str:>8} {dur_str:>8}")

    scores = [float(r[3]) for r in rows if r[3] is not None]
    if scores:
        print(f"\n── Overall stats ─────────────────────────────────────────────")
        print(f"  Rules scored:           {len(scores)}")
        print(f"  Rules win% > 70:        {sum(1 for s in scores if s >= 70)}")
        print(f"  Rules win% > 60:        {sum(1 for s in scores if s >= 60)}")
        print(f"  Rules win% < 40:        {sum(1 for s in scores if s < 40)}  ← potential inverse signals")
        print(f"  Average win%:           {sum(scores)/len(scores):.1f}%")


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    import time
    start = time.time()
    conn = get_conn()
    print(f"Connected. NIFTY_SYMBOL = '{NIFTY_SYMBOL}', today = {TODAY}")

    print("\n[1] Building Nifty close-price map…")
    close_map = build_nifty_close_map(conn)

    print("\n[2] Loading rule outcome map…")
    rule_outcome_map = load_rule_outcome_map(conn)
    print(f"  Rules loaded: {len(rule_outcome_map)}")

    print("\n[3] Scoring km_rule_transits…")
    update_transit_returns(conn, close_map, rule_outcome_map)

    print("\n[4] Computing km_rule_confidence…")
    compute_confidence_from_transits(conn)

    print("\n[5] Computing yearly breakdown…")
    compute_yearly_breakdown(conn)

    print("\n[6] Summary:")
    print_summary(conn)

    conn.close()
    print(f"\nDone in {time.time() - start:.1f}s")


if __name__ == '__main__':
    main()
