// Deterministic plain-language interpretation of a rule's evidence — NO LLM.
// (VaNi narration is deferred; the right-click "what does this mean" read must
// work from data alone.) Built on km_rule_evidence via the shared fetch.
//
// Voice rules (astro-story §2 + the founding use case): readiness, never
// direction. Numbers appear as "X of Y" beside their base rate; an effect is
// described only when it clears the same thresholds the tooltip uses;
// otherwise the read says "ordinary" plainly.

import type { RuleEvidence, TransitionStats } from '@/pages/RuleEngine/ruleService'

const BOUNDARY_LABEL: Record<string, string> = {
  day: 'event day', start: 'entry day', end: 'exit day',
}

export interface RuleRead {
  role: 'watch' | 'orientation'
  /** One glanceable line for the hover tooltip. */
  hover: string
  /** Short paragraphs for the right-click read. */
  paragraphs: string[]
}

interface Boundary { key: string; label: string; t: TransitionStats; dev: number }

function boundaries(ev: RuleEvidence): Boundary[] {
  return Object.entries(ev.transitions ?? {})
    .filter(([, t]) => t.n >= 10 && t.base_flip_pct != null)
    .map(([key, t]) => ({
      key, label: BOUNDARY_LABEL[key] ?? key, t,
      dev: t.flip_pct - (t.base_flip_pct as number),
    }))
    .sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))
}

export function buildRuleRead(ev: RuleEvidence | null | undefined): RuleRead {
  if (!ev || !ev.windows_scored) {
    return {
      role: 'orientation',
      hover: 'no measured history yet',
      paragraphs: ['This rule has no measured market history yet.'],
    }
  }

  const n = ev.windows_scored
  const sinceYr = ev.first_scored ? ev.first_scored.slice(0, 4) : null
  const bs = boundaries(ev)
  const best = bs[0]
  const isWatch = best != null && Math.abs(best.dev) >= 5

  // ── Hover line ──────────────────────────────────────────────────────────
  let hover: string
  if (isWatch && best.dev > 0) {
    hover = `watch the ${best.label} ±2d — trend changed ${best.t.flip_pct.toFixed(0)}% vs ${best.t.base_flip_pct!.toFixed(0)}% usual`
  } else if (isWatch) {
    hover = `unusually steady around the ${best.label} — changes ${best.t.flip_pct.toFixed(0)}% vs ${best.t.base_flip_pct!.toFixed(0)}% usual`
  } else {
    hover = 'historically ordinary conditions — context, not a signal'
  }

  // ── Full read ───────────────────────────────────────────────────────────
  const p: string[] = []
  p.push(`Seen ${n} times${sinceYr ? ` since ${sinceYr}` : ''} against NIFTY 50.`)

  // Inside the window
  const inside: string[] = []
  if (ev.range_ratio_mean != null) {
    if (ev.range_ratio_mean >= 1.15) inside.push(`daily ranges ran ${ev.range_ratio_mean.toFixed(1)}× their usual size`)
    else if (ev.range_ratio_mean <= 0.85) inside.push(`daily ranges ran quieter than usual (${ev.range_ratio_mean.toFixed(2)}×)`)
    else inside.push('daily ranges stayed about usual')
  }
  if (ev.pos_close_n != null && ev.pos_close_base_pct != null) {
    const pct = (ev.pos_close_n / n) * 100
    const dev = pct - ev.pos_close_base_pct
    if (Math.abs(dev) >= 8) {
      inside.push(`NIFTY finished the window higher ${ev.pos_close_n} of ${n} times — ${dev > 0 ? 'above' : 'below'} its normal rate (~${ev.pos_close_base_pct.toFixed(0)}%)`)
    } else {
      inside.push(`NIFTY finished higher ${ev.pos_close_n} of ${n} times — about its normal rate`)
    }
  }
  if (inside.length > 0) p.push(`Inside these windows, ${inside.join('; ')}.`)

  // The edges
  const notable = bs.filter(b => Math.abs(b.dev) >= 5)
  if (notable.length > 0) {
    for (const b of notable) {
      let line = `Around the ${b.label} (±2 days), the short-term trend changed ${b.t.flip_pct.toFixed(0)}% of the time, vs ~${b.t.base_flip_pct!.toFixed(0)}% on ordinary days.`
      if (b.t.confirm_given_flip_pct != null) {
        line += ` When it did change, a break of the previous day's high or low confirmed it ${b.t.confirm_given_flip_pct.toFixed(0)}% of the time.`
      }
      p.push(line)
    }
  } else if (bs.length > 0) {
    p.push('Its entry and exit days show no unusual turn behavior — ordinary days statistically.')
  }

  // How to use — readiness voice, never direction
  if (isWatch && best.dev > 0) {
    p.push(`How to use: the date is the alarm clock, not the signal. For two days either side of the ${best.label}, keep the previous day's high and low on screen — the break is the confirmation.`)
  } else {
    p.push('How to use: treat as context — where you are in the cycle. No day inside this window has historically demanded special readiness.')
  }

  return { role: isWatch && best.dev > 0 ? 'watch' : 'orientation', hover, paragraphs: p }
}

/** Compact mono stat lines (moved from TradingChart) — the fine-print footer
 *  of the right-click read. Threshold-driven identically to the prose. */
export function patternLines(ev: RuleEvidence): string[] {
  const n = ev.windows_scored
  if (!n) return []
  const lines: string[] = []
  const sinceYr = ev.first_scored ? `'${ev.first_scored.slice(2, 4)}` : '—'
  let rangeTxt = 'range in line with usual'
  if (ev.range_ratio_mean != null) {
    if (ev.range_ratio_mean >= 1.15) rangeTxt = `range ran ${ev.range_ratio_mean.toFixed(2)}× usual`
    else if (ev.range_ratio_mean <= 0.85) rangeTxt = `quieter than usual (${ev.range_ratio_mean.toFixed(2)}×)`
  }
  lines.push(`${n} windows since ${sinceYr} · ${rangeTxt}`)
  if (ev.pos_close_n != null && ev.pos_close_base_pct != null) {
    const pct = (ev.pos_close_n / n) * 100
    lines.push(
      Math.abs(pct - ev.pos_close_base_pct) < 8
        ? `closed higher in ${ev.pos_close_n}/${n} — near its usual rate`
        : `closed higher in ${ev.pos_close_n}/${n} (usual ≈${ev.pos_close_base_pct.toFixed(0)}%)`,
    )
  }
  if (ev.turn_n != null && ev.turn_base_pct != null) {
    const pct = (ev.turn_n / n) * 100
    if (Math.abs(pct - ev.turn_base_pct) >= 10) {
      lines.push(`a swing high/low formed inside ${pct.toFixed(0)}% (usual ≈${ev.turn_base_pct.toFixed(0)}%)`)
    }
  }
  if ((ev.vix_windows ?? 0) >= 10 && ev.vix_up_n != null) {
    lines.push(`VIX rose in ${ev.vix_up_n} of ${ev.vix_windows} recent windows`)
  }
  const TRANSITION_LABEL: Record<string, string> = { day: 'event ±2d', start: 'entry ±2d', end: 'exit ±2d' }
  for (const [key, t] of Object.entries(ev.transitions ?? {})) {
    if (t.n < 10) continue
    const flipBase = t.base_flip_pct != null ? ` (usual ≈${t.base_flip_pct.toFixed(0)}%)` : ''
    let line = `${TRANSITION_LABEL[key] ?? key} ×${t.n}: trend flipped ${t.flip_pct.toFixed(0)}%${flipBase}`
    if (t.confirm_given_flip_pct != null) {
      line += ` · flips confirmed by a prev-day H/L break ${t.confirm_given_flip_pct.toFixed(0)}%`
    }
    lines.push(line)
  }
  return lines
}
