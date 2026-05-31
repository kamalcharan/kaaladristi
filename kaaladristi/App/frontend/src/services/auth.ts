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

  return data as KmProfile | null;
}

/** Update profile for current user.
 *  Uses upsert so it works whether or not the km_profiles row already exists
 *  (e.g. immediately after a fresh registration). */
export async function updateProfile(
  updates: Partial<Pick<KmProfile, 'full_name' | 'display_name' | 'phone' | 'avatar_url' | 'onboarded' | 'theme' | 'dark_mode'>>,
) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await from('km_profiles')
    .upsert({ id: user.id, email: user.email, ...updates })
    .select('*')
    .single()
    .execute();

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
