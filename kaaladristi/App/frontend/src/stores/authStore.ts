import { create } from 'zustand';
import type { KmProfile } from '@/types';
import type { KdSession, KdUser } from '@/services/auth';
import { getSession, getProfile, onAuthStateChange, signOut } from '@/services/auth';

/** Errors that mean the token is dead (expired/invalid) rather than the
 *  network being flaky — the only correct response is a clean sign-out. */
export function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /jwt|expired|unauthoriz|not authenticated|HTTP 401|\b401\b/i.test(msg);
}
import { useThemeStore, type ThemeId, type ThemeMode } from '@/stores/themeStore';
import { identifyUser, resetAnalytics } from '@/lib/analytics';

function applyProfileTheme(profile: KmProfile | null) {
  if (!profile) return
  const themeId = (profile.theme ?? 'kaaladristi') as ThemeId
  // Only 'light'/'dark' remain (System was removed) — coerce legacy 'system'.
  const mode: ThemeMode = profile.mode === 'light' ? 'light' : 'dark'
  useThemeStore.getState().setTheme(themeId)
  useThemeStore.getState().setMode(mode)
}

interface AuthState {
  user: KdUser | null;
  session: KdSession | null;
  profile: KmProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  authError: string | null;

  initialize: () => Promise<void>;
  setSession: (session: KdSession | null) => void;
  setProfile: (profile: KmProfile | null) => void;
  refreshProfile: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  authError: null,

  initialize: async () => {
    set({ isLoading: true, authError: null });

    try {
      // Listen for auth changes — registered FIRST so it survives the early
      // sign-out returns below. LoginPage's sign-in reaches the store's `user`
      // only through this listener; registering it last meant a dead-token
      // sign-out during init would leave the app unable to log back in.
      onAuthStateChange(async (_event, session) => {
        set({ user: session?.user ?? null, session });

        if (session?.user) {
          try {
            const profile = await getProfile();
            applyProfileTheme(profile)
            set({ profile, isAdmin: profile?.role === 'admin' });
            if (profile) identifyUser(profile.id, { email: profile.email, role: profile.role });
          } catch { /* ignore */ }
        } else {
          set({ profile: null, isAdmin: false });
          resetAnalytics();
        }
      });

      const session = await getSession();

      if (session?.user) {
        set({ user: session.user, session });

        // Load the profile — retry once on transient failures. Leaving the
        // store as "user set, profile null" is a trap: ProtectedRoute reads a
        // null profile as not-onboarded and bounces a fully-onboarded user
        // into /setup (the repeat-/setup nuisance, 2026-07-25). A dead token
        // (401/expired) gets a clean sign-out instead; anything else marks
        // authError so ProtectedRoute can route to login, not the wizard.
        let profile = null;
        let profileErr: unknown = null;
        try {
          profile = await getProfile();
        } catch (err1) {
          // Even an auth-shaped error (401/expired/jwt) gets ONE retry
          // before we treat it as a genuinely dead token — a cold-starting
          // backend container or a fleeting network blip can return a
          // 401/502 that LOOKS auth-shaped without the token actually
          // being invalid. This whole block only runs on a fresh full
          // page load (a client-side SPA navigation between already-
          // mounted pages never re-enters initialize()) — so a page only
          // ever reached by typing its URL directly (never through an
          // in-app link) is the one place that repeatedly exercises this
          // exact race, while every other page — always reached via a
          // link click into an already-initialized session — never does.
          // Instant sign-out on the FIRST failure here silently bounced
          // users to the landing page on nothing more than a transient
          // hiccup, with zero error shown — indistinguishable from "never
          // logged in." Retrying first (mirroring the non-auth-error path
          // below) means a genuinely dead token still gets caught (it
          // fails identically on retry), but a one-off blip doesn't cost
          // the session.
          console.error('[auth] getProfile failed (attempt 1), retrying once:', err1);
          await new Promise(r => setTimeout(r, 1500));
          try {
            profile = await getProfile();
          } catch (err2) {
            if (isAuthError(err2)) {
              console.error('[auth] token rejected on retry — signing out:', err2);
              await signOut();
              set({ user: null, session: null, profile: null, isAdmin: false, isLoading: false });
              return;
            }
            profileErr = err2;
          }
        }
        if (profileErr) {
          console.error('[auth] getProfile error (after retry):', profileErr);
          set({
            isLoading: false,
            authError: profileErr instanceof Error ? profileErr.message : 'Failed to load profile',
          });
        } else {
          applyProfileTheme(profile)
          set({
            profile,
            isAdmin: profile?.role === 'admin',
            isLoading: false,
          });
          if (profile) identifyUser(profile.id, { email: profile.email, role: profile.role });
        }
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('[auth] initialize() failed:', err);
      set({
        isLoading: false,
        authError: err instanceof Error ? err.message : 'Failed to initialize auth',
      });
    }
  },

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
  }),

  setProfile: (profile) => set({
    profile,
    isAdmin: profile?.role === 'admin',
  }),

  refreshProfile: async () => {
    try {
      const profile = await getProfile();
      applyProfileTheme(profile)
      set({ profile, isAdmin: profile?.role === 'admin' });
    } catch { /* ignore */ }
  },

  clear: () => set({
    user: null,
    session: null,
    profile: null,
    isAdmin: false,
    authError: null,
  }),
}));
