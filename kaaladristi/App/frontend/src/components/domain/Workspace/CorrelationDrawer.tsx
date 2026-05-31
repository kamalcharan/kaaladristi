import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace(/_/g, ' ').toUpperCase()
}

function pairLabel(c: VaNiCorrelation): string {
  return `${fmtId(c.item_a)} ∩ ${fmtId(c.item_b)}`
}

function vaNiNote(c: VaNiCorrelation): string {
  const direction = c.avg_return_5d < 0 ? 'bearish' : 'bullish'
  const strength  = Math.abs(c.avg_return_5d) > 1 ? 'strongly' : 'mildly'
  const active    = c.currently_active ? 'is currently active and' : 'has historically'
  return `This confluence ${active} resolved ${strength} ${direction} in ${c.bullish_count + c.bearish_count} of ${c.n_instances} instances, with an average 5-day move of ${c.avg_return_5d >= 0 ? '+' : ''}${c.avg_return_5d.toFixed(2)}% and 22-day move of ${c.avg_return_22d >= 0 ? '+' : ''}${c.avg_return_22d.toFixed(2)}%.`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontFamily: 'var(--font-mono,monospace)' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono,monospace)' }}>
        {value}
      </span>
    </div>
  )
}

function OutcomeBar({ bullish, bearish, total }: { bullish: number; bearish: number; total: number }) {
  const bullPct = total > 0 ? (bullish / total) * 100 : 50
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10,
        color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font-mono,monospace)' }}>
        <span style={{ color: '#10b981' }}>▲ {bullish} bullish</span>
        <span style={{ color: '#ef4444' }}>{bearish} bearish ▼</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(239,68,68,.25)',
        display: 'flex' }}>
        <div style={{ width: `${bullPct}%`, background: '#10b981', borderRadius: '3px 0 0 3px',
          transition: 'width .4s' }} />
      </div>
    </div>
  )
}

function InstanceRow({ inst }: { inst: VaNiCorrelation['instances'][0] }) {
  const ret5 = inst.return_5d
  const isPos = ret5 !== null && ret5 >= 0
  const isNeg = ret5 !== null && ret5 < 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
      borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 11 }}>
      <span style={{ color: 'rgba(255,255,255,.45)', fontFamily: 'var(--font-mono,monospace)',
        minWidth: 72 }}>
        {inst.start_date}
      </span>
      <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 10, minWidth: 40 }}>
        {inst.duration_days}d
      </span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)',
        overflow: 'hidden' }}>
        {ret5 !== null && (
          <div style={{
            width: `${Math.min(Math.abs(ret5) * 15, 100)}%`,
            height: '100%',
            background: isPos ? '#10b981' : '#ef4444',
            borderRadius: 2,
          }} />
        )}
      </div>
      <span style={{ minWidth: 52, textAlign: 'right', fontFamily: 'var(--font-mono,monospace)',
        color: isPos ? '#10b981' : isNeg ? '#ef4444' : 'rgba(255,255,255,.25)', fontSize: 11 }}>
        {ret5 !== null ? `${ret5 >= 0 ? '+' : ''}${ret5.toFixed(2)}%` : '—'}
      </span>
    </div>
  )
}

function PairDetail({ corr, onDismiss }: { corr: VaNiCorrelation; onDismiss: () => void }) {
  const total = corr.bullish_count + corr.bearish_count
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 20px 24px' }}>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {corr.currently_active ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 8px #10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Active Now</span>
          </>
        ) : (
          <>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b',
              display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: '#f59e0b' }}>Approaching</span>
          </>
        )}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontFamily: 'var(--font-mono,monospace)',
          marginLeft: 4 }}>
          {corr.shape}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        padding: 14, background: 'rgba(255,255,255,.03)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,.06)' }}>
        <StatBox label="Instances" value={String(corr.n_instances)} />
        <StatBox label="Bull / Bear" value={`${corr.bullish_count} / ${corr.bearish_count}`} />
        <StatBox label="5D avg"
          value={`${corr.avg_return_5d >= 0 ? '+' : ''}${corr.avg_return_5d.toFixed(2)}%`}
          color={corr.avg_return_5d >= 0 ? '#10b981' : '#ef4444'} />
        <StatBox label="22D avg"
          value={`${corr.avg_return_22d >= 0 ? '+' : ''}${corr.avg_return_22d.toFixed(2)}%`}
          color={corr.avg_return_22d >= 0 ? '#10b981' : '#ef4444'} />
      </div>

      {/* Outcome bar */}
      <OutcomeBar bullish={corr.bullish_count} bearish={corr.bearish_count} total={total} />

      {/* Instance list */}
      <div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 6,
          fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.05em' }}>
          HISTORICAL INSTANCES
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {corr.instances.map((inst, i) => (
            <InstanceRow key={i} inst={inst} />
          ))}
        </div>
      </div>

      {/* VaNi inference note */}
      <div style={{ padding: 12, background: 'rgba(139,92,246,.06)', borderRadius: 8,
        border: '1px solid rgba(139,92,246,.2)', fontSize: 12,
        color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
        <span style={{ color: '#a78bfa', marginRight: 6, fontSize: 10 }}>✦ VaNi</span>
        {vaNiNote(corr)}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
          color: 'rgba(255,255,255,.4)', cursor: 'not-allowed' }}>
          Mark on chart
        </button>
        <button style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
          color: 'rgba(255,255,255,.4)', cursor: 'not-allowed' }}>
          Save observation
        </button>
        <button
          onClick={onDismiss}
          style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12,
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
            color: '#f87171', cursor: 'pointer' }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

interface Props {
  isOpen:        boolean
  activePairKey: string | null   // "item_a:item_b"
  onClose:       () => void
  onSelectPair:  (key: string) => void
}

export default function CorrelationDrawer({ isOpen, activePairKey, onClose, onSelectPair }: Props) {
  const correlations      = useFrameworkStore(s => s.vaniCorrelations)
  const dismissCorrelation = useFrameworkStore(s => s.dismissVaNiCorrelation)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const activeCorr = correlations.find(
    c => `${c.item_a}:${c.item_b}` === activePairKey
  ) ?? correlations[0] ?? null

  if (!isOpen || correlations.length === 0) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(0,0,0,.25)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        zIndex: 200, display: 'flex', flexDirection: 'column',
        background: 'rgba(13,17,23,.97)', backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(139,92,246,.2)',
        boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Drawer header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#a78bfa' }}>✦</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              VaNi Confluence
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)',
            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Pair tabs */}
        {correlations.length > 1 && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)',
            overflowX: 'auto', flexShrink: 0 }}>
            {correlations.map(c => {
              const key     = `${c.item_a}:${c.item_b}`
              const isActive = key === (activePairKey ?? `${correlations[0].item_a}:${correlations[0].item_b}`)
              return (
                <button
                  key={key}
                  onClick={() => onSelectPair(key)}
                  style={{
                    padding: '10px 14px', fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer',
                    background: 'none', border: 'none',
                    borderBottom: isActive ? '2px solid #a78bfa' : '2px solid transparent',
                    color: isActive ? '#c4b5fd' : 'rgba(255,255,255,.35)',
                    fontFamily: 'var(--font-mono,monospace)',
                  }}>
                  {fmtId(c.item_a)} ∩ {fmtId(c.item_b)} · {c.n_instances}×
                </button>
              )
            })}
          </div>
        )}

        {/* Active pair label (single pair — no tabs) */}
        {correlations.length === 1 && activeCorr && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.06)',
            flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: '#c4b5fd', fontFamily: 'var(--font-mono,monospace)' }}>
              {pairLabel(activeCorr)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>
              {activeCorr.n_instances} instances detected
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16 }}>
          {activeCorr && (
            <PairDetail
              corr={activeCorr}
              onDismiss={() => {
                dismissCorrelation(activeCorr.item_a, activeCorr.item_b)
                if (correlations.length <= 1) onClose()
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
