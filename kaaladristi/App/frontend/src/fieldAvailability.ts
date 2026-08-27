// fieldAvailability.ts — per-category column definitions for the scanner table.
// defaultCols: always visible, cannot be hidden.
// optionalCols: available in the column picker, user can show/hide and reorder.
//
// All keys must exist in ALL_FIELDS (fieldConfig.ts).
// Category IDs match kd_scan_presets.category / SCAN_PRESETS[].category.

export const FIELD_AVAILABILITY: Record<string, {
  defaultCols: string[];
  optionalCols: string[];
}> = {

  price_action: {
    // Scores lead everywhere (owner: "Score is the real moat") — same
    // Close | Score 5D | Score 22D | 1D% ordering as the rotation table.
    defaultCols: [
      'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng',
      'breakout_level', 'pct_from_breakout',
      'avg_amt_5d', 'avg_amt_22d',
      'rvol', 'rsi_14', 'magic_rs',
    ],
    optionalCols: [
      'prev_week_close', 'pct_wtd',
      'prev_month_close', 'pct_mtd',
      'breakdown_level', 'pct_from_breakdown',
      'pct_5d', 'pct_22d', 'pct_66d',
      'avg_amt_66d', 'score_66d',
      'ret_5d', 'ret_22d', 'ret_66d',
      'delivery_surge_x', 'delivery_pct',
      'ema_20', 'sma_50', 'sma_150', 'sma_200',
      'mcap_cr', 'w52_high', 'pctBelow52wHigh',
      'stage', 'supertrend_dir',
      'flow_type', 'sniper_inst', 'sniper_hot',
      'accum_distrib', 'rss_value',
      'd_pct', 'deliv_value_cr',
    ],
  },

  stage_analysis: {
    // The stage-entry trio sits immediately after `stage`, because the three
    // only mean anything next to the label they qualify: which stage, since
    // when, from what price, and how far it has travelled since.
    defaultCols: [
      'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng',
      'magic_rs', 'rs_percentile', 'stage',
      'stage_since', 'stage_since_close', 'pct_from_stage_entry',
      'rsi_14', 'rvol', 'flow_type',
      'sniper_inst', 'rss_value',
      'avg_amt_5d', 'avg_amt_22d',
      'pctBelow52wHigh', 'mcap_cr',
    ],
    optionalCols: [
      'avg_amt_66d', 'delivery_surge_x',
      'delivery_pct', 'deliv_value_cr',
      'score_66d',
      'ret_5d', 'ret_22d', 'ret_66d',
      'ema_20', 'sma_50', 'sma_150', 'sma_200',
      'w52_high', 'sniper_hot',
      'accum_distrib', 'supertrend_dir',
      'stage_confirmed', 'stage_bars',
      'd_pct',
    ],
  },

  flow: {
    defaultCols: [
      'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng',
      'delivery_surge_x', 'avg_amt_5d', 'avg_amt_22d',
      'delivery_pct', 'rsi_14', 'ema_20',
      'magic_rs', 'flow_type', 'rvol',
    ],
    optionalCols: [
      'avg_amt_66d',
      'score_66d',
      'ret_5d', 'ret_22d', 'ret_66d',
      'mcap_cr', 'rss_value', 'sniper_inst',
      'sniper_hot', 'accum_distrib',
      'supertrend_dir', 'stage',
      'sma_50', 'sma_150', 'sma_200',
      'w52_high', 'pctBelow52wHigh',
      'd_pct', 'deliv_value_cr',
    ],
  },

  // Discovery (Waking Giants family). This group existed in kd_scan_presets
  // from migration 177 but never here, so any discovery preset without a
  // PRESET_COL_OVERRIDES entry fell through getFieldsForGroup's 3-column
  // default and rendered Symbol | Close | 1D% only. The journey tabs were
  // masked by their overrides; nothing else was.
  discovery: {
    defaultCols: [
      'symbol', 'close', 'pct_chng',
      'pct_from_3y_high', 'listing_age_years',
      'delivery_pct', 'magic_rs', 'rvol', 'mcap_cr',
    ],
    optionalCols: [
      'score_5d', 'score_22d',
      'avg_amt_5d', 'avg_amt_22d', 'avg_amt_66d',
      'delivery_surge_x', 'deliv_value_cr',
      'ret_5d', 'ret_22d', 'ret_66d',
      'rsi_14', 'flow_type', 'sniper_inst', 'rss_value',
      'accum_distrib', 'supertrend_dir', 'stage',
      'ema_20', 'sma_50', 'sma_150', 'sma_200',
      'w52_high', 'pctBelow52wHigh', 'd_pct',
    ],
  },

  market: {
    defaultCols: [
      'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng',
      'magic_rs', 'rvol', 'rsi_14',
      'flow_type', 'sniper_inst', 'rss_value',
      'accum_distrib', 'supertrend_dir',
      'mcap_cr', 'avg_amt_5d', 'avg_amt_22d',
    ],
    optionalCols: [
      'avg_amt_66d', 'delivery_surge_x',
      'delivery_pct', 'deliv_value_cr',
      'score_66d',
      'ret_5d', 'ret_22d', 'ret_66d',
      'sniper_hot', 'ema_20',
      'sma_50', 'sma_150', 'sma_200',
      'w52_high', 'pctBelow52wHigh',
      'rs_percentile', 'stage',
      'd_pct',
    ],
  },
};

export function getFieldsForGroup(category: string): {
  defaultCols: string[];
  optionalCols: string[];
} {
  return FIELD_AVAILABILITY[category] ?? {
    defaultCols: ['symbol', 'close', 'pct_chng'],
    optionalCols: [],
  };
}
