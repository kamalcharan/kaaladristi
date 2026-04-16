import { useAppStore } from '@/stores/appStore';
import { useDayRisk, useHistoricalProofs } from '@/hooks';
import DashboardView from './DashboardView';
import type { DayRiskReport } from '@/types';

/** Fallback report when risk API is unavailable — dashboard still renders */
function makeFallbackReport(symbol: string, date: string): DayRiskReport {
  return {
    date,
    symbol: symbol as DayRiskReport['symbol'],
    riskScore: 0,
    regime: 'Unknown',
    explanation: '',
    factors: { structural: 0, momentum: 0, volatility: 0, deception: 0 },
    planetarySummary: 'Cycle data loading...',
    sectorImpacts: [],
  };
}

export default function DashboardPage() {
  const { selectedSymbol, selectedDate } = useAppStore();

  const dayRisk = useDayRisk(selectedDate, selectedSymbol);
  const proofs  = useHistoricalProofs(selectedSymbol);

  // Use real report if available, fallback if not (dashboard widgets still work)
  const report = dayRisk.data ?? makeFallbackReport(selectedSymbol, selectedDate);

  return (
    <DashboardView
      report={report}
      proofs={proofs.data ?? []}
    />
  );
}
