// fieldConfig.ts — single source of truth for field display across ScanTable and StockCard

export type FieldType =
  | 'price'
  | 'pct'
  | 'number'
  | 'cr'
  | 'surge'
  | 'trend'
  | 'zone'
  | 'category'
  | 'score50'
  | 'score100'
  | 'rsi'
  | 'flow'

export interface ThresholdColor {
  low: string     // CSS var — color when value < lowMax
  mid: string     // CSS var — color when lowMax <= value < highMin
  high: string    // CSS var — color when value >= highMin
  lowMax: number
  highMin: number
}

export interface FieldConfig {
  key: string
  label: string
  shortLabel?: string
  tooltip: string
  type: FieldType
  width: number
  sticky?: boolean
  thresholds?: ThresholdColor
  formatFn?: (val: any) => string
  colorFn?: (val: any, row?: any) => string
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function formatByType(type: FieldType, val: any): string {
  if (val == null) return '—'
  switch (type) {
    case 'price': {
      const n = Number(val)
      if (isNaN(n)) return '—'
      return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    }
    case 'pct': {
      const n = Number(val)
      if (isNaN(n)) return '—'
      return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
    }
    case 'number': {
      const n = Number(val)
      return isNaN(n) ? '—' : n.toFixed(2)
    }
    case 'cr': {
      const n = Number(val)
      return isNaN(n) ? '—' : `${n.toFixed(2)} Cr`
    }
    case 'surge': {
      const n = Number(val)
      return isNaN(n) ? '—' : `${n.toFixed(2)}×`
    }
    case 'score50': {
      const n = Number(val)
      return isNaN(n) ? '—' : n.toFixed(1)
    }
    case 'score100': {
      const n = Number(val)
      return isNaN(n) ? '—' : n.toFixed(0)
    }
    case 'rsi': {
      const n = Number(val)
      return isNaN(n) ? '—' : n.toFixed(1)
    }
    case 'zone': {
      const n = Number(val)
      return isNaN(n) ? '—' : n.toFixed(1)
    }
    case 'category':
    case 'flow':
    case 'trend':
    default:
      return String(val)
  }
}

// Normalizes supertrend_dir which may be boolean, number (1/0/-1), or string
function isBullishTrend(val: any): boolean {
  if (typeof val === 'boolean') return val
  const s = String(val).toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'UP' || s === 'BULLISH'
}

// ── Flow type display maps ─────────────────────────────────────────────────────

const FLOW_DISPLAY: Record<string, string> = {
  FRESH_LONGS:      'Fresh Longs',
  SHORT_COVERING:   'Short Cover',
  LONG_LIQUIDATION: 'Long Liq',
  FRESH_SHORTS:     'Fresh Shorts',
  LOW_VOLUME:       'Low Volume',
  MIXED:            'Mixed',
}

const FLOW_COLOR: Record<string, string> = {
  FRESH_LONGS:      'var(--bull)',
  FRESH_SHORTS:     'var(--bear)',
  SHORT_COVERING:   'var(--gold)',
  LONG_LIQUIDATION: 'var(--bear-dim, rgba(239,68,68,0.6))',
  MIXED:            'var(--gold)',
  LOW_VOLUME:       'var(--text-muted)',
}

// ── Stage color map ────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  S2:           'var(--bull)',
  S2_CANDIDATE: 'var(--gold)',
  S3:           'var(--gold)',
  S4:           'var(--bear)',
}

// ── Field registry ─────────────────────────────────────────────────────────────

export const ALL_FIELDS: Record<string, FieldConfig> = {

  symbol: {
    key: 'symbol',
    label: 'Symbol',
    tooltip: 'Stock symbol and company name. ✦ dot indicates VaNi Opportunity.',
    type: 'category',
    width: 130,
    sticky: true,
  },

  close: {
    key: 'close',
    label: 'Close',
    tooltip: 'Last traded price (₹)',
    type: 'price',
    width: 85,
  },

  pct_chng: {
    key: 'pct_chng',
    label: 'D%',
    tooltip: 'Price change today (%). Green = up, Red = down.',
    type: 'pct',
    width: 72,
  },

  magic_rs: {
    key: 'magic_rs',
    label: 'MagicRS vs N500',
    shortLabel: 'MRS',
    tooltip: 'MagicRS — Relative Strength benchmarked against NIFTY 500 (CNX500). Proprietary 144-bar momentum oscillator: positive = outperforming NIFTY 500, negative = underperforming. Color reflects zone: Strong Bull (green) → Strong Bear (red).',
    type: 'zone',
    width: 72,
    colorFn: (_val: any, row?: any) => {
      const zone = (row as any)?.magic_rs_zone
      switch (zone) {
        case 'Strong Bull':  return 'var(--bull)'
        case 'Mild Bull':    return 'var(--bull-dim, rgba(34,197,94,0.55))'
        case 'Neutral Bull': return 'var(--bull-faint, rgba(34,197,94,0.3))'
        case 'Neutral Bear': return 'var(--bear-faint, rgba(239,68,68,0.3))'
        case 'Mild Bear':    return 'var(--bear-dim, rgba(239,68,68,0.55))'
        case 'Strong Bear':  return 'var(--bear)'
        default:             return 'var(--text-secondary)'
      }
    },
  },

  rs_percentile: {
    key: 'rs_percentile',
    label: 'RS%',
    tooltip: 'RS Percentile — rank among all NSE stocks by relative strength (0–100). Above 80 = market leader. Above 70 = strong.',
    type: 'score100',
    width: 62,
    thresholds: {
      low:     'var(--bear)',
      mid:     'var(--gold)',
      high:    'var(--bull)',
      lowMax:  40,
      highMin: 70,
    },
  },

  stage: {
    key: 'stage',
    label: 'Stage',
    tooltip: 'Weinstein Stage — S1: Basing, S2: Advancing (buy zone), S3: Topping, S4: Declining (avoid/short). S2_CANDIDATE = approaching S2.',
    type: 'category',
    width: 90,
    colorFn: (val: any) => STAGE_COLOR[String(val ?? '')] ?? 'var(--text-muted)',
  },

  rsi_14: {
    key: 'rsi_14',
    label: 'RSI',
    tooltip: 'RSI 14 — Relative Strength Index. Above 70 = overbought (highlighted red). Below 30 = oversold (highlighted green). 50 = neutral.',
    type: 'rsi',
    width: 62,
    thresholds: {
      low:     'var(--bull)',
      mid:     'var(--text-secondary)',
      high:    'var(--bear)',
      lowMax:  30,
      highMin: 70,
    },
  },

  rvol: {
    key: 'rvol',
    label: 'RVOL',
    tooltip: 'Relative Volume — today vs 20-day average. Above 2× = elevated institutional activity. Below 1 = below normal.',
    type: 'surge',
    width: 65,
    thresholds: {
      low:     'var(--text-muted)',
      mid:     'var(--gold)',
      high:    'var(--bull)',
      lowMax:  1,
      highMin: 2,
    },
  },

  pctBelow52wHigh: {
    key: 'pctBelow52wHigh',
    label: '% Bel 52W',
    tooltip: '% below 52-week high. Closer to 0% = near highs (strength). Higher % = further from highs (weakness or opportunity).',
    type: 'pct',
    width: 90,
    colorFn: () => 'var(--text-secondary)',
  },

  mcap_cr: {
    key: 'mcap_cr',
    label: 'MCap',
    tooltip: 'Market Capitalisation in ₹ Crores.',
    type: 'cr',
    width: 85,
  },

  flow_type: {
    key: 'flow_type',
    label: 'Flow',
    tooltip: 'Smart money flow classification based on price direction + MagicRS strength. Fresh Longs = institutional buying. Short Covering = shorts exiting. Long Liquidation = longs exiting. Fresh Shorts = institutional selling.',
    type: 'flow',
    width: 110,
    formatFn: (val: any) => FLOW_DISPLAY[String(val ?? '')] ?? String(val ?? '—'),
    colorFn: (val: any) => FLOW_COLOR[String(val ?? '')] ?? 'var(--text-muted)',
  },

  sniper_inst: {
    key: 'sniper_inst',
    label: 'Institution',
    tooltip: 'Institutional Activity — Sniper detection of institutional flow. Based on RSI(9) above base 61, scaled 0–50. Above 35 = strong institutional presence.',
    type: 'score50',
    width: 90,
    thresholds: {
      low:     'var(--text-muted)',
      mid:     'var(--gold)',
      high:    'var(--bull)',
      lowMax:  15,
      highMin: 35,
    },
  },

  sniper_hot: {
    key: 'sniper_hot',
    label: 'Hot Money',
    tooltip: 'Hot Money — fast momentum/retail flow detection. Based on RSI(4) above base 15, scaled 0–50. Value of 50 = maximum activity (at cap). Often uniformly high in trending markets.',
    type: 'score50',
    width: 90,
    thresholds: {
      low:     'var(--text-muted)',
      mid:     'var(--gold)',
      high:    'var(--gold)',
      lowMax:  20,
      highMin: 40,
    },
  },

  rss_value: {
    key: 'rss_value',
    label: 'RSS',
    tooltip: 'RSS — LuckyPop Relative Strength Smoothed. Computed as RSI(5) of the SMA(10)–SMA(40) spread, then smoothed with SMA(3). Range 0–100. Above 80 = overbought / strong momentum. Below 20 = oversold / weak momentum. A new RSS high before price makes a new high is an early momentum signal.',
    type: 'score100',
    width: 65,
    thresholds: {
      low:     'var(--bear)',
      mid:     'var(--text-secondary)',
      high:    'var(--accent)',
      lowMax:  20,
      highMin: 80,
    },
  },

  accum_distrib: {
    key: 'accum_distrib',
    label: 'Accum/Dist',
    tooltip: 'Accumulation/Distribution regime. ACCUMULATION = price below GreenLine with bullish momentum (smart money buying). DISTRIBUTION = price above GreenLine with bearish momentum (smart money selling). NEUTRAL = no contested A/D regime. NULL = SMA 150 not yet computed.',
    type: 'category',
    width: 95,
    colorFn: (val: any) => {
      if (val === 'ACCUMULATION') return 'var(--bull)'
      if (val === 'DISTRIBUTION') return 'var(--bear)'
      return 'var(--text-muted)'
    },
  },

  supertrend_dir: {
    key: 'supertrend_dir',
    label: 'ST',
    tooltip: 'Supertrend direction. ▲ = bullish bias (price above supertrend). ▼ = bearish bias (price below supertrend).',
    type: 'trend',
    width: 48,
    formatFn: (val: any) => {
      if (val == null) return '—'
      return isBullishTrend(val) ? '▲' : '▼'
    },
    colorFn: (val: any) => {
      if (val == null) return 'var(--text-secondary)'
      return isBullishTrend(val) ? 'var(--bull)' : 'var(--bear)'
    },
  },

  delivery_surge_x: {
    key: 'delivery_surge_x',
    label: 'Delivery Surge',
    tooltip: 'Ratio of Avg Amt 5D ÷ Avg Amt 22D — rising delivery interest vs recent average',
    type: 'surge',
    width: 72,
    thresholds: {
      low:     'var(--text-muted)',
      mid:     'var(--gold)',
      high:    'var(--bull)',
      lowMax:  1.5,
      highMin: 2,
    },
  },

  avg_amt_5d: {
    key: 'avg_amt_5d',
    label: 'Avg Amt 5D',
    tooltip: 'Average invested amount (delivery value) over 5 trading days (Cr)',
    type: 'cr',
    width: 85,
  },

  avg_amt_22d: {
    key: 'avg_amt_22d',
    label: 'Avg Amt 22D',
    tooltip: 'Average invested amount (delivery value) over 22 trading days (Cr)',
    type: 'cr',
    width: 85,
  },

  avg_amt_66d: {
    key: 'avg_amt_66d',
    label: 'Avg Amt 66D',
    tooltip: 'Average invested amount (delivery value) over 66 trading days (Cr)',
    type: 'cr',
    width: 85,
  },

  delivery_pct: {
    key: 'delivery_pct',
    label: 'Deliv%',
    tooltip: 'Delivery percentage — what portion of traded volume resulted in actual delivery. Higher = genuine buying conviction, not intraday trading.',
    type: 'pct',
    width: 70,
    thresholds: {
      low:     'var(--text-muted)',
      mid:     'var(--gold)',
      high:    'var(--bull)',
      lowMax:  30,
      highMin: 50,
    },
  },

  ema_20: {
    key: 'ema_20',
    label: 'EMA20',
    tooltip: '20-day Exponential Moving Average. Price proximity to EMA20 is used in Conviction Flow scanner (within ±8%).',
    type: 'price',
    width: 82,
  },

  breakout_level: {
    key: 'breakout_level',
    label: 'Brk Lvl',
    tooltip: 'Breakout level — highest close over prior 20 bars. Price breaking above this = breakout signal. Note: this is the 20-bar ceiling, not a true identified breakout event.',
    type: 'price',
    width: 80,
  },

  pct_from_breakout: {
    key: 'pct_from_breakout',
    label: '% Above',
    tooltip: '% above the breakout level. Closer to 0% = fresher breakout. Higher % = extended move, more risk.',
    type: 'pct',
    width: 78,
    thresholds: {
      low:     'var(--bull)',
      mid:     'var(--gold)',
      high:    'var(--text-muted)',
      lowMax:  2,
      highMin: 5,
    },
  },

  ret_5d: {
    key: 'ret_5d',
    label: '5D%',
    tooltip: '5-day price return (%). Only available for Conviction Flow and Breakout Surge scanners.',
    type: 'pct',
    width: 65,
    // cross-column: accent when 5D outpacing 22D
    colorFn: (val: any, row?: any) => {
      const n = Number(val)
      if (isNaN(n)) return 'var(--text-secondary)'
      const r = row as any
      if (r?.ret_5d != null && r?.ret_22d != null && r.ret_5d > r.ret_22d) return 'var(--accent)'
      return n > 0 ? 'var(--bull)' : n < 0 ? 'var(--bear)' : 'var(--text-secondary)'
    },
  },

  ret_22d: {
    key: 'ret_22d',
    label: '22D%',
    tooltip: '22-day price return (%). Only available for Conviction Flow and Breakout Surge scanners.',
    type: 'pct',
    width: 65,
  },

  ret_66d: {
    key: 'ret_66d',
    label: '66D%',
    tooltip: '66-day price return (%). Available for Conviction Flow and Breakout Surge scanners.',
    type: 'pct',
    width: 65,
  },

  d_pct: {
    key: 'd_pct',
    label: 'Day%',
    tooltip: 'Intraday price change % for today',
    type: 'pct',
    width: 70,
    colorFn: (val: any) => {
      const n = Number(val)
      if (isNaN(n)) return 'var(--text-secondary)'
      return n > 0 ? 'var(--bull)' : n < 0 ? 'var(--bear)' : 'var(--text-secondary)'
    },
  },

  deliv_value_cr: {
    key: 'deliv_value_cr',
    label: 'Deliv Val',
    tooltip: 'Today delivery value in ₹ Crores — actual money that changed hands with delivery',
    type: 'cr',
    width: 85,
  },


  score_5d: {
    key: 'score_5d',
    label: 'Score 5D',
    tooltip: 'Delivery surge score over 5 days. surge ≥ 1: surge² × 25. surge < 1: raw 5D return %.',
    type: 'number',
    width: 90,
    thresholds: {
      low:     'var(--bear)',
      mid:     'var(--text-secondary)',
      high:    'var(--bull)',
      lowMax:  0,
      highMin: 20,
    },
  },

  score_22d: {
    key: 'score_22d',
    label: 'Score 22D',
    tooltip: 'Delivery surge score over 22 days. surge ≥ 1: surge² × 25. surge < 1: raw 22D return %.',
    type: 'number',
    width: 90,
    thresholds: {
      low:     'var(--bear)',
      mid:     'var(--text-secondary)',
      high:    'var(--bull)',
      lowMax:  0,
      highMin: 20,
    },
  },

  score_66d: {
    key: 'score_66d',
    label: 'Score 66D',
    tooltip: 'Delivery surge score over 66 days. surge ≥ 1: surge² × 25. surge < 1: raw 66D return %.',
    type: 'number',
    width: 90,
    thresholds: {
      low:     'var(--bear)',
      mid:     'var(--text-secondary)',
      high:    'var(--bull)',
      lowMax:  0,
      highMin: 20,
    },
  },

  sma_50: {
    key: 'sma_50',
    label: 'SMA50',
    tooltip: '50-day Simple Moving Average. Price above SMA50 = medium-term uptrend.',
    type: 'price',
    width: 82,
  },

  sma_150: {
    key: 'sma_150',
    label: 'SMA150',
    tooltip: '150-day Simple Moving Average. Used in Stage 2 analysis: SMA150 must be rising and price must be above it.',
    type: 'price',
    width: 82,
  },

  sma_200: {
    key: 'sma_200',
    label: 'SMA200',
    tooltip: '200-day Simple Moving Average. Price above SMA200 = long-term uptrend. Stage 2 requires SMA50 > SMA200 with rising SMA200.',
    type: 'price',
    width: 82,
  },

  w52_high: {
    key: 'w52_high',
    label: '52W High',
    tooltip: '52-week high price.',
    type: 'price',
    width: 82,
  },

  // Stubs for removed optional columns (C36 — always null, hidden from picker)
  rel_5d_n50: {
    key: 'rel_5d_n50',
    label: 'Rel N50',
    tooltip: 'Relative 5D return vs NIFTY 50. Not currently populated.',
    type: 'pct',
    width: 75,
  },

  rel_5d_n500: {
    key: 'rel_5d_n500',
    label: 'Rel N500',
    tooltip: 'Relative 5D return vs NIFTY 500. Not currently populated.',
    type: 'pct',
    width: 75,
  },
}

// ── Exported helpers ───────────────────────────────────────────────────────────

export function getFieldConfig(key: string): FieldConfig | undefined {
  return ALL_FIELDS[key]
}

export function formatValue(key: string, val: any, _row?: any): string {
  if (val == null) return '—'
  const cfg = ALL_FIELDS[key]
  if (!cfg) return String(val)
  if (cfg.formatFn) return cfg.formatFn(val)
  return formatByType(cfg.type, val)
}

export function getColor(key: string, val: any, row?: any): string {
  const cfg = ALL_FIELDS[key]
  if (!cfg || val == null) return 'var(--text-secondary)'

  if (cfg.colorFn) return cfg.colorFn(val, row)

  if (cfg.thresholds) {
    const n = Number(val)
    if (!isNaN(n)) {
      if (n < cfg.thresholds.lowMax)   return cfg.thresholds.low
      if (n >= cfg.thresholds.highMin) return cfg.thresholds.high
      return cfg.thresholds.mid
    }
  }

  // pct type default: green when positive, red when negative
  if (cfg.type === 'pct') {
    const n = Number(val)
    if (!isNaN(n)) {
      if (n > 0) return 'var(--bull)'
      if (n < 0) return 'var(--bear)'
    }
  }

  return 'var(--text-secondary)'
}

export function getLabel(key: string): string {
  return ALL_FIELDS[key]?.label ?? key
}

export function getTooltip(key: string): string {
  return ALL_FIELDS[key]?.tooltip ?? ''
}
