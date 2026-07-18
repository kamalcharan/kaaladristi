/**
 * Bookmarks — "My Bookmarks" per-user saved stock list.
 * Talks to /api/bookmarks/{user_id} (pipeline2_api.py), the same
 * JWT-secured FastAPI pattern used by the Framework system
 * (stores/frameworkStore.ts) — not direct PostgREST/RLS.
 */

import { useAuthStore } from '@/stores/authStore';
import { from } from '@/services/postgrest';
import { SECTOR_TAB_CATEGORIES } from '@/services/sectorRotation';

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
  // Position (Phase 2a, migration 153) — a bookmark WITH an entry is a held
  // position; null entry_price = watchlist-only.
  entry_price: number | null;
  entry_date: string | null;
  entry_qty: number | null;
}

export interface PositionEntry {
  entry_price: number | null;
  entry_date: string | null;
  entry_qty: number | null;
}

/** Set (or clear, with null entry_price) a position on a stock — creates the
 *  bookmark row if needed. Returns the full joined bookmark row. */
export async function setPosition(
  userId: string,
  equityId: number,
  entry: PositionEntry,
): Promise<BookmarkRow> {
  const res = await fetch(`${pipelineUrl}/api/bookmarks/${userId}/${equityId}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
}

export interface BookmarkMarketData {
  close: number | null;
  pct_chng: number | null;
  /** Latest-bar signal snapshot (= last5[0], surfaced for the row columns). */
  rsi_14: number | null;
  magic_rs: number | null;
  magic_rs_zone: string | null;
  score_5d: number | null;
  score_22d: number | null;
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
    .select('equity_id,trade_date,close,pct_chng,value_cr,ret_5d,ret_22d,score_5d,score_22d,rsi_14,magic_rs,magic_rs_zone')
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
    const latest = last5[0];
    result.set(equityId, {
      close: latest?.close ?? null,
      pct_chng: latest?.pct_chng ?? null,
      rsi_14: latest?.rsi_14 ?? null,
      magic_rs: latest?.magic_rs ?? null,
      magic_rs_zone: latest?.magic_rs_zone ?? null,
      score_5d: latest?.score_5d ?? null,
      score_22d: latest?.score_22d ?? null,
      last5,
    });
  }

  return result;
}

// ── Sector membership (batched) ─────────────────────────────────────────────
// A stock's sector = the sectoral-category index it belongs to, via
// km_equity_symbols.index_names[] (the solidified Sector path — same source
// SectorMembershipCard uses). Returns the matched sector index {id,name} so
// the row can link to /sector-rotation/:id and pull that sector's live signal
// from Sector Pulse. Batched: two queries for the whole bookmark list, not
// per-stock. A stock can sit in several sectoral indices — we surface the
// first (name-sorted) for the compact column.

export interface BookmarkSector {
  id: number;
  name: string;
}

export async function fetchBookmarkSectors(
  equityIds: number[],
): Promise<Map<number, BookmarkSector[]>> {
  const result = new Map<number, BookmarkSector[]>();
  if (equityIds.length === 0) return result;

  const [symRes, idxRes] = await Promise.all([
    from('km_equity_symbols').select('id,index_names').in('id', equityIds).execute(),
    from('km_index_symbols').select('id,name,category').is('is_active', 'true').execute(),
  ]);
  if (symRes.error || idxRes.error) return result;

  const sectoralCats = new Set(SECTOR_TAB_CATEGORIES.sectoral);
  const sectoralByName = new Map<string, BookmarkSector>();
  for (const i of (idxRes.data ?? []) as { id: number; name: string; category: string }[]) {
    if (sectoralCats.has(i.category)) sectoralByName.set(i.name.toUpperCase(), { id: i.id, name: i.name });
  }

  for (const s of (symRes.data ?? []) as { id: number; index_names: string[] | null }[]) {
    const secs: BookmarkSector[] = [];
    const seen = new Set<number>();
    for (const n of (s.index_names ?? []).slice().sort((a, b) => a.localeCompare(b))) {
      const sec = sectoralByName.get(n.toUpperCase());
      if (sec && !seen.has(sec.id)) { seen.add(sec.id); secs.push(sec); }
    }
    if (secs.length) result.set(s.id, secs);
  }

  return result;
}
