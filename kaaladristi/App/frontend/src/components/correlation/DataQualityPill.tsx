interface DataQualityPillProps {
  coverage_pct: number
  days_covered: number
  date_from:    string
  date_to:      string
}

export function DataQualityPill({ coverage_pct, days_covered, date_from, date_to }: DataQualityPillProps) {
  const color = coverage_pct >= 95 ? 'var(--bull)'
              : coverage_pct >= 80 ? 'var(--caution)'
              : 'var(--bear)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'color-mix(in srgb, var(--text-primary) 2%, transparent)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 10,
      color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)',
    }}>
      <span style={{ color, fontSize: 8 }}>●</span>
      <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 9 }}>
        EOD DATA
      </span>
      <span style={{ marginLeft: 'auto', color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)' }}>
        {days_covered.toLocaleString()} days
      </span>
      <span>·</span>
      <span>{date_from.slice(0, 4)}–{date_to.slice(0, 4)}</span>
      <span>·</span>
      <span style={{ color, fontWeight: 600 }}>{coverage_pct.toFixed(1)}%</span>
    </div>
  )
}
