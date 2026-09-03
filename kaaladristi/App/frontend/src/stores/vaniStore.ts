/**
 * VaNi state store — manages panel open/close + entity context.
 *
 * When opened from the header button: no entity, shows page intents only.
 * When opened from a stock card trigger: entity is set, shows equity intents.
 *
 * Scanner pages additionally publish a scan context (the exact filtered
 * result view the user is looking at) so scanner intents can send it as
 * display context to /api/vani/ask, and the gated stock-lookup flow can
 * check membership before any LLM call.
 */

import { create } from 'zustand';

/** Raw signal values for the line-item confirmation view (StockAskPopover) —
 *  optional because most VaNiEntity call sites (VaNiChatPanel's URL-derived
 *  entity, chart/pulse pages) don't have a scan row to read them from.
 *  When absent, the popover just skips the confirmation row and shows the
 *  VaNi answer alone, same as before this existed. */
export interface VaNiEntitySignals {
  close: number;
  pctChng: number | null;
  rvol: number | null;
  flowType: string | null;
  magicRsZone: string | null;
  deliveryPct: number | null;
}

export interface VaNiEntity {
  type: 'equity' | 'index';
  id: number;
  symbol: string;
  pageContext?: string;
  signals?: VaNiEntitySignals;
}

/** One visible scan result row, already translated to the SEBI-safe
 *  on-screen vocabulary (zone: Leading/Improving/…, flow: Fresh Longs/…). */
export interface VaNiScanRow {
  equityId: number;
  symbol: string;
  company: string | null;
  industry: string | null;
  zone: string | null;
  flow: string | null;
  rsi: number | null;
  rvol: number | null;
  pctChng: number | null;
  surge: number | null;
  vani: boolean;
}

/** Tier A (scannerenhancement.md) — precomputed facts over the FULL result
 *  set, not the capped 25-row sample below. Fixes the documented "25-of-270
 *  sample mismatch" narration failure: without this, scanner.read_results
 *  can only guess aggregate facts (VaNi highlight count, % accelerating…)
 *  from whatever happens to be in the visible sample. Optional — pages that
 *  don't compute it (every scanner except this Breakout Surge preview, so
 *  far) simply don't set it, and the backend falls back to the old
 *  sample-derived count. */
export interface VaNiScanCohortStats {
  vaniHighlightCount: number;
  acceleratingPct: number;
  realVolumePct: number;
  leadingIndustry: string | null;
  leadingIndustryCount: number | null;
}

export interface VaNiScanContext {
  presetId: string;
  presetName: string;
  timeframe: string;
  exchange: string;
  totalCount: number;
  rows: VaNiScanRow[]; // capped at 25
  cohortStats?: VaNiScanCohortStats | null;
}

interface VaNiState {
  open: boolean;
  entity: VaNiEntity | null;
  scanContext: VaNiScanContext | null;
  /** Intent to auto-fire when the panel opens (e.g. "✦ VaNi explains" link). */
  pendingIntentId: string | null;
  toggle: () => void;
  openWithEntity: (entity: VaNiEntity) => void;
  openWithIntent: (intentId: string) => void;
  consumePendingIntent: () => string | null;
  setScanContext: (ctx: VaNiScanContext) => void;
  clearScanContext: () => void;
  close: () => void;
  clearEntity: () => void;
}

export const useVaNiStore = create<VaNiState>((set, get) => ({
  open: false,
  entity: null,
  scanContext: null,
  pendingIntentId: null,
  toggle: () => set((s) => ({ open: !s.open, entity: s.open ? null : s.entity })),
  openWithEntity: (entity) => set({ open: true, entity }),
  openWithIntent: (intentId) => set({ open: true, pendingIntentId: intentId }),
  consumePendingIntent: () => {
    const id = get().pendingIntentId;
    if (id) set({ pendingIntentId: null });
    return id;
  },
  setScanContext: (scanContext) => set({ scanContext }),
  clearScanContext: () => set({ scanContext: null }),
  close: () => set({ open: false, entity: null, pendingIntentId: null }),
  clearEntity: () => set({ entity: null }),
}));
