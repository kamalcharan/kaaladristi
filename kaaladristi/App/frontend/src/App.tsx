import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
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
  const { isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-kd-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
