import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronLeft, Download, Copy, Check } from 'lucide-react';
import { Card, DristiQLoader } from '@/components/ui';
import { useScan, useAllScanCounts, useScanPresets } from '@/hooks/useScan';
import { SCAN_PRESETS, type ExchangeFilter, type ScanTimeframe } from '@/services/scanEngine';
import { StockCard, StageBadge } from '@/components/domain/StockCard';
import { ScanSectionLabel } from '@/components/domain/ScanCardShell';
import ScanTable from '@/components/domain/ScanTable';
import ConvictionFlowCards from '@/components/domain/ConvictionFlowTable';
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable';
import { downloadScanXls, type ScanVariant } from '@/utils/downloadXls';
import type { ScanDefinition, ScanStock } from '@/types';
import AtmosphericBadge from '@/components/domain/AtmosphericBadge';
import { ScanFilterBar, applyFilters, EMPTY_FILTERS, type ScanFilters } from '@/components/domain/ScanFilterBar';

// ── Sort ──────────────────────────────────────────────────────

type SortKey = 'magic_rs' | 'rsi_14' | 'rvol' | 'pct_chng' | 'reward' | 'symbol' | 'vaniOpportunity';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'vaniOpportunity', label: '✦ VaNi Opportunity' },
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
              background: value === ex ? 'rgba(255,255,255,0.06)' : 'transparent',
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
        boxShadow: active ? '0 0 16px rgba(212,168,75,0.3)' : undefined,
      }}
    >
      <span style={{ fontSize: '10px', lineHeight: 1 }}>✦</span>
      VaNi Opportunity
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        padding: '1px 6px', borderRadius: '100px',
        background: 'rgba(0,0,0,0.2)',
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
            background: value === mode ? 'rgba(255,255,255,0.06)' : 'transparent',
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
      background: 'rgba(11,17,32,0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--border-strong)',
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
        style={{ ...btnBase, color: copied ? 'var(--bull)' : 'var(--text-muted)', borderColor: copied ? 'rgba(74,222,128,0.4)' : 'var(--border)' }}
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
          <span>✦</span> VaNi Opportunity
          <span style={{
            background: 'rgba(240,165,0,0.12)', color: 'var(--gold2, #ffd166)',
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
  const [filters, setFilters] = useState<ScanFilters>(EMPTY_FILTERS);
  const { show: showToast, Toast } = useToast();

  const { data: rawStocks = [], isLoading, error, refetch } = useScan(preset.id, exchangeFilter, timeframe);

  useEffect(() => { setFilters(EMPTY_FILTERS); }, [preset.id]);

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
      background: 'linear-gradient(90deg, var(--card) 25%, rgba(255,255,255,0.03) 50%, var(--card) 75%)',
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
        <VaniFilterButton active={vaniOnly} count={vaniCount} onToggle={() => setVaniOnly((f) => !f)} />
        <ScanFilterBar
          presetId={preset.id}
          stocks={rawStocks}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Sort strip — right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
              padding: '6px 16px', background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px',
              color: '#60a5fa', fontSize: '12px', cursor: 'pointer',
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
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
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
  const [filters, setFilters] = useState<ScanFilters>(EMPTY_FILTERS);
  const { data: rawStocks = [], isLoading, error } = useScan('conviction_flow', exchangeFilter, timeframe);
  const { show: showToast, Toast } = useToast();
  const stocks = useMemo(() => applyFilters(rawStocks, filters), [rawStocks, filters]);
  const vaniCount = useMemo(() => stocks.filter((s) => s.vaniOpportunity).length, [stocks]);

  return (
    <>
      {Toast}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 0', flexWrap: 'wrap', marginBottom: '4px',
      }}>
        <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={[]} />
        <ScanFilterBar
          presetId="conviction_flow"
          stocks={rawStocks}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
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


// ── Screen 2: Results ──────────────────────────────────────────

function ScannerResults({ presetId }: { presetId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timeframe = (searchParams.get('timeframe') ?? 'daily') as ScanTimeframe;
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [sortKey, setSortKey] = useState<SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [oppFilter, setOppFilter] = useState(false);
  const [filters, setFilters] = useState<ScanFilters>(EMPTY_FILTERS);
  const [viewMode, setViewMode] = useViewMode();

  const { data: presets = SCAN_PRESETS } = useScanPresets();
  const preset = presets.find((p) => p.id === presetId) ?? SCAN_PRESETS.find((p) => p.id === presetId);
  const { data: allCountsData } = useAllScanCounts('combined');
  const allCounts = allCountsData?.counts;
  const isNseOnly = preset?.universe === 'NSE_ONLY' && timeframe !== 'daily';
  const disabledExchangeOptions: ExchangeFilter[] = isNseOnly ? ['combined', 'BSE'] : [];

  const { data: rawStocks, isLoading, error } = useScan(
    preset ? presetId : (presets[0]?.id ?? presetId),
    exchangeFilter,
    timeframe,
  );

  useEffect(() => { setFilters(EMPTY_FILTERS); }, [presetId]);
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
                    background: isActiveTf ? 'rgba(255,255,255,0.06)' : 'transparent',
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
      </div>
    </div>
  );

  // Stage 2 family — v2 card layout with S2 badge + % ATH
  if (presetId === 'stage_2_leaders' || presetId === 'stage_2_watch' || presetId === 'vani_opportunity') {
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

  // Breakout Surge — table or custom card layout
  if (presetId === 'breakout_surge' || presetId === 'breakout_surge_daily') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '12px', flexWrap: 'wrap',
        }}>
          <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={disabledExchangeOptions} />
          <ScanFilterBar
            presetId={presetId}
            stocks={rawStocks ?? []}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <div style={{ marginLeft: 'auto' }}>
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
            stocks={stocks}
            presetId={presetId}
            onRowClick={(s) => navigate(`/pulse/equity/${s.equity_id}`)}
          />
        ) : (
          <BreakoutSurgeCards stocks={stocks} />
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
          <VaniFilterButton active={oppFilter} count={oppCount} onToggle={() => setOppFilter((f) => !f)} />
          <ScanFilterBar
            presetId={presetId}
            stocks={rawStocks ?? []}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Sort strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>
            Sort
          </span>
          {SORT_OPTIONS.map((opt) => {
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
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {oppFilter ? 'No VaNi Opportunity setups in this scan today.' : 'No stocks match this scan criteria today.'}
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
                      VaNi Opportunity · {vaniStocks.length} stock{vaniStocks.length !== 1 ? 's' : ''}
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
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {oppFilter
              ? 'No VaNi Opportunity setups in this scan today.'
              : 'No stocks match this scan criteria today.'}
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
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
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
        background: 'var(--sidebar-bg, var(--card))',
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
                background: isActive ? 'rgba(240,165,0,0.1)' : 'var(--bg3, rgba(255,255,255,0.04))',
                padding: '1px 6px', borderRadius: '3px',
              }}>
                {catCount > 0 ? catCount : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right panel — scrollable content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {presetId ? (
          <ScannerResults presetId={presetId} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Loader2 style={{ width: '20px', height: '20px', color: 'var(--text-faint)', animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>
    </div>
  );
}
