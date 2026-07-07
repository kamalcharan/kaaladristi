/*
 * ConfidenceDial — SVG clock-metaphor pattern confidence indicator.
 * 12 o'clock = Strong  (n ≥ 30, hit ≥ 65%)
 *  3 o'clock = Good    (n ≥ 15, hit ≥ 60%)
 *  6 o'clock = Moderate (n ≥ 8 or hit ≥ 55%)
 *  9 o'clock = Low     (n < 8)
 */

interface ConfidenceDialProps {
  n_instances: number
  hit_rate:    number   // 0–1 fraction, e.g. 0.67 = 67%
}

type StrengthLevel = 'Strong' | 'Good' | 'Moderate' | 'Low'

interface ConfidenceResult {
  level:    StrengthLevel
  fill:     number   // 0–1 arc fraction
  color:    string
  hint:     string   // shown below legend
}

function getConfidenceLevel(n: number, hitRate: number): ConfidenceResult {
  if (n >= 30 && hitRate >= 0.65) return {
    level: 'Strong',   fill: 1.0,  color: 'var(--bull, #2dd4bf)',
    hint: 'n ≥ 30, hit ≥ 65%',
  }
  if (n >= 15 && hitRate >= 0.60) return {
    level: 'Good',     fill: 0.75, color: 'var(--caution, #f59e0b)',
    hint: 'n ≥ 15, hit ≥ 60%',
  }
  if (n >= 8  || hitRate >= 0.55) return {
    level: 'Moderate', fill: 0.5,  color: 'var(--gold, #f59e0b)',
    hint: 'n ≥ 8 or hit ≥ 55%',
  }
  return {
    level: 'Low',      fill: 0.25, color: 'var(--bear, #ef4444)',
    hint: 'n < 8',
  }
}

const LEGEND_ROWS: { pos: string; label: StrengthLevel }[] = [
  { pos: '12', label: 'Strong'   },
  { pos: '3',  label: 'Good'     },
  { pos: '6',  label: 'Moderate' },
  { pos: '9',  label: 'Low'      },
]

export default function ConfidenceDial({ n_instances, hit_rate }: ConfidenceDialProps) {
  const { level, fill, color, hint } = getConfidenceLevel(n_instances, hit_rate)
  const activeIdx = LEGEND_ROWS.findIndex(r => r.label === level)

  const R            = 38
  const CX           = 50
  const CY           = 50
  const circumference = 2 * Math.PI * R
  const dashLen      = fill * circumference

  return (
    <div>
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--text-muted)', letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        Pattern Confidence
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        {/* SVG dial */}
        <div style={{ flexShrink: 0 }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke="var(--text-faint)"
              strokeWidth={8}
            />
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${dashLen} ${circumference}`}
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
            />
            <text
              x={CX} y={CY - 5}
              textAnchor="middle" fontSize={11} fontWeight={600}
              fill={color} fontFamily="var(--font-display, serif)"
            >
              {level}
            </text>
            <text
              x={CX} y={CY + 10}
              textAnchor="middle" fontSize={9}
              fill="var(--text-muted)" fontFamily="monospace"
            >
              n={n_instances}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
          {LEGEND_ROWS.map((row, i) => {
            const isActive = i === activeIdx
            const rowColor = isActive ? color : 'var(--text-faint)'
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
                  background: isActive ? color : 'var(--text-faint)',
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
            {hint}
          </p>
        </div>
      </div>
    </div>
  )
}
