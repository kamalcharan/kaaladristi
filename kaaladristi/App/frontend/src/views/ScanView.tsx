import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { useScan, useAllScanCounts } from '@/hooks/useScan';
import { SCAN_PRESETS, type ExchangeFilter } from '@/services/scanEngine';
import { StockCard } from '@/components/domain/StockCard';
import type { ScanStock } from '@/types';

// ── Sort ──────────────────────────────────────────────────────

type SortKey = 'magic_rs' | 'rsi_14' | 'rvol' | 'pct_chng' | 'reward' | 'symbol';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'magic_rs', label: 'RS' },
  { key: 'rvol',     label: 'RVOL' },
  { key: 'reward',   label: 'Reward' },
  { key: 'pct_chng', label: '% Chg' },
  { key: 'rsi_14',   label: 'RSI' },
  { key: 'symbol',   label: 'Symbol' },
];

function sortStocks(stocks: ScanStock[], key: SortKey, dir: SortDir): ScanStock[] {
  const arr = [...stocks];
  arr.sort((a, b) => {
    let va: string | number = 0;
    let vb: string | number = 0;
    switch (key) {
      case 'symbol':   va = a.symbol;          vb = b.symbol;          break;
      case 'pct_chng': va = a.pct_chng ?? 0;   vb = b.pct_chng ?? 0;   break;
      case 'magic_rs': va = a.magic_rs ?? 0;   vb = b.magic_rs ?? 0;   break;
      case 'rsi_14':   va = a.rsi_14 ?? 0;     vb = b.rsi_14 ?? 0;     break;
      case 'rvol':     va = a.rvol ?? 0;       vb = b.rvol ?? 0;       break;
      case 'reward':   va = a.rewardPct ?? -99; vb = b.rewardPct ?? -99; break;
    }
    if (typeof va === 'string') {
      return dir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    }
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
  return arr;
}

// ── Relevance bar from count ──────────────────────────────────

function getRelevance(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 5) return 1;
  if (count <= 14) return 2;
  if (count <= 20) return 3;
  return 4;
}

const REL_BAR: Record<number, { width: string; color: string }> = {
  0: { width: '10%', color: 'var(--text-faint)' },
  1: { width: '30%', color: 'var(--text-muted)' },
  2: { width: '55%', color: 'var(--caution)' },
  3: { width: '80%', color: 'var(--gold)' },
  4: { width: '100%', color: 'var(--gold)' },
};

// ── Main View ─────────────────────────────────────────────────

export default function ScanView() {
  const [activeScan, setActiveScan] = useState(SCAN_PRESETS[0].id);
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('combined');
  const [sortKey, setSortKey] = useState<SortKey>('magic_rs');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [oppFilter, setOppFilter] = useState(false);

  const { data: stocks, isLoading, error } = useScan(activeScan, exchangeFilter);
  const { data: allCounts } = useAllScanCounts(exchangeFilter);

  const oppCount = useMemo(() => (stocks ?? []).filter((s) => s.vaniOpportunity).length, [stocks]);

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

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px', color: 'var(--text-primary)' }}>
          Scanner <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>· thesis search</em>
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Six condition-convergence presets, arranged against today's market structure.
        </p>
      </div>

      {/* Preset tile grid — 3 columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '20px',
      }}>
        {SCAN_PRESETS.map((preset) => {
          const count = allCounts?.[preset.id] ?? null;
          const rel = count != null ? getRelevance(count) : 1;
          const bar = REL_BAR[rel];
          const isActive = activeScan === preset.id;
          const isHighRelevance = rel >= 3;
          const isLowRelevance = rel === 0;

          return (
            <div
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveScan(preset.id)}
              onKeyDown={(e) => e.key === 'Enter' && setActiveScan(preset.id)}
              title={preset.tooltip}
              style={{
                background: isHighRelevance && !isActive
                  ? `linear-gradient(180deg, var(--gold-bg) 0%, var(--card) 80%)`
                  : 'var(--card)',
                border: `1px solid ${isActive ? 'var(--indigo)' : isHighRelevance ? 'var(--border-gold)' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '14px 14px 13px',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                opacity: isLowRelevance && !isActive ? 0.55 : 1,
                boxShadow: isActive ? '0 0 0 3px rgba(129,140,248,0.15)' : undefined,
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14.5px',
                fontWeight: 500,
                color: isActive || isHighRelevance ? 'var(--text-primary)' : 'var(--text-secondary)',
                lineHeight: 1.15,
                marginBottom: '8px',
              }}>
                {preset.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: isActive ? 'var(--indigo-strong)' : 'var(--text-muted)',
                }}>
                  {count != null ? `${count} match${count !== 1 ? 'es' : ''}` : '…'}
                  {isActive && ' · active'}
                </span>
              </div>
              {/* Relevance bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0,
                width: bar.width, height: '2px',
                borderRadius: '2px',
                background: bar.color,
                opacity: rel === 0 ? 0.3 : rel === 1 ? 0.4 : rel === 2 ? 0.6 : 1,
              }} />
            </div>
          );
        })}
      </div>

      {/* Sub-bar: exchange tabs + opp filter + sort */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
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
              border: `1px solid var(--border-gold)`,
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
              padding: '2px 7px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '100px', marginLeft: '2px',
              color: oppFilter ? '#1a1410' : undefined,
            }}>
              {oppCount}
            </span>
          </button>
        </div>

        {/* Sort strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Sort</span>
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
                {opt.label}
                {active && (sortDir === 'asc' ? ' ↑' : ' ↓')}
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
              {oppFilter && ` · VaNi Opportunity filter active`}
            </span>
          </div>
        </>
      ) : (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '16px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {oppFilter
              ? 'No VaNi Opportunity setups in this scan today.'
              : 'No stocks match this scan criteria today.'}
          </p>
        </div>
      )}

      {/* Action Island */}
      <div style={{
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        transform: 'translateX(calc(-50% + 110px))',
        background: 'rgba(11,17,32,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-strong)',
        borderRadius: '100px',
        padding: '10px 14px 10px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--indigo)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
          VaNi is watching{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {stocks?.length ?? 0} setup{(stocks?.length ?? 0) !== 1 ? 's' : ''}
          </em>
        </div>
        {oppCount > 0 && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)' }} />
            <button
              onClick={() => setOppFilter(true)}
              style={{
                fontSize: '13px', padding: '7px 16px',
                background: 'var(--gold)', color: '#1a1410',
                border: 'none', borderRadius: '100px',
                fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {oppCount} opportunit{oppCount !== 1 ? 'ies' : 'y'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
