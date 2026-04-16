/**
 * useScanPresence — Check which scans contain a specific stock
 * ==============================================================
 * Runs all 6 scan presets and checks if the given equity_id
 * appears in any of them. Returns matching scan names.
 */

import { useQuery } from '@tanstack/react-query';
import { executeScan, SCAN_PRESETS } from '@/services/scanEngine';
import type { ScanStock } from '@/types';

interface ScanPresenceResult {
  stock: ScanStock | null;
  matchedScans: { id: string; name: string }[];
  isLoading: boolean;
}

async function computeScanPresence(
  equityId: number,
): Promise<{ stock: ScanStock | null; matchedScans: { id: string; name: string }[] }> {
  const matched: { id: string; name: string }[] = [];
  let foundStock: ScanStock | null = null;

  // Run all scans in parallel
  const results = await Promise.all(
    SCAN_PRESETS.map(async (preset) => {
      const stocks = await executeScan(preset.id, 'combined');
      const match = stocks.find((s) => s.equity_id === equityId);
      return { preset, match: match ?? null };
    }),
  );

  for (const { preset, match } of results) {
    if (match) {
      matched.push({ id: preset.id, name: preset.name });
      if (!foundStock) foundStock = match;
    }
  }

  return { stock: foundStock, matchedScans: matched };
}

export function useScanPresence(equityId: number | null): ScanPresenceResult {
  const query = useQuery({
    queryKey: ['scan-presence', equityId],
    queryFn: () => computeScanPresence(equityId!),
    staleTime: 3 * 60 * 1000, // 3 min (same as scan cache)
    enabled: !!equityId,
  });

  return {
    stock: query.data?.stock ?? null,
    matchedScans: query.data?.matchedScans ?? [],
    isLoading: query.isLoading,
  };
}
