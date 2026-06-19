import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceCanvas from '@/components/domain/Workspace/WorkspaceCanvas'
import CorrelationDrawer from '@/components/domain/Workspace/CorrelationDrawer'
import VaNiMorningBrief, { useMorningBriefAutoShow } from '@/components/workspace/VaNiMorningBrief'

type ActiveTab = 'today' | 'discovery' | 'myspace'

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDateChip(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')} ${_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { framework, isLoading, error, loadFramework, vaniCorrelations } = useFrameworkStore()

  const icpMode = profile?.icp_mode ?? 'astro'
  const [activeTab, setActiveTab] = useState<ActiveTab>(icpMode === 'technical' ? 'discovery' : 'today')

  const [drawerOpen, setDrawerOpen]             = useState(false)
  const [activePairKey, setActivePairKey]       = useState<string | null>(null)
  const [betaBarDismissed, setBetaBarDismissed] = useState(false)
  const [morningModalOpen, setMorningModalOpen] = useState(false)
  const { shouldShow: autoShowMorning, dismiss: dismissMorning } = useMorningBriefAutoShow(profile?.id)

  const isBeta = profile?.tier === 'beta'
  const todayDisplay = fmtDateChip(new Date())

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

      {/* ── Tab bar ── */}
      <nav style={{
        display: 'flex', alignItems: 'stretch', height: 44, flexShrink: 0,
        background: 'var(--card-soft)', borderBottom: '1px solid var(--border)',
        padding: '0 20px', position: 'sticky', top: 48, zIndex: 39,
      }}>
        {(['today', 'discovery', 'myspace'] as const).map((tab) => {
          const labels: Record<ActiveTab, string> = { today: 'Today', discovery: 'Discovery', myspace: 'My Space' }
          const icons:  Record<ActiveTab, string> = { today: '◐', discovery: '⊙', myspace: '⊞' }
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '0 20px', border: 'none', background: 'transparent',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: active ? 500 : 400,
                fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              <span style={{ fontSize: 12, opacity: 0.7 }}>{icons[tab]}</span>
              {labels[tab]}
              {tab === 'today' && icpMode === 'astro' && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0, display: 'inline-block' }} />
              )}
            </button>
          )
        })}

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* AtmosphericBadge — not yet a standalone component; placeholder until Step 4.9 */}
          <div className="atmospheric-placeholder" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {todayDisplay}
          </span>
        </div>
      </nav>

      {/* ── Tab panels ── */}

      {activeTab === 'today' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {/* Step 4.5 will fill this */}
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Today tab — coming in Step 4.5</div>
        </div>
      )}

      {activeTab === 'discovery' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {/* Step 4.6 will fill this */}
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Discovery tab — coming in Step 4.6</div>
        </div>
      )}

      {activeTab === 'myspace' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* VaNi Morning Brief — not moved/changed until Step 4.7 */}
          <div style={{ flexShrink: 0, padding: '0 20px 4px' }}>
            <VaNiMorningBrief
              modalOpen={morningModalOpen}
              onModalOpen={() => setMorningModalOpen(true)}
              onModalClose={() => { setMorningModalOpen(false); dismissMorning() }}
            />
          </div>
          {/* WorkspaceCanvas — not modified until Step 4.7 */}
          <WorkspaceCanvas
            framework={framework!}
            onOpenDrawer={openDrawer}
            onMorningBrief={() => setMorningModalOpen(true)}
            islandOffset={isBeta && !betaBarDismissed ? 36 : 0}
          />
        </div>
      )}

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
