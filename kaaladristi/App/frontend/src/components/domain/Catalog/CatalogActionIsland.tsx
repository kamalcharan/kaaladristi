import { useNavigate } from 'react-router-dom'
import { useFrameworkStore } from '@/stores/frameworkStore'

export default function CatalogActionIsland() {
  const navigate = useNavigate()
  const { framework, isSaving } = useFrameworkStore()

  const blockCount   = framework?.blocks.length ?? 0
  const overlayCount = framework?.chart_overlays.length ?? 0
  const hasItems     = blockCount > 0 || overlayCount > 0

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        // +110px: main sidebar (220px/2), +100px: catalog subnav (200px/2)
        transform: `translateX(calc(-50% + 210px)) translateY(${hasItems ? '0' : '80px'})`,
        opacity: hasItems ? 1 : 0,
        pointerEvents: hasItems ? 'auto' : 'none',
        transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease',
        background: 'var(--bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-strong, color-mix(in srgb, var(--text-primary) 18%, transparent))',
        borderRadius: 100,
        padding: '10px 12px 10px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: [
          '0 24px 60px rgba(0,0,0,0.65)',
          '0 0 0 1px rgba(124,106,247,0.18)',
          '0 8px 32px rgba(124,106,247,0.12)',
        ].join(', '),
        zIndex: 150,
      }}
    >
      {/* Summary */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono, monospace)',
        whiteSpace: 'nowrap',
      }}>
        {/* Saving pulse dot */}
        <span style={{
          display: 'inline-block',
          width: 6, height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          background: isSaving ? 'var(--caution)' : 'var(--bull)',
          opacity: isSaving ? 1 : 0.7,
          animation: isSaving ? 'pulse-live 1s infinite' : 'none',
          transition: 'background 0.3s',
        }} />

        <span>
          {blockCount > 0 && (
            <span style={{ color: 'var(--text-primary)' }}>
              {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
            </span>
          )}
          {blockCount > 0 && overlayCount > 0 && (
            <span style={{ color: 'color-mix(in srgb, var(--text-primary) 20%, transparent)', margin: '0 6px' }}>·</span>
          )}
          {overlayCount > 0 && (
            <span style={{ color: 'var(--text-primary)' }}>
              {overlayCount} {overlayCount === 1 ? 'overlay' : 'overlays'}
            </span>
          )}
          {isSaving && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>saving…</span>
          )}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: 'color-mix(in srgb, var(--text-primary) 15%, transparent)', flexShrink: 0 }} />

      {/* CTA */}
      <button
        onClick={() => navigate('/workspace')}
        style={{
          padding: '7px 18px',
          borderRadius: 100,
          border: 'none',
          background: 'linear-gradient(135deg,#7c6af7,#5b4fd4)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(124,106,247,0.4)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = 'translateY(-1px)'
          el.style.boxShadow = '0 6px 22px rgba(124,106,247,0.55)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = ''
          el.style.boxShadow = '0 4px 16px rgba(124,106,247,0.4)'
        }}
      >
        Open Workspace →
      </button>
    </div>
  )
}
