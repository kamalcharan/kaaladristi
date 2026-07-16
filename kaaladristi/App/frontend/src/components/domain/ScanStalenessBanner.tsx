/**
 * ScanStalenessBanner — visible cross-check between a scan's own row dates
 * and the pipeline's confirmed latest data date.
 *
 * The primary fix for stale scan results is cache-key hygiene (useScan now
 * keys on the pipeline-confirmed date — see hooks/useScan.ts). This banner
 * is the second, visible layer: if some other path still serves an older
 * date's rows (a caching edge case, a slow network retry, anything we
 * haven't anticipated), the user sees it immediately instead of silently
 * trading on stale signals. Never let stale data look identical to fresh
 * data — that gap is what caused real confusion (a scan row showing a
 * 2-day-old close/breakout-level with no indication it wasn't today's).
 */

import { usePipelineStatus } from '@/hooks/usePipelineStatus';
import type { ScanStock } from '@/types';

function mostCommonTradeDate(stocks: ScanStock[]): string | null {
  const counts = new Map<string, number>();
  for (const s of stocks) {
    if (!s.trade_date) continue;
    counts.set(s.trade_date, (counts.get(s.trade_date) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [d, c] of counts) {
    if (c > bestCount) { best = d; bestCount = c; }
  }
  return best;
}

export default function ScanStalenessBanner({ stocks }: { stocks: ScanStock[] }) {
  const { latestDataDate } = usePipelineStatus();
  const rowDate = mostCommonTradeDate(stocks);

  if (!rowDate || !latestDataDate || rowDate >= latestDataDate) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', marginBottom: 14, borderRadius: 10,
      background: 'color-mix(in srgb, var(--risk-amber) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--risk-amber) 40%, transparent)',
    }}>
      <span style={{ fontSize: 14 }}>⚠</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
        Showing results from <strong>{rowDate}</strong> — newer data ({latestDataDate}) is available.
        Refresh the page to update.
      </span>
    </div>
  );
}
