import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { ErrorBoundary } from '@/components/ui';
import Layout from '@/components/domain/Layout';
import ProtectedRoute from '@/components/domain/ProtectedRoute';
import LandingPage from '@/views/LandingPage';
import ProfileSetup from '@/views/ProfileSetup';
import DashboardPage from '@/views/DashboardPage';
import MarketsView from '@/views/MarketsView';
import CalendarView from '@/views/CalendarView';
import TransmissionView from '@/views/TransmissionView';
import BacktestView from '@/views/BacktestView';
import SettingsView from '@/views/SettingsView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { isLoading, authError, initialize } = useAuthStore();

  useEffect(() => {
    initialize().catch((err) => {
      console.error('[App] Auth initialization failed:', err);
    });
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-kd-bg flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="text-sm text-muted">Connecting to Kala-Drishti...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-kd-bg flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-risk-amber/10 border border-risk-amber/30 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-risk-amber" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
          <p className="text-sm text-secondary mb-4 leading-relaxed">
            Could not connect to the authentication service. The Supabase project may be
            paused or unreachable.
          </p>
          <p className="text-xs text-muted bg-slate-900/60 border border-white/5 rounded-xl p-3 mb-6 mono">
            {authError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-indigo/20 border border-accent-indigo/40 rounded-xl text-sm font-medium text-accent-indigo hover:bg-accent-indigo/30 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public: Landing / Auth */}
      <Route path="/" element={<LandingPage />} />

      {/* Authenticated but not yet onboarded */}
      <Route element={<ProtectedRoute requireOnboarded={false} />}>
        <Route path="/setup" element={<ProfileSetup />} />
      </Route>

      {/* Authenticated + onboarded: App shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/markets" element={<MarketsView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/transmission" element={<TransmissionView />} />
          <Route path="/history" element={<BacktestView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
