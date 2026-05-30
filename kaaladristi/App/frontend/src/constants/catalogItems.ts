import type { BlockType, PlacementType, ChartOverlayType, DataSourceType } from './frameworkConstants'

export interface CatalogItem {
  id: string                        // canonical, stable identifier
  display_name: string
  description: string
  block_type: BlockType
  placement: PlacementType
  data_source: DataSourceType
  overlay_type?: ChartOverlayType   // only when placement = 'chart_overlay'
  // Array when column exists in multiple tables; omit for api/computed items
  db_table?: ('km_equity_eod' | 'km_index_eod' | 'km_index_15m' | 'km_equity_15m')[]
  db_column?: string                // canonical column name — never use legacy aliases
  config_schema?: Record<string, unknown>
  applicable_to: ('equity' | 'index')[]
  tier_required: 'free' | 'paid'
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
    tier_required: 'free',
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
    tier_required: 'free',
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
    tier_required: 'free',
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
