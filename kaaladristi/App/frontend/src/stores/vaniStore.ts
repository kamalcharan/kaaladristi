/**
 * VaNi state store — manages panel open/close + entity context.
 *
 * When opened from the header button: no entity, shows page intents only.
 * When opened from a stock card trigger: entity is set, shows equity intents.
 */

import { create } from 'zustand';

export interface VaNiEntity {
  type: 'equity' | 'index';
  id: number;
  symbol: string;
  pageContext?: string;
}

interface VaNiState {
  open: boolean;
  entity: VaNiEntity | null;
  toggle: () => void;
  openWithEntity: (entity: VaNiEntity) => void;
  close: () => void;
  clearEntity: () => void;
}

export const useVaNiStore = create<VaNiState>((set) => ({
  open: false,
  entity: null,
  toggle: () => set((s) => ({ open: !s.open, entity: s.open ? null : s.entity })),
  openWithEntity: (entity) => set({ open: true, entity }),
  close: () => set({ open: false, entity: null }),
  clearEntity: () => set({ entity: null }),
}));
