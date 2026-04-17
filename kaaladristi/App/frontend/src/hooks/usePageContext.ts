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
  { pattern: /^\/scan/, page: 'scanner' },
  { pattern: /^\/manipulation-watch/, page: 'manipulation_watch' },
  { pattern: /^\/astro-calendar/, page: 'astro_calendar' },
  { pattern: /^\/dashboard/, page: 'dashboard' },
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
