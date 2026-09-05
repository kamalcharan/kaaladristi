/**
 * StructureStrip — Big Money × Golden Line, as ONE component used everywhere
 * that read appears.
 *
 * It renders services/thesis.ts's StructureRead and computes nothing of its
 * own. That is the whole point: the same strip is shown in ChartView's Thesis
 * tab, in the VaNi inline popover's "I hold this" and "Can I enter now" reads,
 * and therefore in the bookmarks/positions flow that reaches the popover — so
 * a user cannot be told one thing on the chart and another in the popover.
 *
 * The two facts it composes are both stored, not derived here:
 *   · the Golden Line (sma_150) and where price sits on it (migration 194)
 *   · the last Big Money day and its zone (migration 200)
 *
 * SEBI: observational only. It states where large money changed hands, where
 * price is relative to that zone and to the Golden Line, and how often price
 * has closed above the zone since. It never says what to do about any of it.
 */

import type { StructureRead } from '@/services/thesis'

const MONO = { fontFamily: 'var(--font-mono)' } as const

const TONE_COLOR: Record<StructureRead['tone'], string> = {
  bull: 'var(--bull)',
  bear: 'var(--bear)',
  neutral: 'var(--gold)',
}

const DIRECTION_LABEL = {
  entry: 'entry footprint',
  exit: 'exit footprint',
  mixed: 'mixed',
} as const

function Kv({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...MONO, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        {label}
      </div>
      <div style={{ ...MONO, fontSize: 11.5, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

export default function StructureStrip({ structure, compact = false }: {
  structure: StructureRead | null
  /** Popover variant — tighter type, no prose paragraph unless it is the only
   *  thing worth saying. */
  compact?: boolean
}) {
  if (!structure) return null
  const { gl, pctFromGl, aboveGl, daysAboveGl, bigMoney, aboveZone, label, tone, line } = structure
  const tint = TONE_COLOR[tone]

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `2px solid ${tint}`,
      borderRadius: 8,
      background: 'var(--card)',
      padding: compact ? '8px 10px' : '10px 12px',
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
        <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Structure
        </span>
        <span style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 600, color: tint }}>{label}</span>
        {bigMoney && bigMoney.sessionsSince > 0 && (
          <span style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
            {bigMoney.sessionsSince} session{bigMoney.sessionsSince === 1 ? '' : 's'} since
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 7 }}>
        <Kv
          label="Golden Line"
          value={gl != null ? `₹${gl.toFixed(0)}${pctFromGl != null ? ` · ${pctFromGl >= 0 ? '+' : ''}${pctFromGl.toFixed(1)}%` : ''}` : '—'}
          color={aboveGl == null ? undefined : aboveGl ? 'var(--bull)' : 'var(--bear)'}
        />
        {aboveGl && daysAboveGl != null && daysAboveGl > 0 && (
          <Kv label="Held for" value={`${daysAboveGl} sessions`} />
        )}
        {bigMoney ? (
          <>
            <Kv
              label={`Big money · ${DIRECTION_LABEL[bigMoney.direction]}`}
              value={`₹${bigMoney.low.toFixed(0)}–${bigMoney.high.toFixed(0)}`}
              color={aboveZone == null ? undefined : aboveZone ? 'var(--bull)' : 'var(--bear)'}
            />
            <Kv
              label="Moved"
              value={`₹${bigMoney.delivCr >= 100 ? bigMoney.delivCr.toFixed(0) : bigMoney.delivCr.toFixed(1)} Cr · ${bigMoney.ratio.toFixed(1)}×`}
            />
            {bigMoney.sessionsSince > 0 && (
              <Kv label="Closed above zone" value={`${bigMoney.heldAbove} of ${bigMoney.sessionsSince}`} />
            )}
          </>
        ) : (
          <Kv label="Big money" value="none on record" />
        )}
      </div>

      <div style={{ fontSize: compact ? 10.5 : 11.5, lineHeight: 1.5, color: 'var(--text-muted)' }}>
        {line} <i style={{ color: 'var(--text-faint)' }}>Observational, not advice.</i>
      </div>
    </div>
  )
}
