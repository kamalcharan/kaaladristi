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
  if (pct >= 95) return '#16a34a'
  if (pct >= 80) return '#d97706'
  return '#dc2626'
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
        padding: '8px 14px', borderRadius: 8, margin: '6px 0',
        background: '#fefce8', border: '1px solid #fde68a',
        fontSize: 12, color: '#92400e',
      }}>
        <Info size={13} style={{ flexShrink: 0, color: '#d97706' }} />
        <span>Fewer than 3 instances — not enough data for reliable conclusions</span>
      </div>
    )
  }

  const color = coverageColor(coverage_pct)
  const pct   = coverage_pct.toFixed(1)
  const fmt   = (d: string) => d.slice(0, 10)

  return (
    <div style={{
      borderRadius: 8, margin: '6px 0',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px 5px',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
          color: '#6b7280', fontFamily: 'var(--font-mono,monospace)',
        }}>
          EOD DATA COVERAGE
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#374151' }}>
            {days_covered.toLocaleString()} of {days_total.toLocaleString()} days
            &nbsp;·&nbsp;
            {fmt(date_from)} – {fmt(date_to)}
          </span>

          {exclusions.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onMouseEnter={() => setTooltipOpen(true)}
                onMouseLeave={() => setTooltipOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center', color: '#9ca3af' }}>
                <Info size={12} />
              </button>
              {tooltipOpen && (
                <div style={{
                  position: 'absolute', bottom: '100%', right: 0, marginBottom: 6,
                  background: '#1e1e2e', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 8, padding: '8px 12px', width: 280, zIndex: 50,
                  boxShadow: '0 4px 20px rgba(0,0,0,.5)',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 6,
                    fontFamily: 'var(--font-mono,monospace)', letterSpacing: '.04em' }}>
                    KNOWN EXCLUSIONS
                  </div>
                  {exclusions.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,.65)',
                      lineHeight: 1.55, paddingTop: i > 0 ? 4 : 0 }}>
                      · {e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar + percentage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 8px' }}>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f3f4f6' }}>
          <div style={{
            width: `${Math.min(100, coverage_pct)}%`,
            height: '100%', borderRadius: 3,
            background: color,
            transition: 'width .5s ease',
          }} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, color,
          fontFamily: 'var(--font-mono,monospace)', flexShrink: 0, minWidth: 40,
          textAlign: 'right',
        }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}
