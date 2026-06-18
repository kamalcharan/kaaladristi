import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceCanvas from '@/components/domain/Workspace/WorkspaceCanvas'
import CorrelationDrawer from '@/components/domain/Workspace/CorrelationDrawer'
import VaNiMorningBrief, { useMorningBriefAutoShow } from '@/components/workspace/VaNiMorningBrief'

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { framework, isLoading, error, loadFramework, vaniCorrelations } = useFrameworkStore()

  const [drawerOpen, setDrawerOpen]             = useState(false)
  const [activePairKey, setActivePairKey]       = useState<string | null>(null)
  const [betaBarDismissed, setBetaBarDismissed] = useState(false)
  const [morningModalOpen, setMorningModalOpen] = useState(false)
  const { shouldShow: autoShowMorning, dismiss: dismissMorning } = useMorningBriefAutoShow(profile?.id)

  const isBeta = profile?.tier === 'beta'

  // Auto-show morning modal once per day
  useEffect(() => {
    if (autoShowMorning) setMorningModalOpen(true)
  }, [autoShowMorning])

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
    return <Navigate to="/setup" replace />
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
              color: 'var(--text-faint)', letterSpacing: '.05em' }}>
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
                background: 'var(--caution-bg)',
                border: '1px solid var(--caution-dim)',
                color: 'var(--caution)',
                fontFamily: 'var(--font-mono,monospace)',
                cursor: 'default',
                letterSpacing: '.04em',
              }}>
              β · Beta Access
            </div>
          )}

          {/* VaNi confluence pills */}
          {vaniCorrelations.slice(0, 4).map(c => {
            const key    = `${c.item_a}:${c.item_b}`
            const active = c.currently_active
            return (
              <button
                key={key}
                onClick={() => openDrawer(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px', borderRadius: 20, fontSize: 11,
                  background: active ? 'var(--accent-dim)' : 'var(--accent-glow)',
                  border: `1px solid ${active ? 'var(--caution)' : 'var(--accent-dim)'}`,
                  color: active ? 'var(--caution)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono,monospace)',
                  cursor: 'pointer',
                  transition: 'border-color .2s, color .2s',
                }}>
                <span style={{ fontSize: 9, color: 'var(--accent)' }}>✦</span>
                {fmtId(c.item_a)} ∩ {fmtId(c.item_b)} · {c.n_instances}×
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--caution)', boxShadow: '0 0 5px var(--caution)',
                    display: 'inline-block' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* VaNi Morning Brief — pinned above canvas, non-block, session-computed */}
      <div style={{ flexShrink: 0, padding: '0 20px 4px' }}>
        <VaNiMorningBrief
          modalOpen={morningModalOpen}
          onModalOpen={() => setMorningModalOpen(true)}
          onModalClose={() => {
            setMorningModalOpen(false)
            dismissMorning()
          }}
        />
      </div>

      {/* Canvas */}
      <WorkspaceCanvas framework={framework!} onOpenDrawer={openDrawer} onMorningBrief={() => setMorningModalOpen(true)} islandOffset={isBeta && !betaBarDismissed ? 36 : 0} />

      {/* Correlation Drawer */}
      <CorrelationDrawer
        isOpen={drawerOpen}
        activePairKey={activePairKey}
        onClose={() => setDrawerOpen(false)}
        onSelectPair={setActivePairKey}
      />

      {/* Beta footer bar — fixed to bottom, session-dismissable, beta tier only */}
      {isBeta && !betaBarDismissed && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '0 20px',
          zIndex: 60,
          background: 'var(--caution-bg)',
          borderTop: '1px solid var(--caution-dim)',
          fontSize: 12, color: 'var(--caution)',
        }}>
          <span>Beta Access — free until public launch. You'll be notified before anything changes.</span>
          <button
            onClick={() => setBetaBarDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--caution)', opacity: .5, padding: 2,
              display: 'flex', alignItems: 'center' }}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
