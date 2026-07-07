import os
import sys
import psycopg2
import psycopg2.extras
import json
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.config import DATABASE_URL


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL / DB_PRIMARY not set in .env')
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)

NIFTY_SYMBOL = "NIFTY 50"

# Directional buckets — cover BOTH vocabularies the hypothesis can arrive in:
# the rule master's outcome/base_bias values AND km_rule_inference's 12-value
# /inference vocabulary (migration 135).
_BULLISH_SIGNALS = {'bullish', 'strong_bullish', 'mild_bullish',
                    'major_positive', 'minor_positive'}
_BEARISH_SIGNALS = {'bearish', 'strong_bearish', 'mild_bearish',
                    'major_negative', 'minor_negative'}
_SKIP_SIGNALS    = {'volatile', 'turning', 'neutral',
                    'highly_volatile', 'cautious', 'consolidation', 'mixed'}

# Rule types whose signals live in km_rule_signals only (no km_rule_transits)
DAILY_ONLY_RULE_TYPES = ('nakshatra_vara', 'tithi_alone', 'eclipse')

BATCH_SIZE = 500
TODAY = date.today()


# ── STEP 1: Build Nifty close-price lookups ────────────────────────────────────

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


def build_nifty_prev_close_map(close_map: dict) -> dict:
    """
    Return {trade_date: (prev_close, close)} for each date that has a predecessor.
    Used to compute same-day returns for daily-signal rules.
    """
    sorted_dates = sorted(close_map.keys())
    result = {}
    for i in range(1, len(sorted_dates)):
        d      = sorted_dates[i]
        prev_d = sorted_dates[i - 1]
        result[d] = (close_map[prev_d], close_map[d])
    return result


# ── STEP 2a: Score km_rule_transits (transit-based rules) ─────────────────────

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
            from datetime import timedelta
            for offset in range(1, 6):
                candidate = start_date + timedelta(days=offset)
                if candidate in close_map:
                    start_close = close_map[candidate]
                    break
        if end_close is None:
            from datetime import timedelta
            for offset in range(1, 6):
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
    """Return {rule_id: hypothesis_impact} for all rules.

    Item 3 of the inference-lifecycle POA: the hypothesis of record is the
    rule's ACTIVE single-rule inference; the seeded outcome/base_bias is
    only the fallback for rules with no authored inference. Scoring
    therefore validates what the expert currently claims, not the fossil
    label — same windows, re-scored whenever the claim changes."""
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id, COALESCE(i.market_impact, COALESCE(r.outcome, r.base_bias))
        FROM km_astro_rule_master r
        LEFT JOIN km_rule_inference i
               ON i.rule_a_id = r.id AND i.rule_b_id IS NULL AND i.status = 'active'
    """)
    return {row[0]: row[1] for row in cur.fetchall()}


# ── Hypothesis-aware re-scoring (POA item 3) ───────────────────────────────────
#
# update_transit_returns() only fills rows whose nifty_return_pct IS NULL, so
# a hypothesis change would never touch already-scored windows. matched is
# fully derivable from the STORED return + the current hypothesis, so this
# recomputes it in one UPDATE — cheap enough to run on every inference save
# (scoped to that rule) and after every nightly scoring pass (all rules).

_RESCORE_MATCHED_SQL = """
    UPDATE km_rule_transits t
    SET matched = CASE
        WHEN h.impact IN %(bullish)s THEN t.nifty_return_pct > 0
        WHEN h.impact IN %(bearish)s THEN t.nifty_return_pct <= 0
        ELSE NULL
    END
    FROM (
        SELECT r.id AS rule_id,
               COALESCE(i.market_impact, COALESCE(r.outcome, r.base_bias)) AS impact
        FROM km_astro_rule_master r
        LEFT JOIN km_rule_inference i
               ON i.rule_a_id = r.id AND i.rule_b_id IS NULL AND i.status = 'active'
    ) h
    WHERE h.rule_id = t.rule_id
      AND t.nifty_return_pct IS NOT NULL
"""

_HYPOTHESIS_STAMP_SQL = """
    UPDATE km_rule_confidence c
    SET hypothesis_source = h.src,
        hypothesis_impact = h.impact
    FROM (
        SELECT r.id AS rule_id,
               COALESCE(i.market_impact, COALESCE(r.outcome, r.base_bias)) AS impact,
               CASE WHEN i.market_impact IS NOT NULL THEN 'inference' ELSE 'base_bias' END AS src
        FROM km_astro_rule_master r
        LEFT JOIN km_rule_inference i
               ON i.rule_a_id = r.id AND i.rule_b_id IS NULL AND i.status = 'active'
    ) h
    WHERE c.rule_id = h.rule_id
"""


def rescore_rules(conn, rule_ids: list | None = None) -> int:
    """Recompute matched for already-scored windows against the CURRENT
    hypothesis (active inference, else base_bias), refresh km_rule_confidence
    aggregates, and stamp which hypothesis produced the numbers.

    rule_ids=None → all rules (nightly pass); a list → just those rules
    (called synchronously when an inference is saved)."""
    cur = conn.cursor()
    params = {'bullish': tuple(_BULLISH_SIGNALS), 'bearish': tuple(_BEARISH_SIGNALS)}

    sql = _RESCORE_MATCHED_SQL
    if rule_ids:
        sql += " AND t.rule_id = ANY(%(rule_ids)s)"
        params['rule_ids'] = list(rule_ids)
    cur.execute(sql, params)
    rescored = cur.rowcount

    # Refresh aggregates for the affected rules (same upsert shape as
    # compute_confidence_from_transits, scoped when rule_ids given).
    agg_filter = "AND rule_id = ANY(%(rule_ids)s)" if rule_ids else ""
    cur.execute(f"""
        INSERT INTO km_rule_confidence (
            rule_id, total_occurrences, matched_count, confidence_score,
            avg_return_all, avg_return_matched, avg_return_unmatched,
            best_return, worst_return, avg_duration_days,
            historical_transits, last_computed_at
        )
        SELECT
            rule_id,
            COUNT(*) FILTER (WHERE matched IS NOT NULL),
            COUNT(*) FILTER (WHERE matched = TRUE),
            ROUND(COUNT(*) FILTER (WHERE matched = TRUE)::numeric /
                  NULLIF(COUNT(*) FILTER (WHERE matched IS NOT NULL), 0) * 100, 2),
            ROUND(AVG(nifty_return_pct)::numeric, 4),
            ROUND(AVG(nifty_return_pct) FILTER (WHERE matched = TRUE)::numeric, 4),
            ROUND(AVG(nifty_return_pct) FILTER (WHERE matched = FALSE)::numeric, 4),
            ROUND(MAX(nifty_return_pct)::numeric, 4),
            ROUND(MIN(nifty_return_pct)::numeric, 4),
            ROUND(AVG(duration_days)::numeric, 1),
            COUNT(*) FILTER (WHERE nifty_return_pct IS NOT NULL),
            NOW()
        FROM km_rule_transits
        WHERE end_date <= CURRENT_DATE {agg_filter}
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
    """, params)

    stamp_sql = _HYPOTHESIS_STAMP_SQL
    if rule_ids:
        stamp_sql += " AND c.rule_id = ANY(%(rule_ids)s)"
    cur.execute(stamp_sql, params)

    conn.commit()
    return rescored


# ── Per-benchmark confidence (POA item 4 part 1, migration 139) ────────────────
#
# Windows are universal facts; what differs per instrument is only the return.
# For every benchmark index with enough history, measure each rule window on
# THAT index's closes (same close(start)->close(end) + 5-day forward walk as
# update_transit_returns) and aggregate matched/confidence vs the rule's
# current hypothesis (active inference, else base_bias). NIFTY 50's aggregate
# stays in km_rule_confidence; this table answers "does the rule hold on the
# index the user is actually looking at / the inference actually claims".

MIN_BENCH_BARS = 250   # same gate as pattern_study.py — skip thin benchmarks


def _load_hypothesis_maps(conn):
    """({rule_id: impact}, {rule_id: 'inference'|'base_bias'})"""
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id,
               COALESCE(i.market_impact, COALESCE(r.outcome, r.base_bias)),
               CASE WHEN i.market_impact IS NOT NULL THEN 'inference' ELSE 'base_bias' END
        FROM km_astro_rule_master r
        LEFT JOIN km_rule_inference i
               ON i.rule_a_id = r.id AND i.rule_b_id IS NULL AND i.status = 'active'
    """)
    impact, source = {}, {}
    for rid, imp, src in cur.fetchall():
        impact[rid] = imp
        source[rid] = src
    return impact, source


def score_benchmark_confidence(conn, rule_ids: list | None = None) -> int:
    """Upsert km_rule_confidence_bench for all (rule, benchmark) pairs.

    rule_ids=None → every rule with completed transit windows (nightly);
    a list → just those rules (inference save/delete). Daily-signal rules
    (km_rule_signals) are not fanned out yet — their aggregate stays
    NIFTY-based in km_rule_confidence.
    Returns the number of (rule, benchmark) rows upserted."""
    from datetime import timedelta

    cur = conn.cursor()
    impact_map, source_map = _load_hypothesis_maps(conn)

    # Completed windows, grouped per rule
    q = """
        SELECT rule_id, start_date, end_date
        FROM km_rule_transits
        WHERE end_date <= CURRENT_DATE
    """
    args = []
    if rule_ids:
        q += " AND rule_id = ANY(%s)"
        args.append(list(rule_ids))
    cur.execute(q, args)
    windows_by_rule: dict = {}
    for rid, sd, ed in cur.fetchall():
        windows_by_rule.setdefault(rid, []).append((sd, ed))
    if not windows_by_rule:
        return 0

    # Benchmarks with enough history (standard + curated)
    cur.execute("""
        SELECT s.id FROM km_index_symbols s
        WHERE (SELECT COUNT(*) FROM km_index_eod e WHERE e.index_id = s.id) >= %s
        ORDER BY s.id
    """, (MIN_BENCH_BARS,))
    bench_ids = [r[0] for r in cur.fetchall()]

    upserted = 0
    batch: list = []

    def flush():
        nonlocal upserted, batch
        if not batch:
            return
        psycopg2.extras.execute_values(cur, """
            INSERT INTO km_rule_confidence_bench (
                rule_id, benchmark_index_id, total_occurrences, matched_count,
                confidence_score, avg_return_all, avg_return_matched,
                avg_return_unmatched, best_return, worst_return,
                historical_transits, hypothesis_source, hypothesis_impact,
                last_computed_at
            ) VALUES %s
            ON CONFLICT (rule_id, benchmark_index_id) DO UPDATE SET
                total_occurrences  = EXCLUDED.total_occurrences,
                matched_count      = EXCLUDED.matched_count,
                confidence_score   = EXCLUDED.confidence_score,
                avg_return_all     = EXCLUDED.avg_return_all,
                avg_return_matched = EXCLUDED.avg_return_matched,
                avg_return_unmatched = EXCLUDED.avg_return_unmatched,
                best_return        = EXCLUDED.best_return,
                worst_return       = EXCLUDED.worst_return,
                historical_transits = EXCLUDED.historical_transits,
                hypothesis_source  = EXCLUDED.hypothesis_source,
                hypothesis_impact  = EXCLUDED.hypothesis_impact,
                last_computed_at   = NOW()
        """, batch,
            template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())")
        upserted += len(batch)
        batch = []

    for bench_id in bench_ids:
        # One benchmark's close map at a time — bounded memory
        cur.execute(
            "SELECT trade_date, close FROM km_index_eod "
            "WHERE index_id = %s AND close IS NOT NULL",
            (bench_id,),
        )
        close_map = {d: float(c) for d, c in cur.fetchall()}
        if len(close_map) < MIN_BENCH_BARS:
            continue

        def close_on_or_after(d, _cm=close_map):
            for off in range(0, 6):
                c = _cm.get(d + timedelta(days=off))
                if c is not None:
                    return c
            return None

        for rid, windows in windows_by_rule.items():
            outcome = (impact_map.get(rid) or '').lower()
            rets, matched_flags = [], []
            for sd, ed in windows:
                sc, ec = close_on_or_after(sd), close_on_or_after(ed)
                if sc is None or ec is None or sc == 0:
                    continue
                ret = (ec - sc) / sc * 100
                rets.append(ret)
                if outcome in _BULLISH_SIGNALS:
                    matched_flags.append(ret > 0)
                elif outcome in _BEARISH_SIGNALS:
                    matched_flags.append(ret <= 0)
                else:
                    matched_flags.append(None)

            if not rets:
                continue
            scored = [m for m in matched_flags if m is not None]
            n = len(scored)
            matched_count = sum(1 for m in scored if m)
            matched_rets   = [r for r, m in zip(rets, matched_flags) if m is True]
            unmatched_rets = [r for r, m in zip(rets, matched_flags) if m is False]
            batch.append((
                rid, bench_id, n, matched_count,
                round(matched_count / n * 100, 2) if n else None,
                round(sum(rets) / len(rets), 4),
                round(sum(matched_rets) / len(matched_rets), 4) if matched_rets else None,
                round(sum(unmatched_rets) / len(unmatched_rets), 4) if unmatched_rets else None,
                round(max(rets), 4), round(min(rets), 4),
                len(rets), source_map.get(rid), impact_map.get(rid),
            ))
            if len(batch) >= 500:
                flush()

    flush()
    conn.commit()
    return upserted


# ── STEP 2b: Partial-day flags for nakshatra/tithi signals ────────────────────

def populate_partial_day_flags(conn) -> int:
    """
    Set km_rule_signals.partial_day based on panchang end times.

    partial_day = TRUE  if the nakshatra or tithi changes before market close
                        (15:30 IST), meaning the rule was only active for part
                        of the trading session.  Includes transitions that happen
                        before market open (signal is essentially the wrong element
                        for the whole trading day).

    Applies to:
      nakshatra_vara — uses nakshatra_end_ist  (incl. DLNL Schema D)
      tithi_alone    — uses tithi_end_ist

    Only rows where partial_day IS NULL are updated (idempotent).
    Returns count of rows updated.
    """
    cur = conn.cursor()
    cur.execute("""
        UPDATE km_rule_signals s
        SET partial_day = CASE
            WHEN r.rule_type = 'nakshatra_vara'
                 AND p.nakshatra_end_ist IS NOT NULL
                 AND p.nakshatra_end_ist < '15:30:00'::time
                THEN TRUE
            WHEN r.rule_type = 'tithi_alone'
                 AND p.tithi_end_ist IS NOT NULL
                 AND p.tithi_end_ist < '15:30:00'::time
                THEN TRUE
            ELSE FALSE
        END
        FROM km_daily_panchang p, km_astro_rule_master r
        WHERE p.date = s.date
          AND r.id = s.rule_id
          AND s.partial_day IS NULL
    """)
    updated = cur.rowcount
    conn.commit()
    print(f"  partial_day flags set: {updated}")
    return updated


# ── STEP 2c: Score km_rule_signals (daily-only rules) ─────────────────────────

def update_daily_signal_returns(conn, close_map: dict, rule_outcome_map: dict) -> int:
    """
    For each daily-type signal (nakshatra_vara / tithi_alone / eclipse) with null
    actual_market_return, compute the same-day Nifty return:
        return% = (close[signal_date] - close[prev_trading_day]) / close[prev_trading_day] * 100

    This measures "what did Nifty do on the day this rule was active?"

    NOTE: partial_day signals ARE included but flagged — callers can exclude them
    later. The return for a partial-day signal is noisier because the market traded
    under a different nakshatra/tithi for part of the session.

    Returns number of signals updated.
    """
    prev_close_map = build_nifty_prev_close_map(close_map)

    cur = conn.cursor()
    cur.execute("""
        SELECT s.id, s.rule_id, s.date
        FROM km_rule_signals s
        JOIN km_astro_rule_master r ON r.id = s.rule_id
        WHERE r.rule_type IN %s
          AND s.actual_market_return IS NULL
          AND s.date < %s
        ORDER BY s.date
    """, (DAILY_ONLY_RULE_TYPES, TODAY))
    rows = cur.fetchall()
    print(f"  Daily signals to score: {len(rows)}")

    total_updated = 0
    batch = []

    for signal_id, rule_id, signal_date in rows:
        price_pair = prev_close_map.get(signal_date)
        if price_pair is None:
            continue  # no previous trading day data
        prev_close, day_close = price_pair
        if prev_close == 0:
            continue

        ret_pct   = round((day_close - prev_close) / prev_close * 100, 4)
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

        batch.append((ret_pct, matched, signal_id))

        if len(batch) >= BATCH_SIZE:
            _flush_signal_batch(conn, batch)
            total_updated += len(batch)
            batch = []

    if batch:
        _flush_signal_batch(conn, batch)
        total_updated += len(batch)

    conn.commit()
    print(f"  Daily signals updated: {total_updated}")
    return total_updated


def _flush_signal_batch(conn, batch: list):
    from psycopg2.extras import execute_values
    cur = conn.cursor()
    execute_values(
        cur,
        "UPDATE km_rule_signals "
        "SET actual_market_return = v.ret_pct, matched = v.matched "
        "FROM (VALUES %s) AS v(ret_pct, matched, id) "
        "WHERE km_rule_signals.id = v.id::int",
        batch,
        template="(%s, %s, %s)",
        page_size=500,
    )


# ── STEP 3a: Compute km_rule_confidence from transits ─────────────────────────

def compute_confidence_from_transits(conn) -> int:
    """
    Aggregate km_rule_transits (historical only) per rule_id and upsert
    km_rule_confidence.  Transit-based rules only.
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
    print(f"  km_rule_confidence rows upserted (transits): {upserted}")
    return upserted


# ── STEP 3b: Compute km_rule_confidence from daily signals ────────────────────

def compute_confidence_from_daily_signals(conn) -> int:
    """
    Aggregate km_rule_signals for daily-only rule types into km_rule_confidence.

    Uses only signals where actual_market_return IS NOT NULL and date < today.
    Partial-day signals ARE included in the aggregate (they are flagged via
    partial_day=TRUE so callers can filter if needed — see km_rule_signals).

    avg_duration_days is set to 1 (daily signals have no multi-day span).

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
            s.rule_id,
            COUNT(*) FILTER (WHERE s.matched IS NOT NULL)               AS total_occurrences,
            COUNT(*) FILTER (WHERE s.matched = TRUE)                    AS matched_count,
            ROUND(
                COUNT(*) FILTER (WHERE s.matched = TRUE)::numeric /
                NULLIF(COUNT(*) FILTER (WHERE s.matched IS NOT NULL), 0) * 100
            , 2)                                                         AS confidence_score,
            ROUND(AVG(s.actual_market_return)::numeric, 4)              AS avg_return_all,
            ROUND(AVG(s.actual_market_return) FILTER (WHERE s.matched = TRUE)::numeric, 4)
                                                                         AS avg_return_matched,
            ROUND(AVG(s.actual_market_return) FILTER (WHERE s.matched = FALSE)::numeric, 4)
                                                                         AS avg_return_unmatched,
            ROUND(MAX(s.actual_market_return)::numeric, 4)              AS best_return,
            ROUND(MIN(s.actual_market_return)::numeric, 4)              AS worst_return,
            1.0                                                          AS avg_duration_days,
            COUNT(*) FILTER (WHERE s.actual_market_return IS NOT NULL)  AS historical_transits,
            NOW()
        FROM km_rule_signals s
        JOIN km_astro_rule_master r ON r.id = s.rule_id
        WHERE r.rule_type IN %s
          AND s.actual_market_return IS NOT NULL
          AND s.date < CURRENT_DATE
        GROUP BY s.rule_id
        ON CONFLICT (rule_id) DO UPDATE SET
            total_occurrences    = EXCLUDED.total_occurrences,
            matched_count        = EXCLUDED.matched_count,
            confidence_score     = EXCLUDED.confidence_score,
            avg_return_all       = EXCLUDED.avg_return_all,
            avg_return_matched   = EXCLUDED.avg_return_matched,
            avg_return_unmatched = EXCLUDED.avg_return_unmatched,
            best_return          = EXCLUDED.best_return,
            worst_return         = EXCLUDED.worst_return,
            avg_duration_days    = EXCLUDED.avg_duration_days,
            historical_transits  = EXCLUDED.historical_transits,
            last_computed_at     = EXCLUDED.last_computed_at
    """, (DAILY_ONLY_RULE_TYPES,))
    upserted = cur.rowcount
    conn.commit()
    print(f"  km_rule_confidence rows upserted (daily signals): {upserted}")
    return upserted


# ── STEP 4: Compute yearly breakdown ─────────────────────────────────────────

def compute_yearly_breakdown(conn) -> int:
    """
    Populate km_rule_confidence_yearly from km_rule_transits (transit-based rules).
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
    print(f"  km_rule_confidence_yearly rows upserted (transits): {upserted}")
    return upserted


def compute_yearly_breakdown_from_signals(conn) -> int:
    """
    Populate km_rule_confidence_yearly from km_rule_signals for daily-only rules.
    Returns rows upserted.
    """
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO km_rule_confidence_yearly (
            rule_id, year, transits, matched, win_pct, avg_return, avg_duration
        )
        SELECT
            s.rule_id,
            EXTRACT(YEAR FROM s.date)::smallint                         AS year,
            COUNT(*) FILTER (WHERE s.actual_market_return IS NOT NULL)  AS transits,
            COUNT(*) FILTER (WHERE s.matched = TRUE)                    AS matched,
            ROUND(
                COUNT(*) FILTER (WHERE s.matched = TRUE)::numeric /
                NULLIF(COUNT(*) FILTER (WHERE s.matched IS NOT NULL), 0) * 100
            , 2)                                                         AS win_pct,
            ROUND(AVG(s.actual_market_return)::numeric, 4)              AS avg_return,
            1.0                                                          AS avg_duration
        FROM km_rule_signals s
        JOIN km_astro_rule_master r ON r.id = s.rule_id
        WHERE r.rule_type IN %s
          AND s.actual_market_return IS NOT NULL
          AND s.date < CURRENT_DATE
        GROUP BY s.rule_id, EXTRACT(YEAR FROM s.date)
        ON CONFLICT (rule_id, year) DO UPDATE SET
            transits     = EXCLUDED.transits,
            matched      = EXCLUDED.matched,
            win_pct      = EXCLUDED.win_pct,
            avg_return   = EXCLUDED.avg_return,
            avg_duration = EXCLUDED.avg_duration
    """, (DAILY_ONLY_RULE_TYPES,))
    upserted = cur.rowcount
    conn.commit()
    print(f"  km_rule_confidence_yearly rows upserted (daily signals): {upserted}")
    return upserted


# ── STEP 5: Print summary ─────────────────────────────────────────────────────

def print_summary(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT r.rule_code, r.rule_type, c.historical_transits, c.matched_count,
               c.confidence_score, c.avg_return_all, c.avg_duration_days
        FROM km_rule_confidence c
        JOIN km_astro_rule_master r ON c.rule_id = r.id
        WHERE c.historical_transits > 0
        ORDER BY c.confidence_score DESC
    """)
    rows = cur.fetchall()

    print(f"\n{'Rule Code':<30} {'Type':<16} {'Occs':>6} {'Match':>5} {'Win%':>6} {'AvgRet':>8} {'Days':>6}")
    print("-" * 82)
    for rule_code, rule_type, transits, matched, score, avg_ret, avg_dur in rows:
        score_str = f"{score:.1f}%" if score  is not None else "N/A"
        ret_str   = f"{avg_ret:+.2f}%" if avg_ret is not None else "N/A"
        dur_str   = f"{avg_dur:.1f}" if avg_dur is not None else "N/A"
        print(f"{rule_code:<30} {rule_type:<16} {(transits or 0):>6} {(matched or 0):>5} "
              f"{score_str:>6} {ret_str:>8} {dur_str:>6}")

    scores = [float(r[4]) for r in rows if r[4] is not None]
    if scores:
        print(f"\n── Overall stats ─────────────────────────────────────────────")
        print(f"  Rules scored:           {len(scores)}")
        print(f"  Rules win% > 70:        {sum(1 for s in scores if s >= 70)}")
        print(f"  Rules win% > 60:        {sum(1 for s in scores if s >= 60)}")
        print(f"  Rules win% < 40:        {sum(1 for s in scores if s < 40)}  ← potential inverse signals")
        print(f"  Average win%:           {sum(scores)/len(scores):.1f}%")

    # Partial-day summary
    cur.execute("""
        SELECT r.rule_type,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE s.partial_day = TRUE) AS partial
        FROM km_rule_signals s
        JOIN km_astro_rule_master r ON r.id = s.rule_id
        WHERE r.rule_type IN ('nakshatra_vara', 'tithi_alone')
        GROUP BY r.rule_type
    """)
    pd_rows = cur.fetchall()
    if pd_rows:
        print(f"\n── Partial-day signal breakdown ───────────────────────────────")
        for rt, total, partial in pd_rows:
            pct = partial / total * 100 if total else 0
            print(f"  {rt:<20}: {total:>6} total, {partial:>5} partial-day ({pct:.1f}%)")


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

    print("\n[3] Scoring km_rule_transits (transit-based rules)…")
    update_transit_returns(conn, close_map, rule_outcome_map)

    print("\n[3b] Setting partial_day flags on km_rule_signals…")
    populate_partial_day_flags(conn)

    print("\n[3c] Scoring km_rule_signals (daily-only rules)…")
    update_daily_signal_returns(conn, close_map, rule_outcome_map)

    print("\n[4] Computing km_rule_confidence (transit-based)…")
    compute_confidence_from_transits(conn)

    print("\n[4b] Computing km_rule_confidence (daily signals)…")
    compute_confidence_from_daily_signals(conn)

    print("\n[5] Computing yearly breakdown (transits)…")
    compute_yearly_breakdown(conn)

    print("\n[5b] Computing yearly breakdown (daily signals)…")
    compute_yearly_breakdown_from_signals(conn)

    print("\n[6] Summary:")
    print_summary(conn)

    conn.close()
    print(f"\nDone in {time.time() - start:.1f}s")


if __name__ == '__main__':
    main()
