-- ============================================================================
-- km_migration_197_fpb_latest_alignment.sql
-- Target DB: kaala_dristi_db
--
-- One behavioural change: flower_pot_burst now resolves "latest session" the
-- same way every other arm does.
--
-- Fourteen arms use the `latest` CTE -- MAX(trade_date) WHERE ema_20 IS NOT
-- NULL -- which flips only once the indicator pass has committed. fpb_base
-- carried no such filter and took the raw max, so the two disagreed whenever a
-- refresh landed between "bars inserted" and "ema_20 written".
--
-- That happened on 2026-08-28. The refresh stamped 14 presets at 08-27 and
-- flower_pot_burst at 08-28. fetchScanReadyDate took MAX() across the matview,
-- got 08-28 from 91 FPB rows, and pinned every scanner to a session the other
-- fourteen had no rows for. The Golden Line tabs read km_equity_eod directly at
-- that date and returned nothing while 17 breakouts sat on 08-27.
--
-- The frontend was hardened separately (the ready date is now the matview's
-- MODE, which one arm out of fifteen cannot move). This removes the
-- disagreement at its source, so the two dates cannot diverge again.
--
-- Also bounds fpb_base at `latest`: its compression windows average rvol and
-- true range over 140 days, and a bar new enough to lack ema_20 generally
-- lacks a settled rvol too. Reading it was never right, only invisible.
--
-- Supersedes migration 195. Identical in every other respect -- the fifteen
-- arms, their filters, ranks and 81 columns are unchanged.
--
-- After COMMIT, repopulate (order matters -- see the tail of this file).
-- ============================================================================

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS km_scan_exclusion_counts CASCADE;
DROP MATERIALIZED VIEW IF EXISTS km_scan_results          CASCADE;

-- ============================================================================
-- km_scan_results
-- ============================================================================
CREATE MATERIALIZED VIEW km_scan_results AS
WITH
-- [F5] Latest indicator-complete trade date. Aligns with the frontend's
-- resolveConfirmedLatestDate (scanEngine.ts:126-147): the newest date with
-- any non-null ema_20. compute_all_pending_indicators writes ema_20 in one
-- transaction per date, so this flips atomically at commit — no row-count
-- threshold to trip on partial-exchange days.
latest AS (
  SELECT MAX(trade_date) AS trade_date
  FROM   km_equity_eod
  WHERE  ema_20 IS NOT NULL
),

-- Active universe (scanEngine.ts:169-175 — km_equity_symbols WHERE is_active).
active AS (
  SELECT id AS equity_id, symbol, company_name, industry, exchange, isin, mcap_cr
  FROM   km_equity_symbols
  WHERE  is_active = TRUE
),

-- Per-equity history, bounded to 45 calendar days (scanEngine.ts:162 eodCutoff),
-- newest-first rank. rn=1 is the latest bar. history[k] (JS) == rn (k+1).
-- prev_close = the older neighbour (JS bars[i+1]); LEAD over DESC order = older row.
eq_hist AS (
  SELECT
    e.equity_id,
    e.trade_date,
    e.open, e.high, e.low, e.close,
    e.value_cr, e.rvol, e.sniper_inst, e.magic_rs, e.magic_rs_zone,
    row_number() OVER (PARTITION BY e.equity_id ORDER BY e.trade_date DESC) AS rn,
    lead(e.close) OVER (PARTITION BY e.equity_id ORDER BY e.trade_date DESC) AS prev_close
  FROM km_equity_eod e
  JOIN active a USING (equity_id)
  WHERE e.trade_date <= (SELECT trade_date FROM latest)
    AND e.trade_date >  CURRENT_DATE - INTERVAL '45 days'
),

-- Per-bar DOT detection (hasDotInHistory, scanEngine.ts:519-558).
eq_hist_dots AS (
  SELECT
    equity_id, rn,
    (rn BETWEEN 1 AND 5 AND prev_close IS NOT NULL AND (high - low) > 0
      AND COALESCE(rvol,0) > 10
      AND close > (high + low) / 2.0
      AND prev_close > 0 AND close > prev_close * 1.02
      AND (abs(close - open) / (high - low)) >= 0.5
      AND close > open
    ) AS svd_hit,
    (rn BETWEEN 1 AND 5 AND prev_close IS NOT NULL AND (high - low) > 0
      AND COALESCE(rvol,0) >= 3 AND COALESCE(rvol,0) < 10
      AND close > open
      AND close > high - (high - low) / 3.0
      AND (abs(close - open) / (high - low)) >= 0.45
    ) AS sbd_hit,
    (rn BETWEEN 1 AND 5 AND prev_close IS NOT NULL AND (high - low) > 0
      AND close < prev_close
      AND COALESCE(rvol,0) >= 2
      AND close < low + (high - low) / 3.0
    ) AS syd_hit
  FROM eq_hist
),

-- Per-equity derivations aggregated from the bounded history.
eq_deriv AS (
  SELECT
    h.equity_id,
    count(*)                                             AS hist_len,
    avg(h.value_cr) FILTER (WHERE h.rn <= 5)            AS avg_val5,
    avg(h.value_cr) FILTER (WHERE h.rn <= 22)           AS avg_val22,
    max(h.magic_rs)      FILTER (WHERE h.rn = 10)       AS magic_rs_rn10,
    max(h.magic_rs_zone) FILTER (WHERE h.rn = 10)       AS zone_rn10,
    max(h.sniper_inst)   FILTER (WHERE h.rn = 5)        AS sniper_rn5,
    max(h.close) FILTER (WHERE h.rn = 6)                AS close_rn6,
    max(h.close) FILTER (WHERE h.rn = 23)               AS close_rn23,
    max(h.close) FILTER (WHERE h.rn = 67)               AS close_rn67,
    max(h.magic_rs) FILTER (WHERE h.rn = 1)             AS mrs1,
    max(h.magic_rs) FILTER (WHERE h.rn = 2)             AS mrs2,
    max(h.magic_rs) FILTER (WHERE h.rn = 3)             AS mrs3,
    max(h.magic_rs) FILTER (WHERE h.rn = 4)             AS mrs4,
    max(h.magic_rs) FILTER (WHERE h.rn = 5)             AS mrs5,
    max(h.magic_rs) FILTER (WHERE h.rn = 6)             AS mrs6
  FROM eq_hist h
  GROUP BY h.equity_id
),

eq_dots AS (
  SELECT
    equity_id,
    bool_or(svd_hit) AS has_recent_svd,
    bool_or(sbd_hit) AS has_recent_sbd,
    bool_or(syd_hit) AS has_recent_syd
  FROM eq_hist_dots
  GROUP BY equity_id
),

-- Latest equity_eod row (rn=1) + zone coercion + full-row ema_20 exclusion.
eq_base AS (
  SELECT
    e.*,
    (e.magic_rs_zone IS NOT NULL
       AND e.magic_rs_zone NOT IN
           ('Strong Bull','Mild Bull','Neutral','Mild Bear','Strong Bear')) AS zone_coerced,
    CASE WHEN e.magic_rs_zone IN
           ('Strong Bull','Mild Bull','Neutral','Mild Bear','Strong Bear')
         THEN e.magic_rs_zone ELSE NULL END                                  AS zone
  FROM km_equity_eod e
  WHERE e.trade_date = (SELECT trade_date FROM latest)
    AND e.ema_20 IS NOT NULL
),

-- Industry history, bounded to 20 calendar days (scanEngine.ts:163), newest-first.
ind_hist AS (
  SELECT
    industry, trade_date, industry_rank, pct_accumulation,
    row_number() OVER (PARTITION BY industry ORDER BY trade_date DESC) AS rn
  FROM km_industry_eod
  WHERE trade_date <= (SELECT trade_date FROM latest)
    AND trade_date >  CURRENT_DATE - INTERVAL '20 days'
),

ind_agg AS (
  SELECT
    industry,
    count(*)                                        AS ind_len,
    max(industry_rank)    FILTER (WHERE rn = 1)     AS rank1,
    max(pct_accumulation) FILTER (WHERE rn = 1)     AS pct_acc1,
    max(industry_rank)    FILTER (WHERE rn = 5)     AS rank5,
    max(pct_accumulation) FILTER (WHERE rn = 5)     AS pct_acc5,
    max(industry_rank)    FILTER (WHERE rn = 10)    AS rank10
  FROM ind_hist
  GROUP BY industry
),

-- Quartile cutoffs.
ind_meta AS (
  SELECT
    count(*)                                              AS total,
    ceil(count(*)::numeric / 4)::int                      AS top_cut,
    count(*) - ceil(count(*)::numeric / 4)::int           AS bot_cut
  FROM km_industry_eod
  WHERE trade_date = (SELECT trade_date FROM latest)
),

-- Industry classification.
ind_class AS (
  SELECT
    a.industry,
    a.rank1, a.pct_acc1, a.rank10,
    m.top_cut, m.bot_cut,
    (a.ind_len > 4 AND (a.rank5 - a.rank1) >= 5)             AS rotating_in,
    (a.ind_len > 4 AND (a.rank5 - a.rank1) <= -5)            AS rotating_out,
    (a.rank1 <= m.top_cut)                                   AS leading,
    (a.rank1 >  m.bot_cut)                                   AS lagging,
    (a.pct_acc1 - CASE WHEN a.ind_len > 4 THEN a.pct_acc5 ELSE 0 END) AS acc_change,
    CASE WHEN a.ind_len > 9 THEN (a.rank10 - a.rank1) ELSE 0 END      AS dist_rank_drop
  FROM ind_agg a
  CROSS JOIN ind_meta m
  WHERE a.industry IN (SELECT industry FROM km_industry_eod
                       WHERE trade_date = (SELECT trade_date FROM latest))
),

-- [F3] Smart Money industry gate — top-decile OR absolute.
-- Live JS at scanEngine.ts:982-991: rank the industries with any accumulation,
-- take the top MAX(5, CEIL(len/10)) plus anything > 55. The old absolute > 60
-- gate fired for 0-1 industries most days; this hybrid reliably surfaces the
-- strongest-accumulating corner without losing the absolute floor.
smart_money_industries AS (
  SELECT industry
  FROM (
    SELECT
      industry,
      pct_accumulation,
      row_number() OVER (ORDER BY pct_accumulation DESC NULLS LAST, industry) AS acc_rank,
      GREATEST(5, ceil(count(*) OVER () / 10.0))::int              AS decile_count
    FROM km_industry_eod
    WHERE trade_date = (SELECT trade_date FROM latest)
      AND COALESCE(pct_accumulation, 0) > 0
  ) r
  WHERE pct_accumulation > 55 OR acc_rank <= decile_count           -- MAGIC: 55, /10
),

-- NIFTY 50 / NIFTY 500 returns.
nifty AS (
  SELECT
    max(e.ret_5d)  FILTER (WHERE s.name = 'NIFTY 50')  AS n50_5d,
    max(e.ret_22d) FILTER (WHERE s.name = 'NIFTY 50')  AS n50_22d,
    max(e.ret_66d) FILTER (WHERE s.name = 'NIFTY 50')  AS n50_66d,
    max(e.ret_5d)  FILTER (WHERE s.name = 'NIFTY 500') AS n500_5d,
    max(e.ret_22d) FILTER (WHERE s.name = 'NIFTY 500') AS n500_22d,
    max(e.ret_66d) FILTER (WHERE s.name = 'NIFTY 500') AS n500_66d
  FROM km_index_eod e
  JOIN km_index_symbols s ON s.id = e.index_id
  WHERE s.name IN ('NIFTY 50','NIFTY 500')
    AND e.trade_date = (SELECT trade_date FROM latest)
),

-- ── Assembled per-stock row ─────────────────────────────────────────────────
stock AS (
  SELECT
    b.equity_id,
    b.trade_date,
    a.symbol, a.company_name, a.industry, a.exchange, a.isin, a.mcap_cr,
    b.close, b.pct_chng, b.magic_rs, b.zone AS magic_rs_zone, b.flow_type,
    b.rvol, b.sniper_inst, b.accum_distrib, b.rss_value, b.delivery_pct,
    b.delivery_surge_x, b.avg_amt_22d, b.sma_150, b.ema_20, b.atr_14, b.w52_high,
    b.volume_divergence_flag, b.pct_below_52w_high, b.value_cr,
    -- D1: columns the UI renders for every matview preset (see header)
    b.score_5d, b.score_22d, b.rsi_14, b.avg_amt_5d, b.supertrend_dir,
    -- Price-action columns (migrations 183/185/187). eq_base is SELECT e.*,
    -- so these were always present one CTE up -- only the projection was missing.
    b.prev_week_close, b.pct_wtd, b.prev_month_close, b.pct_mtd,
    b.breakout_level, b.pct_from_breakout, b.breakdown_level, b.pct_from_breakdown,
    b.zone_coerced,
    COALESCE(b.is_vani_s2,       FALSE) AS is_vani_s2,
    COALESCE(b.is_vani_distrib,  FALSE) AS is_vani_distrib,
    COALESCE(b.is_vani_weakness, FALSE) AS is_vani_weakness,
    COALESCE(b.is_vani_surge,    FALSE) AS is_vani_surge,
    COALESCE(b.is_vani_breakout, FALSE) AS is_vani_breakout,
    COALESCE(b.is_vani_smart,    FALSE) AS is_vani_smart,
    ((b.ema_20 + b.atr_14) - b.close)                                       AS reward,
    CASE WHEN b.atr_14 > 0 THEN ((b.ema_20 + b.atr_14) - b.close) / b.atr_14 END AS reward_pct,
    CASE WHEN d.avg_val22 > 0 AND d.avg_val5 IS NOT NULL
         THEN round(d.avg_val5 / d.avg_val22, 3) END                        AS xamt,
    CASE WHEN b.ret_5d  IS NOT NULL AND n.n50_5d   IS NOT NULL THEN round(b.ret_5d  - n.n50_5d,  2) END AS rel_5d_n50,
    CASE WHEN b.ret_22d IS NOT NULL AND n.n50_22d  IS NOT NULL THEN round(b.ret_22d - n.n50_22d, 2) END AS rel_22d_n50,
    CASE WHEN b.ret_66d IS NOT NULL AND n.n50_66d  IS NOT NULL THEN round(b.ret_66d - n.n50_66d, 2) END AS rel_66d_n50,
    CASE WHEN b.ret_5d  IS NOT NULL AND n.n500_5d  IS NOT NULL THEN round(b.ret_5d  - n.n500_5d, 2) END AS rel_5d_n500,
    CASE WHEN b.ret_22d IS NOT NULL AND n.n500_22d IS NOT NULL THEN round(b.ret_22d - n.n500_22d,2) END AS rel_22d_n500,
    CASE WHEN b.ret_66d IS NOT NULL AND n.n500_66d IS NOT NULL THEN round(b.ret_66d - n.n500_66d,2) END AS rel_66d_n500,
    COALESCE(dt.has_recent_svd, FALSE) AS has_recent_svd,
    COALESCE(dt.has_recent_sbd, FALSE) AS has_recent_sbd,
    COALESCE(dt.has_recent_syd, FALSE) AS has_recent_syd,
    (ARRAY[
       CASE WHEN d.mrs1 IS NOT NULL AND d.mrs2 IS NOT NULL THEN (d.mrs1 > d.mrs2)::int::smallint END,
       CASE WHEN d.mrs2 IS NOT NULL AND d.mrs3 IS NOT NULL THEN (d.mrs2 > d.mrs3)::int::smallint END,
       CASE WHEN d.mrs3 IS NOT NULL AND d.mrs4 IS NOT NULL THEN (d.mrs3 > d.mrs4)::int::smallint END,
       CASE WHEN d.mrs4 IS NOT NULL AND d.mrs5 IS NOT NULL THEN (d.mrs4 > d.mrs5)::int::smallint END,
       CASE WHEN d.mrs5 IS NOT NULL AND d.mrs6 IS NOT NULL THEN (d.mrs5 > d.mrs6)::int::smallint END
     ])[1:LEAST(d.hist_len,5)]                                              AS magic_rs_trend,
    b.ret_5d AS db_ret_5d, b.ret_22d AS db_ret_22d, b.ret_66d AS db_ret_66d,
    b.deliv_value_cr AS db_deliv_value_cr,
    CASE WHEN d.close_rn6  IS NOT NULL AND d.close_rn6  <> 0 THEN round((b.close - d.close_rn6)  / d.close_rn6  * 100, 2) END AS walk_ret_5d,
    CASE WHEN d.close_rn23 IS NOT NULL AND d.close_rn23 <> 0 THEN round((b.close - d.close_rn23) / d.close_rn23 * 100, 2) END AS walk_ret_22d,
    CASE WHEN d.close_rn67 IS NOT NULL AND d.close_rn67 <> 0 THEN round((b.close - d.close_rn67) / d.close_rn67 * 100, 2) END AS walk_ret_66d,
    CASE WHEN b.ema_20 <> 0 THEN round((b.close - b.ema_20) / b.ema_20 * 100, 2) END AS d_pct,
    round(COALESCE(b.value_cr,0) * (COALESCE(b.delivery_pct,0) / 100.0), 2)          AS conv_deliv_value_cr,
    (d.hist_len < 22)                                                       AS history_insufficient,
    d.hist_len, d.magic_rs_rn10, d.zone_rn10, d.sniper_rn5,
    ic.rotating_in, ic.rotating_out, ic.leading, ic.lagging,
    ic.pct_acc1 AS ind_pct_acc, ic.acc_change AS ind_acc_change,
    ic.dist_rank_drop AS ind_rank_drop
  FROM eq_base b
  JOIN active a       USING (equity_id)
  LEFT JOIN eq_deriv d USING (equity_id)
  LEFT JOIN eq_dots dt USING (equity_id)
  LEFT JOIN ind_class ic ON ic.industry = a.industry
  CROSS JOIN nifty n
),

-- ══ Preset 1: power_buy → Strength Confluence (scanEngine.ts:809-839) ═════════
power_buy AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.magic_rs,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND (s.rotating_in OR s.leading)
    AND (
      s.accum_distrib = 'ACCUMULATION'
      OR (s.sma_150 IS NOT NULL AND s.close > s.sma_150
          AND s.magic_rs_zone IN ('Strong Bull','Mild Bull')
          AND s.flow_type IN ('FRESH_LONGS','SHORT_COVERING')
          AND COALESCE(s.rvol,0) > 1.5)                                     -- MAGIC: 1.5
    )
),

-- ══ Preset 2: power_sell → Weakness Confluence (scanEngine.ts:847-876) ════════
power_sell AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.magic_rs,0) ASC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND (s.rotating_out OR s.lagging)
    AND (
      s.accum_distrib = 'DISTRIBUTION'
      OR (s.sma_150 IS NOT NULL AND s.close < s.sma_150
          AND s.magic_rs_zone IN ('Strong Bear','Mild Bear')
          AND s.flow_type IN ('FRESH_SHORTS','LONG_LIQUIDATION')
          AND COALESCE(s.rvol,0) > 1.5)                                     -- MAGIC: 1.5
    )
),

-- ══ Preset 3: smart_money → Smart Money Loading (scanEngine.ts:970-1011) ══════
-- [F3] Industry gate now sourced from smart_money_industries (top-decile OR > 55).
-- Stock filter unchanged: symbol starts with an uppercase letter (drops BSE
-- numeric scrip codes), delivery_pct > 60, rss_value > 0.
smart_money AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.delivery_pct,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND s.industry IN (SELECT industry FROM smart_money_industries)
    AND s.exchange = 'NSE'                                                  -- D2: kd_scan_presets.universe = NSE_ONLY
    AND s.symbol ~ '^[A-Z]'
    AND COALESCE(s.delivery_pct,0) > 60                                     -- MAGIC: 60
    AND COALESCE(s.rss_value,0) > 0
),

-- ══ Preset 4: quiet_accumulation → Quiet Accumulation (scanEngine.ts:1023-1060) ═
quiet_accumulation AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.ind_acc_change,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND s.exchange = 'NSE'                                                  -- D2: kd_scan_presets.universe = NSE_ONLY
    AND s.leading = FALSE
    AND COALESCE(s.ind_acc_change,0) > 0
    AND s.accum_distrib = 'ACCUMULATION'
    AND COALESCE(s.sniper_inst,0) > COALESCE(s.sniper_rn5,0)
),

-- ══ Preset 5: distribution_warning → Distribution Warnings (scanEngine.ts:1063-1109)
-- [F4] Current zone list widened to admit the two 7-band middle bands
-- (Neutral Bull / Neutral Bear). A stock decaying out of Strong Bull lands
-- there first, so the old 5-band-only list hid the scanner's most natural
-- candidates. See CLAUDE.md "MagicRS Zones — DB emits 7 bands".
distribution_warning AS (
  SELECT s.*,
    abs(COALESCE(s.ind_rank_drop,0))
      * abs(COALESCE(s.magic_rs,0) - COALESCE(s.magic_rs_rn10,0)) AS dist_score,
    row_number() OVER (
      ORDER BY abs(COALESCE(s.ind_rank_drop,0))
             * abs(COALESCE(s.magic_rs,0) - COALESCE(s.magic_rs_rn10,0)) DESC,
             s.equity_id) AS rnk
  FROM stock s
  WHERE s.magic_rs_zone IN ('Mild Bull','Neutral Bull','Neutral','Neutral Bear','Mild Bear')
    AND s.zone_rn10 = 'Strong Bull'
    AND (s.has_recent_syd OR s.volume_divergence_flag = 'VOLUME_DIV_DOWN')
),

-- ══ Preset 6: conviction_flow → Conviction Flow (scanEngine.ts:1112-1160) ═════
conviction_flow AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.delivery_surge_x,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.ema_20 > 0
    AND s.exchange = 'NSE'                                                  -- D2: kd_scan_presets.universe = NSE_ONLY
    AND s.hist_len >= 5                                                     -- MAGIC: 5
    AND s.d_pct BETWEEN -8 AND 8                                            -- MAGIC: ±8 band
    AND COALESCE(s.avg_amt_22d,0) > 1.5                                     -- MAGIC: 1.5
    AND COALESCE(s.delivery_surge_x,0) > 1.5                               -- MAGIC: 1.5
),

-- ══ Flower Pot Burst source (deep-history, NSE-only) ═════════════════════════
fpb_base AS (
  SELECT e.equity_id, e.trade_date, e.open, e.high, e.low, e.close, e.prev_close, e.volume,
         e.magic_rs, e.magic_rs_zone, e.stage, e.delivery_pct, e.rvol, e.pct_chng, e.avg_amt_22d,
         a.symbol, a.company_name, a.industry, a.exchange, a.isin, a.mcap_cr,
         GREATEST(e.high - e.low, abs(e.high - e.prev_close), abs(e.low - e.prev_close)) AS tr,
         (e.high - e.low) AS rng
  FROM km_equity_eod e
  JOIN active a USING (equity_id)
  WHERE a.exchange = 'NSE'
    AND e.trade_date > CURRENT_DATE - INTERVAL '140 days'
    -- Bounded at `latest` (migration 197). Without it the compression windows
    -- could average in a just-inserted bar whose rvol has not settled.
    AND e.trade_date <= (SELECT trade_date FROM latest)
),
fpb_w AS (
  SELECT b.*,
    avg(tr)     OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) AS atr15,
    avg(tr)     OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 59 PRECEDING AND CURRENT ROW) AS atr60,
    avg(volume) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 4  PRECEDING AND CURRENT ROW) AS vol5,
    avg(volume) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 21 PRECEDING AND CURRENT ROW) AS vol22,
    max(high)   OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 9  PRECEDING AND CURRENT ROW) AS hi10,
    min(low)    OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 9  PRECEDING AND CURRENT ROW) AS lo10,
    avg(rng)    OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 14 PRECEDING AND CURRENT ROW) AS avgrng15,
    lag(magic_rs,5) OVER (PARTITION BY equity_id ORDER BY trade_date) AS rs5,
    count(*)    OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 59 PRECEDING AND CURRENT ROW) AS nbars
  FROM fpb_base b
),
fpb_flag AS (
  SELECT w.*,
    CASE WHEN atr15/NULLIF(atr60,0) < 0.8
          AND (hi10 - lo10)/NULLIF(close,0) < 0.08
          AND vol5/NULLIF(vol22,0) < 0.6
          AND abs(magic_rs - rs5) < 2
          AND nbars >= 60 AND close > 20
          AND stage NOT IN ('S3','S4') THEN 1 ELSE 0 END AS compressed
  FROM fpb_w w
),
fpb_sig AS (
  SELECT f.*,
    max(compressed) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 9  PRECEDING AND CURRENT ROW) AS setup_recent10,
    max(compressed) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 22 PRECEDING AND 1 PRECEDING) AS setup_prior22,
    sum(compressed) OVER (PARTITION BY equity_id ORDER BY trade_date ROWS BETWEEN 21 PRECEDING AND CURRENT ROW) AS setup_days22,
    lag(hi10,1)     OVER (PARTITION BY equity_id ORDER BY trade_date) AS hi10_prior,
    lag(lo10,1)     OVER (PARTITION BY equity_id ORDER BY trade_date) AS lo10_prior,
    volume       / NULLIF(lag(vol22,1)    OVER (PARTITION BY equity_id ORDER BY trade_date), 0) AS vol_burst_raw,
    (high - low) / NULLIF(lag(avgrng15,1) OVER (PARTITION BY equity_id ORDER BY trade_date), 0) AS range_exp_raw,
    (close - low)/ NULLIF(high - low, 0) AS close_str_raw
  FROM fpb_flag f
),
fpb_scored AS (
  SELECT l.*,
    (setup_prior22 = 1
      AND vol_burst_raw >= 3 AND range_exp_raw >= 2 AND close_str_raw >= 0.7
      AND close > hi10_prior AND delivery_pct > 45) AS is_burst,
    (setup_prior22 = 1
      AND vol_burst_raw >= 3 AND range_exp_raw >= 2 AND close_str_raw <= 0.3
      AND close < lo10_prior AND delivery_pct > 45) AS is_shatter,
    atr15/NULLIF(atr60,0) AS atr_comp,
    vol5/NULLIF(vol22,0)  AS vol_death_x,
    (hi10 - lo10)/NULLIF(close,0) AS range_pct
  FROM fpb_sig l
  -- `latest`, not max(fpb_base) (migration 197): the raw max is what let this
  -- arm stamp a different session from the other fourteen.
  WHERE trade_date = (SELECT trade_date FROM latest)
),
fpb AS (
  SELECT
    equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
    close, pct_chng, magic_rs, magic_rs_zone, rvol, delivery_pct,
    is_burst,
    CASE WHEN is_burst THEN 'BURST' WHEN is_shatter THEN 'SHATTER' ELSE 'SETUP' END AS fpb_phase,
    round((GREATEST(0, 1 - atr_comp)
         + GREATEST(0, 1 - vol_death_x)
         + GREATEST(0, 1 - range_pct/0.08))::numeric, 2) AS fpb_compression_score,
    round(atr_comp::numeric, 2)   AS fpb_atr_compression,
    round(vol_death_x::numeric, 2) AS fpb_vol_death,
    setup_days22::int             AS fpb_setup_days,
    CASE WHEN is_burst OR is_shatter THEN round(vol_burst_raw::numeric, 1) END AS fpb_vol_burst,
    CASE WHEN is_burst OR is_shatter THEN round(range_exp_raw::numeric, 1) END AS fpb_range_exp,
    CASE WHEN is_burst OR is_shatter THEN round(close_str_raw::numeric, 2) END AS fpb_close_strength,
    CASE WHEN is_burst THEN
      round(((vol_burst_raw/3.0) * (range_exp_raw/2.0) * close_str_raw * (delivery_pct/50.0))::numeric, 2)
         WHEN is_shatter THEN
      round(((vol_burst_raw/3.0) * (range_exp_raw/2.0) * (1 - close_str_raw) * (delivery_pct/50.0))::numeric, 2)
    END AS fpb_quality,
    row_number() OVER (
      ORDER BY (is_burst OR is_shatter) DESC,
        round((GREATEST(0,1-atr_comp)+GREATEST(0,1-vol_death_x)+GREATEST(0,1-range_pct/0.08))::numeric,2) DESC,
        equity_id) AS rnk
  FROM fpb_scored
  WHERE (is_burst OR is_shatter OR setup_recent10 = 1)
),
-- ══ Waking Giants / First Ascent v3 — shared engine (POA: waking-giants-poa.md) ══
-- ONE CTE chain computes every gate with listing_age_years as a column; the
-- two preset blocks below band it. All constants NAMED here so calibration is
-- a one-line change + refresh. v3 deltas vs 175: flat arm capped to small/mid
-- caps, per-ISIN combined-exchange ADV, Stirring display cap.
wg_const AS (
  SELECT
    10   AS wg_min_years,           -- WG_MIN_LISTING_YEARS (owner: hardcoded, no dropdown)
    6    AS fa_min_years,           -- FA_MIN — First Ascent band floor
    200  AS min_mcap_cr,            -- audit par.6b
    1.0  AS min_adv_cr,             -- combined-exchange 22-session avg turnover, Cr
    -50  AS dormant_min_drawdown,   -- fell at least half from the 3-yr high (post-high trough)
    365  AS dormant_high_age_days,  -- and that peak is OLD — dormant, not a fresh crash
    -20  AS dormant_max_recovery,   -- still >= 20% below the high; beyond = already ran
    1.8  AS dormant_flat_ratio,     -- 3-yr high/low ratio: long-flat-range arm
    5000 AS flat_max_mcap_cr,       -- flat arm only below this — flat mega caps are mature, not forgotten
    55   AS gl_min_delivery_pct,    -- GL day: delivery-backed        (v1 estimate)
    2.0  AS gl_max_abs_pct_chng,    -- GL day: quiet, no fireworks    (v1 estimate)
    2.5  AS gl_max_rvol,            -- GL day: volume not explosive   (v1 estimate)
    12   AS waking_min_gl_days,     -- WAKING floor (of last 60 sessions)
    6    AS stirring_min_gl_days,   -- STIRRING floor
    10   AS stirring_display_cap    -- top-N STIRRING rows shown per band (WAKING uncapped)
),
-- Earliest listing evidence per ISIN: NSE migrants (SHIVALIK: NSE 2021, BSE
-- history to 2015, actually listed 1980s) must carry their real age.
wg_first AS (
  SELECT isin, MIN(evt) AS first_listed
  FROM (
    SELECT isin, listing_date AS evt
    FROM km_equity_symbols WHERE isin IS NOT NULL AND listing_date IS NOT NULL
    UNION ALL
    SELECT isin, first_trade_date
    FROM km_equity_symbols WHERE isin IS NOT NULL AND first_trade_date IS NOT NULL
  ) t
  GROUP BY isin
),
-- Layer 0.5: age + mcap + dormancy. Dormancy is a HISTORY read: fell hard
-- from an old peak and not yet fully recovered (deep arm, any size), OR went
-- nowhere for 3 years (flat arm — small/mid caps only; see header).
wg_pool AS (
  SELECT s.id AS equity_id,
         EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                 LEAST(COALESCE(f.first_listed, s.listing_date),
                       COALESCE(s.listing_date, f.first_listed))))::int AS listing_age_years,
         s.pct_from_3y_high, s.days_since_3y_high, s.drawdown_3y_pct,
         s.isin
  FROM km_equity_symbols s
  LEFT JOIN wg_first f ON f.isin = s.isin
  CROSS JOIN wg_const c
  WHERE s.is_active AND s.exchange = 'NSE'
    AND COALESCE(f.first_listed, s.listing_date) IS NOT NULL
    AND EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                LEAST(COALESCE(f.first_listed, s.listing_date),
                      COALESCE(s.listing_date, f.first_listed)))) >= c.fa_min_years
    AND s.mcap_cr >= c.min_mcap_cr
    AND s.pct_from_3y_high IS NOT NULL      -- compute_dormancy.py has run
    AND (   (s.drawdown_3y_pct <= c.dormant_min_drawdown
             AND s.days_since_3y_high >= c.dormant_high_age_days
             AND s.pct_from_3y_high <= c.dormant_max_recovery)
         OR (s.high_3y_adj / NULLIF(s.low_3y_adj, 0) <= c.dormant_flat_ratio
             AND s.mcap_cr <= c.flat_max_mcap_cr) )
),
-- Tradability = the COMPANY's turnover, not one order book: sum the trailing
-- 22-session avg value across every exchange row sharing the ISIN (SHIVALIK:
-- NSE 0.96 + BSE 0.09 = 1.05 Cr — passes; NSE-only failed by 4 lakh).
wg_adv AS (
  SELECT p.equity_id, SUM(x.adv_cr) AS adv_cr
  FROM wg_pool p
  JOIN km_equity_symbols tw
    ON (p.isin IS NOT NULL AND tw.isin = p.isin) OR tw.id = p.equity_id
  JOIN LATERAL (
    SELECT AVG(v.value_cr) AS adv_cr
    FROM (
      SELECT e.value_cr FROM km_equity_eod e
      WHERE e.equity_id = tw.id
        AND e.trade_date <= (SELECT trade_date FROM latest)
      ORDER BY e.trade_date DESC LIMIT 22
    ) v
  ) x ON TRUE
  GROUP BY p.equity_id
),
-- 130 calendar days covers the 60-session GL window + the 22-session RS lookback.
wg_hist AS (
  SELECT e.equity_id, e.delivery_pct, e.rvol, e.pct_chng, e.magic_rs, e.close,
         row_number() OVER (PARTITION BY e.equity_id ORDER BY e.trade_date DESC) AS rn
  FROM km_equity_eod e
  JOIN wg_pool p ON p.equity_id = e.equity_id
  WHERE e.trade_date <= (SELECT trade_date FROM latest)
    AND e.trade_date >  CURRENT_DATE - INTERVAL '130 days'
),
wg_metrics AS (
  SELECT h.equity_id,
    count(*) FILTER (WHERE h.rn <= 60
        AND COALESCE(h.delivery_pct, 0) >= (SELECT gl_min_delivery_pct FROM wg_const)
        AND abs(COALESCE(h.pct_chng, 0)) <= (SELECT gl_max_abs_pct_chng FROM wg_const)
        AND COALESCE(h.rvol, 1)          <= (SELECT gl_max_rvol         FROM wg_const)) AS gl_acc_days,
    max(h.magic_rs) FILTER (WHERE h.rn = 1)   AS mrs_now,
    max(h.magic_rs) FILTER (WHERE h.rn = 22)  AS mrs_22,
    max(h.close)    FILTER (WHERE h.rn = 1)   AS close_now,
    max(h.close)    FILTER (WHERE h.rn = 22)  AS close_22
  FROM wg_hist h
  GROUP BY h.equity_id
),
wg_scored AS (
  SELECT p.equity_id, p.listing_age_years, p.pct_from_3y_high, p.days_since_3y_high,
         p.drawdown_3y_pct,
         m.gl_acc_days::int AS gl_acc_days,
    CASE
      WHEN m.gl_acc_days >= (SELECT waking_min_gl_days FROM wg_const)
       AND m.mrs_now IS NOT NULL AND m.mrs_22 IS NOT NULL AND m.mrs_now > m.mrs_22
       AND abs(m.close_now / NULLIF(m.close_22, 0) - 1) < 0.10
        THEN 'WAKING'      -- Phase 2: RS pushing while price still flat
      WHEN m.gl_acc_days >= (SELECT stirring_min_gl_days FROM wg_const)
        THEN 'STIRRING'    -- Phase 1: quiet delivery-backed building
      ELSE 'DORMANT'       -- watchlist only — NOT emitted by the presets
    END AS wg_phase
  FROM wg_pool p
  JOIN wg_metrics m USING (equity_id)
  JOIN wg_adv a     USING (equity_id)
  WHERE a.adv_cr >= (SELECT min_adv_cr FROM wg_const)
),
-- The two age bands — EVIDENCE ONLY, with STIRRING choked to its strongest
-- top-N so WAKING stays the headline (owner 2026-08-24). JOIN stock reuses
-- the fully-assembled display row.
wg_giants AS (
  SELECT z.*,
         row_number() OVER (ORDER BY
           CASE z.wg_phase WHEN 'WAKING' THEN 0 ELSE 1 END,
           z.gl_acc_days DESC, z.equity_id) AS rnk
  FROM (
    SELECT s.*, g.listing_age_years, g.pct_from_3y_high, g.days_since_3y_high,
           g.drawdown_3y_pct, g.gl_acc_days, g.wg_phase,
           row_number() OVER (PARTITION BY g.wg_phase
                              ORDER BY g.gl_acc_days DESC, s.equity_id) AS phase_rnk
    FROM wg_scored g
    JOIN stock s USING (equity_id)
    WHERE g.wg_phase <> 'DORMANT'
      AND g.listing_age_years >= (SELECT wg_min_years FROM wg_const)
  ) z
  WHERE z.wg_phase = 'WAKING'
     OR z.phase_rnk <= (SELECT stirring_display_cap FROM wg_const)
),
wg_ascent AS (
  SELECT z.*,
         row_number() OVER (ORDER BY
           CASE z.wg_phase WHEN 'WAKING' THEN 0 ELSE 1 END,
           z.gl_acc_days DESC, z.equity_id) AS rnk
  FROM (
    SELECT s.*, g.listing_age_years, g.pct_from_3y_high, g.days_since_3y_high,
           g.drawdown_3y_pct, g.gl_acc_days, g.wg_phase,
           row_number() OVER (PARTITION BY g.wg_phase
                              ORDER BY g.gl_acc_days DESC, s.equity_id) AS phase_rnk
    FROM wg_scored g
    JOIN stock s USING (equity_id)
    WHERE g.wg_phase <> 'DORMANT'
      AND g.listing_age_years < (SELECT wg_min_years FROM wg_const)
  ) z
  WHERE z.wg_phase = 'WAKING'
     OR z.phase_rnk <= (SELECT stirring_display_cap FROM wg_const)
),

-- ══ Price-action presets (migration 195) ═════════════════════════════════════
-- All six share one gate: NSE (every one is universe='NSE_ONLY' in
-- kd_scan_presets), close >= 50, one row per ISIN. The frontend applied the
-- universe gate and the ISIN dedup in JS after fetching 2,000 rows; both move
-- into SQL here so the served row set is already the answer.
pa_pool AS (
  SELECT s.*,
         row_number() OVER (
           -- PARTITION BY treats NULLs as equal, so a bare `isin` would collapse
           -- every ISIN-less symbol into one partition and keep exactly one of
           -- them. Key those rows by equity_id instead so each stands alone.
           PARTITION BY COALESCE(s.isin, 'EQ:' || s.equity_id::text)
           ORDER BY (s.exchange = 'NSE') DESC, s.equity_id
         ) AS isin_rnk
  FROM stock s
  WHERE s.exchange = 'NSE'
    AND s.close >= 50
),
pa AS (SELECT * FROM pa_pool WHERE isin_rnk = 1),

-- ══ Preset 10: weekly_movers → Weekly Movers (scanEngine.ts fetchPeriodMovers)
weekly_movers AS (
  SELECT p.*, row_number() OVER (ORDER BY p.pct_wtd DESC, p.equity_id) AS rnk
  FROM pa p WHERE p.pct_wtd > 0
),

-- ══ Preset 11: monthly_movers → Monthly Movers ═══════════════════════════════
monthly_movers AS (
  SELECT p.*, row_number() OVER (ORDER BY p.pct_mtd DESC, p.equity_id) AS rnk
  FROM pa p WHERE p.pct_mtd > 0
),

-- ══ Preset 12: weekly_decliners → Weekly Decliners ═══════════════════════════
weekly_decliners AS (
  SELECT p.*, row_number() OVER (ORDER BY p.pct_wtd ASC, p.equity_id) AS rnk
  FROM pa p WHERE p.pct_wtd < 0
),

-- ══ Preset 13: monthly_decliners → Monthly Decliners ═════════════════════════
monthly_decliners AS (
  SELECT p.*, row_number() OVER (ORDER BY p.pct_mtd ASC, p.equity_id) AS rnk
  FROM pa p WHERE p.pct_mtd < 0
),

-- ══ Preset 14: breakout_surge → Breakout Surge ═══════════════════════════════
-- Adds pct_chng > 0 to the period gate: a breakout is cleared on an up day.
breakout_surge AS (
  SELECT p.*, row_number() OVER (ORDER BY p.pct_from_breakout DESC, p.equity_id) AS rnk
  FROM pa p WHERE p.pct_chng > 0 AND p.pct_from_breakout > 0
),

-- ══ Preset 15: breakdown_watch → Breakdown Surge ═════════════════════════════
-- Mirror image, and ranked ASC so the deepest breaks lead.
breakdown_watch AS (
  SELECT p.*, row_number() OVER (ORDER BY p.pct_from_breakdown ASC, p.equity_id) AS rnk
  FROM pa p WHERE p.pct_chng < 0 AND p.pct_from_breakdown < 0
)

-- ── UNION of the 15 pre-ranked, pre-limited preset blocks ───────────────────
-- (was 8; fresh_breakout retired — [F6].) Column order identical across all
-- blocks (required by UNION ALL). Same shape as migration 147.
SELECT 'power_buy'::text AS preset_id, rnk::int AS rank, is_vani_s2 AS vani_flag,
       'computeVaniOpportunity'::text AS vani_path, FALSE AS flow_guard_applied,
       zone_coerced, history_insufficient, NULL::text[] AS guard_notes,
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d AS ret_5d, db_ret_22d AS ret_22d, db_ret_66d AS ret_66d,
       NULL::numeric AS d_pct, db_deliv_value_cr AS deliv_value_cr, NULL::numeric AS score,
       NULL::text AS fpb_phase, NULL::numeric AS fpb_compression_score,
       NULL::numeric AS fpb_atr_compression, NULL::numeric AS fpb_vol_death,
       NULL::int AS fpb_setup_days, NULL::numeric AS fpb_vol_burst,
       NULL::numeric AS fpb_range_exp, NULL::numeric AS fpb_close_strength,
       NULL::numeric AS fpb_quality,
       NULL::int AS listing_age_years, NULL::numeric AS pct_from_3y_high,
       NULL::int AS days_since_3y_high, NULL::int AS gl_acc_days, NULL::text AS wg_phase,
       NULL::numeric AS drawdown_3y_pct,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM power_buy WHERE rnk <= 25

UNION ALL
SELECT 'power_sell', rnk::int, (is_vani_distrib OR is_vani_weakness),
       'computeVaniOpportunity', FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM power_sell WHERE rnk <= 25

UNION ALL
SELECT 'smart_money', rnk::int, is_vani_smart,
       'computeVaniOpportunity', FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM smart_money WHERE rnk <= 25

UNION ALL
SELECT 'quiet_accumulation', rnk::int, is_vani_s2,
       'computeVaniOpportunity', FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM quiet_accumulation WHERE rnk <= 25

UNION ALL
SELECT 'distribution_warning', rnk::int, (is_vani_distrib OR is_vani_weakness),
       'computeVaniOpportunity', FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, dist_score,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM distribution_warning WHERE rnk <= 25

UNION ALL
SELECT 'conviction_flow', rnk::int, (is_vani_surge OR is_vani_breakout),
       'computeVaniOpportunity', FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       walk_ret_5d AS ret_5d, walk_ret_22d AS ret_22d, walk_ret_66d AS ret_66d,
       d_pct, conv_deliv_value_cr AS deliv_value_cr, NULL::numeric AS score,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM conviction_flow WHERE rnk <= 50

UNION ALL
SELECT 'flower_pot_burst', rnk::int, is_burst AS vani_flag,
       'flowerPotBurst'::text AS vani_path, FALSE AS flow_guard_applied,
       FALSE AS zone_coerced, FALSE AS history_insufficient, NULL::text[] AS guard_notes,
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, NULL::text AS flow_type, rvol,
       NULL::numeric AS sniper_inst, NULL::text AS accum_distrib, NULL::numeric AS rss_value,
       delivery_pct, NULL::numeric AS delivery_surge_x, NULL::numeric AS avg_amt_22d,
       NULL::numeric AS sma_150, NULL::numeric AS ema_20, NULL::double precision AS atr_14,
       NULL::numeric AS w52_high, NULL::text AS volume_divergence_flag,
       NULL::numeric AS reward, NULL::numeric AS reward_pct, NULL::numeric AS pct_below_52w_high,
       NULL::numeric AS xamt,
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       FALSE, FALSE, FALSE, NULL::smallint[],
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       fpb_compression_score AS score,
       fpb_phase, fpb_compression_score, fpb_atr_compression, fpb_vol_death,
       fpb_setup_days, fpb_vol_burst, fpb_range_exp, fpb_close_strength, fpb_quality,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::smallint,
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
FROM fpb

UNION ALL
SELECT 'waking_giants', rnk::int, FALSE AS vani_flag,
       'none'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       listing_age_years, pct_from_3y_high, days_since_3y_high, gl_acc_days, wg_phase,
       drawdown_3y_pct,
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::smallint,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM wg_giants WHERE rnk <= 60

UNION ALL
SELECT 'first_ascent', rnk::int, FALSE,
       'none'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       listing_age_years, pct_from_3y_high, days_since_3y_high, gl_acc_days, wg_phase,
       drawdown_3y_pct,
       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::smallint,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM wg_ascent WHERE rnk <= 30

UNION ALL
SELECT 'weekly_movers', rnk::int, (is_vani_surge OR is_vani_breakout),
       'computeVaniOpportunity'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM weekly_movers WHERE rnk <= 500

UNION ALL
SELECT 'monthly_movers', rnk::int, (is_vani_surge OR is_vani_breakout),
       'computeVaniOpportunity'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM monthly_movers WHERE rnk <= 500

UNION ALL
SELECT 'weekly_decliners', rnk::int, is_vani_weakness,
       'computeVaniOpportunity'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM weekly_decliners WHERE rnk <= 500

UNION ALL
SELECT 'monthly_decliners', rnk::int, is_vani_weakness,
       'computeVaniOpportunity'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM monthly_decliners WHERE rnk <= 500

UNION ALL
SELECT 'breakout_surge', rnk::int, (is_vani_surge OR is_vani_breakout),
       'computeVaniOpportunity'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM breakout_surge WHERE rnk <= 500

UNION ALL
SELECT 'breakdown_watch', rnk::int, is_vani_weakness,
       'computeVaniOpportunity'::text, FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric,
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
       NULL::int, NULL::numeric, NULL::int, NULL::int, NULL::text,
       NULL::numeric,
       score_5d, score_22d, rsi_14, avg_amt_5d, supertrend_dir,
       prev_week_close, pct_wtd, prev_month_close, pct_mtd,
       breakout_level, pct_from_breakout, breakdown_level, pct_from_breakdown
FROM breakdown_watch WHERE rnk <= 500

WITH NO DATA;

CREATE UNIQUE INDEX ux_km_scan_results_pk   ON km_scan_results (preset_id, equity_id);
CREATE        INDEX ix_km_scan_results_rank ON km_scan_results (preset_id, rank);
CREATE        INDEX ix_km_scan_results_vani ON km_scan_results (vani_flag) WHERE vani_flag;

-- ============================================================================
-- km_scan_exclusion_counts — [F5] latest CTE aligned with ema_20 gate,
-- [F6] fresh_breakout removed from the preset enum.
-- ============================================================================
CREATE MATERIALIZED VIEW km_scan_exclusion_counts AS
WITH
latest AS (
  SELECT MAX(trade_date) AS trade_date
  FROM   km_equity_eod
  WHERE  ema_20 IS NOT NULL
),
hist_len AS (
  SELECT e.equity_id, count(*) AS n
  FROM km_equity_eod e
  JOIN km_equity_symbols a ON a.id = e.equity_id AND a.is_active
  WHERE e.trade_date <= (SELECT trade_date FROM latest)
    AND e.trade_date >  CURRENT_DATE - INTERVAL '45 days'
  GROUP BY e.equity_id
),
universe AS (
  SELECT a.id AS equity_id, e.ema_20, e.atr_14, COALESCE(h.n,0) AS hist_len
  FROM km_equity_symbols a
  JOIN km_equity_eod e ON e.equity_id = a.id AND e.trade_date = (SELECT trade_date FROM latest)
  LEFT JOIN hist_len h ON h.equity_id = a.id
  WHERE a.is_active
),
presets AS (
  SELECT unnest(ARRAY['power_buy','power_sell','smart_money',
                      'quiet_accumulation','distribution_warning','conviction_flow',
                      -- migration 195: the six price-action presets. These are the
                      -- ones where excluded_null_ema20 is a real number to watch --
                      -- they never had that gate as direct-query fetchers.
                      'weekly_movers','monthly_movers','weekly_decliners',
                      'monthly_decliners','breakout_surge','breakdown_watch']) AS preset_id
)
SELECT
  p.preset_id,
  (SELECT trade_date FROM latest)                                          AS trade_date,
  (SELECT count(*) FROM universe)                                          AS total_candidates,
  (SELECT count(*) FROM universe WHERE ema_20 IS NULL)                     AS excluded_null_ema20,
  (SELECT count(*) FROM universe WHERE ema_20 IS NOT NULL
                                   AND (atr_14 IS NULL OR atr_14 <= 0))     AS excluded_null_atr,
  (SELECT count(*) FROM universe WHERE hist_len < 5)                       AS excluded_insufficient_history,
  (SELECT count(*) FROM km_scan_results r WHERE r.preset_id = p.preset_id) AS included_count
FROM presets p
WITH NO DATA;

CREATE UNIQUE INDEX ux_km_scan_excl_pk ON km_scan_exclusion_counts (preset_id, trade_date);

-- ============================================================================
-- Grants — must match migration 147 (authenticated is the decisive role;
-- migration 151 additionally maintains the grant on refresh).
-- ============================================================================
GRANT SELECT ON km_scan_results          TO authenticated, anon, kd_app, admin, "user", kd_readonly;
GRANT SELECT ON km_scan_exclusion_counts TO authenticated, anon, kd_app, admin, "user", kd_readonly;

-- Migration 157 set the owner to kd_app so REFRESH runs from the pipeline; the
-- DROP + CREATE above resets ownership to the migration runner. Re-apply.
ALTER MATERIALIZED VIEW km_scan_results          OWNER TO kd_app;
ALTER MATERIALIZED VIEW km_scan_exclusion_counts OWNER TO kd_app;


-- ============================================================================
-- kd_scan_presets — deliberately NOT re-seeded here.
--
-- Migration 181 carried an INSERT ... ON CONFLICT (id) DO UPDATE SET
-- is_active = EXCLUDED.is_active for waking_giants and first_ascent. Migration
-- 190 exists solely because that block silently un-retired first_ascent for a
-- second time (177 retired it; 181's re-seed set is_active = TRUE again).
-- Copying it forward would undo 190 for a third time, so it is dropped.
--
-- Nothing here needs it: all six price-action presets already exist in
-- kd_scan_presets from migrations 184/186/188/189, and this migration changes
-- only where their rows are SERVED FROM, not what they are.
--
-- The first_ascent ARM below is left in the view on purpose — migration 190
-- says so explicitly: the tab is hidden by is_active, the arm costs ~11 rows a
-- night, and leaving it keeps the retirement reversible with a one-line UPDATE.
-- ============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Populate (run AFTER commit; order matters — results before exclusion counts,
-- since the latter's included_count SELECTs from km_scan_results):
--   REFRESH MATERIALIZED VIEW km_scan_results;
--   REFRESH MATERIALIZED VIEW km_scan_exclusion_counts;
-- After the initial populate, the nightly pipeline2 handle_scan_refresh path
-- uses CONCURRENTLY (unique indexes exist on both views).
--
-- Then run the completeness audit:
--   cd App/backend && python scripts/audit_scanner_contract.py
-- Every preset x every dimension must report OK.
--
-- Then sanity-check the two WG presets (expect single-digit-to-teens rows
-- per band, led by real fallen names — NOT index heavyweights):
--   SELECT preset_id, wg_phase, count(*),
--          string_agg(symbol, ', ' ORDER BY rank) FILTER (WHERE rank <= 10)
--   FROM km_scan_results WHERE preset_id IN ('waking_giants','first_ascent')
--   GROUP BY 1,2;
-- The 6 bundle presets + flower_pot_burst are byte-identical to migration
-- 170 apart from the appended NULL WG columns — no re-parity needed.
-- ============================================================================
