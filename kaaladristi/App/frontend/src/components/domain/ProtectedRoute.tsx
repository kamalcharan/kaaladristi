import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  requireOnboarded?: boolean;
}

export default function ProtectedRoute({ requireOnboarded = true }: ProtectedRouteProps) {
  const { user, profile, isLoading } = useAuthStore();

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

  // Authenticated but not onboarded → profile setup
  if (requireOnboarded && profile && !profile.onboarded) {
    return <Navigate to="/setup" replace />;
  }

  return <Outlet />;
}
