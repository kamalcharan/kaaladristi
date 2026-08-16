-- ============================================================================
-- km_migration_170_scan_matview_refresh_logic.sql
-- ----------------------------------------------------------------------------
-- Rebuilds km_scan_results / km_scan_exclusion_counts so the matview matches
-- the scanners the app actually runs today. Supersedes the DEFINITION in
-- migration 147 (and folds in 151 + 157 — see the note above COMMIT).
--
-- Materialized views cannot be ALTERed, so this DROPs and re-CREATEs both.
-- Everything below is migration 147's definition with four changes; the
-- C1/C2/C3 corrections and the ported quirks from 147 are preserved verbatim
-- and its header comments are still the reference for those.
--
-- WHY: the 2026-08-15 re-verification (docs/claude/scan-matview-audit-2026-08-15.md,
-- harness in scripts/qa/scan-parity/) ran the live scanEngine.ts against this
-- matview on 2026-08-14 data. power_buy and power_sell matched exactly;
-- conviction_flow and quiet_accumulation matched on membership (their only
-- differences were exact-tie orderings, where this matview's equity_id
-- tiebreak is the more deterministic of the two). Two presets had drifted:
--
--   [F3] smart_money — the app reworked the industry gate on 2026-07-19 from
--        an absolute `pct_accumulation > 60` to `> 55 OR top-decile`, because
--        the absolute bar fires for 0-1 industries on a typical day. The
--        matview kept the old gate and has returned ZERO rows on every refresh
--        since deployment. The July parity check recorded "js=0 sql=0" — two
--        empty sets agreeing, which is not the same as parity.
--
--   [F4] distribution_warning — the app moved to the 7-band magic_rs_zone
--        scheme on 2026-07-13. This matview coerced any zone outside the old
--        5-band list to NULL, so `Neutral Bull` / `Neutral Bear` (~47% of the
--        universe, and where a stock decaying out of Strong Bull lands FIRST)
--        were erased before the preset filter ever saw them: 17 of 25 rows
--        differed from the app. BOTH the coercion in eq_base AND the preset's
--        IN-list are widened here; changing either alone is a no-op.
--
-- Two smaller fixes ride along:
--
--   [F5] the `latest` CTE picked the newest date with >= 4000 equity_eod rows.
--        That is the row-count resolver the frontend abandoned after the
--        mid-pipeline blackout bug, and it is exchange-blind: on 2026-08-14,
--        when NSE's bhav published late, BSE alone cleared 4,000 rows. Now
--        gated on ema_20 IS NOT NULL, mirroring resolveConfirmedLatestDate.
--
--   [F6] fresh_breakout — retired in the app 2026-07-13 and deactivated in
--        kd_scan_presets by migration 152, but still materialised 25 dead rows
--        every refresh. Removed.
--
-- NOT CHANGED: flower_pot_burst (live, and the one preset the frontend already
-- reads from this matview), and the two client-side data-visibility caps the
-- audit found (8,000-symbol / 1,000-industry-row) — those are frontend fixes.
--
-- AFTER APPLYING: re-run the parity harness (both modes) before repointing any
-- scanner at this matview:
--   cd scripts/qa/scan-parity && node build.mjs && node run-parity.mjs
--
-- Target database: kaala_dristi_db (PostgreSQL 17+).
-- Run in pgAdmin / DBeaver / psql as the current owner or a superuser.
-- ============================================================================

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS km_scan_exclusion_counts CASCADE;
DROP MATERIALIZED VIEW IF EXISTS km_scan_results          CASCADE;

-- ============================================================================
-- km_scan_results
-- ============================================================================
CREATE MATERIALIZED VIEW km_scan_results AS
WITH
-- Latest INDICATOR-COMPLETE trade date. Mirrors resolveConfirmedLatestDate
-- (scanEngine.ts): the newest date carrying a non-NULL ema_20.
--
-- Was `HAVING count(*) >= 4000`, the row-count resolver the frontend abandoned
-- after the mid-pipeline blackout bug: row presence is not data readiness, and
-- the threshold is exchange-blind. On 2026-08-14 NSE's bhav published late and
-- BSE alone cleared 4,000 rows, so a refresh in that window would have picked a
-- BSE-only day as "latest". compute_all_pending_indicators writes ema_20 in one
-- transaction per date, so this flips atomically at commit.
latest AS (
  SELECT max(e.trade_date) AS trade_date
  FROM   km_equity_eod e
  WHERE  e.ema_20 IS NOT NULL
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
    -- prior-20 high = max of prior 20 CLOSES, rn 2..21 [C1]. Unused since
    -- fresh_breakout was removed (F6); kept so the shared CTE is untouched.
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
           ('Strong Bull','Mild Bull','Neutral Bull','Neutral',
            'Neutral Bear','Mild Bear','Strong Bear')) AS zone_coerced,
    CASE WHEN e.magic_rs_zone IN
           ('Strong Bull','Mild Bull','Neutral Bull','Neutral',
            'Neutral Bear','Mild Bear','Strong Bear')
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

-- ══ Preset 3: smart_money → Smart Money Loading (scanEngine.ts:970-1010) ═════
-- Industry gate reworked in the app on 2026-07-19; this matview still carried
-- the ORIGINAL absolute `pct_accumulation > 60`, which fires for 0-1 industries
-- on a typical day — smart_money returned 0 rows on every refresh since the
-- matview was deployed. The app keeps the absolute bar but ORs it with a
-- top-decile cutoff, so the scan reflects the strongest-accumulating corner of
-- the market instead of blanking.
--
-- E: industry pct_accumulation > 55 OR industry in the top decile by
--    pct_accumulation (decile = max(5, ceil(n/10)) over industries with
--    pct_accumulation > 0 on the latest date).
-- F: symbol ~ ^[A-Z] ∧ delivery_pct>60 ∧ rss_value>0.  S: delivery_pct DESC. L: 25.
ind_accum_rank AS (
  SELECT
    industry,
    pct_accumulation,
    -- JS sorts descending and reads positions 0..decile-1; `industry` breaks
    -- exact ties deterministically (V8's stable sort is not replicable).
    row_number() OVER (ORDER BY pct_accumulation DESC, industry) AS acc_rn,
    count(*)     OVER ()                                         AS acc_n
  FROM km_industry_eod
  WHERE trade_date = (SELECT trade_date FROM latest)
    AND COALESCE(pct_accumulation, 0) > 0
),

ind_accum AS (
  SELECT industry
  FROM   ind_accum_rank
  WHERE  pct_accumulation > 55                                              -- MAGIC: 55
     OR  acc_rn <= GREATEST(5, ceil(acc_n::numeric / 10)::int)              -- MAGIC: top decile, floor 5
),

smart_money AS (
  SELECT s.*, row_number() OVER (ORDER BY COALESCE(s.delivery_pct,0) DESC, s.equity_id) AS rnk
  FROM stock s
  WHERE s.industry IS NOT NULL
    AND s.symbol ~ '^[A-Z]'
    AND s.industry IN (SELECT industry FROM ind_accum)
    AND COALESCE(s.delivery_pct,0) > 60                                     -- MAGIC: 60
    AND COALESCE(s.rss_value,0) > 0
),

-- Preset 4 (fresh_breakout) REMOVED. Retired in the app on 2026-07-13 and
-- deactivated in kd_scan_presets by migration 152 (it was a near-duplicate of
-- Breakout Surge), but the matview kept materialising 25 dead rows on every
-- refresh. The eq_deriv.high20 column it used is left in place — harmless, and
-- removing it would touch the shared history CTE for no gain.

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
-- E: none beyond per-stock.
-- F: zone∈{Mild Bull,Neutral Bull,Neutral,Neutral Bear,Mild Bear} ∧ zone(rn10)='Strong Bull'
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
  -- The two neutral bands were added in the app on 2026-07-13: a stock
  -- decaying out of Strong Bull lands in Neutral Bull/Neutral Bear FIRST, so
  -- omitting them hid this scanner's most natural candidates (~47% of the
  -- universe sits in those bands). Requires the widened coercion in eq_base.
  WHERE s.magic_rs_zone IN ('Mild Bull','Neutral Bull','Neutral','Neutral Bear','Mild Bear')
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
),

-- ══ Flower Pot Burst source (deep-history, NSE-only) ═════════════════════════
-- Independent of the 45-day eq_hist above: compression needs 60 trading bars,
-- so this chain reads its own 140-calendar-day window. Latest = max NSE date
-- (FPB is NSE-only, so it is not gated on the >=4000 both-exchange `latest`).
-- Calibrated thresholds (scanEngine.ts FPB block): ATR15/ATR60<0.8, 10d range
-- <8%, vol5/vol22<0.6, |MagicRS 5d delta|<2, close>20, stage NOT IN (S3,S4),
-- >=60 bars. SETUP = compressed within last 10 sessions; BURST = a setup active
-- in the prior 22 sessions plus today's release (vol>=3x, range>=2x, close>=70%
-- of range, close>10d-high, delivery>45%).
fpb_base AS (
  SELECT e.equity_id, e.trade_date, e.open, e.high, e.low, e.close, e.prev_close, e.volume,
         e.magic_rs, e.magic_rs_zone, e.stage, e.delivery_pct, e.rvol, e.pct_chng,
         a.symbol, a.company_name, a.industry, a.exchange, a.isin, a.mcap_cr,
         GREATEST(e.high - e.low, abs(e.high - e.prev_close), abs(e.low - e.prev_close)) AS tr,
         (e.high - e.low) AS rng
  FROM km_equity_eod e
  JOIN active a USING (equity_id)
  WHERE a.exchange = 'NSE'
    AND e.trade_date > CURRENT_DATE - INTERVAL '140 days'
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
  WHERE trade_date = (SELECT max(trade_date) FROM fpb_base)
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
    -- Release-only metrics (burst or shatter); blank on coiling rows.
    CASE WHEN is_burst OR is_shatter THEN round(vol_burst_raw::numeric, 1) END AS fpb_vol_burst,
    CASE WHEN is_burst OR is_shatter THEN round(range_exp_raw::numeric, 1) END AS fpb_range_exp,
    CASE WHEN is_burst OR is_shatter THEN round(close_str_raw::numeric, 2) END AS fpb_close_strength,
    -- Burst rewards a strong close (near high); shatter rewards a weak close (near low).
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
  WHERE is_burst OR is_shatter OR setup_recent10 = 1
)

-- ── UNION of the 8 pre-ranked, pre-limited preset blocks ────────────────────
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
       NULL::numeric AS d_pct, db_deliv_value_cr AS deliv_value_cr, NULL::numeric AS score,
       -- Flower Pot Burst columns (populated only by the flower_pot_burst block below)
       NULL::text AS fpb_phase, NULL::numeric AS fpb_compression_score,
       NULL::numeric AS fpb_atr_compression, NULL::numeric AS fpb_vol_death,
       NULL::int AS fpb_setup_days, NULL::numeric AS fpb_vol_burst,
       NULL::numeric AS fpb_range_exp, NULL::numeric AS fpb_close_strength,
       NULL::numeric AS fpb_quality
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
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
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
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
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
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
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
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
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
       NULL::text, NULL::numeric, NULL::numeric, NULL::numeric, NULL::int, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
FROM conviction_flow WHERE rnk <= 50

-- ══ Preset 8: flower_pot_burst → Flower Pot Burst ════════════════════════════
-- Compression -> release. Two phases surface together: SETUP (coiling now,
-- watchlist) and BURST (the rare coil that released today). NSE-only; needs 60
-- trading bars so it uses its own deep-history CTEs (fpb_* above), independent
-- of the 45-day eq_hist the other 7 presets share. Thresholds are the CALIBRATED
-- live-NSE values (scanEngine.ts FPB block), not the spec literals. Ranked burst-
-- first, then by compression tightness. No hard row cap (universe is naturally
-- tiny — a few dozen).
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
       fpb_setup_days, fpb_vol_burst, fpb_range_exp, fpb_close_strength, fpb_quality
FROM fpb

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
  SELECT unnest(ARRAY['power_buy','power_sell','smart_money',
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

-- ============================================================================
-- Ownership + MAINTAIN — re-applied because DROP/CREATE resets both.
--
-- Migration 157 transferred these matviews to kd_app (the pipeline role) so the
-- nightly scan_refresh step can REFRESH them: on PG17 that needs ownership or
-- MAINTAIN, and there is no GRANT REFRESH. Migration 151 granted MAINTAIN to
-- kd_app and admin. Recreating the views here makes the migration runner the
-- owner again, so both must be restored or the daily run fails on its last step
-- with "permission denied for materialized view km_scan_results".
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kd_app') THEN
    EXECUTE 'ALTER MATERIALIZED VIEW km_scan_results          OWNER TO kd_app';
    EXECUTE 'ALTER MATERIALIZED VIEW km_scan_exclusion_counts OWNER TO kd_app';
  END IF;
END $$;

GRANT MAINTAIN ON km_scan_results          TO kd_app, admin;
GRANT MAINTAIN ON km_scan_exclusion_counts TO kd_app, admin;

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
