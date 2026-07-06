// Block types — add new types here only, never inline
export const BLOCK_TYPES = [
  'indicator', 'widget', 'scanner', 'astro_rule', 'vani_correlation', 'chart'
] as const
export type BlockType = typeof BLOCK_TYPES[number]

// Placement types
export const PLACEMENT_TYPES = [
  'chart_overlay', 'panel_block', 'output_panel'
] as const
export type PlacementType = typeof PLACEMENT_TYPES[number]

// Chart overlay types
export const CHART_OVERLAY_TYPES = [
  'astro_zone', 'astro_marker', 'indicator_line', 'indicator_band'
] as const
export type ChartOverlayType = typeof CHART_OVERLAY_TYPES[number]

// Data source types — how a catalog item gets its data
export const DATA_SOURCE_TYPES = [
  'db_column', 'computed_ts', 'api_endpoint', 'rule_engine'
] as const
export type DataSourceType = typeof DATA_SOURCE_TYPES[number]

// Astro rule overlay types — derived from rule_discovery.py TRANSIT_GROUPED_TYPES
export const RANGE_RULE_TYPES = [
  'planet_transit', 'planet_state', 'planet_conjunction', 'vedh', 'planet_manifestation'
] as const
export const POINT_RULE_TYPES = [
  'nakshatra_vara', 'tithi_alone', 'eclipse', 'compound'
] as const

// Tier types
export const TIER_TYPES = [
  'free', 'trial', 'quarterly', 'annual', 'beta'
] as const
export type TierType = typeof TIER_TYPES[number]
export const PAID_TIERS: TierType[] = ['trial', 'quarterly', 'annual', 'beta']

// Added-by types
export const ADDED_BY_TYPES = ['user', 'vani'] as const
export type AddedByType = typeof ADDED_BY_TYPES[number]

// ── Default chart lens ────────────────────────────────────────────
// Owner decision 2026-07-07: charts have NO hardcoded lines — they draw
// exactly what the framework says, on every Study surface. New users (empty
// chart_overlays) are seeded with this classic set as REMOVABLE overlays so
// a fresh chart still reads familiar. Shape matches ChartOverlay
// (types/framework.ts) — declared structurally to avoid a circular import.
export const DEFAULT_CHART_OVERLAYS: Array<{
  catalog_item_id: string
  type: 'indicator_line'
  visible: boolean
  label: string
}> = [
  { catalog_item_id: 'sma_50',     type: 'indicator_line', visible: true, label: 'SMA 50' },
  { catalog_item_id: 'sma_150',    type: 'indicator_line', visible: true, label: 'SMA 150' },
  { catalog_item_id: 'sma_200',    type: 'indicator_line', visible: true, label: 'SMA 200' },
  { catalog_item_id: 'supertrend', type: 'indicator_line', visible: true, label: 'SuperTrend' },
]
