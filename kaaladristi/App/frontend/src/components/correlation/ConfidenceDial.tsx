/*
 * ConfidenceDial — pure SVG clock-metaphor confidence indicator.
 * 12 o'clock = Strong  (n >= 30, coverage >= 95%)
 *  3 o'clock = Good    (n 15–29)
 *  6 o'clock = Moderate (n 8–14)
 *  9 o'clock = Low     (n < 8)
 */

interface ConfidenceDialProps {
  n_instances:  number
  coverage_pct?: number
}

type StrengthLevel = 'Strong' | 'Good' | 'Moderate' | 'Low'

function computeStrength(n: number, coverage?: number): StrengthLevel {
  if (n >= 30 && (coverage == null || coverage >= 95)) return 'Strong'
  if (n >= 15) return 'Good'
  if (n >= 8)  return 'Moderate'
  return 'Low'
}

// Map strength to a 0–1 fill fraction (clock arc from 12 o'clock)
function strengthToFill(s: StrengthLevel): number {
  switch (s) {
    case 'Strong':   return 1.0
    case 'Good':     return 0.75
    case 'Moderate': return 0.5
    case 'Low':      return 0.25
  }
}

function strengthToColor(s: StrengthLevel): string {
  switch (s) {
    case 'Strong':   return 'var(--bull, #2dd4bf)'
    case 'Good':     return 'var(--bull, #2dd4bf)'
    case 'Moderate': return 'var(--gold, #f59e0b)'
    case 'Low':      return 'var(--bear, #ef4444)'
  }
}

const LEGEND_ROWS: { pos: string; label: StrengthLevel; desc: string }[] = [
  { pos: '12',  label: 'Strong',   desc: 'n ≥ 30, coverage ≥ 95%' },
  { pos: '3',   label: 'Good',     desc: 'n 15–29' },
  { pos: '6',   label: 'Moderate', desc: 'n 8–14' },
  { pos: '9',   label: 'Low',      desc: 'n < 8' },
]

export default function ConfidenceDial({ n_instances, coverage_pct }: ConfidenceDialProps) {
  const strength  = computeStrength(n_instances, coverage_pct)
  const fill      = strengthToFill(strength)
  const color     = strengthToColor(strength)
  const activeIdx = LEGEND_ROWS.findIndex(r => r.label === strength)

  // SVG circle arc via stroke-dasharray
  const R          = 38
  const CX         = 50
  const CY         = 50
  const circumference = 2 * Math.PI * R
  const dashLen    = fill * circumference
  // Rotate so arc starts at 12 o'clock (top), which is -90° in SVG
  const rotation   = -90

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
      {/* SVG dial */}
      <div style={{ flexShrink: 0 }}>
        <svg width={100} height={100} viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={8}
          />
          {/* Fill arc */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${dashLen} ${circumference}`}
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          />
          {/* Center text */}
          <text
            x={CX} y={CY - 5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={color}
            fontFamily="var(--font-display, serif)"
          >
            {strength}
          </text>
          <text
            x={CX} y={CY + 10}
            textAnchor="middle"
            fontSize={9}
            fill="rgba(255,255,255,0.4)"
            fontFamily="monospace"
          >
            n={n_instances}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
        {LEGEND_ROWS.map((row, i) => {
          const isActive = i === activeIdx
          const rowColor = isActive ? color : 'rgba(255,255,255,0.2)'
          return (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 20, fontSize: 9, fontFamily: 'monospace',
                color: 'var(--text-faint)', flexShrink: 0, textAlign: 'right',
              }}>
                {row.pos}
              </span>
              <div style={{
                flex: 1, height: 4, borderRadius: 2,
                background: isActive ? color : 'rgba(255,255,255,0.07)',
              }} />
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
                color: rowColor, fontWeight: isActive ? 600 : 400, flexShrink: 0,
              }}>
                {row.label}
              </span>
            </div>
          )
        })}
        <p style={{
          fontSize: 10, color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono, monospace)',
          marginTop: 4, lineHeight: 1.5,
        }}>
          {LEGEND_ROWS[activeIdx].desc}
        </p>
      </div>
    </div>
  )
}
