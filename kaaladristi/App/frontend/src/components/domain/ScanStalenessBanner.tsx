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
import { useScanReadyDate } from '@/hooks/useScan';
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
  const { data: readyDate } = useScanReadyDate();
  const rowDate = mostCommonTradeDate(stocks);

  if (!rowDate || !latestDataDate) return null;

  // Two different situations used to render the same message, and one of them
  // was a lie. The daily run marks km_trading_calendar 'completed' at step 2
  // of 38, so between ~18:02 and the end of the run latestDataDate is a date
  // whose indicators do not exist yet. Telling the owner "newer data is
  // available, refresh the page" there sends them to reload a page that
  // cannot improve — the data is mid-computation, not mis-cached.
  const stillProcessing = readyDate != null && latestDataDate > readyDate;

  if (stillProcessing && rowDate >= readyDate) {
    return (
      <Note tone="neutral">
        Showing <strong>{rowDate}</strong> — the latest fully processed session.
        {' '}{latestDataDate}&apos;s prices have landed and its indicators are still computing.
      </Note>
    );
  }

  // Genuine staleness: rows older than what IS ready. A caching edge case or a
  // slow retry — refreshing really does fix this one.
  const target = readyDate ?? latestDataDate;
  if (rowDate >= target) return null;

  return (
    <Note tone="warn">
      Showing results from <strong>{rowDate}</strong> — newer data ({target}) is available.
      Refresh the page to update.
    </Note>
  );
}

function Note({ tone, children }: { tone: 'warn' | 'neutral'; children: React.ReactNode }) {
  const accent = tone === 'warn' ? 'var(--risk-amber)' : 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', marginBottom: 14, borderRadius: 10,
      background: `color-mix(in srgb, ${accent} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
    }}>
      <span style={{ fontSize: 14 }}>{tone === 'warn' ? '⚠' : '⏳'}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{children}</span>
    </div>
  );
}
