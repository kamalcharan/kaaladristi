import { useEffect, useRef } from 'react'
import { useActiveRuleToday } from '@/hooks/useRuleInsight'
import RuleInsightCard from './RuleInsightCard'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

/**
 * Anchored popover that explains an overlay group: which specific rule in the tag
 * is active today (+ the next upcoming one) and VaNi's plain-language interpretation
 * of it. Reuses useActiveRuleToday + RuleInsightCard. Renders nothing extra when the
 * LLM is offline (RuleInsightCard self-hides).
 */
export default function OverlayExplainPopover({
  tag, anchorX, anchorY, onClose,
}: {
  tag: string
  anchorX: number
  anchorY: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useActiveRuleToday(tag)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handle) }
  }, [onClose])

  const active   = data?.active_now?.[0]
  const upcoming = data?.upcoming?.[0]
  const insightRuleId = active?.id ?? upcoming?.id ?? null

  const left = Math.max(8, Math.min(anchorX, window.innerWidth - 348))

  return (
    <div
      ref={ref}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left, top: anchorY + 6, zIndex: 500,
        width: 340, maxHeight: '70vh', overflowY: 'auto',
        background: 'var(--bg-card, #0d1117)',
        border: '1px solid rgba(157,143,249,0.25)', borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)', padding: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{tag}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono,monospace)' }}>
          overlay
        </span>
        <button
          onClick={onClose}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, padding: 0, lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Active today */}
      {isLoading ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Checking what's active…</div>
      ) : active ? (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 5px rgba(16,185,129,0.8)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
              {active.display_name}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono,monospace)' }}>
            Active now{active.end_date ? ` · ends ${fmtDate(active.end_date)}` : ''}
            {active.days_remaining != null ? ` (${active.days_remaining}d left)` : ''}
            {active.base_bias ? ` · ${active.base_bias}` : ''}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          No {tag} rule active today.
        </div>
      )}

      {/* Upcoming */}
      {upcoming && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono,monospace)' }}>
          Next: {upcoming.display_name}
          {upcoming.start_date ? ` · ${fmtDate(upcoming.start_date)}` : ''}
          {upcoming.days_until != null ? ` (in ${upcoming.days_until}d)` : ''}
        </div>
      )}

      {/* VaNi interpretation of the active (or next) rule — self-hides when none */}
      <RuleInsightCard ruleId={insightRuleId} className="mt-3" />
    </div>
  )
}
