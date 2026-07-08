import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useFrameworkStore } from '@/stores/frameworkStore'
import { useAuthStore } from '@/stores/authStore'
import { PAID_TIERS } from '@/constants/frameworkConstants'
import { useCorrelationResult, type CorrelationInstance } from '@/hooks/useCorrelationResult'
import ConfidenceDial from '@/components/correlation/ConfidenceDial'
import { DataQualityPill } from '@/components/correlation/DataQualityPill'
import { recommendVisualisations } from '@/utils/correlationVizSkill'
import type { VisualisationOption } from '@/utils/correlationVizSkill'
import InlineGate from '@/components/workspace/InlineGate'
import { getCatalogItem } from '@/constants/catalogItems'
import { ASTRO_GROUP_OVERLAYS } from '@/constants/astroGroupOverlays'
import VaNiFeedback from '@/components/domain/VaNi/VaNiFeedback'

const WALK_TIERS = ['trial', 'quarterly', 'annual', 'beta'] as const

const VANI_LOADING_MESSAGES = [
  'Reading this combination…',
  'Checking historical instances…',
  'Analysing pattern signals…',
  'Generating insight…',
]

function VaNiModal() {
  const [msgIdx, setMsgIdx] = useState(0)
  const [dots, setDots]     = useState(0)
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % VANI_LOADING_MESSAGES.length), 2200)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`@keyframes vani-ring{0%,100%{transform:scale(1);opacity:.15}50%{transform:scale(1.35);opacity:.06}}`}</style>
      <div style={{
        background: 'var(--bg-card, #111)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '36px 48px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        minWidth: 260,
      }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)', opacity: 0.15, animation: 'vani-ring 1.8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono,monospace)' }}>
            Vᴺ
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', minHeight: 20 }}>
          {VANI_LOADING_MESSAGES[msgIdx]}{'.'.repeat(dots)}
        </div>
      </div>
    </div>
  )
}

const VIZ_PREF_KEY = (a: string, b: string) => `corr_viz:${a}:${b}`

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace('astro_group:', '').replace(/_/g, ' ').toUpperCase()
}

function fmtPct(n: number | null, digits = 2): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

const _CORR_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(s: string): string {
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}-${_CORR_MONTHS[+m - 1]}-${y}`;
}
function fmtDateShort(s: string): string {
  const [, m, d] = s.slice(0, 10).split('-');
  return `${d}-${_CORR_MONTHS[+m - 1]}`;
}

function resolveDisplayName(id: string): string {
  const item = getCatalogItem(id)
  if (item) return item.display_name
  const group = ASTRO_GROUP_OVERLAYS.find(g => g.id === id)
  if (group) return group.display_name
  return id.replace('astro_rule:', '').replace('astro_group:', '').replace(/_/g, ' ').toUpperCase()
}

function resolveDescription(id: string): string {
  const item = getCatalogItem(id)
  if (item?.vani_explanation) {
    const first = item.vani_explanation.split('.')[0]
    return first + '.'
  }
  return resolveDisplayName(id)
}

function OutcomeBadge({ returnVal }: { returnVal: number | null }) {
  if (returnVal == null) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const bull = returnVal > 0
  return (
    <span style={{
      fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
      color: bull ? 'var(--bull)' : 'var(--bear)',
      background: bull ? 'rgba(45,212,191,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${bull ? 'rgba(45,212,191,0.2)' : 'rgba(239,68,68,0.2)'}`,
      padding: '1px 6px', borderRadius: 3,
    }}>
      {returnVal > 0 ? '↑' : '↓'} {Math.abs(returnVal).toFixed(2)}%
    </span>
  )
}

// ── Visualisation Views ────────────────────────────────────────────────────────

function InstanceGrid({ instances }: { instances: CorrelationInstance[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const resolved  = instances.filter(i => i.return_5d != null)
  const bullCount = resolved.filter(i => (i.return_5d ?? 0) > 0).length
  const bearCount = resolved.filter(i => (i.return_5d ?? 0) <= 0).length
  const activeCount = instances.filter(i => !i.end_date || new Date(i.end_date) >= new Date()).length

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Closed higher', value: bullCount, color: 'var(--bull)', bg: 'rgba(45,212,191,0.08)' },
          { label: 'Closed lower',  value: bearCount, color: 'var(--bear)', bg: 'rgba(239,68,68,0.08)' },
          { label: 'In progress',   value: activeCount, color: 'var(--accent)', bg: 'var(--accent-glow)' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: bg, border: `1px solid ${color}22`,
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color,
            }}>
              {value}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
              {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12, position: 'relative' }}>
        {instances.map((inst, i) => {
          const isActive  = !inst.end_date || new Date(inst.end_date) >= new Date()
          const r5        = inst.return_5d
          const bg = isActive
            ? 'var(--accent)'
            : r5 == null ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)'
            : r5 > 0 ? 'var(--bull)' : 'var(--bear)'

          return (
            <div
              key={i}
              style={{
                width: 20, height: 20, borderRadius: 3,
                background: bg,
                opacity: r5 == null && !isActive ? 0.3 : isActive ? 1 : 0.8,
                cursor: 'pointer',
                animation: isActive ? 'pulse-glow 2s ease-in-out infinite' : undefined,
                boxShadow: isActive ? `0 0 6px var(--accent)` : undefined,
              }}
              onMouseEnter={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setTooltipPos({ x: rect.left, y: rect.top })
                setHovered(i)
              }}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}
      </div>

      {/* Tooltip */}
      {hovered !== null && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x + 24,
          top: tooltipPos.y - 8,
          zIndex: 500,
          background: 'var(--bg-card, #111)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '7px 10px',
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          minWidth: 160,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div>{fmtDate(instances[hovered].start_date)} → {instances[hovered].end_date ? fmtDate(instances[hovered].end_date) : 'active'}</div>
          <div>Duration: {instances[hovered].duration_days}d</div>
          <div>5D: {fmtPct(instances[hovered].return_5d)}</div>
          <div>22D: {fmtPct(instances[hovered].return_22d)}</div>
        </div>
      )}

      {/* Caption */}
      <p style={{
        fontSize: 12, fontFamily: 'var(--font-display)', fontStyle: 'italic',
        color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        {instances.length} times this combination appeared.
        {' '}<span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
          Green = positive 5D return · Red = negative · Blue = approaching or active
        </span>
      </p>

      {/* Compact instance table */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Duration', '5D Return', 'Outcome'].map(col => (
                <th key={col} style={{
                  padding: '4px 10px', textAlign: 'left',
                  fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
                  fontWeight: 400,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...instances]
              .filter(i => i.return_5d != null)
              .sort((a, b) => b.start_date.localeCompare(a.start_date))
              .map((inst, i) => (
                <tr key={i} style={{ borderTop: '1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)' }}>
                  <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)' }}>
                    {fmtDate(inst.start_date)}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                    {inst.duration_days}d
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: (inst.return_5d ?? 0) > 0 ? 'var(--bull)' : 'var(--bear)' }}>
                    {fmtPct(inst.return_5d)}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: (inst.return_5d ?? 0) > 0 ? 'var(--bull)' : 'var(--bear)' }}>
                    {(inst.return_5d ?? 0) > 0 ? '↑' : '↓'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GanttTimeline({ instances }: { instances: CorrelationInstance[] }) {
  const sorted = [...instances].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const LABEL_W = 70
  const BAR_H   = 10
  const ROW_H   = 18
  const H       = sorted.length * ROW_H + 30
  const W       = 320

  if (sorted.length === 0) return null

  const minDate = sorted[0].start_date
  const maxDate = sorted[sorted.length - 1].end_date || sorted[sorted.length - 1].start_date
  const minTs   = new Date(minDate).getTime()
  const maxTs   = new Date(maxDate).getTime() || minTs + 86_400_000 * 30
  const range   = maxTs - minTs || 1

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W + LABEL_W} ${H}`} width="100%" style={{ display: 'block' }}>
        {sorted.map((inst, i) => {
          const y = i * ROW_H + 4
          const startTs = new Date(inst.start_date).getTime()
          const endTs   = inst.end_date ? new Date(inst.end_date).getTime() : startTs + 86_400_000 * (inst.duration_days || 5)
          const x1 = LABEL_W + ((startTs - minTs) / range) * W
          const x2 = LABEL_W + ((endTs   - minTs) / range) * W
          const barW = Math.max(3, x2 - x1)
          const bull = (inst.return_5d ?? 0) > 0
          const color = inst.return_5d == null ? 'color-mix(in srgb, var(--text-primary) 25%, transparent)' : bull ? 'var(--bull)' : 'var(--bear)'

          return (
            <g key={i}>
              <text
                x={LABEL_W - 6} y={y + BAR_H / 2 + 3}
                textAnchor="end"
                fontSize={7.5}
                fontFamily="monospace"
                fill="color-mix(in srgb, var(--text-primary) 30%, transparent)"
              >
                {fmtDateShort(inst.start_date)}
              </text>
              <rect
                x={x1} y={y}
                width={barW} height={BAR_H}
                rx={2}
                fill={color}
                opacity={0.75}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Distribution({ instances }: { instances: CorrelationInstance[] }) {
  const buckets = [
    { label: '< −2%', min: -Infinity, max: -2 },
    { label: '−2 to −1%', min: -2, max: -1 },
    { label: '−1 to 0%',  min: -1, max: 0 },
    { label: '0 to +1%',  min: 0,  max: 1 },
    { label: '+1 to +2%', min: 1,  max: 2 },
    { label: '> +2%',     min: 2,  max: Infinity },
  ]

  const resolved = instances.filter(i => i.return_5d != null)
  const counts   = buckets.map(b =>
    resolved.filter(i => (i.return_5d ?? 0) > b.min && (i.return_5d ?? 0) <= b.max).length
  )
  const maxCount = Math.max(...counts, 1)
  const maxIdx   = counts.indexOf(maxCount)

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100, marginBottom: 12 }}>
        {buckets.map((b, i) => {
          const neg = b.max <= 0
          const barH = (counts[i] / maxCount) * 80
          return (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-faint)' }}>
                {counts[i]}
              </div>
              <div style={{
                width: '100%', height: barH,
                background: neg ? 'var(--bear)' : 'var(--bull)',
                borderRadius: '2px 2px 0 0',
                opacity: 0.75,
                minHeight: counts[i] > 0 ? 4 : 0,
              }} />
            </div>
          )
        })}
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {buckets.map(b => (
          <div key={b.label} style={{
            flex: 1, textAlign: 'center', fontSize: 8,
            fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)',
          }}>
            {b.label}
          </div>
        ))}
      </div>
      {maxIdx >= 0 && counts[maxIdx] > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          The most common outcome is a 5D return{' '}
          <em>{buckets[maxIdx].label}</em>, appearing in {counts[maxIdx]} of {resolved.length} resolved instances.
        </p>
      )}
    </div>
  )
}

function InstanceTable({ instances }: { instances: CorrelationInstance[] }) {
  const sorted = [...instances].sort((a, b) => b.start_date.localeCompare(a.start_date))

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)' }}>
            {['Start', 'Duration', '5D', '22D', 'Outcome'].map(col => (
              <th key={col} style={{
                padding: '8px 10px', textAlign: 'left',
                fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 400,
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((inst, i) => {
            const isActive = !inst.end_date || new Date(inst.end_date) >= new Date()
            return (
              <tr key={i} style={{
                borderBottom: '1px solid var(--border)',
                background: isActive ? 'rgba(124,106,247,0.05)' : undefined,
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
                <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)' }}>
                  {fmtDate(inst.start_date)}
                </td>
                <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>
                  {inst.duration_days}d
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                    color: inst.return_5d == null ? 'var(--text-muted)' : inst.return_5d > 0 ? 'var(--bull)' : 'var(--bear)',
                  }}>
                    {fmtPct(inst.return_5d)}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                    color: inst.return_22d == null ? 'var(--text-muted)' : inst.return_22d > 0 ? 'var(--bull)' : 'var(--bear)',
                  }}>
                    {fmtPct(inst.return_22d)}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  {isActive
                    ? <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)' }}>Approaching</span>
                    : <OutcomeBadge returnVal={inst.return_5d} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CorrelationPage() {
  const { itemA, itemB } = useParams<{ itemA: string; itemB: string }>()
  const navigate          = useNavigate()
  const correlations      = useFrameworkStore(s => s.vaniCorrelations)
  const dismissCorrelation = useFrameworkStore(s => s.dismissVaNiCorrelation)
  const { profile, session, isAdmin } = useAuthStore()
  const queryClient = useQueryClient()
  const canWalk              = WALK_TIERS.includes(profile?.tier as typeof WALK_TIERS[number])
  const [walkGateOpen, setWalkGateOpen] = useState(false)
  const [vaniTriggered, setVaniTriggered] = useState(false)
  const [vaniMinWait, setVaniMinWait] = useState(false)

  const { result, loading } = useCorrelationResult(itemA ?? '', itemB ?? '')

  const storedVizKey = `corr_viz:${itemA}:${itemB}`
  const [vizId, setVizId] = useState<VisualisationOption['id']>(() => {
    try { return (localStorage.getItem(storedVizKey) as VisualisationOption['id']) || 'grid' } catch { return 'grid' }
  })

  function selectViz(id: VisualisationOption['id']) {
    setVizId(id)
    try { localStorage.setItem(storedVizKey, id) } catch {}
  }

  // Pair nav
  const currentIdx = correlations.findIndex(c => c.item_a === itemA && c.item_b === itemB)
  const prevCorr   = correlations[currentIdx - 1]
  const nextCorr   = correlations[currentIdx + 1]

  const hasDurationVariance = useMemo(() => {
    if (!result) return false
    const durations = result.instances.map(i => i.duration_days)
    const min = Math.min(...durations), max = Math.max(...durations)
    return max - min > 3
  }, [result])

  const vizOptions = useMemo(() => {
    if (!result) return []
    return recommendVisualisations(result.shape, result.n_instances, hasDurationVariance)
  }, [result, hasDurationVariance])

  const activeCorr  = correlations.find(c => c.item_a === itemA && c.item_b === itemB)
  const aLabel      = fmtId(itemA ?? '')
  const bLabel      = fmtId(itemB ?? '')
  const shapeLabel  = result?.shape ?? activeCorr?.shape ?? ''

  const bullCount = result?.bullish_count ?? 0
  const bearCount = result?.bearish_count ?? 0
  const total     = bullCount + bearCount
  const hitRate   = total > 0 ? Math.max(bullCount, bearCount) / total : 0

  const [refreshCount, setRefreshCount] = useState(0)
  const isForceRefresh = refreshCount > 0

  const { data: insightData, isLoading: insightLoading } = useQuery({
    queryKey: ['corr-insight', itemA, itemB, result?.shape, refreshCount],
    queryFn: async () => {
      const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''
      const token = session?.access_token
      const r = await fetch(`${pipelineUrl}/api/vani/correlation-insight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          item_a:             itemA,
          item_b:             itemB,
          item_a_display:     resolveDisplayName(itemA ?? ''),
          item_b_display:     resolveDisplayName(itemB ?? ''),
          item_a_description: resolveDescription(itemA ?? ''),
          item_b_description: resolveDescription(itemB ?? ''),
          shape:              result?.shape ?? '',
          n_instances:        result?.n_instances ?? 0,
          hit_rate:           hitRate,
          avg_return_5d:      result?.avg_return_5d ?? 0,
          avg_return_22d:     result?.avg_return_22d ?? 0,
          currently_active:   result?.currently_active ?? false,
          instances:          (result?.instances ?? []).slice(0, 5).map(i => ({
            start_date:    i.start_date,
            duration_days: i.duration_days,
            return_5d:     i.return_5d,
          })),
          force_refresh:      isForceRefresh,
        }),
      })
      return r.json()
    },
    enabled: vaniTriggered && !!result && !!itemA && !!itemB,
    staleTime: Infinity,
    retry: 1,
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {vaniTriggered && (insightLoading || vaniMinWait) && <VaNiModal />}

      {/* Topbar */}
      <div style={{
        flexShrink: 0,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/workspace')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft size={14} />
          Workspace
        </button>

        <span style={{ color: 'var(--border)' }}>·</span>

        {/* Pair breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11, color: 'var(--accent)',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-dim)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            {aLabel}
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>∩</span>
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11, color: 'var(--accent)',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-dim)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            {bLabel}
          </span>
          {shapeLabel && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-muted)', letterSpacing: '0.08em',
              background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
              border: '1px solid var(--border)',
              padding: '1px 6px', borderRadius: 3,
            }}>
              {shapeLabel}
            </span>
          )}
          {result?.currently_active && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--caution)', background: 'var(--caution-bg)',
              border: '1px solid var(--caution-dim)',
              padding: '1px 6px', borderRadius: 3,
            }}>
              Active now
            </span>
          )}
        </div>

        {/* Pair nav */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            disabled={!prevCorr}
            onClick={() => prevCorr && navigate(`/correlation/${prevCorr.item_a}/${prevCorr.item_b}`)}
            style={{
              background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '4px 8px', cursor: prevCorr ? 'pointer' : 'not-allowed',
              color: prevCorr ? 'var(--text-secondary)' : 'var(--text-faint)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronLeft size={13} />
          </button>
          <button
            disabled={!nextCorr}
            onClick={() => nextCorr && navigate(`/correlation/${nextCorr.item_a}/${nextCorr.item_b}`)}
            style={{
              background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border)',
              borderRadius: 5, padding: '4px 8px', cursor: nextCorr ? 'pointer' : 'not-allowed',
              color: nextCorr ? 'var(--text-secondary)' : 'var(--text-faint)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{
          width: 320, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          padding: '20px 20px 32px',
        }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}

          {result && (
            <>
              {/* VaNi trigger — top of panel, disappears once triggered */}
              {!vaniTriggered && (
                <button
                  onClick={() => {
                    setVaniTriggered(true)
                    setVaniMinWait(true)
                    setTimeout(() => setVaniMinWait(false), 900)
                  }}
                  style={{
                    width: '100%', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent-dim)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)', opacity: 0.2 }} />
                    <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'linear-gradient(135deg,#9d8ff9,#5b4fd4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono,monospace)' }}>
                      Vᴺ
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono,monospace)', letterSpacing: '0.08em' }}>Ask VaNi</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>What does this combination mean?</div>
                  </div>
                </button>
              )}

              {/* Confidence dial — label rendered inside ConfidenceDial */}
              <div style={{ marginBottom: 20 }}>
                <ConfidenceDial
                  n_instances={result.n_instances}
                  hit_rate={hitRate}
                />
              </div>

              {/* Stats 2×2 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Total Instances', value: result.n_instances },
                  { label: 'Resolved',        value: result.bullish_count + result.bearish_count },
                  { label: '5D Avg Return',   value: `${result.avg_return_5d >= 0 ? '+' : ''}${result.avg_return_5d.toFixed(2)}%` },
                  { label: '22D Avg Return',  value: `${result.avg_return_22d >= 0 ? '+' : ''}${result.avg_return_22d.toFixed(2)}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)', border: '1px solid var(--border)',
                    borderRadius: 7, padding: '10px 12px',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300,
                      color: 'var(--text-primary)', letterSpacing: '-0.02em',
                    }}>
                      {value}
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-muted)', marginTop: 2,
                    }}>
                      {label.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data quality pill */}
              {result.coverage_pct != null && (
                <div style={{ marginBottom: 16 }}>
                  <DataQualityPill
                    coverage_pct={result.coverage_pct}
                    days_covered={result.days_covered ?? 0}
                    date_from={result.date_from ?? ''}
                    date_to={result.date_to ?? ''}
                  />
                </div>
              )}

              {/* Outcome split bar */}
              {total > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)', letterSpacing: '0.1em',
                    textTransform: 'uppercase', marginBottom: 8,
                  }}>
                    Outcome Split
                  </div>
                  <div style={{ borderRadius: 4, overflow: 'hidden', height: 8, display: 'flex' }}>
                    <div style={{
                      width: `${(bullCount / total) * 100}%`,
                      background: 'var(--bull)', transition: 'width 0.4s ease',
                    }} />
                    <div style={{
                      width: `${(bearCount / total) * 100}%`,
                      background: 'var(--bear)', transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: 5, fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    <span style={{ color: 'var(--bull)' }}>{bullCount} up</span>
                    <span style={{ color: 'var(--bear)' }}>{bearCount} down</span>
                  </div>
                </div>
              )}

              {/* VaNi loader + insight — shown after trigger, in original position */}
              {/* VaNiModal handles loading overlay at root level */}

              {vaniTriggered && !insightLoading && !vaniMinWait && insightData?.insight && (
                <div style={{
                  padding: '12px 14px', marginBottom: 12,
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent-dim)',
                  borderRadius: 8,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                    background: 'linear-gradient(180deg, var(--accent), transparent)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ color: 'var(--accent)', fontSize: 12 }}>✦</span>
                    <span style={{
                      fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: 'var(--accent)', fontWeight: 600,
                      fontFamily: 'var(--font-mono,monospace)',
                    }}>VaNi</span>
                    {isAdmin && (
                      <button
                        title="Regenerate — bypasses cache"
                        onClick={async () => {
                          const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? ''
                          try {
                            await fetch(`${pipelineUrl}/api/vani/correlation-insight/${encodeURIComponent(itemA)}/${encodeURIComponent(itemB)}/${encodeURIComponent(result?.shape ?? '')}`, { method: 'DELETE' })
                          } catch {}
                          // Remove all cached versions of this query (any refreshCount)
                          queryClient.removeQueries({ queryKey: ['corr-insight', itemA, itemB, result?.shape] })
                          setRefreshCount(prev => prev + 1)
                          setVaniTriggered(false)
                        }}
                        style={{
                          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3,
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 8, fontFamily: 'var(--font-mono,monospace)',
                          color: 'rgba(239,68,68,0.35)', padding: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.8)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.35)')}
                      >
                        <Trash2 style={{ width: 10, height: 10 }} />
                        <span>clear cache</span>
                      </button>
                    )}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display, serif)',
                    fontSize: 13, fontStyle: 'italic',
                    fontWeight: 400, lineHeight: 1.6,
                    color: 'var(--text-primary)',
                  }}>
                    {insightData.insight}
                  </div>
                  {insightData.log_id && <VaNiFeedback logId={insightData.log_id} />}
                </div>
              )}

              {/* Walk mode CTA */}
              <button
                onClick={() => canWalk ? undefined : setWalkGateOpen(true)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, fontSize: 12,
                  border: '1px solid rgba(124,106,247,0.35)',
                  background: canWalk ? 'rgba(124,106,247,0.10)' : 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
                  color: canWalk ? '#8b7af8' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  marginTop: 8, transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (canWalk) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(124,106,247,0.18)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,247,0.55)'
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = canWalk ? 'rgba(124,106,247,0.10)' : 'color-mix(in srgb, var(--text-primary) 3%, transparent)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,247,0.35)'
                }}
              >
                {!canWalk && <span style={{ marginRight: 5 }}>🔒</span>}
                Walk through all {result.n_instances} instances on chart →
              </button>

              {/* Dismiss */}
              <button
                onClick={() => { dismissCorrelation(itemA ?? '', itemB ?? ''); navigate('/workspace') }}
                style={{
                  width: '100%', padding: '8px', borderRadius: 7, fontSize: 11,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                  marginTop: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--text-primary) 20%, transparent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                Dismiss correlation
              </button>
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> Computing correlation…
            </div>
          )}

          {result && (
            <>
              {/* Viz selector */}
              {vizOptions.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-muted)', marginBottom: 8,
                  }}>
                    <span style={{ color: 'var(--accent)' }}>✦</span> VaNi suggests for {result.shape} · n={result.n_instances}:
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
                    {vizOptions.map(opt => (
                      <div key={opt.id} style={{ position: 'relative' }}>
                        {opt.recommended && (
                          <span style={{
                            position: 'absolute', top: -14, left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 8, fontFamily: 'var(--font-mono, monospace)',
                            color: 'var(--accent)', whiteSpace: 'nowrap',
                          }}>
                            VaNi pick
                          </span>
                        )}
                        <button
                          onClick={() => selectViz(opt.id)}
                          style={{
                            padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                            border: `1px solid ${vizId === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                            background: vizId === opt.id ? 'var(--accent-glow)' : 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
                            color: vizId === opt.id ? 'var(--accent)' : 'var(--text-muted)',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                          }}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active viz */}
              <div style={{ marginTop: vizOptions.some(v => v.recommended) ? 12 : 0 }}>
                {vizId === 'grid'         && <InstanceGrid     instances={result.instances} />}
                {vizId === 'timeline'     && <GanttTimeline    instances={result.instances} />}
                {vizId === 'distribution' && <Distribution     instances={result.instances} />}
                {vizId === 'table'        && <InstanceTable    instances={result.instances} />}
              </div>
            </>
          )}

          {!loading && !result && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
              No correlation data available for this pair.
            </div>
          )}
        </div>
      </div>

      <InlineGate
        context="walk_mode"
        isOpen={walkGateOpen}
        onDismiss={() => setWalkGateOpen(false)}
      />
    </div>
  )
}
