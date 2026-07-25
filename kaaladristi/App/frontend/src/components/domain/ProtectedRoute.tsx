import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import BetaWelcomeModal from '@/components/ui/BetaWelcomeModal';

interface ProtectedRouteProps {
  requireOnboarded?: boolean;
}

export default function ProtectedRoute({ requireOnboarded = true }: ProtectedRouteProps) {
  const { user, profile, isLoading, authError } = useAuthStore();

  // Still initializing auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-kd-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  // Not authenticated → landing page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Profile FAILED to load (network/server error, token already handled by a
  // clean sign-out in authStore) → back to the landing/login page, never into
  // the /setup wizard: an onboarded user whose profile fetch hiccuped once
  // must not be re-onboarded (repeat-/setup nuisance, 2026-07-25).
  if (!profile && authError) {
    return <Navigate to="/" replace />;
  }

  // Authenticated but not onboarded → send to setup.
  // profile === null is treated as NOT onboarded: once auth initialization is
  // done (isLoading handled above), a null profile with NO fetch error means
  // the km_profiles row is genuinely missing — that must never skip
  // onboarding. LoginPage awaits refreshProfile() before navigating, so
  // onboarded users don't hit this with a transiently-null profile.
  if (requireOnboarded && !profile?.onboarded) {
    return <Navigate to="/setup" replace />;
  }

  // Welcome + non-advisory disclaimer — once per user (localStorage-persisted),
  // on whichever protected page they land on first. Only in the onboarded
  // layout so it never overlaps the /setup wizard.
  return (
    <>
      {requireOnboarded && <BetaWelcomeModal />}
      <Outlet />
    </>
  );
}
