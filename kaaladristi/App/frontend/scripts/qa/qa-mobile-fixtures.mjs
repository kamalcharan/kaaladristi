// One real km_scan_results row (2026-09-04, power_buy rank 2), cloned with
// variation so a page has a realistic dozen rows.
const TEMPLATE = {"preset_id":"power_buy","rank":2,"vani_flag":false,"vani_path":"computeVaniOpportunity","flow_guard_applied":false,"zone_coerced":false,"history_insufficient":false,"guard_notes":null,"equity_id":38725,"trade_date":"2026-09-04","symbol":"BODALCHEM","company_name":"Bodal Chemicals Limited","industry":"Specialty Chemicals","exchange":"NSE","isin":"INE338D01028","mcap_cr":1959.94,"close":155.62,"pct_chng":3.22,"magic_rs":131.294,"magic_rs_zone":"Strong Bull","flow_type":"FRESH_LONGS","rvol":3.2631,"sniper_inst":50,"accum_distrib":"NEUTRAL","rss_value":99.2,"delivery_pct":24.34,"delivery_surge_x":4.4,"avg_amt_22d":8.0479,"sma_150":65.54,"ema_20":103.44,"atr_14":8.496,"w52_high":159.99,"volume_divergence_flag":null,"reward":-43.68,"reward_pct":-5.14,"pct_below_52w_high":2.73,"xamt":4.056,"rel_5d_n50":58.21,"rel_22d_n50":109.92,"rel_66d_n50":111.61,"rel_5d_n500":58.23,"rel_22d_n500":109.0,"rel_66d_n500":110.14,"has_recent_svd":true,"has_recent_sbd":true,"has_recent_syd":false,"magic_rs_trend":[1,1,1,1,1],"ret_5d":57.06,"ret_22d":106.97,"ret_66d":113.71,"d_pct":null,"deliv_value_cr":19.1161,"score":null,"fpb_phase":null,"fpb_compression_score":null,"fpb_atr_compression":null,"fpb_vol_death":null,"fpb_setup_days":null,"fpb_vol_burst":null,"fpb_range_exp":null,"fpb_close_strength":null,"fpb_quality":null,"listing_age_years":null,"pct_from_3y_high":null,"days_since_3y_high":null,"gl_acc_days":null,"wg_phase":null,"drawdown_3y_pct":null,"score_5d":484.0,"score_22d":225.01,"rsi_14":95.31,"avg_amt_5d":35.4108,"supertrend_dir":1,"prev_week_close":99.08,"pct_wtd":57.06,"prev_month_close":118.89,"pct_mtd":30.89,"breakout_level":150.76,"pct_from_breakout":3.22,"breakdown_level":67.67,"pct_from_breakdown":129.97,
  // columns direct fetchers read that the matview row lacks
  "open":150.1,"high":157.2,"low":149.0,"sma_50":120.3,"sma_200":80.2,"w52_low":40.1,"lifetime_high":170.0,"avg_amt_66d":6.1,"sniper_hot":38,"rss_spread":6.2,"dot_svd":true,"dot_sbd":true,"dot_syd":false,"stage":"S2","stage_confirmed":true,"stage_since":"2026-06-01","stage_since_close":90.0,"stage_bars":60,"pct_from_stage_entry":72.9,"rs_percentile":97.0,"is_vani_s2":true,"is_vani_surge":true,"is_vani_breakout":false,"is_vani_weakness":false,"is_vani_smart":true,"is_vani_distrib":false,"gl_event":"BREAKOUT","gl_days_above":12,
  "km_equity_symbols":{"id":38725,"symbol":"BODALCHEM","company_name":"Bodal Chemicals Limited","exchange":"NSE","industry":"Specialty Chemicals","mcap_cr":1959.94,"isin":"INE338D01028"}};
const NAMES = [['BODALCHEM','Bodal Chemicals Limited'],['PVP','PVP Ventures Limited'],['UHTL','United Heat Transfer Limited'],['RELIANCE','Reliance Industries Limited'],['TATASTEEL','Tata Steel Limited'],['HDFCBANK','HDFC Bank Limited'],['INFY','Infosys Limited'],['ITC','ITC Limited'],['SBIN','State Bank of India'],['LT','Larsen & Toubro Limited'],['MARUTI','Maruti Suzuki India Limited'],['WIPRO','Wipro Limited']];
export function rowsFor(presetId) {
  return NAMES.map(([sym, name], i) => ({
    ...TEMPLATE, preset_id: presetId, rank: i + 1, equity_id: 30000 + i,
    // Distinct ISINs: the direct fetchers (Golden Line, movers fallback) dedupe by ISIN,
    // so clones sharing the template's collapse to one row.
    symbol: sym, company_name: name, vani_flag: i % 3 === 0, isin: `INE${String(i).padStart(6, '0')}01`,
    close: +(TEMPLATE.close * (1 + i * 0.07)).toFixed(2), pct_chng: +(3.2 - i * 0.4).toFixed(2),
    score_5d: +(484 - i * 31).toFixed(1), rvol: +(3.26 - i * 0.2).toFixed(2), rsi_14: +(95 - i * 3).toFixed(1),
    magic_rs_zone: ['Strong Bull','Mild Bull','Neutral Bull','Neutral Bear','Mild Bear','Strong Bear'][i % 6],
    km_equity_symbols: { ...TEMPLATE.km_equity_symbols, id: 30000 + i, symbol: sym, company_name: name, isin: `INE${String(i).padStart(6, '0')}01` },
  }));
}

