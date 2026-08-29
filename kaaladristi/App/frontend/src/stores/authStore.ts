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
          if (isAuthError(err1)) {
            console.error('[auth] token rejected — signing out:', err1);
            await signOut();
            set({ user: null, session: null, profile: null, isAdmin: false, isLoading: false });
            return;
          }
          await new Promise(r => setTimeout(r, 1500));
          try {
            profile = await getProfile();
          } catch (err2) {
            if (isAuthError(err2)) {
              console.error('[auth] token rejected — signing out:', err2);
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
