import type { BookmarkMarketData } from '@/services/bookmarks';

export type BookmarkSignalStateKey = 'improving' | 'turning' | 'cooling' | 'fading' | 'watch';

export interface BookmarkSignalState {
  key: BookmarkSignalStateKey;
  label: string;
  color: string;
  priority: number;
  explanation: string;
}

export function bookmarkSignalState(m: BookmarkMarketData | undefined): BookmarkSignalState {
  if (!m || m.magic_rs == null || m.score_5d == null || m.score_22d == null) {
    return { key: 'watch', label: 'Watch', color: 'var(--text-faint)', priority: 4, explanation: 'Signal data is incomplete.' };
  }
  const rsUp = m.magic_rs > 0;
  const flowUp = m.score_5d > m.score_22d;
  if (rsUp && flowUp) return { key: 'improving', label: 'Improving', color: 'var(--risk-green)', priority: 3, explanation: 'Relative strength and recent flow agree.' };
  if (!rsUp && flowUp) return { key: 'turning', label: 'Turning', color: 'color-mix(in srgb, var(--risk-green) 72%, transparent)', priority: 2, explanation: 'Recent flow is improving; relative strength has not confirmed.' };
  if (rsUp && !flowUp) return { key: 'cooling', label: 'Cooling', color: 'var(--risk-amber)', priority: 1, explanation: 'Relative strength remains positive, but recent flow is weakening.' };
  return { key: 'fading', label: 'Fading', color: 'var(--risk-red)', priority: 0, explanation: 'Relative strength and recent flow are both weak.' };
}
