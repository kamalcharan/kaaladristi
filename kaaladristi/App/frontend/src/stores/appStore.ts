import { create } from 'zustand';
import type { MarketSymbol } from '@/types';

interface AppState {
  selectedSymbol: MarketSymbol;
  selectedDate: string;
  setSymbol: (symbol: MarketSymbol) => void;
  setDate: (date: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSymbol: 'NIFTY',
  selectedDate: new Date().toISOString().split('T')[0],
  setSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setDate: (date) => set({ selectedDate: date }),
}));
