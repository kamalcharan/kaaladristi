/**
 * Single-instance state for the per-stock "Ask VaNi" popover
 * (VaNiTrigger.tsx → StockAskPopover.tsx).
 *
 * Owner, 2026-09-03: multiple rows could each open their own popover
 * independently (every VaNiTrigger held its own local `anchor` state), and
 * the popover stayed pinned to the click point even after the page/table
 * scrolled, drifting away from the row it was actually about. Lifting the
 * "which stock, anchored to which element" state into one shared store lets
 * a single globally-mounted `<StockAskPopover />` (mounted once in
 * Layout.tsx, next to VaNiChatPanel) enforce both: opening a new one closes
 * whatever was open, and the popover can recompute its position from the
 * anchor element's LIVE bounding rect on every scroll/resize instead of a
 * one-time snapshot.
 */

import { create } from 'zustand';
import type { VaNiEntity } from './vaniStore';

interface StockAskState {
  entity: VaNiEntity | null;
  anchorEl: HTMLElement | null;
  isOpenFor: (entity: VaNiEntity) => boolean;
  open: (entity: VaNiEntity, anchorEl: HTMLElement) => void;
  close: () => void;
}

export const useStockAskStore = create<StockAskState>((set, get) => ({
  entity: null,
  anchorEl: null,
  isOpenFor: (entity) => {
    const active = get().entity;
    return !!active && active.type === entity.type && active.id === entity.id;
  },
  open: (entity, anchorEl) => set({ entity, anchorEl }),
  close: () => set({ entity: null, anchorEl: null }),
}));
