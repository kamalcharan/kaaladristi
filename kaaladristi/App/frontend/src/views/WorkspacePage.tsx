import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { from } from '@/services/postgrest'
import { useIndexBreadth } from '@/hooks/useSectorRotation'
import TickerRail from '@/components/domain/DashboardV3/TickerRail'
import PlanetRegimeStrip from '@/components/domain/DashboardV3/PlanetRegimeStrip'
import BreadthRotation from '@/components/domain/BreadthRotation'
import { DristiQLoader } from '@/components/ui'
import { Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import type { InstrumentRef } from '@/types/framework'
import WorkspaceCanvas from '@/components/domain/Workspace/WorkspaceCanvas'
import CorrelationDrawer from '@/components/domain/Workspace/CorrelationDrawer'
import VaNiMorningBrief from '@/components/workspace/VaNiMorningBrief'
import PipelineHealthBar from '@/components/workspace/PipelineHealthBar'
import MarketWeatherCard from '@/components/domain/DashboardV3/MarketWeatherCard'
import MarketBreadthChart from '@/components/domain/MarketBreadthChart'
import BreadthRocChart from '@/components/domain/BreadthRocChart'
import IndexDropdown from '@/components/domain/IndexDropdown'
import WorkspaceChart from '@/components/workspace/WorkspaceChart'
import CurrentSkyRail from '@/components/domain/DashboardV3/CurrentSkyRail'
import PanchangamCard from '@/components/domain/PanchangamCard'
import SixDayOutlookCompact from '@/components/domain/DashboardV3/SixDayOutlookCompact'
import NakVaraSignals from '@/components/domain/DashboardV3/NakVaraSignals'
import SectorPulse from '@/components/domain/DashboardV3/SectorPulse'
import VaNiHighlightsBoard from '@/components/domain/VaNiHighlightsBoard'
import AtmosphericBadge from '@/components/domain/AtmosphericBadge'

type ActiveTab = 'today' | 'discovery' | 'myspace'

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDateChip(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')} ${_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** IST time-of-day greeting for the Today header. */
function greetingWord(): string {
  const istHour = (new Date().getUTCHours() + 5.5) % 24
  if (istHour < 12) return 'Good morning'
  if (istHour < 17) return 'Good afternoon'
  return 'Good evening'
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

  const isBeta = profile?.tier === 'beta'
  const today        = new Date().toISOString().split('T')[0]
  const todayDisplay = fmtDateChip(new Date())

  const primaryInstrument = framework?.blocks
    .find(b => b.type === 'chart')?.config.instrument as InstrumentRef | undefined
  const primarySymbol = (primaryInstrument as { symbol?: string } | undefined)?.symbol ?? 'Index'

  const [todayIndexDropdown, setTodayIndexDropdown] = useState<{ x: number; y: number } | null>(null)

  // ── Today: one index selector drives breadth rotation + breadth + ROC ──
  const navigate = useNavigate()
  const TODAY_INDICES = ['NIFTY 50', 'NIFTY 500', 'NIFTY BANK'] as const
  const [breadthIndex, setBreadthIndex] = useState<string>('NIFTY 50')
  const { data: todayIdxIds } = useQuery({
    queryKey: ['workspace-today-index-ids'],
    queryFn: async () => {
      const { data } = await from('km_index_symbols').select('id,name').in('name', ['NIFTY 50', 'NIFTY 500', 'NIFTY BANK']).execute()
      const m: Record<string, number> = {}
      ;(data ?? []).forEach((r: { id: number; name: string }) => { m[r.name] = r.id })
      return m
    },
    staleTime: Infinity,
  })
  const breadthIndexId = todayIdxIds?.[breadthIndex] ?? null
  const { data: todayBreadth, isLoading: todayBreadthLoading } = useIndexBreadth(breadthIndexId, 66)

  // Auto-switch to Today tab once per day
  useEffect(() => {
    const key = `vani_today_shown:${profile?.id}:${today}`
    if (!localStorage.getItem(key)) {
      setActiveTab('today')
      localStorage.setItem(key, '1')
    }
  }, [profile?.id, today])

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
          <AtmosphericBadge />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {todayDisplay}
          </span>
        </div>
      </nav>

      {/* ── Tab panels ── */}

      {activeTab === 'today' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '26px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 0 · Greeting — the editorial moment (Glass UX §4: display serif + italic em) */}
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--label-font-size)',
                fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: 'var(--text-faint)', marginBottom: 6,
              }}>
                Today · Market Weather
              </div>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300,
                letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0,
                color: 'var(--text-primary)',
              }}>
                {greetingWord()},{' '}
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--gold)' }}>
                  {profile?.display_name || profile?.full_name || 'there'}
                </em>
              </h1>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--text-muted)', marginTop: 5,
              }}>
                {fmtDateLong(new Date())}
              </div>
            </div>

            {/* 1 · Index cards — NIFTY 50 / BANK / 500 / India VIX */}
            <TickerRail date={today} />

            {/* Shared index selector (drives rotation + breadth + ROC) + Market Breadth nav */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono, monospace)' }}>Breadth view:</span>
                <div style={{ display: 'inline-flex', gap: 3, background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', borderRadius: 9, padding: 3 }}>
                  {TODAY_INDICES.map(n => (
                    <button key={n} onClick={() => setBreadthIndex(n)}
                      style={{
                        fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 700,
                        padding: '5px 12px', borderRadius: 6, border: 0, cursor: 'pointer', transition: 'all .15s',
                        background: breadthIndex === n ? 'var(--accent)' : 'transparent',
                        color: breadthIndex === n ? '#fff' : 'var(--text-muted)',
                      }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => navigate('/market-structure')}
                style={{
                  fontFamily: 'var(--font-mono, monospace)', fontSize: 11, cursor: 'pointer',
                  color: 'var(--accent)', borderRadius: 100, padding: '5px 13px',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                }}>Open Market Breadth →</button>
            </div>

            {/* 2 · How breadth is moving — rotation (VaNi read; no heatmap) */}
            <BreadthRotation indexId={breadthIndexId} title={`How breadth is moving · ${breadthIndex}`} />

            {/* 3 · Panchangam (40%) + Sky Regime (60%) — one row, astro ICP */}
            {icpMode === 'astro' && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 40fr) minmax(0, 60fr)', gap: 20, alignItems: 'start',
              }}>
                <PanchangamCard date={today} />
                <PlanetRegimeStrip />
              </div>
            )}

            {/* 4 · Market Breadth + ROC — driven by the same index selector */}
            {todayBreadthLoading && !todayBreadth ? (
              <DristiQLoader message="Loading breadth & momentum…" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <MarketBreadthChart
                  data={todayBreadth?.data}
                  isLoading={todayBreadthLoading}
                  indexName={breadthIndex}
                  zoneMode={todayBreadth?.zoneMode}
                  percentileRank={todayBreadth?.percentileRank ?? undefined}
                  stockCount={todayBreadth?.stockCount}
                />
                <BreadthRocChart
                  data={todayBreadth?.roc}
                  isLoading={todayBreadthLoading}
                  rocBadge={todayBreadth?.rocBadge}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'discovery' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Sector Pulse — score-framework rotation verdict (replaced the old
              industry-rank panel, owner decision 2026-07-06; per-scan preview
              widgets remain available as My Space catalog widgets) */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <SectorPulse />
          </div>

          {/* VaNi Highlights — union of ✦ across all scanners, both sides open */}
          <div style={{ padding: '16px 20px' }}>
            <VaNiHighlightsBoard />
          </div>
        </div>
      )}

      {activeTab === 'myspace' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <WorkspaceCanvas
            framework={framework!}
            onOpenDrawer={openDrawer}
            onMorningBrief={() => setActiveTab('today')}
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
