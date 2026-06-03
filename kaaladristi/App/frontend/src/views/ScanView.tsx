import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronLeft, Download, Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { useScan, useAllScanCounts, useScanPresets } from '@/hooks/useScan';
import { SCAN_PRESETS, type ExchangeFilter, type ScanTimeframe } from '@/services/scanEngine';
import { StockCard, StageBadge } from '@/components/domain/StockCard';
import { ScanSectionLabel } from '@/components/domain/ScanCardShell';
import ConvictionFlowCards from '@/components/domain/ConvictionFlowTable';
import BreakoutSurgeCards from '@/components/domain/BreakoutSurgeTable';
import { downloadScanXls, type ScanVariant } from '@/utils/downloadXls';
import { useAstroSignal } from '@/hooks/useDashboardExtras';
import { useLastTradingDate } from '@/hooks/useLastTradingDate';
import type { ScanDefinition, ScanStock } from '@/types';

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

// ── Atmospheric line (VaNi section header) ────────────────────

function atmosphericConfig(netScore: number): { color: string; label: string } {
  if (netScore > 2)  return { color: 'var(--teal, #00c9a0)', label: 'Favorable' };
  if (netScore >= -1) return { color: 'var(--caution)',       label: 'Neutral'   };
  return               { color: 'var(--bear)',                label: 'Unfavorable' };
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
  const today = new Date().toISOString().slice(0, 10);
  const { data: ltDate } = useLastTradingDate(today);
  const { data: astro } = useAstroSignal(ltDate ?? today);
  const atm = atmosphericConfig(astro?.net_score ?? 0);

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
        {astro && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', color: atm.color,
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: atm.color, flexShrink: 0 }} />
            Atmospheric · {atm.label}
          </span>
        )}
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

// ── Scanner Hub — left-nav + pills landing ────────────────────

function ScannerHub() {
  const navigate = useNavigate();
  const { data: allCountsData } = useAllScanCounts('combined');
  const { data: presets = SCAN_PRESETS } = useScanPresets();
  const allCounts = allCountsData?.counts;

  // Group presets by category, ordered by category_sort then sort_order
  const categories = useMemo(() => {
    const map = new Map<string, { label: string; color: string; sort: number; presets: ScanDefinition[] }>();
    for (const p of presets) {
      if (!p.category) continue;
      if (!map.has(p.category)) {
        map.set(p.category, { label: p.category_label, color: p.category_color, sort: p.category_sort, presets: [] });
      }
      map.get(p.category)!.presets.push(p);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => a.sort - b.sort)
      .map(([id, val]) => ({ id, ...val }));
  }, [presets]);

  const [activeCatId, setActiveCatId] = useState<string>('');

  // Set first category once presets load
  useEffect(() => {
    if (!activeCatId && categories.length > 0) {
      setActiveCatId(categories[0].id);
    }
  }, [categories, activeCatId]);

  const activeCat = categories.find((c) => c.id === activeCatId) ?? categories[0];
  const pillPresets = activeCat?.presets ?? [];

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', margin: '-24px', height: 'calc(100vh - 46px)' }}>
      {/* Left nav */}
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
          const isActive = cat.id === activeCatId;
          const catCount = cat.presets.reduce((s, p) => s + (allCounts?.[p.id] ?? 0), 0);
          return (
            <div
              key={cat.id}
              onClick={() => setActiveCatId(cat.id)}
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
                {catCount > 0 ? catCount : cat.presets.length}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: pills + grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Pills strip */}
        <div style={{
          background: 'var(--card)', borderBottom: '1px solid var(--border)',
          padding: '0 20px', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', gap: '4px', padding: '10px 0',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {pillPresets.map((p) => {
              const count = allCounts?.[p.id] ?? null;
              const vaniCount = 0; // VaNi count not available from allCounts — shown as 0 until detail view
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/scanner/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '6px 13px', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer',
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: 'var(--text-faint)', background: 'rgba(255,255,255,0.04)',
                    padding: '1px 5px', borderRadius: '3px',
                  }}>
                    {count ?? '…'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {pillPresets.map((preset) => {
              const count = allCounts?.[preset.id] ?? null;
              const isHighRelevance = (count ?? 0) >= 20;
              const isZero = count === 0;
              return (
                <div
                  key={preset.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/scanner/${preset.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/scanner/${preset.id}`)}
                  title={preset.tooltip}
                  style={{
                    background: isHighRelevance ? 'linear-gradient(180deg, var(--gold-bg) 0%, var(--card) 80%)' : 'var(--card)',
                    border: `1px solid ${isHighRelevance ? 'var(--border-gold)' : 'var(--border)'}`,
                    borderLeft: `3px solid ${preset.category_color || 'var(--border)'}`,
                    borderRadius: '12px', padding: '18px 16px',
                    cursor: 'pointer', opacity: isZero ? 0.55 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500,
                    color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.2,
                  }}>
                    {preset.name}
                  </div>
                  <div style={{
                    fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px',
                  }}>
                    {preset.description}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '12px',
                    color: (count ?? 0) > 0 ? 'var(--text-secondary)' : 'var(--text-faint)',
                  }}>
                    {count != null ? `${count} setup${count !== 1 ? 's' : ''} today` : '…'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stage 2 Leaders results ───────────────────────────────────

function Stage2Results({ preset, timeframe }: { preset: ScanDefinition; timeframe: ScanTimeframe }) {
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const disabledExchangeOptions: ExchangeFilter[] = preset.universe === 'NSE_ONLY' ? ['BSE'] : [];
  const { data: stocks = [], isLoading, error } = useScan('stage_2_leaders', exchangeFilter, timeframe);
  const [sortKey, setSortKey] = useState<SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [vaniOnly, setVaniOnly] = useState(false);
  const [mfOpen, setMfOpen] = useState(false);
  const { show: showToast, Toast } = useToast();

  const vaniStocks = useMemo(() => stocks.filter((s) => s.vaniOpportunity), [stocks]);

  const sorted = useMemo(() => {
    let arr = vaniOnly ? stocks.filter((s) => s.vaniOpportunity) : stocks;
    return sortStocks(arr, sortKey, sortDir);
  }, [stocks, sortKey, sortDir, vaniOnly]);

  const vaniSorted = useMemo(() => sortStocks(vaniStocks, sortKey, sortDir), [vaniStocks, sortKey, sortDir]);
  const restSorted = useMemo(() => sorted.filter((s) => !s.vaniOpportunity), [sorted]);

  const exportStocks = useMemo(() => vaniOnly ? vaniStocks : stocks, [stocks, vaniStocks, vaniOnly]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const pctAth = (stock: ScanStock) => {
    const lh = stock.lifetime_high;
    if (!lh || lh <= 0) return null;
    return (stock.close / lh) * 100;
  };

  const athLabel = (stock: ScanStock) => {
    const p = pctAth(stock);
    if (p == null) return null;
    const pctOff = 100 - p;
    return (
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: pctOff < 10 ? 'var(--bull)' : pctOff < 25 ? 'var(--caution)' : 'var(--text-faint)',
      }}>
        {p.toFixed(1)}% of ATH
      </span>
    );
  };

  const renderCard = (stock: ScanStock) => (
    <StockCard
      key={stock.equity_id}
      stock={stock}
      stageBadge="S2"
      extraRight={athLabel(stock)}
    />
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
        <VaniFilterButton active={vaniOnly} count={vaniStocks.length} onToggle={() => setVaniOnly((f) => !f)} />

        {/* Contextual filter chips */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '4px' }}>
          {[
            { label: 'MCap', value: 'All' },
            { label: 'Industry', value: 'All Industries' },
            { label: '% of ATH', value: '75%+' },
            { label: 'Supertrend', value: '▲ Bullish' },
          ].map((f) => (
            <button
              key={f.label}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 9px', background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: '6px',
                fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span style={{ fontSize: '9px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {f.label}
              </span>
              {' '}{f.value} ▾
            </button>
          ))}
        </div>

        {/* More Filters */}
        <button
          onClick={() => setMfOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '5px 9px', borderRadius: '6px', fontSize: '11px',
            color: 'var(--text-muted)', cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--card)',
            fontFamily: 'var(--font-body)',
          }}
        >
          ⚙ More Filters
        </button>

        {/* Sort strip — right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--text-faint)', textTransform: 'uppercase',
            letterSpacing: '0.08em', whiteSpace: 'nowrap',
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
        </div>
      </div>

      {/* VaNi Section */}
      {!vaniOnly && vaniSorted.length > 0 && (
        <div style={{
          marginBottom: '20px',
          border: '1px solid rgba(240,165,0,0.2)', borderRadius: '10px',
          overflow: 'hidden', background: 'rgba(240,165,0,0.015)',
        }}>
          <VaniSectionHeader
            vaniCount={vaniSorted.length}
            scanName={preset.name}
            onAddWidget={() => showToast(`✦ ${preset.name} widget added to Workspace`)}
          />
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {vaniSorted.map(renderCard)}
          </div>
        </div>
      )}

      {/* All Results */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
          <Loader2 style={{ width: '20px', height: '20px', marginRight: '8px', color: 'var(--indigo)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Scanning Stage 2 universe…</span>
        </div>
      ) : error ? (
        <Card rounded="xxl" className="py-12 text-center">
          <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan. Check data connection.</p>
        </Card>
      ) : restSorted.length > 0 ? (
        <>
          {!vaniOnly && (
            <ScanSectionLabel>
              All Results · {restSorted.length} stock{restSorted.length !== 1 ? 's' : ''}
            </ScanSectionLabel>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(vaniOnly ? sorted : restSorted).map(renderCard)}
          </div>
        </>
      ) : !isLoading && sorted.length === 0 ? (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            No Stage 2 setups today. Stage 2 requires SMA_200 data — stocks need 200+ days of history.
          </p>
        </div>
      ) : null}

      {/* More Filters panel */}
      {mfOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
          onClick={() => setMfOpen(false)}
        />
      )}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '320px',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        zIndex: 51, padding: '20px', overflowY: 'auto',
        transform: mfOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
            More Filters
          </span>
          <button
            onClick={() => setMfOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>

        {/* Stage filter */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Stage Filter
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['S2 Only', 'S2 + Candidate'].map((opt, i) => (
              <button key={opt} style={{
                padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: i === 0 ? 'rgba(59,130,246,0.1)' : 'var(--card)',
                border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                color: i === 0 ? '#60a5fa' : 'var(--text-muted)',
              }}>{opt}</button>
            ))}
          </div>
        </div>

        {/* % of ATH */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Min % of ATH
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="range" min={50} max={100} defaultValue={75} style={{ flex: 1, accentColor: 'var(--gold)' }}
              onChange={(e) => (e.currentTarget.nextElementSibling as HTMLElement).textContent = `${e.currentTarget.value}%`}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', minWidth: '36px' }}>75%</span>
          </div>
        </div>

        {/* Supertrend */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Supertrend
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['Bullish ▲', 'Any'].map((opt, i) => (
              <button key={opt} style={{
                padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: i === 0 ? 'rgba(59,130,246,0.1)' : 'var(--card)',
                border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                color: i === 0 ? '#60a5fa' : 'var(--text-muted)',
              }}>{opt}</button>
            ))}
          </div>
        </div>

        {/* RS Zone */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
            RS Zone
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['Strong Bull', 'Mild Bull', 'Neutral', 'Any'].map((opt, i) => (
              <button key={opt} style={{
                padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: i < 2 ? 'rgba(59,130,246,0.1)' : 'var(--card)',
                border: `1px solid ${i < 2 ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                color: i < 2 ? '#60a5fa' : 'var(--text-muted)',
              }}>{opt}</button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setMfOpen(false)}
          style={{
            width: '100%', padding: '9px',
            background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.3)',
            borderRadius: '7px', color: 'var(--gold)', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}
        >
          Apply Filters
        </button>
      </div>

      {/* Action Island */}
      <ActionIsland>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--bull)', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Showing{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {sorted.length}
          </em>
          {' '}Stage 2 setup{sorted.length !== 1 ? 's' : ''}
        </span>
        {vaniSorted.length > 0 && !vaniOnly && (
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
              {vaniSorted.length} opportunit{vaniSorted.length !== 1 ? 'ies' : 'y'}
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

function ConvictionFlowResults({ preset, timeframe }: { preset: ScanDefinition; timeframe: ScanTimeframe }) {

  const totalSetups = useMemo(
    () => Object.values(allCounts ?? {}).reduce((s, n) => s + n, 0),
    [allCounts],
  );
  const activePresets = useMemo(
    () => Object.values(allCounts ?? {}).filter((n) => n > 0).length,
    [allCounts],
  );

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 500,
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '8px',
          color: 'var(--text-primary)',
        }}>
          Scanner{' '}
          <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>
            · thesis search
          </em>
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Eight condition-convergence presets, arranged against today's market structure.
        </p>
      </div>

      {/* Preset grid — 3 columns, taller cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {presets.map((preset) => {
          const count = allCounts?.[preset.id] ?? null;
          const rel = count != null ? getRelevance(count) : 1;
          const bar = REL_BAR[rel];
          const isHighRelevance = rel >= 3;
          const isLowRelevance = rel === 0;
          const hasResults = (count ?? 0) > 0;

          return (
            <div
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/scanner/${preset.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/scanner/${preset.id}`)}
              title={preset.tooltip}
              style={{
                background: isHighRelevance
                  ? 'linear-gradient(180deg, var(--gold-bg) 0%, var(--card) 80%)'
                  : 'var(--card)',
                border: `1px solid ${isHighRelevance ? 'var(--border-gold)' : 'var(--border)'}`,
                borderRadius: '14px',
                padding: '22px 18px 18px',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                opacity: isLowRelevance ? 0.55 : 1,
                transition: 'all 0.2s',
              }}
            >
              {/* Preset name — 18px Fraunces */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 500,
                color: isHighRelevance ? 'var(--text-primary)' : 'var(--text-secondary)',
                lineHeight: 1.2,
                marginBottom: '10px',
              }}>
                {preset.name}
              </div>

              {/* Description */}
              <div style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                marginBottom: '16px',
              }}>
                {preset.description}
              </div>

              {/* Match count */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: hasResults ? 'var(--text-secondary)' : 'var(--text-faint)',
                marginBottom: '14px',
              }}>
                {count != null ? `${count} setup${count !== 1 ? 's' : ''} today` : '…'}
              </div>

              {/* D / W / M dot row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* D — Daily: clickable, gold if has results */}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/scanner/${preset.id}`); }}
                  title={`Daily · ${count ?? 0} setup${(count ?? 0) !== 1 ? 's' : ''} as of ${latestDate ?? '…'}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: hasResults ? 'var(--gold)' : 'var(--text-faint)',
                    opacity: hasResults ? 1 : 0.35,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                    color: hasResults ? 'var(--gold)' : 'var(--text-faint)',
                    opacity: hasResults ? 1 : 0.5,
                  }}>
                    D
                  </span>
                </button>

                {/* W — Weekly */}
                {preset.universe === 'NSE_ONLY' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/scanner/${preset.id}?timeframe=weekly`); }}
                    title="Weekly scan"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: 'var(--indigo)', opacity: 0.7 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--indigo)', opacity: 0.8 }}>W</span>
                  </button>
                ) : (
                  <span title="Weekly · coming soon" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: 'transparent', border: '1px solid var(--border-strong)', opacity: 0.35 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-faint)', opacity: 0.4 }}>W</span>
                  </span>
                )}

                {/* M — Monthly */}
                {preset.universe === 'NSE_ONLY' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/scanner/${preset.id}?timeframe=monthly`); }}
                    title="Monthly scan"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: 'var(--indigo)', opacity: 0.7 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--indigo)', opacity: 0.8 }}>M</span>
                  </button>
                ) : (
                  <span title="Monthly · coming soon" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: 'transparent', border: '1px solid var(--border-strong)', opacity: 0.35 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-faint)', opacity: 0.4 }}>M</span>
                  </span>
                )}
              </div>

              {/* Relevance bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0,
                width: bar.width, height: '2px', borderRadius: '2px',
                background: bar.color, opacity: bar.opacity,
              }} />
            </div>
          );
        })}
      </div>

      {/* Action Island */}
      <ActionIsland>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          VaNi is watching{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {allCounts ? totalSetups : '…'} setup{totalSetups !== 1 ? 's' : ''}
          </em>
          {' '}across{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {activePresets}
          </em>
          {' '}preset{activePresets !== 1 ? 's' : ''} today
        </span>
      </ActionIsland>
    </div>
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

  const { data: presets = SCAN_PRESETS } = useScanPresets();
  const preset = presets.find((p) => p.id === presetId);
  const isNseOnly = preset?.universe === 'NSE_ONLY' && timeframe !== 'daily';
  const disabledExchangeOptions: ExchangeFilter[] = isNseOnly ? ['combined', 'BSE'] : [];

  const { data: stocks, isLoading, error } = useScan(
    preset ? presetId : (presets[0]?.id ?? presetId),
    exchangeFilter,
    timeframe,
  );

  const oppCount = useMemo(
    () => (stocks ?? []).filter((s) => s.vaniOpportunity).length,
    [stocks],
  );

  const sorted = useMemo(() => {
    let arr = stocks ?? [];
    if (oppFilter) arr = arr.filter((s) => s.vaniOpportunity);
    return sortStocks(arr, sortKey, sortDir);
  }, [stocks, sortKey, sortDir, oppFilter]);

  const exportStocks = useMemo(
    () => oppFilter ? (stocks ?? []).filter((s) => s.vaniOpportunity) : (stocks ?? []),
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

  // Redirect to landing if presetId is not recognized
  useEffect(() => {
    if (!preset) navigate('/scanner', { replace: true });
  }, [preset, navigate]);

  if (!preset) return null;

  // Shared header block reused for all presets including conviction_flow
  const header = (
    <div style={{ paddingBottom: '0' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/scanner')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-muted)', fontSize: '13px',
            fontFamily: 'var(--font-body)', transition: 'color 0.15s',
          }}
        >
          <ChevronLeft style={{ width: '14px', height: '14px' }} />
          Scanner
        </button>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 500,
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px',
          color: 'var(--text-primary)',
        }}>
          {preset.name}{' '}
          <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>
            · {timeframe === 'weekly' ? 'Weekly' : timeframe === 'monthly' ? 'Monthly' : 'Daily'}
          </em>
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {preset.description}
        </p>
      </div>
    </div>
  );

  // Stage 2 Leaders — v2 card layout with S2 badge + % ATH
  if (presetId === 'stage_2_leaders') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <Stage2Results preset={preset} timeframe={timeframe} />
      </div>
    );
  }

  // Conviction Flow — custom card layout
  if (presetId === 'conviction_flow') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <ConvictionFlowResults preset={preset} timeframe={timeframe} />
      </div>
    );
  }

  // Breakout Surge — custom card layout
  if (presetId === 'breakout_surge') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <BreakoutSurgeResults preset={preset} timeframe={timeframe} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/scanner')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-muted)', fontSize: '13px',
            fontFamily: 'var(--font-body)', transition: 'color 0.15s',
          }}
        >
          <ChevronLeft style={{ width: '14px', height: '14px' }} />
          Scanner
        </button>
      </div>

      {/* Heading */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 500,
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px',
          color: 'var(--text-primary)',
        }}>
          {preset.name}{' '}
          <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>
            · {timeframe === 'weekly' ? 'Weekly' : timeframe === 'monthly' ? 'Monthly' : 'Daily'}
          </em>
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {preset.description}
        </p>
      </div>

      {/* Sub-bar: exchange tabs + opp filter + sort */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <ExchangeTabs value={exchangeFilter} onChange={setExchangeFilter} disabledOptions={disabledExchangeOptions} />
          <VaniFilterButton active={oppFilter} count={oppCount} onToggle={() => setOppFilter((f) => !f)} />
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
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
          <Loader2 style={{ width: '20px', height: '20px', marginRight: '8px', color: 'var(--indigo)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Scanning market…</span>
        </div>
      ) : error ? (
        <Card rounded="xxl" className="py-12 text-center">
          <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan. Check data connection.</p>
        </Card>
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

// ── Router dispatch ───────────────────────────────────────────

import React from 'react';

export default function ScanView() {
  const { presetId } = useParams<{ presetId?: string }>();
  if (!presetId) return <ScannerHub />;
  return <ScannerResults presetId={presetId} />;
}
