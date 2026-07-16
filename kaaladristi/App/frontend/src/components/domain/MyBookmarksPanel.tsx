import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Loader2 } from 'lucide-react';
import { Card, DristiQLoader } from '@/components/ui';
import { displaySymbol, displaySubName, navName as toNavName, bseTooltip } from '@/lib/symbolUtils';
import { ExchangeBadge } from '@/components/domain/StockCard';
import FlowIntensityMap, { type CellData } from '@/components/domain/FlowIntensityMap';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useBookmarkMarketData } from '@/hooks/useBookmarks';
import { useScanPresenceForMany } from '@/hooks/useScanPresence';
import { useIndustryTransition } from '@/hooks/useIndustryRotation';
import type { TransitionCategory } from '@/services/industryRotation';
import type { BookmarkRow } from '@/services/bookmarks';

const SECTOR_STATUS_LABEL: Record<TransitionCategory, { label: string; color: string }> = {
  rotating_in:  { label: 'Rotating In',  color: 'var(--risk-green)' },
  leading:      { label: 'Leading',      color: 'var(--risk-green)' },
  rotating_out: { label: 'Fading',       color: 'var(--risk-red)' },
  stable:       { label: 'Stable',       color: 'var(--text-faint)' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

function BookmarkListRow({
  bookmark,
  sectorStatus,
  scanTags,
  market,
  onRemove,
}: {
  bookmark: BookmarkRow;
  sectorStatus: { label: string; color: string } | null;
  scanTags: string[];
  market: { close: number | null; pct_chng: number | null } | undefined;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const heroName = displaySymbol({ symbol: bookmark.symbol, company_name: bookmark.company_name });
  const subName = displaySubName({ symbol: bookmark.symbol, company_name: bookmark.company_name });
  const tooltip = bseTooltip({ symbol: bookmark.symbol, exchange: bookmark.exchange, isin: null });
  const pct = market?.pct_chng ?? null;

  return (
    <Card
      rounded="xxl"
      hover="lift"
      className="p-3 sm:p-4 cursor-pointer"
      title={tooltip ?? undefined}
      onClick={() => navigate(`/chart/equity/${bookmark.equity_id}?name=${encodeURIComponent(toNavName(bookmark))}`)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove bookmark"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
          }}
        >
          <Star className="w-3.5 h-3.5" style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />
        </button>

        <div style={{ minWidth: 0, width: 150, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {heroName}
            </span>
            <ExchangeBadge exchange={bookmark.exchange} />
          </div>
          {subName && (
            <div style={{ fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subName}
            </div>
          )}
        </div>

        <div style={{ width: 100, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
            {market?.close != null ? `₹${market.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
          </div>
          {pct != null && (
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: pct >= 0 ? 'var(--risk-green)' : 'var(--risk-red)' }}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
            </div>
          )}
        </div>

        <div style={{ width: 130, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bookmark.industry ?? '—'}
          </div>
          {sectorStatus && (
            <span style={{ fontSize: 10, fontWeight: 600, color: sectorStatus.color }}>
              {sectorStatus.label}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {scanTags.length === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>No active scanner match</span>
          ) : scanTags.map((t) => (
            <span key={t} style={{
              fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
              background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
              color: 'var(--accent-indigo)',
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * "My Bookmarks" content — the Workspace tab body (WorkspacePage.tsx).
 * Also reused standalone by views/MyBookmarksPage.tsx (deep-link route).
 */
export default function MyBookmarksPanel() {
  const navigate = useNavigate();
  const { bookmarks, isLoading, hasLoaded, load, toggle } = useBookmarkStore();

  useEffect(() => {
    if (!hasLoaded) load();
  }, [hasLoaded, load]);

  const equityIds = useMemo(() => bookmarks.map((b) => b.equity_id), [bookmarks]);
  const { dataByEquity, isLoading: marketLoading } = useBookmarkMarketData(equityIds);
  const { matchedByEquity } = useScanPresenceForMany(equityIds);
  const { data: transition } = useIndustryTransition();

  const industryStatus = useMemo(() => {
    const map = new Map<string, TransitionCategory>();
    if (transition) {
      for (const item of transition.rotatingIn) map.set(item.industry, 'rotating_in');
      for (const item of transition.leading) map.set(item.industry, 'leading');
      for (const item of transition.rotatingOut) map.set(item.industry, 'rotating_out');
      for (const item of transition.stable) map.set(item.industry, 'stable');
    }
    return map;
  }, [transition]);

  // Reuse FlowIntensityMap (same component used on IndexDetailPage's Flow
  // Map tab / SectorRotationPage's Heat toggle) for the 5D heatmap — one
  // grid across all bookmarks, not a bespoke per-row widget.
  const heatmapLabels: string[] = [];
  const heatmapCells: Record<string, CellData[]> = {};
  let heatmapDates: string[] = [];
  for (const b of bookmarks) {
    const market = dataByEquity.get(b.equity_id);
    if (!market || market.last5.length === 0) continue;
    const label = displaySymbol({ symbol: b.symbol, company_name: b.company_name });
    heatmapLabels.push(label);
    if (heatmapDates.length < market.last5.length) {
      heatmapDates = market.last5.map((r) => fmtDate(r.trade_date));
    }
    heatmapCells[label] = market.last5.map((r) => ({
      d1: r.pct_chng ?? 0,
      amt: r.value_cr ?? 0,
      ret_5d: r.ret_5d ?? undefined,
      ret_22d: r.ret_22d ?? undefined,
      s5: r.score_5d ?? undefined,
      s22: r.score_22d ?? undefined,
    }));
  }

  if (isLoading && !hasLoaded) {
    return <DristiQLoader message="Loading bookmarks…" />;
  }

  if (bookmarks.length === 0) {
    return (
      <div style={{
        padding: '64px 24px', textAlign: 'center',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
      }}>
        <Star className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>No bookmarks yet</p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Tap the ☆ on any scanner row or a stock's chart page to save it here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {marketLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Loading prices…
          </div>
        )}
        {bookmarks.map((b) => (
          <BookmarkListRow
            key={b.id}
            bookmark={b}
            market={dataByEquity.get(b.equity_id)}
            scanTags={(matchedByEquity.get(b.equity_id) ?? []).map((m) => m.name)}
            sectorStatus={
              b.industry && industryStatus.has(b.industry)
                ? SECTOR_STATUS_LABEL[industryStatus.get(b.industry)!]
                : null
            }
            onRemove={() => toggle(b.equity_id)}
          />
        ))}
      </div>

      {heatmapLabels.length > 0 && (
        <FlowIntensityMap
          mode="constituent"
          rows={heatmapLabels}
          dates={heatmapDates}
          cells={heatmapCells}
          cellWidth={56}
          title="5D Heatmap"
          subtitle="Last 5 sessions · money-flow conviction"
          onRowClick={(label) => {
            const b = bookmarks.find(
              (bm) => displaySymbol({ symbol: bm.symbol, company_name: bm.company_name }) === label,
            );
            if (b) navigate(`/chart/equity/${b.equity_id}?name=${encodeURIComponent(toNavName(b))}`);
          }}
        />
      )}
    </>
  );
}
