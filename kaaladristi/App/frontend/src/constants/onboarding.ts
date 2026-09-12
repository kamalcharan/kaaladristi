/**
 * Which onboarding a user must have completed, and how we ask.
 *
 * Replaces the blanket `UPDATE km_profiles SET onboarded = false` of
 * migration 165. That worked once and told us nothing: it could not
 * distinguish a user who already satisfied the new step from one who did
 * not, so everyone re-walked everything — and because it cleared the flag
 * that guards ProfileSetup, it also let users re-apply the starter template
 * over a workspace they had built.
 *
 * Here the profile records WHICH flow it completed (km_profiles
 * .onboarding_version, migration 206) and the app compares it to the constant
 * below. Sending a cohort back through setup is: bump this number, stamp
 * whoever should be exempt. Nothing else moves.
 *
 * ── Version log ────────────────────────────────────────────────────────────
 *   1  Persona / ICP flow (migration 204, shipped 2026-09-07).
 *      The four answers — persona, acts_on, hold_horizon, concede_level —
 *      are what make VaNi's opening brief personal: concede_level names the
 *      price line the user actually trades on, which selects the breadth
 *      timeframe their read is built around (constants/breadthLegs.ts).
 *      Without them the brief has no line to mark and every user gets the
 *      same generic market reading.
 *
 * When you bump this, add the line above saying what changed and why, and
 * write the matching migration — a version nobody can explain is worse than
 * no version.
 */
import type { KmProfile } from '@/types';

export const ONBOARDING_VERSION = 1;

/**
 * Does this profile need to go (back) through /setup?
 *
 * Two independent reasons, both of which must send the user to the wizard:
 *   · they never finished it (`onboarded` false) — the original rule;
 *   · they finished an OLDER flow than the one we now require.
 *
 * A null profile counts as needing it. Once auth has settled, a null profile
 * with no fetch error means the km_profiles row is genuinely missing, and
 * that must never skip onboarding (ProtectedRoute carries the longer note).
 */
export function needsOnboarding(profile: KmProfile | null | undefined): boolean {
  if (!profile) return true;
  if (!profile.onboarded) return true;
  return (profile.onboarding_version ?? 0) < ONBOARDING_VERSION;
}

/**
 * True when the user is being sent back rather than arriving for the first
 * time — they have finished onboarding before, just an older version.
 *
 * The wizard uses this to behave like a returning-user flow instead of a
 * first-run one: it must not silently replace a workspace they already built
 * (see the "Keep my current workspace" exit in ProfileSetup).
 */
export function isReturningForUpgrade(profile: KmProfile | null | undefined): boolean {
  return !!profile?.onboarded && (profile.onboarding_version ?? 0) < ONBOARDING_VERSION;
}
