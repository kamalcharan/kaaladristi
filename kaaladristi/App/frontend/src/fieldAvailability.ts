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
    defaultCols: [
      'symbol', 'close', 'score_5d', 'score_22d', 'pct_chng',
      'magic_rs', 'rs_percentile', 'stage',
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
