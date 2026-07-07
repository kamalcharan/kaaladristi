import { useState, useMemo } from 'react';
import { ArrowLeft, Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIndexBreakdown } from '@/hooks';

interface Props {
  indexId: number;
  indexName: string;
  onBack: () => void;
}

export default function IndexBreakdown({ indexId, indexName, onBack }: Props) {
  const { data: constituents = [], isLoading } = useIndexBreakdown(indexId);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<'symbol' | 'industry' | 'weight'>('symbol');
  const [sortAsc, setSortAsc] = useState(true);

  // Flatten joined equity data
  const rows = useMemo(() =>
    constituents.map(c => ({
      id: c.id,
      equityId: c.equity_id,
      symbol: c.km_equity_symbols?.symbol ?? '—',
      companyName: c.km_equity_symbols?.company_name ?? '',
      industry: c.km_equity_symbols?.industry ?? 'Unknown',
      isFno: c.km_equity_symbols?.is_fno ?? false,
      weightPct: c.weight_pct,
      sector: c.sector,
    })),
    [constituents]
  );

  // Industry breakdown (group by industry, count stocks)
  const industryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const ind = r.industry || 'Unknown';
      map.set(ind, (map.get(ind) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([industry, count]) => ({ industry, count, pct: (count / rows.length) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  // Filtered & sorted rows
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = rows.filter(r =>
      !q || r.symbol.toLowerCase().includes(q) || r.companyName.toLowerCase().includes(q) || r.industry.toLowerCase().includes(q)
    );
    result.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortCol === 'industry') cmp = a.industry.localeCompare(b.industry);
      else if (sortCol === 'weight') cmp = (a.weightPct ?? 0) - (b.weightPct ?? 0);
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [rows, search, sortCol, sortAsc]);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) => {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
        <span className="text-sm text-muted">Loading breakdown...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Index Data
      </button>

      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
          {indexName}
        </h2>
        <p className="text-sm text-secondary">
          {rows.length} constituents &middot; {industryBreakdown.length} industries
        </p>
      </header>

      {/* Industry Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-kd-surface border border-kd-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Industry Breakdown</h3>
          <div className="flex flex-col gap-2.5">
            {industryBreakdown.slice(0, 12).map(({ industry, count, pct }) => (
              <div key={industry} className="flex items-center gap-3">
                <span className="text-[11px] text-[var(--text-secondary)] w-[160px] truncate shrink-0">{industry}</span>
                <div className="flex-1 h-5 bg-kd-elevated rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-accent-indigo/40 to-accent-indigo flex items-center justify-end px-2"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  >
                    <span className="text-[10px] font-semibold text-[var(--text-primary)]">{count}</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted mono w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
              </div>
            ))}
            {industryBreakdown.length > 12 && (
              <p className="text-[10px] text-muted mt-1">+ {industryBreakdown.length - 12} more industries</p>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="bg-kd-surface border border-kd-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-kd-elevated rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-accent-indigo mono">{rows.length}</div>
              <div className="text-[10px] text-muted mt-1">Total Stocks</div>
            </div>
            <div className="bg-kd-elevated rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-accent-violet mono">{industryBreakdown.length}</div>
              <div className="text-[10px] text-muted mt-1">Industries</div>
            </div>
            <div className="bg-kd-elevated rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-risk-green mono">{rows.filter(r => r.isFno).length}</div>
              <div className="text-[10px] text-muted mt-1">F&O Stocks</div>
            </div>
            <div className="bg-kd-elevated rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-risk-amber mono">
                {rows.filter(r => r.industry === 'Unknown').length}
              </div>
              <div className="text-[10px] text-muted mt-1">Unclassified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stocks..."
            className="w-full pl-9 pr-3 py-2 bg-kd-elevated border border-kd-border rounded-xl text-xs text-[var(--text-primary)] placeholder:text-muted focus:outline-none focus:border-accent-indigo/60 transition-colors"
          />
        </div>
        <span className="text-xs text-muted">{filtered.length} stocks</span>
      </div>

      {/* Constituent Table */}
      <div className="bg-kd-surface border-2 border-kd-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-kd-border bg-kd-elevated/50 text-[10px] text-muted font-semibold uppercase tracking-wider">
          <span className="w-8 text-center">#</span>
          <button onClick={() => handleSort('symbol')} className="flex-1 min-w-[120px] text-left hover:text-[var(--text-primary)] transition-colors">
            Symbol <SortIcon col="symbol" />
          </button>
          <span className="hidden md:inline w-[200px]">Company</span>
          <button onClick={() => handleSort('industry')} className="w-[160px] text-left hover:text-[var(--text-primary)] transition-colors hidden sm:inline-flex items-center">
            Industry <SortIcon col="industry" />
          </button>
          <span className="w-12 text-center">F&O</span>
          <button onClick={() => handleSort('weight')} className="w-16 text-right hover:text-[var(--text-primary)] transition-colors">
            Weight <SortIcon col="weight" />
          </button>
        </div>

        {/* Rows */}
        {filtered.map((row, i) => (
          <div
            key={row.id}
            className="flex items-center gap-3 px-4 py-2 border-b border-kd-border last:border-b-0 hover:bg-kd-elevated/40 transition-all"
          >
            <span className="w-8 text-center text-[10px] text-muted mono">{i + 1}</span>
            <div className="flex-1 min-w-[120px]">
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">{row.symbol}</span>
            </div>
            <span className="hidden md:inline w-[200px] text-[11px] text-[var(--text-secondary)] truncate">
              {row.companyName}
            </span>
            <span className="w-[160px] hidden sm:inline">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-kd-elevated border border-kd-border text-[var(--text-secondary)]">
                {row.industry}
              </span>
            </span>
            <span className="w-12 text-center">
              {row.isFno && (
                <span className="text-[9px] px-1.5 py-px rounded bg-risk-green/10 border border-risk-green/20 text-risk-green font-semibold">
                  F&O
                </span>
              )}
            </span>
            <span className="w-16 text-right text-[11px] mono text-[var(--text-secondary)]">
              {row.weightPct != null ? `${row.weightPct.toFixed(2)}%` : '—'}
            </span>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted">No stocks match your search.</p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted mt-3 text-right mono">
        {rows.length} constituents &middot; snapshot {constituents[0]?.snapshot_date || '—'}
      </p>
    </div>
  );
}
