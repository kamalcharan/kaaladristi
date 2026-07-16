/**
 * Bookmarks — "My Bookmarks" per-user saved stock list.
 * Talks to /api/bookmarks/{user_id} (pipeline2_api.py), the same
 * JWT-secured FastAPI pattern used by the Framework system
 * (stores/frameworkStore.ts) — not direct PostgREST/RLS.
 */

import { useAuthStore } from '@/stores/authStore';
import { from } from '@/services/postgrest';

const pipelineUrl = (import.meta.env.VITE_PIPELINE_API_URL as string) ?? '';

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface BookmarkRow {
  id: string;
  equity_id: number;
  symbol: string;
  company_name: string | null;
  industry: string | null;
  exchange: string | null;
  created_at: string;
}

export async function fetchBookmarks(userId: string): Promise<BookmarkRow[]> {
  const res = await fetch(`${pipelineUrl}/api/bookmarks/${userId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function addBookmark(userId: string, equityId: number): Promise<BookmarkRow> {
  const res = await fetch(`${pipelineUrl}/api/bookmarks/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ equity_id: equityId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function removeBookmark(userId: string, equityId: number): Promise<void> {
  const res = await fetch(`${pipelineUrl}/api/bookmarks/${userId}/${equityId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Market data for bookmarked stocks ───────────────────────────────────────
// Scoped fetcher, not the full-market scan bundle — My Bookmarks may be the
// first page a user opens in a session, and loading the ~8000-symbol bundle
// just to read a handful of bookmarked rows would be wasteful. Gated on
// ema_20 (indicator-complete), same rationale as resolveConfirmedLatestDate
// in scanEngine.ts — a plain max(trade_date) can surface a mid-pipeline row.
//
// Selects the same columns FlowIntensityMap's CellData needs (see
// components/domain/FlowIntensityMap.tsx) so the 5D heatmap section reuses
// that existing component directly instead of a bespoke one.

export interface BookmarkEodRow {
  trade_date: string;
  close: number | null;
  pct_chng: number | null;
  value_cr: number | null;
  ret_5d: number | null;
  ret_22d: number | null;
  score_5d: number | null;
  score_22d: number | null;
}

export interface BookmarkMarketData {
  close: number | null;
  pct_chng: number | null;
  /** Last up to 5 trading days, newest first — feeds FlowIntensityMap directly. */
  last5: BookmarkEodRow[];
}

export async function fetchBookmarkMarketData(
  equityIds: number[],
): Promise<Map<number, BookmarkMarketData>> {
  const result = new Map<number, BookmarkMarketData>();
  if (equityIds.length === 0) return result;

  const { data: dateRows } = await from('km_equity_eod')
    .select('trade_date')
    .notNull('ema_20')
    .order('trade_date', { ascending: false })
    .limit(1)
    .execute();
  const latestDate = (dateRows as { trade_date: string }[] | null)?.[0]?.trade_date ?? null;
  if (!latestDate) return result;

  const cutoff = new Date(new Date(latestDate).getTime() - 12 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const { data } = await from('km_equity_eod')
    .select('equity_id,trade_date,close,pct_chng,value_cr,ret_5d,ret_22d,score_5d,score_22d')
    .in('equity_id', equityIds)
    .gte('trade_date', cutoff)
    .lte('trade_date', latestDate)
    .order('trade_date', { ascending: false })
    .limit(equityIds.length * 10)
    .execute();

  const rows = (data ?? []) as Array<BookmarkEodRow & { equity_id: number }>;
  const byEquity = new Map<number, typeof rows>();
  for (const r of rows) {
    const arr = byEquity.get(r.equity_id) ?? [];
    arr.push(r);
    byEquity.set(r.equity_id, arr);
  }

  for (const [equityId, arr] of byEquity) {
    const last5 = arr.slice(0, 5);
    result.set(equityId, {
      close: last5[0]?.close ?? null,
      pct_chng: last5[0]?.pct_chng ?? null,
      last5,
    });
  }

  return result;
}
