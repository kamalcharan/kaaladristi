/**
 * ThesisTab — ChartView's 3rd tab (Phase 2a). The single home for thesis
 * verification, reached from bookmarks / positions / scanners. It adapts to
 * your relationship with the stock:
 *   · position  → entry scorecard · P&L · health-vs-entry · deterioration
 *   · watchlist → the same reversal read, framed as opportunity
 *   · none      → the cold setup read + prompts to bookmark / hold
 *
 * All content is computed by services/thesis.ts (which reuses buildPillars +
 * buildStoryEvents) — one substrate, so this tab, the chart and VaNi agree.
 */

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { computeThesis, type Relationship, type ThesisBar, type ThesisRead } from '@/services/thesis'
import { KIND_COLORS } from '@/services/storyEvents'
import { narrateVani } from '@/services/vaniNarrate'
import type { Pillar } from './VerdictHero'

/** Assemble the deterministic facts VaNi will narrate — nothing derived here. */
function buildThesisFacts(name: string, t: ThesisRead): string {
  const lines: string[] = [`Instrument: ${name}`, `Relationship: ${t.relationship}`]
  if (t.relationship === 'position' && t.positionRisk) {
    const r = t.positionRisk
    lines.push(`P&L since entry: ${r.currentPct >= 0 ? '+' : ''}${r.currentPct.toFixed(1)}%`)
    lines.push(`Peak since entry: ${r.peakPct >= 0 ? '+' : ''}${r.peakPct.toFixed(1)}%; given back ${Math.abs(r.drawdownFromPeak).toFixed(1)}% from the peak`)
    lines.push(`Worst drawdown since entry: ${r.maxAdversePct.toFixed(1)}%`)
    lines.push(`Risk trend: ${r.riskTrend}`)
    if (t.entry) lines.push(`Entry setup was: ${t.entry.label} (${t.entry.aligned}/${t.entry.total} pillars)`)
  }
  const strong = t.pillars.filter((p) => p.aligned).map((p) => p.label)
  const weak = t.pillars.filter((p) => !p.aligned && p.value !== '—').map((p) => p.label)
  lines.push(`Pillars aligned now: ${t.alignedNow} of ${t.total}${strong.length ? ` (strong on ${strong.join(', ')})` : ''}${weak.length ? `; weak on ${weak.join(', ')}` : ''}`)
  lines.push(`Alignment trend: ${t.alignedTrend}`)
  lines.push(`Verdict: ${t.verdict.label} — ${t.verdict.line}`)
  if (t.deterioration.length) {
    lines.push('Recent warnings: ' + t.deterioration.slice(0, 4).map((e) => `${e.title} (${e.date})`).join('; '))
  }
  return lines.join('\n')
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' }
const TONE: Record<'bull' | 'bear' | 'neutral', string> = {
  bull: 'var(--risk-green)', bear: 'var(--risk-red)', neutral: 'var(--risk-amber)',
}

export default function ThesisTab({
  bars, equityId, name, currentClose, autoOpenForm, onAutoOpened,
}: {
  bars: ThesisBar[]
  equityId: number
  name: string
  currentClose: number | null
  /** Open the "I hold this" form on mount (triggered from the chart hero). */
  autoOpenForm?: boolean
  onAutoOpened?: () => void
}) {
  const userId = useAuthStore((s) => s.profile?.id) ?? null
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const bookmarkedIds = useBookmarkStore((s) => s.bookmarkedIds)
  const loadBookmarks = useBookmarkStore((s) => s.load)
  const setPositionApi = useBookmarkStore((s) => s.setPosition)
  const clearPositionApi = useBookmarkStore((s) => s.clearPosition)

  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  // A position is a bookmark WITH an entry (migration 153).
  const bmRow = useMemo(() => bookmarks.find((b) => b.equity_id === equityId) ?? null, [bookmarks, equityId])
  const position = bmRow?.entry_price != null
    ? { entryPrice: bmRow.entry_price, entryDate: bmRow.entry_date ?? '', qty: bmRow.entry_qty }
    : null
  const relationship: Relationship = position ? 'position' : bookmarkedIds.has(equityId) ? 'watchlist' : 'none'

  const thesis = useMemo(
    () => computeThesis(bars, relationship, position),
    [bars, relationship, position],
  )

  const lastDate = bars[bars.length - 1]?.trade_date ?? ''
  const [showForm, setShowForm] = useState(false)
  const [entryPrice, setEntryPrice] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [qty, setQty] = useState('')

  useEffect(() => {
    if (showForm) {
      setEntryPrice(currentClose != null ? String(Math.round(currentClose * 100) / 100) : '')
      setEntryDate(lastDate)
      setQty('')
    }
  }, [showForm, currentClose, lastDate])

  // Opened from the chart hero's "＋ Position" — pop the form straight away.
  useEffect(() => {
    if (autoOpenForm && !position) { setShowForm(true); onAutoOpened?.() }
  }, [autoOpenForm, position, onAutoOpened])

  // VaNi narration (Phase 3) — an LLM read of the SAME deterministic facts.
  const [vaniText, setVaniText] = useState<string | null>(null)
  const [vaniLoading, setVaniLoading] = useState(false)
  const [vaniTried, setVaniTried] = useState(false)
  useEffect(() => { setVaniText(null); setVaniTried(false) }, [equityId, relationship])

  if (!thesis) {
    return <div className="glass-card rounded-xl p-4 text-[11px] text-muted">No data to read a thesis yet.</div>
  }

  const vColor = TONE[thesis.verdict.tone]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Relationship + verdict header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          {relationship === 'position' ? 'Position · held' : relationship === 'watchlist' ? 'Watchlist · watching' : 'Not tracked'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...MONO, fontSize: 12, fontWeight: 700, color: vColor }}>
          ● {thesis.verdict.label}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {thesis.verdict.line}</span>
        </span>

        {relationship === 'position' && position && (
          <span style={{ display: 'flex', gap: 18, marginLeft: 'auto', alignItems: 'baseline' }}>
            <Kv label="Entry" value={`₹${position.entryPrice} · ${position.entryDate}${position.qty ? ` · ${position.qty}` : ''}`} />
            <Kv label="Now" value={currentClose != null ? `₹${currentClose.toFixed(2)}` : '—'} />
            <Kv label="P&L" value={thesis.pnlPct != null ? `${thesis.pnlPct >= 0 ? '+' : ''}${thesis.pnlPct.toFixed(1)}%` : '—'}
              color={thesis.pnlPct != null ? (thesis.pnlPct >= 0 ? 'var(--risk-green)' : 'var(--risk-red)') : undefined} big />
            <button onClick={() => clearPositionApi(equityId)} title="Remove position"
              style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ✕
            </button>
          </span>
        )}
        {relationship !== 'position' && (
          <button onClick={() => setShowForm((s) => !s)}
            style={{ marginLeft: 'auto', ...MONO, fontSize: 11, fontWeight: 600, color: 'var(--accent, var(--gold-soft))',
              background: 'color-mix(in srgb, var(--accent, var(--gold-soft)) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent, var(--gold-soft)) 35%, transparent)',
              borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>
            ＋ I hold this
          </button>
        )}
      </div>

      {/* ── VaNi read — grounded narration of the computed thesis/risk. The
          instant line is deterministic; "Ask VaNi" gets a richer LLM read of the
          SAME facts (grounded — it can't invent numbers). ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-secondary)',
        background: 'linear-gradient(90deg, color-mix(in srgb, var(--vani) 12%, transparent), transparent)',
        border: '1px solid color-mix(in srgb, var(--vani) 24%, transparent)', borderRadius: 10, padding: '11px 13px',
      }}>
        <span style={{ color: 'var(--vani)', fontSize: 14, lineHeight: 1.3 }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ color: 'var(--vani)' }}>VaNi</b> <span style={{ color: 'var(--text-faint)' }}>· वाणी</span> — {vaniText ?? thesis.vaniLine}{' '}
          <i style={{ color: 'var(--text-faint)' }}>Observational, not advice.</i>
          <div style={{ marginTop: 5 }}>
            {vaniText ? (
              <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>✦ VaNi · grounded narration</span>
            ) : (
              <button
                onClick={async () => {
                  setVaniLoading(true)
                  const text = await narrateVani(name, buildThesisFacts(name, thesis))
                  setVaniText(text); setVaniTried(true); setVaniLoading(false)
                }}
                disabled={vaniLoading}
                style={{ ...MONO, fontSize: 10, fontWeight: 600, color: 'var(--vani)', background: 'none',
                  border: 'none', cursor: vaniLoading ? 'default' : 'pointer', padding: 0, opacity: vaniLoading ? 0.6 : 1 }}
              >
                {vaniLoading ? '✦ VaNi is reading…' : vaniTried ? '✦ VaNi unavailable — retry' : '✦ Ask VaNi to narrate this'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Add-position form ── */}
      {showForm && relationship !== 'position' && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap',
          background: 'var(--card)', border: '1px dashed color-mix(in srgb, var(--accent, var(--gold-soft)) 40%, var(--border))',
          borderRadius: 10, padding: '12px 14px' }}>
          <Field label="Entry price ₹" value={entryPrice} onChange={setEntryPrice} />
          <Field label="Entry date" value={entryDate} onChange={setEntryDate} type="date" />
          <Field label="Quantity" value={qty} onChange={setQty} placeholder="optional" />
          <button
            onClick={() => {
              const p = Number(entryPrice)
              if (!p || !entryDate) return
              setPositionApi(equityId, { entry_price: p, entry_date: entryDate, entry_qty: qty ? Number(qty) : null })
              setShowForm(false)
            }}
            style={{ ...MONO, fontSize: 13, fontWeight: 650, color: 'var(--accent, var(--gold-soft))',
              background: 'color-mix(in srgb, var(--accent, var(--gold-soft)) 14%, transparent)',
              border: '1px solid var(--accent, var(--gold-soft))', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
            Add position
          </button>
          {userId == null && <span style={{ ...MONO, fontSize: 10, color: 'var(--risk-amber)' }}>Sign in to save positions.</span>}
        </div>
      )}

      {/* ── Three cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {/* Thesis health */}
        <Card>
          <Label>Thesis health</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 0 8px' }}>
            <span style={{ ...MONO, fontSize: 22, fontWeight: 700, color: healthColor(thesis.alignedNow, thesis.total) }}>
              {thesis.alignedNow}<span style={{ color: 'var(--text-faint)', fontSize: 13 }}>/{thesis.total}</span>
            </span>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)' }}>
              {relationship === 'position' && thesis.entry ? `entry ${thesis.entry.aligned}/${thesis.entry.total}` : `trend ${thesis.alignedTrend}`}
            </span>
          </div>
          <Meter frac={thesis.alignedNow / thesis.total} color={healthColor(thesis.alignedNow, thesis.total)} />
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
            {thesis.pillars.map((p) => {
              const gap = p.value === '—'
              return (
                <span key={p.key} style={{ ...MONO, fontSize: 10, color: gap ? 'var(--text-faint)' : p.aligned ? 'var(--text-secondary)' : 'var(--text-faint)' }}
                  title={gap ? 'No data for this pillar — not counted' : undefined}>
                  {gap ? '·' : p.aligned ? '✓' : '✗'} {p.label}{gap ? ' (no data)' : ''}
                </span>
              )
            })}
          </div>
        </Card>

        {/* Position risk (entry-anchored) — or generic posture for watch/cold */}
        <Card>
          {relationship === 'position' && thesis.positionRisk ? (() => {
            const pr = thesis.positionRisk!
            const trendColor = pr.riskTrend === 'rising' ? 'var(--risk-red)' : pr.riskTrend === 'easing' ? 'var(--risk-green)' : 'var(--risk-amber)'
            return (
              <>
                <Label>Position Risk · since entry</Label>
                <PnlChart points={pr.pnlPath} />
                <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                  <Kv label="Peak" value={`${pr.peakPct >= 0 ? '+' : ''}${pr.peakPct.toFixed(1)}%`} />
                  <Kv label="Off peak" value={`${pr.drawdownFromPeak.toFixed(1)}%`} color={pr.drawdownFromPeak < -0.5 ? 'var(--risk-red)' : 'var(--text-primary)'} />
                  <Kv label="Worst" value={`${pr.maxAdversePct.toFixed(1)}%`} color={pr.maxAdversePct < 0 ? 'var(--risk-red)' : 'var(--text-primary)'} />
                  <Kv label="Risk" value={pr.riskTrend} color={trendColor} />
                </div>
              </>
            )
          })() : (
            <>
              <Label>Risk ↔ reward · 30 bars</Label>
              <PostureChart points={thesis.postureTrajectory.map((p) => p.posture)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>
                <span>{thesis.postureTrajectory[0]?.date}</span><span>now</span>
              </div>
            </>
          )}
        </Card>

        {/* Entry scorecard (position) OR setup read (watchlist/cold) */}
        <Card>
          <Label>{relationship === 'position' ? `Entry scorecard · ${thesis.entry?.date ?? ''}` : 'Setup read'}</Label>
          <div style={{ ...MONO, fontSize: 16, fontWeight: 700, margin: '4px 0 8px',
            color: relationship === 'position'
              ? (thesis.entry && thesis.entry.aligned >= 3 ? 'var(--risk-green)' : thesis.entry && thesis.entry.aligned === 2 ? 'var(--risk-amber)' : 'var(--risk-red)')
              : vColor }}>
            {relationship === 'position' ? (thesis.entry?.label ?? '—') : thesis.verdict.label}
          </div>
          <PillarList pillars={relationship === 'position' ? (thesis.entry?.pillars ?? thesis.pillars) : thesis.pillars} />
        </Card>
      </div>

      {/* ── Deterioration timeline ── */}
      {thesis.deterioration.length > 0 && (
        <div>
          <Label>{relationship === 'position' ? 'Deterioration since entry' : 'Recent warnings'}</Label>
          <div style={{ marginTop: 6 }}>
            {thesis.deterioration.map((e, i) => (
              <div key={`${e.barIndex}-${e.kind}-${i}`} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 12,
                padding: '8px 0', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
                <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>{e.date}</span>
                <span style={{ fontSize: 12.5 }}>
                  <b style={{ color: KIND_COLORS[e.kind] }}>{e.title}.</b>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>{e.detail}.</span>
                  {e.reactionPct != null && (
                    <span style={{ ...MONO, fontSize: 10, color: e.reactionPct >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}>
                      {' '}({e.reactionPct >= 0 ? '+' : ''}{e.reactionPct.toFixed(1)}% / 5 bars)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── bits ──────────────────────────────────────────────────────────
function healthColor(a: number, t: number): string {
  const f = a / t
  return f >= 0.6 ? 'var(--risk-green)' : f <= 0.4 ? 'var(--risk-red)' : 'var(--risk-amber)'
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', boxShadow: 'var(--card-shadow)' }}>{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{children}</div>
}
function Kv({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ ...MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ ...MONO, fontSize: big ? 15 : 13, fontWeight: big ? 700 : 600, color: color ?? 'var(--text-primary)' }}>{value}</span>
    </span>
  )
}
function Meter({ frac, color }: { frac: number; color: string }) {
  return (
    <div style={{ height: 7, borderRadius: 5, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color, borderRadius: 5, transition: 'width 0.4s' }} />
    </div>
  )
}
function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        style={{ ...MONO, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 7, padding: '7px 10px', width: 130, colorScheme: 'dark light' }} />
    </label>
  )
}
function PillarList({ pillars }: { pillars: Pillar[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {pillars.map((p) => {
        const gap = p.value === '—'
        return (
          <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 11 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
            <span style={{ color: gap ? 'var(--text-faint)' : p.toneColor }}>{p.value}{gap ? '' : p.aligned ? ' ✓' : ' ✗'}</span>
          </div>
        )
      })}
    </div>
  )
}
/** P&L% since entry — area filled between the price path and the entry line (0%). */
function PnlChart({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div style={{ height: 60, display: 'flex', alignItems: 'center', ...MONO, fontSize: 10, color: 'var(--text-faint)' }}>Not enough history since entry.</div>
  }
  const W = 240, H = 60
  const min = Math.min(0, ...points), max = Math.max(0, ...points)
  const range = (max - min) || 1
  const y = (v: number) => H - 4 - ((v - min) / range) * (H - 8)
  const zeroY = y(0)
  const step = W / (points.length - 1)
  const line = points.map((v, i) => `${i * step},${y(v)}`).join(' ')
  const last = points[points.length - 1]
  const col = last >= 0 ? 'var(--risk-green)' : 'var(--risk-red)'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 6 }} aria-label="P&L since entry">
      <defs>
        <linearGradient id="pnlg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity="0.22" />
          <stop offset="1" stopColor={col} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="var(--text-faint)" strokeDasharray="3 3" />
      <text x="2" y={Math.max(9, zeroY - 3)} fill="var(--text-faint)" fontSize="8" fontFamily="var(--font-mono)">entry</text>
      <polygon points={`${line} ${W},${zeroY} 0,${zeroY}`} fill="url(#pnlg)" />
      <polyline points={line} fill="none" stroke={col} strokeWidth="2" />
      <circle cx={W} cy={y(last)} r="3.5" fill={col} />
    </svg>
  )
}

/** −100..+100 posture as an area line crossing a neutral midline. */
function PostureChart({ points }: { points: number[] }) {
  if (points.length < 2) return <div style={{ height: 60 }} />
  const W = 240, H = 60, mid = H / 2
  const step = W / (points.length - 1)
  const y = (v: number) => mid - (Math.max(-100, Math.min(100, v)) / 100) * (mid - 4)
  const line = points.map((v, i) => `${i * step},${y(v)}`).join(' ')
  const area = `${line} ${W},${H} 0,${H}`
  const last = points[points.length - 1]
  const endCol = last >= 20 ? 'var(--risk-green)' : last <= -20 ? 'var(--risk-red)' : 'var(--risk-amber)'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 6 }} aria-label="Risk/reward posture">
      <defs>
        <linearGradient id="posg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--risk-green)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--risk-red)" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeDasharray="3 3" />
      <polygon points={area} fill="url(#posg)" />
      <polyline points={line} fill="none" stroke={endCol} strokeWidth="2" />
      <circle cx={W} cy={y(last)} r="3.5" fill={endCol} />
    </svg>
  )
}
