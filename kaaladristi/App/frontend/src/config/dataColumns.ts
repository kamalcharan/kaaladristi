/**
 * dataColumns — the column catalogue for the Study → Data tab.
 *
 * km_equity_eod carries 145 columns. Nobody wants that grid, so a small set
 * leads and the rest sit behind the picker in named groups.
 *
 * ONE list. DATA_COLUMN_GROUPS is the only place a column is named: the
 * picker renders from it and the PostgREST select is built from it
 * (`dataSelectColumns()`), so the two cannot drift. Every blank cell chased
 * this week came from a picker offering a column some hand-written select had
 * never asked for; there is no second list here to fall behind.
 *
 * Labels and formatting come from fieldConfig where the key is known (83 of
 * the 145) and fall back to a prettified key otherwise — a column with no
 * config still renders its value rather than vanishing.
 */

export interface DataColumnGroup {
  id: string;
  title: string;
  /** Shown collapsed under the group heading in the picker. */
  note?: string;
  columns: string[];
}

/** Always visible, never hidden — the row's identity and the price itself. */
export const DATA_PINNED_COLUMNS = ['trade_date'] as const;

/** Ticked on first open. ATR sits here as a plain number: it is a
 *  volatility reading, not a target, and carries no derived logic. */
export const DATA_DEFAULT_COLUMNS = [
  'trade_date', 'open', 'high', 'low', 'close',
  'volume', 'value_cr', 'delivery_pct', 'pct_chng', 'atr_14',
];

export const DATA_COLUMN_GROUPS: DataColumnGroup[] = [
  {
    id: 'price',
    title: 'Price & Volume',
    columns: [
      'trade_date', 'open', 'high', 'low', 'close', 'prev_close',
      'chng', 'pct_chng', 'volume', 'value_cr', 'tvol', 'rvol',
    ],
  },
  {
    id: 'adjusted',
    title: 'Adjusted Price',
    note: 'km_corporate_actions is empty, so adj_* is unpopulated. Shown for transparency, not use.',
    columns: ['adj_factor', 'adj_open', 'adj_high', 'adj_low', 'adj_close'],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    note: 'NSE only from ~2024; BSE has no delivery feed.',
    columns: ['delivery_qty', 'delivery_pct', 'deliv_value_cr',
              'avg_amt_5d', 'avg_amt_22d', 'avg_amt_66d', 'delivery_surge_x'],
  },
  {
    id: 'ma',
    title: 'Moving Averages',
    columns: [
      'ema_20', 'ema_60',
      'sma_8', 'sma_10', 'sma_21', 'sma_40', 'sma_50', 'sma_55',
      'sma_89', 'sma_150', 'sma_200', 'sma_233', 'sma200_rising',
    ],
  },
  {
    id: 'momentum',
    title: 'Momentum & Volatility',
    columns: ['rsi_14', 'rsi_9', 'mfi_14', 'atr_10', 'atr_14',
              'supertrend', 'supertrend_dir', 'obv', 'obv_sma_20'],
  },
  {
    id: 'proprietary',
    title: 'Proprietary',
    note: 'MagicRS, Sniper Dragon and RSSI — see Field Formulas in CLAUDE.md.',
    columns: [
      'magic_rs', 'magic_ma', 'magic_rs_zone', 'magic_rs_sma144',
      'magic_rs_short', 'magic_rs_short_ma', 'magic_rs_short_zone',
      'sniper_inst', 'sniper_hot', 'sniper_rsi',
      'rss_value', 'rss_rsi', 'rss_spread',
      'score_5d', 'score_22d', 'rs_percentile',
    ],
  },
  {
    id: 'structure',
    title: 'Stage & Flow',
    columns: [
      'stage', 'stage_confirmed', 'stage_since', 'stage_since_close',
      'stage_bars', 'pct_from_stage_entry', 'stage_since_censored',
      'flow_type', 'accum_distrib', 'vacuum_flag', 'volume_divergence_flag',
      'dot_svd', 'dot_sbd', 'dot_syd',
      'absorption', 'delta_smoothed',
    ],
  },
  {
    id: 'levels',
    title: 'Levels',
    columns: [
      'w52_high', 'w52_low', 'lifetime_high', 'pct_below_52w_high',
      'breakout_level', 'pct_from_breakout',
      'breakdown_level', 'pct_from_breakdown',
      'pct_from_gl', 'gl_event', 'gl_days_above',
      'pivot_pp', 'pivot_r1', 'pivot_r2', 'pivot_r3',
      'pivot_s1', 'pivot_s2', 'pivot_s3',
      'swing_high', 'swing_low', 'ib30_high', 'ib30_low', 'ib30_status',
    ],
  },
  {
    id: 'period',
    title: 'Period Returns',
    columns: [
      'ret_5d', 'ret_22d', 'ret_66d',
      'pct_5d', 'pct_22d', 'pct_66d',
      'd30_pct_chng', 'd365_pct_chng', 'surge_22d',
      'prev_week_close', 'pct_wtd', 'prev_month_close', 'pct_mtd',
    ],
  },
  {
    id: 'vani',
    title: 'VaNi Flags',
    note: 'Booleans written nightly by backfill_vani_flags.py.',
    columns: [
      'is_vani_s2', 'is_vani_smart', 'is_vani_strength', 'is_vani_breakout',
      'is_vani_surge', 'is_vani_flow', 'is_vani_rs', 'is_vani_52wh',
      'is_vani_ath', 'is_vani_delivery', 'is_vani_ema20',
      'is_vani_overbought', 'is_vani_oversold', 'is_vani_distrib',
      'is_vani_weakness', 'is_vani_score5d', 'is_vani_score22d',
      'is_vani_hightrade', 'is_vani_52wl',
    ],
  },
  {
    id: 'chartink',
    title: 'Chartink',
    columns: ['chartink_emd_pct', 'chartink_emd_ok', 'chartink_ca_pct',
              'chartink_ca_ok', 'chartink_vmac_ok', 'chartink_score'],
  },
  {
    id: 'meta',
    title: 'Metadata',
    columns: ['ffmc', 'indicators_computed_at'],
  },
];

/** Every column the tab can render, in group order, deduped. */
export const DATA_ALL_COLUMNS: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of DATA_COLUMN_GROUPS) {
    for (const c of g.columns) {
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
  }
  return out;
})();

/** The PostgREST select list — derived from the SAME catalogue the picker
 *  renders, which is the whole point of this file. */
export function dataSelectColumns(): string {
  return DATA_ALL_COLUMNS.join(',');
}

/** Readable label for a column with no fieldConfig entry. */
export function prettifyKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\bpct\b/gi, '%')
    .replace(/\b(\w)/g, (m) => m.toUpperCase());
}
