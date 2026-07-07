import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useFrameworkStore, type VaNiCorrelation } from '@/stores/frameworkStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtId(id: string): string {
  return id.replace('astro_rule:', '').replace('astro_group:', '').replace(/_/g, ' ').toUpperCase()
}

function fmtRet(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function retColor(v: number | null): string {
  if (v === null) return 'var(--text-faint)'
  return v >= 0 ? 'var(--bull)' : 'var(--bear)'
}

function pairLabel(c: VaNiCorrelation): string {
  return `${fmtId(c.item_a)} ∩ ${fmtId(c.item_b)}`
}

function vaniOneLiner(corr: VaNiCorrelation): string {
  const resolved = corr.instances.filter(i => i.return_5d !== null).length
  const higher   = corr.bullish_count
  const lower    = corr.bearish_count
  const current  = corr.currently_active
    ? ' One instance currently active.'
    : corr.n_instances > resolved ? ' One instance approaching.' : ''
  return `${corr.n_instances} instances on record — ${higher} closed higher, ${lower} closed lower.${current}`
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono,monospace)',
        letterSpacing: '.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, color: color ?? 'var(--text-primary)',
        fontFamily: 'var(--font-mono,monospace)' }}>
        {value}
      </span>
    </div>
  )
}

function OutcomeBar({ bullish, bearish }: { bullish: number; bearish: number }) {
  const total   = bullish + bearish
  const bullPct = total > 0 ? (bullish / total) * 100 : 50
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 10,
        color: 'var(--text-muted)', fontFamily: 'var(--font-mono,monospace)' }}>
        <span style={{ color: 'var(--bull)' }}>▲ {bullish} higher</span>
        <span style={{ color: 'var(--bear)' }}>{bearish} lower ▼</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--bear-bg)',
        display: 'flex' }}>
        <div style={{ width: `${bullPct}%`, background: 'var(--bull)', borderRadius: '3px 0 0 3px',
          transition: 'width .4s' }} />
      </div>
    </div>
  )
}

// ── PairDetail ────────────────────────────────────────────────────────────────

function PairDetail({ corr, onDismiss, onOpenFull }: {
  corr: VaNiCorrelation
  onDismiss: () => void
  onOpenFull: () => void
}) {
  return (
    <>
      {/* Pair identity */}
      <div style={{ flexShrink: 0, padding: '14px 16px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#c4b5fd',
          fontFamily: 'var(--font-display, var(--font-mono, monospace))',
          lineHeight: 1.4, marginBottom: 8 }}>
          {pairLabel(corr)}
        </div>
        {/* Status badge + shape tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {corr.currently_active ? (
            <>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bull)',
                boxShadow: '0 0 6px var(--bull)', display: 'inline-block',
                animation: 'pulse 2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--bull)', fontWeight: 600 }}>Active Now</span>
            </>
          ) : (
            <>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--caution)',
                display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--caution)' }}>Approaching</span>
            </>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-faint)',
            fontFamily: 'var(--font-mono,monospace)', marginLeft: 2 }}>
            {corr.shape}
          </span>
        </div>
      </div>

      {/* Stats 2×2 */}
      <div style={{ flexShrink: 0, padding: '0 16px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
          padding: 14, background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)', borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)' }}>
          <StatBox label="Instances"  value={String(corr.n_instances)} />
          <StatBox label="Bull / Bear" value={`${corr.bullish_count} / ${corr.bearish_count}`} />
          <StatBox label="5D avg"
            value={fmtRet(corr.avg_return_5d)}
            color={retColor(corr.avg_return_5d)} />
          <StatBox label="22D avg"
            value={fmtRet(corr.avg_return_22d)}
            color={retColor(corr.avg_return_22d)} />
        </div>
      </div>

      {/* Outcome bar */}
      <div style={{ flexShrink: 0, padding: '0 16px 14px' }}>
        <OutcomeBar bullish={corr.bullish_count} bearish={corr.bearish_count} />
      </div>

      {/* VaNi one-liner */}
      <div style={{ flexShrink: 0, padding: '12px 16px',
        background: 'var(--accent-glow)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent)', fontSize: 10,
          fontFamily: 'var(--font-mono,monospace)' }}>✦ VaNi · </span>
        <span style={{ fontSize: 12, fontStyle: 'italic',
          fontFamily: 'var(--font-display, serif)',
          color: 'var(--text-secondary)' }}>
          {vaniOneLiner(corr)}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ height: 24 }} />

      {/* Actions */}
      <div style={{ flexShrink: 0, padding: '12px 16px 20px',
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onOpenFull}
          style={{
            width: '100%', padding: '9px', borderRadius: 8, fontSize: 12,
            border: '1px solid var(--accent-dim)',
            background: 'var(--accent-glow)',
            color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--accent-dim)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--accent-glow)'
          }}
        >
          Open full view →
        </button>
        <button
          onClick={onDismiss}
          style={{
            width: '100%', padding: '9px', borderRadius: 8, fontSize: 12,
            background: 'transparent',
            border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)',
            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          Dismiss
        </button>
      </div>
    </>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

interface Props {
  isOpen:        boolean
  activePairKey: string | null
  onClose:       () => void
  onSelectPair:  (key: string) => void
}

export default function CorrelationDrawer({ isOpen, activePairKey, onClose, onSelectPair }: Props) {
  const navigate           = useNavigate()
  const correlations       = useFrameworkStore(s => s.vaniCorrelations)
  const dismissCorrelation = useFrameworkStore(s => s.dismissVaNiCorrelation)

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
        position: 'fixed', top: 52, right: 0, bottom: 0, width: 320,
        zIndex: 200, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--card)',
        borderLeft: '1px solid var(--accent-dim)',
        boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 12, color: '#a78bfa' }}>✦</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              VaNi Confluence
            </span>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Pair tabs — only shown when multiple pairs */}
        {correlations.length > 1 && (
          <div style={{
            display: 'flex', gap: 4, flexShrink: 0,
            borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
            {correlations.map(c => {
              const key      = `${c.item_a}:${c.item_b}`
              const isActive = key === (activePairKey ?? `${correlations[0].item_a}:${correlations[0].item_b}`)
              return (
                <button
                  key={key}
                  onClick={() => onSelectPair(key)}
                  style={{
                    padding: '6px 8px', fontSize: 10, whiteSpace: 'nowrap', cursor: 'pointer',
                    background: 'none', border: 'none',
                    borderBottom: isActive ? '2px solid #a78bfa' : '2px solid transparent',
                    color: isActive ? '#c4b5fd' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono,monospace)',
                  }}>
                  {fmtId(c.item_a)} ∩ {fmtId(c.item_b)} · {c.n_instances}×
                </button>
              )
            })}
          </div>
        )}

        {/* Pair detail — flex column fills remaining space */}
        {activeCorr && (
          <PairDetail
            corr={activeCorr}
            onDismiss={() => {
              dismissCorrelation(activeCorr.item_a, activeCorr.item_b)
              if (correlations.length <= 1) onClose()
            }}
            onOpenFull={() => {
              onClose()
              navigate(`/correlation/${activeCorr.item_a}/${activeCorr.item_b}`)
            }}
          />
        )}
      </div>
    </>
  )
}
