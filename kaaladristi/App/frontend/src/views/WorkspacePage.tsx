import { useEffect, useState, useMemo, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useVaNiStore } from '@/stores/vaniStore'
import { Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import WorkspaceToday from '@/components/workspace/WorkspaceToday'
import WorkspaceMarketMetrics from '@/components/workspace/WorkspaceMarketMetrics'
import PipelineHealthBar from '@/components/workspace/PipelineHealthBar'
import WorkspaceDiscovery from '@/components/workspace/WorkspaceDiscovery'
import AtmosphericBadge from '@/components/domain/AtmosphericBadge'
import MyBookmarksPanel from '@/components/domain/MyBookmarksPanel'
import TourLauncher from '@/components/ui/TourLauncher'
import { useTour } from '@/hooks/useTour'
import { useLocation } from 'react-router-dom'
import { markGuideWalked, tourRequest } from '@/services/guideProgress'
import { maybeRecordDay2Return } from '@/services/uxEvents'
import { buildWorkspaceTourSteps } from '@/config/tours/workspaceTour'

type ActiveTab = 'today' | 'discovery' | 'metrics' | 'bookmarks'

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDateChip(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')} ${_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { framework, isLoading, error, loadFramework } = useFrameworkStore()

  const icpMode = profile?.icp_mode ?? 'astro'
  const [activeTab, setActiveTab] = useState<ActiveTab>('today')

  // Tell VaNi which page it is on. /workspace is one route over four tabs, and
  // usePageContext maps by route alone — so every tab inherited `index_vp`,
  // which was designed for the former personal canvas. Today now uses the
  // market-structure context, while the other tabs receive matching intents.
  // Bookmarks retains its stock-level context; Market Metrics uses the broad
  // dashboard context for index and volatility questions.
  const setPageOverride = useVaNiStore((s) => s.setPageOverride)
  useEffect(() => {
    const byTab: Record<ActiveTab, 'dashboard' | 'index_vp' | 'market_structure'> = {
      today: 'market_structure',
      discovery: 'dashboard',   // SectorPulse — dashboard.rotation_overview
      metrics: 'dashboard',
      bookmarks: 'index_vp',
    }
    setPageOverride(byTab[activeTab])
    return () => setPageOverride(null)
  }, [activeTab, setPageOverride])

  const [betaBarDismissed, setBetaBarDismissed] = useState(false)

  const isBeta = profile?.tier === 'beta'
  const today        = new Date().toISOString().split('T')[0]
  const todayDisplay = fmtDateChip(new Date())

  // Auto-switch to Today tab once per day
  useEffect(() => {
    const key = `vani_today_shown:${profile?.id}:${today}`
    if (!localStorage.getItem(key)) {
      setActiveTab('today')
      localStorage.setItem(key, '1')
    }
  }, [profile?.id, today])

  // ── Explainer walk — auto-starts on first visit (after welcome-modal ack),
  //    replayable via the ? launcher in the tab bar ──
  const tourSteps = useMemo(() => buildWorkspaceTourSteps({ astro: icpMode === 'astro' }), [icpMode])
  // "Show me" from the Guide (`/workspace?tour=1&guide=workspace`) forces the
  // walk once the framework is up and marks it walked when it closes.
  const location = useLocation()
  const tourReq = tourRequest(location.search)
  const { startTour } = useTour<ActiveTab>({
    tourId: 'workspace',
    steps: tourSteps,
    userId: profile?.id,
    enabled: !!framework && !isLoading,
    autoStart: !tourReq,
    onTabChange: setActiveTab,
    onDone: tourReq?.guideKey ? () => void markGuideWalked(tourReq.guideKey) : undefined,
  })
  const forcedRef = useRef(false)
  useEffect(() => {
    if (!tourReq || forcedRef.current || !framework || isLoading) return
    forcedRef.current = true
    const t = window.setTimeout(() => void startTour(), 900)
    return () => window.clearTimeout(t)
  }, [tourReq, framework, isLoading, startTour])

  // Onboarding metric: the user came back 1–3 days after setting a persona.
  useEffect(() => { maybeRecordDay2Return(profile?.persona_set_at) }, [profile?.persona_set_at])

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
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center"
        style={{ background: 'var(--bg)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed to load framework.</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Admin-only: surfaces a failed pipeline step (run no longer fails wholesale) */}
      <PipelineHealthBar />
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

          {/* VaNi confluence pills — HIDDEN (owner 2026-07-22): the whole
              confluence engine (pills, island, drawer) is suspended pending
              a rebuild on the base-rate framework. Not deleted — vaniCorrelations
              stays populated for non-astro pairs so this can be re-enabled by
              restoring this block alone if the drawer/island come back first. */}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <nav style={{
        display: 'flex', alignItems: 'stretch', height: 44, flexShrink: 0,
        background: 'var(--card-soft)', borderBottom: '1px solid var(--border)',
        padding: '0 20px', position: 'sticky', top: 48, zIndex: 39,
      }}>
        {(['today', 'discovery', 'metrics', 'bookmarks'] as const).map((tab) => {
          const labels: Record<ActiveTab, string> = { today: 'Today', discovery: 'Discovery', metrics: 'Market Metrics', bookmarks: 'My Bookmarks' }
          const icons:  Record<ActiveTab, string> = { today: '◐', discovery: '⊙', metrics: '◈', bookmarks: '☆' }
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
          <TourLauncher onClick={() => void startTour()} />
          <AtmosphericBadge />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {todayDisplay}
          </span>
        </div>
      </nav>

      {/* ── Tab panels ── */}

      {activeTab === 'today' && (
        <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          <WorkspaceToday />
        </div>
      )}

      {activeTab === 'discovery' && (
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <WorkspaceDiscovery />
        </div>
      )}

      {activeTab === 'metrics' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <WorkspaceMarketMetrics />
        </div>
      )}

      {activeTab === 'bookmarks' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px' }}>
            <MyBookmarksPanel />
          </div>
        </div>
      )}

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
