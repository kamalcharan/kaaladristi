/**
 * journeyFacts — the Waking Giants arc, rendered as SENTENCES.
 *
 * Two consumers: JourneyStrip's closing line (what the user reads) and the
 * thesis fact block VaNi narrates. They must not be two implementations of one
 * comparison — that is how a badge and its own scanner end up disagreeing —
 * so both come from here.
 *
 * ── Why sentences and not numbers ────────────────────────────────────────────
 * A small model handed `base_high 852.40` and `close 749.15` will volunteer a
 * comparison and get the sign wrong; it already did, in production, on the
 * first live autorun (fast/slow ROC, 2026-09-11). Every relationship in here is
 * therefore resolved into words BEFORE the model sees it — ABOVE / BELOW, UP /
 * DOWN, "X days after". The model copies a stated relationship; it never
 * derives one. That moves the risk from the model into arithmetic we can test,
 * and check-journey-events.mjs tests it.
 *
 * ── Why the base rate needs its own guard rail ───────────────────────────────
 * "58.5% of wakes confirmed" is a recorded population frequency. It is one
 * short sentence away from being narrated as "this stock will probably
 * confirm", which is a forecast about a specific security. The facts carry an
 * explicit line saying it is not that, the strip never phrases it as one, and
 * a rate is always stated WITH its denominator so the sample is visible.
 *
 * With no reading the frequency clause is DROPPED, never replaced with a
 * remembered number: the figures move every night as arcs close (migration
 * 209), and a confidently stale base rate is worse than none.
 *
 * SEBI / D39: recorded structure and recorded frequency. No expectation, no
 * instruction, no directional vocabulary.
 */

import type { StoryJourney } from './storyEvents'
import type { JourneyBaseRates } from './indicatorData'

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const t = Date.parse(d)
  if (Number.isNaN(t)) return '—'
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

/** Whole days between two ISO dates, or null if either is unusable. */
export function daysBetween(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/** The closing sentence of JourneyStrip: what this arc is, and what the
 *  recorded population says about arcs at that point.
 *
 *  Every figure comes from `rates` (nightly, migration 209). None is typed in.
 *  When there is no reading the frequency clause is dropped entirely. */
export function baseRateLine(
  j: StoryJourney,
  rates: JourneyBaseRates | null | undefined,
  gap: number | null,
): string {
  const n = rates?.closed_total ?? null
  const confirmed = rates?.confirmed_total ?? null
  const pct = rates?.confirmed_pct ?? null
  const toConfirm = rates?.avg_days_to_confirm ?? null
  const lifeOk = rates?.avg_life_confirmed ?? null

  if (j.confirm_date) {
    const head = `Confirmed ${fmtDate(j.confirm_date)}.`
    if (n && lifeOk != null) {
      return `${head} Across ${n} recorded journeys, confirmed arcs ran ${lifeOk} days on average.`
    }
    return head
  }

  if (j.wake_date) {
    const head = 'Woken, not yet confirmed.'
    if (n && confirmed != null && pct != null) {
      const when = toConfirm != null ? `, on average ${toConfirm} days after the wake` : ''
      return `${head} Of ${n} recorded journeys, ${confirmed} (${pct}%) went on to confirm${when}.`
    }
    return head
  }

  return gap != null && gap > 0
    ? 'No wake recorded on this journey. A close above the base ceiling is what records one.'
    : 'No wake recorded on this journey.'
}

/**
 * The journey block VaNi is given. Returns [] when there is no journey, so the
 * caller appends nothing rather than a header over emptiness.
 *
 * @param asOf  latest loaded bar date — the reference for every "N days ago".
 */
export function journeyFacts(
  j: StoryJourney | null | undefined,
  close: number | null | undefined,
  rates: JourneyBaseRates | null | undefined,
  asOf?: string | null,
): string[] {
  if (!j) return []

  const out: string[] = ['', 'Waking Giants journey (recorded, not inferred):']
  const age = (d?: string | null) => {
    const n = daysBetween(d, asOf)
    return n != null && n >= 0 ? ` (${n} days before the latest bar)` : ''
  }

  if (j.sleep_date) {
    const life = daysBetween(j.wake_date, j.sleep_date)
    out.push(`- Arc CLOSED on ${fmtDate(j.sleep_date)}${life != null ? `, ${life} days after its wake` : ''}. It is no longer running.`)
  } else if (j.state) {
    out.push(`- Arc is RUNNING, currently in state ${j.state}${j.resting ? ' and flagged resting' : ''}.`)
  }

  if (j.base_years != null) {
    out.push(`- Base: ${j.base_years} years${j.base_start ? ` from ${fmtDate(j.base_start)}` : ''}.`)
  }
  if (j.turn_date) out.push(`- Turn recorded ${fmtDate(j.turn_date)}${age(j.turn_date)}.`)
  if (j.stir_days != null) {
    // A TALLY with its denominator, never "stirring for N days". The
    // qualifying bars are scattered (9.4 across a 41.3-bar span; 2.8%
    // contiguous), so a duration phrasing is a false claim — and it is
    // exactly the phrasing a model reaches for if handed a bare count.
    out.push(j.stir_window_bars
      ? `- Stirring signature on ${j.stir_days} of the last ${j.stir_window_bars} sessions`
        + ` (scattered bars, not a continuous run)`
        + (j.stir_first_date ? `, earliest ${fmtDate(j.stir_first_date)}.` : '.')
      : `- Stirring signature on ${j.stir_days} sessions in the recent window`
        + ` (scattered bars, not a continuous run).`)
  }
  if (j.wake_date) {
    out.push(`- Wake recorded ${fmtDate(j.wake_date)}${age(j.wake_date)}.`)
  } else {
    out.push('- NO wake recorded on this journey yet.')
  }
  if (j.confirm_date) {
    const lag = daysBetween(j.wake_date, j.confirm_date)
    out.push(`- CONFIRMED (Ascent) on ${fmtDate(j.confirm_date)}${lag != null ? `, ${lag} days after the wake` : ''}${age(j.confirm_date)}.`)
  } else if (j.wake_date && !j.sleep_date) {
    out.push('- NOT yet confirmed — the arc woke but has not reached Ascent.')
  }

  // Direction is spelled out. A signed number is exactly what the model
  // misreads, so it never has to read one.
  if (j.pct_from_turn != null) {
    out.push(`- Price is ${j.pct_from_turn >= 0 ? 'UP' : 'DOWN'} ${Math.abs(j.pct_from_turn).toFixed(1)}% since the turn.`)
  }
  if (j.pct_from_wake != null) {
    out.push(`- Price is ${j.pct_from_wake >= 0 ? 'UP' : 'DOWN'} ${Math.abs(j.pct_from_wake).toFixed(1)}% since the wake.`)
  }
  if (j.align_score != null) out.push(`- Alignment clocks: ${j.align_score} of 6.`)

  // The ceiling gap is the one live number, and the only arithmetic here.
  if (j.base_high != null) {
    if (close != null) {
      const gap = j.base_high - close
      const pct = close ? Math.abs(gap / close) * 100 : null
      const side = gap > 0 ? 'BELOW' : 'ABOVE'
      out.push(
        `- Latest close is ${side} the base ceiling of Rs ${j.base_high}`
        + `, by Rs ${Math.abs(gap).toFixed(2)}${pct != null ? ` (${pct.toFixed(1)}%)` : ''}.`
        + (gap > 0 ? ' A close clearing that ceiling is what records a wake.' : ''),
      )
    } else {
      out.push(`- Base ceiling: Rs ${j.base_high}.`)
    }
  }

  const gapForLine = j.base_high != null && close != null ? j.base_high - close : null
  out.push(`- Recorded population: ${baseRateLine(j, rates, gapForLine)}`)
  if (rates) {
    if (rates.avg_life_unconfirmed != null && rates.avg_life_confirmed != null) {
      out.push(
        `- Across the same recorded population, arcs that confirmed ran ${rates.avg_life_confirmed} days`
        + ` and arcs that never confirmed ran ${rates.avg_life_unconfirmed} days.`,
      )
    }
    out.push(
      '- These frequencies describe what HAS happened across all recorded journeys.'
      + ' They are not a probability for this stock and must not be stated as one.',
    )
  }

  return out
}
