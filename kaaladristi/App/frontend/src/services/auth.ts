import { supabase } from './supabase';
import type { KmProfile } from '@/types';

// ── Sign Up (email + password) ──
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

// ── Sign In ──
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ── Sign Out ──
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Get current session ──
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ── Get profile for current user ──
export async function getProfile(): Promise<KmProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('km_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    // Profile might not exist yet (trigger hasn't fired)
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as KmProfile;
}

// ── Update profile ──
export async function updateProfile(updates: Partial<Pick<KmProfile, 'full_name' | 'display_name' | 'phone' | 'avatar_url' | 'onboarded'>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('km_profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as KmProfile;
}
