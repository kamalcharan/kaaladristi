/**
 * MoveQualityCard — Phase 2b. Renders a MoveQuality verdict (broad · mixed ·
 * narrow) computed from an index's constituents. One component, two mounts:
 *   · full    — sits above the constituents table on the sector-rotation page,
 *               turning that table into a "so what" (is this move real?).
 *   · compact — a single verdict chip for the ChartView index cockpit.
 *
 * When the index's own flow badge is bullish but the move-quality is narrow, the
 * card surfaces the TRAP: badge says "entering", the population says otherwise.
 * Observational, never advice.
 */

import { useState } from 'react'
import type { MoveQuality, MoveVerdict } from '@/services/moveQuality'
import { narrateVani } from '@/services/vaniNarrate'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

/** Deterministic facts VaNi narrates for an index's move quality. */
function moveFacts(subject: string, mq: MoveQuality): string {
  const lines = [
    `Index: ${subject}`,
    `Move quality verdict: ${mq.headline}`,
    `Breadth: ${mq.upCount} of ${mq.total} constituents up on the day`,
    `Consensus: ${mq.bullFlowCount} of ${mq.total} confirm with bullish flow${mq.bearFlowCount ? `, ${mq.bearFlowCount} turning bearish` : ''}`,
  ]
  if (mq.topSharePct != null && mq.topName) lines.push(`Concentration: top name ${mq.topName} is ${mq.topSharePct}% of the positive score`)
  if (mq.aboveTrendPct != null) lines.push(`Constituents above their 20-EMA: ${Math.round(mq.aboveTrendPct)}%`)
  return lines.join('\n')
}

const VERDICT_COLOR: Record<MoveVerdict, string> = {
  broad: 'var(--risk-green)',
  mixed: 'var(--risk-amber)',
  narrow: 'var(--risk-red)',
}
const VERDICT_ICON: Record<MoveVerdict, string> = { broad: '✓', mixed: '~', narrow: '⚑' }

export interface MoveBadge {
  label: string
  bullish: boolean
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        ...MONO, display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        padding: '3px 9px', borderRadius: 999,
        color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function MoveQualityCard({
  mq,
  badge = null,
  compact = false,
  subject,
}: {
  mq: MoveQuality
  badge?: MoveBadge | null
  compact?: boolean
  /** Index name — when set (full mode), enables the grounded VaNi read. */
  subject?: string
}) {
  const [vaniText, setVaniText] = useState<string | null>(null)
  const [vaniLoading, setVaniLoading] = useState(false)
  const color = VERDICT_COLOR[mq.verdict]
  const icon = VERDICT_ICON[mq.verdict]
  // The trap: a bullish badge contradicted by a non-broad population.
  const trap = badge?.bullish && mq.verdict !== 'broad'

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill color={color}>{icon} {mq.verdict}</Pill>
        <span style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)' }}>
          {mq.upCount}/{mq.total} up{mq.topSharePct != null && mq.verdict === 'narrow' ? ` · ${mq.topName} ${mq.topSharePct}%` : ''}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
        borderLeft: `3px solid ${color}`, padding: '14px 16px',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {/* Verdict + trap contrast */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Move Quality
        </span>
        <Pill color={color}>{icon} {mq.headline}</Pill>
        {trap && badge && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)' }}>badge</span>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', textDecoration: 'line-through', textDecorationColor: 'var(--risk-red)' }}>
              {badge.label}
            </span>
          </span>
        )}
      </div>

      {/* Three internals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 10 }}>
        <Stat label="Breadth" value={`${mq.upCount}/${mq.total}`} sub="up on day"
          tone={mq.upCount / mq.total >= 0.6 ? 'ok' : mq.upCount / mq.total <= 0.4 ? 'bad' : 'warn'} />
        <Stat label="Consensus" value={`${mq.bullFlowCount}/${mq.total}`} sub="confirm flow"
          tone={mq.bullFlowCount >= Math.ceil(mq.total / 2) ? 'ok' : mq.bullFlowCount === 0 ? 'bad' : 'warn'} />
        <Stat
          label="Concentration"
          value={mq.topSharePct != null ? `${mq.topSharePct}%` : '—'}
          sub={mq.topName ? `top: ${mq.topName}` : 'score share'}
          tone={mq.topSharePct != null && mq.topSharePct >= 60 ? 'bad' : mq.topSharePct != null && mq.topSharePct >= 45 ? 'warn' : 'ok'}
        />
      </div>

      {/* Reason bullets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
        {mq.flags.map((f, i) => (
          <span key={i} style={{ ...MONO, fontSize: 10.5, color: 'var(--text-muted)' }}>
            <span style={{ color, marginRight: 4 }}>·</span>{f}
          </span>
        ))}
      </div>

      {/* VaNi grounded read (Phase 3) */}
      {subject && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--vani)', fontSize: 13 }}>✦</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
            {vaniText ? (
              <><b style={{ color: 'var(--vani)' }}>VaNi</b> — {vaniText}</>
            ) : (
              <button
                onClick={async () => {
                  setVaniLoading(true)
                  const text = await narrateVani(subject, moveFacts(subject, mq))
                  setVaniText(text); setVaniLoading(false)
                }}
                disabled={vaniLoading}
                style={{ ...MONO, fontSize: 10, fontWeight: 600, color: 'var(--vani)', background: 'none', border: 'none', cursor: vaniLoading ? 'default' : 'pointer', padding: 0, opacity: vaniLoading ? 0.6 : 1 }}
              >
                {vaniLoading ? '✦ VaNi is reading…' : '✦ Ask VaNi to read this move'}
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'ok' | 'warn' | 'bad' }) {
  const c = tone === 'ok' ? 'var(--risk-green)' : tone === 'bad' ? 'var(--risk-red)' : 'var(--risk-amber)'
  return (
    <div style={{ background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ ...MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ ...MONO, fontSize: 17, fontWeight: 700, color: c, lineHeight: 1.15 }}>{value}</div>
      <div style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)' }}>{sub}</div>
    </div>
  )
}
