/**
 * Authentication service for KaalaDristi.
 * Calls PostgREST RPC functions: kd_auth_register, kd_auth_login,
 * kd_auth_forgot_password, kd_auth_reset_password.
 */

import { rpc } from './postgrest';
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
  role?: string;
}

// ── Session persistence ──────────────────────────────────────────────────────

function saveSession(session: KdSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** True when the JWT carries an `exp` that has passed (60s skew allowance).
 *  kd_auth_login tokens live 7 days (migration 003); before this check the
 *  frontend kept the localStorage session forever, so day-8 visitors looked
 *  logged-in but every API call 401'd — profile never loaded, ProtectedRoute
 *  bounced them to /setup, and the wizard's framework save could never
 *  succeed ("stuck at Your framework", 2026-07-25). An unparseable token is
 *  treated as expired — it can never authenticate a request anyway. */
function tokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return true;
  }
}

export function getStoredSession(): KdSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as KdSession;
    if (!session?.access_token || tokenExpired(session.access_token)) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ── Auth operations ──────────────────────────────────────────────────────────

/** Register a new account. */
export async function signUp(email: string, password: string, fullName: string): Promise<KdSession> {
  const { data, error } = await rpc('kd_auth_register', {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  const session: KdSession = {
    access_token: data.access_token,
    user: data.user,
  };
  saveSession(session);
  notifyListeners('SIGNED_IN', session);
  return session;
}

/** Sign in with email + password. */
export async function signIn(email: string, password: string): Promise<KdSession> {
  const { data, error } = await rpc('kd_auth_login', {
    p_email: email,
    p_password: password,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  const session: KdSession = {
    access_token: data.access_token,
    user: data.user,
  };
  saveSession(session);
  notifyListeners('SIGNED_IN', session);
  return session;
}

/** Sign out — clear local session. */
export async function signOut() {
  clearSession();
  notifyListeners('SIGNED_OUT', null);
}

/** Request a password reset email. */
export async function forgotPassword(email: string): Promise<string> {
  const { data, error } = await rpc('kd_auth_forgot_password', {
    p_email: email,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data.message;
}

/** Reset password using a token. */
export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const { data, error } = await rpc('kd_auth_reset_password', {
    p_token: token,
    p_new_password: newPassword,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data.message;
}

/** Change password for the currently authenticated user. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
  const { data, error } = await rpc('kd_auth_change_password', {
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data.message;
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
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  const profile = data as KmProfile | null;

  // Get latest active subscription expires_at
  if (profile) {
    const { data: subData } = await from('user_subscriptions')
      .select('expires_at, status')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .execute();

    if (subData) {
      profile.expires_at = (subData as any).expires_at ?? null;
    }
  }

  return profile;
}

/** Update profile for current user.
 *  Goes through the kd_update_profile SECURITY DEFINER RPC (migration 143), NOT
 *  a direct PostgREST PATCH/upsert. Logged-in users run as their PROFILE role
 *  (kd_auth_login embeds km_profiles.role — e.g. 'user' — as the JWT role;
 *  migrations 096/140), and the `user` role has SELECT but no UPDATE grant on
 *  km_profiles, so a direct write 403s. That silently broke onboarding
 *  persistence (`onboarded` never saved → user re-looped to /setup and could
 *  never reach the dashboard). The RPC runs as its owner and scopes the write
 *  to the caller's own row via the JWT `sub` claim. */
export async function updateProfile(
  updates: Partial<Pick<KmProfile, 'full_name' | 'display_name' | 'phone' | 'avatar_url' | 'onboarded' | 'theme' | 'mode' | 'icp_mode'>>,
) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await rpc('kd_update_profile', { p_updates: updates });

  if (error) throw new Error(error.message);
  return data as KmProfile;
}

// ── Auth state change listeners ──────────────────────────────────────────────

type AuthCallback = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: KdSession | null) => void;
const listeners: AuthCallback[] = [];

export function onAuthStateChange(callback: AuthCallback): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners(event: 'SIGNED_IN' | 'SIGNED_OUT', session: KdSession | null) {
  for (const cb of listeners) {
    try { cb(event, session); } catch { /* ignore */ }
  }
}
