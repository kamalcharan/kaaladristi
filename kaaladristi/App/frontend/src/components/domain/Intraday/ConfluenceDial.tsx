/**
 * ConfluenceDial — SVG ring (0–10) + 3-bar breakdown
 *
 * Per spec §7. The ring fills clockwise from 12 o'clock. The bar
 * rendering matches the formula:
 *   Tech (60%)       = grey when LP null
 *   Panchang (20%)   = sq + abhijit bonus
 *   Planetary (20%)  = positive plan only
 */

import {
  type ConfluenceBreakdown,
  labelForScore,
  colorForScore,
} from '@/services/confluenceScore';

interface ConfluenceDialProps {
  breakdown: ConfluenceBreakdown;
}

interface BarProps {
  label: string;
  value: number;     // raw value
  max: number;       // raw max
  weight: number;    // % weight for caption
  color: string;
  grey?: boolean;
  caption?: string;
}

function Bar({ label, value, max, weight, color, grey, caption }: BarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: grey ? 'var(--text-faint)' : 'var(--text-muted)',
        letterSpacing: '0.06em', marginBottom: 2,
      }}>
        <span>{label} <span style={{ color: 'var(--text-faint)' }}>({weight}%)</span></span>
        <span style={{
          color: grey ? 'var(--text-faint)' : color,
          fontWeight: 700,
        }}>{caption ?? value.toFixed(1)}</span>
      </div>
      <div style={{
        height: 5, background: 'var(--kd-border)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%',
          background: grey ? 'var(--text-faint)' : color,
          opacity: grey ? 0.4 : 0.85,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

export default function ConfluenceDial({ breakdown }: ConfluenceDialProps) {
  const { tech, panchang, abhBonus, plan, total, lpAvailable } = breakdown;
  const color = colorForScore(total);
  const label = labelForScore(total);

  // SVG ring math
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const dash = (total / 10) * circumference;

  return (
    <div style={{
      border: '1px solid var(--kd-border)',
      borderRadius: 4,
      padding: 12,
      background: 'var(--panel-recess)',
    }}>
      {/* Header */}
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'var(--text-faint)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>Confluence</div>

      {/* Dial */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={84} height={84} viewBox="0 0 84 84">
          {/* Background ring */}
          <circle cx={42} cy={42} r={r}
            fill="none" stroke="var(--kd-border)" strokeWidth={5} />
          {/* Foreground arc */}
          <circle cx={42} cy={42} r={r}
            fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 42 42)" />
          {/* Score */}
          <text x={42} y={40}
            textAnchor="middle"
            fontSize={18} fontWeight={700} fill={color}
            fontFamily="var(--font-mono, monospace)">
            {total.toFixed(1)}
          </text>
          <text x={42} y={52}
            textAnchor="middle"
            fontSize={8} fill="var(--text-faint)"
            fontFamily="var(--font-mono, monospace)">/10</text>
        </svg>
      </div>

      {/* Label */}
      <div style={{
        textAlign: 'center', marginTop: 4,
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
        color, fontWeight: 700, letterSpacing: '0.12em',
      }}>{label}</div>

      {/* 3-bar breakdown */}
      <Bar
        label="Tech" weight={60} value={tech} max={6}
        color="var(--accent-cyan)"
        grey={!lpAvailable}
        caption={lpAvailable ? `${tech.toFixed(1)}/6` : 'awaiting LP'}
      />
      <Bar
        label="Panchang" weight={20}
        value={panchang + abhBonus} max={2.8}
        color="var(--risk-green)"
        caption={
          abhBonus > 0
            ? `${panchang.toFixed(1)} +${abhBonus.toFixed(1)} abh`
            : `${panchang.toFixed(1)}/2.0`
        }
      />
      <Bar
        label="Planetary" weight={20}
        value={plan} max={2}
        color="var(--gold)"
        caption={`${plan.toFixed(2)}/2.0`}
      />
    </div>
  );
}
