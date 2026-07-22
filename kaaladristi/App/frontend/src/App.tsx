import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMidnightDateRefresh } from '@/stores/appStore';
import { ErrorBoundary } from '@/components/ui';
import Layout from '@/components/domain/Layout';
import ProtectedRoute from '@/components/domain/ProtectedRoute';
import LandingPage from '@/views/LandingPage';
import LoginPage from '@/views/LoginPage';
import ProfileSetup from '@/views/ProfileSetup';
import MarketsView from '@/views/MarketsView';
import SettingsView from '@/views/SettingsView';
import InferenceView from '@/views/InferenceView';
import RuleEvalView from '@/views/RuleEvalView';
import CalendarView from '@/views/CalendarView';
import AlmanacPage from '@/views/AlmanacPage';
import ChartView from '@/views/ChartView';
import { VisualPulsePage } from '@/components/domain/VisualPulse';
import { EquityVisualPulsePage } from '@/components/domain/VisualPulse/equity';
import { IntradayPage } from '@/components/domain/Intraday';
import ScanView from '@/views/ScanView';
import MyBookmarksPage from '@/views/MyBookmarksPage';
import ManipulationWatchView from '@/views/ManipulationWatchView';
import IndustryTransitionView from '@/views/IndustryTransitionView';
import DataPipelinePage from '@/pages/DataPipeline';
import PanchangView from '@/views/PanchangView';
import AdminPanchangView from '@/views/AdminPanchangView';
import UsersView from '@/views/UsersView';
import { RuleList, RuleDetail } from '@/pages/RuleEngine';
import MarketStructureView from '@/views/MarketStructureView';
import PlanetaryIntelView from '@/views/PlanetaryIntelView';
import WorkspacePage from '@/views/WorkspacePage'
import CatalogPage from '@/views/CatalogPage';
import PricingPage from '@/views/PricingPage'
import AccountPage from '@/views/AccountPage';
import CorrelationPage from '@/views/CorrelationPage';
import SectorRotationPage from '@/views/SectorRotationPage';
import IndexDetailPage from '@/views/IndexDetailPage';
import CustomIndexPage from '@/views/CustomIndexPage';
import CustomIndexCreatePage from '@/views/CustomIndexCreatePage';
import CustomIndexDiscoverPage from '@/views/CustomIndexDiscoverPage';
import CustomIndexManagePage from '@/views/CustomIndexManagePage';

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
  useMidnightDateRefresh();

  useEffect(() => {
    initialize().catch((err) => {
      console.error('[App] Auth initialization failed:', err);
    });
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-kd-bg flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="text-sm text-muted">Connecting to DristiQ...</p>
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
          <p className="text-xs text-muted bg-kd-card border border-white/5 rounded-xl p-3 mb-6 mono">
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
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated but not yet onboarded */}
      <Route element={<ProtectedRoute requireOnboarded={false} />}>
        <Route path="/setup" element={<ProfileSetup />} />
      </Route>

      {/* Authenticated + onboarded: App shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/sector-rotation" element={<SectorRotationPage />} />
          <Route path="/sector-rotation/:indexId" element={<IndexDetailPage />} />
          <Route path="/correlation/:itemA/:itemB" element={<CorrelationPage />} />
          <Route path="/markets" element={<MarketsView />} />
          <Route path="/inference" element={<InferenceView />} />
          <Route path="/rule-eval" element={<RuleEvalView />} />
          <Route path="/astro-calendar" element={<CalendarView />} />
          <Route path="/almanac" element={<AlmanacPage />} />
          <Route path="/chart/:type/:id" element={<ChartView />} />
          <Route path="/pulse/:indexId" element={<VisualPulsePage />} />
          <Route path="/pulse/equity/:equityId" element={<EquityVisualPulsePage />} />
          <Route path="/intraday/:indexId" element={<IntradayPage />} />
          <Route path="/scan" element={<Navigate to="/scanner" replace />} />
          <Route path="/scanners" element={<Navigate to="/scanner" replace />} />
          <Route path="/scanners/:presetId" element={<ScanView />} />
          <Route path="/scanner" element={<ScanView />} />
          <Route path="/bookmarks" element={<MyBookmarksPage />} />
          <Route path="/scanner/:presetId" element={<ScanView />} />
          <Route path="/manipulation-watch" element={<ManipulationWatchView />} />
          <Route path="/industry-transition" element={<IndustryTransitionView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/data-pipeline" element={<DataPipelinePage />} />
          <Route path="/panchang" element={<PanchangView />} />
          <Route path="/admin/panchang" element={<AdminPanchangView />} />
          <Route path="/users" element={<UsersView />} />
          <Route path="/market-structure" element={<MarketStructureView />} />
          <Route path="/planetary-intel" element={<PlanetaryIntelView />} />
          <Route path="/rules" element={<RuleList />} />
          <Route path="/rules/:id" element={<RuleDetail />} />
          <Route path="/custom-index" element={<CustomIndexPage />} />
          <Route path="/custom-index/create" element={<CustomIndexCreatePage />} />
          <Route path="/custom-index/discover" element={<CustomIndexDiscoverPage />} />
          <Route path="/custom-index/:indexId/manage" element={<CustomIndexManagePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/account" element={<AccountPage />} />
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
