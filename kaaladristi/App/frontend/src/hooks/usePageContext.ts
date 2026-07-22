/**
 * Detects the current page context for VaNi intent routing.
 * Maps React Router paths to VaNi page identifiers.
 */

import { useLocation, useParams } from 'react-router-dom';
import type { VaNiPage } from '@/config/vaniIntents';

export interface PageContext {
  page: VaNiPage;
  entityType?: 'stock' | 'index' | 'industry';
  entityId?: string;
}

const PATH_MAP: Array<{ pattern: RegExp; page: VaNiPage; entityType?: PageContext['entityType'] }> = [
  { pattern: /^\/chart\/equity\/(\d+)/, page: 'equity_vp', entityType: 'stock' },
  { pattern: /^\/chart\/index\/(\d+)/, page: 'index_vp', entityType: 'index' },
  { pattern: /^\/pulse\/equity\/(\d+)/, page: 'equity_vp', entityType: 'stock' },
  { pattern: /^\/pulse\/(\d+)/, page: 'index_vp', entityType: 'index' },
  { pattern: /^\/industry-transition/, page: 'industry_transition' },
  { pattern: /^\/scanner/, page: 'scanner' },
  { pattern: /^\/manipulation-watch/, page: 'manipulation_watch' },
  { pattern: /^\/astro-calendar/, page: 'astro_calendar' },
  // My Space had NO entry — the global "Ask VaNi" button silently fell back
  // to 'dashboard' there, showing generic questions instead of the Mercury
  // story ribbon's own intent (owner 2026-07-22: local ribbon and global
  // button must coordinate on the same intents). Mapped to 'index_vp' —
  // same intent set as an index chart — because the Mercury reading is
  // universal (the sky's state, not tied to which instrument is pinned),
  // so it's correct here even when My Space happens to show an equity block.
  { pattern: /^\/workspace/, page: 'index_vp' },
];

export function usePageContext(): PageContext {
  const location = useLocation();
  const params = useParams();
  const path = location.pathname;

  for (const entry of PATH_MAP) {
    const match = path.match(entry.pattern);
    if (match) {
      return {
        page: entry.page,
        entityType: entry.entityType,
        entityId: match[1] || params.indexId || params.equityId,
      };
    }
  }

  return { page: 'dashboard' };
}
