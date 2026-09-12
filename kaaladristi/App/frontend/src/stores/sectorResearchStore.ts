import { create } from 'zustand';
import type { SectorTab } from '@/services/sectorRotation';

export const useSectorResearchStore = create<{
  mode?: 'current' | 'leadership'; months?: 3 | 6 | 12; scope: string; date?: string; category: SectorTab; period: 5 | 22 | 66;
  setContext: (context: { mode?: 'current' | 'leadership'; months?: 3 | 6 | 12; scope: string; date?: string; category?: SectorTab; period?: 5 | 22 | 66 }) => void;
}>((set) => ({ scope: '', category: 'sectoral', period: 22, setContext: context => set(context) }));
