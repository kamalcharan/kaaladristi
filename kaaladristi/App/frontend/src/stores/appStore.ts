import { create } from 'zustand';
import { useEffect } from 'react';
import type { MarketSymbol } from '@/types';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+5:30

function todayIso(): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10);
}

function nextTradingDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  let dt = new Date(Date.UTC(y, m - 1, d + 1));
  // Skip Saturday (6) and Sunday (0)
  while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) {
    dt = new Date(dt.getTime() + 86400_000);
  }
  return dt.toISOString().slice(0, 10);
}

/** After 19:00 IST, return next Mon–Fri; otherwise return today (Mon–Fri aware). */
export function dashboardDate(): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const today = istNow.toISOString().slice(0, 10);
  const hourIST = istNow.getUTCHours(); // already shifted to IST
  const dow = istNow.getUTCDay();       // 0=Sun … 6=Sat

  // Weekends: always show next Mon
  if (dow === 0 || dow === 6) return nextTradingDay(today);

  // Weekday after 7 PM: show next trading day
  if (hourIST >= 19) return nextTradingDay(today);

  return today;
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
