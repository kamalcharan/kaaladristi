-- Migration 117 · Add ema_20 and sma_50 to v_equity_eod_deduped
--
-- Both columns already exist in km_equity_eod (computed by compute_indicators_batch
-- via migration 042). This migration makes them accessible through the canonical
-- dedup view so breadth computation can use close > ema_20 and close > sma_50
-- per constituent without touching the raw equity table directly.
--
-- No data changes. No table changes. View redefinition only.
-- Target DB: kaala_dristi_db

CREATE OR REPLACE VIEW v_equity_eod_deduped AS
SELECT DISTINCT ON (COALESCE(s.isin, s.symbol || '_' || s.exchange), e.trade_date)
  COALESCE(s.isin, s.symbol || '_' || s.exchange) AS dedup_key,
  s.isin,
  e.equity_id,
  s.symbol,
  s.exchange,
  s.industry,
  s.company_name,
  s.is_fno,
  e.trade_date,
  e.open, e.high, e.low, e.close, e.prev_close, e.pct_chng, e.volume,
  e.rvol, e.tvol,
  e.rsi_14, e.mfi_14,
  e.rss_value, e.rss_spread,
  e.sma_150,
  e.ema_20, e.sma_50,
  e.sniper_inst, e.sniper_hot,
  e.flow_type, e.vacuum_flag, e.volume_divergence_flag,
  e.accum_distrib,
  e.magic_rs, e.magic_ma, e.magic_rs_zone
FROM km_equity_eod e
JOIN km_equity_symbols s ON s.id = e.equity_id
WHERE s.is_active = true
  AND s.industry IS NOT NULL
  AND s.industry != 'Shell Companies'
ORDER BY COALESCE(s.isin, s.symbol || '_' || s.exchange), e.trade_date,
         CASE s.exchange WHEN 'NSE' THEN 1 WHEN 'BSE' THEN 2 ELSE 3 END;

COMMENT ON VIEW v_equity_eod_deduped IS
  'One row per company (ISIN) per trade_date. NSE-preferred deduplication for dual-listed stocks. Includes ema_20 and sma_50 for per-index breadth computation (migration 117).';

GRANT SELECT ON v_equity_eod_deduped TO authenticated, anon, kd_app;

NOTIFY pgrst, 'reload schema';
