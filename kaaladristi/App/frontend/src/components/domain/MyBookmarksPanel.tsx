import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Card, DristiQLoader } from '@/components/ui';
import { displaySymbol, displaySubName, navName as toNavName, bseTooltip } from '@/lib/symbolUtils';
import { ExchangeBadge } from '@/components/domain/StockCard';
import FlowIntensityMap, { type CellData } from '@/components/domain/FlowIntensityMap';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useBookmarkMarketData } from '@/hooks/useBookmarks';
import { useScanPresenceForMany } from '@/hooks/useScanPresence';
import { useIndustryTransition } from '@/hooks/useIndustryRotation';
import type { TransitionCategory } from '@/services/industryRotation';
import type { BookmarkRow, BookmarkMarketData } from '@/services/bookmarks';
import type { MatchedScan } from '@/hooks/useScanPresence';

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

// Column widths — shared between the header row and each data row so they align.
const W = {
  star: 26, stock: 150, price: 88, industry: 132,
  rsi: 46, rs: 58, s5: 56, s22: 58, scanners: 150,
} as const;

function num(v: number | null | undefined, digits = 1): string {
  return v == null ? '—' : v.toFixed(digits);
}
function rsiColor(v: number | null): string {
  if (v == null) return 'var(--text-faint)';
  if (v >= 70) return 'var(--risk-red)';
  if (v <= 30) return 'var(--risk-green)';
  return 'var(--text-secondary)';
}
function signColor(v: number | null): string {
  if (v == null) return 'var(--text-faint)';
  return v >= 0 ? 'var(--risk-green)' : 'var(--risk-red)';
}

const HEAD: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-faint)', flexShrink: 0,
};
const CELL_MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12 };

function HeaderRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px 6px', minWidth: 'max-content' }}>
      <div style={{ width: W.star, flexShrink: 0 }} />
      <div style={{ ...HEAD, width: W.stock }}>Stock</div>
      <div style={{ ...HEAD, width: W.price }}>Price</div>
      <div style={{ ...HEAD, width: W.industry }}>Industry</div>
      <div style={{ ...HEAD, width: W.rsi, textAlign: 'right' }}>RSI</div>
      <div style={{ ...HEAD, width: W.rs, textAlign: 'right' }}>RS</div>
      <div style={{ ...HEAD, width: W.s5, textAlign: 'right' }}>Score 5D</div>
      <div style={{ ...HEAD, width: W.s22, textAlign: 'right' }}>Score 22D</div>
      <div style={{ ...HEAD, width: W.scanners }}>Scanners</div>
      <div style={{ ...HEAD, flex: 1, minWidth: 200 }}>5D Money Flow</div>
      <div style={{ width: 76, flexShrink: 0 }} />
    </div>
  );
}

function BookmarkRowCard({
  bookmark, sectorStatus, scanTags, market, onRemove,
}: {
  bookmark: BookmarkRow;
  sectorStatus: { label: string; color: string } | null;
  scanTags: MatchedScan[];
  market: BookmarkMarketData | undefined;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const heroName = displaySymbol({ symbol: bookmark.symbol, company_name: bookmark.company_name });
  const subName = displaySubName({ symbol: bookmark.symbol, company_name: bookmark.company_name });
  const tooltip = bseTooltip({ symbol: bookmark.symbol, exchange: bookmark.exchange, isin: null });
  const pct = market?.pct_chng ?? null;
  const openChart = () =>
    navigate(`/chart/equity/${bookmark.equity_id}?name=${encodeURIComponent(toNavName(bookmark))}`);

  const last5 = market?.last5 ?? [];
  const dates = last5.map((r) => fmtDate(r.trade_date));
  const cells: Record<string, CellData[]> = {
    [heroName]: last5.map((r) => ({
      d1: r.pct_chng ?? 0, amt: r.value_cr ?? 0,
      ret_5d: r.ret_5d ?? undefined, ret_22d: r.ret_22d ?? undefined,
      s5: r.score_5d ?? undefined, s22: r.score_22d ?? undefined,
    })),
  };

  return (
    <Card rounded="xl" className="px-3 py-2.5">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 'max-content' }}>
        <button
          onClick={onRemove}
          title="Remove bookmark"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: W.star, height: W.star, borderRadius: 7, flexShrink: 0,
            background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
          }}
        >
          <Star className="w-3 h-3" style={{ color: 'var(--gold)', fill: 'var(--gold)' }} />
        </button>

        {/* Stock */}
        <div style={{ width: W.stock, flexShrink: 0, cursor: 'pointer' }} title={tooltip ?? undefined} onClick={openChart}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...CELL_MONO, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Price */}
        <div style={{ width: W.price, flexShrink: 0 }}>
          <div style={{ ...CELL_MONO, color: 'var(--text-primary)' }}>
            {market?.close != null ? `₹${market.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
          </div>
          {pct != null && (
            <div style={{ ...CELL_MONO, fontSize: 11, color: signColor(pct) }}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Industry + rotation status */}
        <div style={{ width: W.industry, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bookmark.industry ?? '—'}
          </div>
          {sectorStatus && (
            <span style={{ fontSize: 10, fontWeight: 600, color: sectorStatus.color }}>{sectorStatus.label}</span>
          )}
        </div>

        {/* RSI */}
        <div style={{ ...CELL_MONO, width: W.rsi, flexShrink: 0, textAlign: 'right', color: rsiColor(market?.rsi_14 ?? null) }}>
          {num(market?.rsi_14, 0)}
        </div>
        {/* RS (magic_rs) */}
        <div style={{ ...CELL_MONO, width: W.rs, flexShrink: 0, textAlign: 'right', color: signColor(market?.magic_rs ?? null) }}
          title={market?.magic_rs_zone ?? undefined}>
          {market?.magic_rs != null ? (market.magic_rs >= 0 ? '+' : '') + market.magic_rs.toFixed(1) : '—'}
        </div>
        {/* Score 5D */}
        <div style={{ ...CELL_MONO, width: W.s5, flexShrink: 0, textAlign: 'right', color: 'var(--text-secondary)' }}>
          {num(market?.score_5d, 0)}
        </div>
        {/* Score 22D */}
        <div style={{ ...CELL_MONO, width: W.s22, flexShrink: 0, textAlign: 'right', color: 'var(--text-secondary)' }}>
          {num(market?.score_22d, 0)}
        </div>

        {/* Scanners */}
        <div style={{ width: W.scanners, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {scanTags.length === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>No scanner match</span>
          ) : scanTags.map((t) => (
            <span key={t.id} title={t.vani ? 'VaNi highlight in this scanner' : undefined} style={{
              fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
              background: t.vani ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
              color: t.vani ? 'var(--gold)' : 'var(--accent-indigo)',
            }}>
              {t.vani ? '✦ ' : ''}{t.name}
            </span>
          ))}
        </div>

        {/* 5D flow heatmap */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {last5.length > 0 ? (
            <FlowIntensityMap
              bare hideRowLabels hideTrend
              mode="constituent"
              rows={[heroName]} dates={dates} cells={cells}
              cellWidth={40} cellHeight={30}
            />
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>No flow data</span>
          )}
        </div>

        {/* Open */}
        <button
          onClick={openChart}
          title="Open chart"
          style={{
            width: 76, flexShrink: 0, fontSize: 11, padding: '5px 10px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Open ›
        </button>
      </div>
    </Card>
  );
}

/**
 * "My Bookmarks" content — the Workspace tab body (WorkspacePage.tsx).
 * Also reused standalone by views/MyBookmarksPage.tsx (deep-link route).
 */
export default function MyBookmarksPanel() {
  const { bookmarks, isLoading, hasLoaded, load, toggle } = useBookmarkStore();

  useEffect(() => {
    if (!hasLoaded) load();
  }, [hasLoaded, load]);

  const equityIds = useMemo(() => bookmarks.map((b) => b.equity_id), [bookmarks]);
  const { dataByEquity, isLoading: marketLoading } = useBookmarkMarketData(equityIds);
  const { matchedByEquity, isLoading: scanLoading } = useScanPresenceForMany(equityIds);
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

  // Wait for prices + scanner membership before rendering, so the row shows the
  // complete picture at once (scanner membership runs every preset — a few
  // seconds — and would otherwise flash "No scanner match" until it resolves).
  if (marketLoading || scanLoading) {
    return <DristiQLoader message="Loading prices & scanner membership…" />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <HeaderRow />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bookmarks.map((b) => (
          <BookmarkRowCard
            key={b.id}
            bookmark={b}
            market={dataByEquity.get(b.equity_id)}
            scanTags={matchedByEquity.get(b.equity_id) ?? []}
            sectorStatus={
              b.industry && industryStatus.has(b.industry)
                ? SECTOR_STATUS_LABEL[industryStatus.get(b.industry)!]
                : null
            }
            onRemove={() => toggle(b.equity_id)}
          />
        ))}
      </div>
    </div>
  );
}
