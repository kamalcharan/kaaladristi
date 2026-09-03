import { useEffect, useRef, useState } from 'react'
import { getEquityIntents } from '@/config/vaniIntents'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { usePipelineStatus } from '@/hooks/usePipelineStatus'
import { fmtDateLong } from '@/lib/dateUtils'
import VaNiInsight from '@/components/domain/VaNiInsight'
import { useStockAskStore } from '@/stores/stockAskStore'

type EquityIntentKey = 'equity.explain_signals' | 'equity.why_in_context' | 'equity.risk_assessment'

/**
 * Anchored per-stock "Ask VaNi" popover — replaces VaNiTrigger's old
 * `openWithEntity()` call, which opened the global right-side drawer.
 *
 * Owner (2026-09-02, re: the sparkle icon in every scan table row): "why am
 * i still getting slide for the onboard vani, we have discussed this a few
 * times" — the same "existing VaNi space, not a right drawer" complaint
 * already fixed for the on-page screener-level pills had never been applied
 * to this per-stock trigger. Owner's choice, given three options: an inline
 * popover anchored to the clicked row.
 *
 * Owner follow-up (2026-09-03): a per-row local `anchor` (this component's
 * original v1) let every row open its OWN popover independently, and the
 * popover stayed pinned to a one-time click-point snapshot even as the page
 * scrolled, drifting away from the row it was actually about. Fixed by
 * mounting exactly ONE instance globally (Layout.tsx, next to
 * VaNiChatPanel) driven by `stockAskStore` — `open()` there always replaces
 * whatever was open, so a second row's click can never leave two popovers
 * live — and by tracking the anchor as a live DOM element reference, whose
 * `getBoundingClientRect()` is re-read on every scroll/resize event (capture
 * phase, so it catches scrolling inside a nested container too, not just the
 * window) rather than computed once at click time.
 *
 * Mechanically still a copy of `OverlayExplainPopover.tsx`'s anchored-popover
 * chrome (fixed position clamped to the viewport, click-outside + Escape to
 * close) — the content is the entity intents (`equity.*`) VaNiChatPanel.tsx's
 * drawer already asks for this entity, just rendered here instead of there.
 */
export default function StockAskPopover() {
  const entity = useStockAskStore((s) => s.entity)
  const anchorEl = useStockAskStore((s) => s.anchorEl)
  const close = useStockAskStore((s) => s.close)

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

  // Live position — recomputed from the anchor element's current bounding
  // rect, not a one-time snapshot, so the popover tracks the clicked row
  // through scrolling instead of drifting to a stale viewport coordinate.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    if (!anchorEl) { setPos(null); return }
    const update = () => {
      const rect = anchorEl.getBoundingClientRect()
      setPos({ left: rect.left, top: rect.bottom + 6 })
    }
    update()
    // capture: true catches scroll events from any nested scroll container
    // on the page (scroll events don't bubble, but do fire in the capture
    // phase on ancestors, window included), not just window-level scroll.
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [anchorEl])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 0)
    document.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [close])

  // Reset which intent pill is active + fire the default question fresh
  // whenever a NEW entity opens. This component is now a single long-lived
  // global instance (mounted once in Layout.tsx) shared across every stock —
  // without resetting explain/risk here too, ask()'s "already have data,
  // don't refire" guard would show a PREVIOUS stock's stale answer under a
  // pill for the stock now open, since a mutation's `.data` otherwise only
  // clears on its own next `.mutate()` call.
  const askedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!entity) return
    const key = `${entity.type}:${entity.id}`
    if (askedForRef.current === key) return
    askedForRef.current = key
    setActiveIntent('equity.why_in_context')
    explainMutation.reset()
    riskMutation.reset()
    const dateIso = latestDataDate || new Date().toISOString().slice(0, 10)
    whyMutation.mutate({
      intent_id: 'equity.why_in_context',
      date: dateIso,
      entity_type: entity.type,
      entity_id: entity.id,
      page_context: entity.pageContext,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.type, entity?.id])

  if (!entity || !anchorEl || !pos) return null

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

  const intents = getEquityIntents(entity.symbol) as Array<{ intentId: EquityIntentKey; label: string }>
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - 348))

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left, top: pos.top, zIndex: 500,
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
          onClick={close}
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
