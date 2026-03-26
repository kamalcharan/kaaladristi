/**
 * Authentication service for KaalaDristi.
 * Replaces Supabase GoTrue with custom JWT auth via PostgREST RPC.
 *
 * Auth flow:
 *   1. signIn/signUp → POST /rpc/kd_auth_login or /rpc/kd_auth_register
 *   2. Server returns { access_token, user } (JWT signed with shared secret)
 *   3. Token stored in localStorage, sent on all subsequent PostgREST requests
 *   4. PostgREST validates the JWT automatically
 *
 * Until the server-side auth RPC functions are implemented,
 * this module uses a simplified session model:
 *   - No server-side auth (single-user / dev mode)
 *   - A hardcoded anon session
 */

import { from } from './postgrest';
import type { KmProfile } from '@/types';

const SESSION_KEY = 'kd_session';

export interface KdSession {
  access_token: string;
  user: KdUser;
}

export interface KdUser {
  id: string;
  email: string;
  full_name?: string;
}

// ── Session persistence ──────────────────────────────────────────────────────

function saveSession(session: KdSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredSession(): KdSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KdSession;
  } catch {
    return null;
  }
}

// ── Auth operations ──────────────────────────────────────────────────────────

/**
 * Sign up with email + password.
 * TODO: Call /rpc/kd_auth_register when server-side auth is implemented.
 */
export async function signUp(email: string, password: string, fullName: string) {
  // Placeholder — server-side auth RPC not yet implemented
  console.warn('[auth] signUp: server-side auth not yet implemented, using dev mode');
  const session: KdSession = {
    access_token: import.meta.env.VITE_ANON_KEY || '',
    user: { id: 'dev-user', email, full_name: fullName },
  };
  saveSession(session);
  return session;
}

/** Sign in with email + password. */
export async function signIn(email: string, password: string) {
  // Placeholder — server-side auth RPC not yet implemented
  console.warn('[auth] signIn: server-side auth not yet implemented, using dev mode');
  const session: KdSession = {
    access_token: import.meta.env.VITE_ANON_KEY || '',
    user: { id: 'dev-user', email },
  };
  saveSession(session);
  return session;
}

/** Sign out — clear local session. */
export async function signOut() {
  clearSession();
}

/** Get current session from localStorage. */
export async function getSession(): Promise<KdSession | null> {
  return getStoredSession();
}

/** Get current user from session. */
export function getUser(): KdUser | null {
  return getStoredSession()?.user ?? null;
}

/** Get profile for current user from km_profiles table. */
export async function getProfile(): Promise<KmProfile | null> {
  const user = getUser();
  if (!user) return null;

  const { data, error } = await from('km_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
    .execute();

  if (error) {
    // Profile might not exist yet
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  return data as KmProfile | null;
}

/** Update profile for current user. */
export async function updateProfile(
  updates: Partial<Pick<KmProfile, 'full_name' | 'display_name' | 'phone' | 'avatar_url' | 'onboarded'>>,
) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await from('km_profiles')
    .select('*')
    .eq('id', user.id)
    .update(updates)
    .single()
    .execute();

  if (error) throw new Error(error.message);
  return data as KmProfile;
}

// ── Auth state change listeners ──────────────────────────────────────────────

type AuthCallback = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: KdSession | null) => void;
const listeners: AuthCallback[] = [];

/** Register a callback for auth state changes. Returns unsubscribe function. */
export function onAuthStateChange(callback: AuthCallback): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/** Notify all listeners of an auth state change. */
function notifyListeners(event: 'SIGNED_IN' | 'SIGNED_OUT', session: KdSession | null) {
  for (const cb of listeners) {
    try { cb(event, session); } catch { /* ignore */ }
  }
}
