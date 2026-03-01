import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { KmProfile } from '@/types';
import { supabase } from '@/services/supabase';
import { getProfile } from '@/services/auth';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: KmProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  authError: string | null;

  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
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
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[auth] getSession error:', sessionError.message);
        set({ isLoading: false, authError: sessionError.message });
        return;
      }

      if (session?.user) {
        set({ user: session.user, session });

        // Fetch profile
        try {
          const profile = await getProfile();
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
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ user: session?.user ?? null, session });

        if (session?.user) {
          try {
            const profile = await getProfile();
            set({ profile, isAdmin: profile?.role === 'admin' });
          } catch { /* ignore */ }
        } else {
          set({ profile: null, isAdmin: false });
        }
      });
    } catch (err) {
      // Critical: if getSession() itself throws (network error, invalid URL, etc.)
      // we MUST set isLoading=false so the app doesn't hang on the spinner forever
      console.error('[auth] initialize() failed:', err);
      set({
        isLoading: false,
        authError: err instanceof Error ? err.message : 'Failed to connect to auth service',
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
