import { create } from 'zustand';
import { useEffect } from 'react';
import type { MarketSymbol } from '@/types';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+5:30

function todayIso(): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10);
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
      const now = Date.now();
      const istNow = new Date(now + IST_OFFSET_MS);
      // Next IST midnight in UTC
      const nextISTMidnightUTC =
        Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + 1)
        - IST_OFFSET_MS;
      const msUntil = nextISTMidnightUTC - now;

      const id = setTimeout(() => {
        setDate(todayIso());
        scheduleNext();
      }, msUntil);

      return id;
    }

    const id = scheduleNext();
    return () => clearTimeout(id);
  }, [setDate]);
}
