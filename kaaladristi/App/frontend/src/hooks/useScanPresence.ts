/**
 * useScanPresence — Check which scans contain a specific stock
 * ==============================================================
 * Runs every ACTIVE scan preset (from the DB via fetchScanPresets —
 * kd_scan_presets is the source of truth; the static list is only the
 * offline fallback) and checks if the given equity_id appears in any of
 * them. Also reports whether the stock is a ✦ VaNi Highlight within each
 * matched scan (POA Phase 1.2).
 */

import { useQuery } from '@tanstack/react-query';
import { executeScan, fetchScanPresets, SCAN_PRESETS } from '@/services/scanEngine';
import type { ScanStock } from '@/types';

export interface MatchedScan {
  id: string;
  name: string;
  /** True when the stock is a ✦ VaNi Highlight inside this scan. */
  vani: boolean;
}

interface ScanPresenceResult {
  stock: ScanStock | null;
  matchedScans: MatchedScan[];
  isLoading: boolean;
}

async function computeScanPresence(
  equityId: number,
): Promise<{ stock: ScanStock | null; matchedScans: MatchedScan[] }> {
  const presets = await fetchScanPresets().catch(() => SCAN_PRESETS);

  const matched: MatchedScan[] = [];
  let foundStock: ScanStock | null = null;

  // Prime the shared bundle once, then fan out — parallel cold starts would
  // trigger concurrent full-market downloads (same guard as fetchVaniHighlights).
  if (presets.length > 0) await executeScan(presets[0].id, 'combined');

  const results = await Promise.allSettled(
    presets.map(async (preset) => {
      const stocks = await executeScan(preset.id, 'combined');
      const match = stocks.find((s) => s.equity_id === equityId);
      return { preset, match: match ?? null };
    }),
  );

  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    const { preset, match } = res.value;
    if (match) {
      // always_true presets flag every row — ✦ carries no information there,
      // so presence in the scan is reported without the highlight marker.
      const vani = preset.vani_rule === 'always_true' ? false : !!match.vaniOpportunity;
      matched.push({ id: preset.id, name: preset.name, vani });
      if (!foundStock) foundStock = match;
    }
  }

  // ✦ scans first — the strongest presence signal leads.
  matched.sort((a, b) => Number(b.vani) - Number(a.vani) || a.name.localeCompare(b.name));

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
