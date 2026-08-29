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
  | 'date'

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
  // The row is passed so a formatter can qualify its own value from a sibling
  // column -- stage_since prefixes an approximate date when
  // stage_since_censored says the real entry predates the data.
  formatFn?: (val: any, row?: any) => string
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
    case 'date': {
      const d = new Date(String(val))
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
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
    tooltip: 'Stock symbol and company name. ✦ dot indicates a VaNi Highlight (best of this list).',
    type: 'category',
    width: 158,
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
    label: '1D%',
    tooltip: 'Price change today (%). Green = up, Red = down.',
    type: 'pct',
    width: 72,
  },

  magic_rs: {
    key: 'magic_rs',
    label: 'MagicRS vs N500',
    shortLabel: 'MRS',
    tooltip: 'MagicRS — Relative Strength benchmarked against NIFTY 500 (CNX500). Proprietary 144-bar momentum oscillator: positive = outperforming NIFTY 500, negative = underperforming. Color reflects zone: Strong Uptrend (green) → Strong Downtrend (red).',
    type: 'zone',
    width: 72,
    colorFn: (_val: any, row?: any) => {
      const zone = (row as any)?.magic_rs_zone
      switch (zone) {
        case 'Strong Bull':  return 'var(--bull)'
        case 'Mild Bull':    return 'var(--bull-dim, rgba(34,197,94,0.55))'
        case 'Neutral Bull': return 'color-mix(in srgb, var(--bull) 30%, transparent)'
        case 'Neutral Bear': return 'color-mix(in srgb, var(--bear) 30%, transparent)'
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

  dot_signal: {
    key: 'dot_signal',
    label: 'Dot',
    tooltip: 'Which dot fired on this bar. SVD (Volume Drive) = move >9% on >10x its 5-day volume, close in the upper half of range, above the 150-SMA. SBD (Accumulation) = the broader form — green candle, >=3x its 50-day volume, close in the top third. SVD is the extreme tail of the same shape, and historically the stronger of the two. Both fire ON the move day.',
    type: 'category',
    width: 60,
  },

  stage: {
    key: 'stage',
    label: 'Stage',
    tooltip: 'Weinstein Stage — S1: Basing, S2: Advancing (buy zone), S3: Topping, S4: Declining (avoid/short). S2_CANDIDATE = approaching S2.',
    type: 'category',
    width: 90,
    colorFn: (val: any) => STAGE_COLOR[String(val ?? '')] ?? 'var(--text-muted)',
  },

  // ── Golden Line (migration 194) ─────────────────────────────────────────
  // sma_150 IS the Golden Line — a 150-BAR mean of close (migration 014).
  // It was always on km_equity_eod; what was missing was a record of what
  // happens AT it, which is the thing a scanner can filter on.

  gl_event: {
    key: 'gl_event',
    label: 'GL Event',
    tooltip: 'BREAKOUT — the close crossed from at-or-below the Golden Line to above it, with an SVD or SBD printing within five days either side of the cross. RETEST — the low reached the line while the close held above it, again with a dot within five days, after ten or more sessions holding the line. On the Discovery tabs the mark stays for 30 sessions after the event, so read GL AGE next to it.',
    type: 'category',
    width: 96,
    colorFn: (val: any) =>
      val === 'BREAKOUT' ? 'var(--bull)' : val === 'RETEST' ? 'var(--accent)' : 'var(--text-faint)',
  },

  gl_event_date: {
    key: 'gl_event_date',
    label: 'GL AGE',
    tooltip: 'Sessions since the Golden Line event in GL Event fired. The mark stays lit for 30 sessions, so this is what separates a breakout from yesterday from one six weeks old.',
    type: 'date',
    width: 88,
  },

  pct_from_gl: {
    key: 'pct_from_gl',
    label: 'vs GL',
    tooltip: 'Signed distance of the close from the Golden Line (150-bar mean close). Positive is above the line, negative below.',
    type: 'pct',
    width: 78,
  },

  gl_days_above: {
    key: 'gl_days_above',
    label: 'Days Above GL',
    tooltip: 'Consecutive sessions closed above the Golden Line, this session included. Zero means the close is at or below it.',
    type: 'number',
    width: 96,
    formatFn: (val: any) => (val == null ? '—' : String(Math.round(Number(val)))),
  },

  // ── Waking Giants clocks + turn (migrations 192/194) ────────────────────

  clocks: {
    key: 'clocks',
    label: 'D W M',
    tooltip: 'The three MagicRS clocks: daily, weekly, monthly. Green = bullish zone, red = not, grey = no data for that timeframe. The alignment score weights them 1/2/3, so a score alone cannot tell you WHICH clock turned — the daily is the fastest and carries the least weight.',
    type: 'category',
    width: 74,
  },

  turn_date: {
    key: 'turn_date',
    label: 'Turned On',
    tooltip: 'Where the move began: the Golden Line was crossed and held with the weekly clock already green. Earlier than the wake, which requires clearing the multi-year ceiling and therefore confirms late. Blank once the Golden Line is lost.',
    type: 'date',
    width: 100,
  },

  turn_close: {
    key: 'turn_close',
    label: 'Turn Price',
    tooltip: 'Close on the day the move began. Split- and bonus-adjusted, the same series as the base ceiling.',
    type: 'price',
    width: 96,
  },

  pct_from_turn: {
    key: 'pct_from_turn',
    label: '% Since Turn',
    tooltip: 'Price change since the move began. Compare with % Since Wake: the gap between them is how much of the move was already made before the breakout confirmed it.',
    type: 'pct',
    width: 104,
  },

  // ── Waking Giants: where the journey started (migration 192) ────────────
  // journey_age_days already said WHEN. Without the price it woke at, the
  // grid could not say whether the breakout went anywhere — SPARC read
  // "2mo · 5/6" while sitting a quarter below its own wake.

  wake_date: {
    key: 'wake_date',
    label: 'Woke On',
    tooltip: 'The session the journey began: close broke above the multi-year base ceiling while at or above the Golden Line (150-day mean close). Blank for stocks still basing.',
    type: 'date',
    width: 100,
  },

  wake_close: {
    key: 'wake_close',
    label: 'Wake Price',
    tooltip: 'Close on the day the journey began. Split- and bonus-adjusted and merged across NSE/BSE listings, the same series as the base ceiling — so it can differ slightly from the raw close shown elsewhere.',
    type: 'price',
    width: 100,
  },

  pct_from_wake: {
    key: 'pct_from_wake',
    label: '% Since Wake',
    tooltip: 'Price change since the journey began. Both sides on the adjusted series, so it is directly comparable with % from the base ceiling. A deeply negative number means the breakout was given back — the journey stays listed until relative-strength alignment collapses, which price alone does not do.',
    type: 'pct',
    width: 108,
  },

  // ── Stage entry (migration 191) ──────────────────────────────────────────
  // These four answer "when did this stock enter its stage, and at what
  // price". They read the CONFIRMED stage, not the raw one: the raw `stage`
  // label flickers so hard around the 200-SMA that 52% of its contiguous runs
  // last 3 bars or fewer, and an entry date read off those is meaningless.

  stage_confirmed: {
    key: 'stage_confirmed',
    label: 'Confirmed',
    tooltip: 'The stage once it has held 10 bars (~2 weeks). When this differs from Stage, the raw label has just flipped and has not held yet — the flip is days old, not established.',
    type: 'category',
    width: 100,
    colorFn: (val: any) => STAGE_COLOR[String(val ?? '')] ?? 'var(--text-muted)',
  },

  stage_since: {
    key: 'stage_since',
    label: 'In Stage Since',
    tooltip: 'First session of the run that opened the confirmed stage — backdated to where the turn happened, not to where it was proven. A ≥ prefix means the stock was already in this stage on its first classifiable bar, so the real entry is earlier and this date is a floor.',
    type: 'date',
    width: 108,
    // The censored case must not read as a precise date. Qualifying it here
    // keeps one honest number in the cell instead of a separate flag column
    // that a reader has to remember to look at.
    formatFn: (val: any, row?: any) => {
      if (val == null) return '—'
      const d = new Date(String(val))
      if (isNaN(d.getTime())) return '—'
      const txt = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
      return row?.stage_since_censored ? `≥ ${txt}` : txt
    },
  },

  stage_since_close: {
    key: 'stage_since_close',
    label: 'Entry Price',
    tooltip: 'Close on the day the confirmed stage began. Raw bhavcopy close — not adjusted for splits or bonuses, so a stock that has had a corporate action since will read wrong.',
    type: 'price',
    width: 100,
  },

  pct_from_stage_entry: {
    key: 'pct_from_stage_entry',
    label: '% Since Entry',
    tooltip: 'Price change since the confirmed stage began. Not a return — no corporate-action adjustment.',
    type: 'pct',
    width: 105,
  },

  stage_bars: {
    key: 'stage_bars',
    label: 'Bars In',
    tooltip: 'Sessions held since the confirmed stage began. Sessions, not calendar days — a long holiday stretch would overstate how much trading the stage has actually survived.',
    type: 'number',
    width: 78,
    formatFn: (val: any) => (val == null ? '—' : String(Math.round(Number(val)))),
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

  // ── Flower Pot Burst fields ──
  fpb_phase: {
    key: 'fpb_phase',
    label: 'Phase',
    tooltip: 'Coiling = compression forming (watchlist). Burst = the coil released UP today (near high, above the range). Shatter = released DOWN (near low, below the range). Both fire on explosive volume + range.',
    type: 'category',
    width: 86,
    formatFn: (val: any) =>
      val === 'BURST' ? '🌸 Burst' : val === 'SHATTER' ? '💥 Shatter' : val === 'SETUP' ? '🪴 Coiling' : '—',
    colorFn: (val: any) =>
      val === 'BURST' ? 'var(--bull)' : val === 'SHATTER' ? 'var(--bear)' : 'var(--text-secondary)',
  },
  fpb_compression_score: {
    key: 'fpb_compression_score',
    label: 'Tightness',
    tooltip: 'Compression tightness score — higher means a tighter coil (ATR contracted, range narrow, volume dead). Sums (1−ATR ratio) + (1−volume ratio) + (1−range/8%).',
    type: 'number',
    width: 80,
    colorFn: () => 'var(--text-primary)',
  },
  fpb_atr_compression: {
    key: 'fpb_atr_compression',
    label: 'ATR ×60d',
    tooltip: 'ATR15 as a multiple of ATR60 — how much recent volatility has contracted vs its 60-day norm. Lower = more compressed (< 0.8 qualifies).',
    type: 'surge',
    width: 78,
    colorFn: () => 'var(--text-secondary)',
  },
  fpb_vol_death: {
    key: 'fpb_vol_death',
    label: 'Vol ×norm',
    tooltip: 'Recent 5-day volume as a multiple of the 22-day norm. Lower = participation dying (< 0.6 qualifies).',
    type: 'surge',
    width: 82,
    colorFn: () => 'var(--text-secondary)',
  },
  fpb_setup_days: {
    key: 'fpb_setup_days',
    label: 'Coiled',
    tooltip: 'Number of the last 22 sessions this stock met the compression gate — how long the coil has been forming.',
    type: 'number',
    width: 66,
    formatFn: (val: any) => (val == null ? '—' : `${Number(val)}d`),
    colorFn: () => 'var(--text-secondary)',
  },
  fpb_vol_burst: {
    key: 'fpb_vol_burst',
    label: 'Vol Burst',
    tooltip: "Burst day's volume as a multiple of the pre-burst 22-day average (≥ 3× confirms a burst).",
    type: 'surge',
    width: 78,
    colorFn: () => 'var(--bull)',
  },
  fpb_range_exp: {
    key: 'fpb_range_exp',
    label: 'Range Exp',
    tooltip: "Burst candle's range as a multiple of the prior 15-day average range (≥ 2× confirms expansion).",
    type: 'surge',
    width: 84,
    colorFn: () => 'var(--bull)',
  },
  fpb_close_strength: {
    key: 'fpb_close_strength',
    label: 'Close Str',
    tooltip: "Where the burst closed within the day's range — 100% = at the high, ≥ 70% confirms buyers held.",
    type: 'pct',
    width: 78,
    formatFn: (val: any) => (val == null ? '—' : `${Math.round(Number(val) * 100)}%`),
    colorFn: () => 'var(--bull)',
  },
  fpb_quality: {
    key: 'fpb_quality',
    label: 'Quality',
    tooltip: 'Burst quality score — combines volume, range expansion, close strength and delivery. > 2.5 = strong burst.',
    type: 'number',
    width: 72,
    colorFn: () => 'var(--bull)',
  },

  // ── Waking Giants / First Ascent (migration 174) ──────────────────────────
  wg_phase: {
    key: 'wg_phase',
    label: 'Phase',
    tooltip: 'Observational phase — only names with evidence appear here. Stirring = a run of quiet delivery-backed sessions. Waking = that plus relative strength rising while price is still flat.',
    type: 'category',
    width: 92,
    formatFn: (val: any) =>
      val === 'WAKING' ? '🌅 Waking'
        : val === 'ASCENDING' ? '🧗 Ascent'
        : val === 'STIRRING' ? '🌱 Stirring'
        : val === 'HIBERNATING' || val === 'DORMANT' ? '🌑 Asleep'
        : '—',
    colorFn: (val: any) =>
      val === 'WAKING' || val === 'ASCENDING' ? 'var(--bull)'
        : val === 'STIRRING' ? 'var(--risk-amber)'
        : 'var(--text-secondary)',
  },
  base_years: {
    key: 'base_years',
    label: 'Slept',
    tooltip: 'Length of the hibernation the wake broke — "7y" reads as: the breakout printed the highest close in 7 years. "14y+" means the sleep exceeds our loaded history window.',
    type: 'number',
    width: 66,
    formatFn: (val: any) => {
      if (val == null) return '—';
      const v = Number(val);
      return v >= 14.5 ? '14y+' : `${v.toFixed(1)}y`;
    },
    colorFn: () => 'var(--text-primary)',
  },
  align_score: {
    key: 'align_score',
    label: 'Align',
    tooltip: 'MagicRS alignment across timeframes: daily counts 1, weekly 2, monthly 3 — 6/6 means Leading/Improving on all three clocks at once. A journey confirms into Ascent at 6 and returns to sleep at 1 or below.',
    type: 'number',
    width: 64,
    formatFn: (val: any) => (val == null ? '—' : `${Number(val)}/6`),
    colorFn: (val: any) =>
      val != null && Number(val) >= 6 ? 'var(--bull)'
        : val != null && Number(val) >= 3 ? 'var(--risk-amber)'
        : 'var(--text-secondary)',
  },
  journey_age_days: {
    key: 'journey_age_days',
    label: 'Journey',
    tooltip: 'Time since the wake event (the day the hibernation ceiling broke).',
    type: 'number',
    width: 72,
    formatFn: (val: any) => {
      if (val == null) return '—';
      const d = Number(val);
      return d >= 365 ? `${(d / 365).toFixed(1)}y` : `${Math.round(d / 30.44)}mo`;
    },
    colorFn: () => 'var(--text-secondary)',
  },
  wg_resting: {
    key: 'wg_resting',
    label: 'Resting',
    tooltip: 'Weekly close currently below the Golden Line — the journey is pausing, not over. A journey returns to sleep only when the timeframe alignment collapses.',
    type: 'category',
    width: 68,
    formatFn: (val: any) => (val === true || val === 't' ? '😴 Yes' : '—'),
    colorFn: () => 'var(--text-secondary)',
  },
  gl_dist_pct: {
    key: 'gl_dist_pct',
    label: 'vs GL',
    tooltip: 'Distance of the close from the Golden Line (SMA 150). Expanding distance after a wake is follow-through; negative marks a rest.',
    type: 'number',
    width: 70,
    // Signed, and coloured on BOTH sides. It used to print an unsigned number
    // in grey when above the line, so the state that matters — holding the
    // Golden Line — had no visual at all.
    formatFn: (val: any) =>
      (val == null ? '—' : `${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(1)}%`),
    colorFn: (val: any) =>
      val == null ? 'var(--text-secondary)'
        : Number(val) < 0 ? 'var(--risk-amber)' : 'var(--bull)',
  },
  drawdown_3y_pct: {
    key: 'drawdown_3y_pct',
    label: 'Fell',
    tooltip: 'Deepest fall after the cliff-adjusted 3-year high — how far the stock dropped from its peak before going quiet. Read with "% vs 3Y High" to see how much of the fall has been recovered.',
    type: 'number',
    width: 76,
    formatFn: (val: any) => (val == null ? '—' : `${Number(val).toFixed(0)}%`),
    colorFn: () => 'var(--text-secondary)',
  },
  gl_acc_days: {
    key: 'gl_acc_days',
    label: 'Quiet Acc',
    tooltip: 'Sessions in the last 60 with delivery-backed, quiet building — delivery ≥ 55%, day move within ±2%, volume not explosive.',
    type: 'number',
    width: 76,
    formatFn: (val: any) => (val == null ? '—' : `${Number(val)}d`),
    colorFn: () => 'var(--text-secondary)',
  },
  listing_age_years: {
    key: 'listing_age_years',
    label: 'Listed',
    tooltip: 'Years since NSE listing. Veteran 20y+ · Established 10–20y · Ascending 6–10y.',
    type: 'category',
    width: 108,
    formatFn: (val: any) => {
      if (val == null) return '—';
      const y = Number(val);
      const tier = y >= 20 ? 'Veteran' : y >= 10 ? 'Established' : 'Ascending';
      return `${y}y · ${tier}`;
    },
    colorFn: (val: any) => (val != null && Number(val) >= 20 ? 'var(--text-primary)' : 'var(--text-secondary)'),
  },
  pct_from_3y_high: {
    key: 'pct_from_3y_high',
    label: '% vs 3Y High',
    tooltip: 'Where the price sits today vs the cliff-adjusted 3-year high (split/bonus cliffs back-adjusted). Less negative than "Fell" means part of the fall has already been recovered — the awakening in progress.',
    type: 'number',
    width: 92,
    formatFn: (val: any) => (val == null ? '—' : `${Number(val).toFixed(1)}%`),
    colorFn: (val: any) => (val != null && Number(val) <= -50 ? 'var(--bear)' : 'var(--text-secondary)'),
  },
  days_since_3y_high: {
    key: 'days_since_3y_high',
    label: 'High Age',
    tooltip: 'Calendar days since the 3-year high was set — an old high means dormancy, a recent one means a fresh decline.',
    type: 'number',
    width: 76,
    formatFn: (val: any) => (val == null ? '—' : `${Math.round(Number(val) / 30.44)}mo`),
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
      // caution, not accent: >80 = overbought heat. The violet accent is
      // reserved for interactive elements — data signals must not wear it.
      high:    'var(--caution)',
      lowMax:  20,
      highMin: 80,
    },
  },

  accum_distrib: {
    key: 'accum_distrib',
    label: 'Accum/Dist',
    tooltip: 'Rising/Falling Flow regime. ACCUMULATION = price below GreenLine with positive momentum (smart money buying). DISTRIBUTION = price above GreenLine with negative momentum (smart money selling). NEUTRAL = no contested regime. NULL = SMA 150 not yet computed.',
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
    tooltip: 'Supertrend direction. ▲ = uptrend bias (price above supertrend). ▼ = downtrend bias (price below supertrend).',
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

  prev_week_close: {
    key: 'prev_week_close',
    label: 'Prev Wk Close',
    tooltip: "Last week's closing price — the reference the week-to-date move is measured from. Gap-safe: for a stock that did not trade last week this is its last available close.",
    type: 'price',
    width: 96,
  },
  pct_wtd: {
    key: 'pct_wtd',
    label: '% WTD',
    tooltip: 'Week-to-date change vs last week\u2019s close. Observational: it states how far this week has travelled, not where it is heading.',
    type: 'pct',
    width: 78,
  },
  prev_month_close: {
    key: 'prev_month_close',
    label: 'Prev Mth Close',
    tooltip: "Last month's closing price — the reference the month-to-date move is measured from. Gap-safe: for a stock that did not trade last month this is its last available close.",
    type: 'price',
    width: 100,
  },
  pct_mtd: {
    key: 'pct_mtd',
    label: '% MTD',
    tooltip: 'Month-to-date change vs last month\u2019s close. Observational: it states how far this month has travelled, not where it is heading.',
    type: 'pct',
    width: 78,
  },
  breakdown_level: {
    key: 'breakdown_level',
    label: 'Brk Dn Lvl',
    tooltip: 'Breakdown level — the lowest close over the prior 20 bars. Price below this = trading under its 20-day floor. The mirror of Brk Lvl.',
    type: 'price',
    width: 88,
  },
  pct_from_breakdown: {
    key: 'pct_from_breakdown',
    label: '% Below',
    tooltip: 'Percent of close versus the 20-day breakdown level. Negative means price has broken below the floor; the more negative, the deeper the break.',
    type: 'pct',
    width: 78,
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

  pct_5d: {
    key: 'pct_5d',
    label: 'Pct 5D',
    tooltip: '5-day price return % — DB-computed via LAG(close,4) (migration 111). Breakout Surge Daily only.',
    type: 'pct',
    width: 65,
  },

  pct_22d: {
    key: 'pct_22d',
    label: 'Pct 22D',
    tooltip: '22-day price return % — DB-computed via LAG(close,21) (migration 111). Breakout Surge Daily only.',
    type: 'pct',
    width: 65,
  },

  pct_66d: {
    key: 'pct_66d',
    label: 'Pct 66D',
    tooltip: '66-day price return % — DB-computed via LAG(close,65) (migration 111). Breakout Surge Daily only.',
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
    tooltip: 'Stock-level conviction over ~1 week: how strongly delivery money is running above its own norm (squared, ×25). High = real money arriving. NOTE: stock scores run 0–300; index scores use a different formula (0–80) — do not compare across the two.',
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
    tooltip: 'Stock-level conviction over ~1 month. Compare with Score 5D: a higher 5D score means money flow is accelerating recently.',
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
    tooltip: 'Stock-level conviction over ~3 months — the long-baseline view of delivery money.',
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
  if (cfg.formatFn) return cfg.formatFn(val, _row)
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
