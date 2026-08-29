import posthog from 'posthog-js'

/**
 * Shared analytics wrapper — one PostHog Cloud org/project across ALL
 * Vikuna products (DristiQ, ContractNest, VaNi, …), not just this one.
 *
 * Two things this wrapper enforces so the shared setup stays correct as
 * more products join it:
 *
 * 1. `product` is registered as a PostHog *super property* once at init, so
 *    every event this app ever captures — including PostHog's own
 *    autocaptured clicks/pageviews — carries it automatically. Filter or
 *    group by `product` in PostHog to see one product or all of them.
 * 2. Every distinct_id passed to identify() is namespaced `product:id`.
 *    Each product has its own independent user-id space (separate DBs) —
 *    without the prefix, DristiQ user "42" and ContractNest user "42"
 *    would collide into the same PostHog person.
 *
 * No-ops everywhere if VITE_POSTHOG_KEY isn't set, so local dev and any
 * environment without analytics configured never breaks on this.
 */

const PRODUCT = 'dristiq'
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let ready = false

export function initAnalytics(): void {
  if (!KEY || ready) return
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only', // don't create a person until identify() — avoid tracking anonymous visitors as full profiles
    capture_pageview: true,
    capture_pageleave: true,
  })
  posthog.register({ product: PRODUCT })
  ready = true
}

/** Call once a user's profile is known (login, session restore). */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!ready) return
  posthog.identify(`${PRODUCT}:${userId}`, traits)
}

/** Call on sign-out — clears the local PostHog identity so the next
 *  session (possibly a different person on the same device) starts clean. */
export function resetAnalytics(): void {
  if (!ready) return
  posthog.reset()
}

/** Capture a product event. `product` is already attached via the
 *  super-property registered in initAnalytics() — don't pass it again. */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (!ready) return
  posthog.capture(name, props)
}
