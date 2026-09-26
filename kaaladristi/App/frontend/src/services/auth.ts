/**
 * Authentication service for KaalaDristi.
 * Calls PostgREST RPC functions: kd_auth_register, kd_auth_login,
 * kd_auth_forgot_password, kd_auth_reset_password.
 */

import { rpc } from './postgrest';
import { from } from './postgrest';
import type { PostgRESTError } from './postgrest';
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

// ── Auth rejection ───────────────────────────────────────────────────────────

/** PostgREST's JWT error codes: PGRST301 (JWT could not be verified — the
 *  `JWSError JWSInvalidSignature` every browser saw after the 2026-09-26
 *  secret rotation), PGRST302 (anonymous access disabled), PGRST303 (JWT
 *  expired / not yet valid / bad claims). */
const PGRST_AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);
const AUTH_REJECTION_MESSAGE = /JWSError|JWSInvalidSignature|JWT expired/i;

/** True when a failure means the server REJECTED our credentials, as opposed
 *  to the network or the server being down. Accepts an Error, a
 *  PostgRESTError, or anything carrying `status` / `code` / `message`. */
export function isAuthRejection(err: unknown): boolean {
  if (err == null) return false;
  const o = (typeof err === 'object' ? err : { message: String(err) }) as
    { status?: unknown; code?: unknown; message?: unknown };
  if (o.status === 401) return true;
  if (typeof o.code === 'string' && PGRST_AUTH_CODES.has(o.code)) return true;
  const msg = typeof o.message === 'string' ? o.message : '';
  return AUTH_REJECTION_MESSAGE.test(msg);
}

/** The one place a dead session goes: drop the stored token, tell listeners,
 *  and send the browser to /login. A full navigation on purpose — every
 *  in-memory reader of the session starts over, and nothing can keep sending
 *  the rejected token. No-op on the redirect when already on /login. */
export function redirectToLogin(): void {
  clearSession();
  notifyListeners('SIGNED_OUT', null);
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.replace('/login');
}

/** Re-throw a PostgREST error as an Error that still carries `code` and
 *  `status`, so isAuthRejection() can read them after the throw. */
function toError(error: PostgRESTError): Error {
  return Object.assign(new Error(error.message), { code: error.code, status: error.status });
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
    throw toError(error);
  }

  const profile = data as KmProfile | null;

  // Get latest active subscription expires_at
  if (profile) {
    const { data: subData, error: subError } = await from('user_subscriptions')
      .select('expires_at, status')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .execute();

    // A rejected token here is a dead session like anywhere else; any other
    // failure keeps the pre-existing behaviour (no expiry, profile still loads).
    if (subError && isAuthRejection(subError)) throw toError(subError);

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
  updates: Partial<Pick<KmProfile,
    | 'full_name' | 'display_name' | 'phone' | 'avatar_url' | 'onboarded' | 'theme' | 'mode' | 'icp_mode'
    // migration 204 — persona_set_at is stamped by the RPC, never sent
    | 'persona' | 'acts_on' | 'hold_horizon' | 'concede_level' | 'guide_progress'
    // migration 206 — stamped only by finishOnboarding(), alongside `onboarded`
    | 'onboarding_version'
  >>,
) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await rpc('kd_update_profile', { p_updates: updates });

  if (error) throw new Error(error.message);
  const saved = data as KmProfile;
  if (saved?.id !== user.id || (['persona','acts_on','hold_horizon','concede_level'] as const).some(key=>key in updates && saved[key] !== updates[key])) throw new Error('Your profile could not be verified. Please try saving again.');
  const { useAuthStore } = await import('@/stores/authStore');
  const current = useAuthStore.getState().profile;
  useAuthStore.getState().setProfile(current?.id === saved.id ? {...current,...saved} : saved);
  return saved;
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
