import { useMemo } from 'react';
import { useMarketBreadth, useBreadthRoc } from '@/hooks/useDashboardExtras';
import { useIndexChart } from '@/hooks/useEodData';
import { useMarketStructureStore } from '@/stores/marketStructureStore';
import type { MarketBreadthDay, BreadthRocDay } from '@/types';

import { structureSnapshot } from '@/lib/structureSnapshot';

export function useMarketStructureReading() {
  // Five extra sessions make coverage comparisons stable at the window edge.
  const b = useMarketBreadth(71);
  const r = useBreadthRoc(71);
  const nifty = useIndexChart('NIFTY', '1Y');
  const { period, selectedDate } = useMarketStructureStore();
  const breadth = useMemo(() => [...(b.data ?? [])].sort((a, z) => a.trade_date.localeCompare(z.trade_date))
    .filter(v => !selectedDate || v.trade_date <= selectedDate).slice(-period), [b.data, period, selectedDate]);
  const roc = useMemo(() => [...(r.data ?? [])].sort((a, z) => a.trade_date.localeCompare(z.trade_date))
    .filter(v => !selectedDate || v.trade_date <= selectedDate).slice(-period), [r.data, period, selectedDate]);
  const snapshot = useMemo(() => structureSnapshot(breadth, roc), [breadth, roc]);
  const coverageContext = useMemo(() => [...(b.data ?? [])].sort((a, z) => a.trade_date.localeCompare(z.trade_date)), [b.data]);
  const rocCoverageContext = useMemo(() => [...(r.data ?? [])].sort((a, z) => a.trade_date.localeCompare(z.trade_date)), [r.data]);
  return { breadth, roc, snapshot, period, selectedDate, coverageContext, rocCoverageContext,
    niftyData: nifty.data?.chartData ?? [],
    breadthDate: breadth.at(-1)?.trade_date, rocDate: roc.at(-1)?.trade_date,
    isLoading: b.isLoading || r.isLoading, isError: b.isError || r.isError,
    refresh: () => Promise.all([b.refetch(), r.refetch()]),
  };
}
