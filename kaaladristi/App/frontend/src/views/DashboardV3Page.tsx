import DashboardV3View from './DashboardV3View';
import { BetaWelcomeModal } from '@/components/ui';

export default function DashboardV3Page() {
  return (
    <>
      <BetaWelcomeModal />
      <DashboardV3View />
    </>
  );
}
