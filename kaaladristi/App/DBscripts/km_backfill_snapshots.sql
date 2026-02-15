-- ============================================================================
-- bulk_generate_snapshots() — Set-based snapshot backfill (fast)
--
-- Unlike generate_daily_snapshots() which loops row-by-row (9 queries per day),
-- this function uses CTEs + JOINs to process entire date ranges in a single
-- SQL statement. Orders of magnitude faster for historical backfill.
--
-- Usage (run in Supabase SQL Editor):
--   -- Full backfill: 1990–2029, all symbols
--   SELECT * FROM bulk_generate_snapshots();
--
--   -- Single year
--   SELECT * FROM bulk_generate_snapshots('2025-01-01', '2025-12-31');
--
--   -- Single symbol
--   SELECT * FROM bulk_generate_snapshots('1990-01-01', '2029-12-31', ARRAY['NIFTY']);
--
-- Performance:
--   ~58,000 snapshots (40 years × 4 symbols) in a single SQL pass.
--   Expected time: 2–5 minutes depending on data volume.
--
-- NOTE: For Supabase SQL Editor, you may need to increase statement timeout:
--   SET statement_timeout = '600s';   -- 10 minutes
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_generate_snapshots(
  p_start   DATE DEFAULT '1990-01-01',
  p_end     DATE DEFAULT '2029-12-31',
  p_symbols TEXT[] DEFAULT ARRAY['NIFTY','BANKNIFTY','NIFTYIT','NIFTYFMCG']
)
RETURNS TABLE(total_generated BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count BIGINT;
  v_total_rules INTEGER;
  v_sectors JSONB;
BEGIN
  -- Pre-compute static values
  SELECT COUNT(*) INTO v_total_rules
  FROM km_rules WHERE active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'sector', ss.sector,
      'factor_type', ss.factor_type,
      'volatility_multiplier', ROUND((1.0 + ABS(COALESCE(ss.sensitivity_pct, 0)) / 100)::NUMERIC, 2),
      'direction', CASE WHEN ss.sensitivity_pct > 0 THEN 'bearish' ELSE 'bullish' END
    )
  ), '[]'::jsonb) INTO v_sectors
  FROM km_sector_sensitivity ss;

  RAISE NOTICE 'bulk_generate_snapshots: % to % for % symbols (total_rules=%)',
    p_start, p_end, array_length(p_symbols, 1), v_total_rules;

  -- ── Single-pass bulk INSERT ... SELECT with CTEs ──
  WITH
  -- Pre-aggregate planetary positions by date
  planets_agg AS (
    SELECT pp.date,
      jsonb_agg(
        jsonb_build_object(
          'planet', pp.planet,
          'longitude', pp.longitude,
          'speed', pp.speed,
          'retrograde', COALESCE(pp.retrograde, false),
          'sign', pp.sign_name,
          'nakshatra', pp.nakshatra_name,
          'nakshatra_pada', pp.nakshatra_pada,
          'combust', COALESCE(pp.combust, false)
        ) ORDER BY pp.planet
      ) AS json
    FROM km_planetary_positions pp
    WHERE pp.date BETWEEN p_start AND p_end
    GROUP BY pp.date
  ),

  -- Pre-aggregate aspects by date
  aspects_agg AS (
    SELECT a.date,
      jsonb_agg(
        jsonb_build_object(
          'planet_1', a.planet_1,
          'planet_2', a.planet_2,
          'aspect_type', a.aspect_type,
          'angle', a.angle,
          'orb', a.orb,
          'exact', COALESCE(a.exact, false)
        )
      ) AS json
    FROM km_planetary_aspects a
    WHERE a.date BETWEEN p_start AND p_end
    GROUP BY a.date
  ),

  -- Pre-aggregate events by date
  events_agg AS (
    SELECT e.event_date AS date,
      jsonb_agg(
        jsonb_build_object(
          'event_type', e.event_type,
          'planet', e.planet,
          'from_value', e.from_value,
          'to_value', e.to_value,
          'severity', e.severity
        )
      ) AS json
    FROM km_astro_events e
    WHERE e.event_date BETWEEN p_start AND p_end
    GROUP BY e.event_date
  ),

  -- Pre-aggregate signals by date (joined with rule metadata)
  signals_agg AS (
    SELECT rs.date,
      jsonb_build_object(
        'net_score', ROUND(COALESCE(SUM(
          CASE
            WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength
            WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength
            ELSE 0
          END
        ), 0)::NUMERIC, 1),
        'classification', CASE
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) > 3  THEN 'super_bullish'
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) > 0  THEN 'mildly_bullish'
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) < -3 THEN 'super_bearish'
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) < 0  THEN 'mildly_bearish'
          ELSE 'neutral'
        END,
        'fired_count', COUNT(rs.id),
        'total_rules', v_total_rules,
        'rules', COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'code', ru.code,
              'name', ru.name,
              'category', ru.category,
              'signal', rs.signal,
              'strength', rs.strength
            )
          ) FILTER (WHERE ru.id IS NOT NULL),
          '[]'::jsonb
        )
      ) AS json
    FROM km_rule_signals rs
    LEFT JOIN km_rules ru ON ru.id = rs.rule_id
    WHERE rs.date BETWEEN p_start AND p_end
    GROUP BY rs.date
  ),

  -- Pre-format panchang by date (1 row per date, no aggregation)
  panchang_fmt AS (
    SELECT p.date,
      jsonb_build_object(
        'tithi_num', p.tithi_num,
        'tithi_name', p.tithi_name,
        'paksha', p.paksha,
        'nakshatra_name', p.nakshatra_name,
        'nakshatra_pada', p.nakshatra_pada,
        'yoga_name', p.yoga_name,
        'karana_name', p.karana_name,
        'vara', p.vara,
        'dlnl_match', COALESCE(p.dlnl_match, false),
        'is_sankranti', COALESCE(p.is_sankranti, false),
        'is_purnima', COALESCE(p.is_purnima, false),
        'is_amavasya', COALESCE(p.is_amavasya, false),
        'is_ekadashi', COALESCE(p.is_ekadashi, false),
        'sunrise', p.sunrise_ist
      ) AS json
    FROM km_daily_panchang p
    WHERE p.date BETWEEN p_start AND p_end
  )

  -- ── MAIN INSERT ──
  INSERT INTO km_daily_snapshots (date, symbol, version, snapshot)
  SELECT
    r.date,
    r.symbol,
    1,
    jsonb_build_object(
      'date',         r.date,
      'symbol',       r.symbol,
      'version',      1,
      'generated_at', NOW()::TEXT,

      -- Risk
      'risk', jsonb_build_object(
        'composite_score', r.composite_score,
        'regime',       COALESCE(r.regime, _km_regime(r.composite_score)),
        'structural',   COALESCE(r.structural, 0),
        'momentum',     COALESCE(r.momentum, 0),
        'volatility',   COALESCE(r.volatility, 0),
        'deception',    COALESCE(r.deception, 0),
        'explanation',  COALESCE(r.explanation, 'Risk data for ' || r.date::TEXT)
      ),

      -- Panchang
      'panchang', pf.json,

      -- Planets
      'planets', COALESCE(pa.json, '[]'::jsonb),

      -- Aspects
      'aspects', COALESCE(aa.json, '[]'::jsonb),

      -- Events
      'events', COALESCE(ea.json, '[]'::jsonb),

      -- Signals
      'signals', COALESCE(sa.json, jsonb_build_object(
        'net_score', 0,
        'classification', 'neutral',
        'fired_count', 0,
        'total_rules', v_total_rules,
        'rules', '[]'::jsonb
      )),

      -- Sectors (static, same for all dates)
      'sectors', v_sectors,

      -- Outlook (next 7 days of risk scores) — correlated subquery
      'outlook', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'date',   ol.date,
            'score',  ol.composite_score,
            'regime', COALESCE(ol.regime, _km_regime(ol.composite_score))
          ) ORDER BY ol.date
        ), '[]'::jsonb)
        FROM km_risk_scores ol
        WHERE ol.symbol = r.symbol
          AND ol.date >= r.date
          AND ol.date <  r.date + 7
      ),

      -- Market (latest EOD on or before date) — LATERAL join
      'market', mkt.json
    )

  FROM km_risk_scores r

  -- Join pre-aggregated CTEs
  LEFT JOIN panchang_fmt pf ON pf.date = r.date
  LEFT JOIN planets_agg  pa ON pa.date = r.date
  LEFT JOIN aspects_agg  aa ON aa.date = r.date
  LEFT JOIN events_agg   ea ON ea.date = r.date
  LEFT JOIN signals_agg  sa ON sa.date = r.date

  -- Market: latest EOD on or before the date
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object(
      'trade_date',  m.trade_date,
      'close',       m.close,
      'prev_close',  m.prev_close,
      'change',      ROUND((m.close - COALESCE(m.prev_close, m.close))::NUMERIC, 2),
      'pct_change',  ROUND(COALESCE(m.pct_chng,
        CASE WHEN m.prev_close > 0
          THEN ((m.close - m.prev_close) / m.prev_close * 100)
          ELSE 0
        END)::NUMERIC, 2),
      'open',        m.open,
      'high',        m.high,
      'low',         m.low,
      'volume',      m.volume,
      'w52_high',    m.w52_high,
      'w52_low',     m.w52_low
    ) AS json
    FROM km_index_eod m
    WHERE m.index_id = (
      SELECT id FROM km_index_symbols
      WHERE name = _km_symbol_to_index_name(r.symbol)
      LIMIT 1
    )
    AND m.trade_date <= r.date
    ORDER BY m.trade_date DESC
    LIMIT 1
  ) mkt ON true

  WHERE r.date BETWEEN p_start AND p_end
    AND r.symbol = ANY(p_symbols)

  ON CONFLICT (date, symbol)
  DO UPDATE SET
    snapshot     = EXCLUDED.snapshot,
    generated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RAISE NOTICE 'bulk_generate_snapshots: % snapshots upserted', v_count;
  total_generated := v_count;
  RETURN NEXT;
END;
$$;


-- ============================================================================
-- BACKFILL RUNNER — Execute year-by-year to avoid statement timeouts
-- ============================================================================
-- If the full range times out, run these individually in Supabase SQL Editor.
-- Each year takes ~10–30 seconds depending on data density.
-- ============================================================================

-- ============================================================================
-- PREREQUISITE: Replicate risk scores to all symbols
-- ============================================================================
-- Risk scores are purely astronomical (retrogrades, aspects, moon nakshatra)
-- and identical for all NSE indices on the same date. NIFTY has full coverage;
-- copy to BANKNIFTY, NIFTYIT, NIFTYFMCG before generating snapshots.
-- ============================================================================

-- Step 0: Replicate NIFTY risk scores to other symbols
-- INSERT INTO km_risk_scores (date, symbol, composite_score, structural, momentum,
--                             volatility, deception, regime, explanation)
-- SELECT date, target.sym, composite_score, structural, momentum,
--        volatility, deception, regime, explanation
-- FROM km_risk_scores r
-- CROSS JOIN (VALUES ('BANKNIFTY'), ('NIFTYIT'), ('NIFTYFMCG')) AS target(sym)
-- WHERE r.symbol = 'NIFTY'
-- ON CONFLICT (date, symbol) DO NOTHING;

-- Step 1: Increase timeout for bulk operations
-- SET statement_timeout = '600s';

-- Step 2: Generate snapshots for all symbols
-- SELECT * FROM bulk_generate_snapshots();

-- Step 3: If timeout, run by decade:
-- SELECT * FROM bulk_generate_snapshots('1990-01-01', '1999-12-31');
-- SELECT * FROM bulk_generate_snapshots('2000-01-01', '2009-12-31');
-- SELECT * FROM bulk_generate_snapshots('2010-01-01', '2019-12-31');
-- SELECT * FROM bulk_generate_snapshots('2020-01-01', '2029-12-31');

-- Step 4: Verify coverage
-- SELECT symbol, COUNT(*) AS snapshots, MIN(date) AS earliest, MAX(date) AS latest
-- FROM km_daily_snapshots
-- GROUP BY symbol ORDER BY symbol;

-- Verify risk score coverage
-- SELECT symbol, COUNT(*) AS scores, MIN(date) AS earliest, MAX(date) AS latest
-- FROM km_risk_scores
-- GROUP BY symbol ORDER BY symbol;
