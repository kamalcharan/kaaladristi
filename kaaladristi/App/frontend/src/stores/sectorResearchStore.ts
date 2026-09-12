import { create } from 'zustand';
import type { SectorTab } from '@/services/sectorRotation';

export const useSectorResearchStore = create<{
  scope: string; date?: string; category: SectorTab; period: 5 | 22 | 66;
  setContext: (context: { scope: string; date?: string; category?: SectorTab; period?: 5 | 22 | 66 }) => void;
}>((set) => ({ scope: '', category: 'sectoral', period: 22, setContext: context => set(context) }));
