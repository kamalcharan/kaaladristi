import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Loader2 } from 'lucide-react';
import { Card, DristiQLoader } from '@/components/ui';
import { displaySymbol, displaySubName, navName as toNavName, bseTooltip } from '@/lib/symbolUtils';
import { ExchangeBadge } from '@/components/domain/StockCard';
import FlowIntensityMap, { type CellData } from '@/components/domain/FlowIntensityMap';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import { useBookmarkMarketData, useBookmarkSectors } from '@/hooks/useBookmarks';
import { useScanPresenceForMany } from '@/hooks/useScanPresence';
import { useSectorPulse } from '@/hooks/useSectorRotation';
import { flowSignal, STRONG_SCORE_CUT_INDEX, type FlowSignal } from '@/components/domain/FlowIntensityMap';
import type { BookmarkRow, BookmarkMarketData, BookmarkSector } from '@/services/bookmarks';
import type { MatchedScan } from '@/hooks/useScanPresence';

// Sector money-flow signal → rotation vocabulary (same 5 states the Sector
// Rotation heatmap uses; this is the solidified path, unlike industry).
const SECTOR_SIGNAL: Record<FlowSignal, { label: string; color: string; rank: number }> = {
  STRONG:  { label: 'Leading',   color: 'var(--risk-green)', rank: 0 },
  BUILDING:{ label: 'Improving', color: 'color-mix(in srgb, var(--risk-green) 70%, transparent)', rank: 1 },
  FADING:  { label: 'Fading',    color: 'var(--risk-amber)', rank: 2 },
  OUTFLOW: { label: 'Outflow',   color: 'var(--risk-red)', rank: 3 },
  QUIET:   { label: 'Quiet',     color: 'var(--text-faint)', rank: 4 },
};

/** Drop the "NIFTY " prefix so sector chips stay compact ("NIFTY IT" → "IT"). */
function shortSector(name: string): string {
  return name.replace(/^NIFTY\s+/i, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

// Column widths — shared between the header row and each data row so they align.
const W = {
  star: 26, stock: 150, price: 88, sector: 190,
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
      <div style={{ ...HEAD, width: W.sector }}>Sector / Industry</div>
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

interface SectorChip extends BookmarkSector {
  signal: { label: string; color: string; rank: number } | null;
}

function BookmarkRowCard({
  bookmark, sectors, scanTags, scanLoading, market, onRemove,
}: {
  bookmark: BookmarkRow;
  sectors: SectorChip[];
  scanTags: MatchedScan[];
  scanLoading: boolean;
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

        {/* Sectors (one chip per sectoral index, strongest signal first, colored
            by that sector's live rotation signal) · Industry as muted subtext */}
        <div style={{ width: W.sector, flexShrink: 0 }}>
          {sectors.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>No sector</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {sectors.map((sec) => {
                const color = sec.signal?.color ?? 'var(--text-faint)';
                return (
                  <span
                    key={sec.id}
                    onClick={(e) => { e.stopPropagation(); navigate(`/sector-rotation/${sec.id}`); }}
                    title={`${sec.name}${sec.signal ? ` — ${sec.signal.label}` : ''}`}
                    style={{
                      fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 100, cursor: 'pointer',
                      border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
                      background: `color-mix(in srgb, ${color} 10%, transparent)`,
                      color, whiteSpace: 'nowrap',
                    }}
                  >
                    {shortSector(sec.name)}
                  </span>
                );
              })}
            </div>
          )}
          {bookmark.industry && (
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bookmark.industry}
            </div>
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

        {/* Scanners — loaded off the critical path (full-market scan), so this
            fills in a moment after prices/sectors rather than blocking them. */}
        <div style={{ width: W.scanners, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {scanLoading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-faint)' }}>
              <Loader2 className="w-3 h-3 animate-spin" /> checking…
            </span>
          ) : scanTags.length === 0 ? (
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

  // Reload from the server on every mount — a bookmark added elsewhere (scanner
  // row, chart page) must show up when you open this tab without a hard refresh.
  useEffect(() => {
    load();
  }, [load]);

  const equityIds = useMemo(() => bookmarks.map((b) => b.equity_id), [bookmarks]);
  const { dataByEquity, isLoading: marketLoading } = useBookmarkMarketData(equityIds);
  const { matchedByEquity, isLoading: scanLoading } = useScanPresenceForMany(equityIds);
  const { sectorByEquity, isLoading: sectorLoading } = useBookmarkSectors(equityIds);
  const { data: sectorPulse = [] } = useSectorPulse();

  // sector index name → live money-flow signal (latest cell), the solidified
  // Sector Rotation verdict.
  const sectorSignalByName = useMemo(() => {
    const map = new Map<string, { label: string; color: string; rank: number }>();
    for (const row of sectorPulse) {
      const latest = row.cells[0]; // cells are NEWEST FIRST (index 0 = latest)
      if (!latest) continue;
      map.set(row.name.toUpperCase(), SECTOR_SIGNAL[flowSignal(latest, STRONG_SCORE_CUT_INDEX)]);
    }
    return map;
  }, [sectorPulse]);

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

  // Gate only on the FAST, indexed queries (prices + sector membership) so the
  // page paints in well under a second. Scanner membership is deliberately NOT
  // gated: it runs every preset over the full market (one shared ~8k-row bundle
  // download), which dominated load time and is the same fixed cost per user —
  // so it streams in behind a per-row "checking…" indicator instead of blocking
  // the whole page. (A server-side membership table is the real scale fix —
  // see docs/claude/scannerenhancement.md.)
  if (marketLoading || sectorLoading) {
    return <DristiQLoader message="Loading bookmarks…" />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <HeaderRow />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bookmarks.map((b) => {
          const sectors: SectorChip[] = (sectorByEquity.get(b.equity_id) ?? [])
            .map((s) => ({ ...s, signal: sectorSignalByName.get(s.name.toUpperCase()) ?? null }))
            .sort((a, x) => (a.signal?.rank ?? 9) - (x.signal?.rank ?? 9) || a.name.localeCompare(x.name));
          return (
            <BookmarkRowCard
              key={b.id}
              bookmark={b}
              market={dataByEquity.get(b.equity_id)}
              scanTags={matchedByEquity.get(b.equity_id) ?? []}
              scanLoading={scanLoading}
              sectors={sectors}
              onRemove={() => toggle(b.equity_id)}
            />
          );
        })}
      </div>
    </div>
  );
}
