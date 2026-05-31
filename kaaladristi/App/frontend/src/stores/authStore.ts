import { create } from 'zustand';
import type { KmProfile } from '@/types';
import type { KdSession, KdUser } from '@/services/auth';
import { getSession, getProfile, onAuthStateChange } from '@/services/auth';
import { useThemeStore } from '@/stores/themeStore';

function applyProfileTheme(profile: KmProfile | null) {
  if (!profile) return
  const themeId = (profile.theme ?? 'kaaladristi') as Parameters<typeof useThemeStore.getState['setTheme']>[0]
  const darkMode = profile.dark_mode ?? true
  useThemeStore.getState().setTheme(themeId as any, darkMode)
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
      const session = await getSession();

      if (session?.user) {
        set({ user: session.user, session });

        try {
          const profile = await getProfile();
          applyProfileTheme(profile)
          set({
            profile,
            isAdmin: profile?.role === 'admin',
            isLoading: false,
          });
        } catch (err) {
          console.error('[auth] getProfile error:', err);
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      onAuthStateChange(async (_event, session) => {
        set({ user: session?.user ?? null, session });

        if (session?.user) {
          try {
            const profile = await getProfile();
            applyProfileTheme(profile)
            set({ profile, isAdmin: profile?.role === 'admin' });
          } catch { /* ignore */ }
        } else {
          set({ profile: null, isAdmin: false });
        }
      });
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
