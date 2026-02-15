/**
 * Edge Function client for Kāla-Drishti.
 *
 * All high-traffic data flows through Edge Functions (cached, rate-limited).
 * Direct Supabase queries are only used for low-traffic operations
 * (master data, auth, admin).
 */

import type {
  MarketSymbol,
  DailySnapshot,
  CalendarMonth,
  EodChartResponse,
  ProofsResponse,
  TimeRange,
} from '@/types';
import { subMonths, subYears, format } from 'date-fns';

// Derive edge URL from Supabase URL if VITE_EDGE_FUNCTIONS_URL is not set
// (e.g. after .env was removed from git tracking)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const EDGE_URL =
  import.meta.env.VITE_EDGE_FUNCTIONS_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!EDGE_URL) {
  console.error('[Kala-Drishti] Edge Functions URL not configured. Set VITE_EDGE_FUNCTIONS_URL or VITE_SUPABASE_URL in .env');
}
if (!ANON_KEY) {
  console.error('[Kala-Drishti] Supabase anon key not configured. Set VITE_SUPABASE_ANON_KEY in .env');
}

/**
 * Shared fetch wrapper for edge functions.
 * Adds auth header (anon key) and handles errors.
 */
async function edgeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${EDGE_URL}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Edge ${path}] ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Snapshot (Dashboard) ──

export async function fetchSnapshot(date: string, symbol: MarketSymbol): Promise<DailySnapshot> {
  return edgeFetch<DailySnapshot>('snapshot', { date, symbol });
}

// ── Calendar ──

export async function fetchCalendarMonth(
  year: number,
  month: number,
  symbol: MarketSymbol,
): Promise<CalendarMonth> {
  return edgeFetch<CalendarMonth>('calendar', {
    year: String(year),
    month: String(month),
    symbol,
  });
}

// ── EOD Chart ──

function getStartDate(range: TimeRange): string | null {
  const now = new Date();
  switch (range) {
    case '1M':  return format(subMonths(now, 1), 'yyyy-MM-dd');
    case '3M':  return format(subMonths(now, 3), 'yyyy-MM-dd');
    case '6M':  return format(subMonths(now, 6), 'yyyy-MM-dd');
    case '1Y':  return format(subYears(now, 1), 'yyyy-MM-dd');
    case '5Y':  return format(subYears(now, 5), 'yyyy-MM-dd');
    case 'MAX': return null;
  }
}

export async function fetchEodChart(
  symbol: MarketSymbol,
  range: TimeRange,
  maxPoints = 500,
): Promise<EodChartResponse> {
  const from = getStartDate(range);
  const to = format(new Date(), 'yyyy-MM-dd');

  return edgeFetch<EodChartResponse>('eod-chart', {
    symbol,
    from: from || '',
    to,
    max_points: String(maxPoints),
  });
}

// ── Historical Proofs ──

export async function fetchProofs(
  symbol: MarketSymbol,
  limit = 20,
  regime?: string,
): Promise<ProofsResponse> {
  const params: Record<string, string> = { symbol, limit: String(limit) };
  if (regime) params.regime = regime;
  return edgeFetch<ProofsResponse>('proofs', params);
}
