/**
 * useSetupData — Phase 4 data hook for the Scanner Story Page.
 *
 * Fetches raw data for one equity + hands it to the right per-preset
 * adapter → returns SetupData for ScannerArrivalView to render.
 *
 * Reads:
 *   · km_equity_weekly (5y window) for the annotated weekly chart
 *   · km_equity_eod (latest row) for pivots / SMAs / stage / RS pct
 *   · km_equity_symbols (identity) for symbol / exchange / industry
 *
 * See: docs/claude/scanner-story-page-poa.md
 */

import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import {
  getSetupAdapter,
  type SetupData,
  type WeeklyBar,
  type LatestEodRow,
  type EquityIdentity,
} from '@/services/thesis/setupAdapter';

// Ensure adapters register themselves before the first getSetupAdapter call.
import '@/services/thesis/adapters';

const WEEKLY_LOOKBACK_YEARS = 5;

// km_equity_weekly does NOT carry `stage` — the column lives on km_equity_eod.
// We fetch (trade_date, stage) from eod for the same 5-year window and stamp
// each weekly bar's stage from the eod row on that exact date (weekly bars
// are Friday-anchored, so a same-date lookup works for the vast majority;
// missing days fall through to the closest prior-week stage).
const WEEKLY_COLS = 'trade_date,open,high,low,close,volume,magic_rs,magic_rs_zone';
const STAGE_COLS  = 'trade_date,stage';
const LATEST_COLS = 'trade_date,close,pct_chng,pivot_pp,pivot_r1,pivot_r2,pivot_s1,pivot_s2,ema_20,sma_50,sma_150,w52_high,w52_low,stage,magic_rs,magic_rs_zone,rs_percentile,rvol,delivery_pct,accum_distrib,flow_type';
const SYMBOL_COLS = 'id,symbol,company_name,exchange,industry,isin,mcap_cr';

export interface UseSetupDataResult {
  data: SetupData | null;
  isLoading: boolean;
  error: Error | null;
  /** Raw weekly bars — exposed so the chart component can render them
   *  without a separate fetch. */
  weekly: WeeklyBar[];
}

export function useSetupData(equityId: number | null, setupKey: string | null): UseSetupDataResult {
  const q = useQuery({
    queryKey: ['setupData', equityId, setupKey],
    enabled: equityId != null && setupKey != null,
    queryFn: async () => {
      const id = equityId!;
      const key = setupKey!;

      const adapter = getSetupAdapter(key);
      if (!adapter) {
        throw new Error(`Unknown setup preset: "${key}". Add an adapter in services/thesis/adapters/index.ts.`);
      }

      const cutoffIso = new Date(Date.now() - WEEKLY_LOOKBACK_YEARS * 365 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);

      const [weeklyRes, latestRes, symbolRes, stageRes] = await Promise.all([
        from('km_equity_weekly')
          .select(WEEKLY_COLS)
          .eq('equity_id', id)
          .gte('trade_date', cutoffIso)
          .order('trade_date', { ascending: true })
          .limit(400)
          .execute(),
        from('km_equity_eod')
          .select(LATEST_COLS)
          .eq('equity_id', id)
          .order('trade_date', { ascending: false })
          .limit(1)
          .execute(),
        from('km_equity_symbols')
          .select(SYMBOL_COLS)
          .eq('id', id)
          .limit(1)
          .execute(),
        from('km_equity_eod')
          .select(STAGE_COLS)
          .eq('equity_id', id)
          .gte('trade_date', cutoffIso)
          .order('trade_date', { ascending: true })
          .limit(1500)
          .execute(),
      ]);

      if (weeklyRes.error) throw new Error(`weekly: ${weeklyRes.error.message}`);
      if (latestRes.error) throw new Error(`latest: ${latestRes.error.message}`);
      if (symbolRes.error) throw new Error(`symbol: ${symbolRes.error.message}`);
      if (stageRes.error)  throw new Error(`stage: ${stageRes.error.message}`);

      const weeklyRaw = (weeklyRes.data ?? []) as WeeklyBar[];
      const latest    = (latestRes.data ?? [])[0] as LatestEodRow | undefined;
      const identity  = (symbolRes.data ?? [])[0] as EquityIdentity | undefined;

      // Stage aggregation: for each weekly bar, pick the eod stage on that
      // trade_date if present, else carry the most recent prior-date stage
      // forward (weekly bars are Friday-anchored; a same-date row usually
      // exists but not always — non-trading Fridays are the exception).
      const stageRows = (stageRes.data ?? []) as Array<{ trade_date: string; stage: string | null }>;
      const stageByDate = new Map(stageRows.map((r) => [r.trade_date, r.stage] as const));
      const sortedStageDates = [...stageByDate.keys()].sort();
      const weekly: WeeklyBar[] = weeklyRaw.map((b) => {
        let s = stageByDate.get(b.trade_date) ?? null;
        if (s == null) {
          // fallback: nearest prior date's stage
          for (let i = sortedStageDates.length - 1; i >= 0; i--) {
            if (sortedStageDates[i] <= b.trade_date) {
              s = stageByDate.get(sortedStageDates[i]) ?? null;
              break;
            }
          }
        }
        return { ...b, stage: s };
      });

      if (!latest)   throw new Error('No latest EOD row for this equity.');
      if (!identity) throw new Error('No km_equity_symbols row for this equity.');

      const data = adapter(weekly, latest, identity);
      return { data, weekly };
    },
    staleTime: 5 * 60 * 1000,  // 5 min — daily-close data, doesn't move intraday
  });

  return {
    data:  q.data?.data ?? null,
    weekly: q.data?.weekly ?? [],
    isLoading: q.isLoading,
    error: q.error as Error | null,
  };
}
