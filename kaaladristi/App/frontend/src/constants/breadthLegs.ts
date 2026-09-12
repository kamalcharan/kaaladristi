/**
 * The bridge between a user's ICP and the breadth data.
 *
 * This is the whole reason the opening brief can say something decision-shaped
 * rather than merely descriptive. Onboarding already asks where the user would
 * concede they were wrong, and every answer NAMES A PRICE LINE at a specific
 * timeframe (personaConfig.CONCEDE_LEVEL_OPTIONS). Market breadth is measured
 * at those same three timeframes. So the same market reads differently
 * depending on who is asking:
 *
 *   2026-09-11 — 35.7% of NSE held their 20 EMA, 41.4% their 50, 45.4% their 150.
 *     · concedes at the 10-day low  → their timeframe is the WEAKEST one
 *     · concedes at the Golden Line → their timeframe is the one still holding
 *
 * Identical numbers, opposite meaning. Naming which leg is *theirs* is what
 * turns a market reading into their reading.
 *
 * Constants-first rule: never inline this mapping. The keys are
 * personaConfig's ConcedeLevel union and the DB CHECK in migration 204;
 * `npm run check:persona` keeps that vocabulary honest.
 */
import type { ConcedeLevel } from './personaConfig';

export type BreadthLeg = 'short' | 'medium' | 'long';

/** Concede line → the breadth timeframe that user actually operates on. */
export const PERSONA_TO_LEG: Record<ConcedeLevel, BreadthLeg> = {
  tight: 'short',        // 10-day low   → 20 EMA
  swing_low: 'medium',   // 22-day low   → 50 EMA
  structure: 'long',     // Golden Line  → 150 EMA
};

/** Human phrasing for each leg, reused by the ladder and the VaNi payload. */
export const LEG_PHRASE: Record<BreadthLeg, string> = {
  short: 'the short-term line (20 EMA)',
  medium: 'the medium-term line (50 EMA)',
  long: 'the long-term line (150 EMA, the Golden Line)',
};
