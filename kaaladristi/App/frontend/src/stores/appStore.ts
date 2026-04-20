import { create } from 'zustand';
import { useEffect } from 'react';
import type { MarketSymbol } from '@/types';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

interface AppState {
  selectedSymbol: MarketSymbol;
  selectedDate: string;
  setSymbol: (symbol: MarketSymbol) => void;
  setDate: (date: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSymbol: 'NIFTY',
  selectedDate: todayIso(),
  setSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setDate: (date) => set({ selectedDate: date }),
}));

/** Call once at app root — advances selectedDate automatically at midnight */
export function useMidnightDateRefresh() {
  const setDate = useAppStore((s) => s.setDate);

  useEffect(() => {
    function scheduleNext() {
      const now = new Date();
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();

      const id = setTimeout(() => {
        setDate(todayIso());
        scheduleNext();
      }, msUntilMidnight);

      return id;
    }

    const id = scheduleNext();
    return () => clearTimeout(id);
  }, [setDate]);
}
