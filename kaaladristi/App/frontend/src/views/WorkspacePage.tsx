import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceCanvas from '@/components/domain/Workspace/WorkspaceCanvas'
import CorrelationDrawer from '@/components/domain/Workspace/CorrelationDrawer'

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { framework, isLoading, error, loadFramework, vaniCorrelations } = useFrameworkStore()

  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [activePairKey, setActivePairKey]   = useState<string | null>(null)
  const [betaBarDismissed, setBetaBarDismissed] = useState(false)

  const isBeta = profile?.tier === 'beta'

  const openDrawer = useCallback((key: string | null) => {
    setActivePairKey(key)
    setDrawerOpen(true)
  }, [])

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

  if (
    !isLoading && framework && framework.version === 1 &&
    framework.blocks.filter(b => b.type !== 'chart').length === 0 &&
    framework.chart_overlays.length === 0
  ) {
    return <Navigate to="/profile-setup" replace />
  }

  if (error && !framework) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--bg)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed to load framework.</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{ padding: '14px 20px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300,
              color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {framework!.name}
            </h1>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
              color: 'rgba(255,255,255,.2)', letterSpacing: '.05em' }}>
              v{framework!.version}
            </span>
          </div>

          {/* Beta badge */}
          {isBeta && (
            <div
              title="You're a founding member. Full access free until public launch."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20, fontSize: 11,
                background: 'rgba(245,158,11,.12)',
                border: '1px solid rgba(245,158,11,.35)',
                color: '#fcd34d',
                fontFamily: 'var(--font-mono,monospace)',
                cursor: 'default',
                letterSpacing: '.04em',
              }}>
              β · Beta Access
            </div>
          )}

          {/* VaNi confluence pills */}
          {vaniCorrelations.map(c => {
            const key    = `${c.item_a}:${c.item_b}`
            const active = c.currently_active
            return (
              <button
                key={key}
                onClick={() => openDrawer(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px', borderRadius: 20, fontSize: 11,
                  background: active ? 'rgba(139,92,246,.18)' : 'rgba(139,92,246,.06)',
                  border: `1px solid ${active ? '#f59e0b' : 'rgba(139,92,246,.2)'}`,
                  color: active ? '#fcd34d' : 'rgba(196,181,253,.5)',
                  fontFamily: 'var(--font-mono,monospace)',
                  cursor: 'pointer',
                  transition: 'border-color .2s, color .2s',
                }}>
                <span style={{ fontSize: 9, color: '#a78bfa' }}>✦</span>
                {fmtId(c.item_a)} ∩ {fmtId(c.item_b)} · {c.n_instances}×
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%',
                    background: '#f59e0b', boxShadow: '0 0 5px #f59e0b',
                    display: 'inline-block' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Canvas */}
      <WorkspaceCanvas framework={framework!} onOpenDrawer={openDrawer} />

      {/* Correlation Drawer */}
      <CorrelationDrawer
        isOpen={drawerOpen}
        activePairKey={activePairKey}
        onClose={() => setDrawerOpen(false)}
        onSelectPair={setActivePairKey}
      />

      {/* Beta footer bar — session-dismissable, beta tier only */}
      {isBeta && !betaBarDismissed && (
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '7px 20px',
          zIndex: 50,
          background: 'rgba(245,158,11,.07)',
          borderTop: '1px solid rgba(245,158,11,.2)',
          fontSize: 12, color: 'rgba(253,211,77,.7)',
        }}>
          <span>Beta Access — free until public launch. You'll be notified before anything changes.</span>
          <button
            onClick={() => setBetaBarDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(253,211,77,.4)', padding: 2, display: 'flex', alignItems: 'center' }}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
