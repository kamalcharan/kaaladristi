import { create } from 'zustand'
import { useThemeStore } from '@/stores/themeStore'
import type { UserFramework, FrameworkBlock, ChartOverlay, GridPosition, InstrumentRef } from '@/types/framework'
import type { CatalogItem } from '@/constants/catalogItems'
import { getCatalogItem } from '@/constants/catalogItems'
import type { FrameworkTemplate } from '@/constants/frameworkTemplates'
import { useAuthStore } from '@/stores/authStore'
import { onAuthStateChange } from '@/services/auth'
import type { CorrelationResult } from '@/hooks/useCorrelationResult'

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Debounce ──────────────────────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(saveFn: () => Promise<void>) {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => { saveFn() }, 800)
}

// ── VaNi correlation suppression — 24hr session-level map ─────────────────────

const _suppressedUntil = new Map<string, number>()

function isSuppressed(key: string): boolean {
  const t = _suppressedUntil.get(key)
  return t !== undefined && Date.now() < t
}

function suppress(key: string) {
  _suppressedUntil.set(key, Date.now() + 24 * 60 * 60 * 1000)
}

// ── Default framework ─────────────────────────────────────────────────────────

function makeDefault(userId: string): Omit<UserFramework, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    name: 'My Framework',
    version: 1,
    instruments: ['NIFTY50'],
    blocks: [],
    chart_overlays: [],
    tier_at_creation: 'free',
  }
}

// ── Next grid position — appends to right sidebar (cols 9-12) ────────────────

function nextGridPosition(blocks: FrameworkBlock[]): GridPosition {
  const nonChart = blocks.filter(b => b.type !== 'chart')
  const maxRow = nonChart.reduce((m, b) => Math.max(m, b.grid_position.row_end), 1)
  return { col_start: 17, col_end: 25, row_start: maxRow, row_end: maxRow + 6 }
}

// ── Default NIFTY50 chart block for bootstrap ─────────────────────────────────

function makeDefaultChartBlock(): FrameworkBlock {
  return {
    id: crypto.randomUUID(),
    type: 'chart',
    catalog_item_id: 'chart:1',
    placement: 'panel_block',
    grid_position: { col_start: 1, col_end: 17, row_start: 1, row_end: 19 },
    config: { instrument: { symbol: 'NIFTY50', id: 1, type: 'index' } as InstrumentRef },
    added_by: 'vani',
    added_at: new Date().toISOString(),
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface VaNiCorrelation extends CorrelationResult {
  item_a: string
  item_b: string
}

interface FrameworkStore {
  framework: UserFramework | null
  isLoading: boolean
  isSaving: boolean
  error: string | null

  // ── VaNi correlations — session-only, not persisted ──────────────────────
  vaniCorrelations: VaNiCorrelation[]
  addVaNiCorrelation: (item_a: string, item_b: string, result: CorrelationResult) => void
  dismissVaNiCorrelation: (item_a: string, item_b: string) => void

  loadFramework: (userId: string) => Promise<void>
  saveFramework: () => Promise<void>
  addBlock: (item: CatalogItem, config?: Record<string, unknown>) => void
  removeBlock: (blockId: string) => void
  updateBlockPosition: (blockId: string, position: GridPosition) => void
  addOverlay: (item: CatalogItem, color?: string) => void
  removeOverlay: (catalogItemId: string) => void
  toggleOverlayVisibility: (catalogItemId: string) => void
  updateOverlayColor: (catalogItemId: string, color: string) => void
  updateOverlayOpacity: (catalogItemId: string, opacity: number) => void
  updateOverlayConfig: (catalogItemId: string, config: Record<string, unknown>) => void
  addChartBlock: (instrument: InstrumentRef) => void
  switchPrimaryIndex: (instrument: InstrumentRef) => void
  addInstrument: (symbol: string) => void
  removeInstrument: (symbol: string) => void
  isBlockActive: (catalogItemId: string) => boolean
  isOverlayActive: (catalogItemId: string) => boolean
  applyTemplate: (template: FrameworkTemplate) => void
}

export const useFrameworkStore = create<FrameworkStore>((set, get) => ({
  framework: null,
  isLoading: false,
  isSaving: false,
  error: null,

  // ── VaNi correlations ─────────────────────────────────────────────────────
  vaniCorrelations: [],

  addVaNiCorrelation: (item_a, item_b, result) => {
    const key = `${item_a}:${item_b}`
    if (isSuppressed(key)) return
    if (get().vaniCorrelations.some(c => c.item_a === item_a && c.item_b === item_b)) return
    suppress(key)
    set(s => ({ vaniCorrelations: [...s.vaniCorrelations, { ...result, item_a, item_b }] }))
  },

  dismissVaNiCorrelation: (item_a, item_b) => {
    set(s => ({
      vaniCorrelations: s.vaniCorrelations.filter(c => !(c.item_a === item_a && c.item_b === item_b)),
    }))
  },

  // ── Load ───────────────────────────────────────────────────────────────────

  loadFramework: async (userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${pipelineUrl}/api/framework/${userId}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      const data: UserFramework = raw

      // Sync tier, expires_at, and theme prefs into authStore profile so
      // gates, badges, and theme all reflect the latest server state.
      const { profile, setProfile } = useAuthStore.getState()
      if (profile && (raw.tier !== undefined || raw.expires_at !== undefined || raw.theme !== undefined)) {
        const updated = {
          ...profile,
          tier:       raw.tier       ?? profile.tier,
          expires_at: raw.expires_at ?? profile.expires_at,
          theme:      raw.theme      ?? profile.theme,
        }
        setProfile(updated)
        // Apply theme from server — overrides any localStorage state
        if (raw.theme !== undefined) {
          useThemeStore.getState().setTheme(raw.theme as any)
        }
      }

      // Deduplicate chart blocks: keep only one per catalog_item_id (largest by area).
      // Fixes corrupt saved state from before the addChartBlock positioning fix.
      const chartGroups = new Map<string, FrameworkBlock>()
      for (const b of data.blocks) {
        if (b.type !== 'chart') continue
        const existing = chartGroups.get(b.catalog_item_id)
        if (!existing) { chartGroups.set(b.catalog_item_id, b); continue }
        const areaA = (existing.grid_position.col_end - existing.grid_position.col_start) *
                      (existing.grid_position.row_end - existing.grid_position.row_start)
        const areaB = (b.grid_position.col_end - b.grid_position.col_start) *
                      (b.grid_position.row_end - b.grid_position.row_start)
        if (areaB > areaA) chartGroups.set(b.catalog_item_id, b)
      }
      const deduped = [
        ...data.blocks.filter(b => b.type !== 'chart'),
        ...Array.from(chartGroups.values()),
      ]
      const needsSave = deduped.length !== data.blocks.length

      // One-time migration: inject missing base overlays for sub-rule overlays.
      // e.g. PNK-IND-BUL stored without PNK-ALL5-BUL → inject PNK-ALL5-BUL silently.
      const BASE_RULE_MAP_STORE: Record<string, { id: string; color: string; label: string }> = {
        'PNK-ALL5-BUL': { id: 'astro_rule:PNK-ALL5-BUL', color: '#6366f1', label: 'Panchak' },
        'PNK-ALL5-BEA': { id: 'astro_rule:PNK-ALL5-BEA', color: '#6366f1', label: 'Panchak' },
      }
      const BASE_SUB_PREFIXES = ['PNK']
      const baseOverlaysToInject: ChartOverlay[] = []
      for (const o of data.chart_overlays) {
        const code = o.catalog_item_id.replace('astro_rule:', '')
        const prefix = code.split('-')[0]
        if (!BASE_SUB_PREFIXES.includes(prefix)) continue
        if (Object.keys(BASE_RULE_MAP_STORE).includes(code)) continue  // is already a base
        const baseId = `astro_rule:${prefix}-ALL5-BUL`
        const alreadyPresent = data.chart_overlays.some(x => x.catalog_item_id === baseId)
        const alreadyQueued  = baseOverlaysToInject.some(x => x.catalog_item_id === baseId)
        if (!alreadyPresent && !alreadyQueued) {
          baseOverlaysToInject.push({
            catalog_item_id: baseId,
            type:            'astro_zone',
            visible:         true,
            color:           '#6366f1',
            label:           'Panchak',
          })
        }
      }
      if (baseOverlaysToInject.length > 0) {
        data.chart_overlays = [...baseOverlaysToInject, ...data.chart_overlays]
      }
      const needsBaseSave = baseOverlaysToInject.length > 0

      // Bootstrap: inject NIFTY50 chart block if none present
      if (!deduped.some(b => b.type === 'chart')) {
        data.blocks = [...deduped, makeDefaultChartBlock()]
        set({ framework: data, isLoading: false })
        const { saveFramework } = get()
        scheduleSave(saveFramework)
      } else {
        data.blocks = deduped
        set({ framework: data, isLoading: false })
        if (needsSave || needsBaseSave) {
          const { saveFramework } = get()
          scheduleSave(saveFramework)
        }
      }
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  // ── Save (called by debounce — never call directly from mutation actions) ──

  saveFramework: async () => {
    const { framework } = get()
    if (!framework) return
    set({ isSaving: true })
    try {
      const res = await fetch(`${pipelineUrl}/api/framework/${framework.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(framework),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated: UserFramework = await res.json()
      // Sync server-assigned version + updated_at back into local state
      set(s => ({
        isSaving: false,
        framework: s.framework ? { ...s.framework, version: updated.version, updated_at: updated.updated_at } : null,
      }))
    } catch (err) {
      set({ isSaving: false, error: String(err) })
    }
  },

  // ── Block mutations ────────────────────────────────────────────────────────

  addBlock: (item: CatalogItem, config: Record<string, unknown> = {}) => {
    const { framework, saveFramework } = get()
    if (!framework) return

    // Idempotent — don't add the same catalog item twice
    if (framework.blocks.some(b => b.catalog_item_id === item.id)) return

    const block: FrameworkBlock = {
      id: crypto.randomUUID(),
      type: item.block_type,
      catalog_item_id: item.id,
      placement: item.placement,
      grid_position: nextGridPosition(framework.blocks),
      config,
      added_by: 'user',
      added_at: new Date().toISOString(),
    }

    set(s => ({
      framework: s.framework
        ? { ...s.framework, blocks: [...s.framework.blocks, block], version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  removeBlock: (blockId: string) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? { ...s.framework, blocks: s.framework.blocks.filter(b => b.id !== blockId), version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  updateBlockPosition: (blockId: string, position: GridPosition) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? {
            ...s.framework,
            blocks: s.framework.blocks.map(b => b.id === blockId ? { ...b, grid_position: position } : b),
            version: s.framework.version + 1,
          }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  // ── Overlay mutations ──────────────────────────────────────────────────────

  addOverlay: (item: CatalogItem, color?: string) => {
    const { framework, saveFramework } = get()
    if (!framework) return

    // Idempotent
    if (framework.chart_overlays.some(o => o.catalog_item_id === item.id)) return

    // overlay_type must be present for chart_overlay items — guaranteed by catalog
    const overlayType = item.overlay_type
    if (!overlayType) return

    const defaultConfig: Record<string, unknown> | undefined =
      item.id === 'gann_sq9' ? { show_ordinal: false } : undefined

    const overlay: ChartOverlay = {
      catalog_item_id: item.id,
      type: overlayType,
      visible: true,
      ...(color ? { color } : {}),
      ...(item.display_name ? { label: item.display_name } : {}),
      ...(defaultConfig ? { config: defaultConfig } : {}),
    }

    set(s => ({
      framework: s.framework
        ? { ...s.framework, chart_overlays: [...s.framework.chart_overlays, overlay], version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  removeOverlay: (catalogItemId: string) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? { ...s.framework, chart_overlays: s.framework.chart_overlays.filter(o => o.catalog_item_id !== catalogItemId), version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  toggleOverlayVisibility: (catalogItemId: string) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? {
            ...s.framework,
            chart_overlays: s.framework.chart_overlays.map(o =>
              o.catalog_item_id === catalogItemId ? { ...o, visible: !o.visible } : o
            ),
            version: s.framework.version + 1,
          }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  updateOverlayColor: (catalogItemId: string, color: string) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? {
            ...s.framework,
            chart_overlays: s.framework.chart_overlays.map(o =>
              o.catalog_item_id === catalogItemId ? { ...o, color } : o
            ),
            version: s.framework.version + 1,
          }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  updateOverlayOpacity: (catalogItemId: string, opacity: number) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? {
            ...s.framework,
            chart_overlays: s.framework.chart_overlays.map(o =>
              o.catalog_item_id === catalogItemId ? { ...o, opacity } : o
            ),
            version: s.framework.version + 1,
          }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  updateOverlayConfig: (catalogItemId: string, config: Record<string, unknown>) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? {
            ...s.framework,
            chart_overlays: s.framework.chart_overlays.map(o =>
              o.catalog_item_id === catalogItemId ? { ...o, config: { ...o.config, ...config } } : o
            ),
            version: s.framework.version + 1,
          }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  // ── Template application ───────────────────────────────────────────────────

  applyTemplate: (template: FrameworkTemplate) => {
    const { framework, saveFramework } = get()
    if (!framework) return
    const now = new Date().toISOString()
    const blocks: FrameworkBlock[] = template.blocks.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      added_by: 'vani' as const,
      added_at: now,
    }))
    set(s => ({
      framework: s.framework
        ? {
            ...s.framework,
            blocks,
            chart_overlays: template.chart_overlays,
            template_id: template.id,
            version: s.framework.version + 1,
          }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  // ── Chart block mutations ──────────────────────────────────────────────────

  addChartBlock: (instrument: InstrumentRef) => {
    const { framework, saveFramework } = get()
    if (!framework) return
    // Don't add if this instrument already has a chart block
    if (framework.blocks.some(b => b.type === 'chart' && b.catalog_item_id === `chart:${instrument.id}`)) return

    // Charts stack vertically in the chart zone (cols 1–17).
    // Find the lowest row_end among existing chart blocks, then start there.
    const chartBlocks = framework.blocks.filter(b => b.type === 'chart')
    const maxRowEnd = chartBlocks.reduce((m, b) => Math.max(m, b.grid_position.row_end), 1)

    // Each additional chart gets half the vertical space of the canvas (10 rows out of 20).
    // If this is the first chart added via addChartBlock (bootstrap already placed one),
    // we split the existing chart's rows and put the new one below.
    const newRowStart = Math.min(maxRowEnd, 19)   // cap to leave at least 1 row
    const newRowEnd   = 21                          // go to bottom

    // Also shrink the topmost chart so it doesn't cover the new chart's rows
    const updatedBlocks = framework.blocks.map(b => {
      if (b.type !== 'chart') return b
      // Only shrink if it would overlap the new chart's rows
      if (b.grid_position.row_end > newRowStart) {
        return { ...b, grid_position: { ...b.grid_position, row_end: newRowStart } }
      }
      return b
    })

    const block: FrameworkBlock = {
      id: crypto.randomUUID(),
      type: 'chart',
      catalog_item_id: `chart:${instrument.id}`,
      placement: 'panel_block',
      grid_position: { col_start: 1, col_end: 17, row_start: newRowStart, row_end: newRowEnd },
      config: { instrument },
      added_by: 'user',
      added_at: new Date().toISOString(),
    }
    set(s => ({
      framework: s.framework
        ? { ...s.framework, blocks: [...updatedBlocks, block], version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  switchPrimaryIndex: (instrument: InstrumentRef) => {
    const { saveFramework } = get()
    set(s => {
      if (!s.framework) return { framework: null }
      const blocks = s.framework.blocks.map(b => {
        if (b.type !== 'chart') return b
        return {
          ...b,
          catalog_item_id: `chart:${instrument.id}`,
          config: { instrument },
        }
      })
      return {
        framework: { ...s.framework, blocks, instruments: [instrument.symbol], version: s.framework.version + 1 },
      }
    })
    scheduleSave(saveFramework)
  },

  // ── Instrument mutations ───────────────────────────────────────────────────

  addInstrument: (symbol: string) => {
    const { framework, saveFramework } = get()
    if (!framework || framework.instruments.includes(symbol)) return
    set(s => ({
      framework: s.framework
        ? { ...s.framework, instruments: [...s.framework.instruments, symbol], version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  removeInstrument: (symbol: string) => {
    const { saveFramework } = get()
    set(s => ({
      framework: s.framework
        ? { ...s.framework, instruments: s.framework.instruments.filter(i => i !== symbol), version: s.framework.version + 1 }
        : null,
    }))
    scheduleSave(saveFramework)
  },

  // ── Derived active checks — O(1) via Set built on first access ────────────

  isBlockActive: (catalogItemId: string) => {
    const { framework } = get()
    if (!framework) return false
    return framework.blocks.some(b => b.catalog_item_id === catalogItemId)
  },

  isOverlayActive: (catalogItemId: string) => {
    const { framework } = get()
    if (!framework) return false
    return framework.chart_overlays.some(o => o.catalog_item_id === catalogItemId)
  },
}))

// Re-export getCatalogItem so callers can resolve items without a separate import
export { getCatalogItem }

// Reset all user-specific state on signout to prevent cross-user leakage
onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    _suppressedUntil.clear()
    useFrameworkStore.setState({
      framework: null,
      vaniCorrelations: [],
    })
  }
})
