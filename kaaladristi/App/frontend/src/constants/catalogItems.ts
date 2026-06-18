import type { BlockType, PlacementType, ChartOverlayType, DataSourceType } from './frameworkConstants'

export interface CatalogItem {
  id: string                        // canonical, stable identifier
  display_name: string
  description: string
  block_type: BlockType
  placement: PlacementType
  data_source: DataSourceType
  overlay_type?: ChartOverlayType   // only when placement = 'chart_overlay'
  color?: string                    // default overlay color hint (e.g. Panchak = indigo)
  // Array when column exists in multiple tables; omit for api/computed items
  db_table?: ('km_equity_eod' | 'km_index_eod' | 'km_index_15m' | 'km_equity_15m')[]
  db_column?: string                // canonical column name — never use legacy aliases
  config_schema?: Record<string, unknown>
  applicable_to: ('equity' | 'index')[]
  tier_required: 'free' | 'paid'
  vani_explanation?: string
  vani_tags?: Array<{ text: string; type: 'works' | 'limit' }>
}

// ── Indicators ────────────────────────────────────────────────────────────────
// placement: 'chart_overlay' unless noted

const INDICATORS: CatalogItem[] = [
  {
    id: 'ema_20',
    display_name: 'EMA 20',
    description: 'Exponential Moving Average (20-period). Short-term trend reference.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_line',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'ema_20',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "EMA 20 gives more weight to the last 20 sessions than older data, so it reacts faster to price changes than a simple moving average. Think of it as a short-term memory of the market — it tells you the recent direction without the noise of individual sessions. When price crosses above EMA 20, the short-term tide has turned.",
    vani_tags: [
      { text: 'Trending markets', type: 'works' },
      { text: 'Entry timing', type: 'works' },
      { text: 'Choppy sideways markets', type: 'limit' },
    ],
  },
  {
    id: 'ema_60',
    display_name: 'EMA 60',
    description: 'Exponential Moving Average (60-period). Intermediate trend reference.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_line',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'ema_60',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "EMA 60 is the bridge between short-term noise and medium-term trend. It moves slower than EMA 20 but faster than SMA 50, making it useful for identifying when the intermediate trend is changing direction. Popular with swing traders looking for a balance between responsiveness and stability.",
    vani_tags: [
      { text: 'Swing trading', type: 'works' },
      { text: 'Trend confirmation', type: 'works' },
      { text: 'Very short-term timing', type: 'limit' },
    ],
  },
  {
    id: 'sma_50',
    display_name: 'SMA 50',
    description: 'Simple Moving Average (50-period). Mid-term institutional reference.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_line',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'sma_50',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "SMA 50 is the line institutional desks watch most carefully on weekly timeframes. It acts as a gravitational reference — price tends to return to it in trending markets. Unlike EMA, it weighs every one of the last 50 sessions equally, so it moves more slowly and filters out short-term noise. If price is above SMA 50, the medium-term structure is intact.",
    vani_tags: [
      { text: 'Medium-term structure', type: 'works' },
      { text: 'Support/resistance', type: 'works' },
      { text: 'Short-term signals', type: 'limit' },
    ],
  },
  {
    id: 'sma_150',
    display_name: 'SMA 150 — Golden Line',
    description: 'Simple Moving Average (150-period). Primary trend filter used across all scans.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_line',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'sma_150',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "SMA 150 is DristiQ's primary trend filter — it's the line all internal scans use to classify whether the market is in a constructive phase or not. When Nifty is above SMA 150, scans weight bullish signals more heavily. When below, caution signals get priority. This is the most important line in your framework if you follow the system.",
    vani_tags: [
      { text: 'Primary trend filter', type: 'works' },
      { text: 'Scan classification', type: 'works' },
      { text: 'Timing entries', type: 'limit' },
    ],
  },
  {
    id: 'sma_200',
    display_name: 'SMA 200',
    description: 'Simple Moving Average (200-period). Long-term institutional trend reference.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_line',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'sma_200',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "SMA 200 is the most widely watched line in global equity markets. Fund managers, algorithms, and retail traders all reference it. When a major index trades below SMA 200, institutional risk models flag it as a structural concern. Its power comes from the fact that everyone is watching it — making it a self-fulfilling reference point.",
    vani_tags: [
      { text: 'Long-term structure', type: 'works' },
      { text: 'Institutional reference', type: 'works' },
      { text: 'Timing entries', type: 'limit' },
    ],
  },
  {
    id: 'rsi_14',
    display_name: 'RSI 14',
    description: 'Relative Strength Index (14-period). Momentum oscillator 0–100.',
    block_type: 'indicator',
    placement: 'panel_block',
    data_source: 'db_column',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'rsi_14',
    applicable_to: ['equity', 'index'],
    tier_required: 'paid',
  },
  {
    id: 'supertrend',
    display_name: 'SuperTrend',
    description: 'ATR-based trend-following overlay. Direction stored in supertrend_dir (1 = up, -1 = down).',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_line',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'supertrend',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "SuperTrend is a trend-following band built on ATR (volatility). It flips between two states — green below price means the trend is up, red above price means the trend is down. Unlike moving averages, it adjusts its distance from price based on how volatile the market is, so it stays closer in calm markets and wider in choppy ones.",
    vani_tags: [
      { text: 'Clear trend identification', type: 'works' },
      { text: 'Volatile markets', type: 'works' },
      { text: 'Sideways markets', type: 'limit' },
    ],
  },
  {
    id: 'pivot_levels',
    display_name: 'Pivot Levels',
    description: 'Daily pivot PP, R1–R3, S1–S3 support/resistance bands.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'db_column',
    overlay_type: 'indicator_band',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'pivot_pp',  // primary; renderer also reads pivot_r1/r2/r3, pivot_s1/s2/s3
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "Pivot levels are mathematically derived support and resistance zones calculated from the prior period's high, low, and close. They don't look at price history beyond one period — they simply define where the market statistically tends to find reaction points. Price doesn't always obey them, but it notices them.",
    vani_tags: [
      { text: 'Intraday reference', type: 'works' },
      { text: 'Short-term S/R', type: 'works' },
      { text: 'Trend following', type: 'limit' },
    ],
  },
  {
    id: 'atr_14',
    display_name: 'ATR 14',
    description: 'Average True Range (14-period). Volatility measure used for position sizing.',
    block_type: 'indicator',
    placement: 'panel_block',
    data_source: 'db_column',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'atr_14',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "ATR 14 measures how much Nifty moves on average over the last 14 sessions — pure volatility, no direction. When ATR is high, the market is making large swings. When low, it's in a compression phase. It doesn't tell you which way price will go, only how much room it typically takes to move.",
    vani_tags: [
      { text: 'Volatility context', type: 'works' },
      { text: 'Position sizing', type: 'works' },
      { text: 'Not directional', type: 'limit' },
    ],
  },
  {
    id: 'gann_sq9',
    display_name: 'Gann Square of 9',
    description: 'W.D. Gann price vibration levels — natural support and resistance from Square of 9 geometry. Draws horizontal bands on the price chart.',
    block_type: 'indicator',
    placement: 'chart_overlay',
    data_source: 'computed_ts',
    overlay_type: 'indicator_band',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'close',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: 'Gann Square of 9 calculates natural price vibration levels using square root geometry. Price tends to pause or reverse at these mathematical harmonics. Cardinal levels (90°, 180°, 270°, 360°) are strongest. Used by Gann practitioners alongside planetary timing for confluence.',
    vani_tags: [
      { text: 'Gann geometry', type: 'works' },
      { text: 'Computed from last close', type: 'works' },
      { text: 'Cardinal levels strongest', type: 'works' },
      { text: 'Reference only — not predictive', type: 'limit' },
    ],
  },
]

// ── Widgets ───────────────────────────────────────────────────────────────────

const WIDGETS: CatalogItem[] = [
  {
    id: 'magic_rs',
    display_name: 'MagicRS',
    description: 'Relative strength vs NIFTY 500. Zone: Strong Bull → Strong Bear. Proprietary KD signal.',
    block_type: 'widget',
    placement: 'panel_block',
    data_source: 'db_column',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'magic_rs',  // also reads magic_ma, magic_rs_zone — never legacy magicrs_value
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "MagicRS is DristiQ's proprietary relative strength signal. It measures how Nifty is moving relative to its own historical volatility rhythm — not against another index. A positive reading means Nifty is expressing more strength than its recent average. A negative reading means it's underperforming its own baseline. It's a mirror of the market's internal momentum, not a comparison to anything external.",
    vani_tags: [
      { text: 'Momentum context', type: 'works' },
      { text: 'Intraday + swing', type: 'works' },
      { text: 'Not a buy/sell signal', type: 'limit' },
    ],
  },
  {
    id: 'breadth_roc',
    display_name: 'Breadth ROC',
    description: 'Market breadth rate-of-change oscillator. roc_13 / roc_55 / sma_breadth.',
    block_type: 'widget',
    placement: 'panel_block',
    data_source: 'api_endpoint',
    config_schema: { endpoint: '/api/dashboard/composite' },
    applicable_to: ['index'],
    tier_required: 'free',
    vani_explanation: "Breadth ROC measures the rate of change in how many stocks are participating in a move. When Breadth ROC is rising, the advance is broadening — more stocks are joining. When it's falling, the move is narrowing to fewer names. A rising index with falling Breadth ROC is a divergence worth noting.",
    vani_tags: [
      { text: 'Market-wide participation', type: 'works' },
      { text: 'Divergence detection', type: 'works' },
      { text: 'Single stock analysis', type: 'limit' },
    ],
  },
  {
    id: 'smart_money',
    display_name: 'Smart Money',
    description: 'Institutional + hot-money activity derived from RSI_9. sniper_inst fires at RSI > 61.',
    block_type: 'widget',
    placement: 'panel_block',
    data_source: 'db_column',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'sniper_inst',  // also reads sniper_hot — never legacy sniper_banker / sniper_hotmoney
    applicable_to: ['equity', 'index'],
    tier_required: 'paid',
    vani_explanation: "Smart Money tracks institutional accumulation and distribution patterns on Nifty. It classifies volume into informed vs uninformed flow by looking at when and how blocks trade. When Smart Money is in accumulation, large participants are systematically absorbing supply. This is the signal that often precedes a sustained directional move.",
    vani_tags: [
      { text: 'Institutional flow', type: 'works' },
      { text: 'Swing context', type: 'works' },
      { text: 'Not real-time tick data', type: 'limit' },
    ],
  },
  {
    id: 'stage_2_watch',
    display_name: 'Stage 2 Watch',
    description: 'Stocks approaching Stage 2 breakout — MA stacking confirmed, SMA200 momentum building',
    block_type: 'scanner',
    placement: 'output_panel',
    data_source: 'api_endpoint',
    applicable_to: ['equity'],
    tier_required: 'free',
    vani_explanation: 'These stocks have completed the MA stacking pattern (price > SMA50 > SMA200) but SMA200 is not yet rising. VaNi watches these as Stage 2 launchpad candidates.',
  },
  {
    id: 'vani_opportunity',
    display_name: 'VaNi Opportunity',
    description: 'Highest conviction Stage 2 setups with top RS momentum',
    block_type: 'scanner',
    placement: 'output_panel',
    data_source: 'api_endpoint',
    applicable_to: ['equity'],
    tier_required: 'paid',
    vani_explanation: 'VaNi highest conviction list — confirmed Stage 2 structure with RS percentile >80. These stocks satisfy the full Alpha Edge formula and rank in the top 20% of relative strength.',
    vani_tags: [
      { text: 'Alpha Edge formula', type: 'works' },
      { text: 'RS percentile >80', type: 'works' },
      { text: 'Stage 2 confirmed', type: 'works' },
      { text: 'Top 25 only', type: 'limit' },
    ],
  },
  {
    id: 'conviction_flow',
    display_name: 'Conviction Flow',
    description: '5-day delivery surge vs 22-day baseline. Detects quiet institutional accumulation.',
    block_type: 'scanner',
    placement: 'output_panel',
    data_source: 'computed_ts',
    db_table: ['km_equity_eod'],
    db_column: 'delivery_qty',  // primary input; also uses close, value_cr, ema_20
    applicable_to: ['equity'],
    tier_required: 'paid',
    vani_explanation: "Conviction Flow compares the last 5-day delivery percentage against a 22-day rolling baseline. When delivery surges above baseline without a proportional price move, it flags quiet institutional accumulation — large participants taking positions before the market notices.",
    vani_tags: [
      { text: 'Institutional detection', type: 'works' },
      { text: 'Pre-move signal', type: 'works' },
      { text: 'Equity only', type: 'limit' },
    ],
  },
  {
    id: 'order_flow',
    display_name: 'Order Flow',
    description: 'Flow intelligence: flow_type, RVOL, vacuum detection, accum/distrib state.',
    block_type: 'widget',
    placement: 'panel_block',
    data_source: 'db_column',
    db_table: ['km_equity_eod', 'km_index_eod'],
    db_column: 'flow_type',  // also reads rvol, vacuum_flag, accum_distrib — never legacy aliases
    applicable_to: ['equity', 'index'],
    tier_required: 'paid',
    vani_explanation: "Order Flow classifies each session's volume into buyer-initiated vs seller-initiated transactions. When buyers are dominant, sessions close in the upper half of their range on rising volume. It tells you whether the tape is being driven by urgency to buy or urgency to sell — which is different from price direction alone.",
    vani_tags: [
      { text: 'Session context', type: 'works' },
      { text: 'Volume analysis', type: 'works' },
      { text: 'Not predictive alone', type: 'limit' },
    ],
  },
  {
    id: 'six_day_outlook',
    display_name: 'Six-Day Outlook',
    description: 'Astro signal forecast for the next 6 trading days from km_astro_daily_signal.',
    block_type: 'widget',
    placement: 'panel_block',
    data_source: 'api_endpoint',
    config_schema: { endpoint: '/api/astro/signals' },
    applicable_to: ['equity', 'index'],
    tier_required: 'paid',
    vani_explanation: "Six-Day Outlook is a forward astro calendar — it shows which of your active rules are firing across the next 6 trading days before they happen. This is the planning surface. Instead of reacting to what fired today, you see what's coming. It turns the astro signal layer from reactive to anticipatory.",
    vani_tags: [
      { text: 'Forward planning', type: 'works' },
      { text: 'Rule confluence preview', type: 'works' },
      { text: 'Not a trading calendar', type: 'limit' },
    ],
  },
  {
    id: 'stage_4_leaders',
    display_name: 'Stage 4 Leaders',
    description: 'Stocks in confirmed downtrend — below SMA50 and SMA200, death cross confirmed',
    block_type: 'scanner',
    placement: 'output_panel',
    data_source: 'api_endpoint',
    applicable_to: ['equity'],
    tier_required: 'paid',
    vani_explanation: 'Stage 4 Leaders are confirmed downtrend candidates: close < SMA50 < SMA200. Sorted by RS percentile ascending — weakest relative strength first. Not a sell recommendation; use for risk awareness and identifying stocks to avoid or hedge.',
    vani_tags: [
      { text: 'Death cross confirmed', type: 'works' },
      { text: 'Weakest RS first', type: 'works' },
      { text: 'Not a sell signal', type: 'limit' },
    ],
  },
  {
    id: 'stage_3_watch',
    display_name: 'Stage 3 Watch',
    description: 'Stocks entering weakness — above SMA200 but SMA50 converging toward death cross',
    block_type: 'scanner',
    placement: 'output_panel',
    data_source: 'api_endpoint',
    applicable_to: ['equity'],
    tier_required: 'paid',
    vani_explanation: 'Stage 3 Watch identifies stocks where SMA50 is converging toward SMA200 (gap < 15%). These are early-warning candidates — not yet in Stage 4 but showing structural deterioration. Sorted by convergence closeness to death cross.',
    vani_tags: [
      { text: 'Early warning', type: 'works' },
      { text: 'MA convergence signal', type: 'works' },
      { text: 'Confirm with price action', type: 'limit' },
    ],
  },
  {
    id: 'vani_exit_watch',
    display_name: 'VaNi Exit Watch',
    description: 'Highest conviction weakness — death cross confirmed with RS percentile below 20',
    block_type: 'scanner',
    placement: 'output_panel',
    data_source: 'api_endpoint',
    applicable_to: ['equity'],
    tier_required: 'paid',
    vani_explanation: 'VaNi Exit Watch is the short-side equivalent of VaNi Opportunity — Stage 4 confirmed, death cross active, RS percentile below 20. Bottom 25 weakest stocks by relative strength. Use for exit timing or hedge candidates; not a blanket sell recommendation.',
    vani_tags: [
      { text: 'RS percentile <20', type: 'works' },
      { text: 'Death cross confirmed', type: 'works' },
      { text: 'Bottom 25 only', type: 'works' },
      { text: 'Not a sell recommendation', type: 'limit' },
    ],
  },
  {
    id: 'chart_player',
    display_name: 'Historical Player',
    description: 'Timeline scrubber — play through history bar by bar. Syncs all workspace panels and the main chart.',
    block_type: 'widget',
    placement: 'panel_block',
    data_source: 'db_column',
    db_table: ['km_index_eod', 'km_equity_eod'],
    db_column: 'trade_date',
    applicable_to: ['equity', 'index'],
    tier_required: 'free',
    vani_explanation: "Historical Player turns your workspace into a time machine. Drag the scrubber to any past date and every panel — Order Flow, Smart Money, Magic RS, Breadth ROC — snaps to that moment. Use it to replay how signals looked the day before a major move, and build intuition without risk.",
    vani_tags: [
      { text: 'Replay any date', type: 'works' },
      { text: 'All panels sync', type: 'works' },
      { text: 'No live data while scrubbing', type: 'limit' },
    ],
  },
]

// ── Registry ──────────────────────────────────────────────────────────────────

export const CATALOG_ITEMS: CatalogItem[] = [...INDICATORS, ...WIDGETS]

export const CATALOG_MAP: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG_ITEMS.map(item => [item.id, item])
)

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG_MAP[id]
}

export function getCatalogItemsByType(blockType: BlockType): CatalogItem[] {
  return CATALOG_ITEMS.filter(item => item.block_type === blockType)
}

export function getCatalogItemsByPlacement(placement: PlacementType): CatalogItem[] {
  return CATALOG_ITEMS.filter(item => item.placement === placement)
}
