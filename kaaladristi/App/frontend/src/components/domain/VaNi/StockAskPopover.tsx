import { useEffect, useRef, useState } from 'react'
import { getEquityIntents } from '@/config/vaniIntents'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { usePipelineStatus } from '@/hooks/usePipelineStatus'
import { fmtDateLong } from '@/lib/dateUtils'
import VaNiInsight from '@/components/domain/VaNiInsight'
import type { VaNiEntity } from '@/stores/vaniStore'

type EquityIntentKey = 'equity.explain_signals' | 'equity.why_in_context' | 'equity.risk_assessment'

/**
 * Anchored per-stock "Ask VaNi" popover — replaces VaNiTrigger's old
 * `openWithEntity()` call, which opened the global right-side drawer.
 *
 * Owner (2026-09-02, re: the sparkle icon in every scan table row): "why am
 * i still getting slide for the onboard vani, we have discussed this a few
 * times" — the same "existing VaNi space, not a right drawer" complaint
 * already fixed for the on-page screener-level pills (breakout-surge-vani-poa.md
 * v10-v12) had never been applied to this PER-STOCK trigger, which
 * `docs/claude/vani-common-component.md` had actually documented as a
 * deliberate exception ("list/scanner pages stay on-demand via the drawer").
 * Owner's choice this round, given three options: an inline popover anchored
 * to the clicked row — not the drawer, and not a scroll-away trip to a
 * shared on-page card either, since a table row has no "on page" card of its
 * own the way a single-stock/scanner page does.
 *
 * Mechanically a copy of `OverlayExplainPopover.tsx`'s proven anchored-popover
 * chrome (fixed position clamped to the viewport, click-outside + Escape to
 * close) — the content is the entity intents (`equity.*`) VaNiChatPanel.tsx's
 * drawer already asks for this entity, just rendered here instead of there.
 */
export default function StockAskPopover({
  entity, anchorX, anchorY, onClose,
}: {
  entity: VaNiEntity
  anchorX: number
  anchorY: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { latestDataDate, latestDataDateFormatted } = usePipelineStatus()

  const explainMutation = useVaNiAsk()
  const whyMutation = useVaNiAsk()
  const riskMutation = useVaNiAsk()
  const mutationByIntent: Record<EquityIntentKey, ReturnType<typeof useVaNiAsk>> = {
    'equity.explain_signals': explainMutation,
    'equity.why_in_context': whyMutation,
    'equity.risk_assessment': riskMutation,
  }
  const [activeIntent, setActiveIntent] = useState<EquityIntentKey>('equity.why_in_context')
  const active = mutationByIntent[activeIntent]

  const intents = getEquityIntents(entity.symbol) as Array<{ intentId: EquityIntentKey; label: string }>

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 0)
    document.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const ask = (intentId: EquityIntentKey) => {
    setActiveIntent(intentId)
    const mutation = mutationByIntent[intentId]
    if (mutation.data || mutation.isPending) return
    const dateIso = latestDataDate || new Date().toISOString().slice(0, 10)
    mutation.mutate({
      intent_id: intentId,
      date: dateIso,
      entity_type: entity.type,
      entity_id: entity.id,
      page_context: entity.pageContext,
    })
  }

  // Fires eagerly, same default the gated stock-lookup search in
  // VaNiChatPanel.tsx already uses for "tell me about this stock".
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    ask('equity.why_in_context')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const left = Math.max(8, Math.min(anchorX, window.innerWidth - 348))

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left, top: anchorY + 6, zIndex: 500,
        width: 340, maxHeight: '70vh', overflowY: 'auto',
        background: 'var(--card)',
        border: '1px solid var(--border-indigo)', borderRadius: 12,
        boxShadow: '0 16px 48px color-mix(in srgb, black 45%, transparent)',
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{entity.symbol}</span>
        {entity.pageContext && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entity.pageContext}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)' }}>
          {latestDataDateFormatted || fmtDateLong(latestDataDate || '')}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, padding: 0, lineHeight: 1,
          }}
        >✕</button>
      </div>

      <VaNiInsight
        insight={active.data?.response}
        isLoading={active.isPending}
        logId={active.data?.log_id ?? undefined}
        className="mt-0"
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {intents.map((i) => (
          <button
            key={i.intentId}
            onClick={() => ask(i.intentId)}
            style={{
              padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${activeIntent === i.intentId ? 'var(--indigo)' : 'var(--border)'}`,
              background: activeIntent === i.intentId ? 'var(--indigo-bg)' : 'transparent',
              color: activeIntent === i.intentId ? 'var(--indigo)' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  )
}
