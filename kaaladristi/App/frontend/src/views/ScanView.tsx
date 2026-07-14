import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronLeft, Download, Copy, Check } from 'lucide-react';
import { Card, DristiQLoader } from '@/components/ui';
import { useScan, useAllScanCounts, useScanPresets, useFpbActive } from '@/hooks/useScan';
import { SCAN_PRESETS, type ExchangeFilter, type ScanTimeframe, type FpbActiveRow } from '@/services/scanEngine';
import { StockCard, StageBadge } from '@/components/domain/StockCard';
import { ScanSectionLabel } from '@/components/domain/ScanCardShell';
import ScanTable from '@/components/domain/ScanTable';
import ConvictionFlowCards from '@/components/domain/ConvictionFlowTable';
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable';
import { downloadScanXls, type ScanVariant } from '@/utils/downloadXls';
import type { ScanDefinition, ScanStock } from '@/types';
import AtmosphericBadge from '@/components/domain/AtmosphericBadge';
import { ScanFilterBar, applyFilters, DEFAULT_FILTERS, FPB_DEFAULT_FILTERS, type ScanFilters } from '@/components/domain/ScanFilterBar';

// ── Sort ──────────────────────────────────────────────────────

type SortKey = 'score_5d' | 'score_22d' | 'magic_rs' | 'rsi_14' | 'rvol' | 'pct_chng' | 'reward' | 'symbol' | 'vaniOpportunity';
type SortDir = 'asc' | 'desc';

// Scores first (owner doctrine). These chips drive CARD view ordering only —
// in table view the table's own sortable headers are the single sort control
// (the chips used to render there too but were silently ignored).
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'vaniOpportunity', label: '✦ VaNi Highlight' },
  { key: 'score_5d',        label: 'Score 5D' },
  { key: 'score_22d',       label: 'Score 22D' },
  { key: 'magic_rs',        label: 'RS' },
  { key: 'rvol',            label: 'RVOL' },
  { key: 'reward',          label: 'Reward' },
  { key: 'pct_chng',        label: '% Chg' },
  { key: 'rsi_14',          label: 'RSI' },
  { key: 'symbol',          label: 'Symbol' },
];

function sortStocks(stocks: ScanStock[], key: SortKey, dir: SortDir): ScanStock[] {
  const arr = [...stocks];
  arr.sort((a, b) => {
    let va: string | number = 0;
    let vb: string | number = 0;
    switch (key) {
      case 'symbol':          va = a.symbol;                    vb = b.symbol;                    break;
      case 'score_5d':        va = a.score_5d ?? -1;            vb = b.score_5d ?? -1;            break;
      case 'score_22d':       va = a.score_22d ?? -1;           vb = b.score_22d ?? -1;           break;
      case 'pct_chng':        va = a.pct_chng ?? 0;             vb = b.pct_chng ?? 0;             break;
      case 'magic_rs':        va = a.magic_rs ?? 0;             vb = b.magic_rs ?? 0;             break;
      case 'rsi_14':          va = a.rsi_14 ?? 0;               vb = b.rsi_14 ?? 0;               break;
      case 'rvol':            va = a.rvol ?? 0;                 vb = b.rvol ?? 0;                 break;
      case 'reward':          va = a.rewardPct ?? -99;           vb = b.rewardPct ?? -99;           break;
      case 'vaniOpportunity': va = a.vaniOpportunity ? 1 : 0;  vb = b.vaniOpportunity ? 1 : 0;  break;
    }
    if (typeof va === 'string') {
      return dir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    }
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
  return arr;
}

// ── Relevance bar ─────────────────────────────────────────────

function getRelevance(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 5) return 1;
  if (count <= 14) return 2;
  if (count <= 20) return 3;
  return 4;
}

const REL_BAR: Record<number, { width: string; color: string; opacity: number }> = {
  0: { width: '10%',  color: 'var(--text-faint)', opacity: 0.3 },
  1: { width: '30%',  color: 'var(--text-muted)', opacity: 0.4 },
  2: { width: '55%',  color: 'var(--caution)',    opacity: 0.6 },
  3: { width: '80%',  color: 'var(--gold)',       opacity: 1   },
  4: { width: '100%', color: 'var(--gold)',       opacity: 1   },
};

// ── Exchange Tabs (shared) ─────────────────────────────────────

function ExchangeTabs({
  value,
  onChange,
  disabledOptions = [],
}: {
  value: ExchangeFilter;
  onChange: (f: ExchangeFilter) => void;
  disabledOptions?: ExchangeFilter[];
}) {
  return (
    <div style={{
      display: 'flex', gap: '2px', padding: '4px',
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '100px',
    }}>
      {(['combined', 'NSE', 'BSE'] as ExchangeFilter[]).map((ex) => {
        const isDisabled = disabledOptions.includes(ex);
        return (
          <button
            key={ex}
            onClick={() => !isDisabled && onChange(ex)}
            disabled={isDisabled}
            style={{
              padding: '6px 16px', borderRadius: '100px', border: 'none',
              background: value === ex ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'transparent',
              color: value === ex ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: 500,
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              opacity: isDisabled ? 0.3 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {ex === 'combined' ? 'Combined' : ex}
          </button>
        );
      })}
    </div>
  );
}

// ── VaNi filter button (shared) ────────────────────────────────

function VaniFilterButton({ active, count, onToggle }: { active: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px',
        background: active ? 'var(--gold)' : 'transparent',
        border: '1px solid var(--border-gold)',
        color: active ? '#1a1410' : 'var(--gold)',
        borderRadius: '100px',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-body)', transition: 'all 0.2s',
        boxShadow: active ? '0 0 16px color-mix(in srgb, var(--gold) 30%, transparent)' : undefined,
      }}
    >
      <span style={{ fontSize: '10px', lineHeight: 1 }}>✦</span>
      VaNi Highlight
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        padding: '1px 6px', borderRadius: '100px',
        background: 'rgba(0,0,0,0.2)', // theme-agnostic: recess on the gold chip, not on the page surface
        color: active ? '#1a1410' : undefined,
      }}>
        {count}
      </span>
    </button>
  );
}

// ── View toggle (Table / Cards) ───────────────────────────────

type ViewMode = 'table' | 'cards';

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{
      display: 'flex', gap: '2px', padding: '4px',
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '100px',
    }}>
      {(['table', 'cards'] as ViewMode[]).map(mode => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          style={{
            padding: '5px 14px', borderRadius: '100px', border: 'none',
            background: value === mode ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'transparent',
            color: value === mode ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: 500,
            fontFamily: 'var(--font-body)', transition: 'all 0.15s', cursor: 'pointer',
          }}
        >
          {mode === 'table' ? '≡ Table' : '⊞ Cards'}
        </button>
      ))}
    </div>
  );
}

function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = React.useState<ViewMode>(() => {
    try { return (localStorage.getItem('scan_view_mode') as ViewMode) ?? 'table'; }
    catch { return 'table'; }
  });
  function set(v: ViewMode) {
    setMode(v);
    try { localStorage.setItem('scan_view_mode', v); } catch { /* ignore */ }
  }
  return [mode, set];
}

// ── Action Island (shared shell) ──────────────────────────────

function ActionIsland({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '28px',
      left: '50%',
      transform: 'translateX(calc(-50% + 110px))',
      background: 'color-mix(in srgb, var(--card) 94%, transparent)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--border)',
      borderRadius: '100px',
      padding: '10px 18px 10px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
      zIndex: 50,
    }}>
      {children}
    </div>
  );
}

// ── Download XLS button ───────────────────────────────────────

function DownloadXlsButton({
  stocks,
  scanName,
  variant = 'default',
}: {
  stocks: ScanStock[];
  scanName: string;
  variant?: ScanVariant;
}) {
  if (stocks.length === 0) return null;
  return (
    <button
      onClick={() => downloadScanXls(stocks, scanName, variant)}
      title={`Download ${stocks.length} rows as Excel`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 12px', borderRadius: '100px',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-muted)',
        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
        fontFamily: 'var(--font-body)', transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
      }}
    >
      <Download style={{ width: '12px', height: '12px' }} />
      XLS
    </button>
  );
}

// ── TradingView Export ──────────────────────────────────────────

function toTvSymbol(symbol: string, exchange: string | null): string {
  const ex = exchange === 'BSE' ? 'BSE' : 'NSE';
  return `${ex}:${symbol}`;
}

function buildTvList(stocks: Array<{ symbol: string; exchange: string | null }>): string {
  return stocks
    .filter((s) => !/^\d+$/.test(s.symbol))  // skip BSE numeric codes (e.g. "500002")
    .map((s) => toTvSymbol(s.symbol, s.exchange))
    .join(',');
}

function TradingViewExportButton({
  stocks,
  scanName,
}: {
  stocks: Array<{ symbol: string; exchange: string | null }>;
  scanName: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (stocks.length === 0) return null;

  const list = buildTvList(stocks);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      if (resetRef.current) clearTimeout(resetRef.current);
      resetRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: download as txt
      const blob = new Blob([list], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scanName.replace(/\s+/g, '_')}_tradingview.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([list], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scanName.replace(/\s+/g, '_')}_tradingview.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '100px',
    border: '1px solid var(--border)',
    background: 'transparent',
    fontSize: '12px', fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        title={`Copy ${stocks.length} TradingView symbols to clipboard`}
        style={{ ...btnBase, color: copied ? 'var(--bull)' : 'var(--text-muted)', borderColor: copied ? 'var(--bull-dim)' : 'var(--border)' }}
        onMouseEnter={(e) => {
          if (!copied) {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          }
        }}
      >
        {copied
          ? <><Check style={{ width: '12px', height: '12px' }} />Copied</>
          : <><Copy style={{ width: '12px', height: '12px' }} />TV</>
        }
      </button>
      {/* Download .txt button */}
      <button
        onClick={handleDownload}
        title={`Download ${stocks.length} TradingView symbols as .txt`}
        style={{ ...btnBase, color: 'var(--text-muted)', padding: '5px 8px' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
        }}
      >
        <Download style={{ width: '12px', height: '12px' }} />
      </button>
    </div>
  );
}

// ── VaNi Section header (used by all screener detail views) ───

function VaniSectionHeader({
  vaniCount,
  onAddWidget,
  scanName,
}: {
  vaniCount: number;
  onAddWidget: () => void;
  scanName: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px',
      background: 'rgba(240,165,0,0.03)',
      borderBottom: '1px solid rgba(240,165,0,0.12)',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px',
          textTransform: 'uppercase', color: 'var(--gold)',
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <span>✦</span> VaNi Highlight
          <span style={{
            background: 'rgba(240,165,0,0.12)', color: '#ffd166',
            padding: '1px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
          }}>
            {vaniCount} stock{vaniCount !== 1 ? 's' : ''}
          </span>
        </span>
        <AtmosphericBadge />
      </div>
      {/* Right: Add Widget */}
      <button
        onClick={onAddWidget}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 11px',
          background: 'rgba(240,165,0,0.07)', border: '1px solid rgba(240,165,0,0.22)',
          borderRadius: '6px', fontSize: '11px', fontWeight: 500, color: 'var(--gold)',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
      >
        + Add Widget
      </button>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (text: string) => {
    setMsg(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(null), 2500);
  };

  const Toast = msg ? (
    <div style={{
      position: 'fixed', bottom: '80px', right: '24px',
      padding: '10px 16px',
      background: 'rgba(20,30,48,0.97)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--border-strong)', borderRadius: '10px',
      fontSize: '12px', color: 'var(--text-primary)',
      display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      zIndex: 200,
      animation: 'fadeIn 0.2s ease',
    }}>
      <span style={{ color: 'var(--gold)' }}>✦</span>
      {msg}
    </div>
  ) : null;

  return { show, Toast };
}

// ── Scanner Hub removed — sidebar lives in ScanView directly ──

// ── Stage 2 Leaders results ───────────────────────────────────

type S2SortKey = 'magic_rs' | 'close' | 'rss_spread' | 'mcap_cr';

const S2_SORT_OPTIONS: { key: S2SortKey; label: string }[] = [
  { key: 'magic_rs',   label: 'RS' },
  { key: 'close',      label: 'Price' },
  { key: 'rss_spread', label: 'RSS' },
  { key: 'mcap_cr',    label: 'MCap' },
];

function sortStage2(arr: ScanStock[], key: S2SortKey, dir: SortDir): ScanStock[] {
  return [...arr].sort((a, b) => {
    const av = (a[key] as number | null) ?? -Infinity;
    const bv = (b[key] as number | null) ?? -Infinity;
    return dir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
  });
}


function Stage2Results({ preset, timeframe, viewMode, onViewModeChange }: {
  preset: ScanDefinition;
  timeframe: ScanTimeframe;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  const navigate = useNavigate();
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const disabledExchangeOptions: ExchangeFilter[] = preset.universe === 'NSE_ONLY' ? ['BSE'] : [];
  const [s2Sort, setS2Sort] = useState<S2SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [vaniOnly, setVaniOnly] = useState(false);
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const { show: showToast, Toast } = useToast();

  const { data: fetchedStocks = [], isLoading, error, refetch } = useScan(preset.id, exchangeFilter, timeframe);

  // always_true presets are pre-filtered shortlists — every row would carry ✦,
  // so the flag says nothing within this scan. Strip it at the view boundary
  // (the Discovery board consumes the engine flag directly and is unaffected).
  const hideVani = preset.vani_rule === 'always_true';
  const rawStocks = useMemo(
    () => hideVani ? fetchedStocks.map((s) => (s.vaniOpportunity ? { ...s, vaniOpportunity: false } : s)) : fetchedStocks,
    [fetchedStocks, hideVani],
  );

  useEffect(() => { setFilters(DEFAULT_FILTERS); }, [preset.id]);

  const filteredRaw = useMemo(() => applyFilters(rawStocks, filters), [rawStocks, filters]);
  const vaniStocks = useMemo(() => filteredRaw.filter((s) => s.vaniOpportunity), [filteredRaw]);
  const vaniCount = vaniStocks.length;
  const displayStocks = useMemo(() => vaniOnly ? vaniStocks : filteredRaw, [filteredRaw, vaniStocks, vaniOnly]);
  const vaniSorted = useMemo(() => sortStage2(vaniStocks, s2Sort, sortDir), [vaniStocks, s2Sort, sortDir]);
  const restSorted = useMemo(() => sortStage2(displayStocks.filter((s) => !s.vaniOpportunity), s2Sort, sortDir), [displayStocks, s2Sort, sortDir]);

  const exportStocks = useMemo(() => rawStocks, [rawStocks]);

  const toggleSort = (key: S2SortKey) => {
    if (s2Sort === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setS2Sort(key); setSortDir('desc'); }
  };

  const renderCard = (stock: ScanStock) => (
    <StockCard
      key={stock.equity_id}
      stock={stock}
      stageBadge="S2"
    />
  );


  const SkeletonCard = () => (
    <div style={{
      height: '64px', borderRadius: '10px',
      background: 'linear-gradient(90deg, var(--card) 25%, color-mix(in srgb, var(--text-primary) 3%, transparent) 50%, var(--card) 75%)',
      backgroundSize: '200% 100%', animation: 'pulse 1.5s ease-in-out infinite',
      border: '1px solid var(--border)',
    }} />
  );

  return (
    <>
      {Toast}

      {/* Filters bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 0', flexWrap: 'wrap', marginBottom: '4px',
      }}>
        <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={disabledExchangeOptions} />
        {!hideVani && <VaniFilterButton active={vaniOnly} count={vaniCount} onToggle={() => setVaniOnly((f) => !f)} />}
        <ScanFilterBar
          presetId={preset.id}
          stocks={rawStocks}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Sort strip — right side. Chips are CARD view only: table view
            sorts via the table's own headers. */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {viewMode === 'cards' && (<>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--text-faint)', textTransform: 'uppercase',
            letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>
            Sort
          </span>
          {S2_SORT_OPTIONS.map((opt) => {
            const active = s2Sort === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => toggleSort(opt.key)}
                style={{
                  padding: '4px 10px', borderRadius: '100px', border: 'none',
                  background: active ? 'var(--indigo-bg)' : 'transparent',
                  color: active ? 'var(--indigo)' : 'var(--text-muted)',
                  fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                  outline: active ? '1px solid var(--border-indigo)' : undefined,
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}{active && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </button>
            );
          })}
          </>)}
          <DownloadXlsButton stocks={exportStocks} scanName={preset.name} />
          <TradingViewExportButton stocks={exportStocks} scanName={preset.name} />
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'table' && !isLoading && !error && (
        <ScanTable
          stocks={displayStocks}
          presetId={preset.id}
          onRowClick={(s) => navigate(`/pulse/equity/${s.equity_id}`)}
        />
      )}

      {/* VaNi Section (cards mode only) */}
      {viewMode === 'cards' && !vaniOnly && vaniSorted.length > 0 && (
        <div style={{
          marginBottom: '20px',
          border: '1px solid rgba(240,165,0,0.2)', borderRadius: '10px',
          overflow: 'hidden', background: 'rgba(240,165,0,0.015)',
        }}>
          <VaniSectionHeader
            vaniCount={vaniCount}
            scanName={preset.name}
            onAddWidget={() => showToast(`✦ ${preset.name} widget added to Workspace`)}
          />
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {vaniSorted.map(renderCard)}
          </div>
        </div>
      )}

      {/* All Results (cards mode only) */}
      {viewMode === 'cards' && (isLoading ? (
        <DristiQLoader message="Preparing Data For You…" />
      ) : error ? (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--bear)', marginBottom: '12px' }}>
            Failed to run scan. Check data connection.
          </p>
          <button
            onClick={() => refetch()}
            style={{
              padding: '6px 16px', background: 'var(--accent-glow)',
              border: '1px solid var(--accent-dim)', borderRadius: '6px',
              color: 'var(--accent)', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : restSorted.length > 0 ? (
        <>
          {!vaniOnly && (
            <ScanSectionLabel>
              All Results · {restSorted.length} stock{restSorted.length !== 1 ? 's' : ''}
            </ScanSectionLabel>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(vaniOnly ? sortStage2(vaniStocks, s2Sort, sortDir) : restSorted).map(renderCard)}
          </div>
        </>
      ) : !isLoading && rawStocks.length === 0 ? (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            No Stage 2 setups today. Stage 2 requires SMA_200 data — stocks need 200+ days of history.
          </p>
        </div>
      ) : null)}

      {/* Action Island */}
      <ActionIsland>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--bull)', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Showing{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {displayStocks.length}
          </em>
          {' '}Stage 2 setup{displayStocks.length !== 1 ? 's' : ''}
        </span>
        {vaniCount > 0 && !vaniOnly && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', flexShrink: 0 }} />
            <button
              onClick={() => setVaniOnly(true)}
              style={{
                fontSize: '13px', padding: '7px 16px',
                background: 'var(--gold)', color: '#1a1410',
                border: 'none', borderRadius: '100px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
              }}
            >
              {vaniCount} opportunit{vaniCount !== 1 ? 'ies' : 'y'}
            </button>
          </>
        )}
      </ActionIsland>
    </>
  );
}

// ── Conviction Flow sort ───────────────────────────────────────

type CFSortKey = 'delivery_surge_x' | 'avg_amt_5d' | 'avg_amt_22d' | 'close' | 'd_pct' | 'rsi_14' | 'ret_5d' | 'ret_22d' | 'ret_66d' | 'symbol';

const CF_SORT_OPTIONS: { key: CFSortKey; label: string }[] = [
  { key: 'delivery_surge_x', label: 'Surge' },
  { key: 'avg_amt_5d',       label: '5D Avg' },
  { key: 'avg_amt_22d',      label: '22D Avg' },
  { key: 'close',            label: 'Close' },
  { key: 'd_pct',            label: 'D%' },
  { key: 'rsi_14',           label: 'RSI' },
  { key: 'ret_5d',           label: '5D%' },
  { key: 'ret_22d',          label: '22D%' },
  { key: 'ret_66d',          label: '66D%' },
  { key: 'symbol',           label: 'Symbol' },
];

function sortCFStocks(stocks: ScanStock[], key: CFSortKey, dir: SortDir): ScanStock[] {
  return [...stocks].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (key) {
      case 'symbol':           va = a.symbol;                    vb = b.symbol;                    break;
      case 'delivery_surge_x': va = a.delivery_surge_x ?? 0;     vb = b.delivery_surge_x ?? 0;     break;
      case 'avg_amt_5d':       va = a.avg_amt_5d ?? 0;           vb = b.avg_amt_5d ?? 0;           break;
      case 'avg_amt_22d':      va = a.avg_amt_22d ?? 0;          vb = b.avg_amt_22d ?? 0;          break;
      case 'close':            va = a.close;                     vb = b.close;                     break;
      case 'd_pct':            va = a.d_pct ?? 0;                vb = b.d_pct ?? 0;                break;
      case 'rsi_14':           va = a.rsi_14 ?? 0;               vb = b.rsi_14 ?? 0;               break;
      case 'ret_5d':           va = a.ret_5d ?? -999;            vb = b.ret_5d ?? -999;            break;
      case 'ret_22d':          va = a.ret_22d ?? -999;           vb = b.ret_22d ?? -999;           break;
      case 'ret_66d':          va = a.ret_66d ?? -999;           vb = b.ret_66d ?? -999;           break;
      default:                 va = 0;                           vb = 0;
    }
    if (typeof va === 'string') {
      return dir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    }
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

// ── Conviction Flow results (server-side RPC, different columns) ───────────

function ConvictionFlowResults({ preset, timeframe, viewMode, onViewModeChange }: {
  preset: ScanDefinition;
  timeframe: ScanTimeframe;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  const navigate = useNavigate();
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const [vaniOnly, setVaniOnly] = useState(false);
  const { data: rawStocks = [], isLoading, error } = useScan('conviction_flow', exchangeFilter, timeframe);
  const { show: showToast, Toast } = useToast();
  const filtered = useMemo(() => applyFilters(rawStocks, filters), [rawStocks, filters]);
  const vaniCount = useMemo(() => filtered.filter((s) => s.vaniOpportunity).length, [filtered]);
  const stocks = useMemo(() => (vaniOnly ? filtered.filter((s) => s.vaniOpportunity) : filtered), [filtered, vaniOnly]);

  return (
    <>
      {Toast}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 0', flexWrap: 'wrap', marginBottom: '4px',
      }}>
        <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={[]} />
        <VaniFilterButton active={vaniOnly} count={vaniCount} onToggle={() => setVaniOnly((f) => !f)} />
        <ScanFilterBar
          presetId="conviction_flow"
          stocks={rawStocks}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DownloadXlsButton stocks={stocks} scanName={preset.name} />
          <TradingViewExportButton stocks={stocks} scanName={preset.name} />
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>

      {viewMode === 'table' ? (
        isLoading ? <DristiQLoader /> : error ? (
          <Card rounded="xxl" className="py-12 text-center">
            <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan.</p>
          </Card>
        ) : (
          <ScanTable
            stocks={stocks}
            presetId="conviction_flow"
            onRowClick={(s) => navigate(`/pulse/equity/${s.equity_id}`)}
          />
        )
      ) : (
        <>
          <VaniSectionHeader
            vaniCount={vaniCount}
            scanName={preset.name}
            onAddWidget={() => showToast(`✦ ${preset.name} widget added to Workspace`)}
          />
          {isLoading ? (
            <DristiQLoader />
          ) : error ? (
            <Card rounded="xxl" className="py-12 text-center">
              <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan.</p>
            </Card>
          ) : (
            <ConvictionFlowCards stocks={stocks} />
          )}
        </>
      )}
    </>
  );
}


// ── Flower Pot Burst — phased (Bursts / Shatters / Coiling Setups) layout ──
function FpbMetricLine({ stock }: { stock: ScanStock }) {
  const parts: string[] = [];
  if (stock.fpb_phase === 'BURST' || stock.fpb_phase === 'SHATTER') {
    if (stock.fpb_vol_burst != null) parts.push(`${stock.fpb_vol_burst}× volume`);
    if (stock.fpb_range_exp != null) parts.push(`${stock.fpb_range_exp}× range`);
    if (stock.fpb_close_strength != null) {
      const pct = Math.round(stock.fpb_close_strength * 100);
      parts.push(`closed ${pct}% up the range`);  // ~100% = at the high (burst), ~0% = at the low (shatter)
    }
    if (stock.fpb_quality != null) parts.push(`quality ${stock.fpb_quality}`);
  } else {
    if (stock.fpb_atr_compression != null) parts.push(`ATR ${stock.fpb_atr_compression}× of 60d`);
    if (stock.fpb_vol_death != null) parts.push(`volume ${Math.round(stock.fpb_vol_death * 100)}% of norm`);
    if (stock.fpb_setup_days != null) parts.push(`coiled ${stock.fpb_setup_days}d/22`);
    if (stock.fpb_compression_score != null) parts.push(`tightness ${stock.fpb_compression_score}`);
  }
  if (parts.length === 0) return null;
  return (
    <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 4px 8px', letterSpacing: '0.01em' }}>
      {parts.join(' · ')}
    </div>
  );
}

// ── Day-2 position layer: recent releases + hold/crack verdict + stop/target ──
const FPB_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE:     { label: 'Day 2 pending', color: 'var(--text-muted)' },
  HOLDING:    { label: 'Holding',       color: 'var(--bull)' },
  TARGET_HIT: { label: 'Target hit',    color: 'var(--bull)' },
  CRACKED:    { label: 'Cracked',       color: 'var(--gold)' },
  STOPPED:    { label: 'Stopped',       color: 'var(--bear)' },
};

function FpbActiveSection() {
  const navigate = useNavigate();
  const { data: rows = [] } = useFpbActive();
  const shown = useMemo(
    () => rows.filter((r) => r.status !== 'EXPIRED').slice(0, 24),
    [rows],
  );
  if (shown.length === 0) return null;

  const fmt = (n: number | null | undefined) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })}`);

  return (
    <div style={{ marginBottom: 20 }}>
      <ScanSectionLabel>
        Live Releases · Day 2+ · {shown.length}
      </ScanSectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((r: FpbActiveRow) => {
          const st = FPB_STATUS[r.status] ?? FPB_STATUS.ACTIVE;
          const up = r.direction === 'UP';
          return (
            <div
              key={`${r.equity_id}-${r.release_date}`}
              onClick={() => navigate(`/pulse/equity/${r.equity_id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '10px 14px', borderRadius: 12,
                background: 'var(--card)', border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 13, color: up ? 'var(--bull)' : 'var(--bear)', width: 16, flexShrink: 0 }}>
                {up ? '↑' : '↓'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, minWidth: 96, color: 'var(--text-primary)' }}>
                {r.symbol}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                color: st.color, border: `1px solid ${st.color}`, whiteSpace: 'nowrap',
              }}>
                {st.label}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span>{up ? 'Burst' : 'Shatter'} {r.release_date?.slice(5)}</span>
                <span>entry {fmt(r.release_close)}</span>
                <span>SL {fmt(r.sl_level)}</span>
                <span>target {fmt(r.target_level)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FpbResults({ preset, timeframe, viewMode, onViewModeChange }: {
  preset: ScanDefinition;
  timeframe: ScanTimeframe;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}) {
  const navigate = useNavigate();
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [filters, setFilters] = useState<ScanFilters>(FPB_DEFAULT_FILTERS);
  const [vaniOnly, setVaniOnly] = useState(false);
  const { data: rawStocks = [], isLoading, error } = useScan('flower_pot_burst', exchangeFilter, timeframe);
  const filtered = useMemo(() => applyFilters(rawStocks, filters), [rawStocks, filters]);
  const bursts = useMemo(() => filtered.filter((s) => s.fpb_phase === 'BURST'), [filtered]);
  const shatters = useMemo(() => filtered.filter((s) => s.fpb_phase === 'SHATTER'), [filtered]);
  // ✦ VaNi Highlight for FPB = the releases (Burst up / Shatter down) — the
  // actionable events. Toggling it isolates "acted today" from the coiling watchlist.
  const releaseCount = bursts.length + shatters.length;
  const setups = useMemo(
    () => (vaniOnly ? [] : filtered.filter((s) => s.fpb_phase === 'SETUP')),
    [filtered, vaniOnly],
  );

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 0', flexWrap: 'wrap', marginBottom: '4px',
      }}>
        {/* FPB is NSE-only — BSE has no delivery/compression depth. */}
        <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={['BSE']} />
        <VaniFilterButton active={vaniOnly} count={releaseCount} onToggle={() => setVaniOnly((f) => !f)} />
        <ScanFilterBar
          presetId="flower_pot_burst"
          stocks={rawStocks}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DownloadXlsButton stocks={filtered} scanName={preset.name} />
          <TradingViewExportButton stocks={filtered} scanName={preset.name} />
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>

      {/* Day-2 position layer — recent releases + hold/crack verdict + SL/target.
          Renders only once km_fpb_active (migration 156) is populated. */}
      {!vaniOnly && <FpbActiveSection />}

      {isLoading ? (
        <DristiQLoader />
      ) : error ? (
        <Card rounded="xxl" className="py-12 text-center">
          <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan.</p>
        </Card>
      ) : viewMode === 'table' ? (
        <ScanTable
          stocks={[...bursts, ...shatters, ...setups]}
          presetId="flower_pot_burst"
          onRowClick={(s) => navigate(`/pulse/equity/${s.equity_id}`)}
        />
      ) : (
        <>
          <ScanSectionLabel>
            🌸 Bursts · {bursts.length} today
          </ScanSectionLabel>
          {bursts.length === 0 ? (
            <div style={{
              padding: '20px 24px', textAlign: 'center', marginBottom: 20,
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
            }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                No coil released upward today. Bursts are rare — historically about twice a month across the NSE
                universe. The coiling setups below are where the next one may come from.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 20 }}>
              {bursts.map((stock) => (
                <div key={stock.equity_id}>
                  <StockCard stock={stock} />
                  <FpbMetricLine stock={stock} />
                </div>
              ))}
            </div>
          )}

          {/* Pot Shatter — the downward release. Only rendered when one fires. */}
          {shatters.length > 0 && (
            <>
              <ScanSectionLabel>
                💥 Flower Pot Shatter · {shatters.length} today
              </ScanSectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 20 }}>
                {shatters.map((stock) => (
                  <div key={stock.equity_id}>
                    <StockCard stock={stock} />
                    <FpbMetricLine stock={stock} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ✦ active isolates the actionable releases — hide the coiling watchlist. */}
          {!vaniOnly && (
            <>
              <ScanSectionLabel>
                Coiling Setups · {setups.length} watching
              </ScanSectionLabel>
              {setups.length === 0 ? (
                <div style={{
                  padding: '20px 24px', textAlign: 'center',
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
                }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    No stocks are tightly coiled right now. Genuine compression — ATR halving, range under 8%,
                    volume dying, relative strength flat — is uncommon; check back after the next few sessions.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {setups.map((stock) => (
                    <div key={stock.equity_id}>
                      <StockCard stock={stock} />
                      <FpbMetricLine stock={stock} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}


// ── Screen 2: Results ──────────────────────────────────────────

// First-visit orientation: 14 presets with no guidance was a documented
// drop-off point ("which scanner do I start with?"). Shown once per browser,
// dismissible; hidden when the user is already on the recommended scan.
const SCAN_HINT_KEY = 'kd_scan_hint_dismissed';

function ScanStartHereHint({ currentPresetId }: { currentPresetId: string }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(SCAN_HINT_KEY) === 'true'; } catch { return true; }
  });

  if (dismissed || currentPresetId === 'power_buy') return null;

  function dismiss() {
    try { localStorage.setItem(SCAN_HINT_KEY, 'true'); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
      padding: '8px 12px', borderRadius: 8,
      background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
        New to scanners? <strong style={{ color: 'var(--gold)' }}>Strength Confluence</strong> is
        the best starting point — stocks where several independent conditions line up at once.
      </span>
      <button
        onClick={() => { dismiss(); navigate('/scanner/power_buy'); }}
        style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
          border: '1px solid var(--gold)', background: 'transparent',
          color: 'var(--gold)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Open it →
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ fontSize: 13, background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '0 2px' }}
      >
        ✕
      </button>
    </div>
  );
}

function ScannerResults({ presetId }: { presetId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timeframe = (searchParams.get('timeframe') ?? 'daily') as ScanTimeframe;
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [sortKey, setSortKey] = useState<SortKey>('score_5d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [oppFilter, setOppFilter] = useState(false);
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useViewMode();

  const { data: presets = SCAN_PRESETS } = useScanPresets();
  const preset = presets.find((p) => p.id === presetId) ?? SCAN_PRESETS.find((p) => p.id === presetId);
  const { data: allCountsData } = useAllScanCounts('combined');
  const allCounts = allCountsData?.counts;
  const isNseOnly = preset?.universe === 'NSE_ONLY' && timeframe !== 'daily';
  const disabledExchangeOptions: ExchangeFilter[] = isNseOnly ? ['combined', 'BSE'] : [];

  const { data: fetchedStocks, isLoading, error } = useScan(
    preset ? presetId : (presets[0]?.id ?? presetId),
    exchangeFilter,
    timeframe,
  );

  // always_true presets are pre-filtered shortlists — every row would carry ✦,
  // so the flag says nothing within this scan. Strip it at the view boundary
  // (the Discovery board consumes the engine flag directly and is unaffected).
  const hideVani = preset?.vani_rule === 'always_true';
  const rawStocks = useMemo(
    () => hideVani && fetchedStocks
      ? fetchedStocks.map((s) => (s.vaniOpportunity ? { ...s, vaniOpportunity: false } : s))
      : fetchedStocks,
    [fetchedStocks, hideVani],
  );

  useEffect(() => { setFilters(DEFAULT_FILTERS); }, [presetId]);
  useEffect(() => { if (typeof window !== 'undefined') (window as any).__scanResults = rawStocks; }, [rawStocks]);

  const stocks = useMemo(() => applyFilters(rawStocks ?? [], filters), [rawStocks, filters]);

  const oppCount = useMemo(
    () => stocks.filter((s) => s.vaniOpportunity).length,
    [stocks],
  );

  const sorted = useMemo(() => {
    let arr = stocks;
    if (oppFilter) arr = arr.filter((s) => s.vaniOpportunity);
    return sortStocks(arr, sortKey, sortDir);
  }, [stocks, sortKey, sortDir, oppFilter]);

  const exportStocks = useMemo(
    () => oppFilter ? stocks.filter((s) => s.vaniOpportunity) : stocks,
    [stocks, oppFilter],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (!preset) return null;

  // Category siblings for tab strip
  const categoryPresets = preset.category
    ? presets.filter((p) => p.category === preset.category)
    : [];

  // Shared header block reused for all presets
  const header = (
    <div style={{ paddingBottom: '0' }}>

      {/* Category tab strip */}
      {categoryPresets.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          marginBottom: '20px', flexWrap: 'wrap',
        }}>
          {categoryPresets.map((p) => {
            const isActive = p.id === presetId;
            const count = allCounts?.[p.id] ?? null;
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/scanner/${p.id}`)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px', borderRadius: '8px',
                  border: `1px solid ${isActive ? preset.category_color : 'var(--border)'}`,
                  background: isActive ? `${preset.category_color}18` : 'transparent',
                  color: isActive ? preset.category_color : 'var(--text-muted)',
                  fontSize: '12px', fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {p.name}
                {count != null && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: isActive ? preset.category_color : 'var(--text-faint)',
                    opacity: 0.8,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Timeframe tabs — weekly/monthly on hold */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', padding: '3px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
            {(['daily', 'weekly', 'monthly'] as const).map((tf) => {
              const isActiveTf = timeframe === tf;
              const isDisabled = tf !== 'daily';
              return (
                <button
                  key={tf}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && navigate(`/scanner/${presetId}?timeframe=${tf}`)}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', border: 'none',
                    background: isActiveTf ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'transparent',
                    color: isActiveTf ? 'var(--text-primary)' : 'var(--text-faint)',
                    fontSize: '11px', fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 500,
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px',
          color: 'var(--text-primary)',
        }}>
          {preset.name}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {preset.description}
        </p>
        {preset.tooltip && preset.tooltip !== preset.description && (
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: 6, maxWidth: 720, lineHeight: 1.55 }}>
            {preset.tooltip}
          </p>
        )}
        <ScanStartHereHint currentPresetId={presetId} />
      </div>
    </div>
  );

  // Stage 2 family — v2 card layout with S2 badge + % ATH
  if (presetId === 'stage_2_leaders' || presetId === 'stage_2_watch') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <Stage2Results preset={preset} timeframe={timeframe} viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>
    );
  }

  // Conviction Flow — custom card layout
  if (presetId === 'conviction_flow') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <ConvictionFlowResults preset={preset} timeframe={timeframe} viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>
    );
  }

  // Flower Pot Burst — two-phase (Bursts / Coiling Setups) layout
  if (presetId === 'flower_pot_burst') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <FpbResults preset={preset} timeframe={timeframe} viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>
    );
  }

  // Breakout Surge — merged scan (single tab), table or custom card layout
  if (presetId === 'breakout_surge') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '12px', flexWrap: 'wrap',
        }}>
          <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={disabledExchangeOptions} />
          {!hideVani && <VaniFilterButton active={oppFilter} count={oppCount} onToggle={() => setOppFilter((f) => !f)} />}
          <ScanFilterBar
            presetId={presetId}
            stocks={rawStocks ?? []}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DownloadXlsButton stocks={exportStocks} scanName={preset.name} />
            <TradingViewExportButton stocks={exportStocks} scanName={preset.name} />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
        {isLoading ? (
          <DristiQLoader />
        ) : error ? (
          <Card rounded="xxl" className="py-12 text-center">
            <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan.</p>
          </Card>
        ) : viewMode === 'table' ? (
          <ScanTable
            stocks={exportStocks}
            presetId={presetId}
            onRowClick={(s) => navigate(`/pulse/equity/${s.equity_id}`)}
          />
        ) : (
          <BreakoutSurgeCards stocks={oppFilter ? exportStocks : sorted} />
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '100px' }}>
      {header}

      {/* Sub-bar: exchange tabs + opp filter + sort */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={disabledExchangeOptions} />
          {!hideVani && <VaniFilterButton active={oppFilter} count={oppCount} onToggle={() => setOppFilter((f) => !f)} />}
          <ScanFilterBar
            presetId={presetId}
            stocks={rawStocks ?? []}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Sort strip — CARD view only: in table view the table's sortable
            headers are the single sort control (these chips were silently
            ignored there and fought the table's internal sort) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {viewMode === 'cards' && (
            <>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-faint)',
                textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
              }}>
                Sort
              </span>
              {SORT_OPTIONS.filter((opt) => !(hideVani && opt.key === 'vaniOpportunity')).map((opt) => {
                const active = sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleSort(opt.key)}
                    style={{
                      padding: '5px 12px', borderRadius: '100px', border: 'none',
                      background: active ? 'var(--indigo-bg)' : 'transparent',
                      color: active ? 'var(--indigo)' : 'var(--text-muted)',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                      outline: active ? '1px solid var(--border-indigo)' : undefined,
                    }}
                  >
                    {opt.label}{active && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                );
              })}
            </>
          )}
          <DownloadXlsButton stocks={exportStocks} scanName={preset.name} />
          <TradingViewExportButton stocks={exportStocks} scanName={preset.name} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <DristiQLoader />
      ) : error ? (
        <Card rounded="xxl" className="py-12 text-center">
          <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan. Check data connection.</p>
        </Card>
      ) : viewMode === 'table' ? (
        sorted.length > 0 ? (
          <ScanTable
            key={presetId}
            stocks={sorted}
            presetId={presetId}
            onRowClick={(s) => navigate(`/pulse/equity/${s.equity_id}`)}
          />
        ) : (
          <div style={{
            padding: '64px 24px', textAlign: 'center',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: 8 }}>
              {oppFilter ? 'No VaNi Highlights in this scan today.' : 'No stocks match this scan criteria today.'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6 }}>
              {oppFilter
                ? 'Try turning the VaNi filter off to see all matches.'
                : 'That can be normal — some conditions only line up a few days a month. Try Strength Confluence for the broadest read, or check back after ~6:30 PM IST on trading days when fresh data lands.'}
            </p>
          </div>
        )
      ) : sorted.length > 0 ? (
        <>
          {(() => {
            const vaniStocks = sorted.filter((s) => s.vaniOpportunity);
            const restStocks = sorted.filter((s) => !s.vaniOpportunity);
            return (
              <>
                {vaniStocks.length > 0 && (
                  <>
                    <ScanSectionLabel>
                      <span style={{ color: 'var(--gold)', marginRight: '6px' }}>✦</span>
                      VaNi Highlight · {vaniStocks.length} stock{vaniStocks.length !== 1 ? 's' : ''}
                    </ScanSectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                      {vaniStocks.map((stock) => (
                        <StockCard key={stock.equity_id} stock={stock} />
                      ))}
                    </div>
                  </>
                )}
                {restStocks.length > 0 && (
                  <>
                    <ScanSectionLabel>
                      All Results · {restStocks.length} stock{restStocks.length !== 1 ? 's' : ''}
                    </ScanSectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {restStocks.map((stock) => (
                        <StockCard key={stock.equity_id} stock={stock} />
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: 8 }}>
            {oppFilter
              ? 'No VaNi Highlights in this scan today.'
              : 'No stocks match this scan criteria today.'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6 }}>
            {oppFilter
              ? 'Try turning the VaNi filter off to see all matches.'
              : 'That can be normal — some conditions only line up a few days a month. Try Strength Confluence for the broadest read, or check back after ~6:30 PM IST on trading days when fresh data lands.'}
          </p>
        </div>
      )}

      {/* Action Island */}
      <ActionIsland>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Showing{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {stocks?.length ?? 0}
          </em>
          {' '}{preset.name} setup{(stocks?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        {oppCount > 0 && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', flexShrink: 0 }} />
            <button
              onClick={() => setOppFilter(true)}
              style={{
                fontSize: '13px', padding: '7px 16px',
                background: 'var(--gold)', color: '#1a1410',
                border: 'none', borderRadius: '100px',
                fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >
              {oppCount} opportunit{oppCount !== 1 ? 'ies' : 'y'}
            </button>
          </>
        )}
      </ActionIsland>
    </div>
  );
}

// ── Router dispatch — sidebar always visible ──────────────────

import React from 'react';

export default function ScanView() {
  const { presetId } = useParams<{ presetId?: string }>();
  const navigate = useNavigate();
  const { data: presets = SCAN_PRESETS } = useScanPresets();
  const { data: allCountsData } = useAllScanCounts('combined');
  const allCounts = allCountsData?.counts;

  // Build category groups
  const categories = useMemo(() => {
    const map = new Map<string, {
      label: string; color: string; sort: number;
      presets: ScanDefinition[];
    }>();
    for (const p of presets) {
      if (!p.category) continue;
      if (!map.has(p.category)) {
        map.set(p.category, { label: p.category_label, color: p.category_color, sort: p.category_sort, presets: [] });
      }
      map.get(p.category)!.presets.push(p);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => a.sort - b.sort)
      .map(([id, val]) => ({
        id,
        ...val,
        // Explicit find — never relies on iteration order or mutable accumulation
        defaultPreset: val.presets.find(p => p.is_default_tab) ?? val.presets[0],
      }));
  }, [presets]);

  // Auto-navigate to first category default tab when URL has no presetId
  useEffect(() => {
    if (!presetId && categories.length > 0) {
      const first = categories[0];
      const target = first.defaultPreset ?? first.presets[0];
      if (target) navigate(`/scanner/${target.id}`, { replace: true });
    }
  }, [presetId, categories, navigate]);

  // Active category = derived from current URL presetId
  const activePreset = presets.find((p) => p.id === presetId);
  const activeCategoryId = activePreset?.category ?? '';

  return (
    <div style={{
      display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden',
      margin: '-24px', height: 'calc(100vh - 46px)',
    }}>
      {/* Left sidebar — always visible */}
      <div style={{
        width: '220px', minWidth: '220px',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto', padding: '14px 0', flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px',
          letterSpacing: '1.5px', textTransform: 'uppercase',
          color: 'var(--text-faint)', padding: '0 14px 10px',
        }}>
          Scanner
        </div>
        {categories.map((cat) => {
          const defaultPreset = cat.defaultPreset ?? cat.presets[0];
          const isActive = cat.id === activeCategoryId;
          // count = default tab count only (4a)
          const catCount = defaultPreset ? (allCounts?.[defaultPreset.id] ?? 0) : 0;
          return (
            <div
              key={cat.id}
              onClick={() => defaultPreset && navigate(`/scanner/${defaultPreset.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', cursor: 'pointer',
                background: isActive ? 'rgba(240,165,0,0.06)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: cat.color, flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '11px',
                letterSpacing: '0.8px', textTransform: 'uppercase', flex: 1,
                color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              }}>
                {cat.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                color: isActive ? 'var(--gold)' : 'var(--text-faint)',
                background: isActive ? 'rgba(240,165,0,0.1)' : 'var(--panel-recess)',
                padding: '1px 6px', borderRadius: '3px',
              }}>
                {catCount > 0 ? catCount : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right panel — scrollable content area + standing disclaimer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {presetId ? (
            <ScannerResults presetId={presetId} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Loader2 style={{ width: '20px', height: '20px', color: 'var(--text-faint)', animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </div>
        {/* Standing disclaimer — always visible, never scrolls away */}
        <div style={{
          flexShrink: 0, padding: '7px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          fontSize: '10.5px', lineHeight: 1.5, color: 'var(--text-faint)',
          textAlign: 'center',
        }}>
          Scans surface observations of market conditions from end-of-day data, for study and education.
          Nothing here is investment advice or a recommendation to buy or sell any security.
        </div>
      </div>
    </div>
  );
}
