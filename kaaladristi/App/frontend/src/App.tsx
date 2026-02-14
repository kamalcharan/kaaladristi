import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/domain/Layout';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/markets" element={<MarketsView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/transmission" element={<TransmissionView />} />
            <Route path="/history" element={<BacktestView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
