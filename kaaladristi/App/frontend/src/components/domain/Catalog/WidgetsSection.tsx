import { useState, useRef, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { getCatalogItemsByType, type CatalogItem } from '@/constants/catalogItems'
import { useAuthStore } from '@/stores/authStore'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import InlineGate from '@/components/workspace/InlineGate'
import { useQuery } from '@tanstack/react-query'
import { fetchIndicatorDataById } from '@/services/indicatorData'
import BreadthRocChart from '@/components/domain/BreadthRocChart'
import MagicRsWidget from './widgets/MagicRsWidget'
import OrderFlowWidget from './widgets/OrderFlowWidget'
import SmartMoneyWidget from './widgets/SmartMoneyWidget'
import type { DeepDiveItem } from './DeepDivePanel'

const WIDGETS           = getCatalogItemsByType('widget')
const SCANNERS          = getCatalogItemsByType('scanner')
const PANEL_INDICATORS  = getCatalogItemsByType('indicator').filter(i => i.placement === 'panel_block')
const ALL_WIDGETS       = [...WIDGETS, ...SCANNERS, ...PANEL_INDICATORS]

// Tight locked-card copy — max 2 sentences, ~20 words each
const LOCKED_DESCRIPTIONS: Record<string, string> = {
  smart_money:     'Classifies volume into institutional vs retail flow. Shows when large participants are systematically accumulating.',
  order_flow:      'Classifies each session into buyer-initiated or seller-initiated flow. Shows whether urgency to buy or sell is driving the tape.',
  six_day_outlook: 'Forward-looking astro calendar for the next 6 trading days. See which rules are firing before they happen.',
  conviction_flow: 'Detects quiet institutional accumulation via delivery surge vs baseline. Surfaces stocks being loaded before price moves.',
  rsi_14:          'Momentum oscillator tracking overbought and oversold conditions. Fires when price moves fast relative to its recent range.',
}

const ICONS: Record<string, string> = {
  magic_rs:        '◎',
  breadth_roc:     '⊛',
  smart_money:     '◉',
  conviction_flow: '⊙',
  order_flow:      '⇌',
  six_day_outlook: '☽',
  chart_player:    '▷',
}

interface WidgetsSectionProps {
  onSelect?: (item: DeepDiveItem) => void
}

// symbolId={1} = NIFTY 50. Explicit in catalog context; workspace widgets read from
// useWorkspaceEod instead (no prop passed).
function LivePreview({ id }: { id: string }) {
  if (id === 'magic_rs')    return <MagicRsWidget    symbolId={1} />
  if (id === 'breadth_roc') return <BreadthRocChart />
  if (id === 'order_flow')  return <OrderFlowWidget  symbolId={1} />
  if (id === 'smart_money') return <SmartMoneyWidget symbolId={1} />
  if (id === 'six_day_outlook') return <SixDayMock />
  if (id === 'conviction_flow') return <ConvictionMock />
  if (id === 'rsi_14')          return <RsiWidget />
  if (id === 'atr_14')          return <AtrWidget />
  return null
}

// Static visual mocks for locked-only widgets — shown blurred behind overlay
function SixDayMock() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const signals = ['↑', '↑↑', '—', '↓', '↑', '↑↑']
  const colors  = ['#2dd4bf', '#2dd4bf', '#888', '#f87171', '#2dd4bf', '#2dd4bf']
  return (
    <div style={{ padding: '10px 4px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {days.map((d, i) => (
        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)', width: 24 }}>{d}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: `${colors[i]}22` }}>
            <div style={{ width: `${[60,90,20,35,70,85][i]}%`, height: '100%', borderRadius: 3, background: colors[i], opacity: 0.7 }} />
          </div>
          <span style={{ fontSize: 10, color: colors[i], width: 20, textAlign: 'right' }}>{signals[i]}</span>
        </div>
      ))}
    </div>
  )
}

function ConvictionMock() {
  const bars = [12, 28, 18, 42, 35, 55, 48, 70, 62, 85]
  return (
    <div style={{ padding: '10px 4px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ height: `${h}%`, borderRadius: 2, background: i > 6 ? 'rgba(45,212,191,0.6)' : 'rgba(139,122,248,0.35)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)' }}>baseline</span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono,monospace)', color: '#2dd4bf' }}>surge ↑</span>
      </div>
    </div>
  )
}

function useNiftyEod() {
  return useQuery({
    queryKey: ['widget-catalog-eod', 1],
    queryFn:  () => fetchIndicatorDataById(1, '1Y'),
    staleTime: 120_000,
  })
}

function SparklineCanvas({ pts, color, fillColor, refLines }: {
  pts: number[]
  color: string
  fillColor: string
  refLines?: Array<{ value: number; color: string }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pts.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const min = Math.min(...pts), max = Math.max(...pts)
    const range = max - min || 1
    const toX = (i: number) => (i / (pts.length - 1)) * W
    const toY = (v: number) => H - ((v - min) / range) * H * 0.82 - H * 0.09
    refLines?.forEach(r => {
      const ry = toY(r.value)
      if (ry < 0 || ry > H) return
      ctx.strokeStyle = r.color; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(W, ry); ctx.stroke()
      ctx.setLineDash([])
    })
    const pathPts = pts.map((v, i) => [toX(i), toY(v)] as [number, number])
    ctx.beginPath(); ctx.moveTo(pathPts[0][0], pathPts[0][1])
    pathPts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    ctx.fillStyle = fillColor; ctx.fill()
    const last = pathPts[pathPts.length - 1]
    ctx.beginPath(); ctx.arc(last[0], last[1], 2.5, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
  }, [pts, color, fillColor, refLines])
  return <canvas ref={canvasRef} width={240} height={60} style={{ width: '100%', height: 60 }} />
}

function RsiWidget() {
  const { data = [], isLoading } = useNiftyEod()
  if (isLoading || data.length === 0) return <div style={{ height: 80 }} />
  const last60 = data.slice(-60)
  const pts = last60.map(b => (b as unknown as Record<string, number>).rsi_14).filter(v => v != null)
  const current = pts[pts.length - 1]
  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono,monospace)',
          color: current >= 70 ? '#f87171' : current <= 30 ? '#2dd4bf' : '#8b7af8', lineHeight: 1 }}>
          {current?.toFixed(1) ?? '—'}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
          {current >= 70 ? 'OVERBOUGHT' : current <= 30 ? 'OVERSOLD' : 'NEUTRAL'}
        </span>
      </div>
      <SparklineCanvas
        pts={pts}
        color="#8b7af8"
        fillColor="rgba(139,122,248,0.06)"
        refLines={[
          { value: 70, color: 'rgba(248,113,113,0.35)' },
          { value: 30, color: 'rgba(45,212,191,0.35)' },
        ]}
      />
    </div>
  )
}

function AtrWidget() {
  const { data = [], isLoading } = useNiftyEod()
  if (isLoading || data.length === 0) return <div style={{ height: 80 }} />
  const last60 = data.slice(-60)
  const pts = last60.map(b => (b as unknown as Record<string, number>).atr_14).filter(v => v != null)
  const current = pts[pts.length - 1]
  const avg = pts.reduce((s, v) => s + v, 0) / pts.length
  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono,monospace)',
          color: 'rgba(201,168,76,0.9)', lineHeight: 1 }}>
          {current?.toFixed(1) ?? '—'}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono,monospace)', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
          {current > avg * 1.2 ? 'HIGH VOL' : current < avg * 0.8 ? 'LOW VOL' : 'AVG RANGE'}
        </span>
      </div>
      <SparklineCanvas
        pts={pts}
        color="rgba(201,168,76,0.85)"
        fillColor="rgba(201,168,76,0.07)"
      />
    </div>
  )
}

function LockedOverlay({ item, onDeepDive }: { item: CatalogItem; onDeepDive: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '20px 24px',
      zIndex: 2,
    }}>
      <Lock size={20} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 17,
        fontWeight: 300,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        fontStyle: 'italic',
      }}>
        {item.display_name}
      </div>
      <p style={{
        fontSize: 11.5,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        textAlign: 'center',
        maxWidth: 220,
      }}>
        {LOCKED_DESCRIPTIONS[item.id] ?? item.description}
      </p>
      <button
        onClick={e => { e.stopPropagation(); onDeepDive() }}
        style={{
          padding: '6px 16px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          border: '1px solid rgba(124,106,247,0.35)',
          background: 'rgba(124,106,247,0.10)',
          color: '#8b7af8', fontFamily: 'inherit',
          marginTop: 4,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(124,106,247,0.18)'
          el.style.borderColor = 'rgba(124,106,247,0.55)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(124,106,247,0.10)'
          el.style.borderColor = 'rgba(124,106,247,0.35)'
        }}
      >
        Unlock with Trial →
      </button>
    </div>
  )
}

export default function WidgetsSection({ onSelect }: WidgetsSectionProps) {
  const { profile } = useAuthStore()
  const { addBlock, isBlockActive, isOverlayActive } = useFrameworkStore()
  const isPaid = PAID_TIERS.includes(profile?.tier as never)
  const [gateOpen, setGateOpen] = useState(false)

  function isActive(item: CatalogItem) {
    return item.placement === 'chart_overlay' ? isOverlayActive(item.id) : isBlockActive(item.id)
  }

  function handleAdd(item: CatalogItem, e: React.MouseEvent) {
    e.stopPropagation()
    if (item.tier_required === 'paid' && !isPaid) { setGateOpen(true); return }
    addBlock(item)
  }

  const hasLivePreview = (id: string) =>
    ['magic_rs', 'breadth_roc', 'order_flow', 'smart_money', 'six_day_outlook', 'conviction_flow', 'rsi_14', 'atr_14'].includes(id)

  return (
    <>
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 300,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}>
          Intelligence <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Widgets</em>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
          Proprietary DristiQ signals rendered as panel blocks in your workspace.
          These don't draw on the chart — they run alongside it.
        </p>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--caution)', display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ opacity: 0.7 }}>◑</span>
          Some paid tier
        </span>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 14,
      }}>
        {ALL_WIDGETS.map(item => {
          const active  = isActive(item)
          const locked  = item.tier_required === 'paid' && !isPaid
          const icon    = ICONS[item.id] ?? '◌'
          const livePreview = hasLivePreview(item.id)

          return (
            <div
              key={item.id}
              onClick={() => onSelect?.({ mode: 'catalog_item', item })}
              style={{
                border: `1px solid ${
                  active ? 'rgba(45,212,191,0.28)'  :
                  locked ? 'rgba(255,255,255,0.06)' :
                           'rgba(124,106,247,0.18)'
                }`,
                borderRadius: 12,
                background: active ? 'rgba(45,212,191,0.04)' : 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                minHeight: locked ? 220 : undefined,
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = locked ? 'rgba(255,255,255,0.1)' : 'rgba(124,106,247,0.38)'
                  if (!locked) { el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.28)' }
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = active
                  ? 'rgba(45,212,191,0.28)'
                  : locked ? 'rgba(255,255,255,0.06)' : 'rgba(124,106,247,0.18)'
                el.style.transform = ''
                el.style.boxShadow = ''
              }}
            >
              {/* Live preview always renders — blur sits on top when locked */}
              {livePreview && (
                <div style={{
                  position: 'absolute', inset: 0,
                  filter: locked ? 'blur(3px)' : 'none',
                  opacity: locked ? 0.5 : 1,
                  pointerEvents: 'none', zIndex: 1,
                  overflow: 'hidden', padding: '18px 20px',
                }}>
                  <LivePreview id={item.id} />
                </div>
              )}
              {locked && !livePreview && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.15)',
                  pointerEvents: 'none', zIndex: 1,
                }} />
              )}

              {/* Lock overlay */}
              {locked && (
                <LockedOverlay
                  item={item}
                  onDeepDive={() => onSelect?.({ mode: 'catalog_item', item })}
                />
              )}

              {/* Normal card content — hidden behind lock overlay when locked */}
              {!locked && (
                <div style={{ padding: '18px 20px' }}>
                  {/* VaNi glow backdrop */}
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    width: 110, height: 110,
                    background: 'radial-gradient(circle at top right, rgba(124,106,247,0.05), transparent 70%)',
                    pointerEvents: 'none',
                  }} />

                  {/* Tier badge */}
                  {item.tier_required === 'paid' && (
                    <div style={{
                      position: 'absolute', top: 14, right: 14,
                      fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
                      padding: '2px 6px',
                      background: 'rgba(124,106,247,0.10)',
                      border: '1px solid rgba(124,106,247,0.28)',
                      color: '#8b7af8', borderRadius: 3, letterSpacing: '0.06em',
                    }}>
                      PAID ✓
                    </div>
                  )}

                  {/* Icon */}
                  <div style={{
                    fontSize: 22, marginBottom: 10,
                    fontFamily: 'var(--font-display)',
                    color: active ? '#2dd4bf' : '#8b7af8',
                  }}>
                    {icon}
                  </div>

                  {/* Name */}
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300,
                    color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 5,
                  }}>
                    {item.display_name}
                  </div>

                  {/* Spacer when live preview is absolute-positioned behind card */}
                  {livePreview && <div style={{ height: 80, marginBottom: 12 }} />}

                  {/* VaNi one-liner */}
                  {item.vani_explanation && (
                    <p style={{
                      fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55,
                      marginBottom: 14,
                    }}>
                      <span style={{ color: 'var(--accent)' }}>✦</span>{' '}
                      {item.vani_explanation.split('. ')[0]}.
                    </p>
                  )}

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-faint)', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3,
                    }}>
                      {item.id}
                    </span>

                    {active ? (
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#2dd4bf' }}>
                        ✓ added
                      </span>
                    ) : (
                      <button
                        onClick={e => handleAdd(item, e)}
                        style={{
                          padding: '5px 13px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: '1px solid rgba(124,106,247,0.38)',
                          background: 'rgba(124,106,247,0.10)',
                          color: '#8b7af8', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLElement
                          el.style.background = 'rgba(124,106,247,0.18)'
                          el.style.borderColor = 'rgba(124,106,247,0.55)'
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLElement
                          el.style.background = 'rgba(124,106,247,0.10)'
                          el.style.borderColor = 'rgba(124,106,247,0.38)'
                        }}
                      >
                        + Add to framework
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>

    <InlineGate
      context="add_indicator"
      isOpen={gateOpen}
      onDismiss={() => setGateOpen(false)}
    />
    </>
  )
}
