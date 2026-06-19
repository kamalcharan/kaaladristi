import type {
  BlockType, PlacementType, ChartOverlayType, AddedByType, TierType
} from '@/constants/frameworkConstants'

export interface GridPosition {
  col_start: number   // 1–12
  col_end: number
  row_start: number   // 1–10
  row_end: number
}

export interface InstrumentRef {
  symbol: string
  id: number
  type: 'index' | 'equity'
}

export interface FrameworkBlock {
  id: string
  type: BlockType
  catalog_item_id: string
  placement: PlacementType
  grid_position: GridPosition
  config: Record<string, unknown>
  added_by: AddedByType
  added_at: string
}

export interface ChartOverlay {
  catalog_item_id: string
  type: ChartOverlayType
  visible: boolean
  color?: string
  opacity?: number  // 0–1, applied to astro zone fills; default tier-specific
  label?: string    // clean display label; set at add-time for astro rules
  config?: Record<string, unknown>  // overlay-specific settings (e.g. show_ordinal for gann_sq9)
}

export interface UserFramework {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  version: number
  instruments: string[]
  blocks: FrameworkBlock[]
  chart_overlays: ChartOverlay[]
  template_id?: string
  tier_at_creation: TierType
}

export type PartialFramework = Partial<UserFramework> & { id: string }
