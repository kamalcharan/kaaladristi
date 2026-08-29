/**
 * ScanVaNiPublisher — invisible bridge between a scan results view and VaNi.
 *
 * Publishes the exact filtered result view the user is looking at into the
 * VaNi store so scanner intents can send it as display context, and the
 * gated stock-lookup flow can check membership before any LLM call.
 *
 * Rows are translated to the SEBI-safe on-screen vocabulary here
 * (zoneLabel/flowLabel) — DB values like raw magic_rs_zone never leave
 * the client toward the LLM.
 */

import { useEffect } from 'react';
import { useVaNiStore, type VaNiScanRow, type VaNiScanCohortStats } from '@/stores/vaniStore';
import { zoneLabel, flowLabel } from '@/constants/signalScale';
import { displaySymbol } from '@/lib/symbolUtils';
import type { ScanStock, ScanDefinition } from '@/types';

const MAX_ROWS = 25;

export function toVaNiScanRows(stocks: ScanStock[], hideVani: boolean): VaNiScanRow[] {
  return stocks.slice(0, MAX_ROWS).map((s) => ({
    equityId: s.equity_id,
    symbol: displaySymbol(s),
    company: s.company_name ?? null,
    industry: s.industry ?? null,
    zone: s.magic_rs_zone ? zoneLabel(s.magic_rs_zone).label : null,
    flow: s.flow_type ? flowLabel(s.flow_type).label : null,
    rsi: s.rsi_14 ?? null,
    rvol: s.rvol ?? null,
    pctChng: s.pct_chng ?? null,
    surge: s.delivery_surge_x ?? null,
    vani: hideVani ? false : !!s.vaniOpportunity,
  }));
}

export default function ScanVaNiPublisher({
  preset,
  timeframe,
  exchange,
  stocks,
  isLoading = false,
  cohortStats = null,
}: {
  preset: ScanDefinition;
  timeframe: string;
  exchange: string;
  stocks: ScanStock[];
  /** While the scan query is in flight, no context is published — an
   *  unsettled list must never be narrated as "today's results". */
  isLoading?: boolean;
  /** Tier A cohort facts (see VaNiScanCohortStats) — computed over the full
   *  unfiltered result set, independent of `stocks` (the filtered view).
   *  Omit to keep the old sample-derived narration for this page. */
  cohortStats?: VaNiScanCohortStats | null;
}) {
  const setScanContext = useVaNiStore((s) => s.setScanContext);
  const clearScanContext = useVaNiStore((s) => s.clearScanContext);

  useEffect(() => {
    if (isLoading) {
      clearScanContext();
      return;
    }
    const hideVani = preset.vani_rule === 'always_true';
    setScanContext({
      presetId: preset.id,
      presetName: preset.name,
      timeframe,
      exchange,
      totalCount: stocks.length,
      rows: toVaNiScanRows(stocks, hideVani),
      cohortStats: hideVani ? null : cohortStats,
    });
    return () => clearScanContext();
  }, [preset.id, preset.name, preset.vani_rule, timeframe, exchange, stocks, isLoading, cohortStats, setScanContext, clearScanContext]);

  return null;
}
