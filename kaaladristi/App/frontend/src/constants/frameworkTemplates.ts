import type { FrameworkBlock, ChartOverlay, InstrumentRef } from '@/types/framework'

export interface FrameworkTemplate {
  id: string
  display_name: string
  icp: 'investor' | 'trader' | 'hybrid_weighted' | 'hybrid_balanced'
  blocks: Omit<FrameworkBlock, 'id' | 'added_at'>[]
  chart_overlays: ChartOverlay[]
}

// ── Shared chart block — NIFTY50, left 16 columns (24-col grid) ──────────────
// All positions use 24×20 grid coordinates (old × 2 − 1).

const NIFTY50_REF: InstrumentRef = { symbol: 'NIFTY50', id: 1, type: 'index' }

const CHART_BLOCK: Omit<FrameworkBlock, 'id' | 'added_at'> = {
  type: 'chart',
  catalog_item_id: 'chart:1',
  placement: 'panel_block',
  grid_position: { col_start: 1, col_end: 17, row_start: 1, row_end: 19 },
  config: { instrument: NIFTY50_REF },
  added_by: 'vani',
}

// ── Investor ──────────────────────────────────────────────────────────────────
// MagicRS + Panchak panel (current status) + Six-Day Outlook + Conviction Flow
// Panchak also lives in chart_overlays as an astro_zone shading the price chart.

const INVESTOR: FrameworkTemplate = {
  id: 'vani_investor',
  display_name: 'Investor',
  icp: 'investor',
  blocks: [
    CHART_BLOCK,
    {
      type: 'widget',
      catalog_item_id: 'magic_rs',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 1, row_end: 7 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'astro_rule',
      catalog_item_id: 'astro_rule:panchak',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 7, row_end: 13 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'six_day_outlook',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 13, row_end: 19 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'scanner',
      catalog_item_id: 'conviction_flow',
      placement: 'output_panel',
      grid_position: { col_start: 1, col_end: 9, row_start: 17, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'chart_player',
      placement: 'panel_block',
      grid_position: { col_start: 1, col_end: 25, row_start: 21, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
  ],
  chart_overlays: [
    { catalog_item_id: 'astro_rule:panchak', type: 'astro_zone', visible: true },
  ],
}

// ── Trader ────────────────────────────────────────────────────────────────────
// EMA 20 + SMA 50 (both chart overlays) + RSI 14 + Breadth ROC + Conviction Flow

const TRADER: FrameworkTemplate = {
  id: 'vani_trader',
  display_name: 'Trader',
  icp: 'trader',
  blocks: [
    CHART_BLOCK,
    {
      type: 'indicator',
      catalog_item_id: 'rsi_14',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 1, row_end: 7 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'breadth_roc',
      placement: 'panel_block',
      grid_position: { col_start: 9, col_end: 25, row_start: 17, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'scanner',
      catalog_item_id: 'conviction_flow',
      placement: 'output_panel',
      grid_position: { col_start: 1, col_end: 9, row_start: 17, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'chart_player',
      placement: 'panel_block',
      grid_position: { col_start: 1, col_end: 25, row_start: 21, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
  ],
  chart_overlays: [
    { catalog_item_id: 'ema_20', type: 'indicator_line', visible: true },
    { catalog_item_id: 'sma_50', type: 'indicator_line', visible: true },
  ],
}

// ── Hybrid Weighted (70/30+ Investor) ─────────────────────────────────────────
// All 6 blocks: EMA 20 + MagicRS + Panchak + Conviction Flow + Breadth ROC + Six-Day Outlook

const HYBRID_WEIGHTED: FrameworkTemplate = {
  id: 'vani_hybrid_weighted',
  display_name: 'Hybrid (Investor-leaning)',
  icp: 'hybrid_weighted',
  blocks: [
    CHART_BLOCK,
    {
      type: 'widget',
      catalog_item_id: 'magic_rs',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 1, row_end: 7 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'six_day_outlook',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 13, row_end: 19 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'scanner',
      catalog_item_id: 'conviction_flow',
      placement: 'output_panel',
      grid_position: { col_start: 1, col_end: 9, row_start: 17, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'breadth_roc',
      placement: 'panel_block',
      grid_position: { col_start: 9, col_end: 25, row_start: 17, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
  ],
  chart_overlays: [
    { catalog_item_id: 'ema_20', type: 'indicator_line', visible: true },
    { catalog_item_id: 'astro_rule:panchak', type: 'astro_zone', visible: true },
  ],
}

// ── Hybrid Balanced (50/50) ───────────────────────────────────────────────────
// 3 astro: Panchak (overlay) + Six-Day Outlook + MagicRS
// 3 technical: EMA 20 (overlay) + RSI 14 + Breadth ROC

const HYBRID_BALANCED: FrameworkTemplate = {
  id: 'vani_hybrid_balanced',
  display_name: 'Hybrid (Balanced)',
  icp: 'hybrid_balanced',
  blocks: [
    CHART_BLOCK,
    {
      type: 'widget',
      catalog_item_id: 'magic_rs',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 1, row_end: 7 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'indicator',
      catalog_item_id: 'rsi_14',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 7, row_end: 13 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'six_day_outlook',
      placement: 'panel_block',
      grid_position: { col_start: 17, col_end: 25, row_start: 13, row_end: 19 },
      config: {},
      added_by: 'vani',
    },
    {
      type: 'widget',
      catalog_item_id: 'breadth_roc',
      placement: 'panel_block',
      grid_position: { col_start: 9, col_end: 25, row_start: 17, row_end: 23 },
      config: {},
      added_by: 'vani',
    },
  ],
  chart_overlays: [
    { catalog_item_id: 'ema_20', type: 'indicator_line', visible: true },
    { catalog_item_id: 'astro_rule:panchak', type: 'astro_zone', visible: true },
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const FRAMEWORK_TEMPLATES: FrameworkTemplate[] = [
  INVESTOR,
  TRADER,
  HYBRID_WEIGHTED,
  HYBRID_BALANCED,
]

export const TEMPLATE_MAP: Record<string, FrameworkTemplate> = Object.fromEntries(
  FRAMEWORK_TEMPLATES.map(t => [t.id, t])
)

/**
 * Maps ICP answer + optional blend slider value to the right starter template.
 * blend is the Investor % (10–90). blend >= 70 → weighted, else → balanced.
 */
export function getTemplateForICP(
  icp: 'investor' | 'trader' | 'both',
  blend?: number
): FrameworkTemplate {
  if (icp === 'investor') return INVESTOR
  if (icp === 'trader') return TRADER
  // 'both'
  return (blend ?? 50) >= 70 ? HYBRID_WEIGHTED : HYBRID_BALANCED
}
