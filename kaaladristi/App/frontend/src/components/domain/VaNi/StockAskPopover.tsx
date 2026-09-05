import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEquityIntents } from '@/config/vaniIntents'
import { useVaNiAsk } from '@/hooks/useVaNiChat'
import { usePipelineStatus } from '@/hooks/usePipelineStatus'
import { useScanPresence } from '@/hooks/useScanPresence'
import { fmtDateLong } from '@/lib/dateUtils'
import { zoneLabel, flowLabel } from '@/constants/signalScale'
import VaNiInsight from '@/components/domain/VaNiInsight'
import { PnlChart } from '@/components/domain/StockCockpit/ThesisTab'
import { computeThesis, type ThesisBar, type PositionInput, type ThesisRead } from '@/services/thesis'
import { fetchEquityEodById } from '@/services/indicatorData'
import { useStockAskStore } from '@/stores/stockAskStore'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { useAuthStore } from '@/stores/authStore'

type LlmEquityIntentKey = 'equity.explain_signals' | 'equity.why_in_context' | 'equity.risk_assessment'
type StructuredEquityIntentKey = 'equity.i_hold_this' | 'equity.can_i_enter'
type EquityIntentKey = LlmEquityIntentKey | StructuredEquityIntentKey

function isStructuredIntent(id: EquityIntentKey): id is StructuredEquityIntentKey {
  return id === 'equity.i_hold_this' || id === 'equity.can_i_enter'
}

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
 * Owner (2026-09-03, live on BODALCHEM): "line level pop up - put it nice -
 * landscape mode rather than vertical mode" — at the old fixed 340px width
 * the 4 confirm pills wrapped onto two rows and the VaNi paragraph wrapped
 * to 5-6 lines, stacking into a tall narrow card. Widened to 560px (capped
 * to the viewport) and split the body into two columns — a narrow rail with
 * the confirm pills in a 2x2 grid + the "N of 4" line on the left, the VaNi
 * answer filling the remaining width on the right — so the same content
 * reads wide and short instead of narrow and tall. The two columns wrap
 * back to stacked on a narrow viewport (flex-wrap, not a fixed split).
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
  const mutationByIntent: Record<LlmEquityIntentKey, ReturnType<typeof useVaNiAsk>> = {
    'equity.explain_signals': explainMutation,
    'equity.why_in_context': whyMutation,
    'equity.risk_assessment': riskMutation,
  }
  const [activeIntent, setActiveIntent] = useState<EquityIntentKey>('equity.why_in_context')
  const active = isStructuredIntent(activeIntent) ? null : mutationByIntent[activeIntent]

  // ── "I hold this" / "Can I enter now?" — deterministic, no LLM call.
  // Both read the SAME computeThesis() the Chart View Thesis tab uses; "I
  // hold this" reads a SAVED position (bookmarkStore), "Can I enter now?"
  // previews an UNSAVED one (today's close, a typed qty) through the exact
  // same function, per the owner-approved design plan.
  const userId = useAuthStore((s) => s.profile?.id) ?? null
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const hasLoadedBookmarks = useBookmarkStore((s) => s.hasLoaded)
  const loadBookmarks = useBookmarkStore((s) => s.load)
  const setPositionApi = useBookmarkStore((s) => s.setPosition)
  const clearPositionApi = useBookmarkStore((s) => s.clearPosition)
  const positionError = useBookmarkStore((s) => s.error)
  useEffect(() => { if (!hasLoadedBookmarks) loadBookmarks() }, [hasLoadedBookmarks, loadBookmarks])

  const bmRow = entity ? bookmarks.find((b) => b.equity_id === entity.id) ?? null : null
  const position: PositionInput | null = bmRow?.entry_price != null
    ? { entryPrice: bmRow.entry_price, entryDate: bmRow.entry_date ?? '', qty: bmRow.entry_qty }
    : null

  // Bars only fetched once one of the two position pills is actually opened
  // (not on every popover open) — same 6M range ChartView/ThesisTab use.
  const needsBars = activeIntent === 'equity.i_hold_this' || activeIntent === 'equity.can_i_enter'
  const barsQuery = useQuery({
    queryKey: ['ask-popover-bars', entity?.id],
    queryFn: () => fetchEquityEodById(entity!.id, '6M'),
    enabled: !!entity && needsBars,
    staleTime: 5 * 60 * 1000,
  })
  const bars = barsQuery.data as unknown as ThesisBar[] | undefined
  const latestClose = bars && bars.length ? bars[bars.length - 1].close : (entity?.signals?.close ?? null)
  const latestBarDate = bars && bars.length ? bars[bars.length - 1].trade_date : ''

  const heldThesis: ThesisRead | null = position && bars ? computeThesis(bars, 'position', position) : null

  const [holdQty, setHoldQty] = useState('')
  const [holdPrice, setHoldPrice] = useState('')
  const [holdDate, setHoldDate] = useState('')
  // Prefill the capture form's defaults once bars/last-close are known — same
  // pattern ThesisTab's own "+ I hold this" form uses.
  useEffect(() => {
    if (activeIntent === 'equity.i_hold_this' && !position) {
      setHoldPrice(latestClose != null ? String(latestClose) : '')
      setHoldDate(latestBarDate || latestDataDate || '')
      setHoldQty('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntent, position, latestClose, latestBarDate, latestDataDate])

  const [enterQty, setEnterQty] = useState('')
  const enterQtyNum = enterQty ? Number(enterQty) : null
  const previewPosition: PositionInput | null =
    enterQtyNum && enterQtyNum > 0 && latestClose != null
      ? { entryPrice: latestClose, entryDate: latestBarDate || latestDataDate || new Date().toISOString().slice(0, 10), qty: enterQtyNum }
      : null
  const previewThesis: ThesisRead | null = previewPosition && bars ? computeThesis(bars, 'position', previewPosition) : null

  // ── "Also in these scans" — owner (2026-09-04): "it is not an intent......
  // this has to be shown directly into the UI without invoking any intent."
  // Not a pill anymore — an always-visible strip, fetched as soon as the
  // popover opens for this stock (useScanPresence no-ops on a null id).
  const scanPresence = useScanPresence(entity ? entity.id : null)

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
    setHoldQty(''); setHoldPrice(''); setHoldDate('')
    setEnterQty('')
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
    // The 3 position/scan-presence pills are computed locally (thesis.ts /
    // useScanPresence) — never an LLM call, nothing to mutate.
    if (isStructuredIntent(intentId)) return
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

  const intents = getEquityIntents(entity.symbol) as Array<{ intentId: EquityIntentKey; label: string; group?: 'position' | 'market' }>
  const POPOVER_WIDTH = 560
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - POPOVER_WIDTH - 16))
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
        width: POPOVER_WIDTH, maxWidth: 'calc(100vw - 16px)', maxHeight: '70vh', overflowY: 'auto',
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

      <AlsoInScansStrip
        isLoading={scanPresence.isLoading}
        matchedScans={scanPresence.matchedScans}
        currentPresetId={entity.currentPresetId}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {activeIntent === 'equity.i_hold_this' ? (
          <HoldThisBody
            position={position}
            thesis={heldThesis}
            barsLoading={barsQuery.isLoading}
            qty={holdQty} setQty={setHoldQty}
            price={holdPrice} setPrice={setHoldPrice}
            date={holdDate} setDate={setHoldDate}
            canSave={userId != null}
            error={positionError}
            onSave={() => {
              const p = Number(holdPrice)
              if (!p || !holdDate) return
              setPositionApi(entity.id, { entry_price: p, entry_date: holdDate, entry_qty: holdQty ? Number(holdQty) : null })
            }}
            onClear={() => clearPositionApi(entity.id)}
          />
        ) : activeIntent === 'equity.can_i_enter' ? (
          <CanIEnterBody
            latestClose={latestClose}
            latestDate={latestBarDate || latestDataDate || ''}
            qty={enterQty} setQty={setEnterQty}
            thesis={previewThesis}
            barsLoading={barsQuery.isLoading && !!enterQtyNum}
            canSave={userId != null}
            error={positionError}
            onSave={async () => {
              if (!previewPosition) return
              await setPositionApi(entity.id, { entry_price: previewPosition.entryPrice, entry_date: previewPosition.entryDate, entry_qty: previewPosition.qty ?? null })
              // On success, switch straight to "I hold this" — that pill's
              // saved-position branch is the actual answer to "can I enter
              // now?" once the answer is "yes, and now you hold it." Bug
              // fixed here (owner, 2026-09-05): clearing enterQty right
              // after save wiped previewPosition/previewThesis back to
              // null, so the day-zero read vanished the instant it saved —
              // "it won't answer the question" — even though the save
              // itself had gone through (visible in Positions). On failure,
              // stay put with the qty/read intact so the error text next
              // to the button is visible and the user can retry.
              if (!useBookmarkStore.getState().error) {
                setEnterQty('')
                setActiveIntent('equity.i_hold_this')
              }
            }}
          />
        ) : (
          <>
            {s && confirmCount != null && (
              <div style={{ flex: '1 1 190px', minWidth: 170 }}>
                {/* Single column, not 2x2 — a 2-up grid at this width wrapped
                    longer values ("Fresh Longs") onto their own line, which
                    looked worse than just stacking all 4 (still far shorter
                    than the old fully-vertical card, since the VaNi text sits
                    beside this column instead of below it). */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                  <ConfirmPill k="Volume" v={s.rvol != null ? `${s.rvol.toFixed(1)}x` : '—'} ok={volOk} />
                  <ConfirmPill k="Flow" v={flowLabel(s.flowType).label} ok={flowOk} />
                  <ConfirmPill k="RS Zone" v={zoneLabel(s.magicRsZone).label} ok={rsOk} />
                  <ConfirmPill k="Delivery" v={s.deliveryPct != null ? `${s.deliveryPct}%` : '—'} ok={delivOk} />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                  <b style={{ color: 'var(--text-primary)' }}>{confirmCount} of 4</b> signals confirm
                </div>
              </div>
            )}

            <div style={{ flex: '2 1 260px', minWidth: 220 }}>
              <VaNiInsight
                insight={active?.data?.response}
                isLoading={active?.isPending ?? false}
                logId={active?.data?.log_id ?? undefined}
                className="mt-0"
              />
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {intents.map((i) => {
          const isActive = activeIntent === i.intentId
          const isPosition = i.group === 'position'
          return (
            <button
              key={i.intentId}
              onClick={() => ask(i.intentId)}
              style={{
                padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${isActive ? 'var(--indigo)' : isPosition ? 'var(--accent, var(--gold-soft))' : 'var(--border)'}`,
                background: isActive ? 'var(--indigo-bg)' : isPosition ? 'color-mix(in srgb, var(--accent, var(--gold-soft)) 10%, transparent)' : 'transparent',
                color: isActive ? 'var(--indigo)' : isPosition ? 'var(--accent, var(--gold-soft))' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {i.label}
            </button>
          )
        })}
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

function MiniKv({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>{value}</span>
    </span>
  )
}

function MiniField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', width: 110,
        }}
      />
    </label>
  )
}

/** The entry-anchored risk read itself — vaniLine + since-entry/peak/off-peak/
 *  risk stats + the PnlChart sparkline. Shared by HoldThisBody (a saved
 *  position) and CanIEnterBody (an unsaved preview of one) — owner
 *  (2026-09-05): "user has no way to gauge — system is forcing the user to
 *  save it as a position." Splitting this out is what fixes that: the SAME
 *  full read now renders the moment a qty is typed, before any save, so
 *  Save becomes a genuinely optional "track this going forward" action
 *  instead of the only way to see the answer. */
function PositionRiskRead({ thesis }: { thesis: ThesisRead }) {
  const pr = thesis.positionRisk
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
        {thesis.vaniLine}
      </div>
      {pr && (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
            <MiniKv label="Since entry" value={`${pr.currentPct >= 0 ? '+' : ''}${pr.currentPct.toFixed(1)}%`} color={pr.currentPct >= 0 ? 'var(--bull)' : 'var(--bear)'} />
            <MiniKv label="Peak" value={`${pr.peakPct >= 0 ? '+' : ''}${pr.peakPct.toFixed(1)}%`} />
            <MiniKv label="Off peak" value={`${pr.drawdownFromPeak.toFixed(1)}%`} color={pr.drawdownFromPeak < -0.5 ? 'var(--bear)' : undefined} />
            <MiniKv label="Risk" value={pr.riskTrend} color={pr.riskTrend === 'rising' ? 'var(--bear)' : pr.riskTrend === 'easing' ? 'var(--bull)' : undefined} />
          </div>
          <PnlChart points={pr.pnlPath} />
        </>
      )}
    </>
  )
}

/** "I hold this" — a saved position (bookmarkStore entry) reads instantly via
 *  computeThesis(); no saved position yet shows the same capture form
 *  ChartView's Thesis tab uses (qty/price/date → bookmarkStore.setPosition). */
function HoldThisBody({
  position, thesis, barsLoading, qty, setQty, price, setPrice, date, setDate, canSave, error, onSave, onClear,
}: {
  position: PositionInput | null
  thesis: ThesisRead | null
  barsLoading: boolean
  qty: string; setQty: (v: string) => void
  price: string; setPrice: (v: string) => void
  date: string; setDate: (v: string) => void
  canSave: boolean
  error?: string | null
  onSave: () => void
  onClear: () => void
}) {
  if (position) {
    if (barsLoading || !thesis) {
      return <div style={{ flex: '1 1 100%', fontSize: 11, color: 'var(--text-faint)' }}>Loading position risk…</div>
    }
    return (
      <div style={{ flex: '1 1 100%' }}>
        <PositionRiskRead thesis={thesis} />
        <button
          onClick={onClear}
          style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ✕ Remove position
        </button>
        {error && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--bear)' }}>{error}</div>}
      </div>
    )
  }

  const disabled = !price || !date || !canSave
  return (
    <div style={{ flex: '1 1 100%', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <MiniField label="Entry price ₹" value={price} onChange={setPrice} />
      <MiniField label="Entry date" value={date} onChange={setDate} type="date" />
      <MiniField label="Qty" value={qty} onChange={setQty} placeholder="optional" />
      <button
        onClick={onSave}
        disabled={disabled}
        style={{
          fontSize: 12, fontWeight: 600, color: 'var(--accent, var(--gold-soft))',
          background: 'color-mix(in srgb, var(--accent, var(--gold-soft)) 14%, transparent)',
          border: '1px solid var(--accent, var(--gold-soft))', borderRadius: 7, padding: '6px 14px',
          cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
        }}
      >
        Save position
      </button>
      {!canSave && <span style={{ fontSize: 10, color: 'var(--bear)' }}>Sign in to save positions.</span>}
      {error && <span style={{ fontSize: 10, color: 'var(--bear)' }}>{error}</span>}
    </div>
  )
}

/** "Can I enter now?" — a what-if, priced off the last EOD close, never
 *  persisted unless the user explicitly saves it (same setPosition as
 *  "I hold this"). */
function CanIEnterBody({
  latestClose, latestDate, qty, setQty, thesis, barsLoading, canSave, error, onSave,
}: {
  latestClose: number | null
  latestDate: string
  qty: string; setQty: (v: string) => void
  thesis: ThesisRead | null
  barsLoading: boolean
  canSave: boolean
  error?: string | null
  onSave: () => void
}) {
  return (
    <div style={{ flex: '1 1 100%' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: thesis || barsLoading ? 10 : 0 }}>
        <MiniField label="Qty you're considering" value={qty} onChange={setQty} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Entry price</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
            {latestClose != null ? `₹${latestClose.toFixed(2)}` : '—'}
            <span style={{ fontSize: 9.5 }}> (last close{latestDate ? ` · ${latestDate}` : ''})</span>
          </span>
        </span>
      </div>
      {barsLoading ? (
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading…</div>
      ) : thesis ? (
        <>
          {/* The full read — same one "I hold this" shows for a saved
              position — renders as soon as a qty is typed. Nothing is saved
              to get here: owner (2026-09-05) — "user has no way to gauge —
              system is forcing the user to save it as a position." Save
              below is now a clearly separate, optional step. */}
          <PositionRiskRead thesis={thesis} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Not tracked yet —</span>
            <button
              onClick={onSave}
              disabled={!canSave}
              style={{
                fontSize: 12, fontWeight: 600, color: 'var(--accent, var(--gold-soft))',
                background: 'color-mix(in srgb, var(--accent, var(--gold-soft)) 14%, transparent)',
                border: '1px solid var(--accent, var(--gold-soft))', borderRadius: 7, padding: '6px 14px',
                cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.55,
              }}
            >
              Save as my position
            </button>
            {!canSave && <span style={{ fontSize: 10, color: 'var(--bear)' }}>Sign in to save positions.</span>}
            {error && <span style={{ fontSize: 10, color: 'var(--bear)' }}>{error}</span>}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Enter a quantity to see the risk read.</div>
      )}
    </div>
  )
}

/** "Also in these scans" — owner (2026-09-04): not a pill, always visible.
 *  A compact strip (not the full ScanPresenceCard box — this renders on
 *  every popover open, so it has to stay light), dropping whichever preset
 *  the popover was opened from so the list never names the screen the user
 *  is already on. Renders nothing once resolved with no OTHER matches, so
 *  it never sits there empty taking up space. */
function AlsoInScansStrip({
  isLoading, matchedScans, currentPresetId,
}: {
  isLoading: boolean
  matchedScans: { id: string; name: string; vani: boolean }[]
  currentPresetId?: string
}) {
  if (isLoading) {
    return <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 8 }}>Checking other scans…</div>
  }
  const others = matchedScans.filter((m) => m.id !== currentPresetId)
  if (others.length === 0) return null

  const SHOWN = 3
  const shown = others.slice(0, SHOWN)
  const rest = others.length - shown.length

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 10.5, marginBottom: 10 }}>
      <span style={{ color: 'var(--text-faint)' }}>Also in:</span>
      {shown.map((m, i) => (
        <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Link to={`/scanner/${m.id}`} style={{ color: 'var(--text-secondary, var(--text-muted))', textDecoration: 'none' }}>
            {m.name}
          </Link>
          {m.vani && <span style={{ color: 'var(--gold)' }} title="✦ VaNi Highlight in this scan">✦</span>}
          {i < shown.length - 1 && <span style={{ color: 'var(--text-faint)' }}>·</span>}
        </span>
      ))}
      {rest > 0 && <span style={{ color: 'var(--text-faint)' }}>+{rest} more</span>}
    </div>
  )
}
