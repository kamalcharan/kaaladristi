/**
 * JourneyStrip — the Waking Giants arc, rendered from the stored journey row.
 *
 * Every value here already existed in km_wg_journeys and none of it reached a
 * user. On 2026-09-14 the table held six dated milestones and the story layer
 * read two; `confirm_date` — the Ascent moment, the payoff the whole engine
 * exists to find — had never been shown anywhere, and `sleep_date` closes an
 * arc that the chart simply stopped drawing.
 *
 * Computes nothing of its own beyond formatting and the distance to the
 * ceiling, which is arithmetic on two stored numbers.
 *
 * What makes this worth showing at all is that the outcome is MEASURABLE, so
 * the footnote cites the recorded frequency of arcs at this point. Those
 * figures are NOT typed in here: they come from km_journey_base_rates, which
 * scripts/compute_wg_journeys.py recomputes nightly inside the same
 * transaction as the journeys it summarises (migration 209). They were
 * hardcoded once and would have gone stale silently — the numbers move every
 * night as arcs close and confirm.
 *
 * With no reading available the frequency clause is dropped, never replaced by
 * a remembered number. A confidently wrong base rate is worse than none.
 *
 * The sentence itself lives in services/journeyFacts.ts, because VaNi narrates
 * the same arc and two phrasings of one comparison drift apart.
 *
 * SEBI / D39: describes structure and recorded state. The stage names say what
 * the arc IS, not where price goes next; no instruction, no expectation.
 */

import type { StoryJourney } from '@/services/storyEvents'
import type { JourneyBaseRates } from '@/services/indicatorData'
import { baseRateLine } from '@/services/journeyFacts'

const MONO = { fontFamily: 'var(--font-mono)' } as const

/** Ordered arc. `key` matches the journey field that dates each milestone. */
const STEPS = [
  { key: 'base',    label: 'Base' },
  { key: 'turn',    label: 'Turn' },
  { key: 'stir',    label: 'Stirring' },
  { key: 'wake',    label: 'Wake' },
  { key: 'confirm', label: 'Ascent' },
] as const

const STATE_LABEL: Record<string, string> = {
  HIBERNATING: 'Hibernating',
  STIRRING: 'Stirring',
  WAKING: 'Waking',
  ASCENDING: 'Ascending',
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const t = Date.parse(d)
  if (Number.isNaN(t)) return '—'
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function rupee(n?: number | null): string {
  return n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/** How far through the arc this journey has travelled, 0..4. */
function reachedIndex(j: StoryJourney): number {
  if (j.confirm_date) return 4
  if (j.wake_date) return 3
  if ((j.stir_days ?? 0) > 0 || j.state === 'STIRRING') return 2
  if (j.turn_date) return 1
  return 0
}

/** The stirring cell.
 *
 *  This read `${stir_days} days`, which is the one wrong thing you can say
 *  about this number: `stir_days` is a TALLY of qualifying bars inside the
 *  last-60 window, not a run. Measured across all 1,048 stirring stocks on
 *  2026-09-14 — 9.4 qualifying bars spread over a 41.3-bar span, and only
 *  2.8% contiguous — so "24 days" was read as three weeks of continuous
 *  stirring by anyone looking at it.
 *
 *  Stating the denominator fixes it without losing anything: "24 / 41" says
 *  both how much and how thinly. Same rule as the confirmation base rate —
 *  a rate always carries the sample it was measured over. With no window
 *  recorded (before migration 211 runs) the bare count is shown rather than
 *  an invented denominator. */
export function stirLabel(j: StoryJourney): string {
  const n = j.stir_days
  if (n == null) return '—'
  const w = j.stir_window_bars
  return w ? `${n} / ${w}` : `${n}`
}

export default function JourneyStrip({
  journey, close, rates,
}: {
  journey?: StoryJourney | null
  /** Latest close — turns the stored base ceiling into a live distance. */
  close?: number | null
  /** Nightly recorded outcome across all journeys. Null = say less. */
  rates?: JourneyBaseRates | null
}) {
  if (!journey) return null

  const j = journey
  const reached = reachedIndex(j)
  const slept = !!j.sleep_date
  const state = j.state ? (STATE_LABEL[j.state] ?? j.state) : null

  // The wake condition is a close above the base ceiling. Both numbers are
  // stored; the gap is the only thing computed, and only when both exist.
  const ceiling = j.base_high ?? null
  const gap = ceiling != null && close != null ? ceiling - close : null
  const gapPct = gap != null && close ? (gap / close) * 100 : null

  const accent = slept ? 'var(--text-faint)' : 'var(--accent, var(--gold-soft))'

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: `2px solid ${accent}`,
        borderRadius: 10,
        padding: '13px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 11, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Journey
        </span>
        {state && (
          <span style={{ fontSize: 14, fontWeight: 650, color: accent }}>
            {slept ? 'Closed' : state}
          </span>
        )}
        {j.base_years != null && (
          <span style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>
            {j.base_years}-year base{j.base_start ? ` from ${fmtDate(j.base_start)}` : ''}
          </span>
        )}
        {j.resting && !slept && (
          <span style={{ ...MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase',
            color: 'var(--risk-amber)', border: '1px solid var(--risk-amber)', borderRadius: 3, padding: '1px 5px' }}>
            Resting
          </span>
        )}
      </div>

      {/* Milestone track. A slept journey greys out — the arc happened, it is
          simply no longer running. */}
      <div style={{ display: 'flex', gap: 2 }}>
        {STEPS.map((s, i) => {
          const done = i <= reached
          const now = i === reached && !slept
          const date =
            s.key === 'base' ? j.base_start
            : s.key === 'turn' ? j.turn_date
            : s.key === 'wake' ? j.wake_date
            : s.key === 'confirm' ? j.confirm_date
            : null
          return (
            <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: done && !slept ? accent : done ? 'var(--text-faint)' : 'var(--border)',
                opacity: done ? 1 : 0.55,
              }} />
              <div style={{ ...MONO, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase',
                color: now ? 'var(--text-primary)' : done ? 'var(--text-muted)' : 'var(--text-faint)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.label}
              </div>
              <div style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.key === 'stir' ? stirLabel(j) : fmtDate(date)}
              </div>
            </div>
          )
        })}
      </div>

      {/* The numbers that say where in the arc this actually is. */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {j.align_score != null && (
          <Fact k="Clocks" v={`${j.align_score}/6`} tone={j.align_score >= 6 ? 'bull' : undefined} />
        )}
        {j.pct_from_turn != null && <Fact k="From turn" v={`${j.pct_from_turn > 0 ? '+' : ''}${j.pct_from_turn.toFixed(1)}%`} tone={j.pct_from_turn > 0 ? 'bull' : 'bear'} />}
        {j.pct_from_wake != null && <Fact k="From wake" v={`${j.pct_from_wake > 0 ? '+' : ''}${j.pct_from_wake.toFixed(1)}%`} tone={j.pct_from_wake > 0 ? 'bull' : 'bear'} />}
        {ceiling != null && <Fact k="Base ceiling" v={rupee(ceiling)} />}
        {!j.wake_date && gap != null && gap > 0 && gapPct != null && (
          <Fact k="To the wake" v={`${rupee(gap)} · ${gapPct.toFixed(1)}%`} />
        )}
        {j.sleep_date && <Fact k="Closed" v={fmtDate(j.sleep_date)} />}
      </div>

      <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)', margin: 0 }}>
        {baseRateLine(j, rates, gap)}
        {' '}Observational — recorded frequencies, not a forecast.
      </p>
    </div>
  )
}

function Fact({ k, v, tone }: { k: string; v: string; tone?: 'bull' | 'bear' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ ...MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{k}</span>
      <span style={{ ...MONO, fontSize: 12.5, fontWeight: 650,
        color: tone === 'bull' ? 'var(--bull)' : tone === 'bear' ? 'var(--bear)' : 'var(--text-primary)' }}>{v}</span>
    </div>
  )
}
