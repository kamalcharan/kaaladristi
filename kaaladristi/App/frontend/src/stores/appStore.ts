import { create } from 'zustand';
import type { MarketSymbol } from '@/types';

/** Roll back to the last weekday (Mon-Fri). Sat→Fri, Sun→Fri. */
function lastTradingDay(d: Date = new Date()): string {
  const day = d.getDay(); // 0=Sun, 6=Sat
  if (day === 0) d.setDate(d.getDate() - 2); // Sun → Fri
  else if (day === 6) d.setDate(d.getDate() - 1); // Sat → Fri
  return d.toISOString().split('T')[0];
}

interface AppState {
  selectedSymbol: MarketSymbol;
  selectedDate: string;
  setSymbol: (symbol: MarketSymbol) => void;
  setDate: (date: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSymbol: 'NIFTY',
  selectedDate: lastTradingDay(),
  setSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setDate: (date) => set({ selectedDate: lastTradingDay(new Date(date + 'T12:00:00')) }),
}));
