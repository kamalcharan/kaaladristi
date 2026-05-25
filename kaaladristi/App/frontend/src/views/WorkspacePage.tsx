import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceCanvas from '@/components/domain/Workspace/WorkspaceCanvas'
import { getCatalogItem } from '@/constants/catalogItems'

// ── Overlay strip ─────────────────────────────────────────────────────────────

function OverlayStrip() {
  const { framework, toggleOverlayVisibility } = useFrameworkStore()
  if (!framework || framework.chart_overlays.length === 0) return null

  const overlays = framework.chart_overlays

  const typeColor: Record<string, string> = {
    astro_zone:     '#c9a84c',
    astro_marker:   '#c9a84c',
    indicator_line: '#2dd4bf',
    indicator_band: '#2dd4bf',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 16px', borderBottom: '1px solid rgba(255,255,255,.05)',
      overflowX: 'auto', flexShrink: 0,
      // hide scrollbar
      scrollbarWidth: 'none',
    }}>
      {overlays.map(o => {
        const catalog = getCatalogItem(o.catalog_item_id)
        const label   = catalog?.display_name ?? o.catalog_item_id.replace('astro_rule:', '')
        const dot     = typeColor[o.type] ?? '#7c6af7'
        return (
          <button
            key={o.catalog_item_id}
            onClick={() => toggleOverlayVisibility(o.catalog_item_id)}
            title={o.visible ? 'Click to hide' : 'Click to show'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 100, flexShrink: 0,
              border: '1px solid rgba(255,255,255,.1)',
              background: o.visible ? 'rgba(255,255,255,.05)' : 'transparent',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
              color: o.visible ? 'var(--text-primary)' : 'rgba(255,255,255,.3)',
              opacity: o.visible ? 1 : 0.4,
              transition: 'all .15s',
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%',
              background: dot, flexShrink: 0,
              opacity: o.visible ? 1 : 0.4 }} />
            {label}
            <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>
              {o.visible ? '👁' : '👁‍🗨'}
            </span>
          </button>
        )
      })}

      {/* Stub: "+ overlay" — opens Catalog drawer in Phase 3 */}
      <button
        onClick={() => {/* Phase 3: open catalog drawer */}}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 100, flexShrink: 0,
          border: '1px dashed rgba(255,255,255,.1)', background: 'transparent',
          cursor: 'default', fontSize: 11,
          color: 'rgba(255,255,255,.2)', fontFamily: 'var(--font-mono, monospace)' }}>
        + overlay
      </button>
    </div>
  )
}

// ── WorkspacePage ─────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { framework, isLoading, error, loadFramework } = useFrameworkStore()

  useEffect(() => {
    if (!framework && profile?.id) {
      loadFramework(profile.id)
    }
  }, [framework, profile?.id, loadFramework])

  if (isLoading || (!framework && !error)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--bg)' }}>
        <Loader2 className="w-6 h-6 text-accent-indigo animate-spin" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your framework…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6"
        style={{ background: 'var(--bg)' }}>
        <div style={{ fontSize: 28, opacity: .4 }}>⚠</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textAlign: 'center', maxWidth: 280 }}>
          Could not load framework: {error}
        </p>
        <button
          onClick={() => profile?.id && loadFramework(profile.id)}
          style={{ padding: '8px 20px', borderRadius: 100, border: '1px solid rgba(255,255,255,.1)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 12, fontFamily: 'inherit' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300,
            color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {framework!.name}
          </h1>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: 'rgba(255,255,255,.2)', letterSpacing: '.05em' }}>
            v{framework!.version}
          </span>
        </div>
      </div>

      {/* Overlay pill strip */}
      <OverlayStrip />

      {/* Canvas */}
      <WorkspaceCanvas framework={framework!} />
    </div>
  )
}
