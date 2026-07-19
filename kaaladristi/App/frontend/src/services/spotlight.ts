/**
 * Landing-spotlight deep-link intent.
 *
 * The landing proof band stores SPOTLIGHT_INTENT_KEY before routing to
 * /login ("See it inside"). After auth completes — at LoginPage's exits for
 * existing users, or at ProfileSetup's final exits for brand-new users — the
 * exit point calls resolveSpotlightIntent() to turn that intent into a
 * destination: the Study page of today's pick, via the authenticated
 * /api/landing/spotlight/reveal endpoint.
 *
 * One-shot and fail-open: the key is cleared on first consumption, and any
 * failure (network, index-mode day, missing token) resolves to null so the
 * caller falls back to its normal destination. A broken reveal must never
 * strand a login.
 */

import { useAuthStore } from '@/stores/authStore';

export const SPOTLIGHT_INTENT_KEY = 'kd_post_login_intent';

const PIPELINE_API = (import.meta.env.VITE_PIPELINE_API_URL?.trim() || '');

export function storeSpotlightIntent(): void {
  try { localStorage.setItem(SPOTLIGHT_INTENT_KEY, 'spotlight'); } catch { /* ignore */ }
}

export async function resolveSpotlightIntent(): Promise<string | null> {
  let intent: string | null = null;
  try {
    intent = localStorage.getItem(SPOTLIGHT_INTENT_KEY);
    if (intent) localStorage.removeItem(SPOTLIGHT_INTENT_KEY); // one-shot
  } catch { return null; }
  if (intent !== 'spotlight') return null;

  const token = useAuthStore.getState().session?.access_token;
  if (!token) return null;

  try {
    const res = await fetch(`${PIPELINE_API}/api/landing/spotlight/reveal`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const j = await res.json() as { mode: string; equity_id?: number; symbol?: string };
    if (j.mode === 'equity' && j.equity_id) {
      const q = j.symbol ? `?name=${encodeURIComponent(j.symbol)}` : '';
      return `/chart/equity/${j.equity_id}${q}`; // the Study surface
    }
    return null; // index-mode day — normal destination is fine
  } catch {
    return null;
  }
}
