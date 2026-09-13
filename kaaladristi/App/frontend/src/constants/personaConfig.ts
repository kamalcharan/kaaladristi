/**
 * personaConfig — the persona vocabulary for agentic onboarding.
 *
 * Single source for: the four persisted fields on km_profiles (migration 204),
 * the deterministic persona derivation, the persona → scanner mapping the
 * workbench assembles from, the persona → framework template bridge, and the
 * one-line "reading" VaNi shows as the user answers.
 *
 * Constants-first rule: nothing here is redefined inline elsewhere. The DB
 * CHECK constraints in migration 204 mirror these unions — change both.
 *
 * No LLM anywhere in this file. VaNi "infers" with a table, so the same three
 * answers always produce the same persona and the reading strip can explain
 * itself.
 */

// ── Vocabulary (mirrors km_profiles CHECK constraints) ──────────────────────

export const PERSONA_IDS = ['investor', 'swing', 'intensity'] as const
export type Persona = (typeof PERSONA_IDS)[number]

export const ACTS_ON_IDS = ['confirmed', 'early', 'extreme'] as const
export type ActsOn = (typeof ACTS_ON_IDS)[number]

export const HOLD_HORIZON_IDS = ['days', 'weeks', 'months'] as const
export type HoldHorizon = (typeof HOLD_HORIZON_IDS)[number]

export const CONCEDE_LEVEL_IDS = ['tight', 'swing_low', 'structure'] as const
export type ConcedeLevel = (typeof CONCEDE_LEVEL_IDS)[number]

/** The three answers that produce a persona. All optional — skip is allowed. */
export interface PersonaAnswers {
  acts_on?: ActsOn | null
  hold_horizon?: HoldHorizon | null
  concede_level?: ConcedeLevel | null
}

/** Skip on every Personality question lands here (POA rec. 8). */
export const DEFAULT_PERSONA: Persona = 'investor'

// ── Labels ──────────────────────────────────────────────────────────────────

export const PERSONAS: Record<Persona, { label: string; voice: string; short: string }> = {
  investor:  { label: 'Investor',            short: 'Investor',   voice: 'A starting selection for longer-term trends.' },
  swing:     { label: 'Swing trader',        short: 'Swing',      voice: 'A starting selection for moves developing over a few weeks.' },
  intensity: { label: 'High-intensity trader', short: 'Intensity', voice: 'A starting selection for short-term moves.' },
}

/** "Which of these would you act on?" — one live Studio card per option. */
export const ACTS_ON_OPTIONS: Record<ActsOn, { label: string; hint: string; phrase: string }> = {
  confirmed: { label: 'An established upward trend', hint: 'Find stocks that have already been rising steadily.', phrase: 'confirmed strength' },
  early:     { label: 'Early signs of improvement',        hint: 'Explore stocks beginning to improve before a clear trend has formed.',                phrase: 'early signs' },
  extreme:   { label: 'A sharp move happening now',   hint: 'Explore stocks making a large move in the current session.',   phrase: 'the extreme move' },
}

export const HOLD_HORIZON_OPTIONS: Record<HoldHorizon, { label: string; phrase: string }> = {
  days:   { label: 'A few days',   phrase: 'for days' },
  weeks:  { label: 'A few weeks',  phrase: 'for weeks' },
  months: { label: 'Several months or longer', phrase: 'for months' },
}

/**
 * "Where would you concede you were wrong?" — three price lines on a real
 * chart. The `line` field names the level the chart step draws and is the
 * vocabulary the reading strip and the Account tab reuse.
 */
export const CONCEDE_LEVEL_OPTIONS: Record<ConcedeLevel, { label: string; line: string; phrase: string }> = {
  tight:     { label: 'Tight',      line: '10-day low',           phrase: 'at the 10-day low' },
  swing_low: { label: 'Swing low',  line: '22-day low',           phrase: 'at the 22-day low' },
  structure: { label: 'Structure',  line: 'Golden Line (150-day)', phrase: 'at the Golden Line' },
}

// ── Derivation ──────────────────────────────────────────────────────────────

/** Holding period sets the starting persona; discovery preference is used when
 * the user is still exploring their horizon. Optional exit settings are retained
 * but do not change the recommendation profile. Explicit persona choice wins in callers. */
const HORIZON_PERSONA: Record<HoldHorizon, Persona>   = { days: 'intensity', weeks: 'swing', months: 'investor' }
const ACTS_ON_PERSONA: Record<ActsOn, Persona>         = { confirmed: 'investor', early: 'swing', extreme: 'intensity' }
const CONCEDE_PERSONA: Record<ConcedeLevel, Persona>   = { tight: 'intensity', swing_low: 'swing', structure: 'investor' }

const W_HORIZON = 2
const W_MODULATOR = 1.5

export function derivePersona(a: PersonaAnswers): Persona {
  const score: Record<Persona, number> = { investor: 0, swing: 0, intensity: 0 }
  if (a.hold_horizon)  score[HORIZON_PERSONA[a.hold_horizon]]  += W_HORIZON
  if (a.acts_on)       score[ACTS_ON_PERSONA[a.acts_on]]       += W_MODULATOR
  // Exit preferences are optional research settings, not a persona classifier.

  const best = Math.max(score.investor, score.swing, score.intensity)
  if (best === 0) return DEFAULT_PERSONA
  const winners = PERSONA_IDS.filter(p => score[p] === best)
  if (winners.length === 1) return winners[0]
  const horizonPick = a.hold_horizon ? HORIZON_PERSONA[a.hold_horizon] : null
  if (horizonPick && winners.includes(horizonPick)) return horizonPick
  return winners.includes(DEFAULT_PERSONA) ? DEFAULT_PERSONA : winners[0]
}

// ── Reading strip ───────────────────────────────────────────────────────────

/**
 * The one line VaNi shows while the user answers — its only "voice" in the
 * flow. Grows a clause per answer; ends with the derived persona once any
 * answer exists. `persona` overrides the derived one when the user has tapped
 * the chip (the strip then says "you chose").
 */
export function readingLine(a: PersonaAnswers, persona?: Persona | null): string {
  if (!a.acts_on && !a.hold_horizon && !persona) return 'Explore at your own pace. You can use every scanner and change these preferences anytime.'
  const chosen = persona ?? derivePersona(a)
  const focus = { investor: 'longer-term trends', swing: 'moves developing over a few weeks', intensity: 'short-term moves' }[chosen]
  return `We’ll start you with scanners for ${focus}. You can explore every scanner and change this anytime.`
}

// ── Persona → scanners (what the workbench assembles) ───────────────────────

/**
 * Four scan preset ids per persona, in the order the Guide checklist lists
 * them. Ids are `SCAN_PRESETS[].id` / `STUDIO_DESCRIPTORS` keys in
 * services/scanEngine.ts and config/scannerStudio.ts — never retyped there;
 * scripts/qa/check-persona.mjs fails the build check if any id drifts.
 */
export const PERSONA_SCANNERS: Record<Persona, readonly string[]> = {
  investor:  ['stage_2_leaders', 'waking_giants', 'quiet_accumulation', 'conviction_flow'],
  swing:     ['breakout_surge', 'stage_2_leaders', 'gl_retest', 'power_buy'],
  intensity: ['breakout_surge', 'gl_breakout', 'flower_pot_burst', 'volume_drive'],
}

/**
 * The three live cards in the Personality step — one per acts_on option.
 * Proposed in the POA "Open" list; owner to confirm before Phase 2 ships.
 */
export const ACTS_ON_PRESETS: Record<ActsOn, string> = {
  confirmed: 'stage_2_leaders',
  early:     'quiet_accumulation',
  extreme:   'breakout_surge',
}

/** The live card under the VaNi intro on step 1 (persona-agnostic). */
export const INTRO_PRESET = 'breakout_surge'

// ── Persona → framework template ────────────────────────────────────────────

/** Bridges to constants/frameworkTemplates.ts ids — no new templates. */
export const PERSONA_TEMPLATE: Record<Persona, string> = {
  investor:  'vani_investor',
  swing:     'vani_hybrid_balanced',
  intensity: 'vani_trader',
}

// ── Guide checklist ─────────────────────────────────────────────────────────

/** Non-scanner rows of the How-to-use-DristiQ checklist, keyed like guide_progress. */
export const GUIDE_PAGES = ['workspace', 'chart', 'market_structure'] as const

/** Days after persona_set_at during which the Morning Brief carries the continuity line. */
export const CONTINUITY_DAYS = 14

/** Hard gate for the reading strip: how many answers make a persona "set". */
export function isPersonaComplete(a: PersonaAnswers): boolean {
  return Boolean(a.acts_on && a.hold_horizon)
}

/** Category-specific starting points; direct scanner links always take precedence. */
export const PERSONA_CATEGORY_DEFAULTS: Record<Persona,Record<string,string>> = {
 investor:{price_action:'gl_retest',stage_analysis:'stage_2_leaders',flow:'conviction_flow',market:'quiet_accumulation',discovery:'waking_giants'},
 swing:{price_action:'breakout_surge',stage_analysis:'stage_2_leaders',flow:'power_buy',market:'smart_money',discovery:'waking_giants'},
 intensity:{price_action:'flower_pot_burst',stage_analysis:'stage_2_leaders',flow:'volume_drive',market:'smart_money',discovery:'waking_giants'},
}
export function recommendedScanners(persona:Persona):string[]{return [...new Set([...PERSONA_SCANNERS[persona],...Object.values(PERSONA_CATEGORY_DEFAULTS[persona])])]}
