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

export interface VaNiEntity {
  type: 'equity' | 'index';
  id: number;
  symbol: string;
  pageContext?: string;
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

export interface VaNiScanContext {
  presetId: string;
  presetName: string;
  timeframe: string;
  exchange: string;
  totalCount: number;
  rows: VaNiScanRow[]; // capped at 25
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
