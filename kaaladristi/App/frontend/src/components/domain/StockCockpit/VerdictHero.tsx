/**
 * VerdictHero — the decision-first anchor for the stock deep-dive (Slice 1 of
 * the Stock DeepDive layout). A single glanceable card: the verdict state, how
 * many of the four pillars are aligned, and one headline metric per pillar
 * (Conviction · Momentum · Liquidity · Returns).
 *
 * Fixed-dark by design in both modes (see --verdict-hero-* in globals.css) so it
 * reads as a hero. All values come from the latest chart row + the existing
 * snapshot verdict — no extra fetches. Observational, not advice.
 */

export interface LatestRow {
  score_5d?: number | null
  score_22d?: number | null
  rsi_14?: number | null
  delivery_pct?: number | null
  delivery_surge_x?: number | null
  ret_66d?: number | null
  close?: number | null
  ema_20?: number | null
}

interface CorrState {
  state: string
  color: string
  tagline?: string
}

interface Props {
  latest: LatestRow
  snapshot?: { corrState?: CorrState } | null
}

export interface Pillar {
  key: string
  label: string
  value: string
  tone: string
  toneColor: string
  aligned: boolean
  anchor: string
}

const GREEN = 'var(--risk-green)'
const RED = 'var(--risk-red)'
const AMBER = 'var(--risk-amber)'
const MUTED = 'var(--verdict-hero-muted)'

function pct(v: number | null | undefined): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function buildPillars(l: LatestRow): Pillar[] {
  const s5 = l.score_5d ?? null
  const s22 = l.score_22d ?? null
  const rsi = l.rsi_14 ?? null
  const dp = l.delivery_pct ?? null
  const surge = l.delivery_surge_x ?? null
  const r66 = l.ret_66d ?? null
  const above20 =
    l.close != null && l.ema_20 != null && l.ema_20 > 0 ? l.close > l.ema_20 : null

  // Conviction — money-flow score (5D), trend vs its 22D pace.
  const convTone =
    s5 == null || s22 == null ? '—' : s5 > s22 ? 'Building' : s5 < s22 ? 'Fading' : 'Steady'
  // Momentum — RSI band.
  const momTone =
    rsi == null ? '—' : rsi >= 60 ? 'Elevated' : rsi < 40 ? 'Weak' : 'Neutral'
  // Liquidity — delivery conviction via the recent-vs-baseline surge.
  const liqTone =
    surge == null ? (dp == null ? '—' : 'Deliv') : surge >= 1.2 ? 'Deliv · Strong' : 'Deliv · Soft'

  return [
    {
      key: 'conviction',
      label: 'Conviction',
      value: s5 != null ? String(Math.round(s5)) : '—',
      tone: convTone,
      toneColor: convTone === 'Building' ? GREEN : convTone === 'Fading' ? AMBER : MUTED,
      aligned: s5 != null && s5 >= 50,
      anchor: 'flow',
    },
    {
      key: 'momentum',
      label: 'Momentum',
      value: rsi != null ? String(Math.round(rsi)) : '—',
      tone: momTone,
      toneColor: momTone === 'Elevated' ? GREEN : momTone === 'Weak' ? RED : MUTED,
      aligned: above20 === true || (rsi != null && rsi >= 50),
      anchor: 'strength',
    },
    {
      key: 'liquidity',
      label: 'Liquidity',
      value: dp != null ? `${Math.round(dp)}%` : '—',
      tone: liqTone,
      toneColor: surge != null && surge >= 1.2 ? GREEN : MUTED,
      aligned: surge != null && surge >= 1.2,
      anchor: 'flow',
    },
    {
      key: 'returns',
      label: 'Returns',
      value: pct(r66),
      tone: '66 days',
      toneColor: r66 != null && r66 >= 0 ? GREEN : RED,
      aligned: r66 != null && r66 > 0,
      anchor: 'strength',
    },
  ]
}

function jumpTo(anchor: string) {
  document.getElementById(`study-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function VerdictHero({ latest, snapshot }: Props) {
  if (!latest) return null
  const pillars = buildPillars(latest)
  const alignedCount = pillars.filter((p) => p.aligned).length
  const corr = snapshot?.corrState
  const verdictColor = corr?.color ?? 'var(--text-primary)'

  return (
    <div
      style={{
        borderRadius: 16,
        background: 'var(--verdict-hero-bg)',
        border: '1px solid var(--verdict-hero-border)',
        padding: '18px 20px 16px',
        color: 'var(--verdict-hero-text)',
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--verdict-hero-muted)',
          marginBottom: 6,
        }}
      >
        Setup Read · Observational
      </div>

      {/* Verdict + pillars-aligned line */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 26, fontWeight: 650, lineHeight: 1.1, color: verdictColor }}>
          {corr?.state ?? 'Neutral'}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--verdict-hero-muted)' }}>
          {alignedCount} of 4 pillars aligned{corr?.tagline ? ` · ${corr.tagline}` : ''}
        </span>
      </div>

      {/* Pillar tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
        }}
      >
        {pillars.map((p) => (
          <button
            key={p.key}
            onClick={() => jumpTo(p.anchor)}
            title={`Jump to ${p.label} evidence`}
            style={{
              textAlign: 'left',
              borderRadius: 10,
              padding: '11px 12px',
              background: 'var(--verdict-hero-tile)',
              border: `1px solid ${p.aligned ? `color-mix(in srgb, ${p.toneColor} 35%, transparent)` : 'var(--verdict-hero-tile-border)'}`,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--verdict-hero-muted)',
                marginBottom: 4,
              }}
            >
              {p.label}
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.05 }}>
              {p.value}
            </div>
            <div style={{ fontSize: 10.5, color: p.toneColor, marginTop: 3 }}>{p.tone}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'var(--verdict-hero-muted)', marginTop: 12 }}>
        Pillar cards jump to their evidence. Not advice, not a forecast.
      </div>
    </div>
  )
}
