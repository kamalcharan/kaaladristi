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

// The daily pipeline enqueues at 18:00 IST (pipeline2/scheduler.py
// _enqueue_daily_run) — nothing runs for "today" before that. Before 18:00,
// yesterday's close being the latest data is the CORRECT, complete state,
// not something "processing" — daysOld===1 all morning/afternoon is normal,
// not pending. Bug found live 2026-07-22 10:06 IST: the badge said
// "processing" for 21-Jul at 10 AM even though 21-Jul's own pipeline had
// completed the previous evening — nothing was actually running.
const DAILY_RUN_IST_HOUR = 18;

function istHourNow(): number {
  // en-US hourly format in Asia/Kolkata, independent of the browser's
  // local timezone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  return Number(parts.find(p => p.type === 'hour')?.value ?? 0);
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
  } else if (daysOld === 1 && !isWeekendToday && istHourNow() < DAILY_RUN_IST_HOUR) {
    // 1 day old, before 18:00 IST — the LAST SESSION's data is the correct,
    // complete state; today's pipeline hasn't been enqueued yet, so nothing
    // is "pending" or "processing". Reads as current, not a freshness warning.
    isCurrent = true;
    isPendingToday = false;
    status = 'current';
  } else if (daysOld === 1 && !isWeekendToday) {
    // 1 day old, 18:00 IST or later — today's pipeline is enqueued/running
    // and hasn't landed yet. This is the genuine "processing" window.
    isCurrent = false;
    isPendingToday = true;
    status = 'pending';
  } else if (daysOld <= 2 && isWeekendToday) {
    // Weekend: Friday's data is current
    isCurrent = true;
    isPendingToday = false;
    status = 'current';
  } else if (daysOld <= 3 && now.getDay() === 1 && istHourNow() < DAILY_RUN_IST_HOUR) {
    // Monday before 18:00 IST: Friday's data (weekend gap) is still the
    // correct, complete reference — same "not pending until 18:00" rule.
    isCurrent = true;
    isPendingToday = false;
    status = 'current';
  } else if (daysOld <= 3 && now.getDay() === 1) {
    // Monday, 18:00 IST or later: Friday's data is 3 days old but that's
    // normal (weekend gap) — today's Monday pipeline is now the pending one.
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
