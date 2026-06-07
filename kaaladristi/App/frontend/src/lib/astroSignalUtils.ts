import { SIGNAL_LABELS, type MarketImpact } from '@/constants/signalScale';

export type NetSignal =
  | 'strong_bullish' | 'bullish' | 'mild_bullish' | 'neutral'
  | 'turning' | 'mild_bearish' | 'bearish' | 'strong_bearish';

export const SIGNAL_COLORS: Record<NetSignal, { bg: string; text: string }> = {
  strong_bullish: { bg: '#0a5c2e', text: '#ffffff' },
  bullish:        { bg: '#1a8a4a', text: '#ffffff' },
  mild_bullish:   { bg: '#d4edda', text: '#1a8a4a' },
  neutral:        { bg: '#6c757d', text: '#ffffff' },
  turning:        { bg: '#f0a500', text: '#ffffff' },
  mild_bearish:   { bg: '#f8d7da', text: '#c0392b' },
  bearish:        { bg: '#c0392b', text: '#ffffff' },
  strong_bearish: { bg: '#7b1c1c', text: '#ffffff' },
};

export { SIGNAL_LABELS };

export function formatScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export function formatTradeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day  = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const date = dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${day} ${date}`;
}

export function signalColor(netSignal: string): { bg: string; text: string } {
  return SIGNAL_COLORS[netSignal as NetSignal] ?? SIGNAL_COLORS.neutral;
}

export function signalLabel(netSignal: string): string {
  return SIGNAL_LABELS[netSignal as MarketImpact] ?? netSignal;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
