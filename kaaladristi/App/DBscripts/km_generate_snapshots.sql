-- ============================================================================
-- generate_daily_snapshots() — SQL-based snapshot generator
--
-- Assembles pre-computed JSON blobs from source tables directly in PostgreSQL.
-- No Python needed. Run from Supabase SQL Editor or schedule as a pg_cron job.
--
-- Usage:
--   SELECT generate_daily_snapshots();                          -- today + 6 days, all 4 symbols
--   SELECT generate_daily_snapshots('2026-02-01', '2026-02-28'); -- date range
--   SELECT generate_daily_snapshots('2026-02-15', '2026-02-15', ARRAY['NIFTY']); -- single
-- ============================================================================

-- Symbol-to-index-name mapping (must match km_index_symbols.name)
CREATE OR REPLACE FUNCTION _km_symbol_to_index_name(sym TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE sym
    WHEN 'NIFTY'      THEN 'NIFTY 50'
    WHEN 'BANKNIFTY'   THEN 'NIFTY BANK'
    WHEN 'NIFTYIT'     THEN 'NIFTY IT'
    WHEN 'NIFTYFMCG'   THEN 'NIFTY FMCG'
    WHEN 'NIFTYPHARMA' THEN 'NIFTY PHARMA'
    WHEN 'NIFTYMETAL'  THEN 'NIFTY METAL'
    WHEN 'NIFTYREALTY' THEN 'NIFTY REALTY'
    WHEN 'NIFTYAUTO'   THEN 'NIFTY AUTO'
    WHEN 'NIFTYENERGY' THEN 'NIFTY ENERGY'
    ELSE sym
  END;
$$;

-- Regime classifier (matches frontend getRegimeFromScore)
CREATE OR REPLACE FUNCTION _km_regime(score DOUBLE PRECISION)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN score IS NULL       THEN 'unknown'
    WHEN score >= 71         THEN 'capital_protection'
    WHEN score >= 51         THEN 'distribution'
    WHEN score >= 31         THEN 'expansion'
    ELSE 'accumulation'
  END;
$$;


-- ============================================================================
-- MAIN FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_daily_snapshots(
  p_start  DATE DEFAULT CURRENT_DATE,
  p_end    DATE DEFAULT CURRENT_DATE + INTERVAL '6 days',
  p_symbols TEXT[] DEFAULT ARRAY['NIFTY','BANKNIFTY','NIFTYIT','NIFTYFMCG']
)
RETURNS TABLE(generated_date DATE, generated_symbol TEXT, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS for writes
AS $$
DECLARE
  v_sym       TEXT;
  v_dt        DATE;
  v_idx_id    INTEGER;
  v_snapshot  JSONB;
  v_risk      JSONB;
  v_panchang  JSONB;
  v_planets   JSONB;
  v_aspects   JSONB;
  v_events    JSONB;
  v_signals   JSONB;
  v_sectors   JSONB;
  v_outlook   JSONB;
  v_market    JSONB;
  v_count     INTEGER := 0;
  v_score     DOUBLE PRECISION;
BEGIN
  FOREACH v_sym IN ARRAY p_symbols LOOP
    -- Resolve index_id from km_index_symbols
    SELECT id INTO v_idx_id
    FROM km_index_symbols
    WHERE name = _km_symbol_to_index_name(v_sym)
    LIMIT 1;

    v_dt := p_start;
    WHILE v_dt <= p_end LOOP

      -- ── 1. RISK ──
      SELECT jsonb_build_object(
        'composite_score', r.composite_score,
        'regime', COALESCE(r.regime, _km_regime(r.composite_score)),
        'structural', COALESCE(r.structural, 0),
        'momentum', COALESCE(r.momentum, 0),
        'volatility', COALESCE(r.volatility, 0),
        'deception', COALESCE(r.deception, 0),
        'explanation', COALESCE(r.explanation, 'Risk data for ' || v_dt::TEXT)
      ) INTO v_risk
      FROM km_risk_scores r
      WHERE r.date = v_dt AND r.symbol = v_sym;

      -- Get composite score for later use
      SELECT composite_score INTO v_score
      FROM km_risk_scores WHERE date = v_dt AND symbol = v_sym;

      -- ── 2. PANCHANG ──
      SELECT jsonb_build_object(
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
      ) INTO v_panchang
      FROM km_daily_panchang p
      WHERE p.date = v_dt;

      -- ── 3. PLANETS ──
      SELECT COALESCE(jsonb_agg(
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
      ), '[]'::jsonb) INTO v_planets
      FROM km_planetary_positions pp
      WHERE pp.date = v_dt;

      -- ── 4. ASPECTS ──
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'planet_1', a.planet_1,
          'planet_2', a.planet_2,
          'aspect_type', a.aspect_type,
          'angle', a.angle,
          'orb', a.orb,
          'exact', COALESCE(a.exact, false)
        )
      ), '[]'::jsonb) INTO v_aspects
      FROM km_planetary_aspects a
      WHERE a.date = v_dt;

      -- ── 5. EVENTS ──
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'event_type', e.event_type,
          'planet', e.planet,
          'from_value', e.from_value,
          'to_value', e.to_value,
          'severity', e.severity
        )
      ), '[]'::jsonb) INTO v_events
      FROM km_astro_events e
      WHERE e.event_date = v_dt;

      -- ── 6. SIGNALS (rules that fired) ──
      SELECT jsonb_build_object(
        'net_score', COALESCE(SUM(
          CASE
            WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength
            WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength
            ELSE 0
          END
        ), 0),
        'classification', CASE
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) > 3 THEN 'super_bullish'
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) > 0 THEN 'mildly_bullish'
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) < -3 THEN 'super_bearish'
          WHEN COALESCE(SUM(CASE WHEN rs.signal IN ('Bullish','Super Bullish') THEN rs.strength WHEN rs.signal IN ('Bearish','Super Bearish') THEN -rs.strength ELSE 0 END), 0) < 0 THEN 'mildly_bearish'
          ELSE 'neutral'
        END,
        'fired_count', COUNT(rs.id),
        'total_rules', (SELECT COUNT(*) FROM km_rules WHERE active = true),
        'rules', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'code', ru.code,
            'name', ru.name,
            'category', ru.category,
            'signal', rs2.signal,
            'strength', rs2.strength
          ))
          FROM km_rule_signals rs2
          JOIN km_rules ru ON ru.id = rs2.rule_id
          WHERE rs2.date = v_dt
        ), '[]'::jsonb)
      ) INTO v_signals
      FROM km_rule_signals rs
      WHERE rs.date = v_dt;

      -- ── 7. SECTORS ──
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'sector', ss.sector,
          'factor_type', ss.factor_type,
          'volatility_multiplier', ROUND((1.0 + ABS(COALESCE(ss.sensitivity_pct, 0)) / 100)::NUMERIC, 2),
          'direction', CASE WHEN ss.sensitivity_pct > 0 THEN 'bearish' ELSE 'bullish' END
        )
      ), '[]'::jsonb) INTO v_sectors
      FROM km_sector_sensitivity ss;

      -- ── 8. MARKET (latest EOD on or before date) ──
      IF v_idx_id IS NOT NULL THEN
        SELECT jsonb_build_object(
          'trade_date', m.trade_date,
          'close', m.close,
          'prev_close', m.prev_close,
          'change', ROUND((m.close - COALESCE(m.prev_close, m.close))::NUMERIC, 2),
          'pct_change', ROUND(COALESCE(m.pct_chng,
            CASE WHEN m.prev_close > 0
              THEN ((m.close - m.prev_close) / m.prev_close * 100)
              ELSE 0
            END)::NUMERIC, 2),
          'open', m.open,
          'high', m.high,
          'low', m.low,
          'volume', m.volume,
          'w52_high', m.w52_high,
          'w52_low', m.w52_low
        ) INTO v_market
        FROM km_index_eod m
        WHERE m.index_id = v_idx_id AND m.trade_date <= v_dt
        ORDER BY m.trade_date DESC
        LIMIT 1;
      END IF;

      -- ── 9. OUTLOOK (7-day risk scores) ──
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', ol.date,
          'score', ol.composite_score,
          'regime', COALESCE(ol.regime, _km_regime(ol.composite_score))
        ) ORDER BY ol.date
      ), '[]'::jsonb) INTO v_outlook
      FROM km_risk_scores ol
      WHERE ol.symbol = v_sym
        AND ol.date >= v_dt
        AND ol.date < v_dt + INTERVAL '7 days';

      -- ── ASSEMBLE SNAPSHOT ──
      v_snapshot := jsonb_build_object(
        'date', v_dt,
        'symbol', v_sym,
        'version', 1,
        'generated_at', NOW()::TEXT,
        'risk', v_risk,
        'panchang', v_panchang,
        'planets', v_planets,
        'aspects', v_aspects,
        'events', v_events,
        'signals', v_signals,
        'sectors', v_sectors,
        'outlook', v_outlook,
        'market', v_market
      );

      -- ── UPSERT ──
      INSERT INTO km_daily_snapshots (date, symbol, version, snapshot)
      VALUES (v_dt, v_sym, 1, v_snapshot)
      ON CONFLICT (date, symbol)
      DO UPDATE SET snapshot = EXCLUDED.snapshot, generated_at = NOW();

      v_count := v_count + 1;

      generated_date := v_dt;
      generated_symbol := v_sym;
      status := 'ok';
      RETURN NEXT;

      v_dt := v_dt + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Generated % snapshots', v_count;
END;
$$;


-- ============================================================================
-- DAILY RUN: Generate snapshots for today + 7-day outlook (use with pg_cron)
-- ============================================================================
-- SELECT * FROM generate_daily_snapshots();   -- today + 6 days, all 4 symbols

-- ============================================================================
-- HISTORICAL BACKFILL: Use bulk_generate_snapshots() from
-- km_backfill_snapshots.sql — set-based, orders of magnitude faster.
-- ============================================================================
-- SELECT * FROM bulk_generate_snapshots();                           -- full 1990–2029
-- SELECT * FROM bulk_generate_snapshots('2020-01-01','2025-12-31');  -- specific range

-- ============================================================================
-- VERIFICATION: Check generated snapshots
-- ============================================================================
-- SELECT symbol, COUNT(*) AS snapshots, MIN(date) AS earliest, MAX(date) AS latest
-- FROM km_daily_snapshots
-- GROUP BY symbol ORDER BY symbol;
