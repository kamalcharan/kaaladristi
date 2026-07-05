import DashboardV3View from './DashboardV3View';

// BetaWelcomeModal now mounts in ProtectedRoute (once per user, any protected
// page) — it no longer belongs to this route specifically.
export default function DashboardV3Page() {
  return <DashboardV3View />;
}
