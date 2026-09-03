import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEquityIntents } from '@/config/vaniIntents'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { usePipelineStatus } from '@/hooks/usePipelineStatus'
import { fmtDateLong } from '@/lib/dateUtils'
import { zoneLabel, flowLabel } from '@/constants/signalScale'
import VaNiInsight from '@/components/domain/VaNiInsight'
import { useStockAskStore } from '@/stores/stockAskStore'

type EquityIntentKey = 'equity.explain_signals' | 'equity.why_in_context' | 'equity.risk_assessment'

// Provisional confirmation thresholds for the line-item read below — not
// calibrated against real data distributions yet (see LESSONS_LEARNED.md's
// "always check actual data distribution before setting numeric thresholds"
// — sniper_inst/sniper_hot were wrong for exactly this reason). RVOL >= 3
// and delivery >= 30% are the same cuts already used elsewhere on this page
// (Real Volume Behind tile, delivery_surge scans); owner should sanity-check
// both against `percentile_cont` before this ships for real.
const RVOL_CONFIRM_MIN = 3
const DELIVERY_CONFIRM_MIN = 30
const CONFIRMING_ZONES = ['Strong Bull', 'Mild Bull']

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
 * Owner follow-up (2026-09-03, VaNi Two Levels mock review): a wall of two
 * paragraphs read as "big paragraphs, is it hallucinating" for numbers that
 * were real but narrated instead of shown. Added a confirmation row (do
 * volume/flow/RS/delivery agree — real math, no LLM) above the VaNi answer,
 * so the model's job shrinks to the one sentence that's actually its job:
 * the read on whatever the pills already show. Confirmation only renders
 * when the caller passes `entity.signals` (ScanTable.tsx does; other
 * VaNiTrigger call sites and the URL-derived chart-page entity don't yet —
 * the popover degrades to VaNi-answer-only for those, same as before).
 * Also added Study →, which just navigates to the real ChartView route
 * (`/chart/equity/:id`) — that page's own event/story-pin rendering is
 * unrelated and untouched, this only has to get there correctly.
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
  const navigate = useNavigate()

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

  const study = () => {
    close()
    navigate(`/chart/equity/${entity.id}?name=${encodeURIComponent(entity.symbol)}&tab=chart`)
  }

  const intents = getEquityIntents(entity.symbol) as Array<{ intentId: EquityIntentKey; label: string }>
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - 348))
  const s = entity.signals

  const volOk = s?.rvol != null && s.rvol >= RVOL_CONFIRM_MIN
  const flowOk = s?.flowType === 'FRESH_LONGS'
  const rsOk = !!s?.magicRsZone && CONFIRMING_ZONES.includes(s.magicRsZone)
  const delivOk = s?.deliveryPct != null && s.deliveryPct >= DELIVERY_CONFIRM_MIN
  const confirmCount = s ? [volOk, flowOk, rsOk, delivOk].filter(Boolean).length : null

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
        {s && (
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: s.pctChng != null && s.pctChng >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
            ₹{s.close.toFixed(2)} {s.pctChng != null ? `${s.pctChng >= 0 ? '+' : ''}${s.pctChng.toFixed(2)}%` : ''}
          </span>
        )}
        {entity.pageContext && !s && (
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

      {s && confirmCount != null && (
        <>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            <ConfirmPill k="Volume" v={s.rvol != null ? `${s.rvol.toFixed(1)}x` : '—'} ok={volOk} />
            <ConfirmPill k="Flow" v={flowLabel(s.flowType).label} ok={flowOk} />
            <ConfirmPill k="RS Zone" v={zoneLabel(s.magicRsZone).label} ok={rsOk} />
            <ConfirmPill k="Delivery" v={s.deliveryPct != null ? `${s.deliveryPct}%` : '—'} ok={delivOk} />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 10 }}>
            <b style={{ color: 'var(--text-primary)' }}>{confirmCount} of 4</b> signals confirm
          </div>
        </>
      )}

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
        <button
          onClick={study}
          className="text-white"
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: 'none', background: 'var(--indigo)', fontFamily: 'var(--font-body)',
          }}
        >
          Study →
        </button>
      </div>
    </div>
  )
}

function ConfirmPill({ k, v, ok }: { k: string; v: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7,
      background: 'var(--card)', border: '1px solid var(--border)', fontSize: 10.5,
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, flexShrink: 0,
        background: ok ? 'color-mix(in srgb, var(--bull) 20%, transparent)' : 'color-mix(in srgb, var(--bear) 16%, transparent)',
        color: ok ? 'var(--bull)' : 'var(--bear)',
      }}>{ok ? '✓' : '–'}</span>
      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</span>
    </div>
  )
}
