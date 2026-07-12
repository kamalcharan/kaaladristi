-- ============================================================================
-- km_migration_147_scan_results_matview.sql
-- ----------------------------------------------------------------------------
-- Materializes the 7 Path A / bundle scanners into `km_scan_results` so the
-- frontend reads one indexed table instead of client-computing over a large EOD
-- bundle. Companion `km_scan_exclusion_counts` records silently-dropped rows.
--
-- SCOPE — 7 in-scope (Path A, bundle) scanners ONLY:
--   power_buy, power_sell, smart_money, fresh_breakout,
--   quiet_accumulation, distribution_warning, conviction_flow
-- OUT OF SCOPE (Path B direct-query, MUST NOT regress — not touched here):
--   stage_2_leaders, stage_2_watch, breakout_surge, stage_4_leaders,
--   stage_3_watch, vani_opportunity, vani_exit_watch
--
-- Rule source of truth: App/frontend/src/services/scanEngine.ts (line #s cited
-- as SQL comments below). Working doc: SCAN_MATVIEW_IMPLEMENTATION.md.
-- PARITY DISCIPLINE: replicate current behaviour verbatim, including known
-- quirks. Flagged bugs are NOT silently fixed here.
--
-- Target DB: kaala_dristi_db.  Next free migration after 146.
-- Run in pgAdmin / DBeaver / psql.  DRAFT — parity-diff on a backup/staging
-- copy before running in production (see Phase 4 in the working doc).
--
-- ----------------------------------------------------------------------------
-- CORRECTIONS to the doc's Phase-1 rule inventory, found by reading the live
-- source + live DB while writing this migration (2026-07-11):
--
--   [C1] fresh_breakout's 20-day breakout compares against the max of the prior
--        20 *closes* (scanEngine.ts:920 `history.slice(1,21).map(h => h.close)`),
--        NOT prior highs. The doc said "max(high ...)". Ported as closes.
--
--   [C2] power_sell Path-2 (bearish confluence) ALSO requires `close < sma_150`
--        AND `rvol > 1.5` (scanEngine.ts:864-867). The doc listed only the zone
--        and flow conditions. Ported with all four.
--
--   [C3] smart_money's LIVE vani_rule is 'is_vani_smart' (kd_scan_presets, queried
--        via the read-only MCP connector), NOT NULL. The handover's "DEFINITIVE"
--        section claimed smart_money falls to evaluateOpportunity(bullish cfg).
--        It does not: getPresetMeta() reads kd_scan_presets first (scanEngine.ts:59)
--        and the live row has vani_rule='is_vani_smart'. CONSEQUENCE: ALL 7
--        in-scope presets run computeVaniOpportunity (flag-based). NONE use
--        evaluateOpportunity. Therefore:
--          * vani_path is 'computeVaniOpportunity' for all 7 (no evaluateOpportunity row).
--          * flow_guard_applied (the LOW_VOLUME bypass at scanEngine.ts:501-503)
--            is UNREACHABLE for all 7 in-scope scanners -> always FALSE here.
--          * The "77.4% LOW_VOLUME dominant guard" finding (Part 2) concerns
--            evaluateOpportunity and does NOT affect these 7 scanners' vani_flag.
--            LOW_VOLUME is just an ordinary flow_type value that fails the flow
--            gates in the scan filters.
--
-- vani_flag per preset (EXACT parity — matview reads the same is_vani_* columns
-- the bundle EOD SELECT reads at scanEngine.ts:198, so parity is by construction):
--   power_buy / fresh_breakout / quiet_accumulation -> is_vani_s2
--   power_sell / distribution_warning               -> is_vani_distrib OR is_vani_weakness
--   conviction_flow                                 -> is_vani_surge OR is_vani_breakout
--   smart_money                                     -> is_vani_smart
--
-- QUIRKS ported verbatim (see working doc §Quirks):
--   * zone coercion: a non-null magic_rs_zone that isn't one of the 5 canonical
--     Title-Case values is coerced to NULL (scanEngine.ts:603-605). On 2026-07-10
--     this hits `Neutral Bull`/`Neutral Bear` (~47% of the universe) — the pipeline
--     writes a 7-band scheme, the frontend VALID_ZONES knows 5. Coercion is a NO-OP
--     for scanner inclusion (Neutral Bull/Bear fail every zone gate anyway) but DOES
--     blank the stored display zone, so we coerce the display column too, to match.
--   * is_vani_distrib_and_weakness is an OR despite the name (scanEngine.ts:780-783).
--   * magic-number thresholds with no config row are ported as literals, each with
--     a `MAGIC:` note so a future config-table migration can find them.
--
-- HISTORY-WINDOW parity: the JS bundle bounds equity history to 45 calendar days
-- (scanEngine.ts:162) and industry history to 20 (scanEngine.ts:163). Those bounds
-- interact with `history.length > N` gates, so we mirror them with CURRENT_DATE
-- windows (evaluated at REFRESH time, matching the browser's Date.now()).
--
-- RANK / tie-order: JS sorts with `(b.x ?? 0) - (a.x ?? 0)` (V8 stable sort; nulls
-- treated as 0). We replicate with `ORDER BY COALESCE(sortkey,0) <dir>` and a
-- deterministic `equity_id` tiebreaker. The MEMBERSHIP set is identical; only the
-- rank order among *exact* ties may differ from JS's Map-insertion order (which is
-- not replicable and is semantically insignificant on a float sort key).
-- ============================================================================

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS km_scan_exclusion_counts CASCADE;
DROP MATERIALIZED VIEW IF EXISTS km_scan_results          CASCADE;

-- ============================================================================
-- km_scan_results
-- ============================================================================
CREATE MATERIALIZED VIEW km_scan_results AS
WITH
-- Latest fully-complete trade date: latest date with >= 4000 equity_eod rows.
-- Mirrors scanEngine.ts:180-189 (GROUP BY trade_date HAVING count() >= 4000).
latest AS (
  SELECT trade_date
  FROM   km_equity_eod
  GROUP  BY trade_date
  HAVING count(*) >= 4000
  ORDER  BY trade_date DESC
  LIMIT  1
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
-- Pairs are (bar=rn r, prev=rn r+1) for r in 1..5 -> only rn 1..5 with an older
-- neighbour are candidates. range<=0 skips the bar. rvol null -> 0.
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
    -- xAmt = avg(value_cr,5D) / avg(value_cr,22D)  (scanEngine.ts:622-627)
    avg(h.value_cr) FILTER (WHERE h.rn <= 5)            AS avg_val5,
    avg(h.value_cr) FILTER (WHERE h.rn <= 22)           AS avg_val22,
    -- fresh_breakout prior-20 high = max of prior 20 CLOSES, rn 2..21 [C1]
    max(h.close)      FILTER (WHERE h.rn BETWEEN 2 AND 21) AS high20,
    -- distribution_warning bar10 = rn 10 (scanEngine.ts:993)
    max(h.magic_rs)      FILTER (WHERE h.rn = 10)       AS magic_rs_rn10,
    max(h.magic_rs_zone) FILTER (WHERE h.rn = 10)       AS zone_rn10,
    -- quiet_accumulation sniper 5-back = rn 5 (scanEngine.ts:966)
    max(h.sniper_inst)   FILTER (WHERE h.rn = 5)        AS sniper_rn5,
    -- conviction_flow price-walk return anchors (scanEngine.ts:1042-1044)
    max(h.close) FILTER (WHERE h.rn = 6)                AS close_rn6,
    max(h.close) FILTER (WHERE h.rn = 23)               AS close_rn23,
    max(h.close) FILTER (WHERE h.rn = 67)               AS close_rn67,
    -- magic_rs by rn for the magicRsTrend display array (scanEngine.ts:616-620)
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
-- ema_20 IS NULL drops the row entirely (buildScanStock, scanEngine.ts:600).
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
    max(industry_rank)    FILTER (WHERE rn = 5)     AS rank5,   -- ~5 sessions ago
    max(pct_accumulation) FILTER (WHERE rn = 5)     AS pct_acc5,
    max(industry_rank)    FILTER (WHERE rn = 10)    AS rank10   -- ~10 sessions ago
  FROM ind_hist
  GROUP BY industry
),

-- Quartile cutoffs: total = # industries present on the latest date
-- (bundle.industries, scanEngine.ts:563-565). top = ceil(total/4).
ind_meta AS (
  SELECT
    count(*)                                              AS total,
    ceil(count(*)::numeric / 4)::int                      AS top_cut,
    count(*) - ceil(count(*)::numeric / 4)::int           AS bot_cut
  FROM km_industry_eod
  WHERE trade_date = (SELECT trade_date FROM latest)
),

-- Industry classification (getIndustryClassifications, scanEngine.ts:562-585).
-- rankChange = oldRow.rank(rn5) - current.rank(rn1), 0 if < 5 bars.
ind_class AS (
  SELECT
    a.industry,
    a.rank1, a.pct_acc1, a.rank10,
    m.top_cut, m.bot_cut,
    (a.ind_len > 4 AND (a.rank5 - a.rank1) >= 5)             AS rotating_in,   -- MAGIC: +5
    (a.ind_len > 4 AND (a.rank5 - a.rank1) <= -5)            AS rotating_out,  -- MAGIC: -5
    (a.rank1 <= m.top_cut)                                   AS leading,
    (a.rank1 >  m.bot_cut)                                   AS lagging,
    -- quiet_accumulation: accChange = pct_acc now - 5-back (0 if <5 bars) (scanEngine.ts:948-950)
    (a.pct_acc1 - CASE WHEN a.ind_len > 4 THEN a.pct_acc5 ELSE 0 END) AS acc_change,
    -- distribution rankDrop = rank(rn10) - rank(rn1), 0 if <10 bars (scanEngine.ts:1008-1009)
    CASE WHEN a.ind_len > 9 THEN (a.rank10 - a.rank1) ELSE 0 END      AS dist_rank_drop
  FROM ind_agg a
  CROSS JOIN ind_meta m
  WHERE a.industry IN (SELECT industry FROM km_industry_eod
                       WHERE trade_date = (SELECT trade_date FROM latest))
),

-- NIFTY 50 / NIFTY 500 returns for the latest date (rel_* fields, scanEngine.ts:637-645).
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

-- ── Assembled per-stock row: everything shared across presets ────────────────
-- One row per active equity that survived the ema_20 exclusion. Helper columns
-- (rotating_in, high20, dist_rank_drop, ...) drive the per-preset filters/sorts.
stock AS (
  SELECT
    b.equity_id,
    b.trade_date,
    a.symbol, a.company_name, a.industry, a.exchange, a.isin, a.mcap_cr,
    b.close, b.pct_chng, b.magic_rs, b.zone AS magic_rs_zone, b.flow_type,
    b.rvol, b.sniper_inst, b.accum_distrib, b.rss_value, b.delivery_pct,
    b.delivery_surge_x, b.avg_amt_22d, b.sma_150, b.ema_20, b.atr_14, b.w52_high,
    b.volume_divergence_flag, b.pct_below_52w_high, b.value_cr,
    b.zone_coerced,
    -- is_vani_* flags (read straight from km_equity_eod — same as EOD_COLS)
    COALESCE(b.is_vani_s2,       FALSE) AS is_vani_s2,
    COALESCE(b.is_vani_distrib,  FALSE) AS is_vani_distrib,
    COALESCE(b.is_vani_weakness, FALSE) AS is_vani_weakness,
    COALESCE(b.is_vani_surge,    FALSE) AS is_vani_surge,
    COALESCE(b.is_vani_breakout, FALSE) AS is_vani_breakout,
    COALESCE(b.is_vani_smart,    FALSE) AS is_vani_smart,
    -- reward / rewardPct (scanEngine.ts:612-613, unrounded)
    ((b.ema_20 + b.atr_14) - b.close)                                       AS reward,
    CASE WHEN b.atr_14 > 0 THEN ((b.ema_20 + b.atr_14) - b.close) / b.atr_14 END AS reward_pct,
    -- xAmt rounded 3dp (scanEngine.ts:701)
    CASE WHEN d.avg_val22 > 0 AND d.avg_val5 IS NOT NULL
         THEN round(d.avg_val5 / d.avg_val22, 3) END                        AS xamt,
    -- rel_* vs NIFTY 50 / 500, from DB ret columns, rounded 2dp (scanEngine.ts:702-707)
    CASE WHEN b.ret_5d  IS NOT NULL AND n.n50_5d   IS NOT NULL THEN round(b.ret_5d  - n.n50_5d,  2) END AS rel_5d_n50,
    CASE WHEN b.ret_22d IS NOT NULL AND n.n50_22d  IS NOT NULL THEN round(b.ret_22d - n.n50_22d, 2) END AS rel_22d_n50,
    CASE WHEN b.ret_66d IS NOT NULL AND n.n50_66d  IS NOT NULL THEN round(b.ret_66d - n.n50_66d, 2) END AS rel_66d_n50,
    CASE WHEN b.ret_5d  IS NOT NULL AND n.n500_5d  IS NOT NULL THEN round(b.ret_5d  - n.n500_5d, 2) END AS rel_5d_n500,
    CASE WHEN b.ret_22d IS NOT NULL AND n.n500_22d IS NOT NULL THEN round(b.ret_22d - n.n500_22d,2) END AS rel_22d_n500,
    CASE WHEN b.ret_66d IS NOT NULL AND n.n500_66d IS NOT NULL THEN round(b.ret_66d - n.n500_66d,2) END AS rel_66d_n500,
    -- dots
    COALESCE(dt.has_recent_svd, FALSE) AS has_recent_svd,
    COALESCE(dt.has_recent_sbd, FALSE) AS has_recent_sbd,
    COALESCE(dt.has_recent_syd, FALSE) AS has_recent_syd,
    -- magicRsTrend: 5 bool comparisons, trimmed to available history (display only)
    (ARRAY[
       CASE WHEN d.mrs1 IS NOT NULL AND d.mrs2 IS NOT NULL THEN (d.mrs1 > d.mrs2)::int::smallint END,
       CASE WHEN d.mrs2 IS NOT NULL AND d.mrs3 IS NOT NULL THEN (d.mrs2 > d.mrs3)::int::smallint END,
       CASE WHEN d.mrs3 IS NOT NULL AND d.mrs4 IS NOT NULL THEN (d.mrs3 > d.mrs4)::int::smallint END,
       CASE WHEN d.mrs4 IS NOT NULL AND d.mrs5 IS NOT NULL THEN (d.mrs4 > d.mrs5)::int::smallint END,
       CASE WHEN d.mrs5 IS NOT NULL AND d.mrs6 IS NOT NULL THEN (d.mrs5 > d.mrs6)::int::smallint END
     ])[1:LEAST(d.hist_len,5)]                                              AS magic_rs_trend,
    -- DB returns (used by the 6 non-conviction presets)
    b.ret_5d AS db_ret_5d, b.ret_22d AS db_ret_22d, b.ret_66d AS db_ret_66d,
    b.deliv_value_cr AS db_deliv_value_cr,
    -- conviction_flow price-walk returns (scanEngine.ts:1042-1044, rounded 2dp)
    CASE WHEN d.close_rn6  IS NOT NULL AND d.close_rn6  <> 0 THEN round((b.close - d.close_rn6)  / d.close_rn6  * 100, 2) END AS walk_ret_5d,
    CASE WHEN d.close_rn23 IS NOT NULL AND d.close_rn23 <> 0 THEN round((b.close - d.close_rn23) / d.close_rn23 * 100, 2) END AS walk_ret_22d,
    CASE WHEN d.close_rn67 IS NOT NULL AND d.close_rn67 <> 0 THEN round((b.close - d.close_rn67) / d.close_rn67 * 100, 2) END AS walk_ret_66d,
    -- conviction_flow d_pct + deliv_value_cr (scanEngine.ts:1031, 1049-1050)
    CASE WHEN b.ema_20 <> 0 THEN round((b.close - b.ema_20) / b.ema_20 * 100, 2) END AS d_pct,
    round(COALESCE(b.value_cr,0) * (COALESCE(b.delivery_pct,0) / 100.0), 2)          AS conv_deliv_value_cr,
    -- history-window provenance (see audit column notes)
    (d.hist_len < 22)                                                       AS history_insufficient,
    -- helper columns
    d.hist_len, d.high20, d.magic_rs_rn10, d.zone_rn10, d.sniper_rn5,
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
-- E: industry in (rotatingIn ∪ leading). F: ACCUMULATION  OR  (close>sma_150 ∧
-- zone∈{Strong Bull,Mild Bull} ∧ flow∈{FRESH_LONGS,SHORT_COVERING} ∧ rvol>1.5).
-- S: magic_rs DESC. L: 25.
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
-- E: industry in (rotatingOut ∪ lagging). F: DISTRIBUTION  OR  (close<sma_150 ∧
-- zone∈{Strong Bear,Mild Bear} ∧ flow∈{FRESH_SHORTS,LONG_LIQUIDATION} ∧ rvol>1.5). [C2]
-- S: magic_rs ASC. L: 25.
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

-- ══ Preset 3: smart_money → Smart Money Loading (scanEngine.ts:879-905) ═══════
-- E: industry pct_accumulation > 60. F: symbol ~ ^[A-Z] ∧ delivery_pct>60 ∧ rss_value>0.
-- S: delivery_pct DESC. L: 25.
smart_money AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.delivery_pct,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND s.symbol ~ '^[A-Z]'
    AND COALESCE(s.ind_pct_acc,0) > 60                                      -- MAGIC: 60
    AND COALESCE(s.delivery_pct,0) > 60                                     -- MAGIC: 60
    AND COALESCE(s.rss_value,0) > 0
),

-- ══ Preset 4: fresh_breakout → Fresh Breakouts (scanEngine.ts:908-936) ════════
-- E: industry in leading. F: rvol>2 ∧ close>max(prior-20 closes) ∧ close>sma_150
--   (sma_150 gate skipped when sma_150 is NULL/0 — JS truthiness). [C1]
-- S: rvol DESC. L: 25.
fresh_breakout AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.rvol,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND s.leading
    AND COALESCE(s.rvol,0) > 2                                              -- MAGIC: 2
    AND s.high20 IS NOT NULL AND s.close > s.high20                         -- prior 20-day high (closes)
    AND (s.sma_150 IS NULL OR s.sma_150 = 0 OR s.close > s.sma_150)
),

-- ══ Preset 5: quiet_accumulation → Quiet Accumulation (scanEngine.ts:939-976) ═
-- E: industry NOT in top quartile (rank1 > top_cut) ∧ acc_change>0.
-- F: accum_distrib='ACCUMULATION' ∧ sniper_inst(now) > sniper_inst(5-back).
-- S: acc_change (industry) DESC. L: 25.
quiet_accumulation AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.ind_acc_change,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND s.leading = FALSE            -- rank1 > top_cut  ==  NOT leading
    AND COALESCE(s.ind_acc_change,0) > 0
    AND s.accum_distrib = 'ACCUMULATION'
    AND COALESCE(s.sniper_inst,0) > COALESCE(s.sniper_rn5,0)
),

-- ══ Preset 6: distribution_warning → Distribution Warnings (scanEngine.ts:979-1018)
-- E: none beyond per-stock. F: zone∈{Mild Bull,Neutral,Mild Bear} ∧ zone(rn10)='Strong Bull'
--   ∧ (has_recent_syd ∨ volume_divergence_flag='VOLUME_DIV_DOWN').
-- Score = |rankDrop(rn10-rn1)| × |magic_rs - magic_rs(rn10)|. S: score DESC. L: 25.
-- NOTE: no industry-null filter — null-industry stocks are allowed with score 0.
distribution_warning AS (
  SELECT s.*,
    abs(COALESCE(s.ind_rank_drop,0))
      * abs(COALESCE(s.magic_rs,0) - COALESCE(s.magic_rs_rn10,0)) AS dist_score,
    row_number() OVER (
      ORDER BY abs(COALESCE(s.ind_rank_drop,0))
             * abs(COALESCE(s.magic_rs,0) - COALESCE(s.magic_rs_rn10,0)) DESC,
             s.equity_id) AS rnk
  FROM stock s
  WHERE s.magic_rs_zone IN ('Mild Bull','Neutral','Mild Bear')
    AND s.zone_rn10 = 'Strong Bull'
    AND (s.has_recent_syd OR s.volume_divergence_flag = 'VOLUME_DIV_DOWN')
),

-- ══ Preset 7: conviction_flow → Conviction Flow (scanEngine.ts:1021-1060) ═════
-- E: ema_20>0 ∧ hist_len>=5. F: d_pct∈[-8,8] ∧ avg_amt_22d>1.5 ∧ delivery_surge_x>1.5.
-- ret_5d/22d/66d are PRICE-WALK values here (not DB columns). deliv_value_cr recomputed.
-- S: delivery_surge_x DESC. L: 50.
conviction_flow AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.delivery_surge_x,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.ema_20 > 0
    AND s.hist_len >= 5                                                     -- MAGIC: 5
    AND s.d_pct BETWEEN -8 AND 8                                            -- MAGIC: ±8 band
    AND COALESCE(s.avg_amt_22d,0) > 1.5                                     -- MAGIC: 1.5
    AND COALESCE(s.delivery_surge_x,0) > 1.5                               -- MAGIC: 1.5
)

-- ── UNION of the 7 pre-ranked, pre-limited preset blocks ────────────────────
-- Column order is identical across all blocks (required by UNION ALL).
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
       NULL::numeric AS d_pct, db_deliv_value_cr AS deliv_value_cr, NULL::numeric AS score
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
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric
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
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric
FROM smart_money WHERE rnk <= 25

UNION ALL
SELECT 'fresh_breakout', rnk::int, is_vani_s2,
       'computeVaniOpportunity', FALSE, zone_coerced, history_insufficient, NULL::text[],
       equity_id, trade_date, symbol, company_name, industry, exchange, isin, mcap_cr,
       close, pct_chng, magic_rs, magic_rs_zone, flow_type, rvol, sniper_inst,
       accum_distrib, rss_value, delivery_pct, delivery_surge_x, avg_amt_22d,
       sma_150, ema_20, atr_14, w52_high, volume_divergence_flag, reward, reward_pct,
       pct_below_52w_high, xamt, rel_5d_n50, rel_22d_n50, rel_66d_n50,
       rel_5d_n500, rel_22d_n500, rel_66d_n500, has_recent_svd, has_recent_sbd,
       has_recent_syd, magic_rs_trend,
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric
FROM fresh_breakout WHERE rnk <= 25

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
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, NULL::numeric
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
       db_ret_5d, db_ret_22d, db_ret_66d, NULL::numeric, db_deliv_value_cr, dist_score
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
       d_pct, conv_deliv_value_cr AS deliv_value_cr, NULL::numeric AS score
FROM conviction_flow WHERE rnk <= 50

WITH NO DATA;

-- CONCURRENTLY refresh requires a UNIQUE index; a stock never appears twice in one preset.
CREATE UNIQUE INDEX ux_km_scan_results_pk   ON km_scan_results (preset_id, equity_id);
CREATE        INDEX ix_km_scan_results_rank ON km_scan_results (preset_id, rank);
CREATE        INDEX ix_km_scan_results_vani ON km_scan_results (vani_flag) WHERE vani_flag;

-- ============================================================================
-- km_scan_exclusion_counts — per-(preset,date) silently-dropped aggregate.
-- Answers "how much of the universe did we drop today, and why". total_candidates
-- and the excluded_* counts are UNIVERSE-WIDE (identical across presets — the
-- in-scope scanners share the same ema_20 pre-guard); only included_count varies.
-- REFRESH ORDER: refresh km_scan_results FIRST (included_count reads it).
-- ============================================================================
CREATE MATERIALIZED VIEW km_scan_exclusion_counts AS
WITH
latest AS (
  SELECT trade_date FROM km_equity_eod
  GROUP BY trade_date HAVING count(*) >= 4000
  ORDER BY trade_date DESC LIMIT 1
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
  SELECT unnest(ARRAY['power_buy','power_sell','smart_money','fresh_breakout',
                      'quiet_accumulation','distribution_warning','conviction_flow']) AS preset_id
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
-- Grants — logged-in browser users run PostgREST as DB role `authenticated`
-- (migration 142 lesson); the `authenticated` grant is the decisive one.
-- ============================================================================
GRANT SELECT ON km_scan_results          TO authenticated, anon, kd_app, admin, "user", kd_readonly;
GRANT SELECT ON km_scan_exclusion_counts TO authenticated, anon, kd_app, admin, "user", kd_readonly;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Populate (run AFTER commit; order matters — results before exclusion counts):
--   REFRESH MATERIALIZED VIEW km_scan_results;
--   REFRESH MATERIALIZED VIEW km_scan_exclusion_counts;
-- Subsequent nightly refreshes can use CONCURRENTLY (unique indexes exist):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY km_scan_results;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY km_scan_exclusion_counts;
-- ============================================================================
