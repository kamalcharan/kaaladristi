import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui';
import { useScan, useAllScanCounts } from '@/hooks/useScan';
import { SCAN_PRESETS, type ExchangeFilter } from '@/services/scanEngine';
import { StockCard } from '@/components/domain/StockCard';
import ConvictionFlowCards from '@/components/domain/ConvictionFlowTable';
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

// ── Screen 1: Landing grid ─────────────────────────────────────

function ScannerLanding() {
  const navigate = useNavigate();
  const { data: allCountsData } = useAllScanCounts('combined');
  const allCounts = allCountsData?.counts;
  const latestDate = allCountsData?.latestDate ?? null;

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
          Seven condition-convergence presets, arranged against today's market structure.
        </p>
      </div>

      {/* Preset grid — 3 columns, taller cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {SCAN_PRESETS.map((preset) => {
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

                {/* W — Weekly: coming soon */}
                <span
                  title="Weekly · coming soon"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}
                >
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: 'transparent',
                    border: '1px solid var(--border-strong)',
                    opacity: 0.35,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                    color: 'var(--text-faint)', opacity: 0.4,
                  }}>
                    W
                  </span>
                </span>

                {/* M — Monthly: coming soon */}
                <span
                  title="Monthly · coming soon"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}
                >
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: 'transparent',
                    border: '1px solid var(--border-strong)',
                    opacity: 0.35,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
                    color: 'var(--text-faint)', opacity: 0.4,
                  }}>
                    M
                  </span>
                </span>
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

function ConvictionFlowResults({ preset }: { preset: ScanDefinition }) {
  const { data: stocks = [], isLoading, error } = useScan('conviction_flow');
  const [sortKey, setSortKey] = useState<CFSortKey>('delivery_surge_x');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [vaniOnly, setVaniOnly] = useState(false);

  const vaniCount = useMemo(() => stocks.filter((s) => s.vaniOpportunity).length, [stocks]);

  const sorted = useMemo(() => {
    let arr = vaniOnly ? stocks.filter((s) => s.vaniOpportunity) : stocks;
    return sortCFStocks(arr, sortKey, sortDir);
  }, [stocks, sortKey, sortDir, vaniOnly]);

  const toggleSort = (key: CFSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  return (
    <>
      {/* Sub-bar: sort + filters */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '12px', flexWrap: 'wrap',
      }}>
        {/* Left: VaNi toggle + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setVaniOnly((f) => !f)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px',
              background: vaniOnly ? 'var(--gold)' : 'transparent',
              border: '1px solid var(--border-gold)',
              color: vaniOnly ? '#1a1410' : 'var(--gold)',
              borderRadius: '100px',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)', transition: 'all 0.2s',
              boxShadow: vaniOnly ? '0 0 16px rgba(212,168,75,0.3)' : undefined,
            }}
          >
            <span style={{ fontSize: '10px', lineHeight: 1 }}>✦</span>
            VaNi Opportunity
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              padding: '1px 6px', borderRadius: '100px',
              background: 'rgba(0,0,0,0.2)',
              color: vaniOnly ? '#1a1410' : undefined,
            }}>
              {vaniCount}
            </span>
          </button>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            Delivery value surge · all exchanges
          </span>
        </div>

        {/* Right: sort strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--text-faint)', textTransform: 'uppercase',
            letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>
            Sort
          </span>
          {CF_SORT_OPTIONS.map((opt) => {
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
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
          <Loader2 style={{ width: '20px', height: '20px', marginRight: '8px', color: 'var(--indigo)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Running conviction flow scan…</span>
        </div>
      ) : error ? (
        <Card rounded="xxl" className="py-12 text-center">
          <p style={{ fontSize: '13px', color: 'var(--bear)' }}>Failed to run scan. Check data connection.</p>
        </Card>
      ) : (
        <ConvictionFlowCards stocks={sorted} />
      )}

      {/* Action Island */}
      <ActionIsland>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Showing{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {sorted.length}
          </em>
          {' '}Conviction Flow setup{sorted.length !== 1 ? 's' : ''}
        </span>
        {vaniCount > 0 && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
            <button
              onClick={() => setVaniOnly(true)}
              style={{
                fontSize: '13px', padding: '7px 16px',
                background: 'var(--gold)', color: '#1a1410',
                border: 'none', borderRadius: '100px',
                fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
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

// ── Screen 2: Results ──────────────────────────────────────────

function ScannerResults({ presetId }: { presetId: string }) {
  const navigate = useNavigate();
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [sortKey, setSortKey] = useState<SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [oppFilter, setOppFilter] = useState(false);

  const preset = SCAN_PRESETS.find((p) => p.id === presetId);

  const { data: stocks, isLoading, error } = useScan(
    preset ? presetId : SCAN_PRESETS[0].id,
    exchangeFilter,
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
            · Daily
          </em>
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {preset.description}
        </p>
      </div>
    </div>
  );

  // Conviction Flow uses server-side RPC + its own table layout
  if (presetId === 'conviction_flow') {
    return (
      <div style={{ paddingBottom: '100px' }}>
        {header}
        <ConvictionFlowResults preset={preset} />
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
            · Daily
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
          {/* Exchange tabs */}
          <div style={{
            display: 'flex', gap: '2px', padding: '4px',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '100px',
          }}>
            {(['combined', 'NSE', 'BSE'] as ExchangeFilter[]).map((ex) => (
              <button
                key={ex}
                onClick={() => setExchangeFilter(ex)}
                style={{
                  padding: '6px 16px', borderRadius: '100px', border: 'none',
                  background: exchangeFilter === ex ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: exchangeFilter === ex ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                }}
              >
                {ex === 'combined' ? 'Combined' : ex}
              </button>
            ))}
          </div>

          {/* VaNi Opportunity filter */}
          <button
            onClick={() => setOppFilter((f) => !f)}
            title="Show only setups that pass today's VaNi opportunity policy"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '7px 14px',
              background: oppFilter ? 'var(--gold)' : 'transparent',
              border: '1px solid var(--border-gold)',
              color: oppFilter ? '#1a1410' : 'var(--gold)',
              borderRadius: '100px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)', transition: 'all 0.2s',
              boxShadow: oppFilter ? '0 0 20px rgba(212,168,75,0.3)' : undefined,
            }}
          >
            <span style={{ fontSize: '11px', lineHeight: 1 }}>✦</span>
            VaNi Opportunity
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10.5px',
              padding: '2px 7px', borderRadius: '100px', marginLeft: '2px',
              background: 'rgba(0,0,0,0.2)',
              color: oppFilter ? '#1a1410' : undefined,
            }}>
              {oppCount}
            </span>
          </button>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sorted.map((stock) => (
              <StockCard key={stock.equity_id} stock={stock} />
            ))}
          </div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-faint)' }}>
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
              {oppFilter && ' · VaNi Opportunity filter active'}
            </span>
          </div>
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
  if (!presetId) return <ScannerLanding />;
  return <ScannerResults presetId={presetId} />;
}
