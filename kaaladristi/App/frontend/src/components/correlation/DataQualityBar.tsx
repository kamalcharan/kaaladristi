import { Info } from 'lucide-react'
import { useState } from 'react'

export const KNOWN_QUALITY_ISSUES = {
  VOLUME_DISCONTINUITY: 'Volume data discontinuity post-March 2026 — RVOL signals excluded',
  SHANTHALA_PHANTOM:    'SHANTHALA index excluded — phantom membership data',
  DUAL_LISTED:          'Dual-listed equities deduplicated via v_equity_eod_deduped',
} as const

export interface DataQualityBarProps {
  coverage_pct:       number
  days_covered:       number
  days_total:         number
  date_from:          string
  date_to:            string
  exclusions?:        string[]
  insufficient_data?: boolean
}

function coverageColor(pct: number): string {
  if (pct >= 95) return 'var(--risk-green, #22c55e)'
  if (pct >= 80) return 'var(--risk-amber, #f59e0b)'
  return 'var(--risk-red, #ef4444)'
}

export default function DataQualityBar({
  coverage_pct,
  days_covered,
  days_total,
  date_from,
  date_to,
  exclusions = [],
  insufficient_data,
}: DataQualityBarProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  if (insufficient_data) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderRadius: 8, margin: '8px 0',
        background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)',
        fontSize: 12, color: '#fcd34d',
      }}>
        <Info size={13} style={{ flexShrink: 0, opacity: .8 }} />
        <span>Fewer than 3 instances — not enough data for reliable conclusions</span>
      </div>
    )
  }

  const color = coverageColor(coverage_pct)
  const pct   = coverage_pct.toFixed(1)
  const fmt   = (d: string) => d.slice(0, 10)   // YYYY-MM-DD

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 10px', borderRadius: 8, margin: '6px 0',
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
      fontSize: 11,
    }}>
      {/* Coverage percentage */}
      <span style={{ color, fontFamily: 'var(--font-mono,monospace)', fontWeight: 600, flexShrink: 0 }}>
        {pct}%
      </span>

      {/* Bar */}
      <div style={{ flex: 1, maxWidth: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }}>
        <div style={{
          width: `${Math.min(100, coverage_pct)}%`,
          height: '100%', borderRadius: 2,
          background: color,
          transition: 'width .4s ease',
        }} />
      </div>

      {/* Day counts and date range */}
      <span style={{ color: 'var(--text-muted,#6b7280)', flexShrink: 0 }}>
        {days_covered} of {days_total} days
        &nbsp;·&nbsp;
        {fmt(date_from)} – {fmt(date_to)}
      </span>

      {/* Exclusions tooltip */}
      {exclusions.length > 0 && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,.35)' }}>
            <Info size={12} />
          </button>
          {tooltipOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', right: 0, marginBottom: 6,
              background: '#1e1e2e', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 8, padding: '8px 12px', width: 260, zIndex: 50,
              boxShadow: '0 4px 20px rgba(0,0,0,.6)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 6,
                fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.04em' }}>
                DATA EXCLUSIONS
              </div>
              {exclusions.map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,.6)',
                  lineHeight: 1.5, paddingTop: i > 0 ? 4 : 0 }}>
                  · {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
