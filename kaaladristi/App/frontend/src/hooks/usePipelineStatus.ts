/**
 * usePipelineStatus — Data freshness awareness hook
 * ====================================================
 * Queries the latest trade_date from km_industry_eod (representative
 * of full pipeline completion) and derives freshness status.
 *
 * Polls every 60 seconds. Any component can use this to determine
 * fallback dates or display data freshness.
 */

import { useQuery } from '@tanstack/react-query';
import { from } from '@/services/postgrest';
import { fmtDateLong, fmtDateShort } from '@/lib/dateUtils';

export type PipelineStatusLevel = 'current' | 'pending' | 'delayed' | 'stale';

export interface PipelineStatus {
  /** Most recent trade_date with completed pipeline data */
  latestDataDate: string | null;
  /** Formatted date string: "15 Apr 2026" */
  latestDataDateFormatted: string;
  /** Data is for today (or most recent trading day if weekend) */
  isCurrent: boolean;
  /** Data is 1 day old — today's pipeline likely running or not yet started */
  isPendingToday: boolean;
  /** Days since last successful pipeline run */
  daysOld: number;
  /** Summary status */
  status: PipelineStatusLevel;
  /** Whether the query is still loading */
  isLoading: boolean;
}

function formatDate(iso: string): string { return fmtDateLong(iso); }
function formatDateShort(iso: string): string { return fmtDateShort(iso); }

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Fetch the most recent trade_date from km_industry_eod.
 *
 *  No explicit indicator-completeness gate — none is needed as long as
 *  `industry_composites` stays the LAST step in DAILY_STEPS (see the same
 *  note in industryRotation.ts). This is also why the app-wide "data
 *  current/pending" pill is correctly conservative: it only flips to
 *  current once this final step's output lands. */
async function fetchLatestDataDate(): Promise<string | null> {
  const { data, error } = await from('km_industry_eod')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();

  if (error || !data || data.length === 0) return null;
  return (data[0] as { trade_date: string }).trade_date;
}

export function usePipelineStatus(): PipelineStatus {
  const { data: latestDate, isLoading } = useQuery({
    queryKey: ['pipeline-latest-date'],
    queryFn: fetchLatestDataDate,
    staleTime: 60_000,       // 1 min
    refetchInterval: 60_000, // poll every 60s
    retry: 1,
  });

  if (isLoading || !latestDate) {
    return {
      latestDataDate: null,
      latestDataDateFormatted: '',
      isCurrent: false,
      isPendingToday: false,
      daysOld: 0,
      status: 'pending',
      isLoading,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const daysOld = daysBetween(latestDate, today);

  // Account for weekends — if today is Saturday/Sunday, 1-2 days old is still "current"
  const now = new Date();
  const isWeekendToday = isWeekend(now);
  const isFriday = now.getDay() === 5;

  let isCurrent: boolean;
  let isPendingToday: boolean;
  let status: PipelineStatusLevel;

  if (daysOld === 0) {
    // Data is from today
    isCurrent = true;
    isPendingToday = false;
    status = 'current';
  } else if (daysOld === 1 && !isWeekendToday) {
    // 1 day old on a weekday — today's pipeline pending
    isCurrent = false;
    isPendingToday = true;
    status = 'pending';
  } else if (daysOld <= 2 && isWeekendToday) {
    // Weekend: Friday's data is current
    isCurrent = true;
    isPendingToday = false;
    status = 'current';
  } else if (daysOld <= 3 && now.getDay() === 1) {
    // Monday: Friday's data is 3 days old but that's normal (weekend gap)
    isCurrent = false;
    isPendingToday = true;
    status = 'pending';
  } else if (daysOld <= 3) {
    isCurrent = false;
    isPendingToday = false;
    status = 'delayed';
  } else {
    // 4+ days old — stale
    isCurrent = false;
    isPendingToday = false;
    status = 'stale';
  }

  return {
    latestDataDate: latestDate,
    latestDataDateFormatted: formatDate(latestDate),
    isCurrent,
    isPendingToday,
    daysOld,
    status,
    isLoading,
  };
}
