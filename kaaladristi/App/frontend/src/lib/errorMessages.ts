import { isAuthError } from '@/stores/authStore'

/** The two pieces of copy that genuinely depend on what the app was trying
 *  to do — everything else (auth-expired, HTTP-status, timeout) is the same
 *  regardless of which flow hit it, so those stay fixed in errMessage(). */
export interface ErrMessageContext {
  /** Shown when the failure looks like a dead network connection. */
  networkMessage: string
  /** Shown when nothing more specific matched. */
  fallbackMessage: string
}

/**
 * Translate a caught error into a calm, actionable, user-facing message.
 * Originally ProfileSetup.tsx's local errMessage() — extracted so every
 * user-facing catch in the app gets the same quality of message instead of
 * some flows showing a raw `err.message` and others showing translated
 * copy (found in the LoginPage/ProfileSetup UX review — same product,
 * two different standards).
 */
export function errMessage(e: unknown, ctx: ErrMessageContext): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (isAuthError(e)) {
    return 'Your session has expired — please log in again.'
  }
  // Surface the actual server response when it's an HTTP error — a generic
  // "check your connection" fallback hides every real cause (401/403/500/etc.)
  // and is indistinguishable from an actual network drop.
  if (/HTTP \d/i.test(raw)) {
    const short = raw.replace(/^Error:\s*/, '').slice(0, 220)
    return `Server rejected the request: ${short}. Try again in a moment.`
  }
  if (/timed out/i.test(raw)) {
    return 'The server took too long to respond. Try again in a moment.'
  }
  if (/framework service|Failed to fetch|NetworkError|load failed/i.test(raw)) {
    return ctx.networkMessage
  }
  return ctx.fallbackMessage
}
